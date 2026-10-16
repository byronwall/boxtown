import { createHash } from "node:crypto";
import { isMapNodePriority, type MapNodePriority } from "~/lib/spatial-map/node-priority";
import { withNodePriority } from "~/lib/spatial-map/node-priority-update";
import { isMapNodeStatus } from "~/lib/spatial-map/node-status";
import type { MapLink, MapNode, MapNodeStatus } from "~/lib/spatial-map/types";
import {
  appendProjectOperation,
  getMutationMetadata,
  readProjectByIdFromDisk,
  serializedMutation,
  writeProjectAndPublish,
} from "./data.server";
import {
  findUnknownMetadataKeys,
  ProjectMutationError,
  unknownMetadataKeysError,
} from "./mutation-error";
import { sanitizeNodeMetadata } from "./node-metadata";
import { normalizeProjectNodeTypeName } from "./node-types";
import { serializeNodeFile } from "./storage/node-file";
import type { ProjectOperationActor, ProjectRecord } from "./types";

// One node change, applied as a unit: every field is validated against the
// latest stored node inside the mutation queue before anything is written.
export interface ProjectNodePatch {
  title?: string;
  status?: string;
  type?: string;
  archived?: boolean;
  priority?: string | null;
  context?: string;
  // Appended to the latest stored context inside the write queue, so
  // concurrent notes are all kept. Recorded once in the history entry.
  note?: { text: string; heading?: string };
  metadata?: {
    set?: Record<string, unknown>;
    unset?: string[];
    // Replaces the whole map; `set` and `unset` then apply on top of it.
    replace?: Record<string, unknown>;
  };
}

export interface PatchProjectNodeInput {
  projectId: string;
  nodeId: string;
  patch: ProjectNodePatch;
  // Rejects the patch when the node changed since the caller read this revision.
  expectedRevision?: string;
  actor?: ProjectOperationActor;
  clientMutationId?: string;
}

export interface PatchProjectNodeResult {
  project: ProjectRecord;
  node: MapNode;
  revision: string;
  changedFields: string[];
  operationId: string | null;
}

// Digest of the node's stored file. Other nodes' edits do not change it.
export function getNodeRevision(node: MapNode, links: MapLink[]) {
  return createHash("sha256").update(serializeNodeFile(node, links)).digest("hex").slice(0, 16);
}

export const patchProjectNodeOnDisk = serializedMutation(async function patchProjectNodeOnDisk(
  input: PatchProjectNodeInput,
): Promise<PatchProjectNodeResult> {
  const current = await readProjectByIdFromDisk(input.projectId);
  if (!current) {
    throw new ProjectMutationError("project_not_found", "Project not found.", 404, { projectId: input.projectId });
  }
  const node = current.spatialMap.nodes.find((item) => item.id === input.nodeId);
  if (!node) {
    throw new ProjectMutationError("node_not_found", "Node not found.", 404, { nodeId: input.nodeId });
  }

  const currentRevision = getNodeRevision(node, current.spatialMap.links);
  if (input.expectedRevision !== undefined && input.expectedRevision !== currentRevision) {
    throw new ProjectMutationError("revision_conflict", "The node changed since it was read.", 409, {
      nodeId: node.id,
      expectedRevision: input.expectedRevision,
      currentRevision,
    });
  }

  const { node: nextNode, changedFields } = applyNodePatch(node, input.patch, current);
  if (changedFields.length === 0) {
    return { project: current, node, revision: currentRevision, changedFields, operationId: null };
  }

  const nextRecord = appendProjectOperation({
    ...current,
    updatedAt: new Date().toISOString(),
    spatialMap: {
      ...current.spatialMap,
      nodes: current.spatialMap.nodes.map((item) => (item.id === node.id ? nextNode : item)),
    },
  }, {
    kind: input.patch.note ? "node.note.added" : "node.updated",
    actor: input.actor,
    summary: input.patch.note
      ? `Added a note to "${nextNode.label}".`
      : `Updated ${changedFields.join(", ")} on "${nextNode.label}".`,
    nodeIds: [node.id],
    metadata: {
      ...getMutationMetadata(input),
      fields: changedFields.join(","),
      ...(input.patch.note ? { note: input.patch.note.text.trim() } : {}),
    },
  });
  await writeProjectAndPublish(nextRecord);

  return {
    project: nextRecord,
    node: nextNode,
    revision: getNodeRevision(nextNode, nextRecord.spatialMap.links),
    changedFields,
    operationId: nextRecord.operationLog[0]?.id ?? null,
  };
});

export function appendNote(context: string, note: { text: string; heading?: string }) {
  const heading = note.heading?.trim();
  const block = heading ? `${heading}:\n\n${note.text.trim()}` : note.text.trim();
  return [context.trim(), block].filter(Boolean).join("\n\n");
}

// Pure: validates every requested field first, then builds the next node.
export function applyNodePatch(node: MapNode, patch: ProjectNodePatch, project: ProjectRecord) {
  const status = patch.status === undefined ? undefined : requireStatus(patch.status);
  const priority = patch.priority === undefined ? undefined : requirePriority(patch.priority);
  const type = patch.type === undefined ? undefined : requireType(patch.type, project);
  if (patch.archived !== undefined && typeof patch.archived !== "boolean") {
    throw new ProjectMutationError("invalid_archived", "archived must be a boolean.");
  }
  if (patch.title !== undefined && typeof patch.title !== "string") {
    throw new ProjectMutationError("invalid_title", "title must be a string.");
  }
  if (patch.context !== undefined && typeof patch.context !== "string") {
    throw new ProjectMutationError("invalid_context", "context must be a string.");
  }
  if (patch.note !== undefined && (typeof patch.note.text !== "string" || !patch.note.text.trim())) {
    throw new ProjectMutationError("invalid_note", "A note needs non-empty text.");
  }
  if (patch.note !== undefined && patch.context !== undefined) {
    throw new ProjectMutationError("invalid_note", "Send either context or a note, not both.");
  }
  const metadata = patch.metadata ? mergeMetadata(node.metadata, patch.metadata, project) : undefined;

  let next: MapNode = { ...node };
  const changed: string[] = [];
  if (patch.title !== undefined) {
    const title = patch.title.trim() || "Untitled node";
    if (title !== node.label) changed.push("title");
    next.label = title;
  }
  if (status !== undefined && status !== node.status) {
    next.status = status;
    changed.push("status");
  }
  if (type !== undefined && type !== node.type) {
    next.type = type;
    changed.push("type");
  }
  if (patch.archived !== undefined && patch.archived !== (node.archived === true)) {
    const { archived: _archived, ...rest } = next;
    next = patch.archived ? { ...rest, archived: true } : rest;
    changed.push("archived");
  }
  if (priority !== undefined && priority !== (node.priority ?? null)) {
    next = withNodePriority(next, priority);
    changed.push("priority");
  }
  if (patch.context !== undefined && patch.context !== node.context) {
    next.context = patch.context;
    changed.push("context");
  }
  if (patch.note !== undefined) {
    next.context = appendNote(node.context, patch.note);
    changed.push("context");
  }
  if (metadata) {
    const keys = new Set([...Object.keys(node.metadata), ...Object.keys(metadata)]);
    for (const key of [...keys].sort()) {
      if (node.metadata[key] !== metadata[key]) changed.push(`metadata.${key}`);
    }
    next.metadata = metadata;
  }

  return { node: next, changedFields: changed };
}

function mergeMetadata(
  current: Record<string, string>,
  patch: NonNullable<ProjectNodePatch["metadata"]>,
  project: ProjectRecord,
) {
  const unknownKeys = findUnknownMetadataKeys([
    ...Object.keys(patch.replace ?? {}),
    ...Object.keys(patch.set ?? {}),
    ...(patch.unset ?? []),
  ], project.nodeMetadataSchema);
  if (unknownKeys.length > 0) throw unknownMetadataKeysError(unknownKeys, project.nodeMetadataSchema);
  const nonStrings = Object.entries({ ...patch.replace, ...patch.set })
    .filter(([, value]) => typeof value !== "string")
    .map(([key]) => key);
  if (nonStrings.length > 0) {
    throw new ProjectMutationError("invalid_metadata_value", "Metadata values must be strings.", 400, {
      keys: nonStrings,
    });
  }

  const merged: Record<string, unknown> = { ...(patch.replace ?? current), ...patch.set };
  for (const key of patch.unset ?? []) delete merged[key];
  return sanitizeNodeMetadata(merged, project.nodeMetadataSchema, { omitDefaultValues: true });
}

function requireStatus(value: string): MapNodeStatus {
  if (!isMapNodeStatus(value)) {
    throw new ProjectMutationError("invalid_status", "A valid node status is required.", 400, { status: value });
  }
  return value;
}

function requirePriority(value: string | null): MapNodePriority | null {
  const priority = value === null || value === "none" ? null : value;
  if (priority !== null && !isMapNodePriority(priority)) {
    throw new ProjectMutationError(
      "invalid_priority",
      'priority must be one of "urgent", "high", "medium", "low", or null.',
      400,
      { priority: value },
    );
  }
  return priority;
}

function requireType(value: string, project: ProjectRecord) {
  const type = typeof value === "string" ? normalizeProjectNodeTypeName(value) : "";
  if (!type || !project.nodeTypeSchema.some((item) => item.name === type)) {
    throw new ProjectMutationError("invalid_type", "Node type is not defined in project settings.", 400, {
      type: value,
      types: project.nodeTypeSchema.map((item) => item.name),
    });
  }
  return type;
}
