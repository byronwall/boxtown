// Canvas image preview geometry inside a node. Node dimensions come from the
// layout and stay fixed; only the preview frame adapts to the image shape.
// Before the image loads (and during SSR) the frame uses the default top band,
// so first render is deterministic.
//
// Two placements are possible: "top" puts the image above the label, "side"
// puts it on the left with the label in the column to its right. The image
// shape picks whichever placement shows the larger preview, so tall or square
// images stop leaving empty bands beside them on wide nodes.

const FRAME_INSET = 8;
const DEFAULT_MAX_HEIGHT = 86;
const DEFAULT_HEIGHT_RATIO = 0.45;
// Tall images may take up to half the node so they read as more than a strip.
const TALL_HEIGHT_RATIO = 0.5;
// Extreme shapes are cropped to these ratios instead of shrinking to slivers.
const MIN_ASPECT = 0.6;
const MAX_ASPECT = 4;
const MIN_WIDE_HEIGHT_RATIO = 0.6;
// A side image leaves at least this share of the node width for the label.
const SIDE_MAX_WIDTH_RATIO = 0.45;
// Room kept below a side image for the status badge in the bottom-left corner.
const SIDE_BOTTOM_INSET = 28;
// Side placement must beat the top band by this factor, so near-ties keep the
// familiar top layout.
const SIDE_PREFERENCE = 1.25;

export type NodeImagePlacement = "top" | "side";

export interface NodeImageFrame {
  placement: NodeImagePlacement;
  x: number;
  y: number;
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
  if (!aspect) {
    return { placement: "top", x: FRAME_INSET, y: FRAME_INSET, width: maxWidth, height: defaultHeight };
  }

  const shape = Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, aspect));
  const top = getTopFrame(input, shape, maxWidth, defaultHeight);
  const side = getSideFrame(input, shape);
  return side && side.width * side.height > top.width * top.height * SIDE_PREFERENCE ? side : top;
}

function getTopFrame(
  input: { nodeWidth: number; nodeHeight: number },
  shape: number,
  maxWidth: number,
  defaultHeight: number,
): NodeImageFrame {
  const defaultShape = maxWidth / defaultHeight;
  if (shape >= defaultShape) {
    // Wide: full width, shorter band, which leaves more room for the label.
    const height = Math.max(defaultHeight * MIN_WIDE_HEIGHT_RATIO, maxWidth / shape);
    return { placement: "top", x: FRAME_INSET, y: FRAME_INSET, width: maxWidth, height: round(height) };
  }

  // Square or tall: grow the band up to the tall limit, then narrow the frame
  // to the image shape and center it.
  const height = Math.max(defaultHeight, Math.min(input.nodeHeight * TALL_HEIGHT_RATIO, maxWidth / shape));
  const width = Math.min(maxWidth, height * shape);
  return {
    placement: "top",
    x: round((input.nodeWidth - width) / 2),
    y: FRAME_INSET,
    width: round(width),
    height: round(height),
  };
}

function getSideFrame(input: { nodeWidth: number; nodeHeight: number }, shape: number): NodeImageFrame | null {
  const maxHeight = input.nodeHeight - FRAME_INSET - SIDE_BOTTOM_INSET;
  const maxWidth = input.nodeWidth * SIDE_MAX_WIDTH_RATIO - FRAME_INSET;
  if (maxHeight <= 0 || maxWidth <= 0) return null;

  // Fit the whole image in the left column, then center it vertically in the
  // space above the status badge.
  const width = Math.min(maxWidth, maxHeight * shape);
  const height = width / shape;
  return {
    placement: "side",
    x: FRAME_INSET,
    y: round(FRAME_INSET + (maxHeight - height) / 2),
    width: round(width),
    height: round(height),
  };
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}
