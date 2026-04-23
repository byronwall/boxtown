interface ImageActionTarget {
  file?: File;
  src?: string;
  filename: string;
  mimeType?: string;
}

export async function copyImageTargetToClipboard(target: ImageActionTarget) {
  if (typeof navigator === "undefined" || !navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error("This browser does not support copying images to the clipboard.");
  }

  const blob = await getImageBlob(target);
  const mimeType = blob.type || target.mimeType || "image/png";

  if (typeof ClipboardItem.supports === "function" && !ClipboardItem.supports(mimeType)) {
    throw new Error(`${mimeType} is not supported by this browser clipboard.`);
  }

  await navigator.clipboard.write([
    new ClipboardItem({
      [mimeType]: blob,
    }),
  ]);
}

export async function downloadImageTarget(target: ImageActionTarget) {
  const blob = await getImageBlob(target);
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = objectUrl;
  anchor.download = sanitizeDownloadFilename(target.filename);
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

async function getImageBlob(target: ImageActionTarget) {
  if (target.file) {
    return target.file;
  }

  if (!target.src) {
    throw new Error("Image source is not available.");
  }

  const response = await fetch(target.src);
  if (!response.ok) {
    throw new Error(`Image request failed with ${response.status}.`);
  }

  return response.blob();
}

function sanitizeDownloadFilename(filename: string) {
  return filename.replace(/[\\/:*?"<>|]/g, "-").trim() || "image";
}
