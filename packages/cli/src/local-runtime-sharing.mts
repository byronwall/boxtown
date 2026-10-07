import { randomUUID } from "node:crypto";
import { realpath, mkdir, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CliError, exitCodes } from "../src/errors.mjs";
import { getPortCandidates, hasExited, startRuntime, stopChild, waitUntilReady } from "./local-runtime.mjs";
import {
  clearStaleRecord,
  createOwnership,
  delay,
  identifiesRuntime,
  isLoopbackURL,
  isPidAlive,
  lockName,
  onShutdownSignal,
  removeOwnedRecord,
  signalExitCode,
  tryReadRecord,
  withFolderGuard,
  writeOwnership,
  type RuntimeRecord,
} from "./local-runtime-records.mjs";

type Io = {
  stdout: { write: (value: string) => void };
  stderr: { write: (value: string) => void };
  env: NodeJS.ProcessEnv;
  cwd: string;
};

export type LocalConnection = Pick<RuntimeRecord, "dataDir" | "token" | "url" | "id">;
type ParsedLocal = {
  command: string[];
  options: Record<string, string | boolean | undefined>;
};

export async function dispatchLocal<T>(
  parsed: ParsedLocal,
  io: Io,
  action: (runtime: LocalConnection) => Promise<T>,
) {
  const folder = parsed.options.local;
  if (typeof folder !== "string" || !folder.trim()) {
    throw new CliError("Use --local <folder> to select local project data.", exitCodes.usage);
  }
  if (parsed.options.server !== undefined || parsed.options.token !== undefined) {
    throw new CliError("Use --local or remote --server/--token options, not both.", exitCodes.usage);
  }
  if (!new Set(["project", "node", "image"]).has(parsed.command[0])) {
    throw new CliError("--local is available for project, node, and image commands.", exitCodes.usage);
  }
  if (parsed.command[0] === "project" && ["link", "current", "unlink"].includes(parsed.command[1])) {
    throw new CliError("Project linking uses the remote CLI configuration. Choose a local project with --project <id>.", exitCodes.usage);
  }
  if (parsed.command[0] === "project" && parsed.command[1] === "create" && parsed.options.link) {
    throw new CliError("--link changes the remote project selection and cannot be used with --local.", exitCodes.usage);
  }
  return withLocalRuntime(folder, io, action);
}

export async function withLocalRuntime<T>(inputDir: string, io: Io, action: (runtime: LocalConnection) => Promise<T>) {
  const dataDir = await resolveDataDir(inputDir, io.cwd);
  const runtimeDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "runtime");
  const runtimeEntry = path.join(runtimeDir, "server", "index.mjs");

  const recordPath = path.join(dataDir, lockName);
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const existing = await tryReadRecord(recordPath);
    if (existing) {
      if (existing.dataDir !== dataDir) {
        throw new Error(`The local runtime record in ${dataDir} points to a different folder. Do not reuse it.`);
      }
      if (existing.mode === "viewer") {
        const live = await waitForViewer(existing, io.stderr);
        if (live) return action(connectionFrom(live));
      }
      if (existing.state === "stopping" && isPidAlive(existing.pid)) {
        await delay(250);
        continue;
      }
      if (existing.mode === "command" && isPidAlive(existing.pid)) {
        await delay(250);
        continue;
      }
      await clearStaleRecord(recordPath, existing, io.stderr);
      continue;
    }

    await stat(runtimeEntry).catch(() => {
      throw new Error("The packaged viewer runtime is missing. Reinstall pgm or run `pnpm pack` from the PGM checkout.");
    });

    const runtimeId = randomUUID();
    const record: RuntimeRecord = {
      id: runtimeId,
      pid: process.pid,
      dataDir,
      token: randomUUID(),
      url: "",
      mode: "command",
      state: "starting",
    };
    try {
      await withFolderGuard(dataDir, () => createOwnership(recordPath, record));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        await delay(100);
        continue;
      }
      throw error;
    }
    let child: ReturnType<typeof spawn> | undefined;
    let activeSignal: NodeJS.Signals | null = null;
    const onSignal = (signal: NodeJS.Signals) => {
      activeSignal = signal;
      child?.kill("SIGTERM");
    };
    const removeSignalHandlers = onShutdownSignal(onSignal);

    try {
      const ports = await getPortCandidates(undefined);
      let startupError: Error | null = null;
      for (const port of ports) {
        if (activeSignal) break;
        record.url = `http://127.0.0.1:${port}`;
        await writeOwnership(recordPath, record);
        if (activeSignal) break;
        child = startRuntime(runtimeEntry, dataDir, record.token, port, runtimeId, io);
        record.childPid = child.pid ?? undefined;
        await writeOwnership(recordPath, record);
        try {
          await waitUntilReady(record.url, child, io.stderr);
          if (!(await identifiesRuntime(record))) throw new Error("The local viewer did not confirm its folder identity.");
          startupError = null;
          break;
        } catch (error) {
          startupError = asError(error);
          await stopChild(child);
          child = undefined;
          record.childPid = undefined;
          if (!startupError.message.includes("EADDRINUSE")) break;
        }
      }
      if (activeSignal) {
        process.exitCode = signalExitCode(activeSignal);
        return undefined as T;
      }
      if (!child) throw startupError ?? new Error("No available local viewer port was found.");
      record.state = "ready";
      await writeOwnership(recordPath, record);
      io.stderr.write(`Using local viewer ${record.url}\n`);
      const result = await action(connectionFrom(record));
      if (activeSignal) process.exitCode = signalExitCode(activeSignal);
      return result;
    } catch (error) {
      if (!activeSignal) throw error;
      process.exitCode = signalExitCode(activeSignal);
      return undefined as T;
    } finally {
      removeSignalHandlers();
      if (child) {
        record.state = "stopping";
        await writeOwnership(recordPath, record).catch(() => {});
      }
      if (child && !hasExited(child)) await stopChild(child);
      await removeOwnedRecord(recordPath, runtimeId);
    }
  }
  throw new Error(`A local viewer command is still starting for ${dataDir}. Retry shortly.`);
}

async function waitForViewer(record: RuntimeRecord, stderr: Io["stderr"]) {
  if (!isLoopbackURL(record.url)) throw new Error("Local runtime record has an unsafe address.");
  if (!isPidAlive(record.pid)) return null;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (record.state === "ready" && await identifiesRuntime(record)) return record;
    await delay(250);
    const current = await tryReadRecord(path.join(record.dataDir, lockName));
    if (!current || current.id !== record.id) return null;
    Object.assign(record, current);
    if (!isPidAlive(record.pid)) return null;
  }
  throw new Error("The local viewer is still starting. Retry the command shortly.");
}

async function resolveDataDir(inputDir: string, cwd: string) {
  if (!inputDir.trim()) throw new Error("Use --local <folder> to select local project data.");
  const requested = path.resolve(cwd, inputDir);
  await mkdir(requested, { recursive: true });
  return realpath(requested);
}

function connectionFrom(record: RuntimeRecord): LocalConnection {
  return { id: record.id, dataDir: record.dataDir, token: record.token, url: record.url };
}

function asError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error));
}
