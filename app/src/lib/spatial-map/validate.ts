import type { MapLink, MapNode, SpatialMapData } from "~/lib/spatial-map/types";

export function parseSpatialMapData(input: unknown): SpatialMapData {
  if (!isRecord(input)) {
    throw new Error("Spatial map data must be an object.");
  }

  const { nodes, links } = input;

  if (!Array.isArray(nodes)) {
    throw new Error("Spatial map data must include a nodes array.");
  }
  if (!Array.isArray(links)) {
    throw new Error("Spatial map data must include a links array.");
  }

  return {
    nodes: nodes.map(parseMapNode),
    links: links.map(parseMapLink),
  };
}

function parseMapNode(input: unknown): MapNode {
  if (!isRecord(input)) {
    throw new Error("Each node must be an object.");
  }

  const { id, label, type, depth, purpose, implementation } = input;
  if (!isNonEmptyString(id)) throw new Error("Node id must be a non-empty string.");
  if (!isNonEmptyString(label)) throw new Error("Node label must be a non-empty string.");
  if (!isNonEmptyString(type)) throw new Error("Node type must be a non-empty string.");
  if (typeof depth !== "number" || !Number.isInteger(depth) || depth < 0) {
    throw new Error("Node depth must be a non-negative integer.");
  }
  if (!isNonEmptyString(purpose)) {
    throw new Error("Node purpose must be a non-empty string.");
  }
  if (!isNonEmptyString(implementation)) {
    throw new Error("Node implementation must be a non-empty string.");
  }

  return { id, label, type, depth, purpose, implementation };
}

function parseMapLink(input: unknown): MapLink {
  if (!isRecord(input)) {
    throw new Error("Each link must be an object.");
  }

  const { source, target, kind } = input;
  if (!isNonEmptyString(source)) {
    throw new Error("Link source must be a non-empty string.");
  }
  if (!isNonEmptyString(target)) {
    throw new Error("Link target must be a non-empty string.");
  }
  if (kind !== undefined && !isNonEmptyString(kind)) {
    throw new Error("Link kind must be a non-empty string when provided.");
  }

  return { source, target, kind: typeof kind === "string" ? kind : undefined };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
