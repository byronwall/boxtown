import type { ProjectRecord } from "./types";

export function createProjectNodeFormData(
  projectId: string,
  nodeId: string,
  fields: Record<string, string>,
) {
  const formData = new FormData();
  formData.set("projectId", projectId);
  formData.set("nodeId", nodeId);

  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }

  return formData;
}

export function updateProjectNode(
  project: ProjectRecord,
  nodeId: string,
  updateNode: (node: ProjectRecord["spatialMap"]["nodes"][number]) => ProjectRecord["spatialMap"]["nodes"][number],
): ProjectRecord {
  return {
    ...project,
    updatedAt: new Date().toISOString(),
    spatialMap: {
      ...project.spatialMap,
      nodes: project.spatialMap.nodes.map((node) =>
        node.id === nodeId ? updateNode(node) : node,
      ),
    },
  };
}
