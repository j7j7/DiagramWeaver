"use client";

import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { DiagramNodeData, NodeChartSpecGantt, RichTextRun } from "@/lib/types";
import { useGlobalProperties, useGlobalVariableContext } from "@/components/diagram/global-properties-context";
import { labelToRuns, normalizeRuns, getPlainTextFromRuns } from "@/lib/rich-text";
import { resolveGlobalVariablesInRuns } from "@/lib/global-properties";
import { buildGridChartInlineTextNode } from "@/lib/grid-chart-rich-node";
import { TextboxRichEditor } from "../textbox-rich-editor";
import { TextboxRichDisplay } from "../textbox-rich-display";
import { svgUserPointFromClient } from "@/lib/chart-pointer-geometry";
import {
  adjustGridColumnTracksGrowContainer,
  adjustGridRowTracksGrowContainer,
  gridChartTrackPixelSizesFromEdges,
  gridTrackIndexAtPointer,
  TRACK_EDGE_HIT_PAD,
} from "@/lib/grid-chart-layout";
import {
  buildGanttChartLayout,
  GANTT_BAR_FONT,
  GANTT_GATE_BAR_BORDER,
  GANTT_GATE_BAR_FILL,
  GANTT_LABEL_CHIP_FILL,
  GANTT_MIN_BAR_SPAN,
  GANTT_TASK_BAR_BORDER,
  GANTT_TASK_BAR_FILL,
  plotXToColumnUnits,
  snapGanttColumnUnit,
  type GanttLayoutBar,
} from "@/lib/gantt-chart-layout";
import { defaultGanttChartSpec } from "@/lib/chart-node";
import { SvgShapeBase } from "./svg-shape-base";
import { getShapeSvgFill } from "./shape-utils";
import { useSvgGradient } from "@/hooks/use-svg-gradient";
import { getHighlightAnimStyleForNode, mergeCardShellHighlightStyle } from "@/lib/highlight-anim";
import { GridChartStructureChrome } from "./grid-chart-structure-chrome";

const ROW_REORDER_EDGE_PAD = 7;

type EditSlot =
  | { kind: "title" }
  | { kind: "col"; index: number }
  | { kind: "row"; index: number }
  | { kind: "bar"; id: string }
  | { kind: "legend"; which: "gate" | "task" | "phase" };

interface GanttChartShapeProps {
  node: DiagramNodeData & { width?: number; height?: number };
  showMeshGradientHubIndicators?: boolean;
  tag?: string;
  tagPosition?: string;
  isEditingTag: boolean;
  editTagText: string;
  onTagTextChange: (text: string) => void;
  onTagSubmit: () => void;
  onTagKeyDown: (e: React.KeyboardEvent) => void;
  onTagDoubleClick: (e: React.MouseEvent) => void;
  label: string;
  isEditingLabel: boolean;
  editRuns: RichTextRun[];
  onRichLabelSubmit: (plainText: string, runs: RichTextRun[]) => void;
  onVerticalAlignChange?: (position: "top" | "middle" | "bottom") => void;
  onLabelKeyDown: (e: React.KeyboardEvent) => void;
  onLabelDoubleClick: (e: React.MouseEvent) => void;
  slideColorTransition?: string;
  overrideWidth?: number;
  overrideHeight?: number;
  isReadOnly?: boolean;
  ganttInteractive?: boolean;
  onGanttDragSessionChange?: (active: boolean) => void;
  onDeleteGanttRow?: (rowIndex: number) => void;
  onDeleteGanttColumn?: (colIndex: number) => void;
  onMoveGanttRow?: (fromRow: number, toRow: number) => void;
  onMoveGanttColumn?: (fromCol: number, toCol: number) => void;
  onInsertGanttRow?: (atRow: number) => void;
  onInsertGanttColumn?: (atCol: number) => void;
  onColumnTrackResize?: (payload: { columnWeights: number[]; width: number }) => void;
  onRowTrackResize?: (payload: { rowWeights: number[]; height: number }) => void;
  onGanttFitHeight?: (height: number) => void;
  onGanttBarChange?: (barId: string, start: number, end: number) => void;
  onGanttBarTextChange?: (barId: string, plainText: string, runs: RichTextRun[]) => void;
  onGanttTitleChange?: (plainText: string, runs: RichTextRun[]) => void;
  onGanttColumnTitleChange?: (colIndex: number, plainText: string, runs: RichTextRun[]) => void;
  onGanttRowLabelChange?: (rowIndex: number, plainText: string, runs: RichTextRun[]) => void;
  onGanttLegendChange?: (
    which: "gate" | "task" | "phase",
    plainText: string,
    runs: RichTextRun[]
  ) => void;
}

export function GanttChartShape(props: GanttChartShapeProps) {
  const {
    isReadOnly = false,
    ganttInteractive = false,
    showMeshGradientHubIndicators: _hub = false,
    onGanttDragSessionChange,
    onDeleteGanttRow,
    onDeleteGanttColumn,
    onMoveGanttRow,
    onMoveGanttColumn,
    onInsertGanttRow,
    onInsertGanttColumn,
    onColumnTrackResize,
    onRowTrackResize,
    onGanttFitHeight,
    onGanttBarChange,
    onGanttBarTextChange,
    onGanttTitleChange,
    onGanttColumnTitleChange,
    onGanttRowLabelChange,
    onGanttLegendChange,
    ...svgBaseProps
  } = props;
  const { node, slideColorTransition } = svgBaseProps;
  const nodeAny = node as unknown as Record<string, unknown>;
  const chartBase: NodeChartSpecGantt =
    node.chart?.kind === "gantt" ? node.chart : defaultGanttChartSpec();
  const variableContext = useGlobalVariableContext();
  const globalProperties = useGlobalProperties();
  const layout = useMemo(
    () => buildGanttChartLayout(node, chartBase, { structureChrome: ganttInteractive }),
    [node, chartBase, ganttInteractive]
  );
  const { body, plot } = layout;
  const canEdit = !isReadOnly && Boolean(onGanttRowLabelChange);
  const canDragBars = ganttInteractive && Boolean(onGanttBarChange);
  const canReorderRows = ganttInteractive && Boolean(onMoveGanttRow);
  const [edit, setEdit] = useState<EditSlot | null>(null);
  const [editRuns, setEditRuns] = useState<RichTextRun[]>([]);
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [rowReorderTarget, setRowReorderTarget] = useState<number | null>(null);
  const rowReorderRef = useRef<{
    from: number;
    originClientY: number;
    moved: boolean;
    target: number;
  } | null>(null);
  const onGanttFitHeightRef = useRef(onGanttFitHeight);
  onGanttFitHeightRef.current = onGanttFitHeight;

  useLayoutEffect(() => {
    const fit = onGanttFitHeightRef.current;
    if (!fit) return;
    const cur = node.height ?? 0;
    const need = layout.requiredNodeHeight;
    if (need <= cur + 0.5) return;
    fit(need);
  }, [layout.requiredNodeHeight, node.height]);

  const barDragRef = useRef<{
    id: string;
    rowIndex: number;
    mode: "move" | "resize-start" | "resize-end";
    originCol: number;
    originClientX: number;
    originClientY: number;
    start: number;
    end: number;
    axis: "x" | "y" | null;
  } | null>(null);
  const colDragRef = useRef<{ index: number; frozen: number[] } | null>(null);
  const rowDragRef = useRef<{ index: number; frozen: number[] } | null>(null);

  const resolveRuns = useCallback(
    (runs: RichTextRun[]) => resolveGlobalVariablesInRuns(runs, globalProperties, variableContext),
    [globalProperties, variableContext]
  );

  const runsFor = (plain: string, rich?: RichTextRun[]) =>
    rich?.length ? rich : labelToRuns(plain);

  const runsForEdit = (plain: string, rich?: RichTextRun[]) => {
    const runs = runsFor(plain, rich);
    return runs.length > 0 ? runs : [{ text: "" }];
  };

  const finishEdit = (plain: string, runs: RichTextRun[]) => {
    const slot = edit;
    setEdit(null);
    if (!slot) return;
    const norm = normalizeRuns(runs);
    if (slot.kind === "title") onGanttTitleChange?.(plain, norm);
    else if (slot.kind === "col") onGanttColumnTitleChange?.(slot.index, plain, norm);
    else if (slot.kind === "row") onGanttRowLabelChange?.(slot.index, plain, norm);
    else if (slot.kind === "bar") onGanttBarTextChange?.(slot.id, plain, norm);
    else onGanttLegendChange?.(slot.which, plain, norm);
  };

  const renderText = (opts: {
    key: string;
    x: number;
    y: number;
    w: number;
    h: number;
    runs: RichTextRun[];
    slot: EditSlot;
    color: string;
    fontSize: number;
    align: "left" | "center";
    weight?: number;
    transform?: string;
    /** When true, clicks pass through to the bar so drag/resize still work. Double-click the bar to edit. */
    passPointer?: boolean;
  }) => {
    const isEditing =
      edit != null &&
      ((opts.slot.kind === "legend" && edit.kind === "legend" && edit.which === opts.slot.which) ||
        (opts.slot.kind !== "legend" &&
          edit.kind === opts.slot.kind &&
          (("index" in opts.slot && "index" in edit && opts.slot.index === edit.index) ||
            ("id" in opts.slot && "id" in edit && opts.slot.id === edit.id) ||
            (opts.slot.kind === "title" && edit.kind === "title"))));
    const displayRuns = resolveRuns(opts.runs);
    const plain = getPlainTextFromRuns(displayRuns).trim();
    if (!plain && !isEditing) return null;
    const passPointer = Boolean(opts.passPointer) && !isEditing;
    const textCaptures =
      isEditing || (ganttInteractive && canEdit && !passPointer);
    const textNode = buildGridChartInlineTextNode(node, {
      labelColor: opts.color,
      fontSize: opts.fontSize,
      textAlign: opts.align,
      fontWeight: opts.weight ?? (opts.align === "left" ? 600 : 500),
    });
    return (
      <g key={opts.key}>
        <foreignObject
          x={opts.x}
          y={opts.y}
          width={Math.max(4, opts.w)}
          height={Math.max(4, opts.h)}
          style={{
            overflow: isEditing ? "visible" : "hidden",
            pointerEvents: textCaptures ? "auto" : "none",
          }}
        >
          <div
            className={`flex h-full w-full flex-col ${textCaptures ? "cursor-text" : "cursor-default"}`}
            style={{
              justifyContent: "center",
              alignItems: opts.align === "left" ? "flex-start" : "center",
              textTransform: opts.transform as React.CSSProperties["textTransform"],
            }}
            onPointerDown={(e) => {
              if (!isEditing) return;
              e.stopPropagation();
            }}
            onDoubleClick={(e) => {
              if (!canEdit || isEditing) return;
              e.stopPropagation();
              e.preventDefault();
              setEditRuns(opts.runs);
              setEdit(opts.slot);
            }}
          >
            {isEditing ? (
              <div
                className="relative min-h-0 w-full flex-1 overflow-visible"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <TextboxRichEditor
                  node={textNode}
                  runs={editRuns}
                  onSubmit={finishEdit}
                  toolbarFixedToViewport
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Escape") {
                      e.preventDefault();
                      setEdit(null);
                    }
                  }}
                />
              </div>
            ) : (
              <TextboxRichDisplay
                node={textNode}
                runs={displayRuns}
                suppressHoverBackground
                pointerEventsNone={passPointer}
                onDoubleClick={(e) => {
                  if (!canEdit) return;
                  e.stopPropagation();
                  e.preventDefault();
                  setEditRuns(opts.runs);
                  setEdit(opts.slot);
                }}
              />
            )}
          </div>
        </foreignObject>
      </g>
    );
  };

  const applyBarPointer = (clientX: number, clientY: number, svg: SVGSVGElement) => {
    const drag = barDragRef.current;
    if (!drag) return;
    if (drag.mode === "move") {
      if (!drag.axis) {
        const dx = clientX - drag.originClientX;
        const dy = clientY - drag.originClientY;
        if (Math.hypot(dx, dy) < 8) return;
        drag.axis = canReorderRows && Math.abs(dy) >= Math.abs(dx) ? "y" : "x";
        if (drag.axis === "y") {
          rowReorderRef.current = {
            from: drag.rowIndex,
            originClientY: drag.originClientY,
            moved: true,
            target: drag.rowIndex,
          };
        }
      }
      if (drag.axis === "y") {
        applyRowReorderPointer(clientY, svg);
        return;
      }
    }
    if (!onGanttBarChange) return;
    const pt = svgUserPointFromClient(svg, clientX, 0);
    if (!pt) return;
    const col = plotXToColumnUnits(pt.x, layout.columnEdges, layout.cols);
    const delta = col - drag.originCol;
    if (drag.mode !== "move" && drag.axis == null) {
      if (Math.abs(delta) < 0.05) return;
      drag.axis = "x";
    }
    const span = drag.end - drag.start;
    let start = drag.start;
    let end = drag.end;
    if (drag.mode === "move") {
      start = Math.max(0, Math.min(layout.cols - span, drag.start + delta));
      end = start + span;
    } else if (drag.mode === "resize-start") {
      start = Math.max(0, Math.min(drag.end - GANTT_MIN_BAR_SPAN, drag.start + delta));
    } else {
      end = Math.min(layout.cols, Math.max(drag.start + GANTT_MIN_BAR_SPAN, drag.end + delta));
    }
    onGanttBarChange(
      drag.id,
      snapGanttColumnUnit(start, layout.subdivisions, layout.cols),
      snapGanttColumnUnit(end, layout.subdivisions, layout.cols)
    );
  };

  const onBarPointerDown = (bar: GanttLayoutBar, mode: "move" | "resize-start" | "resize-end") =>
    (e: React.PointerEvent<SVGRectElement>) => {
      if (!canDragBars && !(mode === "move" && canReorderRows)) return;
      e.stopPropagation();
      const svg = e.currentTarget.ownerSVGElement;
      if (!svg) return;
      const pt = svgUserPointFromClient(svg, e.clientX, 0);
      barDragRef.current = {
        id: bar.id,
        rowIndex: bar.rowIndex,
        mode,
        originCol: pt ? plotXToColumnUnits(pt.x, layout.columnEdges, layout.cols) : bar.start,
        originClientX: e.clientX,
        originClientY: e.clientY,
        start: bar.start,
        end: bar.end,
        axis: mode === "move" ? null : "x",
      };
      onGanttDragSessionChange?.(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    };

  const endBarDrag = (e: React.PointerEvent) => {
    const drag = barDragRef.current;
    barDragRef.current = null;
    if (drag?.axis === "y") {
      endRowReorder(e);
      return;
    }
    onGanttDragSessionChange?.(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  const applyRowReorderPointer = (clientY: number, svg: SVGSVGElement) => {
    const drag = rowReorderRef.current;
    if (!drag) return;
    if (!drag.moved) {
      if (Math.abs(clientY - drag.originClientY) < 6) return;
      drag.moved = true;
      onGanttDragSessionChange?.(true);
    }
    const pt = svgUserPointFromClient(svg, 0, clientY);
    if (!pt) return;
    const target = gridTrackIndexAtPointer(pt.y, layout.rowEdges, layout.rows);
    drag.target = target;
    setRowReorderTarget(target);
  };

  const onRowReorderPointerDown = (rowIndex: number) => (e: React.PointerEvent<SVGRectElement>) => {
    if (!canReorderRows || edit) return;
    e.stopPropagation();
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg) return;
    rowReorderRef.current = { from: rowIndex, originClientY: e.clientY, moved: false, target: rowIndex };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onRowReorderPointerMove = (e: React.PointerEvent<SVGRectElement>) => {
    if (!rowReorderRef.current) return;
    const svg = e.currentTarget.ownerSVGElement;
    if (svg) applyRowReorderPointer(e.clientY, svg);
  };

  const endRowReorder = (e: React.PointerEvent) => {
    const drag = rowReorderRef.current;
    rowReorderRef.current = null;
    const from = drag?.from ?? -1;
    const to = drag?.target ?? from;
    const moved = Boolean(drag?.moved);
    setRowReorderTarget(null);
    onGanttDragSessionChange?.(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    if (moved && from >= 0 && from !== to) onMoveGanttRow?.(from, to);
  };

  const backgroundStyle = (nodeAny.backgroundStyle as string) || "solid";
  const borderStyle = (nodeAny.borderStyle as string) || "solid";
  const backgroundColors = (nodeAny.backgroundColors as string[]) || [
    (nodeAny.backgroundColor as string) || "#f8f9fa",
  ];
  const borderColors = (nodeAny.borderColors as string[]) || [
    (nodeAny.borderColor as string) || "#e5e7eb",
  ];
  const gradientAngle = (nodeAny.gradientAngle as number) || 180;
  const { defs: gradDefs, fillRef, strokeRef } = useSvgGradient({
    colors: backgroundStyle === "gradient" ? backgroundColors : [backgroundColors[0]],
    angle: gradientAngle,
    borderColors: borderStyle === "gradient" ? borderColors : undefined,
    borderAngle: borderStyle === "gradient" ? gradientAngle : undefined,
    enabled: backgroundStyle === "gradient" || borderStyle === "gradient",
  });
  const fillColor = getShapeSvgFill(
    backgroundStyle,
    fillRef,
    nodeAny.backgroundColor as string,
    "#f8f9fa"
  );
  const strokeColor =
    borderStyle === "gradient" ? strokeRef : (nodeAny.borderColor as string) || "#e5e7eb";
  const strokeDasharray = borderStyle === "dotted" ? "4 3" : undefined;
  const shellHighlightStyle = getHighlightAnimStyleForNode(
    node as DiagramNodeData & { x: number; y: number },
    {
      isLineNode: false,
      isDuplicateDragPreview: false,
      positionX: node.x ?? 0,
      positionY: node.y ?? 0,
      roundedShellGlow: true,
    }
  );
  const shellBorderRadius = `${Math.max(0, body.rx)}px`;

  const svgContent = (
    <>
      <defs>{gradDefs}</defs>
      <rect
        x={body.x}
        y={body.y}
        width={body.w}
        height={body.h}
        rx={body.rx}
        ry={body.ry}
        fill={fillColor}
        stroke={borderStyle === "none" ? "none" : strokeColor}
        strokeWidth={layout.strokeWidth}
        strokeDasharray={strokeDasharray}
        {...(layout.strokeWidth > 0 ? { vectorEffect: "non-scaling-stroke" as const } : {})}
      />
      <g pointerEvents="none">
        {layout.weekLines.map((ln, i) => (
          <line
            key={`wk-${i}`}
            x1={ln.x1}
            y1={ln.y1}
            x2={ln.x2}
            y2={ln.y2}
            stroke={layout.gridLineColor}
            strokeWidth={0.6}
            strokeDasharray="2 3"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {layout.monthLines.map((ln, i) => (
          <line
            key={`mo-${i}`}
            x1={ln.x1}
            y1={ln.y1}
            x2={ln.x2}
            y2={ln.y2}
            stroke={layout.gridLineColor}
            strokeWidth={0.9}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {layout.phaseSeps.map((ln, i) => (
          <line
            key={`ph-${i}`}
            x1={ln.x1}
            y1={ln.y1}
            x2={ln.x2}
            y2={ln.y2}
            stroke="#e5e7eb"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>
      {layout.title
        ? renderText({
            key: "title",
            x: body.x + layout.titlePadX,
            y: body.y + 2,
            w: body.w - layout.titlePadX * 2,
            h: layout.title.fontSize * 2,
            runs: runsFor(chartBase.title ?? "", chartBase.richTitle),
            slot: { kind: "title" },
            color: layout.titleColor,
            fontSize: layout.title.fontSize,
            align: "center",
            weight: 600,
          })
        : null}
      {layout.columnTitles.map((ct) => {
        const colW =
          (layout.columnEdges[ct.colIndex + 1] ?? plot.x + plot.w) -
          (layout.columnEdges[ct.colIndex] ?? plot.x);
        return renderText({
          key: `ct-${ct.colIndex}`,
          x: layout.columnEdges[ct.colIndex] ?? plot.x,
          y: ct.y - ct.fontSize,
          w: colW,
          h: ct.fontSize * 2,
          runs: runsFor(
            chartBase.columnTitles?.[ct.colIndex] ?? ct.text,
            chartBase.richColumnTitles?.[ct.colIndex]
          ),
          slot: { kind: "col", index: ct.colIndex },
          color: layout.axisColor,
          fontSize: ct.fontSize,
          align: "center",
          weight: 500,
        });
      })}
      {layout.layoutRows.map((row) => {
        const fontSize = row.fontSize;
        const box = row.chip ?? {
          x: layout.labelCol.x + 6,
          y: row.y0,
          w: layout.labelCol.w - 10,
          h: row.y1 - row.y0,
        };
        return (
          <g key={`row-${row.id}`}>
            {canReorderRows ? (
              <rect
                x={layout.labelCol.x}
                y={row.y0 + ROW_REORDER_EDGE_PAD}
                width={Math.max(8, layout.labelCol.w)}
                height={Math.max(4, row.y1 - row.y0 - ROW_REORDER_EDGE_PAD * 2)}
                fill="transparent"
                style={{ cursor: "grab", touchAction: "none" }}
                onPointerDown={onRowReorderPointerDown(row.index)}
                onPointerMove={onRowReorderPointerMove}
                onPointerUp={endRowReorder}
                onPointerCancel={endRowReorder}
                onDoubleClick={(e) => {
                  if (!canEdit) return;
                  e.stopPropagation();
                  e.preventDefault();
                  rowReorderRef.current = null;
                  setRowReorderTarget(null);
                  onGanttDragSessionChange?.(false);
                  const raw = chartBase.rows[row.index];
                  setEditRuns(runsForEdit(raw?.label ?? row.label, raw?.richLabel));
                  setEdit({ kind: "row", index: row.index });
                }}
              />
            ) : null}
            {row.chip ? (
              <rect
                x={row.chip.x}
                y={row.chip.y}
                width={row.chip.w}
                height={row.chip.h}
                rx={Math.min(row.chip.h * 0.5, 12)}
                fill={row.chipFill}
                pointerEvents="none"
              />
            ) : null}
            {renderText({
              key: `rl-${row.id}`,
              x: box.x + 6,
              y: box.y,
              w: box.w - 12,
              h: box.h,
              runs: runsFor(
                chartBase.rows[row.index]?.label ?? row.label,
                chartBase.rows[row.index]?.richLabel
              ),
              slot: { kind: "row", index: row.index },
              color: row.labelColor,
              fontSize,
              align: "left",
              weight: row.kind === "phase" ? 500 : 700,
              transform: row.kind === "phase" ? "uppercase" : undefined,
              passPointer: canReorderRows,
            })}
          </g>
        );
      })}
      {layout.bars.map((bar) => {
        const rx = bar.h * 0.5;
        const handle = Math.max(6, Math.min(10, bar.w * 0.12));
        const barInteractive = canDragBars || canReorderRows;
        return (
          <g key={`bar-${bar.id}`}>
            <rect
              x={bar.x}
              y={bar.y}
              width={bar.w}
              height={bar.h}
              rx={rx}
              fill={bar.fill}
              stroke={bar.border}
              strokeWidth={1.1}
              vectorEffect="non-scaling-stroke"
              style={{
                cursor: barInteractive ? "grab" : "default",
                touchAction: "none",
                pointerEvents: barInteractive || (ganttInteractive && canEdit) ? "auto" : "none",
              }}
              onPointerDown={onBarPointerDown(bar, "move")}
              onPointerMove={(e) => {
                if (!barDragRef.current) return;
                const svg = e.currentTarget.ownerSVGElement;
                if (svg) applyBarPointer(e.clientX, e.clientY, svg);
              }}
              onPointerUp={endBarDrag}
              onPointerCancel={endBarDrag}
              onDoubleClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                barDragRef.current = null;
                onGanttDragSessionChange?.(false);
                if (!canEdit) return;
                const raw = chartBase.bars.find((b) => b.id === bar.id);
                setEditRuns(runsForEdit(raw?.label ?? bar.label ?? "", raw?.richLabel));
                setEdit({ kind: "bar", id: bar.id });
              }}
            />
            {canDragBars ? (
              <>
                <rect
                  x={bar.x}
                  y={bar.y}
                  width={handle}
                  height={bar.h}
                  fill="transparent"
                  style={{ cursor: "ew-resize", touchAction: "none" }}
                  onPointerDown={onBarPointerDown(bar, "resize-start")}
                  onPointerMove={(e) => {
                    if (!barDragRef.current) return;
                    const svg = e.currentTarget.ownerSVGElement;
                    if (svg) applyBarPointer(e.clientX, e.clientY, svg);
                  }}
                  onPointerUp={endBarDrag}
                  onPointerCancel={endBarDrag}
                />
                <rect
                  x={bar.x + bar.w - handle}
                  y={bar.y}
                  width={handle}
                  height={bar.h}
                  fill="transparent"
                  style={{ cursor: "ew-resize", touchAction: "none" }}
                  onPointerDown={onBarPointerDown(bar, "resize-end")}
                  onPointerMove={(e) => {
                    if (!barDragRef.current) return;
                    const svg = e.currentTarget.ownerSVGElement;
                    if (svg) applyBarPointer(e.clientX, e.clientY, svg);
                  }}
                  onPointerUp={endBarDrag}
                  onPointerCancel={endBarDrag}
                />
              </>
            ) : null}
            {bar.label || (edit?.kind === "bar" && edit.id === bar.id)
              ? renderText({
                  key: `bl-${bar.id}`,
                  x: bar.x,
                  y: bar.y,
                  w: bar.w,
                  h: bar.h,
                  runs: runsFor(
                    chartBase.bars.find((b) => b.id === bar.id)?.label ?? bar.label,
                    chartBase.bars.find((b) => b.id === bar.id)?.richLabel
                  ),
                  slot: { kind: "bar", id: bar.id },
                  color: bar.labelColor,
                  fontSize: GANTT_BAR_FONT,
                  align: "center",
                  weight: 700,
                  transform: "uppercase",
                  passPointer: canDragBars || canReorderRows,
                })
              : null}
          </g>
        );
      })}
      {layout.legend
        ? layout.legend.items.map((item) => {
            const isGate = item.kind === "gate";
            const isTask = item.kind === "task";
            const sw = item.swatch;
            const labelRuns = runsFor(
              item.kind === "gate"
                ? chartBase.legendGateLabel ?? item.label
                : item.kind === "task"
                  ? chartBase.legendTaskLabel ?? item.label
                  : chartBase.legendPhaseLabel ?? item.label,
              item.kind === "gate"
                ? chartBase.richLegendGateLabel
                : item.kind === "task"
                  ? chartBase.richLegendTaskLabel
                  : chartBase.richLegendPhaseLabel
            );
            return (
              <g key={`leg-${item.kind}`}>
                <rect
                  x={sw.x}
                  y={sw.y}
                  width={sw.w}
                  height={sw.h}
                  rx={isTask || isGate ? 3 : 2}
                  fill={isGate ? (chartBase.gateBarFill?.trim() || GANTT_GATE_BAR_FILL) : isTask ? (chartBase.taskBarFill?.trim() || GANTT_TASK_BAR_FILL) : (chartBase.taskChipFill?.trim() || GANTT_LABEL_CHIP_FILL)}
                  stroke={isGate ? (chartBase.gateBarBorder?.trim() || GANTT_GATE_BAR_BORDER) : isTask ? (chartBase.taskBarBorder?.trim() || GANTT_TASK_BAR_BORDER) : "none"}
                  strokeWidth={isPhase(item.kind) ? 0 : 1}
                  vectorEffect="non-scaling-stroke"
                />
                {renderText({
                  key: `leg-t-${item.kind}`,
                  x: sw.x + sw.w + 6,
                  y: layout.legend!.y - 2,
                  w: item.kind === "gate" ? 150 : 70,
                  h: layout.legend!.h,
                  runs: labelRuns,
                  slot: { kind: "legend", which: item.kind },
                  color: layout.axisColor,
                  fontSize: layout.legend!.fontSize,
                  align: "left",
                  weight: 500,
                })}
              </g>
            );
          })
        : null}
      {ganttInteractive && onColumnTrackResize && layout.cols > 1
        ? layout.colBoundaries.map((b) => {
            const hitW = Math.max(6, TRACK_EDGE_HIT_PAD * 2);
            return (
              <rect
                key={`cb-${b.index}`}
                x={b.x - hitW / 2}
                y={b.y0}
                width={hitW}
                height={b.y1 - b.y0}
                fill={hoveredCol === b.index ? "rgba(59,130,246,0.18)" : "transparent"}
                style={{ cursor: "col-resize", touchAction: "none" }}
                onPointerEnter={() => setHoveredCol(b.index)}
                onPointerLeave={() => setHoveredCol((p) => (p === b.index ? null : p))}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  colDragRef.current = {
                    index: b.index,
                    frozen: gridChartTrackPixelSizesFromEdges(layout.columnEdges),
                  };
                  onGanttDragSessionChange?.(true);
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  const session = colDragRef.current;
                  if (!session) return;
                  const svg = e.currentTarget.ownerSVGElement;
                  if (!svg) return;
                  const pt = svgUserPointFromClient(svg, e.clientX, 0);
                  if (!pt) return;
                  const { trackPx, plotW } = adjustGridColumnTracksGrowContainer(
                    session.frozen,
                    session.index,
                    pt.x,
                    plot.x
                  );
                  onColumnTrackResize({
                    columnWeights: trackPx,
                    width: Math.max(40, (node.width ?? layout.body.w) + (plotW - plot.w)),
                  });
                }}
                onPointerUp={(e) => {
                  colDragRef.current = null;
                  onGanttDragSessionChange?.(false);
                  try {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                  } catch {
                    /* ignore */
                  }
                }}
              />
            );
          })
        : null}
      {ganttInteractive && onRowTrackResize && layout.rows > 1
        ? layout.rowBoundaries.map((b) => {
            const hitH = Math.max(6, TRACK_EDGE_HIT_PAD * 2);
            return (
              <rect
                key={`rb-${b.index}`}
                x={layout.labelCol.x}
                y={b.y - hitH / 2}
                width={Math.max(8, plot.x + plot.w - layout.labelCol.x)}
                height={hitH}
                fill={hoveredRow === b.index ? "rgba(59,130,246,0.18)" : "transparent"}
                style={{ cursor: "row-resize", touchAction: "none" }}
                onPointerEnter={() => setHoveredRow(b.index)}
                onPointerLeave={() => setHoveredRow((p) => (p === b.index ? null : p))}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  rowDragRef.current = {
                    index: b.index,
                    frozen: gridChartTrackPixelSizesFromEdges(layout.rowEdges),
                  };
                  onGanttDragSessionChange?.(true);
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  const session = rowDragRef.current;
                  if (!session) return;
                  const svg = e.currentTarget.ownerSVGElement;
                  if (!svg) return;
                  const pt = svgUserPointFromClient(svg, 0, e.clientY);
                  if (!pt) return;
                  const { trackPx, plotH } = adjustGridRowTracksGrowContainer(
                    session.frozen,
                    session.index,
                    pt.y,
                    plot.y
                  );
                  onRowTrackResize({
                    rowWeights: trackPx,
                    height: Math.max(40, (node.height ?? layout.body.h) + (plotH - plot.h)),
                  });
                }}
                onPointerUp={(e) => {
                  rowDragRef.current = null;
                  onGanttDragSessionChange?.(false);
                  try {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                  } catch {
                    /* ignore */
                  }
                }}
              />
            );
          })
        : null}
      {rowReorderTarget != null
        ? (
          <rect
            x={layout.labelCol.x}
            y={layout.rowEdges[rowReorderTarget] ?? plot.y}
            width={Math.max(8, plot.x + plot.w - layout.labelCol.x)}
            height={Math.max(
              4,
              (layout.rowEdges[rowReorderTarget + 1] ?? plot.y + plot.h) -
                (layout.rowEdges[rowReorderTarget] ?? plot.y)
            )}
            fill="hsl(var(--primary) / 0.12)"
            stroke="hsl(var(--primary))"
            strokeWidth={0.75}
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
        )
        : null}
      {ganttInteractive ? (
        <GridChartStructureChrome
          layout={layout}
          canInteract
          onDeleteRow={onDeleteGanttRow}
          onDeleteColumn={onDeleteGanttColumn}
          onMoveRow={onMoveGanttRow}
          onMoveColumn={onMoveGanttColumn}
          onInsertRow={onInsertGanttRow}
          onInsertColumn={onInsertGanttColumn}
          onDragSessionChange={onGanttDragSessionChange}
        />
      ) : null}
    </>
  );

  return (
    <div
      data-dw-gantt-chart-shell=""
      data-dw-highlight-anim={shellHighlightStyle ? "true" : undefined}
      className="relative box-border h-full w-full"
      style={{
        borderRadius: shellBorderRadius,
        overflow: ganttInteractive ? "visible" : "hidden",
        ...mergeCardShellHighlightStyle(shellHighlightStyle, undefined),
      }}
    >
      <SvgShapeBase
        {...svgBaseProps}
        defaultWidth={640}
        defaultHeight={400}
        viewBox={`0 0 ${layout.vbW} ${layout.vbH}`}
        borderRadius={shellBorderRadius}
        frostedClipRectInViewBox={{ x: body.x, y: body.y, w: body.w, h: body.h, rx: body.rx, ry: body.ry }}
        slideColorTransition={slideColorTransition}
        svgOverflowVisible={ganttInteractive}
        svgContent={svgContent}
      />
    </div>
  );
}

function isPhase(kind: "gate" | "task" | "phase"): boolean {
  return kind === "phase";
}
