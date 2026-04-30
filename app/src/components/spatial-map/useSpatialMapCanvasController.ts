import {
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  untrack,
  type Accessor,
} from "solid-js";
import {
  buildAdjacencyMap,
  createInitialLayout,
  filterSpatialMapDataForIsolation,
  getRelatedSet,
  VIEWPORT_HEIGHT,
  VIEWPORT_WIDTH,
} from "~/lib/spatial-map/layout";
import { calculateNodeDepths } from "~/lib/spatial-map/depth";
import type { PositionedMapNode, SpatialMapData } from "~/lib/spatial-map/types";

import type {
  ChildNodeDraft,
  CameraState,
  SpatialMapCanvasController,
  SpatialMapDepthLevel,
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
import {
  createLayoutTransitionItems,
  easeInOutCubic,
  getLayoutTransitionAnchor,
  hasLayoutTransitionWork,
  interpolateCamera,
  interpolateNumber,
  interpolatePositionedNode,
  LAYOUT_TRANSITION_DURATION_MS,
} from "./spatial-map-layout-transition";

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
  const initialPositionedNodes = createInitialLayout(data());
  const fallbackCamera = createDefaultCamera();
  const initialCamera = getFitCamera(
    initialPositionedNodes,
    fallbackCamera.width / fallbackCamera.height,
  );
  const [positionedNodes, setPositionedNodes] = createSignal(initialPositionedNodes);
  const [transitionVisualState, setTransitionVisualState] = createSignal(
    new Map<string, { opacity: number; scale: number }>(),
  );
  const [selectedNodeId, setSelectedNodeId] = createSignal<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = createSignal<string | null>(null);
  const [isolatedNodeId, setIsolatedNodeId] = createSignal<string | null>(null);
  const [showLinkedInIsolation, setShowLinkedInIsolation] = createSignal(false);
  const [showEdges, setShowEdges] = createSignal(false);
  const [inspectorOpen, setInspectorOpen] = createSignal(true);
  const [addNodesOpen, setAddNodesOpen] = createSignal(false);
  const [contextNoteConversionOpen, setContextNoteConversionOpen] = createSignal(false);
  const [sourceDecompositionOpen, setSourceDecompositionOpen] = createSignal(false);
  const [deleteNodeConfirmId, setDeleteNodeConfirmId] = createSignal<string | null>(null);
  const [unsafeDeleteNodeRequest, setUnsafeDeleteNodeRequest] = createSignal<{
    nodeId: string;
    requestId: number;
  } | null>(null);
  const [childNodeDraft, setChildNodeDraft] = createSignal<ChildNodeDraft | null>(null);
  const [reparentingNodeId, setReparentingNodeId] = createSignal<string | null>(null);
  const [viewMode, setViewMode] = createSignal<SpatialMapViewMode>("canvas");
  const [visibleDepthSelection, writeVisibleDepthSelection] =
    createSignal<SpatialMapDepthLevel>("max");
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
    filterSpatialMapDataForIsolation(data(), isolatedNodeId(), {
      includeLinked: showLinkedInIsolation(),
    }),
  );
  const availableDepthLevels = createMemo(() =>
    Array.from({ length: getDepthLevelCount(isolatedData()) }, (_, index) => index + 1),
  );
  const visibleDepthLevel = createMemo(() =>
    resolveVisibleDepthLevel(visibleDepthSelection(), availableDepthLevels()),
  );
  const visibleData = createMemo(() =>
    filterSpatialMapDataByDepthLevel(isolatedData(), visibleDepthLevel()),
  );

  let viewportRef: HTMLDivElement | undefined;
  let svgRef: SVGSVGElement | undefined;
  let cameraSnapshot = initialCamera;
  let cameraFrame: number | undefined;
  let cameraTweenFrame: number | undefined;
  let layoutTransitionFrame: number | undefined;
  let layoutTransitionTarget: PositionedMapNode[] | undefined;
  let layoutTransitionInitialized = false;
  let pendingTransitionAnchorId: string | null = null;
  let resizeObserver: ResizeObserver | undefined;
  let panSession: PanSession | undefined;
  let suppressNodeClick = false;
  let viewportFitFrame: number | undefined;
  let viewportSizedFitApplied = false;
  let lastViewportClientPoint: { x: number; y: number } | undefined;
  const viewportSize: ViewportSize = {
    width: VIEWPORT_WIDTH,
    height: VIEWPORT_HEIGHT,
  };

  const activeNodeId = createMemo(() => selectedNodeId());
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
  const setVisibleDepthLevel = (value: SpatialMapDepthLevel) => {
    if (value === "max") {
      writeVisibleDepthSelection(value);
      return;
    }

    const maxLevel = availableDepthLevels().at(-1) ?? 1;
    writeVisibleDepthSelection(clampInteger(value, 1, maxLevel));
  };
  const zoomScale = createMemo(() => {
    const currentCamera = camera();
    const scaleX = VIEWPORT_WIDTH / currentCamera.width;
    const scaleY = VIEWPORT_HEIGHT / currentCamera.height;

    return Math.min(scaleX, scaleY);
  });
  const zoomPercent = createMemo(() => {
    return `${Math.round(zoomScale() * 100)}%`;
  });
  const viewportScale = createMemo(() => {
    return (viewportSize.height / VIEWPORT_HEIGHT) * zoomScale();
  });
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
      transitionVisualState: transitionVisualState(),
    }),
  );
  const edgeState = createMemo(() =>
    createEdgeState({
      activeNodeId: activeNodeId(),
      links: data().links,
      nodesById: nodesById(),
      relatedSet: relatedSet(),
      showEdges: showEdges(),
      transitionVisualState: transitionVisualState(),
    }),
  );

  createEffect(() => {
    const maxLevel = availableDepthLevels().at(-1) ?? 1;
    writeVisibleDepthSelection((current) =>
      current === "max" ? current : clampInteger(current, 1, maxLevel),
    );
  });

  createEffect(() => {
    const nextData = visibleData();
    const sourceData = data();
    const nextLayout = createInitialLayout(nextData);
    transitionToLayout(nextLayout, pendingTransitionAnchorId);
    pendingTransitionAnchorId = null;
    setHoveredNodeId(null);
    setIsolatedNodeId((current) =>
      current && sourceData.nodes.some((node) => node.id === current) ? current : null,
    );
    setSelectedNodeId((current) =>
      current && nextData.nodes.some((node) => node.id === current) ? current : null,
    );
    setReparentingNodeId((current) =>
      current && sourceData.nodes.some((node) => node.id === current) ? current : null,
    );
  });

  const updateViewportSize = () => {
    const viewportElement = svgRef?.isConnected ? svgRef : viewportRef;

    if (!viewportElement || !viewportElement.isConnected) {
      viewportSize.width = VIEWPORT_WIDTH;
      viewportSize.height = VIEWPORT_HEIGHT;
      return;
    }

    const rect = viewportElement.getBoundingClientRect();
    viewportSize.width = Math.max(rect.width, 1);
    viewportSize.height = Math.max(rect.height, 1);
  };

  const getViewportAspectRatio = () => {
    if (!viewportRef && !svgRef) {
      return fallbackCamera.width / fallbackCamera.height;
    }

    updateViewportSize();
    return viewportSize.width / viewportSize.height;
  };

  const cancelCameraTween = () => {
    if (cameraTweenFrame === undefined) {
      return;
    }

    if (typeof cancelAnimationFrame !== "undefined") {
      cancelAnimationFrame(cameraTweenFrame);
    }
    cameraTweenFrame = undefined;
  };

  const cancelLayoutTransition = () => {
    if (layoutTransitionFrame === undefined) {
      return;
    }

    if (typeof cancelAnimationFrame !== "undefined") {
      cancelAnimationFrame(layoutTransitionFrame);
    }
    layoutTransitionFrame = undefined;
    if (layoutTransitionTarget) {
      setPositionedNodes(layoutTransitionTarget);
      layoutTransitionTarget = undefined;
    }
    setTransitionVisualState(new Map());
  };

  const setCameraImmediate = (nextCamera: CameraState) => {
    cancelCameraTween();
    cameraSnapshot = nextCamera;
    if (cameraFrame !== undefined) {
      cancelAnimationFrame(cameraFrame);
      cameraFrame = undefined;
    }
    writeCamera(nextCamera);
  };

  const setCameraDeferred = (nextCamera: CameraState) => {
    cancelCameraTween();
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

  const animateCameraToLayout = (
    nodes: PositionedMapNode[],
    startedAt: number,
    durationMs: number,
  ) => {
    cancelCameraTween();

    const startCamera = cameraSnapshot;
    const targetCamera = getFitCamera(nodes, getViewportAspectRatio());

    const tick = (now: number) => {
      const progress = clampValue((now - startedAt) / durationMs, 0, 1);
      const easedProgress = easeInOutCubic(progress);
      const nextCamera = interpolateCamera(startCamera, targetCamera, easedProgress);

      cameraSnapshot = nextCamera;
      writeCamera(nextCamera);

      if (progress < 1) {
        cameraTweenFrame = requestAnimationFrame(tick);
        return;
      }

      cameraTweenFrame = undefined;
      cameraSnapshot = targetCamera;
      writeCamera(targetCamera);
    };

    cameraTweenFrame = requestAnimationFrame(tick);
  };

  const scheduleViewportFit = (
    nodes: PositionedMapNode[] = positionedNodes(),
    remainingFrames = 3,
  ) => {
    if (viewportFitFrame !== undefined) {
      cancelAnimationFrame(viewportFitFrame);
    }

    viewportFitFrame = requestAnimationFrame(() => {
      viewportFitFrame = undefined;
      if (
        remainingFrames > 0 &&
        (!viewportRef?.isConnected ||
          viewportRef.clientWidth === 0 ||
          viewportRef.clientHeight === 0)
      ) {
        scheduleViewportFit(nodes, remainingFrames - 1);
        return;
      }
      fitCameraToLayout(nodes);
    });
  };

  const transitionToLayout = (
    nextLayout: PositionedMapNode[],
    anchorNodeId: string | null,
  ) => {
    if (!layoutTransitionInitialized) {
      layoutTransitionInitialized = true;
      setPositionedNodes(nextLayout);
      setTransitionVisualState(new Map());
      queueMicrotask(() => fitCameraToLayout(nextLayout));
      return;
    }

    cancelLayoutTransition();

    const previousLayout = untrack(positionedNodes);
    if (!hasLayoutTransitionWork(previousLayout, nextLayout)) {
      setPositionedNodes(nextLayout);
      setTransitionVisualState(new Map());
      queueMicrotask(() => fitCameraToLayout(nextLayout));
      return;
    }

    const anchorPosition = getLayoutTransitionAnchor({
      anchorNodeId,
      previousLayout,
      nextLayout,
    });
    const animationItems = createLayoutTransitionItems(
      previousLayout,
      nextLayout,
      anchorPosition,
    );
    const startedAt = performance.now();
    layoutTransitionTarget = nextLayout;

    animateCameraToLayout(nextLayout, startedAt, LAYOUT_TRANSITION_DURATION_MS);

    const tick = (now: number) => {
      const progress = clampValue(
        (now - startedAt) / LAYOUT_TRANSITION_DURATION_MS,
        0,
        1,
      );
      const easedProgress = easeInOutCubic(progress);
      const nextNodes: PositionedMapNode[] = [];
      const nextTransitionState = new Map<string, { opacity: number; scale: number }>();

      for (const item of animationItems) {
        const opacity = interpolateNumber(item.startOpacity, item.endOpacity, easedProgress);

        if (progress >= 1 && item.endOpacity === 0) {
          continue;
        }

        nextNodes.push(interpolatePositionedNode(item.startNode, item.endNode, easedProgress));
        nextTransitionState.set(item.endNode.id, {
          opacity,
          scale: interpolateNumber(item.startScale, item.endScale, easedProgress),
        });
      }

      setPositionedNodes(nextNodes);
      setTransitionVisualState(nextTransitionState);

      if (progress < 1) {
        layoutTransitionFrame = requestAnimationFrame(tick);
        return;
      }

      layoutTransitionFrame = undefined;
      layoutTransitionTarget = undefined;
      setPositionedNodes(nextLayout);
      setTransitionVisualState(new Map());
    };

    layoutTransitionFrame = requestAnimationFrame(tick);
  };

  const getWorldPoint = (clientX: number, clientY: number) => {
    const viewportElement = svgRef?.isConnected ? svgRef : viewportRef;

    if (!viewportElement) {
      return { x: 0, y: 0 };
    }

    const rect = viewportElement.getBoundingClientRect();
    const currentCamera = cameraSnapshot;
    const xRatio = (clientX - rect.left) / Math.max(rect.width, 1);
    const yRatio = (clientY - rect.top) / Math.max(rect.height, 1);

    return {
      x: currentCamera.x + xRatio * currentCamera.width,
      y: currentCamera.y + yRatio * currentCamera.height,
    };
  };

  const getViewportCenterWorldPoint = () => {
    const currentCamera = cameraSnapshot;
    return {
      x: currentCamera.x + currentCamera.width / 2,
      y: currentCamera.y + currentCamera.height / 2,
    };
  };

  const rememberViewportPointer = (clientX: number, clientY: number) => {
    if (!viewportRef?.isConnected) {
      return;
    }

    const rect = viewportRef.getBoundingClientRect();
    if (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    ) {
      return;
    }

    lastViewportClientPoint = { x: clientX, y: clientY };
  };

  const getDraftWorldPoint = () =>
    lastViewportClientPoint
      ? getWorldPoint(lastViewportClientPoint.x, lastViewportClientPoint.y)
      : getViewportCenterWorldPoint();

  const openChildNodeDraft = (parentNodeId: string | null = selectedNodeId()) => {
    setChildNodeDraft({ parentNodeId, ...getDraftWorldPoint() });
  };

  const handleWindowKeyDown = (event: KeyboardEvent) => {
    if (isUnsafeDeleteNodeShortcut(event)) {
      const nodeId = selectedNodeId();
      if (nodeId && viewMode() === "canvas") {
        event.preventDefault();
        setUnsafeDeleteNodeRequest({
          nodeId,
          requestId: Date.now(),
        });
      }
      return;
    }

    if (isEditableTarget(event.target)) {
      return;
    }

    if (event.key.toLowerCase() === "c" && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const parentNodeId = selectedNodeId();
      if (viewMode() === "canvas") {
        event.preventDefault();
        openChildNodeDraft(parentNodeId);
      }
      return;
    }

    if (isDeleteNodeShortcut(event)) {
      const nodeId = selectedNodeId();
      if (nodeId && viewMode() === "canvas") {
        event.preventDefault();
        setDeleteNodeConfirmId(nodeId);
      }
      return;
    }

    if (event.key.toLowerCase() === "p" && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const nodeId = selectedNodeId();
      if (nodeId && viewMode() === "canvas") {
        event.preventDefault();
        setReparentingNodeId(nodeId);
      }
      return;
    }

    if (event.key === "Escape" && reparentingNodeId()) {
      event.preventDefault();
      setReparentingNodeId(null);
      return;
    }

    const depthShortcut = getDepthShortcutSelection(event, availableDepthLevels());
    if (depthShortcut !== null) {
      event.preventDefault();
      setVisibleDepthLevel(depthShortcut);
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
    if (!viewportSizedFitApplied) {
      viewportSizedFitApplied = true;
      fitCameraToNodes();
      return;
    }
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
    rememberViewportPointer(event.clientX, event.clientY);
    cancelLayoutTransition();
    cancelCameraTween();
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
    rememberViewportPointer(event.clientX, event.clientY);
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
    rememberViewportPointer(event.clientX, event.clientY);
    event.preventDefault();
    cancelLayoutTransition();
    cancelCameraTween();

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
    pendingTransitionAnchorId = nodeId ?? isolatedNodeId() ?? selectedNodeId();
    setHoveredNodeId(null);
    setShowLinkedInIsolation(false);
    if (nodeId) {
      writeVisibleDepthSelection("max");
    }
    setIsolatedNodeId(nodeId);
    if (nodeId) {
      setSelectedNodeId(nodeId);
    }
  };

  const toggleNodeIsolation = (nodeId: string) => {
    if (suppressNodeClick) {
      return;
    }

    applyIsolation(isolatedNodeId() === nodeId ? null : nodeId);
  };

  const toggleLinkedIsolation = () => {
    pendingTransitionAnchorId = isolatedNodeId() ?? selectedNodeId();
    setShowLinkedInIsolation((current) => !current);
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
    setReparentingNodeId(null);
  };

  const handleBackgroundDoubleClick: SpatialMapCanvasController["sceneHandlers"]["onBackgroundDoubleClick"] = (event) => {
    if (suppressNodeClick) {
      return;
    }

    const target = event.target;
    if (target instanceof Element && target.closest(".spatial-map-node")) {
      return;
    }

    applyIsolation(null);
  };

  onMount(() => {
    updateViewportSize();
    if (viewportRef && typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(viewportRef);
    }
    fitCameraToNodes();
    scheduleViewportFit();
    window.addEventListener("keydown", handleWindowKeyDown);
    window.addEventListener("resize", handleResize);

    onCleanup(() => {
      window.removeEventListener("keydown", handleWindowKeyDown);
      window.removeEventListener("resize", handleResize);
    });
  });

  onCleanup(() => {
    if (cameraFrame !== undefined) {
      if (typeof cancelAnimationFrame !== "undefined") {
        cancelAnimationFrame(cameraFrame);
      }
      cameraFrame = undefined;
    }
    cancelCameraTween();
    cancelLayoutTransition();
    if (viewportFitFrame !== undefined) {
      if (typeof cancelAnimationFrame !== "undefined") {
        cancelAnimationFrame(viewportFitFrame);
      }
      viewportFitFrame = undefined;
    }
    resizeObserver?.disconnect();
  });

  return {
    camera,
    sceneTransform,
    addNodesOpen,
    contextNoteConversionOpen,
    deleteNodeConfirmId,
    unsafeDeleteNodeRequest,
    sourceDecompositionOpen,
    childNodeDraft,
    edgeState,
    isolatedNodeId,
    isolationLabel,
    isolationModeActive,
    inspectorOpen,
    isPanning,
    reparentingNodeId,
    orderedNodes,
    selectedNodeId,
    selectedNodeRelations,
    selectedNode,
    showEdges,
    showLinkedInIsolation,
    sourceNodesById,
    availableDepthLevels,
    visibleData,
    visibleDepthSelection,
    visibleDepthLevel,
    viewMode,
    viewportScale,
    zoomPercent,
    zoomScale,
    closeAddNodesFlow: () => setAddNodesOpen(false),
    closeContextNoteConversionFlow: () => setContextNoteConversionOpen(false),
    closeSourceDecompositionFlow: () => setSourceDecompositionOpen(false),
    clearIsolation: () => applyIsolation(null),
    clearDeleteNodeConfirm: () => setDeleteNodeConfirmId(null),
    clearUnsafeDeleteNodeRequest: () => setUnsafeDeleteNodeRequest(null),
    clearChildNodeDraft: () => setChildNodeDraft(null),
    clearReparentingNode: () => setReparentingNodeId(null),
    openChildNodeDraft,
    openAddNodesFlow: () => {
      setContextNoteConversionOpen(false);
      setSourceDecompositionOpen(false);
      setAddNodesOpen(true);
    },
    openContextNoteConversionFlow: () => {
      setAddNodesOpen(false);
      setSourceDecompositionOpen(false);
      setContextNoteConversionOpen(true);
    },
    openSourceDecompositionFlow: () => {
      setAddNodesOpen(false);
      setContextNoteConversionOpen(false);
      setSourceDecompositionOpen(true);
    },
    isolateNode: (nodeId) => applyIsolation(nodeId),
    setInspectorOpen,
    setSelectedNodeId,
    setShowEdges,
    setShowLinkedInIsolation,
    setViewMode: (value) => {
      setViewMode(value);
      if (value === "canvas") {
        scheduleViewportFit();
      }
    },
    setVisibleDepthLevel,
    toggleLinkedInIsolation: toggleLinkedIsolation,
    toggleEdges: () => setShowEdges((current) => !current),
    reflowLayout: () => {
      const nextLayout = createInitialLayout(visibleData());
      transitionToLayout(nextLayout, selectedNodeId());
    },
    fitCameraToNodes,
    setViewportRef: setViewportElement,
    setSvgRef: (element) => {
      svgRef = element;
      updateViewportSize();
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
      onBackgroundDoubleClick: handleBackgroundDoubleClick,
      onNodeClick: handleNodeSelection,
      onNodeDoubleClick: toggleNodeIsolation,
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

  const depthsByNodeId = calculateNodeDepths(data);
  const depths = data.nodes.map((node) => depthsByNodeId.get(node.id) ?? 0);
  return Math.max(Math.max(...depths) - Math.min(...depths) + 1, 1);
}

function resolveVisibleDepthLevel(
  selection: SpatialMapDepthLevel,
  availableLevels: number[],
) {
  const maxLevel = availableLevels.at(-1) ?? 1;
  return selection === "max" ? maxLevel : clampInteger(selection, 1, maxLevel);
}

function getDepthShortcutSelection(
  event: KeyboardEvent,
  availableLevels: number[],
): SpatialMapDepthLevel | null {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
    return null;
  }

  const level = getKeyboardDigit(event);
  if (level === null) {
    return null;
  }

  const maxLevel = availableLevels.at(-1) ?? 1;
  if (level === 0 || level >= maxLevel) {
    return "max";
  }

  if (!availableLevels.includes(level)) {
    return null;
  }

  return level;
}

function isDeleteNodeShortcut(event: KeyboardEvent) {
  return (
    (event.key === "Delete" || event.key === "Backspace") &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.shiftKey
  );
}

function isUnsafeDeleteNodeShortcut(event: KeyboardEvent) {
  return (
    (event.key === "Delete" || event.key === "Backspace") &&
    event.metaKey &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.shiftKey
  );
}

function getKeyboardDigit(event: KeyboardEvent) {
  if (/^[0-9]$/.test(event.key)) {
    return Number(event.key);
  }

  const codeDigit = /^(?:Digit|Numpad)([0-9])$/.exec(event.code)?.[1];
  return codeDigit ? Number(codeDigit) : null;
}

function filterSpatialMapDataByDepthLevel(
  data: SpatialMapData,
  visibleDepthLevel: number,
): SpatialMapData {
  if (data.nodes.length === 0) {
    return data;
  }

  const depthsByNodeId = calculateNodeDepths(data);
  const depths = data.nodes.map((node) => depthsByNodeId.get(node.id) ?? 0);
  const minDepth = Math.min(...depths);
  const maxVisibleDepth = minDepth + Math.max(visibleDepthLevel, 1) - 1;
  const visibleNodeIds = new Set(
    data.nodes
      .filter((node) => (depthsByNodeId.get(node.id) ?? 0) <= maxVisibleDepth)
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
