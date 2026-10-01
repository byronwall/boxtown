import type { MapNodePriority } from "./node-priority";
import type { MapNode } from "./types";

// Sets or clears a node's priority; cleared nodes drop the field entirely.
export function withNodePriority(node: MapNode, priority: MapNodePriority | null): MapNode {
  const { priority: _priority, ...rest } = node;
  return priority ? { ...rest, priority } : rest;
}
