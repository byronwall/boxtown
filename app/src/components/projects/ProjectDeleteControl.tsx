import { useAction } from "@solidjs/router";
import { Trash2 } from "lucide-solid";
import { createSignal } from "solid-js";
import { Box, HStack, VStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { SimpleDialog } from "~/components/ui/simple-dialog";
import { Text } from "~/components/ui/text";
import { toaster } from "~/components/ui/toast";
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
      <Button
        type="button"
        variant="outline"
        size="xs"
        h="30px"
        minW="30px"
        px="0"
        borderRadius="4px"
        borderColor="rgba(127, 64, 54, 0.72)"
        color="#6e1f14"
        bg="rgba(230, 219, 215, 0.86)"
        transition="background-color 140ms ease, border-color 140ms ease"
        _hover={{ bg: "rgba(234, 223, 217, 0.96)", borderColor: "#7f4036" }}
        aria-label={`Delete ${props.projectName}`}
        onClick={() => setOpen(true)}
      >
        <Box as={Trash2} boxSize="4" />
      </Button>
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
              variant="solid"
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
        <VStack gap="4" alignItems="stretch">
          <Text textStyle="sm" color="#4a524a">
            This removes the project from the registry immediately.
          </Text>
        </VStack>
      </SimpleDialog>
    </>
  );
}
