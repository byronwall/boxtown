import { createEffect, type JSX, onCleanup, splitProps } from "solid-js";
import { css } from "styled-system/css";
import { createEditInPlaceMachine } from "./edit-in-place-machine";

const rootClass = css({
  boxSizing: "border-box",
  display: "block",
  maxW: "full",
  minH: "1em",
  outline: "none",
  overflowWrap: "anywhere",
  position: "relative",
  transformOrigin: "center",
  userSelect: "text",
  whiteSpace: "pre-wrap",
  _before: {
    borderColor: "transparent",
    borderRadius: "sm",
    borderWidth: "1px",
    content: "\"\"",
    inset: "-2px -4px",
    pointerEvents: "none",
    position: "absolute",
    zIndex: "-1",
  },
  _selection: {
    bg: "blue.9",
    color: "white",
  },
  _hover: {
    cursor: "default",
    _before: { bg: "black/5" },
  },
  "&[data-state=selected]": {
    cursor: "text",
    _before: { bg: "black/8" },
  },
  "&[data-state=editing]": {
    cursor: "text",
    _before: { bg: "transparent", borderColor: "black/20" },
  },
  "&[data-anim=confirmed]": {
    animation: "edit-in-place-confirmed 420ms ease 1",
  },
  "&[data-anim=reverted]": {
    animation: "edit-in-place-reverted 220ms ease 1",
  },
});

export type EditInPlaceState = "idle" | "selected" | "editing";
export type EditInPlaceAnim = "confirmed" | "reverted";
export type EditInPlaceProps =
  Omit<JSX.IntrinsicElements["div"], "onBlur" | "contentEditable" | "children"> & {
    value: string;
    disabled?: boolean;
    isEditing?: boolean;
    shouldAllowMultiline?: boolean;
    onConfirm?: (value: string) => void;
    onBlur?: (value: string) => void;
  };

export function EditInPlace(props: EditInPlaceProps) {
  const [local, rest] = splitProps(props, [
    "value",
    "disabled",
    "isEditing",
    "shouldAllowMultiline",
    "onConfirm",
    "onBlur",
    "class",
  ]);

  let el: HTMLDivElement | undefined;
  const machine = createEditInPlaceMachine({
    getEl: () => el,
    getValue: () => local.value,
    getControlledIsEditing: () => local.isEditing,
    getDisabled: () => !!local.disabled,
    shouldAllowMultiline: () => local.shouldAllowMultiline ?? false,
    onConfirm: (value) => local.onConfirm?.(value),
    onBlur: (value) => local.onBlur?.(value),
  });

  createEffect(() => {
    machine.dom.syncDomWhenNotEditing();
  });

  createEffect(() => {
    machine.dom.syncControlled();
  });

  createEffect(() => {
    if (machine.state() !== "selected") return;

    const onPointerDown = (ev: PointerEvent) => machine.dom.onDocumentPointerDown(ev);
    document.addEventListener("pointerdown", onPointerDown);
    onCleanup(() => document.removeEventListener("pointerdown", onPointerDown));
  });

  return (
    <div
      ref={el}
      data-scope="edit-in-place"
      data-part="root"
      {...machine.dom.props()}
      {...rest}
      class={[rootClass, local.class].filter(Boolean).join(" ")}
    />
  );
}
