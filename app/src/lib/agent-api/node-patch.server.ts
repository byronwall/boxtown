import type { APIEvent } from "@solidjs/start/server";
import { patchProjectNodeOnDisk, type ProjectNodePatch } from "~/lib/projects/node-patch.server";
import { AgentApiError, rethrowAsAgentApiError } from "./errors.server";
import { toAgentOperationActor } from "./operation-actor";
import { toAgentMapNode } from "./projections.server";
import { agentJson } from "./response.server";
import type { AgentActor } from "./types";

type RecordValue = Record<string, unknown>;

// Reads the PATCH body shared by the node routes. Shape errors are reported
// before the storage call, so nothing is written for a malformed request.
export function parseNodePatchBody(input: RecordValue): ProjectNodePatch {
  const patch: ProjectNodePatch = {};
  const title = input.title ?? input.label;
  if (title !== undefined) {
    if (typeof title !== "string") throw new AgentApiError("invalid_title", "title must be a string.", 400);
    patch.title = title;
  }
  if (input.status !== undefined) patch.status = input.status as string;
  if (input.type !== undefined) {
    if (typeof input.type !== "string") throw new AgentApiError("invalid_type", "type must be a string.", 400);
    patch.type = input.type;
  }
  if (input.archived !== undefined) patch.archived = input.archived as boolean;
  if (input.priority !== undefined) patch.priority = input.priority as string | null;
  if (input.context !== undefined) {
    if (typeof input.context !== "string") {
      throw new AgentApiError("invalid_context", "A string context is required.", 400);
    }
    patch.context = input.context;
  }
  const metadata = parseMetadataPatch(input.metadata);
  if (metadata) patch.metadata = metadata;
  return patch;
}

// Accepts `{ set, unset, replace }`, or a plain map as an explicit replacement.
export function parseMetadataPatch(value: unknown): ProjectNodePatch["metadata"] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!isRecord(value)) {
    throw new AgentApiError("invalid_metadata", "metadata must be an object.", 400);
  }
  const isOperation = "set" in value || "unset" in value || "replace" in value;
  if (!isOperation) return { replace: value };

  const set = value.set === undefined ? undefined : requireRecord(value.set, "metadata.set");
  const replace = value.replace === undefined ? undefined : requireRecord(value.replace, "metadata.replace");
  return { set, replace, unset: parseUnsetKeys(value.unset) };
}

export function parseUnsetKeys(value: unknown) {
  if (value === undefined) return undefined;
  if (typeof value === "string") return [value];
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) return value as string[];
  throw new AgentApiError("invalid_metadata", "unset must be a key or a list of keys.", 400);
}

export function parseExpectedRevision(input: RecordValue) {
  const value = input.expectedRevision;
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length === 0) {
    throw new AgentApiError("invalid_revision", "expectedRevision must be a non-empty string.", 400);
  }
  return value;
}

export async function respondWithNodePatch(
  event: APIEvent,
  actor: AgentActor,
  patch: ProjectNodePatch,
  options: { expectedRevision?: string; clientMutationId?: unknown } = {},
) {
  try {
    const result = await patchProjectNodeOnDisk({
      projectId: event.params.projectId,
      nodeId: event.params.nodeId,
      patch,
      expectedRevision: options.expectedRevision,
      actor: toAgentOperationActor(actor),
      clientMutationId: typeof options.clientMutationId === "string" ? options.clientMutationId : undefined,
    });
    return agentJson({
      node: toAgentMapNode(result.node),
      revision: result.revision,
      changedFields: result.changedFields,
      operationId: result.operationId,
    });
  } catch (error) {
    rethrowAsAgentApiError(error);
  }
}

export async function readJsonRecord(event: APIEvent) {
  const input = await event.request.json().catch(() => null);
  if (!isRecord(input)) {
    throw new AgentApiError("invalid_json", "A JSON body is required.", 400);
  }
  return input;
}

function requireRecord(value: unknown, name: string) {
  if (!isRecord(value)) throw new AgentApiError("invalid_metadata", `${name} must be an object.`, 400);
  return value;
}

function isRecord(value: unknown): value is RecordValue {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
