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

  let el: Element | null =
    target instanceof Element ? target : target.parentElement;

  while (el) {
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      return !el.disabled;
    }
    if (el instanceof HTMLElement && el.isContentEditable) {
      return true;
    }
    if (el.closest?.(".cm-editor") || el.classList?.contains("cm-focused")) {
      return true;
    }
    el = el.parentElement;
  }

  return false;
}
