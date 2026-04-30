import { useSubmission } from "@solidjs/router";
import { createEffect, createSignal } from "solid-js";
import { HStack, VStack } from "styled-system/jsx";
import { Trash2 } from "lucide-solid";
import { Button } from "~/components/ui/button";
import { SimpleDialog } from "~/components/ui/simple-dialog";
import { Text } from "~/components/ui/text";
import { Tooltip } from "~/components/ui/tooltip";
import { toaster } from "~/components/ui/toast";
import { deleteProjectNode } from "~/lib/projects/data";
import type { ProjectRecord } from "~/lib/projects/types";
import { normalizeActionUrl } from "~/lib/router/action-url";
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
  const formId = `delete-node-${props.hideTrigger ? "shortcut" : "button"}-${props.node.id}`;
  const submission = useSubmission(deleteProjectNode, (input) => {
    const formData = input[0];
    return (
      formData instanceof FormData &&
      formData.get("projectId") === props.projectId &&
      formData.get("nodeId") === props.node.id &&
      formData.get("deleteFormId") === formId
    );
  });

  createEffect(() => {
    if (props.hideTrigger && spatialMap.deleteNodeConfirmId() === props.node.id) {
      setOpen(true);
    }
  });

  const setDialogOpen = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen && spatialMap.deleteNodeConfirmId() === props.node.id) {
      spatialMap.clearDeleteNodeConfirm();
    }
  };

  createEffect(() => {
    const result = submission.result;
    if (!result || submission.pending) {
      return;
    }

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
    submission.clear();
  });

  return (
    <>
      {!props.hideTrigger && (
        <Tooltip content="Delete node" disabled={!props.compact} openDelay={150} closeDelay={80}>
          <Button
            size="xs"
            variant="outline"
            class={`spatial-map-button spatial-map-button--danger${props.compact ? " spatial-map-icon-button" : ""}`}
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
        footer={
          <HStack>
            <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>
              Keep
            </Button>
            <Button
              type="submit"
              form={formId}
              loading={submission.pending}
              class="spatial-map-button spatial-map-button--danger"
            >
              Delete
            </Button>
          </HStack>
        }
      >
        <form
          id={formId}
          action={normalizeActionUrl(deleteProjectNode.url)}
          method="post"
        >
          <VStack alignItems="stretch" gap="4">
            <input type="hidden" name="projectId" value={props.projectId} />
            <input type="hidden" name="nodeId" value={props.node.id} />
            <input type="hidden" name="deleteFormId" value={formId} />
            <Text textStyle="sm" color="fg.muted">
              This removes the node and prunes any incoming or outgoing links that reference it.
            </Text>
          </VStack>
        </form>
      </SimpleDialog>
    </>
  );
}
