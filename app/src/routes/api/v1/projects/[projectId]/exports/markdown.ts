import type { APIEvent } from "@solidjs/start/server";
import { buildVisibleNodesMarkdown } from "~/components/spatial-map/spatial-map-markdown-export";
import { AgentApiError } from "~/lib/agent-api/errors.server";
import { withAgentApi } from "~/lib/agent-api/handler.server";
import { readProjectByIdFromDisk } from "~/lib/projects/data.server";

export async function GET(event: APIEvent) {
  return withAgentApi(event, { scopes: ["project:read", "node:read"] }, async () => {
    const project = await readProjectByIdFromDisk(event.params.projectId);
    if (!project) {
      throw new AgentApiError("project_not_found", "Project not found.", 404, {
        projectId: event.params.projectId,
      });
    }

    const origin = new URL(event.request.url).origin;
    const markdown = buildVisibleNodesMarkdown({
      project,
      visibleData: project.spatialMap,
      origin,
    });

    return new Response(markdown, {
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  });
}
