import { useAction } from "@solidjs/router";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2 } from "lucide-solid";
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
import { Tooltip } from "~/components/ui/tooltip";
import { updateProjectMetadataSchema } from "~/lib/projects/data";
import { createNodeTypeColor } from "~/lib/projects/node-types";
import { appendClientMutationId, createClientMutationId } from "~/lib/projects/optimistic";
import type {
  ProjectNodeMetadataField,
  ProjectNodeTypeDefinition,
  ProjectRecord,
} from "~/lib/projects/types";

interface ProjectMetadataSettingsDialogProps {
  project: ProjectRecord;
  onProjectUpdated?: (project: ProjectRecord, options?: import("~/lib/projects/optimistic").ProjectUpdateOptions) => void;
  trigger?: (open: () => void) => JSX.Element;
}

interface MetadataSchemaRowDraft extends ProjectNodeMetadataField {
  originalKey: string;
}

interface NodeTypeRowDraft extends ProjectNodeTypeDefinition {}

type SettingsSection = "details" | "metadata" | "types";

const ProjectSettingsForm = styled("form");
const SettingsSectionButtonRoot = styled("button");

// SimpleDialog only exposes a content class, so the slot-level dialog chrome
// stays as a small component-local Panda escape hatch instead of global CSS.
const projectSettingsDialogClass = css({
  w: "min(880px, calc(100dvw - 24px))",
  maxW: "min(880px, calc(100dvw - 24px)) !important",
  h: "min(600px, calc(100dvh - 24px))",
  maxH: "calc(100dvh - 24px) !important",
  boxSizing: "border-box",
  "& .dialog__body": {
    alignItems: "stretch",
    flex: "1",
    minH: "0",
    overflow: "hidden",
    p: "0",
  },
  "& .dialog__body > *": {
    w: "100%",
    minW: "0",
    minH: "0",
  },
});

const gridScrollAreaClass = css({
  WebkitOverflowScrolling: "touch",
  scrollbarGutter: "stable",
});

const gridCellClass = css({
  "& textarea": {
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
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
  const [selectedSection, setSelectedSection] = createSignal<SettingsSection>("details");
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
    const clientMutationId = createClientMutationId();
    const previousProject = props.project;
    props.onProjectUpdated?.(
      {
        ...props.project,
        name: name().trim() || props.project.name,
        description: description().trim() || props.project.description,
        updatedAt: new Date().toISOString(),
        nodeMetadataSchema: rows().map(({ originalKey: _originalKey, ...row }) => row),
        nodeTypeSchema: typeRows(),
      },
      { clientMutationId, phase: "optimistic" },
    );
    try {
      const result = await submitUpdateSettings(appendClientMutationId(formData, clientMutationId));
      props.onProjectUpdated?.(result, { clientMutationId, phase: "server" });
      setOpen(false);
      toaster.success({
        title: "Project settings updated",
        description: "Project details and metadata settings were saved.",
      });
    } catch (error) {
      props.onProjectUpdated?.(previousProject, { clientMutationId, phase: "failed" });
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
          colorPalette="gray"
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
        title="Project settings"
        description="Project details, node metadata fields, and node types."
        maxW="min(880px, calc(100dvw - 24px))"
        contentClass={projectSettingsDialogClass}
        scrollBehavior="inside"
        footer={
          <HStack>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form={formId}
              colorPalette="gray"
              loading={pending()}
            >
              Save
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
          h="100%"
          maxH="100%"
          p="0"
          display="flex"
          flexDirection={{ base: "column", md: "row" }}
          overflow="hidden"
        >
          <input type="hidden" name="projectId" value={props.project.id} />
          <SettingsSectionRail
            selected={selectedSection()}
            metadataCount={rows().length}
            typeCount={typeRows().length}
            onSelect={setSelectedSection}
          />
          <Box flex="1" minW="0" minH="0" p="12px 16px" overflow="hidden">
            <VStack
              alignItems="stretch"
              gap="2"
              mt="0"
              h="100%"
              minH="0"
              overflowY="auto"
              overflowX="hidden"
              pb="1"
              pr="1"
            >
            <SettingsPanel selected={selectedSection() === "details"}>
            <SettingsSectionTitle>Project Details</SettingsSectionTitle>
            <Box display="grid" gap="8px" minW="0" maxW="560px">
              <Field.Root
                display="grid"
                gridTemplateColumns={{ base: "1fr", sm: "96px minmax(0, 1fr)" }}
                alignItems="start"
                gap="8px"
              >
                <Field.Label color="#475249" fontSize="12px" fontWeight="500" pt="7px">Title</Field.Label>
                <Textarea
                  variant="spatial"
                  size="compact"
                  autoResize={false}
                  minH="34px"
                  overflow="auto"
                  name="name"
                  value={name()}
                  onInput={(event) => setName(event.currentTarget.value)}
                  placeholder="Untitled Project"
                  rows={1}
                />
              </Field.Root>
              <Field.Root
                display="grid"
                gridTemplateColumns={{ base: "1fr", sm: "96px minmax(0, 1fr)" }}
                alignItems="start"
                gap="8px"
              >
                <Field.Label color="#475249" fontSize="12px" fontWeight="500" pt="7px">Subtitle</Field.Label>
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
            </SettingsPanel>

            <SettingsPanel selected={selectedSection() === "metadata"}>
            <SettingsSectionTitle>
              Node Metadata Fields
            </SettingsSectionTitle>
            <GridScrollArea>
              <Box {...metadataGridProps()} minH="26px" borderBottom="1px solid rgba(96, 101, 95, 0.34)">
                <GridHeaderCell>Key</GridHeaderCell>
                <GridHeaderCell>Label</GridHeaderCell>
                <GridHeaderCell>Default Value</GridHeaderCell>
                <GridHeaderCell centered>Order</GridHeaderCell>
              </Box>

              <Box {...metadataGridProps()} >
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
                      <HStack gap="1" {...gridCellProps()} justifyContent="center" alignItems="center">
                        <Tooltip content="Move up" openDelay={150} closeDelay={80}>
                          <IconButton
                            aria-label={`Move ${row().label || row().key || "field"} up`}
                            type="button"
                            size="2xs"
                            variant="plain"
                            color="#475249"
                          disabled={index === 0}
                          onClick={() => moveRow(index, -1, setRows)}
                          >
                            <ArrowUpIcon size={13} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip content="Move down" openDelay={150} closeDelay={80}>
                          <IconButton
                            aria-label={`Move ${row().label || row().key || "field"} down`}
                            type="button"
                            size="2xs"
                            variant="plain"
                            color="#475249"
                          disabled={index === rows().length - 1}
                          onClick={() => moveRow(index, 1, setRows)}
                          >
                            <ArrowDownIcon size={13} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip content="Remove" openDelay={150} closeDelay={80}>
                          <IconButton
                            aria-label={`Remove ${row().label || row().key || "field"}`}
                            type="button"
                            size="2xs"
                            variant="plain"
                            color="#475249"
                            _hover={{ background: "red.subtle.bg", color: "red.outline.fg" }}
                          onClick={() => removeRow(index, setRows)}
                          >
                            <Trash2 size={13} />
                          </IconButton>
                        </Tooltip>
                      </HStack>
                    </>
                  )}
                </Index>
              </Box>
            </GridScrollArea>

            <HStack justifyContent="space-between" alignItems="center" flexWrap="wrap">
              <Text color="#475249" fontSize="12px">
                Keys are normalized on save; existing node values follow a renamed key.
              </Text>
              <Button
                type="button"
                size="2xs"
                variant="surface"
                colorPalette="gray"
                onClick={() =>
                  setRows((current) => [
                    ...current,
                    { originalKey: "", key: "", label: "", defaultValue: "" },
                  ])
                }
              >
                <PlusIcon size={13} />
                Add field
              </Button>
            </HStack>
            </SettingsPanel>

            <SettingsPanel selected={selectedSection() === "types"}>
            <SettingsSectionTitle>
              Node Types
            </SettingsSectionTitle>
            <GridScrollArea>
              <Box {...typeGridProps()} minH="26px" borderBottom="1px solid rgba(96, 101, 95, 0.34)">
                <GridHeaderCell>Name</GridHeaderCell>
                <GridHeaderCell>Color</GridHeaderCell>
                <GridHeaderCell centered>Default</GridHeaderCell>
                <GridHeaderCell centered>Order</GridHeaderCell>
              </Box>
              <Box {...typeGridProps()} >
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
                      <HStack {...gridCellProps()} alignItems="center" gap="7px">
                        <input
                          aria-label={`Color for node type ${row().name || index + 1}`}
                          style={{
                            width: "28px",
                            height: "26px",
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
                        <Text as="span" color="#475249" fontFamily="mono" fontSize="11px">
                          {row().color}
                        </Text>
                      </HStack>
                      <HStack {...gridCellProps()} justifyContent="center" alignItems="center">
                        <input
                          aria-label={`Use ${row().name || "this type"} as the default for new nodes`}
                          title="Default type for new nodes (click again to clear)"
                          type="radio"
                          name="defaultNodeTypeIndex"
                          value={index}
                          checked={row().isDefault === true}
                          onClick={() => toggleDefaultTypeRow(index, setTypeRows)}
                        />
                      </HStack>
                      <HStack gap="1" {...gridCellProps()} justifyContent="center" alignItems="center">
                        <Tooltip content="Move up" openDelay={150} closeDelay={80}>
                          <IconButton
                            aria-label={`Move ${row().name || "type"} up`}
                            type="button"
                            size="2xs"
                            variant="plain"
                            color="#475249"
                          disabled={index === 0}
                          onClick={() => moveRow(index, -1, setTypeRows)}
                          >
                            <ArrowUpIcon size={13} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip content="Move down" openDelay={150} closeDelay={80}>
                          <IconButton
                            aria-label={`Move ${row().name || "type"} down`}
                            type="button"
                            size="2xs"
                            variant="plain"
                            color="#475249"
                          disabled={index === typeRows().length - 1}
                          onClick={() => moveRow(index, 1, setTypeRows)}
                          >
                            <ArrowDownIcon size={13} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip content="Remove" openDelay={150} closeDelay={80}>
                          <IconButton
                            aria-label={`Remove ${row().name || "type"}`}
                            type="button"
                            size="2xs"
                            variant="plain"
                            color="#475249"
                            _hover={{ background: "red.subtle.bg", color: "red.outline.fg" }}
                          onClick={() => removeRow(index, setTypeRows)}
                          >
                            <Trash2 size={13} />
                          </IconButton>
                        </Tooltip>
                      </HStack>
                    </>
                  )}
                </Index>
              </Box>
            </GridScrollArea>

            <HStack justifyContent="space-between" alignItems="center" flexWrap="wrap">
              <Text color="#475249" fontSize="12px">
                Type names are normalized on save and become the type picker options.
              </Text>
              <Button
                type="button"
                size="2xs"
                variant="surface"
                colorPalette="gray"
                onClick={() =>
                  setTypeRows((current) => [
                    ...current,
                    { name: "", color: createNodeTypeColor(current.length) },
                  ])
                }
              >
                <PlusIcon size={13} />
                Add type
              </Button>
            </HStack>
            </SettingsPanel>
            </VStack>
          </Box>
        </ProjectSettingsForm>
      </SimpleDialog>
    </>
  );
}

function SettingsSectionTitle(props: { children: JSX.Element }) {
  return (
    <Text
      as="h3"
      m="0"
      color="#475249"
      fontSize="11px"
      fontWeight="700"
      letterSpacing="0.08em"
      lineHeight="1.2"
      textTransform="uppercase"
    >
      {props.children}
    </Text>
  );
}

function SettingsPanel(props: { children: JSX.Element; selected: boolean }) {
  return (
    <VStack
      alignItems="stretch"
      gap="3"
      minW="0"
      display={props.selected ? "flex" : "none"}
      aria-hidden={props.selected ? undefined : "true"}
    >
      {props.children}
    </VStack>
  );
}

function SettingsSectionRail(props: {
  selected: SettingsSection;
  metadataCount: number;
  typeCount: number;
  onSelect: (section: SettingsSection) => void;
}) {
  return (
    <VStack
      as="nav"
      aria-label="Project settings sections"
      alignItems="stretch"
      gap="1"
      flexShrink="0"
      w={{ base: "100%", md: "176px" }}
      maxH={{ base: "none", md: "100%" }}
      p="8px"
      borderRight={{ base: "0", md: "1px solid rgba(96, 101, 95, 0.2)" }}
      borderBottom={{ base: "1px solid rgba(96, 101, 95, 0.2)", md: "0" }}
      overflowX={{ base: "auto", md: "hidden" }}
      overflowY="hidden"
    >
      <SettingsSectionButton
        selected={props.selected === "details"}
        label="Project Details"
        meta="Title and subtitle"
        onClick={() => props.onSelect("details")}
      />
      <SettingsSectionButton
        selected={props.selected === "metadata"}
        label="Metadata Fields"
        meta={`${props.metadataCount} fields`}
        onClick={() => props.onSelect("metadata")}
      />
      <SettingsSectionButton
        selected={props.selected === "types"}
        label="Node Types"
        meta={`${props.typeCount} types`}
        onClick={() => props.onSelect("types")}
      />
    </VStack>
  );
}

function SettingsSectionButton(props: {
  selected: boolean;
  label: string;
  meta: string;
  onClick: () => void;
}) {
  return (
    <SettingsSectionButtonRoot
      _active={{ transform: "scale(0.99)" }}
      type="button"
      aria-current={props.selected ? "page" : undefined}
      onClick={props.onClick}
      display="grid"
      gap="2px"
      minW={{ base: "144px", md: "0" }}
      p="6px 8px"
      border="0"
      borderRadius="4px"
      background={props.selected ? "rgba(233, 235, 232, 0.96)" : "transparent"}
      color="#171c19"
      cursor="pointer"
      font="inherit"
      textAlign="left"
      _hover={{
        background: props.selected ? "rgba(233, 235, 232, 0.96)" : "rgba(34, 41, 36, 0.06)",
      }}
    >
      <Text as="span" fontSize="12px" fontWeight={props.selected ? "700" : "500"} lineHeight="1.3">
        {props.label}
      </Text>
      <Text as="span" color="#475249" fontSize="11px" lineHeight="1.3">
        {props.meta}
      </Text>
    </SettingsSectionButtonRoot>
  );
}

function GridScrollArea(props: { children: JSX.Element }) {
  return (
    <Box
      minW="0"
      overflowX="auto"
      overflowY="hidden"
      class={gridScrollAreaClass}
    >
      {props.children}
    </Box>
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
      p="0 6px"
      color="#475249"
      fontSize="11px"
      fontWeight="500"
      lineHeight="1"
    >
      {props.children}
    </Text>
  );
}

function metadataGridProps() {
  return {
    display: "grid",
    gridTemplateColumns: "minmax(150px, 0.85fr) minmax(150px, 0.9fr) minmax(240px, 1.45fr) 126px",
    gap: "0",
    alignItems: "stretch",
    w: "100%",
    minW: "688px",
  } as const;
}

function typeGridProps() {
  return {
    display: "grid",
    gridTemplateColumns: "minmax(180px, 280px) 136px 72px 126px",
    gap: "0",
    alignItems: "stretch",
    w: "fit-content",
    maxW: "100%",
    minW: "514px",
  } as const;
}

function gridCellProps() {
  return {
    minW: "0",
    minH: "36px",
    p: "3px",
    borderBottom: "1px solid rgba(96, 101, 95, 0.2)",
    class: gridCellClass,
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
    ...(field.isDefault ? { isDefault: true } : {}),
  }));
}

// Radios can't be unchecked natively, so clicking the current default clears it
// (new nodes then fall back to the parent's type).
function toggleDefaultTypeRow(
  index: number,
  setRows: (setter: (current: NodeTypeRowDraft[]) => NodeTypeRowDraft[]) => void,
) {
  setRows((current) => {
    const clearing = current[index]?.isDefault === true;
    return current.map(({ isDefault: _isDefault, ...row }, rowIndex) =>
      !clearing && rowIndex === index ? { ...row, isDefault: true } : row,
    );
  });
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
