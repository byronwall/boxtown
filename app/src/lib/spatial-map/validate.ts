import type { MapLink, MapNode, MapNodeImage, SpatialMapData } from "~/lib/spatial-map/types";
import { isMapLinkRelationship } from "./links";

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

  const { id, label, type, depth, purpose, implementation, context, rawContext, contextMode, images } = input;
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
  if (context !== undefined && typeof context !== "string") {
    throw new Error("Node context must be a string when provided.");
  }
  if (rawContext !== undefined && typeof rawContext !== "string") {
    throw new Error("Node rawContext must be a string when provided.");
  }
  if (
    contextMode !== undefined &&
    contextMode !== "context-only" &&
    contextMode !== "structured"
  ) {
    throw new Error('Node contextMode must be "context-only" or "structured" when provided.');
  }
  if (images !== undefined && !Array.isArray(images)) {
    throw new Error("Node images must be an array when provided.");
  }

  const resolvedContext = typeof context === "string" ? context : "";
  const resolvedContextMode =
    typeof contextMode === "string"
      ? contextMode
      : type === "note"
        ? "context-only"
        : "structured";

  return {
    id,
    label,
    type,
    depth,
    purpose,
    implementation,
    context: resolvedContext,
    rawContext: typeof rawContext === "string" ? rawContext : resolvedContext,
    contextMode: resolvedContextMode,
    images: Array.isArray(images) ? images.map(parseMapNodeImage) : [],
  };
}

function parseMapNodeImage(input: unknown): MapNodeImage {
  if (!isRecord(input)) {
    throw new Error("Each node image must be an object.");
  }

  const { id, src, filename, originalName, mimeType, size, createdAt } = input;
  if (!isNonEmptyString(id)) throw new Error("Node image id must be a non-empty string.");
  if (!isNonEmptyString(src)) throw new Error("Node image src must be a non-empty string.");
  if (!isNonEmptyString(filename)) throw new Error("Node image filename must be a non-empty string.");
  if (!isNonEmptyString(originalName)) {
    throw new Error("Node image originalName must be a non-empty string.");
  }
  if (!isNonEmptyString(mimeType)) throw new Error("Node image mimeType must be a non-empty string.");
  if (typeof size !== "number" || !Number.isFinite(size) || size < 0) {
    throw new Error("Node image size must be a non-negative number.");
  }
  if (!isNonEmptyString(createdAt)) throw new Error("Node image createdAt must be a non-empty string.");

  return { id, src, filename, originalName, mimeType, size, createdAt };
}

function parseMapLink(input: unknown): MapLink {
  if (!isRecord(input)) {
    throw new Error("Each link must be an object.");
  }

  const { source, target, parentChild, relationship } = input;
  if (!isNonEmptyString(source)) {
    throw new Error("Link source must be a non-empty string.");
  }
  if (!isNonEmptyString(target)) {
    throw new Error("Link target must be a non-empty string.");
  }

  if (typeof parentChild !== "boolean") {
    throw new Error("Link parentChild must be a boolean.");
  }

  if (parentChild) {
    return { source, target, parentChild: true };
  }

  if (!isMapLinkRelationship(relationship)) {
    throw new Error('Non-parent/child link relationship must be "related", "dependency", or "reuse".');
  }

  return { source, target, parentChild: false, relationship };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
