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
      viewBox="0 0 100 60"
      defaultWidth={100}
      defaultHeight={60}
      svgContent={
        <path
          d="M 20,42
             C 12,42 8,38 8,32
             C 8,26 12,22 18,22
             C 18,16 22,10 30,10
             C 35,10 39,13 41,17
             C 44,12 49,8 58,8
             C 68,8 74,14 76,22
             C 79,20 82,19 86,19
             C 92,19 96,23 96,29
             C 96,35 92,39 86,40
             C 84,44 80,48 74,48
             C 70,48 67,47 64,45
             C 60,47 55,49 48,49
             C 40,49 34,47 30,45
             C 27,47 23,48 20,48
             C 20,46 20,44 20,42 Z"
          fill={nodeAny.backgroundStyle === 'gradient'
            ? getGradientWithAngle(nodeAny.backgroundColors || [nodeAny.backgroundColor || '#6b7280'], nodeAny.gradientAngle || 135)
            : nodeAny.backgroundColor || '#6b7280'}
          stroke={nodeAny.borderColor || '#6b7280'}
          strokeWidth={nodeAny.borderStyle === 'none' ? '0' : (nodeAny.borderWidth || 2)}
          strokeLinecap="round"
          strokeLinejoin="round"
          {...getRoundedEdgesProps(roundedEdges)}
        />
      }
    />
  );
}
