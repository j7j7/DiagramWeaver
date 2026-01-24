"use client";

import React from "react";
import type { DiagramNodeData } from "@/lib/types";
import { SvgShapeBase } from "./svg-shape-base";
import { getGradientWithAngle, polygonToRoundedPath } from "./shape-utils";

interface ChevronShapeProps {
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

export function ChevronShape(props: ChevronShapeProps) {
  const { node } = props;
  const nodeAny = node as any;
  const roundedEdges = nodeAny.roundedEdges || false;
  const points = "5,5 25,5 35,20 25,35 5,35 15,20";
  const viewBox: [number, number] = [60, 40];

  const fillColor = nodeAny.backgroundStyle === 'gradient'
    ? getGradientWithAngle(nodeAny.backgroundColors || [nodeAny.backgroundColor || '#6b7280'], nodeAny.gradientAngle || 135)
    : nodeAny.backgroundColor || '#6b7280';
  
  const strokeColor = nodeAny.borderColor || '#6b7280';
  const strokeWidth = nodeAny.borderStyle === 'none' ? '0' : (nodeAny.borderWidth || 2);

  return (
    <SvgShapeBase
      {...props}
      viewBox="0 0 60 40"
      defaultWidth={60}
      defaultHeight={40}
      svgContent={
        roundedEdges ? (
          <path
            d={polygonToRoundedPath(points, undefined, viewBox)}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : (
          <polygon
            points={points}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
        )
      }
    />
  );
}
