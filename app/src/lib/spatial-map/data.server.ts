import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { SpatialMapData } from "~/lib/spatial-map/types";
import { parseSpatialMapData } from "~/lib/spatial-map/validate";

export async function readSpatialMapDataFromDisk(): Promise<SpatialMapData> {
  const filePath = path.join(resolveSpatialMapDataDir(), "spatial-map.json");
  const raw = await readFile(filePath, "utf8");
  return parseSpatialMapData(JSON.parse(raw));
}

function resolveSpatialMapDataDir() {
  const cwd = process.cwd();
  const candidates = [path.join(cwd, "data"), path.join(cwd, "app", "data")];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}
