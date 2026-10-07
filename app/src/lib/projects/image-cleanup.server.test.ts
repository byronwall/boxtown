import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  addProjectNodeImagesOnDisk,
  createChildNodeOnDisk,
  createProjectOnDisk,
  deleteProjectNodeOnDisk,
  getProjectDataDir,
  getProjectNodeImageDir,
} from "./data.server";
import { getUnusedProjectImagesFromDisk, removeUnusedProjectImagesOnDisk } from "./image-cleanup.server";

const originalDataDir = process.env.APP_DATA_DIR;
let tempRoot = "";

beforeEach(() => {
  tempRoot = mkdtempSync(path.join(os.tmpdir(), "project-grid-image-cleanup-"));
  process.env.APP_DATA_DIR = tempRoot;
});

afterEach(() => {
  if (originalDataDir === undefined) delete process.env.APP_DATA_DIR;
  else process.env.APP_DATA_DIR = originalDataDir;
  rmSync(tempRoot, { recursive: true, force: true });
});

function png(name: string) {
  return new File([new Uint8Array([137, 80, 78, 71, 1, 2, 3])], name, { type: "image/png" });
}

async function createNodeWithImage(projectId: string, title: string, parentNodeId: string | null = null) {
  const { nodeId } = await createChildNodeOnDisk({ projectId, parentNodeId, title });
  const project = await addProjectNodeImagesOnDisk({ projectId, nodeId, images: [png(`${title}.png`)] });
  const image = project.spatialMap.nodes.find((node) => node.id === nodeId)?.images?.[0];
  return { nodeId, imagePath: path.join(getProjectNodeImageDir(projectId, nodeId), image!.filename) };
}

describe("deleteProjectNodeOnDisk image files", () => {
  it("removes the deleted node's image files and folder", async () => {
    const project = await createProjectOnDisk({ name: "Delete Images" });
    const kept = await createNodeWithImage(project.id, "Kept");
    const removed = await createNodeWithImage(project.id, "Removed");

    await deleteProjectNodeOnDisk({ projectId: project.id, nodeId: removed.nodeId });

    expect(existsSync(removed.imagePath)).toBe(false);
    expect(existsSync(path.dirname(removed.imagePath))).toBe(false);
    expect(existsSync(kept.imagePath)).toBe(true);
  });

  it("removes descendant images when children are deleted too", async () => {
    const project = await createProjectOnDisk({ name: "Delete Subtree Images" });
    const parent = await createNodeWithImage(project.id, "Parent");
    const child = await createNodeWithImage(project.id, "Child", parent.nodeId);

    await deleteProjectNodeOnDisk({ projectId: project.id, nodeId: parent.nodeId, includeChildren: true });

    expect(existsSync(parent.imagePath)).toBe(false);
    expect(existsSync(child.imagePath)).toBe(false);
  });

  it("keeps a child's images when only the parent is deleted", async () => {
    const project = await createProjectOnDisk({ name: "Keep Child Images" });
    const parent = await createNodeWithImage(project.id, "Parent");
    const child = await createNodeWithImage(project.id, "Child", parent.nodeId);

    await deleteProjectNodeOnDisk({ projectId: project.id, nodeId: parent.nodeId });

    expect(existsSync(child.imagePath)).toBe(true);
  });
});

describe("unused project images", () => {
  it("finds and removes only files that no node uses", async () => {
    const project = await createProjectOnDisk({ name: "Unused Images" });
    const used = await createNodeWithImage(project.id, "Used");
    const strayInUsedFolder = path.join(path.dirname(used.imagePath), "stray.png");
    const orphanFolder = path.join(getProjectDataDir(project.id), "images", "old-node");
    mkdirSync(orphanFolder, { recursive: true });
    writeFileSync(strayInUsedFolder, "12345");
    writeFileSync(path.join(orphanFolder, "orphan.png"), "1234567890");

    expect(await getUnusedProjectImagesFromDisk(project.id)).toEqual({ fileCount: 2, totalBytes: 15 });

    expect(await removeUnusedProjectImagesOnDisk(project.id)).toEqual({ fileCount: 2, totalBytes: 15 });
    expect(existsSync(used.imagePath)).toBe(true);
    expect(existsSync(strayInUsedFolder)).toBe(false);
    expect(existsSync(orphanFolder)).toBe(false);
    expect(await getUnusedProjectImagesFromDisk(project.id)).toEqual({ fileCount: 0, totalBytes: 0 });
  });

  it("reports nothing for a project without an images folder", async () => {
    const project = await createProjectOnDisk({ name: "No Images" });
    expect(await getUnusedProjectImagesFromDisk(project.id)).toEqual({ fileCount: 0, totalBytes: 0 });
    expect(await removeUnusedProjectImagesOnDisk(project.id)).toEqual({ fileCount: 0, totalBytes: 0 });
  });
});
