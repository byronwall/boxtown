import { describe, expect, it } from "vitest";
import {
  filterSpatialMapDataByDepthLevel,
  filterSpatialMapDataByGlobalFilter,
} from "./useSpatialMapCanvasController";
import type { SpatialMapGlobalFilterState } from "./spatial-map-canvas.types";
import type { MapNode, SpatialMapData } from "~/lib/spatial-map/types";

const data: SpatialMapData = {
  nodes: [
    createNode("task-planned", "task", "planned"),
    createNode("task-working", "task", "working"),
    createNode("page-planned", "page", "planned"),
    createNode("page-working", "page", "working"),
  ],
  links: [
    { source: "page-planned", target: "task-planned", parentChild: true },
    { source: "page-working", target: "task-working", parentChild: true },
  ],
};

describe("filterSpatialMapDataByGlobalFilter", () => {
  it("filters by a selected type when no status is selected", () => {
    const filtered = filterSpatialMapDataByGlobalFilter(data, createFilter({
      selectedTypes: ["task"],
    }));

    expect(filtered.nodes.map((node) => node.id)).toEqual(["task-planned", "task-working"]);
  });

  it("filters by a selected status when no type is selected", () => {
    const filtered = filterSpatialMapDataByGlobalFilter(data, createFilter({
      selectedStatuses: ["planned"],
    }));

    expect(filtered.nodes.map((node) => node.id)).toEqual(["task-planned", "page-planned"]);
  });

  it("uses AND semantics when type and status are both selected", () => {
    const filtered = filterSpatialMapDataByGlobalFilter(data, createFilter({
      selectedTypes: ["task"],
      selectedStatuses: ["planned"],
    }));

    expect(filtered.nodes.map((node) => node.id)).toEqual(["task-planned"]);
  });
});

describe("filterSpatialMapDataByDepthLevel", () => {
  const treeData: SpatialMapData = {
    nodes: [
      createNode("root", "page", "working"),
      createNode("section", "assembly", "working"),
      createNode("component", "component", "working"),
      createNode("nested", "component", "working"),
    ],
    links: [
      { source: "root", target: "section", parentChild: true },
      { source: "section", target: "component", parentChild: true },
      { source: "component", target: "nested", parentChild: true },
    ],
  };

  it("adds one child layer for manually expanded visible nodes", () => {
    const filtered = filterSpatialMapDataByDepthLevel(
      treeData,
      1,
      new Set(["root"]),
    );

    expect(filtered.nodes.map((node) => node.id)).toEqual(["root", "section"]);
  });

  it("adds another child layer when a newly visible child is also manually expanded", () => {
    const filtered = filterSpatialMapDataByDepthLevel(
      treeData,
      1,
      new Set(["root", "section"]),
    );

    expect(filtered.nodes.map((node) => node.id)).toEqual(["root", "section", "component"]);
  });

  it("does not expand through collapsed descendants", () => {
    const filtered = filterSpatialMapDataByDepthLevel(
      treeData,
      1,
      new Set(["root", "component"]),
    );

    expect(filtered.nodes.map((node) => node.id)).toEqual(["root", "section"]);
  });
});

function createFilter(
  overrides: Partial<SpatialMapGlobalFilterState>,
): SpatialMapGlobalFilterState {
  return {
    enabled: true,
    includeParents: false,
    selectedTypes: [],
    selectedStatuses: [],
    ...overrides,
  };
}

function createNode(id: string, type: string, status: MapNode["status"]): MapNode {
  return {
    id,
    label: id,
    type,
    status,
    metadata: {},
    context: "",
    rawContext: "",
  };
}
