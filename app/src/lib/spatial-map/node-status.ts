import {
  mapNodeStatuses,
  type MapNodeStatus,
} from "~/lib/spatial-map/types";

export const DEFAULT_MAP_NODE_STATUS: MapNodeStatus = "planned";

export const mapNodeStatusLabels = {
  planned: "Planned",
  implemented: "Implemented",
  working: "Working",
  blocked: "Blocked",
  "needs-review": "Needs review",
  deprecated: "Deprecated",
} satisfies Record<MapNodeStatus, string>;

export const mapNodeStatusGlyphs = {
  planned: "P",
  implemented: "I",
  working: "W",
  blocked: "!",
  "needs-review": "?",
  deprecated: "x",
} satisfies Record<MapNodeStatus, string>;

export function isMapNodeStatus(value: unknown): value is MapNodeStatus {
  return (
    typeof value === "string" &&
    (mapNodeStatuses as readonly string[]).includes(value)
  );
}

export function getMapNodeStatusLabel(status: MapNodeStatus) {
  return mapNodeStatusLabels[status];
}

export function getMapNodeStatusGlyph(status: MapNodeStatus) {
  return mapNodeStatusGlyphs[status];
}
