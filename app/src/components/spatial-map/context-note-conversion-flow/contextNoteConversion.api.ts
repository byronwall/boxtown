import type { ContextNoteConversionRunSnapshot } from "~/lib/context-note-conversion/types";

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
