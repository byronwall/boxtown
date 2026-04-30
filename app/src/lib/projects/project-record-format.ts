import type {
  ProjectNodeMetadataField,
  ProjectNodeTypeDefinition,
  ProjectRecord,
} from "./types";
import { sanitizeNodeMetadata, createDefaultProjectNodeMetadataSchema } from "./node-metadata";
import {
  createDefaultProjectNodeTypeSchema,
  normalizeProjectNodeTypeColor,
  normalizeProjectNodeTypeName,
} from "./node-types";
import type { SpatialMapData } from "~/lib/spatial-map/types";
import { parseSpatialMapData } from "~/lib/spatial-map/validate";

interface SerializedProjectRecord {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  nodeMetadataSchema?: unknown;
  nodeTypeSchema?: unknown;
  spatialMap?: unknown;
}

export function parseStoredProjectRecord(value: unknown): {
  record: ProjectRecord;
  didNormalize: boolean;
} {
  if (!isRecord(value)) {
    throw new Error("Invalid project record in storage.");
  }

  const record = value as SerializedProjectRecord;
  if (
    typeof record.id !== "string" ||
    typeof record.name !== "string" ||
    typeof record.createdAt !== "string" ||
    typeof record.updatedAt !== "string"
  ) {
    throw new Error("Invalid project record in storage.");
  }

  const nodeMetadataSchema = parseNodeMetadataSchema(record.nodeMetadataSchema);
  const spatialMap = parseSpatialMapData(record.spatialMap, {
    allowedMetadataKeys: nodeMetadataSchema.map((field) => field.key),
  });
  const nodeTypeSchema = parseNodeTypeSchema(record.nodeTypeSchema, spatialMap);

  const normalizedRecord: ProjectRecord = {
    id: record.id,
    name: record.name,
    description:
      typeof record.description === "string"
        ? record.description
        : "No project description yet.",
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    nodeMetadataSchema,
    nodeTypeSchema,
    spatialMap: normalizeSpatialMapMetadata(spatialMap, nodeMetadataSchema),
  };

  return {
    record: normalizedRecord,
    didNormalize: JSON.stringify(value) !== JSON.stringify(serializeProjectRecord(normalizedRecord)),
  };
}

export function serializeProjectRecord(record: ProjectRecord) {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    nodeMetadataSchema: record.nodeMetadataSchema,
    nodeTypeSchema: record.nodeTypeSchema,
    spatialMap: record.spatialMap,
  };
}

export function parseNodeMetadataSchema(input: unknown): ProjectNodeMetadataField[] {
  if (input === undefined) {
    return createDefaultProjectNodeMetadataSchema();
  }
  if (!Array.isArray(input)) {
    throw new Error("Project nodeMetadataSchema must be an array.");
  }

  const schema = input.map((field, index) => parseNodeMetadataField(field, index));
  const keys = new Set<string>();
  for (const field of schema) {
    if (keys.has(field.key)) {
      throw new Error(`Duplicate project metadata key "${field.key}".`);
    }
    keys.add(field.key);
  }

  return schema;
}

export function parseNodeTypeSchema(
  input: unknown,
  spatialMap?: SpatialMapData,
): ProjectNodeTypeDefinition[] {
  if (input === undefined) {
    const defaults = createDefaultProjectNodeTypeSchema();
    const existingTypes = spatialMap?.nodes.map((node) => node.type) ?? [];
    return mergeStoredNodeTypes(defaults, existingTypes);
  }
  if (!Array.isArray(input)) {
    throw new Error("Project nodeTypeSchema must be an array.");
  }

  const schema = input.map((field, index) => parseNodeTypeField(field, index));
  const names = new Set<string>();
  for (const field of schema) {
    if (names.has(field.name)) {
      throw new Error(`Duplicate project node type "${field.name}".`);
    }
    names.add(field.name);
  }

  return schema.length > 0 ? schema : createDefaultProjectNodeTypeSchema();
}

function normalizeSpatialMapMetadata(
  spatialMap: SpatialMapData,
  schema: ProjectNodeMetadataField[],
): SpatialMapData {
  return {
    ...spatialMap,
    nodes: spatialMap.nodes.map((node) => ({
      ...node,
      metadata: sanitizeNodeMetadata(node.metadata, schema, {
        omitDefaultValues: true,
      }),
    })),
  };
}

function parseNodeTypeField(input: unknown, index: number): ProjectNodeTypeDefinition {
  if (!isRecord(input)) {
    throw new Error(`Project node type row ${index + 1} must be an object.`);
  }

  const { name, color } = input;
  if (typeof name !== "string" || name.trim().length === 0) {
    throw new Error(`Project node type row ${index + 1} must have a name.`);
  }
  if (typeof color !== "string") {
    throw new Error(`Project node type row ${index + 1} must have a color.`);
  }

  return {
    name: normalizeProjectNodeTypeName(name),
    color: normalizeProjectNodeTypeColor(color, index),
  };
}

function mergeStoredNodeTypes(
  schema: ProjectNodeTypeDefinition[],
  names: string[],
): ProjectNodeTypeDefinition[] {
  const next = [...schema];
  const seen = new Set(next.map((item) => item.name));

  for (const name of names) {
    const normalized = normalizeProjectNodeTypeName(name);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    next.push({
      name: normalized,
      color: normalizeProjectNodeTypeColor("", next.length),
    });
  }

  return next;
}

function parseNodeMetadataField(input: unknown, index: number): ProjectNodeMetadataField {
  if (!isRecord(input)) {
    throw new Error(`Project metadata schema row ${index + 1} must be an object.`);
  }

  const { key, label, defaultValue } = input;
  if (typeof key !== "string" || key.trim().length === 0) {
    throw new Error(`Project metadata schema row ${index + 1} must have a key.`);
  }
  if (typeof label !== "string") {
    throw new Error(`Project metadata schema row ${index + 1} must have a label.`);
  }
  if (typeof defaultValue !== "string") {
    throw new Error(`Project metadata schema row ${index + 1} must have a defaultValue.`);
  }

  return {
    key: key.trim(),
    label: label.trim(),
    defaultValue: defaultValue.trim(),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
