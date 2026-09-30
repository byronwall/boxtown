import type { SpatialMapData } from "./types";

// Ids of archived nodes plus every descendant, since archiving a node hides its subtree.
export function getArchivedSubtreeNodeIds(data: SpatialMapData) {
  const hiddenNodeIds = new Set(
    data.nodes.filter((node) => node.archived).map((node) => node.id),
  );
  if (hiddenNodeIds.size === 0) {
    return hiddenNodeIds;
  }

  let added = true;
  while (added) {
    added = false;
    for (const link of data.links) {
      if (link.parentChild && hiddenNodeIds.has(link.source) && !hiddenNodeIds.has(link.target)) {
        hiddenNodeIds.add(link.target);
        added = true;
      }
    }
  }

  return hiddenNodeIds;
}

export function hideArchivedNodes(data: SpatialMapData): SpatialMapData {
  const hiddenNodeIds = getArchivedSubtreeNodeIds(data);
  if (hiddenNodeIds.size === 0) {
    return data;
  }

  return {
    nodes: data.nodes.filter((node) => !hiddenNodeIds.has(node.id)),
    links: data.links.filter(
      (link) => !hiddenNodeIds.has(link.source) && !hiddenNodeIds.has(link.target),
    ),
  };
}
