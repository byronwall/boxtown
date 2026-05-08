import assert from "node:assert/strict";
import { test } from "node:test";
import { EventEmitter } from "node:events";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ProductGridClient } from "../src/client.mjs";
import { defaultServer, resolveProjectId, resolveServer, resolveToken } from "../src/config.mjs";
import { getUpdateCommand, main, parseArgs } from "../src/main.mjs";
import { writeJson } from "../src/output.mjs";
import { getBundledSkillPath, resolveSkillInstallTarget } from "../src/skill.mjs";
import { isNewerVersion, notifyIfUpdateAvailable } from "../src/update-check.mjs";
import { packageVersion } from "../src/version.mjs";

test("parseArgs handles command positionals and global flags", () => {
  const parsed = parseArgs([
    "node",
    "list",
    "--project",
    "demo",
    "--status=blocked",
    "--json",
  ]);

  assert.deepEqual(parsed.command, ["node", "list"]);
  assert.deepEqual(parsed.positionals, []);
  assert.equal(parsed.options.project, "demo");
  assert.equal(parsed.options.status, "blocked");
  assert.equal(parsed.options.json, true);
});

test("parseArgs handles project view positional", () => {
  const parsed = parseArgs(["project", "view", "demo-project", "--json"]);

  assert.deepEqual(parsed.command, ["project", "view"]);
  assert.deepEqual(parsed.positionals, ["demo-project"]);
  assert.equal(parsed.options.json, true);
});

test("parseArgs handles project create name and link flag", () => {
  const parsed = parseArgs(["project", "create", "New", "Product", "Site", "--link", "--json"]);

  assert.deepEqual(parsed.command, ["project", "create"]);
  assert.deepEqual(parsed.positionals, ["New", "Product", "Site"]);
  assert.equal(parsed.options.link, true);
  assert.equal(parsed.options.json, true);
});

test("parseArgs does not let boolean flags consume following positionals", () => {
  const linkedCreate = parseArgs(["project", "create", "--link", "New", "Product", "Site"]);
  assert.deepEqual(linkedCreate.command, ["project", "create"]);
  assert.deepEqual(linkedCreate.positionals, ["New", "Product", "Site"]);
  assert.equal(linkedCreate.options.link, true);

  const importMarkdown = parseArgs(["node", "import-markdown", "--split-headings", "brief.md"]);
  assert.deepEqual(importMarkdown.positionals, ["brief.md"]);
  assert.equal(importMarkdown.options.splitHeadings, true);

  const jsonFalse = parseArgs(["project", "list", "--json=false"]);
  assert.equal(jsonFalse.options.json, false);
});

test("main prints package version without reading config", async () => {
  const stdout = createWritableBuffer();

  await main(["node", "pgm", "--version"], {
    stdout,
    stderr: createWritableBuffer(),
    env: {
      PRODUCT_GRID_CONFIG: path.join("/missing", "parent", "cli.json"),
    },
    cwd: "/tmp",
  });

  assert.equal(stdout.value, `${packageVersion}\n`);
});

test("main prints config path without reading config", async () => {
  const stdout = createWritableBuffer();
  const configPath = path.join("/missing", "parent", "cli.json");

  await main(["node", "pgm", "config", "path"], {
    stdout,
    stderr: createWritableBuffer(),
    env: {
      PRODUCT_GRID_CONFIG: configPath,
    },
    cwd: "/tmp",
  });

  assert.equal(stdout.value, `${configPath}\n`);
});

test("update check prints an encouraging update note to stderr", async () => {
  const stderr = createWritableBuffer();

  await notifyIfUpdateAvailable({
    stderr,
    env: {},
  }, {
    fetch: async () => new Response(JSON.stringify({ version: "99.0.0" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  });

  assert.match(stderr.value, /A fresh pgm update is ready:/);
  assert.match(stderr.value, /pgm update/);
});

test("pgm update exposes dry-run JSON and spawns npm for real updates", async () => {
  const dryRunStdout = createWritableBuffer();

  await main(["node", "pgm", "update", "--dry-run", "--json"], {
    stdout: dryRunStdout,
    stderr: createWritableBuffer(),
    env: {},
    cwd: "/tmp",
  });

  const dryRun = JSON.parse(dryRunStdout.value);
  assert.equal(dryRun.packageName, "@byronwallrus/product-grid-cli");
  assert.equal(dryRun.dryRun, true);
  assert.deepEqual(getUpdateCommand(), ["npm", "install", "-g", "@byronwallrus/product-grid-cli@latest"]);

  const calls = [];
  const stdout = createWritableBuffer();
  await main(["node", "pgm", "update", "--json"], {
    stdout,
    stderr: createWritableBuffer(),
    env: { PGM_NO_UPDATE_CHECK: "1" },
    cwd: "/tmp",
    spawn(command, args, options) {
      calls.push({ command, args, options });
      const child = new EventEmitter();
      queueMicrotask(() => child.emit("close", 0));
      return child;
    },
  });

  assert.deepEqual(calls[0], {
    command: "npm",
    args: ["install", "-g", "@byronwallrus/product-grid-cli@latest"],
    options: {
      cwd: "/tmp",
      env: { PGM_NO_UPDATE_CHECK: "1" },
      stdio: "inherit",
    },
  });
  assert.equal(JSON.parse(stdout.value).exitCode, 0);
});

test("update check can be disabled and compares semver versions", async () => {
  const stderr = createWritableBuffer();
  let called = false;

  await notifyIfUpdateAvailable({
    stderr,
    env: { PGM_NO_UPDATE_CHECK: "1" },
  }, {
    fetch: async () => {
      called = true;
      return new Response(JSON.stringify({ version: "99.0.0" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  assert.equal(called, false);
  assert.equal(stderr.value, "");
  assert.equal(isNewerVersion("1.2.4", "1.2.3"), true);
  assert.equal(isNewerVersion("1.2.3", "1.2.3"), false);
  assert.equal(isNewerVersion("1.2.2", "1.2.3"), false);
});

test("parseArgs handles markdown import and image add positionals", () => {
  const markdown = parseArgs([
    "node",
    "import-markdown",
    "--file",
    "brief.md",
    "--split-headings",
    "--max-heading-depth",
    "2",
    "--json",
  ]);

  assert.deepEqual(markdown.command, ["node", "import-markdown"]);
  assert.equal(markdown.options.file, "brief.md");
  assert.equal(markdown.options.splitHeadings, true);
  assert.equal(markdown.options.maxHeadingDepth, "2");
  assert.equal(markdown.options.json, true);

  const image = parseArgs(["image", "add", "node-1", "shot.png", "detail.jpg", "--json"]);
  assert.deepEqual(image.command, ["image", "add"]);
  assert.deepEqual(image.positionals, ["node-1", "shot.png", "detail.jpg"]);
  assert.equal(image.options.json, true);
});

test("parseArgs handles node mutation and export commands", () => {
  const update = parseArgs(["node", "update", "node-1", "--status", "working", "--type", "page"]);
  assert.deepEqual(update.command, ["node", "update"]);
  assert.deepEqual(update.positionals, ["node-1"]);
  assert.equal(update.options.status, "working");
  assert.equal(update.options.type, "page");

  const context = parseArgs(["node", "context", "set", "node-1", "--file", "context.md", "--json"]);
  assert.deepEqual(context.command, ["node", "context", "set"]);
  assert.deepEqual(context.positionals, ["node-1"]);
  assert.equal(context.options.file, "context.md");

  const metadata = parseArgs(["node", "metadata", "set", "node-1", "purpose", "Checkout", "--json"]);
  assert.deepEqual(metadata.command, ["node", "metadata", "set"]);
  assert.deepEqual(metadata.positionals, ["node-1", "purpose", "Checkout"]);

  const move = parseArgs(["node", "move", "node-1", "--parent", "node-0", "--json"]);
  assert.deepEqual(move.command, ["node", "move"]);
  assert.equal(move.options.parent, "node-0");

  const exportMarkdown = parseArgs(["project", "export-markdown", "demo", "--output", "project.md"]);
  assert.deepEqual(exportMarkdown.command, ["project", "export-markdown"]);
  assert.deepEqual(exportMarkdown.positionals, ["demo"]);
  assert.equal(exportMarkdown.options.output, "project.md");
});

test("parseArgs handles targeted node context flags", () => {
  const nodeList = parseArgs([
    "node",
    "list",
    "--search",
    "layout",
    "--roots",
    "--compact",
    "--with-ancestors",
    "--json",
  ]);
  assert.deepEqual(nodeList.command, ["node", "list"]);
  assert.equal(nodeList.options.search, "layout");
  assert.equal(nodeList.options.roots, true);
  assert.equal(nodeList.options.compact, true);
  assert.equal(nodeList.options.withAncestors, true);
  assert.equal(nodeList.options.json, true);

  const nodeView = parseArgs(["node", "view", "node-1", "--with-context"]);
  assert.deepEqual(nodeView.command, ["node", "view"]);
  assert.deepEqual(nodeView.positionals, ["node-1"]);
  assert.equal(nodeView.options.withContext, true);

  const nodeExport = parseArgs(["node", "export-context", "node-1", "--output", "node-context.md"]);
  assert.deepEqual(nodeExport.command, ["node", "export-context"]);
  assert.deepEqual(nodeExport.positionals, ["node-1"]);
  assert.equal(nodeExport.options.output, "node-context.md");

  const contextPack = parseArgs(["node", "context-pack", "parent-1", "--output", "pack", "--depth", "2"]);
  assert.deepEqual(contextPack.command, ["node", "context-pack"]);
  assert.deepEqual(contextPack.positionals, ["parent-1"]);
  assert.equal(contextPack.options.output, "pack");
  assert.equal(contextPack.options.depth, "2");

  const projectSchema = parseArgs(["project", "schema", "--json"]);
  assert.deepEqual(projectSchema.command, ["project", "schema"]);
  assert.equal(projectSchema.options.json, true);
});

test("parseArgs handles compact agent workflow commands", () => {
  const status = parseArgs(["node", "status", "node-1", "node-2", "--fields", "id,status"]);
  assert.deepEqual(status.command, ["node", "status"]);
  assert.deepEqual(status.positionals, ["node-1", "node-2"]);
  assert.equal(status.options.fields, "id,status");

  const subtree = parseArgs([
    "node",
    "list",
    "--subtree",
    "root",
    "--depth",
    "2",
    "--include-self",
    "--preset",
    "tree",
  ]);
  assert.equal(subtree.options.subtree, "root");
  assert.equal(subtree.options.depth, "2");
  assert.equal(subtree.options.includeSelf, true);
  assert.equal(subtree.options.preset, "tree");

  const issue = parseArgs(["issue", "view", "https://example.test?project=demo&node=node-1", "--json"]);
  assert.deepEqual(issue.command, ["issue", "view"]);
  assert.deepEqual(issue.positionals, ["https://example.test?project=demo&node=node-1"]);
});

test("config resolution prefers flags then environment then config", () => {
  const config = {
    defaultServer: "http://config.example",
    currentProjectId: "config-project",
    tokens: {
      "http://flag.example": "config-token",
    },
  };

  assert.equal(resolveServer({ server: "http://flag.example/" }, config, {}), "http://flag.example");
  assert.equal(resolveServer({}, config, { PRODUCT_GRID_SERVER: "http://env.example" }), "http://env.example");
  assert.equal(resolveServer({}, {}, {}), defaultServer);
  assert.equal(resolveProjectId({ project: "flag-project" }, config, {}), "flag-project");
  assert.equal(resolveProjectId({}, config, { PRODUCT_GRID_PROJECT: "env-project" }), "env-project");
  assert.equal(resolveToken({ token: "flag-token" }, config, "http://flag.example", {}), "flag-token");
  assert.equal(resolveToken({}, config, "http://flag.example", {}), "config-token");
});

test("client sends authorization and parses project list", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ projects: [{ id: "demo", name: "Demo" }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const client = new ProductGridClient({
      server: "http://localhost:3000",
      token: "secret-token",
    });
    const projects = await client.listProjects();

    assert.equal(projects[0].id, "demo");
    assert.equal(calls[0].url, "http://localhost:3000/api/v1/projects");
    assert.equal(calls[0].init.headers.get("authorization"), "Bearer secret-token");
    assert.equal(calls[0].init.headers.get("user-agent"), `@byronwallrus/product-grid-cli/${packageVersion}`);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("client creates a project with a JSON body", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({
      project: {
        id: "new-product-site",
        name: "New Product Site",
        description: "Blank project",
        nodeCount: 0,
        linkCount: 0,
      },
    }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const client = new ProductGridClient({
      server: "http://localhost:3000",
      token: "secret-token",
    });
    const project = await client.createProject({ name: "New Product Site" });

    assert.equal(project.id, "new-product-site");
    assert.equal(calls[0].url, "http://localhost:3000/api/v1/projects");
    assert.equal(calls[0].init.method, "POST");
    assert.equal(calls[0].init.headers.get("content-type"), "application/json");
    assert.deepEqual(JSON.parse(calls[0].init.body), { name: "New Product Site" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("client imports markdown with a JSON body", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({
      import: {
        rootNodeId: "note-brief",
        createdNodeIds: ["note-brief", "note-overview"],
        createdNodeCount: 2,
      },
      nodes: [],
      links: [],
    }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const client = new ProductGridClient({
      server: "http://localhost:3000",
      token: "secret-token",
    });
    const result = await client.importMarkdown("demo", {
      title: "Brief",
      markdown: "# Overview",
      splitByHeadingLevel: true,
      maxHeadingDepth: 2,
      metadata: { purpose: "Context" },
    });

    assert.equal(result.import.createdNodeCount, 2);
    assert.equal(calls[0].url, "http://localhost:3000/api/v1/projects/demo/imports/markdown");
    assert.equal(calls[0].init.method, "POST");
    assert.equal(calls[0].init.headers.get("content-type"), "application/json");
    assert.deepEqual(JSON.parse(calls[0].init.body), {
      title: "Brief",
      markdown: "# Overview",
      splitByHeadingLevel: true,
      maxHeadingDepth: 2,
      metadata: { purpose: "Context" },
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("client sends node mutation requests", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, init });
    if (url.endsWith("/context") && (!init.method || init.method === "GET")) {
      return new Response(JSON.stringify({ nodeId: "node-1", context: "Context" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (url.endsWith("/metadata") && (!init.method || init.method === "GET")) {
      return new Response(JSON.stringify({ nodeId: "node-1", metadata: { purpose: "Purpose" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify({
      nodeId: "node-1",
      node: { id: "node-1", label: "Node 1" },
      parentLink: null,
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const client = new ProductGridClient({
      server: "http://localhost:3000",
      token: "secret-token",
    });

    await client.createNode("demo", { title: "Node 1", type: "page" });
    await client.updateNode("demo", "node-1", { status: "working" });
    await client.moveNode("demo", "node-1", { parentNodeId: "node-0" });
    await client.getNodeContext("demo", "node-1");
    await client.setNodeContext("demo", "node-1", "Context");
    await client.getNodeMetadata("demo", "node-1");
    await client.patchNodeMetadata("demo", "node-1", { set: { purpose: "Purpose" } });

    assert.equal(calls[0].url, "http://localhost:3000/api/v1/projects/demo/nodes");
    assert.equal(calls[0].init.method, "POST");
    assert.deepEqual(JSON.parse(calls[0].init.body), { title: "Node 1", type: "page" });
    assert.equal(calls[1].url, "http://localhost:3000/api/v1/projects/demo/nodes/node-1");
    assert.equal(calls[1].init.method, "PATCH");
    assert.equal(calls[2].url, "http://localhost:3000/api/v1/projects/demo/nodes/node-1/move");
    assert.equal(calls[2].init.method, "POST");
    assert.equal(calls[4].init.method, "PUT");
    assert.deepEqual(JSON.parse(calls[6].init.body), { set: { purpose: "Purpose" } });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("client requests schema and compact hierarchy context projections", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({
      schema: { projectId: "demo", statuses: [], nodeTypes: [], metadataFields: [] },
      nodes: [],
      node: { id: "node-1", title: "Node 1" },
      path: [],
      inheritedContext: { titlePath: "Node 1" },
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const client = new ProductGridClient({
      server: "http://localhost:3000",
      token: "secret-token",
    });

    await client.getProjectSchema("demo");
    await client.listNodes("demo", {
      status: "planned",
      search: "layout",
      roots: true,
      compact: true,
      fields: "id,label,status,type,parentNodeId,childCount,imageCount",
      subtree: "root",
      depth: "2",
      includeSelf: true,
      include: "ancestors",
    });
    await client.getNode("demo", "node-1", { fields: "id,status,metadata.implementation" });
    await client.getNodeContextTree("demo", "node-1", {
      compact: true,
      fields: "id,status",
    });

    assert.equal(
      calls[0].url,
      "http://localhost:3000/api/v1/projects/demo/schema",
    );
    assert.equal(
      calls[1].url,
      "http://localhost:3000/api/v1/projects/demo/nodes?status=planned&search=layout&roots=true&compact=true&fields=id%2Clabel%2Cstatus%2Ctype%2CparentNodeId%2CchildCount%2CimageCount&subtree=root&depth=2&includeSelf=true&include=ancestors",
    );
    assert.equal(
      calls[2].url,
      "http://localhost:3000/api/v1/projects/demo/nodes/node-1?fields=id%2Cstatus%2Cmetadata.implementation",
    );
    assert.equal(
      calls[3].url,
      "http://localhost:3000/api/v1/projects/demo/nodes/node-1/context-tree?fields=id%2Cstatus&compact=true",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("issue view resolves a Product Grid URL to compact context", async () => {
  const calls = [];
  const stdout = createWritableBuffer();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({
      node: { id: "node-1", title: "Node 1", status: "planned", type: "task" },
      titlePath: "Root > Node 1",
      inheritedContext: {
        metadata: [],
        contextBlocks: [],
        rawContextBlocks: [],
        images: [],
        hasDirectContext: false,
        hasInheritedContext: false,
        missingContext: true,
      },
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    await main([
      "node",
      "pgm",
      "issue",
      "view",
      "https://prod-mgmt.apps.byroni.us/projects/project-mgmt-grid?node=node-1&project=demo",
      "--json",
    ], {
      stdout,
      stderr: createWritableBuffer(),
      env: {
        PRODUCT_GRID_SERVER: "http://localhost:3000",
      },
      cwd: "/tmp",
    });

    assert.equal(
      calls[0].url,
      "http://localhost:3000/api/v1/projects/demo/nodes/node-1/context-tree?compact=true",
    );
    const body = JSON.parse(stdout.value);
    assert.equal(body.projectId, "demo");
    assert.equal(body.nodeId, "node-1");
    assert.match(body.suggestedCommands.close, /pgm node resolve node-1/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("writeJson ignores EPIPE from closed stdout consumers", () => {
  assert.doesNotThrow(() => {
    writeJson({ ok: true }, {
      write() {
        const error = new Error("write EPIPE");
        error.code = "EPIPE";
        throw error;
      },
    });
  });
});

test("node complete writes compact mutation JSON and appends a note", async () => {
  const calls = [];
  const stdout = createWritableBuffer();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, init });
    if (url.endsWith("/context") && (!init.method || init.method === "GET")) {
      return new Response(JSON.stringify({
        nodeId: "node-1",
        context: "Existing context",
        rawContext: "",
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      node: {
        id: "node-1",
        label: "Node 1",
        type: "task",
        status: "implemented",
        metadata: {},
        context: "",
        rawContext: "",
        images: [],
      },
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    await main([
      "node",
      "pgm",
      "node",
      "complete",
      "node-1",
      "--project",
      "demo",
      "--note",
      "Done",
      "--json",
    ], {
      stdout,
      stderr: createWritableBuffer(),
      env: {
        PRODUCT_GRID_SERVER: "http://localhost:3000",
      },
      cwd: "/tmp",
    });

    assert.equal(calls[0].url, "http://localhost:3000/api/v1/projects/demo/nodes/node-1");
    assert.deepEqual(JSON.parse(calls[0].init.body), { status: "implemented" });
    assert.equal(calls[1].url, "http://localhost:3000/api/v1/projects/demo/nodes/node-1/context");
    assert.equal(calls[2].init.method, "PUT");
    assert.deepEqual(JSON.parse(calls[2].init.body), {
      context: "Existing context\n\nResolution note:\n\nDone",
    });
    assert.deepEqual(JSON.parse(stdout.value), {
      nodeId: "node-1",
      status: "implemented",
      updatedFields: ["status", "context"],
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("client uploads node images as multipart form data", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "pgm-cli-image-"));
  const imagePath = path.join(tempDir, "shot.png");
  await writeFile(imagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    const uploaded = init.body.getAll("images");
    assert.equal(uploaded.length, 1);
    assert.equal(uploaded[0].name, "shot.png");
    assert.equal(uploaded[0].type, "image/png");

    return new Response(JSON.stringify({
      nodeId: "node-1",
      imageCount: 1,
      images: [{ id: "image-1", originalName: "shot.png" }],
    }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const client = new ProductGridClient({
      server: "http://localhost:3000",
      token: "secret-token",
    });
    const result = await client.addNodeImages("demo", "node-1", [imagePath]);

    assert.equal(result.imageCount, 1);
    assert.equal(
      calls[0].url,
      "http://localhost:3000/api/v1/projects/demo/nodes/node-1/images",
    );
    assert.equal(calls[0].init.method, "POST");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("client lists and removes images and exports markdown", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, init });
    if (url.endsWith("/exports/markdown")) {
      return new Response("# Demo\n", {
        status: 200,
        headers: { "content-type": "text/markdown" },
      });
    }
    return new Response(JSON.stringify({
      nodeId: "node-1",
      imageCount: 0,
      images: [],
      removedImageId: "image-1",
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const client = new ProductGridClient({
      server: "http://localhost:3000",
      token: "secret-token",
    });
    const list = await client.listNodeImages("demo", "node-1");
    const removed = await client.removeNodeImage("demo", "node-1", "image-1");
    const markdown = await client.exportProjectMarkdown("demo");

    assert.equal(list.imageCount, 0);
    assert.equal(removed.removedImageId, "image-1");
    assert.equal(markdown, "# Demo\n");
    assert.equal(calls[0].url, "http://localhost:3000/api/v1/projects/demo/nodes/node-1/images");
    assert.equal(calls[1].init.method, "DELETE");
    assert.deepEqual(JSON.parse(calls[1].init.body), { imageId: "image-1" });
    assert.equal(calls[2].url, "http://localhost:3000/api/v1/projects/demo/exports/markdown");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("node context-pack exports subtree context and images", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "pgm-context-pack-"));
  const outputDir = path.join(tempDir, "pack");
  const calls = [];
  const stdout = createWritableBuffer();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, init });
    if (url.includes("/nodes?")) {
      return new Response(JSON.stringify({
        nodes: [{ id: "parent-1" }, { id: "child-1" }],
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (url.endsWith("/asset.png")) {
      return new Response(Buffer.from([0x89, 0x50, 0x4e, 0x47]), { status: 200 });
    }
    const nodeId = url.includes("child-1") ? "child-1" : "parent-1";
    return new Response(JSON.stringify({
      node: {
        id: nodeId,
        title: nodeId === "parent-1" ? "Parent" : "Child",
        label: nodeId === "parent-1" ? "Parent" : "Child",
        status: "planned",
        type: nodeId === "parent-1" ? "page" : "task",
        parentNodeId: nodeId === "child-1" ? "parent-1" : null,
        metadata: nodeId === "child-1" ? { implementation: "Do work" } : {},
      },
      path: [
        {
          id: "parent-1",
          title: "Parent",
          label: "Parent",
          status: "planned",
          type: "page",
          metadata: {},
          context: "Parent context",
          rawContext: "",
          images: [{
            id: "image-1",
            src: "/asset.png",
            filename: "asset.png",
            originalName: "asset.png",
            mimeType: "image/png",
          }],
        },
        ...(nodeId === "child-1"
          ? [{
            id: "child-1",
            title: "Child",
            label: "Child",
            status: "planned",
            type: "task",
            metadata: { implementation: "Do work" },
            context: "Child context",
            rawContext: "",
            images: [],
          }]
          : []),
      ],
      inheritedContext: {
        titlePath: nodeId === "child-1" ? "Parent > Child" : "Parent",
        metadata: [],
        contextBlocks: [],
        rawContextBlocks: [],
        images: [],
        hasDirectContext: true,
        hasInheritedContext: nodeId === "child-1",
        missingContext: false,
      },
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    await main([
      "node",
      "pgm",
      "node",
      "context-pack",
      "parent-1",
      "--project",
      "demo",
      "--output",
      outputDir,
      "--json",
    ], {
      stdout,
      stderr: createWritableBuffer(),
      env: {
        PRODUCT_GRID_SERVER: "http://localhost:3000",
      },
      cwd: tempDir,
    });

    const result = JSON.parse(stdout.value);
    assert.equal(result.nodeCount, 2);
    assert.equal(result.imageCount, 1);
    assert.equal(result.downloaded[0].path, path.join(outputDir, "images", "parent-1-image-1.png"));
    assert.equal(calls[0].url, "http://localhost:3000/api/v1/projects/demo/nodes?subtree=parent-1&includeSelf=true&fields=id");
    assert.ok(calls.some((call) => call.url === "http://localhost:3000/asset.png"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("skill helpers resolve bundled and project install paths", () => {
  assert.ok(getBundledSkillPath().endsWith("packages/cli/skills/product-grid-context"));

  assert.equal(
    resolveSkillInstallTarget({
      agent: "codex",
      global: false,
      cwd: "/tmp/demo",
    }),
    path.join("/tmp/demo", ".agents", "skills", "product-grid-context"),
  );
});

function createWritableBuffer() {
  return {
    value: "",
    write(chunk) {
      this.value += chunk;
    },
  };
}
