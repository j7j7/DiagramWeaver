"use client";

import React from "react";
import type { DiagramNodeData } from "@/lib/types";
import { SvgShapeBase } from "./svg-shape-base";
import { getGradientWithAngle } from "./shape-utils";

interface ArrowheadShapeProps {
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

export function ArrowheadShape(props: ArrowheadShapeProps) {
  const { node } = props;
  const nodeAny = node as any;

  return (
    <SvgShapeBase
      {...props}
      viewBox="0 0 60 40"
      defaultWidth={60}
      defaultHeight={40}
      svgContent={
        <polygon
          points="5,5 45,5 45,15 55,20 45,25 45,35 5,35"
          fill={nodeAny.backgroundStyle === 'gradient'
            ? getGradientWithAngle(nodeAny.backgroundColors || [nodeAny.backgroundColor || '#6b7280'], nodeAny.gradientAngle || 135)
            : nodeAny.backgroundColor || '#6b7280'}
          stroke={nodeAny.borderColor || '#6b7280'}
          strokeWidth={nodeAny.borderStyle === 'none' ? '0' : (nodeAny.borderWidth || 2)}
        />
      }
    />
  );
}
