"use client";

import React from "react";
import type { DiagramNodeData, RichTextRun } from "@/lib/types";
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
  editRuns: RichTextRun[];
  onRichLabelSubmit: (plainText: string, runs: RichTextRun[]) => void;
  onVerticalAlignChange?: (position: 'top' | 'middle' | 'bottom') => void;
  onLabelKeyDown: (e: React.KeyboardEvent) => void;
  onLabelDoubleClick: (e: React.MouseEvent) => void;
  slideColorTransition?: string;
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
  slideColorTransition,
  ...rest
}: SvgShapeBaseProps) {
  const nodeAny = node as any;
  const scale = getNodeSizeMultiplier(nodeAny.nodeSize);
  const baseWidth = node.width ?? defaultWidth;
  const baseHeight = node.height ?? defaultHeight;
  const width = overrideWidth ?? (node.width != null ? node.width : Math.round(baseWidth * scale));
  const height = overrideHeight ?? (node.height != null ? node.height : Math.round(baseHeight * scale));
  const styles = getShapeStyles(node);

  const svgPaintTransition =
    slideColorTransition !== undefined && slideColorTransition !== "none" ? slideColorTransition : undefined;

  return (
    <ShapeWrapper
      node={node}
      defaultWidth={defaultWidth}
      defaultHeight={defaultHeight}
      overrideWidth={overrideWidth}
      overrideHeight={overrideHeight}
      useSvgShadow={styles.shadow}
      skipWrapperStyling={true}
      slideColorTransition={slideColorTransition}
      {...rest}
    >
      <svg
        width={width}
        height={height}
        viewBox={viewBox}
        preserveAspectRatio={preserveAspectRatio ?? "none"}
        className="absolute inset-0 dw-slide-svg-paint-tx"
      >
        {svgPaintTransition ? (
          <style>{`
            .dw-slide-svg-paint-tx :is(path, circle, rect, polygon, polyline, line, ellipse, text, tspan) {
              transition: ${svgPaintTransition};
            }
          `}</style>
        ) : null}
        {svgContent}
      </svg>
    </ShapeWrapper>
  );
}
