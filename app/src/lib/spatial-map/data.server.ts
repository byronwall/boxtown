import { readFile } from "node:fs/promises";
import path from "node:path";
import type { SpatialMapData } from "~/lib/spatial-map/types";
import { parseSpatialMapData } from "~/lib/spatial-map/validate";

export async function readSpatialMapDataFromDisk(): Promise<SpatialMapData> {
  const filePath = path.join(process.cwd(), "src", "data", "spatial-map.json");
  const raw = await readFile(filePath, "utf8");
  return parseSpatialMapData(JSON.parse(raw));
}
