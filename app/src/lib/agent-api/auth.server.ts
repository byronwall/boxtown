import type { APIEvent } from "@solidjs/start/server";
import { AgentApiError } from "./errors.server";
import type { AgentActor } from "./types";

const allDevScopes = [
  "project:read",
  "project:write",
  "node:read",
  "image:read",
  "node:write",
  "image:write",
  "run:read",
  "run:start",
];

export function authenticateAgentRequest(
  event: APIEvent,
  requiredScopes: string[],
): AgentActor {
  const configuredTokens = parseConfiguredTokens(process.env.AGENT_API_TOKENS);
  const authorization = event.request.headers.get("authorization");
  const token = parseBearerToken(authorization);

  if (configuredTokens.length === 0 && process.env.NODE_ENV !== "production") {
    return {
      id: "local-dev",
      scopes: allDevScopes,
      tokenSuffix: null,
    };
  }

  if (!token) {
    throw new AgentApiError("auth_required", "A bearer token is required.", 401);
  }

  const matched = configuredTokens.find((item) => item.token === token);
  if (!matched) {
    throw new AgentApiError("invalid_token", "The bearer token is invalid.", 401);
  }

  const missingScopes = requiredScopes.filter((scope) => !matched.scopes.includes(scope));
  if (missingScopes.length > 0) {
    throw new AgentApiError("permission_denied", "The bearer token lacks required scopes.", 403, {
      missingScopes,
    });
  }

  return {
    id: `token:${token.slice(-6)}`,
    scopes: matched.scopes,
    tokenSuffix: token.slice(-6),
  };
}

function parseBearerToken(value: string | null) {
  if (!value) {
    return null;
  }

  const match = /^Bearer\s+(.+)$/i.exec(value.trim());
  return match?.[1]?.trim() || null;
}

function parseConfiguredTokens(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const separatorIndex = item.indexOf(":");
      const token = separatorIndex === -1 ? item : item.slice(0, separatorIndex);
      const scopesValue = separatorIndex === -1 ? "" : item.slice(separatorIndex + 1);
      return {
        token: token.trim(),
        scopes: scopesValue.split("|").map((scope) => scope.trim()).filter(Boolean),
      };
    })
    .filter((item) => item.token.length > 0);
}
