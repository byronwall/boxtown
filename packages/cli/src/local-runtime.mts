import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { link, mkdir, readFile, realpath, rename, stat, unlink, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtimeDir = path.join(packageRoot, "runtime");
const tokenScopes = "project:read|project:write|node:read|node:write|image:read|image:write";
const lockName = ".pgm-local-runtime.json";

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
  const onInterrupt = () => onSignal("SIGINT");
  const onTerminate = () => onSignal("SIGTERM");
  process.on("SIGINT", onInterrupt);
  process.on("SIGTERM", onTerminate);
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
    try {
      await withFolderGuard(dataDir, () => createOwnership(recordPath, record));
      recordWritten = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        throw new Error(`A PGM viewer already owns ${dataDir}. Stop it before starting another viewer.`);
      }
      throw error;
    }

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
    if (activeSignal === "SIGINT") process.exitCode = 130;
    else if (activeSignal === "SIGTERM") process.exitCode = 143;
    else if (code !== 0) throw new Error(`Local viewer stopped with exit code ${code ?? 1}.`);
  } catch (error) {
    if (!activeSignal) throw error;
    process.exitCode = activeSignal === "SIGINT" ? 130 : 143;
  } finally {
    process.off("SIGINT", onInterrupt);
    process.off("SIGTERM", onTerminate);
    if (child) {
      record.state = "stopping";
      await writeOwnership(recordPath, record).catch(() => {});
    }
    if (child && child.exitCode === null) await stopChild(child);
    if (recordWritten) await removeOwnedRecord(recordPath, runtimeId);
  }
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
    if (child.exitCode !== null) throw new Error(`Local viewer exited before readiness. ${output}`);
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
  if (child.exitCode !== null) return child.exitCode;
  return new Promise<number | null>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => resolve(code));
  });
}

export async function stopChild(child: ReturnType<typeof spawn>) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  let timeout: NodeJS.Timeout | undefined;
  const exited = waitForChild(child).catch(() => undefined);
  const timedOut = new Promise<"timeout">((resolve) => {
    timeout = setTimeout(() => resolve("timeout"), 4000);
    timeout.unref();
  });
  try {
    if (await Promise.race([exited, timedOut]) === "timeout" && child.exitCode === null) {
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
    guard.once("error", (error) => reject(
      (error as NodeJS.ErrnoException).code === "EADDRINUSE"
        ? new Error("Another local runtime is changing folder ownership. Retry shortly.")
        : error,
    ));
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

function requireString(value: string | boolean | undefined, message: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error(message);
  return value.trim();
}
