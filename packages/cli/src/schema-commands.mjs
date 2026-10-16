import { requireOption, requireProject, writeMaybeJson } from "./cli-helpers.mjs";

// pgm project schema ensure-field <key> [--label] [--default]
export async function dispatchSchemaEnsureField(context) {
  const projectId = requireProject(context);
  const key = requireOption(
    context.parsed.positionals[1],
    "Usage: pgm project schema ensure-field <key> [--label \"Label\"] [--default \"Default\"]",
  );
  const options = context.parsed.options;
  const result = await context.client.ensureMetadataField(projectId, {
    key,
    ...(typeof options.label === "string" ? { label: options.label } : {}),
    ...(typeof options.default === "string" ? { defaultValue: options.default } : {}),
  });
  const verb = result.created ? "Added" : "Already defined:";
  writeMaybeJson(
    context,
    { projectId, ...result },
    `${verb} ${result.field.key} (${result.field.label}). Fields: ${result.fields.map((field) => field.key).join(", ")}\n`,
  );
}
