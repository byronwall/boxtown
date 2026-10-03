import { tmpdir } from "node:os";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  assert,
  checkAssets,
  expectStatus,
  fetchOk,
  freePort,
  jsonRequest,
  normalizeBasePath,
  openProjectSocket,
  run,
  startRuntime,
  stopRuntime,
  verifyBadData,
  verifyStartupFailures,
  waitForReady,
} from "./local-viewer-smoke-support.js";

const root = process.cwd();
const appDir = path.join(root, "app");
const tempDir = path.join(root, "tmp", `local-viewer-smoke-${Date.now()}`);
const runtimeRoot = path.join(tmpdir(), `pgm-local-viewer-smoke-${process.pid}-${Date.now()}`);
const token = `smoke-${process.pid}-${Date.now()}`;
const scopes = "project:read|project:write|node:read|node:write|image:read|image:write";
const tokenHeader = { authorization: `Bearer ${token}` };
const imageBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l0sAAAAASUVORK5CYII=",
  "base64",
);

await rm(tempDir, { recursive: true, force: true });
await mkdir(tempDir, { recursive: true });

try {
  await buildAndCopy("hosted", process.env.BASE_PATH?.trim() || "/");
  const hosted = await checkRuntime("hosted", { restart: false });
  await buildAndCopy("relocated", "/");
  const relocated = await checkRuntime("relocated", { restart: true });
  if (hosted.eventFailure || relocated.eventFailure) {
    process.exitCode = 1;
    console.error(`Project event check failed: ${hosted.eventFailure ?? relocated.eventFailure}`);
    console.error(`Other smoke checks completed. Fixtures: ${tempDir}`);
  } else {
    console.log(`Local viewer smoke passed. Fixtures: ${tempDir}`);
  }
} catch (error) {
  console.error(`Local viewer smoke failed. Fixtures kept at ${tempDir}`);
  throw error;
} finally {
  await rm(runtimeRoot, { recursive: true, force: true });
}

async function buildAndCopy(name: string, basePath: string) {
  const output = path.join(runtimeRoot, name, "runtime");
  await mkdir(path.dirname(output), { recursive: true });
  await run("pnpm", ["--dir", appDir, "build"], {
    cwd: root,
    env: { ...process.env, BASE_PATH: basePath },
  });
  await cp(path.join(appDir, ".output"), output, { recursive: true, dereference: false });
  if (output.startsWith(root)) throw new Error("Runtime copy is inside the checkout.");
}

async function checkRuntime(name: string, { restart }: { restart: boolean }) {
  const runtimeDir = path.join(runtimeRoot, name, "runtime");
  const dataDir = path.join(tempDir, name, "data");
  const logPath = path.join(tempDir, `${name}.log`);
  const basePath = name === "hosted" ? process.env.BASE_PATH?.trim() || "/" : "/";
  const port = await freePort();
  const url = `http://127.0.0.1:${port}${normalizeBasePath(basePath)}`;
  const runtime = await startRuntime({ runtimeDir, dataDir, logPath, port, token, scopes });

  try {
    await waitForReady(`${url}/`, runtime, logPath);
    const html = await (await fetchOk(`${url}/`)).text();
    await checkAssets(html, `${url}/`);
    await expectStatus(`${url}/api/v1/projects`, 401);
    await expectStatus(`${url}/api/v1/projects`, 401, { authorization: "Bearer invalid" });

    const project = await jsonRequest(`${url}/api/v1/projects`, {
      method: "POST",
      headers: { ...tokenHeader, "content-type": "application/json" },
      body: JSON.stringify({ name: `Smoke ${name}` }),
    }, 201);
    const projectId = project.project.id;
    const nodeResult = await jsonRequest(`${url}/api/v1/projects/${projectId}/nodes`, {
      method: "POST",
      headers: { ...tokenHeader, "content-type": "application/json" },
      body: JSON.stringify({ title: "Initial", context: "Before edit" }),
    }, 201);
    const nodeId = nodeResult.nodeId;
    const eventFailure = await checkProjectEvent(url, projectId, nodeId);
    await jsonRequest(`${url}/api/v1/projects/${projectId}/nodes/${nodeId}/context`, {
      method: "PUT",
      headers: { ...tokenHeader, "content-type": "application/json" },
      body: JSON.stringify({ context: "After edit" }),
    });

    const image = await addProofImage(url, projectId, nodeId);
    const imageDownload = await fetchOk(`${url}${image.src}`);
    assert(Buffer.from(await imageDownload.arrayBuffer()).equals(imageBytes), "Image bytes changed in transit.");
    await verifyDiskState(dataDir, projectId, nodeId, image.filename);

    if (restart) {
      await verifyBadData(dataDir, url, tokenHeader);
      await verifyStartupFailures({ runtimeDir, logPath, tempDir, token, scopes, tokenHeader });
      await stopRuntime(runtime);
      const restarted = await startRuntime({ runtimeDir, dataDir, logPath, port, token, scopes });
      try {
        await waitForReady(`${url}/`, restarted, logPath);
        const reloaded = await jsonRequest(`${url}/api/projects/${projectId}`);
        const reloadedNode = reloaded.spatialMap.nodes.find((item) => item.id === nodeId);
        assert(reloadedNode?.label === "Edited", "Restart lost the edited title.");
        assert(reloadedNode?.context === "After edit", "Restart lost the edited context.");
        const persistedImage = await fetchOk(`${url}${reloadedNode.images[0].src}`);
        assert(Buffer.from(await persistedImage.arrayBuffer()).equals(imageBytes), "Restart lost image bytes.");
      } finally {
        await stopRuntime(restarted);
      }
    }

    console.log(`${name}: HTML, assets, auth, project/node edits, and image bytes passed.${eventFailure ? ` Event check failed: ${eventFailure}` : " Events passed."}`);
    return { eventFailure };
  } finally {
    if (runtime.child.exitCode === null) await stopRuntime(runtime);
  }
}

async function checkProjectEvent(url: string, projectId: string, nodeId: string) {
  let socket;
  let failure: string | null = null;
  try {
    try {
      socket = await openProjectSocket(`${url}/ws/jobs`);
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
    }
    await jsonRequest(`${url}/api/v1/projects/${projectId}/nodes/${nodeId}`, {
      method: "PATCH",
      headers: { ...tokenHeader, "content-type": "application/json" },
      body: JSON.stringify({ title: "Edited" }),
    });
    if (socket) {
      const event = await socket.next((message) => message.type === "project:changed");
      assert(event.projectId === projectId, "Project event did not identify the edited project.");
    }
  } finally {
    socket?.close();
  }
  return failure;
}

async function addProofImage(url: string, projectId: string, nodeId: string) {
  const form = new FormData();
  form.append("images", new File([imageBytes], "smoke.png", { type: "image/png" }));
  const upload = await jsonRequest(`${url}/api/v1/projects/${projectId}/nodes/${nodeId}/images`, {
    method: "POST",
    headers: tokenHeader,
    body: form,
  }, 201);
  return upload.images[0];
}

async function verifyDiskState(dataDir: string, projectId: string, nodeId: string, filename: string) {
  const projectFile = path.join(dataDir, "projects", projectId, "project.json");
  const saved = JSON.parse(await readFile(projectFile, "utf8"));
  assert(saved.operationLog.some((item) => item.kind === "node.title.updated" && item.nodeIds.includes(nodeId)), "Edited title was not saved to the operation log.");
  assert(saved.operationLog.some((item) => item.kind === "node.context.updated" && item.nodeIds.includes(nodeId)), "Edited context was not saved to the operation log.");
  const imageFile = path.join(dataDir, "projects", projectId, "images", nodeId, filename);
  assert((await readFile(imageFile)).equals(imageBytes), "Image bytes were not saved under the selected data folder.");
}
