import type { JSX } from "solid-js";
import { createStore } from "solid-js/store";
import {
  contentEditableValuesEqual,
  type EnterSelectionIntent,
  insertContentEditableValueAtCursor,
  readContentEditableValue,
  setContentEditableValue,
  setSelectionFromPoint,
  setSelectionToAll,
  setSelectionToEnd,
} from "./selection";

export type EditInPlaceMachineState = "idle" | "selected" | "editing";
export type EditInPlaceMachineAnim = "confirmed" | "reverted";

export interface CreateEditInPlaceMachineOptions {
  getEl: () => HTMLDivElement | undefined;
  getValue: () => string;
  getControlledIsEditing: () => boolean | undefined;
  getDisabled: () => boolean;
  shouldAllowMultiline: () => boolean;
  now?: () => number;
  pointerFocusSuppressMs?: number;
  selectAllOnSecondClickWithinMs?: number;
  onConfirm?: (value: string) => void;
  onBlur?: (value: string) => void;
}

interface EditInPlaceMachineCtx {
  state: EditInPlaceMachineState;
  anim?: EditInPlaceMachineAnim;
  lastPointerDownAtMs: number;
  lastControlledIsEditing?: boolean;
  enteredEditingAtMs: number;
  enteredEditingFrom?: "click" | "keyboard" | "controlled" | "action";
}

const DEFAULT_POINTER_FOCUS_SUPPRESS_MS = 350;
const DEFAULT_SELECT_ALL_SECOND_CLICK_WITHIN_MS = 275;

export function createEditInPlaceMachine(opts: CreateEditInPlaceMachineOptions) {
  const initialState: EditInPlaceMachineState = opts.getDisabled()
    ? "idle"
    : opts.getControlledIsEditing() === true
      ? "editing"
      : "idle";

  const [ctx, setCtx] = createStore<EditInPlaceMachineCtx>({
    state: initialState,
    anim: undefined,
    lastPointerDownAtMs: 0,
    lastControlledIsEditing: undefined,
    enteredEditingAtMs: 0,
    enteredEditingFrom: undefined,
  });

  const now = () => opts.now?.() ?? performance.now();
  const pointerFocusSuppressMs = () => opts.pointerFocusSuppressMs ?? DEFAULT_POINTER_FOCUS_SUPPRESS_MS;
  const selectAllOnSecondClickWithinMs = () =>
    opts.selectAllOnSecondClickWithinMs ?? DEFAULT_SELECT_ALL_SECOND_CLICK_WITHIN_MS;
  const editingAllowed = () => opts.getControlledIsEditing() !== false;
  const isEditing = () => ctx.state === "editing";

  const setTextFromValue = (value: string) => {
    const el = opts.getEl();
    if (el) setContentEditableValue(el, value, opts.shouldAllowMultiline());
  };
  const readTextFromEl = () => readContentEditableValue(opts.getEl(), opts.shouldAllowMultiline());
  const clearAnim = () => setCtx("anim", undefined);
  const triggerAnim = (anim: EditInPlaceMachineAnim) => setCtx("anim", anim);

  const focus = () => queueMicrotask(() => opts.getEl()?.focus());
  const blur = () => queueMicrotask(() => opts.getEl()?.blur());
  const setSelection = (intent: EnterSelectionIntent) => {
    queueMicrotask(() => {
      const el = opts.getEl();
      if (intent.kind === "select-all") {
        setSelectionToAll(el);
      } else if (intent.kind === "point") {
        setSelectionFromPoint(el, intent.clientX, intent.clientY, opts.shouldAllowMultiline());
      } else {
        setSelectionToEnd(el);
      }
    });
  };
  const syncDomWhenNotEditing = () => {
    if (!isEditing()) setTextFromValue(opts.getValue());
  };
  const syncControlled = () => {
    const disabled = opts.getDisabled();
    const controlled = opts.getControlledIsEditing();

    if (disabled) {
      setCtx({ ...ctx, state: "idle", lastControlledIsEditing: controlled });
      setTextFromValue(opts.getValue());
      if (ctx.lastControlledIsEditing === true || ctx.state === "editing") blur();
      return;
    }

    if (controlled === true) {
      setCtx({
        ...ctx,
        state: "editing",
        lastControlledIsEditing: controlled,
        enteredEditingAtMs: now(),
        enteredEditingFrom: "controlled",
      });
      if (ctx.lastControlledIsEditing !== true) {
        focus();
        setSelection({ kind: "end" });
      }
      return;
    }

    if (controlled === false) {
      setCtx({
        ...ctx,
        state: ctx.state === "editing" ? "selected" : ctx.state,
        lastControlledIsEditing: controlled,
      });
      setTextFromValue(opts.getValue());
      if (ctx.lastControlledIsEditing === true) blur();
      return;
    }

      setCtx("lastControlledIsEditing", controlled);
  };
  const enterEditing = (intent: EnterSelectionIntent = { kind: "end" }) => {
    if (opts.getDisabled()) return;
    if (!editingAllowed()) {
      if (ctx.state !== "editing") setCtx("state", "selected");
      return;
    }
    setCtx({
      ...ctx,
      state: "editing",
      enteredEditingAtMs: now(),
      enteredEditingFrom: "action",
    });
    setSelection(intent);
  };
  const cancelEditing = (reason: "esc" | "blur") => {
    const hadRejectedEdits = !contentEditableValuesEqual(
      readTextFromEl(),
      opts.getValue(),
      opts.shouldAllowMultiline(),
    );
    setTextFromValue(opts.getValue());
    if (hadRejectedEdits) triggerAnim("reverted");
    setCtx("state", opts.getControlledIsEditing() === true ? "editing" : reason === "blur" ? "idle" : "selected");
    if (reason === "esc") blur();
    if (reason === "blur") opts.onBlur?.(opts.getValue());
  };
  const confirmEditing = () => {
    const nextValue = readTextFromEl();
    const hadChanges = !contentEditableValuesEqual(nextValue, opts.getValue(), opts.shouldAllowMultiline());
    if (hadChanges) {
      triggerAnim("confirmed");
      opts.onConfirm?.(nextValue);
    }
    setCtx("state", opts.getControlledIsEditing() === true ? "editing" : "selected");
    if (opts.getControlledIsEditing() !== true) blur();
  };
  const onDocumentPointerDown = (ev: PointerEvent) => {
    if (ctx.state !== "selected") return;
    const target = ev.target as Node | null;
    const el = opts.getEl();
    if (target && el?.contains(target)) return;
    setCtx("state", "idle");
    opts.onBlur?.(opts.getValue());
    blur();
  };
  const onPointerDown: JSX.EventHandlerUnion<HTMLDivElement, PointerEvent> = () => {
    setCtx("lastPointerDownAtMs", now());
  };
  const onClick: JSX.EventHandlerUnion<HTMLDivElement, MouseEvent> = (ev) => {
    if (opts.getDisabled()) return;

    if (ctx.state === "editing") {
      const withinWindow = now() - ctx.enteredEditingAtMs <= selectAllOnSecondClickWithinMs();
      if (ctx.enteredEditingFrom === "click" && withinWindow && ev.detail >= 2) {
        ev.preventDefault();
        setSelection({ kind: "select-all" });
      }
      return;
    }

    if (!editingAllowed()) {
      setCtx("state", "selected");
      return;
    }

    setCtx({
      ...ctx,
      state: "editing",
      enteredEditingAtMs: now(),
      enteredEditingFrom: "click",
    });
    setSelection(ev.detail >= 2 ? { kind: "select-all" } : { kind: "point", clientX: ev.clientX, clientY: ev.clientY });
  };
  const onKeyDown: JSX.EventHandlerUnion<HTMLDivElement, KeyboardEvent> = (ev) => {
    if (ctx.state === "selected" && ev.key === "Enter") {
      if (!opts.shouldAllowMultiline() && ev.shiftKey) {
        ev.preventDefault();
        return;
      }
      ev.preventDefault();
      if (editingAllowed()) {
        setCtx({
          ...ctx,
          state: "editing",
          enteredEditingAtMs: now(),
          enteredEditingFrom: "keyboard",
        });
        setSelection({ kind: "end" });
      }
      return;
    }

    if (ctx.state !== "editing") return;
    ev.stopPropagation();
    if (ev.isComposing) return;

    if (ev.key === "Escape") {
      ev.preventDefault();
      ev.stopPropagation();
      cancelEditing("esc");
      return;
    }

    if (ev.key === "Enter") {
      if (opts.shouldAllowMultiline() && ev.shiftKey) return;
      ev.preventDefault();
      if (!opts.shouldAllowMultiline() && ev.shiftKey) return;
      confirmEditing();
    }
  };
  const onBeforeInput: JSX.EventHandlerUnion<HTMLDivElement, InputEvent> = (ev) => {
    if (opts.shouldAllowMultiline() || ctx.state !== "editing") return;
    if (ev.inputType === "insertParagraph" || ev.inputType === "insertLineBreak") ev.preventDefault();
  };
  const onPaste: JSX.EventHandlerUnion<HTMLDivElement, ClipboardEvent> = (ev) => {
    if (opts.shouldAllowMultiline() || ctx.state !== "editing") return;
    const text = ev.clipboardData?.getData("text/plain") ?? "";
    if (!text) return;
    ev.preventDefault();
    insertContentEditableValueAtCursor(text, opts.shouldAllowMultiline());
  };
  const onBlur: JSX.EventHandlerUnion<HTMLDivElement, FocusEvent> = () => {
    if (ctx.state === "editing") {
      cancelEditing("blur");
    } else if (ctx.state === "selected") {
      setCtx("state", "idle");
      opts.onBlur?.(opts.getValue());
    }
  };
  const onFocus: JSX.EventHandlerUnion<HTMLDivElement, FocusEvent> = () => {
    if (ctx.state === "editing") return;
    if (now() - ctx.lastPointerDownAtMs <= pointerFocusSuppressMs()) return;
    setCtx("state", "selected");
  };
  const onAnimationEnd: JSX.EventHandlerUnion<HTMLDivElement, AnimationEvent> = (ev) => {
    if (ev.target === opts.getEl()) clearAnim();
  };
  type DomProps = Omit<JSX.IntrinsicElements["div"], "ref"> & {
    "data-state"?: EditInPlaceMachineState;
    "data-anim"?: EditInPlaceMachineAnim;
  };
  const props = (): DomProps => ({
    role: "textbox",
    "aria-multiline": opts.shouldAllowMultiline() ? true : undefined,
    "aria-disabled": opts.getDisabled() ? true : undefined,
    "data-state": ctx.state,
    "data-anim": ctx.anim,
    contentEditable: isEditing(),
    spellcheck: false,
    tabIndex: opts.getDisabled() ? -1 : 0,
    onFocus,
    onPointerDown,
    onClick,
    onKeyDown,
    onBeforeInput,
    onPaste,
    onBlur,
    onAnimationEnd,
  });
  return {
    state: () => ctx.state,
    anim: () => ctx.anim,
    isEditing,
    actions: { clearAnim, triggerAnim, setTextFromValue, readTextFromEl, enterEditing, cancelEditing, confirmEditing },
    dom: { props, syncDomWhenNotEditing, syncControlled, onDocumentPointerDown },
  };
}
