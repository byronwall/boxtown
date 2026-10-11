import { useAction } from "@solidjs/router";
import { createMemo, createSignal } from "solid-js";
import { toaster } from "~/components/ui/toast";
import { applyBulkNodeUpdate } from "~/lib/projects/bulk-update";
import { deleteArchivedProjectNodes, updateProjectNodesBulk } from "~/lib/projects/data";
import { createClientMutationId, type ProjectUpdateOptions } from "~/lib/projects/optimistic";
import type { ProjectRecord } from "~/lib/projects/types";
import { getArchivedSubtreeNodeIds, hideArchivedNodes } from "~/lib/spatial-map/archive";

interface ProjectActionProps {
  project: ProjectRecord;
  onProjectUpdated?: (project: ProjectRecord, options?: ProjectUpdateOptions) => void;
}

export const archivedNodeLabel = (value: number) => `${value} archived node${value === 1 ? "" : "s"}`;

export function createArchiveImplementedAction(props: ProjectActionProps) {
  const [pending, setPending] = createSignal(false);
  const [pendingCount, setPendingCount] = createSignal(0);
  const submitBulk = useAction(updateProjectNodesBulk);
  const nodeIds = createMemo(() =>
    props.project.spatialMap.nodes
      .filter((node) => node.status === "implemented" && !node.archived)
      .map((node) => node.id),
  );
  const count = () => pending() ? pendingCount() : nodeIds().length;

  const run = async () => {
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
      props.onProjectUpdated?.(previousProject, { clientMutationId, phase: "failed" });
      toaster.error({
        title: "Archive failed",
        description: error instanceof Error ? error.message : "Implemented nodes could not be archived.",
      });
    } finally {
      setPending(false);
    }
  };

  return { count, pending, run };
}

export function createDeleteArchivedAction(props: ProjectActionProps) {
  const [pending, setPending] = createSignal(false);
  const [pendingCount, setPendingCount] = createSignal(0);
  const submitDelete = useAction(deleteArchivedProjectNodes);
  // Archiving a node hides its subtree, so the hidden descendants go with it.
  const archivedIds = createMemo(() => getArchivedSubtreeNodeIds(props.project.spatialMap));
  const count = () => pending() ? pendingCount() : archivedIds().size;

  const run = async () => {
    if (pending() || archivedIds().size === 0) return;

    const targetCount = archivedIds().size;
    const previousProject = props.project;
    const clientMutationId = createClientMutationId();
    setPendingCount(targetCount);
    setPending(true);
    props.onProjectUpdated?.({
      ...props.project,
      updatedAt: new Date().toISOString(),
      spatialMap: hideArchivedNodes(props.project.spatialMap),
    }, { clientMutationId, phase: "optimistic" });

    try {
      const result = await submitDelete({ projectId: props.project.id, clientMutationId });
      props.onProjectUpdated?.(result, { clientMutationId, phase: "server" });
      toaster.success({
        title: "Archived nodes deleted",
        description: `Deleted ${archivedNodeLabel(targetCount)} and their images.`,
      });
    } catch (error) {
      props.onProjectUpdated?.(previousProject, { clientMutationId, phase: "failed" });
      toaster.error({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Archived nodes could not be deleted.",
      });
    } finally {
      setPending(false);
    }
  };

  return { count, pending, run };
}
