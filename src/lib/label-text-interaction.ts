import type React from "react";

/** True for a single printable character suitable for type-to-edit (not modified shortcuts). */
export function isPrintableLabelEditKey(e: KeyboardEvent): boolean {
  if (e.metaKey || e.ctrlKey || e.altKey) return false;
  return e.key.length === 1 && !e.key.startsWith("Dead");
}

/** Shift/Ctrl/Meta clicks should keep normal selection behavior, not enter label edit. */
export function isAdditiveLabelSelectionClick(e: React.MouseEvent): boolean {
  return e.shiftKey || e.ctrlKey || e.metaKey;
}

/** Prevent react-dnd node drag from starting when the user presses on label text. */
export function stopNodeDragFromLabelTextPointerDown(
  e: React.PointerEvent,
  enabled = true,
): void {
  if (!enabled) return;
  e.stopPropagation();
}
