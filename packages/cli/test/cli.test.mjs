import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ProductGridClient } from "../src/client.mjs";
import { defaultServer, resolveProjectId, resolveServer, resolveToken } from "../src/config.mjs";
import { main, parseArgs } from "../src/main.mjs";
import { getBundledSkillPath, resolveSkillInstallTarget } from "../src/skill.mjs";
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
