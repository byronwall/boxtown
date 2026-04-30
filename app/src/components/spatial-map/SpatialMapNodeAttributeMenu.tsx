import { ChevronDownIcon } from "lucide-solid";
import { For, Show } from "solid-js";

import * as Menu from "~/components/ui/menu";

export type SpatialMapNodeAttributeMenuItem<T extends string> = {
  label: string;
  value: T;
};

export function SpatialMapNodeAttributeMenu<T extends string>(props: {
  ariaLabel: string;
  currentLabel: string;
  currentValue: T;
  items: SpatialMapNodeAttributeMenuItem<T>[];
  pending: boolean;
  variant: "inspector" | "tree";
  class?: string;
  label?: string;
  menuClass?: string;
  onChange: (value: T) => void;
}) {
  const triggerClass = () =>
    [
      "spatial-map-attribute-menu-trigger",
      `spatial-map-attribute-menu-trigger--${props.variant}`,
      props.class,
      props.variant === "inspector" ? "spatial-map-inspector-chip" : "",
    ].filter(Boolean).join(" ");

  return (
    <Menu.Root positioning={{ placement: "bottom-start", gutter: 4 }} size="sm">
      <div
        class="spatial-map-attribute-menu-trigger-wrap"
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
              aria-label={props.ariaLabel}
            >
              <Show when={props.label}>
                {(label) => (
                  <span class="spatial-map-inspector-row-label">{label()}</span>
                )}
              </Show>
              <span class="spatial-map-attribute-menu-trigger-value is-mono">
                {props.currentLabel}
              </span>
              <ChevronDownIcon size={13} aria-hidden="true" />
            </button>
          )}
        />
      </div>
      <Menu.Positioner>
        <Menu.Content class={props.menuClass ?? "spatial-map-attribute-menu"}>
          <For each={props.items}>
            {(item) => (
              <Menu.Item
                class={item.value === props.currentValue ? "is-current" : undefined}
                value={item.value}
                onClick={(event) => {
                  event.stopPropagation();
                  props.onChange(item.value);
                }}
              >
                <Menu.ItemText>{item.label}</Menu.ItemText>
              </Menu.Item>
            )}
          </For>
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
}
