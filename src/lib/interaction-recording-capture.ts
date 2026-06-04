import type {
  InteractionRecording,
  InteractionRecordingEvent,
  InteractionRecordingCanvasTransform,
} from "@/lib/interaction-recording-types";
import {
  INTERACTION_RECORDING_VERSION,
  RECORDER_START_KEY,
  RECORDER_STOP_KEY,
} from "@/lib/interaction-recording-types";
import { describeInteractionTarget } from "@/lib/interaction-recording-target";
import { DW_CANVAS_MOVE, DW_CANVAS_TRANSFORM, DW_PALETTE_DROP, DW_OVERLAY_OPEN, DW_OVERLAY_CLOSE, DW_OVERLAY_ACTION, DW_CONTEXT_MENU_OPEN, DW_CONTEXT_MENU_ACTION, resetCanvasTransformEmitCache } from "@/lib/interaction-recording-bridge";
import {
  clientToDiagram,
  isClientPointOverCanvas,
  readLiveCanvasTransform,
} from "@/lib/interaction-recording-transform";

const MOVE_MIN_PX = 2;
const MOVE_MIN_MS = 33;

const RECORDED_CUSTOM_EVENTS = new Set([
  "mobileDrop",
  "mobileMove",
  DW_PALETTE_DROP,
  DW_CANVAS_MOVE,
  DW_CANVAS_TRANSFORM,
  DW_OVERLAY_OPEN,
  DW_OVERLAY_CLOSE,
  DW_OVERLAY_ACTION,
  DW_CONTEXT_MENU_OPEN,
  DW_CONTEXT_MENU_ACTION,
]);

function readModifiers(e: KeyboardEvent | MouseEvent | WheelEvent) {
  return {
    alt: e.altKey,
    ctrl: e.ctrlKey,
    meta: e.metaKey,
    shift: e.shiftKey,
  };
}

function diagramAtClient(clientX: number, clientY: number) {
  if (!isClientPointOverCanvas(clientX, clientY)) return undefined;
  const transform = readLiveCanvasTransform();
  const diagram = clientToDiagram(clientX, clientY, transform);
  return diagram ?? undefined;
}

function canvasTransformAtEvent(): InteractionRecordingCanvasTransform {
  return readLiveCanvasTransform();
}

export interface InteractionRecordingCaptureSession {
  stop: () => InteractionRecording;
  getEventCount: () => number;
}

export function startInteractionRecordingCapture(): InteractionRecordingCaptureSession {
  const startedAt = performance.now();
  const events: InteractionRecordingEvent[] = [];
  const canvasTransform = readLiveCanvasTransform();
  let lastMove: { x: number; y: number; t: number } | null = null;

  const relT = () => Math.round(performance.now() - startedAt);

  const push = (event: InteractionRecordingEvent) => {
    events.push(event);
  };

  const recordPointer = (phase: "down" | "move" | "up" | "cancel", e: PointerEvent) => {
    if (phase === "move") {
      const t = relT();
      if (
        lastMove &&
        Math.hypot(e.clientX - lastMove.x, e.clientY - lastMove.y) < MOVE_MIN_PX &&
        t - lastMove.t < MOVE_MIN_MS
      ) {
        return;
      }
      lastMove = { x: e.clientX, y: e.clientY, t };
      push({
        t,
        kind: "pointer",
        phase,
        x: e.clientX,
        y: e.clientY,
        button: e.button,
        buttons: e.buttons,
        pointerId: e.pointerId,
        pointerType: e.pointerType,
        modifiers: readModifiers(e),
        target: describeInteractionTarget(e.target),
        diagram: diagramAtClient(e.clientX, e.clientY),
        canvasTransform: canvasTransformAtEvent(),
      });
      return;
    }

    push({
      t: relT(),
      kind: "pointer",
      phase,
      x: e.clientX,
      y: e.clientY,
      button: e.button,
      buttons: e.buttons,
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      modifiers: readModifiers(e),
      target: describeInteractionTarget(e.target),
      diagram: diagramAtClient(e.clientX, e.clientY),
      canvasTransform: canvasTransformAtEvent(),
    });
  };

  const onPointerDown = (e: PointerEvent) => recordPointer("down", e);
  const onPointerMove = (e: PointerEvent) => recordPointer("move", e);
  const onPointerUp = (e: PointerEvent) => recordPointer("up", e);
  const onPointerCancel = (e: PointerEvent) => recordPointer("cancel", e);

  const onWheel = (e: WheelEvent) => {
    push({
      t: relT(),
      kind: "wheel",
      x: e.clientX,
      y: e.clientY,
      deltaX: e.deltaX,
      deltaY: e.deltaY,
      deltaZ: e.deltaZ,
      deltaMode: e.deltaMode,
      modifiers: readModifiers(e),
      target: describeInteractionTarget(e.target),
      diagram: diagramAtClient(e.clientX, e.clientY),
      canvasTransform: canvasTransformAtEvent(),
    });
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === RECORDER_START_KEY || e.key === RECORDER_STOP_KEY) return;
    push({
      t: relT(),
      kind: "keydown",
      key: e.key,
      code: e.code,
      modifiers: readModifiers(e),
      target: describeInteractionTarget(e.target),
    });
  };

  const onKeyUp = (e: KeyboardEvent) => {
    if (e.key === RECORDER_START_KEY || e.key === RECORDER_STOP_KEY) return;
    push({
      t: relT(),
      kind: "keyup",
      key: e.key,
      code: e.code,
      modifiers: readModifiers(e),
      target: describeInteractionTarget(e.target),
    });
  };

  const onInput = (e: Event) => {
    const target = e.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
    push({
      t: relT(),
      kind: "input",
      value: target.value,
      inputType: e instanceof InputEvent ? e.inputType : undefined,
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      target: describeInteractionTarget(target),
    });
  };

  const onChange = (e: Event) => {
    const target = e.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) {
      return;
    }
    push({
      t: relT(),
      kind: "change",
      value: target.value,
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      target: describeInteractionTarget(target),
    });
  };

  const onClick = (e: MouseEvent) => {
    if (e.button !== 0) return;
    push({
      t: relT(),
      kind: "click",
      x: e.clientX,
      y: e.clientY,
      button: e.button,
      modifiers: readModifiers(e),
      target: describeInteractionTarget(e.target),
      diagram: diagramAtClient(e.clientX, e.clientY),
      canvasTransform: canvasTransformAtEvent(),
    });
  };

  const onContextMenu = (e: MouseEvent) => {
    push({
      t: relT(),
      kind: "contextmenu",
      x: e.clientX,
      y: e.clientY,
      modifiers: readModifiers(e),
      target: describeInteractionTarget(e.target),
      diagram: diagramAtClient(e.clientX, e.clientY),
      canvasTransform: canvasTransformAtEvent(),
    });
  };

  const onCustom = (e: Event) => {
    if (!(e instanceof CustomEvent)) return;
    if (!RECORDED_CUSTOM_EVENTS.has(e.type)) return;
    push({
      t: relT(),
      kind: "custom",
      name: e.type,
      detail: e.detail ?? null,
    });
  };

  const passive: AddEventListenerOptions = { capture: true, passive: true };
  const active: AddEventListenerOptions = { capture: true };

  window.addEventListener("pointerdown", onPointerDown, active);
  window.addEventListener("pointermove", onPointerMove, passive);
  window.addEventListener("pointerup", onPointerUp, active);
  window.addEventListener("pointercancel", onPointerCancel, active);
  window.addEventListener("wheel", onWheel, passive);
  window.addEventListener("keydown", onKeyDown, active);
  window.addEventListener("keyup", onKeyUp, active);
  window.addEventListener("input", onInput, active);
  window.addEventListener("change", onChange, active);
  window.addEventListener("click", onClick, active);
  window.addEventListener("contextmenu", onContextMenu, active);
  document.addEventListener("mobileDrop", onCustom, active);
  document.addEventListener("mobileMove", onCustom, active);
  document.addEventListener(DW_PALETTE_DROP, onCustom, active);
  document.addEventListener(DW_CANVAS_MOVE, onCustom, active);
  document.addEventListener(DW_CANVAS_TRANSFORM, onCustom, active);
  document.addEventListener(DW_OVERLAY_OPEN, onCustom, active);
  document.addEventListener(DW_OVERLAY_CLOSE, onCustom, active);
  document.addEventListener(DW_OVERLAY_ACTION, onCustom, active);
  document.addEventListener(DW_CONTEXT_MENU_OPEN, onCustom, active);
  document.addEventListener(DW_CONTEXT_MENU_ACTION, onCustom, active);

  document.body.dataset.dwRecording = "active";
  resetCanvasTransformEmitCache();

  return {
    getEventCount: () => events.length,
    stop() {
      window.removeEventListener("pointerdown", onPointerDown, active);
      window.removeEventListener("pointermove", onPointerMove, passive);
      window.removeEventListener("pointerup", onPointerUp, active);
      window.removeEventListener("pointercancel", onPointerCancel, active);
      window.removeEventListener("wheel", onWheel, passive);
      window.removeEventListener("keydown", onKeyDown, active);
      window.removeEventListener("keyup", onKeyUp, active);
      window.removeEventListener("input", onInput, active);
      window.removeEventListener("change", onChange, active);
      window.removeEventListener("click", onClick, active);
      window.removeEventListener("contextmenu", onContextMenu, active);
      document.removeEventListener("mobileDrop", onCustom, active);
      document.removeEventListener("mobileMove", onCustom, active);
      document.removeEventListener(DW_PALETTE_DROP, onCustom, active);
      document.removeEventListener(DW_CANVAS_MOVE, onCustom, active);
      document.removeEventListener(DW_CANVAS_TRANSFORM, onCustom, active);
      document.removeEventListener(DW_OVERLAY_OPEN, onCustom, active);
      document.removeEventListener(DW_OVERLAY_CLOSE, onCustom, active);
      document.removeEventListener(DW_OVERLAY_ACTION, onCustom, active);
      document.removeEventListener(DW_CONTEXT_MENU_OPEN, onCustom, active);
      document.removeEventListener(DW_CONTEXT_MENU_ACTION, onCustom, active);
      delete document.body.dataset.dwRecording;

      return {
        version: INTERACTION_RECORDING_VERSION,
        title: "",
        recordedAt: new Date().toISOString(),
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          devicePixelRatio: window.devicePixelRatio || 1,
        },
        canvasTransform,
        canvasTransformEnd: readLiveCanvasTransform(),
        events,
      };
    },
  };
}
