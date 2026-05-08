import { useAction } from "@solidjs/router";
import { createEffect, createMemo, createSignal, For, onCleanup, Show, untrack } from "solid-js";
import { Box, styled } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { toaster } from "~/components/ui/toast";
import { createProjectChildNode } from "~/lib/projects/data";
import { ensureProjectNodeTypeOptions } from "~/lib/projects/node-types";
import { appendClientMutationId, createClientMutationId } from "~/lib/projects/optimistic";
import type { ProjectRecord } from "~/lib/projects/types";
import { useSpatialMap } from "./SpatialMapContext";
import type { ChildNodeDraft, NodeVisualState } from "./spatial-map-canvas.types";

const SpatialMapForm = styled("form");
const SpatialMapSelect = styled("select");

export function SpatialMapChildNodePlaceholder(props: {
  draft: ChildNodeDraft;
  parentNode?: NodeVisualState["node"];
  project: ProjectRecord;
  onProjectUpdated?: (project: ProjectRecord, options?: import("~/lib/projects/optimistic").ProjectUpdateOptions) => void;
}) {
  const controller = useSpatialMap();
  const submitCreateProjectChildNode = useAction(createProjectChildNode);
  const [pending, setPending] = createSignal(false);
  const [title, setTitle] = createSignal("");
  const nodeTypeOptions = createMemo(() =>
    ensureProjectNodeTypeOptions(props.project.nodeTypeSchema, props.parentNode?.type),
  );
  const [nodeType, setNodeType] = createSignal(untrack(() =>
    props.parentNode?.type ?? nodeTypeOptions()[0]?.name ?? "page",
  ));
  const [context, setContext] = createSignal("");
  let formRef: HTMLFormElement | undefined;
  let textareaRef: HTMLTextAreaElement | undefined;
  let closeOnBlurTimer: number | undefined;

  const overlayStyle = createMemo(() => {
    const camera = controller.camera();
    return {
      left: `${((props.draft.x - camera.x) / camera.width) * 100}%`,
      top: `${((props.draft.y - camera.y) / camera.height) * 100}%`,
    };
  });

  createEffect(() => {
    textareaRef?.focus();
  });

  onCleanup(() => {
    if (closeOnBlurTimer !== undefined) {
      window.clearTimeout(closeOnBlurTimer);
    }
  });

  const scheduleCloseOnBlur = () => {
    if (closeOnBlurTimer !== undefined) {
      window.clearTimeout(closeOnBlurTimer);
    }

    closeOnBlurTimer = window.setTimeout(() => {
      closeOnBlurTimer = undefined;
      if (!formRef || untrack(pending)) {
        return;
      }
      const activeElement = document.activeElement;
      if (activeElement instanceof Node && formRef.contains(activeElement)) {
        return;
      }
      controller.clearChildNodeDraft();
    }, 0);
  };

  const createChildNode = async (
    nextTitle: string,
    nextType: string,
    nextContext: string,
  ) => {
    if (pending()) {
      return;
    }

    const formData = new FormData();
    formData.set("projectId", props.project.id);
    if (props.parentNode) {
      formData.set("parentNodeId", props.parentNode.id);
    }
    formData.set("type", nextType);
    formData.set("title", nextTitle);
    formData.set("context", nextContext);
    const clientMutationId = createClientMutationId();

    setPending(true);
    try {
      const result = await submitCreateProjectChildNode(appendClientMutationId(formData, clientMutationId));
      props.onProjectUpdated?.(result.project, { clientMutationId, phase: "server" });
      controller.clearChildNodeDraft();
      queueMicrotask(() => controller.setSelectedNodeId(result.nodeId));
    } catch (error) {
      toaster.error({
        title: "Child node was not created",
        description:
          error instanceof Error
            ? error.message
            : "The server action failed. Try again after the dev server reconnects.",
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <SpatialMapForm
      ref={formRef}
      position="absolute"
      zIndex="30"
      w="min(300px, calc(100% - 24px))"
      maxH="calc(100% - 24px)"
      boxSizing="border-box"
      display="flex"
      flexDirection="column"
      gap="8px"
      p="10px"
      border="1px solid rgba(47, 57, 50, 0.5)"
      background="rgba(250, 252, 247, 0.98)"
      boxShadow="0 12px 28px rgba(20, 25, 22, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.7)"
      color="var(--spatial-map-copy)"
      overflow="auto"
      overscrollBehavior="contain"
      pointerEvents="auto"
      transform="translate(-50%, -50%)"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      style={overlayStyle()}
      onFocusOut={scheduleCloseOnBlur}
      onSubmit={(event) => {
        event.preventDefault();
        const nextTitle = title().trim();
        if (!nextTitle) {
          return;
        }

        void createChildNode(nextTitle, nodeType(), context().trim());
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          controller.clearChildNodeDraft();
          return;
        }

        if (
          event.key === "Enter" &&
          !event.shiftKey &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.altKey
        ) {
          event.preventDefault();
          void createChildNode(title().trim(), nodeType(), context().trim());
        }
      }}
    >
      <Box color="var(--spatial-map-copy-dim)" fontSize="11px" lineHeight="1" textTransform="none">
        {props.parentNode ? "New child node" : "New node"}
      </Box>
      <Show when={props.parentNode}>
        {(parentNode) => (
          <Box
            p="6px 7px"
            border="1px solid rgba(34, 41, 36, 0.12)"
            background="rgba(232, 236, 230, 0.72)"
            color="var(--spatial-map-copy-muted)"
            fontSize="11px"
            lineHeight="1.25"
            overflow="hidden"
            textOverflow="ellipsis"
            whiteSpace="nowrap"
          >
            Parent: {parentNode().label}
          </Box>
        )}
      </Show>
      <Textarea
        ref={textareaRef}
        aria-label="New node title"
        required
        value={title()}
        disabled={pending()}
        placeholder="Node title"
        rows={3}
        onInput={(event) => setTitle(event.currentTarget.value)}
      />
      <Box
        as="label"
        display="flex"
        flexDirection="column"
        gap="4px"
        color="var(--spatial-map-copy-dim)"
        fontSize="10px"
        fontWeight="700"
        letterSpacing="0.04em"
        lineHeight="1"
        textTransform="none"
      >
        <span>Type</span>
        <SpatialMapSelect
          value={nodeType()}
          disabled={pending()}
          w="100%"
          minH="30px"
          border="1px solid rgba(47, 57, 50, 0.28)"
          background="rgba(248, 250, 248, 0.94)"
          color="var(--spatial-map-copy)"
          fontFamily="inherit"
          fontSize="12px"
          fontWeight="500"
          letterSpacing="0"
          onChange={(event) => setNodeType(event.currentTarget.value)}
        >
          <For each={nodeTypeOptions()}>
            {(option) => (
              <option value={option.name}>
                {option.name}
              </option>
            )}
          </For>
        </SpatialMapSelect>
      </Box>
      <Box
        as="label"
        display="flex"
        flexDirection="column"
        gap="4px"
        color="var(--spatial-map-copy-dim)"
        fontSize="10px"
        fontWeight="700"
        letterSpacing="0.04em"
        lineHeight="1"
        textTransform="none"
      >
        <span>Context</span>
        <Textarea
          aria-label="New node context"
          value={context()}
          disabled={pending()}
          placeholder="Optional context"
          rows={4}
          onInput={(event) => setContext(event.currentTarget.value)}
        />
      </Box>
      <Box display="flex" gap="6px" justifyContent="flex-end">
        <Button
          size="xs"
          variant="plain"
          type="button"
          disabled={pending()}
          onClick={() => controller.clearChildNodeDraft()}
        >
          Cancel
        </Button>
        <Button
          size="xs"
          colorPalette="green"
          disabled={!title().trim()}
          loading={pending()}
          type="submit"
        >
          Accept
        </Button>
      </Box>
    </SpatialMapForm>
  );
}
