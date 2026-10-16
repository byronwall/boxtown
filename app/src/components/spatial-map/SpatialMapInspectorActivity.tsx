import { For, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import {
  DatabaseBackupIcon,
  FilePlusIcon,
  GitBranchPlusIcon,
  HistoryIcon,
  ImageIcon,
  Link2OffIcon,
  MoveIcon,
  PencilIcon,
  PlusIcon,
  Settings2Icon,
  Trash2Icon,
} from "lucide-solid";
import { Box, styled } from "styled-system/jsx";
import { Text } from "~/components/ui/text";
import type { ProjectOperationLogEntry } from "~/lib/projects/types";
import type { MapNode } from "~/lib/spatial-map/types";
import { SpatialMapEmptyState } from "./SpatialMapPanelPrimitives";

const ActivityRowButton = styled("button");

type ActivityTone = "create" | "edit" | "image" | "delete" | "system" | "link";
type ActivityKindConfig = {
  label: string;
  tone: ActivityTone;
  icon: typeof HistoryIcon;
};

const ACTIVITY_TONE_COLORS: Record<ActivityTone, string> = {
  create: "rgba(42, 104, 67, 0.94)",
  edit: "rgba(82, 93, 61, 0.94)",
  image: "rgba(43, 101, 116, 0.94)",
  delete: "rgba(143, 68, 62, 0.96)",
  system: "rgba(92, 85, 117, 0.94)",
  link: "rgba(125, 91, 44, 0.94)",
};

export function SpatialMapActivityList(props: {
  entries: ProjectOperationLogEntry[];
  emptyLabel: string;
  nodeById: Map<string, MapNode>;
  selectedNodeId: string | null;
  // Node-scoped lists already imply the node, so the label is only shown for project-wide lists.
  showNode?: boolean;
  onSelect: (nodeId: string) => void;
}) {
  const getTargetNode = (entry: ProjectOperationLogEntry) => {
    const nodeId = entry.nodeIds.find((item) => props.nodeById.has(item));
    return nodeId ? props.nodeById.get(nodeId) ?? null : null;
  };

  return (
    <Box as="ul" m="0" p="0" listStyle="none" w="100%" minW="0">
      <For each={props.entries}>
        {(entry, index) => {
          const targetNode = getTargetNode(entry);
          const isCurrent = () =>
            Boolean(props.showNode && targetNode && props.selectedNodeId === targetNode.id);

          return (
            <Box
              as="li"
              minW="0"
              borderTop={index() === 0 ? "0" : "1px solid var(--spatial-map-panel-divider)"}
            >
              <Show
                when={targetNode}
                fallback={<ActivityRow entry={entry} />}
              >
                {(node) => (
                  <ActivityRowButton
                    _active={{ transform: "scale(0.99)", background: "rgba(34, 41, 36, 0.1)" }}
                    type="button"
                    display="block"
                    w="100%"
                    minW="0"
                    p="0"
                    border="0"
                    borderRadius="4px"
                    background={isCurrent() ? "rgba(233, 235, 232, 0.8)" : "transparent"}
                    color="inherit"
                    font="inherit"
                    textAlign="left"
                    cursor="pointer"
                    _hover={{ background: "rgba(34, 41, 36, 0.06)" }}
                    _focusVisible={{ outline: "none", boxShadow: "inset 0 0 0 1px rgba(60, 66, 62, 0.56)" }}
                    onClick={() => props.onSelect(node().id)}
                    aria-pressed={props.showNode ? isCurrent() : undefined}
                  >
                    <ActivityRow entry={entry} nodeLabel={props.showNode ? node().label : undefined} />
                  </ActivityRowButton>
                )}
              </Show>
            </Box>
          );
        }}
      </For>
      <Show when={props.entries.length === 0}>
        <Box as="li">
          <SpatialMapEmptyState>{props.emptyLabel}</SpatialMapEmptyState>
        </Box>
      </Show>
    </Box>
  );
}

function ActivityRow(props: { entry: ProjectOperationLogEntry; nodeLabel?: string }) {
  const config = () => getActivityKindConfig(props.entry.kind);
  const meta = () =>
    [config().label, formatActivityActor(props.entry), props.nodeLabel].filter(Boolean).join(" · ");

  return (
    <Box
      display="grid"
      gridTemplateColumns="14px minmax(0, 1fr) auto"
      columnGap="6px"
      alignItems="start"
      p="4px"
    >
      <Box
        as="span"
        display="inline-flex"
        pt="2px"
        style={{ color: ACTIVITY_TONE_COLORS[config().tone] }}
        aria-hidden="true"
      >
        <Dynamic component={config().icon} size={13} strokeWidth={2.2} />
      </Box>
      <Box minW="0">
        <Text
          as="div"
          margin="0"
          color="var(--spatial-map-copy)"
          fontSize="12px"
          lineHeight="1.35"
          overflowWrap="anywhere"
          overflow="hidden"
          display="-webkit-box"
          style={{ "-webkit-box-orient": "vertical", "-webkit-line-clamp": "2" }}
          title={props.entry.summary}
        >
          {props.entry.summary}
        </Text>
        <Text
          as="div"
          margin="0"
          color="var(--spatial-map-copy-dim)"
          fontSize="11px"
          lineHeight="1.3"
          overflow="hidden"
          textOverflow="ellipsis"
          whiteSpace="nowrap"
          title={meta()}
        >
          {meta()}
        </Text>
      </Box>
      <Text
        as="time"
        color="var(--spatial-map-copy-dim)"
        fontSize="11px"
        lineHeight="1.5"
        whiteSpace="nowrap"
        title={formatActivityDate(props.entry.createdAt)}
      >
        {formatRelativeActivityDate(props.entry.createdAt)}
      </Text>
    </Box>
  );
}

function getActivityKindConfig(kind: ProjectOperationLogEntry["kind"]): ActivityKindConfig {
  switch (kind) {
    case "node.image.deleted":
    case "node.deleted":
      return { label: "Deleted", tone: "delete", icon: Trash2Icon };
    case "node.images.added":
      return { label: "Image", tone: "image", icon: ImageIcon };
    case "node.metadata.updated":
    case "node.updated":
    case "node.context.updated":
    case "node.title.updated":
    case "node.status.updated":
    case "node.archive.updated":
    case "nodes.bulk.updated":
    case "node.priority.updated":
    case "node.type.updated":
      return { label: "Updated", tone: "edit", icon: PencilIcon };
    case "node.created":
      return { label: "Created", tone: "create", icon: PlusIcon };
    case "nodes.generated":
      return { label: "Generated", tone: "create", icon: GitBranchPlusIcon };
    case "context.nodes.imported":
      return { label: "Imported", tone: "create", icon: FilePlusIcon };
    case "project.schema.updated":
      return { label: "Schema", tone: "system", icon: Settings2Icon };
    case "project.backfilled":
      return { label: "Backfill", tone: "system", icon: DatabaseBackupIcon };
    case "link.deleted":
      return { label: "Link", tone: "link", icon: Link2OffIcon };
    case "node.moved":
      return { label: "Moved", tone: "link", icon: MoveIcon };
    case "project.created":
    default:
      return { label: "Project", tone: "system", icon: HistoryIcon };
  }
}

function formatActivityActor(entry: ProjectOperationLogEntry) {
  return entry.actor.label ?? (entry.actor.kind === "agent" ? "Agent" : "Human");
}

function formatActivityDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toISOString().slice(0, 16).replace("T", " ");
}

function formatRelativeActivityDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const diffMs = Date.now() - date.getTime();
  const absMs = Math.abs(diffMs);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (absMs < minute) return "now";
  if (absMs < hour) {
    const minutes = Math.max(1, Math.round(absMs / minute));
    return diffMs >= 0 ? `${minutes}m` : `in ${minutes}m`;
  }
  if (absMs < day) {
    const hours = Math.round(absMs / hour);
    return diffMs >= 0 ? `${hours}h` : `in ${hours}h`;
  }
  if (absMs < 7 * day) {
    const days = Math.round(absMs / day);
    return diffMs >= 0 ? `${days}d` : `in ${days}d`;
  }

  return date.toISOString().slice(0, 10);
}
