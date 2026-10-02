import { useAction } from "@solidjs/router";
import { ArchiveIcon } from "lucide-solid";
import { createMemo, createSignal, Show } from "solid-js";
import { Box } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { toaster } from "~/components/ui/toast";
import { Tooltip } from "~/components/ui/tooltip";
import { applyBulkNodeUpdate } from "~/lib/projects/bulk-update";
import { updateProjectNodesBulk } from "~/lib/projects/data";
import { createClientMutationId, type ProjectUpdateOptions } from "~/lib/projects/optimistic";
import type { ProjectRecord } from "~/lib/projects/types";

export function SpatialMapArchiveImplementedButton(props: {
  project: ProjectRecord;
  // Compact renders an icon + count for tight chrome such as the inspector header.
  compact?: boolean;
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
      props.onProjectUpdated?.(previousProject, { clientMutationId, phase: "failed" });
      toaster.error({
        title: "Archive failed",
        description: error instanceof Error ? error.message : "Implemented nodes could not be archived.",
      });
    } finally {
      setPending(false);
    }
  };

  const description = () =>
    `Archive all ${count()} implemented node${count() === 1 ? "" : "s"} in this project`;

  return (
    <Show when={count() > 0}>
      <Tooltip content={description()} openDelay={150} closeDelay={80}>
        <Button
          size="2xs"
          variant={props.compact ? "plain" : "outline"}
          flexShrink="0"
          h={props.compact ? "24px" : undefined}
          px={props.compact ? "6px" : undefined}
          gap={props.compact ? "4px" : undefined}
          color={props.compact ? "var(--spatial-map-copy-dim)" : undefined}
          loading={pending()}
          loadingText={props.compact ? undefined : `Archiving ${count()}…`}
          aria-label={description()}
          onClick={() => void archiveImplemented()}
        >
          <ArchiveIcon size={13} aria-hidden="true" />
          <Show when={!props.compact}>Archive implemented</Show>
          <Box as="span" color="var(--spatial-map-copy-dim)" fontVariantNumeric="tabular-nums">
            {count()}
          </Box>
        </Button>
      </Tooltip>
    </Show>
  );
}
