/** Options → hover / select highlight: glow (default) or solid outline. */
export const SELECTION_HIGHLIGHT_STYLE_STORAGE_KEY = "dw:selectionHighlightStyle";

export type SelectionHighlightStyle = "glow" | "outline";

export const DEFAULT_SELECTION_HIGHLIGHT_STYLE: SelectionHighlightStyle = "glow";

/** Set on `#canvas-container` so CSS can switch glow vs outline without remounting connections. */
export const SELECTION_HIGHLIGHT_DATA_ATTR = "data-selection-highlight";

export function parseSelectionHighlightStyle(
  raw: string | null | undefined,
): SelectionHighlightStyle {
  return raw === "outline" ? "outline" : "glow";
}

/** Wider stroke behind a centerline so the outline reads around the visible line. */
export function connectionSolidOutlineStrokeWidth(lineWidthPx: number): number {
  return Math.max(lineWidthPx + 4, 6);
}
