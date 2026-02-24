"use client";

import React from "react";
import type { DiagramNodeData } from "@/lib/types";
import { getNodeSizeMultiplier } from "@/lib/visual-styling";
import { ShapeWrapper } from "./shape-wrapper";
import { getGradientWithAngle, getShapeStyles } from "./shape-utils";

interface SvgShapeBaseProps {
  node: DiagramNodeData & { width?: number; height?: number };
  viewBox: string;
  svgContent: React.ReactNode;
  /** e.g. "xMidYMid meet" for proportion-preserving shapes like kite */
  preserveAspectRatio?: string;
  defaultWidth?: number;
  defaultHeight?: number;
  overrideWidth?: number;
  overrideHeight?: number;
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
  preserveAspectRatio,
  defaultWidth = 60,
  defaultHeight = 60,
  overrideWidth,
  overrideHeight,
  ...rest
}: SvgShapeBaseProps) {
  const nodeAny = node as any;
  const scale = getNodeSizeMultiplier(nodeAny.nodeSize);
  const baseWidth = node.width ?? defaultWidth;
  const baseHeight = node.height ?? defaultHeight;
  const width = overrideWidth ?? (node.width != null ? node.width : Math.round(baseWidth * scale));
  const height = overrideHeight ?? (node.height != null ? node.height : Math.round(baseHeight * scale));
  const styles = getShapeStyles(node);

  return (
    <ShapeWrapper
      node={node}
      defaultWidth={defaultWidth}
      defaultHeight={defaultHeight}
      overrideWidth={overrideWidth}
      overrideHeight={overrideHeight}
      useSvgShadow={styles.shadow}
      skipWrapperStyling={true}
      {...rest}
    >
      <svg width={width} height={height} viewBox={viewBox} preserveAspectRatio={preserveAspectRatio} className="absolute inset-0">
        {svgContent}
      </svg>
    </ShapeWrapper>
  );
}
