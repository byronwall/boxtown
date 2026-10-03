import { For } from "solid-js";
import { HStack, styled } from "styled-system/jsx";

const SegmentButton = styled("button");

export type SpatialMapSegmentedOption<T extends string | number> = {
  value: T;
  label: string;
  ariaLabel?: string;
};

// One connected control for picking a single value. The active segment uses a
// fill plus text treatment only; no underline or inset markers.
export function SpatialMapSegmentedControl<T extends string | number>(props: {
  ariaLabel: string;
  value: T;
  options: SpatialMapSegmentedOption<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <HStack
      role="group"
      aria-label={props.ariaLabel}
      gap="0"
      flexShrink="0"
      overflow="hidden"
      border="1px solid var(--spatial-map-panel-border)"
      borderRadius="6px"
      background="var(--spatial-map-panel-strong)"
    >
      <For each={props.options}>
        {(option, index) => {
          const active = () => props.value === option.value;

          return (
            <SegmentButton
              type="button"
              h="22px"
              minW="28px"
              p="0 8px"
              border="0"
              borderLeft={index() === 0 ? "0" : "1px solid var(--spatial-map-panel-divider)"}
              background={active() ? "rgba(233, 235, 232, 0.96)" : "transparent"}
              color={active() ? "var(--spatial-map-accent-strong)" : "var(--spatial-map-copy-dim)"}
              fontFamily="inherit"
              fontSize="11px"
              fontWeight={active() ? "700" : "500"}
              lineHeight="1"
              whiteSpace="nowrap"
              cursor="pointer"
              _hover={{ color: "var(--spatial-map-copy)" }}
              _focusVisible={{ outline: "none", boxShadow: "inset 0 0 0 1px rgba(60, 66, 62, 0.56)" }}
              // A segment sits flush in its group, so it presses with a fill instead of a scale.
              _active={{ transform: "none", background: "rgba(34, 41, 36, 0.1)" }}
              aria-label={option.ariaLabel}
              aria-pressed={active()}
              onClick={() => props.onChange(option.value)}
            >
              {option.label}
            </SegmentButton>
          );
        }}
      </For>
    </HStack>
  );
}
