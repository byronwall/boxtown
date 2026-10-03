import type { APIEvent } from "@solidjs/start/server";
import { withAgentApi } from "~/lib/agent-api/handler.server";
import { agentJson } from "~/lib/agent-api/response.server";

export function GET(event: APIEvent) {
  const id = process.env.PGM_LOCAL_RUNTIME_ID;
  const dataDir = process.env.APP_DATA_DIR;
  if (!id || !dataDir) return new Response(null, { status: 404 });

  return withAgentApi(event, { scopes: ["project:read"] }, () => agentJson({ id, dataDir }));
}
