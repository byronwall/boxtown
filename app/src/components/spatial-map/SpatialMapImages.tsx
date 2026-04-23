import { useSubmission } from "@solidjs/router";
import {
  createContext,
  createEffect,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
  untrack,
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
import type { MapLink, MapNode, MapNodeImage, SpatialMapData } from "~/lib/spatial-map/types";

import { copyImageTargetToClipboard, downloadImageTarget } from "./image-viewer-actions";
import { isEditableTarget } from "./spatial-map-dom";
import { useSpatialMap } from "./SpatialMapContext";
import { createContainedImageViewport } from "./use-contained-image-viewport";

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
  projectName: string;
  spatialMap: SpatialMapData;
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

    if (spatialMap.sourceDecompositionOpen()) {
      console.info(IMAGE_DEBUG_PREFIX, "paste ignored: source decomposition intake is open");
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
        projectName={props.projectName}
        spatialMap={props.spatialMap}
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
  onOpenChange: (open: boolean) => void;
}) {
  const imageViewport = createContainedImageViewport({
    minScale: IMAGE_VIEWER_MIN_SCALE,
    maxScale: IMAGE_VIEWER_MAX_SCALE,
  });
  let panSession: ViewerPanSession | undefined;

  const resetView = () => {
    imageViewport.resetView();
  };

  const zoomBy = (amount: number, anchorClientX?: number, anchorClientY?: number) => {
    imageViewport.zoomBy(amount, anchorClientX, anchorClientY);
  };

  createEffect(() => {
    const imageSrc = props.state?.image.src;
    untrack(() => {
      imageViewport.clearImageSize();
      resetView();
    });
    if (!imageSrc) return;
  });

  const copyImage = async () => {
    if (!props.state) return;

    try {
      await copyImageTargetToClipboard({
        src: props.state.image.src,
        filename: props.state.image.originalName,
        mimeType: props.state.image.mimeType,
      });
      toaster.success({
        title: "Image copied",
        description: "The image is now available on your clipboard.",
      });
    } catch (error) {
      toaster.error({
        title: "Copy failed",
        description: error instanceof Error ? error.message : "The image could not be copied.",
      });
    }
  };

  const downloadImage = async () => {
    if (!props.state) return;

    try {
      await downloadImageTarget({
        src: props.state.image.src,
        filename: getNodeImageDownloadFilename({
          image: props.state.image,
          node: props.state.node,
          projectName: props.projectName,
          spatialMap: props.spatialMap,
        }),
        mimeType: props.state.image.mimeType,
      });
      toaster.success({
        title: "Download started",
        description: getNodeImageDownloadFilename({
          image: props.state.image,
          node: props.state.node,
          projectName: props.projectName,
          spatialMap: props.spatialMap,
        }),
      });
    } catch (error) {
      toaster.error({
        title: "Download failed",
        description: error instanceof Error ? error.message : "The image could not be downloaded.",
      });
    }
  };

  return (
    <SimpleDialog
      open={Boolean(props.state)}
      onOpenChange={(open) => {
        if (!open) {
          imageViewport.clearImageSize();
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
      <Show when={props.state}>
        {(state) => (
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
                const clampedDelta = clamp(rawDelta, -80, 80);
                zoomBy(Math.exp(-clampedDelta * 0.0015), event.clientX, event.clientY);
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
                if (!panSession || panSession.pointerId !== event.pointerId) {
                  return;
                }

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
                src={state().image.src}
                alt={state().image.originalName}
                draggable={false}
                onLoad={imageViewport.handleImageLoad}
                style={{
                  transform: `translate(${imageViewport.offset().x}px, ${imageViewport.offset().y}px) scale(${imageViewport.scale()})`,
                }}
              />
            </Box>
            <HStack class="spatial-map-image-viewer-meta" gap="2" flexWrap="wrap">
              <span>{state().image.mimeType}</span>
              <span>{formatBytes(state().image.size)}</span>
              <span>{Math.round(imageViewport.scale() * 100)}%</span>
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
  const baseName = truncateFilenameBase(dedupeSequentialParts(parts).join(" - ") || "image");
  const extension =
    getImageExtension(input.image.originalName) ||
    getImageExtension(input.image.filename) ||
    getMimeExtension(input.image.mimeType);

  return extension ? `${baseName}${extension}` : baseName;
}

function sanitizeFilenameSegment(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim().slice(0, 64);
}

function getHierarchyLabels(spatialMap: SpatialMapData, node: MapNode) {
  const nodesById = new Map(spatialMap.nodes.map((item) => [item.id, item]));
  const path = [node];
  const seen = new Set([node.id]);
  let current = node;

  while (true) {
    const parentLink = spatialMap.links.find((link) => link.parentChild && link.target === current.id);
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
  const path: MapNode[] = [];
  let current = node;
  const seen = new Set([node.id]);

  while (path.length < 6) {
    const dependencyLink = getIncomingDependencyLinks(spatialMap.links, current.id)
      .map((link) => ({ link, source: nodesById.get(link.source) }))
      .filter((item): item is { link: MapLink; source: MapNode } => Boolean(item.source))
      .sort((left, right) => getNodeSortWeight(left.source) - getNodeSortWeight(right.source))[0];

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
  return links.filter((link) => !link.parentChild && link.relationship === "dependency" && link.target === nodeId);
}

function getNodeSortWeight(node: MapNode) {
  return node.depth;
}

function dedupeSequentialParts(parts: string[]) {
  return parts.filter((part, index) => index === 0 || part.toLowerCase() !== parts[index - 1]?.toLowerCase());
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
