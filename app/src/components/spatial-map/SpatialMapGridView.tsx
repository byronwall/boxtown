import { useAction } from "@solidjs/router";
import { ChevronDown, ChevronRight, FileText, Trash2 } from "lucide-solid";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  type JSX,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { css } from "styled-system/css";
import { Box, HStack, styled } from "styled-system/jsx";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { EditInPlace } from "~/components/ui/edit-in-place";
import { Input } from "~/components/ui/input";
import { SimpleDialog } from "~/components/ui/simple-dialog";
import { toaster } from "~/components/ui/toast";
import { Tooltip } from "~/components/ui/tooltip";
import {
  deleteProjectLink,
  updateProjectNodeMetadata,
  updateProjectNodeStatus,
  updateProjectNodeTitle,
  updateProjectNodeType,
} from "~/lib/projects/data";
import {
  appendClientMutationId,
  createClientMutationId,
  updateProjectNode,
} from "~/lib/projects/optimistic";
import type {
  ProjectNodeMetadataField,
  ProjectRecord,
} from "~/lib/projects/types";
import {
  getMapNodeStatusGlyph,
  getMapNodeStatusLabel,
} from "~/lib/spatial-map/node-status";
import type { MapLink, MapNode, MapNodeStatus } from "~/lib/spatial-map/types";
import { SpatialMapArchiveImplementedButton } from "./SpatialMapArchiveImplementedButton";
import { SpatialMapDeleteNodeControl } from "./SpatialMapDeleteNodeControl";
import { useSpatialMap } from "./SpatialMapContext";
import { SpatialMapGridBulkBar } from "./SpatialMapGridBulkBar";
import { SpatialMapNodePriorityMenu } from "./SpatialMapNodePriorityMenu";
import { useSpatialMapImages } from "./SpatialMapImages";

type SpatialMapGridMode = "nodes" | "links";

interface NodeGridRow {
  node: MapNode;
  depth: number;
  ancestorHasNextSibling: boolean[];
  hasChildren: boolean;
  isLastSibling: boolean;
  parentNodeId: string | null;
  pathKey: string;
}

const DEFAULT_NODE_COLUMN_WIDTHS = {
  select: 36,
  name: 340,
  type: 132,
  status: 152,
  priority: 132,
  metadata: 240,
  image: 120,
  actions: 92,
};

const MIN_NODE_COLUMN_WIDTHS = {
  select: 36,
  name: 220,
  type: 104,
  status: 116,
  priority: 104,
  metadata: 150,
  image: 92,
  actions: 76,
};

// Native tables and tree connector rails need descendant and pseudo-element
// selectors; the surrounding panels still use props below.
const gridStructureClass = css({
  "& .spatial-map-grid-table": {
    w: "100%",
    minW: "760px",
    borderCollapse: "separate",
    borderSpacing: "0",
    tableLayout: "fixed",
  },
  "& .spatial-map-grid-table-x .spatial-map-grid-table": {
    minW: "0",
  },
  "& .spatial-map-grid-table th": {
    p: "7px 12px",
    borderBottom: "1px solid rgba(34, 41, 36, 0.16)",
    background: "rgba(235, 240, 233, 0.98)",
    color: "var(--spatial-map-copy-dim)",
    fontSize: "10px",
    fontWeight: "760",
    letterSpacing: "0.1em",
    lineHeight: "1.1",
    textAlign: "left",
  },
  "& .spatial-map-grid-table--links th:first-child, & .spatial-map-grid-table--links td:first-child": {
    textAlign: "right",
  },
  "& .spatial-map-grid-table td": {
    p: "6px 12px",
    borderBottom: "1px solid rgba(34, 41, 36, 0.09)",
    color: "var(--spatial-map-copy)",
    fontSize: "12px",
    lineHeight: "1.4",
    verticalAlign: "middle",
  },
  "& .spatial-map-grid-table th:not(:last-child), & .spatial-map-grid-table td:not(:last-child)": {
    borderRight: "1px solid rgba(34, 41, 36, 0.07)",
  },
  "& .spatial-map-grid-table tbody tr": {
    background: "rgba(252, 253, 252, 0.72)",
    cursor: "pointer",
  },
  "& .spatial-map-grid-table tbody tr:nth-child(even)": {
    background: "rgba(247, 250, 246, 0.76)",
  },
  "& .spatial-map-grid-table tbody tr:hover": {
    background: "rgba(230, 239, 229, 0.68)",
  },
  "& .spatial-map-grid-table tbody tr.is-selected": {
    background: "rgba(215, 231, 216, 0.88)",
    color: "#132017",
  },
  "& .spatial-map-grid-table tbody tr:focus-visible": {
    outline: "2px solid rgba(23, 62, 39, 0.48)",
    outlineOffset: "-2px",
  },
  "& .spatial-map-grid-tree-ancestor, & .spatial-map-grid-tree-branch": {
    position: "relative",
    display: "inline-flex",
    flex: "0 0 var(--tree-rail-width)",
    w: "var(--tree-rail-width)",
    minH: "28px",
  },
  "& .spatial-map-grid-tree-ancestor.has-continuation::before, & .spatial-map-grid-tree-branch::before, & .spatial-map-grid-tree-branch::after": {
    content: '""',
    position: "absolute",
    pointerEvents: "none",
  },
  "& .spatial-map-grid-tree-ancestor.has-continuation::before": {
    top: "calc(-1 * var(--tree-row-bleed))",
    bottom: "calc(-1 * var(--tree-row-bleed))",
    left: "8px",
    borderLeft: "1px solid var(--tree-connector-color)",
  },
  "& .spatial-map-grid-tree-branch::before": {
    top: "calc(-1 * var(--tree-row-bleed))",
    bottom: "50%",
    left: "8px",
    borderLeft: "1px solid var(--tree-connector-strong)",
  },
  "& .spatial-map-grid-tree-branch:not(.is-last)::before": {
    bottom: "calc(-1 * var(--tree-row-bleed))",
  },
  "& .spatial-map-grid-tree-branch::after": {
    top: "50%",
    left: "8px",
    w: "10px",
    borderTop: "1px solid var(--tree-connector-strong)",
  },
  "& .spatial-map-grid-tree-branch.is-leaf::after": {
    w: "18px",
  },
  "& .spatial-map-grid-node-title mark": {
    p: "0",
    background: "rgba(37, 95, 58, 0.2)",
    color: "#132017",
    boxDecorationBreak: "clone",
  },
});

const GridButton = styled("button");
const GridImage = styled("img");
const GridSelectElement = styled("select");

export function SpatialMapGridView(props: {
  project: ProjectRecord;
  onProjectUpdated?: (project: ProjectRecord, options?: import("~/lib/projects/optimistic").ProjectUpdateOptions) => void;
}) {
  const spatialMap = useSpatialMap();
  const [mode, setMode] = createSignal<SpatialMapGridMode>("nodes");
  const [selectedMetadataKeys, setSelectedMetadataKeys] = createSignal(
    props.project.nodeMetadataSchema.map((field) => field.key),
  );
  const [nodeSearchQuery, setNodeSearchQuery] = createSignal("");
  const [checkedNodeIds, setCheckedNodeIds] = createSignal<Set<string>>(new Set());
  let searchInputRef: HTMLInputElement | undefined;
  const nodes = createMemo(() => spatialMap.visibleData().nodes.slice());
  const hierarchyLinks = createMemo(() =>
    spatialMap.visibleData().links.filter((link) => link.parentChild),
  );
  // Checked ids that are still visible; archived or filtered-out nodes drop out of the selection.
  const visibleCheckedNodeIds = createMemo(() => {
    const checked = checkedNodeIds();
    return checked.size === 0 ? [] : nodes().map((node) => node.id).filter((id) => checked.has(id));
  });
  const filteredNodes = createMemo(() => {
    const query = normalizeSearchQuery(nodeSearchQuery());
    if (!query) {
      return nodes();
    }

    return nodes().filter((node) =>
      normalizeSearchQuery(node.label).includes(query),
    );
  });
  const links = createMemo(() => {
    const nodesById = spatialMap.sourceNodesById();
    return spatialMap
      .visibleData()
      .links.filter((link) => !link.parentChild)
      .map((link) => ({
        link,
        source: nodesById.get(link.source),
        target: nodesById.get(link.target),
      }))
      .filter(
        (entry): entry is { link: MapLink; source: MapNode; target: MapNode } =>
          Boolean(entry.source && entry.target),
      )
      .sort((left, right) => {
        const sourceSort = left.source.label.localeCompare(right.source.label);
        return sourceSort || left.target.label.localeCompare(right.target.label);
      });
  });

  onMount(() => {
    const handleSlashSearchShortcut = (event: KeyboardEvent) => {
      if (
        event.key !== "/" ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        mode() !== "nodes" ||
        isTextEntryTarget(event.target)
      ) {
        return;
      }

      event.preventDefault();
      searchInputRef?.focus();
      if (searchInputRef?.value) {
        searchInputRef.select();
      }
    };

    window.addEventListener("keydown", handleSlashSearchShortcut);
    onCleanup(() => {
      window.removeEventListener("keydown", handleSlashSearchShortcut);
    });
  });

  return (
    <Box
      class={gridStructureClass}
      position="relative"
      minH="0"
      overflow="hidden"
      p="0"
      border="1px solid rgba(96, 101, 95, 0.46)"
      borderRadius="8px"
      background="linear-gradient(90deg, rgba(35, 42, 37, 0.035) 1px, transparent 1px), linear-gradient(rgba(35, 42, 37, 0.035) 1px, transparent 1px), linear-gradient(180deg, rgba(248, 250, 248, 0.88), rgba(235, 239, 233, 0.96))"
      backgroundSize="40px 40px, 40px 40px, auto"
      boxShadow="inset 0 1px 0 rgba(255, 255, 255, 0.64), 0 12px 30px rgba(29, 33, 28, 0.06)"
    >
      <Box display="grid" gridTemplateRows="auto minmax(0, 1fr)" w="100%" h="100%" minH="100%" margin="0 auto" border="0" background="rgba(249, 250, 247, 0.97)" color="var(--spatial-map-copy)" boxShadow="0 18px 48px rgba(29, 33, 28, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.5)">
        <Box zIndex="3" borderBottom="1px solid rgba(44, 52, 46, 0.22)" background="rgba(246, 248, 244, 0.96)" boxShadow="0 10px 22px rgba(29, 33, 28, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.5)">
          <HStack justifyContent="space-between" gap="16px" minH="54px" p="9px 10px 9px 14px">
            <Box flex="1 1 auto" flexShrink="0" minW="0">
              <Box as="h2" m="0 0 4px" color="#141816" fontSize="16px" lineHeight="1.1" fontWeight="760" letterSpacing="0">
                Metadata grid
              </Box>
              <Box color="var(--spatial-map-copy-dim)" fontSize="11px" lineHeight="1" letterSpacing="0.06em">
                {mode() === "nodes"
                  ? getNodesSummary(filteredNodes().length, nodes().length, nodeSearchQuery())
                  : `${links().length} visible non-hierarchy links`}
              </Box>
            </Box>
            <HStack gap="12px" flex="0 1 auto" justifyContent="flex-end" minW="0">
              <Show when={mode() === "nodes"}>
                <SpatialMapArchiveImplementedButton
                  project={props.project}
                  onProjectUpdated={props.onProjectUpdated}
                />
              </Show>
              <Show when={mode() === "nodes"}>
                <MetadataKeyPicker
                  fields={props.project.nodeMetadataSchema}
                  selectedKeys={selectedMetadataKeys()}
                  onToggle={(key) => {
                    setSelectedMetadataKeys((current) =>
                      current.includes(key)
                        ? current.filter((item) => item !== key)
                        : [...current, key],
                    );
                  }}
                />
              </Show>
              <Show when={mode() === "nodes"}>
                <Box as="label" display="grid" gridTemplateColumns="minmax(180px, 260px)" alignItems="center" flexShrink="0" minW="0">
                  <Box as="span" position="relative" display="block" minW="0">
                    <Input
                      ref={searchInputRef}
                      type="search"
                      variant="spatial"
                      size="compact"
                      pr="30px"
                      aria-label="Filter node names"
                      value={nodeSearchQuery()}
                      placeholder="Filter node names"
                      onInput={(event) => setNodeSearchQuery(event.currentTarget.value)}
                    />
                    <Box as="kbd" position="absolute" top="50%" right="6px" display="inline-flex" alignItems="center" justifyContent="center" minW="18px" h="18px" border="1px solid rgba(44, 52, 46, 0.22)" background="rgba(236, 241, 234, 0.92)" color="var(--spatial-map-copy-dim)" font="inherit" fontSize="10px" fontWeight="760" lineHeight="1" transform="translateY(-50%)" pointerEvents="none">/</Box>
                  </Box>
                </Box>
              </Show>
              <HStack
                gap="0"
                flexShrink="0"
                overflow="hidden"
                border="1px solid rgba(96, 101, 95, 0.44)"
                borderRadius="6px"
                background="rgba(246, 248, 244, 0.94)"
                aria-label="Grid mode"
              >
                <Button
                  size="xs"
                  colorPalette="green"
                  variant={mode() === "nodes" ? "surface" : "outline"}
                  minW="54px"
                  h="28px"
                  p="0 10px"
                  border="0"
                  borderRight="1px solid rgba(24, 29, 26, 0.24)"
                  background={mode() === "nodes" ? "rgba(37, 95, 58, 0.16)" : "transparent"}
                  color={mode() === "nodes" ? "var(--spatial-map-accent-strong)" : "var(--spatial-map-copy-muted)"}
                  boxShadow={mode() === "nodes" ? "inset 0 -2px 0 rgba(23, 62, 39, 0.86)" : undefined}
                  aria-pressed={mode() === "nodes"}
                  onClick={() => setMode("nodes")}
                >
                  Nodes
                </Button>
                <Button
                  size="xs"
                  colorPalette="green"
                  variant={mode() === "links" ? "surface" : "outline"}
                  minW="54px"
                  h="28px"
                  p="0 10px"
                  border="0"
                  background={mode() === "links" ? "rgba(37, 95, 58, 0.16)" : "transparent"}
                  color={mode() === "links" ? "var(--spatial-map-accent-strong)" : "var(--spatial-map-copy-muted)"}
                  boxShadow={mode() === "links" ? "inset 0 -2px 0 rgba(23, 62, 39, 0.86)" : undefined}
                  aria-pressed={mode() === "links"}
                  onClick={() => setMode("links")}
                >
                  Links
                </Button>
              </HStack>
            </HStack>
          </HStack>
        </Box>

        <Show
          when={mode() === "nodes"}
          fallback={
            <LinksGrid
              links={links()}
              project={props.project}
              onProjectUpdated={props.onProjectUpdated}
            />
          }
        >
          <Box display="grid" gridTemplateRows="auto minmax(0, 1fr)" minH="0">
          <Show when={visibleCheckedNodeIds().length > 0} fallback={<Box />}>
            <SpatialMapGridBulkBar
              project={props.project}
              nodeIds={visibleCheckedNodeIds()}
              onClear={() => setCheckedNodeIds(new Set<string>())}
              onProjectUpdated={props.onProjectUpdated}
            />
          </Show>
          <NodesGrid
            checkedNodeIds={checkedNodeIds()}
            onCheckedNodeIdsChange={setCheckedNodeIds}
            rows={buildNodeGridRows(filteredNodes(), hierarchyLinks())}
            searchQuery={nodeSearchQuery()}
            project={props.project}
            metadataFields={props.project.nodeMetadataSchema.filter((field) =>
              selectedMetadataKeys().includes(field.key),
            )}
            selectedNodeId={spatialMap.selectedNodeId()}
            onSelectNode={spatialMap.setSelectedNodeId}
            onProjectUpdated={props.onProjectUpdated}
          />
          </Box>
        </Show>
      </Box>
    </Box>
  );
}

function NodesGrid(props: {
  checkedNodeIds: Set<string>;
  onCheckedNodeIdsChange: (nodeIds: Set<string>) => void;
  rows: NodeGridRow[];
  searchQuery: string;
  project: ProjectRecord;
  metadataFields: ProjectNodeMetadataField[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
  onProjectUpdated?: (project: ProjectRecord, options?: import("~/lib/projects/optimistic").ProjectUpdateOptions) => void;
}) {
  const spatialMap = useSpatialMap();
  let gridWrapRef: HTMLDivElement | undefined;
  let lastAutoScrolledNodeId: string | null = null;
  const rowElements = new Map<string, HTMLTableRowElement>();
  const [treeGridActive, setTreeGridActive] = createSignal(false);
  const [collapsedNodeIds, setCollapsedNodeIds] = createSignal<Set<string>>(new Set());
  const [columnWidths, setColumnWidths] = createSignal<Record<string, number>>({});
  const getColumnWidth = (columnKey: string, fallback: number) =>
    columnWidths()[columnKey] ?? fallback;
  const setColumnWidth = (columnKey: string, width: number) => {
    setColumnWidths((current) => ({ ...current, [columnKey]: width }));
  };
  const columnDefinitions = createMemo(() =>
    getNodeGridColumns(props.metadataFields, getColumnWidth),
  );
  const rowByNodeId = createMemo(() => new Map(props.rows.map((row) => [row.node.id, row])));
  const visibleRows = createMemo(() => {
    const collapsed = collapsedNodeIds();
    const hiddenDepths = new Set<number>();

    return props.rows.filter((row) => {
      for (const depth of Array.from(hiddenDepths)) {
        if (row.depth <= depth) {
          hiddenDepths.delete(depth);
        }
      }

      if (hiddenDepths.size > 0) {
        if (collapsed.has(row.node.id)) {
          hiddenDepths.add(row.depth);
        }
        return false;
      }

      if (collapsed.has(row.node.id)) {
        hiddenDepths.add(row.depth);
      }

      return true;
    });
  });
  const toggleChecked = (nodeId: string) => {
    const next = new Set(props.checkedNodeIds);
    if (next.has(nodeId)) {
      next.delete(nodeId);
    } else {
      next.add(nodeId);
    }
    props.onCheckedNodeIdsChange(next);
  };
  const allVisibleChecked = () =>
    visibleRows().length > 0 && visibleRows().every((row) => props.checkedNodeIds.has(row.node.id));
  const toggleAllVisible = () => {
    const next = new Set(props.checkedNodeIds);
    const checkAll = !allVisibleChecked();
    for (const row of visibleRows()) {
      if (checkAll) {
        next.add(row.node.id);
      } else {
        next.delete(row.node.id);
      }
    }
    props.onCheckedNodeIdsChange(next);
  };
  const isExpanded = (row: NodeGridRow) =>
    row.hasChildren && !collapsedNodeIds().has(row.node.id);
  const toggleRowExpanded = (row: NodeGridRow) => {
    if (!row.hasChildren) return;

    setCollapsedNodeIds((current) => {
      const next = new Set(current);
      if (next.has(row.node.id)) {
        next.delete(row.node.id);
      } else {
        next.add(row.node.id);
      }
      return next;
    });
  };
  const selectRelativeRow = (offset: number) => {
    const rows = visibleRows();
    const currentIndex = rows.findIndex((row) => row.node.id === props.selectedNodeId);
    const baseIndex = currentIndex === -1 ? 0 : currentIndex;
    const next = rows[Math.max(0, Math.min(rows.length - 1, baseIndex + offset))];
    if (next) {
      props.onSelectNode(next.node.id);
    }
  };
  const handleTreeGridKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented) {
      return;
    }

    if (isTextEntryTarget(event.target)) {
      return;
    }

    const currentRow = props.selectedNodeId
      ? rowByNodeId().get(props.selectedNodeId)
      : visibleRows()[0];

    if (event.key === "ArrowDown") {
      event.preventDefault();
      event.stopPropagation();
      selectRelativeRow(1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      selectRelativeRow(-1);
      return;
    }

    if (!currentRow) {
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      event.stopPropagation();
      if (currentRow.hasChildren && !isExpanded(currentRow)) {
        toggleRowExpanded(currentRow);
        return;
      }

      const child = visibleRows().find((row) => row.parentNodeId === currentRow.node.id);
      if (child) {
        props.onSelectNode(child.node.id);
      }
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      event.stopPropagation();
      if (currentRow.hasChildren && isExpanded(currentRow)) {
        toggleRowExpanded(currentRow);
        return;
      }

      if (currentRow.parentNodeId) {
        props.onSelectNode(currentRow.parentNodeId);
      }
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      props.onSelectNode(currentRow.node.id);
    }
  };

  createEffect(() => {
    const selectedNodeId = props.selectedNodeId;
    if (!selectedNodeId) {
      lastAutoScrolledNodeId = null;
      return;
    }

    if (selectedNodeId === lastAutoScrolledNodeId) {
      return;
    }

    if (!visibleRows().some((row) => row.node.id === selectedNodeId)) {
      return;
    }

    lastAutoScrolledNodeId = selectedNodeId;
    const scrollFrame = window.requestAnimationFrame(() => {
      rowElements
        .get(selectedNodeId)
        ?.scrollIntoView({ block: "nearest", inline: "nearest" });
    });

    onCleanup(() => window.cancelAnimationFrame(scrollFrame));
  });

  onMount(() => {
    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (!treeGridActive()) {
        return;
      }

      handleTreeGridKeyDown(event);
    };
    const handleWindowPointerDown = (event: PointerEvent) => {
      setTreeGridActive(
        Boolean(event.target instanceof Node && gridWrapRef?.contains(event.target)),
      );
    };

    window.addEventListener("keydown", handleWindowKeyDown);
    window.addEventListener("pointerdown", handleWindowPointerDown);

    onCleanup(() => {
      window.removeEventListener("keydown", handleWindowKeyDown);
      window.removeEventListener("pointerdown", handleWindowPointerDown);
    });
  });

  return (
    <Box
      ref={gridWrapRef}
      minH="0"
      overflowX="auto"
      overflowY="hidden"
      tabIndex={0}
      onKeyDown={handleTreeGridKeyDown}
      onFocusIn={() => setTreeGridActive(true)}
    >
      <Show
        when={visibleRows().length > 0}
        fallback={<GridEmpty>No visible nodes.</GridEmpty>}
      >
        <Box class="spatial-map-grid-table-x" display="grid" gridTemplateRows="auto minmax(0, 1fr)" h="100%" style={getNodeGridStyle(columnDefinitions())}>
          <table class="spatial-map-grid-table spatial-map-grid-table--nodes" role="treegrid">
            <GridColGroup mode="nodes" columns={columnDefinitions()} />
            <thead>
              <tr>
                <th scope="col">
                  <input
                    type="checkbox"
                    aria-label="Select all visible nodes"
                    checked={allVisibleChecked()}
                    onChange={toggleAllVisible}
                  />
                </th>
                <ResizableHeader
                  label="Name"
                  columnKey="name"
                  width={getColumnWidth("name", DEFAULT_NODE_COLUMN_WIDTHS.name)}
                  minWidth={MIN_NODE_COLUMN_WIDTHS.name}
                  onResize={setColumnWidth}
                />
                <ResizableHeader
                  label="Type"
                  columnKey="type"
                  width={getColumnWidth("type", DEFAULT_NODE_COLUMN_WIDTHS.type)}
                  minWidth={MIN_NODE_COLUMN_WIDTHS.type}
                  onResize={setColumnWidth}
                />
                <ResizableHeader
                  label="Status"
                  columnKey="status"
                  width={getColumnWidth("status", DEFAULT_NODE_COLUMN_WIDTHS.status)}
                  minWidth={MIN_NODE_COLUMN_WIDTHS.status}
                  onResize={setColumnWidth}
                />
                <ResizableHeader
                  label="Priority"
                  columnKey="priority"
                  width={getColumnWidth("priority", DEFAULT_NODE_COLUMN_WIDTHS.priority)}
                  minWidth={MIN_NODE_COLUMN_WIDTHS.priority}
                  onResize={setColumnWidth}
                />
                <For each={props.metadataFields}>
                  {(field) => (
                    <ResizableHeader
                      label={field.label}
                      columnKey={`metadata:${field.key}`}
                      width={getColumnWidth(`metadata:${field.key}`, DEFAULT_NODE_COLUMN_WIDTHS.metadata)}
                      minWidth={MIN_NODE_COLUMN_WIDTHS.metadata}
                      onResize={setColumnWidth}
                    />
                  )}
                </For>
                <ResizableHeader
                  label="Image"
                  columnKey="image"
                  width={getColumnWidth("image", DEFAULT_NODE_COLUMN_WIDTHS.image)}
                  minWidth={MIN_NODE_COLUMN_WIDTHS.image}
                  onResize={setColumnWidth}
                />
                <th scope="col">Actions</th>
              </tr>
            </thead>
          </table>
          <Box minH="0" overflowX="hidden" overflowY="auto">
            <table
              class="spatial-map-grid-table spatial-map-grid-table--nodes"
              role="treegrid"
              tabIndex={0}
            >
              <GridColGroup mode="nodes" columns={columnDefinitions()} />
              <tbody>
                <For each={visibleRows()}>
                  {(row) => (
                    <tr
                      ref={(element) => {
                        rowElements.set(row.node.id, element);
                      }}
                      class={props.selectedNodeId === row.node.id ? "is-selected" : ""}
                      role="row"
                      aria-level={row.depth + 1}
                      aria-expanded={row.hasChildren ? isExpanded(row) : undefined}
                      aria-selected={props.selectedNodeId === row.node.id}
                      tabIndex={props.selectedNodeId === row.node.id ? 0 : -1}
                      onClick={() => props.onSelectNode(row.node.id)}
                      onDblClick={(event) => {
                        if (isTextEntryTarget(event.target)) return;
                        event.preventDefault();
                        spatialMap.isolateNode(row.node.id);
                      }}
                      onKeyDown={handleTreeGridKeyDown}
                    >
                      <td onClick={(event) => event.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Select ${row.node.label}`}
                          checked={props.checkedNodeIds.has(row.node.id)}
                          onChange={() => toggleChecked(row.node.id)}
                        />
                      </td>
                      <td>
                        <NodeNameCell
                          row={row}
                          node={row.node}
                          project={props.project}
                          expanded={isExpanded(row)}
                          onToggleExpanded={() => toggleRowExpanded(row)}
                          onTreeKeyDown={handleTreeGridKeyDown}
                          onProjectUpdated={props.onProjectUpdated}
                        />
                      </td>
                      <td>
                        <NodeTypeCell
                          project={props.project}
                          node={row.node}
                          onProjectUpdated={props.onProjectUpdated}
                        />
                      </td>
                      <td>
                        <NodeStatusCell
                          project={props.project}
                          node={row.node}
                          onProjectUpdated={props.onProjectUpdated}
                        />
                      </td>
                      <td onClick={(event) => event.stopPropagation()}>
                        <SpatialMapNodePriorityMenu
                          project={props.project}
                          node={row.node}
                          variant="tree"
                          onProjectUpdated={props.onProjectUpdated}
                        />
                      </td>
                      <For each={props.metadataFields}>
                        {(field) => (
                          <MetadataValueCell
                            project={props.project}
                            node={row.node}
                            field={field}
                            onProjectUpdated={props.onProjectUpdated}
                          />
                        )}
                      </For>
                      <td>
                        <ImagePreviewCell node={row.node} />
                      </td>
                      <td>
                        <NodeActionsCell
                          project={props.project}
                          node={row.node}
                          onProjectUpdated={props.onProjectUpdated}
                        />
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </Box>
        </Box>
      </Show>
    </Box>
  );
}

function LinksGrid(props: {
  links: Array<{ link: MapLink; source: MapNode; target: MapNode }>;
  project?: ProjectRecord;
  onProjectUpdated?: (project: ProjectRecord, options?: import("~/lib/projects/optimistic").ProjectUpdateOptions) => void;
}) {
  const spatialMap = useSpatialMap();

  return (
    <Box minH="0" overflowX="auto" overflowY="hidden">
      <Show
        when={props.links.length > 0}
        fallback={
          <GridEmpty>
            No non-hierarchy links are visible.
          </GridEmpty>
        }
      >
        <Box class="spatial-map-grid-table-x spatial-map-grid-table-x--links" display="grid" gridTemplateRows="auto minmax(0, 1fr)" w="100%" minW="760px" h="100%">
          <table class="spatial-map-grid-table spatial-map-grid-table--links">
            <GridColGroup mode="links" />
            <thead>
              <tr>
                <th scope="col">Node</th>
                <th scope="col">Link metadata</th>
                <th scope="col">Connected node</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
          </table>
          <Box minH="0" overflowX="hidden" overflowY="auto">
            <table class="spatial-map-grid-table spatial-map-grid-table--links">
              <GridColGroup mode="links" />
              <tbody>
                <For each={props.links}>
                  {(entry) => (
                    <tr>
                      <td onClick={() => spatialMap.setSelectedNodeId(entry.source.id)}>
                        <NodeCell node={entry.source} />
                      </td>
                      <td>
                        <Badge
                          variant="spatial"
                          size="sm"
                          color="var(--spatial-map-accent-strong)"
                          fontWeight="760"
                        >
                          {formatLinkRelationship(entry.link)}
                        </Badge>
                      </td>
                      <td onClick={() => spatialMap.setSelectedNodeId(entry.target.id)}>
                        <NodeCell node={entry.target} />
                      </td>
                      <td>
                        <Show when={props.project}>
                          {(project) => (
                            <LinkActionsCell
                              project={project()}
                              link={entry.link}
                              source={entry.source}
                              target={entry.target}
                              onProjectUpdated={props.onProjectUpdated}
                            />
                          )}
                        </Show>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </Box>
        </Box>
      </Show>
    </Box>
  );
}

function GridColGroup(props: {
  mode: SpatialMapGridMode;
  columns?: Array<{ key: string; width: number }>;
}) {
  return (
    <colgroup>
      <Show when={props.mode === "nodes"}>
        <For each={props.columns ?? []}>
          {(column) => <col style={{ width: `${column.width}px` }} />}
        </For>
      </Show>
      <Show when={props.mode === "links"}>
        <col style={{ width: "36%" }} />
        <col style={{ width: "18%" }} />
        <col style={{ width: "36%" }} />
        <col style={{ width: "10%" }} />
      </Show>
    </colgroup>
  );
}

function ResizableHeader(props: {
  label: string;
  columnKey: string;
  width: number;
  minWidth: number;
  onResize: (columnKey: string, width: number) => void;
}) {
  let startX = 0;
  let startWidth = 0;
  const [resizing, setResizing] = createSignal(false);
  const handlePointerDown = (event: PointerEvent) => {
    const target = event.currentTarget;
    if (!(target instanceof HTMLElement)) return;
    startX = event.clientX;
    startWidth = props.width;
    setResizing(true);
    target.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  };
  const handlePointerMove = (event: PointerEvent) => {
    if (!resizing()) return;
    props.onResize(
      props.columnKey,
      Math.max(props.minWidth, Math.round(startWidth + event.clientX - startX)),
    );
  };
  const finishResize = (event: PointerEvent) => {
    if (!resizing()) return;
    const target = event.currentTarget;
    if (target instanceof HTMLElement) {
      target.releasePointerCapture(event.pointerId);
    }
    setResizing(false);
  };

  return (
    <th scope="col">
      <Box display="flex" alignItems="center" gap="8px" minW="0">
        <Box as="span" minW="0" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
          {props.label}
        </Box>
        <GridButton
          type="button"
          flex="0 0 8px"
          w="8px"
          alignSelf="stretch"
          minH="18px"
          ml="auto"
          p="0"
          border="0"
          borderRadius="2px"
          background={resizing() ? "rgba(23, 62, 39, 0.42)" : "rgba(44, 52, 46, 0.16)"}
          cursor="col-resize"
          aria-label={`Resize ${props.label} column`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishResize}
          onPointerCancel={finishResize}
          onClick={(event) => event.stopPropagation()}
        />
      </Box>
    </th>
  );
}

function MetadataKeyPicker(props: {
  fields: ProjectNodeMetadataField[];
  selectedKeys: string[];
  onToggle: (key: string) => void;
}) {
  return (
    <Show when={props.fields.length > 0}>
      <HStack
        aria-label="Metadata columns"
        flex="0 1 auto"
        gap="1.5"
        minH="7.5"
        minW="30"
        overflowX="auto"
      >
        <Box
          as="span"
          flexShrink="0"
          color="fg.subtle"
          fontSize="10px"
          fontWeight="bold"
          letterSpacing="0.08em"
          lineHeight="1"
        >
          Columns
        </Box>
        <For each={props.fields}>
          {(field) => {
            const selected = () => props.selectedKeys.includes(field.key);
            return (
              <Button
                type="button"
                variant={selected() ? "subtle" : "outline"}
                size="2xs"
                aria-pressed={selected()}
                color={selected() ? "var(--spatial-map-accent-strong)" : "fg.muted"}
                borderColor={selected() ? "rgba(23, 62, 39, 0.38)" : "rgba(44, 52, 46, 0.22)"}
                bg={selected() ? "rgba(37, 95, 58, 0.14)" : "rgba(252, 253, 252, 0.72)"}
                fontSize="10px"
                fontWeight="bold"
                minH="6"
                px="2"
                onClick={() => props.onToggle(field.key)}
              >
                {field.label}
              </Button>
            );
          }}
        </For>
      </HStack>
    </Show>
  );
}

function NodeActionsCell(props: {
  project: ProjectRecord;
  node: MapNode;
  onProjectUpdated?: (project: ProjectRecord, options?: import("~/lib/projects/optimistic").ProjectUpdateOptions) => void;
}) {
  return (
    <Box display="flex" alignItems="center" gap="4px" onClick={(event) => event.stopPropagation()}>
      <SpatialMapDeleteNodeControl
        project={props.project}
        node={props.node}
        compact
        onProjectUpdated={props.onProjectUpdated}
      />
    </Box>
  );
}

function LinkActionsCell(props: {
  project: ProjectRecord;
  link: MapLink;
  source: MapNode;
  target: MapNode;
  onProjectUpdated?: (project: ProjectRecord, options?: import("~/lib/projects/optimistic").ProjectUpdateOptions) => void;
}) {
  const submitDeleteLink = useAction(deleteProjectLink);
  const [open, setOpen] = createSignal(false);
  const [pending, setPending] = createSignal(false);
  let deleteButtonRef: HTMLButtonElement | undefined;

  const deleteLink = async () => {
    if (pending()) return;

    const formData = new FormData();
    formData.set("projectId", props.project.id);
    formData.set("source", props.link.source);
    formData.set("target", props.link.target);
    formData.set("relationship", formatLinkRelationship(props.link));
    const clientMutationId = createClientMutationId();
    const previousProject = props.project;
    const optimisticProject = {
      ...props.project,
      updatedAt: new Date().toISOString(),
      spatialMap: {
        ...props.project.spatialMap,
        links: props.project.spatialMap.links.filter((link) => link !== props.link),
      },
    };

    setPending(true);
    props.onProjectUpdated?.(optimisticProject, { clientMutationId, phase: "optimistic" });
    try {
      const result = await submitDeleteLink(appendClientMutationId(formData, clientMutationId));
      props.onProjectUpdated?.(result, { clientMutationId, phase: "server" });
      setOpen(false);
      toaster.success({
        title: "Link deleted",
        description: `${props.source.label} -> ${props.target.label} was removed.`,
      });
    } catch (error) {
      props.onProjectUpdated?.(previousProject, { clientMutationId, phase: "server" });
      toaster.error({
        title: "Delete failed",
        description:
          error instanceof Error ? error.message : "The link could not be deleted.",
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <Box display="flex" alignItems="center" gap="4px" onClick={(event) => event.stopPropagation()}>
      <Tooltip content="Delete link" openDelay={150} closeDelay={80}>
        <Button
          size="xs"
          variant="danger"
          px="0"
          aria-label="Delete link"
          onClick={() => setOpen(true)}
        >
          <Trash2 size={16} />
        </Button>
      </Tooltip>
      <SimpleDialog
        open={open()}
        onOpenChange={setOpen}
        title="Delete Link"
        description={`Delete the ${formatLinkRelationship(props.link)} link from ${props.source.label} to ${props.target.label}?`}
        maxW="520px"
        initialFocusEl={() => deleteButtonRef ?? null}
        footer={
          <HStack>
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>
              Keep
            </Button>
            <Button
              ref={deleteButtonRef}
              type="button"
              loading={pending()}
              variant="danger"
              onClick={() => {
                void deleteLink();
              }}
            >
              Delete
            </Button>
          </HStack>
        }
      >
        <Box color="var(--spatial-map-copy-muted)" fontSize="12px" lineHeight="1.5">
          This removes only the relationship link. The connected nodes stay in the
          map.
        </Box>
      </SimpleDialog>
    </Box>
  );
}

function NodeCell(props: { node: MapNode }) {
  return (
    <Box display="grid" gap="6px" minW="0">
      <Box display="inline-flex" alignItems="center" gap="6px" m="0" color="#141816" fontSize="13px" lineHeight="1.24" fontWeight="640" overflowWrap="anywhere">
        {props.node.label}
      </Box>
      <HStack gap="1" flexWrap="wrap">
        <Badge variant="spatial" size="2xs">{props.node.type}</Badge>
        <Badge variant="spatial" size="2xs">{props.node.status}</Badge>
        <Badge variant="spatial" size="2xs" fontFamily="mono" color="fg.subtle">
          {props.node.id}
        </Badge>
      </HStack>
    </Box>
  );
}

function NodeNameCell(props: {
  row: NodeGridRow;
  node: MapNode;
  project: ProjectRecord;
  expanded: boolean;
  onToggleExpanded: () => void;
  onTreeKeyDown: (event: KeyboardEvent) => void;
  onProjectUpdated?: (project: ProjectRecord, options?: import("~/lib/projects/optimistic").ProjectUpdateOptions) => void;
}) {
  const spatialMap = useSpatialMap();
  const submitSaveTitle = useAction(updateProjectNodeTitle);
  const [pending, setPending] = createSignal(false);
  const context = createMemo(() => getNodeContext(props.node));
  const hasContext = createMemo(() => context().length > 0);
  const submitTitle = async (value: string) => {
    const title = value.trim();
    if (!title || title === props.node.label || pending()) return;

    setPending(true);
    const previousProject = props.project;
    const clientMutationId = createClientMutationId();
    props.onProjectUpdated?.(
      updateProjectNode(props.project, props.node.id, (projectNode) => ({
        ...projectNode,
        label: title,
      })),
      { clientMutationId, phase: "optimistic" },
    );
    try {
      const formData = createNodeFormData(props.project.id, props.node.id, {
        title,
      });
      const result = await submitSaveTitle(appendClientMutationId(formData, clientMutationId));
      props.onProjectUpdated?.(result, { clientMutationId, phase: "server" });
      toaster.success({ title: "Node renamed", description: `${title} is now shown in the grid.` });
    } catch (error) {
      props.onProjectUpdated?.(previousProject, { clientMutationId, phase: "server" });
      toaster.error({
        title: "Rename failed",
        description: error instanceof Error ? error.message : "The node title could not be updated.",
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <Box
      display="flex"
      alignItems="center"
      gap="0"
      minW="0"
      minH="28px"
      style={{
        "--tree-rail-width": "18px",
        "--tree-row-bleed": "7px",
        "--tree-connector-color": "rgba(44, 52, 46, 0.28)",
        "--tree-connector-strong": "rgba(44, 52, 46, 0.36)",
      }}
    >
      <Box display="inline-flex" alignSelf="stretch" alignItems="stretch" flex="0 0 auto" minH="28px" pointerEvents="none" aria-hidden="true">
        <For each={props.row.ancestorHasNextSibling}>
          {(hasNextSibling) => (
            <span
              class={`spatial-map-grid-tree-ancestor${hasNextSibling ? " has-continuation" : ""}`}
            />
          )}
        </For>
        <Show when={props.row.depth > 0}>
          <span
            class={`spatial-map-grid-tree-branch${props.row.isLastSibling ? " is-last" : ""}${props.row.hasChildren ? "" : " is-leaf"}`}
          />
        </Show>
      </Box>
      <Show
        when={props.row.hasChildren}
      >
        <GridButton
          type="button"
          display="inline-flex"
          alignItems="center"
          justifyContent="center"
          flex="0 0 18px"
          w="18px"
          h="22px"
          mr="3px"
          p="0"
          border="0"
          background="transparent"
          color="rgba(31, 72, 46, 0.78)"
          cursor="pointer"
          _hover={{ color: "var(--spatial-map-accent-strong)", outline: "2px solid rgba(23, 62, 39, 0.26)", outlineOffset: "-1px" }}
          _focusVisible={{ color: "var(--spatial-map-accent-strong)", outline: "2px solid rgba(23, 62, 39, 0.26)", outlineOffset: "-1px" }}
          aria-label={`${props.expanded ? "Collapse" : "Expand"} ${props.node.label}`}
          aria-expanded={props.expanded}
          onClick={(event) => {
            event.stopPropagation();
            props.onToggleExpanded();
          }}
          onKeyDown={props.onTreeKeyDown}
        >
          <Show
            when={props.expanded}
            fallback={<ChevronRight size={14} aria-hidden="true" />}
          >
            <ChevronDown size={14} aria-hidden="true" />
          </Show>
        </GridButton>
      </Show>
      <Box
        class={`spatial-map-grid-node-title${props.row.hasChildren ? " has-children" : " is-leaf"}`}
        display="inline-flex"
        alignItems="center"
        gap="6px"
        ml={props.row.hasChildren ? "4px" : "12px"}
        color="#141816"
        fontSize="13px"
        lineHeight="1.24"
        fontWeight={props.row.hasChildren ? "720" : "640"}
        overflowWrap="anywhere"
        onClick={(event) => event.stopPropagation()}
      >
        <EditInPlace
          value={props.node.label}
          disabled={pending()}
          aria-label={`Edit name for ${props.node.label}`}
          onConfirm={(value) => {
            void submitTitle(value);
          }}
        />
        <Show when={hasContext()}>
          <GridButton
            type="button"
            display="inline-flex"
            alignItems="center"
            justifyContent="center"
            flexShrink="0"
            w="18px"
            h="18px"
            p="0"
            border="1px solid rgba(44, 52, 46, 0.2)"
            background="rgba(252, 253, 252, 0.38)"
            color="rgba(31, 72, 46, 0.62)"
            cursor="pointer"
            _hover={{ borderColor: "rgba(23, 62, 39, 0.34)", background: "rgba(229, 239, 229, 0.54)", color: "rgba(23, 62, 39, 0.78)", outline: "2px solid rgba(23, 62, 39, 0.2)", outlineOffset: "1px" }}
            _focusVisible={{ borderColor: "rgba(23, 62, 39, 0.34)", background: "rgba(229, 239, 229, 0.54)", color: "rgba(23, 62, 39, 0.78)", outline: "2px solid rgba(23, 62, 39, 0.2)", outlineOffset: "1px" }}
            aria-label={`Open context preview for ${props.node.label}`}
            onClick={(event) => {
              event.stopPropagation();
              spatialMap.openContextPreview(props.node.id);
            }}
          >
            <FileText size={14} aria-hidden="true" />
          </GridButton>
        </Show>
      </Box>
    </Box>
  );
}

function NodeTypeCell(props: {
  project: ProjectRecord;
  node: MapNode;
  onProjectUpdated?: (project: ProjectRecord, options?: import("~/lib/projects/optimistic").ProjectUpdateOptions) => void;
}) {
  const submitSaveType = useAction(updateProjectNodeType);
  const [pending, setPending] = createSignal(false);
  const typeColor = createMemo(() =>
    props.project.nodeTypeSchema.find((type) => type.name === props.node.type)?.color ?? "#dbdbdb",
  );
  const submitType = async (type: string) => {
    if (!type || type === props.node.type || pending()) return;

    await submitNodePatch({
      project: props.project,
      node: props.node,
      clientUpdate: (projectNode) => ({ ...projectNode, type }),
      submit: submitSaveType,
      fields: { type },
      successTitle: "Type updated",
      successDescription: `${props.node.label} is now a ${type} node.`,
      errorTitle: "Type update failed",
      onProjectUpdated: props.onProjectUpdated,
      setPending,
    });
  };

  return (
    <Box onClick={(event) => event.stopPropagation()}>
      <GridSelect
        value={props.node.type}
        ariaLabel={`Edit type for ${props.node.label}`}
        pending={pending()}
        options={props.project.nodeTypeSchema.map((type) => ({ value: type.name, label: type.name }))}
        leading={
          <Box as="span" w="9px" h="9px" borderRadius="999px" background={typeColor()} border="1px solid rgba(34, 41, 36, 0.24)" aria-hidden="true" />
        }
        onChange={submitType}
      />
    </Box>
  );
}

function NodeStatusCell(props: {
  project: ProjectRecord;
  node: MapNode;
  onProjectUpdated?: (project: ProjectRecord, options?: import("~/lib/projects/optimistic").ProjectUpdateOptions) => void;
}) {
  const submitSaveStatus = useAction(updateProjectNodeStatus);
  const [pending, setPending] = createSignal(false);
  const submitStatus = async (status: string) => {
    if (!status || status === props.node.status || pending()) return;

    await submitNodePatch({
      project: props.project,
      node: props.node,
      clientUpdate: (projectNode) => ({
        ...projectNode,
        status: status as MapNodeStatus,
      }),
      submit: submitSaveStatus,
      fields: { status },
      successTitle: "Status updated",
      successDescription: `${props.node.label} is now ${getMapNodeStatusLabel(status as MapNodeStatus)}.`,
      errorTitle: "Status update failed",
      onProjectUpdated: props.onProjectUpdated,
      setPending,
    });
  };

  return (
    <Box onClick={(event) => event.stopPropagation()}>
      <GridSelect
        value={props.node.status}
        ariaLabel={`Edit status for ${props.node.label}`}
        pending={pending()}
        options={["planned", "working", "needs-review", "implemented", "blocked", "deprecated"].map((status) => ({
          value: status,
          label: getMapNodeStatusLabel(status as MapNodeStatus),
        }))}
        leading={
          <Box as="span" display="inline-flex" alignItems="center" justifyContent="center" w="18px" h="18px" border="1px solid rgba(34, 41, 36, 0.2)" borderRadius="999px" background="rgba(252, 253, 252, 0.72)" color="var(--spatial-map-accent-strong)" fontSize="10px" fontWeight="800" lineHeight="1" aria-hidden="true">
            {getMapNodeStatusGlyph(props.node.status)}
          </Box>
        }
        onChange={submitStatus}
      />
    </Box>
  );
}

function MetadataValueCell(props: {
  project: ProjectRecord;
  node: MapNode;
  field: ProjectNodeMetadataField;
  onProjectUpdated?: (project: ProjectRecord, options?: import("~/lib/projects/optimistic").ProjectUpdateOptions) => void;
}) {
  const submitSaveMetadata = useAction(updateProjectNodeMetadata);
  const [pending, setPending] = createSignal(false);
  const value = createMemo(() => props.node.metadata[props.field.key]?.trim() ?? "");
  const submitMetadata = async (nextValue: string) => {
    const metadataValue = nextValue.trim();
    if (metadataValue === value() || pending()) return;

    const metadata = {
      ...props.node.metadata,
      [props.field.key]: metadataValue,
    };
    await submitNodePatch({
      project: props.project,
      node: props.node,
      clientUpdate: (projectNode) => ({ ...projectNode, metadata }),
      submit: submitSaveMetadata,
      fields: Object.fromEntries(
        props.project.nodeMetadataSchema.map((field) => [
          `metadata.${field.key}`,
          metadata[field.key] ?? "",
        ]),
      ),
      successTitle: "Metadata updated",
      successDescription: `${props.field.label} was updated for ${props.node.label}.`,
      errorTitle: "Metadata update failed",
      onProjectUpdated: props.onProjectUpdated,
      setPending,
    });
  };

  return (
    <td onClick={(event) => event.stopPropagation()}>
      <GridTextInput
        value={value()}
        ariaLabel={`Edit ${props.field.label} for ${props.node.label}`}
        placeholder="None"
        pending={pending()}
        onCommit={submitMetadata}
      />
    </td>
  );
}

function GridTextInput(props: {
  value: string;
  ariaLabel: string;
  placeholder?: string;
  pending: boolean;
  onCommit: (value: string) => void | Promise<void>;
}) {
  let inputRef: HTMLInputElement | undefined;
  const [draft, setDraft] = createSignal(props.value);

  createEffect(() => {
    if (document.activeElement !== inputRef) {
      setDraft(props.value);
    }
  });

  const commit = () => {
    void props.onCommit(draft());
  };

  return (
    <Input
      ref={inputRef}
      type="text"
      variant="spatial"
      size="compact"
      value={draft()}
      placeholder={props.placeholder}
      disabled={props.pending}
      aria-label={props.ariaLabel}
      title={props.value || props.placeholder}
      minW="0"
      w="100%"
      h="26px"
      px="6px"
      fontSize="12px"
      fontWeight="inherit"
      overflow="hidden"
      textOverflow="ellipsis"
      onInput={(event) => setDraft(event.currentTarget.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
          event.currentTarget.blur();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          setDraft(props.value);
          event.currentTarget.blur();
        }
      }}
    />
  );
}

function GridSelect(props: {
  value: string;
  ariaLabel: string;
  pending: boolean;
  options: Array<{ value: string; label: string }>;
  leading?: JSX.Element;
  onChange: (value: string) => void | Promise<void>;
}) {
  return (
    <Box position="relative" w="100%" minW="0">
      <Show when={props.leading}>
        <Box position="absolute" left="8px" top="50%" display="inline-flex" alignItems="center" justifyContent="center" transform="translateY(-50%)" pointerEvents="none" zIndex="1">
          {props.leading}
        </Box>
      </Show>
      <GridSelectElement
        value={props.value}
        disabled={props.pending}
        aria-label={props.ariaLabel}
        w="100%"
        h="30px"
        pl={props.leading ? "34px" : "10px"}
        pr="30px"
        border="1px solid rgba(44, 52, 46, 0.22)"
        borderRadius="6px"
        background="rgba(252, 253, 252, 0.62)"
        color="var(--spatial-map-copy)"
        fontSize="13px"
        fontWeight="660"
        lineHeight="1"
        cursor="pointer"
        appearance="none"
        boxShadow="inset 0 1px 0 rgba(255, 255, 255, 0.74)"
        _hover={{ borderColor: "rgba(23, 62, 39, 0.34)", background: "rgba(250, 252, 249, 0.88)" }}
        _focusVisible={{ outline: "2px solid rgba(23, 62, 39, 0.24)", outlineOffset: "1px", borderColor: "rgba(23, 62, 39, 0.44)" }}
        onChange={(event) => {
          void props.onChange(event.currentTarget.value);
        }}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <For each={props.options}>
          {(option) => <option value={option.value}>{option.label}</option>}
        </For>
      </GridSelectElement>
      <Box position="absolute" right="10px" top="50%" w="8px" h="8px" borderRight="1.5px solid rgba(34, 41, 36, 0.74)" borderBottom="1.5px solid rgba(34, 41, 36, 0.74)" transform="translateY(-65%) rotate(45deg)" pointerEvents="none" aria-hidden="true" />
    </Box>
  );
}

async function submitNodePatch(input: {
  project: ProjectRecord;
  node: MapNode;
  clientUpdate: (node: MapNode) => MapNode;
  submit: (formData: FormData) => Promise<ProjectRecord>;
  fields: Record<string, string>;
  successTitle: string;
  successDescription: string;
  errorTitle: string;
  onProjectUpdated?: (project: ProjectRecord, options?: import("~/lib/projects/optimistic").ProjectUpdateOptions) => void;
  setPending: (value: boolean) => void;
}) {
  input.setPending(true);
  const previousProject = input.project;
  const clientMutationId = createClientMutationId();
  input.onProjectUpdated?.(
    updateProjectNode(input.project, input.node.id, input.clientUpdate),
    { clientMutationId, phase: "optimistic" },
  );
  try {
    const result = await input.submit(
      appendClientMutationId(
        createNodeFormData(input.project.id, input.node.id, input.fields),
        clientMutationId,
      ),
    );
    input.onProjectUpdated?.(result, { clientMutationId, phase: "server" });
    toaster.success({
      title: input.successTitle,
      description: input.successDescription,
    });
  } catch (error) {
    input.onProjectUpdated?.(previousProject, { clientMutationId, phase: "server" });
    toaster.error({
      title: input.errorTitle,
      description: error instanceof Error ? error.message : "The grid value could not be updated.",
    });
  } finally {
    input.setPending(false);
  }
}

function ImagePreviewCell(props: { node: MapNode }) {
  const imageUi = useSpatialMapImages();
  const images = () => props.node.images ?? [];
  const image = () => images()[0];

  return (
    <Show
      when={image()}
      fallback={null}
    >
      {(previewImage) => (
        <GridButton
          type="button"
          position="relative"
          display="block"
          w="52px"
          maxW="100%"
          aspectRatio="16 / 9"
          p="0"
          border="1px solid rgba(34, 41, 36, 0.28)"
          background="rgba(18, 22, 19, 0.08)"
          cursor="zoom-in"
          overflow="hidden"
          _hover={{ outline: "none", borderColor: "rgba(23, 62, 39, 0.68)", boxShadow: "inset 0 0 0 1px rgba(23, 62, 39, 0.32)" }}
          _focusVisible={{ outline: "none", borderColor: "rgba(23, 62, 39, 0.68)", boxShadow: "inset 0 0 0 1px rgba(23, 62, 39, 0.32)" }}
          aria-label={`Open ${previewImage().originalName}`}
          title={previewImage().originalName}
          onClick={(event) => {
            event.stopPropagation();
            imageUi.openImage(previewImage(), props.node, images());
          }}
        >
          <GridImage
            src={previewImage().src}
            alt={previewImage().originalName}
            loading="lazy"
            display="block"
            w="100%"
            h="100%"
            objectFit="cover"
          />
          <Show when={images().length > 1}>
            <Box as="span" position="absolute" right="4px" bottom="4px" minW="24px" p="2px 5px" border="1px solid rgba(34, 41, 36, 0.24)" background="rgba(249, 250, 247, 0.92)" color="var(--spatial-map-copy)" fontSize="10px" fontWeight="760" lineHeight="1">
              +{images().length - 1}
            </Box>
          </Show>
        </GridButton>
      )}
    </Show>
  );
}

function formatLinkRelationship(link: MapLink) {
  return link.relationship ?? "related";
}

function getNodeContext(node: MapNode) {
  return (node.context || node.rawContext).trim();
}

function normalizeSearchQuery(value: string) {
  return value.trim().toLocaleLowerCase();
}

function getNodesSummary(filteredCount: number, totalCount: number, query: string) {
  if (!normalizeSearchQuery(query)) {
    return `${totalCount} visible nodes`;
  }

  return `${filteredCount} of ${totalCount} visible nodes`;
}

function GridEmpty(props: { children: string }) {
  return (
    <Box m="12px" p="14px" border="1px solid rgba(34, 41, 36, 0.16)" background="rgba(244, 246, 242, 0.82)" color="var(--spatial-map-copy-muted)" fontSize="11px" lineHeight="1.35" letterSpacing="0.04em">
      {props.children}
    </Box>
  );
}

function buildNodeGridRows(nodes: MapNode[], links: MapLink[]): NodeGridRow[] {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const childIdsByParentId = new Map<string, string[]>();
  const parentIdByChildId = new Map<string, string>();

  for (const link of links) {
    if (!nodesById.has(link.source) || !nodesById.has(link.target)) {
      continue;
    }
    if (parentIdByChildId.has(link.target)) {
      continue;
    }

    const childIds = childIdsByParentId.get(link.source) ?? [];
    childIds.push(link.target);
    childIdsByParentId.set(link.source, childIds);
    parentIdByChildId.set(link.target, link.source);
  }

  const roots = nodes.filter(
    (node) => !parentIdByChildId.has(node.id),
  );
  const rows: NodeGridRow[] = [];
  const visited = new Set<string>();

  const visit = (
    node: MapNode,
    depth: number,
    isLastSibling: boolean,
    ancestorHasNextSibling: boolean[],
    pathNodeIds: string[],
  ) => {
    if (visited.has(node.id) || pathNodeIds.includes(node.id)) {
      return;
    }

    visited.add(node.id);
    const nextPathNodeIds = [...pathNodeIds, node.id];
    const childIds = childIdsByParentId.get(node.id) ?? [];

    rows.push({
      node,
      depth,
      ancestorHasNextSibling,
      hasChildren: childIds.length > 0,
      isLastSibling,
      parentNodeId: pathNodeIds.at(-1) ?? null,
      pathKey: nextPathNodeIds.join("/"),
    });

    const childAncestorHasNextSibling =
      depth === 0
        ? []
        : [...ancestorHasNextSibling, !isLastSibling];

    childIds.forEach((childId, index) => {
      const child = nodesById.get(childId);
      if (child) {
        visit(
          child,
          depth + 1,
          index === childIds.length - 1,
          childAncestorHasNextSibling,
          nextPathNodeIds,
        );
      }
    });
  };

  roots.forEach((node, index) => {
    visit(node, 0, index === roots.length - 1, [], []);
  });

  nodes
    .filter((node) => !visited.has(node.id))
    .forEach((node, index, remainingNodes) => {
      visit(node, 0, index === remainingNodes.length - 1, [], []);
    });

  return rows;
}

function isTextEntryTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    target.isContentEditable
  );
}

function getNodeGridStyle(columns: Array<{ width: number }>) {
  const tableWidth = `${columns.reduce((sum, column) => sum + column.width, 0)}px`;

  return {
    "min-width": tableWidth,
    width: `max(100%, ${tableWidth})`,
  };
}

function getNodeGridColumns(
  metadataFields: ProjectNodeMetadataField[],
  getColumnWidth: (columnKey: string, fallback: number) => number,
) {
  return [
    {
      key: "select",
      width: DEFAULT_NODE_COLUMN_WIDTHS.select,
    },
    {
      key: "name",
      width: getColumnWidth("name", DEFAULT_NODE_COLUMN_WIDTHS.name),
    },
    {
      key: "type",
      width: getColumnWidth("type", DEFAULT_NODE_COLUMN_WIDTHS.type),
    },
    {
      key: "status",
      width: getColumnWidth("status", DEFAULT_NODE_COLUMN_WIDTHS.status),
    },
    {
      key: "priority",
      width: getColumnWidth("priority", DEFAULT_NODE_COLUMN_WIDTHS.priority),
    },
    ...metadataFields.map((field) => ({
      key: `metadata:${field.key}`,
      width: getColumnWidth(`metadata:${field.key}`, DEFAULT_NODE_COLUMN_WIDTHS.metadata),
    })),
    {
      key: "image",
      width: getColumnWidth("image", DEFAULT_NODE_COLUMN_WIDTHS.image),
    },
    {
      key: "actions",
      width: getColumnWidth("actions", DEFAULT_NODE_COLUMN_WIDTHS.actions),
    },
  ];
}

function createNodeFormData(projectId: string, nodeId: string, fields: Record<string, string>) {
  const formData = new FormData();
  formData.set("projectId", projectId);
  formData.set("nodeId", nodeId);
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}
