import { useSubmission } from "@solidjs/router";
import { Upload } from "lucide-solid";
import { css } from "styled-system/css";
import { Box, VStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import * as Field from "~/components/ui/field";
import { Text } from "~/components/ui/text";
import { importProject } from "~/lib/projects/data";
import { normalizeActionUrl } from "~/lib/router/action-url";

const monoFont =
  '"IBM Plex Mono", "SFMono-Regular", "SF Mono", "Roboto Mono", "Consolas", monospace';

export function ProjectImportControl() {
  const submission = useSubmission(importProject);

  return (
    <form action={normalizeActionUrl(importProject.url)} method="post" enctype="multipart/form-data">
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
              bg: "olive.2",
              borderColor: "olive.8",
              borderWidth: "1px",
              borderRadius: "0",
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
          loading={submission.pending}
          loadingText="Importing"
          variant="outline"
          borderRadius="0"
          h="10"
        >
          <Box as={Upload} boxSize="4" />
          <Text as="span">Import</Text>
        </Button>
      </VStack>
    </form>
  );
}
