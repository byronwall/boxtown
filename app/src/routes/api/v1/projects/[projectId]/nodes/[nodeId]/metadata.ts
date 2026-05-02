import type { APIEvent } from "@solidjs/start/server";
import { AgentApiError } from "~/lib/agent-api/errors.server";
import { withAgentApi } from "~/lib/agent-api/handler.server";
import { toAgentOperationActor } from "~/lib/agent-api/operation-actor";
import { toAgentMapNode } from "~/lib/agent-api/projections.server";
import { agentJson } from "~/lib/agent-api/response.server";
import {
  readProjectByIdFromDisk,
  updateProjectNodeMetadataOnDisk,
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
      metadata: node.metadata,
    });
  });
}

type PatchMetadataRequest = {
  metadata?: unknown;
  set?: unknown;
  unset?: unknown;
};

export async function PATCH(event: APIEvent) {
  return withAgentApi(event, { scopes: ["node:write"] }, async (context) => {
    const input = (await event.request.json().catch(() => null)) as PatchMetadataRequest | null;
    if (!input) {
      throw new AgentApiError("invalid_json", "A JSON body is required.", 400);
    }

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

    const nextMetadata = getMetadata(input.metadata) ?? { ...node.metadata };
    const setValues = getMetadata(input.set);
    if (setValues) {
      Object.assign(nextMetadata, setValues);
    }
    for (const key of getUnsetKeys(input.unset)) {
      delete nextMetadata[key];
    }

    try {
      const updatedProject = await updateProjectNodeMetadataOnDisk({
        projectId: event.params.projectId,
        nodeId: event.params.nodeId,
        metadata: nextMetadata,
        actor: toAgentOperationActor(context.actor),
      });
      const updatedNode = updatedProject.spatialMap.nodes.find((item) => item.id === event.params.nodeId);
      if (!updatedNode) {
        throw new AgentApiError("node_not_found", "Node not found.", 404, {
          nodeId: event.params.nodeId,
        });
      }

      return agentJson({ node: toAgentMapNode(updatedNode) });
    } catch (error) {
      if (error instanceof AgentApiError) {
        throw error;
      }
      throw new AgentApiError(
        "metadata_update_failed",
        error instanceof Error ? error.message : "Failed to update node metadata.",
        400,
      );
    }
  });
}

function getMetadata(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function getUnsetKeys(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value === "string") {
    return [value];
  }
  return [];
}
