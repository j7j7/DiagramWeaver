"use client";

import React from "react";
import type { DiagramNodeData } from "@/lib/types";
import { ShapeWrapper } from "./shape-wrapper";
import { getGradientWithAngle, getShapeStyles } from "./shape-utils";

interface SvgShapeBaseProps {
  node: DiagramNodeData & { width?: number; height?: number };
  viewBox: string;
  svgContent: React.ReactNode;
  defaultWidth?: number;
  defaultHeight?: number;
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

export function SvgShapeBase({
  node,
  viewBox,
  svgContent,
  defaultWidth = 60,
  defaultHeight = 60,
  ...rest
}: SvgShapeBaseProps) {
  const width = node.width || defaultWidth;
  const height = node.height || defaultHeight;
  const styles = getShapeStyles(node);
  const nodeAny = node as any;

  return (
    <ShapeWrapper
      node={node}
      defaultWidth={defaultWidth}
      defaultHeight={defaultHeight}
      useSvgShadow={styles.shadow}
      {...rest}
    >
      <svg width={width} height={height} viewBox={viewBox} className="absolute inset-0">
        {svgContent}
      </svg>
    </ShapeWrapper>
  );
}
