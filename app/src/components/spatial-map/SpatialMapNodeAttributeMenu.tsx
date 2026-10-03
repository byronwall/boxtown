import { ChevronDownIcon } from "lucide-solid";
import { For, Show, createMemo, createSignal } from "solid-js";
import { Box, styled } from "styled-system/jsx";

import * as Menu from "~/components/ui/menu";
import { filterAttributeMenuItems } from "./spatial-map-attribute-filter";

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
  // Adds a filter field above the options; use for lists that can grow.
  searchable?: boolean;
  searchPlaceholder?: string;
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

  const [open, setOpen] = createSignal(false);
  const [query, setQuery] = createSignal("");
  const [highlightedValue, writeHighlightedValue] = createSignal<string | null>(null);
  const setHighlightedValue = (value: string | null) => writeHighlightedValue(() => value);
  const visibleItems = createMemo(() =>
    props.searchable ? filterAttributeMenuItems(props.items, query()) : props.items,
  );
  const choose = (value: T) => {
    setOpen(false);
    props.onChange(value);
  };
  // The filter field keeps focus, so it drives the menu highlight itself.
  const moveHighlight = (step: number) => {
    const items = visibleItems();
    if (items.length === 0) return;
    const index = items.findIndex((item) => item.value === highlightedValue());
    const next = index === -1 ? (step > 0 ? 0 : items.length - 1) : (index + step + items.length) % items.length;
    setHighlightedValue(items[next].value);
  };
  const handleSearchKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape" || event.key === "Tab") return;
    event.stopPropagation();
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      moveHighlight(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = visibleItems().find((candidate) => candidate.value === highlightedValue()) ?? visibleItems()[0];
      if (item) choose(item.value);
    }
  };

  return (
    <Menu.Root
      positioning={{ placement: "bottom-start", gutter: 4 }}
      size="sm"
      open={open()}
      highlightedValue={props.searchable ? highlightedValue() : undefined}
      onHighlightChange={(details) => setHighlightedValue(details.highlightedValue)}
      onOpenChange={(details) => {
        setOpen(details.open);
        setQuery("");
        setHighlightedValue(details.open && props.searchable ? props.currentValue : null);
      }}
    >
      <Box
        class="spatial-map-attribute-menu-trigger-wrap"
        display="inline-flex"
        minW="0"
        // Panda cannot extract runtime color values, so tones reach the trigger as CSS variables.
        style={{
          "--attribute-fill": triggerTone().fill,
          "--attribute-stroke": triggerTone().stroke,
          "--attribute-copy": triggerTone().copy,
        }}
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
              minH={props.variant === "tree" ? "21px" : "22px"}
              p="0 5px 0 8px"
              border="1px solid"
              borderColor="color-mix(in srgb, var(--attribute-stroke) 52%, transparent)"
              borderRadius="4px"
              background="var(--attribute-fill)"
              color="var(--attribute-copy)"
              title={props.ariaLabel}
              cursor={props.pending ? "wait" : "pointer"}
              font="inherit"
              opacity={props.pending ? "0.68" : undefined}
              _hover={{
                borderColor: "color-mix(in srgb, var(--attribute-stroke) 76%, transparent)",
                boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--attribute-stroke) 22%, transparent)",
                outline: "none",
              }}
              _focusVisible={{
                borderColor: "color-mix(in srgb, var(--attribute-stroke) 76%, transparent)",
                boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--attribute-stroke) 22%, transparent)",
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
                fontSize={props.variant === "tree" ? "10px" : "11px"}
                fontWeight={props.variant === "tree" ? "700" : "600"}
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
          <Show when={props.searchable}>
            <SearchInput
              ref={(element) => queueMicrotask(() => element.focus())}
              type="text"
              value={query()}
              placeholder={props.searchPlaceholder ?? "Filter options"}
              aria-label={props.searchPlaceholder ?? "Filter options"}
              autocomplete="off"
              spellcheck={false}
              w="100%"
              mb="4px"
              p="4px 6px"
              border="1px solid var(--spatial-map-panel-border)"
              borderRadius="4px"
              background="white"
              color="var(--spatial-map-copy)"
              font="inherit"
              fontSize="12px"
              _focusVisible={{ outline: "none", borderColor: "var(--spatial-map-panel-border-strong)" }}
              onInput={(event) => {
                setQuery(event.currentTarget.value);
                setHighlightedValue(visibleItems()[0]?.value ?? null);
              }}
              onKeyDown={handleSearchKeyDown}
            />
            <Show when={visibleItems().length === 0}>
              <Box p="4px 8px" color="var(--spatial-map-copy-dim)" fontSize="12px">
                No options match “{query().trim()}”
              </Box>
            </Show>
          </Show>
          <For each={visibleItems()}>
            {(item) => (
              <Menu.Item
                class={item.value === props.currentValue ? "is-current" : undefined}
                value={item.value}
                background={item.value === props.currentValue ? "rgba(44, 99, 134, 0.1)" : undefined}
                color={item.value === props.currentValue ? "var(--spatial-map-copy)" : undefined}
                onClick={(event) => {
                  event.stopPropagation();
                  choose(item.value);
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
const SearchInput = styled("input");
