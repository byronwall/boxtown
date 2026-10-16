import type { APIEvent } from "@solidjs/start/server";
import { AgentApiError } from "~/lib/agent-api/errors.server";
import { withAgentApi } from "~/lib/agent-api/handler.server";
import { toAgentOperationActor } from "~/lib/agent-api/operation-actor";
import { toAgentMapNode } from "~/lib/agent-api/projections.server";
import { agentJson } from "~/lib/agent-api/response.server";
import {
  parseExpectedRevision,
  parseNodePatchBody,
  readJsonRecord,
  respondWithNodePatch,
} from "~/lib/agent-api/node-patch.server";
import { deleteProjectNodeOnDisk, readProjectByIdFromDisk } from "~/lib/projects/data.server";
import { getNodeRevision } from "~/lib/projects/node-patch.server";

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
      revision: getNodeRevision(node, project.spatialMap.links),
      // Project-wide activity time, not a per-node change marker; use `revision` for that.
      updatedAt: project.updatedAt,
    };
    return agentJson({
      node: projectFields(projectedNode, fields),
    });
  });
}

export async function PATCH(event: APIEvent) {
  return withAgentApi(event, { scopes: ["node:write"] }, async (context) => {
    const input = await readJsonRecord(event);
    const patch = parseNodePatchBody(input);
    if (Object.keys(patch).length === 0) {
      throw new AgentApiError(
        "empty_update",
        "At least one of title, status, type, archived, priority, context, or metadata is required.",
        400,
      );
    }

    return respondWithNodePatch(event, context.actor, patch, {
      expectedRevision: parseExpectedRevision(input),
      clientMutationId: input.clientMutationId,
    });
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
