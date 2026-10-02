import { For, Show, createMemo, createSignal, type JSX } from "solid-js";
import { ClipboardIcon, FilePlusIcon, PlusIcon, SettingsIcon } from "lucide-solid";
import { Box, styled } from "styled-system/jsx";
import { Text } from "~/components/ui/text";
import type { ProjectUpdateOptions } from "~/lib/projects/optimistic";
import type { ProjectOperationLogEntry, ProjectRecord } from "~/lib/projects/types";
import { getMapNodeStatusLabel } from "~/lib/spatial-map/node-status";
import { mapNodeStatuses } from "~/lib/spatial-map/types";
import { ProjectMetadataSettingsDialog } from "./ProjectMetadataSettingsDialog";
import { copyVisibleNodesAsMarkdown } from "./spatial-map-markdown-export";
import { useSpatialMap } from "./SpatialMapContext";
import { SpatialMapCreateContextNodeDialog } from "./SpatialMapCreateContextNodeDialog";
import { SpatialMapActivityList } from "./SpatialMapInspectorActivity";
import {
  SpatialMapEmptyState,
  SpatialMapInspectorSection,
  SpatialMapSectionHeader,
} from "./SpatialMapPanelPrimitives";

const ActionRowButton = styled("button");

// Shown in the inspector when no node is selected: what the project holds,
// what can be started from here, and where work happened most recently.
export function SpatialMapInspectorEmpty(props: {
  project: ProjectRecord;
  recentActivity: ProjectOperationLogEntry[];
  onProjectUpdated?: (project: ProjectRecord, options?: ProjectUpdateOptions) => void;
  onSelectNode: (nodeId: string) => void;
}) {
  const spatialMap = useSpatialMap();
  const [contextNodeDialogOpen, setContextNodeDialogOpen] = createSignal(false);

  const summary = createMemo(() => {
    const nodes = props.project.spatialMap.nodes.filter((node) => !node.archived);
    const byStatus = mapNodeStatuses
      .map((status) => ({
        label: getMapNodeStatusLabel(status).toLowerCase(),
        count: nodes.filter((node) => node.status === status).length,
      }))
      .filter((item) => item.count > 0);
    return { total: nodes.length, byStatus };
  });

  // The node draft only renders on the canvas, so switch there first and wait
  // a frame for the canvas camera before placing the draft.
  const createRootNode = () => {
    if (spatialMap.viewMode() === "canvas") {
      spatialMap.openChildNodeDraft(null);
      return;
    }

    spatialMap.setViewMode("canvas");
    requestAnimationFrame(() => spatialMap.openChildNodeDraft(null));
  };

  return (
    <>
      <SpatialMapEmptyState>
        Select a node to see its details.
        <Show when={summary().total > 0}>
          {" "}
          {summary().total} {summary().total === 1 ? "node" : "nodes"}
          <For each={summary().byStatus}>{(item) => ` · ${item.count} ${item.label}`}</For>
          .
        </Show>
      </SpatialMapEmptyState>

      <SpatialMapInspectorSection gap="0px">
        <ActionRow icon={<PlusIcon size={13} />} label="New node" hint="C" onClick={createRootNode} />
        <ActionRow
          icon={<FilePlusIcon size={13} />}
          label="New context node"
          onClick={() => setContextNodeDialogOpen(true)}
        />
        <ActionRow
          icon={<ClipboardIcon size={13} />}
          label="Copy visible nodes as Markdown"
          onClick={() => void copyVisibleNodesAsMarkdown(props.project, spatialMap.visibleData())}
        />
        <ProjectMetadataSettingsDialog
          project={props.project}
          onProjectUpdated={props.onProjectUpdated}
          trigger={(open) => (
            <ActionRow icon={<SettingsIcon size={13} />} label="Project settings" onClick={() => open()} />
          )}
        />
        <ActionRow label="Search nodes and projects" hint="⌘K" />
        <SpatialMapCreateContextNodeDialog
          project={props.project}
          onProjectUpdated={props.onProjectUpdated}
          open={contextNodeDialogOpen()}
          onOpenChange={setContextNodeDialogOpen}
          trigger={() => null}
        />
      </SpatialMapInspectorSection>

      <SpatialMapInspectorSection>
        <SpatialMapSectionHeader title="Recent activity" />
        <SpatialMapActivityList
          entries={props.recentActivity}
          emptyLabel="No activity yet"
          nodeById={spatialMap.sourceNodesById()}
          selectedNodeId={spatialMap.selectedNodeId()}
          showNode
          onSelect={props.onSelectNode}
        />
      </SpatialMapInspectorSection>
    </>
  );
}

// A row without onClick is a keyboard-shortcut reminder rather than a button.
function ActionRow(props: { icon?: JSX.Element; label: string; hint?: string; onClick?: () => void }) {
  const content = () => (
    <>
      <Box as="span" display="inline-flex" color="var(--spatial-map-copy-dim)" aria-hidden="true">
        {props.icon}
      </Box>
      <Text as="span" color="var(--spatial-map-copy)" fontSize="12px" lineHeight="1.35">
        {props.label}
      </Text>
      <Show when={props.hint}>
        <Text as="kbd" color="var(--spatial-map-copy-dim)" fontFamily="mono" fontSize="11px">
          {props.hint}
        </Text>
      </Show>
    </>
  );

  return (
    <Show
      when={props.onClick}
      fallback={
        <Box display="grid" gridTemplateColumns="14px minmax(0, 1fr) auto" alignItems="center" columnGap="6px" minH="24px" p="0 4px">
          {content()}
        </Box>
      }
    >
      <ActionRowButton
        _active={{ transform: "scale(0.99)", background: "rgba(34, 41, 36, 0.1)" }}
        type="button"
        display="grid"
        gridTemplateColumns="14px minmax(0, 1fr) auto"
        alignItems="center"
        columnGap="6px"
        w="100%"
        minH="24px"
        p="0 4px"
        border="0"
        borderRadius="4px"
        background="transparent"
        font="inherit"
        textAlign="left"
        cursor="pointer"
        _hover={{ background: "rgba(34, 41, 36, 0.06)" }}
        _focusVisible={{ outline: "none", boxShadow: "inset 0 0 0 1px rgba(60, 66, 62, 0.56)" }}
        onClick={() => props.onClick?.()}
      >
        {content()}
      </ActionRowButton>
    </Show>
  );
}
