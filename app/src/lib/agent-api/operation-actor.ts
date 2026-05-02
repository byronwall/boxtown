import type { AgentActor } from "./types";
import type { ProjectOperationActor } from "~/lib/projects/types";

export function toAgentOperationActor(actor: AgentActor): ProjectOperationActor {
  return {
    kind: "agent",
    id: actor.id,
    label: actor.tokenSuffix ? `Agent token ...${actor.tokenSuffix}` : "Agent API",
  };
}
