import type { InteractionRecordingTarget } from "@/lib/interaction-recording-types";

/** Stable ids for floating UI the recorder orients against during replay. */
export const RECORDING_SURFACE_CANVAS_CONTEXT_MENU = "canvas-context-menu";
export const RECORDING_SURFACE_VISUAL_STYLING = "visual-styling-panel";
export const RECORDING_SURFACE_TEXT_STYLING = "text-styling-panel";
export const RECORDING_SURFACE_CONNECTION_SETTINGS = "connection-settings-panel";

export function slugifyRecordingAction(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function trimButtonLabel(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const t = raw.replace(/\s+/g, " ").trim();
  return t || undefined;
}

function accessibleButtonName(el: Element): string | undefined {
  if (!(el instanceof HTMLElement)) return undefined;
  const aria = el.getAttribute("aria-label");
  if (aria) return trimButtonLabel(aria);
  return trimButtonLabel(el.textContent);
}

export function readRecordingSurfaceFromElement(el: Element | null): string | undefined {
  if (!el) return undefined;
  const tagged = el.closest("[data-dw-recording-surface]");
  if (tagged) {
    const id = tagged.getAttribute("data-dw-recording-surface");
    if (id) return id;
  }
  if (el.closest(".context-menu")) return RECORDING_SURFACE_CANVAS_CONTEXT_MENU;
  if (
    el.closest('[role="listbox"]') ||
    el.closest("[data-radix-select-content]") ||
    el.closest("[data-radix-select-viewport]")
  ) {
    if (queryRecordingSurface(RECORDING_SURFACE_VISUAL_STYLING)) {
      return RECORDING_SURFACE_VISUAL_STYLING;
    }
    if (queryRecordingSurface(RECORDING_SURFACE_TEXT_STYLING)) {
      return RECORDING_SURFACE_TEXT_STYLING;
    }
  }
  return undefined;
}

export function readRecordingActionFromElement(el: Element | null): string | undefined {
  if (!el) return undefined;
  const btn = el.closest("button");
  if (btn) {
    const explicit = btn.getAttribute("data-dw-recording-action");
    if (explicit) return explicit;
    const surface = readRecordingSurfaceFromElement(el);
    if (!surface) return undefined;
    const name = accessibleButtonName(btn);
    return name ? slugifyRecordingAction(name) : undefined;
  }
  const option = el.closest('[role="option"]');
  if (option) {
    const surface = readRecordingSurfaceFromElement(option);
    if (!surface) return undefined;
    const name = accessibleButtonName(option);
    return name ? slugifyRecordingAction(name) : undefined;
  }
  const combobox = el.closest('[role="combobox"]');
  if (combobox) {
    const surface = readRecordingSurfaceFromElement(combobox);
    if (!surface) return undefined;
    const explicit = combobox.getAttribute("data-dw-recording-action");
    if (explicit) return explicit;
    const fieldLabel = combobox.closest("[class*='space-y']")?.querySelector("label")?.textContent;
    const value = combobox.textContent?.replace(/\s+/g, " ").trim();
    const parts = [fieldLabel, value].filter(Boolean).join(" ");
    return parts ? slugifyRecordingAction(parts) : undefined;
  }
  const switchEl = el.closest('[role="switch"]');
  if (switchEl) {
    const surface = readRecordingSurfaceFromElement(switchEl);
    if (!surface) return undefined;
    const fieldLabel = switchEl.closest("[class*='space-y']")?.querySelector("label")?.textContent;
    const aria = switchEl.getAttribute("aria-label");
    const parts = [fieldLabel, aria].filter(Boolean).join(" ");
    return parts ? slugifyRecordingAction(parts) : undefined;
  }
  return undefined;
}

export function queryRecordingSurface(surfaceId: string): Element | null {
  const hit = document.querySelector(`[data-dw-recording-surface="${CSS.escape(surfaceId)}"]`);
  if (hit instanceof Element) return hit;
  if (surfaceId === RECORDING_SURFACE_CANVAS_CONTEXT_MENU) {
    const menu = document.querySelector(".context-menu");
    return menu instanceof Element ? menu : null;
  }
  return null;
}

/** Resolve a menu/panel control without relying on recorded screen coordinates. */
export function resolveRecordingSurfaceTarget(target: InteractionRecordingTarget): Element | null {
  const surfaceId = target.recordingSurface;
  const action = target.recordingAction;
  if (!surfaceId && !action && !target.name) return null;

  const scope = surfaceId ? queryRecordingSurface(surfaceId) : document.body;
  if (!scope) return null;

  if (action) {
    const byAction = scope.querySelector(`[data-dw-recording-action="${CSS.escape(action)}"]`);
    if (byAction instanceof Element) return byAction;

    for (const node of scope.querySelectorAll(
      "button, [role='combobox'], [role='switch'], [role='option'], [role='tab']",
    )) {
      const explicit = node.getAttribute("data-dw-recording-action");
      const label = accessibleButtonName(node);
      const slug = label ? slugifyRecordingAction(label) : "";
      if (explicit === action || slug === action) return node;
    }

    for (const option of document.querySelectorAll('[role="option"]')) {
      const label = accessibleButtonName(option);
      const slug = label ? slugifyRecordingAction(label) : "";
      if (slug === action) return option;
    }
  }

  if (target.name) {
    for (const btn of scope.querySelectorAll("button")) {
      if (accessibleButtonName(btn) === target.name) return btn;
    }
  }

  return null;
}

export async function waitForRecordingSurface(
  surfaceId: string,
  timeoutMs = 2000,
  signal?: AbortSignal,
): Promise<Element | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (signal?.aborted) return null;
    const hit = queryRecordingSurface(surfaceId);
    if (hit) return hit;
    await new Promise((r) => window.setTimeout(r, 32));
  }
  return null;
}

export function isTargetInRecordingSurface(target: InteractionRecordingTarget): boolean {
  return Boolean(target.recordingSurface || target.recordingAction);
}

export function centerOfElement(el: Element): { x: number; y: number } {
  const rect = el.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}
