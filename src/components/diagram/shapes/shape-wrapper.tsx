"use client";

import React from "react";
import type { DiagramNodeData, RichTextRun } from "@/lib/types";
import { useSlideShapeShadowTransitionMode } from "@/components/diagram/slide-shape-shadow-transition-context";
import { getNodeSizeMultiplier } from "@/lib/visual-styling";
import { getShapeStyles } from "./shape-utils";
import { ShapeTag } from "./shape-tag";
import { ShapeText } from "./shape-text";

interface ShapeWrapperProps {
  node: DiagramNodeData & { width?: number; height?: number };
  children?: React.ReactNode;
  defaultWidth?: number;
  defaultHeight?: number;
  /** Override dimensions during resize for instant visual feedback */
  overrideWidth?: number;
  overrideHeight?: number;
  borderRadius?: string;
  useSvgShadow?: boolean;
  skipWrapperStyling?: boolean; // When true, skip border/background styling on wrapper (for SVG shapes)
  // Tag props
  tag?: string;
  tagPosition?: string;
  isEditingTag: boolean;
  editTagText: string;
  onTagTextChange: (text: string) => void;
  onTagSubmit: () => void;
  onTagKeyDown: (e: React.KeyboardEvent) => void;
  onTagDoubleClick: (e: React.MouseEvent) => void;
  // Text props
  label: string;
  isEditingLabel: boolean;
  editRuns: RichTextRun[];
  onRichLabelSubmit: (plainText: string, runs: RichTextRun[]) => void;
  onVerticalAlignChange?: (position: "top" | "middle" | "bottom") => void;
  onLabelKeyDown: (e: React.KeyboardEvent) => void;
  onLabelDoubleClick: (e: React.MouseEvent) => void;
  /** Presentation slide transition: lerp fill/stroke between slides */
  slideColorTransition?: string;
}

export function ShapeWrapper({
  node,
  children,
  defaultWidth = 60,
  defaultHeight = 60,
  overrideWidth,
  overrideHeight,
  borderRadius,
  useSvgShadow = false,
  skipWrapperStyling = false,
  tag,
  tagPosition,
  isEditingTag,
  editTagText,
  onTagTextChange,
  onTagSubmit,
  onTagKeyDown,
  onTagDoubleClick,
  label,
  isEditingLabel,
  editRuns,
  onRichLabelSubmit,
  onVerticalAlignChange,
  onLabelKeyDown,
  onLabelDoubleClick,
  slideColorTransition,
}: ShapeWrapperProps) {
  const styles = getShapeStyles(node);
  const slideShapeShadowMode = useSlideShapeShadowTransitionMode();
  /** Only gradient crossfade stacks two paints; suppress per-layer shadow there and use one group filter. Merge-paint keeps the normal shadow so it never “blinks” off. */
  const suppressLayerShadow = styles.shadow && slideShapeShadowMode === "crossfade";
  const nodeAny = node as any;
  const scale = getNodeSizeMultiplier(nodeAny.nodeSize);
  const baseWidth = node.width ?? defaultWidth;
  const baseHeight = node.height ?? defaultHeight;
  const width = overrideWidth ?? (node.width != null ? node.width : Math.round(baseWidth * scale));
  const height = overrideHeight ?? (node.height != null ? node.height : Math.round(baseHeight * scale));
  const roundedEdges = nodeAny.roundedEdges || false;

  // Skip border/background styling when skipWrapperStyling is true (for SVG shapes)
  const shouldSkipStyling = skipWrapperStyling || useSvgShadow;

  // Extend shape by full border width with negative margin so adjacent borders overlap on same pixels
  const borderWidth = !shouldSkipStyling && styles.borderWidth ? parseInt(String(styles.borderWidth), 10) || 2 : 0;
  const overlap = borderWidth > 0 ? borderWidth : 0;

  // Calculate borderRadius when roundedEdges is enabled
  const calculatedBorderRadius = roundedEdges
    ? `${Math.min(width, height) * 0.06}px`
    : borderRadius;

  // Handle border image for gradient borders
  const borderImage = styles.borderImage;
  const borderColorForBorder = borderImage ? 'transparent' : styles.borderColor;
  const borderColors = styles.borderColors;

  // Check if we need special handling for rounded gradient borders
  // border-image doesn't work with border-radius, so we use padding approach
  const needsGradientBorderRounding = roundedEdges && borderImage && borderColors && calculatedBorderRadius;

  return (
    <div
      key={`gradient-${nodeAny.gradientAngle || 135}-${nodeAny.borderGradientAngle ?? nodeAny.gradientAngle ?? 135}`}
      className="relative"
      style={{
        boxSizing: 'border-box',
        borderRadius: needsGradientBorderRounding ? calculatedBorderRadius : undefined,
        width: width + overlap,
        height: height + overlap,
        minWidth: width + overlap,
        minHeight: height + overlap,
        marginRight: overlap ? -overlap : 0,
        marginBottom: overlap ? -overlap : 0,
        ...(styles.shadow && !suppressLayerShadow && !useSvgShadow && !needsGradientBorderRounding ? {
          boxShadow: 'var(--shape-shadow)'
        } : {}),
        ...(styles.shadow && !suppressLayerShadow && useSvgShadow && !needsGradientBorderRounding ? {
          filter: 'var(--shape-shadow-drop)'
        } : {})
      }}
    >
      {needsGradientBorderRounding ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: borderImage,
            borderRadius: calculatedBorderRadius,
            pointerEvents: 'none',
          }}
        />
      ) : null}

      <div
        style={{
          boxSizing: 'border-box',
          background: !shouldSkipStyling && !needsGradientBorderRounding ? styles.background : undefined,
          borderWidth: !shouldSkipStyling && !needsGradientBorderRounding ? styles.borderWidth : undefined,
          borderStyle: !shouldSkipStyling && !needsGradientBorderRounding ? styles.borderStyle : undefined,
          borderColor: !shouldSkipStyling && !needsGradientBorderRounding ? borderColorForBorder : undefined,
          borderImage: !shouldSkipStyling && !needsGradientBorderRounding ? borderImage : undefined,
          borderRadius: !needsGradientBorderRounding ? calculatedBorderRadius : undefined,
          width: needsGradientBorderRounding ? `calc(100% - ${styles.borderWidth})` : '100%',
          height: needsGradientBorderRounding ? `calc(100% - ${styles.borderWidth})` : '100%',
          margin: needsGradientBorderRounding ? `calc(${styles.borderWidth} / 2)` : 0,
          ...(styles.shadow && !suppressLayerShadow && !useSvgShadow && needsGradientBorderRounding ? {
            boxShadow: 'var(--shape-shadow)'
          } : {}),
          ...(styles.shadow && !suppressLayerShadow && useSvgShadow && needsGradientBorderRounding ? {
            filter: 'var(--shape-shadow-drop)'
          } : {}),
          ...(slideColorTransition !== undefined && !skipWrapperStyling ? { transition: slideColorTransition } : {}),
        }}
      >
        {children ?? null}

        <ShapeTag
          tag={tag ?? ''}
          tagPosition={tagPosition ?? 'top-left'}
          isEditingTag={isEditingTag}
          editTagText={editTagText}
          onTagTextChange={onTagTextChange}
          onTagSubmit={onTagSubmit}
          onTagKeyDown={onTagKeyDown}
          onTagDoubleClick={onTagDoubleClick}
        />

        <ShapeText
          node={node}
          label={label}
          isEditingLabel={isEditingLabel}
          editRuns={editRuns}
          onRichLabelSubmit={onRichLabelSubmit}
          onVerticalAlignChange={onVerticalAlignChange}
          onLabelKeyDown={onLabelKeyDown}
          onLabelDoubleClick={onLabelDoubleClick}
        />
      </div>
    </div>
  );
}
