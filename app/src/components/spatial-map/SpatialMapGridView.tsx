import { useAction } from "@solidjs/router";
import { Trash2 } from "lucide-solid";
import { createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { Box, HStack } from "styled-system/jsx";

import { Button } from "~/components/ui/button";
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
  const nodes = createMemo(() =>
    spatialMap
      .visibleData()
      .nodes.slice()
      .sort((left, right) => left.label.localeCompare(right.label)),
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
          <GridColumnHeader
            mode={mode()}
            metadataFields={props.project.nodeMetadataSchema.filter((field) =>
              selectedMetadataKeys().includes(field.key),
            )}
          />
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
            nodes={filteredNodes()}
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
  nodes: MapNode[];
  searchQuery: string;
  project: ProjectRecord;
  metadataFields: ProjectNodeMetadataField[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
  onProjectUpdated?: (project: ProjectRecord) => void;
}) {
  return (
    <Box class="spatial-map-grid-table-wrap">
      <Show
        when={props.nodes.length > 0}
        fallback={<Box class="spatial-map-grid-empty">No visible nodes.</Box>}
      >
        <table
          class="spatial-map-grid-table spatial-map-grid-table--nodes"
          style={getNodeGridStyle(props.metadataFields)}
        >
          <GridColGroup mode="nodes" metadataFields={props.metadataFields} />
          <thead class="spatial-map-grid-native-head">
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Type</th>
              <th scope="col">Status</th>
              <th scope="col">Context</th>
              <For each={props.metadataFields}>
                {(field) => <th scope="col">{field.label}</th>}
              </For>
              <th scope="col">Image</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            <For each={props.nodes}>
              {(node) => (
                <tr
                  class={props.selectedNodeId === node.id ? "is-selected" : ""}
                  onClick={() => props.onSelectNode(node.id)}
                >
                  <td>
                    <NodeNameCell node={node} searchQuery={props.searchQuery} />
                  </td>
                  <td>
                    <span class="spatial-map-grid-data-chip">{node.type}</span>
                  </td>
                  <td>
                    <span class="spatial-map-grid-data-chip">{node.status}</span>
                  </td>
                  <td>
                    <ContextIndicatorCell node={node} />
                  </td>
                  <For each={props.metadataFields}>
                    {(field) => <MetadataValueCell node={node} field={field} />}
                  </For>
                  <td>
                    <ImagePreviewCell node={node} />
                  </td>
                  <td>
                    <NodeActionsCell
                      project={props.project}
                      node={node}
                      onProjectUpdated={props.onProjectUpdated}
                    />
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
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
        <table class="spatial-map-grid-table spatial-map-grid-table--links">
          <GridColGroup mode="links" />
          <thead class="spatial-map-grid-native-head">
            <tr>
              <th scope="col">Node</th>
              <th scope="col">Link metadata</th>
              <th scope="col">Connected node</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
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
        <col style={{ width: nodeColumnWidths()[2] }} />
        <col style={{ width: nodeColumnWidths()[3] }} />
        <For each={props.metadataFields ?? []}>
          {(_, index) => <col style={{ width: nodeColumnWidths()[4 + index()] }} />}
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

function GridColumnHeader(props: {
  mode: SpatialMapGridMode;
  metadataFields: ProjectNodeMetadataField[];
}) {
  return (
    <Box
      class={`spatial-map-grid-column-header${props.mode === "links" ? " spatial-map-grid-column-header--links" : ""}`}
      style={
        props.mode === "nodes" ? getNodeGridStyle(props.metadataFields) : undefined
      }
      aria-hidden="true"
    >
      <Show
        when={props.mode === "nodes"}
        fallback={
          <>
            <span>Node</span>
            <span>Link metadata</span>
            <span>Connected node</span>
            <span>Actions</span>
          </>
        }
      >
        <span>Name</span>
        <span>Type</span>
        <span>Status</span>
        <span>Context</span>
        <For each={props.metadataFields}>
          {(field) => <span>{field.label}</span>}
        </For>
        <span>Image</span>
        <span>Actions</span>
      </Show>
    </Box>
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

function NodeNameCell(props: { node: MapNode; searchQuery?: string }) {
  return (
    <Box class="spatial-map-grid-node-cell">
      <Box class="spatial-map-grid-node-title">
        <HighlightedText
          text={props.node.label}
          query={props.searchQuery ?? ""}
        />
      </Box>
    </Box>
  );
}

function HighlightedText(props: { text: string; query: string }) {
  const segments = createMemo(() =>
    getHighlightedSegments(props.text, props.query),
  );

  return (
    <>
      <For each={segments()}>
        {(segment) => (
          <Show when={segment.match} fallback={segment.text}>
            <mark>{segment.text}</mark>
          </Show>
        )}
      </For>
    </>
  );
}

function ContextIndicatorCell(props: { node: MapNode }) {
  const spatialMap = useSpatialMap();
  const hasContext = createMemo(() => getNodeContext(props.node).length > 0);

  return (
    <button
      type="button"
      class={`spatial-map-grid-context-button${hasContext() ? " has-context" : ""}`}
      aria-label={`${hasContext() ? "Open" : "Open empty"} context for ${props.node.label}`}
      title={`${hasContext() ? "Has context" : "No context"}: open viewer`}
      onClick={(event) => {
        event.stopPropagation();
        spatialMap.openContextPreview(props.node.id);
      }}
    >
      {hasContext() ? "Yes" : "No"}
    </button>
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
      fallback={<span class="spatial-map-grid-muted">No image</span>}
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
    "grid-template-columns": columns.join(" "),
    "min-width": tableWidth,
    width: `max(100%, ${tableWidth})`,
  };
}

function getNodeGridColumnWidths(metadataFields: ProjectNodeMetadataField[]) {
  return [
    "220px",
    "104px",
    "116px",
    "96px",
    ...metadataFields.map(() => "220px"),
    "160px",
    "92px",
  ];
}
