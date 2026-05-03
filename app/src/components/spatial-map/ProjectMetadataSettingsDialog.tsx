import { useAction } from "@solidjs/router";
import { ArrowDownIcon, ArrowUpIcon, Trash2 } from "lucide-solid";
import { Index, createEffect, createSignal, type JSX } from "solid-js";
import { css } from "styled-system/css";
import { Box, HStack, VStack, styled } from "styled-system/jsx";
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

interface ProjectMetadataSettingsDialogProps {
  project: ProjectRecord;
  onProjectUpdated?: (project: ProjectRecord) => void;
  trigger?: (open: () => void) => JSX.Element;
}

interface MetadataSchemaRowDraft extends ProjectNodeMetadataField {
  originalKey: string;
}

interface NodeTypeRowDraft extends ProjectNodeTypeDefinition {}

const ProjectSettingsForm = styled("form");

// SimpleDialog only exposes a content class, so the slot-level dialog chrome
// stays as a small component-local Panda escape hatch instead of global CSS.
const projectSettingsDialogClass = css({
  w: "min(800px, 96vw)",
  maxW: "min(800px, 96vw) !important",
  maxH: "calc(100dvh - 24px) !important",
  py: "12px",
  border: "1px solid rgba(96, 101, 95, 0.72)",
  background: "rgba(252, 253, 252, 0.94)",
  boxShadow: "0 28px 70px rgba(29, 33, 28, 0.22), 0 0 0 1px rgba(255, 255, 255, 0.64), inset 0 1px 0 rgba(255, 255, 255, 0.88)",
  gap: "8px",
  "& .dialog__header": {
    minW: "0",
    mx: "0",
    p: "12px 16px",
    borderBottom: "1px solid rgba(96, 101, 95, 0.28)",
    background: "rgba(248, 250, 248, 0.9)",
  },
  "& .dialog__body": {
    alignItems: "stretch",
    overflow: "hidden",
    p: "8px 16px 0",
  },
  "& .dialog__body > *": {
    w: "100%",
    minW: "0",
    minH: "0",
  },
  "& .dialog__footer": {
    p: "8px 16px 0",
    borderTop: "0",
    background: "transparent",
  },
});

export function ProjectMetadataSettingsDialog(
  props: ProjectMetadataSettingsDialogProps,
) {
  const submitUpdateSettings = useAction(updateProjectMetadataSchema);
  const [open, setOpen] = createSignal(false);
  const [pending, setPending] = createSignal(false);
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

  const saveSettings = async (formData: FormData) => {
    if (pending()) {
      return;
    }

    setPending(true);
    try {
      const result = await submitUpdateSettings(formData);
      props.onProjectUpdated?.(result);
      setOpen(false);
      toaster.success({
        title: "Project settings updated",
        description: "Project details and metadata settings were saved.",
      });
    } catch (error) {
      toaster.error({
        title: "Settings were not saved",
        description:
          error instanceof Error ? error.message : "Project settings could not be saved.",
      });
    } finally {
      setPending(false);
    }
  };

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
        contentClass={projectSettingsDialogClass}
        footer={
          <HStack>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form={formId}
              loading={pending()}
            >
              Save Settings
            </Button>
          </HStack>
        }
      >
        <ProjectSettingsForm
          id={formId}
          onSubmit={(event) => {
            event.preventDefault();
            void saveSettings(new FormData(event.currentTarget));
          }}
          minW="0"
          minH="0"
          p="8px"
          overflow="auto"
          border="1px solid rgba(96, 101, 95, 0.48)"
          borderRadius="4px"
          background="linear-gradient(90deg, rgba(31, 36, 33, 0.045) 1px, transparent 1px), linear-gradient(rgba(31, 36, 33, 0.045) 1px, transparent 1px), radial-gradient(circle at 12% 8%, rgba(48, 164, 108, 0.08), transparent 24rem), rgba(248, 250, 248, 0.9)"
          backgroundSize="24px 24px, 24px 24px, auto, auto"
          boxShadow="inset 0 1px 0 rgba(255, 255, 255, 0.76), 0 14px 36px rgba(29, 33, 28, 0.1)"
        >
          <input type="hidden" name="projectId" value={props.project.id} />
          <VStack alignItems="stretch" gap="3" mt="0" overflowX="auto" pb="0">
            <Box
              display="grid"
              gap="6px"
              minW="656px"
              p="8px"
              border="1px solid rgba(96, 101, 95, 0.34)"
              background="rgba(239, 241, 239, 0.86)"
              boxShadow="inset 3px 0 0 rgba(48, 164, 108, 0.22)"
            >
              <Field.Root display="grid" gridTemplateColumns="96px minmax(0, 1fr)" alignItems="start" gap="8px">
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
              <Field.Root display="grid" gridTemplateColumns="96px minmax(0, 1fr)" alignItems="start" gap="8px">
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

            <SettingsSectionTitle>
              Node Metadata Fields
            </SettingsSectionTitle>
            <Box {...metadataGridProps()} minH="30px" borderTop="1px solid rgba(96, 101, 95, 0.4)" borderBottom="1px solid rgba(96, 101, 95, 0.34)" background="rgba(226, 232, 224, 0.9)">
              <GridHeaderCell>Key</GridHeaderCell>
              <GridHeaderCell>Label</GridHeaderCell>
              <GridHeaderCell>Default Value</GridHeaderCell>
              <GridHeaderCell centered>Order</GridHeaderCell>
            </Box>

            <Box {...metadataGridProps()} borderBottom="1px solid rgba(96, 101, 95, 0.34)" background="rgba(239, 241, 239, 0.86)">
              <Index each={rows()}>
                {(row, index) => (
                  <>
                    <Field.Root {...gridCellProps()}>
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
                    <Field.Root {...gridCellProps()}>
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
                    <Field.Root {...gridCellProps()}>
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
                    <HStack gap="1" {...gridCellProps()} justifyContent="center" alignItems="center" background="rgba(232, 237, 229, 0.72)">
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

            <SettingsSectionTitle>
              Node Types
            </SettingsSectionTitle>
            <Box {...typeGridProps()} minH="30px" borderTop="1px solid rgba(96, 101, 95, 0.4)" borderBottom="1px solid rgba(96, 101, 95, 0.34)" background="rgba(226, 232, 224, 0.9)">
              <GridHeaderCell>Type Name</GridHeaderCell>
              <GridHeaderCell>Expected Color</GridHeaderCell>
              <GridHeaderCell centered>Order</GridHeaderCell>
            </Box>
            <Box {...typeGridProps()} borderBottom="1px solid rgba(96, 101, 95, 0.34)" background="rgba(239, 241, 239, 0.86)">
              <Index each={typeRows()}>
                {(row, index) => (
                  <>
                    <Field.Root {...gridCellProps()}>
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
                    <Field.Root {...gridCellProps()} display="flex" alignItems="center" gap="8px" background="rgba(248, 250, 248, 0.74)">
                      <input
                        aria-label={`Color for node type ${row().name || index + 1}`}
                        style={{
                          width: "34px",
                          height: "30px",
                          padding: "0",
                          border: "1px solid rgba(34, 41, 36, 0.28)",
                          background: "transparent",
                        }}
                        type="color"
                        name="nodeTypeColor"
                        value={row().color}
                        onInput={(event) =>
                          updateTypeRow(index, { color: event.currentTarget.value }, setTypeRows)
                        }
                      />
                      <Text as="span" color="var(--spatial-map-copy-muted)" fontSize="12px" fontWeight="700">
                        {row().color}
                      </Text>
                    </Field.Root>
                    <HStack gap="1" {...gridCellProps()} justifyContent="center" alignItems="center" background="rgba(232, 237, 229, 0.72)">
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
        </ProjectSettingsForm>
      </SimpleDialog>
    </>
  );
}

function SettingsSectionTitle(props: { children: JSX.Element }) {
  return (
    <Text
      as="h3"
      m="4px 0 -1px"
      color="var(--spatial-map-copy-muted)"
      fontSize="11px"
      fontWeight="700"
      letterSpacing="0.08em"
      lineHeight="1"
      textTransform="none"
    >
      {props.children}
    </Text>
  );
}

function GridHeaderCell(props: { children: JSX.Element; centered?: boolean }) {
  return (
    <Text
      as="span"
      display="flex"
      alignItems="center"
      justifyContent={props.centered ? "center" : undefined}
      minW="0"
      p="0 9px"
      borderRight={props.centered ? "0" : "1px solid rgba(96, 101, 95, 0.24)"}
      color="var(--spatial-map-copy-muted)"
      fontSize="11px"
      fontWeight="700"
      letterSpacing="0.08em"
      lineHeight="1"
      textTransform="none"
    >
      {props.children}
    </Text>
  );
}

function metadataGridProps() {
  return {
    display: "grid",
    gridTemplateColumns: "minmax(150px, 0.85fr) minmax(150px, 0.9fr) minmax(240px, 1.45fr) 94px",
    gap: "0",
    alignItems: "stretch",
    w: "100%",
    minW: "656px",
    borderInline: "1px solid rgba(96, 101, 95, 0.34)",
  } as const;
}

function typeGridProps() {
  return {
    display: "grid",
    gridTemplateColumns: "minmax(220px, 1fr) minmax(180px, 0.75fr) 94px",
    gap: "0",
    alignItems: "stretch",
    w: "100%",
    minW: "520px",
    borderInline: "1px solid rgba(96, 101, 95, 0.34)",
  } as const;
}

function gridCellProps() {
  return {
    minW: "0",
    minH: "44px",
    p: "5px",
    borderRight: "1px solid rgba(96, 101, 95, 0.18)",
    borderBottom: "1px solid rgba(96, 101, 95, 0.18)",
  } as const;
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
