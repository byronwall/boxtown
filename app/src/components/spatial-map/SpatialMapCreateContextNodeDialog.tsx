import { useAction } from "@solidjs/router";
import { For, Show, createEffect, createMemo, createSignal, type JSX } from "solid-js";
import { Box, HStack, VStack } from "styled-system/jsx";
import { createProjectContextNode } from "~/lib/projects/data";
import { detectMarkdownMaxHeadingDepth } from "~/lib/projects/context-node-markdown";
import { appendClientMutationId, createClientMutationId } from "~/lib/projects/optimistic";
import type { ProjectRecord } from "~/lib/projects/types";
import { Button } from "~/components/ui/button";
import * as Checkbox from "~/components/ui/checkbox";
import * as Field from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { SimpleDialog } from "~/components/ui/simple-dialog";
import { Textarea } from "~/components/ui/textarea";
import { toaster } from "~/components/ui/toast";
import { useSpatialMap } from "./SpatialMapContext";
import { SpatialMapBlockTitle } from "./SpatialMapPanelPrimitives";
import { SpatialMapSegmentedControl } from "./SpatialMapSegmentedControl";

interface SpatialMapCreateContextNodeDialogProps {
  project: ProjectRecord;
  onProjectUpdated?: (project: ProjectRecord, options?: import("~/lib/projects/optimistic").ProjectUpdateOptions) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: (open: () => void) => JSX.Element;
}

export function SpatialMapCreateContextNodeDialog(
  props: SpatialMapCreateContextNodeDialogProps,
) {
  const spatialMap = useSpatialMap();
  const submitCreateContextNode = useAction(createProjectContextNode);
  const [uncontrolledOpen, setUncontrolledOpen] = createSignal(false);
  const [pending, setPending] = createSignal(false);
  const [label, setLabel] = createSignal("");
  const [context, setContext] = createSignal("");
  const [metadataDraft, setMetadataDraft] = createSignal<Record<string, string>>({});
  const [splitByHeadingLevel, setSplitByHeadingLevel] = createSignal(false);
  const [splitByListItems, setSplitByListItems] = createSignal(false);
  const [splitNestedListItems, setSplitNestedListItems] = createSignal(true);
  const [selectedMaxHeadingDepth, setSelectedMaxHeadingDepth] = createSignal(1);
  const [hasManualHeadingDepth, setHasManualHeadingDepth] = createSignal(false);
  let nameInput: HTMLInputElement | undefined;
  const formId = "create-context-node-form";
  const detectedMaxHeadingDepth = createMemo(() => detectMarkdownMaxHeadingDepth(context()));
  const headingDepthOptions = createMemo(() =>
    Array.from({ length: detectedMaxHeadingDepth() }, (_, index) => index + 1),
  );
  const open = () => props.open ?? uncontrolledOpen();

  const reset = () => {
    setLabel("");
    setContext("");
    setMetadataDraft({});
    setSplitByHeadingLevel(false);
    setSplitByListItems(false);
    setSplitNestedListItems(true);
    setSelectedMaxHeadingDepth(1);
    setHasManualHeadingDepth(false);
  };

  const handleSplitByHeadingLevelChange = (checked: boolean) => {
    setSplitByHeadingLevel(checked);
    if (checked) {
      setSelectedMaxHeadingDepth(Math.max(1, detectedMaxHeadingDepth()));
      setHasManualHeadingDepth(false);
    }
  };

  const handleSelectMaxHeadingDepth = (depth: number) => {
    setSelectedMaxHeadingDepth(depth);
    setHasManualHeadingDepth(true);
  };

  const handleSplitByListItemsChange = (checked: boolean) => {
    setSplitByListItems(checked);
    if (checked) {
      setSplitNestedListItems(true);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    props.onOpenChange?.(nextOpen);
    setUncontrolledOpen(nextOpen);
    if (!nextOpen) {
      reset();
    }
  };

  const createContextNode = async (formData: FormData) => {
    if (pending()) {
      return;
    }

    setPending(true);
    const clientMutationId = createClientMutationId();
    try {
      const result = await submitCreateContextNode(appendClientMutationId(formData, clientMutationId));
      props.onProjectUpdated?.(result.project, { clientMutationId, phase: "server" });
      handleOpenChange(false);
      setLabel("");
      setContext("");
      queueMicrotask(() => {
        spatialMap.setSelectedNodeId(result.nodeId);
        spatialMap.setInspectorOpen(true);
      });
      toaster.success({
        title: result.createdNodeCount > 1 ? "Context nodes created" : "Context node created",
        description:
          result.createdNodeCount > 1
            ? `${result.createdNodeCount} linked context nodes are now available in the map.`
            : `${result.project.spatialMap.nodes.find((node) => node.id === result.nodeId)?.label ?? "New node"} is now available in the map.`,
      });
    } catch (error) {
      toaster.error({
        title: "Context node was not created",
        description:
          error instanceof Error ? error.message : "The context node could not be created.",
      });
    } finally {
      setPending(false);
    }
  };

  createEffect(() => {
    const maxDepth = detectedMaxHeadingDepth();
    if (maxDepth === 0) {
      setSelectedMaxHeadingDepth(1);
      setHasManualHeadingDepth(false);
      return;
    }

    if (!hasManualHeadingDepth() || selectedMaxHeadingDepth() > maxDepth) {
      setSelectedMaxHeadingDepth(maxDepth);
      setHasManualHeadingDepth(false);
    }
  });

  return (
    <>
      {props.trigger ? (
        props.trigger(() => handleOpenChange(true))
      ) : (
        <Button
          colorPalette="gray"
          variant="surface"
          size="xs"
          onClick={() => handleOpenChange(true)}
        >
          New Context Node
        </Button>
      )}

      <SimpleDialog
        open={open()}
        onOpenChange={handleOpenChange}
        title="New context node"
        description="A standalone note node. Paste markdown and optionally split it into child nodes."
        initialFocusEl={() => nameInput ?? null}
        maxW="640px"
        footer={
          <HStack>
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form={formId}
              colorPalette="gray"
              loading={pending()}
            >
              Create
            </Button>
          </HStack>
        }
      >
        <form
          id={formId}
          onSubmit={(event) => {
            event.preventDefault();
            void createContextNode(new FormData(event.currentTarget));
          }}
        >
          <VStack alignItems="stretch" gap="3">
            <input type="hidden" name="projectId" value={props.project.id} />
            <input
              type="hidden"
              name="maxHeadingDepth"
              value={selectedMaxHeadingDepth()}
            />
            <Field.Root required>
              <Field.Label>
                Name
                <Field.RequiredIndicator />
              </Field.Label>
              <Input
                ref={nameInput}
                name="label"
                size="xs"
                required
                value={label()}
                onInput={(event) => setLabel(event.currentTarget.value)}
                placeholder="Market Research Dump"
              />
            </Field.Root>

            <Field.Root>
              <Field.Label>Context</Field.Label>
              <Textarea
                name="context"
                variant="spatial"
                size="sm"
                autoResize={false}
                minH="140px"
                fontSize="12px"
                resize="vertical"
                value={context()}
                onInput={(event) => setContext(event.currentTarget.value)}
                rows={8}
                placeholder={"# Loose context\n\nDrop notes, bullets, snippets, or raw markdown here."}
              />
            </Field.Root>

            <For each={props.project.nodeMetadataSchema}>
              {(field) => (
                <Field.Root>
                  <Field.Label>{field.label}</Field.Label>
                  <Input
                    size="xs"
                    name={`metadata.${field.key}`}
                    value={metadataDraft()[field.key] ?? ""}
                    onInput={(event) =>
                      setMetadataDraft((current) => ({
                        ...current,
                        [field.key]: event.currentTarget.value,
                      }))
                    }
                    placeholder={field.defaultValue}
                  />
                </Field.Root>
              )}
            </For>

            <VStack alignItems="stretch" gap="2" pt="2" borderTop="1px solid var(--spatial-map-panel-divider)">
              <SpatialMapBlockTitle>Split into child nodes</SpatialMapBlockTitle>
              <Checkbox.Root
                checked={splitByHeadingLevel()}
                onCheckedChange={(details) =>
                  handleSplitByHeadingLevelChange(details.checked === true)
                }
              >
                <Checkbox.HiddenInput name="splitByHeadingLevel" value="true" />
                <HStack gap="2" alignItems="flex-start">
                  <Checkbox.Control mt="0.5">
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  <VStack alignItems="stretch" gap="1">
                    <Checkbox.Label fontSize="12px" fontWeight="600">
                      Split based on heading level
                    </Checkbox.Label>
                    <Box as="span" color="var(--spatial-map-copy-dim)" fontSize="12px" lineHeight="1.4">
                      Each markdown heading becomes a child node; the section body becomes its context.
                    </Box>
                    <Show
                      when={splitByHeadingLevel() && headingDepthOptions().length > 0}
                    >
                      <VStack alignItems="start" gap="1" mt="1">
                        <Box as="span" color="var(--spatial-map-copy-dim)" fontSize="12px" lineHeight="1.4">
                          Split through heading depth {selectedMaxHeadingDepth()}. Deeper headings stay in the parent&apos;s context.
                        </Box>
                        <SpatialMapSegmentedControl
                          ariaLabel="Maximum heading depth"
                          value={selectedMaxHeadingDepth()}
                          options={headingDepthOptions().map((depth) => ({ value: depth, label: String(depth) }))}
                          onChange={(depth) => handleSelectMaxHeadingDepth(depth)}
                        />
                      </VStack>
                    </Show>
                  </VStack>
                </HStack>
              </Checkbox.Root>
              <Checkbox.Root
                checked={splitByListItems()}
                onCheckedChange={(details) =>
                  handleSplitByListItemsChange(details.checked === true)
                }
              >
                <Checkbox.HiddenInput name="splitByListItems" value="true" />
                <HStack gap="2" alignItems="flex-start">
                  <Checkbox.Control mt="0.5">
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  <VStack alignItems="stretch" gap="1">
                    <Checkbox.Label fontSize="12px" fontWeight="600">
                      Split on list items
                    </Checkbox.Label>
                    <Box as="span" color="var(--spatial-map-copy-dim)" fontSize="12px" lineHeight="1.4">
                      Each bullet or numbered item becomes a child node under its root or heading.
                    </Box>
                  </VStack>
                </HStack>
              </Checkbox.Root>
              <Show when={splitByListItems()}>
                <Checkbox.Root
                  checked={splitNestedListItems()}
                  onCheckedChange={(details) =>
                    setSplitNestedListItems(details.checked === true)
                  }
                  ml="6"
                >
                  <Checkbox.HiddenInput
                    name="splitNestedListItems"
                    value="true"
                  />
                  <HStack gap="2" alignItems="flex-start">
                    <Checkbox.Control mt="0.5">
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    <VStack alignItems="stretch" gap="1">
                      <Checkbox.Label fontSize="12px" fontWeight="600">
                        Split nested list items recursively
                      </Checkbox.Label>
                      <Box as="span" color="var(--spatial-map-copy-dim)" fontSize="12px" lineHeight="1.4">
                        When off, nested bullets stay in the parent list item&apos;s context.
                      </Box>
                    </VStack>
                  </HStack>
                </Checkbox.Root>
              </Show>
            </VStack>
          </VStack>
        </form>
      </SimpleDialog>
    </>
  );
}
