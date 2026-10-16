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
