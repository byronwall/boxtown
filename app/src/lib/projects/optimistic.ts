import { createUniqueNodeId } from "./node-id";
import type { ProjectRecord } from "./types";

const CLIENT_MUTATION_ID_FIELD = "clientMutationId";

// optimistic: a local snapshot before the write settles.
// server: the authoritative project returned by a successful write.
// failed: the write failed; only its local change is dropped.
export type ProjectUpdatePhase = "optimistic" | "server" | "failed";

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

export function createOptimisticNodeId(
  label: string,
  type: string,
  existingIds: Set<string>,
) {
  return createUniqueNodeId(label, type, existingIds);
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
