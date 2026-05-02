import { ChevronDownIcon } from "lucide-solid";
import { For, Show } from "solid-js";
import { Box, styled } from "styled-system/jsx";

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
  tone?: {
    fill: string;
    stroke: string;
    copy: string;
  };
  onChange: (value: T) => void;
}) {
  const triggerTone = () =>
    props.tone ?? {
      fill: "rgba(244, 247, 241, 0.78)",
      stroke: "#6f776e",
      copy: "#202622",
    };
  const triggerClass = () =>
    [
      "spatial-map-attribute-menu-trigger",
      `spatial-map-attribute-menu-trigger--${props.variant}`,
      props.class,
      props.variant === "inspector" ? "spatial-map-inspector-chip" : "",
    ].filter(Boolean).join(" ");

  return (
    <Menu.Root positioning={{ placement: "bottom-start", gutter: 4 }} size="sm">
      <Box
        class="spatial-map-attribute-menu-trigger-wrap"
        display="inline-flex"
        minW="0"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <Menu.Trigger
          asChild={(triggerProps) => (
            <AttributeMenuButton
              {...triggerProps()}
              type="button"
              class={triggerClass()}
              disabled={props.pending}
              display="inline-flex"
              alignItems="center"
              gap="6px"
              minW="0"
              maxW="100%"
              minH={props.variant === "tree" ? "21px" : "28px"}
              p={props.variant === "tree" ? "0 6px 0 8px" : "0 7px 0 9px"}
              border="1px solid"
              borderColor={`color-mix(in srgb, ${triggerTone().stroke} 52%, transparent)`}
              borderRadius="4px"
              background={triggerTone().fill}
              color={triggerTone().copy}
              cursor={props.pending ? "wait" : "pointer"}
              font="inherit"
              opacity={props.pending ? "0.68" : undefined}
              _hover={{
                borderColor: `color-mix(in srgb, ${triggerTone().stroke} 76%, transparent)`,
                boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${triggerTone().stroke} 22%, transparent)`,
                outline: "none",
              }}
              _focusVisible={{
                borderColor: `color-mix(in srgb, ${triggerTone().stroke} 76%, transparent)`,
                boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${triggerTone().stroke} 22%, transparent)`,
                outline: "none",
              }}
              aria-label={props.ariaLabel}
            >
              <Show when={props.label}>
                {(label) => (
                  <Box
                    as="span"
                    flexShrink="0"
                    color="var(--spatial-map-copy-dim)"
                    fontSize="11px"
                    fontWeight="700"
                    letterSpacing="0.09em"
                    lineHeight="1"
                  >
                    {label()}
                  </Box>
                )}
              </Show>
              <Box
                as="span"
                minW="0"
                overflow="hidden"
                color={triggerTone().copy}
                fontSize="10px"
                fontWeight="700"
                letterSpacing={props.variant === "tree" ? "0.08em" : undefined}
                textOverflow="ellipsis"
                whiteSpace="nowrap"
              >
                {props.currentLabel}
              </Box>
              <ChevronDownIcon size={13} aria-hidden="true" />
            </AttributeMenuButton>
          )}
        />
      </Box>
      <Menu.Positioner>
        <Menu.Content class={props.menuClass ?? "spatial-map-attribute-menu"} minW="160px">
          <For each={props.items}>
            {(item) => (
              <Menu.Item
                class={item.value === props.currentValue ? "is-current" : undefined}
                value={item.value}
                background={item.value === props.currentValue ? "rgba(44, 99, 134, 0.1)" : undefined}
                color={item.value === props.currentValue ? "var(--spatial-map-copy)" : undefined}
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

const AttributeMenuButton = styled("button");
