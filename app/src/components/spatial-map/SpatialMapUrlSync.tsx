import { useSearchParams } from "@solidjs/router";
import { createEffect, untrack } from "solid-js";
import { mapNodeStatuses, type MapNodeStatus } from "~/lib/spatial-map/types";
import type { SpatialMapDepthLevel, SpatialMapViewMode } from "./spatial-map-canvas.types";
import { useSpatialMap } from "./SpatialMapContext";
import { priorityMenuItems } from "./SpatialMapNodePriorityMenu";

// Keeps view state (selection, view mode, depth, filters, isolation) in the
// URL so a refresh or a shared link restores the same view.
type SpatialMapSearchParams = {
  node?: string;
  view?: SpatialMapViewMode;
  depth?: string;
  edges?: string;
  inspector?: string;
  isolate?: string;
  linked?: string;
  filter?: string;
  parents?: string;
  types?: string[];
  statuses?: string[];
  priorities?: string[];
  q?: string;
};

interface SpatialMapUrlState {
  nodeId: string | null;
  viewMode: SpatialMapViewMode | null;
  depthLevel: SpatialMapDepthLevel | null;
  showEdges: boolean | null;
  inspectorOpen: boolean | null;
  isolatedNodeId: string | null;
  showLinked: boolean | null;
  globalFilter: ReturnType<typeof parseGlobalFilter>;
}

interface SpatialMapNodeLookup {
  has(nodeId: string): boolean;
}

export function SpatialMapUrlSync() {
  const controller = useSpatialMap();
  const [searchParams, setSearchParams] =
    useSearchParams<SpatialMapSearchParams>();

  createEffect(() => {
    const nodeId = getStringParam(searchParams.node) ?? null;
    const viewMode = parseViewMode(getStringParam(searchParams.view));
    const depthLevel = parseDepthLevel(getStringParam(searchParams.depth));
    const showEdges = parseBooleanParam(getStringParam(searchParams.edges));
    const inspectorOpen = parseInspectorParam(
      getStringParam(searchParams.inspector),
    );
    const isolatedNodeId = getStringParam(searchParams.isolate) ?? null;
    const showLinked = parseBooleanParam(getStringParam(searchParams.linked));
    const globalFilter = parseGlobalFilter(searchParams);
    const nodeIds = controller.sourceNodesById();

    untrack(() => {
      syncControllerFromUrlState(controller, nodeIds, {
        nodeId,
        viewMode,
        depthLevel,
        showEdges,
        inspectorOpen,
        isolatedNodeId,
        showLinked,
        globalFilter,
      });
    });
  });

  createEffect(() => {
    const selectedNodeId = controller.selectedNodeId();
    const viewMode = controller.viewMode();
    const visibleDepthSelection = controller.visibleDepthSelection();
    const showEdges = controller.showEdges();
    const inspectorOpen = controller.inspectorOpen();
    const isolatedNodeId = controller.isolatedNodeId();
    const showLinked = controller.showLinkedInIsolation();
    const globalFilter = controller.globalFilter();

    const nextParams = {
      node: selectedNodeId,
      view: viewMode === "canvas" ? null : viewMode,
      depth:
        visibleDepthSelection === "max" ? null : String(visibleDepthSelection),
      edges: showEdges ? "1" : null,
      inspector: inspectorOpen ? null : "closed",
      isolate: isolatedNodeId,
      linked: isolatedNodeId && showLinked ? "1" : null,
      filter: globalFilter.enabled ? "1" : null,
      parents: globalFilter.includeParents ? null : "0",
      types: globalFilter.selectedTypes.length ? globalFilter.selectedTypes : undefined,
      statuses: globalFilter.selectedStatuses.length ? globalFilter.selectedStatuses : undefined,
      priorities: globalFilter.selectedPriorities.length ? globalFilter.selectedPriorities : undefined,
    };

    if (
      getNullableStringParam(searchParams.node) === nextParams.node &&
      getNullableStringParam(searchParams.view) === nextParams.view &&
      getNullableStringParam(searchParams.depth) === nextParams.depth &&
      getNullableStringParam(searchParams.edges) === nextParams.edges &&
      getNullableStringParam(searchParams.inspector) === nextParams.inspector &&
      getNullableStringParam(searchParams.isolate) === nextParams.isolate &&
      getNullableStringParam(searchParams.linked) === nextParams.linked &&
      getNullableStringParam(searchParams.filter) === nextParams.filter &&
      getNullableStringParam(searchParams.parents) === nextParams.parents &&
      sameStringParams(searchParams.types, nextParams.types) &&
      sameStringParams(searchParams.statuses, nextParams.statuses) &&
      sameStringParams(searchParams.priorities, nextParams.priorities)
    ) {
      return;
    }

    setSearchParams(nextParams, { replace: true });
  });

  return null;
}

function syncControllerFromUrlState(
  controller: ReturnType<typeof useSpatialMap>,
  nodeIds: SpatialMapNodeLookup,
  state: SpatialMapUrlState,
) {
  if (state.viewMode && controller.viewMode() !== state.viewMode) {
    controller.setViewMode(state.viewMode);
  }

  const nextDepthLevel = state.depthLevel ?? "max";
  if (controller.visibleDepthSelection() !== nextDepthLevel) {
    controller.setVisibleDepthLevel(nextDepthLevel);
  }

  if (state.showEdges !== null && controller.showEdges() !== state.showEdges) {
    controller.setShowEdges(state.showEdges);
  }

  if (
    state.inspectorOpen !== null &&
    controller.inspectorOpen() !== state.inspectorOpen
  ) {
    controller.setInspectorOpen(state.inspectorOpen);
  }

  syncIsolationFromUrlState(controller, nodeIds, state);

  if (
    state.showLinked !== null &&
    controller.showLinkedInIsolation() !== state.showLinked
  ) {
    controller.setShowLinkedInIsolation(state.showLinked);
  }

  const currentFilter = controller.globalFilter();
  const nextFilter = { ...state.globalFilter, includeChildren: currentFilter.includeChildren };
  if (
    currentFilter.enabled !== nextFilter.enabled ||
    currentFilter.includeParents !== nextFilter.includeParents ||
    !sameValues(currentFilter.selectedTypes, nextFilter.selectedTypes) ||
    !sameValues(currentFilter.selectedStatuses, nextFilter.selectedStatuses) ||
    !sameValues(currentFilter.selectedPriorities, nextFilter.selectedPriorities)
  ) {
    controller.setGlobalFilter(nextFilter);
  }

  const nextSelectedNodeId =
    state.nodeId && nodeIds.has(state.nodeId) ? state.nodeId : null;
  if (controller.selectedNodeId() !== nextSelectedNodeId) {
    controller.setSelectedNodeId(nextSelectedNodeId);
  }
}

function syncIsolationFromUrlState(
  controller: ReturnType<typeof useSpatialMap>,
  nodeIds: SpatialMapNodeLookup,
  state: Pick<SpatialMapUrlState, "isolatedNodeId">,
) {
  if (state.isolatedNodeId && nodeIds.has(state.isolatedNodeId)) {
    if (controller.isolatedNodeId() !== state.isolatedNodeId) {
      controller.isolateNode(state.isolatedNodeId);
    }
    return;
  }

  if (controller.isolatedNodeId()) {
    controller.clearIsolation();
  }
}

function getStringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getNullableStringParam(value: string | string[] | undefined) {
  return getStringParam(value) ?? null;
}

function getStringParams(value: string | string[] | undefined) {
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

function sameStringParams(left: string | string[] | undefined, right: string[] | undefined) {
  const a = getStringParams(left);
  const b = right ?? [];
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function sameValues(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function parseGlobalFilter(params: SpatialMapSearchParams) {
  const types = getStringParams(params.types);
  const statuses = getStringParams(params.statuses).filter(
    (value): value is MapNodeStatus => (mapNodeStatuses as readonly string[]).includes(value),
  );
  const priorities = getStringParams(params.priorities).filter((value) =>
    priorityMenuItems.some((item) => item.value === value),
  );
  return {
    enabled: parseBooleanParam(getStringParam(params.filter)) ?? false,
    includeParents: parseBooleanParam(getStringParam(params.parents)) ?? true,
    includeChildren: false,
    selectedTypes: types,
    selectedStatuses: statuses,
    selectedPriorities: priorities,
  };
}

function parseViewMode(value: string | undefined): SpatialMapViewMode | null {
  if (value === "markdown") {
    return "tree";
  }

  return value === "canvas" || value === "tree" || value === "grid"
    ? value
    : null;
}

function parseDepthLevel(value: string | undefined): SpatialMapDepthLevel | null {
  if (!value) {
    return null;
  }

  if (value === "max") {
    return value;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseBooleanParam(value: string | undefined) {
  if (value === "1" || value === "true") {
    return true;
  }

  if (value === "0" || value === "false") {
    return false;
  }

  return null;
}

function parseInspectorParam(value: string | undefined) {
  if (value === "closed") {
    return false;
  }

  if (value === "open") {
    return true;
  }

  return parseBooleanParam(value);
}
