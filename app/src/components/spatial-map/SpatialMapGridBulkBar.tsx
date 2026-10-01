import { useAction } from "@solidjs/router";
import { ArchiveIcon, ArchiveRestoreIcon, XIcon } from "lucide-solid";
import { createSignal } from "solid-js";
import { Box, HStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { SimpleSelect } from "~/components/ui/simple-select";
import { Text } from "~/components/ui/text";
import { toaster } from "~/components/ui/toast";
import { applyBulkNodeUpdate, type BulkNodeUpdate } from "~/lib/projects/bulk-update";
import { updateProjectNodesBulk } from "~/lib/projects/data";
import { createClientMutationId, type ProjectUpdateOptions } from "~/lib/projects/optimistic";
import type { ProjectRecord } from "~/lib/projects/types";
import { getMapNodeStatusLabel } from "~/lib/spatial-map/node-status";
import { mapNodeStatuses, type MapNodeStatus } from "~/lib/spatial-map/types";

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
    <HStack
      gap="2"
      flexWrap="nowrap"
      h="40px"
      overflowX="auto"
      p="6px 10px"
      borderBottom="1px solid rgba(96, 101, 95, 0.26)"
      background="rgba(229, 239, 229, 0.6)"
      role="toolbar"
      aria-label="Bulk actions for selected nodes"
    >
      <Text as="span" flexShrink="0" whiteSpace="nowrap" fontSize="12px" fontWeight="760" color="var(--spatial-map-copy)">
        {count()} selected
      </Text>
      <Box flex="0 0 170px">
        <SimpleSelect
          size="xs"
          minW="150px"
          placeholder="Set status..."
          value=""
          items={mapNodeStatuses.map((status) => ({
            value: status,
            label: getMapNodeStatusLabel(status),
          }))}
          onChange={(value) =>
            void applyUpdate({ status: value as MapNodeStatus }, "Status updated")
          }
        />
      </Box>
      <Button size="xs" variant="outline" loading={pending()} onClick={() => void applyUpdate({ archived: true }, "Nodes archived")}>
        <ArchiveIcon size={14} />
        Archive
      </Button>
      <Button size="xs" variant="outline" loading={pending()} onClick={() => void applyUpdate({ archived: false }, "Nodes restored")}>
        <ArchiveRestoreIcon size={14} />
        Unarchive
      </Button>
      <Button size="xs" variant="plain" onClick={() => props.onClear()}>
        <XIcon size={14} />
        Clear
      </Button>
    </HStack>
  );
}
