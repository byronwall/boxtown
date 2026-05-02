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
import type { ProjectRecord } from "~/lib/projects/types";
import type { MapNode } from "~/lib/spatial-map/types";
import { useSpatialMap } from "./SpatialMapContext";

interface SpatialMapDeleteNodeControlProps {
  projectId: string;
  node: MapNode;
  onProjectUpdated?: (project: ProjectRecord) => void;
  compact?: boolean;
  hideTrigger?: boolean;
}

export function SpatialMapDeleteNodeControl(props: SpatialMapDeleteNodeControlProps) {
  const spatialMap = useSpatialMap();
  const [open, setOpen] = createSignal(false);
  const [pending, setPending] = createSignal(false);
  let deleteButtonRef: HTMLButtonElement | undefined;
  const submitDeleteNode = useAction(deleteProjectNode);

  const deleteNode = async () => {
    if (pending()) {
      return;
    }

    const formData = new FormData();
    formData.set("projectId", props.projectId);
    formData.set("nodeId", props.node.id);

    setPending(true);
    try {
      const result = await submitDeleteNode(formData);
      props.onProjectUpdated?.(result);
      setOpen(false);
      if (spatialMap.deleteNodeConfirmId() === props.node.id) {
        spatialMap.clearDeleteNodeConfirm();
      }
      queueMicrotask(() => {
        spatialMap.setSelectedNodeId(result.spatialMap.nodes[0]?.id ?? null);
        spatialMap.setInspectorOpen(true);
      });
      toaster.success({
        title: "Node deleted",
        description: `${props.node.label} was removed from the project map.`,
      });
    } catch (error) {
      toaster.error({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "The node could not be deleted.",
      });
    } finally {
      setPending(false);
    }
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
        description={`Delete ${props.node.label}? Any links attached to this node will also be removed.`}
        maxW="520px"
        initialFocusEl={() => deleteButtonRef ?? null}
        footer={
          <HStack>
            <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>
              Keep
            </Button>
            <Button
              ref={deleteButtonRef}
              type="button"
              loading={pending()}
              variant="danger"
              onClick={() => {
                void deleteNode();
              }}
            >
              Delete
            </Button>
          </HStack>
        }
      >
        <VStack alignItems="stretch" gap="4">
          <Text textStyle="sm" color="fg.muted">
            This removes the node and prunes any incoming or outgoing links that reference it.
          </Text>
        </VStack>
      </SimpleDialog>
    </>
  );
}
