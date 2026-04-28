import { useSubmission } from "@solidjs/router";
import { For, Show, createEffect, createMemo, createSignal, type JSX } from "solid-js";
import { HStack, VStack } from "styled-system/jsx";
import { createProjectContextNode } from "~/lib/projects/data";
import { detectMarkdownMaxHeadingDepth } from "~/lib/projects/context-node-markdown";
import type { ProjectRecord } from "~/lib/projects/types";
import { normalizeActionUrl } from "~/lib/router/action-url";
import { Button } from "~/components/ui/button";
import * as Checkbox from "~/components/ui/checkbox";
import * as Field from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { SimpleDialog } from "~/components/ui/simple-dialog";
import { Textarea } from "~/components/ui/textarea";
import { toaster } from "~/components/ui/toast";
import { useSpatialMap } from "./SpatialMapContext";

interface SpatialMapCreateContextNodeDialogProps {
  project: ProjectRecord;
  onProjectUpdated?: (project: ProjectRecord) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: (open: () => void) => JSX.Element;
}

export function SpatialMapCreateContextNodeDialog(
  props: SpatialMapCreateContextNodeDialogProps,
) {
  const spatialMap = useSpatialMap();
  const createContextNodeSubmission = useSubmission(createProjectContextNode);
  const [uncontrolledOpen, setUncontrolledOpen] = createSignal(false);
  const [label, setLabel] = createSignal("");
  const [context, setContext] = createSignal("");
  const [metadataDraft, setMetadataDraft] = createSignal<Record<string, string>>({});
  const [splitByHeadingLevel, setSplitByHeadingLevel] = createSignal(false);
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
    setSelectedMaxHeadingDepth(1);
    setHasManualHeadingDepth(false);
    createContextNodeSubmission.clear();
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

  const handleOpenChange = (nextOpen: boolean) => {
    props.onOpenChange?.(nextOpen);
    setUncontrolledOpen(nextOpen);
    if (!nextOpen) {
      reset();
    }
  };

  createEffect(() => {
    const result = createContextNodeSubmission.result;
    if (!result || createContextNodeSubmission.pending) {
      return;
    }

    props.onProjectUpdated?.(result.project);
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
    createContextNodeSubmission.clear();
  });

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
          colorPalette="green"
          variant="surface"
          size="xs"
          class="spatial-map-button spatial-map-button--strong"
          onClick={() => handleOpenChange(true)}
        >
          New Context Node
        </Button>
      )}

      <SimpleDialog
        open={open()}
        onOpenChange={handleOpenChange}
        title="Create Context Node"
        description="Add a standalone note node with a name and freeform markdown context."
        initialFocusEl={() => nameInput ?? null}
        maxW="760px"
        footer={
          <HStack>
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form={formId}
              loading={createContextNodeSubmission.pending}
            >
              Create Node
            </Button>
          </HStack>
        }
      >
        <form
          id={formId}
          action={normalizeActionUrl(createProjectContextNode.url)}
          method="post"
        >
          <VStack alignItems="stretch" gap="4">
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
                required
                value={label()}
                onInput={(event) => setLabel(event.currentTarget.value)}
                placeholder="Market Research Dump"
              />
              <Field.HelperText>
                Keep the label short enough to scan on the canvas.
              </Field.HelperText>
            </Field.Root>

            <Field.Root>
              <Field.Label>Context</Field.Label>
              <Textarea
                name="context"
                class="spatial-map-context-textarea"
                value={context()}
                onInput={(event) => setContext(event.currentTarget.value)}
                rows={14}
                placeholder={"# Loose context\n\nDrop notes, bullets, snippets, or raw markdown here."}
              />
              <Field.HelperText>
                Markdown is stored as plain text and rendered in the inspector when selected.
              </Field.HelperText>
            </Field.Root>

            <For each={props.project.nodeMetadataSchema}>
              {(field) => (
                <Field.Root>
                  <Field.Label>{field.label}</Field.Label>
                  <Input
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
                  <Field.HelperText>
                    {field.defaultValue
                      ? `Default: ${field.defaultValue}`
                      : "Optional project metadata."}
                  </Field.HelperText>
                </Field.Root>
              )}
            </For>

            <Field.Root>
              <Field.Label>Import Options</Field.Label>
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
                    <Checkbox.Label fontSize="sm" fontWeight="medium">
                      Split based on heading level
                    </Checkbox.Label>
                    <Field.HelperText>
                      Create a root note from the name above, then turn markdown headings into linked child nodes with each section body stored as that node&apos;s context.
                    </Field.HelperText>
                    <Show
                      when={splitByHeadingLevel() && headingDepthOptions().length > 0}
                    >
                      <VStack alignItems="stretch" gap="1" mt="2">
                        <Field.HelperText>
                          Convert headings through depth {selectedMaxHeadingDepth()}. Deeper headings stay in the parent node&apos;s context.
                        </Field.HelperText>
                        <HStack gap="1" flexWrap="wrap">
                          <For each={headingDepthOptions()}>
                            {(depth) => (
                              <Button
                                type="button"
                                size="2xs"
                                variant={
                                  selectedMaxHeadingDepth() === depth ? "solid" : "outline"
                                }
                                colorPalette="blue"
                                aria-pressed={selectedMaxHeadingDepth() === depth}
                                onClick={() => handleSelectMaxHeadingDepth(depth)}
                              >
                                {depth}
                              </Button>
                            )}
                          </For>
                        </HStack>
                      </VStack>
                    </Show>
                  </VStack>
                </HStack>
              </Checkbox.Root>
            </Field.Root>
          </VStack>
        </form>
      </SimpleDialog>
    </>
  );
}
