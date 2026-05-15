"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import type { DiagramNodeData, PyramidDirection, PyramidSizing, RichTextRun, TimelineBarSectionData } from "@/lib/types";
import { SvgShapeBase } from "./svg-shape-base";
import { getGradientCoordinates, svgForeignObjectInlineInputStyle } from "./shape-utils";
import { useSvgGradient } from "@/hooks/use-svg-gradient";
import {
  normalizePyramidSections,
  pyramidHullClipPathCssPercent,
  pyramidOuterHullPolygonVb,
  pyramidTierHeights,
  pyramidTiersLayoutVb,
} from "@/lib/pyramid";
import {
  timelineBarSectionResolvedFontFamily,
  timelineBarSectionResolvedFontSizePx,
  timelineBarSectionResolvedFontStyle,
  timelineBarSectionResolvedFontWeight,
  timelineBarSectionResolvedTextAlign,
  timelineBarSectionResolvedTextDecoration,
  timelineBarSectionResolvedVerticalJustify,
  timelineBarSectionThemeHueFill,
} from "@/lib/timeline-bar";

interface PyramidShapeProps {
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
  onVerticalAlignChange?: (position: "top" | "middle" | "bottom") => void;
  onLabelKeyDown: (e: React.KeyboardEvent) => void;
  onLabelDoubleClick: (e: React.MouseEvent) => void;
  slideColorTransition?: string;
  defaultWidth?: number;
  defaultHeight?: number;
  overrideWidth?: number;
  overrideHeight?: number;
  isReadOnly?: boolean;
  onPatch?: (patch: Partial<DiagramNodeData>) => void;
  sectionLabelInteractionEnabled?: boolean;
}

const VIEWBOX_W = 120;
const VIEWBOX_H = 140;

function trapezoidPoints(cx: number, wInner: number, yb: number, yt: number, wb: number, wt: number): string {
  const hwb = (wb * wInner) / 2;
  const hwt = (wt * wInner) / 2;
  const xbl = cx - hwb;
  const xbr = cx + hwb;
  const xtl = cx - hwt;
  const xtr = cx + hwt;
  return `${xbl},${yb} ${xbr},${yb} ${xtr},${yt} ${xtl},${yt}`;
}

export function PyramidShape({
  node,
  slideColorTransition,
  defaultWidth = VIEWBOX_W,
  defaultHeight = VIEWBOX_H,
  overrideWidth,
  overrideHeight,
  isEditingLabel,
  sectionLabelInteractionEnabled,
  onPatch,
  isReadOnly = false,
  ...rest
}: PyramidShapeProps) {
  const nodeAny = node as unknown as Record<string, unknown>;
  const clipId = useId().replace(/:/g, "");
  const inlineSectionLabelCancelledRef = useRef(false);

  const [editingSectionIndex, setEditingSectionIndex] = useState<number | null>(null);
  const [sectionLabelDraft, setSectionLabelDraft] = useState("");

  const backgroundColors = (nodeAny.backgroundColors as string[]) || [(nodeAny.backgroundColor as string) || "#f3f4f6"];
  const borderColors = (nodeAny.borderColors as string[]) || [(nodeAny.borderColor as string) || "#6b7280"];
  const gradientAngle = (nodeAny.gradientAngle as number) || 135;
  const borderGradientAngle = (nodeAny.borderGradientAngle as number) ?? gradientAngle;
  const backgroundStyle = ((nodeAny.backgroundStyle as string) || "solid") as "solid" | "gradient" | "frosted" | "none";
  const borderStyle = ((nodeAny.borderStyle as string) || "solid") as "solid" | "dotted" | "gradient" | "none";

  const { defs: bgDefs, fillRef: _fillUnused, strokeRef } = useSvgGradient({
    colors: backgroundStyle === "gradient" ? backgroundColors : [backgroundColors[0]],
    angle: gradientAngle,
    borderColors: borderStyle === "gradient" ? borderColors : undefined,
    borderAngle: borderStyle === "gradient" ? borderGradientAngle : undefined,
    enabled: backgroundStyle === "gradient" || borderStyle === "gradient",
  });

  const strokeWidth = borderStyle === "none" ? 0 : (parseInt(String(nodeAny.borderWidth || 2), 10) || 2);
  const half = strokeWidth / 2;

  const w = (node.width ?? VIEWBOX_W) as number;
  const h = (node.height ?? VIEWBOX_H) as number;

  const sections = normalizePyramidSections(node);
  const sizing = ((nodeAny.pyramidSizing as string) || "equal") as PyramidSizing;
  const gapPx = typeof nodeAny.pyramidSegmentGap === "number" ? (nodeAny.pyramidSegmentGap as number) : 2;
  const direction = ((nodeAny.pyramidDirection as string) === "narrow-at-bottom"
    ? "narrow-at-bottom"
    : "narrow-at-top") as PyramidDirection;
  const apexRatio =
    typeof nodeAny.pyramidApexWidthRatio === "number" && Number.isFinite(nodeAny.pyramidApexWidthRatio as number)
      ? (nodeAny.pyramidApexWidthRatio as number)
      : 0.12;

  const innerHb = Math.max(4, h);
  const innerW = Math.max(2, w);
  const tiers = pyramidTiersLayoutVb({
    half,
    innerHb,
    wInner: innerW,
    gapPx,
    sections,
    sizing,
    apexRatio,
    direction,
  });
  const hull = pyramidOuterHullPolygonVb(half, innerW, tiers, apexRatio, direction);

  const heights = pyramidTierHeights(innerHb, gapPx, sections, sizing);

  const vbW = w + strokeWidth;
  const vbH = h + strokeWidth;

  const textCol = String(nodeAny.textColor || "#111827");

  const canEditSectionLabel = Boolean(onPatch && sectionLabelInteractionEnabled && !isReadOnly && !isEditingLabel);

  const cx = half + innerW / 2;

  const commitSectionLabelEdit = useCallback(() => {
    if (inlineSectionLabelCancelledRef.current) {
      inlineSectionLabelCancelledRef.current = false;
      return;
    }
    if (editingSectionIndex == null || !onPatch) return;
    const idx = editingSectionIndex;
    const next = sectionLabelDraft.trim();
    const prev = (sections[idx]?.label ?? "").trim();
    if (next !== prev) {
      const nextSecs = sections.map((s, j) => (j === idx ? { ...s, label: next } : s));
      onPatch({ pyramidSections: nextSecs });
    }
    setEditingSectionIndex(null);
  }, [editingSectionIndex, onPatch, sectionLabelDraft, sections]);

  const cancelSectionLabelEdit = useCallback(() => {
    inlineSectionLabelCancelledRef.current = true;
    setEditingSectionIndex(null);
  }, []);

  useEffect(() => {
    if (editingSectionIndex == null) return;
    if (editingSectionIndex < 0 || editingSectionIndex >= sections.length) {
      setEditingSectionIndex(null);
    }
  }, [editingSectionIndex, sections.length]);

  const strokePaint =
    borderStyle === "none"
      ? "none"
      : borderStyle === "gradient" && strokeRef
        ? strokeRef
        : String(nodeAny.borderColor || "#6b7280");
  const strokeDasharray = borderStyle === "dotted" ? "3,3" : undefined;

  // Theme-hue tiers: same `timelineBarHueStepDeg` as segmented timeline bars; migrate display from legacy `pyramidHueStepDeg`.
  const themeHueFillNode: DiagramNodeData = (() => {
    const t = nodeAny.timelineBarHueStepDeg;
    if (typeof t === "number" && Number.isFinite(t)) return node;
    const pLegacy = nodeAny.pyramidHueStepDeg;
    if (typeof pLegacy === "number" && Number.isFinite(pLegacy))
      return { ...node, timelineBarHueStepDeg: pLegacy } as DiagramNodeData;
    return node;
  })();

  const frostedHullCss = pyramidHullClipPathCssPercent(hull, vbW, vbH);

  const labelsFollowFirst = (nodeAny.pyramidLabelsFollowFirstSection as boolean | undefined) === true;

  const content = (
    <>
      {bgDefs}
      <defs>
        {sections.map((seg: TimelineBarSectionData, gi: number) => {
          if ((seg.fillStyle ?? "solid") !== "gradient") return null;
          const cols = seg.fillGradientColors;
          const c0 = cols && cols.length >= 2 ? String(cols[0]) : String(seg.fill ?? "#6b7280");
          const c1 = cols && cols.length >= 2 ? String(cols[1]) : c0;
          const ang =
            typeof seg.fillGradientAngle === "number" && Number.isFinite(seg.fillGradientAngle) ? seg.fillGradientAngle : 90;
          const coords = getGradientCoordinates(ang);
          return (
            <linearGradient
              key={`${clipId}-sgg-${gi}`}
              id={`${clipId}-sg-${gi}`}
              x1={coords.x1}
              y1={coords.y1}
              x2={coords.x2}
              y2={coords.y2}
            >
              <stop offset="0%" stopColor={c0} />
              <stop offset="100%" stopColor={c1} />
            </linearGradient>
          );
        })}
      </defs>

      <g pointerEvents="none">
        {tiers.map((tier, i) => {
          const seg = sections[i];
          const fs = seg.fillStyle ?? "solid";
          let fillPaint: string;
          if (fs === "none") {
            fillPaint = "transparent";
          } else if (fs === "gradient") {
            fillPaint = `url(#${clipId}-sg-${i})`;
          } else if (fs === "theme-hue") {
            fillPaint = timelineBarSectionThemeHueFill(themeHueFillNode, sections, i);
          } else {
            fillPaint = String(seg.fill ?? "#6b7280");
          }
          const segStroke =
            strokeWidth > 0 ? (strokePaint === "none" ? "transparent" : strokePaint) : "none";
          return (
            <polygon
              key={seg.id || i}
              points={trapezoidPoints(cx, innerW, tier.yBottom, tier.yTop, tier.wBottomFrac, tier.wTopFrac)}
              fill={fillPaint}
              stroke={segStroke}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="miter"
            />
          );
        })}
      </g>

      {sections.map((seg: TimelineBarSectionData, i: number) => {
        const tier = tiers[i];
        if (!tier) return null;
        const lab = (seg.label ?? "").trim();
        if (!lab) return null;
        const tierH = Math.max(0.5, heights[i] ?? Math.abs(tier.yBottom - tier.yTop));
        const lc = seg.labelColor ? String(seg.labelColor) : textCol;
        const wTopPx = tier.wTopFrac * innerW;
        const wBotPx = tier.wBottomFrac * innerW;
        const bandMidW = Math.max(wTopPx, wBotPx);
        const padX = Math.max(2, Math.min(6, bandMidW * 0.06));
        const padY = Math.max(1, Math.min(5, tierH * 0.1));
        const foW = Math.max(2, bandMidW - 2 * padX);
        const foH = Math.max(2, tierH - 2 * padY);
        const foLeft = cx - bandMidW / 2 + padX;
        const foTop = tier.yTop + padY;

        const isEditing = canEditSectionLabel && editingSectionIndex === i;
        const labelPointer = canEditSectionLabel ? "auto" : "none";
        const styleIdx = labelsFollowFirst && i > 0 ? 0 : i;
        const styleSeg = sections[styleIdx] ?? seg;
        const segFontSize = Math.min(
          tierH * 0.52,
          timelineBarSectionResolvedFontSizePx(styleSeg, styleIdx, sections, node),
          24,
        );
        const textAlignResolved = timelineBarSectionResolvedTextAlign(styleSeg, styleIdx, sections, node);
        const justifyContent = timelineBarSectionResolvedVerticalJustify(styleSeg, styleIdx, sections, node);
        const fontWeightResolved = timelineBarSectionResolvedFontWeight(styleSeg, styleIdx, sections, node);
        const fontFamily = timelineBarSectionResolvedFontFamily(styleSeg, styleIdx, sections, node);
        const fontStyle = timelineBarSectionResolvedFontStyle(styleSeg, styleIdx, sections, node) as React.CSSProperties["fontStyle"];
        const textDecoration = timelineBarSectionResolvedTextDecoration(styleSeg, styleIdx, sections, node) as React.CSSProperties["textDecoration"];
        const lineHeightMul =
          typeof nodeAny.lineHeight === "number" && Number.isFinite(nodeAny.lineHeight) ? Number(nodeAny.lineHeight) : 1.2;
        const letterSpacingPx =
          typeof nodeAny.letterSpacing === "number" && Number.isFinite(nodeAny.letterSpacing as number)
            ? (nodeAny.letterSpacing as number)
            : undefined;
        const textTransform = ((nodeAny.textTransform as string) || "none") as React.CSSProperties["textTransform"];
        const opacityStyle =
          Number(nodeAny.textOpacity) >= 0 && Number(nodeAny.textOpacity) !== 1
            ? { opacity: Number(nodeAny.textOpacity) }
            : {};

        return (
          <g key={`pylab-${seg.id}-${i}`}>
            <foreignObject x={foLeft} y={foTop} width={foW} height={foH} style={{ overflow: "hidden", pointerEvents: labelPointer }}>
              <div
                className={`flex h-full min-h-0 w-full flex-col ${canEditSectionLabel ? "cursor-text" : "cursor-default"}`}
                style={{ justifyContent }}
                onPointerDown={(e) => canEditSectionLabel && !isEditing && e.stopPropagation()}
                onDoubleClick={(e) => {
                  if (!canEditSectionLabel || isEditing) return;
                  e.stopPropagation();
                  e.preventDefault();
                  setEditingSectionIndex(i);
                  setSectionLabelDraft(seg.label ?? "");
                }}
              >
                {isEditing ? (
                  <textarea
                    value={sectionLabelDraft}
                    autoFocus
                    aria-label="Edit pyramid segment label"
                    className="m-0 box-border min-h-0 w-full flex-1 resize-none bg-transparent shadow-none focus:outline-none focus:ring-0"
                    style={{
                      ...svgForeignObjectInlineInputStyle({
                        fontSize: segFontSize,
                        fontWeight: fontWeightResolved,
                        color: lc,
                        caretColor: lc,
                        textAlign: textAlignResolved,
                      }),
                      minHeight: `${segFontSize * lineHeightMul}px`,
                      lineHeight: lineHeightMul,
                      overflow: "auto",
                      fontFamily,
                      fontStyle,
                      textDecoration,
                      ...(letterSpacingPx !== undefined ? { letterSpacing: `${letterSpacingPx}px` } : {}),
                      textTransform,
                      whiteSpace: "pre-wrap",
                      ...opacityStyle,
                    }}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setSectionLabelDraft(e.target.value)}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Escape") {
                        e.preventDefault();
                        cancelSectionLabelEdit();
                      } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        commitSectionLabelEdit();
                      }
                    }}
                    onBlur={() => commitSectionLabelEdit()}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <div
                    className="min-h-0 w-full overflow-auto"
                    style={{
                      ...opacityStyle,
                      margin: 0,
                      padding: 2,
                      boxSizing: "border-box",
                      fontFamily,
                      fontSize: segFontSize,
                      fontWeight: fontWeightResolved,
                      fontStyle,
                      textDecoration,
                      color: lc,
                      lineHeight: lineHeightMul,
                      textAlign: textAlignResolved,
                      wordBreak: "break-word",
                      overflowWrap: "anywhere",
                      ...(letterSpacingPx !== undefined ? { letterSpacing: `${letterSpacingPx}px` } : {}),
                      textTransform,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {lab}
                  </div>
                )}
              </div>
            </foreignObject>
          </g>
        );
      })}
    </>
  );

  return (
    <SvgShapeBase
      {...rest}
      isEditingLabel={isEditingLabel}
      node={node}
      slideColorTransition={slideColorTransition}
      defaultWidth={defaultWidth}
      defaultHeight={defaultHeight}
      overrideWidth={overrideWidth}
      overrideHeight={overrideHeight}
      viewBox={`0 0 ${vbW} ${vbH}`}
      frostedClipPathOverride={backgroundStyle === "frosted" ? frostedHullCss : undefined}
      svgPointerEvents="none"
      svgContent={content}
    />
  );
}
