import { For } from "solid-js";
import { Box, HStack, VStack } from "styled-system/jsx";
import { Text } from "~/components/ui/text";
import type { MapNode } from "~/lib/spatial-map/types";
import { useSpatialMap } from "./SpatialMapContext";

export function SpatialMapInspector() {
  const spatialMap = useSpatialMap();

  return (
    <Box class="spatial-map-inspector-rail">
      <aside
        id="spatial-map-inspector"
        class={`spatial-map-inspector${spatialMap.inspectorOpen() ? "" : " is-collapsed"}`}
      >
        <VStack alignItems="start" gap="2" h="full">
          <Box class="spatial-map-inspector-header">
            <VStack alignItems="start" gap="1" class="spatial-map-inspector-header-copy">
              <Text as="span" textStyle="xs" class="spatial-map-kicker">
                Inspector rail
              </Text>
              <Box as="h2" class="spatial-map-inspector-title">
                {spatialMap.selectedNode()?.label ?? "Select an item"}
              </Box>
              <Text as="p" class="spatial-map-inspector-copy">
                {spatialMap.selectedNode()
                  ? "Lock another node to compare structure without losing current context."
                  : "Choose any node to inspect metadata, role, and network relationships."}
              </Text>
            </VStack>
            <InspectorToggle inToolbar={false} />
          </Box>

          <Box class="spatial-map-inspector-section">
            <InspectorRow label="ID" value={spatialMap.selectedNode()?.id ?? "None"} mono />
            <InspectorRow label="Type" value={spatialMap.selectedNode()?.type ?? "Unknown"} />
            <InspectorRow label="Depth" value={String(spatialMap.selectedNode()?.depth ?? 0)} />
          </Box>

          <Box class="spatial-map-inspector-section">
            <InspectorBlock
              title="Purpose"
              body={spatialMap.selectedNode()?.purpose ?? "No purpose available for this item."}
            />
            <InspectorBlock
              title="Implementation"
              body={
                spatialMap.selectedNode()?.implementation ??
                "No implementation notes available for this item."
              }
            />
          </Box>

          <Box class="spatial-map-inspector-section">
            <Text as="h3" margin="0 0 6px" fontSize="sm" fontWeight="semibold" class="spatial-map-inspector-section-title">
              Connections
            </Text>
            <InspectorRelationList
              emptyLabel="No outgoing links"
              items={spatialMap.selectedNodeRelations().outgoing}
              nodeById={spatialMap.sourceNodesById()}
              selectedNodeId={spatialMap.selectedNodeId()}
              title="Outgoing"
              onSelect={(nodeId) => spatialMap.setSelectedNodeId(nodeId)}
            />
            <InspectorRelationList
              emptyLabel="No incoming links"
              items={spatialMap.selectedNodeRelations().incoming}
              nodeById={spatialMap.sourceNodesById()}
              selectedNodeId={spatialMap.selectedNodeId()}
              title="Incoming"
              onSelect={(nodeId) => spatialMap.setSelectedNodeId(nodeId)}
            />
          </Box>
        </VStack>
      </aside>
    </Box>
  );
}

export function InspectorToggle(props: { inToolbar: boolean }) {
  const spatialMap = useSpatialMap();

  return (
    <button
      type="button"
      class={`spatial-map-inspector-toggle${props.inToolbar ? " is-toolbar" : ""}`}
      onClick={() => spatialMap.setInspectorOpen((current) => !current)}
      aria-expanded={spatialMap.inspectorOpen()}
      aria-controls="spatial-map-inspector"
      aria-label={spatialMap.inspectorOpen() ? "Hide inspector panel" : "Show inspector panel"}
      title={spatialMap.inspectorOpen() ? "Hide inspector panel" : "Show inspector panel"}
    >
      <span aria-hidden="true" class="spatial-map-inspector-toggle-icon">
        {spatialMap.inspectorOpen() ? ">" : "<"}
      </span>
    </button>
  );
}

function InspectorRow(props: { label: string; value: string; mono?: boolean }) {
  return (
    <HStack justifyContent="space-between" alignItems="start" gap="3" class="spatial-map-inspector-row">
      <Text as="span" textStyle="xs" class="spatial-map-inspector-row-label">
        {props.label}
      </Text>
      <Text
        as="span"
        textStyle="sm"
        class={props.mono ? "spatial-map-inspector-row-value is-mono" : "spatial-map-inspector-row-value"}
        textAlign="right"
      >
        {props.value}
      </Text>
    </HStack>
  );
}

function InspectorBlock(props: { title: string; body: string }) {
  return (
    <VStack alignItems="start" gap="1" class="spatial-map-inspector-block">
      <Text
        as="h3"
        margin="0"
        fontSize="sm"
        fontWeight="semibold"
        class="spatial-map-inspector-block-title"
      >
        {props.title}
      </Text>
      <Text as="p" margin="0" class="spatial-map-inspector-block-body">
        {props.body}
      </Text>
    </VStack>
  );
}

function InspectorRelationList(props: {
  title: string;
  emptyLabel: string;
  items: { kind: string; nodeId: string }[];
  nodeById: Map<string, MapNode>;
  selectedNodeId: string | null;
  onSelect: (nodeId: string) => void;
}) {
  return (
    <VStack alignItems="start" gap="1" mt="2">
      <Text
        as="h4"
        margin="0"
        fontSize="xs"
        fontWeight="semibold"
        class="spatial-map-relation-title"
      >
        {props.title}
      </Text>
      <For each={props.items}>
        {(item) => {
          const node = props.nodeById.get(item.nodeId);
          if (!node) {
            return null;
          }

          return (
            <button
              type="button"
              class={`spatial-map-relation-card${props.selectedNodeId === node.id ? " is-selected" : ""}`}
              onClick={() => props.onSelect(node.id)}
              aria-pressed={props.selectedNodeId === node.id}
            >
              <Text as="div" margin="0" fontSize="sm" fontWeight="semibold" class="spatial-map-relation-name">
                {node.label}
              </Text>
              <Text as="div" margin="2px 0 0" fontSize="xs" class="spatial-map-relation-meta">
                {item.kind} · {node.type} · depth {node.depth}
              </Text>
            </button>
          );
        }}
      </For>
      {props.items.length === 0 ? (
        <Text as="p" margin="0" fontSize="sm" class="spatial-map-empty-state">
          {props.emptyLabel}
        </Text>
      ) : null}
    </VStack>
  );
}
