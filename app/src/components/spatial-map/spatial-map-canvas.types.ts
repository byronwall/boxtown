import type { Accessor, JSX } from "solid-js";
import type {
  MapNodeStatus,
  MapNode,
  PositionedMapNode,
  SpatialMapData,
} from "~/lib/spatial-map/types";

export type SpatialMapViewMode = "canvas" | "tree" | "grid";
export type SpatialMapDepthLevel = number | "max";
export type SpatialMapNodeColorMode = "type" | "status";

export interface SpatialMapGlobalFilterState {
  enabled: boolean;
  includeParents: boolean;
  includeChildren: boolean;
  selectedTypes: string[];
  selectedStatuses: MapNodeStatus[];
}

export interface CameraState {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NodeVisualState {
  node: PositionedMapNode;
  hasUnexpandedChildren: boolean;
  isHovered: boolean;
  isManuallyExpanded: boolean;
  isSelected: boolean;
  opacity: number;
  scale: number;
  depthFillLightness: string;
  depthFillHoverLightness: string;
  depthStrokeLightness: string;
  depthStrokeHoverLightness: string;
  depthStrokeWidth: number;
}

export interface TransitionVisualState {
  opacity: number;
  scale: number;
}

export interface EdgeVisualState {
  linkId: string;
  path: string;
  opacity: number;
}

export interface ChildNodeDraft {
  parentNodeId: string | null;
  x: number;
  y: number;
}

export interface ViewportPointerHandlers {
  onPointerDown: JSX.EventHandlerUnion<HTMLDivElement, PointerEvent>;
  onPointerMove: JSX.EventHandlerUnion<HTMLDivElement, PointerEvent>;
  onPointerUp: JSX.EventHandlerUnion<HTMLDivElement, PointerEvent>;
  onPointerLeave: JSX.EventHandlerUnion<HTMLDivElement, PointerEvent>;
  onPointerCancel: JSX.EventHandlerUnion<HTMLDivElement, PointerEvent>;
  onWheel: JSX.EventHandlerUnion<HTMLDivElement, WheelEvent>;
}

export interface SceneInteractionHandlers {
  onBackgroundClick: JSX.EventHandlerUnion<SVGSVGElement, MouseEvent>;
  onBackgroundDoubleClick: JSX.EventHandlerUnion<SVGSVGElement, MouseEvent>;
  onNodeClick: (nodeId: string) => void;
  onNodeDoubleClick: (nodeId: string) => void;
  onNodePointerDown: (nodeId: string) => void;
  onNodePointerEnter: (nodeId: string) => void;
  onNodePointerLeave: (nodeId: string) => void;
}

export interface SpatialMapCanvasController {
  addNodesOpen: Accessor<boolean>;
  camera: Accessor<CameraState>;
  sceneTransform: Accessor<string>;
  contextNoteConversionOpen: Accessor<boolean>;
  contextPreviewRequest: Accessor<{ nodeId: string; requestId: number } | null>;
  deleteSubtreeConfirmId: Accessor<string | null>;
  deleteNodeRequest: Accessor<{ nodeId: string; requestId: number } | null>;
  edgeState: Accessor<EdgeVisualState[]>;
  isolatedNodeId: Accessor<string | null>;
  isolationLabel: Accessor<string | null>;
  isolationModeActive: Accessor<boolean>;
  inspectorOpen: Accessor<boolean>;
  isPanning: Accessor<boolean>;
  reparentingNodeId: Accessor<string | null>;
  orderedNodes: Accessor<NodeVisualState[]>;
  selectedNodeId: Accessor<string | null>;
  manuallyExpandedNodeIds: Accessor<Set<string>>;
  selectedNodeRelations: Accessor<{
    outgoing: { kind: string; nodeId: string }[];
    incoming: { kind: string; nodeId: string }[];
  }>;
  selectedNode: Accessor<MapNode | null>;
  stashedNodeIds: Accessor<string[]>;
  stashedNodes: Accessor<MapNode[]>;
  showEdges: Accessor<boolean>;
  showLinkedInIsolation: Accessor<boolean>;
  globalFilter: Accessor<SpatialMapGlobalFilterState>;
  globalFilterActive: Accessor<boolean>;
  globalFilterMatchedCount: Accessor<number>;
  availableNodeTypes: Accessor<string[]>;
  availableNodeStatuses: Accessor<MapNodeStatus[]>;
  sourceData: Accessor<SpatialMapData>;
  sourceNodesById: Accessor<Map<string, MapNode>>;
  sourceDecompositionOpen: Accessor<boolean>;
  childNodeDraft: Accessor<ChildNodeDraft | null>;
  availableDepthLevels: Accessor<number[]>;
  visibleData: Accessor<SpatialMapData>;
  visibleDepthSelection: Accessor<SpatialMapDepthLevel>;
  visibleDepthLevel: Accessor<number>;
  viewMode: Accessor<SpatialMapViewMode>;
  viewportScale: Accessor<number>;
  zoomPercent: Accessor<string>;
  zoomScale: Accessor<number>;
  closeAddNodesFlow: () => void;
  closeContextNoteConversionFlow: () => void;
  closeSourceDecompositionFlow: () => void;
  clearIsolation: () => void;
  clearDeleteSubtreeConfirm: () => void;
  clearDeleteNodeRequest: () => void;
  clearChildNodeDraft: () => void;
  clearContextPreviewRequest: () => void;
  clearReparentingNode: () => void;
  focusNode: (nodeId: string) => void;
  focusStashedNode: (nodeId: string) => void;
  isolateNode: (nodeId: string) => void;
  stashNode: (nodeId: string) => void;
  setInspectorOpen: (value: boolean | ((current: boolean) => boolean)) => void;
  setSelectedNodeId: (
    value: string | null | ((current: string | null) => string | null),
  ) => void;
  setShowEdges: (value: boolean | ((current: boolean) => boolean)) => void;
  setShowLinkedInIsolation: (
    value: boolean | ((current: boolean) => boolean),
  ) => void;
  setGlobalFilterEnabled: (value: boolean | ((current: boolean) => boolean)) => void;
  setGlobalFilterIncludeParents: (
    value: boolean | ((current: boolean) => boolean),
  ) => void;
  setGlobalFilterIncludeChildren: (
    value: boolean | ((current: boolean) => boolean),
  ) => void;
  showArchived: Accessor<boolean>;
  setShowArchived: (value: boolean) => void;
  toggleGlobalFilterType: (type: string) => void;
  toggleGlobalFilterStatus: (status: MapNodeStatus) => void;
  setViewMode: (value: SpatialMapViewMode) => void;
  setVisibleDepthLevel: (value: SpatialMapDepthLevel) => void;
  toggleLinkedInIsolation: () => void;
  toggleEdges: () => void;
  toggleNodeStash: (nodeId: string) => void;
  unstashNode: (nodeId: string) => void;
  reflowLayout: () => void;
  fitCameraToNodes: () => void;
  openChildNodeDraft: (
    parentNodeId?: string | null,
    options?: { anchorToParent?: boolean },
  ) => void;
  openAddNodesFlow: () => void;
  openContextNoteConversionFlow: () => void;
  openContextPreview: (nodeId: string) => void;
  openSourceDecompositionFlow: () => void;
  setViewportRef: (element: HTMLDivElement) => void;
  setSvgRef: (element: SVGSVGElement) => void;
  viewportHandlers: ViewportPointerHandlers;
  sceneHandlers: SceneInteractionHandlers;
}
