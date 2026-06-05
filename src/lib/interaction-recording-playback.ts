import type {
  InteractionRecording,
  InteractionRecordingEvent,
  InteractionRecordingModifiers,
  InteractionRecordingTarget,
} from "@/lib/interaction-recording-types";
import {
  DW_BATCH_SELECT,
  DW_CANVAS_MOVE,
  DW_CANVAS_RESIZE,
  DW_CANVAS_TRANSFORM,
  DW_CONTEXT_MENU_ACTION,
  DW_CONTEXT_MENU_OPEN,
  DW_DIAGRAM_CHANGE,
  DW_OVERLAY_ACTION,
  DW_OVERLAY_OPEN,
  DW_PALETTE_DROP,
  DW_SEARCH_MODAL_OPEN,
  DW_SEARCH_MODAL_QUERY,
  DW_RESOURCE_ACTIVATE,
  emitDwReplayBatchSelect,
  emitDwReplayCanvasTransform,
  emitDwReplayClipboardCopy,
  emitDwReplayClipboardPaste,
  emitDwReplayContextMenuAction,
  emitDwReplayContextMenuOpen,
  emitDwReplaySearchModalOpen,
  emitDwReplaySearchModalQuery,
  emitDwReplayResourceActivate,
  emitDwReplaySearchModalClose,
  emitDwReplaySelectNode,
  emitDwReplayCloseOverlays,
  emitDwReplayDiagramChange,
  emitPlaybackCursor,
  type DwBatchSelectDetail,
  type DwCanvasMoveDetail,
  type DwCanvasResizeDetail,
  type DwContextMenuActionDetail,
  type DwContextMenuOpenDetail,
  type DwDiagramChangeDetail,
  type DwOverlayActionDetail,
  type DwPaletteDropDetail,
  type DwPlaybackCursorDetail,
  type DwSearchModalOpenDetail,
  type DwSearchModalQueryDetail,
  type DwResourceActivateDetail,
  type PlaybackCursorKind,
} from "@/lib/interaction-recording-bridge";
import { ItemTypes } from "@/components/editor/draggable-item";
import {
  focusInteractionTarget,
  isEditableElement,
  nodeIdTypePrefix,
  queryResizeHandleElement,
  resolveInteractionTargetForEvent,
  setNativeInputValue,
  waitForInputByPlaceholder,
} from "@/lib/interaction-recording-target";
import {
  centerOfElement,
  isTargetInRecordingSurface,
  RECORDING_SURFACE_CANVAS_CONTEXT_MENU,
  RECORDING_SURFACE_SEARCH_RESOURCES,
  RECORDING_SURFACE_VISUAL_STYLING,
  resolveRecordingSurfaceTarget,
  waitForRecordingSurface,
} from "@/lib/interaction-recording-surfaces";
import {
  diagramToClient,
  isClientPointOverCanvas,
  remapClientPointForCanvasTransform,
  remapClientPointForViewportResize,
  type ReplayPointContext,
  resolveReplayClientPoint,
  transformsEqual,
  waitForCanvasTransform,
} from "@/lib/interaction-recording-transform";
import type { InteractionRecordingCanvasTransform } from "@/lib/interaction-recording-types";
import {
  collectSemanticActionMarkers,
  replayOverlayAction,
  shouldStripSurfaceDomEvent,
} from "@/lib/interaction-recording-overlay";
import { annotateCosmeticMenuActions } from "@/lib/interaction-recording-diagram";

interface PlaybackRuntime {
  pointerDown?: { button: number };
  holdShown: boolean;
  signal?: AbortSignal;
  lastNodeId?: string;
  nodeIdRemap: Map<string, string>;
  /** Last pointer-down client coords on a canvas node (for click replay without micro-drag). */
  lastNodePointerDown?: { nodeId: string; x: number; y: number };
  /** Unstripped recording — used to rebuild drag trails for semantic canvas moves. */
  sourceRecording?: InteractionRecording;
  dragStart?: { x: number; y: number };
  dragPath?: Array<{ x: number; y: number }>;
  lastCursor?: { x: number; y: number };
  playbackSpeed?: number;
  /** Dedupe semantic drag visuals when move/resize has both legacy + diagram events. */
  playedVisualKeys?: Set<string>;
  playbackController?: PlaybackController;
}

export interface InteractionRecordingPlaybackOptions {
  speed?: number;
  onEvent?: (index: number, total: number) => void;
  signal?: AbortSignal;
  /** Original recording before pointer stripping (for drag trail visuals). */
  sourceRecording?: InteractionRecording;
}

export interface InteractionRecordingPlaybackHandle {
  promise: Promise<void>;
  abort: () => void;
  pause: () => void;
  resume: () => void;
  isPaused: () => boolean;
}

class PlaybackController {
  private readonly abortController = new AbortController();
  private paused = false;
  private pauseWaiters: Array<() => void> = [];

  get signal(): AbortSignal {
    return this.abortController.signal;
  }

  abort(): void {
    this.abortController.abort();
    this.resume();
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    const waiters = this.pauseWaiters;
    this.pauseWaiters = [];
    for (const wake of waiters) wake();
  }

  isPaused(): boolean {
    return this.paused;
  }

  waitWhilePaused(): Promise<void> {
    if (!this.paused || this.signal.aborted) return Promise.resolve();
    return new Promise((resolve, reject) => {
      if (this.signal.aborted) {
        reject(new DOMException("Playback aborted", "AbortError"));
        return;
      }
      this.pauseWaiters.push(() => {
        if (this.signal.aborted) {
          reject(new DOMException("Playback aborted", "AbortError"));
          return;
        }
        resolve();
      });
    });
  }
}

async function sleepPausable(ms: number, controller: PlaybackController): Promise<void> {
  if (controller.signal.aborted) {
    throw new DOMException("Playback aborted", "AbortError");
  }
  if (ms > 0) {
    await new Promise<void>((resolve, reject) => {
      if (controller.signal.aborted) {
        reject(new DOMException("Playback aborted", "AbortError"));
        return;
      }
      const id = window.setTimeout(() => {
        controller.signal.removeEventListener("abort", onAbort);
        resolve();
      }, ms);
      const onAbort = () => {
        window.clearTimeout(id);
        reject(new DOMException("Playback aborted", "AbortError"));
      };
      controller.signal.addEventListener("abort", onAbort, { once: true });
    });
  }
  await controller.waitWhilePaused();
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Playback aborted", "AbortError"));
      return;
    }
    const id = window.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      window.clearTimeout(id);
      reject(new DOMException("Playback aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function pausableWait(ms: number, runtime: PlaybackRuntime): Promise<void> {
  if (runtime.playbackController) {
    await sleepPausable(ms, runtime.playbackController);
    return;
  }
  await sleep(ms, runtime.signal);
}

function nodeExistsOnCanvas(nodeId: string): boolean {
  return Boolean(document.querySelector(`[data-node-id="${CSS.escape(nodeId)}"]`));
}

/** Map recorded node ids to nodes created during replay (palette drops use new sequential suffixes). */
function resolveEffectiveNodeId(recordedId: string, runtime: PlaybackRuntime): string {
  const remapped = runtime.nodeIdRemap.get(recordedId);
  if (remapped) return remapped;
  if (nodeExistsOnCanvas(recordedId)) return recordedId;
  if (runtime.lastNodeId && nodeIdTypePrefix(recordedId) === nodeIdTypePrefix(runtime.lastNodeId)) {
    runtime.nodeIdRemap.set(recordedId, runtime.lastNodeId);
    return runtime.lastNodeId;
  }
  return recordedId;
}

function effectiveTarget(
  target: InteractionRecordingTarget | undefined,
  runtime: PlaybackRuntime,
): InteractionRecordingTarget | undefined {
  if (!target?.nodeId) return target;
  const nodeId = resolveEffectiveNodeId(target.nodeId, runtime);
  return nodeId === target.nodeId ? target : { ...target, nodeId };
}

function resolveResizeHandleElement(
  target: InteractionRecordingTarget | undefined,
  runtime: PlaybackRuntime,
): Element | null {
  if (!target?.handle || !target.nodeId) return null;
  const nodeId = resolveEffectiveNodeId(target.nodeId, runtime);
  return queryResizeHandleElement(nodeId, target.handle);
}

async function waitReplayFrames(count = 2): Promise<void> {
  for (let i = 0; i < count; i++) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
}

async function ensureNodeSelectedForReplay(nodeId: string, runtime: PlaybackRuntime): Promise<void> {
  emitDwReplaySelectNode(nodeId);
  runtime.lastNodeId = nodeId;
  await waitReplayFrames(2);
}

/** Prefer resize handles, surface/action targets, then coordinate hit-testing. */
function resolveAtCoordinates(
  event: InteractionRecordingEvent,
  x: number,
  y: number,
  runtime: PlaybackRuntime,
): Element | null {
  if ("target" in event) {
    const target = effectiveTarget(event.target, runtime);
    const handleEl = resolveResizeHandleElement(target, runtime);
    if (handleEl) return handleEl;
    if (target && isTargetInRecordingSurface(target)) {
      const surfaceEl = resolveInteractionTargetForEvent(target, x, y);
      if (surfaceEl instanceof Element) return surfaceEl;
    }
  }
  const atPoint =
    typeof document !== "undefined" && Number.isFinite(x) && Number.isFinite(y)
      ? document.elementFromPoint(x, y)
      : null;
  if (atPoint instanceof Element) return atPoint;
  if ("target" in event) {
    const target = effectiveTarget(event.target, runtime);
    return target ? resolveInteractionTargetForEvent(target, x, y) : null;
  }
  return null;
}

function resolveEventPoint(
  event: InteractionRecordingEvent & {
    x: number;
    y: number;
    diagram?: { x: number; y: number };
    canvasTransform?: InteractionRecordingCanvasTransform;
    phase?: "down" | "move" | "up" | "cancel";
  },
  ctx: ReplayPointContext,
  runtime: PlaybackRuntime,
): { x: number; y: number } {
  if ("target" in event) {
    const target = effectiveTarget(event.target, runtime);
    if (target?.handle && target.nodeId) {
      const handleEl = resolveResizeHandleElement(target, runtime);
      if (handleEl instanceof Element && event.phase === "down") {
        return centerOfElement(handleEl);
      }
    }
    if (target && isTargetInRecordingSurface(target)) {
      const el = resolveInteractionTargetForEvent(target, event.x, event.y);
      if (el instanceof Element) return centerOfElement(el);
    }
  }
  return resolveReplayClientPoint(
    event.x,
    event.y,
    event.diagram,
    ctx,
    event.canvasTransform,
  );
}

function readEventCanvasTransform(
  event: InteractionRecordingEvent,
): InteractionRecordingCanvasTransform | undefined {
  if ("canvasTransform" in event && event.canvasTransform) {
    return event.canvasTransform;
  }
  return undefined;
}

function resolveRecordingStartTransform(
  recording: InteractionRecording,
): InteractionRecordingCanvasTransform {
  if (recording.canvasTransform) return { ...recording.canvasTransform };
  for (const event of recording.events) {
    if (event.kind === "custom" && event.name === DW_CANVAS_TRANSFORM) {
      const detail = event.detail as InteractionRecordingCanvasTransform | null;
      if (detail && typeof detail.k === "number") return { ...detail };
    }
    const snapshot = readEventCanvasTransform(event);
    if (snapshot) return { ...snapshot };
  }
  return { x: 0, y: 0, k: 1 };
}

async function syncCanvasTransformForEvent(
  event: InteractionRecordingEvent,
  ctx: ReplayPointContext,
  runtime: PlaybackRuntime,
): Promise<void> {
  const target = readEventCanvasTransform(event);
  if (!target || transformsEqual(target, ctx.activeTransform, 0.25)) return;
  ctx.activeTransform = { ...target };
  applyCanvasTransform(ctx.activeTransform);
  await waitForCanvasTransform(ctx.activeTransform, 400, runtime.signal);
}

function showPlaybackPointer(x: number, y: number) {
  emitPlaybackCursor({ x, y, kind: "pointer" });
}

function showPlaybackCursor(
  x: number,
  y: number,
  kind: PlaybackCursorKind,
  extra?: Pick<DwPlaybackCursorDetail, "fromX" | "fromY" | "path" | "label">,
) {
  showPlaybackPointer(x, y);
  if (kind === "pointer") return;
  emitPlaybackCursor({ x, y, kind, ...extra });
}

function semanticVisualKey(kind: "move" | "resize", id: string, t: number): string {
  return `${kind}:${id}:${Math.round(t / 150)}`;
}

function shouldPlaySemanticVisual(runtime: PlaybackRuntime, key: string): boolean {
  if (!runtime.playedVisualKeys) runtime.playedVisualKeys = new Set();
  if (runtime.playedVisualKeys.has(key)) return false;
  runtime.playedVisualKeys.add(key);
  return true;
}

function playbackStepMs(runtime: PlaybackRuntime, ms: number): number {
  return ms / Math.max(0.1, runtime.playbackSpeed ?? 1);
}

async function playDragTrailVisual(
  path: Array<{ x: number; y: number }>,
  side: "left" | "right",
  runtime: PlaybackRuntime,
  options?: { label?: string },
): Promise<void> {
  if (path.length === 0) return;
  const button = side === "right" ? 2 : 0;
  const label = options?.label;
  const trailExtra = label ? { label } : undefined;
  const start = path[0]!;
  const end = path[path.length - 1]!;

  showPlaybackCursor(start.x, start.y, dragKindForButton(button, "start"), trailExtra);
  await pausableWait(playbackStepMs(runtime, 70), runtime);

  if (path.length > 2) {
    const stepMs = Math.min(55, Math.max(18, 220 / path.length));
    for (let i = 1; i < path.length - 1; i++) {
      const pt = path[i]!;
      showPlaybackCursor(pt.x, pt.y, dragKindForButton(button, "move"), {
        fromX: start.x,
        fromY: start.y,
        path: path.slice(0, i + 1),
        ...trailExtra,
      });
      await pausableWait(playbackStepMs(runtime, stepMs), runtime);
    }
  }

  showPlaybackCursor(end.x, end.y, dragKindForButton(button, "end"), {
    fromX: start.x,
    fromY: start.y,
    path,
    ...trailExtra,
  });
  runtime.lastCursor = end;
}

function resolveNodeClientCenter(nodeId: string): { x: number; y: number } | null {
  const el = document.querySelector(`[data-node-id="${CSS.escape(nodeId)}"]`);
  if (!(el instanceof Element)) return null;
  return centerOfElement(el);
}

function resolveCopyPasteAnchor(runtime: PlaybackRuntime): { x: number; y: number } {
  if (runtime.lastNodeId) {
    const center = resolveNodeClientCenter(runtime.lastNodeId);
    if (center) return center;
  }
  if (runtime.lastCursor) return runtime.lastCursor;
  return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
}

function dragKindForButton(
  button: number,
  phase: "start" | "move" | "end",
): PlaybackCursorKind {
  const side = button === 2 ? "right" : "left";
  return `${side}-drag-${phase}` as PlaybackCursorKind;
}

const TRAIL_ORIGIN_TOLERANCE = 3;

function isNearScreenOrigin(pt: { x: number; y: number }): boolean {
  return pt.x <= TRAIL_ORIGIN_TOLERANCE && pt.y <= TRAIL_ORIGIN_TOLERANCE;
}

function isReasonableTrailPoint(pt: { x: number; y: number }): boolean {
  if (!Number.isFinite(pt.x) || !Number.isFinite(pt.y)) return false;
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (pt.x < -w * 0.1 || pt.y < -h * 0.1) return false;
  if (pt.x > w * 1.1 || pt.y > h * 1.1) return false;
  return true;
}

/** Prefer remapped client coords; diagram fallback uses the event's canvas transform. */
function resolveTrailClientPoint(
  clientX: number,
  clientY: number,
  diagram: { x: number; y: number } | undefined,
  ctx: ReplayPointContext,
  eventTransform?: InteractionRecordingCanvasTransform,
): { x: number; y: number } | null {
  const fromTransform = eventTransform ?? ctx.recordedTransform;
  const currentViewport = { width: window.innerWidth, height: window.innerHeight };

  const rawClientLooksValid =
    Number.isFinite(clientX) &&
    Number.isFinite(clientY) &&
    !(clientX <= TRAIL_ORIGIN_TOLERANCE && clientY <= TRAIL_ORIGIN_TOLERANCE);

  if (rawClientLooksValid) {
    if (isClientPointOverCanvas(clientX, clientY)) {
      const remapped = remapClientPointForCanvasTransform(
        clientX,
        clientY,
        fromTransform,
        ctx.activeTransform,
      );
      if (remapped && isReasonableTrailPoint(remapped)) return remapped;
    }
    const viewportRemapped = remapClientPointForViewportResize(
      clientX,
      clientY,
      ctx.recordedViewport,
      currentViewport,
    );
    if (isReasonableTrailPoint(viewportRemapped) && !isNearScreenOrigin(viewportRemapped)) {
      return viewportRemapped;
    }
  }

  if (diagram && Number.isFinite(diagram.x) && Number.isFinite(diagram.y)) {
    const atEvent = diagramToClient(diagram.x, diagram.y, fromTransform);
    if (atEvent) {
      const remapped = remapClientPointForCanvasTransform(
        atEvent.x,
        atEvent.y,
        fromTransform,
        ctx.activeTransform,
      );
      if (remapped && isReasonableTrailPoint(remapped)) return remapped;
    }
    const atActive = diagramToClient(diagram.x, diagram.y, ctx.activeTransform);
    if (atActive && isReasonableTrailPoint(atActive)) return atActive;
  }

  return null;
}

function appendTrailPoint(
  points: Array<{ x: number; y: number }>,
  pt: { x: number; y: number } | null,
): void {
  if (!pt || !isReasonableTrailPoint(pt) || isNearScreenOrigin(pt)) return;

  const prev = points[points.length - 1];
  if (prev) {
    const dist = Math.hypot(pt.x - prev.x, pt.y - prev.y);
    if (dist < 2) return;
    const maxJump = Math.max(600, window.innerWidth * 0.45);
    if (dist > maxJump) return;
  }
  points.push(pt);
}

function sanitizeDragTrail(path: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
  const cleaned: Array<{ x: number; y: number }> = [];
  for (const pt of path) {
    appendTrailPoint(cleaned, pt);
  }
  return cleaned;
}

function findDragTrailForCanvasMove(
  sourceRecording: InteractionRecording | undefined,
  nodeId: string,
  endT: number,
  ctx: ReplayPointContext,
): Array<{ x: number; y: number }> {
  if (!sourceRecording) return [];
  const downT = lastPointerDownBefore(sourceRecording, nodeId, endT);
  if (downT == null) return [];

  const points: Array<{ x: number; y: number }> = [];
  for (const ev of sourceRecording.events) {
    if (ev.t < downT || ev.t > endT + 80) continue;
    if (ev.kind !== "pointer") continue;
    if (!("target" in ev) || ev.target.nodeId !== nodeId || ev.target.handle) continue;
    appendTrailPoint(
      points,
      resolveTrailClientPoint(ev.x, ev.y, ev.diagram, ctx, ev.canvasTransform),
    );
  }
  return points;
}

function findResizeDragTrail(
  sourceRecording: InteractionRecording | undefined,
  nodeId: string,
  endT: number,
  ctx: ReplayPointContext,
  handleHint?: string,
): Array<{ x: number; y: number }> {
  if (!sourceRecording) return [];

  let downT: number | null = null;
  for (const ev of sourceRecording.events) {
    if (ev.t >= endT) break;
    if (
      ev.kind === "pointer" &&
      ev.phase === "down" &&
      "target" in ev &&
      ev.target.nodeId === nodeId &&
      ev.target.handle &&
      (!handleHint || ev.target.handle === handleHint)
    ) {
      downT = ev.t;
    }
  }
  if (downT == null) return [];

  const points: Array<{ x: number; y: number }> = [];
  for (const ev of sourceRecording.events) {
    if (ev.t < downT || ev.t > endT + 120) continue;
    if (ev.kind !== "pointer") continue;
    if (!("target" in ev) || ev.target.nodeId !== nodeId || !ev.target.handle) continue;
    if (handleHint && ev.target.handle !== handleHint) continue;
    appendTrailPoint(
      points,
      resolveTrailClientPoint(ev.x, ev.y, ev.diagram, ctx, ev.canvasTransform),
    );
  }
  return points;
}

async function resolveResizeHandleClientPoint(
  nodeId: string,
  handle: string | undefined,
  runtime: PlaybackRuntime,
): Promise<{ x: number; y: number } | null> {
  await ensureNodeSelectedForReplay(nodeId, runtime);
  await waitReplayFrames(2);
  const handleId = handle ?? "se";
  const el = queryResizeHandleElement(nodeId, handleId);
  if (el instanceof Element) return centerOfElement(el);
  return resolveNodeClientCenter(nodeId);
}

async function showCanvasMoveDragVisual(
  detail: DwCanvasMoveDetail,
  moveT: number,
  ctx: ReplayPointContext,
  runtime: PlaybackRuntime,
): Promise<void> {
  const id = resolveEffectiveNodeId(detail.id, runtime);
  if (!shouldPlaySemanticVisual(runtime, semanticVisualKey("move", id, moveT))) return;

  const endClient =
    typeof detail.clientX === "number" && typeof detail.clientY === "number"
      ? { x: detail.clientX, y: detail.clientY }
      : diagramToClient(detail.diagramX, detail.diagramY, ctx.activeTransform);
  if (!endClient) return;

  let path = findDragTrailForCanvasMove(runtime.sourceRecording, id, moveT, ctx);
  if (path.length === 0) {
    const start = resolveNodeClientCenter(id);
    if (start) path = [start, endClient];
    else path = [endClient];
  } else if (path[path.length - 1]!.x !== endClient.x || path[path.length - 1]!.y !== endClient.y) {
    path = [...path, endClient];
  }

  path = sanitizeDragTrail(path);
  if (path.length === 0) {
    const start = resolveNodeClientCenter(id);
    if (start) path = [start, endClient];
    else path = [endClient];
  }

  await playDragTrailVisual(path, "left", runtime, { label: "Move" });
}

async function showCanvasResizeDragVisual(
  nodeId: string,
  resizeT: number,
  ctx: ReplayPointContext,
  runtime: PlaybackRuntime,
  options?: { handle?: string },
): Promise<void> {
  const id = resolveEffectiveNodeId(nodeId, runtime);
  if (!shouldPlaySemanticVisual(runtime, semanticVisualKey("resize", id, resizeT))) return;

  let path = findResizeDragTrail(
    runtime.sourceRecording,
    id,
    resizeT,
    ctx,
    options?.handle,
  );

  if (path.length === 0) {
    const handlePoint = await resolveResizeHandleClientPoint(id, options?.handle, runtime);
    if (handlePoint) path = [handlePoint, handlePoint];
  } else if (path.length === 1) {
    path = [path[0]!, path[0]!];
  }

  path = sanitizeDragTrail(path);

  await playDragTrailVisual(path, "left", runtime, { label: "Resize" });
}

async function showSemanticDragVisualForDiagramChange(
  change: DwDiagramChangeDetail,
  changeT: number,
  ctx: ReplayPointContext,
  runtime: PlaybackRuntime,
): Promise<void> {
  if (change.op === "update-node") {
    const isResize = "width" in change.patch || "height" in change.patch;
    const isMove = "x" in change.patch || "y" in change.patch;
    if (isResize) {
      await showCanvasResizeDragVisual(change.nodeId, changeT, ctx, runtime);
    } else if (isMove) {
      const diagramX = change.patch.x;
      const diagramY = change.patch.y;
      if (typeof diagramX !== "number" || typeof diagramY !== "number") return;
      const endClient = diagramToClient(diagramX, diagramY, ctx.activeTransform);
      if (!endClient) return;
      await showCanvasMoveDragVisual(
        {
          id: change.nodeId,
          itemType: "canvas_node",
          diagramX,
          diagramY,
          clientX: endClient.x,
          clientY: endClient.y,
        },
        changeT,
        ctx,
        runtime,
      );
    }
    return;
  }
  if (change.op === "update-zone") {
    const isResize = "width" in change.patch || "height" in change.patch;
    const isMove = "x" in change.patch || "y" in change.patch;
    if (isResize) {
      await showCanvasResizeDragVisual(change.zoneId, changeT, ctx, runtime);
    } else if (isMove) {
      const diagramX = change.patch.x;
      const diagramY = change.patch.y;
      if (typeof diagramX !== "number" || typeof diagramY !== "number") return;
      const endClient = diagramToClient(diagramX, diagramY, ctx.activeTransform);
      if (!endClient) return;
      await showCanvasMoveDragVisual(
        {
          id: change.zoneId,
          itemType: "zone",
          diagramX,
          diagramY,
          clientX: endClient.x,
          clientY: endClient.y,
        },
        changeT,
        ctx,
        runtime,
      );
    }
  }
}

function modifierInit(modifiers: InteractionRecordingModifiers) {
  return {
    altKey: modifiers.alt,
    ctrlKey: modifiers.ctrl,
    metaKey: modifiers.meta,
    shiftKey: modifiers.shift,
  };
}

function dispatchMouseTriplet(
  type: "mousedown" | "mousemove" | "mouseup",
  x: number,
  y: number,
  el: Element,
  modifiers: InteractionRecordingModifiers,
  button = 0,
  buttons = 0,
) {
  const mods = modifierInit(modifiers);
  el.dispatchEvent(
    new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      button,
      buttons,
      ...mods,
      view: window,
    }),
  );
}

/** Native click reliably invokes React onClick on menus and Radix controls. */
function activateElementClick(el: Element): void {
  if (el instanceof HTMLElement && typeof el.click === "function") {
    el.click();
    return;
  }
  el.dispatchEvent(
    new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      view: window,
    }),
  );
}

function resolveClickTarget(
  event: InteractionRecordingEvent & { target?: InteractionRecordingTarget },
  point: { x: number; y: number },
  runtime: PlaybackRuntime,
): Element | null {
  if ("target" in event && event.target && isTargetInRecordingSurface(event.target)) {
    const surfaceEl = resolveRecordingSurfaceTarget(event.target);
    if (surfaceEl instanceof Element) return surfaceEl;
  }
  return resolveAtCoordinates(event, point.x, point.y, runtime);
}

function applyCanvasTransform(transform: InteractionRecordingCanvasTransform) {
  emitDwReplayCanvasTransform(transform);
}

async function dispatchPointer(
  event: Extract<InteractionRecordingEvent, { kind: "pointer" }>,
  ctx: ReplayPointContext,
  runtime: PlaybackRuntime,
) {
  await syncCanvasTransformForEvent(event, ctx, runtime);

  if (event.phase === "down" && event.target?.handle && event.target.nodeId) {
    const nodeId = resolveEffectiveNodeId(event.target.nodeId, runtime);
    await ensureNodeSelectedForReplay(nodeId, runtime);
  } else if (event.phase === "down" && event.target?.nodeId && !event.target.handle) {
    runtime.lastNodeId = resolveEffectiveNodeId(event.target.nodeId, runtime);
  }

  const point = resolveEventPoint(event, ctx, runtime);
  let dispatchPoint = point;
  const effectiveNodeId =
    event.target?.nodeId && !event.target.handle
      ? resolveEffectiveNodeId(event.target.nodeId, runtime)
      : undefined;

  if (event.phase === "down" && effectiveNodeId) {
    runtime.lastNodePointerDown = { nodeId: effectiveNodeId, x: point.x, y: point.y };
  } else if (
    event.phase === "up" &&
    effectiveNodeId &&
    runtime.lastNodePointerDown?.nodeId === effectiveNodeId &&
    !runtime.holdShown
  ) {
    dispatchPoint = {
      x: runtime.lastNodePointerDown.x,
      y: runtime.lastNodePointerDown.y,
    };
  }

  const el = resolveAtCoordinates(event, dispatchPoint.x, dispatchPoint.y, runtime);
  if (!(el instanceof Element)) return;

  if (event.phase === "down") {
    runtime.pointerDown = { button: event.button };
    runtime.holdShown = false;
    runtime.dragStart = { x: dispatchPoint.x, y: dispatchPoint.y };
    runtime.dragPath = [{ x: dispatchPoint.x, y: dispatchPoint.y }];
    if (event.target?.nodeId) {
      runtime.lastNodeId = resolveEffectiveNodeId(event.target.nodeId, runtime);
    }
    runtime.lastCursor = dispatchPoint;
    showPlaybackCursor(dispatchPoint.x, dispatchPoint.y, event.button === 2 ? "right-down" : "left-down");
  } else if (event.phase === "move" && runtime.pointerDown) {
    if (runtime.dragStart) {
      runtime.dragPath = [...(runtime.dragPath ?? [runtime.dragStart]), { x: dispatchPoint.x, y: dispatchPoint.y }];
    }
    if (!runtime.holdShown) {
      runtime.holdShown = true;
      const start = runtime.dragStart ?? dispatchPoint;
      showPlaybackCursor(start.x, start.y, dragKindForButton(runtime.pointerDown.button, "start"));
    }
    runtime.lastCursor = dispatchPoint;
    showPlaybackCursor(dispatchPoint.x, dispatchPoint.y, dragKindForButton(runtime.pointerDown.button, "move"), {
      fromX: runtime.dragStart?.x,
      fromY: runtime.dragStart?.y,
      path: runtime.dragPath,
    });
  } else if (event.phase === "up" || event.phase === "cancel") {
    const button = runtime.pointerDown?.button ?? event.button;
    if (runtime.holdShown && runtime.dragStart) {
      showPlaybackCursor(dispatchPoint.x, dispatchPoint.y, dragKindForButton(button, "end"), {
        fromX: runtime.dragStart.x,
        fromY: runtime.dragStart.y,
        path: runtime.dragPath,
      });
    }
    runtime.lastCursor = dispatchPoint;
    showPlaybackCursor(dispatchPoint.x, dispatchPoint.y, button === 2 ? "right-up" : "left-up");
    runtime.pointerDown = undefined;
    runtime.holdShown = false;
    runtime.lastNodePointerDown = undefined;
    runtime.dragStart = undefined;
    runtime.dragPath = undefined;
  }

  if (event.phase === "down" && isEditableElement(el)) {
    focusInteractionTarget(el);
  }

  const useNativeClick =
    event.phase === "up" &&
    event.button === 0 &&
    "target" in event &&
    isTargetInRecordingSurface(event.target);

  if (!useNativeClick) {
    const mods = modifierInit(event.modifiers);
    el.dispatchEvent(
      new PointerEvent(`pointer${event.phase}`, {
        bubbles: true,
        cancelable: true,
        clientX: dispatchPoint.x,
        clientY: dispatchPoint.y,
        button: event.button,
        buttons: event.buttons,
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        ...mods,
        view: window,
      }),
    );

    const mouseType =
      event.phase === "down" ? "mousedown" : event.phase === "up" ? "mouseup" : "mousemove";
    dispatchMouseTriplet(
      mouseType,
      dispatchPoint.x,
      dispatchPoint.y,
      el,
      event.modifiers,
      event.button,
      event.buttons,
    );
  }

  if (event.phase === "up" && event.button === 0) {
    const clickTarget = resolveClickTarget(event, dispatchPoint, runtime) ?? el;
    if (useNativeClick) {
      activateElementClick(clickTarget);
    } else {
      const mods = modifierInit(event.modifiers);
      clickTarget.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          clientX: dispatchPoint.x,
          clientY: dispatchPoint.y,
          button: event.button,
          ...mods,
          view: window,
        }),
      );
    }
    await maybeWaitForSurfaceAfterAction(event.target, runtime);
  }
}

async function dispatchClick(
  event: Extract<InteractionRecordingEvent, { kind: "click" }>,
  ctx: ReplayPointContext,
  runtime: PlaybackRuntime,
) {
  await syncCanvasTransformForEvent(event, ctx, runtime);
  const point = resolveEventPoint(event, ctx, runtime);
  const el = resolveClickTarget(event, point, runtime);
  if (!(el instanceof Element)) return;
  showPlaybackCursor(point.x, point.y, "left-down");
  if ("target" in event && isTargetInRecordingSurface(event.target)) {
    activateElementClick(el);
  } else {
    const mods = modifierInit(event.modifiers);
    el.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        clientX: point.x,
        clientY: point.y,
        button: event.button,
        ...mods,
        view: window,
      }),
    );
  }
  showPlaybackCursor(point.x, point.y, "left-up");
  await maybeWaitForSurfaceAfterAction(event.target, runtime);
}

async function dispatchWheel(
  event: Extract<InteractionRecordingEvent, { kind: "wheel" }>,
  ctx: ReplayPointContext,
  runtime: PlaybackRuntime,
) {
  await syncCanvasTransformForEvent(event, ctx, runtime);
  const point = resolveReplayClientPoint(
    event.x,
    event.y,
    event.diagram,
    ctx,
    event.canvasTransform,
  );
  const el = resolveAtCoordinates(event, point.x, point.y, runtime);
  if (!(el instanceof Element)) return;
  showPlaybackPointer(point.x, point.y);
  const mods = modifierInit(event.modifiers);
  el.dispatchEvent(
    new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      clientX: point.x,
      clientY: point.y,
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      deltaZ: event.deltaZ,
      deltaMode: event.deltaMode,
      ...mods,
      view: window,
    }),
  );
}

function applyKeyToEditable(
  el: HTMLInputElement | HTMLTextAreaElement,
  event: Extract<InteractionRecordingEvent, { kind: "keydown" | "keyup" }>,
): void {
  if (event.kind !== "keydown") return;
  let next = el.value;
  if (event.key === "Backspace" || event.key === "Delete") {
    next = next.slice(0, -1);
  } else if (event.key.length === 1 && !event.modifiers.ctrl && !event.modifiers.meta && !event.modifiers.alt) {
    next += event.key;
  } else {
    return;
  }
  setNativeInputValue(el, next);
}

async function dispatchKey(
  event: Extract<InteractionRecordingEvent, { kind: "keydown" | "keyup" }>,
  runtime: PlaybackRuntime,
) {
  if (event.kind === "keydown") {
    const mod = event.modifiers.meta || event.modifiers.ctrl;
    if (mod && !event.modifiers.alt) {
      if (event.key === "c") {
        if (runtime.lastNodeId) {
          emitDwReplaySelectNode(runtime.lastNodeId);
          await waitReplayFrames();
        }
        const anchor = resolveCopyPasteAnchor(runtime);
        showPlaybackCursor(anchor.x, anchor.y, "copy");
        emitDwReplayClipboardCopy();
        return;
      }
      if (event.key === "v") {
        const anchor = resolveCopyPasteAnchor(runtime);
        showPlaybackCursor(anchor.x, anchor.y, "paste");
        emitDwReplayClipboardPaste();
        await waitReplayFrames();
        return;
      }
    }
  }

  const el = resolveInteractionTargetForEvent(event.target);
  if (!(el instanceof Element)) return;
  focusInteractionTarget(el);
  if (isEditableElement(el)) applyKeyToEditable(el, event);
  const mods = modifierInit(event.modifiers);
  el.dispatchEvent(
    new KeyboardEvent(event.kind, {
      bubbles: true,
      cancelable: true,
      key: event.key,
      code: event.code,
      ...mods,
    }),
  );
}

async function dispatchInput(
  event: Extract<InteractionRecordingEvent, { kind: "input" }>,
  signal?: AbortSignal,
) {
  const placeholder = event.target.placeholder ?? event.target.name;
  let el = resolveInteractionTargetForEvent(event.target);
  if ((!el || !isEditableElement(el)) && placeholder) {
    el = await waitForInputByPlaceholder(placeholder, 2500, signal);
  }
  if (!(el instanceof Element) || !isEditableElement(el)) return;
  focusInteractionTarget(el);
  setNativeInputValue(el, event.value);
}

function dispatchChange(event: Extract<InteractionRecordingEvent, { kind: "change" }>) {
  const el = resolveInteractionTargetForEvent(event.target);
  if (!(el instanceof Element)) return;
  focusInteractionTarget(el);
  if (el instanceof HTMLSelectElement || isEditableElement(el)) {
    const proto =
      el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(
      el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : proto,
      "value",
    );
    descriptor?.set?.call(el, event.value);
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

async function dispatchContextMenu(
  event: Extract<InteractionRecordingEvent, { kind: "contextmenu" }>,
  ctx: ReplayPointContext,
  runtime: PlaybackRuntime,
) {
  await syncCanvasTransformForEvent(event, ctx, runtime);
  const point = resolveReplayClientPoint(
    event.x,
    event.y,
    event.diagram,
    ctx,
    event.canvasTransform,
  );
  const el = resolveAtCoordinates(event, point.x, point.y, runtime);
  if (!(el instanceof Element)) return;
  showPlaybackCursor(point.x, point.y, "right-down");
  const mods = modifierInit(event.modifiers);
  el.dispatchEvent(
    new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: point.x,
      clientY: point.y,
      button: 2,
      ...mods,
      view: window,
    }),
  );
  const opensSearch =
    (event.target.testId === "editor-canvas" || event.target.tutorialId === "canvas") &&
    !event.target.nodeId;
  if (opensSearch) {
    if (event.diagram) {
      emitDwReplaySearchModalOpen({
        clientX: point.x,
        clientY: point.y,
        diagramX: event.diagram.x,
        diagramY: event.diagram.y,
      });
    }
    await waitForRecordingSurface(RECORDING_SURFACE_SEARCH_RESOURCES, 2500, runtime.signal);
  } else {
    await waitForRecordingSurface(RECORDING_SURFACE_CANVAS_CONTEXT_MENU, 2000, runtime.signal);
  }
  showPlaybackCursor(point.x, point.y, "right-up");
}

function dispatchPaletteDrop(detail: DwPaletteDropDetail, ctx: ReplayPointContext) {
  const canvas = document.querySelector('[data-testid="editor-canvas"]');
  if (!canvas) return;

  let clientX = detail.clientX;
  let clientY = detail.clientY;
  if (typeof detail.diagramX === "number" && typeof detail.diagramY === "number") {
    const client = diagramToClient(detail.diagramX, detail.diagramY, ctx.activeTransform);
    if (client) {
      clientX = client.x;
      clientY = client.y;
    }
  } else {
    const point = resolveReplayClientPoint(clientX, clientY, undefined, ctx);
    clientX = point.x;
    clientY = point.y;
  }

  canvas.dispatchEvent(
    new CustomEvent("mobileDrop", {
      bubbles: true,
      detail: {
        item: detail.item,
        clientX,
        clientY,
        itemType: detail.itemType ?? ItemTypes.DIAGRAM_NODE,
      },
    }),
  );
}

function nodeIdPrefixFromPaletteType(type: string): string {
  return type.replace(/\./g, "-");
}

function findNodeIdOnCanvasForPaletteType(type: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = nodeIdPrefixFromPaletteType(type);
  const nodes = document.querySelectorAll(`[data-node-id^="${prefix}-"]`);
  if (nodes.length === 0) return null;
  const last = nodes[nodes.length - 1] as HTMLElement;
  return last.getAttribute("data-node-id");
}

function syncLastNodeFromPaletteDrop(
  detail: DwPaletteDropDetail,
  runtime: PlaybackRuntime,
): string | null {
  const item = detail.item as { type?: string } | null;
  if (!item?.type) return null;
  const nodeId = findNodeIdOnCanvasForPaletteType(item.type);
  if (!nodeId) return null;
  runtime.lastNodeId = nodeId;
  return nodeId;
}

function syncLastNodeFromResourceActivate(
  detail: DwResourceActivateDetail,
  runtime: PlaybackRuntime,
): void {
  const item = detail.item as { type?: string } | null;
  if (!item?.type) return;
  const nodeId = findNodeIdOnCanvasForPaletteType(item.type);
  if (nodeId) runtime.lastNodeId = nodeId;
}

function dispatchCanvasMove(detail: DwCanvasMoveDetail, runtime: PlaybackRuntime) {
  const id = resolveEffectiveNodeId(detail.id, runtime);
  const isZone = detail.itemType === ItemTypes.ZONE || detail.itemType === "zone";
  const patch = { x: detail.diagramX, y: detail.diagramY };
  if (isZone) {
    emitDwReplayDiagramChange({ op: "update-zone", zoneId: id, patch });
  } else {
    emitDwReplayDiagramChange({ op: "update-node", nodeId: id, patch });
  }
  runtime.lastNodeId = id;
}

function dispatchCanvasResize(detail: DwCanvasResizeDetail, runtime: PlaybackRuntime) {
  const id = resolveEffectiveNodeId(detail.id, runtime);
  const patch: Record<string, unknown> = {
    width: detail.width,
    height: detail.height,
  };
  if (detail.x !== undefined) patch.x = detail.x;
  if (detail.y !== undefined) patch.y = detail.y;
  if (detail.itemType === "zone") {
    emitDwReplayDiagramChange({ op: "update-zone", zoneId: id, patch });
  } else {
    emitDwReplayDiagramChange({ op: "update-node", nodeId: id, patch });
  }
  runtime.lastNodeId = id;
}

async function maybeWaitForSurfaceAfterAction(
  target: InteractionRecordingTarget | undefined,
  runtime: PlaybackRuntime,
) {
  if (!target?.recordingAction) return;
  if (
    target.recordingAction === "visual-styling" ||
    target.recordingAction === "icon-styling"
  ) {
    await waitForRecordingSurface(RECORDING_SURFACE_VISUAL_STYLING, 2500, runtime.signal);
  }
}

async function dispatchCustom(
  event: Extract<InteractionRecordingEvent, { kind: "custom" }>,
  ctx: ReplayPointContext,
  runtime: PlaybackRuntime,
) {
  const detail = event.detail as Record<string, unknown> | null;
  if (!detail) return;

  if (event.name === DW_CANVAS_TRANSFORM) {
    const transform = detail as unknown as InteractionRecordingCanvasTransform;
    ctx.activeTransform = { ...transform };
    applyCanvasTransform(transform);
    await waitForCanvasTransform(transform, 400, runtime.signal);
    return;
  }

  if (event.name === DW_OVERLAY_OPEN && typeof detail.surface === "string") {
    await waitForRecordingSurface(detail.surface, 2500, runtime.signal);
    return;
  }

  if (event.name === DW_CONTEXT_MENU_OPEN) {
    emitDwReplayContextMenuOpen(detail as unknown as DwContextMenuOpenDetail);
    await waitForRecordingSurface(RECORDING_SURFACE_CANVAS_CONTEXT_MENU, 600, runtime.signal);
    return;
  }

  if (event.name === DW_DIAGRAM_CHANGE) {
    const changeDetail = detail as unknown as DwDiagramChangeDetail;
    await showSemanticDragVisualForDiagramChange(changeDetail, event.t, ctx, runtime);
    emitDwReplayDiagramChange(changeDetail);
    emitDwReplayCloseOverlays();
    await waitReplayFrames(2);
    return;
  }

  if (event.name === DW_CONTEXT_MENU_ACTION) {
    const actionDetail = detail as unknown as DwContextMenuActionDetail;
    emitDwReplayContextMenuAction(actionDetail);
    const action = actionDetail.action;
    if (action === "visual-styling" || action === "icon-styling") {
      await waitForRecordingSurface(RECORDING_SURFACE_VISUAL_STYLING, 2500, runtime.signal);
    }
    return;
  }

  if (event.name === DW_SEARCH_MODAL_OPEN) {
    emitDwReplaySearchModalOpen(detail as unknown as DwSearchModalOpenDetail);
    await waitForRecordingSurface(RECORDING_SURFACE_SEARCH_RESOURCES, 2500, runtime.signal);
    return;
  }

  if (event.name === DW_SEARCH_MODAL_QUERY) {
    const q = detail as unknown as DwSearchModalQueryDetail;
    if (typeof q.query === "string") {
      emitDwReplaySearchModalQuery(q.query);
    }
    return;
  }

  if (event.name === DW_RESOURCE_ACTIVATE) {
    const activate = detail as unknown as DwResourceActivateDetail;
    if (activate?.item) {
      emitDwReplayResourceActivate(activate);
      emitDwReplaySearchModalClose();
      await waitReplayFrames();
      syncLastNodeFromResourceActivate(activate, runtime);
    }
    return;
  }

  if (event.name === DW_BATCH_SELECT) {
    const batch = detail as unknown as DwBatchSelectDetail;
    if (Array.isArray(batch.itemIds) && batch.itemIds.length > 0) {
      const itemIds = batch.itemIds.map((id) => runtime.nodeIdRemap.get(id) ?? id);
      emitDwReplayBatchSelect(itemIds);
    }
    return;
  }

  if (event.name === DW_OVERLAY_ACTION) {
    const actionDetail = detail as unknown as DwOverlayActionDetail;
    await replayOverlayAction(actionDetail, runtime.signal);
    if (actionDetail.kind === "patch" || actionDetail.kind === "set-property") {
      emitDwReplayCloseOverlays();
    }
    return;
  }

  if (event.name === DW_PALETTE_DROP || event.name === "mobileDrop") {
    dispatchPaletteDrop(detail as unknown as DwPaletteDropDetail, ctx);
    emitDwReplaySearchModalClose();
    await waitReplayFrames();
    const droppedNodeId = syncLastNodeFromPaletteDrop(
      detail as unknown as DwPaletteDropDetail,
      runtime,
    );
    if (droppedNodeId) {
      await ensureNodeSelectedForReplay(droppedNodeId, runtime);
    }
    return;
  }
  if (event.name === DW_CANVAS_MOVE) {
    await showCanvasMoveDragVisual(
      detail as unknown as DwCanvasMoveDetail,
      event.t,
      ctx,
      runtime,
    );
    dispatchCanvasMove(detail as unknown as DwCanvasMoveDetail, runtime);
    await waitReplayFrames(3);
    return;
  }
  if (event.name === DW_CANVAS_RESIZE) {
    const resizeDetail = detail as unknown as DwCanvasResizeDetail;
    await showCanvasResizeDragVisual(resizeDetail.id, event.t, ctx, runtime, {
      handle: resizeDetail.handle,
    });
    dispatchCanvasResize(resizeDetail, runtime);
    await waitReplayFrames(4);
    return;
  }
  if (event.name === "mobileMove") {
    const canvas = document.querySelector('[data-testid="editor-canvas"]');
    canvas?.dispatchEvent(new CustomEvent("mobileMove", { detail, bubbles: true }));
  }
}

async function dispatchRecordedEvent(
  event: InteractionRecordingEvent,
  ctx: ReplayPointContext,
  runtime: PlaybackRuntime,
): Promise<void> {
  switch (event.kind) {
    case "custom":
      await dispatchCustom(event, ctx, runtime);
      break;
    case "pointer":
      await dispatchPointer(event, ctx, runtime);
      break;
    case "click":
      await dispatchClick(event, ctx, runtime);
      break;
    case "wheel":
      await dispatchWheel(event, ctx, runtime);
      break;
    case "keydown":
    case "keyup":
      await dispatchKey(event, runtime);
      break;
    case "input":
      await dispatchInput(event, runtime.signal);
      break;
    case "change":
      dispatchChange(event);
      break;
    case "contextmenu":
      await dispatchContextMenu(event, ctx, runtime);
      break;
  }
}

export function playInteractionRecording(
  recording: InteractionRecording,
  options: InteractionRecordingPlaybackOptions = {},
): InteractionRecordingPlaybackHandle {
  const speed = Math.max(0.1, options.speed ?? 1);
  const controller = new PlaybackController();
  if (options.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  const events = recording.events;

  const promise = (async () => {
    document.body.dataset.dwPlayback = "active";
    const initialTransform = resolveRecordingStartTransform(recording);
    const ctx: ReplayPointContext = {
      activeTransform: { ...initialTransform },
      recordedTransform: { ...initialTransform },
      recordedViewport: {
        width: recording.viewport.width,
        height: recording.viewport.height,
      },
    };

    try {
      applyCanvasTransform(ctx.activeTransform);
      await waitForCanvasTransform(ctx.activeTransform, 600, controller.signal);

      const runtime: PlaybackRuntime = {
        holdShown: false,
        signal: controller.signal,
        nodeIdRemap: new Map(),
        sourceRecording: options.sourceRecording ?? recording,
        playbackSpeed: speed,
        playedVisualKeys: new Set(),
        playbackController: controller,
      };

      let prevT = 0;
      for (let i = 0; i < events.length; i++) {
        if (controller.signal.aborted) throw new DOMException("Playback aborted", "AbortError");
        await controller.waitWhilePaused();
        const ev = events[i]!;
        const delay = (ev.t - prevT) / speed;
        prevT = ev.t;
        await sleepPausable(delay, controller);
        options.onEvent?.(i + 1, events.length);
        await dispatchRecordedEvent(ev, ctx, runtime);
      }
    } finally {
      delete document.body.dataset.dwPlayback;
    }
  })();

  return {
    promise,
    abort: () => controller.abort(),
    pause: () => controller.pause(),
    resume: () => controller.resume(),
    isPaused: () => controller.isPaused(),
  };
}

export function recordingDurationMs(recording: InteractionRecording): number {
  const last = recording.events[recording.events.length - 1];
  return last?.t ?? 0;
}

export function formatRecordingDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  return s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

export function downloadInteractionRecording(recording: InteractionRecording, filename?: string): void {
  const safeTitle = (recording.title || "recording")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 64);
  const blob = new Blob([JSON.stringify(recording, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename ?? `${safeTitle || "recording"}.dwrec.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function parseInteractionRecordingFile(file: File): Promise<InteractionRecording> {
  const text = await file.text();
  const parsed = JSON.parse(text) as InteractionRecording;
  if (parsed.version !== 1 || !Array.isArray(parsed.events)) {
    throw new Error("Invalid interaction recording file");
  }
  return parsed;
}

export function summarizeRecordingEvents(recording: InteractionRecording): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const e of recording.events) {
    const key = e.kind === "custom" ? `custom:${e.name}` : e.kind;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

/** Skip redundant key events on text fields when `input` snapshots are present. */
export function optimizeRecordingForPlayback(recording: InteractionRecording): InteractionRecording {
  const hasTextInputEvents = recording.events.some((e) => e.kind === "input");
  if (!hasTextInputEvents) return recording;

  const events = recording.events.filter((e) => {
    if (e.kind !== "keydown" && e.kind !== "keyup") return true;
    if (e.target.tag !== "input" && e.target.tag !== "textarea") return true;
    return false;
  });
  return { ...recording, events };
}

/** De-dupe click events that immediately follow pointerup at the same coordinates. */
export function dedupePointerClicks(recording: InteractionRecording): InteractionRecording {
  const events: InteractionRecordingEvent[] = [];
  for (let i = 0; i < recording.events.length; i++) {
    const ev = recording.events[i]!;
    const prev = events[events.length - 1];
    if (
      ev.kind === "click" &&
      prev?.kind === "pointer" &&
      prev.phase === "up" &&
      prev.button === 0 &&
      Math.hypot(ev.x - prev.x, ev.y - prev.y) < 3
    ) {
      continue;
    }
    events.push(ev);
  }
  return { ...recording, events };
}

/** Drop DOM pointer/click on floating surfaces when a semantic action was recorded. */
export function stripSemanticOverlayDomEvents(
  recording: InteractionRecording,
): InteractionRecording {
  const markers = collectSemanticActionMarkers(recording);
  let contextMenuOpenAt: number | null = null;
  let resourceActivateAt: number | null = null;
  let paletteDropAt: number | null = null;
  let lastSearchQueryAt: number | null = null;

  for (const event of recording.events) {
    if (event.kind === "custom" && event.name === DW_CONTEXT_MENU_OPEN) {
      contextMenuOpenAt = event.t;
    }
    if (event.kind === "custom" && event.name === DW_RESOURCE_ACTIVATE) {
      resourceActivateAt = event.t;
    }
    if (event.kind === "custom" && event.name === DW_PALETTE_DROP) {
      paletteDropAt = event.t;
    }
    if (event.kind === "custom" && event.name === DW_SEARCH_MODAL_QUERY) {
      lastSearchQueryAt = event.t;
    }
  }

  if (
    markers.length === 0 &&
    contextMenuOpenAt == null &&
    resourceActivateAt == null &&
    paletteDropAt == null
  ) {
    return recording;
  }

  const events = recording.events.filter((event) => {
    if (
      event.kind === "contextmenu" &&
      contextMenuOpenAt != null &&
      Math.abs(event.t - contextMenuOpenAt) < 120
    ) {
      return false;
    }
    if (
      (event.kind === "pointer" || event.kind === "click") &&
      "target" in event &&
      event.target.recordingSurface === RECORDING_SURFACE_SEARCH_RESOURCES
    ) {
      if (
        resourceActivateAt != null &&
        Math.abs(event.t - resourceActivateAt) < 700
      ) {
        return false;
      }
      if (
        paletteDropAt != null &&
        Math.abs(event.t - paletteDropAt) < 900
      ) {
        return false;
      }
      if (
        lastSearchQueryAt != null &&
        paletteDropAt != null &&
        event.t > lastSearchQueryAt &&
        event.t < paletteDropAt + 50
      ) {
        return false;
      }
    }
    return !shouldStripSurfaceDomEvent(event, markers);
  });

  return { ...recording, events };
}

/** @deprecated Use stripSemanticOverlayDomEvents */
export function stripSemanticMenuDomEvents(recording: InteractionRecording): InteractionRecording {
  return stripSemanticOverlayDomEvents(recording);
}

function buildPaletteItemFromNodeId(
  nodeId: string,
  label: string,
): { type: string; label: string; provider: string; category: string } | null {
  const base = nodeId.replace(/-\d+$/, "");
  const parts = base.split("-");
  if (parts.length < 3) return null;
  const provider = parts[0]!;
  const category = parts[1]!;
  const type = `${provider}.${category}.${parts.slice(2).join("-")}`;
  return { type, label, provider, category };
}

/** Older recordings typed in search but only placed the icon via click — infer `dwResourceActivate`. */
function lastPointerDownBefore(
  recording: InteractionRecording,
  nodeId: string,
  upT: number,
): number | null {
  let lastDown: number | null = null;
  for (const ev of recording.events) {
    if (ev.t >= upT) break;
    if (
      ev.kind === "pointer" &&
      ev.phase === "down" &&
      "target" in ev &&
      ev.target.nodeId === nodeId &&
      !ev.target.handle
    ) {
      lastDown = ev.t;
    }
  }
  return lastDown;
}

/** Legacy fallback only — never treat pointer-up diagram coords as node top-left. */
export function injectMissingCanvasMovesFromPointerDrags(
  recording: InteractionRecording,
): InteractionRecording {
  return recording;
}

/** Drop canvas drag pointer replay when semantic move / position diagram change exists. */
export function stripCanvasDragPointerDomEvents(
  recording: InteractionRecording,
): InteractionRecording {
  const moveMarkers: Array<{ t: number; id: string }> = [];

  for (const ev of recording.events) {
    if (ev.kind === "custom" && ev.name === DW_CANVAS_MOVE) {
      const detail = ev.detail as DwCanvasMoveDetail | null;
      if (detail?.id) moveMarkers.push({ t: ev.t, id: detail.id });
    }
    if (ev.kind === "custom" && ev.name === DW_DIAGRAM_CHANGE) {
      const detail = ev.detail as DwDiagramChangeDetail | null;
      if (detail?.op === "update-node" && ("x" in detail.patch || "y" in detail.patch)) {
        moveMarkers.push({ t: ev.t, id: detail.nodeId });
      }
      if (detail?.op === "update-zone" && ("x" in detail.patch || "y" in detail.patch)) {
        moveMarkers.push({ t: ev.t, id: detail.zoneId });
      }
    }
  }
  if (moveMarkers.length === 0) return recording;

  const events = recording.events.filter((event) => {
    if (event.kind !== "pointer" && event.kind !== "click") return true;
    if (!("target" in event) || !event.target.nodeId || event.target.handle) return true;
    const nodeId = event.target.nodeId;
    for (const marker of moveMarkers) {
      if (marker.id !== nodeId) continue;
      const dragStart = lastPointerDownBefore(recording, nodeId, marker.t) ?? marker.t - 8000;
      if (event.t >= dragStart - 50 && event.t <= marker.t + 200) return false;
    }
    return true;
  });
  return { ...recording, events };
}

/** Prefer diagram position change over legacy `dwCanvasMove` when both were recorded together. */
export function dedupeCanvasMoveSemanticEvents(
  recording: InteractionRecording,
): InteractionRecording {
  const diagramMoveAt = new Set<number>();
  for (const ev of recording.events) {
    if (ev.kind !== "custom" || ev.name !== DW_DIAGRAM_CHANGE) continue;
    const detail = ev.detail as DwDiagramChangeDetail | null;
    if (!detail) continue;
    const isPosition =
      (detail.op === "update-node" || detail.op === "update-zone") &&
      ("x" in detail.patch || "y" in detail.patch);
    if (isPosition) diagramMoveAt.add(ev.t);
  }
  if (diagramMoveAt.size === 0) return recording;

  const events = recording.events.filter((event) => {
    if (event.kind !== "custom" || event.name !== DW_CANVAS_MOVE) return true;
    return ![...diagramMoveAt].some((t) => Math.abs(event.t - t) < 120);
  });
  return { ...recording, events };
}

/** Drop redundant resize handle pointer events when semantic resize / diagram geometry change exists. */
export function stripResizePointerDomEvents(
  recording: InteractionRecording,
): InteractionRecording {
  const resizeMarkers: Array<{ t: number; id: string }> = [];
  for (const ev of recording.events) {
    if (ev.kind === "custom" && ev.name === DW_CANVAS_RESIZE) {
      const detail = ev.detail as DwCanvasResizeDetail | null;
      if (detail?.id) resizeMarkers.push({ t: ev.t, id: detail.id });
    }
    if (ev.kind === "custom" && ev.name === DW_DIAGRAM_CHANGE) {
      const detail = ev.detail as DwDiagramChangeDetail | null;
      if (detail?.op === "update-node" && ("width" in detail.patch || "height" in detail.patch)) {
        resizeMarkers.push({ t: ev.t, id: detail.nodeId });
      }
      if (detail?.op === "update-zone" && ("width" in detail.patch || "height" in detail.patch)) {
        resizeMarkers.push({ t: ev.t, id: detail.zoneId });
      }
    }
  }
  if (resizeMarkers.length === 0) return recording;

  const events = recording.events.filter((event) => {
    if (event.kind !== "pointer" && event.kind !== "click") return true;
    if (!("target" in event) || !event.target.handle || !event.target.nodeId) return true;
    const nodeId = event.target.nodeId;
    for (const marker of resizeMarkers) {
      if (marker.id !== nodeId) continue;
      if (event.t >= marker.t - 8000 && event.t <= marker.t + 200) return false;
    }
    return true;
  });
  return { ...recording, events };
}

/** Prefer diagram geometry change over legacy `dwCanvasResize` when both were recorded together. */
export function dedupeResizeSemanticEvents(
  recording: InteractionRecording,
): InteractionRecording {
  const diagramResizeAt = new Set<number>();
  for (const ev of recording.events) {
    if (ev.kind !== "custom" || ev.name !== DW_DIAGRAM_CHANGE) continue;
    const detail = ev.detail as DwDiagramChangeDetail | null;
    if (!detail) continue;
    const isGeometry =
      (detail.op === "update-node" || detail.op === "update-zone") &&
      ("width" in detail.patch || "height" in detail.patch);
    if (isGeometry) diagramResizeAt.add(ev.t);
  }
  if (diagramResizeAt.size === 0) return recording;

  const events = recording.events.filter((event) => {
    if (event.kind !== "custom" || event.name !== DW_CANVAS_RESIZE) return true;
    return ![...diagramResizeAt].some((t) => Math.abs(event.t - t) < 120);
  });
  return { ...recording, events };
}

export function injectMissingSearchResourceActivations(
  recording: InteractionRecording,
): InteractionRecording {
  if (
    recording.events.some((e) => e.kind === "custom" && e.name === DW_RESOURCE_ACTIVATE)
  ) {
    return recording;
  }

  const openEv = recording.events.find(
    (e) => e.kind === "custom" && e.name === DW_SEARCH_MODAL_OPEN,
  );
  const queryEvs = recording.events.filter(
    (e) => e.kind === "custom" && e.name === DW_SEARCH_MODAL_QUERY,
  );
  if (!openEv || queryEvs.length === 0) return recording;

  const lastQuery = queryEvs[queryEvs.length - 1]!;
  let pickT: number | null = null;
  let nodeId: string | null = null;
  let label: string | null = null;

  for (const e of recording.events) {
    if (e.t <= lastQuery.t) continue;
    if ("target" in e && e.target?.nodeId?.match(/-\d+$/)) {
      pickT = e.t;
      nodeId = e.target.nodeId;
      label = e.target.name ?? e.target.paletteLabel ?? null;
      break;
    }
    if (e.kind === "custom" && e.name === DW_CANVAS_MOVE) {
      const move = e.detail as { id?: string } | null;
      if (move?.id?.match(/-\d+$/)) {
        pickT = e.t;
        nodeId = move.id;
        break;
      }
    }
  }

  if (!pickT || !nodeId) return recording;
  const item = buildPaletteItemFromNodeId(nodeId, label ?? nodeId);
  if (!item) return recording;

  if (openEv.kind !== "custom") return recording;
  const openDetail = openEv.detail as DwSearchModalOpenDetail;
  const activateEv: InteractionRecordingEvent = {
    t: lastQuery.t + 80,
    kind: "custom",
    name: DW_RESOURCE_ACTIVATE,
    detail: {
      item,
      provider: item.provider,
      category: item.category,
      diagramX: openDetail.diagramX,
      diagramY: openDetail.diagramY,
      resourceLabel: label ?? undefined,
    } satisfies DwResourceActivateDetail,
  };

  const events = [...recording.events, activateEv].sort((a, b) => a.t - b.t);
  return { ...recording, events };
}

export function ensureStartTransformEvent(
  recording: InteractionRecording,
): InteractionRecording {
  const start = resolveRecordingStartTransform(recording);
  const hasTransformAtStart = recording.events.some(
    (event) =>
      event.kind === "custom" &&
      event.name === DW_CANVAS_TRANSFORM &&
      event.t <= 2 &&
      transformsEqual(event.detail as InteractionRecordingCanvasTransform, start, 0.5),
  );
  if (hasTransformAtStart) return recording;
  return {
    ...recording,
    canvasTransform: start,
    events: [
      { t: 0, kind: "custom", name: DW_CANVAS_TRANSFORM, detail: start },
      ...recording.events,
    ],
  };
}

export function prepareRecordingForPlayback(recording: InteractionRecording): InteractionRecording {
  return annotateCosmeticMenuActions(
    stripSemanticOverlayDomEvents(
      dedupeCanvasMoveSemanticEvents(
        dedupeResizeSemanticEvents(
          stripCanvasDragPointerDomEvents(
            stripResizePointerDomEvents(
              dedupePointerClicks(
                optimizeRecordingForPlayback(
                  injectMissingCanvasMovesFromPointerDrags(
                    injectMissingSearchResourceActivations(ensureStartTransformEvent(recording)),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}
