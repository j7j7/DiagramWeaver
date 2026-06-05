"use client";
import React, { useMemo } from 'react';
import { Card, CardContent } from '../ui/card';
import { usePalettePointerDrag } from '@/hooks/use-palette-pointer-drag';

interface DraggableItemProps {
    type: string;
    label: string;
    icon: React.ReactNode;
    data?: any;
}

export const ItemTypes = {
  DIAGRAM_NODE: 'diagram_node',
  CANVAS_NODE: 'canvas_node',
  ZONE: 'zone',
};

const EDITOR_CANVAS_SELECTOR = '[data-testid="editor-canvas"]';

/**
 * Sidebar palette touch gestures: emits `mobileDrop` on the editor canvas element with viewport
 * coordinates — `useCanvasDragDrop` converts to diagram space with pan/zoom.
 */
export function emitMobilePaletteDropIfOverCanvas(opts: {
  touchClientX: number;
  touchClientY: number;
  item: unknown;
}): boolean {
  const canvas =
    typeof document !== "undefined" ? (document.querySelector(EDITOR_CANVAS_SELECTOR) as HTMLElement | null) : null;
  if (!canvas) return false;
  const canvasRect = canvas.getBoundingClientRect();
  const { touchClientX, touchClientY, item } = opts;
  if (
    touchClientX < canvasRect.left ||
    touchClientX > canvasRect.right ||
    touchClientY < canvasRect.top ||
    touchClientY > canvasRect.bottom
  ) {
    return false;
  }
  canvas.dispatchEvent(
    new CustomEvent("mobileDrop", {
      detail: {
        item,
        clientX: touchClientX,
        clientY: touchClientY,
        itemType: ItemTypes.DIAGRAM_NODE,
      },
    }),
  );
  return true;
}

/** On-canvas touch move (after long-press): diagram delta derived from viewport start/end inside `useCanvasDragDrop`. */
export function emitMobileCanvasDeltaMove(opts: {
  id: string;
  itemType: typeof ItemTypes.CANVAS_NODE | typeof ItemTypes.ZONE;
  clientStartX: number;
  clientStartY: number;
  clientEndX: number;
  clientEndY: number;
}): void {
  const canvas =
    typeof document !== "undefined"
      ? (document.querySelector(EDITOR_CANVAS_SELECTOR) as HTMLElement | null)
      : null;
  if (!canvas) return;
  canvas.dispatchEvent(new CustomEvent("mobileMove", { detail: opts }));
}

export function DraggableItem({ type, label, icon, data }: DraggableItemProps) {
  const item = useMemo(() => {
    // Start with the data object, then override with props to ensure type precedence
    const result = { ...data };
    // Ensure the props type takes precedence over data.type
    result.type = type;
    result.label = label;
    // Store the original type if it exists in data (for shape preservation)
    if (data && data.type && data.type !== type) {
      result.originalType = data.type;
    }
    return result;
  }, [type, label, data]);
  const { isDragging, pointerHandlers } = usePalettePointerDrag(item);

  return (
    <div
      {...pointerHandlers}
      style={{ opacity: isDragging ? 0.5 : 1, ...pointerHandlers.style }}
      className="cursor-move"
    >
      <Card className="hover:bg-accent hover:text-accent-foreground transition-colors">
        <CardContent className="p-1.5 flex flex-col items-center justify-center gap-1 text-center min-h-12">
          <div className="flex items-center justify-center">{icon}</div>
          <span className="font-medium text-xs">{label}</span>
        </CardContent>
      </Card>
    </div>
  );
}
