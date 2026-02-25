"use client";

import React from "react";
import type { DiagramNodeData } from "@/lib/types";
import { SvgShapeBase } from "./svg-shape-base";
import { polygonToRoundedPath, getPolygonViewBoxAndPoints } from "./shape-utils";
import { useSvgGradient } from "@/hooks/use-svg-gradient";

interface ParallelogramShapeProps {
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

export function ParallelogramShape(props: ParallelogramShapeProps) {
  const { node } = props;
  const nodeAny = node as any;
  const roundedEdges = nodeAny.roundedEdges || false;
  const points = "20,5 75,5 60,45 5,45";
  const { viewBox, width: vbW, height: vbH, transformedPoints } = getPolygonViewBoxAndPoints(points);

  const backgroundColors = nodeAny.backgroundColors || [nodeAny.backgroundColor || '#6b7280'];
  const borderColors = nodeAny.borderColors || [nodeAny.borderColor || '#6b7280'];
  const gradientAngle = nodeAny.gradientAngle || 135;
  const borderGradientAngle = nodeAny.borderGradientAngle ?? gradientAngle;
  const backgroundStyle = nodeAny.backgroundStyle || 'solid';
  const borderStyle = nodeAny.borderStyle || 'solid';

  const { defs, fillRef, strokeRef } = useSvgGradient({
    colors: backgroundStyle === 'gradient' ? backgroundColors : [backgroundColors[0]],
    angle: gradientAngle,
    borderColors: borderStyle === 'gradient' ? borderColors : undefined,
    borderAngle: borderStyle === 'gradient' ? borderGradientAngle : undefined,
    enabled: backgroundStyle === 'gradient' || borderStyle === 'gradient'
  });

  const fillColor = backgroundStyle === 'gradient' ? fillRef : (nodeAny.backgroundColor || '#6b7280');
  const strokeColor = borderStyle === 'gradient' ? strokeRef : (nodeAny.borderColor || '#6b7280');
  const strokeWidth = borderStyle === 'none' ? '0' : (nodeAny.borderWidth || 2);
  const strokeDasharray = borderStyle === 'dotted' ? '3,3' : undefined;

  return (
    <SvgShapeBase
      {...props}
      viewBox={viewBox}
      defaultWidth={80}
      defaultHeight={50}
      svgContent={
        <>
          {defs}
          {roundedEdges ? (
            <path
              d={polygonToRoundedPath(transformedPoints, undefined, [vbW, vbH])}
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : (
            <polygon
              points={transformedPoints}
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
            />
          )}
        </>
      }
    />
  );
}
