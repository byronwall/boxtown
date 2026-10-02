import { expect, it } from "vitest";
import { getNodeLastEditorKinds } from "./node-last-editor";
import type { ProjectOperationLogEntry } from "./types";

it("keeps the newest retained actor for each node and leaves missing nodes unknown", () => {
  const base = { kind: "nodes.bulk.updated", summary: "Update nodes" } as const;
  const log: ProjectOperationLogEntry[] = [
    {
      ...base,
      id: "new-human",
      createdAt: "2026-10-01T04:00:00Z",
      actor: { kind: "human" },
      nodeIds: ["latest-human", "human-only"],
    },
    {
      ...base,
      id: "new-agent",
      createdAt: "2026-10-01T03:00:00Z",
      actor: { kind: "agent" },
      nodeIds: ["latest-agent", "agent-only"],
    },
    {
      ...base,
      id: "old-agent",
      createdAt: "2026-10-01T02:00:00Z",
      actor: { kind: "agent" },
      nodeIds: ["latest-human"],
    },
    {
      ...base,
      id: "old-human",
      createdAt: "2026-10-01T01:00:00Z",
      actor: { kind: "human" },
      nodeIds: ["latest-agent"],
    },
  ];

  const editors = getNodeLastEditorKinds(log);

  expect(editors).toEqual(new Map([
    ["latest-human", "human"],
    ["human-only", "human"],
    ["latest-agent", "agent"],
    ["agent-only", "agent"],
  ]));
  expect(editors.has("missing-node")).toBe(false);
  expect(editors.get("missing-node")).toBeUndefined();
});
