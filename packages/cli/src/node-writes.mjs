import { describeAllowedAgentUpdateKeys } from "./agent-update.mjs";
import { CliError, exitCodes } from "./errors.mjs";

// Node writes that send one request per node. The server validates every
// field before saving, so an item is either fully applied or not applied.

const passThroughFields = ["title", "status", "type", "priority", "archived", "context"];

// Sends one compound update and returns a receipt built from what the server saved.
export async function patchNode(client, projectId, nodeId, patch) {
  const response = await client.updateNode(projectId, nodeId, patch);
  return toReceipt(nodeId, response);
}

export function toReceipt(nodeId, response) {
  const node = response.node;
  const changedFields = response.changedFields ?? [];
  return {
    nodeId: node?.id ?? nodeId,
    outcome: "applied",
    status: node?.status,
    changedFields,
    savedFields: pickSavedFields(node, changedFields),
    revision: response.revision ?? null,
    operationId: response.operationId ?? null,
    node,
  };
}

// The saved value of each changed field. Context is long, so only its length is shown.
function pickSavedFields(node, changedFields) {
  if (!node) return {};
  const saved = {};
  for (const field of changedFields) {
    if (field.startsWith("metadata.")) {
      saved[field] = node.metadata?.[field.slice("metadata.".length)] ?? null;
    } else if (field === "title") {
      saved.title = node.label;
    } else if (field === "context") {
      saved.contextLength = node.context?.length ?? 0;
    } else {
      saved[field] = node[field] ?? null;
    }
  }
  return saved;
}

// Applies independent node updates in order. Items that fail the schema check
// are rejected without a request. A request that may have reached the server
// before failing is reported as `unknown`, never retried automatically.
export async function applyNodeUpdates(context, projectId, updates) {
  const schema = await context.client.getProjectSchema(projectId);
  const results = [];

  for (const [index, update] of updates.entries()) {
    const nodeId = update?.id ?? update?.nodeId;
    if (typeof nodeId !== "string" || nodeId.trim().length === 0) {
      results.push(rejected(index, null, "missing_node_id", "Missing node id."));
      continue;
    }

    let patch;
    try {
      patch = toPatch(update, schema);
    } catch (error) {
      results.push(rejected(index, nodeId, error.code ?? "invalid_update", error.message, error.details));
      continue;
    }

    try {
      const receipt = await patchNode(context.client, projectId, nodeId, patch);
      const { node: _node, ...compact } = receipt;
      results.push({ index, ...compact });
    } catch (error) {
      results.push(toFailedResult(index, nodeId, error));
    }
  }

  return { target: context.target, ...summarizeResults(results) };
}

function toPatch(update, schema) {
  if (update.invalidKeys) {
    throw invalid(
      "unknown_update_key",
      `Unknown update key${update.invalidKeys.length === 1 ? "" : "s"}: ${update.invalidKeys.join(", ")}. ` +
        `Supported keys: ${describeAllowedAgentUpdateKeys()}. Put other project fields under "metadata".`,
      { keys: update.invalidKeys },
    );
  }
  const patch = {};
  for (const field of passThroughFields) {
    if (update[field] !== undefined) patch[field] = update[field];
  }
  if (update.expectedRevision !== undefined) patch.expectedRevision = update.expectedRevision;
  if (update.metadata !== undefined) {
    if (!update.metadata || typeof update.metadata !== "object" || Array.isArray(update.metadata)) {
      throw invalid("invalid_metadata", "metadata must be an object of string values.");
    }
    if (Object.keys(update.metadata).length > 0) patch.metadata = { set: update.metadata };
  }

  const statuses = schema.statuses.map((status) => status.value);
  if (patch.status !== undefined && !statuses.includes(patch.status)) {
    throw invalid("invalid_status", `Unknown status "${patch.status}". Use one of: ${statuses.join(", ")}.`);
  }
  assertKnownMetadataKeys(Object.keys(patch.metadata?.set ?? {}), schema);
  if (Object.keys(patch).filter((key) => key !== "expectedRevision").length === 0) {
    throw invalid("empty_update", "No supported fields to update.");
  }
  return patch;
}

export function assertKnownMetadataKeys(keys, schema) {
  const known = schema.metadataFields.map((field) => field.key);
  const unknown = keys.filter((key) => !known.includes(key));
  if (unknown.length === 0) return;
  throw invalid(
    "invalid_metadata_key",
    `Unknown metadata field${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}. ` +
      `This project defines: ${known.join(", ") || "(none)"}. Use an existing field, or add one with: ` +
      unknown.map((key) => `boxtown project schema ensure-field ${key} --label "<Label>"`).join("; "),
    { keys: unknown, fields: schema.metadataFields.map(({ key, label }) => ({ key, label })) },
  );
}

function invalid(code, message, details) {
  return Object.assign(new CliError(message, exitCodes.usage), { code, details });
}

function rejected(index, nodeId, code, message, details) {
  return { index, nodeId, outcome: "rejected", error: { code, message, ...(details ? { details } : {}) } };
}

function toFailedResult(index, nodeId, error) {
  const message = error instanceof Error ? error.message : "Update failed.";
  // No response, or a server error: the write may or may not have been saved.
  if (error?.transport || (error?.httpStatus ?? 0) >= 500 || !error?.httpStatus) {
    return {
      index,
      nodeId,
      outcome: "unknown",
      error: { code: error?.code ?? "unknown_outcome", message },
      readback: `boxtown node view ${nodeId} --json`,
    };
  }
  const outcome = error.httpStatus === 409 ? "conflict" : "rejected";
  return { index, nodeId, outcome, error: { code: error.code, message, ...(error.details ? { details: error.details } : {}) } };
}

function summarizeResults(results) {
  const failedCount = results.filter((result) => result.outcome !== "applied").length;
  return {
    results,
    appliedCount: results.length - failedCount,
    failedCount,
    // Older field names, kept for scripts written against them.
    updated: results
      .filter((result) => result.outcome === "applied")
      .map((result) => ({ id: result.nodeId, status: result.status, updatedFields: result.changedFields })),
    failed: results
      .filter((result) => result.outcome !== "applied")
      .map((result) => ({ id: result.nodeId, outcome: result.outcome, error: result.error.message })),
  };
}

// Writes the batch result, then fails the process when any item was not applied.
export function finishBatch(context, result, noun, writeMaybeJson) {
  writeMaybeJson(
    context,
    result,
    `Applied ${result.appliedCount} ${noun}${result.appliedCount === 1 ? "" : "s"}; ${result.failedCount} not applied.\n` +
      result.results
        .filter((item) => item.outcome !== "applied")
        .map((item) => `  [${item.index}] ${item.nodeId ?? "(no id)"} ${item.outcome}: ${item.error.message}\n`)
        .join(""),
  );
  if (result.failedCount > 0) {
    throw new CliError(
      `${result.failedCount} of ${result.results.length} ${noun}s were not applied.`,
      exitCodes.partialFailure,
    );
  }
}

// Text for a field from `--<name>`, `--<name>-file <path>`, or `--<name>-file -` (stdin).
// File and stdin text is stored exactly as read, so shell syntax is never evaluated.
export async function readTextOption(context, name, readFileText) {
  const options = context.parsed.options;
  const fileOption = options[`${name}File`];
  if (typeof fileOption === "string") {
    return fileOption === "-" ? readStdin(context.io.stdin) : readFileText(fileOption, context.io.cwd);
  }
  const value = options[name];
  return typeof value === "string" ? value : undefined;
}

export async function readStdin(stdin = process.stdin) {
  let text = "";
  stdin.setEncoding?.("utf8");
  for await (const chunk of stdin) text += chunk;
  return text;
}
