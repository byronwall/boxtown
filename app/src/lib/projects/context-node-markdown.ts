export interface MarkdownHeadingSection {
  level: number;
  label: string;
  parentIndex: number | null;
  context: string;
}

interface MutableMarkdownHeadingSection {
  level: number;
  label: string;
  parentIndex: number | null;
  bodyLines: string[];
}

const ATX_HEADING_PATTERN = /^( {0,3})(#{1,6})[ \t]+(.+?)(?:[ \t]+#+[ \t]*)?$/;
const FENCE_PATTERN = /^( {0,3})(`{3,}|~{3,})/;

export function splitMarkdownIntoHeadingSections(markdown: string): {
  preamble: string;
  sections: MarkdownHeadingSection[];
} {
  const lines = markdown.split(/\r?\n/);
  const sections: MutableMarkdownHeadingSection[] = [];
  const preambleLines: string[] = [];
  const headingStack: Array<{ index: number; level: number }> = [];
  let activeSectionIndex: number | null = null;
  let activeFenceMarker: string | null = null;

  for (const line of lines) {
    const fenceMatch = line.match(FENCE_PATTERN);
    if (fenceMatch) {
      const marker = fenceMatch[2]?.[0] ?? null;
      if (marker) {
        if (activeFenceMarker === marker) {
          activeFenceMarker = null;
        } else if (activeFenceMarker === null) {
          activeFenceMarker = marker;
        }
      }
    }

    const headingMatch =
      activeFenceMarker === null ? line.match(ATX_HEADING_PATTERN) : null;

    if (headingMatch) {
      const level = headingMatch[2].length;
      const rawLabel = headingMatch[3]?.trim() ?? "";
      const label = rawLabel.replace(/[ \t]+#+$/, "").trim();

      if (label.length === 0) {
        continue;
      }

      while (headingStack.length > 0) {
        const lastHeading = headingStack[headingStack.length - 1];
        if (!lastHeading || lastHeading.level < level) {
          break;
        }
        headingStack.pop();
      }

      const parentIndex = headingStack[headingStack.length - 1]?.index ?? null;
      const nextSectionIndex = sections.length;
      sections.push({
        level,
        label,
        parentIndex,
        bodyLines: [],
      });
      headingStack.push({ index: nextSectionIndex, level });
      activeSectionIndex = nextSectionIndex;
      continue;
    }

    if (activeSectionIndex === null) {
      preambleLines.push(line);
      continue;
    }

    sections[activeSectionIndex]?.bodyLines.push(line);
  }

  return {
    preamble: trimMarkdownBlock(preambleLines.join("\n")),
    sections: sections.map((section) => ({
      level: section.level,
      label: section.label,
      parentIndex: section.parentIndex,
      context: trimMarkdownBlock(section.bodyLines.join("\n")),
    })),
  };
}

function trimMarkdownBlock(value: string) {
  return value.replace(/^\s+|\s+$/g, "");
}
