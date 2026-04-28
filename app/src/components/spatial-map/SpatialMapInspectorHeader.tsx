import { Show, createMemo } from "solid-js";
import { Box, VStack } from "styled-system/jsx";
import { Text } from "~/components/ui/text";
import { useSpatialMap } from "./SpatialMapContext";

interface SpatialMapInspectorHeaderProps {
  title: string;
  kicker?: string;
  description?: string;
  controls?: string;
  closeLabel?: string;
  onClose?: () => void;
}

export function SpatialMapInspectorHeader(props: SpatialMapInspectorHeaderProps) {
  return (
    <Box class="spatial-map-inspector-header">
      <VStack alignItems="start" gap="1" class="spatial-map-inspector-header-copy">
        <Show when={props.kicker}>
          {(kicker) => (
            <Text as="span" textStyle="xs" class="spatial-map-kicker">
              {kicker()}
            </Text>
          )}
        </Show>
        <Box as="h2" class="spatial-map-inspector-title">
          {props.title}
        </Box>
        <Show when={props.description}>
          {(description) => (
            <Text as="p" class="spatial-map-inspector-copy">
              {description()}
            </Text>
          )}
        </Show>
      </VStack>
      <InspectorToggle
        inToolbar={false}
        expanded
        controls={props.controls}
        expandedLabel={props.closeLabel}
        onClick={props.onClose}
      />
    </Box>
  );
}

export function InspectorToggle(props: {
  inToolbar: boolean;
  expanded?: boolean;
  controls?: string;
  expandedLabel?: string;
  collapsedLabel?: string;
  onClick?: () => void;
}) {
  const spatialMap = useSpatialMap();
  const expanded = createMemo(() => props.expanded ?? spatialMap.inspectorOpen());
  const label = createMemo(() =>
    expanded()
      ? props.expandedLabel ?? "Hide inspector panel"
      : props.collapsedLabel ?? "Show inspector panel"
  );

  return (
    <button
      type="button"
      class={`spatial-map-inspector-toggle${props.inToolbar ? " is-toolbar" : ""}`}
      onClick={props.onClick ?? (() => spatialMap.setInspectorOpen((current) => !current))}
      aria-expanded={expanded()}
      aria-controls={props.controls ?? "spatial-map-inspector"}
      aria-label={label()}
      title={label()}
    >
      <span aria-hidden="true" class="spatial-map-inspector-toggle-icon">
        {expanded() ? ">" : "<"}
      </span>
    </button>
  );
}
