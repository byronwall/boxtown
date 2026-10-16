import type { APIEvent } from "@solidjs/start/server";
import { AgentApiError } from "~/lib/agent-api/errors.server";
import { withAgentApi } from "~/lib/agent-api/handler.server";
import {
  parseExpectedRevision,
  parseMetadataPatch,
  parseUnsetKeys,
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
      metadata: node.metadata,
    });
  });
}

// Applies `set`/`unset` against the latest stored metadata inside the write
// queue, so concurrent updates to different keys both survive. A `metadata`
// map is an explicit full replacement.
export async function PATCH(event: APIEvent) {
  return withAgentApi(event, { scopes: ["node:write"] }, async (context) => {
    const input = await readJsonRecord(event);
    const replace = input.metadata === undefined ? undefined : parseMetadataPatch(input.metadata)?.replace;
    const set = input.set === undefined ? undefined : parseMetadataPatch({ set: input.set })?.set;
    const unset = parseUnsetKeys(input.unset);
    if (!replace && !set && !unset) {
      throw new AgentApiError("empty_update", "Provide set, unset, or metadata.", 400);
    }

    return respondWithNodePatch(event, context.actor, { metadata: { replace, set, unset } }, {
      expectedRevision: parseExpectedRevision(input),
      clientMutationId: input.clientMutationId,
    });
  });
}
