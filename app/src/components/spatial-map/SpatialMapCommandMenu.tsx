import { SearchIcon } from "lucide-solid";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Match,
  onCleanup,
  onMount,
  Show,
  Switch,
} from "solid-js";
import { css } from "styled-system/css";
import { Box, HStack, VStack, styled } from "styled-system/jsx";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Kbd } from "~/components/ui/kbd";
import { SimpleDialog } from "~/components/ui/simple-dialog";
import { calculateNodeDepths } from "~/lib/spatial-map/depth";
import type { MapNode, SpatialMapData } from "~/lib/spatial-map/types";

import { isEditableTarget } from "./spatial-map-dom";
import {
  CommandProjectRow,
  CommandSectionLabel,
  useCommandMenuProjects,
} from "./SpatialMapCommandProjects";
import { useSpatialMap } from "./SpatialMapContext";

const RESULT_LIMIT = 12;

const CommandResultButton = styled("button");

// SimpleDialog owns the actual content slot, so command palette chrome uses a
// component-local Panda class while rendered rows use direct style props.
const commandMenuDialogClass = css({
  w: "min(600px, calc(100dvw - 32px)) !important",
  maxW: "min(600px, calc(100dvw - 32px)) !important",
  border: "1px solid rgba(96, 101, 95, 0.62) !important",
  borderRadius: "10px !important",
  background: "linear-gradient(90deg, rgba(35, 42, 37, 0.035) 1px, transparent 1px), linear-gradient(rgba(35, 42, 37, 0.035) 1px, transparent 1px), rgba(252, 253, 252, 0.96) !important",
  backgroundSize: "40px 40px, 40px 40px, auto !important",
  boxShadow: "0 28px 70px rgba(29, 33, 28, 0.22), 0 0 0 1px rgba(255, 255, 255, 0.64), inset 0 1px 0 rgba(255, 255, 255, 0.88) !important",
  "& .dialog__body": {
    alignItems: "stretch",
    p: "0",
  },
});

interface SearchResult {
  node: MapNode;
  score: number;
  depth: number;
  sortOrder: number;
  fieldLabel: string;
  matchedText: string;
  matchStart: number;
}

export function SpatialMapCommandMenu() {
  const controller = useSpatialMap();
  const [open, setOpen] = createSignal(false);
  const [query, setQuery] = createSignal("");
  const [activeIndex, setActiveIndex] = createSignal(0);
  let inputRef: HTMLInputElement | undefined;

  const hierarchy = createMemo(() => createSearchHierarchy(controller.sourceData()));
  const nodes = createMemo(() =>
    [...controller.sourceNodesById().values()].sort((a, b) =>
      compareNodesByHierarchy(a, b, hierarchy()),
    ),
  );
  const results = createMemo(() =>
    searchNodes(nodes(), query(), hierarchy()).slice(0, RESULT_LIMIT),
  );
  // Project rows follow node rows and share one keyboard index.
  const projects = useCommandMenuProjects(open, query);
  const itemCount = () => results().length + projects().length;

  createEffect(() => {
    if (activeIndex() >= itemCount()) {
      setActiveIndex(Math.max(itemCount() - 1, 0));
    }
  });

  createEffect(() => {
    if (!open()) {
      return;
    }

    setActiveIndex(0);
    queueMicrotask(() => inputRef?.focus());
  });

  onMount(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k" || (!event.metaKey && !event.ctrlKey)) {
        return;
      }

      event.preventDefault();
      if (!open() && isEditableTarget(event.target)) {
        inputRef?.focus();
      }
      setOpen((current) => !current);
    };

    window.addEventListener("keydown", onKeyDown);
    onCleanup(() => window.removeEventListener("keydown", onKeyDown));
  });

  const closeMenu = () => {
    setOpen(false);
    setQuery("");
  };

  const selectResult = (result: SearchResult | undefined) => {
    if (!result) {
      return;
    }

    controller.setViewMode("canvas");
    controller.isolateNode(result.node.id);
    closeMenu();
  };

  // Full navigation: the project page keeps canvas state per mounted project,
  // so a client-side param change would carry the old project's view over.
  const openProject = (projectId: string | undefined) => {
    if (!projectId) {
      return;
    }

    closeMenu();
    window.location.assign(`/projects/${encodeURIComponent(projectId)}`);
  };

  const selectActiveItem = () => {
    const index = activeIndex();
    if (index < results().length) {
      selectResult(results()[index]);
      return;
    }

    openProject(projects()[index - results().length]?.id);
  };

  return (
    <SimpleDialog
      open={open()}
      onOpenChange={setOpen}
      showClose={false}
      maxW="min(600px, calc(100dvw - 32px))"
      contentClass={commandMenuDialogClass}
      initialFocusEl={() => inputRef ?? null}
    >
      <VStack alignItems="stretch" gap="0" w="100%" minW="0">
        <HStack
          gap="2"
          minH="54px"
          p="9px 12px"
          borderBottom="1px solid rgba(96, 101, 95, 0.28)"
          background="rgba(248, 250, 248, 0.9)"
          color="var(--spatial-map-copy-dim)"
        >
          <SearchIcon size={17} aria-hidden="true" />
          <Input
            ref={inputRef}
            variant="spatial"
            size="sm"
            border="0"
            bg="transparent"
            boxShadow="none"
            fontSize="0.95rem"
            fontWeight="650"
            aria-label="Search nodes and projects"
            placeholder="Search nodes or switch project..."
            value={query()}
            onInput={(event) => {
              setQuery(event.currentTarget.value);
              setActiveIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((current) =>
                  Math.min(current + 1, Math.max(itemCount() - 1, 0)),
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
                selectActiveItem();
              }
            }}
          />
          <Kbd>⌘K</Kbd>
        </HStack>

        <Box w="100%" maxH="min(440px, 58vh)" p="5px" overflowY="auto" role="listbox">
          <Switch>
            <Match when={results().length > 0}>
              <For each={results()}>
                {(result, index) => (
                  <CommandResultButton
                    type="button"
                    role="option"
                    aria-selected={index() === activeIndex()}
                    display="block"
                    w="100%"
                    p="8px 10px"
                    border="1px solid"
                    borderColor={index() === activeIndex() ? "rgba(45, 111, 72, 0.38)" : "transparent"}
                    borderRadius="6px"
                    background={index() === activeIndex() ? "rgba(229, 239, 229, 0.52)" : "transparent"}
                    color="var(--spatial-map-copy)"
                    cursor="pointer"
                    textAlign="left"
                    transition="background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease"
                    _hover={{
                      borderColor: "rgba(45, 111, 72, 0.38)",
                      background: "rgba(229, 239, 229, 0.52)",
                      boxShadow: "inset 0 0 0 1px rgba(45, 111, 72, 0.08)",
                    }}
                    _focusVisible={{ outline: "2px solid rgba(45, 111, 72, 0.7)", outlineOffset: "2px" }}
                    onMouseEnter={() => setActiveIndex(index())}
                    onClick={() => selectResult(result)}
                  >
                    <HStack justifyContent="space-between" gap="2" minW="0">
                      <Box flex="1 1 auto" minW="0" overflow="hidden" fontWeight="760" lineHeight="1.25" textOverflow="ellipsis" whiteSpace="nowrap">
                        <HighlightedText
                          text={result.node.label}
                          query={query()}
                          fallbackStart={result.fieldLabel === "Title" ? result.matchStart : -1}
                        />
                      </Box>
                      <Show when={result.fieldLabel !== "Title"}>
                        <Box display="flex" flex="2 1 180px" minW="0" gap="8px" color="var(--spatial-map-copy-muted)" fontSize="12px" lineHeight="1.25" overflow="hidden" whiteSpace="nowrap">
                          <Box as="span" flex="0 0 auto" color="var(--spatial-map-copy-dim)" fontWeight="700">{result.fieldLabel}</Box>
                          <Box as="span" minW="0" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
                            <HighlightedText
                              text={result.matchedText}
                              query={query()}
                              fallbackStart={result.matchStart}
                            />
                          </Box>
                        </Box>
                      </Show>
                      <Badge
                        as="span"
                        variant="spatial"
                        size="sm"
                        flex="0 0 auto"
                      >
                        {result.node.type}
                      </Badge>
                      <Box
                        as="span"
                        flex="0 0 auto"
                        color="var(--spatial-map-copy-dim)"
                        fontSize="11px"
                        fontWeight="760"
                        lineHeight="1"
                        whiteSpace="nowrap"
                      >
                        D{result.depth} / #{result.sortOrder + 1}
                      </Box>
                    </HStack>
                  </CommandResultButton>
                )}
              </For>
            </Match>
            <Match when={query().trim().length > 0 && projects().length === 0}>
              <CommandEmpty>No matching nodes or projects</CommandEmpty>
            </Match>
            <Match when={query().trim().length === 0}>
              <CommandEmpty>Type to search all nodes</CommandEmpty>
            </Match>
          </Switch>
          <Show when={projects().length > 0}>
            <CommandSectionLabel>
              {query().trim() ? "Projects" : "Switch project"}
            </CommandSectionLabel>
            <For each={projects()}>
              {(project, index) => (
                <CommandProjectRow
                  project={project}
                  active={results().length + index() === activeIndex()}
                  onHover={() => setActiveIndex(results().length + index())}
                  onSelect={() => openProject(project.id)}
                />
              )}
            </For>
          </Show>
        </Box>
      </VStack>
    </SimpleDialog>
  );
}

interface SearchHierarchy {
  depthsByNodeId: Map<string, number>;
  sortOrderByNodeId: Map<string, number>;
}

function createSearchHierarchy(data: SpatialMapData): SearchHierarchy {
  const nodeIndexById = new Map(data.nodes.map((node, index) => [node.id, index]));
  const sortOrderByNodeId = new Map<string, number>();
  const childIdsByParentId = new Map<string, string[]>();

  for (const link of data.links) {
    if (
      !link.parentChild ||
      !nodeIndexById.has(link.source) ||
      !nodeIndexById.has(link.target)
    ) {
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
      .sort(
        (left, right) =>
          (nodeIndexById.get(left) ?? 0) - (nodeIndexById.get(right) ?? 0),
      )
      .forEach((childId, index) => sortOrderByNodeId.set(childId, index));
  }

  return {
    depthsByNodeId: calculateNodeDepths(data),
    sortOrderByNodeId,
  };
}

function compareNodesByHierarchy(
  left: MapNode,
  right: MapNode,
  hierarchy: SearchHierarchy,
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

function searchNodes(
  nodes: MapNode[],
  rawQuery: string,
  hierarchy: SearchHierarchy,
): SearchResult[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) {
    return nodes.slice(0, RESULT_LIMIT).map((node, index) => ({
      node,
      score: 100 - index,
      depth: hierarchy.depthsByNodeId.get(node.id) ?? 0,
      sortOrder: hierarchy.sortOrderByNodeId.get(node.id) ?? index,
      fieldLabel: "Title",
      matchedText: node.label,
      matchStart: -1,
    }));
  }

  return nodes
    .map((node) => matchNode(node, query, hierarchy))
    .filter((result): result is SearchResult => result !== null)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.depth - b.depth ||
        a.sortOrder - b.sortOrder ||
        a.node.label.localeCompare(b.node.label),
    );
}

function matchNode(
  node: MapNode,
  query: string,
  hierarchy: SearchHierarchy,
): SearchResult | null {
  const depth = hierarchy.depthsByNodeId.get(node.id) ?? 0;
  const sortOrder = hierarchy.sortOrderByNodeId.get(node.id) ?? 0;
  const fields = [
    { label: "Title", text: node.label, weight: 70 },
    { label: "ID", text: node.id, weight: 46 },
    { label: "Type", text: node.type, weight: 34 },
    { label: "Status", text: node.status, weight: 28 },
    ...Object.entries(node.metadata).map(([key, value]) => ({
      label: key,
      text: value,
      weight: 20,
    })),
    { label: "Context", text: node.context, weight: 12 },
    { label: "Raw context", text: node.rawContext, weight: 10 },
  ];

  let best: SearchResult | null = null;
  for (const field of fields) {
    const matchStart = field.text.toLowerCase().indexOf(query);
    if (matchStart < 0) {
      continue;
    }

    const score =
      field.weight +
      (matchStart === 0 ? 20 : 0) +
      Math.max(0, 8 - depth * 2) +
      Math.max(0, 4 - sortOrder * 0.25);
    const result = {
      node,
      score,
      depth,
      sortOrder,
      fieldLabel: field.label,
      matchedText: createMatchSnippet(field.text, matchStart, query.length),
      matchStart: Math.min(matchStart, 24),
    };

    if (!best || result.score > best.score) {
      best = result;
    }
  }

  return best;
}

function createMatchSnippet(text: string, matchStart: number, matchLength: number) {
  if (text.length <= 84) {
    return text;
  }

  const start = Math.max(0, matchStart - 24);
  const end = Math.min(text.length, matchStart + matchLength + 48);
  return `${start > 0 ? "..." : ""}${text.slice(start, end)}${end < text.length ? "..." : ""}`;
}

function HighlightedText(props: {
  text: string;
  query: string;
  fallbackStart: number;
}) {
  const parts = createMemo(() => {
    const query = props.query.trim();
    const matchStart =
      query.length > 0
        ? props.text.toLowerCase().indexOf(query.toLowerCase())
        : props.fallbackStart;

    if (query.length === 0 || matchStart < 0) {
      return { before: props.text, match: "", after: "" };
    }

    return {
      before: props.text.slice(0, matchStart),
      match: props.text.slice(matchStart, matchStart + query.length),
      after: props.text.slice(matchStart + query.length),
    };
  });

  return (
    <>
      {parts().before}
      <Show when={parts().match}>
        {(match) => (
          <Box
            as="mark"
            p="0 2px"
            borderRadius="3px"
            background="rgba(250, 204, 21, 0.56)"
            color="#2f2a12"
            boxShadow="inset 0 -1px 0 rgba(154, 117, 0, 0.32)"
          >
            {match()}
          </Box>
        )}
      </Show>
      {parts().after}
    </>
  );
}

function CommandEmpty(props: { children: string }) {
  return (
    <Box p="28px 12px" color="var(--spatial-map-copy-muted)" fontSize="13px" textAlign="center">
      {props.children}
    </Box>
  );
}
