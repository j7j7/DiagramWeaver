/** Semantic recording events — react-dnd / HTML5 drag cannot be replayed via synthetic pointer events. */

import type { InteractionRecordingCanvasTransform } from "@/lib/interaction-recording-types";

export const DW_PALETTE_DROP = "dwPaletteDrop";
export const DW_CANVAS_MOVE = "dwCanvasMove";
export const DW_CANVAS_RESIZE = "dwCanvasResize";
export const DW_CANVAS_TRANSFORM = "dwCanvasTransform";
export const DW_REPLAY_CANVAS_MOVE = "dwReplayCanvasMove";
export const DW_REPLAY_CANVAS_RESIZE = "dwReplayCanvasResize";
export const DW_REPLAY_CANVAS_TRANSFORM = "dwReplayCanvasTransform";
export const DW_OVERLAY_OPEN = "dwOverlayOpen";
export const DW_OVERLAY_CLOSE = "dwOverlayClose";
export const DW_OVERLAY_ACTION = "dwOverlayAction";
export const DW_REPLAY_OVERLAY_ACTION = "dwReplayOverlayAction";
export const DW_CONTEXT_MENU_OPEN = "dwContextMenuOpen";
export const DW_CONTEXT_MENU_ACTION = "dwContextMenuAction";
export const DW_REPLAY_CONTEXT_MENU_OPEN = "dwReplayContextMenuOpen";
export const DW_REPLAY_CONTEXT_MENU_ACTION = "dwReplayContextMenuAction";
export const DW_SEARCH_MODAL_OPEN = "dwSearchModalOpen";
export const DW_SEARCH_MODAL_QUERY = "dwSearchModalQuery";
export const DW_RESOURCE_ACTIVATE = "dwResourceActivate";
export const DW_BATCH_SELECT = "dwBatchSelect";
export const DW_REPLAY_SEARCH_MODAL_OPEN = "dwReplaySearchModalOpen";
export const DW_REPLAY_SEARCH_MODAL_QUERY = "dwReplaySearchModalQuery";
export const DW_REPLAY_RESOURCE_ACTIVATE = "dwReplayResourceActivate";
export const DW_REPLAY_BATCH_SELECT = "dwReplayBatchSelect";
export const DW_REPLAY_CLIPBOARD_COPY = "dwReplayClipboardCopy";
export const DW_REPLAY_CLIPBOARD_PASTE = "dwReplayClipboardPaste";
export const DW_REPLAY_SELECT_NODE = "dwReplaySelectNode";
export const DW_REPLAY_SEARCH_MODAL_CLOSE = "dwReplaySearchModalClose";
export const DW_PLAYBACK_CURSOR = "dwPlaybackCursor";
export const DW_DIAGRAM_CHANGE = "dwDiagramChange";
export const DW_REPLAY_DIAGRAM_CHANGE = "dwReplayDiagramChange";
export const DW_REPLAY_CLOSE_OVERLAYS = "dwReplayCloseOverlays";

export type PlaybackCursorKind =
  | "left-down"
  | "left-up"
  | "right-down"
  | "right-up"
  | "left-drag-start"
  | "left-drag-move"
  | "left-drag-end"
  | "right-drag-start"
  | "right-drag-move"
  | "right-drag-end"
  | "hold-start"
  | "hold-end"
  | "copy"
  | "paste"
  | "pointer";

export interface DwPlaybackCursorDetail {
  x: number;
  y: number;
  kind: PlaybackCursorKind;
  /** Drag segment start (client px) for trail rendering. */
  fromX?: number;
  fromY?: number;
  /** Optional sampled drag path (client px). */
  path?: Array<{ x: number; y: number }>;
  /** Override default action label (e.g. "Resize"). */
  label?: string;
}

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
  /** When true, replay shows the menu flash only — diagram change event applies the effect. */
  cosmeticOnly?: boolean;
}

export interface DwSearchModalOpenDetail {
  clientX: number;
  clientY: number;
  diagramX: number;
  diagramY: number;
}

export interface DwSearchModalQueryDetail {
  query: string;
}

export interface DwBatchSelectDetail {
  itemIds: string[];
}

/** Search modal click (or equivalent) — places a palette item at the right-click diagram anchor. */
export interface DwResourceActivateDetail {
  item: unknown;
  provider: string;
  category: string;
  diagramX: number;
  diagramY: number;
  resourceLabel?: string;
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

export interface DwCanvasResizeDetail {
  id: string;
  width: number;
  height: number;
  x?: number;
  y?: number;
  handle?: string;
  itemType?: "node" | "zone";
}

/** Direct diagram JSON mutation — replay applies to state without driving UI controls. */
export type DwDiagramChangeDetail =
  | { op: "set-diagram"; diagram: import("@/lib/types").DiagramData }
  | {
      op: "update-node";
      nodeId: string;
      patch: Record<string, unknown>;
      removeKeys?: string[];
    }
  | {
      op: "update-zone";
      zoneId: string;
      patch: Record<string, unknown>;
      removeKeys?: string[];
    }
  | {
      op: "update-connection";
      connectionId?: string;
      from?: string;
      to?: string;
      patch: Record<string, unknown>;
      removeKeys?: string[];
      applyToConnectionIds?: string[];
    }
  | { op: "delete-items"; ids: string[] }
  | { op: "disconnect-node"; nodeId: string }
  | { op: "add-connections"; connections: import("@/lib/types").DiagramConnectionData[] };

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

export function emitDwCanvasResize(detail: DwCanvasResizeDetail): void {
  if (typeof document === "undefined") return;
  if (document.body.dataset.dwPlayback === "active") return;
  document.dispatchEvent(
    new CustomEvent(DW_CANVAS_RESIZE, {
      bubbles: true,
      detail,
    }),
  );
}

export function emitDwReplayCanvasResize(detail: DwCanvasResizeDetail): void {
  if (typeof document === "undefined") return;
  document.dispatchEvent(
    new CustomEvent(DW_REPLAY_CANVAS_RESIZE, {
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

export function emitDwSearchModalOpen(detail: DwSearchModalOpenDetail): void {
  if (typeof document === "undefined") return;
  if (document.body.dataset.dwPlayback === "active") return;
  document.dispatchEvent(new CustomEvent(DW_SEARCH_MODAL_OPEN, { bubbles: true, detail }));
}

export function emitDwResourceActivate(detail: DwResourceActivateDetail): void {
  if (typeof document === "undefined") return;
  if (document.body.dataset.dwPlayback === "active") return;
  document.dispatchEvent(
    new CustomEvent(DW_RESOURCE_ACTIVATE, {
      bubbles: true,
      detail: {
        ...detail,
        item: cloneForRecording(detail.item),
      },
    }),
  );
}

export function emitDwSearchModalQuery(query: string): void {
  if (typeof document === "undefined") return;
  if (document.body.dataset.dwPlayback === "active") return;
  document.dispatchEvent(
    new CustomEvent(DW_SEARCH_MODAL_QUERY, { bubbles: true, detail: { query } satisfies DwSearchModalQueryDetail }),
  );
}

export function emitDwBatchSelect(itemIds: string[]): void {
  if (typeof document === "undefined") return;
  if (document.body.dataset.dwPlayback === "active") return;
  if (itemIds.length === 0) return;
  document.dispatchEvent(
    new CustomEvent(DW_BATCH_SELECT, { bubbles: true, detail: { itemIds } satisfies DwBatchSelectDetail }),
  );
}

export function emitDwReplaySearchModalOpen(detail: DwSearchModalOpenDetail): void {
  if (typeof document === "undefined") return;
  document.dispatchEvent(new CustomEvent(DW_REPLAY_SEARCH_MODAL_OPEN, { bubbles: true, detail }));
}

export function emitDwReplayResourceActivate(detail: DwResourceActivateDetail): void {
  if (typeof document === "undefined") return;
  document.dispatchEvent(
    new CustomEvent(DW_REPLAY_RESOURCE_ACTIVATE, {
      bubbles: true,
      detail: {
        ...detail,
        item: cloneForRecording(detail.item),
      },
    }),
  );
}

export function emitDwReplaySearchModalQuery(query: string): void {
  if (typeof document === "undefined") return;
  document.dispatchEvent(
    new CustomEvent(DW_REPLAY_SEARCH_MODAL_QUERY, {
      bubbles: true,
      detail: { query } satisfies DwSearchModalQueryDetail,
    }),
  );
}

export function emitDwReplayBatchSelect(itemIds: string[]): void {
  if (typeof document === "undefined") return;
  document.dispatchEvent(
    new CustomEvent(DW_REPLAY_BATCH_SELECT, {
      bubbles: true,
      detail: { itemIds } satisfies DwBatchSelectDetail,
    }),
  );
}

export function emitDwReplayClipboardCopy(): void {
  if (typeof document === "undefined") return;
  document.dispatchEvent(new CustomEvent(DW_REPLAY_CLIPBOARD_COPY, { bubbles: true }));
}

export function emitDwReplayClipboardPaste(): void {
  if (typeof document === "undefined") return;
  document.dispatchEvent(new CustomEvent(DW_REPLAY_CLIPBOARD_PASTE, { bubbles: true }));
}

export function emitDwReplaySelectNode(nodeId: string, itemType: "node" | "zone" = "node"): void {
  if (typeof document === "undefined") return;
  document.dispatchEvent(
    new CustomEvent(DW_REPLAY_SELECT_NODE, {
      bubbles: true,
      detail: { nodeId, itemType },
    }),
  );
}

export function emitDwReplaySearchModalClose(): void {
  if (typeof document === "undefined") return;
  document.dispatchEvent(new CustomEvent(DW_REPLAY_SEARCH_MODAL_CLOSE, { bubbles: true }));
}

export function emitPlaybackCursor(detail: DwPlaybackCursorDetail): void {
  if (typeof document === "undefined") return;
  document.dispatchEvent(new CustomEvent(DW_PLAYBACK_CURSOR, { bubbles: true, detail }));
}

export function emitDwDiagramChange(detail: DwDiagramChangeDetail): void {
  if (typeof document === "undefined") return;
  if (document.body.dataset.dwPlayback === "active") return;
  document.dispatchEvent(
    new CustomEvent(DW_DIAGRAM_CHANGE, {
      bubbles: true,
      detail: cloneForRecording(detail),
    }),
  );
}

export function emitDwReplayDiagramChange(detail: DwDiagramChangeDetail): void {
  if (typeof document === "undefined") return;
  document.dispatchEvent(
    new CustomEvent(DW_REPLAY_DIAGRAM_CHANGE, {
      bubbles: true,
      detail: cloneForRecording(detail),
    }),
  );
}

export function emitDwReplayCloseOverlays(): void {
  if (typeof document === "undefined") return;
  document.dispatchEvent(new CustomEvent(DW_REPLAY_CLOSE_OVERLAYS, { bubbles: true }));
}
