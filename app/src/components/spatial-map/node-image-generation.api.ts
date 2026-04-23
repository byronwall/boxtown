import type {
  NodeImageGenerationRunSnapshot,
  NodeImageGenerationStartRequest,
  NodeImageGenerationStartResponse,
} from "~/lib/node-images/types";

async function parseJsonResponse<T>(response: Response, fallbackMessage: string) {
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? fallbackMessage);
  }

  return response.json() as Promise<T>;
}

export async function startNodeImageGenerationRequest(
  projectId: string,
  body: NodeImageGenerationStartRequest,
) {
  return parseJsonResponse<NodeImageGenerationStartResponse>(
    await fetch(`/api/projects/${encodeURIComponent(projectId)}/node-images`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    "Failed to start node image generation.",
  );
}

export async function loadNodeImageGenerationRunRequest(projectId: string, runId: string) {
  return parseJsonResponse<NodeImageGenerationRunSnapshot>(
    await fetch(
      `/api/projects/${encodeURIComponent(projectId)}/node-images/${encodeURIComponent(runId)}`,
      { cache: "no-store" },
    ),
    "Failed to load node image generation progress.",
  );
}

export function subscribeNodeImageGenerationRun(
  projectId: string,
  runId: string,
  handlers: {
    onSnapshot: (snapshot: NodeImageGenerationRunSnapshot) => void;
    onError?: () => void;
  },
) {
  const source = new EventSource(
    `/api/projects/${encodeURIComponent(projectId)}/node-images/${encodeURIComponent(runId)}/events`,
  );

  for (const eventName of ["snapshot", "complete", "failed"] as const) {
    source.addEventListener(eventName, (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as {
        snapshot: NodeImageGenerationRunSnapshot;
      };
      handlers.onSnapshot(payload.snapshot);
    });
  }

  source.onerror = () => handlers.onError?.();
  return () => source.close();
}
