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

// The URL keeps the camera as its world-space center and width. Height follows
// the viewport aspect ratio on restore, so a different window size keeps the
// same focus and zoom.
export interface CameraView {
  centerX: number;
  centerY: number;
  width: number;
}

// Matches the manual zoom-in limit. Fit can be wider than the zoom-out limit
// on large maps, so the upper bound only rejects absurd values.
export const MIN_CAMERA_WIDTH = 220;
const MAX_CAMERA_COORDINATE = 1_000_000;

export function formatCameraParam(camera: CameraState) {
  const round = (value: number) => Math.round(value * 10) / 10;
  return [
    round(camera.x + camera.width / 2),
    round(camera.y + camera.height / 2),
    round(camera.width),
  ].join(",");
}

export function parseCameraParam(value: string | undefined): CameraView | null {
  if (!value) return null;
  const parts = value.split(",");
  if (parts.length !== 3 || parts.some((part) => part.trim() === "")) return null;
  const [centerX, centerY, width] = parts.map(Number);
  if (![centerX, centerY, width].every(Number.isFinite)) return null;
  if (Math.abs(centerX) > MAX_CAMERA_COORDINATE || Math.abs(centerY) > MAX_CAMERA_COORDINATE) return null;
  if (width < MIN_CAMERA_WIDTH || width > MAX_CAMERA_COORDINATE) return null;
  return { centerX, centerY, width };
}

export function getCameraFromView(view: CameraView, aspectRatio: number): CameraState {
  const safeAspect = Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : VIEWPORT_WIDTH / VIEWPORT_HEIGHT;
  const height = view.width / safeAspect;
  return {
    x: view.centerX - view.width / 2,
    y: view.centerY - height / 2,
    width: view.width,
    height,
  };
}
