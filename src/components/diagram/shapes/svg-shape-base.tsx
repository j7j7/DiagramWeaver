"use client";

import React from "react";
import type { DiagramNodeData, RichTextRun } from "@/lib/types";
import { getNodeSizeMultiplier } from "@/lib/visual-styling";
import { ShapeWrapper } from "./shape-wrapper";
import { getFrostedCircleClipPathCss, getShapeStyles, parseViewBoxString } from "./shape-utils";

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
  omitShapeText?: boolean;
  /** Allow paint outside viewBox (e.g. SVG feDropShadow on pie chart). */
  svgOverflowVisible?: boolean;
  /**
   * When `node.backgroundStyle === 'frosted'`, the glass layer is clipped to this rect (viewBox user units)
   * so it matches a transparent SVG fill. Omit for full bounding-box glass (e.g. complex polygons).
   */
  frostedClipRectInViewBox?: { x: number; y: number; w: number; h: number; rx?: number; ry?: number };
  /**
   * When frosted, optional CSS clip-path basic shape (e.g. `polygon(...)`) for non-rect fills.
   * Takes precedence over `frostedClipRectInViewBox` when both are set.
   */
  frostedClipPathOverride?: string;
  /**
   * When `backgroundStyle === 'frosted'`, clip inline glass to this circle in viewBox units
   * (same coordinate space as the SVG root). Ignored if `frostedClipPathOverride` is set.
   */
  frostedClipCircleInViewBox?: { cx: number; cy: number; r: number };
  /** Root SVG pointer-events (`none` lets events pass except on descendants with explicit hit targets). */
  svgPointerEvents?: React.CSSProperties["pointerEvents"];
  /** Allow handles/UI drawn outside the viewBox (e.g. grid row/column chrome). */
  preserveShellHalo?: boolean;
  /** CSS border-radius for SVG shell clip (matches rounded body in viewBox). */
  borderRadius?: string;
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
  omitShapeText,
  svgOverflowVisible = false,
  frostedClipRectInViewBox,
  frostedClipPathOverride,
  frostedClipCircleInViewBox,
  svgPointerEvents,
  preserveShellHalo,
  borderRadius,
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

  let frostedGlassClipPath: string | undefined;
  if (nodeAny.backgroundStyle === "frosted" && frostedClipPathOverride) {
    frostedGlassClipPath = frostedClipPathOverride;
  } else if (nodeAny.backgroundStyle === "frosted" && frostedClipCircleInViewBox) {
    frostedGlassClipPath = getFrostedCircleClipPathCss(
      viewBox,
      frostedClipCircleInViewBox,
      width,
      height,
      preserveAspectRatio
    );
  } else if (nodeAny.backgroundStyle === "frosted" && frostedClipRectInViewBox) {
    const { vbX, vbY, vbW, vbH } = parseViewBoxString(viewBox);
    if (vbW > 0 && vbH > 0) {
      const r = frostedClipRectInViewBox;
      const t = ((r.y - vbY) / vbH) * 100;
      const rgt = (vbX + vbW - (r.x + r.w)) / vbW * 100;
      const b = (vbY + vbH - (r.y + r.h)) / vbH * 100;
      const l = ((r.x - vbX) / vbW) * 100;
      const rxVb = r.rx ?? 0;
      const ryVb = r.ry ?? rxVb;
      const sx = width / vbW;
      const sy = height / vbH;
      let rPx = 0;
      if (rxVb > 0 || ryVb > 0) {
        rPx = Math.min(rxVb * sx, ryVb * sy);
        // Cap so `inset(… round …)` stays valid for pills / large rx (matches inner rounded rect).
        rPx = Math.min(rPx, 0.48 * Math.min(width, height));
      }
      const roundPx = rPx > 0 ? ` round ${rPx}px` : "";
      frostedGlassClipPath = `inset(${t}% ${rgt}% ${b}% ${l}%${roundPx})`;
    }
  }

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
      omitShapeText={omitShapeText}
      frostedGlassClipPath={frostedGlassClipPath}
      preserveShellHalo={preserveShellHalo}
      borderRadius={borderRadius}
      {...rest}
    >
      <svg
        width={width}
        height={height}
        viewBox={viewBox}
        preserveAspectRatio={preserveAspectRatio ?? "none"}
        className="absolute inset-0 dw-slide-svg-paint-tx"
        overflow={svgOverflowVisible ? "visible" : undefined}
        style={svgPointerEvents !== undefined ? { pointerEvents: svgPointerEvents } : undefined}
      >
        {svgPaintTransition ? (
          <style>{`
            .dw-slide-svg-paint-tx :is(path, circle, rect:not(.dw-grid-chart-cell-fill), polygon, polyline, line, ellipse, text, tspan) {
              transition: ${svgPaintTransition};
            }
          `}</style>
        ) : null}
        {svgContent}
      </svg>
    </ShapeWrapper>
  );
}
