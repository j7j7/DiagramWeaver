let previewNode: HTMLElement | null = null;
let grabOffsetX = 0;
let grabOffsetY = 0;

/**
 * Fixed-position clone of the palette tile that follows the pointer during sidebar→canvas drag.
 * Single global instance — palette tiles do not use react-dnd drag previews.
 */
export function paletteDragPreviewStart(
  source: HTMLElement,
  clientX: number,
  clientY: number,
): void {
  paletteDragPreviewEnd();
  const rect = source.getBoundingClientRect();
  grabOffsetX = clientX - rect.left;
  grabOffsetY = clientY - rect.top;

  const clone = source.cloneNode(true) as HTMLElement;
  clone.setAttribute('aria-hidden', 'true');
  clone.style.margin = '0';
  clone.style.position = 'fixed';
  clone.style.left = '0';
  clone.style.top = '0';
  clone.style.zIndex = '99999';
  clone.style.pointerEvents = 'none';
  clone.style.opacity = '0.9';
  clone.style.width = `${rect.width}px`;
  clone.style.boxSizing = 'border-box';
  clone.style.transform = `translate(${clientX - grabOffsetX}px, ${clientY - grabOffsetY}px)`;
  clone.classList.add('dw-palette-drag-preview');

  document.body.appendChild(clone);
  previewNode = clone;
}

export function paletteDragPreviewMove(clientX: number, clientY: number): void {
  if (!previewNode) return;
  previewNode.style.transform = `translate(${clientX - grabOffsetX}px, ${clientY - grabOffsetY}px)`;
}

export function paletteDragPreviewEnd(): void {
  previewNode?.remove();
  previewNode = null;
}
