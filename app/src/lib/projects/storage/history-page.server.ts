import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parseOperationLogEntry } from "~/lib/projects/project-record-format";
import type { ProjectOperationLogEntry } from "~/lib/projects/types";
import { compareHistoryFileNamesNewestFirst, parseHistoryFileName } from "./history-files";

export const HISTORY_DIR = "history";
export const DEFAULT_HISTORY_PAGE_SIZE = 50;
export const MAX_HISTORY_PAGE_SIZE = 500;

export interface HistoryPage {
  entries: ProjectOperationLogEntry[];
  // Pass as `before` to read the next older page; null when no older entries remain.
  nextCursor: string | null;
}

export class HistoryCursorError extends Error {
  constructor(readonly cursor: string) {
    super("History cursor is not valid.");
    this.name = "HistoryCursorError";
  }
}

export async function listHistoryFileNamesNewestFirst(historyDir: string) {
  const names = await readdir(historyDir).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return [] as string[];
    throw error;
  });
  return names.filter((fileName) => parseHistoryFileName(fileName)).sort(compareHistoryFileNamesNewestFirst);
}

// Newest first. History file names sort by time and never change, so a cursor
// (the last file name returned) stays valid while new entries are appended.
export async function readHistoryPage(
  projectDir: string,
  options: { before?: string; limit?: number; nodeId?: string } = {},
): Promise<HistoryPage> {
  const limit = Math.min(Math.max(options.limit ?? DEFAULT_HISTORY_PAGE_SIZE, 1), MAX_HISTORY_PAGE_SIZE);
  const before = options.before === undefined ? undefined : decodeCursor(options.before);
  const historyDir = path.join(projectDir, HISTORY_DIR);
  const fileNames = (await listHistoryFileNamesNewestFirst(historyDir))
    .filter((fileName) => before === undefined || fileName < before);

  const entries: ProjectOperationLogEntry[] = [];
  let lastFileName: string | null = null;
  for (const fileName of fileNames) {
    if (entries.length === limit) break;
    lastFileName = fileName;
    const raw = await readFile(path.join(historyDir, fileName), "utf8");
    const { payload: _payload, ...entry } = parseOperationLogEntry(JSON.parse(raw));
    if (options.nodeId && !entry.nodeIds.includes(options.nodeId)) continue;
    entries.push(entry);
  }

  const hasMore = lastFileName !== null && fileNames.indexOf(lastFileName) < fileNames.length - 1;
  return { entries, nextCursor: hasMore && lastFileName ? encodeCursor(lastFileName) : null };
}

function encodeCursor(fileName: string) {
  return Buffer.from(fileName, "utf8").toString("base64url");
}

function decodeCursor(cursor: string) {
  const fileName = Buffer.from(cursor, "base64url").toString("utf8");
  if (!parseHistoryFileName(fileName)) throw new HistoryCursorError(cursor);
  return fileName;
}
