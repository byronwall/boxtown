import {
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  type Accessor,
} from "solid-js";
import {
  buildAdjacencyMap,
  createInitialLayout,
  getRelatedSet,
  resetLayout,
  VIEWPORT_WIDTH,
} from "~/lib/spatial-map/layout";
import type { SpatialMapData } from "~/lib/spatial-map/types";

import type {
  CameraState,
  SpatialMapCanvasController,
} from "./spatial-map-canvas.types";
import {
  clampValue,
  createDefaultCamera,
  getFitCamera,
  preserveCameraCenter,
} from "./spatial-map-camera";
import {
  getHoveredSpatialMapNodeId,
  isEditableTarget,
} from "./spatial-map-dom";
import {
  createEdgeState,
  createOrderedNodeState,
  describeRelations,
} from "./spatial-map-relations";

interface PanSession {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startCamera: CameraState;
  didDrag: boolean;
}

export function useSpatialMapCanvasController(
  data: Accessor<SpatialMapData>,
): SpatialMapCanvasController {
  const [positionedNodes, setPositionedNodes] = createSignal(createInitialLayout(data()));
  const [selectedNodeId, setSelectedNodeId] = createSignal<string | null>(
    data().nodes[0]?.id ?? null,
  );
  const [hoveredNodeId, setHoveredNodeId] = createSignal<string | null>(null);
  const [showEdges, setShowEdges] = createSignal(false);
  const [inspectorOpen, setInspectorOpen] = createSignal(true);
  const [camera, setCamera] = createSignal(createDefaultCamera());
  const [isPanning, setIsPanning] = createSignal(false);
  const adjacency = createMemo(() => buildAdjacencyMap(data()));
  const nodesById = createMemo(
    () => new Map(positionedNodes().map((node) => [node.id, node])),
  );
  const sourceNodesById = createMemo(
    () => new Map(data().nodes.map((node) => [node.id, node])),
  );

  let viewportRef: HTMLDivElement | undefined;
  let svgRef: SVGSVGElement | undefined;
  let panSession: PanSession | undefined;
  let suppressNodeClick = false;
  const fallbackCamera = createDefaultCamera();

  const activeNodeId = createMemo(() => hoveredNodeId() ?? selectedNodeId());
  const relatedSet = createMemo(() => getRelatedSet(adjacency(), activeNodeId()));
  const selectedNode = createMemo(() =>
    selectedNodeId() ? sourceNodesById().get(selectedNodeId() ?? "") ?? null : null,
  );
  const selectedNodeRelations = createMemo(() =>
    describeRelations(data().links, sourceNodesById(), selectedNode()),
  );
  const zoomPercent = createMemo(() =>
    `${Math.round((VIEWPORT_WIDTH / camera().width) * 100)}%`,
  );
  const orderedNodes = createMemo(() =>
    createOrderedNodeState({
      activeNodeId: activeNodeId(),
      hoveredNodeId: hoveredNodeId(),
      positionedNodes: positionedNodes(),
      relatedSet: relatedSet(),
      selectedNodeId: selectedNodeId(),
    }),
  );
  const edgeState = createMemo(() =>
    createEdgeState({
      activeNodeId: activeNodeId(),
      links: data().links,
      nodesById: nodesById(),
      relatedSet: relatedSet(),
      showEdges: showEdges(),
    }),
  );

  createEffect(() => {
    const nextData = data();
    setPositionedNodes(createInitialLayout(nextData));
    setHoveredNodeId(null);
    setSelectedNodeId(nextData.nodes[0]?.id ?? null);
    queueMicrotask(() => fitCameraToNodes());
  });

  const getViewportAspectRatio = () => {
    if (!viewportRef) {
      return fallbackCamera.width / fallbackCamera.height;
    }

    return viewportRef.clientWidth / Math.max(viewportRef.clientHeight, 1);
  };

  const fitCameraToNodes = () => {
    setCamera(getFitCamera(positionedNodes(), getViewportAspectRatio()));
  };

  const getWorldPoint = (clientX: number, clientY: number) => {
    if (!svgRef) {
      return { x: 0, y: 0 };
    }

    const rect = svgRef.getBoundingClientRect();
    const currentCamera = camera();
    const xRatio = (clientX - rect.left) / Math.max(rect.width, 1);
    const yRatio = (clientY - rect.top) / Math.max(rect.height, 1);

    return {
      x: currentCamera.x + xRatio * currentCamera.width,
      y: currentCamera.y + yRatio * currentCamera.height,
    };
  };

  const handleWindowKeyDown = (event: KeyboardEvent) => {
    if (isEditableTarget(event.target)) {
      return;
    }

    if (event.key.toLowerCase() === "f") {
      event.preventDefault();
      fitCameraToNodes();
    }
  };

  const handleResize = () => {
    setCamera((current) => preserveCameraCenter(current, getViewportAspectRatio()));
  };

  const handleGlobalPointerMove = (event: PointerEvent) => {
    if (isPanning()) {
      return;
    }

    setHoveredNodeId(getHoveredSpatialMapNodeId(event.clientX, event.clientY));
  };

  const handleViewportPointerDown: SpatialMapCanvasController["viewportHandlers"]["onPointerDown"] = (event) => {
    panSession = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startCamera: camera(),
      didDrag: false,
    };
  };

  const handleViewportPointerMove: SpatialMapCanvasController["viewportHandlers"]["onPointerMove"] = (event) => {
    if (!panSession || panSession.pointerId !== event.pointerId || !svgRef) {
      return;
    }

    const deltaX = event.clientX - panSession.startClientX;
    const deltaY = event.clientY - panSession.startClientY;

    if (!panSession.didDrag && Math.hypot(deltaX, deltaY) > 4) {
      panSession.didDrag = true;
      suppressNodeClick = true;
      setIsPanning(true);
      setHoveredNodeId(null);
      viewportRef?.setPointerCapture(event.pointerId);
    }

    if (!panSession.didDrag) {
      return;
    }

    const rect = svgRef.getBoundingClientRect();
    const worldDeltaX = (deltaX / Math.max(rect.width, 1)) * panSession.startCamera.width;
    const worldDeltaY = (deltaY / Math.max(rect.height, 1)) * panSession.startCamera.height;

    setCamera({
      ...panSession.startCamera,
      x: panSession.startCamera.x - worldDeltaX,
      y: panSession.startCamera.y - worldDeltaY,
    });
  };

  const endPanSession = (event: PointerEvent) => {
    if (!panSession || panSession.pointerId !== event.pointerId) {
      return;
    }

    setIsPanning(false);
    const dragged = panSession.didDrag;
    if (dragged && viewportRef?.hasPointerCapture(event.pointerId)) {
      viewportRef.releasePointerCapture(event.pointerId);
    }
    panSession = undefined;

    if (dragged) {
      window.setTimeout(() => {
        suppressNodeClick = false;
      }, 0);
    }
  };

  const handleWheel: SpatialMapCanvasController["viewportHandlers"]["onWheel"] = (event) => {
    event.preventDefault();

    const aspectRatio = getViewportAspectRatio();
    const anchor = getWorldPoint(event.clientX, event.clientY);
    const currentCamera = camera();
    const zoomFactor = Math.exp(event.deltaY * 0.0012);
    const nextWidth = clampValue(currentCamera.width * zoomFactor, 220, VIEWPORT_WIDTH * 8);
    const nextHeight = nextWidth / aspectRatio;
    const anchorRatioX = (anchor.x - currentCamera.x) / currentCamera.width;
    const anchorRatioY = (anchor.y - currentCamera.y) / currentCamera.height;

    setCamera({
      x: anchor.x - anchorRatioX * nextWidth,
      y: anchor.y - anchorRatioY * nextHeight,
      width: nextWidth,
      height: nextHeight,
    });
  };

  const handleNodeSelection = (nodeId: string) => {
    if (!suppressNodeClick) {
      setSelectedNodeId(nodeId);
    }
  };

  const handleBackgroundClick: SpatialMapCanvasController["sceneHandlers"]["onBackgroundClick"] = (event) => {
    if (suppressNodeClick) {
      return;
    }

    const target = event.target;
    if (target instanceof Element && target.closest(".spatial-map-node")) {
      return;
    }

    setHoveredNodeId(null);
    setSelectedNodeId(null);
  };

  onMount(() => {
    fitCameraToNodes();
    window.addEventListener("keydown", handleWindowKeyDown);
    window.addEventListener("resize", handleResize);
    window.addEventListener("pointermove", handleGlobalPointerMove);
  });

  onCleanup(() => {
    window.removeEventListener("keydown", handleWindowKeyDown);
    window.removeEventListener("resize", handleResize);
    window.removeEventListener("pointermove", handleGlobalPointerMove);
  });

  return {
    camera,
    edgeState,
    inspectorOpen,
    isPanning,
    orderedNodes,
    selectedNodeId,
    selectedNodeRelations,
    selectedNode,
    showEdges,
    sourceNodesById,
    zoomPercent,
    setInspectorOpen,
    setSelectedNodeId,
    toggleEdges: () => setShowEdges((current) => !current),
    reflowLayout: () => setPositionedNodes((current) => resetLayout(current, adjacency())),
    fitCameraToNodes,
    setViewportRef: (element) => {
      viewportRef = element;
    },
    setSvgRef: (element) => {
      svgRef = element;
    },
    viewportHandlers: {
      onPointerDown: handleViewportPointerDown,
      onPointerMove: handleViewportPointerMove,
      onPointerUp: endPanSession,
      onPointerLeave: () => setHoveredNodeId(null),
      onPointerCancel: endPanSession,
      onWheel: handleWheel,
    },
    sceneHandlers: {
      onBackgroundClick: handleBackgroundClick,
      onNodeClick: handleNodeSelection,
      onNodePointerDown: handleNodeSelection,
      onNodePointerEnter: setHoveredNodeId,
      onNodePointerLeave: (nodeId) =>
        setHoveredNodeId((current) => (current === nodeId ? null : current)),
    },
  };
}
