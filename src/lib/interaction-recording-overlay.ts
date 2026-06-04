/**
 * Semantic overlay actions — floating menus/panels replay by intent, not screen coords.
 */

import {
  DW_CONTEXT_MENU_ACTION,
  DW_CONTEXT_MENU_OPEN,
  DW_OVERLAY_ACTION,
  DW_OVERLAY_OPEN,
  emitDwOverlayAction,
  emitDwReplayOverlayAction,
  type DwContextMenuActionDetail,
  type DwContextMenuOpenDetail,
  type DwOverlayActionDetail,
  type DwOverlayActionKind,
} from "@/lib/interaction-recording-bridge";
import type { InteractionRecording, InteractionRecordingEvent } from "@/lib/interaction-recording-types";
import {
  queryRecordingSurface,
  readRecordingActionFromElement,
  readRecordingSurfaceFromElement,
  RECORDING_SURFACE_CANVAS_CONTEXT_MENU,
  resolveRecordingSurfaceTarget,
  slugifyRecordingAction,
  waitForRecordingSurface,
} from "@/lib/interaction-recording-surfaces";

const INTERACTIVE_SELECTOR =
  'button, [role="button"], [role="combobox"], [role="switch"], [role="option"], [role="menuitem"], [role="tab"], [data-dw-recording-action]';

function labelNearControl(el: Element): string | undefined {
  const field = el.closest("[class*='space-y']") ?? el.parentElement?.parentElement;
  const label = field?.querySelector("label");
  const text = label?.textContent?.replace(/\s+/g, " ").trim();
  return text || undefined;
}

/** Stable action id for a control inside a recording surface. */
export function resolveActionIdFromElement(el: Element | null): string | undefined {
  if (!el) return undefined;
  const explicit = el.getAttribute("data-dw-recording-action");
  if (explicit) return explicit;

  const fromReader = readRecordingActionFromElement(el);
  if (fromReader) return fromReader;

  const fieldLabel = labelNearControl(el);
  const controlText =
    el.getAttribute("aria-label") ??
    el.textContent?.replace(/\s+/g, " ").trim() ??
    el.getAttribute("value") ??
    "";
  const parts = [fieldLabel, controlText].filter(Boolean).join(" ");
  return parts ? slugifyRecordingAction(parts) : undefined;
}

export function captureOverlayActionFromClick(
  event: { target: EventTarget | null; currentTarget: EventTarget | null },
  surfaceId: string,
): void {
  const root = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
  if (!root) return;
  const hit = (event.target instanceof Element ? event.target : null)?.closest(INTERACTIVE_SELECTOR);
  if (!(hit instanceof Element) || !root.contains(hit)) return;

  const action = resolveActionIdFromElement(hit);
  if (!action) return;

  emitDwOverlayAction({
    surface: surfaceId,
    kind: "click",
    action,
    role: hit.getAttribute("role") ?? undefined,
    tag: hit.tagName.toLowerCase(),
  });
}

function activateElementClick(el: Element): void {
  if (el instanceof HTMLElement && typeof el.click === "function") {
    el.click();
    return;
  }
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
}

function resolveOptionGlobally(action: string): Element | null {
  for (const option of document.querySelectorAll('[role="option"]')) {
    if (resolveActionIdFromElement(option) === action) return option;
  }
  return null;
}

export async function replayOverlayAction(
  detail: DwOverlayActionDetail,
  signal?: AbortSignal,
): Promise<boolean> {
  if (!detail.surface || !detail.action) return false;

  const kind: DwOverlayActionKind = detail.kind ?? "click";

  if (kind === "set-property" || kind === "patch") {
    await waitForRecordingSurface(detail.surface, 2500, signal);
    emitDwReplayOverlayAction(detail);
    return true;
  }

  await waitForRecordingSurface(detail.surface, 2500, signal);

  let el = resolveRecordingSurfaceTarget({
    recordingSurface: detail.surface,
    recordingAction: detail.action,
  });

  if (!(el instanceof Element) && detail.role === "option") {
    el = resolveOptionGlobally(detail.action);
  }

  if (!(el instanceof Element)) {
    el = resolveOptionGlobally(detail.action);
  }

  if (!(el instanceof Element)) return false;

  const role = el.getAttribute("role");
  if (role === "option") {
    const listbox = el.closest('[role="listbox"]');
    if (!listbox || listbox.getAttribute("data-state") === "closed") {
      const scope = queryRecordingSurface(detail.surface);
      const trigger = scope?.querySelector('[role="combobox"]');
      if (trigger instanceof Element) {
        activateElementClick(trigger);
        await new Promise((r) => window.setTimeout(r, 96));
        el =
          resolveRecordingSurfaceTarget({
            recordingSurface: detail.surface,
            recordingAction: detail.action,
          }) ?? resolveOptionGlobally(detail.action);
      }
    }
  }

  if (el instanceof Element) {
    activateElementClick(el);
    return true;
  }
  return false;
}

export interface SemanticActionMarker {
  t: number;
  surface: string;
  action: string;
  kind?: DwOverlayActionKind;
}

export function collectSemanticActionMarkers(recording: InteractionRecording): SemanticActionMarker[] {
  const markers: SemanticActionMarker[] = [];
  for (const event of recording.events) {
    if (event.kind !== "custom") continue;
    if (event.name === DW_OVERLAY_ACTION) {
      const detail = event.detail as DwOverlayActionDetail | null;
      if (detail?.surface && detail.action) {
        markers.push({
          t: event.t,
          surface: detail.surface,
          action: detail.action,
          kind: detail.kind ?? "click",
        });
      }
    }
    if (event.name === DW_CONTEXT_MENU_ACTION) {
      const detail = event.detail as DwContextMenuActionDetail | null;
      if (detail?.action) {
        markers.push({
          t: event.t,
          surface: RECORDING_SURFACE_CANVAS_CONTEXT_MENU,
          action: detail.action,
        });
      }
    }
  }
  return markers;
}

export function shouldStripSurfaceDomEvent(
  event: InteractionRecordingEvent,
  markers: SemanticActionMarker[],
): boolean {
  if (event.kind !== "pointer" && event.kind !== "click") return false;
  if (!("target" in event)) return false;
  const { recordingSurface, recordingAction } = event.target;
  if (!recordingSurface) return false;

  for (const marker of markers) {
    if (marker.surface !== recordingSurface) continue;
    if (marker.kind === "set-property" || marker.kind === "patch") {
      if (Math.abs(event.t - marker.t) < 400) return true;
      continue;
    }
    if (recordingAction && marker.action !== recordingAction) continue;
    if (Math.abs(event.t - marker.t) < 220) return true;
  }
  return false;
}

export interface SemanticRecordingSummaryLine {
  t: number;
  label: string;
}

export function summarizeSemanticRecordingTimeline(
  recording: InteractionRecording,
  limit = 24,
): SemanticRecordingSummaryLine[] {
  const lines: SemanticRecordingSummaryLine[] = [];

  for (const event of recording.events) {
    if (event.kind === "custom" && event.name === DW_OVERLAY_OPEN) {
      const detail = event.detail as { surface?: string } | null;
      if (detail?.surface) {
        lines.push({ t: event.t, label: `Open ${detail.surface}` });
      }
    }
    if (event.kind === "custom" && event.name === DW_CONTEXT_MENU_OPEN) {
      const detail = event.detail as DwContextMenuOpenDetail | null;
      lines.push({
        t: event.t,
        label: `Context menu${detail?.itemId ? ` (${detail.itemId.slice(0, 8)}…)` : ""}`,
      });
    }
    if (event.kind === "custom" && event.name === DW_OVERLAY_ACTION) {
      const detail = event.detail as DwOverlayActionDetail | null;
      if (detail?.surface && detail.action) {
        const kind = detail.kind ?? "click";
        if (kind === "set-property" && detail.property !== undefined) {
          const valueLabel =
            typeof detail.value === "string" || typeof detail.value === "number"
              ? String(detail.value)
              : JSON.stringify(detail.value);
          lines.push({
            t: event.t,
            label: `${detail.surface} → ${detail.property} = ${valueLabel?.slice(0, 48)}`,
          });
        } else if (kind === "patch" && detail.patch) {
          lines.push({
            t: event.t,
            label: `${detail.surface} → patch(${Object.keys(detail.patch).join(", ")})`,
          });
        } else {
          lines.push({ t: event.t, label: `${detail.surface} → ${detail.action}` });
        }
      }
    }
    if (event.kind === "custom" && event.name === DW_CONTEXT_MENU_ACTION) {
      const detail = event.detail as DwContextMenuActionDetail | null;
      if (detail?.action) {
        lines.push({ t: event.t, label: `menu → ${detail.action}` });
      }
    }
  }

  return lines.slice(0, limit);
}

export function countEventsMissingSemanticTarget(recording: InteractionRecording): number {
  let missing = 0;
  for (const event of recording.events) {
    if (event.kind !== "pointer" && event.kind !== "click") continue;
    if (!("target" in event)) continue;
    if (!event.target.recordingSurface) continue;
    if (!event.target.recordingAction && !event.target.name) missing += 1;
  }
  return missing;
}
