import { useAction } from "@solidjs/router";
import { Trash2 } from "lucide-solid";
import { createSignal } from "solid-js";
import { HStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { IconButton } from "~/components/ui/icon-button";
import { SimpleDialog } from "~/components/ui/simple-dialog";
import { Text } from "~/components/ui/text";
import { toaster } from "~/components/ui/toast";
import { Tooltip } from "~/components/ui/tooltip";
import { deleteProject } from "~/lib/projects/data";

type ProjectDeleteControlProps = {
  projectId: string;
  projectName: string;
};

export function ProjectDeleteControl(props: ProjectDeleteControlProps) {
  const [open, setOpen] = createSignal(false);
  const [pending, setPending] = createSignal(false);
  let deleteButtonRef: HTMLButtonElement | undefined;
  const submitDeleteProject = useAction(deleteProject);

  const deleteCurrentProject = async () => {
    if (pending()) {
      return;
    }

    const formData = new FormData();
    formData.set("projectId", props.projectId);

    setPending(true);
    try {
      await submitDeleteProject(formData);
    } catch (error) {
      setPending(false);
      toaster.error({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "The project could not be deleted.",
      });
    }
  };

  return (
    <>
      <Tooltip content="Delete project" openDelay={150} closeDelay={80}>
        <IconButton
          type="button"
          variant="plain"
          size="2xs"
          color="var(--spatial-map-copy-dim)"
          _hover={{ background: "red.subtle.bg", color: "red.outline.fg" }}
          aria-label={`Delete ${props.projectName}`}
          onClick={() => setOpen(true)}
        >
          <Trash2 size={14} />
        </IconButton>
      </Tooltip>
      <SimpleDialog
        open={open()}
        onOpenChange={setOpen}
        title="Delete project"
        description={`Delete ${props.projectName}? This removes the project from the registry immediately.`}
        maxW="480px"
        initialFocusEl={() => deleteButtonRef ?? null}
        footer={
          <HStack justify="flex-end" gap="2" w="full">
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>
              Keep
            </Button>
            <Button
              ref={deleteButtonRef}
              type="button"
              variant="danger"
              loading={pending()}
              onClick={() => {
                void deleteCurrentProject();
              }}
            >
              Delete
            </Button>
          </HStack>
        }
      >
        <Text textStyle="sm" color="fg.muted">
          Download an archive first if you might want it back.
        </Text>
      </SimpleDialog>
    </>
  );
}
