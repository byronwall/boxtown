import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { GeneratedNodeBatch } from "~/lib/add-nodes/types";
import { resolveAppDataDir } from "~/lib/server/data-dir";
import { createParentChildLink, getLinkKey } from "~/lib/spatial-map/links";
import { DEFAULT_MAP_NODE_STATUS, isMapNodeStatus } from "~/lib/spatial-map/node-status";
import type { MapNodeImage, MapNodeStatus, SpatialMapData } from "~/lib/spatial-map/types";
import {
  publishProjectDeleted,
  publishProjectRecordChanged,
} from "~/ws/project-events";
import { splitMarkdownIntoHeadingSections } from "./context-node-markdown";
import { createUniqueNodeId, getNodeImageDirSegment } from "./node-id";
import {
  createDefaultProjectNodeMetadataSchema,
  normalizeProjectNodeMetadataKey,
  normalizeProjectNodeMetadataLabel,
  sanitizeNodeMetadata,
} from "./node-metadata";
import {
  createDefaultProjectNodeTypeSchema,
  normalizeProjectNodeTypeName,
  normalizeProjectNodeTypeSchema,
} from "./node-types";
import {
  parseStoredProjectRecord,
  serializeProjectRecord,
} from "./project-record-format";
import type {
  ProjectOperationActor,
  ProjectOperationKind,
  ProjectOperationLogEntry,
  ProjectOperationPayload,
  ProjectOperationState,
  ProjectNodeMetadataField,
  ProjectRecord,
  ProjectSummary,
} from "./types";

interface CreateProjectInput {
  name?: string;
  actor?: ProjectOperationActor;
}

interface UpdateProjectNodeContextInput {
  projectId: string;
  nodeId: string;
  context: string;
  actor?: ProjectOperationActor;
  clientMutationId?: string;
}

interface UpdateProjectNodeTitleInput {
  projectId: string;
  nodeId: string;
  title: string;
  actor?: ProjectOperationActor;
  clientMutationId?: string;
}

interface UpdateProjectNodeStatusInput {
  projectId: string;
  nodeId: string;
  status: MapNodeStatus;
  actor?: ProjectOperationActor;
  clientMutationId?: string;
}

interface UpdateProjectNodeTypeInput {
  projectId: string;
  nodeId: string;
  type: string;
  actor?: ProjectOperationActor;
  clientMutationId?: string;
}

interface CreateContextNodeInput {
  projectId: string;
  label: string;
  context: string;
  metadata?: Record<string, unknown>;
  splitByHeadingLevel?: boolean;
  splitByListItems?: boolean;
  splitNestedListItems?: boolean;
  maxHeadingDepth?: number;
  actor?: ProjectOperationActor;
  clientMutationId?: string;
}

interface CreateChildNodeInput {
  projectId: string;
  parentNodeId: string | null;
  title: string;
  type?: string;
  status?: MapNodeStatus;
  context?: string;
  metadata?: Record<string, unknown>;
  actor?: ProjectOperationActor;
  clientMutationId?: string;
}

interface UpdateProjectNodeMetadataInput {
  projectId: string;
  nodeId: string;
  metadata: Record<string, unknown>;
  actor?: ProjectOperationActor;
  clientMutationId?: string;
}

interface UpdateProjectMetadataSchemaInput {
  projectId: string;
  name?: string;
  description?: string;
  fields: ProjectMetadataSchemaRowInput[];
  nodeTypes: ProjectNodeTypeRowInput[];
  actor?: ProjectOperationActor;
  clientMutationId?: string;
}

interface ProjectMetadataSchemaRowInput {
  originalKey?: string;
  key: string;
  label: string;
  defaultValue: string;
}

interface ProjectNodeTypeRowInput {
  name: string;
  color: string;
}

interface DeleteProjectNodeInput {
  projectId: string;
  nodeId: string;
  includeChildren?: boolean;
  actor?: ProjectOperationActor;
  clientMutationId?: string;
}

interface DeleteProjectLinkInput {
  projectId: string;
  source: string;
  target: string;
  relationship: string;
  actor?: ProjectOperationActor;
  clientMutationId?: string;
}

interface MoveProjectNodeInput {
  projectId: string;
  nodeId: string;
  parentNodeId: string | null;
  actor?: ProjectOperationActor;
  clientMutationId?: string;
}

interface AddProjectNodeImagesInput {
  projectId: string;
  nodeId: string;
  images: File[];
  actor?: ProjectOperationActor;
  clientMutationId?: string;
}

interface DeleteProjectNodeImageInput {
  projectId: string;
  nodeId: string;
  imageId: string;
  actor?: ProjectOperationActor;
  clientMutationId?: string;
}

interface ProjectNodeImageSource {
  originalName: string;
  mimeType: string;
  size: number;
  data: Buffer;
}

export interface ProjectBackupFileSummary {
  projectId: string;
  filename: string;
  size: number;
  updatedAt: string;
}

interface AddProjectNodeImageSourcesInput {
  projectId: string;
  nodeIds: string[];
  images: ProjectNodeImageSource[];
  actor?: ProjectOperationActor;
  clientMutationId?: string;
}

export function createBlankSpatialMapData(): SpatialMapData {
  return {
    nodes: [],
    links: [],
  };
}

function createProjectOperationLogEntry(input: {
  kind: ProjectOperationKind;
  summary: string;
  createdAt?: string;
  nodeIds?: string[];
  linkKeys?: string[];
  metadata?: Record<string, string>;
  payload?: ProjectOperationPayload;
  actor?: ProjectOperationActor;
}): ProjectOperationLogEntry {
  return {
    id: randomUUID(),
    kind: input.kind,
    actor: input.actor ?? { kind: "human" },
    createdAt: input.createdAt ?? new Date().toISOString(),
    summary: input.summary,
    nodeIds: input.nodeIds ?? [],
    linkKeys: input.linkKeys,
    metadata: input.metadata,
    payload: input.payload,
  };
}

function getProjectOperationState(record: ProjectRecord): ProjectOperationState {
  return {
    nodeMetadataSchema: record.nodeMetadataSchema,
    nodeTypeSchema: record.nodeTypeSchema,
    spatialMap: record.spatialMap,
  };
}

function appendProjectOperation(
  record: ProjectRecord,
  operation: Parameters<typeof createProjectOperationLogEntry>[0],
): ProjectRecord {
  const operationWithState = {
    ...operation,
    payload: operation.payload ?? { state: getProjectOperationState(record) },
  };

  return {
    ...record,
    operationLog: [
      createProjectOperationLogEntry(operationWithState),
      ...stripProjectOperationStatePayloads(record.operationLog ?? []),
    ].slice(0, 250),
  };
}

function stripProjectOperationStatePayloads(
  operationLog: ProjectOperationLogEntry[],
): ProjectOperationLogEntry[] {
  return operationLog.map((entry) => {
    if (!entry.payload?.state) {
      return entry;
    }

    const { payload: _payload, ...entryWithoutPayload } = entry;
    return entryWithoutPayload;
  });
}

function getMutationMetadata(input: { clientMutationId?: string }) {
  return input.clientMutationId ? { clientMutationId: input.clientMutationId } : undefined;
}

function mergeMutationMetadata(
  input: { clientMutationId?: string },
  metadata?: Record<string, string>,
) {
  const mutationMetadata = getMutationMetadata(input);
  return mutationMetadata || metadata ? { ...metadata, ...mutationMetadata } : undefined;
}

async function writeProjectRecordsAndPublishProject(
  _records: ProjectRecord[],
  project: ProjectRecord,
) {
  await writeProjectRecordToDisk(project);
  publishProjectRecordChanged(project);
}

async function writeProjectRecordsAndPublishDeletion(
  records: ProjectRecord[],
  projectId: string,
) {
  await writeProjectRecordsToDisk(records);
  publishProjectDeleted(projectId);
}

export async function readProjectSummariesFromDisk(): Promise<ProjectSummary[]> {
  const records = await readProjectRecordsFromDisk();

  return records
    .map((record) => ({
      id: record.id,
      name: record.name,
      description: record.description,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      nodeCount: record.spatialMap.nodes.length,
      linkCount: record.spatialMap.links.length,
    }))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function readProjectByIdFromDisk(
  projectId: string,
): Promise<ProjectRecord | null> {
  const projectFile = getProjectJsonFilePath(projectId);
  if (!existsSync(projectFile)) {
    return null;
  }

  const storedProject = await readStoredProjectJson(projectFile);
  const parsed = parseStoredProjectRecord(storedProject.value);
  if (parsed.didNormalize || storedProject.didRecover) {
    await writeProjectRecordToDisk(parsed.record);
  }

  return parsed.record;
}

export async function createProjectOnDisk(
  input: CreateProjectInput = {},
): Promise<ProjectRecord> {
  const records = await readProjectRecordsFromDisk();
  const now = new Date().toISOString();
  const name = sanitizeProjectName(input.name);
  const id = createUniqueProjectId(name, records);
  const nextRecord: ProjectRecord = {
    id,
    name,
    description:
      "Blank project ready for grid editing, structure mapping, and future AI-assisted details.",
    createdAt: now,
    updatedAt: now,
    nodeMetadataSchema: createDefaultProjectNodeMetadataSchema(),
    nodeTypeSchema: createDefaultProjectNodeTypeSchema(),
    spatialMap: createBlankSpatialMapData(),
    operationLog: [
      createProjectOperationLogEntry({
        kind: "project.created",
        actor: input.actor,
        createdAt: now,
        summary: `Created project "${name}".`,
        payload: {
          state: {
            nodeMetadataSchema: createDefaultProjectNodeMetadataSchema(),
            nodeTypeSchema: createDefaultProjectNodeTypeSchema(),
            spatialMap: createBlankSpatialMapData(),
          },
        },
      }),
    ],
  };

  records.push(nextRecord);
  await writeProjectRecordsAndPublishProject(records, nextRecord);

  return nextRecord;
}

export async function deleteProjectOnDisk(projectId: string): Promise<void> {
  const records = await readProjectRecordsFromDisk();
  const nextRecords = records.filter((record) => record.id !== projectId);

  if (nextRecords.length === records.length) {
    throw new Error("Project not found.");
  }

  await writeProjectRecordsAndPublishDeletion(nextRecords, projectId);
}

export function mergeGeneratedSpatialMapData(
  current: SpatialMapData,
  generated: GeneratedNodeBatch,
  nodeMetadataSchema: ProjectNodeMetadataField[],
): SpatialMapData {
  const existingIds = new Set(current.nodes.map((node) => node.id));
  const nodeIdMap = new Map<string, string>();
  const nextNodes = [...current.nodes];
  const existingLinkKeys = new Set(current.links.map(getLinkKey));

  for (const node of generated.nodes) {
    const { depth: _legacyDepth, ...nodeWithoutDepth } = node as typeof node & {
      depth?: unknown;
    };
    const stableId = createUniqueNodeId(node.label, node.type, existingIds);
    existingIds.add(stableId);
    nodeIdMap.set(node.id, stableId);
    nextNodes.push({
      ...nodeWithoutDepth,
      id: stableId,
      status: node.status ?? DEFAULT_MAP_NODE_STATUS,
      metadata: sanitizeNodeMetadata(node.metadata, nodeMetadataSchema, {
        omitDefaultValues: true,
      }),
      rawContext: node.rawContext ?? node.context,
    });
  }

  const validNodeIds = new Set(nextNodes.map((node) => node.id));
  const nextLinks = [...current.links];

  for (const link of generated.links) {
    const source = nodeIdMap.get(link.source) ?? link.source;
    const target = nodeIdMap.get(link.target) ?? link.target;
    if (!validNodeIds.has(source) || !validNodeIds.has(target)) {
      continue;
    }

    const nextLink = link.parentChild
      ? createParentChildLink({ source, target })
      : {
          source,
          target,
          parentChild: false,
          relationship: link.relationship ?? "related",
        };
    const key = getLinkKey(nextLink);
    if (existingLinkKeys.has(key)) {
      continue;
    }

    existingLinkKeys.add(key);
    nextLinks.push(nextLink);
  }

  return {
    nodes: nextNodes,
    links: nextLinks,
  };
}

export async function appendGeneratedNodesToProjectOnDisk(input: {
  projectId: string;
  generated: GeneratedNodeBatch;
  actor?: ProjectOperationActor;
}) {
  const records = await readProjectRecordsFromDisk();
  const recordIndex = records.findIndex((record) => record.id === input.projectId);

  if (recordIndex === -1) {
    throw new Error("Project not found.");
  }

  const current = records[recordIndex];
  const nextSpatialMap = mergeGeneratedSpatialMapData(
    current.spatialMap,
    input.generated,
    current.nodeMetadataSchema,
  );
  const createdNodes = nextSpatialMap.nodes.slice(current.spatialMap.nodes.length);
  const createdLinks = nextSpatialMap.links.slice(current.spatialMap.links.length);
  const nextRecord = appendProjectOperation({
    ...current,
    updatedAt: new Date().toISOString(),
    spatialMap: nextSpatialMap,
  }, {
    kind: "nodes.generated",
    actor: input.actor,
    summary: `Generated ${createdNodes.length} nodes and ${createdLinks.length} links.`,
    nodeIds: createdNodes.map((node) => node.id),
    linkKeys: createdLinks.map(getLinkKey),
  });

  records[recordIndex] = nextRecord;
  await writeProjectRecordsAndPublishProject(records, nextRecord);
  return nextRecord;
}

export async function updateProjectNodeContextOnDisk(
  input: UpdateProjectNodeContextInput,
): Promise<ProjectRecord> {
  const records = await readProjectRecordsFromDisk();
  const recordIndex = records.findIndex((record) => record.id === input.projectId);

  if (recordIndex === -1) {
    throw new Error("Project not found.");
  }

  const current = records[recordIndex];
  const nodeIndex = current.spatialMap.nodes.findIndex((node) => node.id === input.nodeId);

  if (nodeIndex === -1) {
    throw new Error("Node not found.");
  }

  const nextNodes = current.spatialMap.nodes.map((node, index) =>
    index === nodeIndex ? { ...node, context: input.context } : node,
  );

  const nextRecord = appendProjectOperation({
    ...current,
    updatedAt: new Date().toISOString(),
    spatialMap: {
      ...current.spatialMap,
      nodes: nextNodes,
    },
  }, {
    kind: "node.context.updated",
    actor: input.actor,
    summary: `Updated context for "${current.spatialMap.nodes[nodeIndex]?.label ?? input.nodeId}".`,
    nodeIds: [input.nodeId],
    metadata: getMutationMetadata(input),
  });

  records[recordIndex] = nextRecord;
  await writeProjectRecordsAndPublishProject(records, nextRecord);
  return nextRecord;
}

export async function updateProjectNodeTitleOnDisk(
  input: UpdateProjectNodeTitleInput,
): Promise<ProjectRecord> {
  const records = await readProjectRecordsFromDisk();
  const recordIndex = records.findIndex((record) => record.id === input.projectId);

  if (recordIndex === -1) {
    throw new Error("Project not found.");
  }

  const current = records[recordIndex];
  const nodeIndex = current.spatialMap.nodes.findIndex((node) => node.id === input.nodeId);

  if (nodeIndex === -1) {
    throw new Error("Node not found.");
  }

  const title = input.title.trim() || "Untitled node";
  const nextNodes = current.spatialMap.nodes.map((node, index) =>
    index === nodeIndex ? { ...node, label: title } : node,
  );

  const nextRecord = appendProjectOperation({
    ...current,
    updatedAt: new Date().toISOString(),
    spatialMap: {
      ...current.spatialMap,
      nodes: nextNodes,
    },
  }, {
    kind: "node.title.updated",
    actor: input.actor,
    summary: `Renamed "${current.spatialMap.nodes[nodeIndex]?.label ?? input.nodeId}" to "${title}".`,
    nodeIds: [input.nodeId],
    metadata: getMutationMetadata(input),
  });

  records[recordIndex] = nextRecord;
  await writeProjectRecordsAndPublishProject(records, nextRecord);
  return nextRecord;
}

export async function updateProjectNodeStatusOnDisk(
  input: UpdateProjectNodeStatusInput,
): Promise<ProjectRecord> {
  if (!isMapNodeStatus(input.status)) {
    throw new Error("Invalid node status.");
  }

  const records = await readProjectRecordsFromDisk();
  const recordIndex = records.findIndex((record) => record.id === input.projectId);

  if (recordIndex === -1) {
    throw new Error("Project not found.");
  }

  const current = records[recordIndex];
  const nodeIndex = current.spatialMap.nodes.findIndex((node) => node.id === input.nodeId);

  if (nodeIndex === -1) {
    throw new Error("Node not found.");
  }

  const nextNodes = current.spatialMap.nodes.map((node, index) =>
    index === nodeIndex ? { ...node, status: input.status } : node,
  );

  const nextRecord = appendProjectOperation({
    ...current,
    updatedAt: new Date().toISOString(),
    spatialMap: {
      ...current.spatialMap,
      nodes: nextNodes,
    },
  }, {
    kind: "node.status.updated",
    actor: input.actor,
    summary: `Changed "${current.spatialMap.nodes[nodeIndex]?.label ?? input.nodeId}" status to ${input.status}.`,
    nodeIds: [input.nodeId],
    metadata: getMutationMetadata(input),
  });

  records[recordIndex] = nextRecord;
  await writeProjectRecordsAndPublishProject(records, nextRecord);
  return nextRecord;
}

export async function updateProjectNodeTypeOnDisk(
  input: UpdateProjectNodeTypeInput,
): Promise<ProjectRecord> {
  const nextType = normalizeProjectNodeTypeName(input.type);
  if (!nextType) {
    throw new Error("A valid node type is required.");
  }

  const records = await readProjectRecordsFromDisk();
  const recordIndex = records.findIndex((record) => record.id === input.projectId);

  if (recordIndex === -1) {
    throw new Error("Project not found.");
  }

  const current = records[recordIndex];
  if (!current.nodeTypeSchema.some((item) => item.name === nextType)) {
    throw new Error("Node type is not defined in project settings.");
  }

  const nodeIndex = current.spatialMap.nodes.findIndex((node) => node.id === input.nodeId);

  if (nodeIndex === -1) {
    throw new Error("Node not found.");
  }

  const nextNodes = current.spatialMap.nodes.map((node, index) =>
    index === nodeIndex ? { ...node, type: nextType } : node,
  );

  const nextRecord = appendProjectOperation({
    ...current,
    updatedAt: new Date().toISOString(),
    spatialMap: {
      ...current.spatialMap,
      nodes: nextNodes,
    },
  }, {
    kind: "node.type.updated",
    actor: input.actor,
    summary: `Changed "${current.spatialMap.nodes[nodeIndex]?.label ?? input.nodeId}" type to ${nextType}.`,
    nodeIds: [input.nodeId],
    metadata: getMutationMetadata(input),
  });

  records[recordIndex] = nextRecord;
  await writeProjectRecordsAndPublishProject(records, nextRecord);
  return nextRecord;
}

export async function updateProjectNodeMetadataOnDisk(
  input: UpdateProjectNodeMetadataInput,
): Promise<ProjectRecord> {
  const records = await readProjectRecordsFromDisk();
  const recordIndex = records.findIndex((record) => record.id === input.projectId);

  if (recordIndex === -1) {
    throw new Error("Project not found.");
  }

  const current = records[recordIndex];
  const nodeIndex = current.spatialMap.nodes.findIndex((node) => node.id === input.nodeId);

  if (nodeIndex === -1) {
    throw new Error("Node not found.");
  }

  const nextNodes = current.spatialMap.nodes.map((node, index) =>
    index === nodeIndex
      ? {
          ...node,
          metadata: sanitizeNodeMetadata(input.metadata, current.nodeMetadataSchema, {
            omitDefaultValues: true,
          }),
        }
      : node,
  );

  const nextRecord = appendProjectOperation({
    ...current,
    updatedAt: new Date().toISOString(),
    spatialMap: {
      ...current.spatialMap,
      nodes: nextNodes,
    },
  }, {
    kind: "node.metadata.updated",
    actor: input.actor,
    summary: `Updated metadata for "${current.spatialMap.nodes[nodeIndex]?.label ?? input.nodeId}".`,
    nodeIds: [input.nodeId],
    metadata: getMutationMetadata(input),
  });

  records[recordIndex] = nextRecord;
  await writeProjectRecordsAndPublishProject(records, nextRecord);
  return nextRecord;
}

export async function updateProjectMetadataSchemaOnDisk(
  input: UpdateProjectMetadataSchemaInput,
): Promise<ProjectRecord> {
  const records = await readProjectRecordsFromDisk();
  const recordIndex = records.findIndex((record) => record.id === input.projectId);

  if (recordIndex === -1) {
    throw new Error("Project not found.");
  }

  const current = records[recordIndex];
  const nextSchema = normalizeProjectMetadataSchemaRows(input.fields);
  const nextNodeTypeSchema = normalizeProjectNodeTypeSchema(input.nodeTypes);
  const nextNodes = current.spatialMap.nodes.map((node) => ({
    ...node,
    metadata: remapNodeMetadataForSchema(node.metadata, current.nodeMetadataSchema, nextSchema, input.fields),
  }));

  const nextRecord = appendProjectOperation({
    ...current,
    name: sanitizeProjectName(input.name ?? current.name),
    description: sanitizeProjectDescription(input.description ?? current.description),
    updatedAt: new Date().toISOString(),
    nodeMetadataSchema: nextSchema,
    nodeTypeSchema: nextNodeTypeSchema,
    spatialMap: {
      ...current.spatialMap,
      nodes: nextNodes,
    },
  }, {
    kind: "project.schema.updated",
    actor: input.actor,
    summary: "Updated project metadata and node type schema.",
    metadata: getMutationMetadata(input),
  });

  records[recordIndex] = nextRecord;
  await writeProjectRecordsAndPublishProject(records, nextRecord);
  return nextRecord;
}

export async function addProjectNodeImagesOnDisk(
  input: AddProjectNodeImagesInput,
): Promise<ProjectRecord> {
  const imageFiles = input.images.filter((file) => file.size > 0);
  if (imageFiles.length === 0) {
    throw new Error("At least one image file is required.");
  }

  const records = await readProjectRecordsFromDisk();
  const recordIndex = records.findIndex((record) => record.id === input.projectId);

  if (recordIndex === -1) {
    throw new Error("Project not found.");
  }

  const current = records[recordIndex];
  const nodeIndex = current.spatialMap.nodes.findIndex((node) => node.id === input.nodeId);

  if (nodeIndex === -1) {
    throw new Error("Node not found.");
  }

  const now = new Date().toISOString();
  const imageDir = getProjectNodeImageDir(input.projectId, input.nodeId);
  await mkdir(imageDir, { recursive: true });

  const storedImages: MapNodeImage[] = [];
  for (const file of imageFiles) {
    const extension = getImageFileExtension(file);
    const imageId = randomUUID();
    const filename = `${imageId}${extension}`;
    await writeFile(path.join(imageDir, filename), Buffer.from(await file.arrayBuffer()));
    storedImages.push({
      id: imageId,
      src: `/api/projects/${encodeURIComponent(input.projectId)}/images/${encodeURIComponent(input.nodeId)}/${encodeURIComponent(filename)}`,
      filename,
      originalName: sanitizeImageOriginalName(file.name),
      mimeType: file.type,
      size: file.size,
      createdAt: now,
    });
  }

  const nextNodes = current.spatialMap.nodes.map((node, index) =>
    index === nodeIndex
      ? { ...node, images: [...(node.images ?? []), ...storedImages] }
      : node,
  );

  const nextRecord = appendProjectOperation({
    ...current,
    updatedAt: now,
    spatialMap: {
      ...current.spatialMap,
      nodes: nextNodes,
    },
  }, {
    kind: "node.images.added",
    actor: input.actor,
    summary: `Added ${storedImages.length} images to "${current.spatialMap.nodes[nodeIndex]?.label ?? input.nodeId}".`,
    nodeIds: [input.nodeId],
    metadata: mergeMutationMetadata(input, { imageCount: String(storedImages.length) }),
  });

  records[recordIndex] = nextRecord;
  await writeProjectRecordsAndPublishProject(records, nextRecord);
  return nextRecord;
}

export async function deleteProjectNodeImageOnDisk(
  input: DeleteProjectNodeImageInput,
): Promise<ProjectRecord> {
  const records = await readProjectRecordsFromDisk();
  const recordIndex = records.findIndex((record) => record.id === input.projectId);

  if (recordIndex === -1) {
    throw new Error("Project not found.");
  }

  const current = records[recordIndex];
  const nodeIndex = current.spatialMap.nodes.findIndex((node) => node.id === input.nodeId);

  if (nodeIndex === -1) {
    throw new Error("Node not found.");
  }

  const node = current.spatialMap.nodes[nodeIndex];
  const image = (node.images ?? []).find((item) => item.id === input.imageId);
  if (!image) {
    throw new Error("Image not found.");
  }

  const now = new Date().toISOString();
  const nextNodes = current.spatialMap.nodes.map((item, index) =>
    index === nodeIndex
      ? { ...item, images: (item.images ?? []).filter((nodeImage) => nodeImage.id !== input.imageId) }
      : item,
  );

  const nextRecord = appendProjectOperation({
    ...current,
    updatedAt: now,
    spatialMap: {
      ...current.spatialMap,
      nodes: nextNodes,
    },
  }, {
    kind: "node.image.deleted",
    actor: input.actor,
    summary: `Deleted image "${image.originalName}" from "${node.label}".`,
    nodeIds: [input.nodeId],
    metadata: mergeMutationMetadata(input, { imageId: input.imageId }),
  });

  records[recordIndex] = nextRecord;
  await writeProjectRecordsAndPublishProject(records, nextRecord);

  await rm(
    getProjectNodeImageFilePath({
      projectId: input.projectId,
      nodeId: input.nodeId,
      filename: image.filename,
    }),
    { force: true },
  );

  return nextRecord;
}

export async function addProjectNodeImageSourcesOnDisk(
  input: AddProjectNodeImageSourcesInput,
): Promise<ProjectRecord> {
  if (input.nodeIds.length === 0 || input.images.length === 0) {
    const project = await readProjectByIdFromDisk(input.projectId);
    if (!project) {
      throw new Error("Project not found.");
    }
    return project;
  }

  const records = await readProjectRecordsFromDisk();
  const recordIndex = records.findIndex((record) => record.id === input.projectId);

  if (recordIndex === -1) {
    throw new Error("Project not found.");
  }

  const current = records[recordIndex];
  const targetNodeIds = new Set(input.nodeIds);
  const currentNodeIds = new Set(current.spatialMap.nodes.map((node) => node.id));
  for (const nodeId of targetNodeIds) {
    if (!currentNodeIds.has(nodeId)) {
      throw new Error(`Node "${nodeId}" not found.`);
    }
  }

  const now = new Date().toISOString();
  const imagesByNodeId = new Map<string, MapNodeImage[]>();
  for (const nodeId of targetNodeIds) {
    const imageDir = getProjectNodeImageDir(input.projectId, nodeId);
    await mkdir(imageDir, { recursive: true });

    const storedImages: MapNodeImage[] = [];
    for (const image of input.images) {
      const extension = getImageSourceFileExtension(image.mimeType);
      const imageId = randomUUID();
      const filename = `${imageId}${extension}`;
      await writeFile(path.join(imageDir, filename), image.data);
      storedImages.push({
        id: imageId,
        src: `/api/projects/${encodeURIComponent(input.projectId)}/images/${encodeURIComponent(nodeId)}/${encodeURIComponent(filename)}`,
        filename,
        originalName: sanitizeImageOriginalName(image.originalName),
        mimeType: image.mimeType,
        size: image.size,
        createdAt: now,
      });
    }

    imagesByNodeId.set(nodeId, storedImages);
  }

  const nextNodes = current.spatialMap.nodes.map((node) =>
    targetNodeIds.has(node.id)
      ? { ...node, images: [...(node.images ?? []), ...(imagesByNodeId.get(node.id) ?? [])] }
      : node,
  );

  const nextRecord = appendProjectOperation({
    ...current,
    updatedAt: now,
    spatialMap: {
      ...current.spatialMap,
      nodes: nextNodes,
    },
  }, {
    kind: "node.images.added",
    actor: input.actor,
    summary: `Attached ${input.images.length} source images to ${input.nodeIds.length} nodes.`,
    nodeIds: input.nodeIds,
    metadata: mergeMutationMetadata(input, { imageCount: String(input.images.length) }),
  });

  records[recordIndex] = nextRecord;
  await writeProjectRecordsAndPublishProject(records, nextRecord);
  return nextRecord;
}

export async function createContextNodeOnDisk(
  input: CreateContextNodeInput,
): Promise<{
  nodeId: string;
  createdNodeIds: string[];
  project: ProjectRecord;
  createdNodeCount: number;
  createdLinks: SpatialMapData["links"];
}> {
  const records = await readProjectRecordsFromDisk();
  const recordIndex = records.findIndex((record) => record.id === input.projectId);

  if (recordIndex === -1) {
    throw new Error("Project not found.");
  }

  const current = records[recordIndex];
  const existingIds = new Set(current.spatialMap.nodes.map((node) => node.id));
  const baseLabel = input.label.trim();
  const metadata = sanitizeNodeMetadata(input.metadata, current.nodeMetadataSchema, {
    omitDefaultValues: true,
  });
  const createdNodes = input.splitByHeadingLevel || input.splitByListItems
    ? createContextNodeTree({
        label: baseLabel,
        markdown: input.context,
        metadata,
        existingIds,
        maxHeadingDepth: input.maxHeadingDepth,
        splitListItems: input.splitByListItems,
        splitNestedListItems: input.splitNestedListItems,
      })
    : createSingleContextNode({
        label: baseLabel,
        context: input.context,
        metadata,
        existingIds,
      });

  const nextRecord = appendProjectOperation({
    ...current,
    updatedAt: new Date().toISOString(),
    spatialMap: {
      ...current.spatialMap,
      nodes: [...current.spatialMap.nodes, ...createdNodes.nodes],
      links: [...current.spatialMap.links, ...createdNodes.links],
    },
  }, {
    kind: "context.nodes.imported",
    actor: input.actor,
    summary: `Imported ${createdNodes.nodes.length} context nodes from "${baseLabel}".`,
    nodeIds: createdNodes.nodes.map((node) => node.id),
    linkKeys: createdNodes.links.map(getLinkKey),
    metadata: getMutationMetadata(input),
  });

  records[recordIndex] = nextRecord;
  await writeProjectRecordsAndPublishProject(records, nextRecord);
  return {
    nodeId: createdNodes.rootNodeId,
    createdNodeIds: createdNodes.nodes.map((node) => node.id),
    project: nextRecord,
    createdNodeCount: createdNodes.nodes.length,
    createdLinks: createdNodes.links,
  };
}

export async function createChildNodeOnDisk(
  input: CreateChildNodeInput,
): Promise<{ nodeId: string; project: ProjectRecord }> {
  const records = await readProjectRecordsFromDisk();
  const recordIndex = records.findIndex((record) => record.id === input.projectId);

  if (recordIndex === -1) {
    throw new Error("Project not found.");
  }

  const current = records[recordIndex];
  const parentNode = input.parentNodeId
    ? current.spatialMap.nodes.find((node) => node.id === input.parentNodeId) ?? null
    : null;

  if (input.parentNodeId && !parentNode) {
    throw new Error("Parent node not found.");
  }

  const label = input.title.trim() || "Untitled node";
  const existingIds = new Set(current.spatialMap.nodes.map((node) => node.id));
  const nodeType = input.type
    ? normalizeProjectNodeTypeName(input.type)
    : parentNode?.type ?? "page";
  if (!nodeType) {
    throw new Error("A valid node type is required.");
  }
  if (!current.nodeTypeSchema.some((item) => item.name === nodeType)) {
    throw new Error("Node type is not defined in project settings.");
  }
  const nodeId = reserveUniqueNodeId(label, nodeType, existingIds);
  const context = input.context ?? "";
  const node = {
    id: nodeId,
    label,
    type: nodeType,
    status: input.status ?? DEFAULT_MAP_NODE_STATUS,
    metadata: sanitizeNodeMetadata(input.metadata, current.nodeMetadataSchema, {
      omitDefaultValues: true,
    }),
    context,
    rawContext: context,
  } satisfies SpatialMapData["nodes"][number];

  const nextRecord = appendProjectOperation({
    ...current,
    updatedAt: new Date().toISOString(),
    spatialMap: {
      ...current.spatialMap,
      nodes: [...current.spatialMap.nodes, node],
      links: parentNode
        ? [
            ...current.spatialMap.links,
            createParentChildLink({ source: parentNode.id, target: node.id }),
          ]
        : current.spatialMap.links,
    },
  }, {
    kind: "node.created",
    actor: input.actor,
    summary: `Created "${label}"${parentNode ? ` under "${parentNode.label}"` : ""}.`,
    nodeIds: [node.id, ...(parentNode ? [parentNode.id] : [])],
    metadata: getMutationMetadata(input),
  });

  records[recordIndex] = nextRecord;
  await writeProjectRecordsAndPublishProject(records, nextRecord);
  return { nodeId, project: nextRecord };
}

function createSingleContextNode(input: {
  label: string;
  context: string;
  metadata: Record<string, string>;
  existingIds: Set<string>;
}) {
  const nodeId = reserveUniqueNodeId(input.label, "note", input.existingIds);

  return {
    rootNodeId: nodeId,
    nodes: [
      createContextNoteNode({
        id: nodeId,
        label: input.label,
        metadata: input.metadata,
        context: input.context,
      }),
    ],
    links: [],
  };
}

function createContextNodeTree(input: {
  label: string;
  markdown: string;
  metadata: Record<string, string>;
  existingIds: Set<string>;
  maxHeadingDepth?: number;
  splitListItems?: boolean;
  splitNestedListItems?: boolean;
}) {
  const { preamble, sections } = splitMarkdownIntoHeadingSections(input.markdown, {
    maxHeadingDepth: input.maxHeadingDepth,
    splitListItems: input.splitListItems,
    splitNestedListItems: input.splitNestedListItems,
  });
  if (sections.length === 0) {
    return createSingleContextNode({
      label: input.label,
      context: input.markdown,
      metadata: input.metadata,
      existingIds: input.existingIds,
    });
  }

  const rootNodeId = reserveUniqueNodeId(input.label, "note", input.existingIds);
  const nodes = [
    createContextNoteNode({
      id: rootNodeId,
      label: input.label,
      metadata: input.metadata,
      context: preamble,
    }),
  ];
  const sectionNodeIds: string[] = [];
  const links: SpatialMapData["links"] = [];

  for (const section of sections) {
    const nodeId = reserveUniqueNodeId(section.label, "note", input.existingIds);
    const parentNodeId =
      section.parentIndex === null ? rootNodeId : sectionNodeIds[section.parentIndex] ?? rootNodeId;

    sectionNodeIds.push(nodeId);
    nodes.push(
      createContextNoteNode({
        id: nodeId,
        label: section.label,
        metadata: {},
        context: section.context,
      }),
    );
    links.push({
      ...createParentChildLink({ source: parentNodeId, target: nodeId }),
    });
  }

  return {
    rootNodeId,
    nodes,
    links,
  };
}

function createContextNoteNode(input: {
  id: string;
  label: string;
  metadata: Record<string, string>;
  context: string;
}) {
  return {
    id: input.id,
    label: input.label,
    type: "note",
    status: DEFAULT_MAP_NODE_STATUS,
    metadata: input.metadata,
    context: input.context,
    rawContext: input.context,
  };
}

export async function deleteProjectNodeOnDisk(
  input: DeleteProjectNodeInput,
): Promise<ProjectRecord> {
  const records = await readProjectRecordsFromDisk();
  const recordIndex = records.findIndex((record) => record.id === input.projectId);

  if (recordIndex === -1) {
    throw new Error("Project not found.");
  }

  const current = records[recordIndex];
  const nodeExists = current.spatialMap.nodes.some((node) => node.id === input.nodeId);

  if (!nodeExists) {
    throw new Error("Node not found.");
  }

  const removedNode = current.spatialMap.nodes.find((node) => node.id === input.nodeId);
  const nodeIdsToDelete = new Set([
    input.nodeId,
    ...(input.includeChildren ? getDescendantNodeIds(current.spatialMap, input.nodeId) : []),
  ]);
  const nextRecord = appendProjectOperation({
    ...current,
    updatedAt: new Date().toISOString(),
    spatialMap: {
      nodes: current.spatialMap.nodes.filter((node) => !nodeIdsToDelete.has(node.id)),
      links: current.spatialMap.links.filter(
        (link) => !nodeIdsToDelete.has(link.source) && !nodeIdsToDelete.has(link.target),
      ),
    },
  }, {
    kind: "node.deleted",
    actor: input.actor,
    summary: input.includeChildren
      ? `Deleted "${removedNode?.label ?? input.nodeId}" and ${nodeIdsToDelete.size - 1} children.`
      : `Deleted "${removedNode?.label ?? input.nodeId}".`,
    nodeIds: [...nodeIdsToDelete],
    metadata: getMutationMetadata(input),
  });

  records[recordIndex] = nextRecord;
  await writeProjectRecordsAndPublishProject(records, nextRecord);
  return nextRecord;
}

export async function deleteProjectLinkOnDisk(
  input: DeleteProjectLinkInput,
): Promise<ProjectRecord> {
  const records = await readProjectRecordsFromDisk();
  const recordIndex = records.findIndex((record) => record.id === input.projectId);

  if (recordIndex === -1) {
    throw new Error("Project not found.");
  }

  const current = records[recordIndex];
  const relationship = input.relationship.trim() || "related";
  const nextLinks = current.spatialMap.links.filter(
    (link) =>
      link.parentChild ||
      link.source !== input.source ||
      link.target !== input.target ||
      (link.relationship ?? "related") !== relationship,
  );

  if (nextLinks.length === current.spatialMap.links.length) {
    throw new Error("Link not found.");
  }

  const nextRecord = appendProjectOperation({
    ...current,
    updatedAt: new Date().toISOString(),
    spatialMap: {
      ...current.spatialMap,
      links: nextLinks,
    },
  }, {
    kind: "link.deleted",
    actor: input.actor,
    summary: `Deleted ${relationship} link from ${input.source} to ${input.target}.`,
    nodeIds: [input.source, input.target],
    metadata: getMutationMetadata(input),
  });

  records[recordIndex] = nextRecord;
  await writeProjectRecordsAndPublishProject(records, nextRecord);
  return nextRecord;
}

export async function moveProjectNodeOnDisk(
  input: MoveProjectNodeInput,
): Promise<ProjectRecord> {
  const records = await readProjectRecordsFromDisk();
  const recordIndex = records.findIndex((record) => record.id === input.projectId);

  if (recordIndex === -1) {
    throw new Error("Project not found.");
  }

  const current = records[recordIndex];
  const nodeExists = current.spatialMap.nodes.some((node) => node.id === input.nodeId);
  const parentNodeExists = input.parentNodeId
    ? current.spatialMap.nodes.some((node) => node.id === input.parentNodeId)
    : true;

  if (!nodeExists) {
    throw new Error("Node not found.");
  }
  if (!parentNodeExists) {
    throw new Error("Parent node not found.");
  }
  if (input.parentNodeId === input.nodeId) {
    throw new Error("A node cannot be its own parent.");
  }
  if (input.parentNodeId && getDescendantNodeIds(current.spatialMap, input.nodeId).has(input.parentNodeId)) {
    throw new Error("A node cannot be moved under one of its descendants.");
  }

  const linksWithoutCurrentParent = current.spatialMap.links.filter(
    (link) => !(link.parentChild && link.target === input.nodeId),
  );
  const nextLinks = input.parentNodeId
    ? [
        ...linksWithoutCurrentParent,
        createParentChildLink({ source: input.parentNodeId, target: input.nodeId }),
      ]
    : linksWithoutCurrentParent;

  const movedNode = current.spatialMap.nodes.find((node) => node.id === input.nodeId);
  const parentNode = input.parentNodeId
    ? current.spatialMap.nodes.find((node) => node.id === input.parentNodeId)
    : null;
  const nextRecord = appendProjectOperation({
    ...current,
    updatedAt: new Date().toISOString(),
    spatialMap: {
      ...current.spatialMap,
      links: nextLinks,
    },
  }, {
    kind: "node.moved",
    actor: input.actor,
    summary: parentNode
      ? `Moved "${movedNode?.label ?? input.nodeId}" under "${parentNode.label}".`
      : `Moved "${movedNode?.label ?? input.nodeId}" to the root.`,
    nodeIds: [input.nodeId, ...(input.parentNodeId ? [input.parentNodeId] : [])],
    metadata: getMutationMetadata(input),
  });

  records[recordIndex] = nextRecord;
  await writeProjectRecordsAndPublishProject(records, nextRecord);
  return nextRecord;
}

function getDescendantNodeIds(data: SpatialMapData, nodeId: string) {
  const childrenByParent = new Map<string, string[]>();
  for (const link of data.links) {
    if (!link.parentChild) {
      continue;
    }
    childrenByParent.set(link.source, [...(childrenByParent.get(link.source) ?? []), link.target]);
  }

  const descendants = new Set<string>();
  const pending = [...(childrenByParent.get(nodeId) ?? [])];
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || descendants.has(current)) {
      continue;
    }
    descendants.add(current);
    pending.push(...(childrenByParent.get(current) ?? []));
  }

  return descendants;
}

export async function readProjectRecordsFromDisk(): Promise<ProjectRecord[]> {
  const projectsDir = getProjectsDirPath();
  if (!existsSync(projectsDir)) {
    return [];
  }

  const entries = await readdir(projectsDir, { withFileTypes: true });
  const records: ProjectRecord[] = [];
  let didNormalizeAnyRecord = false;

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const projectFile = path.join(projectsDir, entry.name, "project.json");
    if (!existsSync(projectFile)) {
      continue;
    }

    const storedProject = await readStoredProjectJson(projectFile);
    const parsed = parseStoredProjectRecord(storedProject.value);
    records.push(parsed.record);
    didNormalizeAnyRecord ||= parsed.didNormalize || storedProject.didRecover;
  }

  if (didNormalizeAnyRecord) {
    await writeProjectRecordsToDisk(records);
  }

  return records;
}

export async function writeProjectRecordsToDisk(records: ProjectRecord[]) {
  const projectsDir = getProjectsDirPath();
  const expectedDirs = new Set(records.map((record) => safePathSegment(record.id)));

  await mkdir(projectsDir, { recursive: true });

  for (const record of records) {
    await writeProjectRecordToDisk(record);
  }

  const entries = await readdir(projectsDir, { withFileTypes: true });
  await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && !expectedDirs.has(entry.name))
      .map((entry) => rm(path.join(projectsDir, entry.name), { recursive: true, force: true })),
  );
}

export async function listProjectBackupFilesFromDisk(): Promise<ProjectBackupFileSummary[]> {
  const projectsDir = getProjectsDirPath();
  if (!existsSync(projectsDir)) {
    return [];
  }

  const entries = await readdir(projectsDir, { withFileTypes: true });
  const backups: ProjectBackupFileSummary[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const projectId = entry.name;
    const projectDir = path.join(projectsDir, projectId);
    const projectEntries = await readdir(projectDir, { withFileTypes: true });
    for (const projectEntry of projectEntries) {
      if (!projectEntry.isFile() || !isProjectBackupFilename(projectEntry.name)) {
        continue;
      }

      const backupFile = path.join(projectDir, projectEntry.name);
      const backupStat = await stat(backupFile);
      backups.push({
        projectId,
        filename: projectEntry.name,
        size: backupStat.size,
        updatedAt: backupStat.mtime.toISOString(),
      });
    }
  }

  return backups.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function readProjectBackupFileFromDisk(input: {
  projectId: string;
  filename: string;
}) {
  if (safePathSegment(input.projectId) !== input.projectId || !isProjectBackupFilename(input.filename)) {
    return null;
  }

  const backupFile = path.join(getProjectDataDir(input.projectId), input.filename);
  if (!existsSync(backupFile)) {
    return null;
  }

  const backupStat = await stat(backupFile);
  if (!backupStat.isFile()) {
    return null;
  }

  return {
    data: await readFile(backupFile),
    filename: input.filename,
    size: backupStat.size,
  };
}

async function writeProjectRecordToDisk(record: ProjectRecord) {
  const projectDir = getProjectDataDir(record.id);
  await mkdir(projectDir, { recursive: true });
  const projectFile = getProjectJsonFilePath(record.id);
  const tempFile = path.join(
    projectDir,
    `.project.${process.pid}.${Date.now()}.${randomUUID()}.tmp`,
  );
  await writeFile(tempFile, `${JSON.stringify(serializeProjectRecord(record), null, 2)}\n`, "utf8");
  await rename(tempFile, projectFile);
}

function isProjectBackupFilename(filename: string) {
  return (
    path.basename(filename) === filename &&
    filename.startsWith("project.json.corrupt-") &&
    filename.includes(".bak")
  );
}

async function readStoredProjectJson(projectFile: string) {
  const raw = await readFile(projectFile, "utf8");
  try {
    return { value: JSON.parse(raw) as unknown, didRecover: false };
  } catch (error) {
    const recoveredRaw = recoverFirstJsonObject(raw);
    if (!recoveredRaw) {
      throw error;
    }

    const recovered = JSON.parse(recoveredRaw) as unknown;
    const backupFile = await backupCorruptProjectFile(projectFile);
    console.warn(
      `Recovered ${projectFile} from trailing JSON data. Original file was preserved at ${backupFile}.`,
    );
    return { value: recovered, didRecover: true };
  }
}

function recoverFirstJsonObject(raw: string) {
  const start = raw.search(/\S/);
  if (start === -1 || raw[start] !== "{") {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaping = false;

  for (let index = start; index < raw.length; index += 1) {
    const char = raw[index];

    if (inString) {
      if (escaping) {
        escaping = false;
      } else if (char === "\\") {
        escaping = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char !== "}") {
      continue;
    }

    depth -= 1;
    if (depth === 0) {
      const end = index + 1;
      if (raw.slice(end).trim().length === 0) {
        return null;
      }
      return raw.slice(start, end);
    }
  }

  return null;
}

async function backupCorruptProjectFile(projectFile: string) {
  const backupFile = await createUniqueBackupFilePath(projectFile);
  await copyFile(projectFile, backupFile);
  return backupFile;
}

async function createUniqueBackupFilePath(projectFile: string) {
  const safeTimestamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
  const baseBackupFile = `${projectFile}.corrupt-${safeTimestamp}.bak`;
  if (!existsSync(baseBackupFile)) {
    return baseBackupFile;
  }

  let suffix = 2;
  while (existsSync(`${baseBackupFile}.${suffix}`)) {
    suffix += 1;
  }

  return `${baseBackupFile}.${suffix}`;
}

function sanitizeProjectName(name?: string) {
  const trimmed = name?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "Untitled Project";
}

function sanitizeProjectDescription(description?: string) {
  const trimmed = description?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "No project description yet.";
}

function createUniqueProjectId(name: string, records: ProjectRecord[]) {
  const baseId = slugifyProjectName(name);
  const existingIds = new Set(records.map((record) => record.id));

  if (!existingIds.has(baseId)) {
    return baseId;
  }

  let suffix = 2;
  while (existingIds.has(`${baseId}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseId}-${suffix}`;
}

function slugifyProjectName(name: string) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "project";
}

function reserveUniqueNodeId(label: string, type: string, existingIds: Set<string>) {
  const nodeId = createUniqueNodeId(label, type, existingIds);
  existingIds.add(nodeId);
  return nodeId;
}

function normalizeProjectMetadataSchemaRows(rows: ProjectMetadataSchemaRowInput[]) {
  const nextSchema = rows.map((row, index) => {
    const key = normalizeProjectNodeMetadataKey(row.key);
    if (key.length === 0) {
      throw new Error(`Metadata row ${index + 1} must have a key.`);
    }

    return {
      key,
      label: normalizeProjectNodeMetadataLabel(row.label, key),
      defaultValue: row.defaultValue.trim(),
    } satisfies ProjectNodeMetadataField;
  });
  const keys = new Set<string>();
  for (const field of nextSchema) {
    if (keys.has(field.key)) {
      throw new Error(`Duplicate metadata key "${field.key}".`);
    }
    keys.add(field.key);
  }

  return nextSchema;
}

function remapNodeMetadataForSchema(
  metadata: Record<string, string>,
  currentSchema: ProjectNodeMetadataField[],
  nextSchema: ProjectNodeMetadataField[],
  rows: ProjectMetadataSchemaRowInput[],
) {
  const currentMetadata = sanitizeNodeMetadata(metadata, currentSchema, {
    omitDefaultValues: true,
  });
  const nextEntries = rows.flatMap((row, index) => {
    const nextField = nextSchema[index];
    if (!nextField) {
      return [];
    }

    const originalKey = row.originalKey?.trim();
    const value =
      typeof originalKey === "string" && originalKey.length > 0
        ? currentMetadata[originalKey]
        : undefined;

    if (typeof value !== "string") {
      return [];
    }

    if (value === nextField.defaultValue) {
      return [];
    }

    return [[nextField.key, value] satisfies [string, string]];
  });

  return Object.fromEntries(nextEntries);
}

const IMAGE_EXTENSIONS_BY_MIME_TYPE: Record<string, string> = {
  "image/avif": ".avif",
  "image/gif": ".gif",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

function getImageFileExtension(file: File) {
  const extension = getImageSourceFileExtension(file.type);
  return extension;
}

function getImageSourceFileExtension(mimeType: string) {
  const extension = IMAGE_EXTENSIONS_BY_MIME_TYPE[mimeType];
  if (!extension) {
    throw new Error("Only AVIF, GIF, JPEG, PNG, and WebP images are supported.");
  }

  return extension;
}

function sanitizeImageOriginalName(name: string) {
  const sanitized = name.trim().replace(/[^\w. -]+/g, "_").slice(0, 160);
  return sanitized || "image";
}

export function getProjectNodeImageFilePath(input: {
  projectId: string;
  nodeId: string;
  filename: string;
}) {
  const imageDir = getProjectNodeImageDir(input.projectId, input.nodeId);
  const filePath = path.join(imageDir, input.filename);

  if (!filePath.startsWith(`${imageDir}${path.sep}`)) {
    throw new Error("Invalid image path.");
  }

  return filePath;
}

export function getProjectNodeImageDir(projectId: string, nodeId: string) {
  return path.join(getProjectDataDir(projectId), "images", getNodeImageDirSegment(nodeId));
}

export function safePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "_") || "unknown";
}

export function resolveProjectDataDir() {
  return resolveAppDataDir();
}

export function getProjectsDirPath() {
  return path.join(resolveProjectDataDir(), "projects");
}

export function getProjectDataDir(projectId: string) {
  return path.join(getProjectsDirPath(), safePathSegment(projectId));
}

export function getProjectJsonFilePath(projectId: string) {
  return path.join(getProjectDataDir(projectId), "project.json");
}
