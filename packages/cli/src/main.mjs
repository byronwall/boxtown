import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ProductGridClient } from "./client.mjs";
import {
  getConfigPath,
  readConfig,
  resolveProjectId,
  resolveServer,
  resolveToken,
  updateConfig,
} from "./config.mjs";
import { CliError, exitCodes } from "./errors.mjs";
import {
  pickNodeColumns,
  pickProjectColumns,
  pickTaskColumns,
  writeJson,
  writeTable,
} from "./output.mjs";
import { packageVersion } from "./version.mjs";

export async function main(argv = process.argv, io = defaultIo()) {
  const parsed = parseArgs(argv.slice(2));
  if (parsed.help || parsed.command.length === 0) {
    io.stdout.write(helpText());
    return;
  }
  if (isVersionCommand(parsed.command)) {
    io.stdout.write(`${packageVersion}\n`);
    return;
  }
  if (isConfigPathCommand(parsed.command)) {
    io.stdout.write(`${getConfigPath(io.env)}\n`);
    return;
  }

  const config = await readConfig();
  const server = resolveServer(parsed.options, config, io.env);
  const token = resolveToken(parsed.options, config, server, io.env);
  const projectId = resolveProjectId(parsed.options, config, io.env);
  const client = new ProductGridClient({ server, token });
  const context = { parsed, config, server, token, projectId, client, io };
  await dispatch(context);
}

async function dispatch(context) {
  const [scope, action, subaction] = context.parsed.command;

  if (scope === "auth") {
    return dispatchAuth(context, action);
  }

  if (scope === "project") {
    return dispatchProject(context, action);
  }

  if (scope === "node") {
    return dispatchNode(context, action);
  }

  if (scope === "image") {
    return dispatchImage(context, action);
  }

  if (scope === "task") {
    return dispatchTask(context, action);
  }

  if (scope === "skill") {
    return dispatchSkill(context, action);
  }

  if (scope === "help") {
    context.io.stdout.write(helpText());
    return;
  }

  throw new CliError(`Unknown command: ${[scope, action, subaction].filter(Boolean).join(" ")}`, exitCodes.usage);
}

async function dispatchAuth(context, action) {
  if (action === "login") {
    const token = requireOption(context.parsed.options.token, "--token is required.");
    const server = context.server;
    await updateConfig((config) => ({
      ...config,
      defaultServer: server,
      tokens: {
        ...(config.tokens ?? {}),
        [server]: token,
      },
    }));

    writeMaybeJson(context, {
      server,
      tokenSuffix: token.slice(-6),
    }, `Logged in to ${server} with token ending ${token.slice(-6)}.\n`);
    return;
  }

  if (action === "status") {
    const status = {
      server: context.server,
      authenticated: Boolean(context.token),
      tokenSuffix: context.token ? context.token.slice(-6) : null,
      currentProjectId: context.projectId,
    };

    if (context.parsed.options.json) {
      writeJson(status, context.io.stdout);
    } else {
      context.io.stdout.write(`Server: ${status.server}\n`);
      context.io.stdout.write(`Authenticated: ${status.authenticated ? "yes" : "no"}\n`);
      context.io.stdout.write(`Project: ${status.currentProjectId ?? "(none)"}\n`);
    }
    return;
  }

  if (action === "logout") {
    await updateConfig((config) => {
      const tokens = { ...(config.tokens ?? {}) };
      delete tokens[context.server];
      return { ...config, tokens };
    });
    writeMaybeJson(context, { server: context.server, loggedOut: true }, `Logged out of ${context.server}.\n`);
    return;
  }

  throw new CliError("Usage: pgm auth <login|status|logout>", exitCodes.usage);
}

async function dispatchProject(context, action) {
  if (action === "list") {
    const projects = await context.client.listProjects();
    if (context.parsed.options.json) {
      writeJson({ projects }, context.io.stdout);
    } else {
      writeTable(projects, pickProjectColumns(), context.io.stdout);
    }
    return;
  }

  if (action === "create") {
    const name = context.parsed.options.name ?? context.parsed.positionals.join(" ");
    const project = await context.client.createProject({
      ...(typeof name === "string" && name.trim().length > 0 ? { name } : {}),
    });
    const linked = Boolean(context.parsed.options.link);

    if (linked) {
      await updateConfig((config) => ({
        ...config,
        defaultServer: context.server,
        currentProjectId: project.id,
      }));
    }

    const result = {
      project,
      linked,
      projectId: project.id,
      name: project.name,
      server: context.server,
    };

    if (context.parsed.options.json) {
      writeJson(result, context.io.stdout);
    } else {
      context.io.stdout.write(`Created ${project.name} (${project.id}).\n`);
      if (linked) {
        context.io.stdout.write(`Linked ${project.id} on ${context.server}.\n`);
      } else {
        context.io.stdout.write(`Use next: pgm project link ${project.id}\n`);
      }
    }
    return;
  }

  if (action === "view") {
    const projectId = context.parsed.positionals[0] ?? context.projectId;
    requireOption(projectId, "A project id is required. Pass one or run pgm project link <id>.");
    const project = await context.client.getProject(projectId);
    if (context.parsed.options.json) {
      writeJson({ project }, context.io.stdout);
    } else {
      context.io.stdout.write(`${project.name} (${project.id})\n`);
      context.io.stdout.write(`${project.description}\n`);
      context.io.stdout.write(`Nodes: ${project.nodeCount}  Links: ${project.linkCount}\n`);
      context.io.stdout.write(`Updated: ${project.updatedAt}\n`);
    }
    return;
  }

  if (action === "export-markdown") {
    const projectId = context.parsed.positionals[0] ?? context.projectId;
    requireOption(projectId, "A project id is required. Pass one or run pgm project link <id>.");
    const markdown = await context.client.exportProjectMarkdown(projectId);
    const output = context.parsed.options.output;
    if (typeof output === "string" && output.trim().length > 0) {
      const outputPath = resolveInputPath(output, context.io.cwd);
      await writeFile(outputPath, markdown, "utf8");
      if (context.parsed.options.json) {
        writeJson({ projectId, output: outputPath }, context.io.stdout);
      } else {
        context.io.stdout.write(`Exported markdown for ${projectId} to ${outputPath}.\n`);
      }
    } else if (context.parsed.options.json) {
      writeJson({ projectId, markdown }, context.io.stdout);
    } else {
      context.io.stdout.write(markdown);
    }
    return;
  }

  if (action === "link") {
    const projectId = requireOption(context.parsed.positionals[0], "A project id is required.");
    await updateConfig((config) => ({
      ...config,
      defaultServer: context.server,
      currentProjectId: projectId,
    }));
    writeMaybeJson(context, { server: context.server, projectId }, `Linked ${projectId} on ${context.server}.\n`);
    return;
  }

  if (action === "current") {
    const current = { server: context.server, projectId: context.projectId };
    if (context.parsed.options.json) {
      writeJson(current, context.io.stdout);
    } else {
      context.io.stdout.write(`Server: ${current.server}\nProject: ${current.projectId ?? "(none)"}\n`);
    }
    return;
  }

  if (action === "unlink") {
    await updateConfig((config) => ({ ...config, currentProjectId: null }));
    writeMaybeJson(context, { unlinked: true }, "Unlinked current project.\n");
    return;
  }

  throw new CliError("Usage: pgm project <list|create|view|export-markdown|link|current|unlink>", exitCodes.usage);
}

async function dispatchNode(context, action) {
  const projectId = requireProject(context);
  const handlers = {
    list: dispatchNodeList,
    view: dispatchNodeView,
    create: dispatchNodeCreate,
    update: dispatchNodeUpdate,
    move: dispatchNodeMove,
    context: dispatchNodeContext,
    metadata: dispatchNodeMetadata,
    "import-markdown": dispatchNodeImportMarkdown,
  };
  const handler = handlers[action];
  if (!handler) {
    throw new CliError("Usage: pgm node <list|view|create|update|move|context|metadata|import-markdown>", exitCodes.usage);
  }

  await handler(context, projectId);
}

async function dispatchNodeList(context, projectId) {
  const nodes = await context.client.listNodes(projectId, {
    status: context.parsed.options.status,
    type: context.parsed.options.type,
    search: context.parsed.options.search,
  });
  if (context.parsed.options.json) {
    writeJson({ nodes }, context.io.stdout);
  } else {
    writeTable(nodes, pickNodeColumns(), context.io.stdout);
  }
}

async function dispatchNodeView(context, projectId) {
  const nodeId = requireOption(context.parsed.positionals[0], "A node id is required.");
  if (context.parsed.options.withAncestors || context.parsed.options.withContext) {
    const contextTree = await context.client.getNodeContextTree(projectId, nodeId);
    if (context.parsed.options.json) {
      writeJson(contextTree, context.io.stdout);
    } else {
      writeContextTreeSummary(contextTree, context.io.stdout);
    }
    return;
  }

  const node = await context.client.getNode(projectId, nodeId);
  if (context.parsed.options.json) {
    writeJson({ node }, context.io.stdout);
    return;
  }

  context.io.stdout.write(`${node.label} (${node.id})\n`);
  context.io.stdout.write(`Status: ${node.status}\nType: ${node.type}\nImages: ${node.images.length}\n`);
  if (node.context) {
    context.io.stdout.write(`\n${node.context}\n`);
  }
}

async function dispatchNodeCreate(context, projectId) {
  const title = context.parsed.options.title ?? context.parsed.options.label ?? context.parsed.positionals.join(" ");
  requireOption(title, "A node title is required. Pass --title <title> or a positional title.");
  const contextText = await readOptionalTextInput(context.parsed.options.contextFile, context.io.cwd);
  const result = await context.client.createNode(projectId, {
    title,
    type: context.parsed.options.type,
    status: context.parsed.options.status,
    parentNodeId: context.parsed.options.parent ?? context.parsed.options.parentNodeId ?? null,
    context: contextText,
    metadata: parseMetadataJson(context.parsed.options.metadataJson),
  });

  if (context.parsed.options.json) {
    writeJson(result, context.io.stdout);
    return;
  }

  context.io.stdout.write(`Created ${result.node?.label ?? title} (${result.nodeId}).\n`);
  if (result.parentLink) {
    context.io.stdout.write(`Parent: ${result.parentLink.source}\n`);
  }
}

async function dispatchNodeUpdate(context, projectId) {
  const nodeId = requireOption(context.parsed.positionals[0], "A node id is required.");
  const input = {};
  if (context.parsed.options.title !== undefined) {
    input.title = context.parsed.options.title;
  }
  if (context.parsed.options.label !== undefined) {
    input.label = context.parsed.options.label;
  }
  if (context.parsed.options.status !== undefined) {
    input.status = context.parsed.options.status;
  }
  if (context.parsed.options.type !== undefined) {
    input.type = context.parsed.options.type;
  }
  if (Object.keys(input).length === 0) {
    throw new CliError("At least one of --title, --status, or --type is required.", exitCodes.usage);
  }
  const result = await context.client.updateNode(projectId, nodeId, input);
  writeNodeMutationResult(context, result, "Updated");
}

async function dispatchNodeMove(context, projectId) {
  const nodeId = requireOption(context.parsed.positionals[0], "A node id is required.");
  const hasRoot = Boolean(context.parsed.options.root);
  const parentNodeId = hasRoot
    ? null
    : requireOption(
      context.parsed.options.parent ?? context.parsed.options.parentNodeId,
      "A parent node id is required. Pass --parent <node-id> or --root.",
    );
  const result = await context.client.moveNode(projectId, nodeId, { parentNodeId });
  if (context.parsed.options.json) {
    writeJson(result, context.io.stdout);
  } else {
    context.io.stdout.write(`Moved ${result.node.label} (${result.node.id}).\n`);
    context.io.stdout.write(`Parent: ${result.parentLink?.source ?? "(root)"}\n`);
  }
}

async function dispatchNodeContext(context, projectId) {
  const nodeId = requireOption(context.parsed.positionals[0], "A node id is required.");
  const subaction = context.parsed.command[2];
  if (subaction === "get") {
    const result = await context.client.getNodeContext(projectId, nodeId);
    if (context.parsed.options.json) {
      writeJson(result, context.io.stdout);
    } else {
      context.io.stdout.write(`${result.context}\n`);
    }
    return;
  }
  if (subaction === "set") {
    const file = requireOption(context.parsed.options.file, "--file <path> is required.");
    const contextText = await readFile(resolveInputPath(file, context.io.cwd), "utf8");
    const result = await context.client.setNodeContext(projectId, nodeId, contextText);
    writeNodeMutationResult(context, result, "Updated context for");
    return;
  }
  throw new CliError("Usage: pgm node context <get|set> <node-id>", exitCodes.usage);
}

async function dispatchNodeMetadata(context, projectId) {
  const nodeId = requireOption(context.parsed.positionals[0], "A node id is required.");
  const subaction = context.parsed.command[2];
  if (subaction === "get") {
    const result = await context.client.getNodeMetadata(projectId, nodeId);
    if (context.parsed.options.json) {
      writeJson(result, context.io.stdout);
    } else {
      writeJson(result.metadata, context.io.stdout);
    }
    return;
  }
  if (subaction === "set") {
    const key = requireOption(context.parsed.positionals[1], "A metadata key is required.");
    const value = requireOption(context.parsed.positionals[2] ?? context.parsed.options.value, "A metadata value is required.");
    const result = await context.client.patchNodeMetadata(projectId, nodeId, {
      set: { [key]: value },
    });
    writeNodeMutationResult(context, result, "Updated metadata for");
    return;
  }
  if (subaction === "unset") {
    const key = requireOption(context.parsed.positionals[1], "A metadata key is required.");
    const result = await context.client.patchNodeMetadata(projectId, nodeId, {
      unset: [key],
    });
    writeNodeMutationResult(context, result, "Updated metadata for");
    return;
  }
  throw new CliError("Usage: pgm node metadata <get|set|unset> <node-id>", exitCodes.usage);
}

async function dispatchNodeImportMarkdown(context, projectId) {
  const file = requireOption(
    context.parsed.options.file ?? context.parsed.positionals[0],
    "A markdown file is required. Pass --file <path> or a positional file path.",
  );
  const filePath = resolveInputPath(file, context.io.cwd);
  const markdown = await readFile(filePath, "utf8");
  const title = context.parsed.options.title ?? context.parsed.options.label ?? titleFromFile(filePath);
  const metadata = parseMetadataJson(context.parsed.options.metadataJson);
  const result = await context.client.importMarkdown(projectId, {
    title,
    markdown,
    metadata,
    splitByHeadingLevel: Boolean(
      context.parsed.options.splitHeadings ?? context.parsed.options.splitByHeadingLevel,
    ),
    maxHeadingDepth: parseOptionalInteger(context.parsed.options.maxHeadingDepth, "--max-heading-depth"),
  });

  if (context.parsed.options.json) {
    writeJson(result, context.io.stdout);
  } else {
    context.io.stdout.write(
      `Imported ${result.import.createdNodeCount} node${result.import.createdNodeCount === 1 ? "" : "s"} from ${file}.\n`,
    );
    context.io.stdout.write(`Root: ${result.import.rootNodeId}\n`);
    context.io.stdout.write(`Nodes: ${result.import.createdNodeIds.join(", ")}\n`);
  }
}

async function dispatchImage(context, action) {
  const projectId = requireProject(context);

  if (action === "add") {
    const nodeId = requireOption(context.parsed.positionals[0], "A node id is required.");
    const imagePaths = context.parsed.positionals.slice(1).map((item) => resolveInputPath(item, context.io.cwd));
    if (imagePaths.length === 0) {
      throw new CliError("At least one image path is required.", exitCodes.usage);
    }

    const result = await context.client.addNodeImages(projectId, nodeId, imagePaths);
    if (context.parsed.options.json) {
      writeJson(result, context.io.stdout);
    } else {
      context.io.stdout.write(
        `Added ${result.imageCount} image${result.imageCount === 1 ? "" : "s"} to ${nodeId}.\n`,
      );
      for (const image of result.images) {
        context.io.stdout.write(`${image.id}  ${image.originalName}\n`);
      }
    }
    return;
  }

  if (action === "list") {
    const nodeId = requireOption(context.parsed.positionals[0], "A node id is required.");
    const result = await context.client.listNodeImages(projectId, nodeId);
    if (context.parsed.options.json) {
      writeJson(result, context.io.stdout);
    } else {
      writeTable(result.images, [
        { header: "ID", value: (row) => row.id },
        { header: "NAME", value: (row) => row.originalName },
        { header: "MIME", value: (row) => row.mimeType },
        { header: "CREATED", value: (row) => row.createdAt?.slice(0, 10) },
      ], context.io.stdout);
    }
    return;
  }

  if (action === "remove") {
    const nodeId = requireOption(context.parsed.positionals[0], "A node id is required.");
    const imageId = requireOption(context.parsed.positionals[1], "An image id is required.");
    const result = await context.client.removeNodeImage(projectId, nodeId, imageId);
    if (context.parsed.options.json) {
      writeJson(result, context.io.stdout);
    } else {
      context.io.stdout.write(`Removed ${result.removedImageId} from ${nodeId}.\n`);
      context.io.stdout.write(`Images remaining: ${result.imageCount}\n`);
    }
    return;
  }

  throw new CliError("Usage: pgm image <add|list|remove>", exitCodes.usage);
}

async function dispatchTask(context, action) {
  const projectId = requireProject(context);

  if (action === "list") {
    const include = getTaskIncludeOption(context.parsed.options);
    const tasks = await context.client.listTasks(projectId, {
      status: context.parsed.options.status,
      type: context.parsed.options.type,
      search: context.parsed.options.search,
      include,
    });
    if (context.parsed.options.json) {
      writeJson({ tasks }, context.io.stdout);
    } else if (include === "context") {
      writeTaskContextList(tasks, context.io.stdout);
    } else {
      writeTable(tasks, pickTaskColumns(), context.io.stdout);
    }
    return;
  }

  if (action === "view") {
    const nodeId = requireOption(context.parsed.positionals[0], "A task/node id is required.");
    const include = context.parsed.options.withAncestors && !context.parsed.options.withContext
      ? "ancestors"
      : "context";
    const task = await context.client.getTask(projectId, nodeId, { include });
    if (context.parsed.options.json) {
      writeJson(task, context.io.stdout);
    } else if ("inheritedContext" in task) {
      writeContextTreeSummary(task, context.io.stdout);
    } else {
      writeTable([task.task], pickTaskColumns(), context.io.stdout);
    }
    return;
  }

  if (action === "export-context") {
    const nodeId = requireOption(context.parsed.positionals[0], "A task/node id is required.");
    const task = await context.client.getTask(projectId, nodeId, { include: "context" });
    const markdown = formatTaskContextMarkdown(task);
    const output = context.parsed.options.output;
    if (typeof output === "string" && output.trim().length > 0) {
      const outputPath = resolveInputPath(output, context.io.cwd);
      await writeFile(outputPath, markdown, "utf8");
      if (context.parsed.options.json) {
        writeJson({ projectId, nodeId, output: outputPath }, context.io.stdout);
      } else {
        context.io.stdout.write(`Exported task context for ${nodeId} to ${outputPath}.\n`);
      }
    } else if (context.parsed.options.json) {
      writeJson({ projectId, nodeId, markdown }, context.io.stdout);
    } else {
      context.io.stdout.write(markdown);
    }
    return;
  }

  throw new CliError("Usage: pgm task <list|view|export-context>", exitCodes.usage);
}

async function dispatchSkill(context, action) {
  const {
    getBundledSkillPath,
    installBundledSkill,
    readBundledSkillMarkdown,
  } = await import("./skill.mjs");

  if (action === "path") {
    context.io.stdout.write(`${getBundledSkillPath()}\n`);
    return;
  }

  if (action === "print") {
    context.io.stdout.write(await readBundledSkillMarkdown());
    return;
  }

  if (action === "install") {
    const result = await installBundledSkill({
      agent: context.parsed.options.agent ?? "codex",
      global: Boolean(context.parsed.options.global),
      cwd: context.io.cwd,
      force: Boolean(context.parsed.options.force),
    });

    writeMaybeJson(
      context,
      result,
      `Installed ${result.skill} for ${result.agent} (${result.scope}) at ${result.target}.\n`,
    );
    return;
  }

  throw new CliError("Usage: pgm skill <path|print|install>", exitCodes.usage);
}

export function parseArgs(args) {
  const options = {};
  const command = [];
  const positionals = [];
  let help = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--version" || arg === "-v") {
      command.push("version");
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }

    if (arg === "--json") {
      options.json = true;
      continue;
    }

    if (arg.startsWith("--")) {
      const [rawKey, inlineValue] = arg.slice(2).split("=", 2);
      const value = parseOptionValue(rawKey, inlineValue, args[index + 1]);
      if (!booleanOptionNames.has(rawKey) && inlineValue === undefined && value !== true) {
        index += 1;
      }
      options[toCamelCase(rawKey)] = value;
      continue;
    }

    if (command.length < getCommandPartLimit(command)) {
      command.push(arg);
      continue;
    }

    positionals.push(arg);
  }

  return { command, positionals, options, help };
}

const booleanOptionNames = new Set([
  "force",
  "global",
  "json",
  "link",
  "root",
  "split-by-heading-level",
  "split-headings",
  "with-ancestors",
  "with-context",
]);

function parseOptionValue(rawKey, inlineValue, nextValue) {
  if (booleanOptionNames.has(rawKey)) {
    return inlineValue === undefined ? true : parseBooleanValue(inlineValue);
  }

  return inlineValue ?? (nextValue && !nextValue.startsWith("--") ? nextValue : true);
}

function parseBooleanValue(value) {
  const normalized = String(value).trim().toLowerCase();
  return !(normalized === "false" || normalized === "0" || normalized === "no");
}

function getCommandPartLimit(command) {
  if (command[0] === "node" && (command[1] === "context" || command[1] === "metadata")) {
    return 3;
  }
  return 2;
}

function isVersionCommand(command) {
  return command.length === 1 && command[0] === "version";
}

function isConfigPathCommand(command) {
  return command.length === 2 && command[0] === "config" && command[1] === "path";
}

function requireProject(context) {
  return requireOption(
    context.projectId,
    "A project id is required. Use --project <id>, PRODUCT_GRID_PROJECT, or pgm project link <id>.",
  );
}

function requireOption(value, message) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new CliError(message, exitCodes.usage);
  }
  return value;
}

function parseMetadataJson(value) {
  if (value === undefined || value === null || value === "") {
    return {};
  }

  try {
    const parsed = JSON.parse(String(value));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("metadata must be an object");
    }
    return parsed;
  } catch (error) {
    throw new CliError(
      `--metadata-json must be a JSON object. ${error instanceof Error ? error.message : ""}`.trim(),
      exitCodes.usage,
    );
  }
}

async function readOptionalTextInput(file, cwd) {
  if (typeof file !== "string" || file.trim().length === 0) {
    return undefined;
  }

  return readFile(resolveInputPath(file, cwd), "utf8");
}

function writeNodeMutationResult(context, result, verb) {
  if (context.parsed.options.json) {
    writeJson(result, context.io.stdout);
  } else {
    context.io.stdout.write(`${verb} ${result.node.label} (${result.node.id}).\n`);
  }
}

function parseOptionalInteger(value, flagName) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new CliError(`${flagName} must be a positive integer.`, exitCodes.usage);
  }

  return parsed;
}

function getTaskIncludeOption(options) {
  if (options.withContext) {
    return "context";
  }
  if (options.withAncestors) {
    return "ancestors";
  }
  return undefined;
}

function writeContextTreeSummary(value, stdout) {
  const item = "task" in value ? value.task : value.node;
  stdout.write(`${item.title ?? item.label} (${item.id})\n`);
  stdout.write(`Path: ${value.inheritedContext.titlePath || "(none)"}\n`);
  stdout.write(`Status: ${item.status}\nType: ${item.type}\n`);
  stdout.write(`Context blocks: ${value.inheritedContext.contextBlocks.length}\n`);
  stdout.write(`Metadata blocks: ${value.inheritedContext.metadata.length}\n`);
  stdout.write(`Images: ${value.inheritedContext.images.length}\n`);
  if (value.inheritedContext.missingContext) {
    stdout.write("No direct or inherited context found.\n");
  }
}

function writeTaskContextList(tasks, stdout) {
  if (tasks.length === 0) {
    stdout.write("No results.\n");
    return;
  }

  for (const taskContext of tasks) {
    stdout.write(`${taskContext.inheritedContext.titlePath} (${taskContext.task.id})\n`);
    const blockCount =
      taskContext.inheritedContext.metadata.length +
      taskContext.inheritedContext.contextBlocks.length +
      taskContext.inheritedContext.rawContextBlocks.length;
    stdout.write(`  ${taskContext.task.status} ${taskContext.task.type}; context blocks: ${blockCount}; images: ${taskContext.inheritedContext.images.length}\n`);
  }
}

function formatTaskContextMarkdown(taskContext) {
  const { task, path: taskPath, inheritedContext } = taskContext;
  const ancestors = taskPath.slice(0, -1);
  const leaf = taskPath.at(-1);
  const sections = [
    `# Task Context: ${task.title}`,
    "",
    `Path: ${inheritedContext.titlePath}`,
    `Status: ${task.status}`,
    `Type: ${task.type}`,
    "",
  ];

  sections.push("## Ancestor Requirements", "");
  if (ancestors.length === 0) {
    sections.push("None.", "");
  } else {
    for (const node of ancestors) {
      sections.push(formatContextNodeMarkdown(node), "");
    }
  }

  sections.push("## Leaf Task", "");
  if (leaf) {
    sections.push(formatContextNodeMarkdown(leaf), "");
  }

  sections.push("## Implementation Notes For Agent", "");
  if (!inheritedContext.hasDirectContext) {
    sections.push("- This task has no direct context.");
  }
  if (inheritedContext.hasInheritedContext) {
    sections.push("- Use inherited context from ancestor nodes.");
  }
  if (inheritedContext.missingContext) {
    sections.push("- No direct or inherited context is available; inspect siblings or ask for clarification before broad changes.");
  }
  if (
    inheritedContext.hasDirectContext ||
    inheritedContext.hasInheritedContext ||
    inheritedContext.missingContext
  ) {
    return `${sections.join("\n").trimEnd()}\n`;
  }

  sections.push("- Review the path and scoped task before implementation.");
  return `${sections.join("\n").trimEnd()}\n`;
}

function formatContextNodeMarkdown(node) {
  const lines = [
    `### ${node.title}`,
    "",
    `ID: ${node.id}`,
    `Type: ${node.type}`,
    `Status: ${node.status}`,
    "",
    "Metadata:",
    ...formatMetadataLines(node.metadata),
    "",
    "Context:",
    node.context.trim() || "none",
    "",
    "Raw context:",
    node.rawContext.trim() || "none",
    "",
    `Images: ${node.images.length === 0 ? "none" : node.images.map((image) => image.originalName).join(", ")}`,
  ];

  return lines.join("\n");
}

function formatMetadataLines(metadata) {
  const entries = Object.entries(metadata ?? {}).filter(([, value]) => value.trim().length > 0);
  if (entries.length === 0) {
    return ["none"];
  }

  return entries.map(([key, value]) => `- ${key}: ${value}`);
}

function resolveInputPath(value, cwd) {
  return path.isAbsolute(value) ? value : path.resolve(cwd, value);
}

function titleFromFile(filePath) {
  const basename = path.basename(filePath, path.extname(filePath));
  return basename
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim() || "Imported Markdown";
}

function writeMaybeJson(context, jsonValue, humanValue) {
  if (context.parsed.options.json) {
    writeJson(jsonValue, context.io.stdout);
  } else {
    context.io.stdout.write(humanValue);
  }
}

function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function defaultIo() {
  return {
    stdout: process.stdout,
    stderr: process.stderr,
    env: process.env,
    cwd: process.cwd(),
  };
}

function helpText() {
  return `Product Grid CLI

Usage:
  pgm auth login --token <token> [--server http://localhost:3000]
  pgm auth status [--json]
  pgm project list [--json]
  pgm project create ["Project name"] [--name "Project name"] [--link] [--json]
  pgm project view [project-id] [--json]
  pgm project export-markdown [project-id] [--output ./project.md] [--json]
  pgm project link <project-id>
  pgm node list [--project <project-id>] [--status blocked] [--type feature] [--search text] [--json]
  pgm node view <node-id> [--project <project-id>] [--with-ancestors|--with-context] [--json]
  pgm node create --title "Checkout" [--type page] [--parent <node-id>] [--context-file ./context.md] [--metadata-json '{"purpose":"..."}'] [--json]
  pgm node update <node-id> [--title "Checkout"] [--status working] [--type page] [--json]
  pgm node move <node-id> (--parent <node-id> | --root) [--json]
  pgm node context get <node-id> [--json]
  pgm node context set <node-id> --file ./context.md [--json]
  pgm node metadata get <node-id> [--json]
  pgm node metadata set <node-id> <key> <value> [--json]
  pgm node metadata unset <node-id> <key> [--json]
  pgm node import-markdown --file <path> [--title "Notes"] [--split-headings] [--max-heading-depth 2] [--metadata-json '{"purpose":"..."}'] [--json]
  pgm image add <node-id> <image-path...> [--project <project-id>] [--json]
  pgm image list <node-id> [--project <project-id>] [--json]
  pgm image remove <node-id> <image-id> [--project <project-id>] [--json]
  pgm task list [--project <project-id>] [--status blocked] [--type task] [--search text] [--with-ancestors|--with-context] [--json]
  pgm task view <node-id> [--project <project-id>] [--json]
  pgm task export-context <node-id> [--project <project-id>] [--output ./task-context.md] [--json]
  pgm skill install [--agent codex] [--global] [--force]
  pgm skill path
  pgm skill print

Global options:
  --server <url>       Server URL. Defaults to PRODUCT_GRID_SERVER or http://localhost:3000.
  --project <id>       Project ID. Defaults to PRODUCT_GRID_PROJECT or linked project.
  --token <token>      Bearer token. Defaults to PRODUCT_GRID_TOKEN or stored token.
  --json               Print machine-readable JSON to stdout.

Context guidance:
  Prefer task/node search and --with-context over project view --json.
  project view --json returns the full graph and can be very large.
`;
}
