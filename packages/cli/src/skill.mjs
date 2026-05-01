import { access, cp, mkdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CliError, exitCodes } from "./errors.mjs";

const skillName = "product-grid-context";

export function getBundledSkillPath() {
  const currentFile = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(currentFile), "..", "skills", skillName);
}

export async function readBundledSkillMarkdown() {
  return readFile(path.join(getBundledSkillPath(), "SKILL.md"), "utf8");
}

export function resolveSkillInstallTarget({
  agent = "codex",
  global = false,
  cwd = process.cwd(),
}) {
  const normalizedAgent = String(agent || "codex").toLowerCase();

  if (!global) {
    return path.join(cwd, ".agents", "skills", skillName);
  }

  if (normalizedAgent === "codex") {
    return path.join(os.homedir(), ".codex", "skills", skillName);
  }

  if (normalizedAgent === "universal") {
    return path.join(os.homedir(), ".config", "agents", "skills", skillName);
  }

  throw new CliError(
    `Unsupported agent "${agent}". Supported agents: codex, universal.`,
    exitCodes.usage,
  );
}

export async function installBundledSkill({
  agent = "codex",
  global = false,
  cwd = process.cwd(),
  force = false,
}) {
  const source = getBundledSkillPath();
  const target = resolveSkillInstallTarget({ agent, global, cwd });
  const exists = await pathExists(target);

  if (exists && !force) {
    throw new CliError(
      `Skill already exists at ${target}. Re-run with --force to replace it.`,
      exitCodes.usage,
    );
  }

  if (exists) {
    await rm(target, { recursive: true, force: true });
  }

  await mkdir(path.dirname(target), { recursive: true });
  await cp(source, target, { recursive: true });

  return {
    skill: skillName,
    agent,
    scope: global ? "global" : "project",
    source,
    target,
  };
}

async function pathExists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}
