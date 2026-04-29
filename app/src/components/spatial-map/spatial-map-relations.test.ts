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
  label: "Node A",
  metadata: {},
  metaSize: 10,
  rawContext: "",
  status: "planned",
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

    expect(states[0]?.scale).toBe(1.2);
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

  it("lightens deeper visible node fills without changing opacity", () => {
    const deepNode: PositionedMapNode = {
      ...unrelatedNode,
      depth: 2,
    };

    const states = createOrderedNodeState({
      activeNodeId: null,
      hoveredNodeId: null,
      positionedNodes: [baseNode, deepNode],
      relatedSet: new Set(),
      selectedNodeId: null,
    });

    expect(states.map((state) => state.opacity)).toEqual([1, 1]);
    expect(states[0]?.depthFillLightness).toBe("0%");
    expect(states[1]?.depthFillLightness).toBe("46%");
    expect(states[1]?.depthFillHoverLightness).toBe("36%");
    expect(states[0]?.depthStrokeLightness).toBe("0%");
    expect(states[1]?.depthStrokeLightness).toBe("28%");
    expect(states[1]?.depthStrokeHoverLightness).toBe("22%");
    expect(states[0]?.depthStrokeWidth).toBe(1.4);
    expect(states[1]?.depthStrokeWidth).toBe(1.05);
  });

  it("keeps single-depth views visually neutral", () => {
    const sameDepthNode: PositionedMapNode = {
      ...unrelatedNode,
      depth: 0,
    };

    const states = createOrderedNodeState({
      activeNodeId: null,
      hoveredNodeId: null,
      positionedNodes: [baseNode, sameDepthNode],
      relatedSet: new Set(),
      selectedNodeId: null,
    });

    expect(states.map((state) => state.scale)).toEqual([1, 1]);
    expect(states.map((state) => state.depthFillLightness)).toEqual(["0%", "0%"]);
    expect(states.map((state) => state.depthStrokeLightness)).toEqual(["0%", "0%"]);
    expect(states.map((state) => state.depthStrokeWidth)).toEqual([1.4, 1.4]);
  });
});
