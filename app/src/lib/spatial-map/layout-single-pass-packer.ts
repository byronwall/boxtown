import type { AdjacencyMap } from "./layout";
import { SpatialCollisionIndex } from "./layout-collision-index";
import { finalizePackedLayout } from "./layout-finalize";
import { getLayoutBounds, rectanglesOverlap } from "./layout-geometry";
import type { PositionedMapNode } from "./types";

type HierarchyIndex = {
  childrenByParentId: Map<string, Set<string>>;
  parentsByChildId: Map<string, Set<string>>;
};

type PackingOptions = {
  centerX: number;
  centerY: number;
  desiredAspect: number;
};

type PlacementCandidate = {
  x: number;
  y: number;
  slot: number;
  preferenceRank: number;
};

const PACKING_GAP = 2;

export function packUnboundedLayout(
  nodes: PositionedMapNode[],
  adjacency: AdjacencyMap,
  hierarchy: HierarchyIndex,
  options: PackingOptions,
): PositionedMapNode[] {
  const inputIndexById = new Map(nodes.map((node, index) => [node.id, index]));
  const nextNodes = nodes.map((node) => ({ ...node, vx: 0, vy: 0 }));
  const remaining = new Set(nextNodes.map((node) => node.id));
  const placedNodes: PositionedMapNode[] = [];
  const placedById = new Map<string, PositionedMapNode>();
  const collisionIndex = new SpatialCollisionIndex();

  while (remaining.size > 0) {
    const node = chooseNextNode(
      nextNodes,
      remaining,
      placedById,
      adjacency,
      hierarchy,
      inputIndexById,
    );
    const position = findPackedNodePosition(
      node,
      placedNodes,
      placedById,
      adjacency,
      hierarchy,
      inputIndexById,
      collisionIndex,
      options,
    );

    node.x = position.x;
    node.y = position.y;
    remaining.delete(node.id);
    placedNodes.push(node);
    placedById.set(node.id, node);
    collisionIndex.insert(node);
  }

  return recenterUnboundedLayout(
    finalizePackedLayout(
      recenterUnboundedLayout(nextNodes, options),
      options.desiredAspect,
    ),
    options,
  );
}

function chooseNextNode(
  nodes: PositionedMapNode[],
  remaining: Set<string>,
  placedById: Map<string, PositionedMapNode>,
  adjacency: AdjacencyMap,
  hierarchy: HierarchyIndex,
  inputIndexById: Map<string, number>,
) {
  const candidates = nodes.filter((node) => remaining.has(node.id));
  const nextNode = candidates.sort((left, right) => {
    const priorityDiff =
      getPlacementPriority(right, placedById, adjacency, hierarchy) -
      getPlacementPriority(left, placedById, adjacency, hierarchy);
    if (priorityDiff !== 0) return priorityDiff;

    const siblingDiff =
      getSiblingOrdinal(left, hierarchy, inputIndexById) -
      getSiblingOrdinal(right, hierarchy, inputIndexById);
    if (siblingDiff !== 0) return siblingDiff;

    const areaDiff = right.width * right.height - left.width * left.height;
    if (areaDiff !== 0) return areaDiff;

    return (inputIndexById.get(left.id) ?? 0) - (inputIndexById.get(right.id) ?? 0);
  })[0];

  if (!nextNode) {
    throw new Error("Unable to choose the next spatial map node to place.");
  }

  return nextNode;
}

function getPlacementPriority(
  node: PositionedMapNode,
  placedById: Map<string, PositionedMapNode>,
  adjacency: AdjacencyMap,
  hierarchy: HierarchyIndex,
) {
  const placedParentCount = [...(hierarchy.parentsByChildId.get(node.id) ?? [])].filter(
    (parentId) => placedById.has(parentId),
  ).length;
  const placedNeighborCount = [...(adjacency.get(node.id) ?? [])].filter((neighborId) =>
    placedById.has(neighborId),
  ).length;
  const rootBonus =
    placedById.size === 0 && !hierarchy.parentsByChildId.has(node.id) ? 1 : 0;

  return (
    rootBonus * 1_000_000 +
    placedParentCount * 180_000 +
    placedNeighborCount * 45_000 +
    (100 - node.depth) * 1_000 +
    (adjacency.get(node.id)?.size ?? 0) * 120
  );
}

function findPackedNodePosition(
  node: PositionedMapNode,
  placedNodes: PositionedMapNode[],
  placedById: Map<string, PositionedMapNode>,
  adjacency: AdjacencyMap,
  hierarchy: HierarchyIndex,
  inputIndexById: Map<string, number>,
  collisionIndex: SpatialCollisionIndex,
  options: PackingOptions,
) {
  if (placedNodes.length === 0) {
    return { x: options.centerX, y: options.centerY };
  }

  const parent = getPrimaryPlacedParent(node, placedById, hierarchy);
  const connectedPlacedNodes = getConnectedPlacedNodes(node, adjacency, placedById);
  const target = getSinglePassTarget(node, parent, connectedPlacedNodes);
  const candidates = getSinglePassCandidates(
    node,
    placedNodes,
    parent,
    connectedPlacedNodes,
    hierarchy,
    inputIndexById,
    options.desiredAspect,
  );
  let bestCandidate: { x: number; y: number; score: number } | null = null;

  for (const candidate of candidates) {
    if (wouldOverlapAtPosition(placedNodes, node, candidate, collisionIndex)) {
      continue;
    }

    const score = scoreSinglePassCandidate(
      node,
      candidate,
      target,
      parent,
      connectedPlacedNodes,
      placedNodes,
      options.desiredAspect,
    );
    if (!bestCandidate || score < bestCandidate.score) {
      bestCandidate = { x: candidate.x, y: candidate.y, score };
    }
  }

  return bestCandidate ?? findOpenRadialPosition(node, target, placedNodes, collisionIndex);
}

function getPrimaryPlacedParent(
  node: PositionedMapNode,
  placedById: Map<string, PositionedMapNode>,
  hierarchy: HierarchyIndex,
) {
  return [...(hierarchy.parentsByChildId.get(node.id) ?? [])]
    .map((id) => placedById.get(id))
    .filter((item): item is PositionedMapNode => Boolean(item))
    .sort((left, right) => {
      const depthDiff = right.depth - left.depth;
      if (depthDiff !== 0) return depthDiff;
      return right.width * right.height - left.width * left.height;
    })[0];
}

function getConnectedPlacedNodes(
  node: PositionedMapNode,
  adjacency: AdjacencyMap,
  placedById: Map<string, PositionedMapNode>,
) {
  return [...(adjacency.get(node.id) ?? [])]
    .map((id) => placedById.get(id))
    .filter((item): item is PositionedMapNode => Boolean(item))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function getSinglePassTarget(
  node: PositionedMapNode,
  parent: PositionedMapNode | undefined,
  connectedPlacedNodes: PositionedMapNode[],
) {
  if (parent) return parent;
  if (connectedPlacedNodes.length === 0) return node;

  return {
    x:
      connectedPlacedNodes.reduce((sum, neighbor) => sum + neighbor.x, 0) /
      connectedPlacedNodes.length,
    y:
      connectedPlacedNodes.reduce((sum, neighbor) => sum + neighbor.y, 0) /
      connectedPlacedNodes.length,
  };
}

function getSinglePassCandidates(
  node: PositionedMapNode,
  placedNodes: PositionedMapNode[],
  parent: PositionedMapNode | undefined,
  connectedPlacedNodes: PositionedMapNode[],
  hierarchy: HierarchyIndex,
  inputIndexById: Map<string, number>,
  desiredAspect: number,
) {
  const candidates = new Map<string, PlacementCandidate>();
  const addCandidate = (candidate: PlacementCandidate) => {
    candidates.set(`${roundToTenth(candidate.x)}:${roundToTenth(candidate.y)}`, candidate);
  };
  const anchors = [
    ...(parent ? [parent] : []),
    ...connectedPlacedNodes.filter((item) => item.id !== parent?.id),
    ...placedNodes.filter(
      (item) =>
        item.id !== parent?.id &&
        !connectedPlacedNodes.some((neighbor) => neighbor.id === item.id),
    ),
  ];
  const preferredSlots = getPreferredSlotOrder(
    getSiblingOrdinal(node, hierarchy, inputIndexById),
  );
  const looseSlotOrder = getLooseNodeSlotOrder(placedNodes, desiredAspect);

  for (const anchor of anchors) {
    const slotOrder =
      anchor.id === parent?.id
        ? preferredSlots
        : parent || connectedPlacedNodes.length > 0
          ? getPreferredSlotOrder(0)
          : looseSlotOrder;
    for (let index = 0; index < slotOrder.length; index += 1) {
      addCandidate(createAdjacentCandidate(node, anchor, slotOrder[index], index));
    }
  }

  return [...candidates.values()];
}

function getPreferredSlotOrder(ordinal: number) {
  const firstSlot = ordinal % 4;
  const slots = [
    firstSlot,
    (firstSlot + 1) % 4,
    (firstSlot + 3) % 4,
    (firstSlot + 2) % 4,
  ];

  return [...slots, ...slots.map((slot) => slot + 4), ...slots.map((slot) => slot + 8)];
}

function getLooseNodeSlotOrder(placedNodes: PositionedMapNode[], desiredAspect: number) {
  const bounds = getLayoutBounds(placedNodes);
  const aspect = bounds.width / Math.max(bounds.height, 1);
  const needsWidth = aspect < desiredAspect;
  const slots = needsWidth ? [1, 3, 0, 2] : [0, 2, 1, 3];

  return [...slots, ...slots.map((slot) => slot + 4), ...slots.map((slot) => slot + 8)];
}

function createAdjacentCandidate(
  node: PositionedMapNode,
  anchor: PositionedMapNode,
  slot: number,
  preferenceRank: number,
): PlacementCandidate {
  const ring = Math.floor(slot / 4);
  const side = slot % 4;
  const ringGap = PACKING_GAP + ring * Math.max(node.width, node.height) * 0.52;
  const horizontalDistance = (anchor.width + node.width) / 2 + ringGap;
  const verticalDistance = (anchor.height + node.height) / 2 + ringGap;
  const slideX = ring * (node.width + PACKING_GAP);
  const slideY = ring * (node.height + PACKING_GAP);

  if (side === 0) {
    return { x: anchor.x + slideX, y: anchor.y - verticalDistance, slot, preferenceRank };
  }
  if (side === 1) {
    return { x: anchor.x + horizontalDistance, y: anchor.y + slideY, slot, preferenceRank };
  }
  if (side === 2) {
    return { x: anchor.x - slideX, y: anchor.y + verticalDistance, slot, preferenceRank };
  }

  return { x: anchor.x - horizontalDistance, y: anchor.y - slideY, slot, preferenceRank };
}

function scoreSinglePassCandidate(
  node: PositionedMapNode,
  candidate: PlacementCandidate,
  target: { x: number; y: number },
  parent: PositionedMapNode | undefined,
  connectedPlacedNodes: PositionedMapNode[],
  placedNodes: PositionedMapNode[],
  desiredAspect: number,
) {
  const distanceToTarget = Math.hypot(candidate.x - target.x, candidate.y - target.y);
  const parentDistance = parent ? Math.hypot(candidate.x - parent.x, candidate.y - parent.y) : 0;
  const connectedDistance = connectedPlacedNodes.reduce(
    (total, connected) => total + Math.hypot(candidate.x - connected.x, candidate.y - connected.y),
    0,
  );
  const bounds = getLayoutBounds([...placedNodes, { ...node, x: candidate.x, y: candidate.y }]);
  const aspect = bounds.width / Math.max(bounds.height, 1);
  const looseNode = !parent && connectedPlacedNodes.length === 0;
  const aspectError = Math.abs(Math.log(aspect / desiredAspect));
  const aspectPenalty = aspectError * (looseNode ? 900 : 620);
  const looseAspectPenalty = looseNode
    ? aspectError * 820
    : 0;
  const area = bounds.width * bounds.height;
  const previousBounds = getLayoutBounds(placedNodes);
  const previousArea = previousBounds.width * previousBounds.height;
  const expansionPenalty = looseNode
    ? Math.max(0, area - previousArea) * 0.0008
    : 0;

  return (
    distanceToTarget * (looseNode ? 0.16 : 0.42) +
    parentDistance * 0.46 +
    connectedDistance * 0.08 +
    candidate.preferenceRank * (looseNode ? 18 : 10) +
    Math.floor(candidate.slot / 4) * 48 +
    node.depth * Math.max(0, Math.abs(candidate.x - target.x) * 0.018) +
    aspectPenalty +
    looseAspectPenalty +
    expansionPenalty
  );
}

function findOpenRadialPosition(
  node: PositionedMapNode,
  target: { x: number; y: number },
  placedNodes: PositionedMapNode[],
  collisionIndex: SpatialCollisionIndex,
) {
  const step = Math.max(node.width, node.height) + PACKING_GAP;

  for (let radius = 1; radius <= placedNodes.length + 4; radius += 1) {
    for (let side = 0; side < 4; side += 1) {
      for (let offset = -radius; offset <= radius; offset += 1) {
        const candidate = getRadialCandidate(target, step, radius, side, offset);
        if (!wouldOverlapAtPosition(placedNodes, node, candidate, collisionIndex)) {
          return candidate;
        }
      }
    }
  }

  return { x: target.x + step * (placedNodes.length + 1), y: target.y };
}

function getRadialCandidate(
  target: { x: number; y: number },
  step: number,
  radius: number,
  side: number,
  offset: number,
) {
  if (side === 0) return { x: target.x + offset * step, y: target.y - radius * step };
  if (side === 1) return { x: target.x + radius * step, y: target.y + offset * step };
  if (side === 2) return { x: target.x - offset * step, y: target.y + radius * step };
  return { x: target.x - radius * step, y: target.y - offset * step };
}

function getSiblingOrdinal(
  node: PositionedMapNode,
  hierarchy: HierarchyIndex,
  inputIndexById: Map<string, number>,
) {
  const parentId = [...(hierarchy.parentsByChildId.get(node.id) ?? [])].sort()[0];
  if (!parentId) return inputIndexById.get(node.id) ?? 0;

  return [...(hierarchy.childrenByParentId.get(parentId) ?? [])]
    .sort(
      (leftId, rightId) =>
        (inputIndexById.get(leftId) ?? 0) - (inputIndexById.get(rightId) ?? 0),
    )
    .indexOf(node.id);
}

function wouldOverlapAtPosition(
  placedNodes: PositionedMapNode[],
  currentNode: PositionedMapNode,
  position: { x: number; y: number },
  collisionIndex: SpatialCollisionIndex,
) {
  return collisionIndex
    .queryRect(position.x, position.y, currentNode.width, currentNode.height, currentNode.id)
    .some((other) =>
      rectanglesOverlap(
        position.x,
        position.y,
        currentNode.width,
        currentNode.height,
        other.x,
        other.y,
        other.width,
        other.height,
      ),
    );
}

function recenterUnboundedLayout(nodes: PositionedMapNode[], options: PackingOptions) {
  const bounds = getLayoutBounds(nodes);
  const offsetX = options.centerX - (bounds.minX + bounds.maxX) / 2;
  const offsetY = options.centerY - (bounds.minY + bounds.maxY) / 2;

  return nodes.map((node) => ({ ...node, x: node.x + offsetX, y: node.y + offsetY }));
}

function roundToTenth(value: number) {
  return Math.round(value * 10) / 10;
}
