"use client";

import React, { useCallback, useRef, useState } from "react";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { svgUserPointFromClient } from "@/lib/chart-pointer-geometry";
import {
  gridTrackIndexAtPointer,
  type GridChartLayout,
} from "@/lib/grid-chart-layout";
import { cn } from "@/lib/utils";

const ACTION_W = 20;
const ACTION_H = 20;
const GRIP_W = 16;
const GRIP_H = 20;

const gripClassName = cn(
  "flex h-5 w-4 items-center justify-center rounded-sm text-muted-foreground",
  "hover:bg-muted/80 cursor-grab active:cursor-grabbing touch-none",
  "outline-none focus-visible:ring-2 focus-visible:ring-ring"
);

const deleteClassName = cn(
  "flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground",
  "hover:bg-destructive/10 hover:text-destructive touch-none",
  "outline-none focus-visible:ring-2 focus-visible:ring-ring"
);

const addClassName = cn(
  "flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground",
  "hover:bg-muted hover:text-foreground touch-none",
  "outline-none focus-visible:ring-2 focus-visible:ring-ring"
);

function ChromeForeignAction({
  cx,
  cy,
  width,
  height,
  children,
}: {
  cx: number;
  cy: number;
  width: number;
  height: number;
  children: React.ReactNode;
}) {
  return (
    <foreignObject
      x={cx - width / 2}
      y={cy - height / 2}
      width={width}
      height={height}
      style={{ overflow: "visible" }}
    >
      <div className="flex h-full w-full items-center justify-center">
        {children}
      </div>
    </foreignObject>
  );
}

/** Layout fields required by row/column chrome (grid and Gantt). */
export type StructureChromeLayout = Pick<
  GridChartLayout,
  "structure" | "rowEdges" | "columnEdges" | "rows" | "cols" | "plot"
>;

export interface GridChartStructureChromeProps {
  layout: StructureChromeLayout;
  canInteract: boolean;
  onDeleteRow?: (rowIndex: number) => void;
  onDeleteColumn?: (colIndex: number) => void;
  onMoveRow?: (fromRow: number, toRow: number) => void;
  onMoveColumn?: (fromCol: number, toCol: number) => void;
  onInsertRow?: (atRow: number) => void;
  onInsertColumn?: (atCol: number) => void;
  onDragSessionChange?: (active: boolean) => void;
}

export function GridChartStructureChrome({
  layout,
  canInteract,
  onDeleteRow,
  onDeleteColumn,
  onMoveRow,
  onMoveColumn,
  onInsertRow,
  onInsertColumn,
  onDragSessionChange,
}: GridChartStructureChromeProps) {
  const chrome = layout.structure;
  const [dragRowFrom, setDragRowFrom] = useState<number | null>(null);
  const [dragRowTarget, setDragRowTarget] = useState<number | null>(null);
  const [dragColFrom, setDragColFrom] = useState<number | null>(null);
  const [dragColTarget, setDragColTarget] = useState<number | null>(null);
  const rowDragFromRef = useRef(0);
  const colDragFromRef = useRef(0);
  const dragActiveRef = useRef(false);
  const dragSvgRef = useRef<SVGSVGElement | null>(null);

  const endDrag = useCallback(() => {
    if (!dragActiveRef.current) return;
    dragActiveRef.current = false;
    dragSvgRef.current = null;
    onDragSessionChange?.(false);
    setDragRowFrom(null);
    setDragRowTarget(null);
    setDragColFrom(null);
    setDragColTarget(null);
  }, [onDragSessionChange]);

  const applyRowTarget = useCallback(
    (clientY: number) => {
      const svg = dragSvgRef.current;
      if (!svg) return;
      const pt = svgUserPointFromClient(svg, 0, clientY);
      if (!pt) return;
      const t = gridTrackIndexAtPointer(pt.y, layout.rowEdges, layout.rows);
      setDragRowTarget(t);
    },
    [layout.rowEdges, layout.rows]
  );

  const applyColTarget = useCallback(
    (clientX: number) => {
      const svg = dragSvgRef.current;
      if (!svg) return;
      const pt = svgUserPointFromClient(svg, clientX, 0);
      if (!pt) return;
      const t = gridTrackIndexAtPointer(pt.x, layout.columnEdges, layout.cols);
      setDragColTarget(t);
    },
    [layout.columnEdges, layout.cols]
  );

  const onPointerDownRowDrag = useCallback(
    (rowIndex: number) => (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!canInteract || !onMoveRow) return;
      e.stopPropagation();
      e.preventDefault();
      dragSvgRef.current = (e.currentTarget.closest("svg") as SVGSVGElement | null) ?? null;
      rowDragFromRef.current = rowIndex;
      dragActiveRef.current = true;
      setDragRowFrom(rowIndex);
      setDragRowTarget(rowIndex);
      onDragSessionChange?.(true);
      applyRowTarget(e.clientY);
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [applyRowTarget, canInteract, onDragSessionChange, onMoveRow]
  );

  const onPointerDownColDrag = useCallback(
    (colIndex: number) => (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!canInteract || !onMoveColumn) return;
      e.stopPropagation();
      e.preventDefault();
      dragSvgRef.current = (e.currentTarget.closest("svg") as SVGSVGElement | null) ?? null;
      colDragFromRef.current = colIndex;
      dragActiveRef.current = true;
      setDragColFrom(colIndex);
      setDragColTarget(colIndex);
      onDragSessionChange?.(true);
      applyColTarget(e.clientX);
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [applyColTarget, canInteract, onDragSessionChange, onMoveColumn]
  );

  const onPointerMoveRowDrag = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!dragActiveRef.current || dragRowFrom == null) return;
      applyRowTarget(e.clientY);
    },
    [applyRowTarget, dragRowFrom]
  );

  const onPointerMoveColDrag = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!dragActiveRef.current || dragColFrom == null) return;
      applyColTarget(e.clientX);
    },
    [applyColTarget, dragColFrom]
  );

  const onPointerUpRowDrag = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* released */
      }
      const from = rowDragFromRef.current;
      const to = dragRowTarget ?? from;
      endDrag();
      if (from !== to) onMoveRow?.(from, to);
    },
    [dragRowTarget, endDrag, onMoveRow]
  );

  const onPointerUpColDrag = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* released */
      }
      const from = colDragFromRef.current;
      const to = dragColTarget ?? from;
      endDrag();
      if (from !== to) onMoveColumn?.(from, to);
    },
    [dragColTarget, endDrag, onMoveColumn]
  );

  if (!chrome || !canInteract) return null;

  const { plot } = layout;
  const canDeleteRow = layout.rows > 1;
  const canDeleteCol = layout.cols > 1;

  return (
    <g className="dw-grid-structure-chrome" pointerEvents="auto">
      {dragRowTarget != null && dragRowFrom != null ? (
        <rect
          x={plot.x}
          y={layout.rowEdges[dragRowTarget]!}
          width={plot.w}
          height={layout.rowEdges[dragRowTarget + 1]! - layout.rowEdges[dragRowTarget]!}
          fill="hsl(var(--primary) / 0.12)"
          stroke="hsl(var(--primary))"
          strokeWidth={0.75}
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
      ) : null}
      {dragColTarget != null && dragColFrom != null ? (
        <rect
          x={layout.columnEdges[dragColTarget]!}
          y={plot.y}
          width={layout.columnEdges[dragColTarget + 1]! - layout.columnEdges[dragColTarget]!}
          height={plot.h}
          fill="hsl(var(--primary) / 0.12)"
          stroke="hsl(var(--primary))"
          strokeWidth={0.75}
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
      ) : null}
      {chrome.rowHandles.map((h) => (
        <g key={`row-chrome-${h.index}`}>
          {canDeleteRow ? (
            <ChromeForeignAction
              cx={h.delete.x}
              cy={h.delete.y}
              width={ACTION_W}
              height={ACTION_H}
            >
              <button
                type="button"
                data-dw-grid-structure-action=""
                aria-label={`Delete row ${h.index + 1}`}
                className={deleteClassName}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteRow?.(h.index);
                }}
              >
                <Trash2 className="h-3 w-3" strokeWidth={2} aria-hidden />
              </button>
            </ChromeForeignAction>
          ) : null}
          <ChromeForeignAction
            cx={h.drag.x + h.drag.w / 2}
            cy={h.drag.y + h.drag.h / 2}
            width={GRIP_W}
            height={GRIP_H}
          >
            <button
              type="button"
              data-dw-grid-structure-action=""
              aria-label={`Drag to reorder row ${h.index + 1}`}
              className={gripClassName}
              onPointerDown={onPointerDownRowDrag(h.index)}
              onPointerMove={onPointerMoveRowDrag}
              onPointerUp={onPointerUpRowDrag}
              onPointerCancel={onPointerUpRowDrag}
            >
              <GripVertical className="h-3 w-3" strokeWidth={2} aria-hidden />
            </button>
          </ChromeForeignAction>
        </g>
      ))}
      {chrome.colHandles.map((h) => (
        <g key={`col-chrome-${h.index}`}>
          {canDeleteCol ? (
            <ChromeForeignAction
              cx={h.delete.x}
              cy={h.delete.y}
              width={ACTION_W}
              height={ACTION_H}
            >
              <button
                type="button"
                data-dw-grid-structure-action=""
                aria-label={`Delete column ${h.index + 1}`}
                className={deleteClassName}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteColumn?.(h.index);
                }}
              >
                <Trash2 className="h-3 w-3" strokeWidth={2} aria-hidden />
              </button>
            </ChromeForeignAction>
          ) : null}
          <ChromeForeignAction
            cx={h.drag.x + h.drag.w / 2}
            cy={h.drag.y + h.drag.h / 2}
            width={GRIP_H}
            height={GRIP_W}
          >
            <button
              type="button"
              data-dw-grid-structure-action=""
              aria-label={`Drag to reorder column ${h.index + 1}`}
              className={gripClassName}
              onPointerDown={onPointerDownColDrag(h.index)}
              onPointerMove={onPointerMoveColDrag}
              onPointerUp={onPointerUpColDrag}
              onPointerCancel={onPointerUpColDrag}
            >
              <GripVertical className="h-3 w-3" strokeWidth={2} aria-hidden />
            </button>
          </ChromeForeignAction>
        </g>
      ))}
      {layout.rows < 24 && onInsertRow ? (
        <ChromeForeignAction
          cx={chrome.addRow.x + chrome.addRow.w / 2}
          cy={chrome.addRow.y + chrome.addRow.h / 2}
          width={ACTION_W}
          height={ACTION_H}
        >
          <button
            type="button"
            data-dw-grid-structure-action=""
            aria-label="Add row"
            className={addClassName}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onInsertRow(layout.rows);
            }}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          </button>
        </ChromeForeignAction>
      ) : null}
      {layout.cols < 24 && onInsertColumn ? (
        <ChromeForeignAction
          cx={chrome.addCol.x + chrome.addCol.w / 2}
          cy={chrome.addCol.y + chrome.addCol.h / 2}
          width={ACTION_W}
          height={ACTION_H}
        >
          <button
            type="button"
            data-dw-grid-structure-action=""
            aria-label="Add column"
            className={addClassName}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onInsertColumn(layout.cols);
            }}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          </button>
        </ChromeForeignAction>
      ) : null}
    </g>
  );
}
