import { ProjectMutationError } from "~/lib/projects/mutation-error";
import type { AgentApiErrorBody } from "./types";

export class AgentApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    status = 400,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AgentApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function errorToResponse(error: unknown) {
  const apiError = error instanceof AgentApiError
    ? error
    : new AgentApiError("internal_error", "Unexpected API error.", 500);

  const body: AgentApiErrorBody = {
    error: {
      code: apiError.code,
      message: apiError.message,
      ...(apiError.details ? { details: apiError.details } : {}),
    },
  };

  return new Response(JSON.stringify(body), {
    status: apiError.status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

// Keeps the code, status, and details of a rejected project write. Other
// errors become `fallback` when given, or propagate unchanged.
export function rethrowAsAgentApiError(
  error: unknown,
  fallback?: { code: string; message: string },
): never {
  if (error instanceof AgentApiError) throw error;
  if (error instanceof ProjectMutationError) {
    throw new AgentApiError(error.code, error.message, error.status, error.details);
  }
  if (fallback) {
    throw new AgentApiError(fallback.code, error instanceof Error ? error.message : fallback.message, 400);
  }
  throw error;
}
