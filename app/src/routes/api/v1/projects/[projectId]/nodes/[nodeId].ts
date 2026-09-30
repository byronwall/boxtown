import type { APIEvent } from "@solidjs/start/server";
import { AgentApiError } from "~/lib/agent-api/errors.server";
import { withAgentApi } from "~/lib/agent-api/handler.server";
import { toAgentOperationActor } from "~/lib/agent-api/operation-actor";
import { toAgentMapNode } from "~/lib/agent-api/projections.server";
import { agentJson } from "~/lib/agent-api/response.server";
import {
  deleteProjectNodeOnDisk,
  readProjectByIdFromDisk,
  updateProjectNodeArchivedOnDisk,
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

    const fields = parseFields(new URL(event.request.url).searchParams.get("fields"));
    const projectedNode = {
      ...toAgentMapNode(node),
      title: node.label,
      updatedAt: project.updatedAt,
    };
    return agentJson({
      node: projectFields(projectedNode, fields),
    });
  });
}

type PatchNodeRequest = {
  title?: unknown;
  label?: unknown;
  status?: unknown;
  type?: unknown;
  archived?: unknown;
};

export async function PATCH(event: APIEvent) {
  return withAgentApi(event, { scopes: ["node:write"] }, async (context) => {
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
          actor: toAgentOperationActor(context.actor),
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
          actor: toAgentOperationActor(context.actor),
        });
      }

      if (input.archived !== undefined) {
        if (typeof input.archived !== "boolean") {
          throw new AgentApiError("invalid_archived", "archived must be a boolean.", 400);
        }
        project = await updateProjectNodeArchivedOnDisk({
          projectId: event.params.projectId,
          nodeId: event.params.nodeId,
          archived: input.archived,
          actor: toAgentOperationActor(context.actor),
        });
      }

      if (typeof input.type === "string") {
        project = await updateProjectNodeTypeOnDisk({
          projectId: event.params.projectId,
          nodeId: event.params.nodeId,
          type: input.type,
          actor: toAgentOperationActor(context.actor),
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
        "At least one of title, status, type, or archived is required.",
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

export async function DELETE(event: APIEvent) {
  return withAgentApi(event, { scopes: ["node:write"] }, async (context) => {
    const before = await readProjectByIdFromDisk(event.params.projectId);
    if (!before) {
      throw new AgentApiError("project_not_found", "Project not found.", 404, {
        projectId: event.params.projectId,
      });
    }
    if (!before.spatialMap.nodes.some((item) => item.id === event.params.nodeId)) {
      throw new AgentApiError("node_not_found", "Node not found.", 404, {
        nodeId: event.params.nodeId,
      });
    }

    const includeChildren =
      new URL(event.request.url).searchParams.get("children") === "true";

    try {
      const project = await deleteProjectNodeOnDisk({
        projectId: event.params.projectId,
        nodeId: event.params.nodeId,
        includeChildren,
        actor: toAgentOperationActor(context.actor),
      });
      const remainingIds = new Set(project.spatialMap.nodes.map((item) => item.id));
      const deletedNodeIds = before.spatialMap.nodes
        .map((item) => item.id)
        .filter((id) => !remainingIds.has(id));

      return agentJson({ nodeId: event.params.nodeId, includeChildren, deletedNodeIds });
    } catch (error) {
      throw new AgentApiError(
        "node_delete_failed",
        error instanceof Error ? error.message : "Failed to delete node.",
        400,
      );
    }
  });
}

function parseFields(value: string | null) {
  if (!value?.trim()) {
    return null;
  }

  return value.split(",").map((field) => field.trim()).filter(Boolean);
}

function projectFields<T extends object>(value: T, fields: string[] | null) {
  if (!fields) {
    return value;
  }

  return Object.fromEntries(
    fields
      .map((field) => [field, getByPath(value, field)] as const)
      .filter(([, fieldValue]) => fieldValue !== undefined),
  );
}

function getByPath(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    return (current as Record<string, unknown>)[part];
  }, value);
}
