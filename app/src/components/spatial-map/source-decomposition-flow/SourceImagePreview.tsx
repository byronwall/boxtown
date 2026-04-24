import { ChevronLeftIcon, ChevronRightIcon } from "lucide-solid";
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
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
  files: File[];
  index: number | null;
  onIndexChange: (index: number) => void;
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
  const [thumbSrcs, setThumbSrcs] = createSignal<string[]>([]);
  const imageViewport = createContainedImageViewport({
    minScale: MIN_SCALE,
    maxScale: MAX_SCALE,
  });
  let panSession: PanSession | undefined;
  let imageSwitchRequestId = 0;
  const activeFile = createMemo(() => {
    const index = props.index;
    return typeof index === "number" && index >= 0 ? props.files[index] ?? null : null;
  });
  const activeSrc = createMemo(() => {
    const index = props.index;
    return typeof index === "number" && index >= 0 ? thumbSrcs()[index] ?? "" : "";
  });
  const hasMultipleImages = createMemo(() => props.files.length > 1);

  const resetView = () => {
    imageViewport.resetView();
  };

  const zoomBy = (amount: number, anchorClientX?: number, anchorClientY?: number) => {
    imageViewport.zoomBy(amount, anchorClientX, anchorClientY);
  };

  const setActiveIndex = (index: number) => {
    if (props.files.length === 0) return;
    const nextIndex = (index + props.files.length) % props.files.length;
    if (nextIndex === props.index) return;
    const requestId = ++imageSwitchRequestId;
    const nextSrc = thumbSrcs()[nextIndex];
    const onIndexChange = props.onIndexChange;
    panSession = undefined;
    if (!nextSrc) {
      props.onIndexChange(nextIndex);
      return;
    }
    void preloadImageSize(nextSrc)
      .then((size) => {
        if (requestId !== imageSwitchRequestId) return;
        imageViewport.setLoadedImageSize(size, { immediate: true });
      })
      .catch(() => {
        if (requestId !== imageSwitchRequestId) return;
        imageViewport.clearImageSize();
        resetView();
      })
      .finally(() => {
        if (requestId !== imageSwitchRequestId) return;
        onIndexChange(nextIndex);
      });
  };

  const showPrevious = () => setActiveIndex((props.index ?? 0) - 1);
  const showNext = () => setActiveIndex((props.index ?? 0) + 1);

  const copyImage = async () => {
    const file = activeFile();
    if (!file) return;

    try {
      await copyImageTargetToClipboard({
        file,
        filename: file.name || "source-image",
        mimeType: file.type,
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
    const file = activeFile();
    if (!file) return;

    try {
      await downloadImageTarget({
        file,
        filename: file.name || "source-image",
        mimeType: file.type,
      });
      toaster.success({
        title: "Download started",
        description: file.name || "source-image",
      });
    } catch (error) {
      toaster.error({
        title: "Download failed",
        description: error instanceof Error ? error.message : "The image could not be downloaded.",
      });
    }
  };

  createEffect(() => {
    const urls = props.files.map((file) => URL.createObjectURL(file));
    setThumbSrcs(urls);
    onCleanup(() => {
      for (const url of urls) {
        URL.revokeObjectURL(url);
      }
    });
  });

  onMount(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!activeFile() || !hasMultipleImages()) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        showPrevious();
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        showNext();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  return (
    <SimpleDialog
      open={Boolean(activeFile())}
      onOpenChange={(open) => {
        if (!open) {
          imageViewport.clearImageSize();
          resetView();
        }
        props.onOpenChange(open);
      }}
      title={activeFile()?.name || "Source image"}
      description={activeFile() ? `${activeFile()?.type || "image"} · ${formatBytes(activeFile()?.size ?? 0)}` : undefined}
      maxW="min(1340px, 96vw)"
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
      <Show when={activeFile() && activeSrc()}>
        <Box class="spatial-map-image-viewer-layout" data-has-thumbnails={hasMultipleImages() ? "true" : "false"}>
            <Show when={hasMultipleImages()}>
              <VStack as="nav" alignItems="stretch" gap="2" class="spatial-map-image-viewer-thumbs" aria-label="Source image thumbnails">
                <For each={props.files}>
                  {(thumbFile, thumbIndex) => (
                    <button
                      type="button"
                      class="spatial-map-image-viewer-thumb"
                      classList={{ "is-active": thumbIndex() === props.index }}
                      aria-label={`Show ${thumbFile.name || "source image"}`}
                      aria-current={thumbIndex() === props.index ? "true" : undefined}
                      onClick={() => setActiveIndex(thumbIndex())}
                    >
                      <Show when={thumbSrcs()[thumbIndex()]}>
                        {(thumbSrc) => <img src={thumbSrc()} alt={thumbFile.name || "Source image"} loading="lazy" />}
                      </Show>
                      <span>{thumbIndex() + 1}</span>
                    </button>
                  )}
                </For>
              </VStack>
            </Show>
            <VStack alignItems="stretch" gap="2" minW="0">
              <Box class="spatial-map-image-viewer-frame">
                <Show when={hasMultipleImages()}>
                  <button type="button" class="spatial-map-image-viewer-arrow is-previous" aria-label="Show previous image" onClick={showPrevious}>
                    <ChevronLeftIcon size={22} />
                  </button>
                </Show>
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
                    src={activeSrc()}
                    alt={activeFile()?.name || "Source image"}
                    draggable={false}
                    onLoad={(event) => imageViewport.handleImageLoad(event)}
                    style={{
                      transform: `translate(${imageViewport.offset().x}px, ${imageViewport.offset().y}px) scale(${imageViewport.scale()})`,
                    }}
                  />
                </Box>
                <Show when={hasMultipleImages()}>
                  <button type="button" class="spatial-map-image-viewer-arrow is-next" aria-label="Show next image" onClick={showNext}>
                    <ChevronRightIcon size={22} />
                  </button>
                </Show>
              </Box>
              <HStack class="spatial-map-image-viewer-meta" gap="2" flexWrap="wrap">
                <span>
                  {(props.index ?? 0) + 1} / {props.files.length || 1}
                </span>
                <span>{activeFile()?.type || "image"}</span>
                <span>{formatBytes(activeFile()?.size ?? 0)}</span>
                <span>{Math.round(imageViewport.scale() * 100)}%</span>
              </HStack>
            </VStack>
        </Box>
      </Show>
    </SimpleDialog>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function preloadImageSize(src: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      resolve({
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height,
      });
    };
    image.onerror = () => reject(new Error("Image preload failed."));
    image.src = src;
  });
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 102.4) / 10} KB`;
  return `${Math.round(bytes / 1024 / 102.4) / 10} MB`;
}
