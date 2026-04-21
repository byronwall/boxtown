import { action, query, redirect } from "@solidjs/router";
import { getRequestEvent } from "solid-js/web";
import type { ProjectRecord, ProjectSummary } from "./types";

async function fetchJson<T>(pathname: string): Promise<T> {
  const requestEvent = getRequestEvent();
  const requestUrl = requestEvent?.request.url;
  const url = requestUrl
    ? new URL(pathname, requestUrl)
    : new URL(pathname, window.location.origin);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to load ${pathname}: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const getProjects = query(
  async () => fetchJson<ProjectSummary[]>("/api/projects"),
  "projects",
);

export const getProjectById = query(
  async (projectId: string) => fetchJson<ProjectRecord>(`/api/projects/${projectId}`),
  "project-by-id",
);

export const createProject = action(
  async (formData: FormData) => {
    "use server";
    const { createProjectOnDisk } = await import("./data.server");

    const nameValue = formData.get("name");
    const project = await createProjectOnDisk({
      name: typeof nameValue === "string" ? nameValue : undefined,
    });

    throw redirect(`/projects/${project.id}`, {
      revalidate: [getProjects.key, getProjectById.keyFor(project.id)],
    });
  },
  "create-project",
);
