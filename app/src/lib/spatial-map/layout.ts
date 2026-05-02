import type { PositionedMapNode, SpatialMapData, NodeSize } from "./types";
import { calculateNodeDepths } from "./depth";
import { SpatialCollisionIndex } from "./layout-collision-index";
import { packUnboundedLayout } from "./layout-single-pass-packer";

export const VIEWPORT_WIDTH = 1600;
export const VIEWPORT_HEIGHT = 960;
export const VIEWPORT_CENTER_X = VIEWPORT_WIDTH / 2;
export const VIEWPORT_CENTER_Y = VIEWPORT_HEIGHT / 2;

const sizeByDepth: Record<
  number,
  Omit<NodeSize, "width" | "height"> & { area: number; minWidth: number; maxWidth: number }
> = {
  0: { area: 20_240, minWidth: 192, maxWidth: 262, fontSize: 22, metaSize: 12 },
  1: { area: 12_580, minWidth: 154, maxWidth: 220, fontSize: 16, metaSize: 11 },
  2: { area: 6_960, minWidth: 120, maxWidth: 172, fontSize: 16, metaSize: 10 },
};
const CANVAS_NODE_TEXT_SCALE = 1.15;
const SHALLOW_VISIBLE_DEPTH_SCALE = 1.32;
const DEEP_VISIBLE_DEPTH_SCALE = 1;

export type AdjacencyMap = Map<string, Set<string>>;

export function getNodeSize(depth: number, label = ""): NodeSize {
  const base = sizeByDepth[depth] ?? sizeByDepth[2];
  const labelLength = label.trim().length;
  const aspect = clamp(1.66 + (labelLength - 10) * 0.06, 1.44, 2.36);
  const rawWidth = Math.sqrt(base.area * aspect);
  const width = clamp(Math.round(rawWidth / 2) * 2, base.minWidth, base.maxWidth);
  const height = Math.max(48, Math.round((base.area / width) / 2) * 2);

  return {
    width,
    height,
    fontSize: roundToTenth(base.fontSize * CANVAS_NODE_TEXT_SCALE),
    metaSize: roundToTenth(base.metaSize * CANVAS_NODE_TEXT_SCALE),
  };
}

export function buildAdjacencyMap(data: SpatialMapData): AdjacencyMap {
  const adjacency = new Map<string, Set<string>>();
  for (const node of data.nodes) {
    adjacency.set(node.id, new Set());
  }

  for (const link of data.links) {
    adjacency.get(link.source)?.add(link.target);
    adjacency.get(link.target)?.add(link.source);
  }

  return adjacency;
}

export function createInitialLayout(data: SpatialMapData): PositionedMapNode[] {
  const adjacency = buildAdjacencyMap(data);
  const hierarchy = buildHierarchyIndex(data);
  const depthsByNodeId = calculateNodeDepths(data);
  const depthItems = data.nodes.map((node) => ({
    node,
    depth: depthsByNodeId.get(node.id) ?? 0,
  }));
  const visibleDepthRange = getVisibleDepthRange(depthItems);
  const positionedNodes = depthItems.map(({ node, depth }) => ({
    ...node,
    depth,
    ...getVisibleDepthNodeSize(depth, node.label, visibleDepthRange),
    x: VIEWPORT_CENTER_X,
    y: VIEWPORT_CENTER_Y,
    vx: 0,
    vy: 0,
  }));

  return resetLayout(positionedNodes, adjacency, hierarchy);
}

function getVisibleDepthNodeSize(
  depth: number,
  label: string,
  visibleDepthRange: { minDepth: number; maxDepth: number },
): NodeSize {
  const baseSize = getNodeSize(depth, label);
  const relativeDepth = getRelativeDepth(depth, visibleDepthRange);
  if (relativeDepth === null) {
    return baseSize;
  }

  const scale = interpolateNumber(
    SHALLOW_VISIBLE_DEPTH_SCALE,
    DEEP_VISIBLE_DEPTH_SCALE,
    relativeDepth,
  );

  return {
    width: roundEven(Math.max(48, baseSize.width * scale)),
    height: roundEven(Math.max(48, baseSize.height * scale)),
    fontSize: Math.max(10, roundToTenth(baseSize.fontSize * scale)),
    metaSize: Math.max(9, roundToTenth(baseSize.metaSize * scale)),
  };
}

function getVisibleDepthRange(nodes: { depth: number }[]) {
  if (nodes.length === 0) {
    return { minDepth: 0, maxDepth: 0 };
  }

  let minDepth = Number.POSITIVE_INFINITY;
  let maxDepth = Number.NEGATIVE_INFINITY;

  for (const node of nodes) {
    minDepth = Math.min(minDepth, node.depth);
    maxDepth = Math.max(maxDepth, node.depth);
  }

  return { minDepth, maxDepth };
}

function getRelativeDepth(
  depth: number,
  range: { minDepth: number; maxDepth: number },
) {
  const span = range.maxDepth - range.minDepth;
  if (span <= 0) {
    return 0;
  }

  return (depth - range.minDepth) / span;
}

function interpolateNumber(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}

function roundEven(value: number) {
  return Math.max(2, Math.round(value / 2) * 2);
}

function roundToTenth(value: number) {
  return Math.round(value * 10) / 10;
}

export function filterSpatialMapDataByRelatedNodes(
  data: SpatialMapData,
  coreId: string | null,
  maxDistance = 2,
): SpatialMapData {
  if (!coreId) {
    return data;
  }

  const adjacency = buildAdjacencyMap(data);
  const visibleNodeIds = getRelatedSet(adjacency, coreId, maxDistance);

  return {
    nodes: data.nodes.filter((node) => visibleNodeIds.has(node.id)),
    links: data.links.filter(
      (link) => visibleNodeIds.has(link.source) && visibleNodeIds.has(link.target),
    ),
  };
}

export function filterSpatialMapDataForIsolation(
  data: SpatialMapData,
  coreId: string | null,
  options: { includeLinked?: boolean; maxLinkedDistance?: number } = {},
): SpatialMapData {
  if (!coreId) {
    return data;
  }

  const visibleNodeIds = getIsolationContinuitySet(data, coreId);

  if (options.includeLinked) {
    const adjacency = buildAdjacencyMap(data);
    for (const nodeId of getRelatedSet(adjacency, coreId, options.maxLinkedDistance)) {
      visibleNodeIds.add(nodeId);
    }
  }

  return {
    nodes: data.nodes.filter((node) => visibleNodeIds.has(node.id)),
    links: data.links.filter(
      (link) => visibleNodeIds.has(link.source) && visibleNodeIds.has(link.target),
    ),
  };
}

export function resetLayout(
  nodes: PositionedMapNode[],
  adjacency: AdjacencyMap,
  hierarchy = createEmptyHierarchyIndex(),
): PositionedMapNode[] {
  const nextNodes = nodes.map((node) => ({
    ...node,
    vx: 0,
    vy: 0,
  }));
  const nodesById = new Map(nextNodes.map((node) => [node.id, node]));

  const pages = nextNodes.filter((node) => node.depth === 0);
  const pageRadius = 280;
  pages.forEach((node, index) => {
    const angle = -Math.PI / 2 + (index / Math.max(pages.length, 1)) * Math.PI * 2;
    node.x = VIEWPORT_CENTER_X + Math.cos(angle) * pageRadius;
    node.y = VIEWPORT_CENTER_Y + Math.sin(angle) * pageRadius;
  });

  const assemblies = sortNodesForPlacement(nextNodes.filter((node) => node.depth === 1));
  assemblies.forEach((node, index) => {
    const parent = getPrimaryPlacedParent(node, nodesById, hierarchy) ??
      getShallowAdjacentParent(node, nodesById, adjacency);
    const angle = (index % 5) * (Math.PI / 2.5);
    node.x = (parent?.x ?? VIEWPORT_CENTER_X) + Math.cos(angle) * 150;
    node.y = (parent?.y ?? VIEWPORT_CENTER_Y) + Math.sin(angle) * 110;
  });

  const components = sortNodesForPlacement(nextNodes.filter((node) => node.depth >= 2));
  components.forEach((node, index) => {
    const parent = getPrimaryPlacedParent(node, nodesById, hierarchy) ??
      getShallowAdjacentParent(node, nodesById, adjacency);
    const angle = (index % 6) * (Math.PI / 3);
    node.x = (parent?.x ?? VIEWPORT_CENTER_X) + Math.cos(angle) * 110;
    node.y = (parent?.y ?? VIEWPORT_CENTER_Y) + Math.sin(angle) * 80;
  });

  return solveStaticLayout(nextNodes, adjacency, hierarchy);
}

export function getRelatedSet(
  adjacency: AdjacencyMap,
  coreId: string | null,
  maxDistance = 2,
): Set<string> {
  if (!coreId) {
    return new Set();
  }

  const related = new Set([coreId]);
  const queue = [{ id: coreId, distance: 0 }];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || current.distance >= maxDistance) {
      continue;
    }

    for (const neighborId of adjacency.get(current.id) ?? []) {
      if (related.has(neighborId)) {
        continue;
      }

      related.add(neighborId);
      queue.push({ id: neighborId, distance: current.distance + 1 });
    }
  }

  return related;
}

export function getDescendantSet(data: SpatialMapData, coreId: string | null): Set<string> {
  if (!coreId) {
    return new Set();
  }

  const { childrenByParentId } = buildHierarchyIndex(data);
  const descendants = new Set([coreId]);
  const queue = [coreId];

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId) {
      continue;
    }

    for (const childId of childrenByParentId.get(currentId) ?? []) {
      if (descendants.has(childId)) {
        continue;
      }

      descendants.add(childId);
      queue.push(childId);
    }
  }

  return descendants;
}

export function getIsolationContinuitySet(
  data: SpatialMapData,
  coreId: string | null,
): Set<string> {
  if (!coreId) {
    return new Set();
  }

  const { childrenByParentId, parentsByChildId } = buildHierarchyIndex(data);
  const visibleNodeIds = new Set([coreId]);
  const descendantQueue = [coreId];
  const ancestorQueue = [coreId];

  while (descendantQueue.length > 0) {
    const currentId = descendantQueue.shift();
    if (!currentId) {
      continue;
    }

    for (const childId of childrenByParentId.get(currentId) ?? []) {
      if (visibleNodeIds.has(childId)) {
        continue;
      }

      visibleNodeIds.add(childId);
      descendantQueue.push(childId);
    }
  }

  while (ancestorQueue.length > 0) {
    const currentId = ancestorQueue.shift();
    if (!currentId) {
      continue;
    }

    for (const parentId of parentsByChildId.get(currentId) ?? []) {
      if (visibleNodeIds.has(parentId)) {
        continue;
      }

      visibleNodeIds.add(parentId);
      ancestorQueue.push(parentId);
    }
  }

  return visibleNodeIds;
}

function buildHierarchyIndex(data: SpatialMapData) {
  const childrenByParentId = new Map<string, Set<string>>();
  const parentsByChildId = new Map<string, Set<string>>();

  for (const link of data.links) {
    if (!link.parentChild) {
      continue;
    }

    const children = childrenByParentId.get(link.source) ?? new Set<string>();
    children.add(link.target);
    childrenByParentId.set(link.source, children);

    const parents = parentsByChildId.get(link.target) ?? new Set<string>();
    parents.add(link.source);
    parentsByChildId.set(link.target, parents);
  }

  return { childrenByParentId, parentsByChildId };
}

function createEmptyHierarchyIndex() {
  return {
    childrenByParentId: new Map<string, Set<string>>(),
    parentsByChildId: new Map<string, Set<string>>(),
  };
}

function getPrimaryPlacedParent(
  node: PositionedMapNode,
  placedById: Map<string, PositionedMapNode>,
  hierarchy: ReturnType<typeof buildHierarchyIndex>,
) {
  const parentIds = hierarchy.parentsByChildId.get(node.id);
  if (!parentIds) {
    return undefined;
  }

  return [...parentIds]
    .map((id) => placedById.get(id))
    .filter((item): item is PositionedMapNode => Boolean(item))
    .sort((left, right) => {
      const depthDiff = right.depth - left.depth;
      if (depthDiff !== 0) {
        return depthDiff;
      }

      return right.width * right.height - left.width * left.height;
    })[0];
}

function getShallowAdjacentParent(
  node: PositionedMapNode,
  nodesById: Map<string, PositionedMapNode>,
  adjacency: AdjacencyMap,
) {
  return [...(adjacency.get(node.id) ?? [])]
    .map((id) => nodesById.get(id))
    .filter(
      (item): item is PositionedMapNode =>
        item !== undefined && item.depth < node.depth,
    )
    .sort((left, right) => right.depth - left.depth)[0];
}

export function stepLayout(
  nodes: PositionedMapNode[],
  adjacency: AdjacencyMap,
  hoveredNodeId: string | null,
): PositionedMapNode[] {
  const nextNodes = nodes.map((node) => ({ ...node }));
  const nodesById = new Map(nextNodes.map((node) => [node.id, node]));
  const collisionIndex = new SpatialCollisionIndex(nextNodes);

  nudgeHoveredCluster(nextNodes, nodesById, adjacency, hoveredNodeId);

  for (const node of nextNodes) {
    const dx = node.x - VIEWPORT_CENTER_X;
    const dy = node.y - VIEWPORT_CENTER_Y;
    const distance = Math.hypot(dx, dy) || 1;
    const targetRadius = node.depth === 0 ? 300 : node.depth === 1 ? 180 : 72;
    const radialError = distance - targetRadius;
    const radialStrength =
      node.depth === 0 ? 0.0015 : node.depth === 1 ? 0.0012 : 0.0009;

    node.vx += -(dx / distance) * radialError * radialStrength;
    node.vy += -(dy / distance) * radialError * radialStrength;
  }

  for (const [sourceId, neighbors] of adjacency) {
    for (const targetId of neighbors) {
      if (sourceId > targetId) {
        continue;
      }

      const source = nodesById.get(sourceId);
      const target = nodesById.get(targetId);
      if (!source || !target) {
        continue;
      }

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const distance = Math.hypot(dx, dy) || 0.001;
      const touchDistance =
        (Math.max(source.width, source.height) + Math.max(target.width, target.height)) *
        0.52;
      const force = (distance - touchDistance) * 0.0045;
      const fx = (dx / distance) * force;
      const fy = (dy / distance) * force;
      source.vx += fx;
      source.vy += fy;
      target.vx -= fx;
      target.vy -= fy;
    }
  }

  for (const a of nextNodes) {
    for (const b of collisionIndex.queryNode(a)) {
      if (a.id >= b.id) {
        continue;
      }

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const overlapX = getAxisOverlap(a.x, a.width, b.x, b.width);
      const overlapY = getAxisOverlap(a.y, a.height, b.y, b.height);

      if (overlapX <= 0 || overlapY <= 0) {
        continue;
      }

      if (overlapX < overlapY) {
        const push = overlapX * 0.12 * Math.sign(dx || 1);
        a.vx -= push;
        b.vx += push;
      } else {
        const push = overlapY * 0.12 * Math.sign(dy || 1);
        a.vy -= push;
        b.vy += push;
      }
    }
  }

  for (const node of nextNodes) {
    const neighbors = [...(adjacency.get(node.id) ?? [])]
      .map((id) => nodesById.get(id))
      .filter((item): item is PositionedMapNode => Boolean(item));

    if (neighbors.length > 0) {
      const avgX =
        neighbors.reduce((sum, neighbor) => sum + neighbor.x, 0) / neighbors.length;
      const avgY =
        neighbors.reduce((sum, neighbor) => sum + neighbor.y, 0) / neighbors.length;
      node.vx += (avgX - node.x) * 0.0008;
      node.vy += (avgY - node.y) * 0.0008;
    }

    node.vx *= 0.88;
    node.vy *= 0.88;
    node.x = clamp(node.x + node.vx, node.width / 2 + 28, VIEWPORT_WIDTH - node.width / 2 - 28);
    node.y = clamp(
      node.y + node.vy,
      node.height / 2 + 28,
      VIEWPORT_HEIGHT - node.height / 2 - 28,
    );
  }

  return nextNodes;
}

export function solveStaticLayout(
  nodes: PositionedMapNode[],
  adjacency: AdjacencyMap,
  hierarchy = createEmptyHierarchyIndex(),
): PositionedMapNode[] {
  return packUnboundedLayout(nodes, adjacency, hierarchy, {
    centerX: VIEWPORT_CENTER_X,
    centerY: VIEWPORT_CENTER_Y,
    desiredAspect: VIEWPORT_WIDTH / VIEWPORT_HEIGHT,
  });
}

function nudgeHoveredCluster(
  nodes: PositionedMapNode[],
  nodesById: Map<string, PositionedMapNode>,
  adjacency: AdjacencyMap,
  hoveredNodeId: string | null,
) {
  if (!hoveredNodeId) {
    return;
  }

  const core = nodesById.get(hoveredNodeId);
  if (!core) {
    return;
  }

  const directNeighbors = [...(adjacency.get(core.id) ?? [])]
    .map((id) => nodesById.get(id))
    .filter((item): item is PositionedMapNode => Boolean(item));

  if (directNeighbors.length === 0) {
    return;
  }

  const clusterNodes = [core, ...directNeighbors];
  const clusterCenterX =
    clusterNodes.reduce((sum, node) => sum + node.x, 0) / clusterNodes.length;
  const clusterCenterY =
    clusterNodes.reduce((sum, node) => sum + node.y, 0) / clusterNodes.length;
  const touchingThreshold = 170;

  for (const node of directNeighbors) {
    const dx = node.x - clusterCenterX;
    const dy = node.y - clusterCenterY;
    const distance = Math.hypot(dx, dy) || 0.001;

    if (distance <= touchingThreshold) {
      continue;
    }

    const pull = (distance - touchingThreshold) * 0.012;
    node.vx += -(dx / distance) * pull;
    node.vy += -(dy / distance) * pull;
  }
}

function getAxisOverlap(
  aCenter: number,
  aSize: number,
  bCenter: number,
  bSize: number,
) {
  return (aSize + bSize) / 2 - Math.abs(aCenter - bCenter);
}

function sortNodesForPlacement(nodes: PositionedMapNode[], adjacency?: AdjacencyMap) {
  return [...nodes].sort((left, right) => {
    const depthDiff = left.depth - right.depth;
    if (depthDiff !== 0) {
      return depthDiff;
    }

    const leftArea = left.width * left.height;
    const rightArea = right.width * right.height;
    const areaDiff = rightArea - leftArea;
    const areaRatio = Math.max(leftArea, rightArea) / Math.max(Math.min(leftArea, rightArea), 1);
    if (areaRatio > 1.08 && areaDiff !== 0) {
      return areaDiff;
    }

    const degreeDiff =
      (adjacency?.get(right.id)?.size ?? 0) - (adjacency?.get(left.id)?.size ?? 0);
    if (degreeDiff !== 0) {
      return degreeDiff;
    }

    return left.id.localeCompare(right.id);
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
