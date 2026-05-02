import type { APIEvent } from "@solidjs/start/server";
import { AgentApiError } from "~/lib/agent-api/errors.server";
import { withAgentApi } from "~/lib/agent-api/handler.server";
import { toAgentTaskContext, toAgentTaskSummaries } from "~/lib/agent-api/projections.server";
import { agentJson } from "~/lib/agent-api/response.server";
import { readProjectByIdFromDisk } from "~/lib/projects/data.server";

export async function GET(event: APIEvent) {
  return withAgentApi(event, { scopes: ["task:read"] }, async () => {
    const project = await readProjectByIdFromDisk(event.params.projectId);
    if (!project) {
      throw new AgentApiError("project_not_found", "Project not found.", 404, {
        projectId: event.params.projectId,
      });
    }

    const url = new URL(event.request.url);
    const include = url.searchParams.get("include");
    if (include === "context") {
      const task = toAgentTaskContext(project, event.params.nodeId);
      if (!task) {
        throw new AgentApiError("task_not_found", "Task not found.", 404, {
          nodeId: event.params.nodeId,
        });
      }
      return agentJson(task);
    }

    const task = toAgentTaskSummaries(project, { withAncestors: include === "ancestors" })
      .find((item) => item.id === event.params.nodeId);
    if (!task) {
      throw new AgentApiError("task_not_found", "Task not found.", 404, {
        nodeId: event.params.nodeId,
      });
    }

    return agentJson({ task });
  });
}
