import { useAction } from "@solidjs/router";
import { createEffect, createSignal, untrack } from "solid-js";
import { HStack, VStack } from "styled-system/jsx";
import { Trash2 } from "lucide-solid";
import { Button } from "~/components/ui/button";
import { SimpleDialog } from "~/components/ui/simple-dialog";
import { Text } from "~/components/ui/text";
import { Tooltip } from "~/components/ui/tooltip";
import { toaster } from "~/components/ui/toast";
import { deleteProjectNode } from "~/lib/projects/data";
import { appendClientMutationId, createClientMutationId } from "~/lib/projects/optimistic";
import type { ProjectRecord } from "~/lib/projects/types";
import type { MapNode } from "~/lib/spatial-map/types";
import { useSpatialMap } from "./SpatialMapContext";

type DeleteScope = "node" | "node-and-children";

interface SpatialMapDeleteNodeControlProps {
  project: ProjectRecord;
  node: MapNode;
  onProjectUpdated?: (project: ProjectRecord, options?: import("~/lib/projects/optimistic").ProjectUpdateOptions) => void;
  compact?: boolean;
  hideTrigger?: boolean;
}

export function SpatialMapDeleteNodeControl(props: SpatialMapDeleteNodeControlProps) {
  const spatialMap = useSpatialMap();
  const [open, setOpen] = createSignal(false);
  const [pending, setPending] = createSignal(false);
  let deleteButtonRef: HTMLButtonElement | undefined;
  const submitDeleteNode = useAction(deleteProjectNode);

  const descendantIds = () => getDescendantNodeIds(props.project.spatialMap, props.node.id);
  const descendantCount = () => descendantIds().size;
  const childrenButtonLabel = () => `Delete node and children (${descendantCount()})`;

  const deleteNode = async (scope: DeleteScope = "node") => {
    if (pending()) {
      return;
    }

    const formData = new FormData();
    const nodeId = props.node.id;
    const nodeLabel = props.node.label;
    const includeChildren = scope === "node-and-children";
    const nodeIdsToDelete = new Set([
      nodeId,
      ...(includeChildren ? descendantIds() : []),
    ]);
    formData.set("projectId", props.project.id);
    formData.set("nodeId", nodeId);
    if (includeChildren) {
      formData.set("includeChildren", "true");
    }
    const clientMutationId = createClientMutationId();
    const previousProject = props.project;
    const optimisticProject = {
      ...props.project,
      updatedAt: new Date().toISOString(),
      spatialMap: {
        nodes: props.project.spatialMap.nodes.filter((node) => !nodeIdsToDelete.has(node.id)),
        links: props.project.spatialMap.links.filter(
          (link) => !nodeIdsToDelete.has(link.source) && !nodeIdsToDelete.has(link.target),
        ),
      },
    };

    setPending(true);
    setOpen(false);
    if (spatialMap.deleteNodeConfirmId() === nodeId) {
      spatialMap.clearDeleteNodeConfirm();
    }
    spatialMap.clearUnsafeDeleteNodeRequest();
    props.onProjectUpdated?.(optimisticProject, { clientMutationId, phase: "optimistic" });

    let result: ProjectRecord;
    try {
      result = await submitDeleteNode(appendClientMutationId(formData, clientMutationId));
    } catch (error) {
      props.onProjectUpdated?.(previousProject, { clientMutationId, phase: "server" });
      toaster.error({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "The node could not be deleted.",
      });
      setPending(false);
      return;
    }

    props.onProjectUpdated?.(result, { clientMutationId, phase: "server" });
    toaster.success({
      title: "Node deleted",
      description: `${nodeLabel} was removed from the project map.`,
    });
    setPending(false);
  };

  createEffect(() => {
    if (props.hideTrigger && spatialMap.deleteNodeConfirmId() === props.node.id) {
      setOpen(true);
    }
  });

  createEffect(() => {
    const request = spatialMap.unsafeDeleteNodeRequest();
    if (!props.hideTrigger || request?.nodeId !== props.node.id) {
      return;
    }

    if (untrack(pending)) {
      return;
    }

    spatialMap.clearUnsafeDeleteNodeRequest();
    void deleteNode();
  });

  const setDialogOpen = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen && spatialMap.deleteNodeConfirmId() === props.node.id) {
      spatialMap.clearDeleteNodeConfirm();
    }
  };

  return (
    <>
      {!props.hideTrigger && (
        <Tooltip content="Delete node" disabled={!props.compact} openDelay={150} closeDelay={80}>
          <Button
            size="xs"
            variant="danger"
            px={props.compact ? "0" : undefined}
            onClick={() => setDialogOpen(true)}
            aria-label={props.compact ? "Delete node" : undefined}
          >
            {props.compact ? <Trash2 size={16} /> : "Delete Node"}
          </Button>
        </Tooltip>
      )}

      <SimpleDialog
        open={open()}
        onOpenChange={setDialogOpen}
        title="Delete Node"
        description={`Delete ${props.node.label}? Choose whether to remove only this node or include its descendants.`}
        maxW="520px"
        initialFocusEl={() => deleteButtonRef ?? null}
        footer={
          <HStack justifyContent="flex-end" flexWrap="wrap">
            <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              ref={deleteButtonRef}
              type="button"
              loading={pending()}
              variant="danger"
              onClick={() => {
                void deleteNode("node");
              }}
            >
              Delete node
            </Button>
            <Button
              type="button"
              loading={pending()}
              disabled={descendantCount() === 0}
              variant="danger"
              onClick={() => {
                void deleteNode("node-and-children");
              }}
            >
              {childrenButtonLabel()}
            </Button>
          </HStack>
        }
      >
        <VStack alignItems="stretch" gap="4">
          <Text textStyle="sm" color="fg.muted">
            Delete node removes this node and its attached links. Delete node and children also removes every descendant connected by parent-child links.
          </Text>
        </VStack>
      </SimpleDialog>
    </>
  );
}

function getDescendantNodeIds(data: ProjectRecord["spatialMap"], nodeId: string) {
  const childrenByParent = new Map<string, string[]>();
  for (const link of data.links) {
    if (!link.parentChild) {
      continue;
    }
    childrenByParent.set(link.source, [...(childrenByParent.get(link.source) ?? []), link.target]);
  }

  const descendants = new Set<string>();
  const pending = [...(childrenByParent.get(nodeId) ?? [])];
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || descendants.has(current)) {
      continue;
    }
    descendants.add(current);
    pending.push(...(childrenByParent.get(current) ?? []));
  }

  return descendants;
}
