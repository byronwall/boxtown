import type { SpatialMapTree } from "./spatial-map-tree";

// Root-first ancestor ids of a node in the parent/child tree.
export function getAncestorIds(tree: SpatialMapTree, nodeId: string) {
  const parentById = new Map<string, string>();
  for (const [parentId, item] of tree.items) {
    for (const childId of item.childNodeIds) parentById.set(childId, parentId);
  }
  const ancestors: string[] = [];
  let current = parentById.get(nodeId);
  while (current && !ancestors.includes(current)) {
    ancestors.unshift(current);
    current = parentById.get(current);
  }
  return ancestors;
}

// Number of nodes below a node in the parent/child tree.
export function countDescendants(tree: SpatialMapTree, nodeId: string): number {
  const childIds = tree.items.get(nodeId)?.childNodeIds ?? [];
  return childIds.reduce((total, childId) => total + 1 + countDescendants(tree, childId), 0);
}
