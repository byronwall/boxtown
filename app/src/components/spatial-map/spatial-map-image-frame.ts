// Canvas image preview geometry inside a node. Node dimensions come from the
// layout and stay fixed; only the preview frame adapts to the image shape.
// Before the image loads (and during SSR) the frame uses the default band, so
// first render is deterministic.

const FRAME_INSET = 8;
const DEFAULT_MAX_HEIGHT = 86;
const DEFAULT_HEIGHT_RATIO = 0.45;
// Tall images may take up to half the node so they read as more than a strip.
const TALL_HEIGHT_RATIO = 0.5;
// Extreme shapes are cropped to these ratios instead of shrinking to slivers.
const MIN_ASPECT = 0.6;
const MAX_ASPECT = 4;
const MIN_WIDE_HEIGHT_RATIO = 0.6;

export interface NodeImageFrame {
  x: number;
  width: number;
  height: number;
}

export function getNodeImageFrame(input: {
  nodeWidth: number;
  nodeHeight: number;
  aspect?: number | null;
}): NodeImageFrame {
  const maxWidth = Math.max(1, input.nodeWidth - FRAME_INSET * 2);
  const defaultHeight = Math.min(DEFAULT_MAX_HEIGHT, input.nodeHeight * DEFAULT_HEIGHT_RATIO);
  const aspect = input.aspect && Number.isFinite(input.aspect) && input.aspect > 0 ? input.aspect : null;
  if (!aspect) return { x: FRAME_INSET, width: maxWidth, height: defaultHeight };

  const shape = Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, aspect));
  const defaultShape = maxWidth / defaultHeight;
  if (shape >= defaultShape) {
    // Wide: full width, shorter band, which leaves more room for the label.
    const height = Math.max(defaultHeight * MIN_WIDE_HEIGHT_RATIO, maxWidth / shape);
    return { x: FRAME_INSET, width: maxWidth, height: round(height) };
  }

  // Square or tall: grow the band up to the tall limit, then narrow the frame
  // to the image shape and center it.
  const height = Math.max(defaultHeight, Math.min(input.nodeHeight * TALL_HEIGHT_RATIO, maxWidth / shape));
  const width = Math.min(maxWidth, height * shape);
  return { x: round((input.nodeWidth - width) / 2), width: round(width), height: round(height) };
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}
