"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { DiagramNodeData, NodeChartSpec, NodeChartSpecBar, RichTextRun } from "@/lib/types";
import { lerpNodeChartForSlide } from "@/lib/chart-slide-lerp";
import { cn } from "@/lib/utils";
import { SvgShapeBase } from "./svg-shape-base";
import {
  chartInlineForeignObjectWidth,
  getGradientCoordinates,
  svgForeignObjectInlineInputStyle,
} from "./shape-utils";
import {
  barChartWantsRoundedColumnEnds,
  barColumnAutoRoundRadius,
  barColumnClipPathHorizontal,
  barColumnClipPathVertical,
  barLegendEntries,
  buildBarChartLayout,
  wrapBarLabelLines,
  type BarRect,
} from "@/lib/bar-chart-layout";
import {
  chartValueFromHorizontalValueAxis,
  chartValueFromVerticalValueAxis,
  svgUserPointFromClient,
} from "@/lib/chart-pointer-geometry";
import {
  chartSegmentPopAnimationStyle,
  chartSegmentPopKeyframesCss,
  type ChartSlideStagger,
} from "@/lib/chart-presentation-stagger";

const VB_W = 100;
const VB_H = 68;
/** Line spacing for wrapped bar labels (matches `bar-chart-layout`). */
const BAR_LABEL_LINE_HEIGHT_EM = 1.15;

function BarSvgTextBlock(props: {
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
  const lh = props.fontSize * BAR_LABEL_LINE_HEIGHT_EM;
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

const MIN_BAR_DIM_FOR_VALUE = 4.5;
/** When values aren’t drawn in segments, defer clearing hover tooltip across brief pointer gaps. */
const BAR_CELL_POINTER_LEAVE_DELAY_MS = 140;
/** Invisible stroke widens bar hit targets slightly (viewBox units, non-scaling). */
const BAR_HIT_STROKE_PAD = 0.75;
/** Ignore double-click value edit after a bar value drag (screen px). */
const BAR_CELL_DRAG_SUPPRESS_DBLCLICK_PX = 6;

type BarCellDragSession = {
  pointerId: number;
  svg: SVGSVGElement;
  segmentIndex: number;
  categoryIndex: number;
  startClientX: number;
  startClientY: number;
  maxMove: number;
  /** Cumulative axis value at pointer (pointerdown). */
  startAxisValue: number;
  /** `series[segmentIndex].values[categoryIndex]` at pointerdown (same render as the bar rect). */
  startCellValue: number;
};

interface BarChartShapeProps {
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
  onBarSegmentNameChange?: (segmentIndex: number, name: string) => void;
  /** Double-click category axis label; updates `chart.categoryLabels`. */
  onBarCategoryLabelChange?: (categoryIndex: number, label: string) => void;
  /** Double-click in-bar numeric value; updates `series[segmentIndex].values[categoryIndex]`. */
  onBarCellValueChange?: (segmentIndex: number, categoryIndex: number, value: number) => void;
  /** Blocks canvas node drag while a bar segment value drag is active (react-dnd `canDrag`). */
  onBarChartValueDragSessionChange?: (active: boolean) => void;
  presentationChartStagger?: ChartSlideStagger;
  presentationChartLerpU?: number;
  presentationChartLerpFromJson?: string;
}

type BarInlineEditState =
  | { kind: "segment"; segmentIndex: number; fromLegend: boolean }
  | { kind: "category"; categoryIndex: number }
  | { kind: "value"; segmentIndex: number; categoryIndex: number };

function formatAxisNumber(n: number): string {
  if (!Number.isFinite(n)) return "";
  if (Math.abs(n - Math.round(n)) < 1e-6) return String(Math.round(n));
  return n.toFixed(1).replace(/\.0$/, "");
}

export function BarChartShape(props: BarChartShapeProps) {
  const {
    isReadOnly = false,
    onBarSegmentNameChange,
    onBarCategoryLabelChange,
    onBarCellValueChange,
    onBarChartValueDragSessionChange,
    presentationChartStagger,
    presentationChartLerpU,
    presentationChartLerpFromJson,
    ...svgBaseProps
  } = props;
  const { node, slideColorTransition } = svgBaseProps;
  const chartRaw = node.chart;
  const chartBase: NodeChartSpecBar =
    chartRaw?.kind === "bar"
      ? chartRaw
      : ({
          kind: "bar",
          series: [],
          vertical: true,
        } as NodeChartSpecBar);

  const chart = useMemo(() => {
    if (
      presentationChartLerpFromJson == null ||
      presentationChartLerpU == null ||
      presentationChartLerpU >= 1 - 1e-9
    ) {
      return chartBase;
    }
    try {
      const from = JSON.parse(presentationChartLerpFromJson) as NodeChartSpec;
      if (!from || from.kind !== "bar" || chartBase.kind !== "bar") return chartBase;
      return lerpNodeChartForSlide(from, chartBase, presentationChartLerpU) as NodeChartSpecBar;
    } catch {
      return chartBase;
    }
  }, [chartBase, presentationChartLerpFromJson, presentationChartLerpU]);

  const model = buildBarChartLayout(chart, { vbW: VB_W, vbH: VB_H });
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [barCellHoverTooltip, setBarCellHoverTooltip] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);
  const [inlineEdit, setInlineEdit] = useState<BarInlineEditState | null>(null);
  const [inlineDraft, setInlineDraft] = useState("");
  const inlineEditCancelledRef = useRef(false);
  const barPointerLeaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const layoutMetricsRef = useRef({
    plot: { x0: 0, y0: 0, w: 0, h: 0 },
    valueAxisMax: 1,
    vertical: true,
  });
  const barCellDragRef = useRef<BarCellDragSession | null>(null);
  const suppressBarValueDblClickAfterDragRef = useRef(false);

  const series = chart.series;

  const commitInlineEdit = () => {
    if (inlineEditCancelledRef.current) {
      inlineEditCancelledRef.current = false;
      return;
    }
    if (!inlineEdit) return;
    if (inlineEdit.kind === "segment") {
      if (onBarSegmentNameChange) {
        onBarSegmentNameChange(inlineEdit.segmentIndex, inlineDraft.trim());
      }
    } else if (inlineEdit.kind === "category") {
      if (onBarCategoryLabelChange) {
        onBarCategoryLabelChange(inlineEdit.categoryIndex, inlineDraft.trim());
      }
    } else if (inlineEdit.kind === "value" && onBarCellValueChange) {
      const raw = inlineDraft.trim().replace(/,/g, ".");
      const n = parseFloat(raw);
      if (Number.isFinite(n)) {
        onBarCellValueChange(
          inlineEdit.segmentIndex,
          inlineEdit.categoryIndex,
          Math.max(0, n)
        );
      }
    }
    setInlineEdit(null);
  };

  const cancelInlineEdit = () => {
    inlineEditCancelledRef.current = true;
    setInlineEdit(null);
  };

  const canEditSegment = !isReadOnly && !!onBarSegmentNameChange;
  const canEditCategory = !isReadOnly && !!onBarCategoryLabelChange;
  const canEditValue = !isReadOnly && !!onBarCellValueChange;
  const canDragBarValue =
    canEditValue && typeof onBarChartValueDragSessionChange === "function";

  const cancelBarLeaveTimer = () => {
    const t = barPointerLeaveTimerRef.current;
    if (t != null) {
      clearTimeout(t);
      barPointerLeaveTimerRef.current = null;
    }
  };

  const scheduleBarLeave = () => {
    cancelBarLeaveTimer();
    barPointerLeaveTimerRef.current = setTimeout(() => {
      barPointerLeaveTimerRef.current = null;
      setHoveredKey(null);
      setBarCellHoverTooltip(null);
    }, BAR_CELL_POINTER_LEAVE_DELAY_MS);
  };

  useEffect(() => {
    return () => {
      const t = barPointerLeaveTimerRef.current;
      if (t != null) {
        clearTimeout(t);
        barPointerLeaveTimerRef.current = null;
      }
    };
  }, []);
  const filterId = `dw-bar-sh-${useId().replace(/:/g, "")}`;
  const gradBaseId = `dw-bar-g-${useId().replace(/:/g, "")}`;
  const clipBaseId = `dw-bar-clip-${useId().replace(/:/g, "")}`;
  const barSegAnimBase = `dwBarSeg${useId().replace(/:/g, "")}`;
  const barSegPopInId = `${barSegAnimBase}In`;
  const barSegPopOutId = `${barSegAnimBase}Out`;
  const gradientAngle = node.gradientAngle ?? 135;
  const gradCoords = getGradientCoordinates(gradientAngle);

  const borderStyle = node.borderStyle || "solid";
  const strokeWidth = borderStyle === "none" ? 0 : node.borderWidth || 2;
  const strokeColor = chart.sliceBorderColor?.trim() || node.borderColor || "#6b7280";
  const svgShadow = chart.shadow === true;
  const showSegmentLabels = chart.showSegmentLabels !== false;
  const showSegmentValues = chart.showSegmentValues === true;
  const showLegend = chart.showLegend === true;
  const showValueAxis = chart.showValueAxis !== false;
  const showCategoryLabels = chart.showCategoryLabels !== false;
  const gridColor = chart.gridColor?.trim() || "rgba(148,163,184,0.45)";
  const axisColor = chart.axisColor?.trim() || strokeColor;
  const categoryLabels = chart.categoryLabels ?? [];

  const {
    plot,
    valueAxisMax,
    valueTicks,
    categoryCount,
    vertical,
    vbH,
    categoryLabelFontSize,
    legendLabelFontSize,
    categoryLabelLines,
    legendLabelLines,
  } = model;

  layoutMetricsRef.current = { plot, valueAxisMax, vertical };

  useEffect(() => {
    if (!inlineEdit) return;
    if (inlineEdit.kind === "segment") {
      if (!Array.isArray(series) || inlineEdit.segmentIndex >= series.length) {
        setInlineEdit(null);
      }
      return;
    }
    if (inlineEdit.kind === "category") {
      if (inlineEdit.categoryIndex >= categoryCount) setInlineEdit(null);
      return;
    }
    if (inlineEdit.kind === "value") {
      if (
        !Array.isArray(series) ||
        inlineEdit.segmentIndex >= series.length ||
        inlineEdit.categoryIndex >= categoryCount
      ) {
        setInlineEdit(null);
      }
    }
  }, [series, inlineEdit, categoryCount]);

  const catSlot = vertical ? plot.w / Math.max(1, categoryCount) : plot.h / Math.max(1, categoryCount);

  const valueGridLines = valueTicks.map((t) => {
    if (vertical) {
      const y = plot.y0 + plot.h - (t / valueAxisMax) * plot.h;
      return { x1: plot.x0, x2: plot.x0 + plot.w, y1: y, y2: y };
    }
    const x = plot.x0 + (t / valueAxisMax) * plot.w;
    return { x1: x, x2: x, y1: plot.y0, y2: plot.y0 + plot.h };
  });

  const categoryGridLines: { x1: number; x2: number; y1: number; y2: number }[] = [];
  for (let j = 0; j <= categoryCount; j++) {
    if (vertical) {
      const x = plot.x0 + j * catSlot;
      categoryGridLines.push({ x1: x, x2: x, y1: plot.y0, y2: plot.y0 + plot.h });
    } else {
      const y = plot.y0 + j * catSlot;
      categoryGridLines.push({ x1: plot.x0, x2: plot.x0 + plot.w, y1: y, y2: y });
    }
  }

  const rectKey = (r: BarRect) => `s${r.segmentIndex}-c${r.categoryIndex}`;

  const barStaggerIndex = useMemo(() => {
    const sorted = [...model.rects].sort((a, b) =>
      a.categoryIndex !== b.categoryIndex
        ? a.categoryIndex - b.categoryIndex
        : a.segmentIndex - b.segmentIndex
    );
    const m = new Map<string, number>();
    sorted.forEach((r, idx) => {
      m.set(rectKey(r), idx);
    });
    return m;
  }, [model.rects]);

  const barDragTooltipText = (r: BarRect, v: number) => {
    const cat =
      (categoryLabels[r.categoryIndex] ?? "").trim() ||
      `Column ${r.categoryIndex + 1}`;
    const seg =
      (series?.[r.segmentIndex]?.name ?? r.name) || `Series ${r.segmentIndex + 1}`;
    return `${seg}\n${cat}: ${formatAxisNumber(v)}`;
  };

  const valueFromPointerClient = (
    svg: SVGSVGElement,
    clientX: number,
    clientY: number
  ): number | null => {
    const pt = svgUserPointFromClient(svg, clientX, clientY);
    if (!pt) return null;
    const { plot: pl, valueAxisMax: vmax, vertical: vert } = layoutMetricsRef.current;
    return vert
      ? chartValueFromVerticalValueAxis(pt.y, pl.y0, pl.h, vmax)
      : chartValueFromHorizontalValueAxis(pt.x, pl.x0, pl.w, vmax);
  };

  /** Hit layer (invisible pad) or filled rect: hover tip + optional value drag. */
  const barSegmentInteractionHandlers = (r: BarRect, layer: "hit" | "fill") => {
    const k = rectKey(r);
    const tipText =
      layer === "hit" && !showSegmentValues && Number.isFinite(r.value)
        ? formatAxisNumber(r.value)
        : "";
    const showTip = tipText !== "";
    const resizeCursor = vertical ? "ns-resize" : "ew-resize";

    const dragProps: Record<string, unknown> = canDragBarValue
      ? {
          "data-dw-bar-cell-value-handle": "",
          onMouseDownCapture: (e: React.MouseEvent<SVGRectElement>) => {
            e.stopPropagation();
          },
          onDoubleClick: (e: React.MouseEvent<SVGRectElement>) => {
            if (suppressBarValueDblClickAfterDragRef.current) {
              e.preventDefault();
              e.stopPropagation();
              return;
            }
            if (!onBarCellValueChange) return;
            e.stopPropagation();
            e.preventDefault();
            const v = r.value;
            setInlineDraft(
              Number.isInteger(v) ? String(Math.round(v)) : String(v)
            );
            setInlineEdit({
              kind: "value",
              segmentIndex: r.segmentIndex,
              categoryIndex: r.categoryIndex,
            });
          },
          onPointerDown: (e: React.PointerEvent<SVGRectElement>) => {
            if (!onBarCellValueChange) return;
            e.stopPropagation();
            const svg = e.currentTarget.ownerSVGElement;
            if (!svg) return;
            const startAxis =
              valueFromPointerClient(svg, e.clientX, e.clientY) ?? 0;
            onBarChartValueDragSessionChange?.(true);
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              /* ignore */
            }
            barCellDragRef.current = {
              pointerId: e.pointerId,
              svg,
              segmentIndex: r.segmentIndex,
              categoryIndex: r.categoryIndex,
              startClientX: e.clientX,
              startClientY: e.clientY,
              maxMove: 0,
              startAxisValue: startAxis,
              startCellValue: Number.isFinite(r.value) ? r.value : 0,
            };
          },
          onPointerUp: (e: React.PointerEvent<SVGRectElement>) => {
            const drag = barCellDragRef.current;
            if (drag && drag.pointerId === e.pointerId) {
              if (drag.maxMove >= BAR_CELL_DRAG_SUPPRESS_DBLCLICK_PX) {
                suppressBarValueDblClickAfterDragRef.current = true;
                window.setTimeout(() => {
                  suppressBarValueDblClickAfterDragRef.current = false;
                }, 450);
              }
              try {
                e.currentTarget.releasePointerCapture(e.pointerId);
              } catch {
                /* ignore */
              }
              barCellDragRef.current = null;
            }
            onBarChartValueDragSessionChange?.(false);
          },
          onPointerCancel: (e: React.PointerEvent<SVGRectElement>) => {
            const drag = barCellDragRef.current;
            if (drag && drag.pointerId === e.pointerId) {
              try {
                e.currentTarget.releasePointerCapture(e.pointerId);
              } catch {
                /* ignore */
              }
              barCellDragRef.current = null;
            }
            onBarChartValueDragSessionChange?.(false);
          },
          onLostPointerCapture: () => {
            barCellDragRef.current = null;
            onBarChartValueDragSessionChange?.(false);
          },
        }
      : {};

    return {
      onPointerEnter: (e: React.PointerEvent<SVGRectElement>) => {
        if (barCellDragRef.current) return;
        cancelBarLeaveTimer();
        setHoveredKey(k);
        if (showTip) {
          setBarCellHoverTooltip({
            x: e.clientX,
            y: e.clientY,
            text: tipText,
          });
        } else {
          setBarCellHoverTooltip(null);
        }
      },
      onPointerMove: (e: React.PointerEvent<SVGRectElement>) => {
        const drag = barCellDragRef.current;
        if (
          drag &&
          drag.pointerId === e.pointerId &&
          canDragBarValue &&
          onBarCellValueChange
        ) {
          drag.maxMove = Math.max(
            drag.maxMove,
            Math.abs(e.clientX - drag.startClientX),
            Math.abs(e.clientY - drag.startClientY)
          );
          const axisV = valueFromPointerClient(drag.svg, e.clientX, e.clientY);
          if (axisV != null) {
            const v = Math.max(
              0,
              drag.startCellValue + axisV - drag.startAxisValue
            );
            onBarCellValueChange(drag.segmentIndex, drag.categoryIndex, v);
            cancelBarLeaveTimer();
            setHoveredKey(k);
            setBarCellHoverTooltip({
              x: e.clientX,
              y: e.clientY,
              text: barDragTooltipText(r, v),
            });
          }
          return;
        }
        if (!showTip) return;
        setBarCellHoverTooltip((prev) =>
          prev
            ? { ...prev, x: e.clientX, y: e.clientY }
            : { x: e.clientX, y: e.clientY, text: tipText }
        );
      },
      onPointerLeave: (e: React.PointerEvent<SVGRectElement>) => {
        const drag = barCellDragRef.current;
        if (drag && drag.pointerId === e.pointerId) return;
        scheduleBarLeave();
      },
      ...dragProps,
      style: {
        cursor: canDragBarValue ? resizeCursor : "default",
        ...(canDragBarValue ? { touchAction: "none" as const } : {}),
      },
    } as React.SVGProps<SVGRectElement>;
  };

  /** Hover value tooltip on segments when values aren’t rendered in the bar (see `showSegmentValues`). */
  const barRectValueTooltipHandlers = (r: BarRect) => {
    const k = rectKey(r);
    const tipText =
      !showSegmentValues && Number.isFinite(r.value) ? formatAxisNumber(r.value) : "";
    const showTip = tipText !== "";
    return {
      onPointerEnter: (e: React.PointerEvent<SVGElement>) => {
        cancelBarLeaveTimer();
        setHoveredKey(k);
        if (showTip) {
          setBarCellHoverTooltip({
            x: e.clientX,
            y: e.clientY,
            text: tipText,
          });
        } else {
          setBarCellHoverTooltip(null);
        }
      },
      onPointerMove: (e: React.PointerEvent<SVGElement>) => {
        if (!showTip) return;
        setBarCellHoverTooltip((prev) =>
          prev
            ? { ...prev, x: e.clientX, y: e.clientY }
            : { x: e.clientX, y: e.clientY, text: tipText }
        );
      },
      onPointerLeave: scheduleBarLeave,
    };
  };

  const barHoveredCategoryIndex = (key: string | null): number | null => {
    if (!key) return null;
    const i = key.indexOf("-c");
    if (i < 0) return null;
    const n = parseInt(key.slice(i + 2), 10);
    return Number.isFinite(n) ? n : null;
  };

  const useRoundedColumnEnds = useMemo(() => barChartWantsRoundedColumnEnds(chart), [chart]);

  const rectsByCategory = useMemo(() => {
    const m = new Map<number, BarRect[]>();
    for (const r of model.rects) {
      const arr = m.get(r.categoryIndex) ?? [];
      arr.push(r);
      m.set(r.categoryIndex, arr);
    }
    return m;
  }, [model.rects]);

  const columnClipByCat = useMemo(() => {
    const m = new Map<number, string | null>();
    if (!useRoundedColumnEnds) return m;
    for (let j = 0; j < categoryCount; j++) {
      const list = rectsByCategory.get(j) ?? [];
      const rAuto = barColumnAutoRoundRadius(list, vertical);
      const d = vertical
        ? barColumnClipPathVertical(list, rAuto)
        : barColumnClipPathHorizontal(list, rAuto);
      m.set(j, d);
    }
    return m;
  }, [categoryCount, useRoundedColumnEnds, rectsByCategory, vertical]);

  const legendList = showLegend ? barLegendEntries(chart) : [];

  const gradients = (
    <>
      {model.rects.map((r) =>
        r.fillMode === "gradient" ? (
          <linearGradient
            key={`lg-${rectKey(r)}`}
            id={`${gradBaseId}-${rectKey(r)}`}
            x1={gradCoords.x1}
            y1={gradCoords.y1}
            x2={gradCoords.x2}
            y2={gradCoords.y2}
            gradientUnits="objectBoundingBox"
          >
            <stop offset="0%" stopColor={r.gradientColor1} />
            <stop offset="100%" stopColor={r.gradientColor2} />
          </linearGradient>
        ) : null
      )}
      {legendList.map((en, i) =>
        en.fillMode === "gradient" ? (
          <linearGradient
            key={`lg-leg-${i}`}
            id={`${gradBaseId}-leg-${i}`}
            x1={gradCoords.x1}
            y1={gradCoords.y1}
            x2={gradCoords.x2}
            y2={gradCoords.y2}
            gradientUnits="objectBoundingBox"
          >
            <stop offset="0%" stopColor={en.gradientColor1} />
            <stop offset="100%" stopColor={en.gradientColor2} />
          </linearGradient>
        ) : null
      )}
    </>
  );

  const renderBarRect = (r: BarRect) => {
    const k = rectKey(r);
    const stagStyle = chartSegmentPopAnimationStyle(
      barStaggerIndex.get(k) ?? 0,
      barSegPopInId,
      barSegPopOutId,
      r.x + r.w / 2,
      r.y + r.h / 2,
      presentationChartStagger
    );
    const isHover = hoveredKey === k;
    const outlineOnColumnPath =
      useRoundedColumnEnds && !!columnClipByCat.get(r.categoryIndex);
    const hasBorder = strokeWidth > 0 && !outlineOnColumnPath;
    const fill =
      r.fillMode === "none"
        ? "transparent"
        : r.fillMode === "gradient"
          ? `url(#${gradBaseId}-${k})`
          : r.solidFill;
    if (showSegmentValues) {
      const fillInteract = barSegmentInteractionHandlers(r, "fill");
      return (
        <g key={k} style={stagStyle}>
          <rect
            x={r.x}
            y={r.y}
            width={Math.max(0, r.w)}
            height={Math.max(0, r.h)}
            fill={fill}
            stroke={
              hasBorder ? strokeColor : isHover ? "rgba(255,255,255,0.9)" : "none"
            }
            strokeWidth={hasBorder ? (isHover ? strokeWidth + 0.75 : strokeWidth) : isHover ? 2 : 0}
            vectorEffect="non-scaling-stroke"
            {...fillInteract}
            style={{
              ...fillInteract.style,
              filter: isHover ? "brightness(1.12)" : undefined,
            }}
          />
        </g>
      );
    }
    return (
      <g key={k} style={stagStyle}>
        <rect
          x={r.x}
          y={r.y}
          width={Math.max(0, r.w)}
          height={Math.max(0, r.h)}
          fill="#000000"
          fillOpacity={0}
          stroke="rgba(0,0,0,0)"
          strokeWidth={BAR_HIT_STROKE_PAD}
          vectorEffect="non-scaling-stroke"
          {...barSegmentInteractionHandlers(r, "hit")}
        />
        <rect
          x={r.x}
          y={r.y}
          width={Math.max(0, r.w)}
          height={Math.max(0, r.h)}
          fill={fill}
          stroke={
            hasBorder ? strokeColor : isHover ? "rgba(255,255,255,0.9)" : "none"
          }
          strokeWidth={hasBorder ? (isHover ? strokeWidth + 0.75 : strokeWidth) : isHover ? 2 : 0}
          vectorEffect="non-scaling-stroke"
          style={{
            filter: isHover ? "brightness(1.12)" : undefined,
            pointerEvents: "none",
          }}
        />
      </g>
    );
  };

  const columnOutlinePath = (categoryIndex: number, clipD: string) => {
    const colHover = barHoveredCategoryIndex(hoveredKey) === categoryIndex;
    const showOutline = strokeWidth > 0 || colHover;
    if (!showOutline) return null;
    const w =
      strokeWidth > 0 ? (colHover ? strokeWidth + 0.75 : strokeWidth) : colHover ? 2 : 0;
    const c =
      strokeWidth > 0 ? strokeColor : colHover ? "rgba(255,255,255,0.9)" : "none";
    return (
      <path
        d={clipD}
        fill="none"
        stroke={c}
        strokeWidth={w}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        pointerEvents="none"
      />
    );
  };

  const bars =
    useRoundedColumnEnds ? (
      <>
        {Array.from({ length: categoryCount }, (_, j) => {
          const list = rectsByCategory.get(j) ?? [];
          if (list.length === 0) return null;
          const clipD = columnClipByCat.get(j) ?? null;
          const inner = list.map(renderBarRect);
          if (!clipD) {
            return (
              <g key={`col-${j}`}>
                {inner}
              </g>
            );
          }
          return (
            <g key={`col-${j}`}>
              <g clipPath={`url(#${clipBaseId}-col-${j})`}>{inner}</g>
              {columnOutlinePath(j, clipD)}
            </g>
          );
        })}
      </>
    ) : (
      model.rects.map(renderBarRect)
    );

  const editCategoryBySegment = useMemo(() => {
    const m = new Map<number, number>();
    for (const r of model.rects) {
      const prev = m.get(r.segmentIndex);
      if (prev === undefined || r.categoryIndex < prev) m.set(r.segmentIndex, r.categoryIndex);
    }
    return m;
  }, [model.rects]);

  const segmentOverlays =
    showSegmentLabels || showSegmentValues
      ? model.rects.map((r) => {
          const wantsName = showSegmentLabels && !!r.name.trim();
          const wantsVal =
            showSegmentValues && r.value > 0 && Number.isFinite(r.value);
          if (!wantsName && !wantsVal) return null;

          const cx = r.x + r.w / 2;
          const cy = r.y + r.h / 2;
          const fullName = (series?.[r.segmentIndex]?.name ?? r.name) || "";

          const valueThin =
            vertical
              ? Math.min(r.h, r.w) < MIN_BAR_DIM_FOR_VALUE
              : Math.min(r.w, r.h) < MIN_BAR_DIM_FOR_VALUE;
          const twoLineRoom = vertical ? r.h >= 8.5 : r.w >= 12;
          const showValueLine = wantsVal && !valueThin;
          const fs = r.labelFontSize;
          const fsVal = Math.min(fs * 0.88, 3.2);
          const lhSeg = fs * BAR_LABEL_LINE_HEIGHT_EM;
          const nameMaxW = Math.max(2, vertical ? r.w - 0.5 : r.w - 0.5);
          const reserveVal = showValueLine && twoLineRoom ? fsVal * 1.25 : 0;
          const usableName = (vertical ? r.h : r.w) - reserveVal;
          const maxNameLines = Math.max(1, Math.floor(usableName / lhSeg));
          const nameLines = wantsName
            ? wrapBarLabelLines(fullName.trim() || r.name.trim(), nameMaxW, fs, maxNameLines)
            : [];
          const showNameLine =
            wantsName && nameLines.length > 0 && usableName >= lhSeg * 0.5;
          if (!showNameLine && !showValueLine) return null;

          const editNameHere =
            showNameLine &&
            inlineEdit?.kind === "segment" &&
            !inlineEdit.fromLegend &&
            inlineEdit.segmentIndex === r.segmentIndex &&
            editCategoryBySegment.get(r.segmentIndex) === r.categoryIndex;

          const editingValueHere =
            canEditValue &&
            inlineEdit?.kind === "value" &&
            inlineEdit.segmentIndex === r.segmentIndex &&
            inlineEdit.categoryIndex === r.categoryIndex;

          const labelTextShadow = "0 0 2px rgba(0,0,0,0.45), 0 1px 2px rgba(0,0,0,0.35)";
          const valStr = formatAxisNumber(r.value);
          const valueDraftSeed = Number.isInteger(r.value)
            ? String(Math.round(r.value))
            : String(r.value);

          const valueInput = (vy: number) => {
            const charCount = Math.max(3, inlineDraft.length, valueDraftSeed.length);
            const vFoW = chartInlineForeignObjectWidth({
              charCount,
              fontSize: fsVal,
              minWidth: 6,
            });
            const vFoH = fsVal;
            return (
              <foreignObject
                key={`val-edit-${rectKey(r)}`}
                x={cx - vFoW / 2}
                y={vy - vFoH / 2}
                width={vFoW}
                height={vFoH}
                style={{ overflow: "visible" }}
              >
                <input
                  type="text"
                  inputMode="decimal"
                  className="m-0 box-border min-w-0 max-w-full bg-transparent shadow-none focus:outline-none focus:ring-0"
                  style={svgForeignObjectInlineInputStyle({
                    fontSize: fsVal,
                    fontWeight: 600,
                    color: r.labelColor,
                    caretColor: r.labelColor,
                    textAlign: "center",
                    textShadow: labelTextShadow,
                  })}
                  value={inlineDraft}
                  autoFocus
                  aria-label="Edit segment value"
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
          };

          if (editingValueHere && showValueLine) {
            if (showNameLine && showValueLine && twoLineRoom) {
              return (
                <g key={`lbl-${rectKey(r)}`}>
                  <BarSvgTextBlock
                    lines={nameLines}
                    x={cx}
                    yCenter={cy - fsVal * 0.35}
                    fontSize={fs}
                    textAnchor="middle"
                    fill={r.labelColor}
                    fontWeight={600}
                    pointerEvents={canEditSegment ? "auto" : "none"}
                    style={{
                      textShadow: labelTextShadow,
                      cursor: canEditSegment ? "text" : undefined,
                    }}
                    onPointerDown={(e) => canEditSegment && e.stopPropagation()}
                    onDoubleClick={(e) => {
                      if (!canEditSegment) return;
                      e.stopPropagation();
                      e.preventDefault();
                      setInlineDraft(fullName);
                      setInlineEdit({
                        kind: "segment",
                        segmentIndex: r.segmentIndex,
                        fromLegend: false,
                      });
                    }}
                  />
                  {valueInput(cy + fs * 0.42)}
                </g>
              );
            }
            return valueInput(cy);
          }

          if (showNameLine && editNameHere) {
            const charCount = Math.max(4, inlineDraft.length, fullName.length);
            const foW = chartInlineForeignObjectWidth({ charCount, fontSize: fs });
            const nameLineCenterY =
              showValueLine && twoLineRoom ? cy - fsVal * 0.35 : cy;
            const nameH = fs;
            const valH = fsVal;
            const valLineCenterY = cy + fs * 0.42;
            const showValUnderEdit = showValueLine && twoLineRoom;
            const betweenGap = showValUnderEdit
              ? Math.max(0, valLineCenterY - nameLineCenterY - nameH / 2 - valH / 2)
              : 0;
            const foH = showValUnderEdit ? nameH + betweenGap + valH : nameH;
            const foTop = nameLineCenterY - nameH / 2;
            return (
              <foreignObject
                key={`lbl-${rectKey(r)}`}
                x={cx - foW / 2}
                y={foTop}
                width={foW}
                height={foH}
                style={{ overflow: "visible" }}
              >
                <div
                  className="flex h-full w-full flex-col items-center justify-start gap-0"
                  style={{ margin: 0, padding: 0 }}
                >
                  <input
                    type="text"
                    className="m-0 box-border min-w-0 max-w-full shrink-0 bg-transparent shadow-none focus:outline-none focus:ring-0"
                    style={svgForeignObjectInlineInputStyle({
                      fontSize: fs,
                      fontWeight: 600,
                      color: r.labelColor,
                      caretColor: r.labelColor,
                      textAlign: "center",
                      textShadow: labelTextShadow,
                    })}
                    value={inlineDraft}
                    autoFocus
                    aria-label="Edit segment label"
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
                  {showValUnderEdit ? (
                    <div
                      className="flex w-full shrink-0 items-center justify-center"
                      style={{
                        marginTop: betweenGap,
                        height: valH,
                        minHeight: valH,
                        maxHeight: valH,
                        fontFamily: "ui-sans-serif, system-ui, sans-serif",
                        fontWeight: 600,
                        fontSize: fsVal,
                        lineHeight: `${fsVal}px`,
                        color: r.labelColor,
                        textShadow: labelTextShadow,
                      }}
                    >
                      {valStr}
                    </div>
                  ) : null}
                </div>
              </foreignObject>
            );
          }

          if (
            showNameLine &&
            inlineEdit?.kind === "segment" &&
            !inlineEdit.fromLegend &&
            inlineEdit.segmentIndex === r.segmentIndex &&
            !editNameHere
          ) {
            return null;
          }

          if (showNameLine && showValueLine && twoLineRoom) {
            return (
              <g key={`lbl-${rectKey(r)}`}>
                <BarSvgTextBlock
                  lines={nameLines}
                  x={cx}
                  yCenter={cy - fsVal * 0.35}
                  fontSize={fs}
                  textAnchor="middle"
                  fill={r.labelColor}
                  fontWeight={600}
                  pointerEvents={canEditSegment ? "auto" : "none"}
                  style={{
                    textShadow: labelTextShadow,
                    cursor: canEditSegment ? "text" : undefined,
                  }}
                  onPointerDown={(e) => canEditSegment && e.stopPropagation()}
                  onDoubleClick={(e) => {
                    if (!canEditSegment) return;
                    e.stopPropagation();
                    e.preventDefault();
                    setInlineDraft(fullName);
                    setInlineEdit({
                      kind: "segment",
                      segmentIndex: r.segmentIndex,
                      fromLegend: false,
                    });
                  }}
                />
                <text
                  x={cx}
                  y={cy + fs * 0.42}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={r.labelColor}
                  fontSize={fsVal}
                  fontWeight={600}
                  pointerEvents={
                    !canEditValue ? "none" : canDragBarValue ? "none" : "auto"
                  }
                  style={{
                    textShadow: labelTextShadow,
                    cursor: canEditValue && !canDragBarValue ? "text" : undefined,
                  }}
                  onPointerDown={(e) => canEditValue && e.stopPropagation()}
                  onDoubleClick={(e) => {
                    if (!canEditValue || canDragBarValue) return;
                    if (suppressBarValueDblClickAfterDragRef.current) {
                      e.preventDefault();
                      e.stopPropagation();
                      return;
                    }
                    e.stopPropagation();
                    e.preventDefault();
                    setInlineDraft(valueDraftSeed);
                    setInlineEdit({
                      kind: "value",
                      segmentIndex: r.segmentIndex,
                      categoryIndex: r.categoryIndex,
                    });
                  }}
                >
                  {valStr}
                </text>
              </g>
            );
          }

          if (showValueLine && (!showNameLine || !twoLineRoom)) {
            return (
              <text
                key={`val-${rectKey(r)}`}
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={r.labelColor}
                fontSize={fsVal}
                fontWeight={600}
                pointerEvents={
                  !canEditValue ? "none" : canDragBarValue ? "none" : "auto"
                }
                style={{
                  textShadow: labelTextShadow,
                  cursor: canEditValue && !canDragBarValue ? "text" : undefined,
                }}
                onPointerDown={(e) => canEditValue && e.stopPropagation()}
                onDoubleClick={(e) => {
                  if (!canEditValue || canDragBarValue) return;
                  if (suppressBarValueDblClickAfterDragRef.current) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                  }
                  e.stopPropagation();
                  e.preventDefault();
                  setInlineDraft(valueDraftSeed);
                  setInlineEdit({
                    kind: "value",
                    segmentIndex: r.segmentIndex,
                    categoryIndex: r.categoryIndex,
                  });
                }}
              >
                {valStr}
              </text>
            );
          }

          if (showNameLine) {
            const wantsBarValueTipOnLabel =
              !showSegmentValues && Number.isFinite(r.value);
            return (
              <BarSvgTextBlock
                key={`lbl-${rectKey(r)}`}
                lines={nameLines}
                x={cx}
                yCenter={cy}
                fontSize={fs}
                textAnchor="middle"
                fill={r.labelColor}
                fontWeight={600}
                pointerEvents={
                  canEditSegment || wantsBarValueTipOnLabel ? "auto" : "none"
                }
                style={{
                  textShadow: labelTextShadow,
                  cursor: canEditSegment ? "text" : undefined,
                }}
                onPointerDown={(e) => canEditSegment && e.stopPropagation()}
                onDoubleClick={(e) => {
                  if (!canEditSegment) return;
                  e.stopPropagation();
                  e.preventDefault();
                  setInlineDraft(fullName);
                  setInlineEdit({
                    kind: "segment",
                    segmentIndex: r.segmentIndex,
                    fromLegend: false,
                  });
                }}
                extraSvgProps={
                  wantsBarValueTipOnLabel
                    ? (barRectValueTooltipHandlers(r) as React.SVGProps<SVGTextElement>)
                    : undefined
                }
              />
            );
          }

          return null;
        })
      : null;

  const axisFont = 3.1;
  const valueLabels =
    showValueAxis &&
    valueTicks.map((t, i) => {
      if (vertical) {
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
      }
      const x = plot.x0 + (t / valueAxisMax) * plot.w;
      return (
        <text
          key={`vt-${i}`}
          x={x}
          y={plot.y0 + plot.h + axisFont + 1}
          textAnchor="middle"
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
          const editingCat =
            inlineEdit?.kind === "category" && inlineEdit.categoryIndex === j;
          const catFs = categoryLabelFontSize;
          if (vertical) {
            const cx = plot.x0 + (j + 0.5) * catSlot;
            const ty = plot.y0 + plot.h + 3.6;
            const catMidY = ty - catFs * 0.35;
            if (editingCat) {
              const charCount = Math.max(4, inlineDraft.length, fullCat.length);
              const foW = chartInlineForeignObjectWidth({ charCount, fontSize: catFs });
              const foH = catFs;
              return (
                <foreignObject
                  key={`cat-${j}`}
                  x={cx - foW / 2}
                  y={catMidY - foH / 2}
                  width={foW}
                  height={foH}
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
              <BarSvgTextBlock
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
          }
          const cy = plot.y0 + (j + 0.5) * catSlot;
          const ty = cy + axisFont * 0.25;
          const catMidY = ty - catFs * 0.35;
          if (editingCat) {
            const charCount = Math.max(4, inlineDraft.length, fullCat.length);
            const foW = chartInlineForeignObjectWidth({ charCount, fontSize: catFs });
            const foH = catFs;
            return (
              <foreignObject
                key={`cat-${j}`}
                x={plot.x0 - 3 - foW}
                y={catMidY - foH / 2}
                width={foW}
                height={foH}
                style={{ overflow: "visible" }}
              >
                <input
                  type="text"
                  className="m-0 box-border min-w-0 max-w-full bg-transparent text-right shadow-none focus:outline-none focus:ring-0"
                  style={svgForeignObjectInlineInputStyle({
                    fontSize: catFs,
                    fontWeight: 500,
                    color: axisColor,
                    caretColor: axisColor,
                    textAlign: "right",
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
            <BarSvgTextBlock
              key={`cat-${j}`}
              lines={catLines}
              x={plot.x0 - 3}
              yCenter={catMidY}
              fontSize={catFs}
              textAnchor="end"
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

  const legendSlotW =
    showLegend && legendList.length > 0 ? plot.w / Math.max(1, legendList.length) : 0;
  /** Minor upward nudge; main legend spacing comes from `buildBarChartLayout` margin bands. */
  const legendYLift = 1.5;
  const legendEls =
    showLegend && legendList.length > 0 ? (
      <g aria-label="Legend">
        {legendList.map((en, i) => {
          const cx = plot.x0 + (i + 0.5) * legendSlotW;
          const sw = 3;
          const fill =
            en.fillMode === "none"
              ? "transparent"
              : en.fillMode === "gradient"
                ? `url(#${gradBaseId}-leg-${i})`
                : en.solidFill;
          const fullLegName = (series?.[en.segmentIndex]?.name ?? en.name) || "";
          const legendNameEdit =
            inlineEdit?.kind === "segment" &&
            inlineEdit.fromLegend &&
            inlineEdit.segmentIndex === en.segmentIndex;
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
              <rect
                x={-legendSlotW / 2 + 0.5}
                y={legMidY - sw / 2}
                width={sw}
                height={sw}
                rx={0.4}
                fill={fill}
                stroke={strokeColor}
                strokeWidth={0.35}
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
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
                    aria-label="Edit legend segment name"
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
                <BarSvgTextBlock
                  lines={legLines}
                  x={tx}
                  yCenter={legMidY}
                  fontSize={legFont}
                  textAnchor="start"
                  fill={axisColor}
                  fontWeight={500}
                  pointerEvents={canEditSegment ? "auto" : "none"}
                  style={{ cursor: canEditSegment ? "text" : undefined }}
                  onPointerDown={(e) => canEditSegment && e.stopPropagation()}
                  onDoubleClick={(e) => {
                    if (!canEditSegment) return;
                    e.stopPropagation();
                    e.preventDefault();
                    setInlineDraft(fullLegName);
                    setInlineEdit({
                      kind: "segment",
                      segmentIndex: en.segmentIndex,
                      fromLegend: true,
                    });
                  }}
                />
              )}
            </g>
          );
        })}
      </g>
    ) : null;

  const showValueGrid = vertical ? chart.showGridY === true : chart.showGridX === true;
  const showCategoryGrid = vertical ? chart.showGridX === true : chart.showGridY === true;

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

  const defs = (
    <defs>
      {presentationChartStagger ? (
        <style
          type="text/css"
          dangerouslySetInnerHTML={{ __html: chartSegmentPopKeyframesCss(barSegPopInId, barSegPopOutId) }}
        />
      ) : null}
      {svgShadow ? (
        <filter id={filterId} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodOpacity="0.3" />
        </filter>
      ) : null}
      {useRoundedColumnEnds
        ? Array.from(columnClipByCat.entries()).map(([j, d]) =>
            d ? (
              <clipPath
                key={`cp-${j}`}
                id={`${clipBaseId}-col-${j}`}
                clipPathUnits="userSpaceOnUse"
              >
                <path d={d} />
              </clipPath>
            ) : null
          )
        : null}
      {gradients}
    </defs>
  );

  const plotBody = (
    <>
      {defs}
      {gridEls}
      {svgShadow ? <g filter={`url(#${filterId})`}>{bars}</g> : bars}
      {segmentOverlays}
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
      {barCellHoverTooltip != null && typeof document !== "undefined"
        ? createPortal(
            <div
              role="tooltip"
              className={cn(
                "pointer-events-none fixed z-[10000] rounded-md border border-border bg-popover px-2 py-1",
                "text-xs font-medium text-popover-foreground shadow-md"
              )}
              style={{
                left: barCellHoverTooltip.x + 12,
                top: barCellHoverTooltip.y + 12,
              }}
            >
              {barCellHoverTooltip.text}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
