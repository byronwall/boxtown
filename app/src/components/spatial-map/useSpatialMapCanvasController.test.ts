import { describe, expect, it } from "vitest";
import { filterSpatialMapDataByGlobalFilter } from "./useSpatialMapCanvasController";
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
