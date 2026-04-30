import { useSubmission } from "@solidjs/router";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { Box } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { toaster } from "~/components/ui/toast";
import { createProjectChildNode, moveProjectNode } from "~/lib/projects/data";
import { getProjectNodeType } from "~/lib/projects/node-types";
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
const NODE_STATUS_BADGE_SIZE = 17;
const NODE_STATUS_BADGE_MARGIN = 6;
const NODE_STATUS_LABEL_GAP = 5;
const NODE_STATUS_LABEL_WIDTH_FACTOR = 6.2;

interface SpatialMapSceneProps {
  project: ProjectRecord;
  nodeColorMode: SpatialMapNodeColorMode;
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
  let moveFormRef: HTMLFormElement | undefined;
  let moveNodeIdInputRef: HTMLInputElement | undefined;
  let moveParentNodeIdInputRef: HTMLInputElement | undefined;

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
      onPointerDown={controller.viewportHandlers.onPointerDown}
      onPointerMove={controller.viewportHandlers.onPointerMove}
      onPointerUp={controller.viewportHandlers.onPointerUp}
      onPointerLeave={controller.viewportHandlers.onPointerLeave}
      onPointerCancel={controller.viewportHandlers.onPointerCancel}
      onWheel={controller.viewportHandlers.onWheel}
    >
      <Box class="spatial-map-viewport-controls">
        <Box as="span" class="spatial-map-zoom-readout">
          Zoom {controller.zoomPercent()}
        </Box>
        <Button
          colorPalette="green"
          variant="plain"
          size="xs"
          class="spatial-map-button spatial-map-viewport-button"
          onClick={() => controller.fitCameraToNodes()}
        >
          Fit View
        </Button>
      </Box>
      <svg
        ref={controller.setSvgRef}
        class={`spatial-map-scene spatial-map-scene--color-${props.nodeColorMode}`}
        viewBox={`0 0 ${VIEWPORT_WIDTH} ${VIEWPORT_HEIGHT}`}
        preserveAspectRatio="none"
        onClick={controller.sceneHandlers.onBackgroundClick}
        onDblClick={controller.sceneHandlers.onBackgroundDoubleClick}
      >
        <g class="spatial-map-scene-layer" transform={controller.sceneTransform()}>
          <g>
            <For each={controller.edgeState()}>
              {(edge) => (
                <path
                  class="spatial-map-edge"
                  d={edge.path}
                  opacity={edge.opacity}
                />
              )}
            </For>
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
                  onPointerEnter={controller.sceneHandlers.onNodePointerEnter}
                  onPointerLeave={controller.sceneHandlers.onNodePointerLeave}
                />
              )}
            </For>
          </g>
        </g>
      </svg>
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
          <div class="spatial-map-reparent-message" onPointerDown={(event) => event.stopPropagation()}>
            <div class="spatial-map-reparent-copy">
              Click the new parent node for {node().label}.
            </div>
            <div class="spatial-map-reparent-actions">
              <Button
                colorPalette="green"
                variant="plain"
                size="xs"
                class="spatial-map-button spatial-map-viewport-button"
                loading={moveSubmission.pending}
                onClick={() => moveSelectedNode(null)}
              >
                Move to root
              </Button>
              <Button
                variant="plain"
                size="xs"
                class="spatial-map-button spatial-map-viewport-button"
                disabled={moveSubmission.pending}
                onClick={() => controller.clearReparentingNode()}
              >
                Cancel
              </Button>
            </div>
          </div>
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
  let formRef: HTMLFormElement | undefined;
  let textareaRef: HTMLTextAreaElement | undefined;

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

  const applyOptimisticChild = (nextTitle: string) => {
    const nodeId = createUniqueNodeId(
      nextTitle,
      props.parentNode?.type ?? "page",
      new Set(props.project.spatialMap.nodes.map((node) => node.id)),
    );
    const nodeType = props.parentNode?.type ?? "page";

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
            type: nodeType,
            status: DEFAULT_MAP_NODE_STATUS,
            metadata: {},
            context: "",
            rawContext: "",
            contextMode: props.parentNode?.contextMode ?? "structured",
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
    <form
      ref={formRef}
      class="spatial-map-node-placeholder"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      style={overlayStyle()}
      action={normalizeActionUrl(createProjectChildNode.url)}
      method="post"
      onSubmit={(event) => {
        const nextTitle = title().trim();
        if (!nextTitle) {
          event.preventDefault();
          return;
        }

        applyOptimisticChild(nextTitle);
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
      <div class="spatial-map-node-placeholder-header">
        {props.parentNode ? "New child node" : "New node"}
      </div>
      <input type="hidden" name="projectId" value={props.project.id} />
      <Show when={props.parentNode}>
        {(parentNode) => (
          <input type="hidden" name="parentNodeId" value={parentNode().id} />
        )}
      </Show>
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
      <div class="spatial-map-node-placeholder-actions">
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
      </div>
    </form>
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
  const imageHeight = () => (hasImages() ? Math.min(54, props.item.node.height * 0.38) : 0);
  const fallbackTone = () =>
    getNodeTypeTone(props.project.nodeTypeSchema, props.item.node.type);
  const nodeTone = () =>
    props.colorMode === "status"
      ? getNodeStatusTone(props.item.node.status)
      : fallbackTone();
  const textScale = () => Math.min(1, 1 / Math.max(props.viewportScale, 0.1));
  const metaFontSize = () => props.item.node.metaSize * textScale();
  const metaBaselineY = () =>
    props.item.node.height -
    Math.max(NODE_LABEL_MIN_BOTTOM_PADDING, props.item.node.height * NODE_LABEL_BOTTOM_PADDING_RATIO);
  const labelAreaTop = () =>
    hasImages() ? NODE_LABEL_TOP_PADDING + imageHeight() + NODE_LABEL_IMAGE_GAP : NODE_LABEL_TOP_PADDING;
  const labelAreaBottom = () => Math.max(labelAreaTop() + 1, metaBaselineY() - metaFontSize() - NODE_LABEL_META_GAP);
  const availableLabelHeight = () =>
    Math.max(1, labelAreaBottom() - labelAreaTop());
  const labelFontSize = () => {
    const zoomAdjustedFontSize = props.item.node.fontSize * textScale();

    return Math.min(
      zoomAdjustedFontSize,
      availableLabelHeight() / NODE_LABEL_LINE_HEIGHT,
    );
  };
  const labelLineHeight = () => Math.ceil(labelFontSize() * NODE_LABEL_LINE_HEIGHT);
  const labelLines = () =>
    wrapSvgText({
      maxLines: Math.max(
        2,
        Math.min(
          5,
          Math.floor(availableLabelHeight() / labelLineHeight()),
        ),
      ),
      maxWidth: Math.max(24, props.item.node.width - NODE_LABEL_HORIZONTAL_PADDING * 2),
      text: props.item.node.label,
      textWidth: labelFontSize() * SVG_TEXT_WIDTH_FACTOR,
    });
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
      class={`spatial-map-node spatial-map-node--${props.item.node.type}${props.item.isSelected ? " is-selected" : ""}${props.item.isHovered ? " is-hovered" : ""}${props.isIsolationTarget ? " is-isolated" : ""}`}
      data-node-id={props.item.node.id}
      transform={`translate(${x()}, ${y()})`}
      opacity={props.item.opacity}
      style={{
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
              aria-label={`Open ${image().originalName}`}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                imageUi.openImage(image(), props.item.node, nodeImages());
              }}
            >
              <img src={image().src} alt={image().originalName} loading="lazy" />
              <Show when={nodeImages().length > 1}>
                <span>{nodeImages().length}</span>
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
      >
        {props.item.node.type}
      </text>
      <g
        class={`spatial-map-node-status spatial-map-node-status--${props.item.node.status}`}
        transform={`translate(${NODE_STATUS_BADGE_MARGIN}, ${props.item.node.height - NODE_STATUS_BADGE_MARGIN - NODE_STATUS_BADGE_SIZE})`}
        aria-label={`Status: ${statusLabel()}`}
      >
        <rect
          class="spatial-map-node-status-hit-area"
          x="0"
          y="0"
          width={NODE_STATUS_BADGE_SIZE}
          height={NODE_STATUS_BADGE_SIZE}
        />
        <rect
          class="spatial-map-node-status-label-bg"
          x={NODE_STATUS_BADGE_SIZE + NODE_STATUS_LABEL_GAP - 1}
          y="0"
          width={statusLabelWidth()}
          height={NODE_STATUS_BADGE_SIZE}
        />
        <circle
          class="spatial-map-node-status-dot"
          cx={NODE_STATUS_BADGE_SIZE / 2}
          cy={NODE_STATUS_BADGE_SIZE / 2}
          r={NODE_STATUS_BADGE_SIZE / 2 - 1}
        />
        <text
          class="spatial-map-node-status-glyph"
          x={NODE_STATUS_BADGE_SIZE / 2}
          y={NODE_STATUS_BADGE_SIZE / 2 + 3.5}
          text-anchor="middle"
        >
          {getMapNodeStatusGlyph(props.item.node.status)}
        </text>
        <text
          class="spatial-map-node-status-label"
          x={NODE_STATUS_BADGE_SIZE + NODE_STATUS_LABEL_GAP + 6}
          y={NODE_STATUS_BADGE_SIZE / 2 + 3.5}
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
  maxLines: number;
  maxWidth: number;
  text: string;
  textWidth: number;
}) {
  const maxCharacters = Math.max(1, Math.floor(options.maxWidth / options.textWidth));
  const words = options.text.trim().replace(/\s+/g, " ").split(" ");
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

  return clampSvgTextLines(lines, options.maxLines, maxCharacters);
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
