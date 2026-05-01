import type { APIEvent } from "@solidjs/start/server";
import { authenticateAgentRequest } from "./auth.server";
import { errorToResponse } from "./errors.server";
import type { AgentApiContext } from "./types";

export async function withAgentApi(
  event: APIEvent,
  options: { scopes: string[] },
  handler: (context: AgentApiContext) => Response | Promise<Response>,
) {
  try {
    const actor = authenticateAgentRequest(event, options.scopes);
    return await handler({ actor });
  } catch (error) {
    return errorToResponse(error);
  }
}
