import { describe, expect, it } from "vitest";
import type { MapNode } from "~/lib/spatial-map/types";
import { countDescendants, getAncestorIds } from "./spatial-map-structure";
import { buildSpatialMapTree } from "./spatial-map-tree";

const node = (id: string): MapNode => ({ id, label: id, type: "page", status: "planned", metadata: {}, context: "", rawContext: "" });

const tree = buildSpatialMapTree({
  nodes: ["root", "a", "a1", "a1x", "b"].map(node),
  links: [
    { source: "root", target: "a", parentChild: true },
    { source: "a", target: "a1", parentChild: true },
    { source: "a1", target: "a1x", parentChild: true },
    { source: "root", target: "b", parentChild: true },
    { source: "b", target: "a1", parentChild: false },
  ],
});

describe("structure peek helpers", () => {
  it("lists ancestors root first and ignores non-parent links", () => {
    expect(getAncestorIds(tree, "a1x")).toEqual(["root", "a", "a1"]);
    expect(getAncestorIds(tree, "root")).toEqual([]);
  });

  it("counts every descendant", () => {
    expect(countDescendants(tree, "root")).toBe(4);
    expect(countDescendants(tree, "a1x")).toBe(0);
  });
});
