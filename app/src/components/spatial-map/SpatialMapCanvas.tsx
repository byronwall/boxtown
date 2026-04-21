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
            ? "drop-shadow(0 18px 30px rgba(0,0,0,0.32))"
            : isDimmed
              ? "drop-shadow(0 4px 10px rgba(0,0,0,0.14))"
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

  return (
    <Box class={`spatial-map-shell${inspectorOpen() ? "" : " spatial-map-shell--collapsed"}`}>
      <Box class="spatial-map-main">
        <Box class="spatial-map-stage">
          <Box class="spatial-map-topbar">
            <VStack alignItems="start" gap="1">
              <Box
                as="h1"
                textStyle={{ base: "xl", md: "2xl" }}
                fontWeight="bold"
                letterSpacing="tight"
                margin="0"
              >
                Recipe Website Architecture Map
              </Box>
              <Text as="p" textStyle="sm" color="rgba(223, 231, 247, 0.72)" margin="0">
                Full-screen architecture view. Hover to preview relationships, click any box to inspect it.
              </Text>
            </VStack>

            <HStack gap="2" flexWrap="wrap">
              <Button
                variant="outline"
                onClick={() => setShowEdges((current) => !current)}
              >
                {showEdges() ? "Hide Edges" : "Show Edges"}
              </Button>
              <Button
                variant="solid"
                onClick={() =>
                  setPositionedNodes((current) =>
                    resetLayout(current, adjacency()),
                  )
                }
              >
                Reflow Layout
              </Button>
              <Button variant="plain" onClick={fitCameraToNodes}>
                Fit to Screen (`F`)
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

            <Box class="spatial-map-stage-footer">
              <HStack gap="3" flexWrap="wrap">
                <LegendItem color="#22335f" borderColor="rgba(137, 180, 255, 0.45)" label="Page" />
                <LegendItem color="#21314f" borderColor="rgba(167, 243, 208, 0.32)" label="Assembly" />
                <LegendItem color="#262739" borderColor="rgba(255, 255, 255, 0.14)" label="Component" />
              </HStack>
              <Text as="span" textStyle="xs" color="rgba(223, 231, 247, 0.7)">
                Selected: {selectedNode()?.label ?? "None"}
              </Text>
            </Box>
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
            {inspectorOpen() ? "Hide inspector" : "Show inspector"}
          </button>

          <aside
            id="spatial-map-inspector"
            class={`spatial-map-inspector${inspectorOpen() ? "" : " is-collapsed"}`}
          >
            <VStack alignItems="start" gap="5" h="full">
              <VStack alignItems="start" gap="2">
                <Text as="span" textStyle="xs" class="spatial-map-kicker">
                  Inspector
                </Text>
                <Box
                  as="h2"
                  margin="0"
                  fontSize="2xl"
                  lineHeight="1.1"
                  fontWeight="semibold"
                  letterSpacing="tight"
                >
                  {selectedNode()?.label ?? "Select an item"}
                </Box>
                <Text as="p" margin="0" color="rgba(223, 231, 247, 0.72)">
                  {selectedNode()
                    ? "Click another box to compare nodes without losing context."
                    : "Choose any box in the map to inspect its metadata and connections."}
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
                <Text as="h3" margin="0 0 10px" fontSize="sm" fontWeight="semibold">
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

interface LegendItemProps {
  color: string;
  borderColor: string;
  label: string;
}

function LegendItem(props: LegendItemProps) {
  return (
    <HStack gap="2" alignItems="center">
      <Box
        boxSize="3.5"
        borderRadius="sm"
        borderWidth="1px"
        style={{
          background: props.color,
          "border-color": props.borderColor,
        }}
      />
      <Text as="span" textStyle="xs">
        {props.label}
      </Text>
    </HStack>
  );
}

interface InspectorRowProps {
  label: string;
  value: string;
  mono?: boolean;
}

function InspectorRow(props: InspectorRowProps) {
  return (
    <HStack justifyContent="space-between" alignItems="start" gap="4">
      <Text as="span" textStyle="xs" color="rgba(223, 231, 247, 0.54)">
        {props.label}
      </Text>
      <Text
        as="span"
        textStyle="sm"
        color="rgba(238, 245, 255, 0.92)"
        fontFamily={props.mono ? "monospace" : undefined}
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
    <VStack alignItems="start" gap="1.5">
      <Text as="h3" margin="0" fontSize="sm" fontWeight="semibold">
        {props.title}
      </Text>
      <Text as="p" margin="0" color="rgba(223, 231, 247, 0.78)" lineHeight="1.6">
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
    <VStack alignItems="start" gap="2" mt="3">
      <Text as="h4" margin="0" fontSize="xs" fontWeight="semibold" color="rgba(223, 231, 247, 0.58)">
        {props.title}
      </Text>
      <For each={props.items}>
        {(item) => (
          <Box
            as="button"
            type="button"
            class={`spatial-map-relation-card${props.selectedNodeId === item.node.id ? " is-selected" : ""}`}
            onClick={() => props.onSelect(item.node.id)}
            aria-pressed={props.selectedNodeId === item.node.id}
          >
            <Text as="div" margin="0" fontSize="sm" fontWeight="semibold">
              {item.node.label}
            </Text>
            <Text as="div" margin="2px 0 0" fontSize="xs" color="rgba(223, 231, 247, 0.58)">
              {item.kind} · {item.node.type} · depth {item.node.depth}
            </Text>
          </Box>
        )}
      </For>
      {props.items.length === 0 ? (
        <Text as="p" margin="0" fontSize="sm" color="rgba(223, 231, 247, 0.48)">
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
  const padding = 140;
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
