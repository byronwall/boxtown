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
  it("filters by last editor kind, combined with type, and never matches unknown history", () => {
    const lastEditors = new Map([
      ["task-planned", "agent" as const],
      ["task-working", "human" as const],
      ["page-planned", "agent" as const],
    ]);

    expect(filterSpatialMapDataByGlobalFilter(data, createFilter({
      selectedEditors: ["agent"],
      selectedTypes: ["task"],
    }), lastEditors).nodes.map((node) => node.id)).toEqual(["task-planned"]);
    // page-working has no retained history, so it is neither human nor agent.
    expect(filterSpatialMapDataByGlobalFilter(data, createFilter({
      selectedEditors: ["human"],
    }), lastEditors).nodes.map((node) => node.id)).toEqual(["task-working"]);
  });

  it("adds descendants and ancestors of last-editor matches when asked", () => {
    const lastEditors = new Map([["page-working", "human" as const]]);
    const withChildren = filterSpatialMapDataByGlobalFilter(data, createFilter({
      selectedEditors: ["human"],
      includeChildren: true,
    }), lastEditors);
    expect(withChildren.nodes.map((node) => node.id)).toEqual(["task-working", "page-working"]);

    const withParents = filterSpatialMapDataByGlobalFilter(data, createFilter({
      selectedEditors: ["agent"],
      includeParents: true,
    }), new Map([["task-planned", "agent" as const]]));
    expect(withParents.nodes.map((node) => node.id)).toEqual(["task-planned", "page-planned"]);
  });

  it("returns no nodes when nothing matches", () => {
    expect(filterSpatialMapDataByGlobalFilter(data, createFilter({ selectedEditors: ["agent"] })).nodes).toEqual([]);
  });


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

  it("filters by priority, with none matching unprioritized nodes", () => {
    const prioritized: SpatialMapData = {
      nodes: [
        { ...createNode("urgent-bug", "task", "planned"), priority: "urgent" },
        createNode("plain", "task", "planned"),
      ],
      links: [],
    };

    expect(filterSpatialMapDataByGlobalFilter(prioritized, createFilter({
      selectedPriorities: ["urgent"],
    })).nodes.map((node) => node.id)).toEqual(["urgent-bug"]);
    expect(filterSpatialMapDataByGlobalFilter(prioritized, createFilter({
      selectedPriorities: ["none"],
    })).nodes.map((node) => node.id)).toEqual(["plain"]);
  });

  it("includes every descendant of matched nodes when includeChildren is on", () => {
    const treeData: SpatialMapData = {
      nodes: [
        createNode("area", "page", "working"),
        createNode("child", "task", "implemented"),
        createNode("grandchild", "task", "blocked"),
        createNode("other", "task", "implemented"),
      ],
      links: [
        { source: "area", target: "child", parentChild: true },
        { source: "child", target: "grandchild", parentChild: true },
      ],
    };

    const filtered = filterSpatialMapDataByGlobalFilter(treeData, createFilter({
      selectedTypes: ["page"],
      includeChildren: true,
    }));

    expect(filtered.nodes.map((node) => node.id)).toEqual(["area", "child", "grandchild"]);
    expect(filtered.links).toHaveLength(2);
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
    includeChildren: false,
    selectedTypes: [],
    selectedPriorities: [],
    selectedStatuses: [],
    selectedEditors: [],
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
