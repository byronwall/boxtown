import { ChevronRightIcon, MenuIcon } from "lucide-solid";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";

import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { PanelPopover } from "~/components/ui/panel-popover";
import type { SpatialMapTree, SpatialMapTreeItem } from "./spatial-map-tree";

type TreeNavigationEntry = {
  item: SpatialMapTreeItem;
  childEntries: TreeNavigationEntry[];
  depth: number;
  path: string;
};

type TreeNavigationProps = {
  tree: SpatialMapTree;
  getScrollRoot: () => HTMLElement | undefined;
  onNavigate: (path: string) => void;
};

export function SpatialMapTreeNavigation(props: TreeNavigationProps) {
  const [isTocOpen, setIsTocOpen] = createSignal(false);
  const [activePath, setActivePath] = createSignal("");
  let navRef: HTMLDivElement | undefined;

  const entries = createMemo(() => buildNavigationEntries(props.tree));
  const entryByPath = createMemo(() => {
    const entriesByPath = new Map<string, TreeNavigationEntry>();
    for (const entry of flattenEntries(entries())) {
      entriesByPath.set(entry.path, entry);
    }
    return entriesByPath;
  });
  const activeTrail = createMemo(() =>
    activePath()
      .split("/")
      .filter(Boolean)
      .map((_, index, parts) => parts.slice(0, index + 1).join("/"))
      .map((path) => entryByPath().get(path))
      .filter((entry): entry is TreeNavigationEntry => Boolean(entry)),
  );
  let updateActivePath: (() => void) | undefined;

  onMount(() => {
    const root = props.getScrollRoot();
    if (!root) {
      return;
    }

    const updateStickyOffset = () => {
      if (!navRef) {
        return;
      }

      const navStyles = window.getComputedStyle(navRef);
      const navMarginBottom = Number.parseFloat(navStyles.marginBottom) || 0;
      root.style.setProperty(
        "--spatial-map-tree-sticky-offset",
        `${Math.ceil(navRef.offsetHeight + navMarginBottom)}px`,
      );
    };

    updateStickyOffset();

    updateActivePath = () => {
      const rows = Array.from(
        root.querySelectorAll<HTMLElement>("[data-spatial-map-tree-path]"),
      );
      if (rows.length === 0) {
        setActivePath("");
        return;
      }

      const rootTop = root.getBoundingClientRect().top;
      const stickyOffset =
        Number.parseFloat(
          window
            .getComputedStyle(root)
            .getPropertyValue("--spatial-map-tree-sticky-offset"),
        ) || 58;
      const activationOffset =
        Number.parseFloat(window.getComputedStyle(rows[0]).scrollMarginTop) ||
        stickyOffset;
      const activationTolerance = 2;
      let activeRow = rows[0];

      for (const row of rows) {
        if (
          row.getBoundingClientRect().top - rootTop <=
          activationOffset + activationTolerance
        ) {
          activeRow = row;
        } else {
          break;
        }
      }

      setActivePath(activeRow.dataset.spatialMapTreePath ?? "");
    };

    const handleActivePathUpdate = updateActivePath;
    const handleResize = () => {
      updateStickyOffset();
      handleActivePathUpdate();
    };
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(handleResize);

    handleActivePathUpdate();
    if (navRef) {
      resizeObserver?.observe(navRef);
    }
    root.addEventListener("scroll", handleActivePathUpdate, { passive: true });
    window.addEventListener("resize", handleResize);

    onCleanup(() => {
      resizeObserver?.disconnect();
      root.removeEventListener("scroll", handleActivePathUpdate);
      window.removeEventListener("resize", handleResize);
    });
  });

  createEffect(() => {
    if (!entryByPath().has(activePath())) {
      setActivePath(entries()[0]?.path ?? "");
    }
    queueMicrotask(() => updateActivePath?.());
  });

  const navigate = (path: string) => {
    props.onNavigate(path);
    setIsTocOpen(false);
  };

  return (
    <div ref={navRef} class="spatial-map-tree-nav" aria-label="Tree navigation">
      <PanelPopover
        open={isTocOpen()}
        onClose={() => setIsTocOpen(false)}
        portalled={false}
        placement="bottom-start"
        offset={6}
        width="min(28rem, calc(100vw - 48px))"
        title="Table of contents"
        description="Jump to a visible tree item."
        anchor={
          <Button
            class="spatial-map-tree-nav-menu-button"
            aria-label="Open tree table of contents"
            aria-expanded={isTocOpen()}
            onClick={() => setIsTocOpen((open) => !open)}
          >
            <MenuIcon size={16} strokeWidth={2} aria-hidden="true" />
          </Button>
        }
      >
        <nav class="spatial-map-tree-toc" aria-label="Tree table of contents">
          <For each={entries()}>
            {(entry) => <TocEntry entry={entry} onNavigate={navigate} />}
          </For>
        </nav>
      </PanelPopover>

      <nav class="spatial-map-tree-breadcrumb" aria-label="Current tree path">
        <Show
          when={activeTrail().length > 0}
          fallback={<span class="spatial-map-tree-breadcrumb-empty">Start</span>}
        >
          <For each={activeTrail()}>
            {(entry, index) => (
              <>
                <Show when={index() > 0}>
                  <ChevronRightIcon
                    class="spatial-map-tree-breadcrumb-separator"
                    size={14}
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                </Show>
                <button
                  type="button"
                  class="spatial-map-tree-breadcrumb-item"
                  onClick={() => navigate(entry.path)}
                >
                  {entry.item.node.label}
                </button>
              </>
            )}
          </For>
        </Show>
      </nav>
    </div>
  );
}

function TocEntry(props: {
  entry: TreeNavigationEntry;
  onNavigate: (path: string) => void;
}) {
  return (
    <div class="spatial-map-tree-toc-entry">
      <button
        type="button"
        class="spatial-map-tree-toc-item"
        style={{ "--spatial-map-tree-toc-depth": String(props.entry.depth) }}
        onClick={() => props.onNavigate(props.entry.path)}
      >
        <Badge as="span" variant="spatial" size="2xs">
          {props.entry.item.node.type}
        </Badge>
        <span class="spatial-map-tree-toc-label">
          {props.entry.item.node.label}
        </span>
      </button>
      <Show when={props.entry.childEntries.length > 0}>
        <div class="spatial-map-tree-toc-children">
          <For each={props.entry.childEntries}>
            {(entry) => <TocEntry entry={entry} onNavigate={props.onNavigate} />}
          </For>
        </div>
      </Show>
    </div>
  );
}

function buildNavigationEntries(tree: SpatialMapTree) {
  const visit = (
    nodeId: string,
    depth: number,
    path: string,
    ancestry: Set<string>,
  ): TreeNavigationEntry | undefined => {
    const item = tree.items.get(nodeId);
    if (!item) {
      return undefined;
    }

    const childEntries = item.childNodeIds
      .filter((childNodeId) => !ancestry.has(childNodeId))
      .map((childNodeId) =>
        visit(
          childNodeId,
          depth + 1,
          `${path}/${childNodeId}`,
          new Set([...ancestry, childNodeId]),
        ),
      )
      .filter((entry): entry is TreeNavigationEntry => Boolean(entry));

    return { item, childEntries, depth, path };
  };

  return tree.roots
    .map((nodeId) => visit(nodeId, 0, nodeId, new Set([nodeId])))
    .filter((entry): entry is TreeNavigationEntry => Boolean(entry));
}

function flattenEntries(entries: TreeNavigationEntry[]) {
  const flattened: TreeNavigationEntry[] = [];
  const visit = (entry: TreeNavigationEntry) => {
    flattened.push(entry);
    for (const child of entry.childEntries) {
      visit(child);
    }
  };
  for (const entry of entries) {
    visit(entry);
  }
  return flattened;
}
