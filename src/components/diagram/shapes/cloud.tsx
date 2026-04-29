"use client";

import React from "react";
import type { DiagramNodeData, RichTextRun } from "@/lib/types";
import { SvgShapeBase } from "./svg-shape-base";
import { getRoundedEdgesProps, getShapeSvgFill } from "./shape-utils";
import { useSvgGradient } from "@/hooks/use-svg-gradient";
import { CLOUD_SHAPE_PATH_D, CLOUD_SHAPE_VIEW_BOX } from "@/lib/cloud-shape";

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
  editRuns: RichTextRun[];
  onRichLabelSubmit: (plainText: string, runs: RichTextRun[]) => void;
  onVerticalAlignChange?: (position: 'top' | 'middle' | 'bottom') => void;
  onLabelKeyDown: (e: React.KeyboardEvent) => void;
  onLabelDoubleClick: (e: React.MouseEvent) => void;
}

export function CloudShape(props: CloudShapeProps) {
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

  const fillColor = getShapeSvgFill(backgroundStyle, fillRef, nodeAny.backgroundColor);
  const strokeColor = borderStyle === 'gradient' ? strokeRef : (nodeAny.borderColor || '#6b7280');
  const strokeWidth = borderStyle === 'none' ? '0' : (nodeAny.borderWidth || 2);
  const strokeDasharray = borderStyle === 'dotted' ? '3,3' : undefined;
  const strokeWidthNum = borderStyle === 'none' ? 0 : (parseInt(String(strokeWidth), 10) || 2);

  return (
    <SvgShapeBase
      {...props}
      viewBox={CLOUD_SHAPE_VIEW_BOX}
      defaultWidth={100}
      defaultHeight={60}
      svgContent={
        <>
          {defs}
          <path
            d={CLOUD_SHAPE_PATH_D}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
            strokeLinecap="round"
            strokeLinejoin="round"
            {...(strokeWidthNum > 0 ? { vectorEffect: "non-scaling-stroke" as const } : {})}
            {...getRoundedEdgesProps(roundedEdges)}
          />
        </>
      }
    />
  );
}
