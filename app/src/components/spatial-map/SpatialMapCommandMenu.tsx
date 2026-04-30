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
import { Box, HStack, VStack } from "styled-system/jsx";
import { Input } from "~/components/ui/input";
import { Kbd } from "~/components/ui/kbd";
import { SimpleDialog } from "~/components/ui/simple-dialog";
import type { MapNode } from "~/lib/spatial-map/types";

import { isEditableTarget } from "./spatial-map-dom";
import { useSpatialMap } from "./SpatialMapContext";

const RESULT_LIMIT = 12;

interface SearchResult {
  node: MapNode;
  score: number;
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

  const nodes = createMemo(() =>
    [...controller.sourceNodesById().values()].sort((a, b) =>
      a.label.localeCompare(b.label),
    ),
  );
  const results = createMemo(() =>
    searchNodes(nodes(), query()).slice(0, RESULT_LIMIT),
  );

  createEffect(() => {
    if (activeIndex() >= results().length) {
      setActiveIndex(Math.max(results().length - 1, 0));
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

  return (
    <SimpleDialog
      open={open()}
      onOpenChange={setOpen}
      showClose={false}
      maxW="min(600px, calc(100dvw - 32px))"
      contentClass="spatial-map-command-menu"
      initialFocusEl={() => inputRef ?? null}
    >
      <VStack alignItems="stretch" gap="0" class="spatial-map-command-menu-body">
        <HStack gap="2" class="spatial-map-command-search-row">
          <SearchIcon size={17} aria-hidden="true" />
          <Input
            ref={inputRef}
            class="spatial-map-command-input"
            aria-label="Search nodes"
            placeholder="Search nodes..."
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
            }}
          />
          <Kbd>⌘K</Kbd>
        </HStack>

        <Box class="spatial-map-command-results" role="listbox">
          <Switch>
            <Match when={results().length > 0}>
              <For each={results()}>
                {(result, index) => (
                  <button
                    type="button"
                    class={`spatial-map-command-result${index() === activeIndex() ? " is-active" : ""}`}
                    role="option"
                    aria-selected={index() === activeIndex()}
                    onMouseEnter={() => setActiveIndex(index())}
                    onClick={() => selectResult(result)}
                  >
                    <HStack justifyContent="space-between" gap="2" class="spatial-map-command-result-row">
                      <Box class="spatial-map-command-result-title">
                        <HighlightedText
                          text={result.node.label}
                          query={query()}
                          fallbackStart={result.fieldLabel === "Title" ? result.matchStart : -1}
                        />
                      </Box>
                      <Show when={result.fieldLabel !== "Title"}>
                        <Box class="spatial-map-command-result-match">
                          <span>{result.fieldLabel}</span>
                          <Box as="span" class="spatial-map-command-result-match-text">
                            <HighlightedText
                              text={result.matchedText}
                              query={query()}
                              fallbackStart={result.matchStart}
                            />
                          </Box>
                        </Box>
                      </Show>
                      <Box as="span" class="spatial-map-command-result-type">
                        {result.node.type}
                      </Box>
                    </HStack>
                  </button>
                )}
              </For>
            </Match>
            <Match when={query().trim().length > 0}>
              <Box class="spatial-map-command-empty">No matching nodes</Box>
            </Match>
            <Match when>
              <Box class="spatial-map-command-empty">Type to search all nodes</Box>
            </Match>
          </Switch>
        </Box>
      </VStack>
    </SimpleDialog>
  );
}

function searchNodes(nodes: MapNode[], rawQuery: string): SearchResult[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) {
    return nodes.slice(0, RESULT_LIMIT).map((node, index) => ({
      node,
      score: 100 - index,
      fieldLabel: "Title",
      matchedText: node.label,
      matchStart: -1,
    }));
  }

  return nodes
    .map((node) => matchNode(node, query))
    .filter((result): result is SearchResult => result !== null)
    .sort((a, b) => b.score - a.score || a.node.label.localeCompare(b.node.label));
}

function matchNode(node: MapNode, query: string): SearchResult | null {
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

    const score = field.weight + (matchStart === 0 ? 20 : 0);
    const result = {
      node,
      score,
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
        {(match) => <mark class="spatial-map-command-highlight">{match()}</mark>}
      </Show>
      {parts().after}
    </>
  );
}
