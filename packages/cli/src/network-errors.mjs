// Classifies why a connection failed, so a blocked socket is not reported as
// a server that is still starting. Node's fetch hides the system error code
// in `cause`.

const permissionCodes = new Set(["EPERM", "EACCES"]);
const refusedCodes = new Set(["ECONNREFUSED", "ECONNRESET"]);
const timeoutCodes = new Set(["ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT"]);

export function getNetworkErrorCode(error) {
  let current = error;
  for (let depth = 0; current && depth < 4; depth += 1) {
    if (typeof current.code === "string") return current.code;
    if (current.name === "TimeoutError" || current.name === "AbortError") return "ETIMEDOUT";
    current = current.cause;
  }
  return undefined;
}

export function describeNetworkError(error) {
  const code = getNetworkErrorCode(error);
  if (code && permissionCodes.has(code)) {
    return {
      kind: "permission",
      code,
      message: `the connection was blocked (${code}). A sandbox or firewall may be denying local network access; allow it and retry.`,
    };
  }
  if (code && refusedCodes.has(code)) {
    return { kind: "refused", code, message: `nothing is accepting connections there (${code}). Is the server running?` };
  }
  if (code && timeoutCodes.has(code)) {
    return { kind: "timeout", code, message: `the server did not answer in time (${code}).` };
  }
  return {
    kind: "unreachable",
    code: code ?? null,
    message: error instanceof Error && error.message ? `${error.message}${code ? ` (${code})` : ""}.` : "unknown network error.",
  };
}
