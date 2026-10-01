import { Show, createEffect, createSignal, on } from "solid-js";
import { Maximize2Icon } from "lucide-solid";
import { css } from "styled-system/css";
import { Box, HStack } from "styled-system/jsx";
import { MarkdownRenderer } from "~/components/markdown-renderer";
import { Button } from "~/components/ui/button";
import { IconButton } from "~/components/ui/icon-button";
import { SimpleDialog } from "~/components/ui/simple-dialog";
import { Textarea } from "~/components/ui/textarea";
import type { MapNode } from "~/lib/spatial-map/types";
import {
  SpatialMapEmptyState,
  SpatialMapInspectorSection,
  SpatialMapSectionHeader,
} from "./SpatialMapPanelPrimitives";

// MarkdownRenderer owns its descendant tags, so markdown spacing remains a
// component-local selector escape hatch rather than a global stylesheet rule.
const contextMarkdownClass = css({
  color: "var(--spatial-map-copy-muted)",
  fontSize: "12px",
  lineHeight: "1.5",
  "& :where(p, ul, ol, blockquote, pre, table)": {
    mb: "8px",
  },
  "& :where(p, ul, ol, blockquote, pre, table):last-child": {
    mb: "0",
  },
});

// SimpleDialog only accepts a content class for its surface.
const contextDialogClass = css({
  maxW: "min(800px, 90vw)",
  "& .dialog__body": {
    alignItems: "stretch",
  },
});

type ContextEditSession = {
  nodeId: string;
  original: string;
};

export function SpatialMapInspectorContextSection(props: {
  node: MapNode;
  pending: boolean;
  dialogOpen: boolean;
  onDialogOpenChange: (open: boolean) => void;
  onSave: (nodeId: string, context: string) => void;
}) {
  const [session, setSession] = createSignal<ContextEditSession | null>(null);
  const [draft, setDraft] = createSignal("");
  const hasContext = () => props.node.context.trim().length > 0;

  const startEditing = () => {
    if (props.pending || session()) return;
    setDraft(props.node.context);
    setSession({ nodeId: props.node.id, original: props.node.context });
  };

  // Clearing the session first makes the blur that follows Escape or an
  // unmount a no-op, so each edit is saved or discarded exactly once.
  const finishEditing = (save: boolean) => {
    const current = session();
    if (!current) return;
    setSession(null);
    if (save && draft() !== current.original) {
      props.onSave(current.nodeId, draft());
    }
  };

  // Selecting another node without blurring first should not drop the edit.
  createEffect(on(() => props.node.id, () => finishEditing(true), { defer: true }));

  const handlePreviewClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest("a, button, summary, input")) return;
    // Let people select and copy rendered text without dropping into the editor.
    if (window.getSelection()?.toString()) return;
    startEditing();
  };

  return (
    <SpatialMapInspectorSection>
      <SpatialMapSectionHeader title="Context">
        <Show when={hasContext() && !session()}>
          <IconButton
            variant="plain"
            size="2xs"
            color="var(--spatial-map-copy-dim)"
            aria-label="Open context in a large view"
            title="Open context in a large view"
            onClick={() => props.onDialogOpenChange(true)}
          >
            <Maximize2Icon size={13} />
          </IconButton>
        </Show>
      </SpatialMapSectionHeader>

      <Show
        when={session()}
        fallback={
          <Box
            role="button"
            tabIndex={0}
            p="6px 8px"
            mx="-8px"
            borderRadius="6px"
            cursor="text"
            aria-label="Edit context"
            title="Click to edit"
            _hover={{ background: "rgba(34, 41, 36, 0.05)" }}
            _focusVisible={{ outline: "none", boxShadow: "inset 0 0 0 1px rgba(37, 95, 58, 0.56)" }}
            onClick={handlePreviewClick}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget || event.key !== "Enter") return;
              event.preventDefault();
              startEditing();
            }}
          >
            <Show
              when={hasContext()}
              fallback={<SpatialMapEmptyState>Click to add markdown notes…</SpatialMapEmptyState>}
            >
              <ContextMarkdown context={props.node.context} />
            </Show>
          </Box>
        }
      >
        <Textarea
          ref={(element) => {
            queueMicrotask(() => {
              element.focus();
              element.setSelectionRange(element.value.length, element.value.length);
            });
          }}
          variant="spatial"
          size="sm"
          minH="96px"
          fontSize="12px"
          lineHeight="1.5"
          aria-label="Markdown context"
          placeholder="Markdown notes, requirements, pasted material…"
          value={draft()}
          onInput={(event) => setDraft(event.currentTarget.value)}
          onBlur={() => finishEditing(true)}
          onKeyDown={(event) => {
            // Keep canvas shortcuts from firing while typing.
            event.stopPropagation();
            if (event.key === "Escape") {
              event.preventDefault();
              finishEditing(false);
            } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              finishEditing(true);
            }
          }}
        />
        <SpatialMapEmptyState>Saves when you click away. Esc cancels.</SpatialMapEmptyState>
      </Show>

      <SimpleDialog
        open={props.dialogOpen}
        onOpenChange={props.onDialogOpenChange}
        title={`${props.node.label} Context`}
        description="Large markdown view for longer context notes and working material."
        maxW="min(800px, 90vw)"
        contentClass={contextDialogClass}
        footer={
          <HStack justifyContent="flex-end">
            <Button size="sm" variant="outline" onClick={() => props.onDialogOpenChange(false)}>
              Close
            </Button>
          </HStack>
        }
      >
        <Show
          when={hasContext()}
          fallback={<SpatialMapEmptyState>No context yet.</SpatialMapEmptyState>}
        >
          <ContextMarkdown context={props.node.context} />
        </Show>
      </SimpleDialog>
    </SpatialMapInspectorSection>
  );
}

function ContextMarkdown(props: { context: string }) {
  return (
    <Box class={contextMarkdownClass}>
      <MarkdownRenderer>{props.context}</MarkdownRenderer>
    </Box>
  );
}
