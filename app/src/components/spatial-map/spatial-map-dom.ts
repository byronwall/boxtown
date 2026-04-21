export function isEditableTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT")
  );
}

export function getHoveredSpatialMapNodeId(clientX: number, clientY: number) {
  const hoveredElement = document.elementFromPoint(clientX, clientY);
  const hoveredNode = hoveredElement?.closest(".spatial-map-node");
  return hoveredNode?.getAttribute("data-node-id") ?? null;
}
