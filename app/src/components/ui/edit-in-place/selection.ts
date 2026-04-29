export type EnterSelectionIntent =
  | { kind: "end" }
  | { kind: "select-all" }
  | { kind: "point"; clientX: number; clientY: number };

export function normalizeContentEditableValue(value: string, shouldAllowMultiline: boolean) {
  const normalized = value.replace(/\r\n?/g, "\n");
  return shouldAllowMultiline ? normalized : normalized.replace(/\s*\n+\s*/g, " ").trim();
}

export function contentEditableValuesEqual(
  a: string,
  b: string,
  shouldAllowMultiline: boolean,
) {
  return normalizeContentEditableValue(a, shouldAllowMultiline) === normalizeContentEditableValue(b, shouldAllowMultiline);
}

export function readContentEditableValue(
  el: HTMLDivElement | undefined,
  shouldAllowMultiline: boolean,
) {
  return normalizeContentEditableValue(el?.textContent ?? "", shouldAllowMultiline);
}

export function setContentEditableValue(
  el: HTMLDivElement,
  value: string,
  shouldAllowMultiline: boolean,
) {
  const next = normalizeContentEditableValue(value, shouldAllowMultiline);
  if (el.textContent !== next) {
    el.textContent = next;
  }
}

export function setSelectionToAll(el: HTMLDivElement | undefined) {
  if (!el) return;

  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(el);
  selection?.removeAllRanges();
  selection?.addRange(range);
}

export function setSelectionToEnd(el: HTMLDivElement | undefined) {
  if (!el) return;

  el.focus();
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  selection?.removeAllRanges();
  selection?.addRange(range);
}

export function setSelectionFromPoint(
  el: HTMLDivElement | undefined,
  clientX: number,
  clientY: number,
  shouldAllowMultiline: boolean,
) {
  if (!el) return;

  el.focus();
  const selection = window.getSelection();
  const range = getCaretRangeFromPoint(clientX, clientY);

  if (range && el.contains(range.startContainer)) {
    selection?.removeAllRanges();
    selection?.addRange(range);
    return;
  }

  shouldAllowMultiline ? setSelectionToEnd(el) : setSelectionToAll(el);
}

export function insertContentEditableValueAtCursor(
  value: string,
  shouldAllowMultiline: boolean,
) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const text = normalizeContentEditableValue(value, shouldAllowMultiline);
  const range = selection.getRangeAt(0);
  range.deleteContents();
  range.insertNode(document.createTextNode(text));
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function getCaretRangeFromPoint(clientX: number, clientY: number) {
  if (document.caretRangeFromPoint) {
    return document.caretRangeFromPoint(clientX, clientY);
  }

  const position = document.caretPositionFromPoint?.(clientX, clientY);
  if (!position) return null;

  const range = document.createRange();
  range.setStart(position.offsetNode, position.offset);
  range.collapse(true);
  return range;
}
