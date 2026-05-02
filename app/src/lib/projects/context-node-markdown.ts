export interface MarkdownHeadingSection {
  level: number;
  label: string;
  parentIndex: number | null;
  context: string;
}

interface SplitMarkdownIntoHeadingSectionsOptions {
  maxHeadingDepth?: number;
  splitListItems?: boolean;
  splitNestedListItems?: boolean;
}

interface MutableMarkdownHeadingSection {
  level: number;
  label: string;
  parentIndex: number | null;
  bodyLines: string[];
}

const ATX_HEADING_PATTERN = /^( {0,3})(#{1,6})[ \t]+(.+?)(?:[ \t]+#+[ \t]*)?$/;
const FENCE_PATTERN = /^( {0,3})(`{3,}|~{3,})/;
const LIST_ITEM_PATTERN = /^([ \t]*)(?:[-+*]|\d+[.)])[ \t]+(.+)$/;

export function detectMarkdownMaxHeadingDepth(markdown: string) {
  return parseMarkdownHeadingSections(markdown).maxHeadingDepth;
}

export function splitMarkdownIntoHeadingSections(
  markdown: string,
  options: SplitMarkdownIntoHeadingSectionsOptions = {},
): {
  preamble: string;
  sections: MarkdownHeadingSection[];
} {
  const parsed = parseMarkdownHeadingSections(markdown, options);

  return {
    preamble: parsed.preamble,
    sections: parsed.sections,
  };
}

function parseMarkdownHeadingSections(
  markdown: string,
  options: SplitMarkdownIntoHeadingSectionsOptions = {},
) {
  const lines = markdown.split(/\r?\n/);
  const sections: MutableMarkdownHeadingSection[] = [];
  const preambleLines: string[] = [];
  const headingStack: Array<{ level: number }> = [];
  const includedHeadingStack: Array<{ index: number; level: number }> = [];
  const maxHeadingDepth =
    typeof options.maxHeadingDepth === "number" && Number.isFinite(options.maxHeadingDepth)
      ? Math.max(1, Math.floor(options.maxHeadingDepth))
      : null;
  const splitListItems = options.splitListItems === true;
  const splitNestedListItems = options.splitNestedListItems !== false;
  let detectedMaxHeadingDepth = 0;
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
    const listItemMatch =
      splitListItems && activeFenceMarker === null ? line.match(LIST_ITEM_PATTERN) : null;

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

      const headingDepth = headingStack.length + 1;
      detectedMaxHeadingDepth = Math.max(detectedMaxHeadingDepth, headingDepth);
      headingStack.push({ level });

      while (includedHeadingStack.length > 0) {
        const lastIncludedHeading = includedHeadingStack[includedHeadingStack.length - 1];
        if (!lastIncludedHeading || lastIncludedHeading.level < level) {
          break;
        }
        includedHeadingStack.pop();
      }

      if (maxHeadingDepth !== null && headingDepth > maxHeadingDepth) {
        const parentSectionIndex = includedHeadingStack[includedHeadingStack.length - 1]?.index;
        if (parentSectionIndex === undefined) {
          preambleLines.push(line);
          activeSectionIndex = null;
        } else {
          sections[parentSectionIndex]?.bodyLines.push(line);
          activeSectionIndex = parentSectionIndex;
        }
        continue;
      }

      const parentIndex =
        includedHeadingStack[includedHeadingStack.length - 1]?.index ?? null;
      const nextSectionIndex = sections.length;
      sections.push({
        level,
        label,
        parentIndex,
        bodyLines: [],
      });
      includedHeadingStack.push({ index: nextSectionIndex, level });
      activeSectionIndex = nextSectionIndex;
      continue;
    }

    if (listItemMatch) {
      const indent = getListIndentWidth(listItemMatch[1] ?? "");
      const label = (listItemMatch[2] ?? "").trim();

      if (label.length === 0) {
        continue;
      }

      const parentSectionIndex = getListItemParentIndex({
        sections,
        activeSectionIndex,
        indent,
        splitNestedListItems,
      });

      if (!splitNestedListItems && shouldRollNestedListItemIntoContext({
        sections,
        activeSectionIndex,
        indent,
      })) {
        appendLineToSectionOrPreamble({
          sections,
          preambleLines,
          activeSectionIndex,
          line,
        });
        continue;
      }

      const nextSectionIndex = sections.length;
      sections.push({
        level: 7 + indent,
        label,
        parentIndex: parentSectionIndex,
        bodyLines: [],
      });
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
    maxHeadingDepth: detectedMaxHeadingDepth,
    sections: sections.map((section) => ({
      level: section.level,
      label: section.label,
      parentIndex: section.parentIndex,
      context: trimMarkdownBlock(section.bodyLines.join("\n")),
    })),
  };
}

function getListIndentWidth(indent: string) {
  return [...indent].reduce((width, char) => width + (char === "\t" ? 4 : 1), 0);
}

function getListItemParentIndex(input: {
  sections: MutableMarkdownHeadingSection[];
  activeSectionIndex: number | null;
  indent: number;
  splitNestedListItems: boolean;
}) {
  if (input.activeSectionIndex === null) {
    return null;
  }

  const activeSection = input.sections[input.activeSectionIndex];
  if (!activeSection) {
    return null;
  }

  if (!input.splitNestedListItems && activeSection.level >= 7) {
    return activeSection.parentIndex;
  }

  if (activeSection.level >= 7) {
    if (input.indent > activeSection.level - 7) {
      return input.activeSectionIndex;
    }

    for (let index = input.activeSectionIndex - 1; index >= 0; index -= 1) {
      const section = input.sections[index];
      if (!section) {
        continue;
      }
      if (section.level < 7) {
        return index;
      }
      const sectionIndent = section.level - 7;
      if (sectionIndent < input.indent) {
        return index;
      }
      if (sectionIndent === input.indent) {
        return section.parentIndex;
      }
    }

    return activeSection.parentIndex;
  }

  return input.activeSectionIndex;
}

function shouldRollNestedListItemIntoContext(input: {
  sections: MutableMarkdownHeadingSection[];
  activeSectionIndex: number | null;
  indent: number;
}) {
  if (input.activeSectionIndex === null) {
    return false;
  }

  const activeSection = input.sections[input.activeSectionIndex];
  return (
    activeSection !== undefined &&
    activeSection.level >= 7 &&
    input.indent > activeSection.level - 7
  );
}

function appendLineToSectionOrPreamble(input: {
  sections: MutableMarkdownHeadingSection[];
  preambleLines: string[];
  activeSectionIndex: number | null;
  line: string;
}) {
  if (input.activeSectionIndex === null) {
    input.preambleLines.push(input.line);
    return;
  }

  input.sections[input.activeSectionIndex]?.bodyLines.push(input.line);
}

function trimMarkdownBlock(value: string) {
  return value.replace(/^\s+|\s+$/g, "");
}
