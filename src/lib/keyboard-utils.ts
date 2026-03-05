/**
 * Keyboard utilities for the editor. Used to avoid intercepting standard
 * text-editing shortcuts (copy, paste, cut, cursor keys) when the user
 * is typing in input fields.
 */

/**
 * Returns true if the keyboard event originates from an editable element
 * (input, textarea, or contenteditable). When true, editor shortcuts
 * should NOT intercept - allow the browser default (copy, paste, cursor
 * keys, select-all, etc).
 */
export function isEventFromEditableElement(
  e: { target: EventTarget | null }
): boolean {
  const target = e.target;
  if (!target || !(target instanceof Node)) return false;

  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    return true;
  }

  const el: Element | null =
    target instanceof Element ? target : (target as Node).parentElement;
  if (!el) return false;

  if (el.getAttribute?.("contenteditable") === "true") return true;
  if (el.closest?.("[contenteditable=\"true\"]")) return true;
  if (el.closest?.(".cm-editor") || (el as HTMLElement).classList?.contains("cm-focused")) return true;

  return false;
}
