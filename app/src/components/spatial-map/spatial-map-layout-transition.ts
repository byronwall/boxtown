import {
  VIEWPORT_CENTER_X,
  VIEWPORT_CENTER_Y,
} from "~/lib/spatial-map/layout";
import type { PositionedMapNode } from "~/lib/spatial-map/types";

import type { CameraState } from "./spatial-map-canvas.types";

export const LAYOUT_TRANSITION_DURATION_MS = 520;
export const LAYOUT_TRANSITION_ENTER_SCALE = 0.76;
export const LAYOUT_TRANSITION_EXIT_SCALE = 0.82;

export interface LayoutTransitionAnchor {
  x: number;
  y: number;
}

export interface LayoutTransitionItem {
  startNode: PositionedMapNode;
  endNode: PositionedMapNode;
  startOpacity: number;
  endOpacity: number;
  startScale: number;
  endScale: number;
}

export function getLayoutTransitionAnchor(options: {
  anchorNodeId: string | null;
  previousLayout: PositionedMapNode[];
  nextLayout: PositionedMapNode[];
}): LayoutTransitionAnchor {
  const startNodesById = new Map(options.previousLayout.map((node) => [node.id, node]));
  const endNodesById = new Map(options.nextLayout.map((node) => [node.id, node]));
  const anchorNode =
    (options.anchorNodeId
      ? startNodesById.get(options.anchorNodeId) ?? endNodesById.get(options.anchorNodeId)
      : undefined) ??
    options.previousLayout[0] ??
    options.nextLayout[0];

  return {
    x: anchorNode?.x ?? VIEWPORT_CENTER_X,
    y: anchorNode?.y ?? VIEWPORT_CENTER_Y,
  };
}

export function createLayoutTransitionItems(
  previousLayout: PositionedMapNode[],
  nextLayout: PositionedMapNode[],
  anchorPosition: LayoutTransitionAnchor,
): LayoutTransitionItem[] {
  const previousById = new Map(previousLayout.map((node) => [node.id, node]));
  const nextById = new Map(nextLayout.map((node) => [node.id, node]));
  const ids = new Set([...previousById.keys(), ...nextById.keys()]);
  const items: LayoutTransitionItem[] = [];

  for (const id of ids) {
    const previousNode = previousById.get(id);
    const nextNode = nextById.get(id);

    if (previousNode && nextNode) {
      items.push({
        startNode: previousNode,
        endNode: nextNode,
        startOpacity: 1,
        endOpacity: 1,
        startScale: 1,
        endScale: 1,
      });
      continue;
    }

    if (nextNode) {
      items.push({
        startNode: {
          ...nextNode,
          x: anchorPosition.x,
          y: anchorPosition.y,
          vx: 0,
          vy: 0,
        },
        endNode: nextNode,
        startOpacity: 0,
        endOpacity: 1,
        startScale: LAYOUT_TRANSITION_ENTER_SCALE,
        endScale: 1,
      });
      continue;
    }

    if (previousNode) {
      items.push({
        startNode: previousNode,
        endNode: {
          ...previousNode,
          x: anchorPosition.x,
          y: anchorPosition.y,
          vx: 0,
          vy: 0,
        },
        startOpacity: 1,
        endOpacity: 0,
        startScale: 1,
        endScale: LAYOUT_TRANSITION_EXIT_SCALE,
      });
    }
  }

  return items;
}

export function hasLayoutTransitionWork(
  previousLayout: PositionedMapNode[],
  nextLayout: PositionedMapNode[],
) {
  if (previousLayout.length !== nextLayout.length) {
    return true;
  }

  const previousById = new Map(previousLayout.map((node) => [node.id, node]));

  return nextLayout.some((nextNode) => {
    const previousNode = previousById.get(nextNode.id);

    return (
      !previousNode ||
      previousNode.x !== nextNode.x ||
      previousNode.y !== nextNode.y ||
      previousNode.width !== nextNode.width ||
      previousNode.height !== nextNode.height
    );
  });
}

export function interpolatePositionedNode(
  startNode: PositionedMapNode,
  endNode: PositionedMapNode,
  progress: number,
): PositionedMapNode {
  return {
    ...endNode,
    x: interpolateNumber(startNode.x, endNode.x, progress),
    y: interpolateNumber(startNode.y, endNode.y, progress),
    width: interpolateNumber(startNode.width, endNode.width, progress),
    height: interpolateNumber(startNode.height, endNode.height, progress),
    fontSize: interpolateNumber(startNode.fontSize, endNode.fontSize, progress),
    metaSize: interpolateNumber(startNode.metaSize, endNode.metaSize, progress),
    vx: 0,
    vy: 0,
  };
}

export function interpolateCamera(
  startCamera: CameraState,
  targetCamera: CameraState,
  progress: number,
): CameraState {
  return {
    x: interpolateNumber(startCamera.x, targetCamera.x, progress),
    y: interpolateNumber(startCamera.y, targetCamera.y, progress),
    width: interpolateNumber(startCamera.width, targetCamera.width, progress),
    height: interpolateNumber(startCamera.height, targetCamera.height, progress),
  };
}

export function interpolateNumber(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}

export function easeInOutCubic(progress: number) {
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;
}
