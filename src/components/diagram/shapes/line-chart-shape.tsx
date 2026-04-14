"use client";

import React, { useEffect, useId, useState, useRef } from "react";
import { createPortal } from "react-dom";
import type { DiagramNodeData, NodeChartSpecLine, RichTextRun } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SvgShapeBase } from "./svg-shape-base";
import {
  chartInlineForeignObjectWidth,
  svgForeignObjectInlineInputStyle,
} from "./shape-utils";
import {
  buildLineChartLayout,
  lineAreaClosedPath,
  lineChartPolylineStrokeFallbackFromNodeBorder,
  linePathPolyline,
  linePathSmooth,
  resolveLineChartPolylineStrokeWidth,
} from "@/lib/line-chart-layout";
import { chartSegmentLegendEntries } from "@/lib/bar-chart-layout";

const VB_W = 100;
const VB_H = 68;
const LABEL_LINE_HEIGHT_EM = 1.15;

const DOT_POINTER_LEAVE_DELAY_MS = 140;
const DOT_HIT_PAD = 2.8;
/** Ignore double-click-to-edit after a drag gesture (screen px). */
const DOT_DRAG_SUPPRESS_DBLCLICK_PX = 6;

function svgUserPointFromClient(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number
): { x: number; y: number } | null {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const p = pt.matrixTransform(ctm.inverse());
  return { x: p.x, y: p.y };
}

function lineChartValueFromSvgY(
  svgY: number,
  plotY0: number,
  plotH: number,
  valueAxisMax: number
): number {
  if (!Number.isFinite(svgY) || plotH <= 0 || !Number.isFinite(valueAxisMax) || valueAxisMax <= 0) {
    return 0;
  }
  const t = (plotY0 + plotH - svgY) / plotH;
  const v = t * valueAxisMax;
  return Math.max(0, Number.isFinite(v) ? v : 0);
}

type DotDragSession = {
  pointerId: number;
  svg: SVGSVGElement;
  seriesIndex: number;
  categoryIndex: number;
  startClientX: number;
  startClientY: number;
  maxMove: number;
};

function LineSvgTextBlock(props: {
  lines: string[];
  x: number;
  yCenter: number;
  fontSize: number;
  textAnchor: "start" | "middle" | "end";
  fill: string;
  fontWeight: number;
  pointerEvents?: "auto" | "none";
  style?: React.CSSProperties;
  onPointerDown?: (e: React.PointerEvent<SVGTextElement>) => void;
  onDoubleClick?: (e: React.MouseEvent<SVGTextElement>) => void;
  extraSvgProps?: React.SVGProps<SVGTextElement>;
}) {
  const lh = props.fontSize * LABEL_LINE_HEIGHT_EM;
  const yFirst = props.yCenter - ((props.lines.length - 1) * lh) / 2;
  return (
    <text
      x={props.x}
      y={yFirst}
      textAnchor={props.textAnchor}
      dominantBaseline="middle"
      fill={props.fill}
      fontSize={props.fontSize}
      fontWeight={props.fontWeight}
      {...props.extraSvgProps}
      pointerEvents={props.pointerEvents}
      style={props.style}
      onPointerDown={props.onPointerDown}
      onDoubleClick={props.onDoubleClick}
    >
      {props.lines.map((line, i) => (
        <tspan key={i} x={props.x} dy={i === 0 ? 0 : lh}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

function formatAxisNumber(n: number): string {
  if (!Number.isFinite(n)) return "";
  if (Math.abs(n - Math.round(n)) < 1e-6) return String(Math.round(n));
  return n.toFixed(1).replace(/\.0$/, "");
}

interface LineChartShapeProps {
  node: DiagramNodeData & { width?: number; height?: number };
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
  onLineSeriesNameChange?: (seriesIndex: number, name: string) => void;
  onLineCategoryLabelChange?: (categoryIndex: number, label: string) => void;
  onLinePointValueChange?: (seriesIndex: number, categoryIndex: number, value: number) => void;
  /** Notifies parent to block canvas node drag while a point handle is held (react-dnd `canDrag`). */
  onLineChartPointDragSessionChange?: (active: boolean) => void;
}

type LineInlineEditState =
  | { kind: "series"; seriesIndex: number; fromLegend: boolean }
  | { kind: "category"; categoryIndex: number }
  | { kind: "value"; seriesIndex: number; categoryIndex: number };

export function LineChartShape(props: LineChartShapeProps) {
  const {
    isReadOnly = false,
    onLineSeriesNameChange,
    onLineCategoryLabelChange,
    onLinePointValueChange,
    onLineChartPointDragSessionChange,
    ...svgBaseProps
  } = props;
  const { node, slideColorTransition } = svgBaseProps;
  const chartRaw = node.chart;
  const chart: NodeChartSpecLine =
    chartRaw?.kind === "line"
      ? chartRaw
      : ({
          kind: "line",
          series: [],
        } as NodeChartSpecLine);

  const model = buildLineChartLayout(chart, { vbW: VB_W, vbH: VB_H });
  const vbH = model.vbH;

  const [hoveredDotKey, setHoveredDotKey] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const [inlineEdit, setInlineEdit] = useState<LineInlineEditState | null>(null);
  const [inlineDraft, setInlineDraft] = useState("");
  const inlineEditCancelledRef = useRef(false);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const layoutMetricsRef = useRef({ plot: { x0: 0, y0: 0, w: 0, h: 0 }, valueAxisMax: 1 });
  const dotDragRef = useRef<DotDragSession | null>(null);
  const suppressDblClickAfterDragRef = useRef(false);

  const series = chart.series;

  const cancelLeaveTimer = () => {
    const t = leaveTimerRef.current;
    if (t != null) {
      clearTimeout(t);
      leaveTimerRef.current = null;
    }
  };

  const scheduleLeave = () => {
    cancelLeaveTimer();
    leaveTimerRef.current = setTimeout(() => {
      leaveTimerRef.current = null;
      setHoveredDotKey(null);
      setTooltip(null);
    }, DOT_POINTER_LEAVE_DELAY_MS);
  };

  useEffect(() => {
    return () => {
      const t = leaveTimerRef.current;
      if (t != null) clearTimeout(t);
    };
  }, []);

  const commitInlineEdit = () => {
    if (inlineEditCancelledRef.current) {
      inlineEditCancelledRef.current = false;
      return;
    }
    if (!inlineEdit) return;
    if (inlineEdit.kind === "series" && onLineSeriesNameChange) {
      onLineSeriesNameChange(inlineEdit.seriesIndex, inlineDraft.trim());
    } else if (inlineEdit.kind === "category" && onLineCategoryLabelChange) {
      onLineCategoryLabelChange(inlineEdit.categoryIndex, inlineDraft.trim());
    } else if (inlineEdit.kind === "value" && onLinePointValueChange) {
      const raw = inlineDraft.trim().replace(/,/g, ".");
      const n = parseFloat(raw);
      if (Number.isFinite(n)) {
        onLinePointValueChange(inlineEdit.seriesIndex, inlineEdit.categoryIndex, Math.max(0, n));
      }
    }
    setInlineEdit(null);
  };

  const cancelInlineEdit = () => {
    inlineEditCancelledRef.current = true;
    setInlineEdit(null);
  };

  const canEditSeries = !isReadOnly && !!onLineSeriesNameChange;
  const canEditCategory = !isReadOnly && !!onLineCategoryLabelChange;
  const canEditValue = !isReadOnly && !!onLinePointValueChange;

  const filterId = `dw-line-sh-${useId().replace(/:/g, "")}`;
  const gradLineId = `dw-line-lg-${useId().replace(/:/g, "")}`;
  const gradAreaId = `dw-line-ag-${useId().replace(/:/g, "")}`;

  const borderStyle = node.borderStyle || "solid";
  const nodeStrokeW = borderStyle === "none" ? 0 : node.borderWidth || 2;
  const strokeColor = chart.sliceBorderColor?.trim() || node.borderColor || "#6b7280";
  const svgShadow = chart.shadow === true;
  const showLegend = chart.showLegend === true;
  const showValueAxis = chart.showValueAxis !== false;
  const showCategoryLabels = chart.showCategoryLabels !== false;
  const gridColor = chart.gridColor?.trim() || "rgba(148,163,184,0.45)";
  const axisColor = chart.axisColor?.trim() || strokeColor;
  const categoryLabels = chart.categoryLabels ?? [];
  const smooth = chart.smooth !== false;
  const showArea = chart.showAreaFill !== false;
  const areaOp = Math.max(0, Math.min(1, chart.areaFillOpacity ?? 0.42));
  const dotRConfigured =
    typeof chart.dotRadius === "number" && Number.isFinite(chart.dotRadius)
      ? Math.min(3, Math.max(0, chart.dotRadius))
      : null;
  const dotR = dotRConfigured != null && dotRConfigured > 0 ? dotRConfigured : 1.85;
  const showDots = chart.showDots !== false && (dotRConfigured == null ? true : dotRConfigured > 0);
  const lineStrokeW = resolveLineChartPolylineStrokeWidth(
    chart,
    lineChartPolylineStrokeFallbackFromNodeBorder(nodeStrokeW)
  );

  const {
    plot,
    valueAxisMax,
    valueTicks,
    categoryCount,
    baseY,
    categoryLabelFontSize,
    legendLabelFontSize,
    categoryLabelLines,
    legendLabelLines,
  } = model;

  layoutMetricsRef.current = { plot, valueAxisMax };

  useEffect(() => {
    if (!inlineEdit) return;
    if (inlineEdit.kind === "series") {
      if (!Array.isArray(series) || inlineEdit.seriesIndex >= series.length) setInlineEdit(null);
      return;
    }
    if (inlineEdit.kind === "category") {
      if (inlineEdit.categoryIndex >= categoryCount) setInlineEdit(null);
      return;
    }
    if (
      !Array.isArray(series) ||
      inlineEdit.seriesIndex >= series.length ||
      inlineEdit.categoryIndex >= categoryCount
    ) {
      setInlineEdit(null);
    }
  }, [series, inlineEdit, categoryCount]);

  const catSlot = plot.w / Math.max(1, categoryCount);

  const valueGridLines = valueTicks.map((t) => {
    const y = plot.y0 + plot.h - (t / valueAxisMax) * plot.h;
    return { x1: plot.x0, x2: plot.x0 + plot.w, y1: y, y2: y };
  });

  const categoryGridLines: { x1: number; x2: number; y1: number; y2: number }[] = [];
  for (let j = 0; j <= categoryCount; j++) {
    const x = plot.x0 + j * catSlot;
    categoryGridLines.push({ x1: x, x2: x, y1: plot.y0, y2: plot.y0 + plot.h });
  }

  const dotKey = (si: number, ci: number) => `s${si}-c${ci}`;

  const categoryName = (j: number) => {
    const raw = categoryLabels[j];
    if (raw != null && String(raw).trim()) return String(raw).trim();
    return `Point ${j + 1}`;
  };

  const showValueGrid = chart.showGridY === true;
  const showCategoryGrid = chart.showGridX === true;

  const gridEls = (
    <g pointerEvents="none">
      {showValueGrid
        ? valueGridLines.map((ln, i) => (
            <line
              key={`vg-${i}`}
              x1={ln.x1}
              y1={ln.y1}
              x2={ln.x2}
              y2={ln.y2}
              stroke={gridColor}
              strokeWidth={0.35}
              vectorEffect="non-scaling-stroke"
            />
          ))
        : null}
      {showCategoryGrid
        ? categoryGridLines.map((ln, i) => (
            <line
              key={`cg-${i}`}
              x1={ln.x1}
              y1={ln.y1}
              x2={ln.x2}
              y2={ln.y2}
              stroke={gridColor}
              strokeWidth={0.35}
              vectorEffect="non-scaling-stroke"
            />
          ))
        : null}
    </g>
  );

  const axisFont = 3.1;
  const valueLabels =
    showValueAxis &&
    valueTicks.map((t, i) => {
      const y = plot.y0 + plot.h - (t / valueAxisMax) * plot.h;
      return (
        <text
          key={`vt-${i}`}
          x={plot.x0 - 2}
          y={y + axisFont * 0.35}
          textAnchor="end"
          fill={axisColor}
          fontSize={axisFont}
          fontWeight={500}
          pointerEvents="none"
        >
          {formatAxisNumber(t)}
        </text>
      );
    });

  const catLabelsEls =
    showCategoryLabels && categoryLabels.length > 0
      ? categoryLabels.slice(0, categoryCount).map((raw, j) => {
          const lab = (raw ?? "").trim();
          if (!lab) return null;
          const catLines = categoryLabelLines[j] ?? [];
          if (catLines.length === 0) return null;
          const fullCat = String(raw ?? "");
          const editingCat = inlineEdit?.kind === "category" && inlineEdit.categoryIndex === j;
          const catFs = categoryLabelFontSize;
          const cx = plot.x0 + (j + 0.5) * catSlot;
          const ty = plot.y0 + plot.h + 3.6;
          const catMidY = ty - catFs * 0.35;
          if (editingCat) {
            const charCount = Math.max(4, inlineDraft.length, fullCat.length);
            const foW = chartInlineForeignObjectWidth({ charCount, fontSize: catFs });
            return (
              <foreignObject
                key={`cat-${j}`}
                x={cx - foW / 2}
                y={catMidY - catFs / 2}
                width={foW}
                height={catFs}
                style={{ overflow: "visible" }}
              >
                <input
                  type="text"
                  className="m-0 box-border min-w-0 max-w-full bg-transparent shadow-none focus:outline-none focus:ring-0"
                  style={svgForeignObjectInlineInputStyle({
                    fontSize: catFs,
                    fontWeight: 500,
                    color: axisColor,
                    caretColor: axisColor,
                    textAlign: "center",
                  })}
                  value={inlineDraft}
                  autoFocus
                  aria-label="Edit category label"
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setInlineDraft(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitInlineEdit();
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      cancelInlineEdit();
                    }
                  }}
                  onBlur={() => commitInlineEdit()}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => e.stopPropagation()}
                />
              </foreignObject>
            );
          }
          return (
            <LineSvgTextBlock
              key={`cat-${j}`}
              lines={catLines}
              x={cx}
              yCenter={catMidY}
              fontSize={catFs}
              textAnchor="middle"
              fill={axisColor}
              fontWeight={500}
              pointerEvents={canEditCategory ? "auto" : "none"}
              style={{ cursor: canEditCategory ? "text" : undefined }}
              onPointerDown={(e) => canEditCategory && e.stopPropagation()}
              onDoubleClick={(e) => {
                if (!canEditCategory) return;
                e.stopPropagation();
                e.preventDefault();
                setInlineDraft(fullCat);
                setInlineEdit({ kind: "category", categoryIndex: j });
              }}
            />
          );
        })
      : null;

  const legendList = showLegend ? chartSegmentLegendEntries(series) : [];
  const legendSlotW =
    showLegend && legendList.length > 0 ? plot.w / Math.max(1, legendList.length) : 0;
  const legendYLift = 1.5;

  const legendEls =
    showLegend && legendList.length > 0 ? (
      <g aria-label="Legend">
        {legendList.map((en, i) => {
          const cx = plot.x0 + (i + 0.5) * legendSlotW;
          const sw = 3;
          const fullLegName = (series?.[en.segmentIndex]?.name ?? en.name) || "";
          const legendNameEdit =
            inlineEdit?.kind === "series" &&
            inlineEdit.fromLegend &&
            inlineEdit.seriesIndex === en.segmentIndex;
          const legFont = legendLabelFontSize;
          const legLines = legendLabelLines[i] ?? [en.name];
          const tx = -legendSlotW / 2 + sw + 1.8;
          const ty = vbH - 3.5 - legendYLift;
          const legMidY = ty - legFont * 0.35;
          const legFoH = legFont;
          const legFoW = legendNameEdit
            ? chartInlineForeignObjectWidth({
                charCount: Math.max(4, inlineDraft.length, fullLegName.length),
                fontSize: legFont,
              })
            : 0;
          return (
            <g key={`leg-${en.segmentIndex}`} transform={`translate(${cx}, 0)`}>
              <line
                x1={-legendSlotW / 2 + 0.5}
                x2={-legendSlotW / 2 + sw + 0.5}
                y1={legMidY}
                y2={legMidY}
                stroke={
                  en.fillMode === "none"
                    ? axisColor
                    : en.fillMode === "gradient"
                      ? `url(#${gradLineId}-leg-${i})`
                      : en.solidFill
                }
                strokeWidth={1.1}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
              {en.fillMode !== "none" ? (
                <circle
                  cx={-legendSlotW / 2 + sw * 0.55}
                  cy={legMidY}
                  r={1.15}
                  fill={en.fillMode === "gradient" ? `url(#${gradLineId}-leg-${i})` : en.solidFill}
                  stroke="rgba(255,255,255,0.85)"
                  strokeWidth={0.35}
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="none"
                />
              ) : null}
              {legendNameEdit ? (
                <foreignObject
                  x={tx}
                  y={legMidY - legFoH / 2}
                  width={legFoW}
                  height={legFoH}
                  style={{ overflow: "visible" }}
                >
                  <input
                    type="text"
                    className="m-0 box-border min-w-0 max-w-full bg-transparent shadow-none focus:outline-none focus:ring-0"
                    style={svgForeignObjectInlineInputStyle({
                      fontSize: legFont,
                      fontWeight: 500,
                      color: axisColor,
                      caretColor: axisColor,
                      textAlign: "left",
                    })}
                    value={inlineDraft}
                    autoFocus
                    aria-label="Edit legend series name"
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setInlineDraft(e.target.value)}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitInlineEdit();
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        cancelInlineEdit();
                      }
                    }}
                    onBlur={() => commitInlineEdit()}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => e.stopPropagation()}
                  />
                </foreignObject>
              ) : (
                <LineSvgTextBlock
                  lines={legLines}
                  x={tx}
                  yCenter={legMidY}
                  fontSize={legFont}
                  textAnchor="start"
                  fill={axisColor}
                  fontWeight={500}
                  pointerEvents={canEditSeries ? "auto" : "none"}
                  style={{ cursor: canEditSeries ? "text" : undefined }}
                  onPointerDown={(e) => canEditSeries && e.stopPropagation()}
                  onDoubleClick={(e) => {
                    if (!canEditSeries) return;
                    e.stopPropagation();
                    e.preventDefault();
                    setInlineDraft(fullLegName);
                    setInlineEdit({ kind: "series", seriesIndex: en.segmentIndex, fromLegend: true });
                  }}
                />
              )}
            </g>
          );
        })}
      </g>
    ) : null;

  const chartDefs = (
    <>
      {legendList.map((en, i) =>
        en.fillMode === "gradient" ? (
          <linearGradient
            key={`lg-leg-${i}`}
            id={`${gradLineId}-leg-${i}`}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="0%"
            gradientUnits="objectBoundingBox"
          >
            <stop offset="0%" stopColor={en.gradientColor1} />
            <stop offset="100%" stopColor={en.gradientColor2} />
          </linearGradient>
        ) : null
      )}
      {model.series.map((sLayout, si) => (
        <React.Fragment key={`def-s-${si}`}>
          {sLayout.fillMode === "gradient" ? (
            <linearGradient
              id={`${gradLineId}-series-${si}`}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="0%"
              gradientUnits="objectBoundingBox"
            >
              <stop offset="0%" stopColor={sLayout.gradientColor1} />
              <stop offset="100%" stopColor={sLayout.gradientColor2} />
            </linearGradient>
          ) : null}
          {showArea && sLayout.fillMode !== "none" ? (
            <linearGradient
              id={`${gradAreaId}-series-${si}`}
              x1={plot.x0}
              y1={plot.y0}
              x2={plot.x0}
              y2={baseY}
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor={sLayout.strokeRgb} stopOpacity={areaOp} />
              <stop offset="100%" stopColor={sLayout.strokeRgb} stopOpacity={0} />
            </linearGradient>
          ) : null}
        </React.Fragment>
      ))}
    </>
  );

  const seriesLayers = model.series.map((sLayout, si) => {
    const pts = sLayout.points;
    if (pts.length === 0) return null;
    const lineD = smooth ? linePathSmooth(pts) : linePathPolyline(pts);
    const areaD =
      showArea && sLayout.fillMode !== "none" ? lineAreaClosedPath(pts, smooth, baseY) : "";
    const isHoveredLine = pts.some((_, ci) => hoveredDotKey === dotKey(si, ci));

    const strokePaint =
      sLayout.fillMode === "gradient"
        ? `url(#${gradLineId}-series-${si})`
        : sLayout.fillMode === "none"
          ? sLayout.strokeRgb
          : sLayout.stroke;

    return (
      <g key={`series-${si}`}>
        {areaD ? (
          <path
            d={areaD}
            fill={`url(#${gradAreaId}-series-${si})`}
            stroke="none"
            style={{ pointerEvents: "none" }}
          />
        ) : null}
        <path
          d={lineD}
          fill="none"
          stroke={strokePaint}
          strokeWidth={isHoveredLine ? lineStrokeW + 0.35 : lineStrokeW}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          style={{
            filter: isHoveredLine ? "brightness(1.08)" : undefined,
            pointerEvents: "none",
          }}
        />
        {showDots
          ? pts.map((p) => {
              const dk = dotKey(si, p.categoryIndex);
              const hover = hoveredDotKey === dk;
              const tip = `${sLayout.name}\n${categoryName(p.categoryIndex)}: ${formatAxisNumber(p.value)}`;
              const editingValue =
                canEditValue &&
                inlineEdit?.kind === "value" &&
                inlineEdit.seriesIndex === si &&
                inlineEdit.categoryIndex === p.categoryIndex;
              const vFo = editingValue
                ? chartInlineForeignObjectWidth({
                    charCount: Math.max(4, inlineDraft.length, formatAxisNumber(p.value).length),
                    fontSize: 3.2,
                    minWidth: 10,
                  })
                : 0;
              return (
                <g key={dk}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={dotR + DOT_HIT_PAD}
                    fill="transparent"
                    stroke="none"
                    data-dw-line-chart-point-handle=""
                    onMouseDownCapture={(e) => {
                      if (!canEditValue || !onLinePointValueChange) return;
                      e.stopPropagation();
                    }}
                    style={{
                      cursor: canEditValue ? "ns-resize" : "default",
                      touchAction: "none",
                    }}
                    onPointerEnter={(e) => {
                      if (dotDragRef.current) return;
                      cancelLeaveTimer();
                      setHoveredDotKey(dk);
                      setTooltip({ x: e.clientX, y: e.clientY, text: tip });
                    }}
                    onPointerMove={(e) => {
                      const drag = dotDragRef.current;
                      if (
                        drag &&
                        drag.pointerId === e.pointerId &&
                        canEditValue &&
                        onLinePointValueChange
                      ) {
                        drag.maxMove = Math.max(
                          drag.maxMove,
                          Math.abs(e.clientX - drag.startClientX),
                          Math.abs(e.clientY - drag.startClientY)
                        );
                        const pt = svgUserPointFromClient(drag.svg, e.clientX, e.clientY);
                        const { plot: pl, valueAxisMax: vmax } = layoutMetricsRef.current;
                        const v = pt
                          ? lineChartValueFromSvgY(pt.y, pl.y0, pl.h, vmax)
                          : null;
                        if (v != null) {
                          onLinePointValueChange(drag.seriesIndex, drag.categoryIndex, v);
                          cancelLeaveTimer();
                          setHoveredDotKey(dk);
                          setTooltip({
                            x: e.clientX,
                            y: e.clientY,
                            text: `${sLayout.name}\n${categoryName(p.categoryIndex)}: ${formatAxisNumber(v)}`,
                          });
                        }
                        return;
                      }
                      setTooltip((prev) =>
                        prev
                          ? { ...prev, x: e.clientX, y: e.clientY }
                          : { x: e.clientX, y: e.clientY, text: tip }
                      );
                    }}
                    onPointerLeave={(e) => {
                      const drag = dotDragRef.current;
                      if (drag && drag.pointerId === e.pointerId) return;
                      scheduleLeave();
                    }}
                    onPointerDown={(e) => {
                      if (!canEditValue || !onLinePointValueChange) return;
                      e.stopPropagation();
                      const svg = e.currentTarget.ownerSVGElement;
                      if (!svg) return;
                      onLineChartPointDragSessionChange?.(true);
                      try {
                        e.currentTarget.setPointerCapture(e.pointerId);
                      } catch {
                        /* ignore */
                      }
                      dotDragRef.current = {
                        pointerId: e.pointerId,
                        svg,
                        seriesIndex: si,
                        categoryIndex: p.categoryIndex,
                        startClientX: e.clientX,
                        startClientY: e.clientY,
                        maxMove: 0,
                      };
                    }}
                    onPointerUp={(e) => {
                      const drag = dotDragRef.current;
                      if (drag && drag.pointerId === e.pointerId) {
                        if (drag.maxMove >= DOT_DRAG_SUPPRESS_DBLCLICK_PX) {
                          suppressDblClickAfterDragRef.current = true;
                          window.setTimeout(() => {
                            suppressDblClickAfterDragRef.current = false;
                          }, 450);
                        }
                        try {
                          e.currentTarget.releasePointerCapture(e.pointerId);
                        } catch {
                          /* ignore */
                        }
                        dotDragRef.current = null;
                      }
                      onLineChartPointDragSessionChange?.(false);
                    }}
                    onPointerCancel={(e) => {
                      const drag = dotDragRef.current;
                      if (drag && drag.pointerId === e.pointerId) {
                        try {
                          e.currentTarget.releasePointerCapture(e.pointerId);
                        } catch {
                          /* ignore */
                        }
                        dotDragRef.current = null;
                      }
                      onLineChartPointDragSessionChange?.(false);
                    }}
                    onLostPointerCapture={() => {
                      dotDragRef.current = null;
                      onLineChartPointDragSessionChange?.(false);
                    }}
                    onDoubleClick={(e) => {
                      if (!canEditValue) return;
                      if (suppressDblClickAfterDragRef.current) {
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                      }
                      e.stopPropagation();
                      e.preventDefault();
                      const v = p.value;
                      setInlineDraft(Number.isInteger(v) ? String(Math.round(v)) : String(v));
                      setInlineEdit({ kind: "value", seriesIndex: si, categoryIndex: p.categoryIndex });
                    }}
                  />
                  {!editingValue ? (
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={hover ? dotR * 1.22 : dotR}
                      fill={sLayout.strokeRgb}
                      stroke="rgba(255,255,255,0.92)"
                      strokeWidth={hover ? 0.95 : 0.75}
                      vectorEffect="non-scaling-stroke"
                      style={{
                        pointerEvents: "none",
                        filter: hover ? "drop-shadow(0 1px 2px rgba(0,0,0,0.25))" : undefined,
                      }}
                    />
                  ) : null}
                  {editingValue ? (
                    <foreignObject
                      x={p.x - vFo / 2}
                      y={p.y - 1.6}
                      width={vFo}
                      height={3.2}
                      style={{ overflow: "visible" }}
                    >
                      <input
                        type="text"
                        inputMode="decimal"
                        className="m-0 box-border min-w-0 max-w-full bg-transparent shadow-none focus:outline-none focus:ring-0"
                        style={svgForeignObjectInlineInputStyle({
                          fontSize: 3.2,
                          fontWeight: 600,
                          color: sLayout.labelColor,
                          caretColor: sLayout.labelColor,
                          textAlign: "center",
                        })}
                        value={inlineDraft}
                        autoFocus
                        aria-label="Edit value"
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setInlineDraft(e.target.value)}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === "Enter") {
                            e.preventDefault();
                            commitInlineEdit();
                          } else if (e.key === "Escape") {
                            e.preventDefault();
                            cancelInlineEdit();
                          }
                        }}
                        onBlur={() => commitInlineEdit()}
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => e.stopPropagation()}
                      />
                    </foreignObject>
                  ) : null}
                </g>
              );
            })
          : null}
      </g>
    );
  });

  const defs = (
    <defs>
      {svgShadow ? (
        <filter id={filterId} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodOpacity="0.3" />
        </filter>
      ) : null}
      {chartDefs}
    </defs>
  );

  const plotBody = (
    <>
      {defs}
      {gridEls}
      {svgShadow ? <g filter={`url(#${filterId})`}>{seriesLayers}</g> : seriesLayers}
      {valueLabels}
      {catLabelsEls}
      {legendEls}
    </>
  );

  return (
    <>
      <SvgShapeBase
        {...svgBaseProps}
        viewBox={`0 0 ${VB_W} ${vbH}`}
        preserveAspectRatio="xMidYMid meet"
        defaultWidth={100}
        defaultHeight={68}
        slideColorTransition={slideColorTransition}
        svgOverflowVisible={svgShadow}
        svgContent={plotBody}
      />
      {tooltip != null && typeof document !== "undefined"
        ? createPortal(
            <div
              role="tooltip"
              className={cn(
                "pointer-events-none fixed z-[10000] max-w-[220px] whitespace-pre-line rounded-md border border-border",
                "bg-popover px-2 py-1 text-xs font-medium text-popover-foreground shadow-md"
              )}
              style={{
                left: tooltip.x + 12,
                top: tooltip.y + 12,
              }}
            >
              {tooltip.text}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
