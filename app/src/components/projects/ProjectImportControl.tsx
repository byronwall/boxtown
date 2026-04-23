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
          <Field.Label fontSize="xs" textTransform="uppercase" letterSpacing="0.16em" fontFamily={monoFont}>
            Import project ZIP
          </Field.Label>
          <input
            type="file"
            name="archive"
            accept=".zip,application/zip"
            class={css({
              bg: "#eef1eb",
              borderColor: "#51584f",
              borderWidth: "1px",
              fontFamily: monoFont,
              fontSize: "xs",
              h: "10",
              px: "3",
              py: "2",
            })}
          />
          <Field.HelperText color="#4a524a">
            Upload an archive exported from another Product Grid server.
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
          textTransform="uppercase"
          letterSpacing="0.12em"
          fontFamily={monoFont}
        >
          <Box as={Upload} boxSize="4" />
          <Text as="span">Import project</Text>
        </Button>
      </VStack>
    </form>
  );
}
