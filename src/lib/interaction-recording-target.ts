import type { InteractionRecordingTarget } from "@/lib/interaction-recording-types";
import {
  readRecordingActionFromElement,
  readRecordingSurfaceFromElement,
  resolveRecordingSurfaceTarget,
} from "@/lib/interaction-recording-surfaces";

const MAX_NAME_LEN = 48;

function trimName(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const t = raw.replace(/\s+/g, " ").trim();
  if (!t) return undefined;
  return t.length > MAX_NAME_LEN ? `${t.slice(0, MAX_NAME_LEN - 1)}…` : t;
}

function nearestAttr(el: Element | null, attr: string): string | undefined {
  const hit = el?.closest(`[${attr}]`);
  if (!hit) return undefined;
  const v = hit.getAttribute(attr);
  return v && v.trim() ? v.trim() : undefined;
}

function accessibleName(el: Element): string | undefined {
  if (!(el instanceof HTMLElement)) return undefined;
  const labelled = el.getAttribute("aria-label");
  if (labelled) return trimName(labelled);
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const ref = document.getElementById(labelledBy);
    if (ref?.textContent) return trimName(ref.textContent);
  }
  if (el instanceof HTMLInputElement && el.placeholder) return trimName(el.placeholder);
  if (el instanceof HTMLTextAreaElement && el.placeholder) return trimName(el.placeholder);
  return trimName(el.textContent);
}

function readPlaceholder(el: Element): string | undefined {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const p = el.placeholder?.trim();
    return p || undefined;
  }
  return undefined;
}

function readPaletteLabel(el: Element): string | undefined {
  const tile = el.closest(".cursor-move");
  if (!tile) return undefined;
  const labelEl = tile.querySelector("span.font-medium, span.text-xs");
  return trimName(labelEl?.textContent ?? tile.textContent);
}

/** Build a compact, replay-friendly descriptor for the event target. */
export function describeInteractionTarget(rawTarget: EventTarget | null): InteractionRecordingTarget {
  const el = rawTarget instanceof Element ? rawTarget : rawTarget instanceof Node ? rawTarget.parentElement : null;
  if (!el) return {};

  const roleEl = el.closest("[role]") ?? el;
  const role = roleEl.getAttribute("role") ?? undefined;
  const placeholder = readPlaceholder(el);
  const paletteLabel = readPaletteLabel(el);
  const recordingSurface = readRecordingSurfaceFromElement(el);
  const recordingAction = readRecordingActionFromElement(el);

  return {
    testId: nearestAttr(el, "data-testid"),
    nodeId: nearestAttr(el, "data-node-id"),
    tutorialId: nearestAttr(el, "data-tutorial-id"),
    handle: nearestAttr(el, "data-handle"),
    role: role || undefined,
    name: accessibleName(roleEl instanceof HTMLElement ? roleEl : el),
    tag: el.tagName.toLowerCase(),
    placeholder,
    paletteLabel,
    recordingSurface,
    recordingAction,
  };
}

function queryByPlaceholder(placeholder: string): Element | null {
  const hit = document.querySelector(
    `input[placeholder="${CSS.escape(placeholder)}"], textarea[placeholder="${CSS.escape(placeholder)}"]`,
  );
  return hit instanceof Element ? hit : null;
}

/** Resolve the best element to dispatch replay events on. */
export function resolveInteractionTarget(
  target: InteractionRecordingTarget,
  clientX: number,
  clientY: number,
): Element | null {
  return resolveInteractionTargetForEvent(target, clientX, clientY);
}

/** Resolve replay target; omit or pass 0,0 coords for keyboard/input-only events. */
export function resolveInteractionTargetForEvent(
  target: InteractionRecordingTarget,
  clientX?: number,
  clientY?: number,
): Element | null {
  if (target.testId) {
    const hit = document.querySelector(`[data-testid="${CSS.escape(target.testId)}"]`);
    if (hit instanceof Element) return hit;
  }
  if (target.nodeId) {
    const hit = document.querySelector(`[data-node-id="${CSS.escape(target.nodeId)}"]`);
    if (hit instanceof Element) return hit;
  }
  if (target.handle && target.nodeId) {
    const node = document.querySelector(`[data-node-id="${CSS.escape(target.nodeId)}"]`);
    const knob = node?.querySelector(`[data-handle="${CSS.escape(target.handle)}"]`);
    if (knob instanceof Element) return knob;
  }
  if (target.tutorialId) {
    const hit = document.querySelector(`[data-tutorial-id="${CSS.escape(target.tutorialId)}"]`);
    if (hit instanceof Element) return hit;
  }
  if (target.placeholder) {
    const hit = queryByPlaceholder(target.placeholder);
    if (hit) return hit;
  }
  if (target.paletteLabel) {
    const tiles = [...document.querySelectorAll(".cursor-move")];
    const match = tiles.find((tile) => readPaletteLabel(tile) === target.paletteLabel);
    if (match instanceof Element) return match;
  }
  const surfaceHit = resolveRecordingSurfaceTarget(target);
  if (surfaceHit) return surfaceHit;
  if ((target.tag === "input" || target.tag === "textarea") && target.name) {
    const hit = queryByPlaceholder(target.name);
    if (hit) return hit;
  }
  if (target.role && target.name) {
    const candidates = [...document.querySelectorAll(`[role="${CSS.escape(target.role)}"]`)];
    const match = candidates.find((c) => accessibleName(c) === target.name);
    if (match instanceof Element) return match;
  }
  if (
    clientX != null &&
    clientY != null &&
    Number.isFinite(clientX) &&
    Number.isFinite(clientY) &&
    (clientX !== 0 || clientY !== 0)
  ) {
    const atPoint = document.elementFromPoint(clientX, clientY);
    if (atPoint instanceof Element) return atPoint;
  }
  if (target.tag === "input" || target.tag === "textarea") {
    const active = document.activeElement;
    if (active instanceof Element && active.tagName.toLowerCase() === target.tag) return active;
  }
  return null;
}

export function isEditableElement(el: Element): el is HTMLInputElement | HTMLTextAreaElement {
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
}

/** Set value in a way React controlled inputs observe. */
export function setNativeInputValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
  descriptor?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

export function focusInteractionTarget(el: Element): void {
  if (el instanceof HTMLElement && typeof el.focus === "function") {
    el.focus({ preventScroll: true });
  }
}

/** Wait for a search/panel input to mount (e.g. after a modal opens). */
export async function waitForInputByPlaceholder(
  placeholder: string,
  timeoutMs = 2500,
  signal?: AbortSignal,
): Promise<HTMLInputElement | HTMLTextAreaElement | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (signal?.aborted) return null;
    const hit = queryByPlaceholder(placeholder);
    if (hit && isEditableElement(hit)) return hit;
    await new Promise((r) => window.setTimeout(r, 32));
  }
  return null;
}
