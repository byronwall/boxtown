import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { GeneratedNodeBatch } from "~/lib/add-nodes/types";
import { createParentChildLink, getLinkKey } from "~/lib/spatial-map/links";
import type { MapNodeImage, SpatialMapData } from "~/lib/spatial-map/types";
import { parseSpatialMapData } from "~/lib/spatial-map/validate";
import { splitMarkdownIntoHeadingSections } from "./context-node-markdown";
import type { ProjectRecord, ProjectSummary } from "./types";

interface CreateProjectInput {
  name?: string;
}

interface UpdateProjectNodeContextInput {
  projectId: string;
  nodeId: string;
  context: string;
}

interface CreateContextNodeInput {
  projectId: string;
  label: string;
  context: string;
  splitByHeadingLevel?: boolean;
  maxHeadingDepth?: number;
}

interface DeleteProjectNodeInput {
  projectId: string;
  nodeId: string;
}

interface AddProjectNodeImagesInput {
  projectId: string;
  nodeId: string;
  images: File[];
}

interface ProjectNodeImageSource {
  originalName: string;
  mimeType: string;
  size: number;
  data: Buffer;
}

interface AddProjectNodeImageSourcesInput {
  projectId: string;
  nodeIds: string[];
  images: ProjectNodeImageSource[];
}

interface SerializedProjectRecord {
  id: unknown;
  name: unknown;
  description?: unknown;
  createdAt: unknown;
  updatedAt: unknown;
  spatialMap: unknown;
}

export function createBlankSpatialMapData(): SpatialMapData {
  return {
    nodes: [],
    links: [],
  };
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
  const records = await readProjectRecordsFromDisk();
  return records.find((record) => record.id === projectId) ?? null;
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
    spatialMap: createBlankSpatialMapData(),
  };

  records.push(nextRecord);
  await writeProjectRecordsToDisk(records);

  return nextRecord;
}

export async function deleteProjectOnDisk(projectId: string): Promise<void> {
  const records = await readProjectRecordsFromDisk();
  const nextRecords = records.filter((record) => record.id !== projectId);

  if (nextRecords.length === records.length) {
    throw new Error("Project not found.");
  }

  await writeProjectRecordsToDisk(nextRecords);
}

export function mergeGeneratedSpatialMapData(
  current: SpatialMapData,
  generated: GeneratedNodeBatch,
): SpatialMapData {
  const existingIds = new Set(current.nodes.map((node) => node.id));
  const nodeIdMap = new Map<string, string>();
  const nextNodes = [...current.nodes];
  const existingLinkKeys = new Set(current.links.map(getLinkKey));

  for (const node of generated.nodes) {
    const stableId = createUniqueNodeId(node.label, node.type, existingIds);
    existingIds.add(stableId);
    nodeIdMap.set(node.id, stableId);
    nextNodes.push({
      ...node,
      id: stableId,
      contextMode: node.contextMode ?? (node.type === "note" ? "context-only" : "structured"),
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
}) {
  const records = await readProjectRecordsFromDisk();
  const recordIndex = records.findIndex((record) => record.id === input.projectId);

  if (recordIndex === -1) {
    throw new Error("Project not found.");
  }

  const current = records[recordIndex];
  const nextRecord: ProjectRecord = {
    ...current,
    updatedAt: new Date().toISOString(),
    spatialMap: mergeGeneratedSpatialMapData(current.spatialMap, input.generated),
  };

  records[recordIndex] = nextRecord;
  await writeProjectRecordsToDisk(records);
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

  const nextRecord: ProjectRecord = {
    ...current,
    updatedAt: new Date().toISOString(),
    spatialMap: {
      ...current.spatialMap,
      nodes: nextNodes,
    },
  };

  records[recordIndex] = nextRecord;
  await writeProjectRecordsToDisk(records);
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

  const nextRecord: ProjectRecord = {
    ...current,
    updatedAt: now,
    spatialMap: {
      ...current.spatialMap,
      nodes: nextNodes,
    },
  };

  records[recordIndex] = nextRecord;
  await writeProjectRecordsToDisk(records);
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

  const nextRecord: ProjectRecord = {
    ...current,
    updatedAt: now,
    spatialMap: {
      ...current.spatialMap,
      nodes: nextNodes,
    },
  };

  records[recordIndex] = nextRecord;
  await writeProjectRecordsToDisk(records);
  return nextRecord;
}

export async function createContextNodeOnDisk(
  input: CreateContextNodeInput,
): Promise<{ nodeId: string; project: ProjectRecord; createdNodeCount: number }> {
  const records = await readProjectRecordsFromDisk();
  const recordIndex = records.findIndex((record) => record.id === input.projectId);

  if (recordIndex === -1) {
    throw new Error("Project not found.");
  }

  const current = records[recordIndex];
  const existingIds = new Set(current.spatialMap.nodes.map((node) => node.id));
  const baseLabel = input.label.trim();
  const createdNodes = input.splitByHeadingLevel
    ? createContextNodeTree({
        label: baseLabel,
        markdown: input.context,
        existingIds,
        maxHeadingDepth: input.maxHeadingDepth,
      })
    : createSingleContextNode({
        label: baseLabel,
        context: input.context,
        existingIds,
      });

  const nextRecord: ProjectRecord = {
    ...current,
    updatedAt: new Date().toISOString(),
    spatialMap: {
      ...current.spatialMap,
      nodes: [...current.spatialMap.nodes, ...createdNodes.nodes],
      links: [...current.spatialMap.links, ...createdNodes.links],
    },
  };

  records[recordIndex] = nextRecord;
  await writeProjectRecordsToDisk(records);
  return {
    nodeId: createdNodes.rootNodeId,
    project: nextRecord,
    createdNodeCount: createdNodes.nodes.length,
  };
}

function createSingleContextNode(input: {
  label: string;
  context: string;
  existingIds: Set<string>;
}) {
  const nodeId = reserveUniqueNodeId(input.label, "note", input.existingIds);

  return {
    rootNodeId: nodeId,
    nodes: [
      createContextNoteNode({
        id: nodeId,
        label: input.label,
        depth: 2,
        context: input.context,
      }),
    ],
    links: [],
  };
}

function createContextNodeTree(input: {
  label: string;
  markdown: string;
  existingIds: Set<string>;
  maxHeadingDepth?: number;
}) {
  const { preamble, sections } = splitMarkdownIntoHeadingSections(input.markdown, {
    maxHeadingDepth: input.maxHeadingDepth,
  });
  if (sections.length === 0) {
    return createSingleContextNode({
      label: input.label,
      context: input.markdown,
      existingIds: input.existingIds,
    });
  }

  const rootNodeId = reserveUniqueNodeId(input.label, "note", input.existingIds);
  const nodes = [
    createContextNoteNode({
      id: rootNodeId,
      label: input.label,
      depth: 2,
      context: preamble,
    }),
  ];
  const sectionNodeIds: string[] = [];
  const sectionDepths: number[] = [];
  const links: SpatialMapData["links"] = [];

  for (const section of sections) {
    const nodeId = reserveUniqueNodeId(section.label, "note", input.existingIds);
    const parentNodeId =
      section.parentIndex === null ? rootNodeId : sectionNodeIds[section.parentIndex] ?? rootNodeId;
    const parentDepth =
      section.parentIndex === null ? 2 : sectionDepths[section.parentIndex] ?? 2;
    const nodeDepth = parentDepth + 1;

    sectionNodeIds.push(nodeId);
    sectionDepths.push(nodeDepth);
    nodes.push(
      createContextNoteNode({
        id: nodeId,
        label: section.label,
        depth: nodeDepth,
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
  depth: number;
  context: string;
}) {
  return {
    id: input.id,
    label: input.label,
    type: "note",
    depth: input.depth,
    purpose: "Loose context, notes, and markdown content that needs a home in the map.",
    implementation: "Freeform markdown note stored directly on the node for AI or human editing.",
    context: input.context,
    rawContext: input.context,
    contextMode: "context-only" as const,
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

  const nextRecord: ProjectRecord = {
    ...current,
    updatedAt: new Date().toISOString(),
    spatialMap: {
      nodes: current.spatialMap.nodes.filter((node) => node.id !== input.nodeId),
      links: current.spatialMap.links.filter(
        (link) => link.source !== input.nodeId && link.target !== input.nodeId,
      ),
    },
  };

  records[recordIndex] = nextRecord;
  await writeProjectRecordsToDisk(records);
  return nextRecord;
}

export async function readProjectRecordsFromDisk(): Promise<ProjectRecord[]> {
  const projectsDir = getProjectsDirPath();
  if (!existsSync(projectsDir)) {
    return [];
  }

  const entries = await readdir(projectsDir, { withFileTypes: true });
  const records: ProjectRecord[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const projectFile = path.join(projectsDir, entry.name, "project.json");
    if (!existsSync(projectFile)) {
      continue;
    }

    records.push(parseProjectRecord(JSON.parse(await readFile(projectFile, "utf8"))));
  }

  return records;
}

export async function writeProjectRecordsToDisk(records: ProjectRecord[]) {
  const projectsDir = getProjectsDirPath();
  const expectedDirs = new Set(records.map((record) => safePathSegment(record.id)));

  await mkdir(projectsDir, { recursive: true });

  for (const record of records) {
    const projectDir = getProjectDataDir(record.id);
    await mkdir(projectDir, { recursive: true });
    await writeFile(getProjectJsonFilePath(record.id), `${JSON.stringify(record, null, 2)}\n`, "utf8");
  }

  const entries = await readdir(projectsDir, { withFileTypes: true });
  await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && !expectedDirs.has(entry.name))
      .map((entry) => rm(path.join(projectsDir, entry.name), { recursive: true, force: true })),
  );
}

function parseProjectRecord(value: SerializedProjectRecord): ProjectRecord {
  if (
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string"
  ) {
    throw new Error("Invalid project record in projects file.");
  }

  return {
    id: value.id,
    name: value.name,
    description:
      typeof value.description === "string"
        ? value.description
        : "No project description yet.",
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    spatialMap: parseSpatialMapData(value.spatialMap),
  };
}

function sanitizeProjectName(name?: string) {
  const trimmed = name?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "Untitled Project";
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

function createUniqueNodeId(label: string, type: string, existingIds: Set<string>) {
  const baseId = slugifyProjectName(`${type}-${label}`);
  if (!existingIds.has(baseId)) {
    return baseId;
  }

  let suffix = 2;
  while (existingIds.has(`${baseId}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseId}-${suffix}`;
}


function reserveUniqueNodeId(label: string, type: string, existingIds: Set<string>) {
  const nodeId = createUniqueNodeId(label, type, existingIds);
  existingIds.add(nodeId);
  return nodeId;
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
  return path.join(getProjectDataDir(projectId), "images", safePathSegment(nodeId));
}

export function safePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "_") || "unknown";
}

export function resolveProjectDataDir() {
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, "data"),
    path.join(cwd, "app", "data"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
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
