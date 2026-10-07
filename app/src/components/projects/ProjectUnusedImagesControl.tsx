import { useAction } from "@solidjs/router";
import { ImageOff } from "lucide-solid";
import { createResource, createSignal, Show } from "solid-js";
import { HStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { IconButton } from "~/components/ui/icon-button";
import { SimpleDialog } from "~/components/ui/simple-dialog";
import { Text } from "~/components/ui/text";
import { toaster } from "~/components/ui/toast";
import { Tooltip } from "~/components/ui/tooltip";
import { getUnusedProjectImages, removeUnusedProjectImages } from "~/lib/projects/image-cleanup";

type ProjectUnusedImagesControlProps = {
  projectId: string;
  projectName: string;
};

export function ProjectUnusedImagesControl(props: ProjectUnusedImagesControlProps) {
  const [open, setOpen] = createSignal(false);
  const [pending, setPending] = createSignal(false);
  const submitRemoveUnusedImages = useAction(removeUnusedProjectImages);
  // Only scan the image folders while the dialog is open.
  const [unused, { refetch }] = createResource(
    () => (open() ? props.projectId : false),
    (projectId) => getUnusedProjectImages(projectId),
  );
  const fileCount = () => unused.latest?.fileCount ?? 0;

  const removeImages = async () => {
    if (pending()) return;
    setPending(true);
    try {
      const result = await submitRemoveUnusedImages({ projectId: props.projectId });
      toaster.success({
        title: "Unused images removed",
        description: `Removed ${formatFileCount(result.fileCount)} (${formatBytes(result.totalBytes)}).`,
      });
      setOpen(false);
    } catch (error) {
      toaster.error({
        title: "Cleanup failed",
        description: error instanceof Error ? error.message : "The unused images could not be removed.",
      });
      void refetch();
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <Tooltip content="Remove unused images" openDelay={150} closeDelay={80}>
        <IconButton
          type="button"
          variant="plain"
          size="2xs"
          color="var(--spatial-map-copy-dim)"
          aria-label={`Remove unused images from ${props.projectName}`}
          onClick={() => setOpen(true)}
        >
          <ImageOff size={14} />
        </IconButton>
      </Tooltip>
      <SimpleDialog
        open={open()}
        onOpenChange={setOpen}
        title="Remove unused images"
        description="Image files in this project's folder that no node uses, including archived nodes."
        maxW="480px"
        footer={
          <HStack justify="flex-end" gap="2" w="full">
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>
              {fileCount() > 0 ? "Keep" : "Close"}
            </Button>
            <Show when={fileCount() > 0}>
              <Button
                type="button"
                variant="danger"
                loading={pending()}
                onClick={() => {
                  void removeImages();
                }}
              >
                Remove {formatFileCount(fileCount())}
              </Button>
            </Show>
          </HStack>
        }
      >
        <Show
          when={unused.latest}
          fallback={
            <Text textStyle="sm" color="fg.muted">
              {unused.error ? "The image folder could not be checked." : "Checking image files..."}
            </Text>
          }
        >
          {(summary) => (
            <Text textStyle="sm" color="fg.muted">
              {summary().fileCount > 0
                ? `${formatFileCount(summary().fileCount)} (${formatBytes(summary().totalBytes)}) not used by any node. Removing them cannot be undone.`
                : "Every image file in this project is used by a node."}
            </Text>
          )}
        </Show>
      </SimpleDialog>
    </>
  );
}

function formatFileCount(count: number) {
  return `${count} ${count === 1 ? "file" : "files"}`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
