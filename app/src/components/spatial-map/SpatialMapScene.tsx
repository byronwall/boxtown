import { useAction } from "@solidjs/router";
import { createEffect, createMemo, createSignal, For, Show, type JSX } from "solid-js";
import { css } from "styled-system/css";
import { Box } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { toaster } from "~/components/ui/toast";
import { moveProjectNode } from "~/lib/projects/data";
import { getProjectNodeType } from "~/lib/projects/node-types";
import { appendClientMutationId, createClientMutationId } from "~/lib/projects/optimistic";
import type { ProjectRecord } from "~/lib/projects/types";
import { createParentChildLink } from "~/lib/spatial-map/links";
import { VIEWPORT_HEIGHT, VIEWPORT_WIDTH } from "~/lib/spatial-map/layout";
import {
  getMapNodeStatusGlyph,
  getMapNodeStatusLabel,
} from "~/lib/spatial-map/node-status";
import type { MapNodeStatus } from "~/lib/spatial-map/types";

import type {
  ChildNodeDraft,
  NodeVisualState,
  SpatialMapNodeColorMode,
} from "./spatial-map-canvas.types";
import { SpatialMapChildNodePlaceholder } from "./SpatialMapChildNodePlaceholder";
import { getImageFilesFromDataTransfer, useSpatialMapImages } from "./SpatialMapImages";
import { getNodeImageFrame } from "./spatial-map-image-frame";
import { useSpatialMap } from "./SpatialMapContext";
import { SpatialMapReparentControl } from "./SpatialMapReparentControl";
import { SpatialMapSegmentedControl, type SpatialMapSegmentedOption } from "./SpatialMapSegmentedControl";

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
// Image previews leave room for two label lines at this share of the base font.
const NODE_IMAGE_LABEL_MIN_SCALE = 0.75;
const SVG_TEXT_WIDTH_FACTOR = 0.58;
const NODE_TEXT_SCALE_ZOOM_START = 0.72;
const NODE_TEXT_SCALE_STEP = 0.06;
const NODE_STATUS_BADGE_SIZE = 17;
const NODE_STATUS_BADGE_MARGIN = 6;
const NODE_STATUS_LABEL_GAP = 5;
const NODE_STATUS_LABEL_WIDTH_FACTOR = 6.2;
const NODE_DESCENDANT_COUNT_MARGIN = 8;

const NODE_COLOR_MODE_OPTIONS: SpatialMapSegmentedOption<SpatialMapNodeColorMode>[] = [
  { value: "type", label: "Type" },
  { value: "status", label: "Status" },
];

// SVG hover state crosses from the node group into child rect/text elements, so
// it stays as a local selector instead of a global CSS file rule.
const nodeInteractionClass = css({
  "&:hover .spatial-map-node-body, &.is-hovered .spatial-map-node-body": {
    fill: "color-mix(in srgb, var(--spatial-map-node-fill-hover, var(--spatial-map-neutral-fill-hover)) calc(100% - var(--spatial-map-node-depth-fill-hover-lightness, 0%)), var(--spatial-map-depth-tint) var(--spatial-map-node-depth-fill-hover-lightness, 0%))",
    stroke: "color-mix(in srgb, var(--spatial-map-node-stroke-hover, var(--spatial-map-neutral-stroke-hover)) calc(100% - var(--spatial-map-node-depth-stroke-hover-lightness, 0%)), var(--spatial-map-depth-tint) var(--spatial-map-node-depth-stroke-hover-lightness, 0%))",
  },
  "& .spatial-map-node-status:hover .spatial-map-node-status-label-bg, & .spatial-map-node-status:hover .spatial-map-node-status-label": {
    opacity: "1",
  },
});

interface SpatialMapSceneProps {
  project: ProjectRecord;
  nodeColorMode: SpatialMapNodeColorMode;
  onNodeColorModeChange: (mode: SpatialMapNodeColorMode) => void;
  onProjectUpdated?: (project: ProjectRecord, options?: import("~/lib/projects/optimistic").ProjectUpdateOptions) => void;
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
  const submitMoveProjectNode = useAction(moveProjectNode);
  const reparentingNode = createMemo(() => {
    const nodeId = controller.reparentingNodeId();
    return nodeId ? controller.sourceNodesById().get(nodeId) ?? null : null;
  });
  const reparentDescendantIds = createMemo(() => {
    const nodeId = controller.reparentingNodeId();
    return nodeId ? getDescendantNodeIds(props.project.spatialMap, nodeId) : new Set<string>();
  });
  const invalidReparentParentIds = createMemo(() => {
    const nodeId = controller.reparentingNodeId();
    const invalidIds = new Set(reparentDescendantIds());
    if (nodeId) {
      invalidIds.add(nodeId);
    }
    return invalidIds;
  });
  const descendantCountsByNodeId = createMemo(() =>
    createDescendantCountMap(props.project.spatialMap),
  );
  const [movePending, setMovePending] = createSignal(false);

  const moveSelectedNode = async (parentNodeId: string | null) => {
    const nodeId = controller.reparentingNodeId();
    if (!nodeId || movePending()) {
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

    const clientMutationId = createClientMutationId();
    const previousProject = props.project;
    props.onProjectUpdated?.(
      moveProjectNodeOptimistically(props.project, nodeId, parentNodeId),
      { clientMutationId, phase: "optimistic" },
    );
    controller.clearReparentingNode();
    const formData = new FormData();
    formData.set("projectId", props.project.id);
    formData.set("nodeId", nodeId);
    formData.set("parentNodeId", parentNodeId ?? "");

    setMovePending(true);
    try {
      const result = await submitMoveProjectNode(appendClientMutationId(formData, clientMutationId));
      props.onProjectUpdated?.(result, { clientMutationId, phase: "server" });
      toaster.success({ title: "Node moved" });
    } catch (error) {
      props.onProjectUpdated?.(previousProject, { clientMutationId, phase: "failed" });
      toaster.error({
        title: "Node was not moved",
        description:
          error instanceof Error
            ? error.message
            : "The server action failed. Try again after the dev server reconnects.",
      });
    } finally {
      setMovePending(false);
    }
  };

  return (
    <Box
      ref={controller.setViewportRef}
      class={`spatial-map-viewport${controller.isPanning() ? " is-panning" : ""}`}
      position="relative"
      overflow="hidden"
      minH="0"
      background="var(--spatial-map-canvas)"
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
      {/* Canvas controls float in the corner as one compact bar of 24px controls. */}
      <Box
        position="absolute"
        top="8px"
        right="8px"
        zIndex="2"
        display="inline-flex"
        alignItems="center"
        flexWrap="wrap"
        justifyContent="flex-end"
        gap="6px"
        maxW="calc(100% - 16px)"
        p="3px 4px 3px 8px"
        border="1px solid var(--spatial-map-panel-border)"
        borderRadius="6px"
        background="var(--spatial-map-panel-strong)"
        cursor="default"
        pointerEvents="auto"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <Box
          as="span"
          color="var(--spatial-map-copy-dim)"
          fontSize="11px"
          fontVariantNumeric="tabular-nums"
          minW="34px"
          title="Zoom level"
        >
          {controller.zoomPercent()}
        </Box>
        <Button variant="outline" size="2xs" onClick={() => controller.fitCameraToNodes()}>
          Fit
        </Button>
        <CanvasToggle pressed={controller.showEdges()} onClick={() => controller.toggleEdges()}>
          Edges
        </CanvasToggle>
        <Show when={controller.isolationModeActive()}>
          <CanvasToggle
            pressed={controller.showLinkedInIsolation()}
            onClick={() => controller.toggleLinkedInIsolation()}
          >
            Linked
          </CanvasToggle>
        </Show>
        <Box as="span" color="var(--spatial-map-copy-dim)" fontSize="11px">
          Color
        </Box>
        <SpatialMapSegmentedControl
          ariaLabel="Node color mode"
          value={props.nodeColorMode}
          options={NODE_COLOR_MODE_OPTIONS}
          onChange={(mode) => props.onNodeColorModeChange(mode)}
        />
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
            "linear-gradient(var(--spatial-map-grid-major) 1px, transparent 1px), linear-gradient(90deg, var(--spatial-map-grid-major) 1px, transparent 1px), linear-gradient(var(--spatial-map-grid-minor) 1px, transparent 1px), linear-gradient(90deg, var(--spatial-map-grid-minor) 1px, transparent 1px), linear-gradient(180deg, var(--spatial-map-canvas-top), var(--spatial-map-canvas-bottom))",
          "background-size": "96px 96px, 96px 96px, 24px 24px, 24px 24px, auto",
          "background-position": "-1px -1px, -1px -1px, -1px -1px, -1px -1px, 0 0",
        }}
      >
        <g
          ref={(element) => {
            // The attribute binding caches the value it computed while
            // hydrating even though hydration skipped the write, so a camera
            // fit during hydration would never reach the DOM. Apply it from an
            // effect that runs after hydration instead.
            createEffect(() => element.setAttribute("transform", controller.sceneTransform()));
          }}
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
                  stroke="var(--spatial-map-edge)"
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
                  stroke="var(--spatial-map-edge-draft)"
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
                  descendantCount={descendantCountsByNodeId().get(item.node.id) ?? 0}
                  viewportScale={controller.viewportScale()}
                  onClick={(nodeId) => {
                    if (controller.reparentingNodeId()) {
                      void moveSelectedNode(nodeId);
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
                  }}
                  onPointerLeave={(nodeId) => {
                    controller.sceneHandlers.onNodePointerLeave(nodeId);
                  }}
                />
              )}
            </For>
          </g>
        </g>
      </svg>
      <Show when={controller.childNodeDraft()}>
        {(draft) => (
          <SpatialMapChildNodePlaceholder
            draft={draft()}
            parentNode={draftParentNode() ?? undefined}
            project={props.project}
            onProjectUpdated={props.onProjectUpdated}
          />
        )}
      </Show>
      <Show when={reparentingNode()}>
        <SpatialMapReparentControl
          data={props.project.spatialMap}
          invalidParentIds={invalidReparentParentIds()}
          movePending={movePending()}
          onMove={(parentNodeId) => {
            void moveSelectedNode(parentNodeId);
          }}
          onCancel={() => controller.clearReparentingNode()}
        />
      </Show>
    </Box>
  );
}

// An on/off control for the canvas bar: fill plus text weight when on.
function CanvasToggle(props: { pressed: boolean; onClick: () => void; children: JSX.Element }) {
  return (
    <Button
      variant="outline"
      size="2xs"
      background={props.pressed ? "var(--spatial-map-toggle-on)" : "transparent"}
      color={props.pressed ? "var(--spatial-map-accent-strong)" : "var(--spatial-map-copy-dim)"}
      fontWeight={props.pressed ? "700" : "500"}
      aria-pressed={props.pressed}
      onClick={() => props.onClick()}
    >
      {props.children}
    </Button>
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

function createDescendantCountMap(data: ProjectRecord["spatialMap"]) {
  const childrenByParent = new Map<string, string[]>();
  for (const link of data.links) {
    if (!link.parentChild) {
      continue;
    }
    childrenByParent.set(link.source, [
      ...(childrenByParent.get(link.source) ?? []),
      link.target,
    ]);
  }

  const counts = new Map<string, number>();
  const countDescendants = (nodeId: string, visited: Set<string>): number => {
    const cached = counts.get(nodeId);
    if (cached !== undefined) {
      return cached;
    }

    const childIds = childrenByParent.get(nodeId) ?? [];
    let count = 0;
    for (const childId of childIds) {
      if (visited.has(childId)) {
        continue;
      }
      visited.add(childId);
      count += 1 + countDescendants(childId, visited);
      visited.delete(childId);
    }

    counts.set(nodeId, count);
    return count;
  };

  for (const node of data.nodes) {
    countDescendants(node.id, new Set([node.id]));
  }

  return counts;
}

function SpatialMapNode(props: {
  item: NodeVisualState;
  project: ProjectRecord;
  colorMode: SpatialMapNodeColorMode;
  descendantCount: number;
  viewportScale: number;
  onClick: (nodeId: string) => void;
  onDoubleClick: (nodeId: string) => void;
  isIsolationTarget: boolean;
  onPointerDown: (nodeId: string) => void;
  onPointerEnter: (nodeId: string) => void;
  onPointerLeave: (nodeId: string) => void;
}) {
  const imageUi = useSpatialMapImages();
  const nodeTransform = createMemo(() => {
    const node = props.item.node;
    const scale = props.item.scale;

    return `translate(${node.x}, ${node.y}) scale(${scale}) translate(${-node.width / 2}, ${-node.height / 2})`;
  });
  const nodeImages = () => props.item.node.images ?? [];
  const firstImage = () => nodeImages()[0];
  const hasImages = () => nodeImages().length > 0;
  // Natural aspect of the preview image, known only after it loads in the browser.
  const [imageAspect, setImageAspect] = createSignal<{ src: string; aspect: number } | null>(null);
  const imageFrame = createMemo(() =>
    getNodeImageFrame({
      nodeWidth: props.item.node.width,
      nodeHeight: props.item.node.height,
      aspect: imageAspect()?.src === firstImage()?.src ? imageAspect()?.aspect : null,
      minTextHeight: getImageNodeMinTextHeight(props.item.node),
    }),
  );
  const hasSideImage = () => hasImages() && imageFrame().placement === "side";
  const hasTopImage = () => hasImages() && imageFrame().placement === "top";
  // A side image moves the label and type into the column to its right.
  const textLeft = () => (hasSideImage() ? imageFrame().x + imageFrame().width : 0);
  const textCenterX = () => (textLeft() + props.item.node.width) / 2;
  const readImageAspect = (element: HTMLImageElement, src: string) => {
    if (element.naturalWidth > 0 && element.naturalHeight > 0) {
      setImageAspect({ src, aspect: element.naturalWidth / element.naturalHeight });
    }
  };
  const fallbackTone = () =>
    getNodeTypeTone(props.project.nodeTypeSchema, props.item.node.type);
  const nodeTone = () =>
    props.colorMode === "status"
      ? themeTone(getNodeStatusTone(props.item.node.status))
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
    hasTopImage()
      ? imageFrame().y + imageFrame().height + NODE_LABEL_IMAGE_GAP
      : NODE_LABEL_TOP_PADDING;
  const labelMaxWidth = createMemo(() =>
    Math.max(24, props.item.node.width - textLeft() - NODE_LABEL_HORIZONTAL_PADDING * 2),
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
    const oneLineFontSize = Math.min(
      zoomAdjustedFontSize,
      availableLabelHeight() / NODE_LABEL_LINE_HEIGHT,
    );
    const oneLineCharacters = labelMaxWidth() / (oneLineFontSize * SVG_TEXT_WIDTH_FACTOR);
    if (props.item.node.label.length <= oneLineCharacters) {
      return oneLineFontSize;
    }

    // The label wraps to at least two lines, so size it for two lines instead
    // of letting the second line run into the type text below.
    return Math.min(oneLineFontSize, availableLabelHeight() / (NODE_LABEL_LINE_HEIGHT * 2));
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
      class={`spatial-map-node ${nodeInteractionClass} spatial-map-node--${props.item.node.type}${props.item.isSelected ? " is-selected" : ""}${props.item.isHovered ? " is-hovered" : ""}${props.item.hasUnexpandedChildren ? " has-unexpanded-children" : ""}${props.item.isManuallyExpanded ? " is-manually-expanded" : ""}${props.isIsolationTarget ? " is-isolated" : ""}`}
      data-node-id={props.item.node.id}
      transform={nodeTransform()}
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
        stroke-dasharray={props.item.isManuallyExpanded ? "9 6" : undefined}
        shape-rendering="crispEdges"
        fill={`color-mix(
          in srgb,
          var(--spatial-map-node-fill, var(--spatial-map-neutral-fill))
            calc(100% - var(--spatial-map-node-depth-fill-lightness, 0%)),
          var(--spatial-map-depth-tint) var(--spatial-map-node-depth-fill-lightness, 0%)
        )`}
        stroke={
          props.item.isSelected
            ? "var(--spatial-map-selected)"
            : props.isIsolationTarget
              ? "var(--spatial-map-isolation)"
              : `color-mix(
                  in srgb,
                  var(--spatial-map-node-stroke, var(--spatial-map-neutral-stroke))
                    calc(100% - var(--spatial-map-node-depth-stroke-lightness, 0%)),
                  var(--spatial-map-depth-tint) var(--spatial-map-node-depth-stroke-lightness, 0%)
                )`
        }
        style={{
          filter: "none",
          transition: "fill 120ms ease, stroke 120ms ease",
        }}
      />
      <Show when={props.item.hasUnexpandedChildren}>
        <rect
          class="spatial-map-node-expandable-border"
          x="5"
          y="5"
          width={props.item.node.width - 10}
          height={props.item.node.height - 10}
          rx="0"
          ry="0"
          fill="none"
          pointer-events="none"
          stroke="var(--spatial-map-accent-strong)"
          stroke-width="2.6"
          shape-rendering="crispEdges"
          style={{ filter: "none" }}
        />
      </Show>
      <Show when={firstImage()}>
        {(image) => (
          <foreignObject
            class="spatial-map-node-image-frame"
            x={imageFrame().x}
            y={imageFrame().y}
            width={imageFrame().width}
            height={imageFrame().height}
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
                border: "1px solid var(--spatial-map-image-border)",
                "border-radius": "0",
                background: "var(--spatial-map-image-bg)",
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
                ref={(element) => {
                  // A hydrated image can finish loading before onLoad is attached.
                  queueMicrotask(() => {
                    if (element.complete) readImageAspect(element, image().src);
                  });
                }}
                onLoad={(event) => readImageAspect(event.currentTarget, image().src)}
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
                    border: "1px solid var(--spatial-map-chip-border)",
                    background: "var(--spatial-map-chip-bg)",
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
        x={textCenterX()}
        y={labelStartY()}
        text-anchor="middle"
        font-size={String(labelFontSize())}
        fill="var(--spatial-map-node-ink)"
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
        <tspan x={textCenterX()} dy="0">
          {labelLineAt(0)}
        </tspan>
        <tspan x={textCenterX()} dy={labelLineHeight()}>
          {labelLineAt(1)}
        </tspan>
        <tspan x={textCenterX()} dy={labelLineHeight()}>
          {labelLineAt(2)}
        </tspan>
        <tspan x={textCenterX()} dy={labelLineHeight()}>
          {labelLineAt(3)}
        </tspan>
        <tspan x={textCenterX()} dy={labelLineHeight()}>
          {labelLineAt(4)}
        </tspan>
      </text>
      <text
        class="meta"
        x={textCenterX()}
        y={metaBaselineY()}
        text-anchor="middle"
        font-size={String(metaFontSize())}
        fill="var(--spatial-map-node-meta)"
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
      <Show when={props.descendantCount > 0}>
        <text
          class="spatial-map-node-descendant-count"
          x={props.item.node.width - NODE_DESCENDANT_COUNT_MARGIN}
          y={metaBaselineY()}
          text-anchor="end"
          font-size={String(metaFontSize())}
          fill="var(--spatial-map-node-count)"
          font-family={`"SFMono-Regular", "SF Mono", "Roboto Mono", "Consolas", monospace`}
          font-weight="800"
          letter-spacing="0"
          pointer-events="none"
          style={{
            transition: "fill 120ms ease, stroke 120ms ease",
            "user-select": "none",
          }}
        >
          {props.descendantCount}
        </text>
      </Show>
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
    "--spatial-map-status-fill": boxFill(tone.fill),
    "--spatial-map-status-stroke": boxLine(tone.stroke),
    "--spatial-map-status-copy": `color-mix(in srgb, ${copy} var(--spatial-map-ink-mix), var(--spatial-map-ink-base))`,
  };
}

function getNodeTypeTone(
  schema: ProjectRecord["nodeTypeSchema"],
  type: string,
) {
  const configured = getProjectNodeType(schema, type);
  return themeTone(getRawNodeTypeTone(schema, type), configured ? "box" : "tint");
}

function getRawNodeTypeTone(
  schema: ProjectRecord["nodeTypeSchema"],
  type: string,
): NodeTone {
  const configured = getProjectNodeType(schema, type);
  if (!configured) return getNodeTypeFallbackTone(type);

  return {
    fill: configured.color,
    fillHover: `color-mix(in srgb, ${configured.color} 86%, white)`,
    stroke: `color-mix(in srgb, ${configured.color} 68%, #202820)`,
    strokeHover: `color-mix(in srgb, ${configured.color} 50%, #121812)`,
  };
}

// Tones are authored for light mode. The theme variables pull fills toward the
// dark box base and lines toward a light ink, so one tone serves both themes.
// Configured type colors are saturated and keep more color than the pastel
// status and fallback tones.
function boxFill(color: string, mix: "box" | "tint" = "tint") {
  return `color-mix(in srgb, ${color} var(--spatial-map-${mix}-mix), var(--spatial-map-box-base))`;
}

function boxLine(color: string) {
  return `color-mix(in srgb, ${color} var(--spatial-map-line-mix), var(--spatial-map-line-base))`;
}

function themeTone(tone: NodeTone, mix: "box" | "tint" = "tint"): NodeTone {
  return {
    fill: boxFill(tone.fill, mix),
    fillHover: boxFill(tone.fillHover, mix),
    stroke: boxLine(tone.stroke),
    strokeHover: boxLine(tone.strokeHover),
  };
}

function getImageNodeMinTextHeight(node: { height: number; fontSize: number; metaSize: number }) {
  const bottomPadding = Math.max(NODE_LABEL_MIN_BOTTOM_PADDING, node.height * NODE_LABEL_BOTTOM_PADDING_RATIO);
  const labelHeight = 2 * node.fontSize * NODE_IMAGE_LABEL_MIN_SCALE * NODE_LABEL_LINE_HEIGHT;

  return NODE_LABEL_IMAGE_GAP + labelHeight + NODE_LABEL_META_GAP + node.metaSize + bottomPadding;
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
