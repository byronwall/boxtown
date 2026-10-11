import { useAction } from "@solidjs/router";
import { Trash2 } from "lucide-solid";
import { createMemo, createSignal, Show } from "solid-js";
import { Box, HStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { SimpleDialog } from "~/components/ui/simple-dialog";
import { Text } from "~/components/ui/text";
import { toaster } from "~/components/ui/toast";
import { Tooltip } from "~/components/ui/tooltip";
import { deleteArchivedProjectNodes } from "~/lib/projects/data";
import { createClientMutationId, type ProjectUpdateOptions } from "~/lib/projects/optimistic";
import type { ProjectRecord } from "~/lib/projects/types";
import { getArchivedSubtreeNodeIds, hideArchivedNodes } from "~/lib/spatial-map/archive";

export function SpatialMapDeleteArchivedButton(props: {
  project: ProjectRecord;
  // Compact renders an icon + count for tight chrome such as the inspector header.
  compact?: boolean;
  onProjectUpdated?: (project: ProjectRecord, options?: ProjectUpdateOptions) => void;
}) {
  const [open, setOpen] = createSignal(false);
  const [pending, setPending] = createSignal(false);
  const [pendingCount, setPendingCount] = createSignal(0);
  let confirmButtonRef: HTMLButtonElement | undefined;
  const submitDelete = useAction(deleteArchivedProjectNodes);
  // Archiving a node hides its subtree, so the hidden descendants go with it.
  const archivedIds = createMemo(() => getArchivedSubtreeNodeIds(props.project.spatialMap));
  const count = () => pending() ? pendingCount() : archivedIds().size;
  const nodeLabel = (value: number) => `${value} archived node${value === 1 ? "" : "s"}`;

  const deleteArchived = async () => {
    if (pending() || archivedIds().size === 0) return;

    const targetCount = archivedIds().size;
    const previousProject = props.project;
    const clientMutationId = createClientMutationId();
    setPendingCount(targetCount);
    setPending(true);
    setOpen(false);
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
        description: `Deleted ${nodeLabel(targetCount)} and their images.`,
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

  const description = () => `Delete all ${nodeLabel(count())} in this project`;

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
          loadingText={props.compact ? undefined : `Deleting ${count()}…`}
          aria-label={description()}
          onClick={() => setOpen(true)}
        >
          <Trash2 size={13} aria-hidden="true" />
          <Show when={!props.compact}>Delete archived</Show>
          <Box as="span" color="var(--spatial-map-copy-dim)" fontVariantNumeric="tabular-nums">
            {count()}
          </Box>
        </Button>
      </Tooltip>

      <SimpleDialog
        open={open()}
        onOpenChange={setOpen}
        title="Delete archived nodes"
        description={`Delete ${nodeLabel(count())}?`}
        maxW="520px"
        initialFocusEl={() => confirmButtonRef ?? null}
        footer={
          <HStack justifyContent="flex-end" flexWrap="wrap">
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              ref={confirmButtonRef}
              type="button"
              variant="danger"
              loading={pending()}
              onClick={() => void deleteArchived()}
            >
              Delete {nodeLabel(count())}
            </Button>
          </HStack>
        }
      >
        <Text fontSize="12px" lineHeight="1.45" color="var(--spatial-map-copy-dim)">
          This permanently removes every archived node, the children hidden under them, their
          links, and their images. It cannot be undone.
        </Text>
      </SimpleDialog>
    </Show>
  );
}
