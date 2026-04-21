import { For } from "solid-js";
import { Box } from "styled-system/jsx";

import type { NodeVisualState } from "./spatial-map-canvas.types";
import { useSpatialMap } from "./SpatialMapContext";

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
        viewBox={`${controller.camera().x} ${controller.camera().y} ${controller.camera().width} ${controller.camera().height}`}
        preserveAspectRatio="xMidYMid slice"
        onClick={controller.sceneHandlers.onBackgroundClick}
      >
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
                onPointerDown={controller.sceneHandlers.onNodePointerDown}
                onPointerEnter={controller.sceneHandlers.onNodePointerEnter}
                onPointerLeave={controller.sceneHandlers.onNodePointerLeave}
              />
            )}
          </For>
        </g>
      </svg>
    </Box>
  );
}

function SpatialMapNode(props: {
  item: NodeVisualState;
  onClick: (nodeId: string) => void;
  onPointerDown: (nodeId: string) => void;
  onPointerEnter: (nodeId: string) => void;
  onPointerLeave: (nodeId: string) => void;
}) {
  const x = () => props.item.node.x - props.item.node.width / 2;
  const y = () => props.item.node.y - props.item.node.height / 2;

  return (
    <g
      class={`spatial-map-node spatial-map-node--${props.item.node.type}${props.item.isSelected ? " is-selected" : ""}${props.item.isHovered ? " is-hovered" : ""}`}
      data-node-id={props.item.node.id}
      transform={`translate(${x()}, ${y()}) scale(${props.item.scale})`}
      opacity={props.item.opacity}
      style={{
        "transform-box": "fill-box",
        "transform-origin": "center",
        filter: props.item.filter,
        cursor: "pointer",
      }}
      onPointerDown={() => props.onPointerDown(props.item.node.id)}
      onClick={() => props.onClick(props.item.node.id)}
      onPointerEnter={() => props.onPointerEnter(props.item.node.id)}
      onPointerLeave={() => props.onPointerLeave(props.item.node.id)}
    >
      <rect width={props.item.node.width} height={props.item.node.height} />
      <text
        class="label"
        x={props.item.node.width / 2}
        y={props.item.node.height / 2 - 4}
        text-anchor="middle"
        dominant-baseline="middle"
        font-size={String(props.item.node.fontSize)}
      >
        {props.item.node.label}
      </text>
      <text
        class="meta"
        x={props.item.node.width / 2}
        y={props.item.node.height - 16}
        text-anchor="middle"
        font-size={String(props.item.node.metaSize)}
      >
        {props.item.node.type}
      </text>
      <g
        class="spatial-map-node-hover"
        transform={`translate(${props.item.node.width - 14}, 14)`}
      >
        <circle r="9" />
        <text text-anchor="middle" dominant-baseline="central">
          i
        </text>
      </g>
    </g>
  );
}
