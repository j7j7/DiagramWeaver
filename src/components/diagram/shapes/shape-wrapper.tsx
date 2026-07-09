"use client";

import React, { Fragment } from "react";
import type { DiagramNodeData, RichTextRun } from "@/lib/types";
import { useSlideShapeShadowTransitionMode } from "@/components/diagram/slide-shape-shadow-transition-context";
import { getNodeSizeMultiplier } from "@/lib/visual-styling";
import {
  getFrostedGlassDropShadowLayerStyle,
  getFrostedGlassTintLayerStyle,
  getFrostedGlassInlineBackdropPrimaryStyle,
  getFrostedGlassInlineBackdropSecondPassStyle,
  getFrostedInlineBackdropReactKey,
  getFrostedBackdropLayerClipStyle,
  getFrostedGrainOverlayStyle,
  getFrostedFineGrainOverlayStyle,
  getFrostedPerlinNoiseOverlayStyle,
  getFrostedGlassTopEdgeHighlightStyle,
  getFrostedGlassLeftEdgeHighlightStyle,
  getFrostedGlassExportBackdropPrimaryFallbackColor,
  getFrostedGlassExportBackdropSecondFallbackColor,
  getFrostedGlassExportRasterStackBlurPx,
  getFrostedGlassExportRasterBackdropSaturate,
  getShapeStyles,
} from "./shape-utils";
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
  onLabelTextHoverChange?: (hovered: boolean) => void;
  /** Presentation slide transition: lerp fill/stroke between slides */
  slideColorTransition?: string;
  /** Card / shape: single opacity exit keyed with last stagger (includes outer box-shadow/filter). */
  slideShellExitStyle?: React.CSSProperties;
  /** When true, skip ShapeText so the shape can render custom label regions (e.g. text-box-heading) */
  omitShapeText?: boolean;
  /** When `backgroundStyle` is frosted and this is set, clips the glass layer to match SVG geometry (see SvgShapeBase). */
  frostedGlassClipPath?: string;
  /** When true with `skipWrapperStyling`, keep shell overflow visible so outer box-shadow halos (e.g. card highlight glow) are not clipped. */
  preserveShellHalo?: boolean;
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

/** `filter` on an ancestor creates a backdrop root — inline `backdrop-filter` then won’t blur the diagram. */
function shouldSuppressSvgDropShadowFilterForFrosted(isFrostedBg: boolean): boolean {
  return isFrostedBg;
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
  onLabelTextHoverChange,
  slideColorTransition,
  slideShellExitStyle,
  omitShapeText = false,
  frostedGlassClipPath,
  preserveShellHalo = false,
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
  const borderGradientBackground = borderImage ? String(borderImage).replace(/\s+1$/, '') : undefined;

  // Use a layered gradient border for all gradient borders.
  // This avoids `border-image` export glitches (gray fills in html-to-image snapshots).
  const needsGradientBorderLayer = shouldUseGradientBorderLayer(shouldSkipStyling, borderImage, borderColors);
  const skipShellClip = shouldSkipStyling && !!calculatedBorderRadius;
  const clipShellOverflow = skipShellClip && !preserveShellHalo;

  // Frosted glass: inline `backdrop-filter` stack. SVG shapes skip CSS wrapper fill but still use
  // `backgroundStyle: 'frosted'` + transparent SVG fill — must not disable glass here.
  const isFrostedBg = nodeAny.backgroundStyle === "frosted";
  const frostedInlineSecondPassStyle =
    isFrostedBg && styles.frostedGlass
      ? getFrostedGlassInlineBackdropSecondPassStyle(styles.frostedGlass)
      : undefined;
  const suppressSvgRootFilter = shouldSuppressSvgDropShadowFilterForFrosted(isFrostedBg);
  const frostedBackdropLayerClip = getFrostedBackdropLayerClipStyle(frostedGlassClipPath);

  return (
    <div
      key={`gradient-${nodeAny.gradientAngle || 135}-${nodeAny.borderGradientAngle ?? nodeAny.gradientAngle ?? 135}`}
      className="relative"
      style={{
        boxSizing: 'border-box',
        borderRadius: needsGradientBorderLayer || skipShellClip ? calculatedBorderRadius : undefined,
        overflow: clipShellOverflow ? "hidden" : undefined,
        width: width + overlap,
        height: height + overlap,
        minWidth: width + overlap,
        minHeight: height + overlap,
        marginRight: overlap ? -overlap : 0,
        marginBottom: overlap ? -overlap : 0,
        ...(styles.shadow && !suppressLayerShadow && !useSvgShadow && !needsGradientBorderLayer ? {
          boxShadow: 'var(--shape-shadow)'
        } : {}),
        ...(styles.shadow &&
        !suppressLayerShadow &&
        useSvgShadow &&
        !needsGradientBorderLayer &&
        !suppressSvgRootFilter
          ? {
              filter: "var(--shape-shadow-drop)",
            }
          : {}),
        ...slideShellExitStyle,
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
          ...(skipShellClip
            ? { overflow: preserveShellHalo ? "visible" : "hidden" }
            : isFrostedBg
              ? { position: "relative", overflow: "visible" }
              : {}),
          ...(styles.shadow && !suppressLayerShadow && !useSvgShadow && needsGradientBorderLayer ? {
            boxShadow: 'var(--shape-shadow)'
          } : {}),
          ...(styles.shadow && !suppressLayerShadow && useSvgShadow && needsGradientBorderLayer ? {
            filter: 'var(--shape-shadow-drop)'
          } : {}),
          ...(slideColorTransition !== undefined && !skipWrapperStyling ? { transition: slideColorTransition } : {}),
        }}
      >
        {isFrostedBg && styles.frostedGlass ? (
          <>
            <div
              data-frosted-glass-stack=""
              data-frosted-clip-path={frostedGlassClipPath || undefined}
              data-frosted-export-blur={String(getFrostedGlassExportRasterStackBlurPx(styles.frostedGlass))}
              data-frosted-export-saturate={String(
                getFrostedGlassExportRasterBackdropSaturate(styles.frostedGlass)
              )}
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "inherit",
                pointerEvents: "none",
                /* No stack-root `clip-path` here — it breaks `backdrop-filter` in Chromium; layers clip themselves. */
              }}
              aria-hidden
            >
              <div
                style={{
                  ...getFrostedGlassDropShadowLayerStyle(styles.frostedGlass),
                  ...(frostedGlassClipPath ? { clipPath: frostedGlassClipPath, WebkitClipPath: frostedGlassClipPath } : {}),
                }}
                aria-hidden
              />
              <Fragment
                key={getFrostedInlineBackdropReactKey(styles.frostedGlass, frostedGlassClipPath)}
              >
                <div
                  data-frosted-backdrop=""
                  data-frosted-export-fallback-bg={getFrostedGlassExportBackdropPrimaryFallbackColor(
                    styles.frostedGlass
                  )}
                  style={{
                    ...getFrostedGlassInlineBackdropPrimaryStyle(styles.frostedGlass),
                    ...frostedBackdropLayerClip,
                  }}
                  aria-hidden
                />
                {frostedInlineSecondPassStyle ? (
                  <div
                    data-frosted-backdrop="second"
                    data-frosted-export-fallback-bg={getFrostedGlassExportBackdropSecondFallbackColor(
                      styles.frostedGlass
                    )}
                    style={{ ...frostedInlineSecondPassStyle, ...frostedBackdropLayerClip }}
                    aria-hidden
                  />
                ) : null}
              </Fragment>
              <div
                style={{
                  ...getFrostedGlassTintLayerStyle(styles.frostedGlass),
                  ...frostedBackdropLayerClip,
                }}
                aria-hidden
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "inherit",
                  overflow: "hidden",
                  pointerEvents: "none",
                  zIndex: 2,
                  ...(frostedGlassClipPath ? { clipPath: frostedGlassClipPath, WebkitClipPath: frostedGlassClipPath } : {}),
                }}
                aria-hidden
              >
                <div
                  style={{
                    ...getFrostedPerlinNoiseOverlayStyle(styles.frostedGlass.frostedPerlinNoise),
                    ...(frostedGlassClipPath ? { clipPath: frostedGlassClipPath, WebkitClipPath: frostedGlassClipPath } : {}),
                  }}
                  aria-hidden
                />
                <div
                  style={{
                    ...getFrostedGrainOverlayStyle(styles.frostedGlass.grainOpacity),
                    ...(frostedGlassClipPath ? { clipPath: frostedGlassClipPath, WebkitClipPath: frostedGlassClipPath } : {}),
                  }}
                  aria-hidden
                />
                <div
                  style={{
                    ...getFrostedFineGrainOverlayStyle(styles.frostedGlass.grainOpacity),
                    ...(frostedGlassClipPath ? { clipPath: frostedGlassClipPath, WebkitClipPath: frostedGlassClipPath } : {}),
                  }}
                  aria-hidden
                />
              </div>
              {/* Bbox-aligned 1px bars read as “box edges” on non-rect clips (rounded inset / polygon) even with clip-path. */}
              {!frostedGlassClipPath ? (
                <>
                  <div style={getFrostedGlassTopEdgeHighlightStyle()} aria-hidden />
                  <div style={getFrostedGlassLeftEdgeHighlightStyle()} aria-hidden />
                </>
              ) : null}
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
                onLabelTextHoverChange={onLabelTextHoverChange}
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
                onLabelTextHoverChange={onLabelTextHoverChange}
              />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
