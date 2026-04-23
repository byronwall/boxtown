import { useSubmission } from "@solidjs/router";
import {
  createContext,
  createEffect,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
  useContext,
  type JSX,
} from "solid-js";
import { Box, HStack, VStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { SimpleDialog } from "~/components/ui/simple-dialog";
import { toaster } from "~/components/ui/toast";
import { addProjectNodeImages } from "~/lib/projects/data";
import type { ProjectRecord } from "~/lib/projects/types";
import { normalizeActionUrl } from "~/lib/router/action-url";
import type { MapNode, MapNodeImage } from "~/lib/spatial-map/types";

import { isEditableTarget } from "./spatial-map-dom";
import { useSpatialMap } from "./SpatialMapContext";

interface SpatialMapImageContextValue {
  openImage: (image: MapNodeImage, node: MapNode) => void;
  uploadImages: (nodeId: string, files: File[]) => Promise<void>;
}

interface ImageViewerState {
  image: MapNodeImage;
  node: MapNode;
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
const IMAGE_VIEWER_MIN_SCALE = 0.2;
const IMAGE_VIEWER_MAX_SCALE = 8;

export function SpatialMapImageProvider(props: {
  projectId: string;
  onProjectUpdated?: (project: ProjectRecord) => void;
  children: JSX.Element;
}) {
  const spatialMap = useSpatialMap();
  const [viewerState, setViewerState] = createSignal<ImageViewerState | null>(null);
  const imageUploadSubmission = useSubmission(addProjectNodeImages, (input) => {
    const formData = input[0];
    return formData instanceof FormData && formData.get("projectId") === props.projectId;
  });
  let uploadFormRef: HTMLFormElement | undefined;
  let uploadFileInputRef: HTMLInputElement | undefined;
  let uploadNodeIdInputRef: HTMLInputElement | undefined;

  createEffect(() => {
    const result = imageUploadSubmission.result;
    if (!result || imageUploadSubmission.pending) {
      return;
    }

    console.info(IMAGE_DEBUG_PREFIX, "upload submission resolved", {
      projectId: result.id,
      nodeCount: result.spatialMap.nodes.length,
    });
    props.onProjectUpdated?.(result);
    toaster.success({
      title: "Images attached",
      description: "Image files were stored on disk and attached to the node.",
    });
    imageUploadSubmission.clear();
  });

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
      if (!uploadFormRef || !uploadFileInputRef || !uploadNodeIdInputRef) {
        throw new Error("Upload form is not mounted.");
      }

      const transfer = new DataTransfer();
      for (const file of imageFiles) {
        transfer.items.add(file);
      }

      uploadNodeIdInputRef.value = nodeId;
      uploadFileInputRef.files = transfer.files;
      console.info(IMAGE_DEBUG_PREFIX, "submitting upload form", {
        nodeId,
        actionUrl: normalizeActionUrl(addProjectNodeImages.url),
        uploadedFiles: describeFiles(Array.from(uploadFileInputRef.files)),
      });
      uploadFormRef.requestSubmit();
    } catch (error) {
      console.error(IMAGE_DEBUG_PREFIX, "upload failed", {
        nodeId,
        uploadedFiles: describeFiles(imageFiles),
        error,
      });
      toaster.error({
        title: "Image upload failed",
        description: error instanceof Error ? error.message : "The selected image could not be stored.",
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
        openImage: (image, node) => setViewerState({ image, node }),
        uploadImages,
      }}
    >
      <form
        ref={uploadFormRef}
        action={normalizeActionUrl(addProjectNodeImages.url)}
        method="post"
        enctype="multipart/form-data"
        class="spatial-map-image-upload-form"
      >
        <input type="hidden" name="projectId" value={props.projectId} />
        <input ref={uploadNodeIdInputRef} type="hidden" name="nodeId" />
        <input ref={uploadFileInputRef} type="file" name="images" accept="image/*" multiple />
      </form>
      {props.children}
      <SpatialMapImageViewer
        state={viewerState()}
        onOpenChange={(open) => {
          if (!open) {
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
    throw new Error("useSpatialMapImages must be used within SpatialMapImageProvider.");
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
      <Box class={`spatial-map-image-strip spatial-map-image-strip--${props.variant}`}>
        <For each={images()}>
          {(image) => (
            <button
              type="button"
              class="spatial-map-image-thumb"
              aria-label={`Open ${image.originalName}`}
              title={image.originalName}
              onClick={(event) => {
                event.stopPropagation();
                imageUi.openImage(image, props.node);
              }}
            >
              <img src={image.src} alt={image.originalName} loading="lazy" />
            </button>
          )}
        </For>
      </Box>
    </Show>
  );
}

export function SpatialMapImageDropTarget(props: {
  nodeId: string;
  class?: string;
  children: JSX.Element;
}) {
  const imageUi = useSpatialMapImages();
  const [isDraggingImage, setIsDraggingImage] = createSignal(false);

  return (
    <Box
      class={`${props.class ?? ""}${isDraggingImage() ? " is-dragging-image" : ""}`}
      onDragEnter={(event) => {
        if (getImageFilesFromDataTransfer(event.dataTransfer).length === 0) {
          console.info(IMAGE_DEBUG_PREFIX, "drag enter ignored: no image files", {
            nodeId: props.nodeId,
            transfer: describeDataTransfer(event.dataTransfer),
          });
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

export function getImageFilesFromDataTransfer(dataTransfer: DataTransfer | null) {
  if (!dataTransfer) {
    return [];
  }

  const files = Array.from(dataTransfer.files).filter((file) => file.type.startsWith("image/"));
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
    const key = `${file.name}:${file.type}:${file.size}:${file.lastModified}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function SpatialMapImageViewer(props: {
  state: ImageViewerState | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [scale, setScale] = createSignal(1);
  const [offset, setOffset] = createSignal({ x: 0, y: 0 });
  let panSession: ViewerPanSession | undefined;
  let stageRef: HTMLDivElement | undefined;

  const resetView = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  const applyScaleAt = (nextScale: number, anchorClientX?: number, anchorClientY?: number) => {
    const currentScale = scale();
    const clampedScale = clamp(nextScale, IMAGE_VIEWER_MIN_SCALE, IMAGE_VIEWER_MAX_SCALE);
    if (clampedScale === currentScale) {
      return;
    }

    if (!stageRef) {
      setScale(clampedScale);
      return;
    }

    const bounds = stageRef.getBoundingClientRect();
    const anchorX = anchorClientX === undefined ? bounds.width / 2 : anchorClientX - bounds.left;
    const anchorY = anchorClientY === undefined ? bounds.height / 2 : anchorClientY - bounds.top;
    const currentOffset = offset();
    const focusX = (anchorX - currentOffset.x) / currentScale;
    const focusY = (anchorY - currentOffset.y) / currentScale;

    setScale(clampedScale);
    setOffset({
      x: anchorX - focusX * clampedScale,
      y: anchorY - focusY * clampedScale,
    });
  };

  const zoomBy = (amount: number, anchorClientX?: number, anchorClientY?: number) => {
    applyScaleAt(scale() * amount, anchorClientX, anchorClientY);
  };

  return (
    <SimpleDialog
      open={Boolean(props.state)}
      onOpenChange={(open) => {
        if (!open) {
          resetView();
        }
        props.onOpenChange(open);
      }}
      title={props.state ? props.state.image.originalName : "Image"}
      description={props.state ? `${props.state.node.label} image attachment` : undefined}
      maxW="min(1120px, 96vw)"
      contentClass="spatial-map-image-viewer-dialog"
      footer={
        <HStack justifyContent="space-between" width="100%" gap="2" flexWrap="wrap">
          <span class="spatial-map-image-viewer-help">Wheel zoom, drag pan, double-click reset.</span>
          <HStack gap="2">
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
      <Show when={props.state}>
        {(state) => (
          <VStack alignItems="stretch" gap="2">
            <Box
              ref={stageRef}
              class="spatial-map-image-viewer-stage"
              onWheel={(event) => {
                event.preventDefault();
                const rawDelta =
                  event.deltaMode === 1
                    ? event.deltaY * 16
                    : event.deltaMode === 2
                      ? event.deltaY * window.innerHeight
                      : event.deltaY;
                const clampedDelta = clamp(rawDelta, -80, 80);
                zoomBy(Math.exp(-clampedDelta * 0.0015), event.clientX, event.clientY);
              }}
              onDblClick={resetView}
              onPointerDown={(event) => {
                panSession = {
                  pointerId: event.pointerId,
                  x: event.clientX,
                  y: event.clientY,
                  startX: offset().x,
                  startY: offset().y,
                };
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                if (!panSession || panSession.pointerId !== event.pointerId) {
                  return;
                }

                setOffset({
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
                src={state().image.src}
                alt={state().image.originalName}
                draggable={false}
                style={{
                  transform: `translate(${offset().x}px, ${offset().y}px) scale(${scale()})`,
                }}
              />
            </Box>
            <HStack class="spatial-map-image-viewer-meta" gap="2" flexWrap="wrap">
              <span>{state().image.mimeType}</span>
              <span>{formatBytes(state().image.size)}</span>
              <span>{Math.round(scale() * 100)}%</span>
            </HStack>
          </VStack>
        )}
      </Show>
    </SimpleDialog>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
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
