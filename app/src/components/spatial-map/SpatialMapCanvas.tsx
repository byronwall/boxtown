import { For, createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { Box, HStack, VStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import {
  buildAdjacencyMap,
  createInitialLayout,
  getRelatedSet,
  resetLayout,
  VIEWPORT_HEIGHT,
  VIEWPORT_WIDTH,
} from "~/lib/spatial-map/layout";
import type {
  MapLink,
  MapNode,
  PositionedMapNode,
  SpatialMapData,
} from "~/lib/spatial-map/types";

import "./spatial-map.css";

interface SpatialMapCanvasProps {
  data: SpatialMapData;
}

interface CameraState {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function SpatialMapCanvas(props: SpatialMapCanvasProps) {
  const [positionedNodes, setPositionedNodes] = createSignal<PositionedMapNode[]>(
    createInitialLayout(props.data),
  );
  const [selectedNodeId, setSelectedNodeId] = createSignal<string | null>(
    props.data.nodes[0]?.id ?? null,
  );
  const [hoveredNodeId, setHoveredNodeId] = createSignal<string | null>(null);
  const [showEdges, setShowEdges] = createSignal(false);
  const [inspectorOpen, setInspectorOpen] = createSignal(true);
  const [camera, setCamera] = createSignal<CameraState>({
    x: 0,
    y: 0,
    width: VIEWPORT_WIDTH,
    height: VIEWPORT_HEIGHT,
  });
  const [isPanning, setIsPanning] = createSignal(false);
  const adjacency = createMemo(() => buildAdjacencyMap(props.data));
  const nodesById = createMemo(
    () => new Map(positionedNodes().map((node) => [node.id, node])),
  );
  const sourceNodesById = createMemo(
    () => new Map(props.data.nodes.map((node) => [node.id, node])),
  );

  let viewportRef: HTMLDivElement | undefined;
  let svgRef: SVGSVGElement | undefined;
  let panSession:
    | {
        pointerId: number;
        startClientX: number;
        startClientY: number;
        startCamera: CameraState;
        didDrag: boolean;
      }
    | undefined;
  let suppressNodeClick = false;

  const activeNodeId = createMemo(() => hoveredNodeId() ?? selectedNodeId());
  const relatedSet = createMemo(() =>
    getRelatedSet(adjacency(), activeNodeId()),
  );
  const selectedNode = createMemo(() =>
    selectedNodeId() ? sourceNodesById().get(selectedNodeId() ?? "") ?? null : null,
  );
  const selectedNodeRelations = createMemo(() =>
    describeRelations(props.data.links, sourceNodesById(), selectedNode()),
  );
  const zoomPercent = createMemo(() =>
    `${Math.round((VIEWPORT_WIDTH / camera().width) * 100)}%`,
  );
  const orderedNodes = createMemo(() => {
    const hovered = hoveredNodeId();
    const selected = selectedNodeId();
    const related = relatedSet();

    return positionedNodes()
      .map((node) => {
        const isActive = Boolean(activeNodeId() && related.has(node.id));
        const isDimmed = Boolean(activeNodeId() && !related.has(node.id));
        const isHovered = hovered === node.id;
        const isSelected = selected === node.id;
        const isCore = isHovered || isSelected;

        return {
          node,
          isHovered,
          isSelected,
          opacity: isDimmed ? 0.22 : 1,
          scale: isCore ? 1.045 : isActive ? 1.02 : isDimmed ? 0.985 : 1,
          filter: isActive
            ? "drop-shadow(0 20px 28px rgba(56, 88, 65, 0.18))"
            : isDimmed
              ? "drop-shadow(0 6px 12px rgba(56, 88, 65, 0.08))"
              : "none",
        };
      });
  });

  const edgeState = createMemo(() => {
    const active = activeNodeId();
    const related = relatedSet();

    return props.data.links.map((link) => {
      const source = nodesById().get(link.source);
      const target = nodesById().get(link.target);
      const isRelatedEdge = Boolean(
        active && related.has(link.source) && related.has(link.target),
      );

      return {
        link,
        source,
        target,
        opacity: active ? (isRelatedEdge ? 0.55 : showEdges() ? 0.2 : 0.04) : showEdges() ? 0.38 : 0,
        visible: showEdges() || isRelatedEdge,
      };
    });
  });

  createEffect(() => {
    props.data;
    setPositionedNodes(createInitialLayout(props.data));
    setHoveredNodeId(null);
    setSelectedNodeId(props.data.nodes[0]?.id ?? null);
    queueMicrotask(() => fitCameraToNodes());
  });

  const fitCameraToNodes = () => {
    const next = getFitCamera(positionedNodes(), getViewportAspectRatio());
    setCamera(next);
  };

  const handleWindowKeyDown = (event: KeyboardEvent) => {
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      (target.isContentEditable ||
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT")
    ) {
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

    const hoveredElement = document.elementFromPoint(event.clientX, event.clientY);
    const hoveredNode = hoveredElement?.closest(".spatial-map-node");
    setHoveredNodeId(hoveredNode?.getAttribute("data-node-id") ?? null);
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

  const getViewportAspectRatio = () => {
    if (!viewportRef) {
      return VIEWPORT_WIDTH / VIEWPORT_HEIGHT;
    }

    return viewportRef.clientWidth / Math.max(viewportRef.clientHeight, 1);
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

  const handleViewportPointerDown = (event: PointerEvent) => {
    panSession = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startCamera: camera(),
      didDrag: false,
    };
  };

  const handleViewportPointerMove = (event: PointerEvent) => {
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

  const handleWheel = (event: WheelEvent) => {
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

  const handleNodeClick = (nodeId: string) => {
    if (suppressNodeClick) {
      return;
    }

    setSelectedNodeId(nodeId);
  };

  const handleNodePointerDown = (nodeId: string) => {
    if (suppressNodeClick) {
      return;
    }

    setSelectedNodeId(nodeId);
  };

  const handleSceneClick = (event: MouseEvent) => {
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

  return (
    <Box class={`spatial-map-shell${inspectorOpen() ? "" : " spatial-map-shell--collapsed"}`}>
      <Box class="spatial-map-main">
        <Box class="spatial-map-stage">
          <Box class="spatial-map-topbar">
            <HStack gap="3" alignItems="center" class="spatial-map-topbar-copy">
              <Text as="span" class="spatial-map-eyebrow">
                System map / operator view
              </Text>
              <Box as="h1" class="spatial-map-title">
                Recipe Architecture Grid
              </Box>
            </HStack>

            <HStack gap="1.5" flexWrap="wrap" justifyContent="flex-end" class="spatial-map-control-strip">
              <Button
                colorPalette="green"
                variant="outline"
                size="xs"
                class="spatial-map-button"
                onClick={() => setShowEdges((current) => !current)}
              >
                {showEdges() ? "Hide Edges" : "Show Edges"}
              </Button>
              <Button
                colorPalette="green"
                variant="surface"
                size="xs"
                class="spatial-map-button spatial-map-button--strong"
                onClick={() =>
                  setPositionedNodes((current) =>
                    resetLayout(current, adjacency()),
                  )
                }
              >
                Reflow Layout
              </Button>
              <Text as="span" class="spatial-map-zoom-readout">
                Zoom {zoomPercent()}
              </Text>
              <Button
                colorPalette="green"
                variant="plain"
                size="xs"
                class="spatial-map-button"
                onClick={fitCameraToNodes}
              >
                Fit View <span class="spatial-map-shortcut">F</span>
              </Button>
            </HStack>
          </Box>

          <Box
            ref={viewportRef}
            class={`spatial-map-viewport${isPanning() ? " is-panning" : ""}`}
            onPointerDown={handleViewportPointerDown}
            onPointerMove={handleViewportPointerMove}
            onPointerUp={endPanSession}
            onPointerLeave={() => setHoveredNodeId(null)}
            onPointerCancel={endPanSession}
            onWheel={handleWheel}
          >
            <svg
              ref={svgRef}
              class="spatial-map-scene"
              viewBox={`${camera().x} ${camera().y} ${camera().width} ${camera().height}`}
              preserveAspectRatio="xMidYMid slice"
              onClick={handleSceneClick}
            >
              <g>
                <For each={edgeState()}>
                  {(edge) => (
                    <path
                      class="spatial-map-edge"
                      d={
                        edge.source && edge.target
                          ? `M ${edge.source.x} ${edge.source.y} L ${edge.target.x} ${edge.target.y}`
                          : ""
                      }
                      opacity={edge.visible ? edge.opacity : 0}
                    />
                  )}
                </For>
              </g>

              <g>
                <For each={orderedNodes()}>
                  {(item) => {
                    const x = () => item.node.x - item.node.width / 2;
                    const y = () => item.node.y - item.node.height / 2;

                    return (
                      <g
                        class={`spatial-map-node spatial-map-node--${item.node.type}${item.isSelected ? " is-selected" : ""}${item.isHovered ? " is-hovered" : ""}`}
                        data-node-id={item.node.id}
                        transform={`translate(${x()}, ${y()}) scale(${item.scale})`}
                        opacity={item.opacity}
                        style={{
                          "transform-box": "fill-box",
                          "transform-origin": "center",
                          filter: item.filter,
                          cursor: "pointer",
                        }}
                        onPointerDown={[handleNodePointerDown, item.node.id]}
                        onClick={[handleNodeClick, item.node.id]}
                        onPointerEnter={() => setHoveredNodeId(item.node.id)}
                        onPointerLeave={() => setHoveredNodeId((current) => current === item.node.id ? null : current)}
                      >
                        <rect width={item.node.width} height={item.node.height} />
                        <text
                          class="label"
                          x={item.node.width / 2}
                          y={item.node.height / 2 - 4}
                          text-anchor="middle"
                          dominant-baseline="middle"
                          font-size={String(item.node.fontSize)}
                        >
                          {item.node.label}
                        </text>
                        <text
                          class="meta"
                          x={item.node.width / 2}
                          y={item.node.height - 16}
                          text-anchor="middle"
                          font-size={String(item.node.metaSize)}
                        >
                          {item.node.type}
                        </text>
                        <g
                          class="spatial-map-node-hover"
                          transform={`translate(${item.node.width - 14}, 14)`}
                        >
                          <circle r="9" />
                          <text text-anchor="middle" dominant-baseline="central">
                            i
                          </text>
                        </g>
                      </g>
                    );
                  }}
                </For>
              </g>
            </svg>
          </Box>
        </Box>

        <Box class="spatial-map-inspector-rail">
          <button
            type="button"
            class="spatial-map-inspector-toggle"
            onClick={() => setInspectorOpen((current) => !current)}
            aria-expanded={inspectorOpen()}
            aria-controls="spatial-map-inspector"
          >
            {inspectorOpen() ? "Hide panel" : "Open panel"}
          </button>

          <aside
            id="spatial-map-inspector"
            class={`spatial-map-inspector${inspectorOpen() ? "" : " is-collapsed"}`}
          >
            <VStack alignItems="start" gap="2" h="full">
              <VStack alignItems="start" gap="1" class="spatial-map-inspector-header">
                <Text as="span" textStyle="xs" class="spatial-map-kicker">
                  Inspector rail
                </Text>
                <Box as="h2" class="spatial-map-inspector-title">
                  {selectedNode()?.label ?? "Select an item"}
                </Box>
                <Text as="p" class="spatial-map-inspector-copy">
                  {selectedNode()
                    ? "Lock another node to compare structure without losing current context."
                    : "Choose any node to inspect metadata, role, and network relationships."}
                </Text>
              </VStack>

              <Box class="spatial-map-inspector-section">
                <InspectorRow label="ID" value={selectedNode()?.id ?? "None"} mono />
                <InspectorRow label="Type" value={selectedNode()?.type ?? "Unknown"} />
                <InspectorRow label="Depth" value={String(selectedNode()?.depth ?? 0)} />
              </Box>

              <Box class="spatial-map-inspector-section">
                <InspectorBlock
                  title="Purpose"
                  body={selectedNode()?.purpose ?? "No purpose available for this item."}
                />
                <InspectorBlock
                  title="Implementation"
                  body={
                    selectedNode()?.implementation ??
                    "No implementation notes available for this item."
                  }
                />
              </Box>

              <Box class="spatial-map-inspector-section">
                <Text as="h3" margin="0 0 6px" fontSize="sm" fontWeight="semibold" class="spatial-map-inspector-section-title">
                  Connections
                </Text>
                <InspectorRelationList
                  title="Outgoing"
                  emptyLabel="No outgoing links"
                  items={selectedNodeRelations().outgoing}
                  selectedNodeId={selectedNodeId()}
                  onSelect={setSelectedNodeId}
                />
                <InspectorRelationList
                  title="Incoming"
                  emptyLabel="No incoming links"
                  items={selectedNodeRelations().incoming}
                  selectedNodeId={selectedNodeId()}
                  onSelect={setSelectedNodeId}
                />
              </Box>
            </VStack>
          </aside>
        </Box>
      </Box>
    </Box>
  );
}

interface InspectorRowProps {
  label: string;
  value: string;
  mono?: boolean;
}

function InspectorRow(props: InspectorRowProps) {
  return (
    <HStack justifyContent="space-between" alignItems="start" gap="3" class="spatial-map-inspector-row">
      <Text as="span" textStyle="xs" class="spatial-map-inspector-row-label">
        {props.label}
      </Text>
      <Text
        as="span"
        textStyle="sm"
        class={props.mono ? "spatial-map-inspector-row-value is-mono" : "spatial-map-inspector-row-value"}
        textAlign="right"
      >
        {props.value}
      </Text>
    </HStack>
  );
}

interface InspectorBlockProps {
  title: string;
  body: string;
}

function InspectorBlock(props: InspectorBlockProps) {
  return (
    <VStack alignItems="start" gap="1" class="spatial-map-inspector-block">
      <Text
        as="h3"
        margin="0"
        fontSize="sm"
        fontWeight="semibold"
        class="spatial-map-inspector-block-title"
      >
        {props.title}
      </Text>
      <Text as="p" margin="0" class="spatial-map-inspector-block-body">
        {props.body}
      </Text>
    </VStack>
  );
}

interface InspectorRelationListProps {
  title: string;
  emptyLabel: string;
  items: { kind: string; node: MapNode }[];
  selectedNodeId: string | null;
  onSelect: (nodeId: string) => void;
}

function InspectorRelationList(props: InspectorRelationListProps) {
  return (
    <VStack alignItems="start" gap="1" mt="2">
      <Text
        as="h4"
        margin="0"
        fontSize="xs"
        fontWeight="semibold"
        class="spatial-map-relation-title"
      >
        {props.title}
      </Text>
      <For each={props.items}>
        {(item) => (
          <button
            type="button"
            class={`spatial-map-relation-card${props.selectedNodeId === item.node.id ? " is-selected" : ""}`}
            onClick={() => props.onSelect(item.node.id)}
            aria-pressed={props.selectedNodeId === item.node.id}
          >
            <Text as="div" margin="0" fontSize="sm" fontWeight="semibold" class="spatial-map-relation-name">
              {item.node.label}
            </Text>
            <Text as="div" margin="2px 0 0" fontSize="xs" class="spatial-map-relation-meta">
              {item.kind} · {item.node.type} · depth {item.node.depth}
            </Text>
          </button>
        )}
      </For>
      {props.items.length === 0 ? (
        <Text as="p" margin="0" fontSize="sm" class="spatial-map-empty-state">
          {props.emptyLabel}
        </Text>
      ) : null}
    </VStack>
  );
}

function describeRelations(
  links: MapLink[],
  nodesById: Map<string, MapNode>,
  selectedNode: MapNode | null,
) {
  if (!selectedNode) {
    return {
      outgoing: [] as { kind: string; node: MapNode }[],
      incoming: [] as { kind: string; node: MapNode }[],
    };
  }

  const outgoing = links
    .filter((link) => link.source === selectedNode.id)
    .map((link) => ({
      kind: link.kind ?? "link",
      node: nodesById.get(link.target),
    }))
    .filter((item): item is { kind: string; node: MapNode } => Boolean(item.node));

  const incoming = links
    .filter((link) => link.target === selectedNode.id)
    .map((link) => ({
      kind: link.kind ?? "link",
      node: nodesById.get(link.source),
    }))
    .filter((item): item is { kind: string; node: MapNode } => Boolean(item.node));

  return { outgoing, incoming };
}

function getFitCamera(nodes: PositionedMapNode[], aspectRatio: number): CameraState {
  if (nodes.length === 0) {
    return {
      x: 0,
      y: 0,
      width: VIEWPORT_WIDTH,
      height: VIEWPORT_HEIGHT,
    };
  }

  const minX = Math.min(...nodes.map((node) => node.x - node.width / 2));
  const maxX = Math.max(...nodes.map((node) => node.x + node.width / 2));
  const minY = Math.min(...nodes.map((node) => node.y - node.height / 2));
  const maxY = Math.max(...nodes.map((node) => node.y + node.height / 2));
  const padding = 56;
  const boundsWidth = Math.max(maxX - minX + padding * 2, 320);
  const boundsHeight = Math.max(maxY - minY + padding * 2, 240);
  const boundsCenterX = (minX + maxX) / 2;
  const boundsCenterY = (minY + maxY) / 2;
  const fittedWidth = Math.max(boundsWidth, boundsHeight * aspectRatio);
  const fittedHeight = fittedWidth / aspectRatio;

  return {
    x: boundsCenterX - fittedWidth / 2,
    y: boundsCenterY - fittedHeight / 2,
    width: fittedWidth,
    height: fittedHeight,
  };
}

function preserveCameraCenter(camera: CameraState, aspectRatio: number): CameraState {
  const centerX = camera.x + camera.width / 2;
  const centerY = camera.y + camera.height / 2;
  const nextHeight = camera.width / aspectRatio;

  return {
    x: centerX - camera.width / 2,
    y: centerY - nextHeight / 2,
    width: camera.width,
    height: nextHeight,
  };
}

function clampValue(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
