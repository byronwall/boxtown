import { useAction } from "@solidjs/router";
import { createMemo, createSignal } from "solid-js";
import { toaster } from "~/components/ui/toast";
import { updateProjectNodePriority } from "~/lib/projects/data";
import {
  createClientMutationId,
  updateProjectNode,
  type ProjectUpdateOptions,
} from "~/lib/projects/optimistic";
import type { ProjectRecord } from "~/lib/projects/types";
import {
  getMapNodePriorityLabel,
  isMapNodePriority,
  mapNodePriorities,
  type MapNodePriority,
} from "~/lib/spatial-map/node-priority";
import { withNodePriority } from "~/lib/spatial-map/node-priority-update";
import type { MapNode } from "~/lib/spatial-map/types";
import { SpatialMapNodeAttributeMenu } from "./SpatialMapNodeAttributeMenu";

const NO_PRIORITY = "none";

export const priorityMenuItems = [
  ...mapNodePriorities.map((priority) => ({
    label: getMapNodePriorityLabel(priority),
    value: priority as string,
  })),
  { label: getMapNodePriorityLabel(undefined), value: NO_PRIORITY },
];

export function SpatialMapNodePriorityMenu(props: {
  project: ProjectRecord;
  node: MapNode;
  variant: "inspector" | "tree";
  showLabel?: boolean;
  onProjectUpdated?: (project: ProjectRecord, options?: ProjectUpdateOptions) => void;
}) {
  const [pending, setPending] = createSignal(false);
  const submitPriority = useAction(updateProjectNodePriority);
  const currentLabel = createMemo(() => getMapNodePriorityLabel(props.node.priority));

  const changePriority = async (value: string) => {
    const priority = isMapNodePriority(value) ? value : null;
    if (pending() || priority === (props.node.priority ?? null)) {
      return;
    }

    const nodeId = props.node.id;
    const previousProject = props.project;
    const clientMutationId = createClientMutationId();
    setPending(true);
    props.onProjectUpdated?.(
      updateProjectNode(props.project, nodeId, (node) => withNodePriority(node, priority)),
      { clientMutationId, phase: "optimistic" },
    );

    try {
      const result = await submitPriority({ projectId: props.project.id, nodeId, priority, clientMutationId });
      props.onProjectUpdated?.(result, { clientMutationId, phase: "server" });
    } catch (error) {
      props.onProjectUpdated?.(previousProject, { clientMutationId, phase: "server" });
      toaster.error({
        title: "Priority update failed",
        description: error instanceof Error ? error.message : "The node priority could not be updated.",
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <SpatialMapNodeAttributeMenu
      ariaLabel={`Change node priority. Current priority: ${currentLabel()}`}
      class="spatial-map-priority-chip"
      currentLabel={currentLabel()}
      currentValue={props.node.priority ?? NO_PRIORITY}
      items={priorityMenuItems}
      label={props.showLabel ? "Priority" : undefined}
      menuClass="spatial-map-priority-menu"
      pending={pending()}
      tone={getPriorityMenuTone(props.node.priority)}
      variant={props.variant}
      onChange={(value) => void changePriority(value)}
    />
  );
}

function getPriorityMenuTone(priority: MapNodePriority | undefined) {
  if (priority === "urgent") {
    return { fill: "#efd9d2", stroke: "#9a5a47", copy: "#552417" };
  }
  if (priority === "high") {
    return { fill: "#eee1c2", stroke: "#98773a", copy: "#4c3712" };
  }
  if (priority === "medium") {
    return { fill: "#d8e6ef", stroke: "#4f7790", copy: "#17374b" };
  }
  return { fill: "#eef1eb", stroke: "#747b72", copy: "#29302b" };
}
