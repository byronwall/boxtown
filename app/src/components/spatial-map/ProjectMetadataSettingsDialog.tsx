import { useSubmission } from "@solidjs/router";
import { For, createEffect, createSignal } from "solid-js";
import { HStack, VStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import * as Field from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { SimpleDialog } from "~/components/ui/simple-dialog";
import { toaster } from "~/components/ui/toast";
import { updateProjectMetadataSchema } from "~/lib/projects/data";
import type { ProjectNodeMetadataField, ProjectRecord } from "~/lib/projects/types";
import { normalizeActionUrl } from "~/lib/router/action-url";

interface ProjectMetadataSettingsDialogProps {
  project: ProjectRecord;
  onProjectUpdated?: (project: ProjectRecord) => void;
}

interface MetadataSchemaRowDraft extends ProjectNodeMetadataField {
  originalKey: string;
}

export function ProjectMetadataSettingsDialog(
  props: ProjectMetadataSettingsDialogProps,
) {
  const updateSubmission = useSubmission(updateProjectMetadataSchema);
  const [open, setOpen] = createSignal(false);
  const [rows, setRows] = createSignal(createRows(props.project.nodeMetadataSchema));
  const formId = "project-metadata-settings-form";

  createEffect(() => {
    if (!open()) {
      setRows(createRows(props.project.nodeMetadataSchema));
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
      title: "Project metadata updated",
      description: "The project metadata schema and node values were updated.",
    });
    updateSubmission.clear();
  });

  return (
    <>
      <Button
        colorPalette="green"
        variant="outline"
        size="xs"
        class="spatial-map-button"
        onClick={() => setOpen(true)}
      >
        Project Settings
      </Button>

      <SimpleDialog
        open={open()}
        onOpenChange={setOpen}
        title="Project Metadata"
        description="Define the project-level metadata keys available on nodes."
        maxW="900px"
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
          id={formId}
          action={normalizeActionUrl(updateProjectMetadataSchema.url)}
          method="post"
        >
          <input type="hidden" name="projectId" value={props.project.id} />
          <VStack alignItems="stretch" gap="3">
            <For each={rows()}>
              {(row, index) => (
                <VStack alignItems="stretch" gap="2" class="spatial-map-inspector-section">
                  <input type="hidden" name="originalKey" value={row.originalKey} />
                  <HStack gap="2" alignItems="flex-end" flexWrap="wrap">
                    <Field.Root flex="1 1 180px">
                      <Field.Label>Key</Field.Label>
                      <Input
                        name="key"
                        value={row.key}
                        onInput={(event) =>
                          updateRow(index(), { key: event.currentTarget.value }, setRows)
                        }
                        placeholder="purpose"
                      />
                    </Field.Root>
                    <Field.Root flex="1 1 180px">
                      <Field.Label>Label</Field.Label>
                      <Input
                        name="label"
                        value={row.label}
                        onInput={(event) =>
                          updateRow(index(), { label: event.currentTarget.value }, setRows)
                        }
                        placeholder="Purpose"
                      />
                    </Field.Root>
                    <Field.Root flex="2 1 260px">
                      <Field.Label>Default Value</Field.Label>
                      <Input
                        name="defaultValue"
                        value={row.defaultValue}
                        onInput={(event) =>
                          updateRow(index(), { defaultValue: event.currentTarget.value }, setRows)
                        }
                        placeholder="Optional default text"
                      />
                    </Field.Root>
                    <HStack gap="1">
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        class="spatial-map-button"
                        disabled={index() === 0}
                        onClick={() => moveRow(index(), -1, setRows)}
                      >
                        Up
                      </Button>
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        class="spatial-map-button"
                        disabled={index() === rows().length - 1}
                        onClick={() => moveRow(index(), 1, setRows)}
                      >
                        Down
                      </Button>
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        class="spatial-map-button"
                        onClick={() => removeRow(index(), setRows)}
                      >
                        Remove
                      </Button>
                    </HStack>
                  </HStack>
                </VStack>
              )}
            </For>

            <HStack justifyContent="space-between" alignItems="center" flexWrap="wrap">
              <Field.HelperText>
                Keys are normalized on save and node metadata is remapped by the original key.
              </Field.HelperText>
              <Button
                type="button"
                size="xs"
                variant="surface"
                class="spatial-map-button spatial-map-button--strong"
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

function updateRow(
  index: number,
  patch: Partial<MetadataSchemaRowDraft>,
  setRows: (setter: (current: MetadataSchemaRowDraft[]) => MetadataSchemaRowDraft[]) => void,
) {
  setRows((current) =>
    current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
  );
}

function moveRow(
  index: number,
  delta: -1 | 1,
  setRows: (setter: (current: MetadataSchemaRowDraft[]) => MetadataSchemaRowDraft[]) => void,
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

function removeRow(
  index: number,
  setRows: (setter: (current: MetadataSchemaRowDraft[]) => MetadataSchemaRowDraft[]) => void,
) {
  setRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
}
