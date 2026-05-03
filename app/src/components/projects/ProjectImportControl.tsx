import { useAction } from "@solidjs/router";
import { Upload } from "lucide-solid";
import { createSignal } from "solid-js";
import { css } from "styled-system/css";
import { Box, VStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import * as Field from "~/components/ui/field";
import { Text } from "~/components/ui/text";
import { toaster } from "~/components/ui/toast";
import { importProject } from "~/lib/projects/data";

const monoFont =
  '"IBM Plex Mono", "SFMono-Regular", "SF Mono", "Roboto Mono", "Consolas", monospace';

export function ProjectImportControl() {
  const submitImportProject = useAction(importProject);
  const [pending, setPending] = createSignal(false);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (pending()) {
          return;
        }

        setPending(true);
        void submitImportProject(new FormData(event.currentTarget)).catch((error) => {
          setPending(false);
          toaster.error({
            title: "Import failed",
            description:
              error instanceof Error ? error.message : "The project archive could not be imported.",
          });
        });
      }}
    >
      <VStack alignItems="stretch" gap="3">
        <Field.Root>
          <Field.Label fontSize="sm">
            Import project
          </Field.Label>
          <input
            type="file"
            name="archive"
            accept=".zip,application/zip"
            class={css({
              bg: "olive.1",
              borderColor: "olive.7",
              borderWidth: "1px",
              borderRadius: "l1",
              color: "fg.default",
              fontFamily: monoFont,
              fontSize: "xs",
              h: "10",
              px: "3",
              py: "2",
            })}
          />
          <Field.HelperText color="fg.muted">
            Choose a project ZIP file.
          </Field.HelperText>
        </Field.Root>
        <Button
          type="submit"
          size="sm"
          loading={pending()}
          loadingText="Importing"
          variant="outline"
          borderRadius="l1"
          h="10"
        >
          <Box as={Upload} boxSize="4" />
          <Text as="span">Import</Text>
        </Button>
      </VStack>
    </form>
  );
}
