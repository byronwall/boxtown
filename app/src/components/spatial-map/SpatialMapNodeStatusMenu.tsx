import { createMemo } from "solid-js";

import {
  getMapNodeStatusLabel,
} from "~/lib/spatial-map/node-status";
import {
  mapNodeStatuses,
  type MapNode,
  type MapNodeStatus,
} from "~/lib/spatial-map/types";
import { SpatialMapNodeAttributeMenu } from "./SpatialMapNodeAttributeMenu";

export function SpatialMapNodeStatusMenu(props: {
  node: MapNode;
  pending: boolean;
  showLabel?: boolean;
  variant: "inspector" | "tree";
  onChange: (status: MapNodeStatus) => void;
}) {
  const currentLabel = createMemo(() => getMapNodeStatusLabel(props.node.status));

  return (
    <SpatialMapNodeAttributeMenu
      ariaLabel={`Change node status. Current status: ${currentLabel()}`}
      class={`spatial-map-status-chip spatial-map-status-chip--${props.node.status}`}
      currentLabel={currentLabel()}
      currentValue={props.node.status}
      items={mapNodeStatuses.map((status) => ({
        label: getMapNodeStatusLabel(status),
        value: status,
      }))}
      label={props.showLabel ? "Status" : undefined}
      menuClass="spatial-map-status-menu"
      pending={props.pending}
      tone={getStatusMenuTone(props.node.status)}
      variant={props.variant}
      onChange={props.onChange}
    />
  );
}

function getStatusMenuTone(status: MapNodeStatus) {
  if (status === "implemented") {
    return { fill: "#d8ead8", stroke: "#4f8a4f", copy: "#17391d" };
  }
  if (status === "working") {
    return { fill: "#d8e6ef", stroke: "#4f7790", copy: "#17374b" };
  }
  if (status === "blocked") {
    return { fill: "#efd9d2", stroke: "#9a5a47", copy: "#552417" };
  }
  if (status === "needs-review") {
    return { fill: "#eee1c2", stroke: "#98773a", copy: "#4c3712" };
  }
  if (status === "deprecated") {
    return { fill: "#e0dfdc", stroke: "#777872", copy: "#30322f" };
  }
  return { fill: "#eef1eb", stroke: "#747b72", copy: "#29302b" };
}
