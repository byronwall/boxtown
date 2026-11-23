import { packageName, packageVersion } from "./version.mjs";

const registryBaseUrl = "https://registry.npmjs.org";
const updateCheckTimeoutMs = 800;

export async function notifyIfUpdateAvailable(io = {}, options = {}) {
  if (io.env?.BOXTOWN_NO_UPDATE_CHECK === "1" || io.env?.NO_UPDATE_NOTIFIER === "1") {
    return;
  }

  const fetchImpl = options.fetch ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    return;
  }

  const latestVersion = await fetchLatestVersion(fetchImpl, options);
  if (!latestVersion || !isNewerVersion(latestVersion, packageVersion)) {
    return;
  }

  const command = "boxtown update";
  io.stderr?.write(
    [
      `A fresh boxtown update is ready: ${packageVersion} -> ${latestVersion}.`,
      `Worth grabbing when you have a minute: ${command}`,
      "",
    ].join("\n"),
  );
}

async function fetchLatestVersion(fetchImpl, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? updateCheckTimeoutMs);

  try {
    const response = await fetchImpl(`${registryBaseUrl}/${encodeURIComponent(packageName)}/latest`, {
      headers: {
        accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const metadata = await response.json();
    return typeof metadata.version === "string" ? metadata.version : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export function isNewerVersion(candidate, current) {
  const candidateParts = parseVersion(candidate);
  const currentParts = parseVersion(current);
  if (!candidateParts || !currentParts) {
    return false;
  }

  for (let index = 0; index < 3; index += 1) {
    if (candidateParts[index] > currentParts[index]) {
      return true;
    }
    if (candidateParts[index] < currentParts[index]) {
      return false;
    }
  }

  return false;
}

function parseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(version);
  if (!match) {
    return null;
  }

  return match.slice(1).map((part) => Number.parseInt(part, 10));
}
