import { useCallback, useRef, useState } from 'react';
import { emitMobilePaletteDropIfOverCanvas } from '@/components/editor/draggable-item';
import {
  paletteDragPreviewEnd,
  paletteDragPreviewMove,
  paletteDragPreviewStart,
} from '@/lib/palette-drag-preview';

const DRAG_THRESHOLD_PX = 10;

/**
 * Pointer-driven palette drag (desktop + touch). Drops via `mobileDrop` on the canvas —
 * no per-tile react-dnd registration, which keeps the sidebar light during canvas moves.
 */
export function usePalettePointerDrag<T extends object>(
  item: T,
  options?: { onTap?: () => void },
) {
  const [isDragging, setIsDragging] = useState(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);
  const dragPastThresholdRef = useRef(false);

  const resetVisual = useCallback((el: HTMLElement) => {
    el.style.opacity = '1';
    setIsDragging(false);
    startRef.current = null;
    dragPastThresholdRef.current = false;
    paletteDragPreviewEnd();
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    // Block native <img> drag so pointer capture always drives the palette ghost.
    e.preventDefault();
    startRef.current = { x: e.clientX, y: e.clientY };
    dragPastThresholdRef.current = false;
    setIsDragging(true);
    suppressClickRef.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
    (e.currentTarget as HTMLElement).style.opacity = '0.5';
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!startRef.current) return;
    const el = e.currentTarget as HTMLElement;
    const dx = Math.abs(e.clientX - startRef.current.x);
    const dy = Math.abs(e.clientY - startRef.current.y);
    if (dx > DRAG_THRESHOLD_PX || dy > DRAG_THRESHOLD_PX) {
      e.preventDefault();
      if (!dragPastThresholdRef.current) {
        dragPastThresholdRef.current = true;
        el.style.opacity = '0.35';
        paletteDragPreviewStart(el, e.clientX, e.clientY);
      } else {
        paletteDragPreviewMove(e.clientX, e.clientY);
      }
    }
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const el = e.currentTarget as HTMLElement;
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      if (!startRef.current) {
        resetVisual(el);
        return;
      }
      const dx = Math.abs(e.clientX - startRef.current.x);
      const dy = Math.abs(e.clientY - startRef.current.y);
      if (dx > DRAG_THRESHOLD_PX || dy > DRAG_THRESHOLD_PX) {
        emitMobilePaletteDropIfOverCanvas({
          touchClientX: e.clientX,
          touchClientY: e.clientY,
          item,
        });
        suppressClickRef.current = true;
      }
      resetVisual(el);
    },
    [item, resetVisual],
  );

  const onPointerCancel = useCallback(
    (e: React.PointerEvent) => {
      resetVisual(e.currentTarget as HTMLElement);
    },
    [resetVisual],
  );

  const onTapRef = useRef(options?.onTap);
  onTapRef.current = options?.onTap;

  const onClick = useCallback((e: React.MouseEvent) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onTapRef.current?.();
  }, []);

  return {
    isDragging,
    pointerHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onClick,
      style: { touchAction: 'none' as const },
    },
  };
}
