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

export function RoundedRectangleShape(props: RoundedRectangleShapeProps) {
  const { node } = props;
  const nodeAny = node as any;

  const backgroundColors = nodeAny.backgroundColors || [nodeAny.backgroundColor || "#6b7280"];
  const borderColors = nodeAny.borderColors || [nodeAny.borderColor || "#6b7280"];
  const gradientAngle = nodeAny.gradientAngle || 135;
  const borderGradientAngle = nodeAny.borderGradientAngle ?? gradientAngle;
  const backgroundStyle = nodeAny.backgroundStyle || "solid";
  const borderStyle = nodeAny.borderStyle || "solid";

  const strokeWidth = borderStyle === "none" ? 0 : (parseInt(String(nodeAny.borderWidth || 2), 10) || 2);
  const half = strokeWidth / 2;

  const w = node.width ?? VIEWBOX_W;
  const h = node.height ?? VIEWBOX_H;
  const scaleX = Math.max(0.01, w / VIEWBOX_W);
  const scaleY = Math.max(0.01, h / VIEWBOX_H);
  const minDim = Math.min(w, h);
  // cornerRadius 0=straight, 1=full pill (radius=minDim/2); 0.5 default gives moderate curve
  const cornerRadius = Math.max(0, Math.min(1, nodeAny.cornerRadius ?? 0.5));
  const targetRadiusPx = cornerRadius * (minDim / 2);
  const rectW = Math.max(0, VIEWBOX_W - strokeWidth);
  const rectH = Math.max(0, VIEWBOX_H - strokeWidth);
  const rx = Math.min(targetRadiusPx / scaleX, rectW / 2, rectH / 2);
  const ry = Math.min(targetRadiusPx / scaleY, rectW / 2, rectH / 2);

  const { defs, fillRef, strokeRef } = useSvgGradient({
    colors: backgroundStyle === "gradient" ? backgroundColors : [backgroundColors[0]],
    angle: gradientAngle,
    borderColors: borderStyle === "gradient" ? borderColors : undefined,
    borderAngle: borderStyle === "gradient" ? borderGradientAngle : undefined,
    enabled: backgroundStyle === "gradient" || borderStyle === "gradient"
  });

  const fillColor = backgroundStyle === "gradient" ? fillRef : (nodeAny.backgroundColor || "#6b7280");
  const strokeColor = borderStyle === "gradient" ? strokeRef : (nodeAny.borderColor || "#6b7280");
  const strokeDasharray = borderStyle === "dotted" ? "3,3" : undefined;

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
            width={Math.max(0, VIEWBOX_W - strokeWidth)}
            height={Math.max(0, VIEWBOX_H - strokeWidth)}
            rx={rx}
            ry={ry}
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
