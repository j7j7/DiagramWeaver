"use client";

import React from "react";
import type { DiagramNodeData } from "@/lib/types";
import { SvgShapeBase } from "./svg-shape-base";
import { getRoundedEdgesProps } from "./shape-utils";
import { useSvgGradient } from "@/hooks/use-svg-gradient";

interface JigsawShapeProps {
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

export function JigsawShape(props: JigsawShapeProps) {
  const { node } = props;
  const nodeAny = node as any;
  const roundedEdges = nodeAny.roundedEdges || false;

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
  const strokeWidthNum = borderStyle === 'none' ? 0 : (parseInt(String(strokeWidth), 10) || 2);

  return (
    <SvgShapeBase
      {...props}
      viewBox="0 0 120 120"
      svgContent={
        <>
          {defs}
          <path
            d="M 22,22 
               L 52,22 
               Q 52,26 54,28 
               Q 60,30 66,28 
               Q 68,26 68,22 
               L 98,22 
               L 98,52 
               Q 102,52 104,54 
               Q 106,60 104,66 
               Q 102,68 98,68 
               L 98,98 
               L 68,98 
               Q 68,94 66,92 
               Q 60,90 54,92 
               Q 52,94 52,98 
               L 22,98 
               L 22,68 
               Q 18,68 16,66 
               Q 14,60 16,54 
               Q 18,52 22,52 
               L 22,22 
               Z"
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
            strokeLinejoin="round"
            {...(strokeWidthNum > 0 ? { vectorEffect: "non-scaling-stroke" as const } : {})}
            {...getRoundedEdgesProps(roundedEdges)}
          />
        </>
      }
    />
  );
}
