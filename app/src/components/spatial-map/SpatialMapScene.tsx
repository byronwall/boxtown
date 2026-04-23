import { For } from "solid-js";
import { Box } from "styled-system/jsx";
import { VIEWPORT_HEIGHT, VIEWPORT_WIDTH } from "~/lib/spatial-map/layout";

import type { NodeVisualState } from "./spatial-map-canvas.types";
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
const NODE_LABEL_META_GAP = 16;
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
      <svg
        ref={controller.setSvgRef}
        class="spatial-map-scene"
        viewBox={`0 0 ${VIEWPORT_WIDTH} ${VIEWPORT_HEIGHT}`}
        preserveAspectRatio="none"
        onClick={controller.sceneHandlers.onBackgroundClick}
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
                  zoomScale={VIEWPORT_WIDTH / controller.camera().width}
                  onClick={controller.sceneHandlers.onNodeClick}
                  onIsolateClick={controller.sceneHandlers.onNodeIsolateClick}
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
  zoomScale: number;
  onClick: (nodeId: string) => void;
  onIsolateClick: (nodeId: string) => void;
  isIsolationTarget: boolean;
  onPointerDown: (nodeId: string) => void;
  onPointerEnter: (nodeId: string) => void;
  onPointerLeave: (nodeId: string) => void;
}) {
  const x = () => props.item.node.x - props.item.node.width / 2;
  const y = () => props.item.node.y - props.item.node.height / 2;
  const fallbackTone = () => getNodeTypeFallbackTone(props.item.node.type);
  const zoomTextCompression = () => Math.max(1, Math.min(2.75, Math.sqrt(props.zoomScale)));
  const availableLabelHeight = () =>
    Math.max(1, props.item.node.height - NODE_LABEL_TOP_PADDING - NODE_LABEL_META_GAP);
  const labelFontSize = () =>
    Math.min(
      props.item.node.fontSize / zoomTextCompression(),
      availableLabelHeight() / (2 * NODE_LABEL_LINE_HEIGHT),
    );
  const metaFontSize = () => props.item.node.metaSize / zoomTextCompression();
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
  const labelBlockHeight = () => labelLines().length * labelLineHeight();
  const labelStartY = () =>
    Math.max(
      NODE_LABEL_TOP_PADDING + labelFontSize(),
      (props.item.node.height - NODE_LABEL_META_GAP - labelBlockHeight()) / 2 +
        labelFontSize() * 0.78,
    );

  return (
    <g
      class={`spatial-map-node spatial-map-node--${props.item.node.type}${props.item.isSelected ? " is-selected" : ""}${props.item.isHovered ? " is-hovered" : ""}`}
      data-node-id={props.item.node.id}
      transform={`translate(${x()}, ${y()}) scale(${props.item.scale})`}
      opacity={props.item.opacity}
      style={{
        "transform-box": "fill-box",
        "transform-origin": "center",
        cursor: "pointer",
        "--spatial-map-node-fill": fallbackTone().fill,
        "--spatial-map-node-fill-hover": fallbackTone().fillHover,
        "--spatial-map-node-stroke": fallbackTone().stroke,
        "--spatial-map-node-stroke-hover": fallbackTone().strokeHover,
      }}
      onPointerDown={() => props.onPointerDown(props.item.node.id)}
      onClick={() => props.onClick(props.item.node.id)}
      onPointerEnter={() => props.onPointerEnter(props.item.node.id)}
      onPointerLeave={() => props.onPointerLeave(props.item.node.id)}
    >
      <rect
        class="spatial-map-node-body"
        width={props.item.node.width}
        height={props.item.node.height}
      />
      <text
        class="label"
        x={props.item.node.width / 2}
        y={labelStartY()}
        text-anchor="middle"
        font-size={String(labelFontSize())}
      >
        <For each={labelLines()}>
          {(line, index) => (
            <tspan x={props.item.node.width / 2} dy={index() === 0 ? 0 : labelLineHeight()}>
              {line}
            </tspan>
          )}
        </For>
      </text>
      <text
        class="meta"
        x={props.item.node.width / 2}
        y={props.item.node.height - 16}
        text-anchor="middle"
        font-size={String(metaFontSize())}
      >
        {props.item.node.type}
      </text>
      <g
        class="spatial-map-node-actions"
        transform={`translate(${props.item.node.width - 18}, 18)`}
      >
        <g
          class={`spatial-map-node-action${props.isIsolationTarget ? " is-active" : ""}`}
          role="button"
          tabindex="0"
          aria-label={props.isIsolationTarget ? "Isolation active" : "Isolate related nodes"}
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.stopPropagation();
            props.onIsolateClick(props.item.node.id);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              event.stopPropagation();
              props.onIsolateClick(props.item.node.id);
            }
          }}
        >
          <rect
            class="spatial-map-node-action-body"
            x="-16"
            y="-10"
            width="32"
            height="20"
            rx="0"
            ry="0"
          />
          <text text-anchor="middle" dominant-baseline="central">
            {props.isIsolationTarget ? "ON" : "ISO"}
          </text>
        </g>
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
