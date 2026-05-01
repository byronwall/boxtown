import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export const defaultServer = "http://localhost:3000";

export function getConfigPath(env = process.env, platform = process.platform) {
  if (env.PRODUCT_GRID_CONFIG) {
    return path.resolve(env.PRODUCT_GRID_CONFIG);
  }

  if (platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "product-grid", "cli.json");
  }

  if (platform === "win32") {
    return path.join(env.APPDATA ?? os.homedir(), "product-grid", "cli.json");
  }

  return path.join(env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config"), "product-grid", "cli.json");
}

export async function readConfig(configPath = getConfigPath()) {
  if (!existsSync(configPath)) {
    return createEmptyConfig();
  }

  const raw = await readFile(configPath, "utf8");
  try {
    return { ...createEmptyConfig(), ...JSON.parse(raw) };
  } catch {
    return createEmptyConfig();
  }
}

export async function writeConfig(config, configPath = getConfigPath()) {
  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, `${JSON.stringify({ ...createEmptyConfig(), ...config }, null, 2)}\n`, {
    mode: 0o600,
  });
}

export async function updateConfig(mutator, configPath = getConfigPath()) {
  const config = await readConfig(configPath);
  const nextConfig = await mutator(config);
  await writeConfig(nextConfig, configPath);
  return nextConfig;
}

export function resolveServer(options, config, env = process.env) {
  return trimTrailingSlash(
    options.server ?? env.PRODUCT_GRID_SERVER ?? config.defaultServer ?? defaultServer,
  );
}

export function resolveToken(options, config, server, env = process.env) {
  return options.token ?? env.PRODUCT_GRID_TOKEN ?? config.tokens?.[server] ?? null;
}

export function resolveProjectId(options, config, env = process.env) {
  return options.project ?? env.PRODUCT_GRID_PROJECT ?? config.currentProjectId ?? null;
}

function createEmptyConfig() {
  return {
    defaultServer,
    currentProjectId: null,
    tokens: {},
  };
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}
