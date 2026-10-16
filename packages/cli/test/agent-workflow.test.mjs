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
