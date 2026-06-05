export const DIAGRAM_GRID_SIZE = 20;

/** `data-dot-grid-overlay` on the SVG grid layer — stripped from html-to-image clones only. */
export const DOT_GRID_OVERLAY_SELECTOR = "[data-dot-grid-overlay]";

/** Remove dot grid from an export clone so PNG/GIF omit it without toggling the live canvas. */
export function hideDotGridOverlayInExportClone(root: HTMLElement): void {
  root.querySelector(DOT_GRID_OVERLAY_SELECTOR)?.remove();
}
