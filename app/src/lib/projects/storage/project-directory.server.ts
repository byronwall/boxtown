import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import {
  mergeStoredNodeTypes,
  parseOperationLogEntry,
  parseOperationState,
} from "~/lib/projects/project-record-format";
import { parseSpatialMapData } from "~/lib/spatial-map/validate";
import { getNodeImageDirSegment, hashString } from "~/lib/projects/node-id";
import type { ProjectOperationLogEntry, ProjectRecord } from "~/lib/projects/types";
import {
  assignHistoryFileNames,
  compareHistoryFileNamesNewestFirst,
  parseHistoryFileName,
} from "./history-files";
import { parseNodeFile, serializeNodeFile } from "./node-file";
import { assembleProjectGraph } from "./project-integrity";
import {
  formatJsonFile,
  hasMergeConflictMarkers,
  readStoredProjectJson,
  writeFileIfChanged,
} from "./stored-files.server";

// Project folder layout (format version 2):
//   project.json   name, description, metadata fields, node types
//   nodes/*.md     one node per file
//   history/*.json one activity entry per file
//   images/<node>/ uploaded images
// Nothing here is rewritten unless its content changed, so git sees only real edits.

export const PROJECT_FILE_FORMAT = "product-grid-project";
export const PROJECT_FILE_VERSION = 2;

const NODES_DIR = "nodes";
const HISTORY_DIR = "history";
const GITIGNORE = `# Written by Product Grid: keep local backups and interrupted writes out of git.\n*.bak\n*.tmp\n`;

export type StoredProject =
  | { layout: "missing" }
  | { layout: "legacy"; value: unknown; didRecover: boolean }
  | { layout: "per-node"; record: ProjectRecord; didRecover: boolean };

export class ProjectStorageError extends Error {
  constructor(
    readonly projectDir: string,
    readonly problems: string[],
  ) {
    super(
      `Project files in ${projectDir} need attention:\n${problems.map((problem) => `  - ${problem}`).join("\n")}`,
    );
    this.name = "ProjectStorageError";
  }
}

export async function readProjectDirectory(
  projectDir: string,
  options: { backupOnRecovery?: boolean } = {},
): Promise<StoredProject> {
  const projectFile = path.join(projectDir, "project.json");
  if (!existsSync(projectFile)) return { layout: "missing" };

  const stored = await readStoredProjectJson(projectFile, options.backupOnRecovery ?? true);
  if (!isPerNodeProjectFile(stored.value)) {
    return { layout: "legacy", value: stored.value, didRecover: stored.didRecover };
  }
  if (stored.value.formatVersion > PROJECT_FILE_VERSION) {
    throw new Error(
      `${projectFile} uses project format ${stored.value.formatVersion}. Update Product Grid to open it.`,
    );
  }

  const problems: string[] = [];
  const nodeFiles = await readNodeFiles(projectDir, problems);
  const operationLog = await readHistoryFiles(projectDir, problems);
  if (problems.length > 0) throw new ProjectStorageError(projectDir, problems);

  const graph = assembleProjectGraph(nodeFiles);
  const project = stored.value;
  const nodeMetadataSchema = dedupeBy(project.nodeMetadataSchema, "key", graph.issues);
  const state = parseOperationState({
    nodeMetadataSchema,
    nodeTypeSchema: dedupeBy(project.nodeTypeSchema, "name", graph.issues),
    spatialMap: { nodes: graph.nodes, links: graph.links },
  });
  warnOnce(projectDir, graph.issues);

  const newestActivity = operationLog[0]?.createdAt ?? "";
  return {
    layout: "per-node",
    didRecover: stored.didRecover,
    record: {
      id: requireString(project.id, "id", projectFile),
      name: requireString(project.name, "name", projectFile),
      description: typeof project.description === "string" ? project.description : "No project description yet.",
      createdAt: requireString(project.createdAt, "createdAt", projectFile),
      // Derived rather than stored: a shared timestamp would conflict on every merge.
      updatedAt: newestActivity > String(project.createdAt) ? newestActivity : String(project.createdAt),
      nodeMetadataSchema: state.nodeMetadataSchema,
      nodeTypeSchema: mergeStoredNodeTypes(
        state.nodeTypeSchema,
        state.spatialMap.nodes.map((node) => node.type),
      ),
      spatialMap: state.spatialMap,
      operationLog,
    },
  };
}

export async function writeProjectDirectory(projectDir: string, record: ProjectRecord) {
  const nodesDir = path.join(projectDir, NODES_DIR);
  const historyDir = path.join(projectDir, HISTORY_DIR);
  await mkdir(nodesDir, { recursive: true });
  await mkdir(historyDir, { recursive: true });

  const gitignoreFile = path.join(projectDir, ".gitignore");
  if (!existsSync(gitignoreFile)) await writeFileIfChanged(gitignoreFile, GITIGNORE);

  await writeNodeFiles(nodesDir, record);
  await writeHistoryFiles(historyDir, record.operationLog);

  // project.json goes last: during a migration it marks the new layout as complete.
  await writeFileIfChanged(
    path.join(projectDir, "project.json"),
    formatJsonFile({
      format: PROJECT_FILE_FORMAT,
      formatVersion: PROJECT_FILE_VERSION,
      id: record.id,
      name: record.name,
      description: record.description,
      createdAt: record.createdAt,
      nodeMetadataSchema: record.nodeMetadataSchema,
      nodeTypeSchema: record.nodeTypeSchema,
    }),
  );
}

async function readNodeFiles(projectDir: string, problems: string[]) {
  const nodesDir = path.join(projectDir, NODES_DIR);
  const files = [];
  const fileByNodeId = new Map<string, string>();

  for (const fileName of await listFiles(nodesDir, ".md")) {
    const fileLabel = `${NODES_DIR}/${fileName}`;
    const raw = await readFile(path.join(nodesDir, fileName), "utf8");
    if (hasMergeConflictMarkers(raw)) {
      problems.push(`${fileLabel} has unresolved git merge conflict markers.`);
      continue;
    }

    try {
      const parsed = parseNodeFile(raw, fileLabel);
      const nodeId = parsed.node.id;
      if (typeof nodeId !== "string" || nodeId.trim().length === 0) {
        problems.push(`${fileLabel} is missing a node "id".`);
        continue;
      }
      const otherFile = fileByNodeId.get(nodeId);
      if (otherFile) {
        problems.push(`${fileLabel} and ${otherFile} both use node id "${nodeId}".`);
        continue;
      }
      // Validate per file so a bad field names the file it came from.
      parseSpatialMapData({ nodes: [parsed.node], links: [] });
      fileByNodeId.set(nodeId, fileLabel);
      files.push({ ...parsed, fileLabel });
    } catch (error) {
      const message = (error as Error).message;
      problems.push(message.startsWith(fileLabel) ? message : `${fileLabel}: ${message}`);
    }
  }

  return files.sort((left, right) => compareText(String(left.node.id), String(right.node.id)));
}

async function readHistoryFiles(projectDir: string, problems: string[]) {
  const historyDir = path.join(projectDir, HISTORY_DIR);
  const entries: ProjectOperationLogEntry[] = [];
  const seenIds = new Set<string>();
  const fileNames = (await listFiles(historyDir, ".json"))
    .filter((fileName) => parseHistoryFileName(fileName))
    .sort(compareHistoryFileNamesNewestFirst);

  for (const fileName of fileNames) {
    const fileLabel = `${HISTORY_DIR}/${fileName}`;
    const raw = await readFile(path.join(historyDir, fileName), "utf8");
    if (hasMergeConflictMarkers(raw)) {
      problems.push(`${fileLabel} has unresolved git merge conflict markers.`);
      continue;
    }

    try {
      const { payload: _payload, ...entry } = parseOperationLogEntry(JSON.parse(raw));
      if (seenIds.has(entry.id)) continue;
      seenIds.add(entry.id);
      entries.push(entry);
    } catch (error) {
      problems.push(`${fileLabel}: ${(error as Error).message}`);
    }
  }

  return entries;
}

async function writeNodeFiles(nodesDir: string, record: ProjectRecord) {
  const fileNames = assignNodeFileNames(record.spatialMap.nodes.map((node) => node.id));
  const expected = new Set<string>();

  for (const node of record.spatialMap.nodes) {
    const fileName = fileNames.get(node.id)!;
    expected.add(fileName);
    await writeFileIfChanged(path.join(nodesDir, fileName), serializeNodeFile(node, record.spatialMap.links));
  }

  for (const fileName of await listFiles(nodesDir, ".md")) {
    if (!expected.has(fileName)) await rm(path.join(nodesDir, fileName), { force: true });
  }
}

async function writeHistoryFiles(historyDir: string, operationLog: ProjectOperationLogEntry[]) {
  const existing = (await listFiles(historyDir, ".json")).filter((fileName) => parseHistoryFileName(fileName));
  const fileNames = assignHistoryFileNames(operationLog, existing);
  const expected = new Set(fileNames.values());
  const existingSet = new Set(existing);

  for (const entry of operationLog) {
    const fileName = fileNames.get(entry.id)!;
    // Entries are write-once; an existing file already holds this entry.
    if (existingSet.has(fileName)) continue;
    const { payload: _payload, ...entryWithoutState } = entry;
    await writeFileIfChanged(path.join(historyDir, fileName), formatJsonFile(entryWithoutState));
  }

  for (const fileName of existing) {
    if (!expected.has(fileName)) await rm(path.join(historyDir, fileName), { force: true });
  }
}

// Node ids map to readable file names. Ids that would share a name on a
// case-insensitive file system get a short hash so each node keeps its own file.
function assignNodeFileNames(nodeIds: string[]) {
  const idsBySegment = new Map<string, string[]>();
  for (const nodeId of nodeIds) {
    const key = getNodeImageDirSegment(nodeId).toLowerCase();
    idsBySegment.set(key, [...(idsBySegment.get(key) ?? []), nodeId]);
  }

  return new Map(
    nodeIds.map((nodeId) => {
      const segment = getNodeImageDirSegment(nodeId);
      const shared = (idsBySegment.get(segment.toLowerCase())?.length ?? 0) > 1;
      return [nodeId, shared ? `${segment}-${hashString(nodeId).slice(0, 6)}.md` : `${segment}.md`];
    }),
  );
}

async function listFiles(dir: string, extension: string) {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(extension) && !entry.name.startsWith("."))
    .map((entry) => entry.name);
}

interface PerNodeProjectFile {
  format: typeof PROJECT_FILE_FORMAT;
  formatVersion: number;
  id?: unknown;
  name?: unknown;
  description?: unknown;
  createdAt?: unknown;
  nodeMetadataSchema?: unknown;
  nodeTypeSchema?: unknown;
}

function isPerNodeProjectFile(value: unknown): value is PerNodeProjectFile {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as PerNodeProjectFile).format === PROJECT_FILE_FORMAT &&
    typeof (value as PerNodeProjectFile).formatVersion === "number"
  );
}

// Two branches that add the same field or node type can both land in project.json.
function dedupeBy(rows: unknown, key: string, issues: string[]) {
  if (!Array.isArray(rows)) return rows;
  const seen = new Set<unknown>();
  return rows.filter((row) => {
    const value = typeof row === "object" && row !== null ? (row as Record<string, unknown>)[key] : undefined;
    if (value === undefined || !seen.has(value)) {
      seen.add(value);
      return true;
    }
    issues.push(`project.json: kept the first of two entries for ${key} "${String(value)}".`);
    return false;
  });
}

function requireString(value: unknown, field: string, projectFile: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${projectFile} is missing "${field}".`);
  }
  return value;
}

function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

const reportedIssues = new Set<string>();

function warnOnce(projectDir: string, issues: string[]) {
  const fresh = issues.filter((issue) => !reportedIssues.has(`${projectDir}\n${issue}`));
  if (fresh.length === 0) return;
  for (const issue of fresh) reportedIssues.add(`${projectDir}\n${issue}`);
  console.warn(
    `Repaired project data in ${projectDir} (saved on the next edit):\n${fresh.map((issue) => `  - ${issue}`).join("\n")}`,
  );
}
