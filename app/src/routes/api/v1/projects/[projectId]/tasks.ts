import type { APIEvent } from "@solidjs/start/server";
import { AgentApiError } from "~/lib/agent-api/errors.server";
import { withAgentApi } from "~/lib/agent-api/handler.server";
import { toAgentTaskSummaries } from "~/lib/agent-api/projections.server";
import { agentJson } from "~/lib/agent-api/response.server";
import { readProjectByIdFromDisk } from "~/lib/projects/data.server";
import { isMapNodeStatus } from "~/lib/spatial-map/node-status";

export async function GET(event: APIEvent) {
  return withAgentApi(event, { scopes: ["task:read"] }, async () => {
    const project = await readProjectByIdFromDisk(event.params.projectId);
    if (!project) {
      throw new AgentApiError("project_not_found", "Project not found.", 404, {
        projectId: event.params.projectId,
      });
    }

    const url = new URL(event.request.url);
    const status = url.searchParams.get("status");
    if (status !== null && !isMapNodeStatus(status)) {
      throw new AgentApiError("invalid_status", "A valid task status is required.", 400, {
        status,
      });
    }

    const tasks = toAgentTaskSummaries(project).filter(
      (task) => status === null || task.status === status,
    );

    return agentJson({ tasks });
  });
}
