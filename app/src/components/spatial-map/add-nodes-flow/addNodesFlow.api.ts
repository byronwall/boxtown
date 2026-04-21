import type {
  AddNodesRunAnswerRequest,
  AddNodesRunSnapshot,
  AddNodesRunStartRequest,
  AddNodesRunStartResponse,
} from "~/lib/add-nodes/types";

async function parseJsonResponse<T>(response: Response, fallbackMessage: string) {
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? fallbackMessage);
  }

  return response.json() as Promise<T>;
}

export async function startAddNodesRunRequest(projectId: string, body: AddNodesRunStartRequest) {
  return parseJsonResponse<AddNodesRunStartResponse>(
    await fetch(`/api/projects/${encodeURIComponent(projectId)}/add-nodes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    "Failed to start the add-nodes flow.",
  );
}

export async function submitAddNodesAnswersRequest(
  projectId: string,
  runId: string,
  body: AddNodesRunAnswerRequest,
) {
  return parseJsonResponse<AddNodesRunSnapshot>(
    await fetch(`/api/projects/${encodeURIComponent(projectId)}/add-nodes/${encodeURIComponent(runId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    "Failed to submit add-nodes answers.",
  );
}

export async function loadAddNodesRunRequest(projectId: string, runId: string) {
  return parseJsonResponse<AddNodesRunSnapshot>(
    await fetch(`/api/projects/${encodeURIComponent(projectId)}/add-nodes/${encodeURIComponent(runId)}`, {
      cache: "no-store",
    }),
    "Failed to load add-nodes progress.",
  );
}

export function subscribeAddNodesRun(projectId: string, runId: string, handlers: {
  onSnapshot: (snapshot: AddNodesRunSnapshot) => void;
  onError?: () => void;
}) {
  const source = new EventSource(
    `/api/projects/${encodeURIComponent(projectId)}/add-nodes/${encodeURIComponent(runId)}/events`,
  );

  for (const eventName of ["snapshot", "complete", "failed"] as const) {
    source.addEventListener(eventName, (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as { snapshot: AddNodesRunSnapshot };
      handlers.onSnapshot(payload.snapshot);
    });
  }

  source.onerror = () => handlers.onError?.();
  return () => source.close();
}
