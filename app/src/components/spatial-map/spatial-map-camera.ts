import { VIEWPORT_HEIGHT, VIEWPORT_WIDTH } from "~/lib/spatial-map/layout";
import type { PositionedMapNode } from "~/lib/spatial-map/types";

import type { CameraState } from "./spatial-map-canvas.types";

const FIT_PADDING = 56;
const MIN_BOUNDS_WIDTH = 320;
const MIN_BOUNDS_HEIGHT = 240;

export function createDefaultCamera(): CameraState {
  return {
    x: 0,
    y: 0,
    width: VIEWPORT_WIDTH,
    height: VIEWPORT_HEIGHT,
  };
}

export function getFitCamera(
  nodes: PositionedMapNode[],
  aspectRatio: number,
): CameraState {
  if (nodes.length === 0) {
    return createDefaultCamera();
  }

  const minX = Math.min(...nodes.map((node) => node.x - node.width / 2));
  const maxX = Math.max(...nodes.map((node) => node.x + node.width / 2));
  const minY = Math.min(...nodes.map((node) => node.y - node.height / 2));
  const maxY = Math.max(...nodes.map((node) => node.y + node.height / 2));
  const boundsWidth = Math.max(maxX - minX + FIT_PADDING * 2, MIN_BOUNDS_WIDTH);
  const boundsHeight = Math.max(maxY - minY + FIT_PADDING * 2, MIN_BOUNDS_HEIGHT);
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

export function preserveCameraCenter(
  camera: CameraState,
  aspectRatio: number,
): CameraState {
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

export function clampValue(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
