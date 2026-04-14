"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { DiagramNodeData, NodeChartSpec, NodeChartSpecPie, RichTextRun } from "@/lib/types";
import { lerpNodeChartForSlide } from "@/lib/chart-slide-lerp";
import { cn } from "@/lib/utils";
import { SvgShapeBase } from "./svg-shape-base";
import {
  chartInlineForeignObjectWidth,
  getGradientCoordinates,
  svgForeignObjectInlineInputStyle,
} from "./shape-utils";
import { pieSlicesForSvg, truncatePieSliceLabel } from "@/lib/chart-node";
import {
  chartValueFromVerticalValueAxis,
  svgUserPointFromClient,
} from "@/lib/chart-pointer-geometry";
import {
  chartSegmentPopAnimationStyle,
  chartSegmentPopKeyframesCss,
  type ChartSlideStagger,
} from "@/lib/chart-presentation-stagger";

const VB_CX = 30;
const VB_CY = 30;
const VB_R = 28;
/** Label ring at separation0; scales with wedge radius when slices are pulled out. */
const LABEL_R_AT_MAX = 16;
const MIN_SPAN_FOR_LABEL = 0.11;
/** Defer clearing slice hover/tooltip so brief gaps at wedge edges or layout reflow don’t flicker. */
const SLICE_POINTER_LEAVE_DELAY_MS = 140;
/** Invisible stroke widens the hit target slightly (SVG viewBox units, non-scaling). */
const SLICE_HIT_STROKE_PAD = 3;
type PieSliceDragSession = {
  pointerId: number;
  svg: SVGSVGElement;
  seriesIndex: number;
  startAxisValue: number;
  startCellValue: number;
  /** Frozen `max(sum, startCell*2, 1)` at pointerdown — same virtual axis for whole gesture. */
  valueSpan: number;
};

interface PieChartShapeProps {
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
  /** Double-click segment label to edit; updates `chart.series[sliceIndex].name`. */
  onPieSliceNameChange?: (sliceIndex: number, name: string) => void;
  /** Drag slice value (pointer up/down); updates `chart.series[sliceIndex].value`. */
  onPieSliceValueChange?: (sliceIndex: number, value: number) => void;
  /** Blocks canvas node drag while a pie slice value drag is active (react-dnd `canDrag`). */
  onPieChartValueDragSessionChange?: (active: boolean) => void;
  presentationChartStagger?: ChartSlideStagger;
  presentationChartLerpU?: number;
  presentationChartLerpFromJson?: string;
}

function pieSeriesValueSum(series: { value?: number }[] | undefined): number {
  if (!Array.isArray(series)) return 0;
  return series.reduce((a, s) => {
    const v = s.value;
    const n = typeof v === "number" && Number.isFinite(v) ? v : 0;
    return a + Math.max(0, n);
  }, 0);
}

export function PieChartShape(props: PieChartShapeProps) {
  const {
    isReadOnly = false,
    onPieSliceNameChange,
    onPieSliceValueChange,
    onPieChartValueDragSessionChange,
    presentationChartStagger,
    presentationChartLerpU,
    presentationChartLerpFromJson,
    ...svgBaseProps
  } = props;
  const { node, slideColorTransition } = svgBaseProps;
  const chartRaw = node.chart;
  const pieChartBase: NodeChartSpecPie | undefined =
    chartRaw?.kind === "pie" ? chartRaw : undefined;
  const pieChart = useMemo(() => {
    if (!pieChartBase) return undefined;
    if (
      presentationChartLerpFromJson == null ||
      presentationChartLerpU == null ||
      presentationChartLerpU >= 1 - 1e-9
    ) {
      return pieChartBase;
    }
    try {
      const from = JSON.parse(presentationChartLerpFromJson) as NodeChartSpec;
      if (!from || from.kind !== "pie") return pieChartBase;
      return lerpNodeChartForSlide(from, pieChartBase, presentationChartLerpU) as NodeChartSpecPie;
    } catch {
      return pieChartBase;
    }
  }, [pieChartBase, presentationChartLerpFromJson, presentationChartLerpU]);
  const series = pieChart?.series;
  const { slices, rDraw } = pieSlicesForSvg(VB_CX, VB_CY, VB_R, series, {
    segmentGapDeg: pieChart?.segmentGapDeg,
  });
  const labelR = (rDraw / VB_R) * LABEL_R_AT_MAX;
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  /** Native SVG `<title>` tooltips are unreliable inside transformed/filtered SVG; use a portaled label. */
  const [sliceHoverTooltip, setSliceHoverTooltip] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);
  const [editingSliceIndex, setEditingSliceIndex] = useState<number | null>(null);
  const [editingSliceNameDraft, setEditingSliceNameDraft] = useState("");
  const sliceLabelEditCancelledRef = useRef(false);
  const slicePointerLeaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pieSliceDragRef = useRef<PieSliceDragSession | null>(null);

  const canEditSegmentLabel = !isReadOnly && !!onPieSliceNameChange;
  const canEditSliceValue = !isReadOnly && !!onPieSliceValueChange;
  const canDragPieSliceValue =
    canEditSliceValue && typeof onPieChartValueDragSessionChange === "function";

  const cancelSliceLeaveTimer = () => {
    const t = slicePointerLeaveTimerRef.current;
    if (t != null) {
      clearTimeout(t);
      slicePointerLeaveTimerRef.current = null;
    }
  };

  const scheduleSliceLeave = () => {
    cancelSliceLeaveTimer();
    slicePointerLeaveTimerRef.current = setTimeout(() => {
      slicePointerLeaveTimerRef.current = null;
      setHoveredIndex(null);
      setSliceHoverTooltip(null);
    }, SLICE_POINTER_LEAVE_DELAY_MS);
  };

  /** Wedge + segment label share these so the tooltip doesn’t clear when moving onto the label (above the hit path). */
  const slicePointerHandlers = (i: number, s: (typeof slices)[number]) => {
    const showSliceValue =
      s.tooltipValue != null && Number.isFinite(s.tooltipValue);
    return {
      onPointerEnter: (e: React.PointerEvent<SVGElement>) => {
        if (pieSliceDragRef.current) return;
        cancelSliceLeaveTimer();
        setHoveredIndex(i);
        if (showSliceValue) {
          setSliceHoverTooltip({
            x: e.clientX,
            y: e.clientY,
            text: s.tooltipValue!.toLocaleString(),
          });
        } else {
          setSliceHoverTooltip(null);
        }
      },
      onPointerMove: (e: React.PointerEvent<SVGElement>) => {
        if (pieSliceDragRef.current) return;
        if (!showSliceValue) return;
        setSliceHoverTooltip((prev) =>
          prev
            ? { ...prev, x: e.clientX, y: e.clientY }
            : {
                x: e.clientX,
                y: e.clientY,
                text: s.tooltipValue!.toLocaleString(),
              }
        );
      },
      onPointerLeave: () => {
        if (pieSliceDragRef.current) return;
        scheduleSliceLeave();
      },
    };
  };

  /** Hit wedge only: tooltip + optional vertical value drag (`chart-pointer-geometry` virtual axis through pie diameter). */
  const sliceHitPathPointerHandlers = (i: number, s: (typeof slices)[number]) => {
    const showSliceValue =
      s.tooltipValue != null && Number.isFinite(s.tooltipValue);
    const seriesIndex = s.seriesIndex;
    const sliceDraggable =
      canDragPieSliceValue &&
      typeof seriesIndex === "number" &&
      seriesIndex >= 0 &&
      showSliceValue;

    const dragProps: Record<string, unknown> = sliceDraggable
      ? {
          "data-dw-pie-slice-value-handle": "",
          onMouseDownCapture: (e: React.MouseEvent<SVGPathElement>) => {
            e.stopPropagation();
          },
          onPointerDown: (e: React.PointerEvent<SVGPathElement>) => {
            if (!onPieSliceValueChange) return;
            e.stopPropagation();
            const svg = e.currentTarget.ownerSVGElement;
            if (!svg) return;
            const pt = svgUserPointFromClient(svg, e.clientX, e.clientY);
            if (!pt) return;
            const sumNow = pieSeriesValueSum(series);
            const startCell = Number.isFinite(s.tooltipValue) ? s.tooltipValue! : 0;
            const valueSpan = Math.max(1, sumNow, startCell * 2);
            const startAxis = chartValueFromVerticalValueAxis(
              pt.y,
              VB_CY - VB_R,
              2 * VB_R,
              valueSpan
            );
            onPieChartValueDragSessionChange?.(true);
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              /* ignore */
            }
            pieSliceDragRef.current = {
              pointerId: e.pointerId,
              svg,
              seriesIndex,
              startAxisValue: startAxis,
              startCellValue: startCell,
              valueSpan,
            };
          },
          onPointerUp: (e: React.PointerEvent<SVGPathElement>) => {
            const drag = pieSliceDragRef.current;
            if (drag && drag.pointerId === e.pointerId) {
              try {
                e.currentTarget.releasePointerCapture(e.pointerId);
              } catch {
                /* ignore */
              }
              pieSliceDragRef.current = null;
            }
            onPieChartValueDragSessionChange?.(false);
          },
          onPointerCancel: (e: React.PointerEvent<SVGPathElement>) => {
            const drag = pieSliceDragRef.current;
            if (drag && drag.pointerId === e.pointerId) {
              try {
                e.currentTarget.releasePointerCapture(e.pointerId);
              } catch {
                /* ignore */
              }
              pieSliceDragRef.current = null;
            }
            onPieChartValueDragSessionChange?.(false);
          },
          onLostPointerCapture: () => {
            pieSliceDragRef.current = null;
            onPieChartValueDragSessionChange?.(false);
          },
        }
      : {};

    return {
      onPointerEnter: (e: React.PointerEvent<SVGPathElement>) => {
        if (pieSliceDragRef.current) return;
        cancelSliceLeaveTimer();
        setHoveredIndex(i);
        if (showSliceValue) {
          setSliceHoverTooltip({
            x: e.clientX,
            y: e.clientY,
            text: s.tooltipValue!.toLocaleString(),
          });
        } else {
          setSliceHoverTooltip(null);
        }
      },
      onPointerMove: (e: React.PointerEvent<SVGPathElement>) => {
        const drag = pieSliceDragRef.current;
        if (
          drag &&
          drag.pointerId === e.pointerId &&
          sliceDraggable &&
          onPieSliceValueChange
        ) {
          const pt = svgUserPointFromClient(drag.svg, e.clientX, e.clientY);
          if (pt) {
            const axisV = chartValueFromVerticalValueAxis(
              pt.y,
              VB_CY - VB_R,
              2 * VB_R,
              drag.valueSpan
            );
            const v = Math.max(
              0,
              drag.startCellValue + axisV - drag.startAxisValue
            );
            onPieSliceValueChange(drag.seriesIndex, v);
            cancelSliceLeaveTimer();
            setHoveredIndex(i);
            setSliceHoverTooltip({
              x: e.clientX,
              y: e.clientY,
              text: v.toLocaleString(),
            });
          }
          return;
        }
        if (pieSliceDragRef.current) return;
        if (!showSliceValue) return;
        setSliceHoverTooltip((prev) =>
          prev
            ? { ...prev, x: e.clientX, y: e.clientY }
            : {
                x: e.clientX,
                y: e.clientY,
                text: s.tooltipValue!.toLocaleString(),
              }
        );
      },
      onPointerLeave: (e: React.PointerEvent<SVGPathElement>) => {
        const drag = pieSliceDragRef.current;
        if (drag && drag.pointerId === e.pointerId) return;
        scheduleSliceLeave();
      },
      ...dragProps,
      style: {
        cursor: sliceDraggable ? ("ns-resize" as const) : ("default" as const),
        ...(sliceDraggable ? { touchAction: "none" as const } : {}),
      },
    } as React.SVGProps<SVGPathElement>;
  };

  useEffect(() => {
    return () => {
      const t = slicePointerLeaveTimerRef.current;
      if (t != null) {
        clearTimeout(t);
        slicePointerLeaveTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (
      editingSliceIndex != null &&
      (!Array.isArray(series) || editingSliceIndex >= series.length)
    ) {
      setEditingSliceIndex(null);
    }
  }, [series, editingSliceIndex]);

  const commitSliceLabelEdit = () => {
    if (sliceLabelEditCancelledRef.current) {
      sliceLabelEditCancelledRef.current = false;
      return;
    }
    if (editingSliceIndex == null || !onPieSliceNameChange) return;
    onPieSliceNameChange(editingSliceIndex, editingSliceNameDraft.trim());
    setEditingSliceIndex(null);
  };

  const cancelSliceLabelEdit = () => {
    sliceLabelEditCancelledRef.current = true;
    setEditingSliceIndex(null);
  };
  const filterId = `dw-pie-sh-${useId().replace(/:/g, "")}`;
  const gradBaseId = `dw-pie-g-${useId().replace(/:/g, "")}`;
  const segPopId = `dwPieSeg${useId().replace(/:/g, "")}`;
  const gradientAngle = node.gradientAngle ?? 135;
  const gradCoords = getGradientCoordinates(gradientAngle);

  const borderStyle = node.borderStyle || "solid";
  const strokeWidth = borderStyle === "none" ? 0 : node.borderWidth || 2;
  const strokeColor =
    pieChart?.sliceBorderColor?.trim() || node.borderColor || "#6b7280";
  const svgShadow = pieChart?.shadow === true;
  const showSegmentLabels = pieChart?.showSegmentLabels !== false;

  const gradients = slices.map((s, i) =>
    s.fillMode === "gradient" ? (
      <linearGradient
        key={`lg-${i}`}
        id={`${gradBaseId}-${i}`}
        x1={gradCoords.x1}
        y1={gradCoords.y1}
        x2={gradCoords.x2}
        y2={gradCoords.y2}
        gradientUnits="objectBoundingBox"
      >
        <stop offset="0%" stopColor={s.gradientColor1} />
        <stop offset="100%" stopColor={s.gradientColor2} />
      </linearGradient>
    ) : null
  );

  const pieSlicesAndLabels = (
    <>
      {slices.map((s, i) => {
        const isHover = hoveredIndex === i;
        const hasBorder = strokeWidth > 0;
        const fill =
          s.fillMode === "none"
            ? "transparent"
            : s.fillMode === "gradient"
              ? `url(#${gradBaseId}-${i})`
              : s.solidFill;
        const t = `translate(${s.explodeX},${s.explodeY})`;
        const segAnim = chartSegmentPopAnimationStyle(
          i,
          segPopId,
          VB_CX,
          VB_CY,
          presentationChartStagger
        );
        return (
          <g key={i} transform={t}>
            <g style={segAnim}>
              {/* Stable hit target: hover stroke/brightness on the visual path can reshuffle hit-testing. */}
              <path
                d={s.d}
                fill="#000000"
                fillOpacity={0}
                stroke="rgba(0,0,0,0)"
                strokeWidth={SLICE_HIT_STROKE_PAD}
                vectorEffect="non-scaling-stroke"
                {...sliceHitPathPointerHandlers(i, s)}
              />
              <path
                d={s.d}
                fill={fill}
                stroke={
                  hasBorder
                    ? strokeColor
                    : isHover
                      ? "rgba(255,255,255,0.9)"
                      : "none"
                }
                strokeWidth={hasBorder ? (isHover ? strokeWidth + 0.75 : strokeWidth) : isHover ? 2 : 0}
                vectorEffect="non-scaling-stroke"
                style={{
                  filter: isHover ? "brightness(1.12)" : undefined,
                  pointerEvents: "none",
                }}
              />
            </g>
          </g>
        );
      })}
      {showSegmentLabels
        ? slices.map((s, i) => {
            if (!s.name.trim()) return null;
            if (slices.length > 1 && s.span < MIN_SPAN_FOR_LABEL) return null;
            const seriesIdx = s.seriesIndex ?? i;
            const labelWantsPointer =
              canEditSegmentLabel ||
              (s.tooltipValue != null && Number.isFinite(s.tooltipValue));
            const lx = VB_CX + s.explodeX;
            const ly = VB_CY + s.explodeY;
            const isFull = s.span >= 2 * Math.PI - 1e-6;
            const ta = isFull
              ? { x: lx, y: ly + Math.min(6, s.labelFontSize * 0.85), anchor: "middle" as const }
              : {
                  x: lx + labelR * Math.cos(s.midAngle),
                  y: ly + labelR * Math.sin(s.midAngle),
                  anchor: "middle" as const,
                };
            const maxChars = isFull
              ? Math.max(4, Math.min(24, Math.round(18 * (5.5 / s.labelFontSize))))
              : Math.max(4, Math.min(20, Math.round(12 * (4.75 / s.labelFontSize))));
            const display = truncatePieSliceLabel(s.name, maxChars);
            const fullName = (series?.[seriesIdx]?.name ?? s.name) || "";
            if (editingSliceIndex === seriesIdx) {
              /** Match `<text fontSize>`: inner layout uses SVG user units → same numeric px in `foreignObject` (no extra × node width; SVG scales the whole subtree). */
              const labelFontSizePx = s.labelFontSize;
              const charCount = Math.max(
                4,
                editingSliceNameDraft.length,
                fullName.length
              );
              const foW = chartInlineForeignObjectWidth({
                charCount,
                fontSize: s.labelFontSize,
              });
              const foH = labelFontSizePx;
              const labelTextShadow =
                "0 0 2px rgba(0,0,0,0.45), 0 1px 2px rgba(0,0,0,0.35)";
              return (
                <foreignObject
                  key={`lbl-${seriesIdx}`}
                  x={ta.x - foW / 2}
                  y={ta.y - foH / 2}
                  width={foW}
                  height={foH}
                  style={{ overflow: "visible" }}
                  {...slicePointerHandlers(i, s)}
                >
                  <input
                    type="text"
                    className="m-0 box-border min-w-0 max-w-full bg-transparent shadow-none focus:outline-none focus:ring-0"
                    style={svgForeignObjectInlineInputStyle({
                      fontSize: labelFontSizePx,
                      fontWeight: 600,
                      color: s.labelColor,
                      caretColor: s.labelColor,
                      textAlign: "center",
                      textShadow: labelTextShadow,
                    })}
                    value={editingSliceNameDraft}
                    autoFocus
                    aria-label="Edit segment label"
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setEditingSliceNameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitSliceLabelEdit();
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        cancelSliceLabelEdit();
                      }
                    }}
                    onBlur={() => {
                      commitSliceLabelEdit();
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => e.stopPropagation()}
                  />
                </foreignObject>
              );
            }
            return (
              <text
                key={`lbl-${seriesIdx}`}
                x={ta.x}
                y={ta.y}
                textAnchor={ta.anchor}
                dominantBaseline="middle"
                fill={s.labelColor}
                fontSize={s.labelFontSize}
                fontWeight={600}
                pointerEvents={labelWantsPointer ? "auto" : "none"}
                style={{
                  textShadow: "0 0 2px rgba(0,0,0,0.45), 0 1px 2px rgba(0,0,0,0.35)",
                  cursor: canEditSegmentLabel ? "text" : undefined,
                }}
                {...slicePointerHandlers(i, s)}
                onPointerDown={(e) => canEditSegmentLabel && e.stopPropagation()}
                onDoubleClick={(e) => {
                  if (!canEditSegmentLabel) return;
                  e.stopPropagation();
                  e.preventDefault();
                  setEditingSliceNameDraft(fullName);
                  setEditingSliceIndex(seriesIdx);
                }}
              >
                {display}
              </text>
            );
          })
        : null}
    </>
  );

  const defs = (
    <defs>
      {presentationChartStagger ? (
        <style
          type="text/css"
          dangerouslySetInnerHTML={{ __html: chartSegmentPopKeyframesCss(segPopId) }}
        />
      ) : null}
      {svgShadow ? (
               <filter id={filterId} x="-55%" y="-55%" width="210%" height="210%">
          <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodOpacity="0.35" />
        </filter>
      ) : null}
      {gradients}
    </defs>
  );

  const pieBody = (
    <>
      {defs}
      {svgShadow ? <g filter={`url(#${filterId})`}>{pieSlicesAndLabels}</g> : pieSlicesAndLabels}
    </>
  );

  return (
    <>
      <SvgShapeBase
        {...svgBaseProps}
        viewBox="0 0 60 60"
        preserveAspectRatio="xMidYMid meet"
        slideColorTransition={slideColorTransition}
        svgOverflowVisible={svgShadow}
        svgContent={pieBody}
      />
      {sliceHoverTooltip != null && typeof document !== "undefined"
        ? createPortal(
            <div
              role="tooltip"
              className={cn(
                "pointer-events-none fixed z-[10000] rounded-md border border-border bg-popover px-2 py-1",
                "text-xs font-medium text-popover-foreground shadow-md"
              )}
              style={{
                left: sliceHoverTooltip.x + 12,
                top: sliceHoverTooltip.y + 12,
              }}
            >
              {sliceHoverTooltip.text}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
