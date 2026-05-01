import type { APIEvent } from "@solidjs/start/server";
import { AgentApiError } from "~/lib/agent-api/errors.server";
import { withAgentApi } from "~/lib/agent-api/handler.server";
import { toAgentMapNode } from "~/lib/agent-api/projections.server";
import { agentJson } from "~/lib/agent-api/response.server";
import {
  readProjectByIdFromDisk,
  updateProjectNodeContextOnDisk,
} from "~/lib/projects/data.server";

export async function GET(event: APIEvent) {
  return withAgentApi(event, { scopes: ["node:read"] }, async () => {
    const project = await readProjectByIdFromDisk(event.params.projectId);
    const node = project?.spatialMap.nodes.find((item) => item.id === event.params.nodeId);
    if (!project) {
      throw new AgentApiError("project_not_found", "Project not found.", 404, {
        projectId: event.params.projectId,
      });
    }
    if (!node) {
      throw new AgentApiError("node_not_found", "Node not found.", 404, {
        nodeId: event.params.nodeId,
      });
    }

    return agentJson({
      nodeId: node.id,
      context: node.context,
      rawContext: node.rawContext,
      contextMode: node.contextMode,
    });
  });
}

type SetContextRequest = {
  context?: unknown;
};

export async function PUT(event: APIEvent) {
  return withAgentApi(event, { scopes: ["node:write"] }, async () => {
    const input = (await event.request.json().catch(() => null)) as SetContextRequest | null;
    if (!input || typeof input.context !== "string") {
      throw new AgentApiError("invalid_context", "A string context is required.", 400);
    }

    try {
      const project = await updateProjectNodeContextOnDisk({
        projectId: event.params.projectId,
        nodeId: event.params.nodeId,
        context: input.context,
      });
      const node = project.spatialMap.nodes.find((item) => item.id === event.params.nodeId);
      if (!node) {
        throw new AgentApiError("node_not_found", "Node not found.", 404, {
          nodeId: event.params.nodeId,
        });
      }

      return agentJson({ node: toAgentMapNode(node) });
    } catch (error) {
      if (error instanceof AgentApiError) {
        throw error;
      }
      throw new AgentApiError(
        "context_update_failed",
        error instanceof Error ? error.message : "Failed to update node context.",
        400,
      );
    }
  });
}
