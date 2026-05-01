import { afterEach, describe, expect, it, vi } from "vitest";
import { authenticateAgentRequest } from "./auth.server";

function createEvent(authorization: string | null) {
  return {
    request: new Request("http://localhost/api/v1/projects", {
      headers: authorization ? { authorization } : {},
    }),
  } as never;
}

describe("authenticateAgentRequest", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows local development when no tokens are configured", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AGENT_API_TOKENS", "");

    const actor = authenticateAgentRequest(createEvent(null), ["project:read"]);

    expect(actor.id).toBe("local-dev");
    expect(actor.scopes).toContain("project:read");
  });

  it("accepts a configured token with colon-delimited scope names", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AGENT_API_TOKENS", "local-token:project:read|node:read|task:read");

    const actor = authenticateAgentRequest(createEvent("Bearer local-token"), [
      "project:read",
      "node:read",
    ]);

    expect(actor.id).toBe("token:-token");
    expect(actor.scopes).toEqual(["project:read", "node:read", "task:read"]);
  });

  it("rejects missing scopes", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AGENT_API_TOKENS", "local-token:project:read");

    expect(() => authenticateAgentRequest(createEvent("Bearer local-token"), ["node:read"]))
      .toThrow("The bearer token lacks required scopes.");
  });
});
