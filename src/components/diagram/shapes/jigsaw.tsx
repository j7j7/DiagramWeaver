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
      viewBox="0 0 60 60"
      svgContent={
        <path
          d="M10,10 Q10,5 15,5 L45,5 Q50,5 50,10 L50,20 Q50,25 45,25 Q42,22 40,25 Q38,28 40,30 Q42,32 45,30 Q50,30 50,35 L50,45 Q50,50 45,50 L35,50 Q30,50 30,45 Q27,42 25,45 Q23,48 25,50 Q27,52 30,50 Q35,50 35,55 L25,55 Q20,55 20,50 Q17,47 15,50 Q13,53 15,55 Q17,57 20,55 Q25,55 25,60 L15,60 Q10,60 10,55 L10,45 Q10,40 15,40 Q18,43 20,40 Q22,37 20,35 Q18,33 15,35 Q10,35 10,30 L10,20 Q10,15 15,15 Q18,18 20,15 Q22,12 20,10 Q18,8 15,10 Q10,10 10,5 Z"
          fill={nodeAny.backgroundStyle === 'gradient'
            ? getGradientWithAngle(nodeAny.backgroundColors || [nodeAny.backgroundColor || '#6b7280'], nodeAny.gradientAngle || 135)
            : nodeAny.backgroundColor || '#6b7280'}
          stroke={nodeAny.borderColor || '#6b7280'}
          strokeWidth={nodeAny.borderStyle === 'none' ? '0' : (nodeAny.borderWidth || 2)}
          {...getRoundedEdgesProps(roundedEdges)}
        />
      }
    />
  );
}
