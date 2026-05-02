import { useAction } from "@solidjs/router";
import { ChevronDown, ChevronRight, FileText, Trash2 } from "lucide-solid";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { Portal } from "solid-js/web";
import { css } from "styled-system/css";
import { Box, HStack, styled } from "styled-system/jsx";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import * as HoverCard from "~/components/ui/hover-card";
import { Input } from "~/components/ui/input";
import { SimpleDialog } from "~/components/ui/simple-dialog";
import { toaster } from "~/components/ui/toast";
import { Tooltip } from "~/components/ui/tooltip";
import { deleteProjectLink } from "~/lib/projects/data";
import type {
  ProjectNodeMetadataField,
  ProjectRecord,
} from "~/lib/projects/types";
import type { MapLink, MapNode } from "~/lib/spatial-map/types";
import { SpatialMapDeleteNodeControl } from "./SpatialMapDeleteNodeControl";
import { useSpatialMap } from "./SpatialMapContext";
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

export function SpatialMapGridView(props: {
  project: ProjectRecord;
  onProjectUpdated?: (project: ProjectRecord) => void;
}) {
  const spatialMap = useSpatialMap();
  const [mode, setMode] = createSignal<SpatialMapGridMode>("nodes");
  const [selectedMetadataKeys, setSelectedMetadataKeys] = createSignal(
    props.project.nodeMetadataSchema.map((field) => field.key),
  );
  const [nodeSearchQuery, setNodeSearchQuery] = createSignal("");
  let searchInputRef: HTMLInputElement | undefined;
  const nodes = createMemo(() => spatialMap.visibleData().nodes.slice());
  const hierarchyLinks = createMemo(() =>
    spatialMap.visibleData().links.filter((link) => link.parentChild),
  );
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
          <NodesGrid
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
        </Show>
      </Box>
    </Box>
  );
}

function NodesGrid(props: {
  rows: NodeGridRow[];
  searchQuery: string;
  project: ProjectRecord;
  metadataFields: ProjectNodeMetadataField[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
  onProjectUpdated?: (project: ProjectRecord) => void;
}) {
  let gridWrapRef: HTMLDivElement | undefined;
  const rowElements = new Map<string, HTMLTableRowElement>();
  const [treeGridActive, setTreeGridActive] = createSignal(false);
  const [collapsedNodeIds, setCollapsedNodeIds] = createSignal<Set<string>>(new Set());
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
      return;
    }

    if (!visibleRows().some((row) => row.node.id === selectedNodeId)) {
      return;
    }

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
        <Box class="spatial-map-grid-table-x" display="grid" gridTemplateRows="auto minmax(0, 1fr)" h="100%" style={getNodeGridStyle(props.metadataFields)}>
          <table class="spatial-map-grid-table spatial-map-grid-table--nodes" role="treegrid">
            <GridColGroup mode="nodes" metadataFields={props.metadataFields} />
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Type</th>
                <th scope="col">Status</th>
                <For each={props.metadataFields}>
                  {(field) => <th scope="col">{field.label}</th>}
                </For>
                <th scope="col">Image</th>
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
              <GridColGroup mode="nodes" metadataFields={props.metadataFields} />
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
                      onKeyDown={handleTreeGridKeyDown}
                    >
                      <td>
                        <NodeNameCell
                          row={row}
                          node={row.node}
                          expanded={isExpanded(row)}
                          onToggleExpanded={() => toggleRowExpanded(row)}
                          onTreeKeyDown={handleTreeGridKeyDown}
                          searchQuery={props.searchQuery}
                        />
                      </td>
                      <td>
                        <Badge variant="spatial" size="sm">{row.node.type}</Badge>
                      </td>
                      <td>
                        <Badge variant="spatial" size="sm">{row.node.status}</Badge>
                      </td>
                      <For each={props.metadataFields}>
                        {(field) => <MetadataValueCell node={row.node} field={field} />}
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
  onProjectUpdated?: (project: ProjectRecord) => void;
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
  metadataFields?: ProjectNodeMetadataField[];
}) {
  const nodeColumnWidths = () => getNodeGridColumnWidths(props.metadataFields ?? []);

  return (
    <colgroup>
      <Show when={props.mode === "nodes"}>
        <col style={{ width: nodeColumnWidths()[0] }} />
        <col style={{ width: nodeColumnWidths()[1] }} />
        <For each={props.metadataFields ?? []}>
          {(_, index) => <col style={{ width: nodeColumnWidths()[2 + index()] }} />}
        </For>
        <col
          style={{
            width: nodeColumnWidths()[nodeColumnWidths().length - 2],
          }}
        />
        <col
          style={{
            width: nodeColumnWidths()[nodeColumnWidths().length - 1],
          }}
        />
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
  onProjectUpdated?: (project: ProjectRecord) => void;
}) {
  return (
    <Box display="flex" alignItems="center" gap="4px" onClick={(event) => event.stopPropagation()}>
      <SpatialMapDeleteNodeControl
        projectId={props.project.id}
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
  onProjectUpdated?: (project: ProjectRecord) => void;
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

    setPending(true);
    try {
      const result = await submitDeleteLink(formData);
      props.onProjectUpdated?.(result);
      setOpen(false);
      toaster.success({
        title: "Link deleted",
        description: `${props.source.label} -> ${props.target.label} was removed.`,
      });
    } catch (error) {
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
  expanded: boolean;
  onToggleExpanded: () => void;
  onTreeKeyDown: (event: KeyboardEvent) => void;
  searchQuery?: string;
}) {
  const spatialMap = useSpatialMap();
  const context = createMemo(() => getNodeContext(props.node));
  const hasContext = createMemo(() => context().length > 0);

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
      >
        <HighlightedText
          text={props.node.label}
          query={props.searchQuery ?? ""}
        />
        <Show when={hasContext()}>
          <HoverCard.Root
            openDelay={180}
            closeDelay={90}
            positioning={{ placement: "right-start", offset: { mainAxis: 8 } }}
          >
            <HoverCard.Trigger
              asChild={(triggerProps) => (
                <GridButton
                  {...triggerProps()}
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
                  aria-label={`Preview context for ${props.node.label}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    spatialMap.openContextPreview(props.node.id);
                  }}
                >
                  <FileText size={14} aria-hidden="true" />
                </GridButton>
              )}
            />
            <Portal>
              <HoverCard.Positioner>
                <HoverCard.Content
                  w="min(360px, calc(100vw - 32px))"
                  maxH="260px"
                  gap="8px"
                  p="12px"
                  border="1px solid rgba(44, 52, 46, 0.2)"
                  borderRadius="4px"
                  background="rgba(250, 252, 249, 0.98)"
                  color="var(--spatial-map-copy)"
                  boxShadow="0 16px 36px rgba(24, 29, 26, 0.16)"
                >
                  <HoverCard.Arrow>
                    <HoverCard.ArrowTip />
                  </HoverCard.Arrow>
                  <Box color="#141816" fontSize="11px" fontWeight="760" lineHeight="1.2">
                    {props.node.label}
                  </Box>
                  <Box maxH="198px" overflow="hidden" color="var(--spatial-map-copy-muted)" fontSize="11px" lineHeight="1.45" whiteSpace="pre-wrap">
                    {context()}
                  </Box>
                </HoverCard.Content>
              </HoverCard.Positioner>
            </Portal>
          </HoverCard.Root>
        </Show>
      </Box>
    </Box>
  );
}

function HighlightedText(props: { text: string; query: string }) {
  const segments = createMemo(() =>
    getHighlightedSegments(props.text, props.query),
  );

  return (
    <Box as="span" display="inline">
      <For each={segments()}>
        {(segment) => (
          <Show when={segment.match} fallback={segment.text}>
            <mark>{segment.text}</mark>
          </Show>
        )}
      </For>
    </Box>
  );
}

function MetadataValueCell(props: {
  node: MapNode;
  field: ProjectNodeMetadataField;
}) {
  const value = createMemo(() => props.node.metadata[props.field.key]?.trim() ?? "");

  return (
    <Show
      when={value().length > 0}
      fallback={<td><Box as="span" color="var(--spatial-map-copy-dim)" fontSize="11px">None</Box></td>}
    >
      <td>
        <Badge
          variant="spatial"
          size="sm"
          maxW="100%"
          minW="0"
          overflow="hidden"
        >
          <Box as="span" minW="0" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
            {value()}
          </Box>
        </Badge>
      </td>
    </Show>
  );
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

function getHighlightedSegments(text: string, query: string) {
  const normalizedQuery = normalizeSearchQuery(query);
  if (!normalizedQuery) {
    return [{ text, match: false }];
  }

  const normalizedText = text.toLocaleLowerCase();
  const segments: Array<{ text: string; match: boolean }> = [];
  let cursor = 0;
  let matchIndex = normalizedText.indexOf(normalizedQuery);

  while (matchIndex !== -1) {
    if (matchIndex > cursor) {
      segments.push({ text: text.slice(cursor, matchIndex), match: false });
    }

    const matchEnd = matchIndex + normalizedQuery.length;
    segments.push({ text: text.slice(matchIndex, matchEnd), match: true });
    cursor = matchEnd;
    matchIndex = normalizedText.indexOf(normalizedQuery, cursor);
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), match: false });
  }

  return segments.length > 0 ? segments : [{ text, match: false }];
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

function getNodeGridStyle(metadataFields: ProjectNodeMetadataField[]) {
  const columns = getNodeGridColumnWidths(metadataFields);
  const tableWidth = `${columns.reduce((sum, column) => sum + Number.parseInt(column, 10), 0)}px`;

  return {
    "min-width": tableWidth,
    width: `max(100%, ${tableWidth})`,
  };
}

function getNodeGridColumnWidths(metadataFields: ProjectNodeMetadataField[]) {
  return [
    "270px",
    "104px",
    "116px",
    ...metadataFields.map(() => "220px"),
    "160px",
    "92px",
  ];
}
