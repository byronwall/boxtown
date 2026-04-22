export interface MapNode {
  id: string;
  label: string;
  type: string;
  depth: number;
  purpose: string;
  implementation: string;
  context: string;
  rawContext: string;
  contextMode: "context-only" | "structured";
}

export interface MapLink {
  source: string;
  target: string;
  kind?: string;
}

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
  x: number;
  y: number;
  vx: number;
  vy: number;
}
