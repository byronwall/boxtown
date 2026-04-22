import { useSubmission } from "@solidjs/router";
import { Trash2 } from "lucide-solid";
import { createSignal } from "solid-js";
import { Box, HStack, VStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { normalizeActionUrl } from "~/lib/router/action-url";
import { SimpleDialog } from "~/components/ui/simple-dialog";
import { Text } from "~/components/ui/text";
import { deleteProject } from "~/lib/projects/data";

type ProjectDeleteControlProps = {
  projectId: string;
  projectName: string;
};

export function ProjectDeleteControl(props: ProjectDeleteControlProps) {
  const [open, setOpen] = createSignal(false);
  const deleteSubmission = useSubmission(
    deleteProject,
    (input) => input[0] instanceof FormData && input[0].get("projectId") === props.projectId,
  );
  const formId = `delete-project-${props.projectId}`;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="xs"
        h="8"
        minW="8"
        px="0"
        borderRadius="0"
        borderColor="#7f4036"
        color="#6e1f14"
        bg="#e6dbd7"
        _hover={{ bg: "#eadfd9" }}
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
        footer={
          <HStack justify="flex-end" gap="2" w="full">
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>
              Keep
            </Button>
            <Button
              type="submit"
              form={formId}
              variant="solid"
              loading={deleteSubmission.pending}
            >
              Delete
            </Button>
          </HStack>
        }
      >
        <form
          id={formId}
          action={normalizeActionUrl(deleteProject.url)}
          method="post"
        >
          <VStack gap="4" alignItems="stretch">
            <input type="hidden" name="projectId" value={props.projectId} />
            <Text textStyle="sm" color="#4a524a">
              This removes the project from the registry immediately.
            </Text>
          </VStack>
        </form>
      </SimpleDialog>
    </>
  );
}
