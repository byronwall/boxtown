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
            Archive
          </Field.Label>
          <input
            type="file"
            name="archive"
            accept=".zip,application/zip"
            class={css({
              bg: "rgba(252, 253, 252, 0.78)",
              borderColor: "var(--spatial-map-panel-border)",
              borderWidth: "1px",
              borderRadius: "4px",
              color: "var(--spatial-map-copy)",
              fontFamily: monoFont,
              fontSize: "xs",
              h: "36px",
              px: "3",
              py: "2",
              _focusVisible: {
                outline: "2px solid var(--spatial-map-accent)",
                outlineOffset: "2px",
              },
            })}
          />
          <Field.HelperText color="var(--spatial-map-copy-dim)" fontSize="11px">
            Choose a project ZIP file.
          </Field.HelperText>
        </Field.Root>
        <Button
          type="submit"
          size="sm"
          loading={pending()}
          loadingText="Importing"
          variant="outline"
          borderRadius="4px"
          borderColor="var(--spatial-map-panel-border-strong)"
          h="34px"
        >
          <Box as={Upload} boxSize="4" />
          <Text as="span">Import</Text>
        </Button>
      </VStack>
    </form>
  );
}
