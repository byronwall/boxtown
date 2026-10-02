import type { MapLink, PositionedMapNode } from "./types";

// Optional "Mahjong" overlap view. Each child is pulled part of the way toward
// its parent so the tiles stack, deeper tiles are drawn on top, and the scene
// draws a tile edge whose thickness grows with depth. The regular layout stays
// the source of truth; this only post-processes positions and draw order.

const PULL_TOWARD_PARENT = 0.3;
// Deeper tiles also sit slightly up and to the left, like a raised stack.
const LIFT_PER_LEVEL = 8;

export function applyDepthOverlap(nodes: PositionedMapNode[], links: MapLink[]): PositionedMapNode[] {
  const parentById = new Map<string, string>();
  for (const link of links) {
    if (link.parentChild) parentById.set(link.target, link.source);
  }
  const originalById = new Map(nodes.map((node) => [node.id, node]));
  const placedById = new Map<string, PositionedMapNode>();

  const place = (node: PositionedMapNode, visiting = new Set<string>()): PositionedMapNode => {
    const placed = placedById.get(node.id);
    if (placed) return placed;
    const parentId = parentById.get(node.id);
    const parent = parentId ? originalById.get(parentId) : undefined;
    if (!parent || visiting.has(node.id)) {
      placedById.set(node.id, node);
      return node;
    }
    visiting.add(node.id);
    const placedParent = place(parent, visiting);
    const next = {
      ...node,
      x: placedParent.x + (node.x - parent.x) * (1 - PULL_TOWARD_PARENT) - LIFT_PER_LEVEL,
      y: placedParent.y + (node.y - parent.y) * (1 - PULL_TOWARD_PARENT) - LIFT_PER_LEVEL,
    };
    placedById.set(node.id, next);
    return next;
  };

  return nodes
    .map((node) => place(node))
    .map((node, index) => ({ node, index }))
    .sort((left, right) => left.node.depth - right.node.depth || left.index - right.index)
    .map(({ node }) => node);
}

// Thickness of the tile edge drawn under a node in the overlap view.
export function getDepthOverlapEdge(depth: number) {
  return 4 + Math.min(depth, 6) * 2;
}
