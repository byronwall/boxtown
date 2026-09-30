import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { CliError, exitCodes } from "./errors.mjs";

// Downloads a node's images (all of them, or the requested ids) to local files.
// `output` is a directory, or a file path when exactly one image is requested.
export async function downloadNodeImages({ client, projectId, nodeId, imageIds, output, cwd }) {
  const { images = [] } = await client.listNodeImages(projectId, nodeId);
  const selected = selectImages(images, imageIds, nodeId);
  const targets = resolveTargets(selected, output, cwd);

  const downloaded = [];
  for (const { image, filePath } of targets) {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, await client.downloadAsset(image.src));
    downloaded.push({
      imageId: image.id,
      originalName: image.originalName,
      mimeType: image.mimeType,
      src: image.src,
      path: filePath,
    });
  }

  return { projectId, nodeId, imageCount: downloaded.length, downloaded };
}

export function imageExtension(image) {
  const filename = image.filename ?? image.originalName ?? "";
  const ext = path.extname(filename);
  if (ext) {
    return ext;
  }
  if (image.mimeType === "image/jpeg") {
    return ".jpg";
  }
  if (image.mimeType === "image/webp") {
    return ".webp";
  }
  return ".png";
}

function selectImages(images, imageIds, nodeId) {
  if (imageIds.length === 0) {
    if (images.length === 0) {
      throw new CliError(`Node ${nodeId} has no images.`, exitCodes.notFound);
    }
    return images;
  }

  return imageIds.map((imageId) => {
    const image = images.find((item) => item.id === imageId);
    if (!image) {
      throw new CliError(`Image ${imageId} was not found on node ${nodeId}.`, exitCodes.notFound);
    }
    return image;
  });
}

function resolveTargets(images, output, cwd) {
  const outputPath = output ? path.resolve(cwd, output) : cwd;
  if (images.length === 1 && output && path.extname(outputPath)) {
    return [{ image: images[0], filePath: outputPath }];
  }

  const usedNames = new Set();
  return images.map((image) => {
    const ext = imageExtension(image);
    const stem = sanitizeFileStem(path.basename(image.originalName ?? "", path.extname(image.originalName ?? "")));
    let filename = `${stem || sanitizeFileStem(image.id)}${ext}`;
    if (usedNames.has(filename)) {
      filename = `${stem}-${sanitizeFileStem(image.id)}${ext}`;
    }
    usedNames.add(filename);
    return { image, filePath: path.join(outputPath, filename) };
  });
}

function sanitizeFileStem(value) {
  return String(value)
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}
