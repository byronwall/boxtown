import { ArchiveIcon, ClipboardIcon, MoreHorizontalIcon, Trash2 } from "lucide-solid";
import { createSignal } from "solid-js";
import { HStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import * as Menu from "~/components/ui/menu";
import { SimpleDialog } from "~/components/ui/simple-dialog";
import { Text } from "~/components/ui/text";
import { Tooltip } from "~/components/ui/tooltip";
import type { ProjectUpdateOptions } from "~/lib/projects/optimistic";
import type { ProjectRecord } from "~/lib/projects/types";
import {
  archivedNodeLabel,
  createArchiveImplementedAction,
  createDeleteArchivedAction,
} from "./spatial-map-archive-actions";
import { useSpatialMap } from "./SpatialMapContext";
import { copyVisibleNodesAsMarkdown } from "./spatial-map-markdown-export";

// Project-wide actions for the toolbar `...` menu, available in every view.
export function SpatialMapProjectActionsMenu(props: {
  project: ProjectRecord;
  onProjectUpdated?: (project: ProjectRecord, options?: ProjectUpdateOptions) => void;
}) {
  const spatialMap = useSpatialMap();
  const archiveImplemented = createArchiveImplementedAction(props);
  const deleteArchived = createDeleteArchivedAction(props);
  // The menu unmounts its content on close, so the confirm dialog lives here.
  const [confirmDeleteOpen, setConfirmDeleteOpen] = createSignal(false);
  let confirmButtonRef: HTMLButtonElement | undefined;
  // Hide the trigger tooltip while the menu is open so it never covers the first item.
  const [menuOpen, setMenuOpen] = createSignal(false);
  const [tooltipOpen, setTooltipOpen] = createSignal(false);

  const confirmDelete = () => {
    setConfirmDeleteOpen(false);
    void deleteArchived.run();
  };

  return (
    <>
      <Menu.Root
        positioning={{ placement: "bottom-end", gutter: 4 }}
        size="sm"
        onOpenChange={(details) => setMenuOpen(details.open)}
      >
        <Menu.Trigger
          asChild={(triggerProps) => (
            <Tooltip
              content="More actions"
              openDelay={150}
              closeDelay={80}
              open={tooltipOpen() && !menuOpen()}
              onOpenChange={(details) => setTooltipOpen(details.open)}
            >
              <Button
                {...triggerProps()}
                variant="outline"
                size="2xs"
                px="0"
                aria-label="More map actions"
              >
                <MoreHorizontalIcon size={14} aria-hidden="true" />
              </Button>
            </Tooltip>
          )}
        />
        <Menu.Positioner>
          <Menu.Content minW="230px" borderRadius="0" fontFamily="inherit" textTransform="none">
            <Menu.Item
              value="copy-visible-nodes-markdown"
              onClick={() => void copyVisibleNodesAsMarkdown(props.project, spatialMap.visibleData())}
            >
              <ClipboardIcon size={14} aria-hidden="true" />
              <Menu.ItemText>Copy visible nodes as Markdown</Menu.ItemText>
            </Menu.Item>
            <Menu.Separator />
            <Menu.Item
              value="archive-implemented"
              disabled={archiveImplemented.pending() || archiveImplemented.count() === 0}
              onClick={() => void archiveImplemented.run()}
            >
              <ArchiveIcon size={14} aria-hidden="true" />
              <Menu.ItemText>Archive implemented</Menu.ItemText>
              <MenuCount value={archiveImplemented.count()} />
            </Menu.Item>
            <Menu.Item
              value="delete-archived"
              disabled={deleteArchived.pending() || deleteArchived.count() === 0}
              onClick={() => setConfirmDeleteOpen(true)}
            >
              <Trash2 size={14} aria-hidden="true" />
              <Menu.ItemText>Delete archived</Menu.ItemText>
              <MenuCount value={deleteArchived.count()} />
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Menu.Root>

      <SimpleDialog
        open={confirmDeleteOpen()}
        onOpenChange={setConfirmDeleteOpen}
        title="Delete archived nodes"
        description={`Delete ${archivedNodeLabel(deleteArchived.count())}?`}
        maxW="520px"
        initialFocusEl={() => confirmButtonRef ?? null}
        footer={
          <HStack justifyContent="flex-end" flexWrap="wrap">
            <Button variant="outline" type="button" onClick={() => setConfirmDeleteOpen(false)}>
              Cancel
            </Button>
            <Button ref={confirmButtonRef} type="button" variant="danger" onClick={confirmDelete}>
              Delete {archivedNodeLabel(deleteArchived.count())}
            </Button>
          </HStack>
        }
      >
        <Text fontSize="12px" lineHeight="1.45" color="var(--spatial-map-copy-dim)">
          This permanently removes every archived node, the children hidden under them, their
          links, and their images. It cannot be undone.
        </Text>
      </SimpleDialog>
    </>
  );
}

function MenuCount(props: { value: number }) {
  return (
    <Text
      as="span"
      ml="auto"
      color="var(--spatial-map-copy-dim)"
      fontSize="11px"
      fontVariantNumeric="tabular-nums"
    >
      {props.value}
    </Text>
  );
}
