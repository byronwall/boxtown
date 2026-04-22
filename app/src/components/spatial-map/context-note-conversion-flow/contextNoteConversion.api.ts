import type {
  ContextNoteConversionRunAcceptRequest,
  ContextNoteConversionRunAnswerRequest,
  ContextNoteConversionRunSnapshot,
  ContextNoteConversionRunStartRequest,
  ContextNoteConversionRunStartResponse,
} from "~/lib/context-note-conversion/types";

async function parseJsonResponse<T>(response: Response, fallbackMessage: string) {
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? fallbackMessage);
  }

  return response.json() as Promise<T>;
}

export async function startContextNoteConversionRunRequest(
  projectId: string,
  body: ContextNoteConversionRunStartRequest,
) {
  return parseJsonResponse<ContextNoteConversionRunStartResponse>(
    await fetch(`/api/projects/${encodeURIComponent(projectId)}/context-note-conversions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    "Failed to start note conversion.",
  );
}

export async function submitContextNoteConversionAnswersRequest(
  projectId: string,
  runId: string,
  body: ContextNoteConversionRunAnswerRequest,
) {
  return parseJsonResponse<ContextNoteConversionRunSnapshot>(
    await fetch(`/api/projects/${encodeURIComponent(projectId)}/context-note-conversions/${encodeURIComponent(runId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    "Failed to submit note conversion answers.",
  );
}

export async function acceptContextNoteConversionRequest(
  projectId: string,
  runId: string,
  body: ContextNoteConversionRunAcceptRequest,
) {
  return parseJsonResponse<ContextNoteConversionRunSnapshot>(
    await fetch(`/api/projects/${encodeURIComponent(projectId)}/context-note-conversions/${encodeURIComponent(runId)}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    "Failed to accept note conversion suggestions.",
  );
}

export async function loadContextNoteConversionRunRequest(projectId: string, runId: string) {
  return parseJsonResponse<ContextNoteConversionRunSnapshot>(
    await fetch(`/api/projects/${encodeURIComponent(projectId)}/context-note-conversions/${encodeURIComponent(runId)}`, {
      cache: "no-store",
    }),
    "Failed to load note conversion progress.",
  );
}

export function subscribeContextNoteConversionRun(
  projectId: string,
  runId: string,
  handlers: {
    onSnapshot: (snapshot: ContextNoteConversionRunSnapshot) => void;
    onError?: () => void;
  },
) {
  const source = new EventSource(
    `/api/projects/${encodeURIComponent(projectId)}/context-note-conversions/${encodeURIComponent(runId)}/events`,
  );

  for (const eventName of ["snapshot", "complete", "failed"] as const) {
    source.addEventListener(eventName, (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as { snapshot: ContextNoteConversionRunSnapshot };
      handlers.onSnapshot(payload.snapshot);
    });
  }

  source.onerror = () => handlers.onError?.();
  return () => source.close();
}
