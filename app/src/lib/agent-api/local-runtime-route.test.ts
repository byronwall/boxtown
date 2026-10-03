import type { APIEvent } from "@solidjs/start/server";
import { afterEach, describe, expect, it } from "vitest";
import { GET } from "~/routes/api/local-runtime";

const originalEnv = {
  id: process.env.PGM_LOCAL_RUNTIME_ID,
  dataDir: process.env.APP_DATA_DIR,
  tokens: process.env.AGENT_API_TOKENS,
  nodeEnv: process.env.NODE_ENV,
};

afterEach(() => {
  setEnv("PGM_LOCAL_RUNTIME_ID", originalEnv.id);
  setEnv("APP_DATA_DIR", originalEnv.dataDir);
  setEnv("AGENT_API_TOKENS", originalEnv.tokens);
  setEnv("NODE_ENV", originalEnv.nodeEnv);
});

describe("local runtime identity route", () => {
  it("is unavailable when the app is not a local viewer", async () => {
    delete process.env.PGM_LOCAL_RUNTIME_ID;
    delete process.env.APP_DATA_DIR;

    const response = await GET(apiEvent());

    expect(response.status).toBe(404);
  });

  it("requires the local project read token", async () => {
    process.env.PGM_LOCAL_RUNTIME_ID = "runtime-123";
    process.env.APP_DATA_DIR = "/tmp/pgm-local-runtime-test";
    process.env.NODE_ENV = "production";
    process.env.AGENT_API_TOKENS = "local-token:project:read";

    expect((await GET(apiEvent())).status).toBe(401);
    const response = await GET(apiEvent("local-token"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ id: "runtime-123", dataDir: "/tmp/pgm-local-runtime-test" });
  });
});

function apiEvent(token?: string) {
  return {
    request: new Request("http://localhost/api/local-runtime", {
      headers: token ? { authorization: `Bearer ${token}` } : undefined,
    }),
  } as APIEvent;
}

function setEnv(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}
