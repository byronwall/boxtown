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
import { Box, HStack } from "styled-system/jsx";

import { Button } from "~/components/ui/button";
import * as HoverCard from "~/components/ui/hover-card";
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
    <Box class="spatial-map-grid-viewport">
      <Box class="spatial-map-grid-panel">
        <Box class="spatial-map-grid-header">
          <HStack justifyContent="space-between" class="spatial-map-grid-header-main">
            <Box class="spatial-map-grid-heading">
              <Box as="h2" class="spatial-map-grid-title">
                Metadata grid
              </Box>
              <Box class="spatial-map-grid-summary">
                {mode() === "nodes"
                  ? getNodesSummary(filteredNodes().length, nodes().length, nodeSearchQuery())
                  : `${links().length} visible non-hierarchy links`}
              </Box>
            </Box>
            <HStack gap="12px" class="spatial-map-grid-header-controls">
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
                <label class="spatial-map-grid-search">
                  <span class="spatial-map-grid-search-field">
                    <input
                      ref={searchInputRef}
                      type="search"
                      aria-label="Filter node names"
                      value={nodeSearchQuery()}
                      placeholder="Filter node names"
                      onInput={(event) => setNodeSearchQuery(event.currentTarget.value)}
                    />
                    <kbd>/</kbd>
                  </span>
                </label>
              </Show>
              <HStack
                gap="0"
                class="spatial-map-toggle-group spatial-map-grid-mode-toggle"
                aria-label="Grid mode"
              >
                <button
                  type="button"
                  class={`spatial-map-grid-mode-button${mode() === "nodes" ? " is-active" : ""}`}
                  aria-pressed={mode() === "nodes"}
                  onClick={() => setMode("nodes")}
                >
                  Nodes
                </button>
                <button
                  type="button"
                  class={`spatial-map-grid-mode-button${mode() === "links" ? " is-active" : ""}`}
                  aria-pressed={mode() === "links"}
                  onClick={() => setMode("links")}
                >
                  Links
                </button>
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
      class="spatial-map-grid-table-wrap"
      tabIndex={0}
      onKeyDown={handleTreeGridKeyDown}
      onFocusIn={() => setTreeGridActive(true)}
    >
      <Show
        when={visibleRows().length > 0}
        fallback={<Box class="spatial-map-grid-empty">No visible nodes.</Box>}
      >
        <Box class="spatial-map-grid-table-x" style={getNodeGridStyle(props.metadataFields)}>
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
          <Box class="spatial-map-grid-table-body-scroll">
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
                        <span class="spatial-map-grid-data-chip">{row.node.type}</span>
                      </td>
                      <td>
                        <span class="spatial-map-grid-data-chip">{row.node.status}</span>
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
    <Box class="spatial-map-grid-table-wrap">
      <Show
        when={props.links.length > 0}
        fallback={
          <Box class="spatial-map-grid-empty">
            No non-hierarchy links are visible.
          </Box>
        }
      >
        <Box class="spatial-map-grid-table-x spatial-map-grid-table-x--links">
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
          <Box class="spatial-map-grid-table-body-scroll">
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
                        <span class="spatial-map-grid-link-chip">
                          {formatLinkRelationship(entry.link)}
                        </span>
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
        <col class="spatial-map-grid-col-node" />
        <col class="spatial-map-grid-col-meta" />
        <col class="spatial-map-grid-col-connected" />
        <col class="spatial-map-grid-col-actions" />
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
      <Box class="spatial-map-grid-metadata-picker" aria-label="Metadata columns">
        <span>Columns</span>
        <For each={props.fields}>
          {(field) => {
            const selected = () => props.selectedKeys.includes(field.key);
            return (
              <button
                type="button"
                class={`spatial-map-grid-metadata-toggle${selected() ? " is-active" : ""}`}
                aria-pressed={selected()}
                onClick={() => props.onToggle(field.key)}
              >
                {field.label}
              </button>
            );
          }}
        </For>
      </Box>
    </Show>
  );
}

function NodeActionsCell(props: {
  project: ProjectRecord;
  node: MapNode;
  onProjectUpdated?: (project: ProjectRecord) => void;
}) {
  return (
    <Box
      class="spatial-map-grid-actions"
      onClick={(event) => event.stopPropagation()}
    >
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
    <Box
      class="spatial-map-grid-actions"
      onClick={(event) => event.stopPropagation()}
    >
      <Tooltip content="Delete link" openDelay={150} closeDelay={80}>
        <Button
          size="xs"
          variant="outline"
          class="spatial-map-button spatial-map-button--danger spatial-map-icon-button"
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
              class="spatial-map-button spatial-map-button--danger"
              onClick={() => {
                void deleteLink();
              }}
            >
              Delete
            </Button>
          </HStack>
        }
      >
        <Box class="spatial-map-grid-delete-copy">
          This removes only the relationship link. The connected nodes stay in the
          map.
        </Box>
      </SimpleDialog>
    </Box>
  );
}

function NodeCell(props: { node: MapNode }) {
  return (
    <Box class="spatial-map-grid-node-cell">
      <Box class="spatial-map-grid-node-title">{props.node.label}</Box>
      <HStack gap="1" flexWrap="wrap" class="spatial-map-grid-node-meta">
        <span>{props.node.type}</span>
        <span>{props.node.status}</span>
        <span>{props.node.id}</span>
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
    <Box class="spatial-map-grid-node-cell spatial-map-grid-node-cell--hierarchy">
      <Box class="spatial-map-grid-tree-gutter" aria-hidden="true">
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
        <button
          type="button"
          class="spatial-map-grid-tree-chevron"
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
        </button>
      </Show>
      <Box
        class={`spatial-map-grid-node-title${props.row.hasChildren ? " has-children" : " is-leaf"}`}
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
                <button
                  {...triggerProps()}
                  type="button"
                  class="spatial-map-grid-context-icon-button"
                  aria-label={`Preview context for ${props.node.label}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    spatialMap.openContextPreview(props.node.id);
                  }}
                >
                  <FileText size={14} aria-hidden="true" />
                </button>
              )}
            />
            <Portal>
              <HoverCard.Positioner>
                <HoverCard.Content class="spatial-map-grid-context-preview-card">
                  <HoverCard.Arrow>
                    <HoverCard.ArrowTip />
                  </HoverCard.Arrow>
                  <Box class="spatial-map-grid-context-preview-title">
                    {props.node.label}
                  </Box>
                  <Box class="spatial-map-grid-context-preview-body">
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
    <span class="spatial-map-grid-node-title-text">
      <For each={segments()}>
        {(segment) => (
          <Show when={segment.match} fallback={segment.text}>
            <mark>{segment.text}</mark>
          </Show>
        )}
      </For>
    </span>
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
      fallback={<td><span class="spatial-map-grid-muted">None</span></td>}
    >
      <td>
        <span class="spatial-map-grid-metadata-value">{value()}</span>
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
        <button
          type="button"
          class="spatial-map-grid-image-preview"
          aria-label={`Open ${previewImage().originalName}`}
          title={previewImage().originalName}
          onClick={(event) => {
            event.stopPropagation();
            imageUi.openImage(previewImage(), props.node, images());
          }}
        >
          <img
            src={previewImage().src}
            alt={previewImage().originalName}
            loading="lazy"
          />
          <Show when={images().length > 1}>
            <span>+{images().length - 1}</span>
          </Show>
        </button>
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
