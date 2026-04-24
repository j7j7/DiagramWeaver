"use client";

import React, { useRef } from "react";
import type { DiagramNodeData, RichTextRun } from "@/lib/types";
import { useSlideShapeShadowTransitionMode } from "@/components/diagram/slide-shape-shadow-transition-context";
import { getNodeSizeMultiplier } from "@/lib/visual-styling";
import {
  getFrostedGlassSurfaceStyle,
  getFrostedGrainOverlayStyle,
  getFrostedGlassTopEdgeHighlightStyle,
  getFrostedGlassLeftEdgeHighlightStyle,
  getShapeStyles,
} from "./shape-utils";
import { FrostedGlassPortalLayer } from "./frosted-glass-portal-layer";
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
  /** When true, skip ShapeText so the shape can render custom label regions (e.g. text-box-heading) */
  omitShapeText?: boolean;
  /** When `backgroundStyle` is frosted and this is set, clips the glass layer to match SVG geometry (see SvgShapeBase). */
  frostedGlassClipPath?: string;
  /**
   * When true, frosted `backdrop-filter` is rendered in a **viewport-fixed** portal on `document.body`
   * (or `#canvas-container` fallback)
   * so it blurs the real viewport (escapes pan/zoom `transform`) while staying under the diagram layer.
   */
  useFrostedGlassViewportPortal?: boolean;
  /** Stacking for the portal (shape container zIndex); should match the diagram node. */
  frostedGlassZIndex?: number;
  /** Pan/zoom from the canvas — enables in-layer frosted portal (working `backdrop-filter`). */
  frostedPanZoom?: { x: number; y: number; k: number };
  /** `#canvas-container` (or viewer root) — used with `frostedPanZoom` for diagram-space sizing. */
  frostedCanvasRef?: React.RefObject<HTMLElement | null>;
}

/**
 * html-to-image can gray out gradient fills when a node combines CSS border-image
 * with a gradient background. Keep this decision centralized so future refactors
 * preserve the export-safe layered border rendering.
 */
function shouldUseGradientBorderLayer(
  shouldSkipStyling: boolean,
  borderImage: string | undefined,
  borderColors: string[] | undefined
): boolean {
  return !shouldSkipStyling && !!(borderImage && borderColors);
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
  omitShapeText = false,
  frostedGlassClipPath,
  useFrostedGlassViewportPortal = false,
  frostedGlassZIndex = 2,
  frostedPanZoom,
  frostedCanvasRef,
}: ShapeWrapperProps) {
  const frostedLayoutRef = useRef<HTMLDivElement | null>(null);
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
  const borderGradientBackground = borderImage ? String(borderImage).replace(/\s+1$/, '') : undefined;

  // Use a layered gradient border for all gradient borders.
  // This avoids `border-image` export glitches (gray fills in html-to-image snapshots).
  const needsGradientBorderLayer = shouldUseGradientBorderLayer(shouldSkipStyling, borderImage, borderColors);

  // Frosted glass is a separate layer (inline or viewport portal). SVG shapes skip CSS wrapper
  // fill but still use `backgroundStyle: 'frosted'` + transparent SVG fill — must not disable glass here.
  const isFrostedBg = nodeAny.backgroundStyle === "frosted";
  const usePortalFrosted =
    Boolean(
      isFrostedBg &&
        styles.frostedGlass &&
        useFrostedGlassViewportPortal &&
        typeof document !== "undefined"
    );
  const frostedBorderRadius = calculatedBorderRadius ?? "0px";
  /** Portal uses getBoundingClientRect; position/rotation changes do not trigger ResizeObserver. */
  const frostedLayoutSyncKey = `${node.x},${node.y},${width},${height},${nodeAny.rotation ?? 0}`;

  return (
    <div
      key={`gradient-${nodeAny.gradientAngle || 135}-${nodeAny.borderGradientAngle ?? nodeAny.gradientAngle ?? 135}`}
      className="relative"
      style={{
        boxSizing: 'border-box',
        borderRadius: needsGradientBorderLayer ? calculatedBorderRadius : undefined,
        width: width + overlap,
        height: height + overlap,
        minWidth: width + overlap,
        minHeight: height + overlap,
        marginRight: overlap ? -overlap : 0,
        marginBottom: overlap ? -overlap : 0,
        ...(styles.shadow && !suppressLayerShadow && !useSvgShadow && !needsGradientBorderLayer ? {
          boxShadow: 'var(--shape-shadow)'
        } : {}),
        ...(styles.shadow && !suppressLayerShadow && useSvgShadow && !needsGradientBorderLayer ? {
          filter: 'var(--shape-shadow-drop)'
        } : {})
      }}
    >
      {needsGradientBorderLayer ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: borderGradientBackground,
            backgroundColor: borderColors?.[0],
            borderRadius: calculatedBorderRadius,
            pointerEvents: 'none',
          }}
        />
      ) : null}

      <div
        ref={frostedLayoutRef}
        data-shape-bg-fallback={!shouldSkipStyling ? styles.backgroundColor : undefined}
        data-shape-border-fallback={needsGradientBorderLayer ? (borderColors?.[0] ?? undefined) : undefined}
        style={{
          boxSizing: 'border-box',
          background: !shouldSkipStyling ? styles.background : undefined,
          // Keep a solid fallback under gradients for html-to-image export reliability.
          backgroundColor: !shouldSkipStyling ? styles.backgroundColor : undefined,
          borderWidth: !shouldSkipStyling && !needsGradientBorderLayer ? styles.borderWidth : undefined,
          borderStyle: !shouldSkipStyling && !needsGradientBorderLayer ? styles.borderStyle : undefined,
          borderColor: !shouldSkipStyling && !needsGradientBorderLayer ? borderColorForBorder : undefined,
          borderImage: !shouldSkipStyling && !needsGradientBorderLayer ? borderImage : undefined,
          borderRadius: !needsGradientBorderLayer ? calculatedBorderRadius : undefined,
          width: needsGradientBorderLayer ? `calc(100% - ${styles.borderWidth})` : '100%',
          height: needsGradientBorderLayer ? `calc(100% - ${styles.borderWidth})` : '100%',
          margin: needsGradientBorderLayer ? `calc(${styles.borderWidth} / 2)` : 0,
          ...(isFrostedBg ? { position: "relative", overflow: "hidden" } : {}),
          ...(styles.shadow && !suppressLayerShadow && !useSvgShadow && needsGradientBorderLayer ? {
            boxShadow: 'var(--shape-shadow)'
          } : {}),
          ...(styles.shadow && !suppressLayerShadow && useSvgShadow && needsGradientBorderLayer ? {
            filter: 'var(--shape-shadow-drop)'
          } : {}),
          ...(slideColorTransition !== undefined && !skipWrapperStyling ? { transition: slideColorTransition } : {}),
        }}
      >
        {!usePortalFrosted && isFrostedBg && styles.frostedGlass ? (
          <>
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "inherit",
                pointerEvents: "none",
                ...(frostedGlassClipPath ? { clipPath: frostedGlassClipPath } : {}),
              }}
              aria-hidden
            >
              <div style={getFrostedGlassSurfaceStyle(styles.frostedGlass)} aria-hidden />
              <div
                style={{
                  ...getFrostedGrainOverlayStyle(styles.frostedGlass.grainOpacity),
                  ...(frostedGlassClipPath ? { clipPath: frostedGlassClipPath } : {}),
                }}
                aria-hidden
              />
              <div style={getFrostedGlassTopEdgeHighlightStyle()} aria-hidden />
              <div style={getFrostedGlassLeftEdgeHighlightStyle()} aria-hidden />
            </div>
          </>
        ) : null}

        {isFrostedBg ? (
          <span className="relative z-[1] flex h-full min-h-0 w-full flex-col">
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

            {!omitShapeText ? (
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
            ) : null}
          </span>
        ) : (
          <>
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

            {!omitShapeText ? (
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
            ) : null}
          </>
        )}
      </div>

      {usePortalFrosted && styles.frostedGlass ? (
        <FrostedGlassPortalLayer
          glass={styles.frostedGlass}
          zIndex={frostedGlassZIndex}
          targetRef={frostedLayoutRef}
          borderRadius={frostedBorderRadius}
          clipPath={frostedGlassClipPath}
          panZoom={frostedPanZoom}
          canvasContainerRef={frostedCanvasRef}
          layoutSyncKey={frostedLayoutSyncKey}
        />
      ) : null}
    </div>
  );
}
