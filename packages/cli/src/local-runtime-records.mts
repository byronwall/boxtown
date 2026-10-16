import { createHash, randomUUID } from "node:crypto";
import { link, readFile, rename, unlink, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { describeNetworkError } from "../src/network-errors.mjs";

// Ownership records (`.pgm-local-runtime.json`) say which process serves a
// local data folder. Both `pgm viewer` and `--local` commands write them, and
// both clear a record whose owner is gone.

export type RuntimeRecord = {
  id: string;
  pid: number;
  childPid?: number;
  dataDir: string;
  token: string;
  url: string;
  mode: "viewer" | "command";
  state: "starting" | "ready" | "stopping";
};

type Stderr = { write: (value: string) => void };

export const lockName = ".pgm-local-runtime.json";

export async function removeOwnedRecord(recordPath: string, runtimeId: string) {
  await withFolderGuard(path.dirname(recordPath), async () => {
    try {
      const current = JSON.parse(await readFile(recordPath, "utf8")) as Partial<RuntimeRecord>;
      if (current.id === runtimeId) await unlink(recordPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  });
}

export async function createOwnership(recordPath: string, record: RuntimeRecord) {
  const tempPath = `${recordPath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(tempPath, JSON.stringify(record), { flag: "wx", mode: 0o600 });
    await link(tempPath, recordPath);
  } finally {
    await unlink(tempPath).catch(() => {});
  }
}

export async function writeOwnership(recordPath: string, record: RuntimeRecord) {
  const tempPath = `${recordPath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(tempPath, JSON.stringify(record), { flag: "wx", mode: 0o600 });
    await rename(tempPath, recordPath);
  } finally {
    await unlink(tempPath).catch(() => {});
  }
}

export async function withFolderGuard<T>(dataDir: string, action: () => Promise<T>): Promise<T> {
  const port = getFolderGuardPort(dataDir);
  const guard = net.createServer();
  await new Promise<void>((resolve, reject) => {
    guard.once("error", (error) => {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "EADDRINUSE") {
        reject(new Error("Another local runtime is changing folder ownership. Retry shortly."));
      } else if (code === "EPERM" || code === "EACCES") {
        reject(Object.assign(new Error(
          `Could not open loopback port ${port} to guard ${dataDir} (${code}). ` +
            "--local commands need permission to use local network sockets, even for reads. Allow local network access and retry.",
        ), { code }));
      } else {
        reject(error);
      }
    });
    guard.listen(port, "127.0.0.1", resolve);
  });
  try {
    return await action();
  } finally {
    await new Promise<void>((resolve) => guard.close(() => resolve()));
  }
}

export function getFolderGuardPort(dataDir: string) {
  const digest = createHash("sha256").update(dataDir).digest();
  return 44000 + digest.readUInt32BE(0) % 1000;
}

export async function tryReadRecord(recordPath: string): Promise<RuntimeRecord | null> {
  try {
    const value = JSON.parse(await readFile(recordPath, "utf8")) as Partial<RuntimeRecord>;
    if (typeof value.id !== "string" || !Number.isInteger(value.pid) || typeof value.dataDir !== "string") return null;
    if (typeof value.token !== "string" || typeof value.url !== "string") return null;
    return value as RuntimeRecord;
  } catch {
    return null;
  }
}

// Removes a record whose owner process has exited, first stopping its server
// if that server is still running and proves it belongs to the record.
export async function clearStaleRecord(recordPath: string, record: RuntimeRecord, stderr: Stderr) {
  await withFolderGuard(path.dirname(recordPath), async () => {
    const current = await tryReadRecord(recordPath);
    if (!current || current.id !== record.id) return;
    if (isPidAlive(current.pid)) throw new Error("A local runtime owns this folder but did not confirm its identity.");
    await clearOrphanedRuntime(current, stderr);
    const latest = await tryReadRecord(recordPath);
    if (latest?.id === record.id) await unlink(recordPath);
  });
}

async function clearOrphanedRuntime(record: RuntimeRecord, stderr: Stderr) {
  if (!record.childPid) {
    if (await runtimeResponds(record.url) || record.state === "starting") {
      throw new Error("A stale local startup has no saved child identity. Keep its record and check the server before retrying.");
    }
    return record;
  }
  if (!isPidAlive(record.childPid)) return record;
  if (!(await identifiesRuntime(record))) {
    throw new Error("A local runtime record is stale, but its server identity cannot be verified. Do not remove the record until that process stops.");
  }
  try {
    process.kill(record.childPid!, "SIGTERM");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
  for (let attempt = 0; attempt < 40 && isPidAlive(record.childPid); attempt += 1) await delay(100);
  if (isPidAlive(record.childPid)) throw new Error("The stale local viewer did not stop after SIGTERM.");
  stderr.write("Stopped a verified orphaned local viewer.\n");
  return record;
}

async function runtimeResponds(url: string) {
  if (!isLoopbackURL(url)) return false;
  try {
    await fetch(`${url}/api/local-runtime`, { signal: AbortSignal.timeout(500) });
    return true;
  } catch {
    return false;
  }
}

// `reason` and `message` are set when `ok` is false.
export type RuntimeProbe = {
  ok: boolean;
  reason?: "permission" | "refused" | "timeout" | "unreachable" | "http" | "mismatch" | "unsafe";
  code?: string | null;
  message?: string;
};

// Asks the runtime to prove which folder it serves, and says why when it can't.
export async function probeRuntime(record: Pick<RuntimeRecord, "url" | "token" | "id" | "dataDir">): Promise<RuntimeProbe> {
  if (!isLoopbackURL(record.url)) return { ok: false, reason: "unsafe", message: "the recorded address is not a local loopback URL." };
  let response: Response;
  try {
    response = await fetch(`${record.url}/api/local-runtime`, {
      headers: { authorization: `Bearer ${record.token}` },
      signal: AbortSignal.timeout(800),
    });
  } catch (error) {
    const described = describeNetworkError(error);
    return { ok: false, reason: described.kind, code: described.code, message: described.message };
  }
  if (!response.ok) return { ok: false, reason: "http", code: String(response.status), message: `it answered HTTP ${response.status}.` };
  const identity = await response.json().catch(() => ({})) as { id?: unknown; dataDir?: unknown };
  return identity.id === record.id && identity.dataDir === record.dataDir
    ? { ok: true }
    : { ok: false, reason: "mismatch", message: "it serves a different runtime or folder." };
}

export async function identifiesRuntime(record: RuntimeRecord) {
  return (await probeRuntime(record)).ok;
}

export function isLoopbackURL(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" && url.hostname === "127.0.0.1" && url.pathname === "/";
  } catch {
    return false;
  }
}

export function isPidAlive(pid?: number) {
  if (!Number.isInteger(pid) || !pid || pid < 1) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Ctrl+C sends SIGINT, `kill` sends SIGTERM, and closing the terminal window
// sends SIGHUP. Each one must still reach the cleanup that removes the record.
export const shutdownSignals = ["SIGINT", "SIGTERM", "SIGHUP"] as const;

export function signalExitCode(signal: NodeJS.Signals) {
  if (signal === "SIGINT") return 130;
  if (signal === "SIGHUP") return 129;
  return 143;
}

export function onShutdownSignal(handler: (signal: NodeJS.Signals) => void) {
  const listeners = shutdownSignals.map((signal) => {
    const listener = () => handler(signal);
    process.on(signal, listener);
    return [signal, listener] as const;
  });
  return () => {
    for (const [signal, listener] of listeners) process.off(signal, listener);
  };
}
