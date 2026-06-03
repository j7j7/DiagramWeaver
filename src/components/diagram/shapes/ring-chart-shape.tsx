"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { DiagramNodeData, NodeChartSpec, NodeChartSpecRing, RichTextRun } from "@/lib/types";
import { lerpNodeChartForSlide } from "@/lib/chart-slide-lerp";
import { resolveChartSpecForDisplay } from "@/lib/chart-value-expr";
import { useGlobalVariableContext, useUserGlobalProperties } from "../global-properties-context";
import { cn } from "@/lib/utils";
import { SvgShapeBase } from "./svg-shape-base";
import {
  chartInlineForeignObjectWidth,
  getGradientCoordinates,
  svgForeignObjectInlineInputStyle,
} from "./shape-utils";
import {
  ringSlicesForSvg,
  roundChartDragValue,
  truncatePieSliceLabel,
} from "@/lib/chart-node";
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
const LABEL_FALLBACK_R = 16;
const MIN_SPAN_FOR_LABEL = 0.11;
const SLICE_POINTER_LEAVE_DELAY_MS = 140;
const SLICE_HIT_STROKE_PAD = 3;

type RingSliceDragSession = {
  pointerId: number;
  svg: SVGSVGElement;
  seriesIndex: number;
  startAxisValue: number;
  startCellValue: number;
  valueSpan: number;
};

interface RingChartShapeProps {
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
  onRingSliceNameChange?: (sliceIndex: number, name: string) => void;
  onRingSliceValueChange?: (sliceIndex: number, value: number) => void;
  onRingChartValueDragSessionChange?: (active: boolean) => void;
  presentationChartStagger?: ChartSlideStagger;
  presentationChartLerpU?: number;
  presentationChartLerpFromJson?: string;
}

function ringSeriesValueSum(series: { value?: number }[] | undefined): number {
  if (!Array.isArray(series)) return 0;
  return series.reduce((a, s) => {
    const v = s.value;
    const n = typeof v === "number" && Number.isFinite(v) ? v : 0;
    return a + Math.max(0, n);
  }, 0);
}

export function RingChartShape(props: RingChartShapeProps) {
  const {
    isReadOnly = false,
    onRingSliceNameChange,
    onRingSliceValueChange,
    onRingChartValueDragSessionChange,
    presentationChartStagger,
    presentationChartLerpU,
    presentationChartLerpFromJson,
    ...svgBaseProps
  } = props;
  const { node, slideColorTransition } = svgBaseProps;
  const chartRaw = node.chart;
  const ringChartBase: NodeChartSpecRing | undefined =
    chartRaw?.kind === "ring" ? chartRaw : undefined;
  const globalProperties = useUserGlobalProperties();
  const variableContext = useGlobalVariableContext();
  const ringChartLerped = useMemo(() => {
    if (!ringChartBase) return undefined;
    if (
      presentationChartLerpFromJson == null ||
      presentationChartLerpU == null ||
      presentationChartLerpU >= 1 - 1e-9
    ) {
      return ringChartBase;
    }
    try {
      const from = JSON.parse(presentationChartLerpFromJson) as NodeChartSpec;
      if (!from || from.kind !== "ring") return ringChartBase;
      return lerpNodeChartForSlide(from, ringChartBase, presentationChartLerpU) as NodeChartSpecRing;
    } catch {
      return ringChartBase;
    }
  }, [ringChartBase, presentationChartLerpFromJson, presentationChartLerpU]);

  const { chart: ringChart, chartValueErrors } = useMemo(() => {
    if (!ringChartLerped) return { chart: undefined, chartValueErrors: [] as const };
    const resolved = resolveChartSpecForDisplay(ringChartLerped, globalProperties, variableContext);
    return {
      chart: resolved.chart as NodeChartSpecRing,
      chartValueErrors: resolved.errors,
    };
  }, [ringChartLerped, globalProperties, variableContext]);
  const series = ringChart?.series;

  const borderStyle = node.borderStyle || "solid";
  const strokeWidthNode = borderStyle === "none" ? 0 : node.borderWidth || 2;
  const chartSpecifiedW = ringChart?.sliceBorderWidth;
  const defaultOutlineWidthVb = useMemo(() => {
    if (typeof chartSpecifiedW === "number" && Number.isFinite(chartSpecifiedW)) {
      return Math.max(0, Math.min(5, chartSpecifiedW));
    }
    if (strokeWidthNode <= 0) return 0;
    return Math.max(0.25, Math.min(5, strokeWidthNode));
  }, [chartSpecifiedW, strokeWidthNode]);

  const { slices } = ringSlicesForSvg(VB_CX, VB_CY, series, ringChart, {
    defaultOutlineWidthVb,
  });

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [sliceHoverTooltip, setSliceHoverTooltip] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);
  const [editingSliceIndex, setEditingSliceIndex] = useState<number | null>(null);
  const [editingSliceNameDraft, setEditingSliceNameDraft] = useState("");
  const sliceLabelEditCancelledRef = useRef(false);
  const slicePointerLeaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ringSliceDragRef = useRef<RingSliceDragSession | null>(null);

  const canEditSegmentLabel = !isReadOnly && !!onRingSliceNameChange;
  const canEditSliceValue = !isReadOnly && !!onRingSliceValueChange;
  const canDragRingSliceValue =
    canEditSliceValue && typeof onRingChartValueDragSessionChange === "function";

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

  const slicePointerHandlers = (i: number, s: (typeof slices)[number]) => {
    const showSliceValue =
      s.tooltipValue != null && Number.isFinite(s.tooltipValue);
    return {
      onPointerEnter: (e: React.PointerEvent<SVGElement>) => {
        if (ringSliceDragRef.current) return;
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
        if (ringSliceDragRef.current) return;
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
        if (ringSliceDragRef.current) return;
        scheduleSliceLeave();
      },
    };
  };

  const sliceHitPathPointerHandlers = (i: number, s: (typeof slices)[number]) => {
    const showSliceValue =
      s.tooltipValue != null && Number.isFinite(s.tooltipValue);
    const seriesIndex = s.seriesIndex;
    const sliceDraggable =
      canDragRingSliceValue &&
      typeof seriesIndex === "number" &&
      seriesIndex >= 0 &&
      showSliceValue;

    const dragProps: Record<string, unknown> = sliceDraggable
      ? {
          "data-dw-ring-slice-value-handle": "",
          onMouseDownCapture: (e: React.MouseEvent<SVGPathElement>) => {
            e.stopPropagation();
          },
          onPointerDown: (e: React.PointerEvent<SVGPathElement>) => {
            if (!onRingSliceValueChange) return;
            e.stopPropagation();
            const svg = e.currentTarget.ownerSVGElement;
            if (!svg) return;
            const pt = svgUserPointFromClient(svg, e.clientX, e.clientY);
            if (!pt) return;
            const sumNow = ringSeriesValueSum(series);
            const startCell = Number.isFinite(s.tooltipValue) ? s.tooltipValue! : 0;
            const valueSpan = Math.max(1, sumNow, startCell * 2);
            const startAxis = chartValueFromVerticalValueAxis(
              pt.y,
              VB_CY - VB_R,
              2 * VB_R,
              valueSpan
            );
            onRingChartValueDragSessionChange?.(true);
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              /* ignore */
            }
            ringSliceDragRef.current = {
              pointerId: e.pointerId,
              svg,
              seriesIndex,
              startAxisValue: startAxis,
              startCellValue: startCell,
              valueSpan,
            };
          },
          onPointerUp: (e: React.PointerEvent<SVGPathElement>) => {
            const drag = ringSliceDragRef.current;
            if (drag && drag.pointerId === e.pointerId) {
              try {
                e.currentTarget.releasePointerCapture(e.pointerId);
              } catch {
                /* ignore */
              }
              ringSliceDragRef.current = null;
            }
            onRingChartValueDragSessionChange?.(false);
          },
          onPointerCancel: (e: React.PointerEvent<SVGPathElement>) => {
            const drag = ringSliceDragRef.current;
            if (drag && drag.pointerId === e.pointerId) {
              try {
                e.currentTarget.releasePointerCapture(e.pointerId);
              } catch {
                /* ignore */
              }
              ringSliceDragRef.current = null;
            }
            onRingChartValueDragSessionChange?.(false);
          },
          onLostPointerCapture: () => {
            ringSliceDragRef.current = null;
            onRingChartValueDragSessionChange?.(false);
          },
        }
      : {};

    return {
      onPointerEnter: (e: React.PointerEvent<SVGPathElement>) => {
        if (ringSliceDragRef.current) return;
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
        const drag = ringSliceDragRef.current;
        if (
          drag &&
          drag.pointerId === e.pointerId &&
          sliceDraggable &&
          onRingSliceValueChange
        ) {
          const pt = svgUserPointFromClient(drag.svg, e.clientX, e.clientY);
          if (pt) {
            const axisV = chartValueFromVerticalValueAxis(
              pt.y,
              VB_CY - VB_R,
              2 * VB_R,
              drag.valueSpan
            );
            const v = roundChartDragValue(
              drag.startCellValue + axisV - drag.startAxisValue
            );
            onRingSliceValueChange(drag.seriesIndex, v);
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
        if (ringSliceDragRef.current) return;
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
        const drag = ringSliceDragRef.current;
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
    if (editingSliceIndex == null || !onRingSliceNameChange) return;
    onRingSliceNameChange(editingSliceIndex, editingSliceNameDraft.trim());
    setEditingSliceIndex(null);
  };

  const cancelSliceLabelEdit = () => {
    sliceLabelEditCancelledRef.current = true;
    setEditingSliceIndex(null);
  };
  const filterId = `dw-ring-sh-${useId().replace(/:/g, "")}`;
  const gradBaseId = `dw-ring-g-${useId().replace(/:/g, "")}`;
  const segAnimBase = `dwRingSeg${useId().replace(/:/g, "")}`;
  const segPopInId = `${segAnimBase}In`;
  const segPopOutId = `${segAnimBase}Out`;
  const gradientAngle = node.gradientAngle ?? 135;
  const gradCoords = getGradientCoordinates(gradientAngle);

  const chartStrokeFallback =
    ringChart?.sliceBorderColor?.trim() || node.borderColor || "#6b7280";
  const svgShadow = ringChart?.shadow === true;
  const showSegmentLabels = ringChart?.showSegmentLabels !== false;
  const sliceOutlineDasharray = borderStyle === "dotted" ? "3,3" : undefined;

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

  const ringSlicesAndLabels = (
    <>
      {slices.map((s, i) => {
        const isHover = hoveredIndex === i;
        const outlineWResolved =
          typeof s.sliceStrokeWidth === "number" &&
          Number.isFinite(s.sliceStrokeWidth)
            ? s.sliceStrokeWidth
            : defaultOutlineWidthVb;
        const outlineColorEffective =
          s.sliceStrokeColor?.trim() || chartStrokeFallback;
        const hasBorder = outlineWResolved > 0;
        const fill =
          s.fillMode === "none"
            ? "transparent"
            : s.fillMode === "gradient"
              ? `url(#${gradBaseId}-${i})`
              : s.solidFill;
        const t = `translate(${s.explodeX},${s.explodeY})`;
        const segAnim = chartSegmentPopAnimationStyle(
          i,
          segPopInId,
          segPopOutId,
          VB_CX,
          VB_CY,
          presentationChartStagger
        );

        const radialDist =
          typeof s.segmentMidRadius === "number" &&
          Number.isFinite(s.segmentMidRadius) &&
          s.segmentMidRadius > 0.05
            ? s.segmentMidRadius
            : LABEL_FALLBACK_R;

        let labelEl: React.ReactNode = null;
        if (showSegmentLabels && s.name.trim() && (slices.length === 1 || s.span >= MIN_SPAN_FOR_LABEL)) {
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
                x: lx + radialDist * Math.cos(s.midAngle),
                y: ly + radialDist * Math.sin(s.midAngle),
                anchor: "middle" as const,
              };
          const maxChars = isFull
            ? Math.max(4, Math.min(24, Math.round(18 * (5.5 / s.labelFontSize))))
            : Math.max(4, Math.min(20, Math.round(12 * (4.75 / s.labelFontSize))));
          const display = truncatePieSliceLabel(s.name, maxChars);
          const fullName = (series?.[seriesIdx]?.name ?? s.name) || "";
          if (editingSliceIndex === seriesIdx) {
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
            labelEl = (
              <foreignObject
                x={ta.x - foW / 2}
                y={ta.y - foH / 2}
                width={foW}
                height={foH}
                style={{ overflow: "visible" }}
                {...slicePointerHandlers(i, s)}
              >
                <input
                  type="text"
                  spellCheck
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
          } else {
            labelEl = (
              <text
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
          }
        }

        return (
          <g key={i} transform={t}>
            <g style={segAnim}>
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
                    ? outlineColorEffective
                    : isHover
                      ? "rgba(255,255,255,0.9)"
                      : "none"
                }
                strokeWidth={
                  hasBorder
                    ? isHover
                      ? outlineWResolved + 0.75
                      : outlineWResolved
                    : isHover
                      ? 2
                      : 0
                }
                strokeDasharray={hasBorder ? sliceOutlineDasharray : undefined}
                vectorEffect="non-scaling-stroke"
                style={{
                  filter: isHover ? "brightness(1.12)" : undefined,
                  pointerEvents: "none",
                }}
              />
              {labelEl}
            </g>
          </g>
        );
      })}
    </>
  );

  const defs = (
    <defs>
      {presentationChartStagger ? (
        <style
          type="text/css"
          dangerouslySetInnerHTML={{ __html: chartSegmentPopKeyframesCss(segPopInId, segPopOutId) }}
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

  const ringBody = (
    <>
      {defs}
      {svgShadow ? <g filter={`url(#${filterId})`}>{ringSlicesAndLabels}</g> : ringSlicesAndLabels}
      {chartValueErrors.length > 0 ? (
        <text x={1} y={59} fill="#dc2626" fontSize={2.2} style={{ pointerEvents: "none" }}>
          {chartValueErrors[0].error}
        </text>
      ) : null}
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
        svgContent={ringBody}
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
