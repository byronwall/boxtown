import type { SpatialMapData } from "./types";

export function calculateNodeDepths(data: SpatialMapData): Map<string, number> {
  const nodeIds = new Set(data.nodes.map((node) => node.id));
  const childrenByParentId = new Map<string, Set<string>>();
  const parentIdsByChildId = new Map<string, Set<string>>();

  for (const link of data.links) {
    if (!link.parentChild || !nodeIds.has(link.source) || !nodeIds.has(link.target)) {
      continue;
    }

    const children = childrenByParentId.get(link.source) ?? new Set<string>();
    children.add(link.target);
    childrenByParentId.set(link.source, children);

    const parents = parentIdsByChildId.get(link.target) ?? new Set<string>();
    parents.add(link.source);
    parentIdsByChildId.set(link.target, parents);
  }

  const depths = new Map<string, number>();
  const roots = data.nodes
    .filter((node) => (parentIdsByChildId.get(node.id)?.size ?? 0) === 0)
    .map((node) => node.id);
  const queue = roots.map((id) => ({ id, depth: 0 }));

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;

    const previousDepth = depths.get(current.id);
    if (previousDepth !== undefined && previousDepth <= current.depth) {
      continue;
    }

    depths.set(current.id, current.depth);

    for (const childId of childrenByParentId.get(current.id) ?? []) {
      queue.push({ id: childId, depth: current.depth + 1 });
    }
  }

  for (const node of data.nodes) {
    if (!depths.has(node.id)) {
      depths.set(node.id, 0);
    }
  }

  return depths;
}
