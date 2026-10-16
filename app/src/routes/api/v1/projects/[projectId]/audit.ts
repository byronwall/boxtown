import { existsSync } from "node:fs";
import type { APIEvent } from "@solidjs/start/server";
import { AgentApiError } from "~/lib/agent-api/errors.server";
import { withAgentApi } from "~/lib/agent-api/handler.server";
import { agentJson } from "~/lib/agent-api/response.server";
import { auditProject } from "~/lib/projects/audit";
import {
  getProjectDataDir,
  getProjectNodeImageFilePath,
  readProjectByIdFromDisk,
} from "~/lib/projects/data.server";
import { readProjectIntegrityIssues } from "~/lib/projects/storage/project-directory.server";

// Read-only completeness and integrity report. Never repairs or writes.
export async function GET(event: APIEvent) {
  return withAgentApi(event, { scopes: ["project:read", "node:read"] }, async () => {
    const project = await readProjectByIdFromDisk(event.params.projectId);
    if (!project) {
      throw new AgentApiError("project_not_found", "Project not found.", 404, { projectId: event.params.projectId });
    }

    const params = new URL(event.request.url).searchParams;
    const subtree = params.get("subtree") ?? undefined;
    if (subtree && !project.spatialMap.nodes.some((node) => node.id === subtree)) {
      throw new AgentApiError("node_not_found", "Subtree root not found.", 404, { nodeId: subtree });
    }
    const require = params.get("require");

    const missingImages = project.spatialMap.nodes.flatMap((node) =>
      (node.images ?? [])
        .filter((image) => !existsSync(getProjectNodeImageFilePath({ projectId: project.id, nodeId: node.id, filename: image.filename })))
        .map((image) => ({ nodeId: node.id, filename: image.filename })));

    const report = auditProject(project, {
      subtree,
      includeArchived: params.get("includeArchived") === "true",
      requireImplemented: require === null ? undefined : require.split(",").map((key) => key.trim()).filter(Boolean),
    }, {
      integrityIssues: await readProjectIntegrityIssues(getProjectDataDir(project.id)),
      missingImages,
    });
    return agentJson({ audit: report });
  });
}
