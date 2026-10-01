import { useAction } from "@solidjs/router";
import { ArchiveIcon, ArchiveRestoreIcon, ChevronDownIcon, XIcon } from "lucide-solid";
import { createSignal, For } from "solid-js";
import { HStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import * as Menu from "~/components/ui/menu";
import { Text } from "~/components/ui/text";
import { toaster } from "~/components/ui/toast";
import { applyBulkNodeUpdate, type BulkNodeUpdate } from "~/lib/projects/bulk-update";
import { updateProjectNodesBulk } from "~/lib/projects/data";
import { createClientMutationId, type ProjectUpdateOptions } from "~/lib/projects/optimistic";
import type { ProjectRecord } from "~/lib/projects/types";
import { getMapNodeStatusLabel } from "~/lib/spatial-map/node-status";
import { mapNodeStatuses } from "~/lib/spatial-map/types";

export function SpatialMapGridBulkBar(props: {
  project: ProjectRecord;
  nodeIds: string[];
  onClear: () => void;
  onProjectUpdated?: (project: ProjectRecord, options?: ProjectUpdateOptions) => void;
}) {
  const [pending, setPending] = createSignal(false);
  const submitBulk = useAction(updateProjectNodesBulk);
  const count = () => props.nodeIds.length;

  const applyUpdate = async (change: Omit<BulkNodeUpdate, "nodeIds">, successTitle: string) => {
    if (pending() || count() === 0) {
      return;
    }

    const nodeIds = [...props.nodeIds];
    const previousProject = props.project;
    const clientMutationId = createClientMutationId();
    setPending(true);
    props.onProjectUpdated?.(
      {
        ...props.project,
        updatedAt: new Date().toISOString(),
        spatialMap: applyBulkNodeUpdate(props.project.spatialMap, { nodeIds, ...change }),
      },
      { clientMutationId, phase: "optimistic" },
    );

    try {
      const result = await submitBulk({ projectId: props.project.id, nodeIds, ...change, clientMutationId });
      props.onProjectUpdated?.(result, { clientMutationId, phase: "server" });
      toaster.success({
        title: successTitle,
        description: `${nodeIds.length} node${nodeIds.length === 1 ? "" : "s"} updated.`,
      });
      if (change.archived !== undefined) {
        props.onClear();
      }
    } catch (error) {
      props.onProjectUpdated?.(previousProject, { clientMutationId, phase: "server" });
      toaster.error({
        title: "Bulk update failed",
        description: error instanceof Error ? error.message : "The selected nodes could not be updated.",
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <HStack gap="1" flexShrink="0" role="toolbar" aria-label="Bulk actions for selected nodes">
      <Text
        as="span"
        mr="1"
        whiteSpace="nowrap"
        fontSize="12px"
        fontWeight="700"
        fontVariantNumeric="tabular-nums"
        color="var(--spatial-map-copy)"
      >
        {count()} selected
      </Text>
      <Menu.Root positioning={{ placement: "bottom-start", gutter: 4 }} size="sm">
        <Menu.Trigger
          asChild={(triggerProps) => (
            <Button {...triggerProps()} variant="outline" size="2xs" disabled={pending()}>
              Set status
              <ChevronDownIcon size={13} aria-hidden="true" />
            </Button>
          )}
        />
        <Menu.Positioner>
          <Menu.Content minW="170px" borderRadius="0" fontFamily="inherit" textTransform="none">
            <For each={mapNodeStatuses}>
              {(status) => (
                <Menu.Item
                  value={status}
                  onClick={() => void applyUpdate({ status }, "Status updated")}
                >
                  <Menu.ItemText>{getMapNodeStatusLabel(status)}</Menu.ItemText>
                </Menu.Item>
              )}
            </For>
          </Menu.Content>
        </Menu.Positioner>
      </Menu.Root>
      <Button size="2xs" variant="outline" loading={pending()} onClick={() => void applyUpdate({ archived: true }, "Nodes archived")}>
        <ArchiveIcon size={13} aria-hidden="true" />
        Archive
      </Button>
      <Button size="2xs" variant="outline" loading={pending()} onClick={() => void applyUpdate({ archived: false }, "Nodes restored")}>
        <ArchiveRestoreIcon size={13} aria-hidden="true" />
        Unarchive
      </Button>
      <Button size="2xs" variant="plain" onClick={() => props.onClear()}>
        <XIcon size={13} aria-hidden="true" />
        Clear
      </Button>
    </HStack>
  );
}
