import type { APIEvent } from "@solidjs/start/server";
import { AgentApiError } from "~/lib/agent-api/errors.server";
import { withAgentApi } from "~/lib/agent-api/handler.server";
import { agentJson } from "~/lib/agent-api/response.server";
import { getProjectDataDir, readProjectByIdFromDisk } from "~/lib/projects/data.server";
import {
  HistoryCursorError,
  MAX_HISTORY_PAGE_SIZE,
  readHistoryPage,
} from "~/lib/projects/storage/history-page.server";

// Pages through every stored history entry, newest first.
export async function GET(event: APIEvent) {
  return withAgentApi(event, { scopes: ["project:read"] }, async () => {
    const project = await readProjectByIdFromDisk(event.params.projectId);
    if (!project) {
      throw new AgentApiError("project_not_found", "Project not found.", 404, {
        projectId: event.params.projectId,
      });
    }

    const params = new URL(event.request.url).searchParams;
    const limit = parseLimit(params.get("limit"));
    try {
      const page = await readHistoryPage(getProjectDataDir(project.id), {
        before: params.get("before") ?? undefined,
        nodeId: params.get("nodeId") ?? undefined,
        limit,
      });
      return agentJson({ projectId: project.id, ...page });
    } catch (error) {
      if (error instanceof HistoryCursorError) {
        throw new AgentApiError("invalid_cursor", error.message, 400, { cursor: error.cursor });
      }
      throw error;
    }
  });
}

function parseLimit(value: string | null) {
  if (value === null) return undefined;
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_HISTORY_PAGE_SIZE) {
    throw new AgentApiError("invalid_limit", `limit must be an integer from 1 to ${MAX_HISTORY_PAGE_SIZE}.`, 400);
  }
  return limit;
}
