import { getConfigPath, readConfig, resolveProjectId, resolveServer, resolveToken, defaultServer } from "./config.mjs";
import { CliError, exitCodes } from "./errors.mjs";
import { describeNetworkError } from "./network-errors.mjs";
import { writeJson } from "./output.mjs";

// boxtown target inspect: where commands would read and write, and whether it is
// reachable. Starts and stops nothing, and never prints the token.
export async function dispatchTarget(parsed, io) {
  if (parsed.command[1] !== "inspect") {
    throw new CliError("Usage: boxtown target inspect [--local <folder>] [--project <id>] [--json]", exitCodes.usage);
  }

  const target = parsed.options.local !== undefined
    ? await inspectLocal(parsed, io)
    : await inspectRemote(parsed, io);

  if (parsed.options.json) {
    writeJson({ target }, io.stdout);
  } else {
    io.stdout.write(formatTarget(target));
  }
}

async function inspectLocal(parsed, io) {
  if (typeof parsed.options.local !== "string") {
    throw new CliError("Use --local <folder> to inspect local project data.", exitCodes.usage);
  }
  const { inspectLocalTarget } = await import("../build/local-runtime-sharing.mjs");
  const projectId = typeof parsed.options.project === "string" ? parsed.options.project : null;
  return inspectLocalTarget(parsed.options.local, io.cwd, projectId);
}

async function inspectRemote(parsed, io) {
  const configPath = getConfigPath(io.env);
  const config = await readConfig(configPath);
  const server = resolveServer(parsed.options, config, io.env);
  const token = resolveToken(parsed.options, config, server, io.env);
  const projectId = resolveProjectId(parsed.options, config, io.env);

  return {
    mode: "remote",
    server,
    serverSource: parsed.options.server !== undefined
      ? "--server"
      : io.env.BOXTOWN_SERVER ? "BOXTOWN_SERVER" : config.defaultServer !== defaultServer ? "config" : "default",
    token: token
      ? {
          present: true,
          source: parsed.options.token !== undefined ? "--token" : io.env.BOXTOWN_TOKEN ? "BOXTOWN_TOKEN" : "config",
        }
      : { present: false },
    project: projectId
      ? {
          id: projectId,
          source: parsed.options.project !== undefined
            ? "--project"
            : io.env.BOXTOWN_PROJECT ? "BOXTOWN_PROJECT" : "linked in config",
        }
      : null,
    configPath,
    reachability: await checkReachable(server),
  };
}

async function checkReachable(server) {
  try {
    const response = await fetch(`${server}/api/v1/version`, { signal: AbortSignal.timeout(2000) });
    const body = await response.json().catch(() => ({}));
    return response.ok
      ? { reachable: true, apiVersion: body.apiVersion ?? null }
      : { reachable: false, problem: { reason: "http", code: String(response.status) } };
  } catch (error) {
    const described = describeNetworkError(error);
    return { reachable: false, problem: { reason: described.kind, code: described.code, message: described.message } };
  }
}

function formatTarget(target) {
  if (target.mode === "local") {
    const runtime = target.runtime;
    return [
      "Mode: local",
      `Data folder: ${target.dataDir}${target.dataDirExists ? "" : " (does not exist)"}`,
      `Project: ${target.project ? `${target.project.id}${target.project.exists ? "" : " (not found)"}` : "(none)"}`,
      runtime
        ? `Runtime: ${runtime.mode} ${runtime.state} at ${runtime.url ?? "(no address)"}, owner ${runtime.ownerAlive ? "running" : "gone"}, ${runtime.reachable ? "reachable" : `not reachable: ${runtime.problem?.message ?? "unknown"}`}`
        : "Runtime: none running (a --local command starts one when needed)",
      "",
    ].join("\n");
  }
  return [
    "Mode: remote",
    `Server: ${target.server} (from ${target.serverSource})`,
    `Token: ${target.token.present ? `set (from ${target.token.source})` : "not set"}`,
    `Project: ${target.project ? `${target.project.id} (from ${target.project.source})` : "(none)"}`,
    `Reachable: ${target.reachability.reachable ? "yes" : `no, ${target.reachability.problem.message ?? target.reachability.problem.reason}`}`,
    "",
  ].join("\n");
}
