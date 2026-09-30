import type { MapNode, MapNodeStatus, SpatialMapData } from "~/lib/spatial-map/types";

export interface BulkNodeUpdate {
  nodeIds: string[];
  status?: MapNodeStatus;
  archived?: boolean;
}

// Shared by the optimistic client update and the server write so both produce
// identical node records.
export function applyBulkNodeUpdate(data: SpatialMapData, update: BulkNodeUpdate): SpatialMapData {
  const targetIds = new Set(update.nodeIds);

  return {
    ...data,
    nodes: data.nodes.map((node) => (targetIds.has(node.id) ? updateNode(node, update) : node)),
  };
}

export function describeBulkNodeUpdate(update: BulkNodeUpdate) {
  const changes: string[] = [];
  if (update.status) {
    changes.push(`status to ${update.status}`);
  }
  if (update.archived !== undefined) {
    changes.push(update.archived ? "archived" : "unarchived");
  }

  const count = update.nodeIds.length;
  return `Bulk updated ${count} node${count === 1 ? "" : "s"}: ${changes.join(", ")}.`;
}

function updateNode(node: MapNode, update: BulkNodeUpdate): MapNode {
  let next: MapNode = update.status ? { ...node, status: update.status } : node;
  if (update.archived !== undefined) {
    const { archived: _archived, ...rest } = next;
    next = update.archived ? { ...rest, archived: true } : rest;
  }
  return next;
}
