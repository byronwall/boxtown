import { createSignal, onCleanup, onMount } from "solid-js";

interface Size {
  width: number;
  height: number;
}

interface Point {
  x: number;
  y: number;
}

interface ContainedImageViewportOptions {
  minScale: number;
  maxScale: number;
}

export function createContainedImageViewport(options: ContainedImageViewportOptions) {
  const [scale, setScale] = createSignal(1);
  const [offset, writeOffset] = createSignal<Point>({ x: 0, y: 0 });
  const [imageSize, setImageSize] = createSignal<Size | null>(null);
  const [stageSize, setStageSize] = createSignal<Size | null>(null);
  let stageRef: HTMLDivElement | undefined;
  let resizeObserver: ResizeObserver | undefined;
  let pendingFitReset = false;
  let followingFitView = false;
  let fitFrame: number | undefined;

  const getFitView = () => {
    const image = imageSize();
    const stage = stageSize();
    if (!image || !stage || image.width <= 0 || image.height <= 0 || stage.width <= 0 || stage.height <= 0) {
      return undefined;
    }

    const fitScale = Math.min(stage.width / image.width, stage.height / image.height, options.maxScale);
    return {
      scale: fitScale,
      offset: {
        x: (stage.width - image.width * fitScale) / 2,
        y: (stage.height - image.height * fitScale) / 2,
      },
    };
  };

  const minimumScale = () => {
    const fit = getFitView();
    return fit ? Math.min(options.minScale, fit.scale) : options.minScale;
  };

  const resetView = (options?: { keepPending?: boolean }) => {
    const fit = getFitView();
    if (!fit) {
      setScale(1);
      writeOffset({ x: 0, y: 0 });
      return;
    }

    pendingFitReset = Boolean(options?.keepPending);
    followingFitView = true;
    setScale(fit.scale);
    writeOffset(fit.offset);
  };

  const scheduleFitReset = () => {
    if (fitFrame !== undefined) {
      cancelAnimationFrame(fitFrame);
    }

    pendingFitReset = true;
    fitFrame = requestAnimationFrame(() => {
      fitFrame = requestAnimationFrame(() => {
        fitFrame = undefined;
        resetView();
      });
    });
  };

  const updateStageSize = () => {
    if (!stageRef) return;

    setStageSize({ width: stageRef.clientWidth, height: stageRef.clientHeight });
    if (pendingFitReset || followingFitView) {
      resetView({ keepPending: true });
    }
  };

  const setStageRef = (element: HTMLDivElement) => {
    stageRef = element;
    updateStageSize();

    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver.observe(element);
    }
  };

  const handleImageLoad = (event: Event) => {
    const image = event.currentTarget as HTMLImageElement;
    setImageSize({
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
    });
    updateStageSize();
    scheduleFitReset();
  };

  const clearImageSize = () => {
    pendingFitReset = false;
    followingFitView = false;
    if (fitFrame !== undefined) {
      cancelAnimationFrame(fitFrame);
      fitFrame = undefined;
    }
    setImageSize(null);
  };

  const applyScaleAt = (nextScale: number, anchorClientX?: number, anchorClientY?: number) => {
    followingFitView = false;
    const currentScale = scale();
    const clampedScale = clamp(nextScale, minimumScale(), options.maxScale);
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
    writeOffset({
      x: anchorX - focusX * clampedScale,
      y: anchorY - focusY * clampedScale,
    });
  };

  const zoomBy = (amount: number, anchorClientX?: number, anchorClientY?: number) => {
    applyScaleAt(scale() * amount, anchorClientX, anchorClientY);
  };

  const setOffset = (nextOffset: Point) => {
    followingFitView = false;
    writeOffset(nextOffset);
  };

  onMount(() => {
    resizeObserver = new ResizeObserver(updateStageSize);
    if (stageRef) {
      resizeObserver.observe(stageRef);
      updateStageSize();
    }
  });

  onCleanup(() => {
    if (fitFrame !== undefined) {
      cancelAnimationFrame(fitFrame);
    }
    resizeObserver?.disconnect();
  });

  return {
    scale,
    offset,
    setOffset,
    imageSize,
    setStageRef,
    handleImageLoad,
    clearImageSize,
    resetView,
    zoomBy,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
