// Ordered most to least important. Nodes without a priority are "unprioritized".
export const mapNodePriorities = ["urgent", "high", "medium", "low"] as const;

export type MapNodePriority = (typeof mapNodePriorities)[number];

export const mapNodePriorityLabels = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
} satisfies Record<MapNodePriority, string>;

export function isMapNodePriority(value: unknown): value is MapNodePriority {
  return (
    typeof value === "string" &&
    (mapNodePriorities as readonly string[]).includes(value)
  );
}

export function getMapNodePriorityLabel(priority: MapNodePriority | undefined) {
  return priority ? mapNodePriorityLabels[priority] : "No priority";
}

// Lower sorts first; unprioritized nodes sort last.
export function getMapNodePriorityRank(priority: MapNodePriority | undefined) {
  return priority ? mapNodePriorities.indexOf(priority) : mapNodePriorities.length;
}
