import { useAction } from "@solidjs/router";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardIcon,
  DownloadIcon,
  RotateCcwIcon,
  Trash2Icon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-solid";
import {
  createContext,
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
  untrack,
  useContext,
  type JSX,
} from "solid-js";
import { css } from "styled-system/css";
import { Box, HStack, VStack, styled } from "styled-system/jsx";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { CloseButton } from "~/components/ui/close-button";
import * as Dialog from "~/components/ui/dialog";
import { SimpleDialog } from "~/components/ui/simple-dialog";
import { toaster } from "~/components/ui/toast";
import {
  addProjectNodeImages,
  deleteProjectNodeImage,
} from "~/lib/projects/data";
import { appendClientMutationId, createClientMutationId } from "~/lib/projects/optimistic";
import type { ProjectRecord } from "~/lib/projects/types";
import type {
  MapLink,
  MapNode,
  MapNodeImage,
  SpatialMapData,
} from "~/lib/spatial-map/types";
import { calculateNodeDepths } from "~/lib/spatial-map/depth";

import {
  copyImageTargetToClipboard,
  downloadImageTarget,
} from "./image-viewer-actions";
import { isEditableTarget } from "./spatial-map-dom";
import { useSpatialMap } from "./SpatialMapContext";
import { createContainedImageViewport } from "./use-contained-image-viewport";

export interface SpatialMapImageTarget {
  image: MapNodeImage;
  node: MapNode;
}

interface SpatialMapImageContextValue {
  openImage: (
    image: MapNodeImage,
    node: MapNode,
    images?: MapNodeImage[],
  ) => void;
  openImageTargets: (
    targets: SpatialMapImageTarget[],
    activeImage: MapNodeImage,
    options?: { canDelete?: boolean },
  ) => void;
  uploadImages: (nodeId: string, files: File[]) => Promise<void>;
}

interface ImageViewerState {
  items: SpatialMapImageTarget[];
  index: number;
  canDelete: boolean;
}

interface ViewerPanSession {
  pointerId: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
}

const SpatialMapImageContext = createContext<SpatialMapImageContextValue>();
const IMAGE_DEBUG_PREFIX = "[spatial-map-images]";
const ImageButton = styled("button");
const ViewerImage = styled("img");

// The image viewer is rendered through SimpleDialog, which exposes the content
// node as a class hook instead of slot props. Keep that selector local here.
export const spatialMapImageViewerDialogClass = css({
  w: "min(1340px, 96vw) !important",
  maxW: "min(1340px, 96vw) !important",
  h: "min(860px, calc(100dvh - 28px))",
  maxH: "calc(100dvh - 28px) !important",
  border: "1px solid rgba(96, 101, 95, 0.72) !important",
  borderRadius: "10px !important",
  background: "rgba(252, 253, 252, 0.96) !important",
  boxShadow: "0 28px 70px rgba(29, 33, 28, 0.22), 0 0 0 1px rgba(255, 255, 255, 0.64), inset 0 1px 0 rgba(255, 255, 255, 0.88) !important",
  "& .dialog__body": {
    minH: "0",
    overflow: "hidden",
    p: "0",
  },
  "& .dialog__header": {
    minW: "0",
    p: "10px 12px",
    borderBottom: "1px solid rgba(96, 101, 95, 0.28)",
    background: "rgba(248, 250, 248, 0.9)",
  },
  "& .dialog__footer": {
    p: "8px 12px",
    borderTop: "1px solid rgba(96, 101, 95, 0.22)",
    background: "rgba(248, 250, 248, 0.9)",
  },
});
const IMAGE_VIEWER_MIN_SCALE = 0.2;
const IMAGE_VIEWER_MAX_SCALE = 8;

export function SpatialMapImageProvider(props: {
  project: ProjectRecord;
  onProjectUpdated?: (project: ProjectRecord, options?: import("~/lib/projects/optimistic").ProjectUpdateOptions) => void;
  children: JSX.Element;
}) {
  const spatialMap = useSpatialMap();
  const [viewerState, setViewerState] = createSignal<ImageViewerState | null>(
    null,
  );
  const [pendingDeleteImageId, setPendingDeleteImageId] = createSignal<
    string | null
  >(null);
  const submitAddProjectNodeImages = useAction(addProjectNodeImages);
  const submitDeleteProjectNodeImage = useAction(deleteProjectNodeImage);

  const applyDeletedImageResult = (result: ProjectRecord, clientMutationId: string) => {
    props.onProjectUpdated?.(result, { clientMutationId, phase: "server" });
    setViewerState((state) => {
      if (!state) return state;
      const nodesById = new Map(
        result.spatialMap.nodes.map((node) => [node.id, node]),
      );
      const items = state.items.flatMap((item) => {
        const node = nodesById.get(item.node.id);
        const image = node?.images?.find(
          (nodeImage) => nodeImage.id === item.image.id,
        );
        return node && image ? [{ node, image }] : [];
      });
      if (items.length === 0) return null;

      return {
        items,
        index: Math.min(state.index, items.length - 1),
        canDelete: state.canDelete,
      };
    });
    toaster.success({
      title: "Image deleted",
      description: "The image was removed from this node.",
    });
    setPendingDeleteImageId(null);
  };

  const uploadImages = async (nodeId: string, files: File[]) => {
    console.info(IMAGE_DEBUG_PREFIX, "upload requested", {
      nodeId,
      receivedFiles: describeFiles(files),
    });
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      console.warn(IMAGE_DEBUG_PREFIX, "upload skipped: no image/* files", {
        nodeId,
        receivedFiles: describeFiles(files),
      });
      return;
    }

    try {
      const formData = new FormData();
      formData.set("projectId", props.project.id);
      formData.set("nodeId", nodeId);
      for (const file of imageFiles) {
        formData.append("images", file);
      }
      console.info(IMAGE_DEBUG_PREFIX, "submitting upload form", {
        nodeId,
        uploadedFiles: describeFiles(imageFiles),
      });
      const clientMutationId = createClientMutationId();
      const result = await submitAddProjectNodeImages(appendClientMutationId(formData, clientMutationId));
      console.info(IMAGE_DEBUG_PREFIX, "upload submission resolved", {
        projectId: result.id,
        nodeCount: result.spatialMap.nodes.length,
      });
      props.onProjectUpdated?.(result, { clientMutationId, phase: "server" });
      toaster.success({
        title: "Images attached",
        description: "Image files were stored on disk and attached to the node.",
      });
    } catch (error) {
      console.error(IMAGE_DEBUG_PREFIX, "upload failed", {
        nodeId,
        uploadedFiles: describeFiles(imageFiles),
        error,
      });
      toaster.error({
        title: "Image upload failed",
        description:
          error instanceof Error
            ? error.message
            : "The selected image could not be stored.",
      });
    }
  };

  const deleteImage = async (nodeId: string, imageId: string) => {
    const clientMutationId = createClientMutationId();
    const previousProject = props.project;
    try {
      setPendingDeleteImageId(imageId);
      const optimisticProject = {
        ...props.project,
        updatedAt: new Date().toISOString(),
        spatialMap: {
          ...props.project.spatialMap,
          nodes: props.project.spatialMap.nodes.map((node) =>
            node.id === nodeId
              ? { ...node, images: (node.images ?? []).filter((image) => image.id !== imageId) }
              : node,
          ),
        },
      } satisfies ProjectRecord;
      props.onProjectUpdated?.(optimisticProject, { clientMutationId, phase: "optimistic" });
      const formData = new FormData();
      formData.set("projectId", props.project.id);
      formData.set("nodeId", nodeId);
      formData.set("imageId", imageId);
      applyDeletedImageResult(
        await submitDeleteProjectNodeImage(appendClientMutationId(formData, clientMutationId)),
        clientMutationId,
      );
    } catch (error) {
      props.onProjectUpdated?.(previousProject, { clientMutationId, phase: "server" });
      setPendingDeleteImageId(null);
      toaster.error({
        title: "Delete failed",
        description:
          error instanceof Error
            ? error.message
            : "The image could not be deleted.",
      });
    }
  };

  const handlePaste = (event: ClipboardEvent) => {
    console.info(IMAGE_DEBUG_PREFIX, "paste event received", {
      target: describeEventTarget(event.target),
      clipboard: describeDataTransfer(event.clipboardData),
      selectedNodeId: spatialMap.selectedNodeId(),
    });

    if (isEditableTarget(event.target)) {
      console.info(IMAGE_DEBUG_PREFIX, "paste ignored: editable target", {
        target: describeEventTarget(event.target),
      });
      return;
    }

    const nodeId = spatialMap.selectedNodeId();
    if (!nodeId) {
      console.warn(IMAGE_DEBUG_PREFIX, "paste ignored: no selected node");
      return;
    }

    const files = getImageFilesFromDataTransfer(event.clipboardData);
    if (files.length === 0) {
      console.warn(IMAGE_DEBUG_PREFIX, "paste ignored: no image files found", {
        clipboard: describeDataTransfer(event.clipboardData),
      });
      return;
    }

    console.info(IMAGE_DEBUG_PREFIX, "paste image files accepted", {
      nodeId,
      files: describeFiles(files),
    });
    event.preventDefault();
    void uploadImages(nodeId, files);
  };

  onMount(() => {
    window.addEventListener("paste", handlePaste);

    onCleanup(() => {
      window.removeEventListener("paste", handlePaste);
    });
  });

  return (
    <SpatialMapImageContext.Provider
      value={{
        openImage: (image, node, images) => {
          const collection = images?.length ? images : [image];
          const index = Math.max(
            0,
            collection.findIndex((item) => item.src === image.src),
          );
          setViewerState({
            items: collection.map((item) => ({ image: item, node })),
            index,
            canDelete: true,
          });
        },
        openImageTargets: (targets, activeImage, options = {}) => {
          if (targets.length === 0) {
            return;
          }
          const index = Math.max(
            0,
            targets.findIndex((item) => item.image.src === activeImage.src),
          );
          setViewerState({
            items: targets,
            index,
            canDelete: options.canDelete ?? true,
          });
        },
        uploadImages,
      }}
    >
      {props.children}
      <SpatialMapImageViewer
        state={viewerState()}
        projectName={props.project.name}
        spatialMap={props.project.spatialMap}
        canDelete={viewerState()?.canDelete ?? true}
        pendingDeleteImageId={pendingDeleteImageId()}
        onDeleteImage={deleteImage}
        onOpenImageChange={setViewerState}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDeleteImageId(null);
            setViewerState(null);
          }
        }}
      />
    </SpatialMapImageContext.Provider>
  );
}

export function useSpatialMapImages() {
  const context = useContext(SpatialMapImageContext);
  if (!context) {
    throw new Error(
      "useSpatialMapImages must be used within SpatialMapImageProvider.",
    );
  }

  return context;
}

export function SpatialMapImageStrip(props: {
  node: MapNode;
  variant: "tree" | "inspector";
}) {
  const imageUi = useSpatialMapImages();
  const images = () => props.node.images ?? [];

  return (
    <Show when={images().length > 0}>
      <Box
        display="grid"
        gridTemplateColumns={
          props.variant === "inspector"
            ? "repeat(auto-fill, minmax(62px, 1fr))"
            : "repeat(auto-fit, minmax(160px, max-content))"
        }
        gap={props.variant === "inspector" ? "6px" : "10px"}
        w="100%"
        minW="0"
      >
        <For each={images()}>
          {(image) => (
            <ImageButton
              type="button"
              aspectRatio={props.variant === "inspector" ? "4 / 3" : "16 / 10"}
              w={props.variant === "inspector" ? undefined : "min(100%, 320px)"}
              minW={props.variant === "inspector" ? "0" : "160px"}
              p="0"
              border="1px solid rgba(34, 41, 36, 0.22)"
              borderRadius={props.variant === "inspector" ? "6px" : "0"}
              background={props.variant === "inspector" ? "rgba(214, 220, 212, 0.92)" : "rgba(249, 250, 247, 0.92)"}
              cursor="zoom-in"
              overflow="hidden"
              _hover={{ borderColor: "rgba(23, 62, 39, 0.62)", boxShadow: "inset 0 0 0 1px rgba(23, 62, 39, 0.42)", outline: "none" }}
              _focusVisible={{ borderColor: "rgba(23, 62, 39, 0.62)", boxShadow: "inset 0 0 0 1px rgba(23, 62, 39, 0.42)", outline: "none" }}
              aria-label={`Open ${image.originalName}`}
              title={image.originalName}
              onClick={(event) => {
                event.stopPropagation();
                imageUi.openImage(image, props.node, images());
              }}
            >
              <ViewerImage src={image.src} alt={image.originalName} loading="lazy" display="block" w="100%" h="100%" objectFit="cover" />
            </ImageButton>
          )}
        </For>
      </Box>
    </Show>
  );
}

export function SpatialMapImageDropTarget(props: {
  nodeId: string;
  class?: string;
  variant?: "panel" | "tree";
  children: JSX.Element;
}) {
  const imageUi = useSpatialMapImages();
  const [isDraggingImage, setIsDraggingImage] = createSignal(false);

  return (
    <Box
      class={`${props.class ?? ""}${isDraggingImage() ? " is-dragging-image" : ""}`}
      w="100%"
      display="grid"
      gap={props.variant === "tree" ? "0" : "9px"}
      mt={props.variant === "tree" ? "0" : "8px"}
      p={props.variant === "tree" ? "0" : "13px 0 0"}
      border="0"
      borderTop={props.variant === "tree" ? "0" : "1px dashed"}
      borderColor={isDraggingImage() ? "rgba(23, 62, 39, 0.62)" : "rgba(96, 101, 95, 0.16)"}
      background={isDraggingImage() ? "rgba(218, 229, 216, 0.96)" : "transparent"}
      boxShadow={isDraggingImage() ? "inset 3px 0 0 rgba(23, 62, 39, 0.88)" : "none"}
      onDragEnter={(event) => {
        if (getImageFilesFromDataTransfer(event.dataTransfer).length === 0) {
          console.info(
            IMAGE_DEBUG_PREFIX,
            "drag enter ignored: no image files",
            {
              nodeId: props.nodeId,
              transfer: describeDataTransfer(event.dataTransfer),
            },
          );
          return;
        }

        console.info(IMAGE_DEBUG_PREFIX, "drag enter image files", {
          nodeId: props.nodeId,
          transfer: describeDataTransfer(event.dataTransfer),
        });
        event.preventDefault();
        setIsDraggingImage(true);
      }}
      onDragOver={(event) => {
        if (getImageFilesFromDataTransfer(event.dataTransfer).length === 0) {
          return;
        }

        event.preventDefault();
      }}
      onDragLeave={() => setIsDraggingImage(false)}
      onDrop={(event) => {
        const files = getImageFilesFromDataTransfer(event.dataTransfer);
        if (files.length === 0) {
          console.warn(IMAGE_DEBUG_PREFIX, "drop ignored: no image files", {
            nodeId: props.nodeId,
            transfer: describeDataTransfer(event.dataTransfer),
          });
          return;
        }

        console.info(IMAGE_DEBUG_PREFIX, "drop image files accepted", {
          nodeId: props.nodeId,
          files: describeFiles(files),
        });
        event.preventDefault();
        setIsDraggingImage(false);
        void imageUi.uploadImages(props.nodeId, files);
      }}
    >
      {props.children}
    </Box>
  );
}

export function getImageFilesFromDataTransfer(
  dataTransfer: DataTransfer | null,
) {
  if (!dataTransfer) {
    return [];
  }

  const files = Array.from(dataTransfer.files).filter((file) =>
    file.type.startsWith("image/"),
  );
  const itemFiles = Array.from(dataTransfer.items)
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file));

  return dedupeFiles([...files, ...itemFiles]);
}

function describeDataTransfer(dataTransfer: DataTransfer | null) {
  if (!dataTransfer) {
    return null;
  }

  return {
    files: describeFiles(Array.from(dataTransfer.files)),
    items: Array.from(dataTransfer.items).map((item) => ({
      kind: item.kind,
      type: item.type,
    })),
    types: Array.from(dataTransfer.types),
  };
}

function describeFiles(files: File[]) {
  return files.map((file) => ({
    name: file.name,
    size: file.size,
    type: file.type,
  }));
}

function describeEventTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return target ? target.constructor.name : null;
  }

  return {
    tagName: target.tagName,
    className: target.getAttribute("class"),
    id: target.id || undefined,
  };
}

function dedupeFiles(files: File[]) {
  const seen = new Set<string>();
  return files.filter((file) => {
    const key = `${file.name}:${file.type}:${file.size}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function SpatialMapImageViewer(props: {
  state: ImageViewerState | null;
  projectName: string;
  spatialMap: SpatialMapData;
  canDelete?: boolean;
  pendingDeleteImageId?: string | null;
  onDeleteImage?: (nodeId: string, imageId: string) => Promise<void>;
  onOpenImageChange: (state: ImageViewerState) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const imageViewport = createContainedImageViewport({
    minScale: IMAGE_VIEWER_MIN_SCALE,
    maxScale: IMAGE_VIEWER_MAX_SCALE,
  });
  let panSession: ViewerPanSession | undefined;
  let imageSwitchRequestId = 0;
  const currentItem = createMemo(
    () => props.state?.items[props.state.index] ?? null,
  );
  const currentImage = createMemo(() => currentItem()?.image ?? null);
  const currentNode = createMemo(() => currentItem()?.node ?? null);
  const hasMultipleImages = createMemo(
    () => (props.state?.items.length ?? 0) > 1,
  );

  const resetView = () => {
    imageViewport.resetView();
  };

  createEffect(() => {
    const image = currentImage();
    untrack(() => {
      const requestId = ++imageSwitchRequestId;
      panSession = undefined;
      imageViewport.clearImageSize();
      resetView();
      if (!image) return;

      void preloadImageSize(image.src)
        .then((size) => {
          if (requestId !== imageSwitchRequestId) return;
          imageViewport.setLoadedImageSize(size, { immediate: true });
        })
        .catch(() => {
          if (requestId !== imageSwitchRequestId) return;
          imageViewport.clearImageSize();
          resetView();
        });
    });
  });

  const zoomBy = (
    amount: number,
    anchorClientX?: number,
    anchorClientY?: number,
  ) => {
    imageViewport.zoomBy(amount, anchorClientX, anchorClientY);
  };

  const setActiveIndex = (index: number) => {
    const state = props.state;
    if (!state || state.items.length === 0) return;
    const nextIndex = (index + state.items.length) % state.items.length;
    if (nextIndex === state.index) return;
    const requestId = ++imageSwitchRequestId;
    const nextImage = state.items[nextIndex]?.image;
    const onOpenImageChange = props.onOpenImageChange;
    if (!nextImage) return;
    panSession = undefined;
    void preloadImageSize(nextImage.src)
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
        onOpenImageChange({ ...state, index: nextIndex });
      });
  };

  const showPrevious = () => setActiveIndex((props.state?.index ?? 0) - 1);
  const showNext = () => setActiveIndex((props.state?.index ?? 0) + 1);

  const copyImage = async () => {
    const image = currentImage();
    if (!image) return;

    try {
      await copyImageTargetToClipboard({
        src: image.src,
        filename: image.originalName,
        mimeType: image.mimeType,
      });
      toaster.success({
        title: "Image copied",
        description: "The image is now available on your clipboard.",
      });
    } catch (error) {
      toaster.error({
        title: "Copy failed",
        description:
          error instanceof Error
            ? error.message
            : "The image could not be copied.",
      });
    }
  };

  const downloadImage = async () => {
    const state = props.state;
    const image = currentImage();
    const node = currentNode();
    if (!state || !image || !node) return;

    try {
      await downloadImageTarget({
        src: image.src,
        filename: getNodeImageDownloadFilename({
          image,
          node,
          projectName: props.projectName,
          spatialMap: props.spatialMap,
        }),
        mimeType: image.mimeType,
      });
      toaster.success({
        title: "Download started",
        description: getNodeImageDownloadFilename({
          image,
          node,
          projectName: props.projectName,
          spatialMap: props.spatialMap,
        }),
      });
    } catch (error) {
      toaster.error({
        title: "Download failed",
        description:
          error instanceof Error
            ? error.message
            : "The image could not be downloaded.",
      });
    }
  };

  const deleteImage = async () => {
    const state = props.state;
    const image = currentImage();
    const node = currentNode();
    if (!state || !image || !node || !props.onDeleteImage || !props.canDelete)
      return;

    await props.onDeleteImage(node.id, image.id);
  };

  const closeViewer = () => {
    imageViewport.clearImageSize();
    resetView();
    props.onOpenChange(false);
  };

  onMount(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!props.state || !hasMultipleImages()) return;
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
      open={Boolean(props.state)}
      onOpenChange={(open) => {
        if (!open) closeViewer();
        else props.onOpenChange(open);
      }}
      header={
        <HStack
          alignItems="center"
          justifyContent="space-between"
          gap="2"
          minW="0"
          w="100%"
        >
          <Dialog.Title>
            {currentImage()?.originalName ?? "Image"}
          </Dialog.Title>
          <HStack
            gap="1"
            justifyContent="flex-end"
            minW="0"
            flexWrap="wrap"
          >
            <HStack gap="1" flexWrap="wrap" minW="0">
              <Badge as="span" variant="spatial" size="2xs">
                {(props.state?.index ?? 0) + 1} /{" "}
                {props.state?.items.length || 1}
              </Badge>
              <Badge as="span" variant="spatial" size="2xs">{currentImage()?.mimeType ?? "image"}</Badge>
              <Badge as="span" variant="spatial" size="2xs">{formatBytes(currentImage()?.size ?? 0)}</Badge>
              <Badge as="span" variant="spatial" size="2xs">{Math.round(imageViewport.scale() * 100)}%</Badge>
            </HStack>
            <HStack
              gap="1"
              justifyContent="flex-end"
              flexWrap="wrap"
            >
              <Button
                size="xs"
                variant="outline"
                onClick={copyImage}
              >
                <ClipboardIcon size={14} />
                <span>Copy</span>
              </Button>
              <Button
                size="xs"
                variant="outline"
                onClick={downloadImage}
              >
                <DownloadIcon size={14} />
                <span>Download</span>
              </Button>
              <Button
                size="xs"
                variant="outline"
                onClick={() => zoomBy(0.8)}
              >
                <ZoomOutIcon size={14} />
                <span>Zoom Out</span>
              </Button>
              <Button
                size="xs"
                variant="outline"
                onClick={resetView}
              >
                <RotateCcwIcon size={14} />
                <span>Reset</span>
              </Button>
              <Button
                size="xs"
                variant="outline"
                onClick={() => zoomBy(1.25)}
              >
                <ZoomInIcon size={14} />
                <span>Zoom In</span>
              </Button>
              <Show when={props.canDelete && currentImage()}>
                {(image) => (
                  <Button
                    size="xs"
                    variant="outline"
                    disabled={props.pendingDeleteImageId === image().id}
                    onClick={deleteImage}
                  >
                    <Trash2Icon size={14} />
                    <span>
                      {props.pendingDeleteImageId === image().id
                        ? "Deleting"
                        : "Delete"}
                    </span>
                  </Button>
                )}
              </Show>
              <CloseButton
                aria-label="Close image viewer"
                onClick={closeViewer}
              />
            </HStack>
          </HStack>
        </HStack>
      }
      maxW="min(1340px, 96vw)"
      contentClass={spatialMapImageViewerDialogClass}
      showClose={false}
    >
      <Show when={props.state && currentImage()}>
        {(state) => (
          <ImageViewerContent
            image={state()}
            images={props.state?.items.map((item) => item.image) ?? []}
            activeIndex={props.state?.index ?? 0}
            hasMultipleImages={hasMultipleImages()}
            imageViewport={imageViewport}
            onSelectImage={setActiveIndex}
            onPrevious={showPrevious}
            onNext={showNext}
            onZoom={zoomBy}
            onReset={resetView}
            getPanSession={() => panSession}
            setPanSession={(session) => {
              panSession = session;
            }}
          />
        )}
      </Show>
    </SimpleDialog>
  );
}

function ImageViewerContent(props: {
  image: MapNodeImage;
  images: MapNodeImage[];
  activeIndex: number;
  hasMultipleImages: boolean;
  imageViewport: ReturnType<typeof createContainedImageViewport>;
  onSelectImage: (index: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  onZoom: (
    amount: number,
    anchorClientX?: number,
    anchorClientY?: number,
  ) => void;
  onReset: () => void;
  getPanSession: () => ViewerPanSession | undefined;
  setPanSession: (session: ViewerPanSession | undefined) => void;
}) {
  return (
    <Box
      data-has-thumbnails={props.hasMultipleImages ? "true" : "false"}
      display="grid"
      gridTemplateColumns={{ base: "minmax(0, 1fr)", md: props.hasMultipleImages ? "180px minmax(0, 1fr)" : "minmax(0, 1fr)" }}
      flex="1"
      alignSelf="stretch"
      h="100%"
      minH="0"
      overflow="hidden"
    >
      <Show when={props.hasMultipleImages}>
        <VStack
          as="nav"
          alignItems="stretch"
          gap="2"
          maxH={{ base: "none", md: "100%" }}
          overflowX={{ base: "auto", md: "hidden" }}
          overflowY={{ base: "hidden", md: "auto" }}
          p={{ base: "0 0 6px", md: "10px" }}
          borderRight={{ base: "0", md: "1px solid rgba(96, 101, 95, 0.34)" }}
          borderBottom={{ base: "1px solid rgba(96, 101, 95, 0.34)", md: "0" }}
          display={{ base: "grid", md: "flex" }}
          gridAutoFlow={{ base: "column", md: undefined }}
          gridAutoColumns={{ base: "minmax(150px, 200px)", md: undefined }}
          aria-label="Image thumbnails"
        >
          <For each={props.images}>
            {(image, index) => (
              <ImageButton
                type="button"
                h={{ base: "150px", md: "112px" }}
                p="0"
                border="1px solid"
                borderColor={index() === props.activeIndex ? "rgba(23, 62, 39, 0.62)" : "rgba(34, 41, 36, 0.18)"}
                borderRadius="6px"
                background="rgba(232, 236, 230, 0.78)"
                cursor="pointer"
                overflow="hidden"
                position="relative"
                boxShadow={index() === props.activeIndex ? "inset 0 0 0 1px rgba(23, 62, 39, 0.42)" : undefined}
                aria-label={`Show ${image.originalName}`}
                aria-current={
                  index() === props.activeIndex ? "true" : undefined
                }
                onClick={() => props.onSelectImage(index())}
              >
                <ViewerImage src={image.src} alt={image.originalName} loading="lazy" display="block" w="100%" h="100%" objectFit="cover" />
                <Box as="span" position="absolute" left="6px" bottom="6px" p="2px 5px" borderRadius="4px" background="rgba(17, 22, 19, 0.72)" color="white" fontSize="10px" fontWeight="700">
                  {index() + 1}
                </Box>
              </ImageButton>
            )}
          </For>
        </VStack>
      </Show>
      <VStack
        alignItems="stretch"
        gap="2"
        minW="0"
        h="100%"
        minH="0"
        overflow="hidden"
      >
        <Box position="relative" display="grid" minH="0" h="100%" background="rgba(221, 226, 219, 0.72)">
          <Show when={props.hasMultipleImages}>
            <ImageButton
              type="button"
              position="absolute"
              left="10px"
              top="50%"
              zIndex="2"
              transform="translateY(-50%)"
              display="inline-flex"
              alignItems="center"
              justifyContent="center"
              w="36px"
              h="36px"
              border="1px solid rgba(34, 41, 36, 0.22)"
              borderRadius="999px"
              background="rgba(252, 253, 252, 0.9)"
              color="var(--spatial-map-copy)"
              cursor="pointer"
              aria-label="Show previous image"
              onClick={() => props.onPrevious()}
            >
              <ChevronLeftIcon size={22} />
            </ImageButton>
          </Show>
          <Box
            ref={props.imageViewport.setStageRef}
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
              const clampedDelta = clamp(rawDelta, -80, 80);
              props.onZoom(
                Math.exp(-clampedDelta * 0.0015),
                event.clientX,
                event.clientY,
              );
            }}
            onDblClick={props.onReset}
            onPointerDown={(event) => {
              props.setPanSession({
                pointerId: event.pointerId,
                x: event.clientX,
                y: event.clientY,
                startX: props.imageViewport.offset().x,
                startY: props.imageViewport.offset().y,
              });
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              const panSession = props.getPanSession();
              if (!panSession || panSession.pointerId !== event.pointerId) {
                return;
              }

              props.imageViewport.setOffset({
                x: panSession.startX + event.clientX - panSession.x,
                y: panSession.startY + event.clientY - panSession.y,
              });
            }}
            onPointerUp={(event) => {
              if (props.getPanSession()?.pointerId === event.pointerId) {
                props.setPanSession(undefined);
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
            }}
            onPointerCancel={() => {
              props.setPanSession(undefined);
            }}
          >
            <ViewerImage
              src={props.image.src}
              alt={props.image.originalName}
              draggable={false}
              display="block"
              maxW="none"
              transformOrigin="top left"
              userSelect="none"
              pointerEvents="none"
              onLoad={(event) => props.imageViewport.handleImageLoad(event)}
              style={{
                transform: `translate(${props.imageViewport.offset().x}px, ${props.imageViewport.offset().y}px) scale(${props.imageViewport.scale()})`,
              }}
            />
          </Box>
          <Show when={props.hasMultipleImages}>
            <ImageButton
              type="button"
              position="absolute"
              right="10px"
              top="50%"
              zIndex="2"
              transform="translateY(-50%)"
              display="inline-flex"
              alignItems="center"
              justifyContent="center"
              w="36px"
              h="36px"
              border="1px solid rgba(34, 41, 36, 0.22)"
              borderRadius="999px"
              background="rgba(252, 253, 252, 0.9)"
              color="var(--spatial-map-copy)"
              cursor="pointer"
              aria-label="Show next image"
              onClick={() => props.onNext()}
            >
              <ChevronRightIcon size={22} />
            </ImageButton>
          </Show>
        </Box>
      </VStack>
    </Box>
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
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 102.4) / 10} KB`;
  }

  return `${Math.round(bytes / 1024 / 102.4) / 10} MB`;
}

function getNodeImageDownloadFilename(input: {
  image: MapNodeImage;
  node: MapNode;
  projectName: string;
  spatialMap: SpatialMapData;
}) {
  const parts = [
    input.projectName,
    ...getHierarchyLabels(input.spatialMap, input.node),
    ...getDependencyFilenameParts(input.spatialMap, input.node),
  ]
    .map((part) => sanitizeFilenameSegment(part))
    .filter(Boolean);
  const baseName = truncateFilenameBase(
    dedupeSequentialParts(parts).join(" - ") || "image",
  );
  const extension =
    getImageExtension(input.image.originalName) ||
    getImageExtension(input.image.filename) ||
    getMimeExtension(input.image.mimeType);

  return extension ? `${baseName}${extension}` : baseName;
}

function sanitizeFilenameSegment(value: string) {
  return value
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 64);
}

function getHierarchyLabels(spatialMap: SpatialMapData, node: MapNode) {
  const nodesById = new Map(spatialMap.nodes.map((item) => [item.id, item]));
  const path = [node];
  const seen = new Set([node.id]);
  let current = node;

  while (true) {
    const parentLink = spatialMap.links.find(
      (link) => link.parentChild && link.target === current.id,
    );
    const parent = parentLink ? nodesById.get(parentLink.source) : undefined;
    if (!parent || seen.has(parent.id)) {
      break;
    }

    path.unshift(parent);
    seen.add(parent.id);
    current = parent;
  }

  return path.map((item) => item.label || item.id);
}

function getDependencyFilenameParts(spatialMap: SpatialMapData, node: MapNode) {
  const dependencyLabels = getDependencyChainLabels(spatialMap, node);
  return dependencyLabels.length > 0 ? ["deps", ...dependencyLabels] : [];
}

function getDependencyChainLabels(spatialMap: SpatialMapData, node: MapNode) {
  const nodesById = new Map(spatialMap.nodes.map((item) => [item.id, item]));
  const depthsByNodeId = calculateNodeDepths(spatialMap);
  const path: MapNode[] = [];
  let current = node;
  const seen = new Set([node.id]);

  while (path.length < 6) {
    const dependencyLink = getIncomingDependencyLinks(
      spatialMap.links,
      current.id,
    )
      .map((link) => ({ link, source: nodesById.get(link.source) }))
      .filter((item): item is { link: MapLink; source: MapNode } =>
        Boolean(item.source),
      )
      .sort(
        (left, right) =>
          getNodeSortWeight(left.source, depthsByNodeId) -
          getNodeSortWeight(right.source, depthsByNodeId),
      )[0];

    if (!dependencyLink || seen.has(dependencyLink.source.id)) {
      break;
    }

    path.unshift(dependencyLink.source);
    seen.add(dependencyLink.source.id);
    current = dependencyLink.source;
  }

  return path.map((item) => item.label || item.id);
}

function getIncomingDependencyLinks(links: MapLink[], nodeId: string) {
  return links.filter(
    (link) =>
      !link.parentChild &&
      link.relationship === "dependency" &&
      link.target === nodeId,
  );
}

function getNodeSortWeight(node: MapNode, depthsByNodeId: Map<string, number>) {
  return depthsByNodeId.get(node.id) ?? 0;
}

function dedupeSequentialParts(parts: string[]) {
  return parts.filter(
    (part, index) =>
      index === 0 || part.toLowerCase() !== parts[index - 1]?.toLowerCase(),
  );
}

function truncateFilenameBase(filename: string) {
  return filename.length <= 180 ? filename : filename.slice(0, 180).trim();
}

function getImageExtension(filename: string) {
  const match = filename.match(/(\.[a-z0-9]+)$/i);
  return match?.[1] ?? "";
}

function getMimeExtension(mimeType: string) {
  switch (mimeType) {
    case "image/avif":
      return ".avif";
    case "image/gif":
      return ".gif";
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    default:
      return "";
  }
}
