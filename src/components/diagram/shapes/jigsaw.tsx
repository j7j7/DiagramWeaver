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
      viewBox="0 0 120 120"
      svgContent={
        <path
          d="M 20,20 
             L 52,20 
             Q 52,24 54,26 
             Q 60,28 66,26 
             Q 68,24 68,20 
             L 100,20 
             L 100,52 
             Q 104,52 106,54 
             Q 108,60 106,66 
             Q 104,68 100,68 
             L 100,100 
             L 68,100 
             Q 68,96 66,94 
             Q 60,92 54,94 
             Q 52,96 52,100 
             L 20,100 
             L 20,68 
             Q 16,68 14,66 
             Q 12,60 14,54 
             Q 16,52 20,52 
             L 20,20 
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
