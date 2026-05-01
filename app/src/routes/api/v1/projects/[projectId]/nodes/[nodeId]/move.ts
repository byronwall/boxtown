import type { APIEvent } from "@solidjs/start/server";
import { AgentApiError } from "~/lib/agent-api/errors.server";
import { withAgentApi } from "~/lib/agent-api/handler.server";
import { toAgentMapNode } from "~/lib/agent-api/projections.server";
import { agentJson } from "~/lib/agent-api/response.server";
import { moveProjectNodeOnDisk } from "~/lib/projects/data.server";

type MoveNodeRequest = {
  parentNodeId?: unknown;
  parent?: unknown;
};

export async function POST(event: APIEvent) {
  return withAgentApi(event, { scopes: ["node:write"] }, async () => {
    const input = (await event.request.json().catch(() => null)) as MoveNodeRequest | null;
    if (!input) {
      throw new AgentApiError("invalid_json", "A JSON body is required.", 400);
    }

    try {
      const parentNodeId = getNullableString(input.parentNodeId ?? input.parent);
      const project = await moveProjectNodeOnDisk({
        projectId: event.params.projectId,
        nodeId: event.params.nodeId,
        parentNodeId,
      });
      const node = project.spatialMap.nodes.find((item) => item.id === event.params.nodeId);
      const parentLink = project.spatialMap.links.find(
        (link) => link.parentChild && link.target === event.params.nodeId,
      ) ?? null;
      if (!node) {
        throw new AgentApiError("node_not_found", "Node not found.", 404, {
          nodeId: event.params.nodeId,
        });
      }

      return agentJson({
        node: toAgentMapNode(node),
        parentNodeId,
        parentLink,
      });
    } catch (error) {
      if (error instanceof AgentApiError) {
        throw error;
      }
      throw new AgentApiError(
        "node_move_failed",
        error instanceof Error ? error.message : "Failed to move node.",
        400,
      );
    }
  });
}

function getNullableString(value: unknown) {
  if (value === null) {
    return null;
  }
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}
