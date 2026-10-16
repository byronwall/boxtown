import type { APIEvent } from "@solidjs/start/server";
import { withAgentApi } from "~/lib/agent-api/handler.server";
import { parseNote, readJsonRecord, respondWithNodePatch } from "~/lib/agent-api/node-patch.server";

// Appends a note to the node's context on the server. Concurrent notes are all
// kept, and the note text is also recorded in its history entry.
export async function POST(event: APIEvent) {
  return withAgentApi(event, { scopes: ["node:write"] }, async (context) => {
    const input = await readJsonRecord(event);
    const note = parseNote({ text: input.text, heading: input.heading });
    return respondWithNodePatch(event, context.actor, { note }, { clientMutationId: input.clientMutationId });
  });
}
