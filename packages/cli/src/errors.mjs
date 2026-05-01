export class CliError extends Error {
  constructor(message, exitCode = 1) {
    super(message);
    this.name = "CliError";
    this.exitCode = exitCode;
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
