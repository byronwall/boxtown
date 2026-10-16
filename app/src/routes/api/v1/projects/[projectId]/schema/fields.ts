import type { APIEvent } from "@solidjs/start/server";
import { AgentApiError, rethrowAsAgentApiError } from "~/lib/agent-api/errors.server";
import { withAgentApi } from "~/lib/agent-api/handler.server";
import { readJsonRecord } from "~/lib/agent-api/node-patch.server";
import { toAgentOperationActor } from "~/lib/agent-api/operation-actor";
import { agentJson } from "~/lib/agent-api/response.server";
import { ensureProjectMetadataFieldOnDisk } from "~/lib/projects/schema-fields.server";

// Ensures one metadata field exists. Safe to repeat; never replaces the schema.
export async function POST(event: APIEvent) {
  return withAgentApi(event, { scopes: ["project:write"] }, async (context) => {
    const input = await readJsonRecord(event);
    if (typeof input.key !== "string") {
      throw new AgentApiError("invalid_metadata_key", "A string key is required.", 400);
    }
    for (const name of ["label", "defaultValue"] as const) {
      if (input[name] !== undefined && typeof input[name] !== "string") {
        throw new AgentApiError("invalid_metadata_field", `${name} must be a string.`, 400);
      }
    }

    try {
      const result = await ensureProjectMetadataFieldOnDisk({
        projectId: event.params.projectId,
        key: input.key,
        label: input.label as string | undefined,
        defaultValue: input.defaultValue as string | undefined,
        actor: toAgentOperationActor(context.actor),
      });
      return agentJson(result, { status: result.created ? 201 : 200 });
    } catch (error) {
      rethrowAsAgentApiError(error);
    }
  });
}
