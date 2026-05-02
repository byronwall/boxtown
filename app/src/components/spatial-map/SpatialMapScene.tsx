import { useSubmission } from "@solidjs/router";
import { createEffect, createMemo, createSignal, For, onCleanup, Show, type JSX } from "solid-js";
import { css } from "styled-system/css";
import { Box, styled } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { toaster } from "~/components/ui/toast";
import { createProjectChildNode, moveProjectNode } from "~/lib/projects/data";
import { ensureProjectNodeTypeOptions, getProjectNodeType } from "~/lib/projects/node-types";
import type { ProjectRecord } from "~/lib/projects/types";
import { normalizeActionUrl } from "~/lib/router/action-url";
import { createParentChildLink } from "~/lib/spatial-map/links";
import { VIEWPORT_HEIGHT, VIEWPORT_WIDTH } from "~/lib/spatial-map/layout";
import {
  DEFAULT_MAP_NODE_STATUS,
  getMapNodeStatusGlyph,
  getMapNodeStatusLabel,
} from "~/lib/spatial-map/node-status";
import type { MapNodeStatus } from "~/lib/spatial-map/types";

import type {
  ChildNodeDraft,
  NodeVisualState,
  SpatialMapNodeColorMode,
} from "./spatial-map-canvas.types";
import { getImageFilesFromDataTransfer, useSpatialMapImages } from "./SpatialMapImages";
import { useSpatialMap } from "./SpatialMapContext";

const NODE_TYPE_FALLBACK_TONES = [
  {
    fill: "#dfe3dc",
    fillHover: "#d2d8cf",
    stroke: "#748072",
    strokeHover: "#626d61",
  },
  {
    fill: "#d8dde0",
    fillHover: "#cbd3d8",
    stroke: "#6c7882",
    strokeHover: "#59656f",
  },
  {
    fill: "#ddd8cf",
    fillHover: "#d2cbc1",
    stroke: "#7d7467",
    strokeHover: "#696154",
  },
  {
    fill: "#d6ddd7",
    fillHover: "#cad3cb",
    stroke: "#6f7b72",
    strokeHover: "#5c685f",
  },
  {
    fill: "#ddd6d1",
    fillHover: "#d2c9c2",
    stroke: "#82736c",
    strokeHover: "#6e6059",
  },
  {
    fill: "#d7dde3",
    fillHover: "#cbd3db",
    stroke: "#6a7784",
    strokeHover: "#586572",
  },
  {
    fill: "#e0dccf",
    fillHover: "#d4cfbf",
    stroke: "#817764",
    strokeHover: "#6d6452",
  },
  {
    fill: "#d8e0da",
    fillHover: "#ccd6cf",
    stroke: "#6d7b71",
    strokeHover: "#5a675e",
  },
] as const;

const NODE_STATUS_TONES = {
  planned: {
    fill: "#e8ece7",
    fillHover: "#dce3da",
    stroke: "#717a70",
    strokeHover: "#5c665b",
  },
  implemented: {
    fill: "#d7e8dc",
    fillHover: "#c7ddcf",
    stroke: "#4e7a56",
    strokeHover: "#3c6544",
  },
  working: {
    fill: "#d8e7ef",
    fillHover: "#c7dce8",
    stroke: "#4d7892",
    strokeHover: "#3b627a",
  },
  blocked: {
    fill: "#f0ddd8",
    fillHover: "#e8cbc4",
    stroke: "#9a5b4a",
    strokeHover: "#824534",
  },
  "needs-review": {
    fill: "#efe4ca",
    fillHover: "#e5d5b3",
    stroke: "#917444",
    strokeHover: "#785f33",
  },
  deprecated: {
    fill: "#dfdfdc",
    fillHover: "#d1d2ce",
    stroke: "#656762",
    strokeHover: "#50534d",
  },
} satisfies Record<MapNodeStatus, NodeTone>;

type NodeTone = {
  fill: string;
  fillHover: string;
  stroke: string;
  strokeHover: string;
};

const NODE_LABEL_HORIZONTAL_PADDING = 8;
const NODE_LABEL_TOP_PADDING = 7;
const NODE_LABEL_IMAGE_GAP = 10;
const NODE_LABEL_META_GAP = 8;
const NODE_LABEL_MIN_BOTTOM_PADDING = 7;
const NODE_LABEL_BOTTOM_PADDING_RATIO = 0.11;
const NODE_LABEL_LINE_HEIGHT = 1.08;
const SVG_TEXT_WIDTH_FACTOR = 0.58;
const NODE_TEXT_SCALE_ZOOM_START = 0.72;
const NODE_TEXT_SCALE_STEP = 0.06;
const NODE_STATUS_BADGE_SIZE = 17;
const NODE_STATUS_BADGE_MARGIN = 6;
const NODE_STATUS_LABEL_GAP = 5;
const NODE_STATUS_LABEL_WIDTH_FACTOR = 6.2;

const SpatialMapButton = styled("button");
const SpatialMapForm = styled("form");
const SpatialMapSelect = styled("select");
const SpatialMapImage = styled("img");

// SVG hover state crosses from the node group into child rect/text elements, so
// it stays as a local selector instead of a global CSS file rule.
const nodeInteractionClass = css({
  "&:hover .spatial-map-node-body, &.is-hovered .spatial-map-node-body": {
    fill: "color-mix(in srgb, var(--spatial-map-node-fill-hover, var(--spatial-map-neutral-fill-hover)) calc(100% - var(--spatial-map-node-depth-fill-hover-lightness, 0%)), white var(--spatial-map-node-depth-fill-hover-lightness, 0%))",
    stroke: "color-mix(in srgb, var(--spatial-map-node-stroke-hover, var(--spatial-map-neutral-stroke-hover)) calc(100% - var(--spatial-map-node-depth-stroke-hover-lightness, 0%)), white var(--spatial-map-node-depth-stroke-hover-lightness, 0%))",
  },
  "& .spatial-map-node-status:hover .spatial-map-node-status-label-bg, & .spatial-map-node-status:hover .spatial-map-node-status-label": {
    opacity: "1",
  },
});

// The preview hierarchy uses connector rails; the lines are pseudo-elements,
// which Panda props cannot attach to plain children passed into the row helper.
const contextTreeClass = css({
  "& .spatial-map-node-context-card-tree-rail": {
    position: "relative",
    minH: "19px",
  },
  "& .spatial-map-node-context-card-tree-rail::before": {
    content: '""',
    position: "absolute",
    top: "-10px",
    bottom: "-10px",
    left: "8px",
    borderLeft: "1px solid var(--context-tree-line)",
  },
  "& .spatial-map-node-context-card-tree-row.is-current .spatial-map-node-context-card-tree-rail::after, & .spatial-map-node-context-card-tree-row.is-child .spatial-map-node-context-card-tree-rail::after": {
    content: '""',
    position: "absolute",
    top: "50%",
    left: "8px",
    w: "12px",
    borderTop: "1px solid var(--context-tree-line-strong)",
  },
  "& .spatial-map-node-context-card-tree-row.is-last .spatial-map-node-context-card-tree-rail::before": {
    bottom: "50%",
  },
  "& .spatial-map-node-context-card-tree-label, & .spatial-map-node-context-card-tree-type": {
    minW: "0",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  "& .spatial-map-node-context-card-tree-type": {
    color: "var(--spatial-map-copy-dim)",
    fontFamily: `"SFMono-Regular", "SF Mono", "Roboto Mono", "Consolas", monospace`,
  },
});
const NODE_CONTEXT_PREVIEW_MAX_LENGTH = 160;
const NODE_CONTEXT_HOVER_DELAY_MS = 200;
const NODE_CONTEXT_CLOSE_DELAY_MS = 120;
const NODE_CONTEXT_CARD_GAP = 12;
const NODE_CONTEXT_CARD_VIEWPORT_INSET = 12;
const NODE_CONTEXT_CARD_FALLBACK_WIDTH = 340;
const NODE_CONTEXT_CARD_FALLBACK_HEIGHT = 260;

interface SpatialMapSceneProps {
  project: ProjectRecord;
  nodeColorMode: SpatialMapNodeColorMode;
  onNodeColorModeChange: (mode: SpatialMapNodeColorMode) => void;
  onProjectUpdated?: (project: ProjectRecord) => void;
}

export function SpatialMapScene(props: SpatialMapSceneProps) {
  const controller = useSpatialMap();
  const draftParentNode = createMemo(() => {
    const parentNodeId = controller.childNodeDraft()?.parentNodeId;
    if (!parentNodeId) {
      return null;
    }

    return controller.orderedNodes().find((item) => item.node.id === parentNodeId)?.node ?? null;
  });
  const draftConnectorPath = createMemo(() => {
    const draft = controller.childNodeDraft();
    const parentNode = draftParentNode();
    if (!draft || !parentNode) {
      return null;
    }

    return createDraftConnectorPath(parentNode, draft);
  });
  const moveSubmission = useSubmission(moveProjectNode, (input) => {
    const formData = input[0];
    return (
      formData instanceof FormData &&
      formData.get("projectId") === props.project.id &&
      formData.get("nodeId") === controller.reparentingNodeId()
    );
  });
  const reparentingNode = createMemo(() => {
    const nodeId = controller.reparentingNodeId();
    return nodeId ? controller.sourceNodesById().get(nodeId) ?? null : null;
  });
  const reparentDescendantIds = createMemo(() => {
    const nodeId = controller.reparentingNodeId();
    return nodeId ? getDescendantNodeIds(props.project.spatialMap, nodeId) : new Set<string>();
  });
  const [contextHoverNodeId, setContextHoverNodeId] = createSignal<string | null>(null);
  const contextHoverItem = createMemo(() => {
    const nodeId = contextHoverNodeId();
    if (!nodeId) {
      return null;
    }

    return controller.orderedNodes().find((entry) => entry.node.id === nodeId) ?? null;
  });
  let moveFormRef: HTMLFormElement | undefined;
  let moveNodeIdInputRef: HTMLInputElement | undefined;
  let moveParentNodeIdInputRef: HTMLInputElement | undefined;
  let contextHoverOpenTimeout: ReturnType<typeof setTimeout> | undefined;
  let contextHoverCloseTimeout: ReturnType<typeof setTimeout> | undefined;

  const clearContextHoverOpenTimeout = () => {
    if (contextHoverOpenTimeout === undefined) {
      return;
    }

    clearTimeout(contextHoverOpenTimeout);
    contextHoverOpenTimeout = undefined;
  };

  const clearContextHoverCloseTimeout = () => {
    if (contextHoverCloseTimeout === undefined) {
      return;
    }

    clearTimeout(contextHoverCloseTimeout);
    contextHoverCloseTimeout = undefined;
  };

  const openContextHoverCard = (nodeId: string) => {
    clearContextHoverCloseTimeout();
    clearContextHoverOpenTimeout();
    contextHoverOpenTimeout = setTimeout(() => {
      contextHoverOpenTimeout = undefined;
      setContextHoverNodeId(nodeId);
    }, NODE_CONTEXT_HOVER_DELAY_MS);
  };

  const closeContextHoverCard = () => {
    clearContextHoverOpenTimeout();
    clearContextHoverCloseTimeout();
    contextHoverCloseTimeout = setTimeout(() => {
      contextHoverCloseTimeout = undefined;
      setContextHoverNodeId(null);
    }, NODE_CONTEXT_CLOSE_DELAY_MS);
  };

  onCleanup(() => {
    clearContextHoverOpenTimeout();
    clearContextHoverCloseTimeout();
  });

  createEffect(() => {
    const result = moveSubmission.result;
    if (!result || moveSubmission.pending) {
      return;
    }

    props.onProjectUpdated?.(result);
    controller.clearReparentingNode();
    toaster.success({ title: "Node moved" });
    moveSubmission.clear();
  });

  createEffect(() => {
    if (!moveSubmission.error || moveSubmission.pending) {
      return;
    }

    toaster.error({
      title: "Node was not moved",
      description:
        moveSubmission.error instanceof Error
          ? moveSubmission.error.message
          : "The server action failed. Try again after the dev server reconnects.",
    });
    moveSubmission.clear();
  });

  const moveSelectedNode = (parentNodeId: string | null) => {
    const nodeId = controller.reparentingNodeId();
    if (!nodeId || !moveFormRef || !moveNodeIdInputRef || !moveParentNodeIdInputRef) {
      return;
    }
    if (parentNodeId === nodeId) {
      toaster.error({ title: "Choose a different parent" });
      return;
    }
    if (parentNodeId && reparentDescendantIds().has(parentNodeId)) {
      toaster.error({
        title: "Choose a different parent",
        description: "A node cannot be moved under one of its descendants.",
      });
      return;
    }

    moveNodeIdInputRef.value = nodeId;
    moveParentNodeIdInputRef.value = parentNodeId ?? "";
    props.onProjectUpdated?.(moveProjectNodeOptimistically(props.project, nodeId, parentNodeId));
    moveFormRef.requestSubmit();
    controller.clearReparentingNode();
  };

  return (
    <Box
      ref={controller.setViewportRef}
      class={`spatial-map-viewport${controller.isPanning() ? " is-panning" : ""}`}
      position="relative"
      overflow="hidden"
      minH="0"
      border="1px solid rgba(96, 101, 95, 0.46)"
      borderRadius={{ base: "6px", md: "8px" }}
      background="linear-gradient(180deg, rgba(248, 250, 248, 0.88), rgba(235, 239, 233, 0.96))"
      boxShadow={`
        inset 0 1px 0 rgba(255, 255, 255, 0.64),
        0 12px 30px rgba(29, 33, 28, 0.06)
      `}
      cursor={controller.isPanning() ? "grabbing" : "grab"}
      touchAction="none"
      userSelect="none"
      onPointerDown={controller.viewportHandlers.onPointerDown}
      onPointerMove={controller.viewportHandlers.onPointerMove}
      onPointerUp={controller.viewportHandlers.onPointerUp}
      onPointerLeave={controller.viewportHandlers.onPointerLeave}
      onPointerCancel={controller.viewportHandlers.onPointerCancel}
      onWheel={controller.viewportHandlers.onWheel}
    >
      <Box
        position="absolute"
        top="0"
        right="0"
        zIndex="2"
        display="inline-flex"
        alignItems="stretch"
        gap="6px"
        pointerEvents="auto"
      >
        <Box
          display="inline-flex"
          alignItems="stretch"
          border="1px solid rgba(24, 29, 26, 0.34)"
          borderTop="0"
          borderRadius="0 0 6px 6px"
          background="rgba(227, 231, 225, 0.94)"
          boxShadow={`
            inset 0 1px 0 rgba(255, 255, 255, 0.32),
            inset 0 -1px 0 rgba(44, 52, 46, 0.14)
          `}
        >
          <Box
            as="span"
            display="inline-flex"
            alignItems="center"
            minH="28px"
            p="0 8px"
            borderRight="1px solid rgba(24, 29, 26, 0.22)"
            color="var(--spatial-map-copy-muted)"
            fontFamily={`"SFMono-Regular", "SF Mono", "Roboto Mono", "Consolas", monospace`}
            fontSize="12px"
            lineHeight="1.1"
            fontWeight="600"
            letterSpacing="0.05em"
            textTransform="none"
            whiteSpace="nowrap"
            pointerEvents="none"
          >
            Zoom {controller.zoomPercent()}
          </Box>
          <Button
            colorPalette="green"
            variant="plain"
            size="xs"
            minH="28px"
            border="0"
            borderRadius="4px"
            background="transparent"
            transition="background-color 160ms ease, border-color 160ms ease, color 160ms ease, box-shadow 160ms ease, transform 160ms ease"
            _active={{ transform: "scale(0.98)" }}
            onClick={() => controller.fitCameraToNodes()}
          >
            Fit View
          </Button>
          <Button
            colorPalette="green"
            variant="plain"
            size="xs"
            class={`spatial-map-viewport-button spatial-map-viewport-toggle${controller.showEdges() ? " is-active" : ""}`}
            minH="28px"
            border="0"
            borderLeft="1px solid rgba(24, 29, 26, 0.22)"
            borderRadius="4px"
            background={controller.showEdges() ? "rgba(229, 239, 229, 0.96)" : "transparent"}
            color={controller.showEdges() ? "var(--spatial-map-accent-strong)" : undefined}
            boxShadow={
              controller.showEdges()
                ? "inset 0 0 0 1px rgba(45, 111, 72, 0.42), inset 0 -2px 0 rgba(45, 111, 72, 0.86)"
                : undefined
            }
            transition="background-color 160ms ease, border-color 160ms ease, color 160ms ease, box-shadow 160ms ease, transform 160ms ease"
            _active={{ transform: "scale(0.98)" }}
            aria-pressed={controller.showEdges()}
            onClick={() => controller.toggleEdges()}
          >
            Show Edges
          </Button>
          <Show when={controller.isolationModeActive()}>
            <Button
              colorPalette="green"
              variant="plain"
              size="xs"
              class={`spatial-map-viewport-button spatial-map-viewport-toggle${controller.showLinkedInIsolation() ? " is-active" : ""}`}
              minH="28px"
              border="0"
              borderLeft="1px solid rgba(24, 29, 26, 0.22)"
              borderRadius="4px"
              background={controller.showLinkedInIsolation() ? "rgba(229, 239, 229, 0.96)" : "transparent"}
              color={controller.showLinkedInIsolation() ? "var(--spatial-map-accent-strong)" : undefined}
              boxShadow={
                controller.showLinkedInIsolation()
                  ? "inset 0 0 0 1px rgba(45, 111, 72, 0.42), inset 0 -2px 0 rgba(45, 111, 72, 0.86)"
                  : undefined
              }
              transition="background-color 160ms ease, border-color 160ms ease, color 160ms ease, box-shadow 160ms ease, transform 160ms ease"
              _active={{ transform: "scale(0.98)" }}
              aria-pressed={controller.showLinkedInIsolation()}
              onClick={() => controller.toggleLinkedInIsolation()}
            >
              Show Links
            </Button>
          </Show>
        </Box>
        <Box
          display="inline-flex"
          alignItems="stretch"
          overflow="hidden"
          border="1px solid rgba(24, 29, 26, 0.34)"
          borderTop="0"
          borderRight="0"
          borderRadius="0 0 0 6px"
          background="rgba(227, 231, 225, 0.94)"
          boxShadow={`
            inset 0 1px 0 rgba(255, 255, 255, 0.32),
            inset 0 -1px 0 rgba(44, 52, 46, 0.14)
          `}
          pointerEvents="auto"
          role="group"
          aria-label="Node color mode"
        >
          <SpatialMapButton
            type="button"
            display="inline-flex"
            alignItems="center"
            justifyContent="center"
            minW="58px"
            minH="28px"
            p="0 10px"
            border="0"
            borderRight="1px solid rgba(24, 29, 26, 0.22)"
            background={props.nodeColorMode === "type" ? "rgba(37, 95, 58, 0.16)" : "transparent"}
            color={props.nodeColorMode === "type" ? "var(--spatial-map-accent-strong)" : "var(--spatial-map-copy)"}
            boxShadow={props.nodeColorMode === "type" ? "inset 0 -2px 0 rgba(23, 62, 39, 0.86)" : undefined}
            fontFamily="inherit"
            fontSize="12px"
            lineHeight="1"
            fontWeight="700"
            letterSpacing="0.02em"
            whiteSpace="nowrap"
            appearance="none"
            cursor="pointer"
            _hover={{ background: "rgba(255, 255, 255, 0.28)", outline: "none" }}
            _focusVisible={{ background: "rgba(255, 255, 255, 0.28)", outline: "none" }}
            aria-pressed={props.nodeColorMode === "type"}
            onClick={() => props.onNodeColorModeChange("type")}
          >
            Type
          </SpatialMapButton>
          <SpatialMapButton
            type="button"
            display="inline-flex"
            alignItems="center"
            justifyContent="center"
            minW="58px"
            minH="28px"
            p="0 10px"
            border="0"
            background={props.nodeColorMode === "status" ? "rgba(37, 95, 58, 0.16)" : "transparent"}
            color={props.nodeColorMode === "status" ? "var(--spatial-map-accent-strong)" : "var(--spatial-map-copy)"}
            boxShadow={props.nodeColorMode === "status" ? "inset 0 -2px 0 rgba(23, 62, 39, 0.86)" : undefined}
            fontFamily="inherit"
            fontSize="12px"
            lineHeight="1"
            fontWeight="700"
            letterSpacing="0.02em"
            whiteSpace="nowrap"
            appearance="none"
            cursor="pointer"
            _hover={{ background: "rgba(255, 255, 255, 0.28)", outline: "none" }}
            _focusVisible={{ background: "rgba(255, 255, 255, 0.28)", outline: "none" }}
            aria-pressed={props.nodeColorMode === "status"}
            onClick={() => props.onNodeColorModeChange("status")}
          >
            Status
          </SpatialMapButton>
        </Box>
      </Box>
      <svg
        ref={controller.setSvgRef}
        class={`spatial-map-scene spatial-map-scene--color-${props.nodeColorMode}`}
        viewBox={`0 0 ${VIEWPORT_WIDTH} ${VIEWPORT_HEIGHT}`}
        preserveAspectRatio="none"
        onClick={controller.sceneHandlers.onBackgroundClick}
        onDblClick={controller.sceneHandlers.onBackgroundDoubleClick}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          "user-select": "none",
          background:
            "linear-gradient(rgba(26, 33, 28, 0.065) 1px, transparent 1px), linear-gradient(90deg, rgba(26, 33, 28, 0.065) 1px, transparent 1px), linear-gradient(rgba(26, 33, 28, 0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(26, 33, 28, 0.018) 1px, transparent 1px), linear-gradient(180deg, rgba(248, 250, 248, 0.9), rgba(235, 239, 233, 0.96))",
          "background-size": "96px 96px, 96px 96px, 24px 24px, 24px 24px, auto",
          "background-position": "-1px -1px, -1px -1px, -1px -1px, -1px -1px, 0 0",
        }}
      >
        <g
          class="spatial-map-scene-layer"
          transform={controller.sceneTransform()}
          style={{ "transform-box": "view-box" }}
        >
          <g>
            <For each={controller.edgeState()}>
              {(edge) => (
                <path
                  class="spatial-map-edge"
                  d={edge.path}
                  opacity={edge.opacity}
                  fill="none"
                  pointer-events="none"
                  stroke="rgba(47, 57, 51, 0.42)"
                  stroke-width="1.25"
                  stroke-linecap="square"
                />
              )}
            </For>
            <Show when={draftConnectorPath()}>
              {(path) => (
                <path
                  class="spatial-map-draft-parent-edge"
                  d={path()}
                  fill="none"
                  pointer-events="none"
                  stroke="rgba(23, 62, 39, 0.68)"
                  stroke-width="2"
                  stroke-dasharray="8 7"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              )}
            </Show>
          </g>

          <g>
            <For each={controller.orderedNodes()}>
              {(item) => (
                <SpatialMapNode
                  item={item}
                  project={props.project}
                  colorMode={props.nodeColorMode}
                  viewportScale={controller.viewportScale()}
                  onClick={(nodeId) => {
                    if (controller.reparentingNodeId()) {
                      moveSelectedNode(nodeId);
                      return;
                    }
                    controller.sceneHandlers.onNodeClick(nodeId);
                  }}
                  onDoubleClick={controller.sceneHandlers.onNodeDoubleClick}
                  isIsolationTarget={controller.isolatedNodeId() === item.node.id}
                  onPointerDown={(nodeId) => {
                    if (controller.reparentingNodeId()) {
                      return;
                    }
                    controller.sceneHandlers.onNodePointerDown(nodeId);
                  }}
                  onPointerEnter={(nodeId) => {
                    controller.sceneHandlers.onNodePointerEnter(nodeId);
                    openContextHoverCard(nodeId);
                  }}
                  onPointerLeave={(nodeId) => {
                    controller.sceneHandlers.onNodePointerLeave(nodeId);
                    closeContextHoverCard();
                  }}
                />
              )}
            </For>
          </g>
        </g>
      </svg>
      <Show when={contextHoverItem()}>
        {(item) => (
          <SpatialMapNodeContextCard
            item={item()}
            project={props.project}
            onPointerEnter={() => {
              clearContextHoverCloseTimeout();
            }}
            onPointerLeave={closeContextHoverCard}
          />
        )}
      </Show>
      <Show when={controller.childNodeDraft()}>
        {(draft) => (
          <ChildNodePlaceholder
            draft={draft()}
            parentNode={draftParentNode() ?? undefined}
            project={props.project}
            onProjectUpdated={props.onProjectUpdated}
          />
        )}
      </Show>
      <form
        ref={moveFormRef}
        action={normalizeActionUrl(moveProjectNode.url)}
        method="post"
        hidden
      >
        <input type="hidden" name="projectId" value={props.project.id} />
        <input ref={moveNodeIdInputRef} type="hidden" name="nodeId" />
        <input ref={moveParentNodeIdInputRef} type="hidden" name="parentNodeId" />
      </form>
      <Show when={reparentingNode()}>
        {(node) => (
          <Box
            position="absolute"
            right="10px"
            bottom="48px"
            zIndex="4"
            w="min(360px, calc(100% - 20px))"
            display="flex"
            alignItems="center"
            gap="8px"
            p="8px"
            border="1px solid rgba(24, 29, 26, 0.34)"
            background="rgba(250, 252, 247, 0.98)"
            color="var(--spatial-map-copy)"
            pointerEvents="auto"
            boxShadow="0 12px 28px rgba(20, 25, 22, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.58)"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <Box minW="0" flex="1" color="var(--spatial-map-copy-dim)" fontSize="12px" lineHeight="1.25">
              Click the new parent node for {node().label}.
            </Box>
            <Box display="inline-flex" alignItems="stretch" gap="4px" flex="none">
              <Button
                colorPalette="green"
                variant="plain"
                size="xs"
                minH="28px"
                border="0"
                borderRadius="4px"
                background="transparent"
                loading={moveSubmission.pending}
                onClick={() => moveSelectedNode(null)}
              >
                Move to root
              </Button>
              <Button
                variant="plain"
                size="xs"
                minH="28px"
                border="0"
                borderRadius="4px"
                background="transparent"
                disabled={moveSubmission.pending}
                onClick={() => controller.clearReparentingNode()}
              >
                Cancel
              </Button>
            </Box>
          </Box>
        )}
      </Show>
    </Box>
  );
}

function moveProjectNodeOptimistically(
  project: ProjectRecord,
  nodeId: string,
  parentNodeId: string | null,
): ProjectRecord {
  const linksWithoutCurrentParent = project.spatialMap.links.filter(
    (link) => !(link.parentChild && link.target === nodeId),
  );

  return {
    ...project,
    updatedAt: new Date().toISOString(),
    spatialMap: {
      ...project.spatialMap,
      links: parentNodeId
        ? [
            ...linksWithoutCurrentParent,
            createParentChildLink({ source: parentNodeId, target: nodeId }),
          ]
        : linksWithoutCurrentParent,
    },
  };
}

function createDraftConnectorPath(
  parentNode: NodeVisualState["node"],
  draft: ChildNodeDraft,
) {
  const start = getNodeEdgePoint(parentNode, draft);
  const end = { x: draft.x, y: draft.y };
  const direction = end.x >= start.x ? 1 : -1;
  const controlOffset = Math.min(180, Math.max(48, Math.abs(end.x - start.x) * 0.42));

  return [
    `M ${start.x} ${start.y}`,
    `C ${start.x + controlOffset * direction} ${start.y}`,
    `${end.x - controlOffset * direction} ${end.y}`,
    `${end.x} ${end.y}`,
  ].join(" ");
}

function getNodeEdgePoint(
  node: NodeVisualState["node"],
  target: { x: number; y: number },
) {
  const dx = target.x - node.x;
  const dy = target.y - node.y;
  if (dx === 0 && dy === 0) {
    return { x: node.x, y: node.y };
  }

  const halfWidth = node.width / 2;
  const halfHeight = node.height / 2;
  const xScale = dx === 0 ? Number.POSITIVE_INFINITY : halfWidth / Math.abs(dx);
  const yScale = dy === 0 ? Number.POSITIVE_INFINITY : halfHeight / Math.abs(dy);
  const scale = Math.min(xScale, yScale);

  return {
    x: node.x + dx * scale,
    y: node.y + dy * scale,
  };
}

function getDescendantNodeIds(data: ProjectRecord["spatialMap"], nodeId: string) {
  const childrenByParent = new Map<string, string[]>();
  for (const link of data.links) {
    if (!link.parentChild) {
      continue;
    }
    childrenByParent.set(link.source, [...(childrenByParent.get(link.source) ?? []), link.target]);
  }

  const descendants = new Set<string>();
  const pending = [...(childrenByParent.get(nodeId) ?? [])];
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || descendants.has(current)) {
      continue;
    }
    descendants.add(current);
    pending.push(...(childrenByParent.get(current) ?? []));
  }

  return descendants;
}

function ChildNodePlaceholder(props: {
  draft: ChildNodeDraft;
  parentNode?: NodeVisualState["node"];
  project: ProjectRecord;
  onProjectUpdated?: (project: ProjectRecord) => void;
}) {
  const controller = useSpatialMap();
  const submission = useSubmission(createProjectChildNode, (input) => {
    const formData = input[0];
    return (
      formData instanceof FormData &&
      formData.get("projectId") === props.project.id &&
      (props.parentNode
        ? formData.get("parentNodeId") === props.parentNode.id
        : !formData.get("parentNodeId"))
    );
  });
  const [title, setTitle] = createSignal("");
  const nodeTypeOptions = createMemo(() =>
    ensureProjectNodeTypeOptions(props.project.nodeTypeSchema, props.parentNode?.type),
  );
  const [nodeType, setNodeType] = createSignal(
    props.parentNode?.type ?? nodeTypeOptions()[0]?.name ?? "page",
  );
  const [context, setContext] = createSignal("");
  let formRef: HTMLFormElement | undefined;
  let textareaRef: HTMLTextAreaElement | undefined;
  let closeOnBlurTimer: number | undefined;

  const overlayStyle = createMemo(() => {
    const camera = controller.camera();
    return {
      left: `${((props.draft.x - camera.x) / camera.width) * 100}%`,
      top: `${((props.draft.y - camera.y) / camera.height) * 100}%`,
    };
  });

  createEffect(() => {
    textareaRef?.focus();
  });

  onCleanup(() => {
    if (closeOnBlurTimer !== undefined) {
      window.clearTimeout(closeOnBlurTimer);
    }
  });

  const scheduleCloseOnBlur = () => {
    if (closeOnBlurTimer !== undefined) {
      window.clearTimeout(closeOnBlurTimer);
    }

    closeOnBlurTimer = window.setTimeout(() => {
      closeOnBlurTimer = undefined;
      if (!formRef || submission.pending) {
        return;
      }
      const activeElement = document.activeElement;
      if (activeElement instanceof Node && formRef.contains(activeElement)) {
        return;
      }
      controller.clearChildNodeDraft();
    }, 0);
  };

  createEffect(() => {
    const result = submission.result;
    if (!result || submission.pending) {
      return;
    }

    props.onProjectUpdated?.(result.project);
    controller.clearChildNodeDraft();
    queueMicrotask(() => controller.setSelectedNodeId(result.nodeId));
    submission.clear();
  });

  createEffect(() => {
    if (!submission.error || submission.pending) {
      return;
    }

    toaster.error({
      title: "Child node was not created",
      description:
        submission.error instanceof Error
          ? submission.error.message
          : "The server action failed. Try again after the dev server reconnects.",
    });
    submission.clear();
  });

  const applyOptimisticChild = (nextTitle: string, nextType: string, nextContext: string) => {
    const nodeId = createUniqueNodeId(
      nextTitle,
      nextType,
      new Set(props.project.spatialMap.nodes.map((node) => node.id)),
    );

    props.onProjectUpdated?.({
      ...props.project,
      updatedAt: new Date().toISOString(),
      spatialMap: {
        ...props.project.spatialMap,
        nodes: [
          ...props.project.spatialMap.nodes,
          {
            id: nodeId,
            label: nextTitle,
            type: nextType,
            status: DEFAULT_MAP_NODE_STATUS,
            metadata: {},
            context: nextContext,
            rawContext: nextContext,
          },
        ],
        links: props.parentNode
          ? [
              ...props.project.spatialMap.links,
              createParentChildLink({ source: props.parentNode.id, target: nodeId }),
            ]
          : props.project.spatialMap.links,
      },
    });
    controller.clearChildNodeDraft();
    queueMicrotask(() => controller.setSelectedNodeId(nodeId));
  };

  return (
    <SpatialMapForm
      ref={formRef}
      position="absolute"
      zIndex="30"
      w="min(300px, calc(100% - 24px))"
      maxH="calc(100% - 24px)"
      boxSizing="border-box"
      display="flex"
      flexDirection="column"
      gap="8px"
      p="10px"
      border="1px solid rgba(47, 57, 50, 0.5)"
      background="rgba(250, 252, 247, 0.98)"
      boxShadow="0 12px 28px rgba(20, 25, 22, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.7)"
      color="var(--spatial-map-copy)"
      overflow="auto"
      overscrollBehavior="contain"
      pointerEvents="auto"
      transform="translate(-50%, -50%)"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      style={overlayStyle()}
      action={normalizeActionUrl(createProjectChildNode.url)}
      method="post"
      onFocusOut={scheduleCloseOnBlur}
      onSubmit={(event) => {
        const nextTitle = title().trim();
        if (!nextTitle) {
          event.preventDefault();
          return;
        }

        applyOptimisticChild(nextTitle, nodeType(), context().trim());
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          controller.clearChildNodeDraft();
          return;
        }

        if (
          event.key === "Enter" &&
          !event.shiftKey &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.altKey
        ) {
          event.preventDefault();
          formRef?.requestSubmit();
        }
      }}
    >
      <Box color="var(--spatial-map-copy-dim)" fontSize="11px" lineHeight="1" textTransform="none">
        {props.parentNode ? "New child node" : "New node"}
      </Box>
      <Show when={props.parentNode}>
        {(parentNode) => (
          <Box
            p="6px 7px"
            border="1px solid rgba(34, 41, 36, 0.12)"
            background="rgba(232, 236, 230, 0.72)"
            color="var(--spatial-map-copy-muted)"
            fontSize="11px"
            lineHeight="1.25"
            overflow="hidden"
            textOverflow="ellipsis"
            whiteSpace="nowrap"
          >
            Parent: {parentNode().label}
          </Box>
        )}
      </Show>
      <input type="hidden" name="projectId" value={props.project.id} />
      <Show when={props.parentNode}>
        {(parentNode) => (
          <input type="hidden" name="parentNodeId" value={parentNode().id} />
        )}
      </Show>
      <input type="hidden" name="type" value={nodeType()} />
      <Textarea
        ref={textareaRef}
        aria-label="New node title"
        name="title"
        required
        value={title()}
        disabled={submission.pending}
        placeholder="Node title"
        rows={3}
        onInput={(event) => setTitle(event.currentTarget.value)}
      />
      <Box
        as="label"
        display="flex"
        flexDirection="column"
        gap="4px"
        color="var(--spatial-map-copy-dim)"
        fontSize="10px"
        fontWeight="700"
        letterSpacing="0.04em"
        lineHeight="1"
        textTransform="none"
      >
        <span>Type</span>
        <SpatialMapSelect
          value={nodeType()}
          disabled={submission.pending}
          w="100%"
          minH="30px"
          border="1px solid rgba(47, 57, 50, 0.28)"
          background="rgba(248, 250, 248, 0.94)"
          color="var(--spatial-map-copy)"
          fontFamily="inherit"
          fontSize="12px"
          fontWeight="500"
          letterSpacing="0"
          onChange={(event) => setNodeType(event.currentTarget.value)}
        >
          <For each={nodeTypeOptions()}>
            {(option) => (
              <option value={option.name}>
                {option.name}
              </option>
            )}
          </For>
        </SpatialMapSelect>
      </Box>
      <Box
        as="label"
        display="flex"
        flexDirection="column"
        gap="4px"
        color="var(--spatial-map-copy-dim)"
        fontSize="10px"
        fontWeight="700"
        letterSpacing="0.04em"
        lineHeight="1"
        textTransform="none"
      >
        <span>Context</span>
        <Textarea
          aria-label="New node context"
          name="context"
          value={context()}
          disabled={submission.pending}
          placeholder="Optional context"
          rows={4}
          onInput={(event) => setContext(event.currentTarget.value)}
        />
      </Box>
      <Box display="flex" gap="6px" justifyContent="flex-end">
        <Button
          size="xs"
          variant="plain"
          type="button"
          disabled={submission.pending}
          onClick={() => controller.clearChildNodeDraft()}
        >
          Cancel
        </Button>
        <Button
          size="xs"
          colorPalette="green"
          disabled={!title().trim()}
          loading={submission.pending}
          type="submit"
        >
          Accept
        </Button>
      </Box>
    </SpatialMapForm>
  );
}

function createUniqueNodeId(label: string, type: string, existingIds: Set<string>) {
  const baseId = slugifyProjectName(`${type}-${label}`);
  if (!existingIds.has(baseId)) {
    return baseId;
  }

  let suffix = 2;
  while (existingIds.has(`${baseId}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseId}-${suffix}`;
}

function slugifyProjectName(name: string) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "project";
}

function SpatialMapNode(props: {
  item: NodeVisualState;
  project: ProjectRecord;
  colorMode: SpatialMapNodeColorMode;
  viewportScale: number;
  onClick: (nodeId: string) => void;
  onDoubleClick: (nodeId: string) => void;
  isIsolationTarget: boolean;
  onPointerDown: (nodeId: string) => void;
  onPointerEnter: (nodeId: string) => void;
  onPointerLeave: (nodeId: string) => void;
}) {
  const imageUi = useSpatialMapImages();
  const x = () => props.item.node.x - props.item.node.width / 2;
  const y = () => props.item.node.y - props.item.node.height / 2;
  const nodeImages = () => props.item.node.images ?? [];
  const firstImage = () => nodeImages()[0];
  const hasImages = () => nodeImages().length > 0;
  const imageHeight = () => (hasImages() ? Math.min(86, props.item.node.height * 0.45) : 0);
  const fallbackTone = () =>
    getNodeTypeTone(props.project.nodeTypeSchema, props.item.node.type);
  const nodeTone = () =>
    props.colorMode === "status"
      ? getNodeStatusTone(props.item.node.status)
      : fallbackTone();
  const zoomTextScale = createMemo(() =>
    quantizeTextScale(
      Math.min(1, NODE_TEXT_SCALE_ZOOM_START / Math.max(props.viewportScale, 0.1)),
    ),
  );
  const metaBaselineY = () =>
    props.item.node.height -
    Math.max(NODE_LABEL_MIN_BOTTOM_PADDING, props.item.node.height * NODE_LABEL_BOTTOM_PADDING_RATIO);
  const labelAreaTop = () =>
    hasImages() ? NODE_LABEL_TOP_PADDING + imageHeight() + NODE_LABEL_IMAGE_GAP : NODE_LABEL_TOP_PADDING;
  const labelMaxWidth = createMemo(() =>
    Math.max(24, props.item.node.width - NODE_LABEL_HORIZONTAL_PADDING * 2),
  );
  const maxReadableTextScale = createMemo(() =>
    getMaxReadableTextScale({
      baseFontSize: props.item.node.fontSize,
      baseMetaSize: props.item.node.metaSize,
      labelAreaTop: labelAreaTop(),
      labelMaxWidth: labelMaxWidth(),
      metaBaselineY: metaBaselineY(),
      text: props.item.node.label,
    }),
  );
  const textScale = createMemo(() => Math.max(zoomTextScale(), maxReadableTextScale()));
  const metaFontSize = createMemo(() => props.item.node.metaSize * textScale());
  const labelAreaBottom = () => Math.max(labelAreaTop() + 1, metaBaselineY() - metaFontSize() - NODE_LABEL_META_GAP);
  const availableLabelHeight = () =>
    Math.max(1, labelAreaBottom() - labelAreaTop());
  const labelFontSize = createMemo(() => {
    const zoomAdjustedFontSize = props.item.node.fontSize * textScale();

    return Math.min(
      zoomAdjustedFontSize,
      availableLabelHeight() / NODE_LABEL_LINE_HEIGHT,
    );
  });
  const labelLineHeight = () => Math.ceil(labelFontSize() * NODE_LABEL_LINE_HEIGHT);
  const labelMaxLines = createMemo(() =>
    Math.max(
      2,
      Math.min(
        5,
        Math.floor(availableLabelHeight() / labelLineHeight()),
      ),
    ),
  );
  const labelMaxCharacters = createMemo(() =>
    Math.max(1, Math.floor(labelMaxWidth() / (labelFontSize() * SVG_TEXT_WIDTH_FACTOR))),
  );
  const labelLines = createMemo(() =>
    wrapSvgText({
      maxCharacters: labelMaxCharacters(),
      maxLines: labelMaxLines(),
      text: props.item.node.label,
    }),
  );
  const labelLineAt = (index: number) => labelLines()[index] ?? "";
  const labelBlockHeight = () => labelLines().length * labelLineHeight();
  const labelStartY = () =>
    labelAreaTop() +
    Math.max(0, (availableLabelHeight() - labelBlockHeight()) / 2) +
    labelFontSize() * 0.78;
  const statusLabel = () => getMapNodeStatusLabel(props.item.node.status);
  const statusLabelWidth = () =>
    Math.max(46, statusLabel().length * NODE_STATUS_LABEL_WIDTH_FACTOR + 14);

  return (
    <g
      class={`spatial-map-node ${nodeInteractionClass} spatial-map-node--${props.item.node.type}${props.item.isSelected ? " is-selected" : ""}${props.item.isHovered ? " is-hovered" : ""}${props.isIsolationTarget ? " is-isolated" : ""}`}
      data-node-id={props.item.node.id}
      transform={`translate(${x()}, ${y()})`}
      opacity={props.item.opacity}
      style={{
        filter: "none",
        transition: "opacity 180ms ease",
        "user-select": "none",
        "transform-box": "fill-box",
        "transform-origin": "center",
        cursor: "pointer",
        "--spatial-map-node-fill": nodeTone().fill,
        "--spatial-map-node-fill-hover": nodeTone().fillHover,
        "--spatial-map-node-stroke": nodeTone().stroke,
        "--spatial-map-node-stroke-hover": nodeTone().strokeHover,
        "--spatial-map-node-depth-fill-lightness": props.item.depthFillLightness,
        "--spatial-map-node-depth-fill-hover-lightness": props.item.depthFillHoverLightness,
        "--spatial-map-node-depth-stroke-lightness": props.item.depthStrokeLightness,
        "--spatial-map-node-depth-stroke-hover-lightness": props.item.depthStrokeHoverLightness,
        "--spatial-map-node-depth-stroke-width": String(props.item.depthStrokeWidth),
      }}
      onPointerDown={() => props.onPointerDown(props.item.node.id)}
      onClick={() => props.onClick(props.item.node.id)}
      onDblClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        props.onDoubleClick(props.item.node.id);
      }}
      onPointerEnter={() => props.onPointerEnter(props.item.node.id)}
      onPointerLeave={() => props.onPointerLeave(props.item.node.id)}
      onDragOver={(event) => {
        if (getImageFilesFromDataTransfer(event.dataTransfer).length === 0) {
          return;
        }

        event.preventDefault();
      }}
      onDrop={(event) => {
        const files = getImageFilesFromDataTransfer(event.dataTransfer);
        if (files.length === 0) {
          console.warn("[spatial-map-images]", "canvas node drop ignored: no image files", {
            nodeId: props.item.node.id,
          });
          return;
        }

        console.info("[spatial-map-images]", "canvas node drop image files accepted", {
          nodeId: props.item.node.id,
          files: files.map((file) => ({
            name: file.name,
            size: file.size,
            type: file.type,
          })),
        });
        event.preventDefault();
        event.stopPropagation();
        void imageUi.uploadImages(props.item.node.id, files);
      }}
    >
      <rect
        class="spatial-map-node-body"
        width={props.item.node.width}
        height={props.item.node.height}
        rx="0"
        ry="0"
        stroke-width={props.item.isSelected ? "2" : props.isIsolationTarget ? "2.4" : "var(--spatial-map-node-depth-stroke-width, 1.4)"}
        shape-rendering="crispEdges"
        fill={`color-mix(
          in srgb,
          var(--spatial-map-node-fill, var(--spatial-map-neutral-fill))
            calc(100% - var(--spatial-map-node-depth-fill-lightness, 0%)),
          white var(--spatial-map-node-depth-fill-lightness, 0%)
        )`}
        stroke={
          props.item.isSelected
            ? "#0f2f1d"
            : props.isIsolationTarget
              ? "#245d7e"
              : `color-mix(
                  in srgb,
                  var(--spatial-map-node-stroke, var(--spatial-map-neutral-stroke))
                    calc(100% - var(--spatial-map-node-depth-stroke-lightness, 0%)),
                  white var(--spatial-map-node-depth-stroke-lightness, 0%)
                )`
        }
        style={{
          filter: "none",
          transition: "fill 120ms ease, stroke 120ms ease",
        }}
      />
      <Show when={firstImage()}>
        {(image) => (
          <foreignObject
            class="spatial-map-node-image-frame"
            x="8"
            y="8"
            width={props.item.node.width - 16}
            height={imageHeight()}
          >
            <button
              type="button"
              class="spatial-map-node-image-button"
              style={{
                position: "relative",
                width: "100%",
                height: "100%",
                display: "block",
                padding: "0",
                border: "1px solid rgba(15, 47, 29, 0.38)",
                "border-radius": "0",
                background: "rgba(18, 22, 19, 0.1)",
                cursor: "zoom-in",
                overflow: "hidden",
              }}
              aria-label={`Open ${image().originalName}`}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                imageUi.openImage(image(), props.item.node, nodeImages());
              }}
            >
              <img
                src={image().src}
                alt={image().originalName}
                loading="lazy"
                style={{
                  width: "100%",
                  height: "100%",
                  display: "block",
                  "object-fit": "cover",
                  "pointer-events": "none",
                }}
              />
              <Show when={nodeImages().length > 1}>
                <span
                  style={{
                    position: "absolute",
                    right: "4px",
                    bottom: "4px",
                    "min-width": "22px",
                    padding: "2px 5px",
                    border: "1px solid rgba(34, 41, 36, 0.24)",
                    background: "rgba(249, 250, 247, 0.92)",
                    color: "var(--spatial-map-copy)",
                    "font-size": "10px",
                    "font-weight": "760",
                    "line-height": "1",
                  }}
                >
                  {nodeImages().length}
                </span>
              </Show>
            </button>
          </foreignObject>
        )}
      </Show>
      <text
        class="label"
        x={props.item.node.width / 2}
        y={labelStartY()}
        text-anchor="middle"
        font-size={String(labelFontSize())}
        fill="#131816"
        font-weight="700"
        letter-spacing="0"
        pointer-events="none"
        text-rendering="geometricPrecision"
        style={{
          "line-height": "1.16",
          transition: "fill 120ms ease, stroke 120ms ease",
          "user-select": "none",
        }}
      >
        <tspan x={props.item.node.width / 2} dy="0">
          {labelLineAt(0)}
        </tspan>
        <tspan x={props.item.node.width / 2} dy={labelLineHeight()}>
          {labelLineAt(1)}
        </tspan>
        <tspan x={props.item.node.width / 2} dy={labelLineHeight()}>
          {labelLineAt(2)}
        </tspan>
        <tspan x={props.item.node.width / 2} dy={labelLineHeight()}>
          {labelLineAt(3)}
        </tspan>
        <tspan x={props.item.node.width / 2} dy={labelLineHeight()}>
          {labelLineAt(4)}
        </tspan>
      </text>
      <text
        class="meta"
        x={props.item.node.width / 2}
        y={metaBaselineY()}
        text-anchor="middle"
        font-size={String(metaFontSize())}
        fill="rgba(23, 27, 24, 0.66)"
        font-family={`"SFMono-Regular", "SF Mono", "Roboto Mono", "Consolas", monospace`}
        letter-spacing="0.04em"
        pointer-events="none"
        style={{
          "text-transform": "none",
          transition: "fill 120ms ease, stroke 120ms ease",
          "user-select": "none",
        }}
      >
        {props.item.node.type}
      </text>
      <g
        class={`spatial-map-node-status spatial-map-node-status--${props.item.node.status}`}
        transform={`translate(${NODE_STATUS_BADGE_MARGIN}, ${props.item.node.height - NODE_STATUS_BADGE_MARGIN - NODE_STATUS_BADGE_SIZE})`}
        aria-label={`Status: ${statusLabel()}`}
        pointer-events="auto"
        style={getNodeStatusStyle(props.item.node.status)}
      >
        <rect
          class="spatial-map-node-status-hit-area"
          x="0"
          y="0"
          width={NODE_STATUS_BADGE_SIZE}
          height={NODE_STATUS_BADGE_SIZE}
          fill="transparent"
          stroke="none"
          pointer-events="all"
        />
        <rect
          class="spatial-map-node-status-label-bg"
          x={NODE_STATUS_BADGE_SIZE + NODE_STATUS_LABEL_GAP - 1}
          y="0"
          width={statusLabelWidth()}
          height={NODE_STATUS_BADGE_SIZE}
          fill="var(--spatial-map-status-fill)"
          stroke="var(--spatial-map-status-stroke)"
          stroke-width="1"
          opacity="0"
          pointer-events="none"
          style={{ transition: "opacity 140ms ease" }}
        />
        <circle
          class="spatial-map-node-status-dot"
          cx={NODE_STATUS_BADGE_SIZE / 2}
          cy={NODE_STATUS_BADGE_SIZE / 2}
          r={NODE_STATUS_BADGE_SIZE / 2 - 1}
          fill="var(--spatial-map-status-fill)"
          stroke="var(--spatial-map-status-stroke)"
          stroke-width="1"
        />
        <text
          class="spatial-map-node-status-glyph"
          x={NODE_STATUS_BADGE_SIZE / 2}
          y={NODE_STATUS_BADGE_SIZE / 2 + 3.5}
          text-anchor="middle"
          fill="var(--spatial-map-status-copy)"
          font-family={`"SFMono-Regular", "SF Mono", "Roboto Mono", "Consolas", monospace`}
          font-size="10px"
          font-weight="800"
          letter-spacing="0"
          style={{ "user-select": "none" }}
        >
          {getMapNodeStatusGlyph(props.item.node.status)}
        </text>
        <text
          class="spatial-map-node-status-label"
          x={NODE_STATUS_BADGE_SIZE + NODE_STATUS_LABEL_GAP + 6}
          y={NODE_STATUS_BADGE_SIZE / 2 + 3.5}
          fill="var(--spatial-map-status-copy)"
          font-family={`"SFMono-Regular", "SF Mono", "Roboto Mono", "Consolas", monospace`}
          font-size="10px"
          font-weight="700"
          letter-spacing="0"
          opacity="0"
          pointer-events="none"
          style={{
            transition: "opacity 140ms ease",
            "user-select": "none",
          }}
        >
          {statusLabel()}
        </text>
      </g>
    </g>
  );
}

function SpatialMapNodeContextCard(props: {
  item: NodeVisualState;
  project: ProjectRecord;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}) {
  const controller = useSpatialMap();
  const imageUi = useSpatialMapImages();
  const [cardSize, setCardSize] = createSignal({
    width: NODE_CONTEXT_CARD_FALLBACK_WIDTH,
    height: NODE_CONTEXT_CARD_FALLBACK_HEIGHT,
  });
  const [viewportSize, setViewportSize] = createSignal({
    width: VIEWPORT_WIDTH,
    height: VIEWPORT_HEIGHT,
  });
  const context = createMemo(() => getNodeContext(props.item.node));
  const contextPreview = createMemo(() => getNodeContextPreview(props.item.node));
  const statusLabel = () => getMapNodeStatusLabel(props.item.node.status);
  const images = () => props.item.node.images ?? [];
  const metadataEntries = createMemo(() =>
    Object.entries(props.item.node.metadata)
      .map(([key, value]) => [key, value.trim()] as const)
      .filter(([, value]) => value.length > 0),
  );
  const activityEntries = createMemo(() =>
    props.project.operationLog
      .filter((entry) => entry.nodeIds.includes(props.item.node.id))
      .slice(0, 2),
  );
  const hierarchyPreview = createMemo(() =>
    getNodeHierarchyPreview(props.project, props.item.node.id),
  );
  let cardRef: HTMLDivElement | undefined;

  createEffect(() => {
    const element = cardRef;

    if (!element) {
      return;
    }

    const updateMeasuredBounds = () => {
      const cardRect = element.getBoundingClientRect();
      const viewportRect = element.parentElement?.getBoundingClientRect();

      setCardSize({
        width: Math.max(cardRect.width, 1),
        height: Math.max(cardRect.height, 1),
      });
      setViewportSize({
        width: Math.max(viewportRect?.width ?? VIEWPORT_WIDTH, 1),
        height: Math.max(viewportRect?.height ?? VIEWPORT_HEIGHT, 1),
      });
    };

    updateMeasuredBounds();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateMeasuredBounds);
      onCleanup(() => window.removeEventListener("resize", updateMeasuredBounds));
      return;
    }

    const resizeObserver = new ResizeObserver(updateMeasuredBounds);
    resizeObserver.observe(element);

    if (element.parentElement) {
      resizeObserver.observe(element.parentElement);
    }

    onCleanup(() => resizeObserver.disconnect());
  });

  const positionStyle = createMemo(() => {
    const camera = controller.camera();
    const node = props.item.node;
    const viewport = viewportSize();
    const card = cardSize();
    const cameraCenterX = camera.x + camera.width / 2;
    const placeLeft = node.x > cameraCenterX;
    const anchorX = placeLeft
      ? node.x - node.width / 2 - NODE_CONTEXT_CARD_GAP
      : node.x + node.width / 2 + NODE_CONTEXT_CARD_GAP;
    const anchorLeft = ((anchorX - camera.x) / camera.width) * viewport.width;
    const nodeTop = ((node.y - node.height / 2 - camera.y) / camera.height) * viewport.height;
    const idealLeft = placeLeft ? anchorLeft - card.width : anchorLeft;
    const maxLeft = viewport.width - card.width - NODE_CONTEXT_CARD_VIEWPORT_INSET;
    const maxTop = viewport.height - card.height - NODE_CONTEXT_CARD_VIEWPORT_INSET;

    return {
      left: `${clampValue(
        idealLeft,
        NODE_CONTEXT_CARD_VIEWPORT_INSET,
        Math.max(NODE_CONTEXT_CARD_VIEWPORT_INSET, maxLeft),
      )}px`,
      top: `${clampValue(
        nodeTop,
        NODE_CONTEXT_CARD_VIEWPORT_INSET,
        Math.max(NODE_CONTEXT_CARD_VIEWPORT_INSET, maxTop),
      )}px`,
    };
  });

  return (
    <Box
      ref={cardRef}
      class="spatial-map-node-context-card"
      style={positionStyle()}
      position="absolute"
      zIndex="18"
      w="min(340px, calc(100% - 24px))"
      maxH="calc(100% - 24px)"
      boxSizing="border-box"
      p="10px"
      border="1px solid rgba(34, 41, 36, 0.2)"
      background="rgba(253, 254, 251, 0.98)"
      color="var(--spatial-map-copy)"
      overflow="auto"
      overscrollBehavior="contain"
      pointerEvents="auto"
      boxShadow="0 16px 42px rgba(18, 23, 20, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.74)"
      onPointerDown={(event) => event.stopPropagation()}
      onPointerEnter={props.onPointerEnter}
      onPointerLeave={props.onPointerLeave}
    >
      <Box color="var(--spatial-map-copy)" fontSize="12px" fontWeight="760" lineHeight="1.25">
        {props.item.node.label}
      </Box>
      <Box display="flex" flexWrap="wrap" gap="5px" mt="7px">
        <ContextCardPill>{props.item.node.type}</ContextCardPill>
        <ContextCardPill>{statusLabel()}</ContextCardPill>
        <Show when={images().length > 0}>
          <ContextCardPill>{images().length} image{images().length === 1 ? "" : "s"}</ContextCardPill>
        </Show>
      </Box>
      <Show when={images().length > 0}>
        <Box display="grid" gridTemplateColumns="repeat(4, minmax(0, 1fr))" gap="5px" mt="8px">
          <For each={images().slice(0, 4)}>
            {(image) => (
              <SpatialMapButton
                type="button"
                position="relative"
                aspectRatio="16 / 10"
                minW="0"
                p="0"
                border="1px solid rgba(34, 41, 36, 0.18)"
                background="rgba(238, 242, 236, 0.72)"
                cursor="zoom-in"
                overflow="hidden"
                _hover={{ borderColor: "rgba(15, 47, 29, 0.5)", outline: "none" }}
                _focusVisible={{ borderColor: "rgba(15, 47, 29, 0.5)", outline: "none" }}
                aria-label={`Open ${image.originalName}`}
                title={image.originalName}
                onClick={(event) => {
                  event.stopPropagation();
                  imageUi.openImage(image, props.item.node, images());
                }}
              >
                <SpatialMapImage
                  src={image.src}
                  alt={image.originalName}
                  loading="lazy"
                  w="100%"
                  h="100%"
                  display="block"
                  objectFit="cover"
                  pointerEvents="none"
                />
              </SpatialMapButton>
            )}
          </For>
          <Show when={images().length > 4}>
            <Box
              as="span"
              display="inline-flex"
              alignItems="center"
              justifyContent="center"
              minH="100%"
              border="1px solid rgba(34, 41, 36, 0.14)"
              background="rgba(235, 240, 232, 0.64)"
              color="var(--spatial-map-copy-dim)"
              fontSize="11px"
              fontWeight="720"
            >
              +{images().length - 4}
            </Box>
          </Show>
          </Box>
        </Show>
      <Box
        class={contextTreeClass}
        aria-label="Node hierarchy"
        display="grid"
        mt="8px"
        p="5px 6px"
        border="1px solid rgba(34, 41, 36, 0.1)"
        background="rgba(246, 248, 244, 0.64)"
        style={{
          "--context-tree-rail-width": "18px",
          "--context-tree-child-offset": "8px",
          "--context-tree-line": "rgba(44, 52, 46, 0.3)",
          "--context-tree-line-strong": "rgba(44, 52, 46, 0.42)",
        }}
      >
        <Show when={hierarchyPreview().parent}>
          {(parent) => (
            <ContextTreeRow class="is-parent">
              <span class="spatial-map-node-context-card-tree-rail" aria-hidden="true" />
              <span class="spatial-map-node-context-card-tree-label" title={parent().label}>
                {parent().label}
              </span>
              <span class="spatial-map-node-context-card-tree-type">{parent().type}</span>
            </ContextTreeRow>
          )}
        </Show>
        <ContextTreeRow
          class={`is-current${hierarchyPreview().parent ? " has-parent" : ""}`}
          current
        >
          <span class="spatial-map-node-context-card-tree-rail" aria-hidden="true" />
          <span class="spatial-map-node-context-card-tree-label" title={props.item.node.label}>
            {props.item.node.label}
          </span>
          <span class="spatial-map-node-context-card-tree-type">{props.item.node.type}</span>
        </ContextTreeRow>
        <For each={hierarchyPreview().children.slice(0, 3)}>
          {(child, index) => (
            <ContextTreeRow
              class={`is-child${index() === Math.min(hierarchyPreview().children.length, 3) - 1 ? " is-last" : ""}`}
              child
            >
              <span class="spatial-map-node-context-card-tree-rail" aria-hidden="true" />
              <span class="spatial-map-node-context-card-tree-label" title={child.label}>
                {child.label}
              </span>
              <span class="spatial-map-node-context-card-tree-type">{child.type}</span>
            </ContextTreeRow>
          )}
        </For>
        <Show when={hierarchyPreview().children.length > 3}>
          <ContextTreeRow class="is-child is-last" child>
            <span class="spatial-map-node-context-card-tree-rail" aria-hidden="true" />
            <span class="spatial-map-node-context-card-tree-label">
              +{hierarchyPreview().children.length - 3} more
            </span>
          </ContextTreeRow>
        </Show>
      </Box>
      <Show when={metadataEntries().length > 0}>
        <Box display="grid" gap="4px" mt="8px">
          <For each={metadataEntries()}>
            {([key, value]) => (
              <Box
                display="grid"
                gridTemplateColumns="minmax(54px, 0.34fr) minmax(0, 1fr)"
                gap="7px"
                minW="0"
                p="4px 6px"
                border="1px solid rgba(34, 41, 36, 0.1)"
                background="rgba(246, 248, 244, 0.72)"
                fontSize="11px"
                lineHeight="1.2"
              >
                <Box as="span" minW="0" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap" color="var(--spatial-map-copy-dim)" fontWeight="720">
                  {key}
                </Box>
                <Box as="span" minW="0" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap" color="var(--spatial-map-copy)">
                  {value}
                </Box>
              </Box>
            )}
          </For>
        </Box>
      </Show>
      <Show when={activityEntries().length > 0}>
        <Box display="grid" gap="4px" mt="8px">
          <For each={activityEntries()}>
            {(entry) => (
              <Box
                display="grid"
                gridTemplateColumns="minmax(0, 1fr) auto"
                gap="8px"
                minW="0"
                color="var(--spatial-map-copy-dim)"
                fontSize="11px"
                lineHeight="1.25"
                title={entry.summary}
              >
                <Box as="span" minW="0" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
                  {entry.summary}
                </Box>
                <Box
                  as="time"
                  minW="0"
                  overflow="hidden"
                  textOverflow="ellipsis"
                  whiteSpace="nowrap"
                  color="var(--spatial-map-copy-muted)"
                  fontFamily={`"SFMono-Regular", "SF Mono", "Roboto Mono", "Consolas", monospace`}
                >
                  {formatShortActivityDate(entry.createdAt)}
                </Box>
              </Box>
            )}
          </For>
        </Box>
      </Show>
      <Show when={context().length > 0}>
        <Box
          mt="8px"
          color="var(--spatial-map-copy-dim)"
          fontSize="12px"
          lineHeight="1.45"
          maxH="168px"
          overflow="hidden"
          whiteSpace="pre-wrap"
        >
          {contextPreview()}
        </Box>
      </Show>
      <Show when={context().length > 0}>
        <SpatialMapButton
          type="button"
          mt="9px"
          p="0"
          border="0"
          background="transparent"
          color="var(--spatial-map-accent-strong)"
          cursor="pointer"
          fontSize="12px"
          fontWeight="720"
          lineHeight="1.2"
          _hover={{ textDecoration: "underline", outline: "none" }}
          _focusVisible={{ textDecoration: "underline", outline: "none" }}
          onClick={(event) => {
            event.stopPropagation();
            controller.openContextPreview(props.item.node.id);
          }}
        >
          Open context
        </SpatialMapButton>
      </Show>
    </Box>
  );
}

function ContextCardPill(props: { children: JSX.Element }) {
  return (
    <Box
      as="span"
      display="inline-flex"
      alignItems="center"
      minH="18px"
      p="0 6px"
      border="1px solid rgba(34, 41, 36, 0.14)"
      background="rgba(235, 240, 232, 0.64)"
      color="var(--spatial-map-copy-dim)"
      fontSize="10px"
      lineHeight="1"
    >
      {props.children}
    </Box>
  );
}

function ContextTreeRow(props: {
  children: JSX.Element;
  class: string;
  child?: boolean;
  current?: boolean;
}) {
  return (
    <Box
      class={`spatial-map-node-context-card-tree-row ${props.class}`}
      display="grid"
      gridTemplateColumns={
        props.child
          ? "calc(var(--context-tree-rail-width) + var(--context-tree-child-offset)) minmax(0, 1fr) auto"
          : "var(--context-tree-rail-width) minmax(0, 1fr) auto"
      }
      gap="6px"
      minW="0"
      alignItems="center"
      minH="19px"
      color={props.current ? "var(--spatial-map-copy)" : "var(--spatial-map-copy-dim)"}
      fontSize="10px"
      fontWeight={props.current ? "760" : undefined}
      lineHeight="1.15"
    >
      {props.children}
    </Box>
  );
}

function getNodeTypeFallbackTone(type: string) {
  let hash = 0;

  for (let index = 0; index < type.length; index += 1) {
    hash = (hash * 31 + type.charCodeAt(index)) >>> 0;
  }

  return NODE_TYPE_FALLBACK_TONES[hash % NODE_TYPE_FALLBACK_TONES.length];
}

function getNodeStatusTone(status: MapNodeStatus) {
  return NODE_STATUS_TONES[status];
}

function getNodeStatusStyle(status: MapNodeStatus) {
  const tone = getNodeStatusTone(status);
  const copy =
    status === "planned"
      ? "#29302b"
      : status === "implemented"
        ? "#17391d"
        : status === "working"
          ? "#17374b"
          : status === "blocked"
            ? "#552417"
            : status === "needs-review"
              ? "#4c3712"
              : "#30322f";

  return {
    "--spatial-map-status-fill": tone.fill,
    "--spatial-map-status-stroke": tone.stroke,
    "--spatial-map-status-copy": copy,
  };
}

function getNodeTypeTone(
  schema: ProjectRecord["nodeTypeSchema"],
  type: string,
) {
  const configured = getProjectNodeType(schema, type);
  if (!configured) return getNodeTypeFallbackTone(type);

  return {
    fill: configured.color,
    fillHover: `color-mix(in srgb, ${configured.color} 86%, white)`,
    stroke: `color-mix(in srgb, ${configured.color} 68%, #202820)`,
    strokeHover: `color-mix(in srgb, ${configured.color} 50%, #121812)`,
  };
}

function wrapSvgText(options: {
  maxCharacters: number;
  maxLines: number;
  text: string;
}) {
  const maxCharacters = Math.max(1, options.maxCharacters);
  const lines = getSvgTextLines(options.text, maxCharacters);

  return clampSvgTextLines(lines, options.maxLines, maxCharacters);
}

function getNodeContextPreview(node: NodeVisualState["node"]) {
  const context = getNodeContext(node).replace(/\s+/g, " ").trim();
  if (context.length <= NODE_CONTEXT_PREVIEW_MAX_LENGTH) {
    return context;
  }

  return `${context.slice(0, NODE_CONTEXT_PREVIEW_MAX_LENGTH - 3).trimEnd()}...`;
}

function clampValue(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getNodeContext(node: NodeVisualState["node"]) {
  return (node.context || node.rawContext).trim();
}

function getNodeHierarchyPreview(project: ProjectRecord, nodeId: string) {
  const nodesById = new Map(project.spatialMap.nodes.map((node) => [node.id, node]));
  const parentId =
    project.spatialMap.links.find((link) => link.parentChild && link.target === nodeId)?.source ??
    null;
  const childIds = project.spatialMap.links
    .filter((link) => link.parentChild && link.source === nodeId)
    .map((link) => link.target);

  return {
    parent: parentId ? nodesById.get(parentId) ?? null : null,
    children: childIds.flatMap((childId) => {
      const child = nodesById.get(childId);
      return child ? [child] : [];
    }),
  };
}

function formatShortActivityDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toISOString().slice(0, 10);
}

function isSvgTextFullyVisible(options: {
  maxCharacters: number;
  maxLines: number;
  text: string;
}) {
  const maxCharacters = Math.max(1, options.maxCharacters);
  return getSvgTextLines(options.text, maxCharacters).length <= options.maxLines;
}

function getMaxReadableTextScale(options: {
  baseFontSize: number;
  baseMetaSize: number;
  labelAreaTop: number;
  labelMaxWidth: number;
  metaBaselineY: number;
  text: string;
}) {
  for (
    let scale = 1;
    scale >= NODE_TEXT_SCALE_STEP;
    scale = Number((scale - NODE_TEXT_SCALE_STEP).toFixed(2))
  ) {
    if (doesTextFitAtScale(options, scale)) {
      return scale;
    }
  }

  return NODE_TEXT_SCALE_STEP;
}

function doesTextFitAtScale(
  options: {
    baseFontSize: number;
    baseMetaSize: number;
    labelAreaTop: number;
    labelMaxWidth: number;
    metaBaselineY: number;
    text: string;
  },
  scale: number,
) {
  const metaFontSize = options.baseMetaSize * scale;
  const labelAreaBottom = Math.max(
    options.labelAreaTop + 1,
    options.metaBaselineY - metaFontSize - NODE_LABEL_META_GAP,
  );
  const availableLabelHeight = Math.max(1, labelAreaBottom - options.labelAreaTop);
  const labelFontSize = Math.min(
    options.baseFontSize * scale,
    availableLabelHeight / NODE_LABEL_LINE_HEIGHT,
  );
  const labelLineHeight = Math.ceil(labelFontSize * NODE_LABEL_LINE_HEIGHT);
  const maxLines = Math.max(
    2,
    Math.min(5, Math.floor(availableLabelHeight / labelLineHeight)),
  );
  const maxCharacters = Math.max(
    1,
    Math.floor(options.labelMaxWidth / (labelFontSize * SVG_TEXT_WIDTH_FACTOR)),
  );

  return isSvgTextFullyVisible({
    maxCharacters,
    maxLines,
    text: options.text,
  });
}

function getSvgTextLines(text: string, maxCharacters: number) {
  const words = text.trim().replace(/\s+/g, " ").split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const chunks = splitOversizedWord(word, maxCharacters);

    for (const chunk of chunks) {
      const candidate = currentLine ? `${currentLine} ${chunk}` : chunk;

      if (candidate.length <= maxCharacters) {
        currentLine = candidate;
        continue;
      }

      if (currentLine) {
        lines.push(currentLine);
      }

      currentLine = chunk;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function splitOversizedWord(word: string, maxCharacters: number) {
  if (word.length <= maxCharacters) {
    return [word];
  }

  const chunks: string[] = [];
  for (let index = 0; index < word.length; index += maxCharacters) {
    chunks.push(word.slice(index, index + maxCharacters));
  }

  return chunks;
}

function clampSvgTextLines(lines: string[], maxLines: number, maxCharacters: number) {
  if (lines.length === 0) {
    return [""];
  }

  const visibleLines = lines.slice(0, Math.max(1, maxLines));
  if (visibleLines.length === lines.length) {
    return visibleLines;
  }

  const lastIndex = visibleLines.length - 1;
  visibleLines[lastIndex] = ellipsizeSvgText(visibleLines[lastIndex], maxCharacters);
  return visibleLines;
}

function ellipsizeSvgText(text: string, maxCharacters: number) {
  if (maxCharacters <= 3) {
    return text.slice(0, maxCharacters);
  }

  if (text.length <= maxCharacters - 3) {
    return `${text}...`;
  }

  return `${text.slice(0, Math.max(1, maxCharacters - 3))}...`;
}

function quantizeTextScale(scale: number) {
  if (scale >= 1) {
    return 1;
  }

  return Math.max(
    NODE_TEXT_SCALE_STEP,
    Math.floor(scale / NODE_TEXT_SCALE_STEP) * NODE_TEXT_SCALE_STEP,
  );
}
