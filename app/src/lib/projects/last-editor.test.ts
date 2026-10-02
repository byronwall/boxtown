import { describe, expect, it } from "vitest";
import { getLastEditorKinds } from "./last-editor";
import type { ProjectOperationLogEntry } from "./types";

const entry = (kind: "human" | "agent", nodeIds: string[]): ProjectOperationLogEntry => ({
  id: `${kind}-${nodeIds.join()}`,
  kind: "node.title.updated",
  actor: { kind },
  createdAt: "2026-10-02T00:00:00.000Z",
  summary: "",
  nodeIds,
});

describe("getLastEditorKinds", () => {
  it("uses the newest retained entry for each node", () => {
    const editors = getLastEditorKinds([
      entry("agent", ["a"]),
      entry("human", ["a", "b"]),
      entry("agent", ["b", "c"]),
    ]);
    expect(editors.get("a")).toBe("agent");
    expect(editors.get("b")).toBe("human");
    expect(editors.get("c")).toBe("agent");
  });

  it("leaves nodes without retained history unknown", () => {
    expect(getLastEditorKinds([entry("human", ["a"])]).has("untouched")).toBe(false);
  });
});
