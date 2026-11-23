import { For, Show, createMemo, createSignal } from "solid-js";
import { ListTreeIcon } from "lucide-solid";
import { Box, styled } from "styled-system/jsx";
import { IconButton } from "~/components/ui/icon-button";
import { PanelPopover } from "~/components/ui/panel-popover";
import { Text } from "~/components/ui/text";
import { Tooltip } from "~/components/ui/tooltip";
import { getMapNodeStatusLabel } from "~/lib/spatial-map/node-status";
import { countDescendants, getAncestorIds } from "./spatial-map-structure";
import { buildSpatialMapTree, type SpatialMapTree } from "./spatial-map-tree";
import { useSpatialMap } from "./SpatialMapContext";

const PeekRowButton = styled("button");

// Levels of descendants listed under the selected node; deeper levels collapse
// into a count so the peek stays compact.
const PEEK_DEPTH = 3;

// A read-only look at where the selected node sits: its ancestors, itself, and
// a few levels of descendants. Opening and closing it leaves selection and the
// camera untouched; choosing a row selects that node.
export function SpatialMapStructurePeek(props: { nodeId: string }) {
  const spatialMap = useSpatialMap();
  const [open, setOpen] = createSignal(false);
  const tree = createMemo(() => buildSpatialMapTree(spatialMap.sourceData()));
  const ancestors = createMemo(() => getAncestorIds(tree(), props.nodeId));
  const label = () => (open() ? "Hide structure" : "Peek at structure");

  const selectNode = (nodeId: string) => {
    setOpen(false);
    spatialMap.setSelectedNodeId(nodeId);
  };

  return (
    <PanelPopover
      open={open()}
      onClose={() => setOpen(false)}
      placement="bottom-end"
      title="Structure"
      width="20rem"
      anchor={
        <Tooltip content={label()} openDelay={150} closeDelay={80}>
          <IconButton
            variant="plain"
            size="xs"
            w="24px"
            minW="24px"
            h="24px"
            p="0"
            color="var(--spatial-map-copy-dim)"
            aria-label={label()}
            aria-expanded={open()}
            aria-haspopup="dialog"
            onClick={() => setOpen((current) => !current)}
          >
            <ListTreeIcon size={15} />
          </IconButton>
        </Tooltip>
      }
    >
      <Box maxH="min(60vh, 420px)" overflowY="auto" mx="-2" data-testid="structure-peek">
        <For each={ancestors()}>
          {(nodeId, index) => (
            <PeekRow tree={tree()} nodeId={nodeId} level={index()} onSelect={selectNode} />
          )}
        </For>
        <PeekRow tree={tree()} nodeId={props.nodeId} level={ancestors().length} current onSelect={selectNode} />
        <PeekChildren tree={tree()} nodeId={props.nodeId} level={ancestors().length + 1} remaining={PEEK_DEPTH} onSelect={selectNode} />
        <Show when={(tree().items.get(props.nodeId)?.childNodeIds.length ?? 0) === 0}>
          <Text as="p" m="0" p="4px 8px" color="var(--spatial-map-copy-dim)" fontSize="12px">
            No child nodes.
          </Text>
        </Show>
      </Box>
    </PanelPopover>
  );
}

function PeekChildren(props: {
  tree: SpatialMapTree;
  nodeId: string;
  level: number;
  remaining: number;
  onSelect: (nodeId: string) => void;
}) {
  const childIds = () => props.tree.items.get(props.nodeId)?.childNodeIds ?? [];

  return (
    <For each={childIds()}>
      {(childId) => (
        <>
          <PeekRow tree={props.tree} nodeId={childId} level={props.level} onSelect={props.onSelect} />
          <Show
            when={props.remaining > 1}
            fallback={
              <Show when={countDescendants(props.tree, childId) > 0}>
                <Text as="p" m="0" p="1px 8px" color="var(--spatial-map-copy-dim)" fontSize="11px" style={{ "padding-left": `${8 + (props.level + 1) * 14}px` }}>
                  +{countDescendants(props.tree, childId)} more
                </Text>
              </Show>
            }
          >
            <PeekChildren tree={props.tree} nodeId={childId} level={props.level + 1} remaining={props.remaining - 1} onSelect={props.onSelect} />
          </Show>
        </>
      )}
    </For>
  );
}

function PeekRow(props: {
  tree: SpatialMapTree;
  nodeId: string;
  level: number;
  current?: boolean;
  onSelect: (nodeId: string) => void;
}) {
  const node = () => props.tree.items.get(props.nodeId)?.node;
  const childCount = () => props.tree.items.get(props.nodeId)?.childNodeIds.length ?? 0;

  return (
    <Show when={node()}>
      {(item) => (
        <PeekRowButton
          type="button"
          display="grid"
          gridTemplateColumns="minmax(0, 1fr) auto"
          alignItems="baseline"
          columnGap="8px"
          w="100%"
          py="3px"
          pr="8px"
          border="0"
          borderRadius="4px"
          background={props.current ? "color-mix(in srgb, var(--spatial-map-ink) 8%, transparent)" : "transparent"}
          color="var(--spatial-map-copy)"
          font="inherit"
          textAlign="left"
          cursor="pointer"
          _hover={{ background: "color-mix(in srgb, var(--spatial-map-ink) 6%, transparent)" }}
          _focusVisible={{ outline: "none", boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--spatial-map-ink) 50%, transparent)" }}
          aria-current={props.current ? "true" : undefined}
          style={{ "padding-left": `${8 + props.level * 14}px` }}
          onClick={() => props.onSelect(props.nodeId)}
        >
          <Text
            as="span"
            fontSize="12px"
            lineHeight="1.35"
            fontWeight={props.current ? "700" : "500"}
            overflow="hidden"
            textOverflow="ellipsis"
            whiteSpace="nowrap"
          >
            {item().label}
          </Text>
          <Text as="span" color="var(--spatial-map-copy-dim)" fontSize="11px" whiteSpace="nowrap">
            {getMapNodeStatusLabel(item().status)}
            {childCount() > 0 ? ` · ${childCount()}` : ""}
          </Text>
        </PeekRowButton>
      )}
    </Show>
  );
}
