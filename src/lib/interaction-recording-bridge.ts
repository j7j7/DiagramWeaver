/** Semantic recording events — react-dnd / HTML5 drag cannot be replayed via synthetic pointer events. */

import type { InteractionRecordingCanvasTransform } from "@/lib/interaction-recording-types";

export const DW_PALETTE_DROP = "dwPaletteDrop";
export const DW_CANVAS_MOVE = "dwCanvasMove";
export const DW_CANVAS_TRANSFORM = "dwCanvasTransform";
export const DW_REPLAY_CANVAS_MOVE = "dwReplayCanvasMove";
export const DW_REPLAY_CANVAS_TRANSFORM = "dwReplayCanvasTransform";
export const DW_OVERLAY_OPEN = "dwOverlayOpen";
export const DW_OVERLAY_CLOSE = "dwOverlayClose";
export const DW_OVERLAY_ACTION = "dwOverlayAction";
export const DW_REPLAY_OVERLAY_ACTION = "dwReplayOverlayAction";
export const DW_CONTEXT_MENU_OPEN = "dwContextMenuOpen";
export const DW_CONTEXT_MENU_ACTION = "dwContextMenuAction";
export const DW_REPLAY_CONTEXT_MENU_OPEN = "dwReplayContextMenuOpen";
export const DW_REPLAY_CONTEXT_MENU_ACTION = "dwReplayContextMenuAction";
export const DW_PLAYBACK_CURSOR = "dwPlaybackCursor";

export type PlaybackCursorKind =
  | "left-down"
  | "left-up"
  | "right-down"
  | "right-up"
  | "hold-start"
  | "hold-end";

export interface DwOverlayOpenDetail {
  surface: string;
  x?: number;
  y?: number;
}

export type DwOverlayActionKind = "click" | "set-property" | "patch";

export interface DwOverlayActionDetail {
  surface: string;
  action: string;
  kind?: DwOverlayActionKind;
  property?: string;
  value?: unknown;
  patch?: Record<string, unknown>;
  role?: string;
  tag?: string;
}

export interface DwContextMenuOpenDetail {
  itemId: string;
  itemType: "node" | "zone";
  x: number;
  y: number;
  timelineEntryId?: string;
  timelineSpineArcRatio?: number;
  cardElementId?: string;
}

export interface DwContextMenuActionDetail {
  action: string;
  itemId?: string;
  itemType?: "node" | "zone";
}

export interface DwPlaybackCursorDetail {
  x: number;
  y: number;
  kind: PlaybackCursorKind;
}

export interface DwPaletteDropDetail {
  item: unknown;
  clientX: number;
  clientY: number;
  itemType: string;
  diagramX?: number;
  diagramY?: number;
}

export interface DwCanvasMoveDetail {
  id: string;
  itemType: string;
  diagramX: number;
  diagramY: number;
  clientX?: number;
  clientY?: number;
}

function cloneForRecording<T>(value: T): T {
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return value;
  }
}

export function emitDwPaletteDrop(detail: DwPaletteDropDetail): void {
  if (typeof document === "undefined") return;
  document.dispatchEvent(
    new CustomEvent(DW_PALETTE_DROP, {
      bubbles: true,
      detail: {
        ...detail,
        item: cloneForRecording(detail.item),
      },
    }),
  );
}

export function emitDwCanvasMove(detail: DwCanvasMoveDetail): void {
  if (typeof document === "undefined") return;
  document.dispatchEvent(
    new CustomEvent(DW_CANVAS_MOVE, {
      bubbles: true,
      detail,
    }),
  );
}

export function emitDwReplayCanvasMove(detail: Omit<DwCanvasMoveDetail, "clientX" | "clientY">): void {
  if (typeof document === "undefined") return;
  document.dispatchEvent(
    new CustomEvent(DW_REPLAY_CANVAS_MOVE, {
      bubbles: true,
      detail,
    }),
  );
}

let lastCanvasTransformEmitKey = "";
let lastCanvasTransformEmitAt: number | null = null;

export function resetCanvasTransformEmitCache(): void {
  lastCanvasTransformEmitKey = "";
  lastCanvasTransformEmitAt = null;
}

export function emitDwCanvasTransform(detail: InteractionRecordingCanvasTransform): void {
  if (typeof document === "undefined") return;
  if (document.body.dataset.dwPlayback === "active") return;

  const key = `${detail.x.toFixed(1)}|${detail.y.toFixed(1)}|${detail.k.toFixed(5)}`;
  const now = performance.now();
  if (lastCanvasTransformEmitKey === key) return;
  if (lastCanvasTransformEmitAt != null && now - lastCanvasTransformEmitAt < 16) return;
  lastCanvasTransformEmitKey = key;
  lastCanvasTransformEmitAt = now;

  document.dispatchEvent(
    new CustomEvent(DW_CANVAS_TRANSFORM, {
      bubbles: true,
      detail,
    }),
  );
}

export function emitDwReplayCanvasTransform(detail: InteractionRecordingCanvasTransform): void {
  if (typeof document === "undefined") return;
  document.dispatchEvent(
    new CustomEvent(DW_REPLAY_CANVAS_TRANSFORM, {
      bubbles: true,
      detail,
    }),
  );
}

export function emitDwOverlayOpen(detail: DwOverlayOpenDetail): void {
  if (typeof document === "undefined") return;
  if (document.body.dataset.dwPlayback === "active") return;
  document.dispatchEvent(new CustomEvent(DW_OVERLAY_OPEN, { bubbles: true, detail }));
}

export function emitDwOverlayClose(detail: { surface: string }): void {
  if (typeof document === "undefined") return;
  if (document.body.dataset.dwPlayback === "active") return;
  document.dispatchEvent(new CustomEvent(DW_OVERLAY_CLOSE, { bubbles: true, detail }));
}

export function emitDwContextMenuOpen(detail: DwContextMenuOpenDetail): void {
  if (typeof document === "undefined") return;
  if (document.body.dataset.dwPlayback === "active") return;
  document.dispatchEvent(new CustomEvent(DW_CONTEXT_MENU_OPEN, { bubbles: true, detail }));
}

export function emitDwContextMenuAction(detail: DwContextMenuActionDetail): void {
  if (typeof document === "undefined") return;
  if (document.body.dataset.dwPlayback === "active") return;
  document.dispatchEvent(new CustomEvent(DW_CONTEXT_MENU_ACTION, { bubbles: true, detail }));
}

export function emitDwOverlayAction(detail: DwOverlayActionDetail): void {
  if (typeof document === "undefined") return;
  if (document.body.dataset.dwPlayback === "active") return;
  document.dispatchEvent(
    new CustomEvent(DW_OVERLAY_ACTION, {
      bubbles: true,
      detail: {
        ...detail,
        kind: detail.kind ?? "click",
        value: detail.value !== undefined ? cloneForRecording(detail.value) : undefined,
        patch: detail.patch ? cloneForRecording(detail.patch) : undefined,
      },
    }),
  );
}

export function emitDwReplayOverlayAction(detail: DwOverlayActionDetail): void {
  if (typeof document === "undefined") return;
  document.dispatchEvent(new CustomEvent(DW_REPLAY_OVERLAY_ACTION, { bubbles: true, detail }));
}

export function emitDwReplayContextMenuOpen(detail: DwContextMenuOpenDetail): void {
  if (typeof document === "undefined") return;
  document.dispatchEvent(
    new CustomEvent(DW_REPLAY_CONTEXT_MENU_OPEN, { bubbles: true, detail }),
  );
}

export function emitDwReplayContextMenuAction(detail: DwContextMenuActionDetail): void {
  if (typeof document === "undefined") return;
  document.dispatchEvent(
    new CustomEvent(DW_REPLAY_CONTEXT_MENU_ACTION, { bubbles: true, detail }),
  );
}

export function emitPlaybackCursor(detail: DwPlaybackCursorDetail): void {
  if (typeof document === "undefined") return;
  document.dispatchEvent(new CustomEvent(DW_PLAYBACK_CURSOR, { bubbles: true, detail }));
}
