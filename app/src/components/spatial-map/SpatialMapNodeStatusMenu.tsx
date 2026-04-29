import { ChevronDownIcon } from "lucide-solid";
import { createMemo, For, Show } from "solid-js";

import * as Menu from "~/components/ui/menu";
import {
  getMapNodeStatusLabel,
} from "~/lib/spatial-map/node-status";
import {
  mapNodeStatuses,
  type MapNode,
  type MapNodeStatus,
} from "~/lib/spatial-map/types";

export function SpatialMapNodeStatusMenu(props: {
  node: MapNode;
  pending: boolean;
  showLabel?: boolean;
  variant: "inspector" | "tree";
  onChange: (status: MapNodeStatus) => void;
}) {
  const currentLabel = createMemo(() => getMapNodeStatusLabel(props.node.status));
  const triggerClass = createMemo(() =>
    [
      "spatial-map-status-menu-trigger",
      `spatial-map-status-menu-trigger--${props.variant}`,
      "spatial-map-status-chip",
      `spatial-map-status-chip--${props.node.status}`,
      props.variant === "inspector" ? "spatial-map-inspector-chip" : "",
    ].filter(Boolean).join(" "),
  );

  return (
    <Menu.Root
      positioning={{ placement: "bottom-start", gutter: 4 }}
      size="sm"
    >
      <div
        class="spatial-map-status-menu-trigger-wrap"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <Menu.Trigger
          asChild={(triggerProps) => (
            <button
              {...triggerProps()}
              type="button"
              class={triggerClass()}
              disabled={props.pending}
              aria-label={`Change node status. Current status: ${currentLabel()}`}
            >
              <Show when={props.showLabel}>
                <span class="spatial-map-inspector-row-label">Status</span>
              </Show>
              <span class="spatial-map-status-menu-trigger-value is-mono">
                {currentLabel()}
              </span>
              <ChevronDownIcon size={13} aria-hidden="true" />
            </button>
          )}
        />
      </div>
      <Menu.Positioner>
        <Menu.Content class="spatial-map-status-menu">
          <For each={mapNodeStatuses}>
            {(status) => (
              <Menu.Item
                value={status}
                onClick={(event) => {
                  event.stopPropagation();
                  props.onChange(status);
                }}
              >
                <Menu.ItemText>{getMapNodeStatusLabel(status)}</Menu.ItemText>
                <Show when={status === props.node.status}>
                  <span class="spatial-map-status-menu-current" aria-hidden="true">
                    Current
                  </span>
                </Show>
              </Menu.Item>
            )}
          </For>
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
}
