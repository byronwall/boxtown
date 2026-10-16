import { readFile } from "node:fs/promises";
import path from "node:path";
import { CliError, exitCodes } from "./errors.mjs";
import { writeJson } from "./output.mjs";

export function requireProject(context) {
  return requireOption(
    context.projectId,
    "A project id is required. Use --project <id>, PRODUCT_GRID_PROJECT, or pgm project link <id>.",
  );
}

export function requireOption(value, message) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new CliError(message, exitCodes.usage);
  }
  return value;
}

export function writeMaybeJson(context, jsonValue, humanValue) {
  if (context.parsed.options.json) {
    writeJson(jsonValue, context.io.stdout);
  } else {
    context.io.stdout.write(humanValue);
  }
}

export function resolveInputPath(value, cwd) {
  return path.isAbsolute(value) ? value : path.resolve(cwd, value);
}

export async function readJsonInput(file, cwd) {
  const raw = await readFile(resolveInputPath(file, cwd), "utf8");
  try {
    if (file.endsWith(".jsonl")) {
      return raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => JSON.parse(line));
    }
    return JSON.parse(raw);
  } catch (error) {
    throw new CliError(
      `Could not parse JSON input. ${error instanceof Error ? error.message : ""}`.trim(),
      exitCodes.usage,
    );
  }
}

export async function readOptionalTextInput(file, cwd) {
  if (typeof file !== "string" || file.trim().length === 0) {
    return undefined;
  }

  return readFile(resolveInputPath(file, cwd), "utf8");
}
