import { FilterIcon } from "lucide-solid";
import { For, type JSX } from "solid-js";
import { Box, HStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import * as Menu from "~/components/ui/menu";
import * as Switch from "~/components/ui/switch";
import { Text } from "~/components/ui/text";
import type { MapNodeStatus } from "~/lib/spatial-map/types";

import type { SpatialMapGlobalFilterState } from "./spatial-map-canvas.types";
import { useSpatialMap } from "./SpatialMapContext";

export function SpatialMapGlobalFilterMenu() {
  const spatialMap = useSpatialMap();

  return (
    <Menu.Root
      positioning={{ placement: "bottom-start", gutter: 4 }}
      size="sm"
      closeOnSelect={false}
    >
      <Menu.Trigger
        asChild={(triggerProps) => (
          <Button
            {...triggerProps()}
            colorPalette="green"
            variant={spatialMap.globalFilterActive() ? "surface" : "outline"}
            size="xs"
            aria-label="Filter visible nodes"
            title="Filter visible nodes"
            background={
              spatialMap.globalFilterActive()
                ? "rgba(229, 239, 229, 0.96)"
                : undefined
            }
            color={
              spatialMap.globalFilterActive()
                ? "var(--spatial-map-accent-strong)"
                : undefined
            }
          >
            <FilterIcon size={15} aria-hidden="true" />
            <Text as="span" fontSize="11px" lineHeight="1">
              {getGlobalFilterLabel(
                spatialMap.globalFilter().enabled,
                getGlobalFilterSelectionCount(spatialMap.globalFilter()),
                spatialMap.globalFilterMatchedCount(),
              )}
            </Text>
          </Button>
        )}
      />
      <Menu.Positioner>
        <Menu.Content
          minW="292px"
          p="10px"
          borderRadius="0"
          fontFamily="inherit"
          textTransform="none"
        >
          <FilterSwitchRow
            label="Filters enabled"
            checked={spatialMap.globalFilter().enabled}
            disabled={getGlobalFilterSelectionCount(spatialMap.globalFilter()) === 0}
            onCheckedChange={(checked) => spatialMap.setGlobalFilterEnabled(checked)}
          />
          <Box h="1px" my="10px" background="rgba(32, 38, 34, 0.12)" />
          <FilterToggleSection label="Type">
            <For each={spatialMap.availableNodeTypes()}>
              {(type) => {
                const selected = () =>
                  spatialMap.globalFilter().selectedTypes.includes(type);

                return (
                  <FilterToggleButton
                    selected={selected()}
                    onClick={() => spatialMap.toggleGlobalFilterType(type)}
                  >
                    {type}
                  </FilterToggleButton>
                );
              }}
            </For>
          </FilterToggleSection>
          <FilterToggleSection label="Status">
            <For each={spatialMap.availableNodeStatuses()}>
              {(status) => {
                const selected = () =>
                  spatialMap.globalFilter().selectedStatuses.includes(status);

                return (
                  <FilterToggleButton
                    selected={selected()}
                    onClick={() => spatialMap.toggleGlobalFilterStatus(status)}
                  >
                    {formatStatusLabel(status)}
                  </FilterToggleButton>
                );
              }}
            </For>
          </FilterToggleSection>
          <Box h="1px" my="10px" background="rgba(32, 38, 34, 0.12)" />
          <FilterSwitchRow
            label="Include parent context"
            checked={spatialMap.globalFilter().includeParents}
            onCheckedChange={(checked) =>
              spatialMap.setGlobalFilterIncludeParents(checked)
            }
          />
          <FilterSwitchRow
            label="Include all children"
            checked={spatialMap.globalFilter().includeChildren}
            onCheckedChange={(checked) =>
              spatialMap.setGlobalFilterIncludeChildren(checked)
            }
          />
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
}

function FilterToggleButton(props: {
  selected: boolean;
  onClick: () => void;
  children: JSX.Element;
}) {
  return (
    <Button
      colorPalette="green"
      variant={props.selected ? "surface" : "outline"}
      size="xs"
      aria-pressed={props.selected}
      onClick={(event) => {
        event.stopPropagation();
        props.onClick();
      }}
      minH="28px"
      borderRadius="5px"
      background={props.selected ? "rgba(229, 239, 229, 0.96)" : "transparent"}
      color={props.selected ? "var(--spatial-map-accent-strong)" : undefined}
    >
      {props.children}
    </Button>
  );
}

function FilterSwitchRow(props: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <Switch.Root
      colorPalette="green"
      size="sm"
      checked={props.checked}
      disabled={props.disabled}
      onCheckedChange={(details) => props.onCheckedChange(details.checked)}
      display="flex"
      alignItems="center"
      justifyContent="space-between"
      gap="16px"
      w="100%"
      minH="32px"
    >
      <Switch.HiddenInput />
      <Switch.Label
        color={props.disabled ? "var(--spatial-map-copy-dim)" : "var(--spatial-map-copy)"}
        fontSize="13px"
        fontWeight="650"
        lineHeight="1"
      >
        {props.label}
      </Switch.Label>
      <HStack gap="8px" alignItems="center">
        <Text as="span" color="var(--spatial-map-copy-dim)" fontSize="11px" fontWeight="700">
          {props.checked ? "On" : "Off"}
        </Text>
        <Switch.Control />
      </HStack>
    </Switch.Root>
  );
}

function FilterToggleSection(props: { label: string; children: JSX.Element }) {
  return (
    <Box display="grid" gap="6px" py="3px">
      <Text
        as="span"
        color="var(--spatial-map-copy-dim)"
        fontSize="11px"
        fontWeight="750"
        lineHeight="1"
      >
        {props.label}
      </Text>
      <HStack gap="6px" flexWrap="wrap">
        {props.children}
      </HStack>
    </Box>
  );
}

function getGlobalFilterLabel(enabled: boolean, selectedCount: number, visibleCount: number) {
  if (selectedCount === 0) {
    return "All";
  }

  if (!enabled) {
    return "Off";
  }

  return `${visibleCount}`;
}

function getGlobalFilterSelectionCount(filter: SpatialMapGlobalFilterState) {
  return filter.selectedTypes.length + filter.selectedStatuses.length;
}

function formatStatusLabel(status: MapNodeStatus) {
  return status
    .split("-")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}
