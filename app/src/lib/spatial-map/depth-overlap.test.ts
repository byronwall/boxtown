import { describe, expect, it } from "vitest";
import { applyDepthOverlap } from "./depth-overlap";
import type { PositionedMapNode } from "./types";

const node = (id: string, depth: number, x: number, y: number): PositionedMapNode => ({
  id,
  label: id,
  type: "page",
  status: "planned",
  metadata: {},
  context: "",
  rawContext: "",
  depth,
  x,
  y,
  vx: 0,
  vy: 0,
  width: 200,
  height: 120,
  fontSize: 20,
  metaSize: 12,
});

describe("applyDepthOverlap", () => {
  const nodes = [node("child", 1, 400, 0), node("root", 0, 0, 0), node("grandchild", 2, 400, 300)];
  const links = [
    { source: "root", target: "child", parentChild: true },
    { source: "child", target: "grandchild", parentChild: true },
  ];

  it("pulls children toward their placed parent so tiles overlap", () => {
    const placed = new Map(applyDepthOverlap(nodes, links).map((item) => [item.id, item]));
    expect(placed.get("root")).toMatchObject({ x: 0, y: 0 });
    expect(placed.get("child")).toMatchObject({ x: 272, y: -8 });
    expect(placed.get("grandchild")).toMatchObject({ x: 264, y: 194 });
    // Children move toward their parent, so adjacent tiles end up overlapping.
    expect(placed.get("child")!.x).toBeLessThan(400);
  });

  it("draws shallow tiles first so deeper tiles sit on top", () => {
    expect(applyDepthOverlap(nodes, links).map((item) => item.id)).toEqual(["root", "child", "grandchild"]);
  });

  it("keeps sizes and leaves unlinked nodes in place", () => {
    const lone = node("lone", 0, 900, 900);
    const [placed] = applyDepthOverlap([lone], []);
    expect(placed).toEqual(lone);
  });
});
