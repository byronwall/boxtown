import { For, Show } from "solid-js";
import { Box } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { VIEWPORT_HEIGHT, VIEWPORT_WIDTH } from "~/lib/spatial-map/layout";

import type { NodeVisualState } from "./spatial-map-canvas.types";
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

const NODE_LABEL_HORIZONTAL_PADDING = 8;
const NODE_LABEL_TOP_PADDING = 7;
const NODE_LABEL_IMAGE_GAP = 10;
const NODE_LABEL_META_GAP = 8;
const NODE_LABEL_BOTTOM_PADDING = 16;
const NODE_LABEL_LINE_HEIGHT = 1.08;
const SVG_TEXT_WIDTH_FACTOR = 0.58;

export function SpatialMapScene() {
  const controller = useSpatialMap();

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
        class="spatial-map-scene"
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
                  onClick={controller.sceneHandlers.onNodeClick}
                  onDoubleClick={controller.sceneHandlers.onNodeDoubleClick}
                  isIsolationTarget={controller.isolatedNodeId() === item.node.id}
                  onPointerDown={controller.sceneHandlers.onNodePointerDown}
                  onPointerEnter={controller.sceneHandlers.onNodePointerEnter}
                  onPointerLeave={controller.sceneHandlers.onNodePointerLeave}
                />
              )}
            </For>
          </g>
        </g>
      </svg>
    </Box>
  );
}

function SpatialMapNode(props: {
  item: NodeVisualState;
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
  const fallbackTone = () => getNodeTypeFallbackTone(props.item.node.type);
  const metaFontSize = () => props.item.node.metaSize;
  const metaBaselineY = () => props.item.node.height - NODE_LABEL_BOTTOM_PADDING;
  const labelAreaTop = () =>
    hasImages() ? NODE_LABEL_TOP_PADDING + imageHeight() + NODE_LABEL_IMAGE_GAP : NODE_LABEL_TOP_PADDING;
  const labelAreaBottom = () => Math.max(labelAreaTop() + 1, metaBaselineY() - metaFontSize() - NODE_LABEL_META_GAP);
  const availableLabelHeight = () =>
    Math.max(1, labelAreaBottom() - labelAreaTop());
  const labelFontSize = () =>
    Math.min(
      props.item.node.fontSize,
      availableLabelHeight() / NODE_LABEL_LINE_HEIGHT,
    );
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
        "--spatial-map-node-fill": fallbackTone().fill,
        "--spatial-map-node-fill-hover": fallbackTone().fillHover,
        "--spatial-map-node-stroke": fallbackTone().stroke,
        "--spatial-map-node-stroke-hover": fallbackTone().strokeHover,
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
