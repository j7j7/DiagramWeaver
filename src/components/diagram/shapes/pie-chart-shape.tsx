"use client";

import React, { useId, useState } from "react";
import type { DiagramNodeData, RichTextRun } from "@/lib/types";
import { SvgShapeBase } from "./svg-shape-base";
import { getGradientCoordinates } from "./shape-utils";
import { computePieRadialLayout, pieSlicesForSvg, truncatePieSliceLabel } from "@/lib/chart-node";

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
}

export function PieChartShape(props: PieChartShapeProps) {
  const { node, slideColorTransition } = props;
  const chart = node.chart;
  const series = chart?.series;
  const { rDraw } = computePieRadialLayout(VB_R, chart?.segmentGapDeg);
  const labelR = (rDraw / VB_R) * LABEL_R_AT_MAX;
  const slices = pieSlicesForSvg(VB_CX, VB_CY, VB_R, series, {
    segmentGapDeg: chart?.segmentGapDeg,
  });
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const filterId = `dw-pie-sh-${useId().replace(/:/g, "")}`;
  const gradBaseId = `dw-pie-g-${useId().replace(/:/g, "")}`;
  const gradientAngle = node.gradientAngle ?? 135;
  const gradCoords = getGradientCoordinates(gradientAngle);

  const borderStyle = node.borderStyle || "solid";
  const strokeWidth = borderStyle === "none" ? 0 : node.borderWidth || 2;
  const strokeColor =
    chart?.sliceBorderColor?.trim() || node.borderColor || "#6b7280";
  const svgShadow = chart?.shadow === true;

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
      {slices.map((s, i) => {
        if (!s.name.trim()) return null;
        if (slices.length > 1 && s.span < MIN_SPAN_FOR_LABEL) return null;
        const lx = VB_CX + s.explodeX;
        const ly = VB_CY + s.explodeY;
        const ta =
          s.span >= 2 * Math.PI - 1e-6
            ? { x: lx, y: ly + 4, anchor: "middle" as const }
            : {
                x: lx + labelR * Math.cos(s.midAngle),
                y: ly + labelR * Math.sin(s.midAngle),
                anchor: "middle" as const,
              };
        const display = truncatePieSliceLabel(s.name, s.span >= 2 * Math.PI - 1e-6 ? 18 : 12);
        return (
          <text
            key={`lbl-${i}`}
            x={ta.x}
            y={ta.y}
            textAnchor={ta.anchor}
            dominantBaseline="middle"
            fill={s.labelColor}
            fontSize={s.span >= 2 * Math.PI - 1e-6 ? 5.5 : 4.75}
            fontWeight={600}
            pointerEvents="none"
            style={{
              textShadow: "0 0 2px rgba(0,0,0,0.45), 0 1px 2px rgba(0,0,0,0.35)",
            }}
          >
            {display}
          </text>
        );
      })}
    </>
  );

  const defs = (
    <defs>
      {svgShadow ? (
        <filter id={filterId} x="-40%" y="-40%" width="180%" height="180%">
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
      {...props}
      viewBox="0 0 60 60"
      preserveAspectRatio="xMidYMid meet"
      slideColorTransition={slideColorTransition}
      svgContent={pieBody}
    />
  );
}
