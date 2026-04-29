import type { MapNodeStatus } from "~/lib/spatial-map/types";
import type { ProjectRecord } from "./types";

type ProjectNodePatch = {
  title?: string;
  status?: MapNodeStatus;
};

export async function patchProjectNode(
  projectId: string,
  nodeId: string,
  patch: ProjectNodePatch,
): Promise<ProjectRecord> {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/nodes/${encodeURIComponent(nodeId)}`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(patch),
    },
  );

  const result = await response.json() as ProjectRecord | { error?: string };
  if (!response.ok) {
    throw new Error("error" in result && result.error ? result.error : "Failed to update node.");
  }

  return result as ProjectRecord;
}
