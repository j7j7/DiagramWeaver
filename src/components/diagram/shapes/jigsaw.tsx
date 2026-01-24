"use client";

import React from "react";
import type { DiagramNodeData } from "@/lib/types";
import { SvgShapeBase } from "./svg-shape-base";
import { getGradientWithAngle, getRoundedEdgesProps } from "./shape-utils";

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

  return (
    <SvgShapeBase
      {...props}
      viewBox="0 0 100 100"
      svgContent={
        <path
          d="M 15,15 
             L 42,15 
             Q 42,20 45,22.5 
             Q 50,25 55,22.5 
             Q 58,20 58,15 
             L 85,15 
             L 85,42 
             Q 90,42 92.5,45 
             Q 95,50 92.5,55 
             Q 90,58 85,58 
             L 85,85 
             L 58,85 
             Q 58,80 55,77.5 
             Q 50,75 45,77.5 
             Q 42,80 42,85 
             L 15,85 
             L 15,58 
             Q 10,58 7.5,55 
             Q 5,50 7.5,45 
             Q 10,42 15,42 
             L 15,15 
             Z"
          fill={nodeAny.backgroundStyle === 'gradient'
            ? getGradientWithAngle(nodeAny.backgroundColors || [nodeAny.backgroundColor || '#6b7280'], nodeAny.gradientAngle || 135)
            : nodeAny.backgroundColor || '#6b7280'}
          stroke={nodeAny.borderColor || '#6b7280'}
          strokeWidth={nodeAny.borderStyle === 'none' ? '0' : (nodeAny.borderWidth || 2)}
          strokeLinejoin="round"
          {...getRoundedEdgesProps(roundedEdges)}
        />
      }
    />
  );
}
