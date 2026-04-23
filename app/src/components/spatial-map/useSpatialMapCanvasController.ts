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
  filterSpatialMapDataByRelatedNodes,
  getRelatedSet,
  VIEWPORT_HEIGHT,
  VIEWPORT_WIDTH,
} from "~/lib/spatial-map/layout";
import type { PositionedMapNode, SpatialMapData } from "~/lib/spatial-map/types";

import type {
  CameraState,
  SpatialMapCanvasController,
  SpatialMapViewMode,
} from "./spatial-map-canvas.types";
import {
  clampValue,
  createDefaultCamera,
  getFitCamera,
  preserveCameraCenter,
} from "./spatial-map-camera";
import {
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

interface ViewportSize {
  width: number;
  height: number;
}

export function useSpatialMapCanvasController(
  data: Accessor<SpatialMapData>,
): SpatialMapCanvasController {
  const [positionedNodes, setPositionedNodes] = createSignal(createInitialLayout(data()));
  const [selectedNodeId, setSelectedNodeId] = createSignal<string | null>(
    data().nodes[0]?.id ?? null,
  );
  const [hoveredNodeId, setHoveredNodeId] = createSignal<string | null>(null);
  const [isolatedNodeId, setIsolatedNodeId] = createSignal<string | null>(null);
  const [showEdges, setShowEdges] = createSignal(false);
  const [inspectorOpen, setInspectorOpen] = createSignal(true);
  const [addNodesOpen, setAddNodesOpen] = createSignal(false);
  const [contextNoteConversionOpen, setContextNoteConversionOpen] = createSignal(false);
  const [viewMode, setViewMode] = createSignal<SpatialMapViewMode>("canvas");
  const [visibleDepthLevel, writeVisibleDepthLevel] = createSignal(
    getDepthLevelCount(data()),
  );
  const initialCamera = createDefaultCamera();
  const [camera, writeCamera] = createSignal(initialCamera);
  const [isPanning, setIsPanning] = createSignal(false);
  const adjacency = createMemo(() => buildAdjacencyMap(data()));
  const nodesById = createMemo(
    () => new Map(positionedNodes().map((node) => [node.id, node])),
  );
  const sourceNodesById = createMemo(
    () => new Map(data().nodes.map((node) => [node.id, node])),
  );
  const isolationModeActive = createMemo(() => Boolean(isolatedNodeId()));
  const isolatedData = createMemo(() =>
    filterSpatialMapDataByRelatedNodes(data(), isolatedNodeId()),
  );
  const availableDepthLevels = createMemo(() =>
    Array.from({ length: getDepthLevelCount(isolatedData()) }, (_, index) => index + 1),
  );
  const visibleData = createMemo(() =>
    filterSpatialMapDataByDepthLevel(isolatedData(), visibleDepthLevel()),
  );

  let viewportRef: HTMLDivElement | undefined;
  let cameraSnapshot = initialCamera;
  let cameraFrame: number | undefined;
  let resizeObserver: ResizeObserver | undefined;
  let panSession: PanSession | undefined;
  let suppressNodeClick = false;
  let viewportFitFrame: number | undefined;
  const fallbackCamera = createDefaultCamera();
  const viewportSize: ViewportSize = {
    width: VIEWPORT_WIDTH,
    height: VIEWPORT_HEIGHT,
  };

  const activeNodeId = createMemo(() => hoveredNodeId() ?? selectedNodeId());
  const relatedSet = createMemo(() => getRelatedSet(adjacency(), activeNodeId()));
  const selectedNode = createMemo(() =>
    selectedNodeId() ? sourceNodesById().get(selectedNodeId() ?? "") ?? null : null,
  );
  const isolationLabel = createMemo(() =>
    isolatedNodeId() ? sourceNodesById().get(isolatedNodeId() ?? "")?.label ?? null : null,
  );
  const selectedNodeRelations = createMemo(() =>
    describeRelations(data().links, sourceNodesById(), selectedNode()),
  );
  const zoomPercent = createMemo(() =>
    `${Math.round((VIEWPORT_WIDTH / camera().width) * 100)}%`,
  );
  const sceneTransform = createMemo(() => {
    const currentCamera = camera();
    const scaleX = VIEWPORT_WIDTH / currentCamera.width;
    const scaleY = VIEWPORT_HEIGHT / currentCamera.height;

    return `matrix(${scaleX} 0 0 ${scaleY} ${-currentCamera.x * scaleX} ${-currentCamera.y * scaleY})`;
  });
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
    const maxLevel = availableDepthLevels().at(-1) ?? 1;
    writeVisibleDepthLevel((current) => clampInteger(current, 1, maxLevel));
  });

  createEffect(() => {
    const nextData = visibleData();
    const sourceData = data();
    const nextLayout = createInitialLayout(nextData);
    setPositionedNodes(nextLayout);
    setHoveredNodeId(null);
    setIsolatedNodeId((current) =>
      current && sourceData.nodes.some((node) => node.id === current) ? current : null,
    );
    setSelectedNodeId((current) =>
      current && nextData.nodes.some((node) => node.id === current)
        ? current
        : nextData.nodes[0]?.id ?? null,
    );
    queueMicrotask(() => fitCameraToLayout(nextLayout));
  });

  const updateViewportSize = () => {
    if (!viewportRef || !viewportRef.isConnected) {
      viewportSize.width = VIEWPORT_WIDTH;
      viewportSize.height = VIEWPORT_HEIGHT;
      return;
    }

    viewportSize.width = Math.max(viewportRef.clientWidth, 1);
    viewportSize.height = Math.max(viewportRef.clientHeight, 1);
  };

  const getViewportAspectRatio = () => {
    if (!viewportRef) {
      return fallbackCamera.width / fallbackCamera.height;
    }

    updateViewportSize();
    return viewportSize.width / viewportSize.height;
  };

  const setCameraImmediate = (nextCamera: CameraState) => {
    cameraSnapshot = nextCamera;
    if (cameraFrame !== undefined) {
      cancelAnimationFrame(cameraFrame);
      cameraFrame = undefined;
    }
    writeCamera(nextCamera);
  };

  const setCameraDeferred = (nextCamera: CameraState) => {
    cameraSnapshot = nextCamera;
    if (cameraFrame !== undefined) {
      return;
    }

    cameraFrame = requestAnimationFrame(() => {
      cameraFrame = undefined;
      writeCamera(cameraSnapshot);
    });
  };

  const fitCameraToNodes = () => {
    setCameraImmediate(getFitCamera(positionedNodes(), getViewportAspectRatio()));
  };

  const fitCameraToLayout = (nodes: PositionedMapNode[]) => {
    setCameraImmediate(getFitCamera(nodes, getViewportAspectRatio()));
  };

  const scheduleViewportFit = (nodes: PositionedMapNode[] = positionedNodes()) => {
    if (viewportFitFrame !== undefined) {
      cancelAnimationFrame(viewportFitFrame);
    }

    viewportFitFrame = requestAnimationFrame(() => {
      viewportFitFrame = undefined;
      fitCameraToLayout(nodes);
    });
  };

  const getWorldPoint = (clientX: number, clientY: number) => {
    if (!viewportRef) {
      return { x: 0, y: 0 };
    }

    const rect = viewportRef.getBoundingClientRect();
    const currentCamera = cameraSnapshot;
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
    if (
      !viewportRef?.isConnected ||
      viewportRef.clientWidth === 0 ||
      viewportRef.clientHeight === 0
    ) {
      return;
    }

    updateViewportSize();
    setCameraImmediate(preserveCameraCenter(cameraSnapshot, getViewportAspectRatio()));
  };

  const setViewportElement = (element: HTMLDivElement) => {
    if (viewportRef === element) {
      return;
    }

    if (viewportRef) {
      resizeObserver?.unobserve(viewportRef);
    }

    viewportRef = element;
    updateViewportSize();
    resizeObserver?.observe(element);
    fitCameraToNodes();
    scheduleViewportFit();
  };

  const handleViewportPointerDown: SpatialMapCanvasController["viewportHandlers"]["onPointerDown"] = (event) => {
    updateViewportSize();
    panSession = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startCamera: cameraSnapshot,
      didDrag: false,
    };
  };

  const handleViewportPointerMove: SpatialMapCanvasController["viewportHandlers"]["onPointerMove"] = (event) => {
    if (!panSession || panSession.pointerId !== event.pointerId) {
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

    const worldDeltaX = (deltaX / viewportSize.width) * panSession.startCamera.width;
    const worldDeltaY = (deltaY / viewportSize.height) * panSession.startCamera.height;

    setCameraDeferred({
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
    const currentCamera = cameraSnapshot;
    const zoomFactor = Math.exp(event.deltaY * 0.0012);
    const nextWidth = clampValue(currentCamera.width * zoomFactor, 220, VIEWPORT_WIDTH * 8);
    const nextHeight = nextWidth / aspectRatio;
    const anchorRatioX = (anchor.x - currentCamera.x) / currentCamera.width;
    const anchorRatioY = (anchor.y - currentCamera.y) / currentCamera.height;

    setCameraDeferred({
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

  const applyIsolation = (nodeId: string | null) => {
    setHoveredNodeId(null);
    setIsolatedNodeId(nodeId);
    if (nodeId) {
      setSelectedNodeId(nodeId);
    }

    const nextData = filterSpatialMapDataByRelatedNodes(data(), nodeId);
    const nextLayout = createInitialLayout(nextData);
    setPositionedNodes(nextLayout);
    queueMicrotask(() => fitCameraToLayout(nextLayout));
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
    updateViewportSize();
    if (viewportRef && typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(viewportRef);
    }
    fitCameraToNodes();
    window.addEventListener("keydown", handleWindowKeyDown);
    window.addEventListener("resize", handleResize);
  });

  onCleanup(() => {
    if (cameraFrame !== undefined) {
      cancelAnimationFrame(cameraFrame);
    }
    if (viewportFitFrame !== undefined) {
      cancelAnimationFrame(viewportFitFrame);
    }
    resizeObserver?.disconnect();
    window.removeEventListener("keydown", handleWindowKeyDown);
    window.removeEventListener("resize", handleResize);
  });

  return {
    camera,
    sceneTransform,
    addNodesOpen,
    contextNoteConversionOpen,
    edgeState,
    isolatedNodeId,
    isolationLabel,
    isolationModeActive,
    inspectorOpen,
    isPanning,
    orderedNodes,
    selectedNodeId,
    selectedNodeRelations,
    selectedNode,
    showEdges,
    sourceNodesById,
    availableDepthLevels,
    visibleData,
    visibleDepthLevel,
    viewMode,
    zoomPercent,
    closeAddNodesFlow: () => setAddNodesOpen(false),
    closeContextNoteConversionFlow: () => setContextNoteConversionOpen(false),
    clearIsolation: () => applyIsolation(null),
    openAddNodesFlow: () => {
      setContextNoteConversionOpen(false);
      setAddNodesOpen(true);
    },
    openContextNoteConversionFlow: () => {
      setAddNodesOpen(false);
      setContextNoteConversionOpen(true);
    },
    isolateNode: (nodeId) => applyIsolation(nodeId),
    setInspectorOpen,
    setSelectedNodeId,
    setViewMode: (value) => {
      setViewMode(value);
      if (value === "canvas") {
        scheduleViewportFit();
      }
    },
    setVisibleDepthLevel: (value) => {
      const maxLevel = availableDepthLevels().at(-1) ?? 1;
      writeVisibleDepthLevel(clampInteger(value, 1, maxLevel));
    },
    toggleEdges: () => setShowEdges((current) => !current),
    reflowLayout: () => {
      const nextLayout = createInitialLayout(visibleData());
      setPositionedNodes(nextLayout);
      queueMicrotask(() => fitCameraToLayout(nextLayout));
    },
    fitCameraToNodes,
    setViewportRef: setViewportElement,
    setSvgRef: (element) => {
      void element;
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
      onNodeIsolateClick: (nodeId) => applyIsolation(nodeId),
      onNodePointerDown: handleNodeSelection,
      onNodePointerEnter: setHoveredNodeId,
      onNodePointerLeave: (nodeId) =>
        setHoveredNodeId((current) => (current === nodeId ? null : current)),
    },
  };
}

function getDepthLevelCount(data: SpatialMapData) {
  if (data.nodes.length === 0) {
    return 1;
  }

  const depths = data.nodes.map((node) => node.depth);
  return Math.max(Math.max(...depths) - Math.min(...depths) + 1, 1);
}

function filterSpatialMapDataByDepthLevel(
  data: SpatialMapData,
  visibleDepthLevel: number,
): SpatialMapData {
  if (data.nodes.length === 0) {
    return data;
  }

  const minDepth = Math.min(...data.nodes.map((node) => node.depth));
  const maxVisibleDepth = minDepth + Math.max(visibleDepthLevel, 1) - 1;
  const visibleNodeIds = new Set(
    data.nodes
      .filter((node) => node.depth <= maxVisibleDepth)
      .map((node) => node.id),
  );

  return {
    nodes: data.nodes.filter((node) => visibleNodeIds.has(node.id)),
    links: data.links.filter(
      (link) => visibleNodeIds.has(link.source) && visibleNodeIds.has(link.target),
    ),
  };
}

function clampInteger(value: number, min: number, max: number) {
  return Math.min(Math.max(Math.trunc(value), min), max);
}
