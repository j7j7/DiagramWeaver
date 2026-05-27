"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { GripVertical } from "lucide-react";
import type { CardElementData } from "@/lib/card-types";
import { getAgendaRowIndex, reorderAgendaRows } from "@/lib/card-agenda";
import { getBulletListRowIndex, reorderBulletListRows } from "@/lib/card-bullet-list";
import { cn } from "@/lib/utils";

function computeDropInsertIndex(
  clientY: number,
  rowIds: readonly string[],
  rowEls: ReadonlyMap<string, HTMLElement>,
): number {
  for (let i = 0; i < rowIds.length; i++) {
    const el = rowEls.get(rowIds[i]);
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    if (clientY < rect.top + rect.height / 2) return i;
  }
  return rowIds.length;
}

function toIndexAfterMove(fromIndex: number, insertIndex: number): number {
  if (fromIndex < insertIndex) return insertIndex - 1;
  return insertIndex;
}

type AgendaRowReorderContextValue = {
  enabled: boolean;
  rowIds: readonly string[];
  draggingRowId: string | null;
  dropInsertIndex: number | null;
  registerRowEl: (rowId: string, el: HTMLDivElement | null) => void;
  beginRowDrag: (rowId: string, e: React.PointerEvent) => void;
};

const AgendaRowReorderContext = createContext<AgendaRowReorderContextValue | null>(null);

export function useAgendaRowReorder(): AgendaRowReorderContextValue | null {
  return useContext(AgendaRowReorderContext);
}

export function CardRowReorderProvider({
  enabled,
  rowIds,
  cardRootElements,
  onPatch,
  reorderRows,
  onDragSessionChange,
  children,
}: {
  enabled: boolean;
  rowIds: readonly string[];
  cardRootElements: CardElementData;
  onPatch: (elements: CardElementData) => void;
  reorderRows: (elements: CardElementData, fromIndex: number, toIndex: number) => CardElementData;
  onDragSessionChange?: (active: boolean) => void;
  children: React.ReactNode;
}) {
  const rowElsRef = useRef<Map<string, HTMLElement>>(new Map());
  const dragRef = useRef<{
    rowId: string;
    fromIndex: number;
    pointerId: number;
    captureEl: HTMLElement;
  } | null>(null);
  const [draggingRowId, setDraggingRowId] = useState<string | null>(null);
  const [dropInsertIndex, setDropInsertIndex] = useState<number | null>(null);
  const dropInsertIndexRef = useRef<number | null>(null);

  const registerRowEl = useCallback((rowId: string, el: HTMLDivElement | null) => {
    if (el) rowElsRef.current.set(rowId, el);
    else rowElsRef.current.delete(rowId);
  }, []);

  const endDrag = useCallback(() => {
    const drag = dragRef.current;
    const insert = dropInsertIndexRef.current;
    dragRef.current = null;
    dropInsertIndexRef.current = null;
    setDraggingRowId(null);
    setDropInsertIndex(null);
    onDragSessionChange?.(false);
    if (!drag) return;
    if (insert == null) return;
    const toIndex = toIndexAfterMove(drag.fromIndex, insert);
    if (drag.fromIndex === toIndex) return;
    onPatch(reorderRows(cardRootElements, drag.fromIndex, toIndex));
  }, [cardRootElements, onDragSessionChange, onPatch, reorderRows]);

  const beginRowDrag = useCallback(
    (rowId: string, e: React.PointerEvent) => {
      if (!enabled || rowIds.length < 2) return;
      const fromIndex = rowIds.indexOf(rowId);
      if (fromIndex < 0) return;
      e.stopPropagation();
      e.preventDefault();
      const captureEl = e.currentTarget as HTMLElement;
      captureEl.setPointerCapture(e.pointerId);
      dragRef.current = {
        rowId,
        fromIndex,
        pointerId: e.pointerId,
        captureEl,
      };
      setDraggingRowId(rowId);
      dropInsertIndexRef.current = fromIndex;
      setDropInsertIndex(fromIndex);
      onDragSessionChange?.(true);
    },
    [enabled, onDragSessionChange, rowIds],
  );

  useEffect(() => {
    if (!draggingRowId) return;

    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;
      const insert = computeDropInsertIndex(e.clientY, rowIds, rowElsRef.current);
      dropInsertIndexRef.current = insert;
      setDropInsertIndex(insert);
    };

    const onUp = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;
      try {
        drag.captureEl.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      endDrag();
    };

    document.addEventListener("pointermove", onMove, true);
    document.addEventListener("pointerup", onUp, true);
    document.addEventListener("pointercancel", onUp, true);
    return () => {
      document.removeEventListener("pointermove", onMove, true);
      document.removeEventListener("pointerup", onUp, true);
      document.removeEventListener("pointercancel", onUp, true);
    };
  }, [draggingRowId, endDrag, rowIds]);

  const value = useMemo(
    (): AgendaRowReorderContextValue => ({
      enabled,
      rowIds,
      draggingRowId,
      dropInsertIndex,
      registerRowEl,
      beginRowDrag,
    }),
    [enabled, rowIds, draggingRowId, dropInsertIndex, registerRowEl, beginRowDrag],
  );

  return (
    <AgendaRowReorderContext.Provider value={value}>{children}</AgendaRowReorderContext.Provider>
  );
}

export function AgendaRowReorderGrip({
  rowId,
  className,
}: {
  rowId: string;
  className?: string;
}) {
  const ctx = useAgendaRowReorder();
  if (!ctx?.enabled || ctx.rowIds.length < 2) return null;
  return (
    <button
      type="button"
      aria-label="Drag to reorder row"
      data-dw-card-action=""
      className={cn(
        "absolute left-0.5 top-1/2 z-[5] flex h-5 w-4 -translate-y-1/2 cursor-grab touch-none items-center justify-center rounded text-muted-foreground hover:bg-muted/80 active:cursor-grabbing",
        className,
      )}
      onPointerDown={(e) => ctx.beginRowDrag(rowId, e)}
    >
      <GripVertical className="h-3 w-3" strokeWidth={2} aria-hidden />
    </button>
  );
}

export function AgendaRowDropIndicator({ rowIndex }: { rowIndex: number }) {
  const ctx = useAgendaRowReorder();
  if (!ctx?.draggingRowId || ctx.dropInsertIndex !== rowIndex) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-0 right-0 top-0 z-[6] h-0.5 -translate-y-1/2 bg-primary"
    />
  );
}

export function AgendaRowDropIndicatorBottom({ rowIndex }: { rowIndex: number }) {
  const ctx = useAgendaRowReorder();
  if (!ctx?.draggingRowId || ctx.dropInsertIndex !== rowIndex + 1) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute bottom-0 left-0 right-0 z-[6] h-0.5 translate-y-1/2 bg-primary"
    />
  );
}

/** Attach to agenda row section; enables drag from row chrome (not text cells). */
export function useAgendaRowSectionReorder(
  rowId: string,
  rowIndex: number,
): {
  setRowRef: (el: HTMLDivElement | null) => void;
  rowSectionProps: {
    "data-dw-agenda-row-id": string;
    "data-dw-agenda-row-index": number;
    className?: string;
    onPointerDown?: (e: React.PointerEvent) => void;
  };
  isDragging: boolean;
} {
  const ctx = useAgendaRowReorder();
  const setRowRef = useCallback(
    (el: HTMLDivElement | null) => {
      ctx?.registerRowEl(rowId, el);
    },
    [ctx, rowId],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!ctx?.enabled || ctx.rowIds.length < 2) return;
      const target = e.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-dw-card-element-kind='text']")) return;
      if (target.closest("[data-dw-card-action]")) return;
      ctx.beginRowDrag(rowId, e);
    },
    [ctx, rowId],
  );

  return {
    setRowRef,
    rowSectionProps: {
      "data-dw-agenda-row-id": rowId,
      "data-dw-agenda-row-index": rowIndex,
      onPointerDown: ctx?.enabled && ctx.rowIds.length >= 2 ? onPointerDown : undefined,
    },
    isDragging: ctx?.draggingRowId === rowId,
  };
}

export function agendaRowIndexFromElements(
  elements: CardElementData,
  rowId: string,
): number {
  return getAgendaRowIndex(elements, rowId);
}

/** Agenda cards — default reorder implementation. */
export function AgendaRowReorderProvider(
  props: Omit<React.ComponentProps<typeof CardRowReorderProvider>, "reorderRows">,
) {
  return <CardRowReorderProvider {...props} reorderRows={reorderAgendaRows} />;
}

export function bulletListRowIndexFromElements(
  elements: CardElementData,
  rowId: string,
): number {
  return getBulletListRowIndex(elements, rowId);
}

export function BulletListRowReorderProvider(
  props: Omit<React.ComponentProps<typeof CardRowReorderProvider>, "reorderRows">,
) {
  return <CardRowReorderProvider {...props} reorderRows={reorderBulletListRows} />;
}
