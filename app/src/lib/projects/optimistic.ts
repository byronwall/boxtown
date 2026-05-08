import type { ProjectRecord } from "./types";

const CLIENT_MUTATION_ID_FIELD = "clientMutationId";

export type ProjectUpdatePhase = "optimistic" | "server";

export interface ProjectUpdateOptions {
  clientMutationId?: string;
  phase?: ProjectUpdatePhase;
}

export function createClientMutationId() {
  return crypto.randomUUID();
}

export function appendClientMutationId(formData: FormData, clientMutationId: string) {
  formData.set(CLIENT_MUTATION_ID_FIELD, clientMutationId);
  return formData;
}

export function getProjectClientMutationId(project: ProjectRecord) {
  return project.operationLog[0]?.metadata?.clientMutationId;
}

export function hasSameProjectState(left: ProjectRecord, right: ProjectRecord) {
  return JSON.stringify(getComparableProjectState(left)) ===
    JSON.stringify(getComparableProjectState(right));
}

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

function getComparableProjectState(project: ProjectRecord) {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    createdAt: project.createdAt,
    nodeMetadataSchema: project.nodeMetadataSchema,
    nodeTypeSchema: project.nodeTypeSchema,
    spatialMap: project.spatialMap,
  };
}
