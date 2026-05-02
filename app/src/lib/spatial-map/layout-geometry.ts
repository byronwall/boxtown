import type { PositionedMapNode } from "./types";

export function getLayoutBounds(nodes: PositionedMapNode[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    minX = Math.min(minX, node.x - node.width / 2);
    minY = Math.min(minY, node.y - node.height / 2);
    maxX = Math.max(maxX, node.x + node.width / 2);
    maxY = Math.max(maxY, node.y + node.height / 2);
  }

  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

export function rectanglesOverlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
) {
  return getAxisOverlap(ax, aw, bx, bw) > 0 && getAxisOverlap(ay, ah, by, bh) > 0;
}

export function getAxisOverlap(
  aCenter: number,
  aSize: number,
  bCenter: number,
  bSize: number,
) {
  return (aSize + bSize) / 2 - Math.abs(aCenter - bCenter);
}
