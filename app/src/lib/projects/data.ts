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

export const deleteProject = action(
  async (formData: FormData) => {
    "use server";
    const { deleteProjectOnDisk } = await import("./data.server");

    const projectId = formData.get("projectId");
    if (typeof projectId !== "string" || projectId.trim().length === 0) {
      throw new Error("A project id is required.");
    }

    await deleteProjectOnDisk(projectId);

    throw redirect("/", {
      revalidate: [getProjects.key],
    });
  },
  "delete-project",
);

export const updateProjectNodeContext = action(
  async (formData: FormData) => {
    "use server";
    const { updateProjectNodeContextOnDisk } = await import("./data.server");

    const projectId = formData.get("projectId");
    const nodeId = formData.get("nodeId");
    const context = formData.get("context");

    if (typeof projectId !== "string" || projectId.trim().length === 0) {
      throw new Error("A project id is required.");
    }
    if (typeof nodeId !== "string" || nodeId.trim().length === 0) {
      throw new Error("A node id is required.");
    }

    return updateProjectNodeContextOnDisk({
      projectId,
      nodeId,
      context: typeof context === "string" ? context : "",
    });
  },
  "update-project-node-context",
);

export const createProjectContextNode = action(
  async (formData: FormData) => {
    "use server";
    const { createContextNodeOnDisk } = await import("./data.server");

    const projectId = formData.get("projectId");
    const label = formData.get("label");
    const context = formData.get("context");
    const splitByHeadingLevel = formData.get("splitByHeadingLevel");
    const maxHeadingDepth = formData.get("maxHeadingDepth");

    if (typeof projectId !== "string" || projectId.trim().length === 0) {
      throw new Error("A project id is required.");
    }
    if (typeof label !== "string" || label.trim().length === 0) {
      throw new Error("A node label is required.");
    }

    return createContextNodeOnDisk({
      projectId,
      label,
      context: typeof context === "string" ? context : "",
      splitByHeadingLevel: splitByHeadingLevel === "true",
      maxHeadingDepth:
        typeof maxHeadingDepth === "string" ? Number.parseInt(maxHeadingDepth, 10) : undefined,
    });
  },
  "create-project-context-node",
);

export const deleteProjectNode = action(
  async (formData: FormData) => {
    "use server";
    const { deleteProjectNodeOnDisk } = await import("./data.server");

    const projectId = formData.get("projectId");
    const nodeId = formData.get("nodeId");

    if (typeof projectId !== "string" || projectId.trim().length === 0) {
      throw new Error("A project id is required.");
    }
    if (typeof nodeId !== "string" || nodeId.trim().length === 0) {
      throw new Error("A node id is required.");
    }

    return deleteProjectNodeOnDisk({ projectId, nodeId });
  },
  "delete-project-node",
);
