import type {
  InteractionRecording,
  InteractionRecordingEvent,
  InteractionRecordingModifiers,
  InteractionRecordingTarget,
} from "@/lib/interaction-recording-types";
import {
  DW_BATCH_SELECT,
  DW_CANVAS_MOVE,
  DW_CANVAS_TRANSFORM,
  DW_CONTEXT_MENU_ACTION,
  DW_CONTEXT_MENU_OPEN,
  DW_OVERLAY_ACTION,
  DW_OVERLAY_OPEN,
  DW_PALETTE_DROP,
  DW_SEARCH_MODAL_OPEN,
  DW_SEARCH_MODAL_QUERY,
  DW_RESOURCE_ACTIVATE,
  emitDwReplayBatchSelect,
  emitDwReplayCanvasTransform,
  emitDwReplayCanvasMove,
  emitDwReplayClipboardCopy,
  emitDwReplayClipboardPaste,
  emitDwReplayContextMenuAction,
  emitDwReplayContextMenuOpen,
  emitDwReplaySearchModalOpen,
  emitDwReplaySearchModalQuery,
  emitDwReplayResourceActivate,
  emitDwReplaySearchModalClose,
  emitDwReplaySelectNode,
  emitPlaybackCursor,
  type DwBatchSelectDetail,
  type DwCanvasMoveDetail,
  type DwContextMenuActionDetail,
  type DwContextMenuOpenDetail,
  type DwOverlayActionDetail,
  type DwPaletteDropDetail,
  type DwSearchModalOpenDetail,
  type DwSearchModalQueryDetail,
  type DwResourceActivateDetail,
} from "@/lib/interaction-recording-bridge";
import { ItemTypes } from "@/components/editor/draggable-item";
import {
  focusInteractionTarget,
  isEditableElement,
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

interface PlaybackRuntime {
  pointerDown?: { button: number };
  holdShown: boolean;
  signal?: AbortSignal;
  lastNodeId?: string;
  nodeIdRemap: Map<string, string>;
}

export interface InteractionRecordingPlaybackOptions {
  speed?: number;
  onEvent?: (index: number, total: number) => void;
  signal?: AbortSignal;
}

export interface InteractionRecordingPlaybackHandle {
  promise: Promise<void>;
  abort: () => void;
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

/** Prefer surface/action targets, then coordinate hit-testing. */
function resolveAtCoordinates(
  event: InteractionRecordingEvent,
  x: number,
  y: number,
): Element | null {
  if ("target" in event && isTargetInRecordingSurface(event.target)) {
    const surfaceEl = resolveInteractionTargetForEvent(event.target, x, y);
    if (surfaceEl instanceof Element) return surfaceEl;
  }
  const atPoint =
    typeof document !== "undefined" && Number.isFinite(x) && Number.isFinite(y)
      ? document.elementFromPoint(x, y)
      : null;
  if (atPoint instanceof Element) return atPoint;
  if ("target" in event) {
    return resolveInteractionTargetForEvent(event.target, x, y);
  }
  return null;
}

function resolveEventPoint(
  event: InteractionRecordingEvent & {
    x: number;
    y: number;
    diagram?: { x: number; y: number };
    canvasTransform?: InteractionRecordingCanvasTransform;
  },
  ctx: ReplayPointContext,
): { x: number; y: number } {
  if ("target" in event && isTargetInRecordingSurface(event.target)) {
    const el = resolveInteractionTargetForEvent(event.target, event.x, event.y);
    if (el instanceof Element) return centerOfElement(el);
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

function showPlaybackCursor(
  x: number,
  y: number,
  kind: "left-down" | "left-up" | "right-down" | "right-up" | "hold-start" | "hold-end",
) {
  emitPlaybackCursor({ x, y, kind });
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
): Element | null {
  if ("target" in event && event.target && isTargetInRecordingSurface(event.target)) {
    const surfaceEl = resolveRecordingSurfaceTarget(event.target);
    if (surfaceEl instanceof Element) return surfaceEl;
  }
  return resolveAtCoordinates(event, point.x, point.y);
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
  const point = resolveEventPoint(event, ctx);
  const el = resolveAtCoordinates(event, point.x, point.y);
  if (!(el instanceof Element)) return;

  if (event.phase === "down") {
    runtime.pointerDown = { button: event.button };
    runtime.holdShown = false;
    if (event.target?.nodeId) {
      runtime.lastNodeId =
        runtime.nodeIdRemap.get(event.target.nodeId) ?? event.target.nodeId;
    }
    showPlaybackCursor(point.x, point.y, event.button === 2 ? "right-down" : "left-down");
  } else if (event.phase === "move" && runtime.pointerDown && !runtime.holdShown) {
    runtime.holdShown = true;
    showPlaybackCursor(point.x, point.y, "hold-start");
  } else if (event.phase === "up" || event.phase === "cancel") {
    if (runtime.holdShown) showPlaybackCursor(point.x, point.y, "hold-end");
    showPlaybackCursor(point.x, point.y, event.button === 2 ? "right-up" : "left-up");
    runtime.pointerDown = undefined;
    runtime.holdShown = false;
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
        clientX: point.x,
        clientY: point.y,
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
      point.x,
      point.y,
      el,
      event.modifiers,
      event.button,
      event.buttons,
    );
  }

  if (event.phase === "up" && event.button === 0) {
    const clickTarget = resolveClickTarget(event, point) ?? el;
    if (useNativeClick) {
      activateElementClick(clickTarget);
    } else {
      const mods = modifierInit(event.modifiers);
      clickTarget.dispatchEvent(
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
    await maybeWaitForSurfaceAfterAction(event.target, runtime);
  }
}

async function dispatchClick(
  event: Extract<InteractionRecordingEvent, { kind: "click" }>,
  ctx: ReplayPointContext,
  runtime: PlaybackRuntime,
) {
  await syncCanvasTransformForEvent(event, ctx, runtime);
  const point = resolveEventPoint(event, ctx);
  const el = resolveClickTarget(event, point);
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
  const el = resolveAtCoordinates(event, point.x, point.y);
  if (!(el instanceof Element)) return;
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

async function waitReplayFrames(count = 2): Promise<void> {
  for (let i = 0; i < count; i++) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
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
        emitDwReplayClipboardCopy();
        return;
      }
      if (event.key === "v") {
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
  const el = resolveAtCoordinates(event, point.x, point.y);
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
): void {
  const item = detail.item as { type?: string } | null;
  if (!item?.type) return;
  const nodeId = findNodeIdOnCanvasForPaletteType(item.type);
  if (nodeId) runtime.lastNodeId = nodeId;
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
  const id = runtime.nodeIdRemap.get(detail.id) ?? detail.id;
  emitDwReplayCanvasMove({
    id,
    itemType: detail.itemType,
    diagramX: detail.diagramX,
    diagramY: detail.diagramY,
  });
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
    await waitForRecordingSurface(RECORDING_SURFACE_CANVAS_CONTEXT_MENU, 2000, runtime.signal);
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
    return;
  }

  if (event.name === DW_PALETTE_DROP || event.name === "mobileDrop") {
    dispatchPaletteDrop(detail as unknown as DwPaletteDropDetail, ctx);
    emitDwReplaySearchModalClose();
    await waitReplayFrames();
    syncLastNodeFromPaletteDrop(detail as unknown as DwPaletteDropDetail, runtime);
    return;
  }
  if (event.name === DW_CANVAS_MOVE) {
    dispatchCanvasMove(detail as unknown as DwCanvasMoveDetail, runtime);
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
  const controller = new AbortController();
  const signal = options.signal ?? controller.signal;
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
      await waitForCanvasTransform(ctx.activeTransform, 600, signal);

      const runtime: PlaybackRuntime = { holdShown: false, signal, nodeIdRemap: new Map() };

      let prevT = 0;
      for (let i = 0; i < events.length; i++) {
        if (signal.aborted) throw new DOMException("Playback aborted", "AbortError");
        const ev = events[i]!;
        const delay = (ev.t - prevT) / speed;
        prevT = ev.t;
        await sleep(delay, signal);
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
/** Drags that end without react-dnd `dwCanvasMove` still leave pointer-up diagram coords — infer moves. */
export function injectMissingCanvasMovesFromPointerDrags(
  recording: InteractionRecording,
): InteractionRecording {
  const injected: InteractionRecordingEvent[] = [];

  for (const event of recording.events) {
    if (event.kind !== "pointer" || event.phase !== "up") continue;
    if (!("target" in event) || !event.target.nodeId || !event.diagram) continue;

    const nodeId = event.target.nodeId;
    const hasNearbyMove = recording.events.some(
      (ev) =>
        ev.kind === "custom" &&
        ev.name === DW_CANVAS_MOVE &&
        (ev.detail as DwCanvasMoveDetail | null)?.id === nodeId &&
        Math.abs(ev.t - event.t) < 500,
    );
    if (hasNearbyMove) continue;

    const duplicateInject = injected.some(
      (ev) =>
        ev.kind === "custom" &&
        ev.name === DW_CANVAS_MOVE &&
        (ev.detail as DwCanvasMoveDetail).id === nodeId &&
        Math.abs(ev.t - event.t) < 800,
    );
    if (duplicateInject) continue;

    injected.push({
      t: event.t + 30,
      kind: "custom",
      name: DW_CANVAS_MOVE,
      detail: {
        id: nodeId,
        itemType: "canvas_node",
        diagramX: event.diagram.x,
        diagramY: event.diagram.y,
      } satisfies DwCanvasMoveDetail,
    });
  }

  if (injected.length === 0) return recording;
  const events = [...recording.events, ...injected].sort((a, b) => a.t - b.t);
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
  return stripSemanticOverlayDomEvents(
    dedupePointerClicks(
      optimizeRecordingForPlayback(
        injectMissingCanvasMovesFromPointerDrags(
          injectMissingSearchResourceActivations(ensureStartTransformEvent(recording)),
        ),
      ),
    ),
  );
}
