import { SearchIcon } from "lucide-solid";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Match,
  Show,
  Switch,
} from "solid-js";
import { Box, HStack, styled, VStack } from "styled-system/jsx";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { calculateNodeDepths } from "~/lib/spatial-map/depth";
import type { MapNode, SpatialMapData } from "~/lib/spatial-map/types";

import { useSpatialMap } from "./SpatialMapContext";

const RESULT_LIMIT = 8;

const ReparentResultButton = styled("button");

interface SpatialMapReparentControlProps {
  data: SpatialMapData;
  invalidParentIds: Set<string>;
  movePending: boolean;
  onMove: (parentNodeId: string | null) => void;
  onCancel: () => void;
}

interface ReparentSearchResult {
  node: MapNode;
  depth: number;
  sortOrder: number;
  matchStart: number;
}

export function SpatialMapReparentControl(props: SpatialMapReparentControlProps) {
  const controller = useSpatialMap();
  const [searchOpen, setSearchOpen] = createSignal(false);
  const [query, setQuery] = createSignal("");
  const [activeIndex, setActiveIndex] = createSignal(0);
  let inputRef: HTMLInputElement | undefined;

  const hierarchy = createMemo(() => createReparentHierarchy(props.data));
  const candidates = createMemo(() =>
    [...controller.sourceNodesById().values()]
      .filter((node) => !props.invalidParentIds.has(node.id))
      .sort((left, right) => compareNodes(left, right, hierarchy())),
  );
  const results = createMemo(() =>
    searchReparentNodes(candidates(), query(), hierarchy()).slice(0, RESULT_LIMIT),
  );

  createEffect(() => {
    if (activeIndex() >= results().length) {
      setActiveIndex(Math.max(results().length - 1, 0));
    }
  });

  createEffect(() => {
    controller.reparentingNodeId();
    setSearchOpen(false);
    setQuery("");
    setActiveIndex(0);
  });

  createEffect(() => {
    if (searchOpen()) {
      queueMicrotask(() => inputRef?.focus());
    }
  });

  const selectResult = (result: ReparentSearchResult | undefined) => {
    if (!result || props.movePending) {
      return;
    }

    props.onMove(result.node.id);
  };

  return (
    <Box
      position="absolute"
      right="10px"
      bottom="48px"
      zIndex="4"
      w="max-content"
      maxW="calc(100% - 20px)"
      color="var(--spatial-map-copy)"
      pointerEvents="auto"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <Show when={searchOpen()}>
        <Box
          position="absolute"
          right="0"
          bottom="74px"
          w="min(420px, calc(100vw - 20px))"
          border="1px solid var(--spatial-map-panel-border)"
          borderRadius="6px"
          background="#fbfcfb"
          boxShadow="0 8px 24px rgba(24, 32, 24, 0.15)"
          overflow="hidden"
        >
          <HStack
            gap="2"
            minH="36px"
            p="4px 9px"
            borderBottom="1px solid var(--spatial-map-panel-divider)"
          >
            <SearchIcon size={15} aria-hidden="true" />
            <Input
              ref={inputRef}
              variant="spatial"
              size="sm"
              border="0"
              bg="transparent"
              boxShadow="none"
              fontSize="12px"
              aria-label="Search parent nodes"
              placeholder="Search parent nodes..."
              value={query()}
              onInput={(event) => {
                setQuery(event.currentTarget.value);
                setActiveIndex(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActiveIndex((current) =>
                    Math.min(current + 1, Math.max(results().length - 1, 0)),
                  );
                  return;
                }

                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActiveIndex((current) => Math.max(current - 1, 0));
                  return;
                }

                if (event.key === "Enter") {
                  event.preventDefault();
                  selectResult(results()[activeIndex()]);
                }

                if (event.key === "Escape") {
                  event.preventDefault();
                  setSearchOpen(false);
                }
              }}
            />
          </HStack>

          <VStack alignItems="stretch" gap="0" p="5px" maxH="252px" overflowY="auto" role="listbox">
            <Switch>
              <Match when={results().length > 0}>
                <For each={results()}>
                  {(result, index) => (
                    <ReparentResultButton
                      _active={{ transform: "scale(0.99)" }}
                      type="button"
                      role="option"
                      aria-selected={index() === activeIndex()}
                      display="block"
                      w="100%"
                      p="7px 8px"
                      border="1px solid"
                      borderColor={index() === activeIndex() ? "rgba(84, 90, 86, 0.38)" : "transparent"}
                      borderRadius="6px"
                      background={index() === activeIndex() ? "rgba(233, 235, 232, 0.52)" : "transparent"}
                      color="var(--spatial-map-copy)"
                      cursor={props.movePending ? "default" : "pointer"}
                      textAlign="left"
                      transition="background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease"
                      disabled={props.movePending}
                      _hover={{
                        borderColor: "rgba(84, 90, 86, 0.38)",
                        background: "rgba(233, 235, 232, 0.52)",
                        boxShadow: "inset 0 0 0 1px rgba(84, 90, 86, 0.08)",
                      }}
                      _focusVisible={{ outline: "2px solid rgba(84, 90, 86, 0.7)", outlineOffset: "2px" }}
                      onMouseEnter={() => setActiveIndex(index())}
                      onClick={() => selectResult(result)}
                    >
                      <HStack justifyContent="space-between" gap="2" minW="0">
                        <Box flex="1 1 auto" minW="0" overflow="hidden" fontWeight="760" lineHeight="1.2" textOverflow="ellipsis" whiteSpace="nowrap">
                          <HighlightedLabel
                            label={result.node.label}
                            query={query()}
                            fallbackStart={result.matchStart}
                          />
                        </Box>
                        <Badge as="span" variant="spatial" size="sm" flex="0 0 auto">
                          {result.node.type}
                        </Badge>
                        <Box as="span" flex="0 0 auto" color="var(--spatial-map-copy-dim)" fontSize="11px" fontWeight="760" lineHeight="1">
                          D{result.depth}
                        </Box>
                      </HStack>
                    </ReparentResultButton>
                  )}
                </For>
              </Match>
              <Match when={query().trim().length > 0}>
                <EmptyResult>No matching parent nodes</EmptyResult>
              </Match>
              <Match when>
                <EmptyResult>Type to search, or choose from the ordered nodes</EmptyResult>
              </Match>
            </Switch>
          </VStack>
        </Box>
      </Show>

      <VStack
        alignItems="stretch"
        gap="1"
        p="6px 8px"
        w="max-content"
        maxW="calc(100vw - 20px)"
        border="1px solid var(--spatial-map-panel-border)"
        borderRadius="6px"
        background="#fbfcfb"
        boxShadow="0 8px 24px rgba(24, 32, 24, 0.15)"
      >
        <HStack gap="1" alignItems="flex-start" minW="0">
          <Box flex="none">
            <Button
              variant="outline"
              size="2xs"
              minW="134px"
              justifyContent="flex-start"
              background={searchOpen() ? "rgba(233, 235, 232, 0.96)" : "transparent"}
              color="var(--spatial-map-copy-dim)"
              disabled={props.movePending}
              onClick={() => setSearchOpen((open) => !open)}
            >
              <SearchIcon size={13} aria-hidden="true" />
              Search nodes
            </Button>
          </Box>
          <Button
            colorPalette="gray"
            variant="plain"
            size="2xs"
            loading={props.movePending}
            onClick={() => props.onMove(null)}
          >
            Move to root
          </Button>
        </HStack>
        <Box color="var(--spatial-map-copy-dim)" fontSize="12px" lineHeight="1.25" textAlign="left" pl="2px">
          Click to choose new parent node.
        </Box>
      </VStack>
    </Box>
  );
}

function createReparentHierarchy(data: SpatialMapData) {
  const nodeIndexById = new Map(data.nodes.map((node, index) => [node.id, index]));
  const sortOrderByNodeId = new Map<string, number>();
  const childIdsByParentId = new Map<string, string[]>();

  for (const link of data.links) {
    if (!link.parentChild || !nodeIndexById.has(link.source) || !nodeIndexById.has(link.target)) {
      continue;
    }

    const childIds = childIdsByParentId.get(link.source) ?? [];
    childIds.push(link.target);
    childIdsByParentId.set(link.source, childIds);
  }

  for (const node of data.nodes) {
    sortOrderByNodeId.set(node.id, nodeIndexById.get(node.id) ?? 0);
  }

  for (const childIds of childIdsByParentId.values()) {
    childIds
      .sort((left, right) => (nodeIndexById.get(left) ?? 0) - (nodeIndexById.get(right) ?? 0))
      .forEach((childId, index) => sortOrderByNodeId.set(childId, index));
  }

  return {
    depthsByNodeId: calculateNodeDepths(data),
    sortOrderByNodeId,
  };
}

function compareNodes(
  left: MapNode,
  right: MapNode,
  hierarchy: ReturnType<typeof createReparentHierarchy>,
) {
  const depthDiff =
    (hierarchy.depthsByNodeId.get(left.id) ?? 0) -
    (hierarchy.depthsByNodeId.get(right.id) ?? 0);
  if (depthDiff !== 0) return depthDiff;

  const sortDiff =
    (hierarchy.sortOrderByNodeId.get(left.id) ?? 0) -
    (hierarchy.sortOrderByNodeId.get(right.id) ?? 0);
  if (sortDiff !== 0) return sortDiff;

  return left.label.localeCompare(right.label);
}

function searchReparentNodes(
  nodes: MapNode[],
  rawQuery: string,
  hierarchy: ReturnType<typeof createReparentHierarchy>,
): ReparentSearchResult[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) {
    return nodes.map((node, index) => ({
      node,
      depth: hierarchy.depthsByNodeId.get(node.id) ?? 0,
      sortOrder: hierarchy.sortOrderByNodeId.get(node.id) ?? index,
      matchStart: -1,
    }));
  }

  return nodes
    .map((node) => {
      const matchStart = node.label.toLowerCase().indexOf(query);
      if (matchStart < 0) {
        return null;
      }

      return {
        node,
        depth: hierarchy.depthsByNodeId.get(node.id) ?? 0,
        sortOrder: hierarchy.sortOrderByNodeId.get(node.id) ?? 0,
        matchStart,
      };
    })
    .filter((result): result is ReparentSearchResult => result !== null)
    .sort(
      (left, right) =>
        left.matchStart - right.matchStart ||
        left.depth - right.depth ||
        left.sortOrder - right.sortOrder ||
        left.node.label.localeCompare(right.node.label),
    );
}

function HighlightedLabel(props: {
  label: string;
  query: string;
  fallbackStart: number;
}) {
  const parts = createMemo(() => {
    const query = props.query.trim();
    const matchStart =
      query.length > 0
        ? props.label.toLowerCase().indexOf(query.toLowerCase())
        : props.fallbackStart;

    if (query.length === 0 || matchStart < 0) {
      return { before: props.label, match: "", after: "" };
    }

    return {
      before: props.label.slice(0, matchStart),
      match: props.label.slice(matchStart, matchStart + query.length),
      after: props.label.slice(matchStart + query.length),
    };
  });

  return (
    <>
      {parts().before}
      <Show when={parts().match}>
        {(match) => (
          <Box as="mark" p="0 2px" borderRadius="3px" background="rgba(250, 204, 21, 0.52)" color="#2f2a12">
            {match()}
          </Box>
        )}
      </Show>
      {parts().after}
    </>
  );
}

function EmptyResult(props: { children: string }) {
  return (
    <Box p="18px 10px" color="var(--spatial-map-copy-muted)" fontSize="12px" textAlign="center">
      {props.children}
    </Box>
  );
}
