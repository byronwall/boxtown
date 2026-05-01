import type { APIEvent } from "@solidjs/start/server";
import { AgentApiError } from "~/lib/agent-api/errors.server";
import { withAgentApi } from "~/lib/agent-api/handler.server";
import { toAgentMapNode } from "~/lib/agent-api/projections.server";
import { agentJson } from "~/lib/agent-api/response.server";
import {
  readProjectByIdFromDisk,
  updateProjectNodeStatusOnDisk,
  updateProjectNodeTitleOnDisk,
  updateProjectNodeTypeOnDisk,
} from "~/lib/projects/data.server";
import { isMapNodeStatus } from "~/lib/spatial-map/node-status";

export async function GET(event: APIEvent) {
  return withAgentApi(event, { scopes: ["node:read"] }, async () => {
    const project = await readProjectByIdFromDisk(event.params.projectId);
    if (!project) {
      throw new AgentApiError("project_not_found", "Project not found.", 404, {
        projectId: event.params.projectId,
      });
    }

    const node = project.spatialMap.nodes.find((item) => item.id === event.params.nodeId);
    if (!node) {
      throw new AgentApiError("node_not_found", "Node not found.", 404, {
        nodeId: event.params.nodeId,
      });
    }

    return agentJson({
      node: toAgentMapNode(node),
    });
  });
}

type PatchNodeRequest = {
  title?: unknown;
  label?: unknown;
  status?: unknown;
  type?: unknown;
};

export async function PATCH(event: APIEvent) {
  return withAgentApi(event, { scopes: ["node:write"] }, async () => {
    const input = (await event.request.json().catch(() => null)) as PatchNodeRequest | null;
    if (!input) {
      throw new AgentApiError("invalid_json", "A JSON body is required.", 400);
    }

    let project = null;

    try {
      const title = typeof input.title === "string"
        ? input.title
        : typeof input.label === "string"
          ? input.label
          : undefined;
      if (title !== undefined) {
        project = await updateProjectNodeTitleOnDisk({
          projectId: event.params.projectId,
          nodeId: event.params.nodeId,
          title,
        });
      }

      if (input.status !== undefined) {
        if (!isMapNodeStatus(input.status)) {
          throw new AgentApiError("invalid_status", "A valid node status is required.", 400, {
            status: input.status,
          });
        }
        project = await updateProjectNodeStatusOnDisk({
          projectId: event.params.projectId,
          nodeId: event.params.nodeId,
          status: input.status,
        });
      }

      if (typeof input.type === "string") {
        project = await updateProjectNodeTypeOnDisk({
          projectId: event.params.projectId,
          nodeId: event.params.nodeId,
          type: input.type,
        });
      }
    } catch (error) {
      if (error instanceof AgentApiError) {
        throw error;
      }
      throw new AgentApiError(
        "node_update_failed",
        error instanceof Error ? error.message : "Failed to update node.",
        400,
      );
    }

    if (!project) {
      throw new AgentApiError(
        "empty_update",
        "At least one of title, status, or type is required.",
        400,
      );
    }

    const node = project.spatialMap.nodes.find((item) => item.id === event.params.nodeId);
    if (!node) {
      throw new AgentApiError("node_not_found", "Node not found.", 404, {
        nodeId: event.params.nodeId,
      });
    }

    return agentJson({ node: toAgentMapNode(node) });
  });
}
