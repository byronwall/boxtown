import { useAction } from "@solidjs/router";
import { ArchiveIcon } from "lucide-solid";
import { createMemo, createSignal, Show } from "solid-js";
import { Button } from "~/components/ui/button";
import { toaster } from "~/components/ui/toast";
import { applyBulkNodeUpdate } from "~/lib/projects/bulk-update";
import { updateProjectNodesBulk } from "~/lib/projects/data";
import { createClientMutationId, type ProjectUpdateOptions } from "~/lib/projects/optimistic";
import type { ProjectRecord } from "~/lib/projects/types";

export function SpatialMapArchiveImplementedButton(props: {
  project: ProjectRecord;
  onProjectUpdated?: (project: ProjectRecord, options?: ProjectUpdateOptions) => void;
}) {
  const [pending, setPending] = createSignal(false);
  const [pendingCount, setPendingCount] = createSignal(0);
  const submitBulk = useAction(updateProjectNodesBulk);
  const nodeIds = createMemo(() =>
    props.project.spatialMap.nodes
      .filter((node) => node.status === "implemented" && !node.archived)
      .map((node) => node.id),
  );
  const count = () => pending() ? pendingCount() : nodeIds().length;

  const archiveImplemented = async () => {
    if (pending() || nodeIds().length === 0) return;

    const targetIds = [...nodeIds()];
    const previousProject = props.project;
    const clientMutationId = createClientMutationId();
    setPendingCount(targetIds.length);
    setPending(true);
    props.onProjectUpdated?.({
      ...props.project,
      updatedAt: new Date().toISOString(),
      spatialMap: applyBulkNodeUpdate(props.project.spatialMap, {
        nodeIds: targetIds,
        archived: true,
      }),
    }, { clientMutationId, phase: "optimistic" });

    try {
      const result = await submitBulk({
        projectId: props.project.id,
        nodeIds: targetIds,
        archived: true,
        clientMutationId,
      });
      props.onProjectUpdated?.(result, { clientMutationId, phase: "server" });
      toaster.success({
        title: "Implemented nodes archived",
        description: `Archived ${targetIds.length} implemented node${targetIds.length === 1 ? "" : "s"} in this project.`,
      });
    } catch (error) {
      props.onProjectUpdated?.(previousProject, { clientMutationId, phase: "server" });
      toaster.error({
        title: "Archive failed",
        description: error instanceof Error ? error.message : "Implemented nodes could not be archived.",
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <Show when={count() > 0}>
      <Button
        size="xs"
        variant="outline"
        loading={pending()}
        loadingText={`Archiving ${count()}…`}
        title={`Archive all ${count()} unarchived implemented nodes in this project`}
        aria-label={`Archive all ${count()} unarchived implemented nodes in this project`}
        onClick={() => void archiveImplemented()}
      >
        <ArchiveIcon size={14} />
        Archive implemented in project ({count()})
      </Button>
    </Show>
  );
}
