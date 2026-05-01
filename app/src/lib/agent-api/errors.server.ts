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
