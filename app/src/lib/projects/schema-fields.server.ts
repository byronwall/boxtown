import {
  appendProjectOperation,
  getMutationMetadata,
  readProjectByIdFromDisk,
  serializedMutation,
  writeProjectAndPublish,
} from "./data.server";
import { ProjectMutationError } from "./mutation-error";
import { normalizeProjectNodeMetadataKey, normalizeProjectNodeMetadataLabel } from "./node-metadata";
import type { ProjectNodeMetadataField, ProjectOperationActor } from "./types";

export interface EnsureMetadataFieldInput {
  projectId: string;
  key: string;
  label?: string;
  defaultValue?: string;
  actor?: ProjectOperationActor;
  clientMutationId?: string;
}

export interface EnsureMetadataFieldResult {
  field: ProjectNodeMetadataField;
  created: boolean;
  fields: ProjectNodeMetadataField[];
}

// Adds one metadata field without touching the others. Repeating the call is a
// no-op; a different label or default for an existing key is a conflict rather
// than a silent overwrite.
export const ensureProjectMetadataFieldOnDisk = serializedMutation(async function ensureProjectMetadataFieldOnDisk(
  input: EnsureMetadataFieldInput,
): Promise<EnsureMetadataFieldResult> {
  const key = normalizeProjectNodeMetadataKey(input.key);
  if (!key) {
    throw new ProjectMutationError("invalid_metadata_key", "A metadata field key is required.");
  }
  if (key !== input.key) {
    throw new ProjectMutationError(
      "invalid_metadata_key",
      `Metadata keys use lowercase letters, digits, and dashes. Use "${key}" instead of "${input.key}".`,
      400,
      { key: input.key, suggestedKey: key },
    );
  }

  const current = await readProjectByIdFromDisk(input.projectId);
  if (!current) {
    throw new ProjectMutationError("project_not_found", "Project not found.", 404, { projectId: input.projectId });
  }

  const existing = current.nodeMetadataSchema.find((field) => field.key === key);
  if (existing) {
    const labelConflict = input.label !== undefined && input.label.trim() !== existing.label;
    const defaultConflict = input.defaultValue !== undefined && input.defaultValue.trim() !== existing.defaultValue;
    if (labelConflict || defaultConflict) {
      throw new ProjectMutationError(
        "metadata_field_conflict",
        `Metadata field "${key}" already exists with a different ${labelConflict ? "label" : "default value"}. ` +
          "Change it in project settings if that is intended.",
        409,
        { field: existing },
      );
    }
    return { field: existing, created: false, fields: current.nodeMetadataSchema };
  }

  const field: ProjectNodeMetadataField = {
    key,
    label: normalizeProjectNodeMetadataLabel(input.label ?? "", key),
    defaultValue: input.defaultValue?.trim() ?? "",
  };
  const nextRecord = appendProjectOperation({
    ...current,
    updatedAt: new Date().toISOString(),
    nodeMetadataSchema: [...current.nodeMetadataSchema, field],
  }, {
    kind: "project.schema.updated",
    actor: input.actor,
    summary: `Added metadata field "${field.label}" (${key}).`,
    metadata: { ...getMutationMetadata(input), field: key },
  });
  await writeProjectAndPublish(nextRecord);

  return { field, created: true, fields: nextRecord.nodeMetadataSchema };
});
