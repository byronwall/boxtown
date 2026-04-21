import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { GeneratedNodeBatch } from "~/lib/add-nodes/types";
import type { SpatialMapData } from "~/lib/spatial-map/types";
import { parseSpatialMapData } from "~/lib/spatial-map/validate";
import type { ProjectRecord, ProjectSummary } from "./types";

interface CreateProjectInput {
  name?: string;
}

interface SerializedProjectRecord {
  id: unknown;
  name: unknown;
  description?: unknown;
  createdAt: unknown;
  updatedAt: unknown;
  spatialMap: unknown;
}

const DATA_DIR = path.join(process.cwd(), "src", "data");
const PROJECTS_FILE = path.join(DATA_DIR, "projects.json");

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

export function mergeGeneratedSpatialMapData(
  current: SpatialMapData,
  generated: GeneratedNodeBatch,
): SpatialMapData {
  const existingIds = new Set(current.nodes.map((node) => node.id));
  const nodeIdMap = new Map<string, string>();
  const nextNodes = [...current.nodes];
  const existingLinkKeys = new Set(
    current.links.map((link) => `${link.source}::${link.target}::${link.kind ?? ""}`),
  );

  for (const node of generated.nodes) {
    const stableId = createUniqueNodeId(node.label, node.type, existingIds);
    existingIds.add(stableId);
    nodeIdMap.set(node.id, stableId);
    nextNodes.push({
      ...node,
      id: stableId,
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

    const normalizedKind = link.kind?.trim() || undefined;
    const key = `${source}::${target}::${normalizedKind ?? ""}`;
    if (existingLinkKeys.has(key)) {
      continue;
    }

    existingLinkKeys.add(key);
    nextLinks.push({
      source,
      target,
      kind: normalizedKind,
    });
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

async function readProjectRecordsFromDisk(): Promise<ProjectRecord[]> {
  const raw = await readFile(PROJECTS_FILE, "utf8");
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error("Invalid projects file: expected an array.");
  }

  return parsed.map(parseProjectRecord);
}

async function writeProjectRecordsToDisk(records: ProjectRecord[]) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(PROJECTS_FILE, `${JSON.stringify(records, null, 2)}\n`, "utf8");
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
