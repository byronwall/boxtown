import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, realpath, stat } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  clearStaleRecord,
  createOwnership,
  getFolderGuardPort,
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

export {
  createOwnership,
  getFolderGuardPort,
  removeOwnedRecord,
  withFolderGuard,
  writeOwnership,
  type RuntimeRecord,
};

type Io = {
  stdout: { write: (value: string) => void };
  stderr: { write: (value: string) => void };
  env: NodeJS.ProcessEnv;
  cwd: string;
};

type RuntimeOptions = {
  dataDir?: string | boolean;
  noOpen?: boolean;
  port?: string | boolean;
};

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtimeDir = path.join(packageRoot, "runtime");
const tokenScopes = "project:read|project:write|node:read|node:write|image:read|image:write";

export async function runViewer(options: RuntimeOptions, io: Io) {
  const inputDataDir = requireString(options.dataDir ?? "pgm/data", "Use --data-dir <folder> to select local project data.");
  const runtimeEntry = path.join(runtimeDir, "server", "index.mjs");
  await stat(runtimeEntry).catch(() => {
    throw new Error("The packaged viewer runtime is missing. Reinstall pgm or run `pnpm pack` from the PGM checkout.");
  });

  const requestedPath = path.resolve(io.cwd, inputDataDir);
  await mkdir(requestedPath, { recursive: true });
  const dataDir = await realpath(requestedPath);
  const recordPath = path.join(dataDir, lockName);
  const ports = await getPortCandidates(options.port, getFolderGuardPort(dataDir));
  const runtimeId = randomUUID();
  const token = randomUUID();
  let child;
  let activeSignal: NodeJS.Signals | null = null;
  const onSignal = (signal: NodeJS.Signals) => {
    activeSignal = signal;
    child?.kill("SIGTERM");
  };
  const removeSignalHandlers = onShutdownSignal(onSignal);
  let recordWritten = false;
  const record: RuntimeRecord = {
    id: runtimeId,
    pid: process.pid,
    childPid: undefined,
    dataDir,
    token,
    url: "",
    mode: "viewer",
    state: "starting",
  };

  try {
    await claimViewerOwnership(recordPath, record, io.stderr);
    recordWritten = true;

    let startupError: Error | null = null;

    for (const port of ports) {
      if (activeSignal) throw new Error("Local viewer startup was interrupted.");
      record.url = `http://127.0.0.1:${port}`;
      await writeOwnership(recordPath, record);
      recordWritten = true;
      if (activeSignal) throw new Error("Local viewer startup was interrupted.");
      child = startRuntime(runtimeEntry, dataDir, token, port, runtimeId, io);
      record.childPid = child.pid ?? undefined;
      await writeOwnership(recordPath, record);
      try {
        await waitUntilReady(record.url, child, io.stderr);
        startupError = null;
        break;
      } catch (error) {
        startupError = error instanceof Error ? error : new Error(String(error));
        await stopChild(child);
        child = undefined;
        if (options.port || !startupError.message.includes("EADDRINUSE")) break;
      }
    }

    if (!child) {
      throw startupError ?? new Error("No available local viewer port was found.");
    }

    record.state = "ready";
    await writeOwnership(recordPath, record);
    io.stdout.write(`Viewer: ${record.url}/\nData folder: ${dataDir}\n`);

    if (!options.noOpen) {
      try {
        await openBrowser(record.url, io.env);
      } catch (error) {
        io.stderr.write(`Could not open a browser: ${error instanceof Error ? error.message : String(error)}. Use ${record.url}/\n`);
      }
    }
    const code = await waitForChild(child);
    if (activeSignal) process.exitCode = signalExitCode(activeSignal);
    else if (code !== 0) throw new Error(`Local viewer stopped with exit code ${code ?? 1}.`);
  } catch (error) {
    if (!activeSignal) throw error;
    process.exitCode = signalExitCode(activeSignal);
  } finally {
    removeSignalHandlers();
    if (child) {
      record.state = "stopping";
      await writeOwnership(recordPath, record).catch(() => {});
    }
    if (child && !hasExited(child)) await stopChild(child);
    if (recordWritten) await removeOwnedRecord(recordPath, runtimeId);
  }
}

// A record left by a viewer that was killed or lost its terminal would block
// every later start, so clear it when its owner process is gone.
export async function claimViewerOwnership(recordPath: string, record: RuntimeRecord, stderr: Io["stderr"]) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await withFolderGuard(record.dataDir, () => createOwnership(recordPath, record));
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }

    const existing = await tryReadRecord(recordPath);
    if (!existing) {
      throw new Error(`${recordPath} cannot be read. Delete it if no PGM viewer or command is running for this folder.`);
    }
    if (isPidAlive(existing.pid)) {
      throw new Error(existing.mode === "viewer"
        ? `A PGM viewer is already running for ${record.dataDir}${existing.url ? ` at ${existing.url}/` : ""} (process ${existing.pid}). Stop it before starting another viewer.`
        : `A pgm command is using ${record.dataDir} (process ${existing.pid}). Retry when it finishes.`);
    }
    await clearStaleRecord(recordPath, existing, stderr);
    stderr.write("Removed a stale viewer record left by a viewer that did not shut down.\n");
  }
  throw new Error(`Another process claimed ${record.dataDir} while the viewer was starting. Retry shortly.`);
}

export function startRuntime(entry: string, dataDir: string, token: string, port: number, runtimeId: string, io: Io) {
  const env = { ...io.env };
  for (const key of [
    "HOST",
    "PORT",
    "NITRO_HOST",
    "NITRO_PORT",
    "NITRO_UNIX_SOCKET",
    "NITRO_SSL_CERT",
    "NITRO_SSL_KEY",
    "NITRO_SSL_CA",
  ]) delete env[key];
  Object.assign(env, {
    NODE_ENV: "production",
    BASE_PATH: "/",
    APP_DATA_DIR: dataDir,
    PGM_LOCAL_RUNTIME_ID: runtimeId,
    AGENT_API_TOKENS: `${token}:${tokenScopes}`,
    NITRO_HOST: "127.0.0.1",
    NITRO_PORT: String(port),
  });

  const child = spawn(process.execPath, [entry], {
    cwd: runtimeDir,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.on("data", (chunk) => io.stderr.write(`[viewer] ${String(chunk)}`));
  child.stderr?.on("data", (chunk) => io.stderr.write(`[viewer] ${String(chunk)}`));
  return child;
}

export async function getPortCandidates(requested: string | boolean | undefined, reservedPort?: number) {
  if (requested !== undefined) {
    if (typeof requested !== "string") throw new Error("Pass a port number after --port.");
    const port = /^\d+$/.test(requested) ? Number(requested) : Number.NaN;
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error("--port must be an integer from 1 to 65535. Nitro uses port 3000 when the port is zero.");
    }
    if (port === 3000) throw new Error("Port 3000 is reserved for the existing app server.");
    if (port === reservedPort) throw new Error("This port is reserved for local runtime ownership. Choose another port.");
    if (!(await isPortFree(port))) throw new Error(`Port ${port} is already in use.`);
    return [port];
  }

  const ports: number[] = [];
  for (let port = 43200; port <= 43249 && ports.length < 5; port += 1) {
    if (await isPortFree(port)) ports.push(port);
  }
  if (ports.length === 0) throw new Error("No free local viewer port was found in 43200–43249.");
  return ports;
}

function isPortFree(port: number) {
  return new Promise<boolean>((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => server.close(() => resolve(true)));
  });
}

export async function waitUntilReady(url: string, child: ReturnType<typeof spawn>, stderr: Io["stderr"]) {
  let output = "";
  const collect = (chunk: Buffer) => { output = `${output}${chunk.toString()}`.slice(-8000); };
  child.stdout?.on("data", collect);
  child.stderr?.on("data", collect);
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (hasExited(child)) throw new Error(`Local viewer exited before readiness. ${output}`);
    try {
      const response = await fetch(`${url}/`, { signal: AbortSignal.timeout(1000) });
      if (response.ok && output.includes(`Listening on ${url}`)) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  stderr.write("Local viewer did not become ready in 15 seconds.\n");
  throw new Error(`Local viewer did not become ready. ${output}`);
}

async function waitForChild(child: ReturnType<typeof spawn>) {
  if (hasExited(child)) return child.exitCode;
  return new Promise<number | null>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => resolve(code));
  });
}

// A child killed by a signal (for example the SIGHUP a closed terminal sends
// to the whole process group) keeps exitCode null and sets signalCode, and its
// "close" event has already fired. Waiting on it again would never settle.
export function hasExited(child: ReturnType<typeof spawn>) {
  return child.exitCode !== null || child.signalCode !== null;
}

export async function stopChild(child: ReturnType<typeof spawn>) {
  if (hasExited(child)) return;
  child.kill("SIGTERM");
  let timeout: NodeJS.Timeout | undefined;
  const exited = waitForChild(child).catch(() => undefined);
  const timedOut = new Promise<"timeout">((resolve) => {
    timeout = setTimeout(() => resolve("timeout"), 4000);
    timeout.unref();
  });
  try {
    if (await Promise.race([exited, timedOut]) === "timeout" && !hasExited(child)) {
      child.kill("SIGKILL");
      await exited;
    }
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function openBrowser(url: string, env: NodeJS.ProcessEnv) {
  const [command, args] = os.platform() === "darwin"
    ? ["open", [url]]
    : os.platform() === "win32"
      ? ["cmd", ["/c", "start", "", url]]
      : ["xdg-open", [url]];
  await new Promise<void>((resolve, reject) => {
    const browser = spawn(command, args, { env, stdio: "ignore", windowsHide: true });
    browser.once("error", reject);
    browser.once("close", (code) => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code ?? 1}.`)));
  });
}

function requireString(value: string | boolean | undefined, message: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error(message);
  return value.trim();
}
