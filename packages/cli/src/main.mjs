import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn as spawnProcess } from "node:child_process";
import { ProductGridClient } from "./client.mjs";
import { downloadNodeImages, imageExtension } from "./image-download.mjs";
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
  writeJson,
  writeTable,
} from "./output.mjs";
import {
  readJsonInput,
  readOptionalTextInput,
  requireOption,
  requireProject,
  resolveInputPath,
  writeMaybeJson,
} from "./cli-helpers.mjs";
import { dispatchSchemaEnsureField } from "./schema-commands.mjs";
import { notifyIfUpdateAvailable } from "./update-check.mjs";
import { packageName, packageVersion } from "./version.mjs";

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
  if (isUpdateCommand(parsed.command)) {
    await dispatchUpdate({ parsed, io });
    return;
  }

  if (parsed.command[0] === "viewer") {
    if (parsed.command.length !== 1 || parsed.positionals.length > 0) {
      throw new CliError("Usage: pgm viewer [--data-dir <folder>] [--no-open] [--port <port>]", exitCodes.usage);
    }
    const { runViewer } = await import("../build/local-runtime.mjs");
    await runViewer(parsed.options, io);
    return;
  }

  if (parsed.options.local !== undefined) {
    const { dispatchLocal } = await import("../build/local-runtime-sharing.mjs");
    await dispatchLocal(parsed, io, async (runtime) => {
      const client = new ProductGridClient({ server: runtime.url, token: runtime.token });
      const context = {
        parsed,
        config: null,
        server: runtime.url,
        token: runtime.token,
        projectId: parsed.options.project ?? null,
        client,
        io,
      };
      await dispatch(context);
    });
    return;
  }

  if (!parsed.options.json) {
    await notifyIfUpdateAvailable(io);
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

  if (scope === "issue") {
    return dispatchIssue(context, action);
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

async function dispatchUpdate(context) {
  const command = getUpdateCommand();
  const result = {
    packageName,
    currentVersion: packageVersion,
    command: command.join(" "),
    dryRun: Boolean(context.parsed.options.dryRun),
  };

  if (context.parsed.options.dryRun) {
    writeMaybeJson(context, result, `${result.command}\n`);
    return;
  }

  if (!context.parsed.options.json) {
    context.io.stdout.write(`Updating pgm with: ${result.command}\n`);
  }

  const exitCode = await runUpdateCommand(command, context.io);
  if (exitCode !== 0) {
    throw new CliError(`pgm update failed with exit code ${exitCode}.`, exitCode);
  }

  writeMaybeJson(context, { ...result, exitCode }, "pgm update completed.\n");
}

export function getUpdateCommand() {
  return ["npm", "install", "-g", `${packageName}@latest`];
}

async function runUpdateCommand(command, io) {
  const spawnImpl = io.spawn ?? spawnProcess;
  const child = spawnImpl(command[0], command.slice(1), {
    cwd: io.cwd,
    env: io.env,
    stdio: "inherit",
  });

  return new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => resolve(typeof code === "number" ? code : 1));
  });
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

  if (action === "schema" && context.parsed.positionals[0] === "ensure-field") {
    return dispatchSchemaEnsureField(context);
  }

  if (action === "schema") {
    const projectId = context.parsed.positionals[0] ?? context.projectId;
    requireOption(projectId, "A project id is required. Pass one or run pgm project link <id>.");
    const schema = await context.client.getProjectSchema(projectId);
    if (context.parsed.options.json) {
      writeJson({ schema }, context.io.stdout);
    } else {
      context.io.stdout.write(`${schema.name} (${schema.projectId})\n`);
      context.io.stdout.write(`Statuses: ${schema.statuses.map((status) => status.value).join(", ")}\n`);
      context.io.stdout.write(`Node types: ${schema.nodeTypes.map((type) => type.name).join(", ")}\n`);
      context.io.stdout.write(`Metadata fields: ${schema.metadataFields.map((field) => field.key).join(", ")}\n`);
    }
    return;
  }

  if (action === "history") {
    const projectId = context.parsed.positionals[0] ?? context.projectId;
    requireOption(projectId, "A project id is required. Pass one or run pgm project link <id>.");
    const options = context.parsed.options;
    const page = await context.client.getProjectHistory(projectId, {
      limit: parseOptionalInteger(options.limit, "--limit"),
      before: options.before,
      nodeId: options.node,
    });
    if (options.json) {
      writeJson(page, context.io.stdout);
    } else {
      for (const entry of page.entries) {
        const actor = entry.actor?.label ?? entry.actor?.kind ?? "unknown";
        context.io.stdout.write(`${entry.createdAt}  ${entry.kind}  ${actor}  ${entry.summary}\n`);
      }
      if (page.nextCursor) context.io.stdout.write(`Older entries: --before ${page.nextCursor}\n`);
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

  throw new CliError("Usage: pgm project <list|create|view|schema|history|export-markdown|link|current|unlink>", exitCodes.usage);
}

async function dispatchNode(context, action) {
  const projectId = requireProject(context);
  const handlers = {
    list: dispatchNodeList,
    view: dispatchNodeView,
    status: dispatchNodeStatus,
    create: dispatchNodeCreate,
    update: dispatchNodeUpdate,
    complete: dispatchNodeComplete,
    resolve: dispatchNodeResolve,
    "batch-update": dispatchNodeBatchUpdate,
    "agent-update": dispatchNodeAgentUpdate,
    move: dispatchNodeMove,
    delete: dispatchNodeDelete,
    archive: (context, projectId) => dispatchNodeArchive(context, projectId, true),
    unarchive: (context, projectId) => dispatchNodeArchive(context, projectId, false),
    context: dispatchNodeContext,
    metadata: dispatchNodeMetadata,
    "export-context": dispatchNodeExportContext,
    "context-pack": dispatchNodeContextPack,
    "import-markdown": dispatchNodeImportMarkdown,
  };
  const handler = handlers[action];
  if (!handler) {
    throw new CliError("Usage: pgm node <list|view|status|create|update|complete|resolve|batch-update|agent-update|move|delete|archive|unarchive|context|metadata|export-context|context-pack|import-markdown>", exitCodes.usage);
  }

  await handler(context, projectId);
}

async function dispatchNodeList(context, projectId) {
  const nodes = await context.client.listNodes(projectId, {
    status: context.parsed.options.status,
    type: context.parsed.options.type,
    priority: context.parsed.options.priority,
    search: context.parsed.options.search,
    roots: context.parsed.options.roots,
    compact: context.parsed.options.compact,
    fields: resolveFieldsOption(context.parsed.options),
    children: context.parsed.options.children,
    subtree: context.parsed.options.subtree,
    depth: context.parsed.options.depth,
    includeSelf: context.parsed.options.includeSelf,
    include: getNodeIncludeOption(context.parsed.options),
    includeArchived: context.parsed.options.includeArchived,
  });
  if (context.parsed.options.json) {
    writeJson({ nodes }, context.io.stdout);
  } else if (context.parsed.options.withContext) {
    writeNodeContextList(nodes, context.io.stdout);
  } else {
    writeTable(nodes, pickNodeColumns(), context.io.stdout);
  }
}

async function dispatchNodeView(context, projectId) {
  const nodeId = requireOption(context.parsed.positionals[0], "A node id is required.");
  if (context.parsed.options.withAncestors || context.parsed.options.withContext) {
    const contextTree = await context.client.getNodeContextTree(projectId, nodeId, {
      compact: context.parsed.options.compact,
      fields: resolveFieldsOption(context.parsed.options),
    });
    if (context.parsed.options.json) {
      writeJson(contextTree, context.io.stdout);
    } else {
      writeContextTreeSummary(contextTree, context.io.stdout);
    }
    return;
  }

  const node = await context.client.getNode(projectId, nodeId, {
    fields: resolveFieldsOption(context.parsed.options),
  });
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

async function dispatchNodeStatus(context, projectId) {
  const nodeIds = context.parsed.positionals;
  if (nodeIds.length === 0) {
    throw new CliError("At least one node id is required.", exitCodes.usage);
  }

  const fields = resolveFieldsOption(context.parsed.options) ?? "id,label,title,status,type,metadata.implementation,updatedAt";
  const nodes = [];
  for (const nodeId of nodeIds) {
    nodes.push(await context.client.getNode(projectId, nodeId, { fields }));
  }

  if (context.parsed.options.json) {
    writeJson({ nodes }, context.io.stdout);
  } else {
    writeTable(nodes, pickNodeColumns(), context.io.stdout);
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
  if (context.parsed.options.priority !== undefined) {
    // "none" clears the priority.
    input.priority = context.parsed.options.priority === "none" ? null : context.parsed.options.priority;
  }
  if (Object.keys(input).length === 0) {
    throw new CliError("At least one of --title, --status, --type, or --priority is required.", exitCodes.usage);
  }
  const result = await context.client.updateNode(projectId, nodeId, input);
  writeNodeMutationResult(context, result, "Updated", Object.keys(input));
}

async function dispatchNodeComplete(context, projectId) {
  const nodeId = requireOption(context.parsed.positionals[0], "A node id is required.");
  const updatedFields = ["status"];
  let result = await context.client.updateNode(projectId, nodeId, { status: "implemented" });

  if (typeof context.parsed.options.note === "string" && context.parsed.options.note.trim().length > 0) {
    const current = await context.client.getNodeContext(projectId, nodeId);
    const note = context.parsed.options.note.trim();
    const nextContext = [current.context.trim(), `Resolution note:\n\n${note}`]
      .filter(Boolean)
      .join("\n\n");
    result = await context.client.setNodeContext(projectId, nodeId, nextContext);
    updatedFields.push("context");
  }

  writeNodeMutationResult(context, result, "Completed", updatedFields);
}

async function dispatchNodeResolve(context, projectId) {
  const nodeId = requireOption(context.parsed.positionals[0], "A node id is required.");
  const status = context.parsed.options.status ?? "implemented";
  const note = context.parsed.options.note;
  const deferred = parseRepeatedOption(context.parsed.options.deferred);
  const metadata = {};
  if (typeof note === "string" && note.trim().length > 0) {
    metadata.implementation = note.trim();
  }
  if (deferred.length > 0) {
    metadata.deferred = deferred.join("\n");
  }

  const updatedFields = [];
  let result = await context.client.updateNode(projectId, nodeId, { status });
  updatedFields.push("status");
  if (Object.keys(metadata).length > 0) {
    result = await context.client.patchNodeMetadata(projectId, nodeId, { set: metadata });
    updatedFields.push(...Object.keys(metadata).map((key) => `metadata.${key}`));
  }

  writeNodeMutationResult(context, result, "Resolved", updatedFields);
}

async function dispatchNodeBatchUpdate(context, projectId) {
  const file = requireOption(
    context.parsed.options.jsonInput ?? context.parsed.options.file,
    "--json-input <path> is required.",
  );
  const input = await readJsonInput(file, context.io.cwd);
  const updates = Array.isArray(input) ? input : input.updates;
  if (!Array.isArray(updates)) {
    throw new CliError("Batch update input must be an array or an object with an updates array.", exitCodes.usage);
  }

  const result = await applyNodeUpdates(context, projectId, updates);
  writeMaybeJson(
    context,
    result,
    `Updated ${result.updated.length} node${result.updated.length === 1 ? "" : "s"}; ${result.failed.length} failed.\n`,
  );
}

async function dispatchNodeAgentUpdate(context, projectId) {
  const file = requireOption(context.parsed.options.file, "--file <path> is required.");
  const input = await readJsonInput(file, context.io.cwd);
  const updates = Array.isArray(input) ? input : input.updates;
  if (!Array.isArray(updates)) {
    throw new CliError("Agent update input must be an array or an object with an updates array.", exitCodes.usage);
  }

  const normalized = updates.map((update) => {
    const summary = update.summary ?? update.note ?? update.implementation;
    const metadata = {
      ...(typeof summary === "string" && summary.trim().length > 0 ? { implementation: summary.trim() } : {}),
      ...(Array.isArray(update.completed) ? { completed: update.completed.join("\n") } : {}),
      ...(Array.isArray(update.deferred) ? { deferred: update.deferred.join("\n") } : {}),
      ...(Array.isArray(update.blockedBy) ? { blockedBy: update.blockedBy.join("\n") } : {}),
      ...(Array.isArray(update.verification) ? { verification: update.verification.join("\n") } : {}),
      ...(Array.isArray(update.filesChanged) ? { filesChanged: update.filesChanged.join("\n") } : {}),
    };
    return {
      id: update.id ?? update.nodeId,
      status: update.status,
      metadata,
    };
  });

  const result = await applyNodeUpdates(context, projectId, normalized);
  writeMaybeJson(
    context,
    result,
    `Applied ${result.updated.length} agent update${result.updated.length === 1 ? "" : "s"}; ${result.failed.length} failed.\n`,
  );
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

async function dispatchNodeDelete(context, projectId) {
  const nodeIds = context.parsed.positionals;
  if (nodeIds.length === 0) {
    throw new CliError("At least one node id is required.", exitCodes.usage);
  }
  if (!context.parsed.options.yes) {
    throw new CliError(
      "Deleting nodes cannot be undone. Re-run with --yes to confirm.",
      exitCodes.usage,
    );
  }

  const includeChildren = Boolean(context.parsed.options.withChildren);
  const results = [];
  for (const nodeId of nodeIds) {
    const result = await context.client.deleteNode(projectId, nodeId, { includeChildren });
    // Older servers without the DELETE route answer 200 with a non-API body; never report that as a delete.
    if (!Array.isArray(result?.deletedNodeIds)) {
      throw new CliError(
        `Server did not confirm deleting ${nodeId}. It may not support node deletes yet (needs the app version with DELETE /api/v1/.../nodes/:nodeId).`,
        1,
      );
    }
    results.push(result);
  }

  const deletedNodeIds = results.flatMap((result) => result.deletedNodeIds ?? []);
  if (context.parsed.options.json) {
    writeJson({ deleted: results, deletedNodeIds }, context.io.stdout);
  } else {
    context.io.stdout.write(
      `Deleted ${deletedNodeIds.length} node${deletedNodeIds.length === 1 ? "" : "s"}: ${deletedNodeIds.join(", ")}\n`,
    );
  }
}

async function dispatchNodeArchive(context, projectId, archived) {
  const nodeIds = context.parsed.positionals;
  if (nodeIds.length === 0) {
    throw new CliError("At least one node id is required.", exitCodes.usage);
  }

  const nodes = [];
  for (const nodeId of nodeIds) {
    const result = await context.client.updateNode(projectId, nodeId, { archived });
    // Older servers ignore unknown PATCH fields; only trust a node that echoes the new state.
    if (result?.node?.archived !== archived) {
      throw new CliError(
        `Server did not confirm ${archived ? "archiving" : "unarchiving"} ${nodeId}. It may not support node archiving yet.`,
        1,
      );
    }
    nodes.push(result.node);
  }

  if (context.parsed.options.json) {
    writeJson({ archived, nodeIds, nodes }, context.io.stdout);
  } else {
    context.io.stdout.write(
      `${archived ? "Archived" : "Unarchived"} ${nodeIds.length} node${nodeIds.length === 1 ? "" : "s"}: ${nodeIds.join(", ")}\n`,
    );
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
    writeNodeMutationResult(context, result, "Updated context for", ["context"]);
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
    writeNodeMutationResult(context, result, "Updated metadata for", ["metadata"]);
    return;
  }
  if (subaction === "unset") {
    const key = requireOption(context.parsed.positionals[1], "A metadata key is required.");
    const result = await context.client.patchNodeMetadata(projectId, nodeId, {
      unset: [key],
    });
    writeNodeMutationResult(context, result, "Updated metadata for", ["metadata"]);
    return;
  }
  throw new CliError("Usage: pgm node metadata <get|set|unset> <node-id>", exitCodes.usage);
}

async function dispatchNodeExportContext(context, projectId) {
  const nodeId = requireOption(context.parsed.positionals[0], "A node id is required.");
  const contextTree = await context.client.getNodeContextTree(projectId, nodeId);
  const markdown = formatNodeContextMarkdown(contextTree);
  const output = context.parsed.options.output;
  if (typeof output === "string" && output.trim().length > 0) {
    const outputPath = resolveInputPath(output, context.io.cwd);
    await writeFile(outputPath, markdown, "utf8");
    if (context.parsed.options.json) {
      writeJson({ projectId, nodeId, output: outputPath }, context.io.stdout);
    } else {
      context.io.stdout.write(`Exported node context for ${nodeId} to ${outputPath}.\n`);
    }
  } else if (context.parsed.options.json) {
    writeJson({ projectId, nodeId, markdown }, context.io.stdout);
  } else {
    context.io.stdout.write(markdown);
  }
}

async function dispatchNodeContextPack(context, projectId) {
  const nodeId = requireOption(context.parsed.positionals[0], "A parent node id is required.");
  const output = requireOption(context.parsed.options.output, "--output <directory> is required.");
  const outputDir = resolveInputPath(output, context.io.cwd);
  await mkdir(outputDir, { recursive: true });

  const summaries = await context.client.listNodes(projectId, {
    subtree: nodeId,
    includeSelf: true,
    depth: context.parsed.options.depth,
    fields: "id",
  });
  const nodeIds = uniqueStrings([nodeId, ...summaries.map((node) => node.id)]);
  const contexts = [];
  for (const currentNodeId of nodeIds) {
    contexts.push(await context.client.getNodeContextTree(projectId, currentNodeId));
  }

  const markdown = formatContextPackMarkdown({ projectId, rootNodeId: nodeId, contexts });
  const metadata = formatContextPackMetadata({ projectId, rootNodeId: nodeId, contexts });
  const imageResults = await downloadContextPackImages(context, outputDir, contexts);

  const contextFile = path.join(outputDir, "context-pack.md");
  const metadataFile = path.join(outputDir, "context-pack.json");
  await writeFile(contextFile, markdown, "utf8");
  await writeFile(metadataFile, `${JSON.stringify({
    ...metadata,
    images: imageResults,
  }, null, 2)}\n`, "utf8");

  const result = {
    projectId,
    rootNodeId: nodeId,
    output: outputDir,
    contextFile,
    metadataFile,
    nodeCount: contexts.length,
    imageCount: imageResults.downloaded.length,
    downloaded: imageResults.downloaded,
    failed: imageResults.failed,
  };

  writeMaybeJson(
    context,
    result,
    `Exported context pack for ${nodeId}: ${contexts.length} nodes, ${imageResults.downloaded.length} images.\n${outputDir}\n`,
  );
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

  if (action === "download") {
    const nodeId = requireOption(context.parsed.positionals[0], "A node id is required.");
    const result = await downloadNodeImages({
      client: context.client,
      projectId,
      nodeId,
      imageIds: context.parsed.positionals.slice(1),
      output: context.parsed.options.output,
      cwd: context.io.cwd,
    });
    if (context.parsed.options.json) {
      writeJson(result, context.io.stdout);
    } else {
      for (const item of result.downloaded) {
        context.io.stdout.write(`${item.imageId}  ${item.path}\n`);
      }
    }
    return;
  }

  throw new CliError("Usage: pgm image <add|list|remove|download>", exitCodes.usage);
}

async function dispatchIssue(context, action) {
  if (action !== "view") {
    throw new CliError("Usage: pgm issue view <product-grid-url> [--json]", exitCodes.usage);
  }

  const urlValue = requireOption(context.parsed.positionals[0], "A Product Grid URL is required.");
  const target = parseProductGridUrl(urlValue);
  const projectId = target.projectId ?? context.projectId;
  requireOption(projectId, "A project id is required in the URL or via --project.");
  const nodeId = requireOption(target.nodeId, "A node id is required in the URL.");
  const contextTree = await context.client.getNodeContextTree(projectId, nodeId, {
    compact: true,
    fields: resolveFieldsOption(context.parsed.options),
  });
  const result = {
    projectId,
    nodeId,
    ...contextTree,
    suggestedCommands: {
      view: `pgm node view ${nodeId} --project ${projectId} --with-context --compact --json`,
      close: `pgm node resolve ${nodeId} --project ${projectId} --status implemented --note "..." --json`,
    },
  };

  if (context.parsed.options.json) {
    writeJson(result, context.io.stdout);
  } else {
    writeContextTreeSummary({
      node: result.node,
      inheritedContext: {
        ...result.inheritedContext,
        titlePath: result.titlePath ?? result.inheritedContext?.titlePath ?? "",
      },
    }, context.io.stdout);
  }
}

function parseProductGridUrl(value) {
  try {
    const url = new URL(value);
    return {
      projectId: url.searchParams.get("project"),
      nodeId: url.searchParams.get("node"),
    };
  } catch {
    return {
      projectId: null,
      nodeId: value,
    };
  }
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
  "yes",
  "with-children",
  "include-archived",
  "force",
  "compact",
  "global",
  "full",
  "json",
  "link",
  "roots",
  "root",
  "include-self",
  "dry-run",
  "split-by-heading-level",
  "split-headings",
  "with-ancestors",
  "with-context",
  "no-open",
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

function isUpdateCommand(command) {
  return command.length === 1 && command[0] === "update";
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

async function applyNodeUpdates(context, projectId, updates) {
  const updated = [];
  const failed = [];

  for (const update of updates) {
    const nodeId = update.id ?? update.nodeId;
    if (typeof nodeId !== "string" || nodeId.trim().length === 0) {
      failed.push({ id: null, error: "Missing node id." });
      continue;
    }

    try {
      let result = null;
      const updatedFields = [];
      if (typeof update.status === "string" && update.status.trim().length > 0) {
        result = await context.client.updateNode(projectId, nodeId, { status: update.status });
        updatedFields.push("status");
      }
      if (update.metadata && typeof update.metadata === "object" && !Array.isArray(update.metadata)) {
        result = await context.client.patchNodeMetadata(projectId, nodeId, { set: update.metadata });
        updatedFields.push(...Object.keys(update.metadata).map((key) => `metadata.${key}`));
      }
      if (!result) {
        throw new Error("No supported fields to update.");
      }
      updated.push({
        id: result.node.id,
        status: result.node.status,
        updatedFields,
      });
    } catch (error) {
      failed.push({
        id: nodeId,
        error: error instanceof Error ? error.message : "Update failed.",
      });
    }
  }

  return { updated, failed };
}

function writeNodeMutationResult(context, result, verb, updatedFields = []) {
  if (context.parsed.options.json) {
    if (context.parsed.options.full) {
      writeJson(result, context.io.stdout);
      return;
    }

    writeJson({
      nodeId: result.node.id,
      status: result.node.status,
      updatedFields,
    }, context.io.stdout);
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

function resolveFieldsOption(options) {
  if (typeof options.fields === "string" && options.fields.trim().length > 0) {
    return options.fields;
  }

  if (typeof options.preset !== "string") {
    return undefined;
  }

  const presets = {
    status: "id,label,title,status,priority,type,parentNodeId,metadata.implementation,updatedAt",
    compact: "id,label,title,status,priority,type,parentNodeId,childCount,imageCount",
    handoff: "id,label,title,status,context,metadata.implementation,images",
    images: "id,label,title,images",
    tree: "id,label,title,status,type,parentNodeId,childCount",
  };

  return presets[options.preset] ?? undefined;
}

function parseRepeatedOption(value) {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === "string" && item.trim().length > 0);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return [value.trim()];
  }
  return [];
}

function getNodeIncludeOption(options) {
  if (options.withContext) {
    return "context";
  }
  if (options.withAncestors) {
    return "ancestors";
  }
  return undefined;
}

function writeContextTreeSummary(value, stdout) {
  const item = value.node;
  stdout.write(`${item.title ?? item.label} (${item.id})\n`);
  stdout.write(`Path: ${value.inheritedContext.titlePath ?? value.titlePath ?? "(none)"}\n`);
  stdout.write(`Status: ${item.status}\nType: ${item.type}\n`);
  stdout.write(`Context blocks: ${value.inheritedContext.contextBlocks.length}\n`);
  stdout.write(`Metadata blocks: ${value.inheritedContext.metadata.length}\n`);
  stdout.write(`Images: ${value.inheritedContext.images.length}\n`);
  if (value.inheritedContext.missingContext) {
    stdout.write("No direct or inherited context found.\n");
  }
}

function writeNodeContextList(nodes, stdout) {
  if (nodes.length === 0) {
    stdout.write("No results.\n");
    return;
  }

  for (const nodeContext of nodes) {
    stdout.write(`${nodeContext.inheritedContext.titlePath} (${nodeContext.node.id})\n`);
    const blockCount =
      nodeContext.inheritedContext.metadata.length +
      nodeContext.inheritedContext.contextBlocks.length +
      nodeContext.inheritedContext.rawContextBlocks.length;
    stdout.write(`  ${nodeContext.node.status} ${nodeContext.node.type}; context blocks: ${blockCount}; images: ${nodeContext.inheritedContext.images.length}\n`);
  }
}

function formatNodeContextMarkdown(nodeContext) {
  const { node, path: nodePath, inheritedContext } = nodeContext;
  const ancestors = nodePath.slice(0, -1);
  const leaf = nodePath.at(-1);
  const sections = [
    `# Node Context: ${node.title ?? node.label}`,
    "",
    `Path: ${inheritedContext.titlePath}`,
    `Status: ${node.status}`,
    `Type: ${node.type}`,
    "",
  ];

  sections.push("## Ancestor Requirements", "");
  if (ancestors.length === 0) {
    sections.push("None.", "");
  } else {
    for (const pathNode of ancestors) {
      sections.push(formatContextNodeMarkdown(pathNode), "");
    }
  }

  sections.push("## Current Node", "");
  if (leaf) {
    sections.push(formatContextNodeMarkdown(leaf), "");
  }

  sections.push("## Implementation Notes For Agent", "");
  if (!inheritedContext.hasDirectContext) {
    sections.push("- This node has no direct context.");
  }
  if (inheritedContext.hasInheritedContext) {
    sections.push("- Use inherited context from ancestor nodes.");
  }
  if (inheritedContext.missingContext) {
    sections.push("- No direct or inherited context is available; inspect nearby nodes or ask for clarification before broad changes.");
  }
  if (
    inheritedContext.hasDirectContext ||
    inheritedContext.hasInheritedContext ||
    inheritedContext.missingContext
  ) {
    return `${sections.join("\n").trimEnd()}\n`;
  }

  sections.push("- Review the path and scoped node before implementation.");
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

function formatContextPackMarkdown({ projectId, rootNodeId, contexts }) {
  const root = contexts.find((item) => item.node.id === rootNodeId) ?? contexts[0];
  const sections = [
    `# Context Pack: ${root?.node.title ?? root?.node.label ?? rootNodeId}`,
    "",
    `Project: ${projectId}`,
    `Root node: ${rootNodeId}`,
    `Nodes: ${contexts.length}`,
    "",
  ];

  for (const nodeContext of contexts) {
    sections.push(formatNodeContextMarkdown(nodeContext).trimEnd(), "");
  }

  return `${sections.join("\n").trimEnd()}\n`;
}

function formatContextPackMetadata({ projectId, rootNodeId, contexts }) {
  return {
    projectId,
    rootNodeId,
    nodes: contexts.map((nodeContext) => ({
      id: nodeContext.node.id,
      title: nodeContext.node.title ?? nodeContext.node.label,
      status: nodeContext.node.status,
      type: nodeContext.node.type,
      parentNodeId: nodeContext.node.parentNodeId ?? null,
      titlePath: nodeContext.inheritedContext.titlePath,
      metadata: nodeContext.node.metadata ?? {},
      inheritedContext: nodeContext.inheritedContext,
      path: nodeContext.path.map((node) => ({
        id: node.id,
        title: node.title,
        status: node.status,
        type: node.type,
        metadata: node.metadata ?? {},
        imageCount: node.images?.length ?? 0,
      })),
    })),
  };
}

async function downloadContextPackImages(context, outputDir, contexts) {
  const imageDir = path.join(outputDir, "images");
  const imageMap = new Map();
  for (const nodeContext of contexts) {
    for (const pathNode of nodeContext.path ?? []) {
      for (const image of pathNode.images ?? []) {
        const key = `${pathNode.id}:${image.id}`;
        if (!imageMap.has(key)) {
          imageMap.set(key, { ...image, sourceNodeId: pathNode.id, sourceTitle: pathNode.title });
        }
      }
    }
  }

  const downloaded = [];
  const failed = [];
  if (imageMap.size > 0) {
    await mkdir(imageDir, { recursive: true });
  }

  for (const image of imageMap.values()) {
    try {
      const filename = `${sanitizePathPart(image.sourceNodeId)}-${sanitizePathPart(image.id)}${imageExtension(image)}`;
      const outputPath = path.join(imageDir, filename);
      await writeFile(outputPath, await context.client.downloadAsset(image.src));
      downloaded.push({
        nodeId: image.sourceNodeId,
        imageId: image.id,
        originalName: image.originalName,
        src: image.src,
        path: outputPath,
      });
    } catch (error) {
      failed.push({
        nodeId: image.sourceNodeId,
        imageId: image.id,
        src: image.src,
        error: error instanceof Error ? error.message : "Image download failed.",
      });
    }
  }

  return { downloaded, failed };
}

function sanitizePathPart(value) {
  return String(value)
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "item";
}

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim().length > 0))];
}

function titleFromFile(filePath) {
  const basename = path.basename(filePath, path.extname(filePath));
  return basename
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim() || "Imported Markdown";
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
  pgm viewer [--data-dir <folder>] [--no-open] [--port <port>]
  pgm project list --local <folder> [--json]
  pgm node list --local <folder> --project <id> [--json]
  pgm image list <node-id> --local <folder> --project <id> [--json]
  pgm auth login --token <token> [--server http://localhost:3000]
  pgm auth status [--json]
  pgm project list [--json]
  pgm project create ["Project name"] [--name "Project name"] [--link] [--json]
  pgm project view [project-id] [--json]
  pgm project schema [project-id] [--json]
  pgm project schema ensure-field <key> [--label "Label"] [--default "Default"] [--project <project-id>] [--json]
  pgm project history [project-id] [--limit 50] [--before <cursor>] [--node <node-id>] [--json]
  pgm project export-markdown [project-id] [--output ./project.md] [--json]
  pgm project link <project-id>
  pgm node list [--project <project-id>] [--roots] [--children <node-id>] [--subtree <node-id>] [--depth N] [--compact] [--fields id,label,status,type] [--preset status] [--status blocked] [--type feature] [--priority urgent|high|medium|low|none] [--search text] [--include-archived] [--with-ancestors|--with-context] [--json]
  pgm node view <node-id> [--project <project-id>] [--with-ancestors|--with-context] [--compact] [--fields id,status,metadata.implementation] [--json]
  pgm node status <node-id...> [--project <project-id>] [--json]
  pgm node create --title "Checkout" [--type page] [--parent <node-id>] [--context-file ./context.md] [--metadata-json '{"purpose":"..."}'] [--json]
  pgm node update <node-id> [--title "Checkout"] [--status working] [--type page] [--priority high|none] [--json] [--full]
  pgm node complete <node-id> [--note "Resolution note"] [--json] [--full]
  pgm node resolve <node-id> [--status implemented] [--note "Implementation note"] [--json] [--full]
  pgm node batch-update --json-input ./updates.json [--json]
  pgm node agent-update --file ./agent-status.json [--json]
  pgm node move <node-id> (--parent <node-id> | --root) [--json]
  pgm node delete <node-id...> --yes [--with-children] [--json]
  pgm node archive <node-id...> [--json]
  pgm node unarchive <node-id...> [--json]
  pgm node context get <node-id> [--json]
  pgm node context set <node-id> --file ./context.md [--json] [--full]
  pgm node metadata get <node-id> [--json]
  pgm node metadata set <node-id> <key> <value> [--json] [--full]
  pgm node metadata unset <node-id> <key> [--json] [--full]
  pgm node export-context <node-id> [--project <project-id>] [--output ./node-context.md] [--json]
  pgm node context-pack <parent-node-id> --output ./context-pack-dir [--depth N] [--json]
  pgm node import-markdown --file <path> [--title "Notes"] [--split-headings] [--max-heading-depth 2] [--metadata-json '{"purpose":"..."}'] [--json]
  pgm image add <node-id> <image-path...> [--project <project-id>] [--json]
  pgm image list <node-id> [--project <project-id>] [--json]
  pgm image remove <node-id> <image-id> [--project <project-id>] [--json]
  pgm image download <node-id> [image-id...] [--output <dir-or-file>] [--project <project-id>] [--json]
  pgm issue view <product-grid-url> [--json]
  pgm update [--dry-run] [--json]
  pgm skill install [--agent codex] [--global] [--force]
  pgm skill path
  pgm skill print

Global options:
  --server <url>       Server URL. Defaults to PRODUCT_GRID_SERVER or http://localhost:3000.
  --project <id>       Project ID. Defaults to PRODUCT_GRID_PROJECT or linked project.
  --local <folder>     Use projects in a local data folder. Requires an explicit --project for scoped commands.
  --token <token>      Bearer token. Defaults to PRODUCT_GRID_TOKEN or stored token.
  --json               Print machine-readable JSON to stdout.

Context guidance:
  Start with project schema, then targeted node list/search and --with-context.
  project view --json returns the full graph and can be very large.
`;
}
