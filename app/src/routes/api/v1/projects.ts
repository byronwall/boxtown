import type { APIEvent } from "@solidjs/start/server";
import { AgentApiError } from "~/lib/agent-api/errors.server";
import { withAgentApi } from "~/lib/agent-api/handler.server";
import { toAgentOperationActor } from "~/lib/agent-api/operation-actor";
import {
  toAgentProjectDetail,
  toAgentProjectSummary,
} from "~/lib/agent-api/projections.server";
import { agentJson } from "~/lib/agent-api/response.server";
import {
  createProjectOnDisk,
  readProjectSummariesFromDisk,
} from "~/lib/projects/data.server";

export async function GET(event: APIEvent) {
  return withAgentApi(event, { scopes: ["project:read"] }, async () => {
    const projects = await readProjectSummariesFromDisk();
    return agentJson({
      projects: projects.map(toAgentProjectSummary),
    });
  });
}

type CreateProjectRequest = {
  name?: unknown;
};

export async function POST(event: APIEvent) {
  return withAgentApi(event, { scopes: ["project:write"] }, async (context) => {
    const input = (await event.request.json().catch(() => ({}))) as CreateProjectRequest;
    if (input.name !== undefined && typeof input.name !== "string") {
      throw new AgentApiError("invalid_name", "Project name must be a string.", 400);
    }

    try {
      const project = await createProjectOnDisk({
        name: input.name,
        actor: toAgentOperationActor(context.actor),
      });
      return agentJson({
        project: toAgentProjectDetail(project),
      }, { status: 201 });
    } catch (error) {
      throw new AgentApiError(
        "project_create_failed",
        error instanceof Error ? error.message : "Failed to create project.",
        400,
      );
    }
  });
}
