import { useAction } from "@solidjs/router";
import { createSignal } from "solid-js";
import { ArchiveIcon, ArchiveRestoreIcon } from "lucide-solid";
import { Button } from "~/components/ui/button";
import { Tooltip } from "~/components/ui/tooltip";
import { toaster } from "~/components/ui/toast";
import { updateProjectNodeArchived } from "~/lib/projects/data";
import {
  createClientMutationId,
  updateProjectNode,
  type ProjectUpdateOptions,
} from "~/lib/projects/optimistic";
import type { ProjectRecord } from "~/lib/projects/types";
import type { MapNode } from "~/lib/spatial-map/types";

interface SpatialMapArchiveNodeControlProps {
  project: ProjectRecord;
  node: MapNode;
  onProjectUpdated?: (project: ProjectRecord, options?: ProjectUpdateOptions) => void;
}

export function SpatialMapArchiveNodeControl(props: SpatialMapArchiveNodeControlProps) {
  const [pending, setPending] = createSignal(false);
  const submitArchive = useAction(updateProjectNodeArchived);
  const label = () => (props.node.archived ? "Unarchive node" : "Archive node");

  const toggleArchived = async () => {
    if (pending()) {
      return;
    }

    const nodeId = props.node.id;
    const nodeLabel = props.node.label;
    const archived = !props.node.archived;
    const previousProject = props.project;
    const clientMutationId = createClientMutationId();

    setPending(true);
    props.onProjectUpdated?.(
      updateProjectNode(props.project, nodeId, (node) => {
        const { archived: _archived, ...rest } = node;
        return archived ? { ...rest, archived: true } : rest;
      }),
      { clientMutationId, phase: "optimistic" },
    );

    try {
      const result = await submitArchive({
        projectId: props.project.id,
        nodeId,
        archived,
        clientMutationId,
      });
      props.onProjectUpdated?.(result, { clientMutationId, phase: "server" });
      toaster.success({
        title: archived ? "Node archived" : "Node restored",
        description: archived
          ? `${nodeLabel} and its children are hidden. Turn on "Show archived" in the filter menu to see them.`
          : `${nodeLabel} is visible again.`,
      });
    } catch (error) {
      props.onProjectUpdated?.(previousProject, { clientMutationId, phase: "server" });
      toaster.error({
        title: archived ? "Archive failed" : "Unarchive failed",
        description: error instanceof Error ? error.message : "The node could not be updated.",
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <Tooltip content={label()} openDelay={150} closeDelay={80}>
      <Button
        size="xs"
        variant="outline"
        px="0"
        loading={pending()}
        aria-label={label()}
        onClick={() => void toggleArchived()}
      >
        {props.node.archived ? <ArchiveRestoreIcon size={16} /> : <ArchiveIcon size={16} />}
      </Button>
    </Tooltip>
  );
}
