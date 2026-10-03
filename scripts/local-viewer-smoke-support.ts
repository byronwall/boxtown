import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { createServer } from "node:net";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export async function startRuntime({ runtimeDir, dataDir, logPath, port, token, scopes, prepareData = true }) {
  if (prepareData) await mkdir(dataDir, { recursive: true });
  const log = createWriteStream(logPath, { flags: "a" });
  const env = { ...process.env };
  for (const key of ["HOST", "PORT", "NITRO_HOST", "NITRO_PORT", "NITRO_UNIX_SOCKET", "NITRO_SSL_KEY", "NITRO_SSL_CERT", "NITRO_SSL_CA"]) delete env[key];
  Object.assign(env, {
    NODE_ENV: "production",
    APP_DATA_DIR: dataDir,
    AGENT_API_TOKENS: `${token}:${scopes}`,
    NITRO_HOST: "127.0.0.1",
    NITRO_PORT: String(port),
  });
  const child = spawn(process.execPath, [path.join(runtimeDir, "server", "index.mjs")], {
    cwd: runtimeDir,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.pipe(log);
  child.stderr.pipe(log);
  child.once("close", () => log.end());
  return { child, port };
}

export async function verifyBadData(dataDir, url, tokenHeader) {
  const badProjectDir = path.join(dataDir, "projects", "malformed");
  await mkdir(badProjectDir, { recursive: true });
  const malformedPath = path.join(badProjectDir, "project.json");
  await writeFile(malformedPath, "{\n", "utf8");
  try {
    const response = await fetch(`${url}/api/v1/projects`, {
      headers: tokenHeader,
      signal: AbortSignal.timeout(5000),
    });
    assert(response.status >= 500, `Malformed project data returned ${response.status}, expected a visible server error.`);
  } finally {
    await rm(badProjectDir, { recursive: true, force: true });
  }
}

export async function verifyStartupFailures({ runtimeDir, logPath, tempDir, token, scopes, tokenHeader }) {
  const occupiedPort = await freePort();
  const occupant = createServer();
  await new Promise<void>((resolve, reject) => {
    occupant.once("error", reject);
    occupant.listen(occupiedPort, "127.0.0.1", resolve);
  });
  try {
    const blocked = await startRuntime({
      runtimeDir,
      dataDir: path.join(tempDir, "occupied-port-data"),
      logPath,
      port: occupiedPort,
      token,
      scopes,
    });
    const code = await waitForExit(blocked.child, 5000);
    assert(code !== null, "Runtime stayed alive after its selected port was occupied.");
    assert((await readFile(logPath, "utf8")).includes("EADDRINUSE"), "Occupied-port failure was not reported in the runtime log.");
  } finally {
    await new Promise<void>((resolve) => occupant.close(() => resolve()));
  }

  const invalidDataPath = path.join(tempDir, "data-is-a-file");
  await writeFile(invalidDataPath, "not a directory");
  const invalidPort = await freePort();
  const invalid = await startRuntime({
    runtimeDir,
    dataDir: invalidDataPath,
    logPath,
    port: invalidPort,
    token,
    scopes,
    prepareData: false,
  });
  try {
    await waitForReady(`http://127.0.0.1:${invalidPort}/`, invalid, logPath);
    const response = await fetch(`http://127.0.0.1:${invalidPort}/api/v1/projects`, {
      method: "POST",
      headers: { ...tokenHeader, "content-type": "application/json" },
      body: JSON.stringify({ name: "Should fail" }),
    });
    assert(response.status === 400, `A file path used as APP_DATA_DIR returned ${response.status}, expected a visible write error.`);
  } finally {
    await stopRuntime(invalid);
    await rm(invalidDataPath, { force: true });
  }
}

export function waitForExit(child, timeout) {
  if (child.exitCode !== null) return Promise.resolve(child.exitCode);
  return Promise.race([
    new Promise((resolve) => child.once("close", resolve)),
    new Promise((resolve) => setTimeout(() => resolve(null), timeout)),
  ]);
}

export async function waitForReady(url, runtime, logPath) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (runtime.child.exitCode !== null) break;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  await stopRuntime(runtime);
  throw new Error(`Runtime did not start at ${url}. Log: ${await readFile(logPath, "utf8")}`);
}

export async function stopRuntime(runtime) {
  if (runtime.child.exitCode !== null) return;
  runtime.child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => runtime.child.once("close", resolve)),
    new Promise((resolve) => setTimeout(resolve, 4000)),
  ]);
  if (runtime.child.exitCode === null) runtime.child.kill("SIGKILL");
}

export async function checkAssets(html, pageUrl) {
  const paths = [...html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="([^"]+)"[^>]*>/gi)]
    .map((match) => match[1])
    .filter((value) => value.includes("/_build/") || value.endsWith(".css"));
  assert(paths.length > 0, "No built JavaScript or CSS URLs were found in the page.");
  for (const assetPath of [...new Set(paths)].slice(0, 8)) {
    await fetchOk(new URL(assetPath, pageUrl).toString());
  }
}

export async function openProjectSocket(url) {
  const socketUrl = url.replace(/^http/, "ws");
  const socket = new WebSocket(socketUrl);
  const messages = [];
  const pending = [];
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    const waiter = pending.findIndex((item) => item.test(message));
    if (waiter >= 0) pending.splice(waiter, 1)[0].resolve(message);
    else messages.push(message);
  });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`WebSocket did not open: ${socketUrl}`)), 5000);
    socket.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
    socket.addEventListener("error", () => { clearTimeout(timer); reject(new Error(`WebSocket failed: ${socketUrl}`)); }, { once: true });
  });
  const init = await next((message) => message.type === "jobs:init");
  assert(init.type === "jobs:init", "WebSocket did not send its initial message.");
  return { next, close: () => socket.close() };

  function next(test) {
    const existing = messages.find(test);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Timed out waiting for a project event.")), 5000);
      pending.push({ test, resolve: (message) => { clearTimeout(timer); resolve(message); } });
    });
  }
}

export async function freePort() {
  for (let port = 43120; port <= 43139; port += 1) {
    const server = createServer();
    try {
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, "127.0.0.1", resolve);
      });
      await new Promise<void>((resolve) => server.close(() => resolve()));
      return port;
    } catch {
      server.close();
    }
  }
  throw new Error("No free port in the reserved local smoke range 43120–43139.");
}

export async function fetchOk(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  assert(response.ok, `GET ${url} returned ${response.status}.`);
  return response;
}

export async function expectStatus(url, status, headers = {}) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(5000) });
  assert(response.status === status, `${url} returned ${response.status}; expected ${status}.`);
}

export async function jsonRequest(url, init: RequestInit = {}, status = 200) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(10000) });
  if (response.status !== status) {
    throw new Error(`${init.method ?? "GET"} ${url} returned ${response.status}; expected ${status}: ${await response.text()}`);
  }
  return response.json();
}

export function normalizeBasePath(value) {
  if (!value || value === "/") return "";
  return `/${value.replace(/^\/+|\/+$/g, "")}`;
}

export function run(command, args, options) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { ...options, stdio: "inherit" });
    child.once("error", reject);
    child.once("close", (code) => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}.`)));
  });
}

export function assert(condition, message) {
  if (!condition) throw new Error(message);
}
