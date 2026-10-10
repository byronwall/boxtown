import type {
  ProjectOperationActor,
  ProjectOperationKind,
  ProjectOperationLogEntry,
  ProjectOperationPayload,
  ProjectOperationState,
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
  operationLog?: unknown;
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

  const operationLog = parseOperationLog(record.operationLog);
  const legacyState = parseLegacyProjectState(record);
  const canonicalLog = ensureCanonicalOperationLog({
    projectId: record.id,
    updatedAt: record.updatedAt,
    operationLog,
    legacyState,
  });
  const state = projectStateFromOperationLog(canonicalLog);

  const normalizedRecord: ProjectRecord = {
    id: record.id,
    name: record.name,
    description:
      typeof record.description === "string"
        ? record.description
        : "No project description yet.",
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    nodeMetadataSchema: state.nodeMetadataSchema,
    nodeTypeSchema: state.nodeTypeSchema,
    spatialMap: state.spatialMap,
    operationLog: canonicalLog,
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
    operationLog: record.operationLog,
  };
}

function parseLegacyProjectState(record: SerializedProjectRecord): ProjectOperationState | null {
  if (record.spatialMap === undefined) {
    return null;
  }

  const nodeMetadataSchema = parseNodeMetadataSchema(record.nodeMetadataSchema);
  const spatialMap = parseSpatialMapData(record.spatialMap, {
    allowedMetadataKeys: nodeMetadataSchema.map((field) => field.key),
  });
  const nodeTypeSchema = parseNodeTypeSchema(record.nodeTypeSchema, spatialMap);

  return {
    nodeMetadataSchema,
    nodeTypeSchema,
    spatialMap: normalizeSpatialMapMetadata(spatialMap, nodeMetadataSchema),
  };
}

function ensureCanonicalOperationLog(input: {
  projectId: string;
  updatedAt: string;
  operationLog: ProjectOperationLogEntry[];
  legacyState: ProjectOperationState | null;
}) {
  const operationLog = input.operationLog.flatMap((entry) =>
    isProjectBackfillEntry(entry)
      ? createBackfilledProjectOperationEntries({
          createdAt: entry.createdAt,
          state: entry.payload.state,
          sourceOperationId: entry.id,
        })
      : [entry],
  );

  if (operationLog.some((entry) => entry.payload?.state)) {
    return operationLog;
  }
  if (!input.legacyState) {
    return operationLog;
  }

  return [
    ...operationLog,
    ...createBackfilledProjectOperationEntries({
      createdAt: input.updatedAt,
      state: input.legacyState,
      sourceOperationId: `legacy-backfill-${input.projectId}`,
    }),
  ];
}

function isProjectBackfillEntry(
  entry: ProjectOperationLogEntry,
): entry is ProjectOperationLogEntry & { payload: { state: ProjectOperationState } } {
  const kind: string = entry.kind;
  return (
    (kind === "project.backfilled" || kind === "project.backfill") &&
    !!entry.payload?.state
  );
}

function createBackfilledProjectOperationEntries(input: {
  createdAt: string;
  state: ProjectOperationState;
  sourceOperationId: string;
}): ProjectOperationLogEntry[] {
  const entries: ProjectOperationLogEntry[] = [];
  let spatialMap: SpatialMapData = { nodes: [], links: [] };
  let state = createProjectOperationState(input.state, spatialMap);
  const actor = { kind: "human" as const, label: "Legacy project owner" };
  const metadata = { sourceOperationId: input.sourceOperationId };

  entries.push({
    id: `${input.sourceOperationId}-project-created`,
    kind: "project.created",
    actor,
    createdAt: input.createdAt,
    summary: "Backfilled project creation.",
    nodeIds: [],
    linkKeys: [],
    metadata,
    payload: { state },
  });

  state = createProjectOperationState(input.state, spatialMap);
  entries.push({
    id: `${input.sourceOperationId}-schema-updated`,
    kind: "project.schema.updated",
    actor,
    createdAt: input.createdAt,
    summary: "Backfilled metadata fields and node types.",
    nodeIds: [],
    linkKeys: [],
    metadata,
    payload: { state },
  });

  const seenNodeIds = new Set<string>();
  for (const node of input.state.spatialMap.nodes) {
    seenNodeIds.add(node.id);
    spatialMap = {
      nodes: [...spatialMap.nodes, { ...node, metadata: {} }],
      links: input.state.spatialMap.links.filter(
        (link) => seenNodeIds.has(link.source) && seenNodeIds.has(link.target),
      ),
    };
    state = createProjectOperationState(input.state, spatialMap);
    entries.push({
      id: `${input.sourceOperationId}-node-created-${node.id}`,
      kind: "node.created",
      actor,
      createdAt: input.createdAt,
      summary: `Backfilled node "${node.label}".`,
      nodeIds: [node.id],
      linkKeys: [],
      metadata,
      payload: { state },
    });

    state = createProjectOperationState(input.state, spatialMap);
    entries.push({
      id: `${input.sourceOperationId}-node-type-${node.id}`,
      kind: "node.type.updated",
      actor,
      createdAt: input.createdAt,
      summary: `Backfilled "${node.label}" type as ${node.type}.`,
      nodeIds: [node.id],
      linkKeys: [],
      metadata,
      payload: { state },
    });

    if (Object.keys(node.metadata).length === 0) {
      continue;
    }

    spatialMap = {
      ...spatialMap,
      nodes: spatialMap.nodes.map((currentNode) =>
        currentNode.id === node.id ? { ...currentNode, metadata: node.metadata } : currentNode,
      ),
    };
    state = createProjectOperationState(input.state, spatialMap);
    entries.push({
      id: `${input.sourceOperationId}-node-metadata-${node.id}`,
      kind: "node.metadata.updated",
      actor,
      createdAt: input.createdAt,
      summary: `Backfilled metadata for "${node.label}".`,
      nodeIds: [node.id],
      linkKeys: [],
      metadata,
      payload: { state },
    });
  }

  return entries.reverse();
}

function createProjectOperationState(
  source: ProjectOperationState,
  spatialMap: SpatialMapData,
): ProjectOperationState {
  return {
    nodeMetadataSchema: source.nodeMetadataSchema,
    nodeTypeSchema: source.nodeTypeSchema,
    spatialMap,
  };
}

function projectStateFromOperationLog(operationLog: ProjectOperationLogEntry[]): ProjectOperationState {
  let state: ProjectOperationState = {
    nodeMetadataSchema: createDefaultProjectNodeMetadataSchema(),
    nodeTypeSchema: createDefaultProjectNodeTypeSchema(),
    spatialMap: { nodes: [], links: [] },
  };

  for (const entry of [...operationLog].reverse()) {
    if (entry.payload?.state) {
      state = entry.payload.state;
    }
  }

  return state;
}

function parseOperationLog(input: unknown): ProjectOperationLogEntry[] {
  if (input === undefined) {
    return [];
  }
  if (!Array.isArray(input)) {
    throw new Error("Project operationLog must be an array.");
  }

  return input.map(parseOperationLogEntry);
}

export function parseOperationLogEntry(input: unknown): ProjectOperationLogEntry {
  if (!isRecord(input)) {
    throw new Error("Project operation log entries must be objects.");
  }

  const { id, kind, actor, createdAt, summary, nodeIds, linkKeys, metadata, payload } = input;
  if (typeof id !== "string" || id.trim().length === 0) {
    throw new Error("Project operation log entry id must be a non-empty string.");
  }
  if (typeof kind !== "string" || kind.trim().length === 0) {
    throw new Error("Project operation log entry kind must be a non-empty string.");
  }
  if (typeof createdAt !== "string" || createdAt.trim().length === 0) {
    throw new Error("Project operation log entry createdAt must be a non-empty string.");
  }
  if (typeof summary !== "string") {
    throw new Error("Project operation log entry summary must be a string.");
  }

  return {
    id,
    kind: kind as ProjectOperationKind,
    actor: parseOperationActor(actor),
    createdAt,
    summary,
    nodeIds: Array.isArray(nodeIds)
      ? nodeIds.filter((nodeId): nodeId is string => typeof nodeId === "string")
      : [],
    linkKeys: Array.isArray(linkKeys)
      ? linkKeys.filter((linkKey): linkKey is string => typeof linkKey === "string")
      : undefined,
    metadata: isRecord(metadata)
      ? Object.fromEntries(
          Object.entries(metadata).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
        )
      : undefined,
    payload: parseOperationPayload(payload),
  };
}

function parseOperationActor(input: unknown): ProjectOperationActor {
  if (input === undefined) {
    return { kind: "human" };
  }
  if (!isRecord(input)) {
    throw new Error("Project operation log entry actor must be an object when provided.");
  }

  const { kind, id, label } = input;
  if (kind !== "human" && kind !== "agent") {
    throw new Error('Project operation log entry actor kind must be "human" or "agent".');
  }

  return {
    kind,
    id: typeof id === "string" && id.trim().length > 0 ? id : undefined,
    label: typeof label === "string" && label.trim().length > 0 ? label : undefined,
  };
}

function parseOperationPayload(input: unknown): ProjectOperationPayload | undefined {
  if (input === undefined) {
    return undefined;
  }
  if (!isRecord(input)) {
    throw new Error("Project operation log entry payload must be an object when provided.");
  }

  const { state } = input;
  return {
    state: state === undefined ? undefined : parseOperationState(state),
  };
}

export function parseOperationState(input: unknown): ProjectOperationState {
  if (!isRecord(input)) {
    throw new Error("Project operation state must be an object.");
  }

  const nodeMetadataSchema = parseNodeMetadataSchema(input.nodeMetadataSchema);
  const spatialMap = parseSpatialMapData(input.spatialMap, {
    allowedMetadataKeys: nodeMetadataSchema.map((field) => field.key),
  });
  const nodeTypeSchema = parseNodeTypeSchema(input.nodeTypeSchema, spatialMap);

  return {
    nodeMetadataSchema,
    nodeTypeSchema,
    spatialMap: normalizeSpatialMapMetadata(spatialMap, nodeMetadataSchema),
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

  const { name, color, isDefault } = input;
  if (typeof name !== "string" || name.trim().length === 0) {
    throw new Error(`Project node type row ${index + 1} must have a name.`);
  }
  if (typeof color !== "string") {
    throw new Error(`Project node type row ${index + 1} must have a color.`);
  }

  return {
    name: normalizeProjectNodeTypeName(name),
    color: normalizeProjectNodeTypeColor(color, index),
    ...(isDefault === true ? { isDefault: true } : {}),
  };
}

export function mergeStoredNodeTypes(
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
