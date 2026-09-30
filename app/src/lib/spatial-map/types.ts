export const mapNodeStatuses = [
  "planned",
  "implemented",
  "working",
  "blocked",
  "needs-review",
  "deprecated",
] as const;

export type MapNodeStatus = (typeof mapNodeStatuses)[number];

export interface MapNode {
  id: string;
  label: string;
  type: string;
  status: MapNodeStatus;
  metadata: Record<string, string>;
  context: string;
  rawContext: string;
  images?: MapNodeImage[];
  // Archived nodes (and their subtrees) are hidden from views by default.
  archived?: boolean;
}

export interface MapNodeImage {
  id: string;
  src: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface MapLink {
  source: string;
  target: string;
  parentChild: boolean;
  relationship?: MapLinkRelationship;
}

export type MapLinkRelationship = "related" | "dependency" | "reuse";

export interface SpatialMapData {
  nodes: MapNode[];
  links: MapLink[];
}

export interface NodeSize {
  width: number;
  height: number;
  fontSize: number;
  metaSize: number;
}

export interface PositionedMapNode extends MapNode, NodeSize {
  depth: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}
