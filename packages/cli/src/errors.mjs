export class CliError extends Error {
  // `extra` carries the server's error `code` and `details`, the HTTP status,
  // and `transport: true` when the request may not have reached the server.
  constructor(message, exitCode = 1, extra = {}) {
    super(message);
    this.name = "CliError";
    this.exitCode = exitCode;
    this.code = extra.code;
    this.details = extra.details;
    this.httpStatus = extra.httpStatus;
    this.transport = extra.transport === true;
  }
}

export const exitCodes = {
  generic: 1,
  usage: 2,
  auth: 3,
  notFound: 4,
  conflict: 5,
  permission: 6,
  remoteRunFailed: 7,
  // A batch finished but at least one item was not applied.
  partialFailure: 8,
};

export function apiErrorToExitCode(code, status) {
  if (status === 401) return exitCodes.auth;
  if (status === 403) return exitCodes.permission;
  if (status === 404) return exitCodes.notFound;
  if (status === 409) return exitCodes.conflict;
  if (code === "auth_required" || code === "invalid_token") return exitCodes.auth;
  if (code === "permission_denied") return exitCodes.permission;
  return exitCodes.generic;
}
