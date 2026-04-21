import type {
  PositionedMapNode,
  SpatialMapData,
  NodeSize,
} from "~/lib/spatial-map/types";

export const VIEWPORT_WIDTH = 1600;
export const VIEWPORT_HEIGHT = 960;
export const VIEWPORT_CENTER_X = VIEWPORT_WIDTH / 2;
export const VIEWPORT_CENTER_Y = VIEWPORT_HEIGHT / 2;

const sizeByDepth: Record<number, NodeSize> = {
  0: { width: 220, height: 92, fontSize: 22, metaSize: 12 },
  1: { width: 170, height: 74, fontSize: 16, metaSize: 11 },
  2: { width: 126, height: 56, fontSize: 12, metaSize: 10 },
};

export type AdjacencyMap = Map<string, Set<string>>;

export function getNodeSize(depth: number): NodeSize {
  return sizeByDepth[depth] ?? sizeByDepth[2];
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
  const positionedNodes = data.nodes.map((node) => ({
    ...node,
    ...getNodeSize(node.depth),
    x: VIEWPORT_CENTER_X,
    y: VIEWPORT_CENTER_Y,
    vx: 0,
    vy: 0,
  }));

  return resetLayout(positionedNodes, adjacency);
}

export function resetLayout(
  nodes: PositionedMapNode[],
  adjacency: AdjacencyMap,
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

  const assemblies = nextNodes.filter((node) => node.depth === 1);
  assemblies.forEach((node, index) => {
    const parentId = [...(adjacency.get(node.id) ?? [])].find((id) => {
      return nodesById.get(id)?.depth === 0;
    });
    const parent = parentId ? nodesById.get(parentId) : undefined;
    const angle = (index % 5) * (Math.PI / 2.5);
    node.x = (parent?.x ?? VIEWPORT_CENTER_X) + Math.cos(angle) * 150;
    node.y = (parent?.y ?? VIEWPORT_CENTER_Y) + Math.sin(angle) * 110;
  });

  const components = nextNodes.filter((node) => node.depth >= 2);
  components.forEach((node, index) => {
    const parentId = [...(adjacency.get(node.id) ?? [])].find((id) => {
      return nodesById.get(id)?.depth === 1;
    });
    const parent = parentId ? nodesById.get(parentId) : undefined;
    const angle = (index % 6) * (Math.PI / 3);
    node.x = (parent?.x ?? VIEWPORT_CENTER_X) + Math.cos(angle) * 110;
    node.y = (parent?.y ?? VIEWPORT_CENTER_Y) + Math.sin(angle) * 80;
  });

  return solveStaticLayout(nextNodes, adjacency);
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

export function stepLayout(
  nodes: PositionedMapNode[],
  adjacency: AdjacencyMap,
  hoveredNodeId: string | null,
): PositionedMapNode[] {
  const nextNodes = nodes.map((node) => ({ ...node }));
  const nodesById = new Map(nextNodes.map((node) => [node.id, node]));

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

  for (let i = 0; i < nextNodes.length; i += 1) {
    for (let j = i + 1; j < nextNodes.length; j += 1) {
      const a = nextNodes[i];
      const b = nextNodes[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const overlapX = (a.width + b.width) / 2 + 10 - Math.abs(dx);
      const overlapY = (a.height + b.height) / 2 + 10 - Math.abs(dy);

      if (overlapX <= 0 || overlapY <= 0) {
        continue;
      }

      if (overlapX < overlapY) {
        const push = overlapX * 0.05 * Math.sign(dx || 1);
        a.vx -= push;
        b.vx += push;
      } else {
        const push = overlapY * 0.05 * Math.sign(dy || 1);
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
): PositionedMapNode[] {
  let nextNodes = nodes.map((node) => ({ ...node, vx: 0, vy: 0 }));

  for (let iteration = 0; iteration < 120; iteration += 1) {
    const previous = nextNodes;
    nextNodes = stepLayout(nextNodes, adjacency, null);

    const movement = nextNodes.reduce((total, node, index) => {
      const prior = previous[index];
      return total + Math.hypot(node.x - prior.x, node.y - prior.y);
    }, 0);

    if (movement < 0.35) {
      break;
    }
  }

  nextNodes = consolidateLayout(nextNodes, adjacency);
  nextNodes = snapLayoutToGrid(nextNodes, 4);

  return nextNodes.map((node) => ({ ...node, vx: 0, vy: 0 }));
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

function consolidateLayout(
  nodes: PositionedMapNode[],
  adjacency: AdjacencyMap,
): PositionedMapNode[] {
  const nextNodes = nodes.map((node) => ({ ...node }));
  const nodesById = new Map(nextNodes.map((node) => [node.id, node]));

  for (let pass = 0; pass < 24; pass += 1) {
    const sortedNodes = [...nextNodes].sort((left, right) => {
      const leftDistance = Math.hypot(left.x - VIEWPORT_CENTER_X, left.y - VIEWPORT_CENTER_Y);
      const rightDistance = Math.hypot(right.x - VIEWPORT_CENTER_X, right.y - VIEWPORT_CENTER_Y);
      return leftDistance - rightDistance;
    });

    for (const node of sortedNodes) {
      const neighbors = [...(adjacency.get(node.id) ?? [])]
        .map((id) => nodesById.get(id))
        .filter((item): item is PositionedMapNode => Boolean(item));

      if (neighbors.length === 0) {
        compactNodeTowardsTarget(nextNodes, node, VIEWPORT_CENTER_X, VIEWPORT_CENTER_Y);
        continue;
      }

      const targetX =
        neighbors.reduce((sum, neighbor) => sum + neighbor.x, 0) / neighbors.length;
      const targetY =
        neighbors.reduce((sum, neighbor) => sum + neighbor.y, 0) / neighbors.length;

      compactNodeTowardsTarget(nextNodes, node, targetX, targetY);
    }
  }

  return nextNodes;
}

function compactNodeTowardsTarget(
  nodes: PositionedMapNode[],
  node: PositionedMapNode,
  targetX: number,
  targetY: number,
) {
  const dx = targetX - node.x;
  const dy = targetY - node.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    moveNodeAlongAxis(nodes, node, "x", dx);
    moveNodeAlongAxis(nodes, node, "y", dy * 0.35);
  } else {
    moveNodeAlongAxis(nodes, node, "y", dy);
    moveNodeAlongAxis(nodes, node, "x", dx * 0.35);
  }
}

function moveNodeAlongAxis(
  nodes: PositionedMapNode[],
  node: PositionedMapNode,
  axis: "x" | "y",
  delta: number,
) {
  if (Math.abs(delta) < 0.5) {
    return;
  }

  const direction = Math.sign(delta);
  const maxDistance = Math.abs(delta);
  let low = 0;
  let high = maxDistance;
  let best = 0;

  while (high - low > 0.5) {
    const mid = (low + high) / 2;
    const candidate =
      axis === "x"
        ? { x: node.x + direction * mid, y: node.y }
        : { x: node.x, y: node.y + direction * mid };

    if (wouldOverlapAtPosition(nodes, node, candidate.x, candidate.y)) {
      high = mid;
    } else {
      best = mid;
      low = mid;
    }
  }

  if (axis === "x") {
    node.x = clamp(
      node.x + direction * best,
      node.width / 2,
      VIEWPORT_WIDTH - node.width / 2,
    );
  } else {
    node.y = clamp(
      node.y + direction * best,
      node.height / 2,
      VIEWPORT_HEIGHT - node.height / 2,
    );
  }
}

function wouldOverlapAtPosition(
  nodes: PositionedMapNode[],
  currentNode: PositionedMapNode,
  x: number,
  y: number,
) {
  return nodes.some((other) => {
    if (other.id === currentNode.id) {
      return false;
    }

    return rectanglesOverlap(
      x,
      y,
      currentNode.width,
      currentNode.height,
      other.x,
      other.y,
      other.width,
      other.height,
    );
  });
}

function rectanglesOverlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
) {
  return Math.abs(ax - bx) < (aw + bw) / 2 && Math.abs(ay - by) < (ah + bh) / 2;
}

function snapLayoutToGrid(nodes: PositionedMapNode[], step: number) {
  return nodes.map((node) => ({
    ...node,
    x: Math.round(node.x / step) * step,
    y: Math.round(node.y / step) * step,
  }));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
