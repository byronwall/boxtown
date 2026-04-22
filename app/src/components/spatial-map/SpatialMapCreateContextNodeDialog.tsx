import { useSubmission } from "@solidjs/router";
import { createEffect, createSignal } from "solid-js";
import { HStack, VStack } from "styled-system/jsx";
import { createProjectContextNode } from "~/lib/projects/data";
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
  projectId: string;
  onProjectUpdated?: (project: ProjectRecord) => void;
}

export function SpatialMapCreateContextNodeDialog(
  props: SpatialMapCreateContextNodeDialogProps,
) {
  const spatialMap = useSpatialMap();
  const createContextNodeSubmission = useSubmission(createProjectContextNode);
  const [open, setOpen] = createSignal(false);
  const [label, setLabel] = createSignal("");
  const [context, setContext] = createSignal("");
  const [splitByHeadingLevel, setSplitByHeadingLevel] = createSignal(false);
  let nameInput: HTMLInputElement | undefined;
  const formId = "create-context-node-form";

  const reset = () => {
    setLabel("");
    setContext("");
    setSplitByHeadingLevel(false);
    createContextNodeSubmission.clear();
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
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
    setOpen(false);
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

  return (
    <>
      <Button
        colorPalette="green"
        variant="surface"
        size="xs"
        class="spatial-map-button spatial-map-button--strong"
        onClick={() => setOpen(true)}
      >
        New Context Node
      </Button>

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
            <input type="hidden" name="projectId" value={props.projectId} />
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

            <Field.Root>
              <Field.Label>Import Options</Field.Label>
              <Checkbox.Root
                checked={splitByHeadingLevel()}
                onCheckedChange={(details) =>
                  setSplitByHeadingLevel(details.checked === true)
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
