"use client";

import React from "react";
import type { DiagramNodeData } from "@/lib/types";
import { SvgShapeBase } from "./svg-shape-base";
import { useSvgGradient } from "@/hooks/use-svg-gradient";

interface RoundedRectangleShapeProps {
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
  editText: string;
  onLabelTextChange: (text: string) => void;
  onLabelSubmit: () => void;
  onLabelKeyDown: (e: React.KeyboardEvent) => void;
  onLabelDoubleClick: (e: React.MouseEvent) => void;
}

const VIEWBOX_W = 80;
const VIEWBOX_H = 50;
const RX = 6; // ~12% corner radius for rounded appearance

export function RoundedRectangleShape(props: RoundedRectangleShapeProps) {
  const { node } = props;
  const nodeAny = node as any;

  const backgroundColors = nodeAny.backgroundColors || [nodeAny.backgroundColor || "#6b7280"];
  const borderColors = nodeAny.borderColors || [nodeAny.borderColor || "#6b7280"];
  const gradientAngle = nodeAny.gradientAngle || 135;
  const borderGradientAngle = nodeAny.borderGradientAngle ?? gradientAngle;
  const backgroundStyle = nodeAny.backgroundStyle || "solid";
  const borderStyle = nodeAny.borderStyle || "solid";

  const { defs, fillRef, strokeRef } = useSvgGradient({
    colors: backgroundStyle === "gradient" ? backgroundColors : [backgroundColors[0]],
    angle: gradientAngle,
    borderColors: borderStyle === "gradient" ? borderColors : undefined,
    borderAngle: borderStyle === "gradient" ? borderGradientAngle : undefined,
    enabled: backgroundStyle === "gradient" || borderStyle === "gradient"
  });

  const fillColor = backgroundStyle === "gradient" ? fillRef : (nodeAny.backgroundColor || "#6b7280");
  const strokeColor = borderStyle === "gradient" ? strokeRef : (nodeAny.borderColor || "#6b7280");
  const strokeWidth = borderStyle === "none" ? "0" : (nodeAny.borderWidth || 2);
  const strokeDasharray = borderStyle === "dotted" ? "3,3" : undefined;

  const s = parseInt(String(strokeWidth), 10) || 2;
  const half = borderStyle === "none" ? 0 : s / 2;

  return (
    <SvgShapeBase
      {...props}
      defaultWidth={VIEWBOX_W}
      defaultHeight={VIEWBOX_H}
      viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
      svgContent={
        <>
          {defs}
          <rect
            x={half}
            y={half}
            width={Math.max(0, VIEWBOX_W - s)}
            height={Math.max(0, VIEWBOX_H - s)}
            rx={Math.min(RX, (VIEWBOX_W - s) / 2, (VIEWBOX_H - s) / 2)}
            ry={Math.min(RX, (VIEWBOX_W - s) / 2, (VIEWBOX_H - s) / 2)}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
          />
        </>
      }
    />
  );
}
