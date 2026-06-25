import { snapToGrid } from "@/components/editor/canvas-constants";
import type { CanvasGuideLine } from "@/lib/types";

/** `data-canvas-guide-lines` on the guide overlay — stripped from html-to-image clones only. */
export const CANVAS_GUIDE_LINES_SELECTOR = "[data-canvas-guide-lines]";

export const CANVAS_GUIDE_LINE_COLOR = "rgb(34, 197, 94)";
export const CANVAS_GUIDE_LINE_OPACITY = 0.5;
export const CANVAS_GUIDE_LINE_SELECTED_OPACITY = 0.85;
export const CANVAS_GUIDE_LINE_DASH = "6 4";
export const CANVAS_GUIDE_LINE_HIT_PX = 8;

export function createCanvasGuideLineId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `guide-${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  }
  return `guide-${Date.now().toString(36)}`;
}

export function screenToDiagramCoords(
  clientX: number,
  clientY: number,
  canvasRect: DOMRect,
  transform: { x: number; y: number; k: number },
): { x: number; y: number } {
  const canvasRelativeX = clientX - canvasRect.left;
  const canvasRelativeY = clientY - canvasRect.top;
  return {
    x: snapToGrid((canvasRelativeX - transform.x) / transform.k),
    y: snapToGrid((canvasRelativeY - transform.y) / transform.k),
  };
}

export function diagramXToCanvasRelative(
  diagramX: number,
  transform: { x: number; y: number; k: number },
): number {
  return diagramX * transform.k + transform.x;
}

export function diagramYToCanvasRelative(
  diagramY: number,
  transform: { x: number; y: number; k: number },
): number {
  return diagramY * transform.k + transform.y;
}

/** Visible canvas area in diagram coordinates (matches pan/zoom + host size). */
export function getViewportDiagramBounds(
  transform: { x: number; y: number; k: number },
  viewportWidth: number,
  viewportHeight: number,
): { minX: number; minY: number; maxX: number; maxY: number } {
  const minX = -transform.x / transform.k;
  const minY = -transform.y / transform.k;
  return {
    minX,
    minY,
    maxX: minX + viewportWidth / transform.k,
    maxY: minY + viewportHeight / transform.k,
  };
}

/** Span for ruler guides: full viewport, expanded past content bounds when needed. */
export function getGuideLineSpanBounds(
  transform: { x: number; y: number; k: number },
  viewportWidth: number,
  viewportHeight: number,
  contentWidth: number,
  contentHeight: number,
): { minX: number; minY: number; maxX: number; maxY: number } {
  const viewport = getViewportDiagramBounds(transform, viewportWidth, viewportHeight);
  return {
    minX: Math.min(0, viewport.minX),
    minY: Math.min(0, viewport.minY),
    maxX: Math.max(contentWidth, viewport.maxX),
    maxY: Math.max(contentHeight, viewport.maxY),
  };
}

/** Remove ruler guide overlay from an export clone so PNG/GIF/SVG omit guides without toggling the live canvas. */
export function hideCanvasGuideLinesInExportClone(root: HTMLElement): void {
  root.querySelector(CANVAS_GUIDE_LINES_SELECTOR)?.remove();
}

export function updateCanvasGuideLinePosition(
  guides: CanvasGuideLine[] | undefined,
  guideId: string,
  position: number,
): CanvasGuideLine[] {
  const list = guides ?? [];
  return list.map((g) => (g.id === guideId ? { ...g, position } : g));
}

export function removeCanvasGuideLine(
  guides: CanvasGuideLine[] | undefined,
  guideId: string,
): CanvasGuideLine[] {
  return (guides ?? []).filter((g) => g.id !== guideId);
}

export function addCanvasGuideLine(
  guides: CanvasGuideLine[] | undefined,
  guide: CanvasGuideLine,
): CanvasGuideLine[] {
  return [...(guides ?? []), guide];
}
