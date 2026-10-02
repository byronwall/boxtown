import { ChevronRightIcon, MenuIcon } from "lucide-solid";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show, type JSX } from "solid-js";

import { Button } from "~/components/ui/button";
import { PanelPopover } from "~/components/ui/panel-popover";
import { Box, styled } from "styled-system/jsx";
import type { SpatialMapTree, SpatialMapTreeItem } from "./spatial-map-tree";

const TreeNavigationButton = styled("button");
const TreeNavigationBreadcrumbButton = styled("button");
const TreeNavigationBreadcrumbSpan = styled("span");

type TreeNavigationEntry = {
  item: SpatialMapTreeItem;
  childEntries: TreeNavigationEntry[];
  depth: number;
  path: string;
};

type TreeNavigationProps = {
  actions?: JSX.Element;
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
    <Box
      ref={navRef}
      class="spatial-map-tree-nav"
      aria-label="Tree navigation"
      position="sticky"
      top="0"
      zIndex="2"
      display="grid"
      gridTemplateColumns="max-content minmax(0, 1fr) max-content"
      alignItems="center"
      gap="6px"
      w="calc(100% + 16px)"
      minH="32px"
      m="0 -8px 0"
      p="3px max(12px, calc(((100% - min(100%, 86ch)) / 2) - 4px)) 3px max(12px, calc(((100% - min(100%, 86ch)) / 2) - 16px))"
      borderBottom="1px solid var(--spatial-map-panel-divider)"
      background="rgba(248, 250, 248, 0.98)"
    >
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
            variant="plain"
            size="2xs"
            px="0"
            color="var(--spatial-map-copy-dim)"
            aria-label="Open tree table of contents"
            title="Table of contents"
            aria-expanded={isTocOpen()}
            onClick={() => setIsTocOpen((open) => !open)}
          >
            <MenuIcon size={14} strokeWidth={2} aria-hidden="true" />
          </Button>
        }
      >
        <Box as="nav" display="grid" gap="2px" maxH="min(56vh, 26rem)" overflow="auto" p="2px" aria-label="Tree table of contents">
          <For each={entries()}>
            {(entry) => <TocEntry entry={entry} activePath={activePath()} onNavigate={navigate} />}
          </For>
        </Box>
      </PanelPopover>

      <Box
        as="nav"
        display="flex"
        minW="0"
        alignItems="center"
        gap="2px"
        overflowX="auto"
        scrollbarWidth="thin"
        aria-label="Current tree path"
      >
        <Show
          when={activeTrail().length > 0}
          fallback={<BreadcrumbItem as="span">Start</BreadcrumbItem>}
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
                <BreadcrumbItem
                  as="button"
                  type="button"
                  onClick={() => navigate(entry.path)}
                >
                  {entry.item.node.label}
                </BreadcrumbItem>
              </>
            )}
          </For>
        </Show>
      </Box>
      <Box display="flex" alignItems="center" gap="2px">
        {props.actions}
      </Box>
    </Box>
  );
}

function TocEntry(props: {
  entry: TreeNavigationEntry;
  activePath: string;
  onNavigate: (path: string) => void;
}) {
  // The heading the tree is scrolled to, as tracked for the breadcrumb.
  const isCurrent = () => props.entry.path === props.activePath;

  return (
    <Box display="grid" gap="2px" minW="0">
      <TreeNavigationButton
        type="button"
        display="grid"
        gridTemplateColumns="minmax(0, 1fr) max-content"
        alignItems="baseline"
        gap="8px"
        minW="0"
        minH="24px"
        p="2px 8px 2px calc(8px + (var(--spatial-map-tree-toc-depth) * 14px))"
        border="0"
        borderRadius="4px"
        background={isCurrent() ? "rgba(34, 41, 36, 0.1)" : "transparent"}
        color="var(--spatial-map-copy)"
        fontFamily="inherit"
        textAlign="left"
        cursor="pointer"
        _hover={{ background: isCurrent() ? "rgba(34, 41, 36, 0.12)" : "rgba(34, 41, 36, 0.06)", outline: "none" }}
        _focusVisible={{ boxShadow: "inset 0 0 0 1px rgba(34, 41, 36, 0.5)", outline: "none" }}
        aria-current={isCurrent() ? "location" : undefined}
        ref={(element) => {
          // Bring the current heading into view when the contents open.
          if (isCurrent()) queueMicrotask(() => element.scrollIntoView({ block: "nearest" }));
        }}
        style={{ "--spatial-map-tree-toc-depth": String(props.entry.depth) }}
        onClick={() => props.onNavigate(props.entry.path)}
      >
        <Box
          as="span"
          minW="0"
          overflow="hidden"
          color={isCurrent() ? "#141816" : "var(--spatial-map-copy)"}
          fontSize="12px"
          lineHeight="1.3"
          fontWeight={isCurrent() || props.entry.depth === 0 ? "700" : "500"}
          textOverflow="ellipsis"
          whiteSpace="nowrap"
        >
          {props.entry.item.node.label}
        </Box>
        <Box as="span" color="var(--spatial-map-copy-dim)" fontSize="11px">
          {props.entry.item.node.type}
        </Box>
      </TreeNavigationButton>
      <Show when={props.entry.childEntries.length > 0}>
        <Box display="grid" gap="2px" minW="0">
          <For each={props.entry.childEntries}>
            {(entry) => <TocEntry entry={entry} activePath={props.activePath} onNavigate={props.onNavigate} />}
          </For>
        </Box>
      </Show>
    </Box>
  );
}

function BreadcrumbItem(props: {
  as: "button" | "span";
  children: string;
  onClick?: () => void;
  type?: "button";
}) {
  const commonProps = {
    display: "inline-flex" as const,
    alignItems: "center" as const,
    maxW: "16rem",
    minH: "24px",
    p: "0 6px",
    border: "0",
    borderRadius: "4px",
    background: "transparent",
    fontFamily: "inherit",
    fontSize: "11px",
    lineHeight: "1",
    fontWeight: "500",
    whiteSpace: "nowrap" as const,
  };

  return (
    <Show
      when={props.as === "span"}
      fallback={
        <TreeNavigationBreadcrumbButton
          {...commonProps}
          type={props.type}
          color="var(--spatial-map-copy)"
          overflow="hidden"
          textOverflow="ellipsis"
          cursor="pointer"
          _hover={{ background: "rgba(34, 41, 36, 0.06)", outline: "none" }}
          _focusVisible={{ background: "rgba(34, 41, 36, 0.06)", outline: "none" }}
          onClick={props.onClick}
        >
          {props.children}
        </TreeNavigationBreadcrumbButton>
      }
    >
      <TreeNavigationBreadcrumbSpan
        {...commonProps}
        color="var(--spatial-map-copy-dim)"
      >
        {props.children}
      </TreeNavigationBreadcrumbSpan>
    </Show>
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
