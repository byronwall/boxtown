import type { ProjectNodeTypeDefinition } from "./types";

const DEFAULT_NODE_TYPE_NAMES = [
  "page",
  "area",
  "assembly",
  "module",
  "component",
  "note",
];

const DEFAULT_HUES = [205, 145, 42, 8, 262, 184, 325, 92];

export function createDefaultProjectNodeTypeSchema(): ProjectNodeTypeDefinition[] {
  return DEFAULT_NODE_TYPE_NAMES.map((name, index) => ({
    name,
    color: createNodeTypeColor(index),
  }));
}

export function createNodeTypeColor(seed = Date.now()) {
  const hue = DEFAULT_HUES[Math.abs(seed) % DEFAULT_HUES.length] ?? 205;
  return hslToHex(hue, 52, 72);
}

export function normalizeProjectNodeTypeName(input: string) {
  return input.trim().replace(/\s+/g, "-").toLowerCase();
}

export function normalizeProjectNodeTypeColor(input: string, seed = 0) {
  const value = input.trim();
  return /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : createNodeTypeColor(seed);
}

export function normalizeProjectNodeTypeSchema(
  input: ProjectNodeTypeDefinition[],
): ProjectNodeTypeDefinition[] {
  const seen = new Set<string>();
  const schema: ProjectNodeTypeDefinition[] = [];
  let hasDefault = false;

  for (const item of input) {
    const name = normalizeProjectNodeTypeName(item.name);
    if (!name || seen.has(name)) continue;

    seen.add(name);
    const isDefault: boolean = item.isDefault === true && !hasDefault;
    hasDefault ||= isDefault;
    schema.push({
      name,
      color: normalizeProjectNodeTypeColor(item.color, schema.length),
      ...(isDefault ? { isDefault: true } : {}),
    });
  }

  return schema.length > 0 ? schema : createDefaultProjectNodeTypeSchema();
}

export function getProjectNodeType(
  schema: ProjectNodeTypeDefinition[],
  name: string,
) {
  return schema.find((item) => item.name === name) ?? null;
}

export function ensureProjectNodeTypeOptions(
  schema: ProjectNodeTypeDefinition[],
  currentType?: string,
) {
  const normalized = normalizeProjectNodeTypeSchema(schema);
  const type = currentType ? normalizeProjectNodeTypeName(currentType) : "";

  if (!type || normalized.some((item) => item.name === type)) {
    return normalized;
  }

  return [
    ...normalized,
    {
      name: type,
      color: createNodeTypeColor(normalized.length),
    },
  ];
}

function hslToHex(hue: number, saturation: number, lightness: number) {
  const s = saturation / 100;
  const l = lightness / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    hue < 60
      ? [c, x, 0]
      : hue < 120
        ? [x, c, 0]
        : hue < 180
          ? [0, c, x]
          : hue < 240
            ? [0, x, c]
            : hue < 300
              ? [x, 0, c]
              : [c, 0, x];

  return `#${[r, g, b]
    .map((channel) =>
      Math.round((channel + m) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

export function getDefaultProjectNodeType(schema: ProjectNodeTypeDefinition[]) {
  return schema.find((item) => item.isDefault)?.name ?? null;
}

// New nodes use the project's default type when one is set, otherwise the parent's type.
export function resolveNewNodeType(
  schema: ProjectNodeTypeDefinition[],
  parentType?: string | null,
) {
  return getDefaultProjectNodeType(schema) ?? parentType ?? schema[0]?.name ?? "page";
}
