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
      variant={props.variant}
      onChange={props.onChange}
    />
  );
}
