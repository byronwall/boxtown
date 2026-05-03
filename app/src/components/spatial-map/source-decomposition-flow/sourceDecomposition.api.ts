import type { SourceDecompositionRunSnapshot } from "~/lib/source-decomposition/types";

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
