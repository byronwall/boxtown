import { ChevronLeftIcon, ChevronRightIcon } from "lucide-solid";
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { Box, HStack, VStack, styled } from "styled-system/jsx";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { SimpleDialog } from "~/components/ui/simple-dialog";
import { toaster } from "~/components/ui/toast";
import { copyImageTargetToClipboard, downloadImageTarget } from "~/components/spatial-map/image-viewer-actions";
import { spatialMapImageViewerDialogClass } from "~/components/spatial-map/SpatialMapImages";
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
const SourcePreviewButton = styled("button");
const SourcePreviewImage = styled("img");

export function SourceImagePreview(props: SourceImagePreviewProps) {
  const [src, setSrc] = createSignal("");

  onMount(() => {
    const objectUrl = URL.createObjectURL(props.file);
    setSrc(objectUrl);
    onCleanup(() => URL.revokeObjectURL(objectUrl));
  });

  return (
    <SourcePreviewButton
      type="button"
      w="38px"
      h="30px"
      flex="0 0 auto"
      overflow="hidden"
      border="1px solid rgba(34, 41, 36, 0.22)"
      background="rgba(214, 220, 212, 0.92)"
      cursor="zoom-in"
      p="0"
      _hover={{ borderColor: "rgba(23, 62, 39, 0.62)", outline: "none", boxShadow: "inset 0 0 0 1px rgba(23, 62, 39, 0.42)" }}
      _focusVisible={{ borderColor: "rgba(23, 62, 39, 0.62)", outline: "none", boxShadow: "inset 0 0 0 1px rgba(23, 62, 39, 0.42)" }}
      aria-label={`Preview ${props.file.name || "source image"}`}
      title={props.file.name || "source image"}
      onClick={() => props.onOpen(props.file)}
    >
      <Show when={src()}>
        {(resolvedSrc) => <SourcePreviewImage src={resolvedSrc()} alt={props.file.name || "Source image"} display="block" w="100%" h="100%" objectFit="cover" />}
      </Show>
    </SourcePreviewButton>
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
      contentClass={spatialMapImageViewerDialogClass}
      footer={
        <HStack justifyContent="space-between" width="100%" gap="2" flexWrap="wrap">
          <Box as="span" color="var(--spatial-map-copy-muted)" fontSize="12px">
            Wheel zoom, drag pan, double-click reset.
          </Box>
          <HStack gap="2" flexWrap="wrap" justifyContent="flex-end">
            <Button size="xs" variant="outline" onClick={copyImage}>
              Copy Image
            </Button>
            <Button size="xs" variant="outline" onClick={downloadImage}>
              Download
            </Button>
            <Button size="xs" variant="outline" onClick={() => zoomBy(0.8)}>
              Zoom Out
            </Button>
            <Button size="xs" variant="outline" onClick={resetView}>
              Reset
            </Button>
            <Button size="xs" variant="outline" onClick={() => zoomBy(1.25)}>
              Zoom In
            </Button>
          </HStack>
        </HStack>
      }
    >
      <Show when={activeFile() && activeSrc()}>
        <Box
          data-has-thumbnails={hasMultipleImages() ? "true" : "false"}
          display="grid"
          gridTemplateColumns={{ base: "minmax(0, 1fr)", md: hasMultipleImages() ? "180px minmax(0, 1fr)" : "minmax(0, 1fr)" }}
          flex="1"
          alignSelf="stretch"
          h="100%"
          minH="0"
          overflow="hidden"
        >
            <Show when={hasMultipleImages()}>
              <VStack
                as="nav"
                alignItems="stretch"
                gap="2"
                p={{ base: "0 0 6px", md: "10px" }}
                borderRight={{ base: "0", md: "1px solid rgba(96, 101, 95, 0.34)" }}
                borderBottom={{ base: "1px solid rgba(96, 101, 95, 0.34)", md: "0" }}
                overflowX={{ base: "auto", md: "hidden" }}
                overflowY={{ base: "hidden", md: "auto" }}
                display={{ base: "grid", md: "flex" }}
                gridAutoFlow={{ base: "column", md: undefined }}
                gridAutoColumns={{ base: "minmax(150px, 200px)", md: undefined }}
                aria-label="Source image thumbnails"
              >
                <For each={props.files}>
                  {(thumbFile, thumbIndex) => (
                    <SourcePreviewButton
                      type="button"
                      h={{ base: "150px", md: "112px" }}
                      p="0"
                      position="relative"
                      border="1px solid"
                      borderColor={thumbIndex() === props.index ? "rgba(23, 62, 39, 0.62)" : "rgba(34, 41, 36, 0.18)"}
                      borderRadius="6px"
                      background="rgba(232, 236, 230, 0.78)"
                      cursor="pointer"
                      overflow="hidden"
                      boxShadow={thumbIndex() === props.index ? "inset 0 0 0 1px rgba(23, 62, 39, 0.42)" : undefined}
                      aria-label={`Show ${thumbFile.name || "source image"}`}
                      aria-current={thumbIndex() === props.index ? "true" : undefined}
                      onClick={() => setActiveIndex(thumbIndex())}
                    >
                      <Show when={thumbSrcs()[thumbIndex()]}>
                        {(thumbSrc) => <SourcePreviewImage src={thumbSrc()} alt={thumbFile.name || "Source image"} loading="lazy" display="block" w="100%" h="100%" objectFit="cover" />}
                      </Show>
                      <Box as="span" position="absolute" left="6px" bottom="6px" p="2px 5px" borderRadius="4px" background="rgba(17, 22, 19, 0.72)" color="white" fontSize="10px" fontWeight="700">
                        {thumbIndex() + 1}
                      </Box>
                    </SourcePreviewButton>
                  )}
                </For>
              </VStack>
            </Show>
            <VStack alignItems="stretch" gap="2" minW="0" h="100%" minH="0" overflow="hidden">
              <Box position="relative" display="grid" minH="0" h="100%" background="rgba(221, 226, 219, 0.72)">
                <Show when={hasMultipleImages()}>
                  <SourcePreviewButton type="button" position="absolute" left="10px" top="50%" zIndex="2" transform="translateY(-50%)" display="inline-flex" alignItems="center" justifyContent="center" w="36px" h="36px" border="1px solid rgba(34, 41, 36, 0.22)" borderRadius="999px" background="rgba(252, 253, 252, 0.9)" color="var(--spatial-map-copy)" cursor="pointer" aria-label="Show previous image" onClick={showPrevious}>
                    <ChevronLeftIcon size={22} />
                  </SourcePreviewButton>
                </Show>
                <Box
                  ref={imageViewport.setStageRef}
                  minH="0"
                  h="100%"
                  overflow="hidden"
                  cursor="grab"
                  touchAction="none"
                  userSelect="none"
                  position="relative"
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
                  <SourcePreviewImage
                    src={activeSrc()}
                    alt={activeFile()?.name || "Source image"}
                    draggable={false}
                    display="block"
                    maxW="none"
                    transformOrigin="top left"
                    userSelect="none"
                    pointerEvents="none"
                    onLoad={(event) => imageViewport.handleImageLoad(event)}
                    style={{
                      transform: `translate(${imageViewport.offset().x}px, ${imageViewport.offset().y}px) scale(${imageViewport.scale()})`,
                    }}
                  />
                </Box>
                <Show when={hasMultipleImages()}>
                  <SourcePreviewButton type="button" position="absolute" right="10px" top="50%" zIndex="2" transform="translateY(-50%)" display="inline-flex" alignItems="center" justifyContent="center" w="36px" h="36px" border="1px solid rgba(34, 41, 36, 0.22)" borderRadius="999px" background="rgba(252, 253, 252, 0.9)" color="var(--spatial-map-copy)" cursor="pointer" aria-label="Show next image" onClick={showNext}>
                    <ChevronRightIcon size={22} />
                  </SourcePreviewButton>
                </Show>
              </Box>
              <HStack gap="2" flexWrap="wrap">
                <Badge as="span" variant="spatial" size="2xs">
                  {(props.index ?? 0) + 1} / {props.files.length || 1}
                </Badge>
                <Badge as="span" variant="spatial" size="2xs">{activeFile()?.type || "image"}</Badge>
                <Badge as="span" variant="spatial" size="2xs">{formatBytes(activeFile()?.size ?? 0)}</Badge>
                <Badge as="span" variant="spatial" size="2xs">{Math.round(imageViewport.scale() * 100)}%</Badge>
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
