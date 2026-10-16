import type { APIEvent } from "@solidjs/start/server";
import { AgentApiError, rethrowAsAgentApiError } from "~/lib/agent-api/errors.server";
import { withAgentApi } from "~/lib/agent-api/handler.server";
import { readJsonRecord } from "~/lib/agent-api/node-patch.server";
import { toAgentOperationActor } from "~/lib/agent-api/operation-actor";
import { agentJson } from "~/lib/agent-api/response.server";
import { readProjectByIdFromDisk } from "~/lib/projects/data.server";
import {
  createProjectLinkOnDisk,
  listNodeRelations,
  removeProjectLinkOnDisk,
} from "~/lib/projects/links.server";

// Relationship links (related, dependency, reuse) from this node to others.
// Parent/child hierarchy is managed by the move route instead.
export async function GET(event: APIEvent) {
  return withAgentApi(event, { scopes: ["node:read"] }, async () => {
    const project = await readProjectByIdFromDisk(event.params.projectId);
    if (!project) {
      throw new AgentApiError("project_not_found", "Project not found.", 404, { projectId: event.params.projectId });
    }
    if (!project.spatialMap.nodes.some((node) => node.id === event.params.nodeId)) {
      throw new AgentApiError("node_not_found", "Node not found.", 404, { nodeId: event.params.nodeId });
    }
    return agentJson({ nodeId: event.params.nodeId, relations: listNodeRelations(project, event.params.nodeId) });
  });
}

export async function POST(event: APIEvent) {
  return withAgentApi(event, { scopes: ["node:write"] }, async (context) => {
    const input = await readLinkInput(event);
    try {
      const result = await createProjectLinkOnDisk({ ...input, actor: toAgentOperationActor(context.actor) });
      return agentJson({ link: result.link, created: result.created }, { status: result.created ? 201 : 200 });
    } catch (error) {
      rethrowAsAgentApiError(error);
    }
  });
}

export async function DELETE(event: APIEvent) {
  return withAgentApi(event, { scopes: ["node:write"] }, async (context) => {
    const input = await readLinkInput(event);
    try {
      const removed = await removeProjectLinkOnDisk({ ...input, actor: toAgentOperationActor(context.actor) });
      return agentJson({ removed });
    } catch (error) {
      rethrowAsAgentApiError(error);
    }
  });
}

async function readLinkInput(event: APIEvent) {
  const input = await readJsonRecord(event);
  if (typeof input.target !== "string" || !input.target.trim()) {
    throw new AgentApiError("invalid_link", "A target node id is required.", 400);
  }
  if (input.relationship !== undefined && typeof input.relationship !== "string") {
    throw new AgentApiError("invalid_relationship", "relationship must be a string.", 400);
  }
  return {
    projectId: event.params.projectId,
    source: event.params.nodeId,
    target: input.target,
    relationship: input.relationship as string | undefined,
  };
}
