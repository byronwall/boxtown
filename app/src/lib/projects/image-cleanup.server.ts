import { readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import {
  getProjectDataDir,
  getProjectNodeImageFilePath,
  readProjectByIdFromDisk,
  removeDirIfEmpty,
  serializedMutation,
} from "./data.server";

export interface UnusedProjectImages {
  fileCount: number;
  totalBytes: number;
}

// An image file is unused when no node in the project (archived nodes
// included) lists it. These files are left behind by older node deletes,
// interrupted uploads, and hand-edited project folders.
async function findUnusedImageFiles(projectId: string) {
  const project = await readProjectByIdFromDisk(projectId);
  if (!project) throw new Error("Project not found.");

  const usedPaths = new Set<string>();
  for (const node of project.spatialMap.nodes) {
    for (const image of node.images ?? []) {
      try {
        usedPaths.add(getProjectNodeImageFilePath({ projectId, nodeId: node.id, filename: image.filename }));
      } catch {
        // A filename that escapes its folder can never match a file below.
      }
    }
  }

  const imagesDir = path.join(getProjectDataDir(projectId), "images");
  const files: { filePath: string; size: number }[] = [];
  const folders = await readdir(imagesDir, { withFileTypes: true }).catch(() => []);
  for (const folder of folders) {
    if (!folder.isDirectory()) continue;
    const folderPath = path.join(imagesDir, folder.name);
    for (const entry of await readdir(folderPath, { withFileTypes: true })) {
      const filePath = path.join(folderPath, entry.name);
      if (!entry.isFile() || usedPaths.has(filePath)) continue;
      files.push({ filePath, size: (await stat(filePath)).size });
    }
  }

  return { imagesDir, files };
}

function summarize(files: { size: number }[]): UnusedProjectImages {
  return {
    fileCount: files.length,
    totalBytes: files.reduce((total, file) => total + file.size, 0),
  };
}

export async function getUnusedProjectImagesFromDisk(projectId: string): Promise<UnusedProjectImages> {
  return summarize((await findUnusedImageFiles(projectId)).files);
}

// Serialized with the other project mutations so an upload that has written
// its file but not yet saved project.json is never mistaken for unused.
export const removeUnusedProjectImagesOnDisk = serializedMutation(async function removeUnusedProjectImagesOnDisk(
  projectId: string,
): Promise<UnusedProjectImages> {
  const { imagesDir, files } = await findUnusedImageFiles(projectId);
  for (const file of files) {
    await rm(file.filePath, { force: true });
  }

  const folders = new Set(files.map((file) => path.dirname(file.filePath)));
  for (const folder of folders) await removeDirIfEmpty(folder);
  await removeDirIfEmpty(imagesDir);

  return summarize(files);
});
