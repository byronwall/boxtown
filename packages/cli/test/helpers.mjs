import { main } from "../src/main.mjs";

// Runs the CLI against a fake server. `respond(call)` returns
// `{ status?, body }` for each request; calls are recorded in order.
export async function runCli(args, respond, options = {}) {
  const calls = [];
  const stdout = createWritableBuffer();
  const stderr = createWritableBuffer();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const call = {
      url: String(url),
      method: init.method ?? "GET",
      body: typeof init.body === "string" ? JSON.parse(init.body) : undefined,
    };
    calls.push(call);
    const result = respond(call) ?? { body: {} };
    return new Response(JSON.stringify(result.body), {
      status: result.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  };

  let error = null;
  try {
    await main(["node", "boxtown", ...args], {
      stdout,
      stderr,
      env: { BOXTOWN_SERVER: "http://localhost:3000", BOXTOWN_NO_UPDATE_CHECK: "1", ...options.env },
      cwd: options.cwd ?? "/tmp",
      stdin: options.stdin,
    });
  } catch (caught) {
    error = caught;
  } finally {
    globalThis.fetch = originalFetch;
  }
  return { calls, stdout: stdout.value, stderr: stderr.value, error };
}

export function createWritableBuffer() {
  return {
    value: "",
    write(chunk) {
      this.value += chunk;
    },
  };
}
