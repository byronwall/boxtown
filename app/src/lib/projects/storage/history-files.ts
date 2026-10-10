import type { ProjectOperationLogEntry } from "~/lib/projects/types";

// Each history entry is its own write-once file. Names sort chronologically, so
// branches that both add entries merge without touching the same file:
//   <yyyymmddThhmmssSSSZ>-<ordinal>-<entry id>.json
// The ordinal keeps entries that share a timestamp (such as backfilled ones) in order.

const HISTORY_FILE_PATTERN = /^(\d{8}T\d{9}Z)-(\d{4})-(.+)\.json$/;
const FALLBACK_STAMP = "00000000T000000000Z";

export interface HistoryFileName {
  stamp: string;
  ordinal: number;
  entryId: string;
}

export function parseHistoryFileName(filename: string): HistoryFileName | null {
  const match = HISTORY_FILE_PATTERN.exec(filename);
  if (!match) return null;
  return { stamp: match[1]!, ordinal: Number(match[2]), entryId: match[3]! };
}

export function compareHistoryFileNamesNewestFirst(left: string, right: string) {
  return left < right ? 1 : left > right ? -1 : 0;
}

// Keeps the names of entries already on disk and names new ones. `entries` is newest first.
export function assignHistoryFileNames(
  entries: ProjectOperationLogEntry[],
  existingFileNames: Iterable<string>,
): Map<string, string> {
  const existingBySafeId = new Map<string, string>();
  const highestOrdinalByStamp = new Map<string, number>();

  for (const fileName of existingFileNames) {
    const parsed = parseHistoryFileName(fileName);
    if (!parsed) continue;
    existingBySafeId.set(parsed.entryId, fileName);
    highestOrdinalByStamp.set(
      parsed.stamp,
      Math.max(highestOrdinalByStamp.get(parsed.stamp) ?? -1, parsed.ordinal),
    );
  }

  const fileNameByEntryId = new Map<string, string>();
  // Name oldest first so entries sharing a timestamp get ascending ordinals.
  for (const entry of [...entries].reverse()) {
    const safeId = toFileSafeId(entry.id);
    const existing = existingBySafeId.get(safeId);
    if (existing) {
      fileNameByEntryId.set(entry.id, existing);
      continue;
    }

    const stamp = toHistoryStamp(entry.createdAt);
    const ordinal = (highestOrdinalByStamp.get(stamp) ?? -1) + 1;
    highestOrdinalByStamp.set(stamp, ordinal);
    const fileName = `${stamp}-${String(ordinal).padStart(4, "0")}-${safeId}.json`;
    existingBySafeId.set(safeId, fileName);
    fileNameByEntryId.set(entry.id, fileName);
  }

  return fileNameByEntryId;
}

function toHistoryStamp(createdAt: string) {
  const time = Date.parse(createdAt);
  if (Number.isNaN(time)) return FALLBACK_STAMP;
  return new Date(time).toISOString().replace(/[-:.]/g, "");
}

function toFileSafeId(id: string) {
  return id.replace(/[^a-zA-Z0-9_-]+/g, "_") || "entry";
}
