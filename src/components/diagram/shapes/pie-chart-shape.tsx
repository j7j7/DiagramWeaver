"use client";

import React from "react";
import type { DiagramNodeData, RichTextRun } from "@/lib/types";
import { SvgShapeBase } from "./svg-shape-base";
import { pieSlicesForSvg } from "@/lib/chart-node";

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
   const series = node.chart?.series;
  const slices = pieSlicesForSvg(30, 30, 28, series);

  const borderStyle = node.borderStyle || "solid";
  const strokeWidth = borderStyle === "none" ? 0 : node.borderWidth || 2;
  const strokeColor = node.borderColor || "#6b7280";

  return (
    <SvgShapeBase
      {...props}
      viewBox="0 0 60 60"
      preserveAspectRatio="xMidYMid meet"
      slideColorTransition={slideColorTransition}
      svgContent={
        <>
          {slices.map((s, i) => (
            <path
              key={i}
              d={s.d}
              fill={s.fill}
              stroke={strokeWidth > 0 ? strokeColor : "none"}
              strokeWidth={strokeWidth}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </>
      }
    />
  );
}
