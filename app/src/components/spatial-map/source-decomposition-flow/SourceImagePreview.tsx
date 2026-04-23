import { createEffect, createSignal, onCleanup, onMount, Show, untrack } from "solid-js";
import { Box, HStack, VStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { SimpleDialog } from "~/components/ui/simple-dialog";
import { toaster } from "~/components/ui/toast";
import { copyImageTargetToClipboard, downloadImageTarget } from "~/components/spatial-map/image-viewer-actions";
import { createContainedImageViewport } from "~/components/spatial-map/use-contained-image-viewport";

interface SourceImagePreviewProps {
  file: File;
  onOpen: (file: File) => void;
}

interface SourceImagePreviewDialogProps {
  file: File | null;
  onOpenChange: (open: boolean) => void;
}

interface PanSession {
  pointerId: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
}

const MIN_SCALE = 0.2;
const MAX_SCALE = 8;

export function SourceImagePreview(props: SourceImagePreviewProps) {
  const [src, setSrc] = createSignal("");

  onMount(() => {
    const objectUrl = URL.createObjectURL(props.file);
    setSrc(objectUrl);
    onCleanup(() => URL.revokeObjectURL(objectUrl));
  });

  return (
    <button
      type="button"
      class="spatial-map-source-image-thumb"
      aria-label={`Preview ${props.file.name || "source image"}`}
      title={props.file.name || "source image"}
      onClick={() => props.onOpen(props.file)}
    >
      <Show when={src()}>
        {(resolvedSrc) => <img src={resolvedSrc()} alt={props.file.name || "Source image"} />}
      </Show>
    </button>
  );
}

export function SourceImagePreviewDialog(props: SourceImagePreviewDialogProps) {
  const [src, setSrc] = createSignal("");
  const imageViewport = createContainedImageViewport({
    minScale: MIN_SCALE,
    maxScale: MAX_SCALE,
  });
  let panSession: PanSession | undefined;

  const resetView = () => {
    imageViewport.resetView();
  };

  const zoomBy = (amount: number, anchorClientX?: number, anchorClientY?: number) => {
    imageViewport.zoomBy(amount, anchorClientX, anchorClientY);
  };

  const copyImage = async () => {
    if (!props.file) return;

    try {
      await copyImageTargetToClipboard({
        file: props.file,
        filename: props.file.name || "source-image",
        mimeType: props.file.type,
      });
      toaster.success({
        title: "Image copied",
        description: "The source image is now available on your clipboard.",
      });
    } catch (error) {
      toaster.error({
        title: "Copy failed",
        description: error instanceof Error ? error.message : "The image could not be copied.",
      });
    }
  };

  const downloadImage = async () => {
    if (!props.file) return;

    try {
      await downloadImageTarget({
        file: props.file,
        filename: props.file.name || "source-image",
        mimeType: props.file.type,
      });
      toaster.success({
        title: "Download started",
        description: props.file.name || "source-image",
      });
    } catch (error) {
      toaster.error({
        title: "Download failed",
        description: error instanceof Error ? error.message : "The image could not be downloaded.",
      });
    }
  };

  let activeUrl = "";
  createEffect(() => {
    if (activeUrl) {
      URL.revokeObjectURL(activeUrl);
      activeUrl = "";
    }
    untrack(() => {
      imageViewport.clearImageSize();
      resetView();
    });

    if (!props.file) {
      setSrc("");
      return;
    }

    activeUrl = URL.createObjectURL(props.file);
    setSrc(activeUrl);
  });

  onCleanup(() => {
    if (activeUrl) {
      URL.revokeObjectURL(activeUrl);
    }
  });

  return (
    <SimpleDialog
      open={Boolean(props.file)}
      onOpenChange={(open) => {
        if (!open) {
          imageViewport.clearImageSize();
          resetView();
        }
        props.onOpenChange(open);
      }}
      title={props.file ? props.file.name || "Source image" : "Source image"}
      description={props.file ? `${props.file.type || "image"} · ${formatBytes(props.file.size)}` : undefined}
      maxW="min(1120px, 96vw)"
      contentClass="spatial-map-image-viewer-dialog"
      footer={
        <HStack justifyContent="space-between" width="100%" gap="2" flexWrap="wrap">
          <span class="spatial-map-image-viewer-help">Wheel zoom, drag pan, double-click reset.</span>
          <HStack gap="2" flexWrap="wrap" justifyContent="flex-end">
            <Button size="xs" variant="outline" class="spatial-map-button" onClick={copyImage}>
              Copy Image
            </Button>
            <Button size="xs" variant="outline" class="spatial-map-button" onClick={downloadImage}>
              Download
            </Button>
            <Button size="xs" variant="outline" class="spatial-map-button" onClick={() => zoomBy(0.8)}>
              Zoom Out
            </Button>
            <Button size="xs" variant="outline" class="spatial-map-button" onClick={resetView}>
              Reset
            </Button>
            <Button size="xs" variant="outline" class="spatial-map-button" onClick={() => zoomBy(1.25)}>
              Zoom In
            </Button>
          </HStack>
        </HStack>
      }
    >
      <Show when={props.file && src()}>
        <VStack alignItems="stretch" gap="2">
          <Box
            ref={imageViewport.setStageRef}
            class="spatial-map-image-viewer-stage"
            onWheel={(event) => {
              event.preventDefault();
              const rawDelta =
                event.deltaMode === 1
                  ? event.deltaY * 16
                  : event.deltaMode === 2
                    ? event.deltaY * window.innerHeight
                    : event.deltaY;
              zoomBy(Math.exp(-clamp(rawDelta, -80, 80) * 0.0015), event.clientX, event.clientY);
            }}
            onDblClick={resetView}
            onPointerDown={(event) => {
              panSession = {
                pointerId: event.pointerId,
                x: event.clientX,
                y: event.clientY,
                startX: imageViewport.offset().x,
                startY: imageViewport.offset().y,
              };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (!panSession || panSession.pointerId !== event.pointerId) return;
              imageViewport.setOffset({
                x: panSession.startX + event.clientX - panSession.x,
                y: panSession.startY + event.clientY - panSession.y,
              });
            }}
            onPointerUp={(event) => {
              if (panSession?.pointerId === event.pointerId) {
                panSession = undefined;
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
            }}
            onPointerCancel={() => {
              panSession = undefined;
            }}
          >
            <img
              src={src()}
              alt={props.file?.name || "Source image"}
              draggable={false}
              onLoad={imageViewport.handleImageLoad}
              style={{
                transform: `translate(${imageViewport.offset().x}px, ${imageViewport.offset().y}px) scale(${imageViewport.scale()})`,
              }}
            />
          </Box>
          <HStack class="spatial-map-image-viewer-meta" gap="2" flexWrap="wrap">
            <span>{props.file?.type || "image"}</span>
            <span>{props.file ? formatBytes(props.file.size) : "0 B"}</span>
            <span>{Math.round(imageViewport.scale() * 100)}%</span>
          </HStack>
        </VStack>
      </Show>
    </SimpleDialog>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 102.4) / 10} KB`;
  return `${Math.round(bytes / 1024 / 102.4) / 10} MB`;
}
