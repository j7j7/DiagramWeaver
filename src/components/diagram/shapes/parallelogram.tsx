"use client";

import React from "react";
import type { DiagramNodeData } from "@/lib/types";
import { SvgShapeBase } from "./svg-shape-base";
import { getGradientWithAngle } from "./shape-utils";

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

  return (
    <SvgShapeBase
      {...props}
      viewBox="0 0 80 50"
      defaultWidth={80}
      defaultHeight={50}
      svgContent={
        <polygon
          points="20,5 75,5 60,45 5,45"
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
