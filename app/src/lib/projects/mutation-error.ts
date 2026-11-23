import type { ProjectNodeMetadataField } from "./types";

// A rejected project write. Thrown before anything is saved; API routes pass
// the code, status, and details through to the caller.
export class ProjectMutationError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ProjectMutationError";
  }
}

export function findUnknownMetadataKeys(keys: Iterable<string>, schema: ProjectNodeMetadataField[]) {
  const known = new Set(schema.map((field) => field.key));
  return [...new Set(keys)].filter((key) => !known.has(key));
}

// Lists the fields that do exist, so the caller can reuse one instead of
// adding a near-duplicate, and says how to add a field deliberately.
export function unknownMetadataKeysError(keys: string[], schema: ProjectNodeMetadataField[]) {
  const available = schema.map((field) => field.key);
  return new ProjectMutationError(
    "invalid_metadata_key",
    `Unknown metadata field${keys.length === 1 ? "" : "s"}: ${keys.join(", ")}. ` +
      `This project defines: ${available.join(", ") || "(none)"}. ` +
      `Use an existing field, or add one with: boxtown project schema ensure-field ${keys[0]} --label "<Label>"`,
    400,
    {
      keys,
      fields: schema.map((field) => ({ key: field.key, label: field.label })),
      ensureFieldCommand: `boxtown project schema ensure-field ${keys[0]} --label "<Label>"`,
    },
  );
}

export function assertKnownMetadataKeys(
  metadata: Record<string, unknown> | null | undefined,
  schema: ProjectNodeMetadataField[],
) {
  const unknownKeys = findUnknownMetadataKeys(Object.keys(metadata ?? {}), schema);
  if (unknownKeys.length > 0) throw unknownMetadataKeysError(unknownKeys, schema);
}
