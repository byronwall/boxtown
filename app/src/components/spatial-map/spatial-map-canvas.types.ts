import type { Accessor, JSX } from "solid-js";
import type { MapNode, PositionedMapNode } from "~/lib/spatial-map/types";

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
  filter: string;
}

export interface EdgeVisualState {
  linkId: string;
  path: string;
  opacity: number;
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
  onNodeClick: (nodeId: string) => void;
  onNodeIsolateClick: (nodeId: string) => void;
  onNodePointerDown: (nodeId: string) => void;
  onNodePointerEnter: (nodeId: string) => void;
  onNodePointerLeave: (nodeId: string) => void;
}

export interface SpatialMapCanvasController {
  addNodesOpen: Accessor<boolean>;
  camera: Accessor<CameraState>;
  contextNoteConversionOpen: Accessor<boolean>;
  edgeState: Accessor<EdgeVisualState[]>;
  isolatedNodeId: Accessor<string | null>;
  isolationLabel: Accessor<string | null>;
  isolationModeActive: Accessor<boolean>;
  inspectorOpen: Accessor<boolean>;
  isPanning: Accessor<boolean>;
  orderedNodes: Accessor<NodeVisualState[]>;
  selectedNodeId: Accessor<string | null>;
  selectedNodeRelations: Accessor<{
    outgoing: { kind: string; nodeId: string }[];
    incoming: { kind: string; nodeId: string }[];
  }>;
  selectedNode: Accessor<MapNode | null>;
  showEdges: Accessor<boolean>;
  sourceNodesById: Accessor<Map<string, MapNode>>;
  zoomPercent: Accessor<string>;
  closeAddNodesFlow: () => void;
  closeContextNoteConversionFlow: () => void;
  clearIsolation: () => void;
  isolateNode: (nodeId: string) => void;
  setInspectorOpen: (value: boolean | ((current: boolean) => boolean)) => void;
  setSelectedNodeId: (value: string | null | ((current: string | null) => string | null)) => void;
  toggleEdges: () => void;
  reflowLayout: () => void;
  fitCameraToNodes: () => void;
  openAddNodesFlow: () => void;
  openContextNoteConversionFlow: () => void;
  setViewportRef: (element: HTMLDivElement) => void;
  setSvgRef: (element: SVGSVGElement) => void;
  viewportHandlers: ViewportPointerHandlers;
  sceneHandlers: SceneInteractionHandlers;
}
