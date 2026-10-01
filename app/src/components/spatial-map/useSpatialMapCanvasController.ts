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
import { hideArchivedNodes } from "~/lib/spatial-map/archive";
import type { MapNodeStatus, PositionedMapNode, SpatialMapData } from "~/lib/spatial-map/types";

import type {
  ChildNodeDraft,
  CameraState,
  SpatialMapCanvasController,
  SpatialMapDepthLevel,
  SpatialMapGlobalFilterState,
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

const CHILD_NODE_PLACEHOLDER_WIDTH = 300;
const CHILD_NODE_PLACEHOLDER_HEIGHT = 430;
const CHILD_NODE_PLACEHOLDER_EDGE_GAP = 12;
const DEFAULT_GLOBAL_FILTER: SpatialMapGlobalFilterState = {
  enabled: false,
  includeParents: true,
  includeChildren: false,
  selectedTypes: [],
  selectedStatuses: [],
  selectedPriorities: [],
};

export function useSpatialMapCanvasController(
  projectData: Accessor<SpatialMapData>,
): SpatialMapCanvasController {
  // Archived subtrees are removed before anything else so every view (canvas,
  // tree, grid, command menu) treats them as absent unless explicitly shown.
  const [showArchived, setShowArchived] = createSignal(false);
  const data = createMemo(() =>
    showArchived() ? projectData() : hideArchivedNodes(projectData()),
  );
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
  const [stashedNodeIds, setStashedNodeIds] = createSignal<string[]>([]);
  const [hoveredNodeId, setHoveredNodeId] = createSignal<string | null>(null);
  const [isolatedNodeId, setIsolatedNodeId] = createSignal<string | null>(null);
  const [manuallyExpandedNodeIds, setManuallyExpandedNodeIds] = createSignal<Set<string>>(
    new Set(),
  );
  const [showLinkedInIsolation, setShowLinkedInIsolation] = createSignal(false);
  const [globalFilter, setGlobalFilter] = createSignal<SpatialMapGlobalFilterState>({
    ...DEFAULT_GLOBAL_FILTER,
  });
  const [showEdges, setShowEdges] = createSignal(false);
  const [inspectorOpen, setInspectorOpen] = createSignal(true);
  const [contextPreviewRequest, setContextPreviewRequest] = createSignal<{
    nodeId: string;
    requestId: number;
  } | null>(null);
  const [deleteSubtreeConfirmId, setDeleteSubtreeConfirmId] = createSignal<string | null>(null);
  const [deleteNodeRequest, setDeleteNodeRequest] = createSignal<{
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
  const globalFilteredData = createMemo(() =>
    filterSpatialMapDataByGlobalFilter(isolatedData(), globalFilter()),
  );
  const globalFilterActive = createMemo(() => isGlobalFilterActive(globalFilter()));
  const globalFilterMatchedCount = createMemo(() => globalFilteredData().nodes.length);
  const availableNodeTypes = createMemo(() =>
    Array.from(new Set(data().nodes.map((node) => node.type).filter(Boolean))).sort(),
  );
  const availableNodeStatuses = createMemo(() =>
    Array.from(new Set(data().nodes.map((node) => node.status))).sort(),
  );
  const availableDepthLevels = createMemo(() =>
    Array.from({ length: getDepthLevelCount(globalFilteredData()) }, (_, index) => index + 1),
  );
  const visibleDepthLevel = createMemo(() =>
    resolveVisibleDepthLevel(visibleDepthSelection(), availableDepthLevels()),
  );
  const expandableNodeIds = createMemo(() => getExpandableNodeIds(globalFilteredData()));
  const visibleData = createMemo(() => {
    if (isolationModeActive()) {
      return globalFilteredData();
    }

    return filterSpatialMapDataByDepthLevel(
      globalFilteredData(),
      visibleDepthLevel(),
      manuallyExpandedNodeIds(),
    );
  });

  let viewportRef: HTMLDivElement | undefined;
  let svgRef: SVGSVGElement | undefined;
  let cameraSnapshot = initialCamera;
  let cameraFrame: number | undefined;
  let cameraTweenFrame: number | undefined;
  let layoutTransitionFrame: number | undefined;
  let layoutTransitionTarget: PositionedMapNode[] | undefined;
  let layoutTransitionInitialized = false;
  let pendingTransitionAnchorId: string | null = null;
  let pendingCameraFocusNodeIds: Set<string> | null = null;
  let manualCameraFocusNodeIds: Set<string> | null = null;
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
  const stashedNodes = createMemo(() => {
    const nodeById = sourceNodesById();
    return stashedNodeIds()
      .map((nodeId) => nodeById.get(nodeId) ?? null)
      .filter((node): node is NonNullable<typeof node> => Boolean(node));
  });
  const isolationLabel = createMemo(() =>
    isolatedNodeId() ? sourceNodesById().get(isolatedNodeId() ?? "")?.label ?? null : null,
  );
  const selectedNodeRelations = createMemo(() =>
    describeRelations(data().links, sourceNodesById(), selectedNode()),
  );
  const setVisibleDepthLevel = (value: SpatialMapDepthLevel) => {
    pendingCameraFocusNodeIds = null;
    manualCameraFocusNodeIds = null;
    setManuallyExpandedNodeIds(new Set<string>());
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
      expandableNodeIds: isolationModeActive() ? new Set() : expandableNodeIds(),
      hoveredNodeId: hoveredNodeId(),
      manuallyExpandedNodeIds: manuallyExpandedNodeIds(),
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
    const previousLayout = untrack(positionedNodes);
    const anchorNodeId =
      pendingTransitionAnchorId ??
      inferNewNodeTransitionAnchorId(previousLayout, nextData);
    const cameraFocusNodeIds = pendingCameraFocusNodeIds ?? manualCameraFocusNodeIds;
    const focusLayout = cameraFocusNodeIds
      ? nextLayout.filter((node) => cameraFocusNodeIds.has(node.id))
      : nextLayout;
    transitionToLayout(
      nextLayout,
      anchorNodeId,
      focusLayout.length > 0 ? focusLayout : nextLayout,
    );
    pendingTransitionAnchorId = null;
    pendingCameraFocusNodeIds = null;
    setHoveredNodeId(null);
    setIsolatedNodeId((current) =>
      current && sourceData.nodes.some((node) => node.id === current) ? current : null,
    );
    setSelectedNodeId((current) =>
      current && nextData.nodes.some((node) => node.id === current) ? current : null,
    );
    setStashedNodeIds((current) =>
      current.filter((nodeId) => sourceData.nodes.some((node) => node.id === nodeId)),
    );
    setManuallyExpandedNodeIds((current) => pruneManualExpansionSet(current, sourceData));
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

  const getGentleNodeCamera = (node: PositionedMapNode) => {
    const aspectRatio = getViewportAspectRatio();
    const fittedCamera = getFitCamera([node], aspectRatio);
    const gentleWidth = Math.max(fittedCamera.width, 920);
    const gentleHeight = gentleWidth / aspectRatio;
    const centerX = fittedCamera.x + fittedCamera.width / 2;
    const centerY = fittedCamera.y + fittedCamera.height / 2;

    return {
      x: centerX - gentleWidth / 2,
      y: centerY - gentleHeight / 2,
      width: gentleWidth,
      height: gentleHeight,
    };
  };

  const focusNode = (nodeId: string) => {
    const node = nodesById().get(nodeId);
    if (!node) {
      return;
    }

    setViewMode("canvas");
    setSelectedNodeId(nodeId);
    setInspectorOpen(true);
    setCameraImmediate(getGentleNodeCamera(node));
  };

  const focusStashedNode = (nodeId: string) => {
    if (nodesById().has(nodeId)) {
      focusNode(nodeId);
      return;
    }

    if (!sourceNodesById().has(nodeId)) {
      return;
    }

    setViewMode("canvas");
    setSelectedNodeId(nodeId);
    setInspectorOpen(true);
    setHoveredNodeId(null);
    setShowLinkedInIsolation(false);
    setIsolatedNodeId(null);
    setVisibleDepthLevel("max");
    pendingTransitionAnchorId = nodeId;
    pendingCameraFocusNodeIds = new Set([nodeId]);
    manualCameraFocusNodeIds = null;
  };

  const stashNode = (nodeId: string) => {
    if (!sourceNodesById().has(nodeId)) {
      return;
    }

    setStashedNodeIds((current) =>
      current.includes(nodeId) ? current : [nodeId, ...current],
    );
    setSelectedNodeId(nodeId);
  };

  const unstashNode = (nodeId: string) => {
    setStashedNodeIds((current) => current.filter((item) => item !== nodeId));
  };

  const toggleNodeStash = (nodeId: string) => {
    if (stashedNodeIds().includes(nodeId)) {
      unstashNode(nodeId);
      return;
    }

    stashNode(nodeId);
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
    cameraFitNodes: PositionedMapNode[] = nextLayout,
  ) => {
    if (!layoutTransitionInitialized) {
      layoutTransitionInitialized = true;
      setPositionedNodes(nextLayout);
      setTransitionVisualState(new Map());
      queueMicrotask(() => fitCameraToLayout(cameraFitNodes));
      return;
    }

    const previousLayout = untrack(positionedNodes);
    if (
      layoutTransitionTarget &&
      !hasLayoutTransitionWork(layoutTransitionTarget, nextLayout)
    ) {
      layoutTransitionTarget = nextLayout;
      return;
    }

    if (!hasLayoutTransitionWork(previousLayout, nextLayout)) {
      setPositionedNodes(nextLayout);
      setTransitionVisualState(new Map());
      queueMicrotask(() => fitCameraToLayout(cameraFitNodes));
      return;
    }

    cancelLayoutTransition();

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

    animateCameraToLayout(cameraFitNodes, startedAt, LAYOUT_TRANSITION_DURATION_MS);

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

  const clampChildNodeDraftPoint = (point: { x: number; y: number }) => {
    const currentCamera = cameraSnapshot;
    const horizontalMargin =
      ((CHILD_NODE_PLACEHOLDER_WIDTH / 2 + CHILD_NODE_PLACEHOLDER_EDGE_GAP) /
        Math.max(viewportSize.width, 1)) *
      currentCamera.width;
    const verticalMargin =
      ((CHILD_NODE_PLACEHOLDER_HEIGHT / 2 + CHILD_NODE_PLACEHOLDER_EDGE_GAP) /
        Math.max(viewportSize.height, 1)) *
      currentCamera.height;
    const halfWidth = Math.min(horizontalMargin, currentCamera.width / 2);
    const halfHeight = Math.min(verticalMargin, currentCamera.height / 2);

    return {
      x: clampValue(
        point.x,
        currentCamera.x + halfWidth,
        currentCamera.x + currentCamera.width - halfWidth,
      ),
      y: clampValue(
        point.y,
        currentCamera.y + halfHeight,
        currentCamera.y + currentCamera.height - halfHeight,
      ),
    };
  };

  const openChildNodeDraft = (
    parentNodeId: string | null = selectedNodeId() ?? isolatedNodeId(),
    options: { anchorToParent?: boolean } = {},
  ) => {
    // Buttons outside the canvas have no meaningful pointer position, so they
    // place the draft beside the parent node instead of at the last pointer.
    const parent = options.anchorToParent && parentNodeId ? nodesById().get(parentNodeId) : undefined;
    const point = parent
      ? { x: parent.x + parent.width, y: parent.y }
      : getDraftWorldPoint();
    setChildNodeDraft({ parentNodeId, ...clampChildNodeDraftPoint(point) });
  };

  const handleWindowKeyDown = (event: KeyboardEvent) => {
    if (isEditableTarget(event.target)) {
      return;
    }

    if (isDeleteSubtreeShortcut(event)) {
      const nodeId = selectedNodeId();
      if (nodeId && viewMode() === "canvas") {
        event.preventDefault();
        setDeleteSubtreeConfirmId(nodeId);
      }
      return;
    }

    if (event.key.toLowerCase() === "c" && !event.metaKey && !event.ctrlKey && !event.altKey) {
      if (viewMode() === "canvas") {
        event.preventDefault();
        openChildNodeDraft();
      }
      return;
    }

    if (isDeleteNodeShortcut(event)) {
      const nodeId = selectedNodeId();
      if (nodeId && viewMode() === "canvas") {
        event.preventDefault();
        setDeleteNodeRequest({
          nodeId,
          requestId: Date.now(),
        });
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

    if (event.key.toLowerCase() === "s" && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const nodeId = selectedNodeId();
      if (nodeId && viewMode() === "canvas") {
        event.preventDefault();
        toggleNodeStash(nodeId);
      }
      return;
    }

    if (isIsolateNodeShortcut(event)) {
      event.preventDefault();
      const nodeId = selectedNodeId();
      applyIsolation(nodeId && isolatedNodeId() !== nodeId ? nodeId : null);
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

    if (event.key === " " && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey) {
      const nodeId = selectedNodeId();
      if (viewMode() === "canvas" && !isolationModeActive()) {
        event.preventDefault();
        if (nodeId) {
          toggleManualNodeExpansion(nodeId);
          return;
        }

        clearManualNodeExpansion();
      }
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

  const toggleManualNodeExpansion = (nodeId: string) => {
    pendingTransitionAnchorId = nodeId;
    setManuallyExpandedNodeIds((current) => {
      const next = new Set(current);

      if (next.has(nodeId)) {
        next.delete(nodeId);
        manualCameraFocusNodeIds = next.size === 0
          ? null
          : getManualExpansionFocusNodeIds(
              globalFilteredData(),
              visibleDepthLevel(),
              next,
              nodeId,
            );
        pendingCameraFocusNodeIds = manualCameraFocusNodeIds;
        return next;
      }

      if (hasVisibleChildNode(globalFilteredData(), nodeId)) {
        next.add(nodeId);
        manualCameraFocusNodeIds = getManualExpansionFocusNodeIds(
          globalFilteredData(),
          visibleDepthLevel(),
          next,
          nodeId,
        );
        pendingCameraFocusNodeIds = manualCameraFocusNodeIds;
      }

      return next;
    });
  };

  const clearManualNodeExpansion = () => {
    if (manuallyExpandedNodeIds().size === 0 && !manualCameraFocusNodeIds) {
      fitCameraToNodes();
      return;
    }

    pendingTransitionAnchorId = selectedNodeId();
    pendingCameraFocusNodeIds = null;
    manualCameraFocusNodeIds = null;
    setManuallyExpandedNodeIds(new Set<string>());
  };

  const toggleLinkedIsolation = () => {
    pendingTransitionAnchorId = isolatedNodeId() ?? selectedNodeId();
    setShowLinkedInIsolation((current) => !current);
  };

  const setGlobalFilterEnabled = (
    value: boolean | ((current: boolean) => boolean),
  ) => {
    pendingTransitionAnchorId = selectedNodeId() ?? isolatedNodeId();
    setGlobalFilter((current) => ({
      ...current,
      enabled: resolveBooleanSetter(value, current.enabled),
    }));
  };

  const setGlobalFilterIncludeParents = (
    value: boolean | ((current: boolean) => boolean),
  ) => {
    pendingTransitionAnchorId = selectedNodeId() ?? isolatedNodeId();
    setGlobalFilter((current) => ({
      ...current,
      includeParents: resolveBooleanSetter(value, current.includeParents),
    }));
  };

  const setGlobalFilterIncludeChildren = (
    value: boolean | ((current: boolean) => boolean),
  ) => {
    pendingTransitionAnchorId = selectedNodeId() ?? isolatedNodeId();
    setGlobalFilter((current) => ({
      ...current,
      includeChildren: resolveBooleanSetter(value, current.includeChildren),
    }));
  };

  const resetFilters = () => {
    pendingTransitionAnchorId = selectedNodeId() ?? isolatedNodeId();
    setGlobalFilter({ ...DEFAULT_GLOBAL_FILTER });
    setShowArchived(false);
  };

  const toggleGlobalFilterType = (type: string) => {
    pendingTransitionAnchorId = selectedNodeId() ?? isolatedNodeId();
    setGlobalFilter((current) => {
      const selectedTypes = current.selectedTypes.includes(type)
        ? current.selectedTypes.filter((item) => item !== type)
        : [...current.selectedTypes, type];

      return {
        ...current,
        enabled: hasAnyGlobalFilterSelection({
          ...current,
          selectedTypes,
        }),
        selectedTypes,
      };
    });
  };

  const toggleGlobalFilterStatus = (status: MapNodeStatus) => {
    pendingTransitionAnchorId = selectedNodeId() ?? isolatedNodeId();
    setGlobalFilter((current) => {
      const selectedStatuses = current.selectedStatuses.includes(status)
        ? current.selectedStatuses.filter((item) => item !== status)
        : [...current.selectedStatuses, status];

      return {
        ...current,
        enabled: hasAnyGlobalFilterSelection({
          ...current,
          selectedStatuses,
        }),
        selectedStatuses,
      };
    });
  };

  const toggleGlobalFilterPriority = (priority: string) => {
    pendingTransitionAnchorId = selectedNodeId() ?? isolatedNodeId();
    setGlobalFilter((current) => {
      const selectedPriorities = current.selectedPriorities.includes(priority)
        ? current.selectedPriorities.filter((item) => item !== priority)
        : [...current.selectedPriorities, priority];

      return {
        ...current,
        enabled: hasAnyGlobalFilterSelection({
          ...current,
          selectedPriorities,
        }),
        selectedPriorities,
      };
    });
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
    contextPreviewRequest,
    deleteSubtreeConfirmId,
    deleteNodeRequest,
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
    manuallyExpandedNodeIds,
    selectedNodeRelations,
    selectedNode,
    stashedNodeIds,
    stashedNodes,
    showEdges,
    showLinkedInIsolation,
    globalFilter,
    globalFilterActive,
    globalFilterMatchedCount,
    availableNodeTypes,
    availableNodeStatuses,
    sourceData: data,
    sourceNodesById,
    availableDepthLevels,
    visibleData,
    visibleDepthSelection,
    visibleDepthLevel,
    viewMode,
    viewportScale,
    zoomPercent,
    zoomScale,
    clearIsolation: () => applyIsolation(null),
    clearDeleteSubtreeConfirm: () => setDeleteSubtreeConfirmId(null),
    clearDeleteNodeRequest: () => setDeleteNodeRequest(null),
    clearChildNodeDraft: () => setChildNodeDraft(null),
    clearContextPreviewRequest: () => setContextPreviewRequest(null),
    clearReparentingNode: () => setReparentingNodeId(null),
    focusNode,
    focusStashedNode,
    openChildNodeDraft,
    openContextPreview: (nodeId) => {
      setSelectedNodeId(nodeId);
      setInspectorOpen(true);
      setContextPreviewRequest((current) => ({
        nodeId,
        requestId: (current?.requestId ?? 0) + 1,
      }));
    },
    isolateNode: (nodeId) => applyIsolation(nodeId),
    stashNode,
    setInspectorOpen,
    setSelectedNodeId,
    setShowEdges,
    setShowLinkedInIsolation,
    setGlobalFilterEnabled,
    setGlobalFilterIncludeParents,
    setGlobalFilterIncludeChildren,
    resetFilters,
    showArchived,
    setShowArchived,
    toggleGlobalFilterType,
    toggleGlobalFilterStatus,
    toggleGlobalFilterPriority,
    setViewMode: (value) => {
      setViewMode(value);
      if (value === "canvas") {
        scheduleViewportFit();
      }
    },
    setVisibleDepthLevel,
    toggleLinkedInIsolation: toggleLinkedIsolation,
    toggleEdges: () => setShowEdges((current) => !current),
    toggleNodeStash,
    unstashNode,
    reflowLayout: () => {
      const nextLayout = createInitialLayout(visibleData());
      transitionToLayout(nextLayout, selectedNodeId());
    },
    fitCameraToNodes,
    setViewportRef: setViewportElement,
    setSvgRef: (element) => {
      svgRef = element;
      updateViewportSize();
      scheduleViewportFit();
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
      onNodePointerDown: () => undefined,
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

// Cmd+Delete on macOS, Ctrl+Delete elsewhere.
function isDeleteSubtreeShortcut(event: KeyboardEvent) {
  return (
    (event.key === "Delete" || event.key === "Backspace") &&
    (event.metaKey || event.ctrlKey) &&
    !event.altKey &&
    !event.shiftKey
  );
}

function isIsolateNodeShortcut(event: KeyboardEvent) {
  return (
    event.key.toLowerCase() === "i" &&
    !event.metaKey &&
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

export function filterSpatialMapDataByDepthLevel(
  data: SpatialMapData,
  visibleDepthLevel: number,
  manuallyExpandedNodeIds: Set<string> = new Set(),
): SpatialMapData {
  if (data.nodes.length === 0) {
    return data;
  }

  const visibleNodeIds = getDepthLimitedNodeIds(data, visibleDepthLevel);

  includeManuallyExpandedChildren(data, visibleNodeIds, manuallyExpandedNodeIds);

  return {
    nodes: data.nodes.filter((node) => visibleNodeIds.has(node.id)),
    links: data.links.filter(
      (link) => visibleNodeIds.has(link.source) && visibleNodeIds.has(link.target),
    ),
  };
}

function getDepthLimitedNodeIds(data: SpatialMapData, visibleDepthLevel: number) {
  const depthsByNodeId = calculateNodeDepths(data);
  const depths = data.nodes.map((node) => depthsByNodeId.get(node.id) ?? 0);
  const minDepth = Math.min(...depths);
  const maxVisibleDepth = minDepth + Math.max(visibleDepthLevel, 1) - 1;

  return new Set(
    data.nodes
      .filter((node) => (depthsByNodeId.get(node.id) ?? 0) <= maxVisibleDepth)
      .map((node) => node.id),
  );
}

function includeManuallyExpandedChildren(
  data: SpatialMapData,
  visibleNodeIds: Set<string>,
  manuallyExpandedNodeIds: Set<string>,
) {
  if (manuallyExpandedNodeIds.size === 0) {
    return;
  }

  let addedNode = true;

  while (addedNode) {
    addedNode = false;

    for (const link of data.links) {
      if (
        link.parentChild &&
        manuallyExpandedNodeIds.has(link.source) &&
        visibleNodeIds.has(link.source) &&
        !visibleNodeIds.has(link.target)
      ) {
        visibleNodeIds.add(link.target);
        addedNode = true;
      }
    }
  }
}

function hasVisibleChildNode(data: SpatialMapData, nodeId: string) {
  return data.links.some((link) => link.parentChild && link.source === nodeId);
}

function getExpandableNodeIds(data: SpatialMapData) {
  const nodeIds = new Set(data.nodes.map((node) => node.id));
  const expandableNodeIds = new Set<string>();

  for (const link of data.links) {
    if (link.parentChild && nodeIds.has(link.source) && nodeIds.has(link.target)) {
      expandableNodeIds.add(link.source);
    }
  }

  return expandableNodeIds;
}

function getManualExpansionFocusNodeIds(
  data: SpatialMapData,
  visibleDepthLevel: number,
  manuallyExpandedNodeIds: Set<string>,
  fallbackNodeId: string,
) {
  if (manuallyExpandedNodeIds.size === 0) {
    return new Set([fallbackNodeId]);
  }

  const visibleNodeIds = getDepthLimitedNodeIds(data, visibleDepthLevel);
  const focusNodeIds = new Set<string>();
  let addedNode = true;

  while (addedNode) {
    addedNode = false;

    for (const link of data.links) {
      if (
        link.parentChild &&
        manuallyExpandedNodeIds.has(link.source) &&
        visibleNodeIds.has(link.source)
      ) {
        focusNodeIds.add(link.source);
        focusNodeIds.add(link.target);

        if (!visibleNodeIds.has(link.target)) {
          visibleNodeIds.add(link.target);
          addedNode = true;
        }
      }
    }
  }

  return focusNodeIds.size > 0 ? focusNodeIds : new Set([fallbackNodeId]);
}

function pruneManualExpansionSet(
  expandedNodeIds: Set<string>,
  sourceData: SpatialMapData,
) {
  if (expandedNodeIds.size === 0) {
    return expandedNodeIds;
  }

  const sourceNodeIds = new Set(sourceData.nodes.map((node) => node.id));
  const next = new Set<string>();

  for (const nodeId of expandedNodeIds) {
    if (sourceNodeIds.has(nodeId)) {
      next.add(nodeId);
    }
  }

  return next.size === expandedNodeIds.size ? expandedNodeIds : next;
}

function inferNewNodeTransitionAnchorId(
  previousLayout: PositionedMapNode[],
  nextData: SpatialMapData,
) {
  if (previousLayout.length === 0) {
    return null;
  }

  const previousNodeIds = new Set(previousLayout.map((node) => node.id));
  const addedNodeIds = new Set(
    nextData.nodes
      .filter((node) => !previousNodeIds.has(node.id))
      .map((node) => node.id),
  );

  if (addedNodeIds.size === 0) {
    return null;
  }

  for (const link of nextData.links) {
    if (
      link.parentChild &&
      addedNodeIds.has(link.target) &&
      previousNodeIds.has(link.source)
    ) {
      return link.source;
    }
  }

  return null;
}

export function filterSpatialMapDataByGlobalFilter(
  data: SpatialMapData,
  filter: SpatialMapGlobalFilterState,
): SpatialMapData {
  if (!isGlobalFilterActive(filter)) {
    return data;
  }

  const visibleNodeIds = new Set(
    data.nodes
      .filter((node) => {
        const typeMatches =
          filter.selectedTypes.length === 0 || filter.selectedTypes.includes(node.type);
        const statusMatches =
          filter.selectedStatuses.length === 0 ||
          filter.selectedStatuses.includes(node.status);
        const priorityMatches =
          filter.selectedPriorities.length === 0 ||
          filter.selectedPriorities.includes(node.priority ?? "none");

        return typeMatches && statusMatches && priorityMatches;
      })
      .map((node) => node.id),
  );

  // Descendants first so their ancestors are covered by the matched nodes' ancestors.
  if (filter.includeChildren) {
    includeDescendantNodes(data, visibleNodeIds);
  }

  if (filter.includeParents) {
    includeAncestorNodes(data, visibleNodeIds);
  }

  return {
    nodes: data.nodes.filter((node) => visibleNodeIds.has(node.id)),
    links: data.links.filter(
      (link) => visibleNodeIds.has(link.source) && visibleNodeIds.has(link.target),
    ),
  };
}

function isGlobalFilterActive(filter: SpatialMapGlobalFilterState) {
  return filter.enabled && hasAnyGlobalFilterSelection(filter);
}

function hasAnyGlobalFilterSelection(filter: SpatialMapGlobalFilterState) {
  return (
    filter.selectedTypes.length > 0 ||
    filter.selectedStatuses.length > 0 ||
    filter.selectedPriorities.length > 0
  );
}

function includeAncestorNodes(data: SpatialMapData, visibleNodeIds: Set<string>) {
  let added = true;

  while (added) {
    added = false;

    for (const link of data.links) {
      if (!link.parentChild || !visibleNodeIds.has(link.target) || visibleNodeIds.has(link.source)) {
        continue;
      }

      visibleNodeIds.add(link.source);
      added = true;
    }
  }
}

function includeDescendantNodes(data: SpatialMapData, visibleNodeIds: Set<string>) {
  let added = true;

  while (added) {
    added = false;

    for (const link of data.links) {
      if (!link.parentChild || !visibleNodeIds.has(link.source) || visibleNodeIds.has(link.target)) {
        continue;
      }

      visibleNodeIds.add(link.target);
      added = true;
    }
  }
}

function resolveBooleanSetter(
  value: boolean | ((current: boolean) => boolean),
  current: boolean,
) {
  return typeof value === "function" ? value(current) : value;
}

function clampInteger(value: number, min: number, max: number) {
  return Math.min(Math.max(Math.trunc(value), min), max);
}
