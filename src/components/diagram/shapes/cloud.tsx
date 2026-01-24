"use client";

import React from "react";
import type { DiagramNodeData } from "@/lib/types";
import { SvgShapeBase } from "./svg-shape-base";
import { getGradientWithAngle, getRoundedEdgesProps } from "./shape-utils";

interface CloudShapeProps {
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

export function CloudShape(props: CloudShapeProps) {
  const { node } = props;
  const nodeAny = node as any;
  const roundedEdges = nodeAny.roundedEdges || false;

  return (
    <SvgShapeBase
      {...props}
      viewBox="0 0 80 50"
      defaultWidth={80}
      defaultHeight={50}
      svgContent={
        <path
          d="M60,25 Q60,15 50,15 Q40,15 40,25 Q40,10 25,10 Q10,10 10,25 Q10,35 20,35 Q15,40 25,40 Q35,40 35,35 Q45,35 50,30 Q55,35 65,35 Q75,35 75,25 Q75,15 65,15 Q70,10 60,10 Q50,10 50,15 Q55,15 60,15 Z"
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
