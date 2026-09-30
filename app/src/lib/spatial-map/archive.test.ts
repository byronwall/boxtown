import { describe, expect, it } from "vitest";
import { getArchivedSubtreeNodeIds, hideArchivedNodes } from "./archive";
import type { MapNode, SpatialMapData } from "./types";

const data: SpatialMapData = {
  nodes: [
    createNode("root"),
    createNode("done", true),
    createNode("done-child"),
    createNode("open"),
  ],
  links: [
    { source: "root", target: "done", parentChild: true },
    { source: "done", target: "done-child", parentChild: true },
    { source: "root", target: "open", parentChild: true },
    { source: "open", target: "done-child", parentChild: false },
  ],
};

describe("archive visibility", () => {
  it("collects archived nodes and their descendants", () => {
    expect([...getArchivedSubtreeNodeIds(data)].sort()).toEqual(["done", "done-child"]);
  });

  it("removes archived subtrees and their links", () => {
    const visible = hideArchivedNodes(data);
    expect(visible.nodes.map((node) => node.id)).toEqual(["root", "open"]);
    expect(visible.links).toEqual([{ source: "root", target: "open", parentChild: true }]);
  });

  it("returns the same data when nothing is archived", () => {
    const plain = { nodes: [createNode("a")], links: [] };
    expect(hideArchivedNodes(plain)).toBe(plain);
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
