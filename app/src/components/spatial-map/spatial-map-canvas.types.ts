import type { Accessor, JSX } from "solid-js";
import type {
  MapNode,
  PositionedMapNode,
  SpatialMapData,
} from "~/lib/spatial-map/types";

export type SpatialMapViewMode = "canvas" | "tree";
export type SpatialMapDepthLevel = number | "max";
export type SpatialMapNodeColorMode = "type" | "status";

export interface CameraState {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NodeVisualState {
  node: PositionedMapNode;
  isHovered: boolean;
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
  deleteNodeConfirmId: Accessor<string | null>;
  unsafeDeleteNodeRequest: Accessor<{ nodeId: string; requestId: number } | null>;
  edgeState: Accessor<EdgeVisualState[]>;
  isolatedNodeId: Accessor<string | null>;
  isolationLabel: Accessor<string | null>;
  isolationModeActive: Accessor<boolean>;
  inspectorOpen: Accessor<boolean>;
  isPanning: Accessor<boolean>;
  reparentingNodeId: Accessor<string | null>;
  orderedNodes: Accessor<NodeVisualState[]>;
  selectedNodeId: Accessor<string | null>;
  selectedNodeRelations: Accessor<{
    outgoing: { kind: string; nodeId: string }[];
    incoming: { kind: string; nodeId: string }[];
  }>;
  selectedNode: Accessor<MapNode | null>;
  showEdges: Accessor<boolean>;
  showLinkedInIsolation: Accessor<boolean>;
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
  clearDeleteNodeConfirm: () => void;
  clearUnsafeDeleteNodeRequest: () => void;
  clearChildNodeDraft: () => void;
  clearReparentingNode: () => void;
  isolateNode: (nodeId: string) => void;
  setInspectorOpen: (value: boolean | ((current: boolean) => boolean)) => void;
  setSelectedNodeId: (
    value: string | null | ((current: string | null) => string | null),
  ) => void;
  setShowEdges: (value: boolean | ((current: boolean) => boolean)) => void;
  setShowLinkedInIsolation: (
    value: boolean | ((current: boolean) => boolean),
  ) => void;
  setViewMode: (value: SpatialMapViewMode) => void;
  setVisibleDepthLevel: (value: SpatialMapDepthLevel) => void;
  toggleLinkedInIsolation: () => void;
  toggleEdges: () => void;
  reflowLayout: () => void;
  fitCameraToNodes: () => void;
  openChildNodeDraft: (parentNodeId?: string | null) => void;
  openAddNodesFlow: () => void;
  openContextNoteConversionFlow: () => void;
  openSourceDecompositionFlow: () => void;
  setViewportRef: (element: HTMLDivElement) => void;
  setSvgRef: (element: SVGSVGElement) => void;
  viewportHandlers: ViewportPointerHandlers;
  sceneHandlers: SceneInteractionHandlers;
}
