import { describe, expect, it } from "vitest";
import { applyBulkNodeUpdate, describeBulkNodeUpdate } from "./bulk-update";
import type { MapNode } from "~/lib/spatial-map/types";

const data = {
  nodes: [createNode("a"), createNode("b", true), createNode("c")],
  links: [],
};

describe("applyBulkNodeUpdate", () => {
  it("updates status and archive state only for the targeted nodes", () => {
    const next = applyBulkNodeUpdate(data, {
      nodeIds: ["a", "b"],
      status: "implemented",
      archived: true,
    });

    expect(next.nodes.map((node) => [node.id, node.status, node.archived])).toEqual([
      ["a", "implemented", true],
      ["b", "implemented", true],
      ["c", "planned", undefined],
    ]);
  });

  it("removes the archived field when unarchiving", () => {
    const next = applyBulkNodeUpdate(data, { nodeIds: ["b"], archived: false });
    expect(next.nodes[1]).not.toHaveProperty("archived");
  });

  it("summarizes the change for the activity log", () => {
    expect(describeBulkNodeUpdate({ nodeIds: ["a", "b"], status: "blocked" })).toBe(
      "Bulk updated 2 nodes: status to blocked.",
    );
  });
});

function createNode(id: string, archived = false): MapNode {
  return {
    id,
    label: id,
    type: "task",
    status: "planned",
    metadata: {},
    context: "",
    rawContext: "",
    ...(archived ? { archived: true } : {}),
  };
}
