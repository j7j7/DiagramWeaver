"use client";

import React from "react";
import type { DiagramNodeData, RichTextRun } from "@/lib/types";
import { SvgShapeBase } from "./svg-shape-base";
import { getShapeSvgFill } from "./shape-utils";
import { useSvgGradient } from "@/hooks/use-svg-gradient";

interface RectangleShapeProps {
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
  onVerticalAlignChange?: (position: 'top' | 'middle' | 'bottom') => void;
  onLabelKeyDown: (e: React.KeyboardEvent) => void;
  onLabelDoubleClick: (e: React.MouseEvent) => void;
  slideColorTransition?: string;
}

const VIEWBOX_W = 80;
const VIEWBOX_H = 50;
const MINT_MOCHA_BG_COLORS = ["#ecfccb", "#d9f99d"];
const MINT_MOCHA_BORDER_COLORS = ["#57534e", "#78716c"];

function normalizeTwoColors(value: unknown, fallbackA: string, fallbackB: string): [string, string] {
  if (Array.isArray(value)) {
    const vals = value.filter((v): v is string => typeof v === "string" && v.length > 0);
    if (vals.length >= 2) return [vals[0], vals[1]];
    if (vals.length === 1) return [vals[0], vals[0]];
  }
  return [fallbackA, fallbackB];
}

export function RectangleShape(props: RectangleShapeProps) {
  const { node } = props;
  const nodeAny = node as any;

  const hasExplicitVisualStyling =
    nodeAny.backgroundStyle !== undefined ||
    nodeAny.backgroundColor !== undefined ||
    (Array.isArray(nodeAny.backgroundColors) && nodeAny.backgroundColors.length > 0) ||
    nodeAny.borderStyle !== undefined ||
    nodeAny.borderColor !== undefined ||
    (Array.isArray(nodeAny.borderColors) && nodeAny.borderColors.length > 0);

  const backgroundColorFallback = nodeAny.backgroundColor || (hasExplicitVisualStyling ? "#6b7280" : MINT_MOCHA_BG_COLORS[0]);
  const borderColorFallback = nodeAny.borderColor || (hasExplicitVisualStyling ? "#6b7280" : MINT_MOCHA_BORDER_COLORS[0]);
  const [bgStart, bgEnd] = normalizeTwoColors(
    nodeAny.backgroundColors,
    backgroundColorFallback,
    hasExplicitVisualStyling ? backgroundColorFallback : MINT_MOCHA_BG_COLORS[1]
  );
  const [borderStart, borderEnd] = normalizeTwoColors(
    nodeAny.borderColors,
    borderColorFallback,
    hasExplicitVisualStyling ? borderColorFallback : MINT_MOCHA_BORDER_COLORS[1]
  );
  const gradientAngle = nodeAny.gradientAngle || 135;
  const borderGradientAngle = nodeAny.borderGradientAngle ?? gradientAngle;
  const backgroundStyle = nodeAny.backgroundStyle || (!hasExplicitVisualStyling ? "gradient" : "solid");
  const borderStyle = nodeAny.borderStyle || (!hasExplicitVisualStyling ? "gradient" : "solid");

  const strokeWidth = borderStyle === "none" ? 0 : (parseInt(String(nodeAny.borderWidth || 2), 10) || 2);
  const half = strokeWidth / 2;

  const w = node.width ?? VIEWBOX_W;
  const h = node.height ?? VIEWBOX_H;
  const vbW = w + strokeWidth;
  const vbH = h + strokeWidth;

  const { defs, fillRef, strokeRef } = useSvgGradient({
    colors: backgroundStyle === "gradient"
      ? [bgStart, bgEnd]
      : [bgStart],
    angle: gradientAngle,
    borderColors: borderStyle === "gradient"
      ? [borderStart, borderEnd]
      : undefined,
    borderAngle: borderStyle === "gradient" ? borderGradientAngle : undefined,
    enabled: backgroundStyle === "gradient" || borderStyle === "gradient",
  });

  const fillColor = getShapeSvgFill(
    backgroundStyle,
    fillRef,
    backgroundColorFallback
  );
  const strokeColor =
    borderStyle === "gradient"
      ? strokeRef
      : borderColorFallback;
  const strokeDasharray = borderStyle === "dotted" ? "3,3" : undefined;

  return (
    <SvgShapeBase
      {...props}
      defaultWidth={VIEWBOX_W}
      defaultHeight={VIEWBOX_H}
      viewBox={`0 0 ${vbW} ${vbH}`}
      frostedClipRectInViewBox={{ x: half, y: half, w, h }}
      svgContent={
        <>
          {defs}
          <rect
            x={half}
            y={half}
            width={w}
            height={h}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
            {...(strokeWidth > 0 ? { vectorEffect: "non-scaling-stroke" as const } : {})}
          />
        </>
      }
    />
  );
}
