import type { AddNodesRunSnapshot } from "~/lib/add-nodes/types";

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
