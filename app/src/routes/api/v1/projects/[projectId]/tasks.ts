import type { APIEvent } from "@solidjs/start/server";
import { AgentApiError } from "~/lib/agent-api/errors.server";
import { withAgentApi } from "~/lib/agent-api/handler.server";
import { toAgentTaskContexts, toAgentTaskSummaries } from "~/lib/agent-api/projections.server";
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
    const type = url.searchParams.get("type");
    const search = url.searchParams.get("search");
    const include = url.searchParams.get("include");
    if (status !== null && !isMapNodeStatus(status)) {
      throw new AgentApiError("invalid_status", "A valid task status is required.", 400, {
        status,
      });
    }

    const hasContext = include === "context";
    const tasks = (hasContext
      ? toAgentTaskContexts(project)
      : toAgentTaskSummaries(project, { withAncestors: include === "ancestors" })
    ).filter(
      (item) => {
        const task = "task" in item ? item.task : item;
        return (
          (status === null || task.status === status) &&
          (type === null || task.type === type) &&
          matchesSearch(task, search)
        );
      },
    );

    return agentJson({ tasks });
  });
}

function matchesSearch(task: { id: string; title: string; titlePath?: string }, search: string | null) {
  if (search === null || search.trim().length === 0) {
    return true;
  }

  const normalized = search.toLowerCase();
  return (
    task.id.toLowerCase().includes(normalized) ||
    task.title.toLowerCase().includes(normalized) ||
    (task.titlePath?.toLowerCase().includes(normalized) ?? false)
  );
}
