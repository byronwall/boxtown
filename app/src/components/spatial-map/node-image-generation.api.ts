import type { NodeImageGenerationRunSnapshot } from "~/lib/node-images/types";

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
