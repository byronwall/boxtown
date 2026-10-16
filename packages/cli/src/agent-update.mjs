import { CliError, exitCodes } from "./errors.mjs";

// Agent status files map onto ordinary metadata fields. Each listed field must
// exist in the project schema; the batch preflight names any that are missing
// and the command to add them.
const listFields = {
  completed: "completed",
  deferred: "deferred",
  blockedBy: "blocked-by",
  verification: "verification",
  filesChanged: "files-changed",
};
const textFields = { solution: "solution", outcome: "outcome" };
const summaryFields = ["summary", "note", "implementation"];
const passThroughFields = ["id", "nodeId", "status", "title", "priority", "expectedRevision", "metadata"];
const allowedKeys = new Set([
  ...passThroughFields,
  ...summaryFields,
  ...Object.keys(listFields),
  ...Object.keys(textFields),
]);

export function normalizeAgentUpdate(update) {
  if (!update || typeof update !== "object" || Array.isArray(update)) {
    throw new CliError("Each agent update must be an object.", exitCodes.usage);
  }
  const unknownKeys = Object.keys(update).filter((key) => !allowedKeys.has(key));
  if (unknownKeys.length > 0) {
    // Returned as an item the batch rejects, so the other updates still run.
    return { id: update.id ?? update.nodeId, invalidKeys: unknownKeys };
  }

  const metadata = { ...update.metadata };
  const summary = summaryFields.map((key) => update[key]).find((value) => typeof value === "string" && value.trim());
  if (summary) metadata.implementation = summary.trim();
  for (const [inputKey, fieldKey] of Object.entries(listFields)) {
    const value = toText(update[inputKey]);
    if (value) metadata[fieldKey] = value;
  }
  for (const [inputKey, fieldKey] of Object.entries(textFields)) {
    const value = toText(update[inputKey]);
    if (value) metadata[fieldKey] = value;
  }

  const normalized = { id: update.id ?? update.nodeId };
  for (const key of ["status", "title", "priority", "expectedRevision"]) {
    if (update[key] !== undefined) normalized[key] = update[key];
  }
  if (Object.keys(metadata).length > 0) normalized.metadata = metadata;
  return normalized;
}

export function describeAllowedAgentUpdateKeys() {
  return [...allowedKeys].join(", ");
}

function toText(value) {
  if (Array.isArray(value)) return value.map(String).join("\n").trim();
  return typeof value === "string" ? value.trim() : "";
}
