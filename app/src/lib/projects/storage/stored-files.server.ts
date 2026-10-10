import { existsSync } from "node:fs";
import { copyFile, readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

// Replaces a file in one step so readers never see a half-written file.
export async function writeFileAtomic(filePath: string, content: string) {
  const tempFile = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  await writeFile(tempFile, content, "utf8");
  await rename(tempFile, filePath);
}

// Writes only when the content changed, so untouched files keep a clean git status.
export async function writeFileIfChanged(filePath: string, content: string) {
  if (existsSync(filePath) && (await readFile(filePath, "utf8")) === content) {
    return false;
  }
  await writeFileAtomic(filePath, content);
  return true;
}

export function formatJsonFile(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

const BACKUP_KINDS = ["corrupt", "v1"] as const;
type BackupKind = (typeof BACKUP_KINDS)[number];

export function isProjectBackupFilename(filename: string) {
  return (
    path.basename(filename) === filename &&
    BACKUP_KINDS.some((kind) => filename.startsWith(`project.json.${kind}-`)) &&
    filename.includes(".bak")
  );
}

export async function backupProjectFile(projectFile: string, kind: BackupKind) {
  const backupFile = createUniqueBackupFilePath(projectFile, kind);
  await copyFile(projectFile, backupFile);
  return backupFile;
}

function createUniqueBackupFilePath(projectFile: string, kind: BackupKind) {
  const safeTimestamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
  const baseBackupFile = `${projectFile}.${kind}-${safeTimestamp}.bak`;
  if (!existsSync(baseBackupFile)) {
    return baseBackupFile;
  }

  let suffix = 2;
  while (existsSync(`${baseBackupFile}.${suffix}`)) {
    suffix += 1;
  }

  return `${baseBackupFile}.${suffix}`;
}

export async function readStoredProjectJson(projectFile: string, backupOnRecovery = true) {
  const raw = await readFile(projectFile, "utf8");
  try {
    return { value: JSON.parse(raw) as unknown, didRecover: false };
  } catch (error) {
    // Never "recover" half of a conflicted merge; that would silently drop one side.
    const recoveredRaw = hasMergeConflictMarkers(raw) ? null : recoverFirstJsonObject(raw);
    if (!recoveredRaw) {
      throw new Error(`${projectFile} is not valid JSON${describeMergeConflict(raw)}.`, { cause: error });
    }

    const recovered = JSON.parse(recoveredRaw) as unknown;
    if (backupOnRecovery) {
      const backupFile = await backupProjectFile(projectFile, "corrupt");
      console.warn(
        `Recovered ${projectFile} from trailing JSON data. Original file was preserved at ${backupFile}.`,
      );
    }
    return { value: recovered, didRecover: true };
  }
}

// Git leaves these markers in files it could not merge.
export function hasMergeConflictMarkers(raw: string) {
  return /^<{7}(?: |$)/m.test(raw) && /^>{7}(?: |$)/m.test(raw);
}

function describeMergeConflict(raw: string) {
  return hasMergeConflictMarkers(raw) ? " (it still has git merge conflict markers)" : "";
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
