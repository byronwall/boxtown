import type { APIEvent } from "@solidjs/start/server";
import { AgentApiError } from "~/lib/agent-api/errors.server";
import { withAgentApi } from "~/lib/agent-api/handler.server";
import {
  parseExpectedRevision,
  readJsonRecord,
  respondWithNodePatch,
} from "~/lib/agent-api/node-patch.server";
import { agentJson } from "~/lib/agent-api/response.server";
import { readProjectByIdFromDisk } from "~/lib/projects/data.server";

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
    });
  });
}

// Pass `expectedRevision` (from a node read) to refuse replacing prose that
// changed since it was read.
export async function PUT(event: APIEvent) {
  return withAgentApi(event, { scopes: ["node:write"] }, async (context) => {
    const input = await readJsonRecord(event);
    if (typeof input.context !== "string") {
      throw new AgentApiError("invalid_context", "A string context is required.", 400);
    }

    return respondWithNodePatch(event, context.actor, { context: input.context }, {
      expectedRevision: parseExpectedRevision(input),
      clientMutationId: input.clientMutationId,
    });
  });
}
