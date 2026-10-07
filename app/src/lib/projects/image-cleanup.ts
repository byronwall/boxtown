import { action, query } from "@solidjs/router";
import type { UnusedProjectImages } from "./image-cleanup.server";

export type { UnusedProjectImages };

export const getUnusedProjectImages = query(async (projectId: string) => {
  "use server";
  const { getUnusedProjectImagesFromDisk } = await import("./image-cleanup.server");
  return getUnusedProjectImagesFromDisk(projectId);
}, "project-unused-images");

export const removeUnusedProjectImages = action(async (input: { projectId: string }) => {
  "use server";
  const { removeUnusedProjectImagesOnDisk } = await import("./image-cleanup.server");
  if (!input.projectId.trim()) throw new Error("A project id is required.");
  return removeUnusedProjectImagesOnDisk(input.projectId);
}, "remove-unused-project-images");
