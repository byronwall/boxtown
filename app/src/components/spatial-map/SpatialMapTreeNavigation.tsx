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
      gridTemplateColumns="max-content minmax(0, 1fr)"
      alignItems="center"
      gap="6px"
      w="calc(100% + 16px)"
      minH="48px"
      m="0 -8px 8px"
      p="8px 12px 8px max(12px, calc(((100% - min(100%, 86ch)) / 2) - 16px))"
      border="1px solid rgba(44, 52, 46, 0.28)"
      borderTop="0"
      borderRight="0"
      borderLeft="0"
      borderRadius="0"
      background="rgba(246, 248, 244, 0.96)"
      boxShadow="inset 0 1px 0 rgba(255, 255, 255, 0.5), 0 8px 18px rgba(29, 33, 28, 0.06)"
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
            w="30px"
            minW="30px"
            h="30px"
            minH="30px"
            p="0"
            borderColor="rgba(44, 52, 46, 0.34)"
            borderRadius="4px"
            background="rgba(252, 253, 252, 0.9)"
            color="#202622"
            aria-label="Open tree table of contents"
            aria-expanded={isTocOpen()}
            onClick={() => setIsTocOpen((open) => !open)}
          >
            <MenuIcon size={16} strokeWidth={2} aria-hidden="true" />
          </Button>
        }
      >
        <Box as="nav" display="grid" gap="2px" maxH="min(56vh, 26rem)" overflow="auto" p="2px" aria-label="Tree table of contents">
          <For each={entries()}>
            {(entry) => <TocEntry entry={entry} onNavigate={navigate} />}
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
    </Box>
  );
}

function TocEntry(props: {
  entry: TreeNavigationEntry;
  onNavigate: (path: string) => void;
}) {
  return (
    <Box display="grid" gap="2px" minW="0">
      <TreeNavigationButton
        type="button"
        display="grid"
        gridTemplateColumns="max-content minmax(0, 1fr)"
        alignItems="center"
        gap="8px"
        minW="0"
        minH="30px"
        p="4px 8px 4px calc(8px + (var(--spatial-map-tree-toc-depth) * 14px))"
        border="0"
        borderRadius="4px"
        background="transparent"
        color="#202622"
        fontFamily="inherit"
        textAlign="left"
        cursor="pointer"
        _hover={{ background: "rgba(229, 239, 229, 0.84)", outline: "none" }}
        _focusVisible={{ background: "rgba(229, 239, 229, 0.84)", outline: "none" }}
        style={{ "--spatial-map-tree-toc-depth": String(props.entry.depth) }}
        onClick={() => props.onNavigate(props.entry.path)}
      >
        <Badge as="span" variant="spatial" size="2xs">
          {props.entry.item.node.type}
        </Badge>
        <Box
          as="span"
          minW="0"
          overflow="hidden"
          color="#202622"
          fontSize="12px"
          lineHeight="1.2"
          fontWeight="700"
          textOverflow="ellipsis"
          whiteSpace="nowrap"
        >
          {props.entry.item.node.label}
        </Box>
      </TreeNavigationButton>
      <Show when={props.entry.childEntries.length > 0}>
        <Box display="grid" gap="2px" minW="0">
          <For each={props.entry.childEntries}>
            {(entry) => <TocEntry entry={entry} onNavigate={props.onNavigate} />}
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
    minH: "28px",
    p: "0 8px",
    border: "0",
    borderRadius: "4px",
    background: "transparent",
    fontFamily: "inherit",
    fontSize: "11px",
    lineHeight: "1",
    fontWeight: "700",
    letterSpacing: "0.02em",
    whiteSpace: "nowrap" as const,
  };

  return (
    <Show
      when={props.as === "span"}
      fallback={
        <TreeNavigationBreadcrumbButton
          {...commonProps}
          type={props.type}
          color="#202622"
          overflow="hidden"
          textOverflow="ellipsis"
          cursor="pointer"
          _hover={{ background: "rgba(229, 239, 229, 0.84)", outline: "none" }}
          _focusVisible={{ background: "rgba(229, 239, 229, 0.84)", outline: "none" }}
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
