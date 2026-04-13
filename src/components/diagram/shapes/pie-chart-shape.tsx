"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import type { DiagramNodeData, RichTextRun } from "@/lib/types";
import { SvgShapeBase } from "./svg-shape-base";
import { getGradientCoordinates } from "./shape-utils";
import { pieSlicesForSvg, truncatePieSliceLabel } from "@/lib/chart-node";

const VB_CX = 30;
const VB_CY = 30;
const VB_R = 28;
/** Label ring at separation0; scales with wedge radius when slices are pulled out. */
const LABEL_R_AT_MAX = 16;
const MIN_SPAN_FOR_LABEL = 0.11;

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
}

export function PieChartShape(props: PieChartShapeProps) {
  const { isReadOnly = false, onPieSliceNameChange, ...svgBaseProps } = props;
  const { node, slideColorTransition } = svgBaseProps;
  const chart = node.chart;
  const series = chart?.series;
  const { slices, rDraw } = pieSlicesForSvg(VB_CX, VB_CY, VB_R, series, {
    segmentGapDeg: chart?.segmentGapDeg,
  });
  const labelR = (rDraw / VB_R) * LABEL_R_AT_MAX;
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [editingSliceIndex, setEditingSliceIndex] = useState<number | null>(null);
  const [editingSliceNameDraft, setEditingSliceNameDraft] = useState("");
  const sliceLabelEditCancelledRef = useRef(false);

  const canEditSegmentLabel = !isReadOnly && !!onPieSliceNameChange;

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
  const gradientAngle = node.gradientAngle ?? 135;
  const gradCoords = getGradientCoordinates(gradientAngle);

  const borderStyle = node.borderStyle || "solid";
  const strokeWidth = borderStyle === "none" ? 0 : node.borderWidth || 2;
  const strokeColor =
    chart?.sliceBorderColor?.trim() || node.borderColor || "#6b7280";
  const svgShadow = chart?.shadow === true;
  const showSegmentLabels = chart?.showSegmentLabels !== false;

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
        return (
          <g key={i} transform={t}>
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
                cursor: "default",
              }}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            />
          </g>
        );
      })}
      {showSegmentLabels
        ? slices.map((s, i) => {
            if (!s.name.trim()) return null;
            if (slices.length > 1 && s.span < MIN_SPAN_FOR_LABEL) return null;
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
            const fullName = (series?.[i]?.name ?? s.name) || "";
            if (editingSliceIndex === i) {
              /** Match `<text fontSize>`: inner layout uses SVG user units → same numeric px in `foreignObject` (no extra × node width; SVG scales the whole subtree). */
              const labelFontSizePx = s.labelFontSize;
              const charCount = Math.max(
                4,
                editingSliceNameDraft.length,
                fullName.length
              );
              const foW = Math.min(
                56,
                Math.max(8, charCount * s.labelFontSize * 0.55)
              );
              const foH = Math.max(5.5, s.labelFontSize * 1.35);
              const labelTextShadow =
                "0 0 2px rgba(0,0,0,0.45), 0 1px 2px rgba(0,0,0,0.35)";
              return (
                <foreignObject
                  key={`lbl-${i}`}
                  x={ta.x - foW / 2}
                  y={ta.y - foH / 2}
                  width={foW}
                  height={foH}
                  style={{ overflow: "visible" }}
                >
                  <div
                    className="flex h-full w-full items-center justify-center"
                    style={{ margin: 0, padding: 0 }}
                  >
                    <input
                      type="text"
                      className="m-0 box-border min-w-0 max-w-full bg-transparent p-0 shadow-none focus:outline-none focus:ring-0"
                      style={{
                        width: "100%",
                        height: "100%",
                        border: "none",
                        borderRadius: 0,
                        textAlign: "center",
                        fontFamily: "ui-sans-serif, system-ui, sans-serif",
                        fontWeight: 600,
                        fontSize: labelFontSizePx,
                        lineHeight: 1,
                        color: s.labelColor,
                        textShadow: labelTextShadow,
                        caretColor: s.labelColor,
                      }}
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
                  </div>
                </foreignObject>
              );
            }
            return (
              <text
                key={`lbl-${i}`}
                x={ta.x}
                y={ta.y}
                textAnchor={ta.anchor}
                dominantBaseline="middle"
                fill={s.labelColor}
                fontSize={s.labelFontSize}
                fontWeight={600}
                pointerEvents={canEditSegmentLabel ? "auto" : "none"}
                style={{
                  textShadow: "0 0 2px rgba(0,0,0,0.45), 0 1px 2px rgba(0,0,0,0.35)",
                  cursor: canEditSegmentLabel ? "text" : undefined,
                }}
                onPointerDown={(e) => canEditSegmentLabel && e.stopPropagation()}
                onDoubleClick={(e) => {
                  if (!canEditSegmentLabel) return;
                  e.stopPropagation();
                  e.preventDefault();
                  setEditingSliceNameDraft(fullName);
                  setEditingSliceIndex(i);
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
    <SvgShapeBase
      {...svgBaseProps}
      viewBox="0 0 60 60"
      preserveAspectRatio="xMidYMid meet"
      slideColorTransition={slideColorTransition}
      svgOverflowVisible={svgShadow}
      svgContent={pieBody}
    />
  );
}
