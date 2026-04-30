import type { MapNode, SpatialMapData } from "~/lib/spatial-map/types";

export interface SpatialMapTreeItem {
  node: MapNode;
  childNodeIds: string[];
}

export interface SpatialMapTree {
  roots: string[];
  items: Map<string, SpatialMapTreeItem>;
}

export function buildSpatialMapTree(data: SpatialMapData): SpatialMapTree {
  const items: Map<string, SpatialMapTreeItem> = new Map(
    data.nodes.map((node) => [node.id, { node, childNodeIds: [] }]),
  );
  const parentIdsByChildId = new Map<string, Set<string>>();

  for (const link of data.links) {
    const source = items.get(link.source);
    const target = items.get(link.target);
    if (!source || !target || !link.parentChild) {
      continue;
    }

    source.childNodeIds.push(target.node.id);
    parentIdsByChildId.set(
      target.node.id,
      (parentIdsByChildId.get(target.node.id) ?? new Set()).add(source.node.id),
    );
  }

  for (const item of items.values()) {
    item.childNodeIds = sortNodeIds(item.childNodeIds, items);
  }

  const roots = sortNodeIds(
    data.nodes
      .filter((node) => (parentIdsByChildId.get(node.id)?.size ?? 0) === 0)
      .map((node) => node.id),
    items,
  );

  return { roots, items };
}

export function sortNodeIds(
  nodeIds: string[],
  items: Map<string, SpatialMapTreeItem>,
) {
  return [...nodeIds].sort((left, right) => {
    const leftNode = items.get(left)?.node;
    const rightNode = items.get(right)?.node;
    if (!leftNode || !rightNode) {
      return left < right ? -1 : left > right ? 1 : 0;
    }

    if (leftNode.label !== rightNode.label) {
      return leftNode.label < rightNode.label ? -1 : 1;
    }

    return leftNode.id < rightNode.id ? -1 : leftNode.id > rightNode.id ? 1 : 0;
  });
}
