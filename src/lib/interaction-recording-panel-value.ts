/** Record / apply panel value changes (color, slider, select) without screen coordinates. */

import {
  emitDwOverlayAction,
  type DwOverlayActionDetail,
} from "@/lib/interaction-recording-bridge";
import { slugifyRecordingAction } from "@/lib/interaction-recording-surfaces";

export function isInteractionRecordingCaptureActive(): boolean {
  return (
    typeof document !== "undefined" &&
    document.body.dataset.dwRecording === "active" &&
    document.body.dataset.dwPlayback !== "active"
  );
}

function cloneRecordedValue<T>(value: T): T {
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return value;
  }
}

export function recordOverlayPropertyChange(
  surface: string,
  property: string,
  value: unknown,
  action?: string,
): void {
  if (!isInteractionRecordingCaptureActive()) return;
  emitDwOverlayAction({
    surface,
    kind: "set-property",
    action: action ?? property,
    property,
    value: cloneRecordedValue(value),
  });
}

export function recordOverlayPatch(
  surface: string,
  patch: Record<string, unknown>,
  action?: string,
): void {
  if (!isInteractionRecordingCaptureActive()) return;
  const keys = Object.keys(patch);
  if (keys.length === 0) return;
  emitDwOverlayAction({
    surface,
    kind: "patch",
    action: action ?? slugifyRecordingAction(keys.join("-")),
    patch: cloneRecordedValue(patch),
  });
}

/** Apply a replayed overlay value event to a panel change handler. */
export function applyReplayedOverlayValue(
  detail: DwOverlayActionDetail,
  onPatch: (patch: Record<string, unknown>) => void,
): boolean {
  if (detail.kind === "patch" && detail.patch && Object.keys(detail.patch).length > 0) {
    onPatch(detail.patch);
    return true;
  }
  if (detail.kind === "set-property" && detail.property !== undefined) {
    onPatch({ [detail.property]: detail.value });
    return true;
  }
  return false;
}
