import type {
  SourceDecompositionRunAcceptRequest,
  SourceDecompositionRunSnapshot,
  SourceDecompositionRunStartResponse,
} from "~/lib/source-decomposition/types";

async function parseJsonResponse<T>(response: Response, fallbackMessage: string) {
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? fallbackMessage);
  }

  return response.json() as Promise<T>;
}

export async function startSourceDecompositionRunRequest(
  projectId: string,
  formData: FormData,
) {
  return parseJsonResponse<SourceDecompositionRunStartResponse>(
    await fetch(`/api/projects/${encodeURIComponent(projectId)}/source-decompositions`, {
      method: "POST",
      body: formData,
    }),
    "Failed to start source decomposition.",
  );
}

export async function acceptSourceDecompositionRequest(
  projectId: string,
  runId: string,
  body: SourceDecompositionRunAcceptRequest,
) {
  return parseJsonResponse<SourceDecompositionRunSnapshot>(
    await fetch(`/api/projects/${encodeURIComponent(projectId)}/source-decompositions/${encodeURIComponent(runId)}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    "Failed to accept source decomposition suggestions.",
  );
}

export async function loadSourceDecompositionRunRequest(projectId: string, runId: string) {
  return parseJsonResponse<SourceDecompositionRunSnapshot>(
    await fetch(`/api/projects/${encodeURIComponent(projectId)}/source-decompositions/${encodeURIComponent(runId)}`, {
      cache: "no-store",
    }),
    "Failed to load source decomposition progress.",
  );
}

export function subscribeSourceDecompositionRun(
  projectId: string,
  runId: string,
  handlers: {
    onSnapshot: (snapshot: SourceDecompositionRunSnapshot) => void;
    onError?: () => void;
  },
) {
  const source = new EventSource(
    `/api/projects/${encodeURIComponent(projectId)}/source-decompositions/${encodeURIComponent(runId)}/events`,
  );

  for (const eventName of ["snapshot", "complete", "failed"] as const) {
    source.addEventListener(eventName, (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as { snapshot: SourceDecompositionRunSnapshot };
      handlers.onSnapshot(payload.snapshot);
    });
  }

  source.onerror = () => handlers.onError?.();
  return () => source.close();
}
