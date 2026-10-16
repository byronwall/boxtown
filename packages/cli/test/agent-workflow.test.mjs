import assert from "node:assert/strict";
import { test } from "node:test";
import { runCli } from "./helpers.mjs";

test("project history pages with a cursor and node filter", async () => {
  const { calls, stdout, error } = await runCli(
    ["project", "history", "demo", "--limit", "2", "--before", "abc", "--node", "node-1", "--json"],
    () => ({ body: { projectId: "demo", entries: [{ id: "op-1" }], nextCursor: "next" } }),
  );

  assert.equal(error, null);
  assert.equal(calls[0].url, "http://localhost:3000/api/v1/projects/demo/history?limit=2&before=abc&nodeId=node-1");
  assert.equal(JSON.parse(stdout).nextCursor, "next");
});

test("schema ensure-field posts one field without replacing the schema", async () => {
  const { calls, stdout, error } = await runCli(
    ["project", "schema", "ensure-field", "solution", "--label", "Solution", "--project", "demo"],
    () => ({
      status: 201,
      body: {
        created: true,
        field: { key: "solution", label: "Solution", defaultValue: "" },
        fields: [{ key: "purpose" }, { key: "solution" }],
      },
    }),
  );

  assert.equal(error, null);
  assert.equal(calls[0].url, "http://localhost:3000/api/v1/projects/demo/schema/fields");
  assert.deepEqual(calls[0].body, { key: "solution", label: "Solution" });
  assert.match(stdout, /Added solution \(Solution\)\. Fields: purpose, solution/);
});

test("API errors keep their code and details", async () => {
  const { error } = await runCli(
    ["node", "metadata", "set", "node-1", "soluton", "x", "--project", "demo"],
    () => ({
      status: 400,
      body: { error: { code: "invalid_metadata_key", message: "Unknown metadata field: soluton.", details: { keys: ["soluton"] } } },
    }),
  );

  assert.equal(error.code, "invalid_metadata_key");
  assert.deepEqual(error.details.keys, ["soluton"]);
});

const schema = {
  projectId: "demo",
  statuses: [{ value: "planned" }, { value: "implemented" }, { value: "blocked" }],
  nodeTypes: [],
  metadataFields: [
    { key: "implementation", label: "Implementation" },
    { key: "solution", label: "Solution" },
    { key: "blocked-by", label: "Blocked by" },
  ],
};

function fakeServer(call) {
  if (call.url.endsWith("/schema")) return { body: { schema } };
  const nodeId = decodeURIComponent(call.url.split("/nodes/")[1] ?? "");
  const metadata = call.body?.metadata?.set ?? {};
  return {
    body: {
      node: { id: nodeId, label: nodeId, status: call.body?.status ?? "planned", metadata },
      changedFields: [
        ...(call.body?.status ? ["status"] : []),
        ...Object.keys(metadata).map((key) => `metadata.${key}`),
      ],
      revision: "rev",
      operationId: `op-${nodeId}`,
    },
  };
}

test("batch-update rejects a bad item without a request, keeps siblings, and exits nonzero", async () => {
  const { writeFile, mkdtemp } = await import("node:fs/promises");
  const os = await import("node:os");
  const path = await import("node:path");
  const dir = await mkdtemp(path.join(os.tmpdir(), "pgm-batch-"));
  await writeFile(path.join(dir, "updates.json"), JSON.stringify([
    { id: "good", status: "implemented", metadata: { solution: "Fixed" } },
    { id: "typo", status: "implemented", metadata: { soluton: "Fixed" } },
  ]));

  const { calls, stdout, error } = await runCli(
    ["node", "batch-update", "--project", "demo", "--json-input", "updates.json", "--json"],
    fakeServer,
    { cwd: dir },
  );

  assert.equal(error.exitCode, 8);
  assert.equal(calls.filter((call) => call.method === "PATCH").length, 1);
  const body = JSON.parse(stdout);
  assert.deepEqual(body.results[0], {
    index: 0,
    nodeId: "good",
    outcome: "applied",
    status: "implemented",
    changedFields: ["status", "metadata.solution"],
    savedFields: { status: "implemented", "metadata.solution": "Fixed" },
    revision: "rev",
    operationId: "op-good",
  });
  assert.equal(body.results[1].outcome, "rejected");
  assert.equal(body.results[1].error.code, "invalid_metadata_key");
  assert.match(body.results[1].error.message, /This project defines: implementation, solution, blocked-by/);
  assert.match(body.results[1].error.message, /pgm project schema ensure-field soluton/);
});

test("a dropped connection reports an unknown outcome with a readback command", async () => {
  const { writeFile, mkdtemp } = await import("node:fs/promises");
  const os = await import("node:os");
  const path = await import("node:path");
  const dir = await mkdtemp(path.join(os.tmpdir(), "pgm-batch-"));
  await writeFile(path.join(dir, "updates.json"), JSON.stringify([{ id: "node-1", status: "implemented" }]));
  const originalFetch = globalThis.fetch;

  const { stdout, error } = await runCli(
    ["node", "batch-update", "--project", "demo", "--json-input", "updates.json", "--json"],
    (call) => {
      if (call.method === "PATCH") throw new TypeError("fetch failed");
      return fakeServer(call);
    },
    { cwd: dir },
  );

  assert.equal(globalThis.fetch, originalFetch);
  assert.equal(error.exitCode, 8);
  const [result] = JSON.parse(stdout).results;
  assert.equal(result.outcome, "unknown");
  assert.equal(result.readback, "pgm node view node-1 --json");
});

test("agent-update maps list fields to declared keys and rejects unknown input keys", async () => {
  const { writeFile, mkdtemp } = await import("node:fs/promises");
  const os = await import("node:os");
  const path = await import("node:path");
  const dir = await mkdtemp(path.join(os.tmpdir(), "pgm-agent-"));
  await writeFile(path.join(dir, "status.json"), JSON.stringify([
    { id: "a", status: "blocked", summary: "Tried X", blockedBy: ["node-b"], solution: "Workaround Y" },
    { id: "b", status: "implemented", solutoin: "typo" },
  ]));

  const { calls, stdout, error } = await runCli(
    ["node", "agent-update", "--project", "demo", "--file", "status.json", "--json"],
    fakeServer,
    { cwd: dir },
  );

  assert.equal(error.exitCode, 8);
  const patch = calls.find((call) => call.method === "PATCH");
  assert.deepEqual(patch.body, {
    status: "blocked",
    metadata: { set: { implementation: "Tried X", "blocked-by": "node-b", solution: "Workaround Y" } },
  });
  const body = JSON.parse(stdout);
  assert.equal(body.results[1].error.code, "unknown_update_key");
  assert.match(body.results[1].error.message, /solutoin/);
});

test("resolve --solution saves status and solution in one request", async () => {
  const { calls, error } = await runCli(
    ["node", "resolve", "node-1", "--project", "demo", "--note", "Code change", "--solution", "Proven fix", "--json"],
    fakeServer,
  );

  assert.equal(error, null);
  const patches = calls.filter((call) => call.method === "PATCH");
  assert.equal(patches.length, 1);
  assert.deepEqual(patches[0].body, {
    status: "implemented",
    metadata: { set: { implementation: "Code change", solution: "Proven fix" } },
  });
});

test("resolve with an undeclared field fails before changing status", async () => {
  const { calls, error } = await runCli(
    ["node", "resolve", "node-1", "--project", "demo", "--deferred", "Later", "--json"],
    fakeServer,
  );

  assert.equal(error.code, "invalid_metadata_key");
  assert.equal(calls.filter((call) => call.method === "PATCH").length, 0);
});

test("text from a file or stdin is sent exactly, without shell evaluation", async () => {
  const { writeFile, mkdtemp } = await import("node:fs/promises");
  const { Readable } = await import("node:stream");
  const os = await import("node:os");
  const path = await import("node:path");
  const dir = await mkdtemp(path.join(os.tmpdir(), "pgm-text-"));
  const text = "Ran `pnpm test` and $(whoami) with \"quotes\" — ✅\n  indented line\n";
  await writeFile(path.join(dir, "solution.md"), text);

  const fromFile = await runCli(
    ["node", "metadata", "set", "node-1", "solution", "--value-file", "solution.md", "--project", "demo", "--json"],
    fakeServer,
    { cwd: dir },
  );
  const fromStdin = await runCli(
    ["node", "metadata", "set", "node-1", "solution", "--value-file", "-", "--project", "demo", "--json"],
    fakeServer,
    { stdin: Readable.from([text]) },
  );

  assert.equal(fromFile.error, null);
  assert.equal(fromStdin.error, null);
  assert.equal(fromFile.calls[0].body.metadata.set.solution, text);
  assert.equal(fromStdin.calls[0].body.metadata.set.solution, text);
});

test("node note add posts the note text to the server", async () => {
  const { calls, error } = await runCli(
    ["node", "note", "add", "node-1", "--text", "Retry with `--force` failed", "--heading", "Attempt", "--project", "demo", "--json"],
    () => ({ body: { node: { id: "node-1", label: "Node 1", context: "..." }, changedFields: ["context"] } }),
  );

  assert.equal(error, null);
  assert.equal(calls[0].url, "http://localhost:3000/api/v1/projects/demo/nodes/node-1/notes");
  assert.deepEqual(calls[0].body, { text: "Retry with `--force` failed", heading: "Attempt" });
});

test("relation commands list, add, and remove links on the source node", async () => {
  const respond = (call) => {
    if (call.method === "GET") return { body: { nodeId: "a", relations: [] } };
    if (call.method === "POST") return { body: { created: true, link: { source: "a", target: "b", relationship: "dependency" } } };
    return { body: { removed: { source: "a", target: "b", relationship: "dependency" } } };
  };

  const list = await runCli(["relation", "list", "a", "--project", "demo", "--json"], respond);
  const add = await runCli(["relation", "add", "a", "b", "--relationship", "dependency", "--project", "demo"], respond);
  const remove = await runCli(["relation", "remove", "a", "b", "--relationship", "dependency", "--project", "demo"], respond);

  assert.equal(list.calls[0].url, "http://localhost:3000/api/v1/projects/demo/nodes/a/relations");
  assert.deepEqual(add.calls[0].body, { target: "b", relationship: "dependency" });
  assert.match(add.stdout, /Added dependency a -> b/);
  assert.equal(remove.calls[0].method, "DELETE");
});
