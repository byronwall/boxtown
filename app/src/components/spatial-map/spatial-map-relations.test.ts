import { describe, expect, it } from "vitest";
import type { PositionedMapNode } from "~/lib/spatial-map/types";
import { createOrderedNodeState } from "./spatial-map-relations";

const baseNode: PositionedMapNode = {
  context: "",
  contextMode: "structured",
  depth: 0,
  fontSize: 16,
  height: 100,
  id: "node-a",
  images: [],
  implementation: "",
  label: "Node A",
  metaSize: 10,
  purpose: "",
  rawContext: "",
  type: "page",
  vx: 0,
  vy: 0,
  width: 200,
  x: 100,
  y: 100,
};

const unrelatedNode: PositionedMapNode = {
  ...baseNode,
  id: "node-b",
  label: "Node B",
  x: 320,
};

describe("createOrderedNodeState", () => {
  it("does not scale active nodes after layout", () => {
    const states = createOrderedNodeState({
      activeNodeId: "node-a",
      hoveredNodeId: "node-a",
      positionedNodes: [baseNode],
      relatedSet: new Set(["node-a"]),
      selectedNodeId: "node-a",
      transitionVisualState: new Map([["node-a", { opacity: 1, scale: 1.2 }]]),
    });

    expect(states[0]?.scale).toBe(1);
  });

  it("keeps unrelated nodes at full opacity during hover-only interactions", () => {
    const states = createOrderedNodeState({
      activeNodeId: null,
      hoveredNodeId: "node-a",
      positionedNodes: [baseNode, unrelatedNode],
      relatedSet: new Set(),
      selectedNodeId: null,
    });

    expect(states.map((state) => state.opacity)).toEqual([1, 1]);
    expect(states.map((state) => state.isHovered)).toEqual([true, false]);
  });
});
