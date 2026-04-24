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
  getFrostedInsetClipStyleForBackdropLayers,
  getFrostedGrainOverlayStyle,
  getFrostedFineGrainOverlayStyle,
  getFrostedGlassTopEdgeHighlightStyle,
  getFrostedGlassLeftEdgeHighlightStyle,
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
  /** Presentation slide transition: lerp fill/stroke between slides */
  slideColorTransition?: string;
  /** When true, skip ShapeText so the shape can render custom label regions (e.g. text-box-heading) */
  omitShapeText?: boolean;
  /** When `backgroundStyle` is frosted and this is set, clips the glass layer to match SVG geometry (see SvgShapeBase). */
  frostedGlassClipPath?: string;
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

/**
 * Clipping the **ancestor** of `backdrop-filter` often disables real blur in Chromium (tint/grain only).
 * For SVG rects we use `inset(...)` — omit that wrapper clip and clip grain/rims/shadow only.
 * Keep wrapper clip for `polygon(...)` so geometry stays roughly aligned (blur may stay weak there).
 */
function frostedInlineOuterClipPath(frostedGlassClipPath: string | undefined): string | undefined {
  if (!frostedGlassClipPath) return undefined;
  const s = frostedGlassClipPath.trimStart().toLowerCase();
  if (s.startsWith("inset(")) return undefined;
  return frostedGlassClipPath;
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

  // Frosted glass: inline `backdrop-filter` stack. SVG shapes skip CSS wrapper fill but still use
  // `backgroundStyle: 'frosted'` + transparent SVG fill — must not disable glass here.
  const isFrostedBg = nodeAny.backgroundStyle === "frosted";
  const frostedInlineSecondPassStyle =
    isFrostedBg && styles.frostedGlass
      ? getFrostedGlassInlineBackdropSecondPassStyle(styles.frostedGlass)
      : undefined;
  const suppressSvgRootFilter = shouldSuppressSvgDropShadowFilterForFrosted(isFrostedBg);
  const frostedOuterClip = frostedInlineOuterClipPath(frostedGlassClipPath);
  const frostedInsetBackdropClip = getFrostedInsetClipStyleForBackdropLayers(frostedGlassClipPath);

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
        ...(styles.shadow &&
        !suppressLayerShadow &&
        useSvgShadow &&
        !needsGradientBorderLayer &&
        !suppressSvgRootFilter
          ? {
              filter: "var(--shape-shadow-drop)",
            }
          : {})
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
          /* `overflow: visible` helps Chromium sample siblings behind this shape for inline `backdrop-filter`. */
          ...(isFrostedBg ? { position: "relative", overflow: "visible" } : {}),
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
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "inherit",
                pointerEvents: "none",
                /* No `isolation: isolate` here — it can trap `backdrop-filter` so the blur won’t see the diagram. */
                ...(frostedOuterClip
                  ? { clipPath: frostedOuterClip, WebkitClipPath: frostedOuterClip }
                  : {}),
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
                  style={{
                    ...getFrostedGlassInlineBackdropPrimaryStyle(styles.frostedGlass),
                    ...frostedInsetBackdropClip,
                  }}
                  aria-hidden
                />
                {frostedInlineSecondPassStyle ? (
                  <div
                    style={{ ...frostedInlineSecondPassStyle, ...frostedInsetBackdropClip }}
                    aria-hidden
                  />
                ) : null}
              </Fragment>
              <div
                style={{
                  ...getFrostedGlassTintLayerStyle(styles.frostedGlass),
                  ...frostedInsetBackdropClip,
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
              <div
                style={{
                  ...getFrostedGlassTopEdgeHighlightStyle(),
                  ...(frostedGlassClipPath ? { clipPath: frostedGlassClipPath, WebkitClipPath: frostedGlassClipPath } : {}),
                }}
                aria-hidden
              />
              <div
                style={{
                  ...getFrostedGlassLeftEdgeHighlightStyle(),
                  ...(frostedGlassClipPath ? { clipPath: frostedGlassClipPath, WebkitClipPath: frostedGlassClipPath } : {}),
                }}
                aria-hidden
              />
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
    </div>
  );
}
