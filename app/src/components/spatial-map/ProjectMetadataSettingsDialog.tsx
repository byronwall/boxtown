import { useSubmission } from "@solidjs/router";
import { ArrowDownIcon, ArrowUpIcon, Trash2 } from "lucide-solid";
import { Index, createEffect, createSignal, type JSX } from "solid-js";
import { Box, HStack, VStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import * as Field from "~/components/ui/field";
import { IconButton } from "~/components/ui/icon-button";
import { SimpleDialog } from "~/components/ui/simple-dialog";
import { Text } from "~/components/ui/text";
import { Textarea } from "~/components/ui/textarea";
import { toaster } from "~/components/ui/toast";
import { updateProjectMetadataSchema } from "~/lib/projects/data";
import { createNodeTypeColor } from "~/lib/projects/node-types";
import type {
  ProjectNodeMetadataField,
  ProjectNodeTypeDefinition,
  ProjectRecord,
} from "~/lib/projects/types";
import { normalizeActionUrl } from "~/lib/router/action-url";

interface ProjectMetadataSettingsDialogProps {
  project: ProjectRecord;
  onProjectUpdated?: (project: ProjectRecord) => void;
  trigger?: (open: () => void) => JSX.Element;
}

interface MetadataSchemaRowDraft extends ProjectNodeMetadataField {
  originalKey: string;
}

interface NodeTypeRowDraft extends ProjectNodeTypeDefinition {}

export function ProjectMetadataSettingsDialog(
  props: ProjectMetadataSettingsDialogProps,
) {
  const updateSubmission = useSubmission(updateProjectMetadataSchema);
  const [open, setOpen] = createSignal(false);
  const [name, setName] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [rows, setRows] = createSignal<MetadataSchemaRowDraft[]>([]);
  const [typeRows, setTypeRows] = createSignal<NodeTypeRowDraft[]>([]);
  const formId = "project-metadata-settings-form";

  createEffect(() => {
    if (!open()) {
      setName(props.project.name);
      setDescription(props.project.description);
      setRows(createRows(props.project.nodeMetadataSchema));
      setTypeRows(createTypeRows(props.project.nodeTypeSchema));
    }
  });

  createEffect(() => {
    const result = updateSubmission.result;
    if (!result || updateSubmission.pending) {
      return;
    }

    props.onProjectUpdated?.(result);
    setOpen(false);
    toaster.success({
      title: "Project settings updated",
      description: "Project details and metadata settings were saved.",
    });
    updateSubmission.clear();
  });

  return (
    <>
      {props.trigger ? (
        props.trigger(() => setOpen(true))
      ) : (
        <Button
          colorPalette="green"
          variant="outline"
          size="xs"
          onClick={() => setOpen(true)}
        >
          Project Settings
        </Button>
      )}

      <SimpleDialog
        open={open()}
        onOpenChange={setOpen}
        title="Project Settings"
        description="Edit the project title, subtitle, and node metadata fields."
        maxW="min(800px, 96vw)"
        contentClass="spatial-map-project-settings-dialog"
        footer={
          <HStack>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form={formId}
              loading={updateSubmission.pending}
            >
              Save Settings
            </Button>
          </HStack>
        }
      >
        <form
          class="spatial-map-project-settings-form"
          id={formId}
          action={normalizeActionUrl(updateProjectMetadataSchema.url)}
          method="post"
        >
          <input type="hidden" name="projectId" value={props.project.id} />
          <VStack alignItems="stretch" gap="3" class="spatial-map-metadata-dialog">
            <Box class="spatial-map-project-settings-section">
              <Field.Root class="spatial-map-project-settings-row">
                <Field.Label>Title</Field.Label>
                <Textarea
                  variant="spatial"
                  size="compact"
                  autoResize={false}
                  minH="34px"
                  overflow="hidden"
                  name="name"
                  value={name()}
                  onInput={(event) => setName(event.currentTarget.value)}
                  placeholder="Untitled Project"
                  rows={1}
                />
              </Field.Root>
              <Field.Root class="spatial-map-project-settings-row">
                <Field.Label>Subtitle</Field.Label>
                <Textarea
                  variant="spatial"
                  size="compact"
                  autoResize={false}
                  minH="54px"
                  resize="vertical"
                  name="description"
                  value={description()}
                  onInput={(event) => setDescription(event.currentTarget.value)}
                  placeholder="Project description"
                  rows={2}
                />
              </Field.Root>
            </Box>

            <Text as="h3" class="spatial-map-settings-section-title">
              Node Metadata Fields
            </Text>
            <Box class="spatial-map-metadata-grid spatial-map-metadata-grid--header">
              <Text as="span">Key</Text>
              <Text as="span">Label</Text>
              <Text as="span">Default Value</Text>
              <Text as="span">Order</Text>
            </Box>

            <Box class="spatial-map-metadata-grid spatial-map-metadata-grid--body">
              <Index each={rows()}>
                {(row, index) => (
                  <>
                    <Field.Root>
                      <input
                        type="hidden"
                        name="originalKey"
                        value={row().originalKey}
                      />
                      <Textarea
                        aria-label={`Key for metadata field ${index + 1}`}
                        variant="spatial"
                        size="compact"
                        autoResize={false}
                        minH="30px"
                        overflow="hidden"
                        resize="none"
                        name="key"
                        value={row().key}
                        onInput={(event) =>
                          updateRow(index, { key: event.currentTarget.value }, setRows)
                        }
                        placeholder="purpose"
                        rows={1}
                      />
                    </Field.Root>
                    <Field.Root>
                      <Textarea
                        aria-label={`Label for metadata field ${index + 1}`}
                        variant="spatial"
                        size="compact"
                        autoResize={false}
                        minH="30px"
                        overflow="hidden"
                        resize="none"
                        name="label"
                        value={row().label}
                        onInput={(event) =>
                          updateRow(index, { label: event.currentTarget.value }, setRows)
                        }
                        placeholder="Purpose"
                        rows={1}
                      />
                    </Field.Root>
                    <Field.Root>
                      <Textarea
                        aria-label={`Default value for metadata field ${index + 1}`}
                        variant="spatial"
                        size="compact"
                        autoResize={false}
                        minH="30px"
                        overflow="hidden"
                        resize="none"
                        name="defaultValue"
                        value={row().defaultValue}
                        onInput={(event) =>
                          updateRow(index, { defaultValue: event.currentTarget.value }, setRows)
                        }
                        placeholder="Optional default text"
                        rows={1}
                      />
                    </Field.Root>
                    <HStack gap="1" class="spatial-map-metadata-row-actions">
                      <IconButton
                        aria-label={`Move ${row().label || row().key || "field"} up`}
                        title="Move up"
                        type="button"
                        size="xs"
                        variant="outline"
                        disabled={index === 0}
                        onClick={() => moveRow(index, -1, setRows)}
                      >
                        <ArrowUpIcon size={15} />
                      </IconButton>
                      <IconButton
                        aria-label={`Move ${row().label || row().key || "field"} down`}
                        title="Move down"
                        type="button"
                        size="xs"
                        variant="outline"
                        disabled={index === rows().length - 1}
                        onClick={() => moveRow(index, 1, setRows)}
                      >
                        <ArrowDownIcon size={15} />
                      </IconButton>
                      <IconButton
                        aria-label={`Remove ${row().label || row().key || "field"}`}
                        title="Remove"
                        type="button"
                        size="xs"
                        variant="danger"
                        onClick={() => removeRow(index, setRows)}
                      >
                        <Trash2 size={15} />
                      </IconButton>
                    </HStack>
                  </>
                )}
              </Index>
            </Box>

            <HStack justifyContent="space-between" alignItems="center" flexWrap="wrap">
              <Text color="fg.muted" textStyle="sm">
                Keys are normalized on save and node metadata is remapped by the original key.
              </Text>
              <Button
                type="button"
                size="xs"
                variant="surface"
                colorPalette="green"
                onClick={() =>
                  setRows((current) => [
                    ...current,
                    { originalKey: "", key: "", label: "", defaultValue: "" },
                  ])
                }
              >
                Add Field
              </Button>
            </HStack>

            <Text as="h3" class="spatial-map-settings-section-title">
              Node Types
            </Text>
            <Box class="spatial-map-type-grid spatial-map-type-grid--header">
              <Text as="span">Type Name</Text>
              <Text as="span">Expected Color</Text>
              <Text as="span">Order</Text>
            </Box>
            <Box class="spatial-map-type-grid spatial-map-type-grid--body">
              <Index each={typeRows()}>
                {(row, index) => (
                  <>
                    <Field.Root>
                      <Textarea
                        aria-label={`Name for node type ${index + 1}`}
                        variant="spatial"
                        size="compact"
                        autoResize={false}
                        minH="30px"
                        overflow="hidden"
                        resize="none"
                        name="nodeTypeName"
                        value={row().name}
                        onInput={(event) =>
                          updateTypeRow(index, { name: event.currentTarget.value }, setTypeRows)
                        }
                        placeholder="component"
                        rows={1}
                      />
                    </Field.Root>
                    <Field.Root class="spatial-map-type-color-field">
                      <input
                        aria-label={`Color for node type ${row().name || index + 1}`}
                        class="spatial-map-type-color-input"
                        type="color"
                        name="nodeTypeColor"
                        value={row().color}
                        onInput={(event) =>
                          updateTypeRow(index, { color: event.currentTarget.value }, setTypeRows)
                        }
                      />
                      <Text as="span" class="spatial-map-type-color-value">
                        {row().color}
                      </Text>
                    </Field.Root>
                    <HStack gap="1" class="spatial-map-metadata-row-actions">
                      <IconButton
                        aria-label={`Move ${row().name || "type"} up`}
                        title="Move up"
                        type="button"
                        size="xs"
                        variant="outline"
                        disabled={index === 0}
                        onClick={() => moveRow(index, -1, setTypeRows)}
                      >
                        <ArrowUpIcon size={15} />
                      </IconButton>
                      <IconButton
                        aria-label={`Move ${row().name || "type"} down`}
                        title="Move down"
                        type="button"
                        size="xs"
                        variant="outline"
                        disabled={index === typeRows().length - 1}
                        onClick={() => moveRow(index, 1, setTypeRows)}
                      >
                        <ArrowDownIcon size={15} />
                      </IconButton>
                      <IconButton
                        aria-label={`Remove ${row().name || "type"}`}
                        title="Remove"
                        type="button"
                        size="xs"
                        variant="danger"
                        onClick={() => removeRow(index, setTypeRows)}
                      >
                        <Trash2 size={15} />
                      </IconButton>
                    </HStack>
                  </>
                )}
              </Index>
            </Box>

            <HStack justifyContent="space-between" alignItems="center" flexWrap="wrap">
              <Text color="fg.muted" textStyle="sm">
                Node type names are normalized on save and become the available type picker options.
              </Text>
              <Button
                type="button"
                size="xs"
                variant="surface"
                colorPalette="green"
                onClick={() =>
                  setTypeRows((current) => [
                    ...current,
                    { name: "", color: createNodeTypeColor(current.length) },
                  ])
                }
              >
                Add Type
              </Button>
            </HStack>
          </VStack>
        </form>
      </SimpleDialog>
    </>
  );
}

function createRows(schema: ProjectNodeMetadataField[]): MetadataSchemaRowDraft[] {
  return schema.map((field) => ({
    originalKey: field.key,
    key: field.key,
    label: field.label,
    defaultValue: field.defaultValue,
  }));
}

function createTypeRows(schema: ProjectNodeTypeDefinition[]): NodeTypeRowDraft[] {
  return schema.map((field) => ({
    name: field.name,
    color: field.color,
  }));
}

function updateRow(
  index: number,
  patch: Partial<MetadataSchemaRowDraft>,
  setRows: (setter: (current: MetadataSchemaRowDraft[]) => MetadataSchemaRowDraft[]) => void,
) {
  setRows((current) =>
    current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
  );
}

function updateTypeRow(
  index: number,
  patch: Partial<NodeTypeRowDraft>,
  setRows: (setter: (current: NodeTypeRowDraft[]) => NodeTypeRowDraft[]) => void,
) {
  setRows((current) =>
    current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
  );
}

function moveRow<T>(
  index: number,
  delta: -1 | 1,
  setRows: (setter: (current: T[]) => T[]) => void,
) {
  setRows((current) => {
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= current.length) {
      return current;
    }

    const next = [...current];
    [next[index], next[nextIndex]] = [next[nextIndex]!, next[index]!];
    return next;
  });
}

function removeRow<T>(
  index: number,
  setRows: (setter: (current: T[]) => T[]) => void,
) {
  setRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
}
