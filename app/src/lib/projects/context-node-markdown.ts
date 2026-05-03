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

interface MarkdownHeadingParserState {
  sections: MutableMarkdownHeadingSection[];
  preambleLines: string[];
  headingStack: Array<{ level: number }>;
  includedHeadingStack: Array<{ index: number; level: number }>;
  detectedMaxHeadingDepth: number;
  activeSectionIndex: number | null;
  activeFenceMarker: string | null;
}

interface NormalizedHeadingSplitOptions {
  maxHeadingDepth: number | null;
  splitListItems: boolean;
  splitNestedListItems: boolean;
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
  const state: MarkdownHeadingParserState = {
    sections: [],
    preambleLines: [],
    headingStack: [],
    includedHeadingStack: [],
    detectedMaxHeadingDepth: 0,
    activeSectionIndex: null,
    activeFenceMarker: null,
  };
  const normalizedOptions = normalizeHeadingSplitOptions(options);

  for (const line of lines) {
    updateFenceState(state, line);

    if (handleHeadingLine(state, normalizedOptions, line)) {
      continue;
    }

    if (handleListItemLine(state, normalizedOptions, line)) {
      continue;
    }

    appendLineToSectionOrPreamble(state, line);
  }

  return {
    preamble: trimMarkdownBlock(state.preambleLines.join("\n")),
    maxHeadingDepth: state.detectedMaxHeadingDepth,
    sections: state.sections.map((section) => ({
      level: section.level,
      label: section.label,
      parentIndex: section.parentIndex,
      context: trimMarkdownBlock(section.bodyLines.join("\n")),
    })),
  };
}

function normalizeHeadingSplitOptions(
  options: SplitMarkdownIntoHeadingSectionsOptions,
): NormalizedHeadingSplitOptions {
  return {
    maxHeadingDepth:
      typeof options.maxHeadingDepth === "number" && Number.isFinite(options.maxHeadingDepth)
        ? Math.max(1, Math.floor(options.maxHeadingDepth))
        : null,
    splitListItems: options.splitListItems === true,
    splitNestedListItems: options.splitNestedListItems !== false,
  };
}

function updateFenceState(state: MarkdownHeadingParserState, line: string) {
  const fenceMatch = line.match(FENCE_PATTERN);
  const marker = fenceMatch?.[2]?.[0] ?? null;
  if (!marker) {
    return;
  }

  if (state.activeFenceMarker === marker) {
    state.activeFenceMarker = null;
  } else if (state.activeFenceMarker === null) {
    state.activeFenceMarker = marker;
  }
}

function handleHeadingLine(
  state: MarkdownHeadingParserState,
  options: NormalizedHeadingSplitOptions,
  line: string,
) {
  const headingMatch = state.activeFenceMarker === null ? line.match(ATX_HEADING_PATTERN) : null;
  if (!headingMatch) {
    return false;
  }

  const level = headingMatch[2].length;
  const label = normalizeHeadingLabel(headingMatch[3]);
  if (label.length === 0) {
    return true;
  }

  const headingDepth = updateHeadingStack(state, level);
  pruneIncludedHeadingStack(state, level);

  if (options.maxHeadingDepth !== null && headingDepth > options.maxHeadingDepth) {
    appendSkippedHeadingToNearestParent(state, line);
    return true;
  }

  const parentIndex = state.includedHeadingStack[state.includedHeadingStack.length - 1]?.index ?? null;
  const nextSectionIndex = state.sections.length;
  state.sections.push({
    level,
    label,
    parentIndex,
    bodyLines: [],
  });
  state.includedHeadingStack.push({ index: nextSectionIndex, level });
  state.activeSectionIndex = nextSectionIndex;
  return true;
}

function normalizeHeadingLabel(rawLabel: string | undefined) {
  return (rawLabel?.trim() ?? "").replace(/[ \t]+#+$/, "").trim();
}

function updateHeadingStack(state: MarkdownHeadingParserState, level: number) {
  pruneStackAtLevel(state.headingStack, level);
  const headingDepth = state.headingStack.length + 1;
  state.detectedMaxHeadingDepth = Math.max(state.detectedMaxHeadingDepth, headingDepth);
  state.headingStack.push({ level });
  return headingDepth;
}

function pruneIncludedHeadingStack(state: MarkdownHeadingParserState, level: number) {
  pruneStackAtLevel(state.includedHeadingStack, level);
}

function pruneStackAtLevel(stack: Array<{ level: number }>, level: number) {
  while (stack.length > 0) {
    const lastHeading = stack[stack.length - 1];
    if (!lastHeading || lastHeading.level < level) {
      break;
    }
    stack.pop();
  }
}

function appendSkippedHeadingToNearestParent(state: MarkdownHeadingParserState, line: string) {
  const parentSectionIndex = state.includedHeadingStack[state.includedHeadingStack.length - 1]?.index;
  if (parentSectionIndex === undefined) {
    state.preambleLines.push(line);
    state.activeSectionIndex = null;
    return;
  }

  state.sections[parentSectionIndex]?.bodyLines.push(line);
  state.activeSectionIndex = parentSectionIndex;
}

function handleListItemLine(
  state: MarkdownHeadingParserState,
  options: NormalizedHeadingSplitOptions,
  line: string,
) {
  const listItemMatch =
    options.splitListItems && state.activeFenceMarker === null ? line.match(LIST_ITEM_PATTERN) : null;
  if (!listItemMatch) {
    return false;
  }

  const indent = getListIndentWidth(listItemMatch[1] ?? "");
  const label = (listItemMatch[2] ?? "").trim();
  if (label.length === 0) {
    return true;
  }

  if (!options.splitNestedListItems && shouldRollNestedListItemIntoContext({
    sections: state.sections,
    activeSectionIndex: state.activeSectionIndex,
    indent,
  })) {
    appendLineToSectionOrPreamble(state, line);
    return true;
  }

  const nextSectionIndex = state.sections.length;
  state.sections.push({
    level: 7 + indent,
    label,
    parentIndex: getListItemParentIndex({
      sections: state.sections,
      activeSectionIndex: state.activeSectionIndex,
      indent,
      splitNestedListItems: options.splitNestedListItems,
    }),
    bodyLines: [],
  });
  state.activeSectionIndex = nextSectionIndex;
  return true;
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

function appendLineToSectionOrPreamble(state: MarkdownHeadingParserState, line: string) {
  if (state.activeSectionIndex === null) {
    state.preambleLines.push(line);
    return;
  }

  state.sections[state.activeSectionIndex]?.bodyLines.push(line);
}

function trimMarkdownBlock(value: string) {
  return value.replace(/^\s+|\s+$/g, "");
}
