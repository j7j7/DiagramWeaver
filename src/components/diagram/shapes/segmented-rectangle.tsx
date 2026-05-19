"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import type { DiagramNodeData, RichTextRun, TimelineBarSectionData } from "@/lib/types";
import type { ChartSlideStagger } from "@/lib/chart-presentation-stagger";
import {
  chartSegmentPopAnimationStyle,
  chartSegmentPopKeyframesCss,
} from "@/lib/chart-presentation-stagger";
import { SvgShapeBase } from "./svg-shape-base";
import { getGradientCoordinates } from "./shape-utils";
import { useSvgGradient } from "@/hooks/use-svg-gradient";
import { svgUserPointFromClient } from "@/lib/chart-pointer-geometry";
import { getNodeSizeMultiplier } from "@/lib/visual-styling";
import { connectionStrokeDashFromLineType } from "@/lib/utils";
import { labelToRuns, normalizeRuns, getPlainTextFromRuns } from "@/lib/rich-text";
import { TextboxRichEditor } from "../textbox-rich-editor";
import { TextboxRichDisplay } from "../textbox-rich-display";
import {
  clampTimelineBarT,
  normalizeTimelineBarSections,
  snapTimelineBarBoundaryT,
  timelineBarEnsureSpanSections,
  timelineBarMinSegmentT,
  timelineBarMoveJointAtVisualBoundary,
  timelineBarSectionResolvedFontFamily,
  timelineBarSectionResolvedFontSizePx,
  timelineBarSectionResolvedFontStyle,
  timelineBarSectionResolvedFontWeight,
  timelineBarSectionResolvedTextAlign,
  timelineBarSectionResolvedTextDecoration,
  timelineBarSectionResolvedVerticalJustify,
  timelineBarSectionThemeHueBorderGradient,
  timelineBarSectionThemeHueFill,
  timelineBarSectionThemeHueFillGradient,
  timelineBarUsesSpanLayout,
} from "@/lib/timeline-bar";
import {
  normalizeSegmentedRectangleSections,
  segmentedRectangleDividerInnerXs,
  segmentedRectangleSegmentLayout,
} from "@/lib/segmented-rectangle";
import { buildSectionLabelRichTextNode } from "@/lib/section-label-rich-node";

interface SegmentedRectangleShapeProps {
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
  /** Diagram X of node origin — snap segment boundaries onto the horizontal grid (`horizontal` placement only). */
  diagramSnapX?: number;
  /** Diagram Y of node origin — snap segment boundaries onto the vertical grid (`vertical` placement only). */
  diagramSnapY?: number;
  onPatch?: (patch: Partial<DiagramNodeData>) => void;
  sectionBoundaryInteractionEnabled?: boolean;
  sectionLabelInteractionEnabled?: boolean;
  onSectionBoundaryDragSessionChange?: (active: boolean) => void;
  /** Presentation slide transitions: sequential segment opacity pop (see `useSlideTransition`). */
  presentationSectionSlideStagger?: ChartSlideStagger;
}

const VIEWBOX_W = 120;
const VIEWBOX_H = 48;

export function SegmentedRectangleShape({
  node,
  slideColorTransition,
  defaultWidth = VIEWBOX_W,
  defaultHeight = VIEWBOX_H,
  overrideWidth,
  overrideHeight,
  diagramSnapX,
  diagramSnapY,
  isEditingLabel,
  sectionBoundaryInteractionEnabled,
  sectionLabelInteractionEnabled,
  onPatch,
  onSectionBoundaryDragSessionChange,
  presentationSectionSlideStagger,
  isReadOnly = false,
  ...rest
}: SegmentedRectangleShapeProps) {
  const nodeAny = node as unknown as Record<string, unknown>;
  const clipId = useId().replace(/:/g, "");
  const sectionSlidePopInId = `${clipId}-srSecSlideIn`;
  const sectionSlidePopOutId = `${clipId}-srSecSlideOut`;
  const dragActiveRef = useRef(false);
  const workingSectionsRef = useRef<TimelineBarSectionData[]>([]);
  const boundaryIndexRef = useRef(0);
  const inlineSectionLabelCancelledRef = useRef(false);

  const [editingSectionIndex, setEditingSectionIndex] = useState<number | null>(null);

  const backgroundColors = (nodeAny.backgroundColors as string[]) || [(nodeAny.backgroundColor as string) || "#f3f4f6"];
  const borderColors = (nodeAny.borderColors as string[]) || [(nodeAny.borderColor as string) || "#6b7280"];
  const gradientAngle = (nodeAny.gradientAngle as number) || 135;
  const borderGradientAngle = (nodeAny.borderGradientAngle as number) ?? gradientAngle;
  const backgroundStyle = ((nodeAny.backgroundStyle as string) || "solid") as "solid" | "gradient" | "frosted" | "none";
  const borderStyle = ((nodeAny.borderStyle as string) || "solid") as "solid" | "dotted" | "gradient" | "none";

  const outlineMode =
    (nodeAny.segmentedRectangleOutlineMode as "container" | "segments" | "none" | undefined) ?? "container";

  const { defs: bgDefs, strokeRef } = useSvgGradient({
    colors: backgroundStyle === "gradient" ? backgroundColors : [backgroundColors[0]],
    angle: gradientAngle,
    borderColors: borderStyle === "gradient" ? borderColors : undefined,
    borderAngle: borderStyle === "gradient" ? borderGradientAngle : undefined,
    enabled: backgroundStyle === "gradient" || borderStyle === "gradient",
  });

  const baseNodeStrokeW = borderStyle === "none" ? 0 : (parseInt(String(nodeAny.borderWidth || 2), 10) || 2);
  const half = baseNodeStrokeW / 2;
  const showContainerStroke = outlineMode === "container" && baseNodeStrokeW > 0;
  const strokeWidth = showContainerStroke ? baseNodeStrokeW : 0;

  const w = (node.width ?? VIEWBOX_W) as number;
  const h = (node.height ?? VIEWBOX_H) as number;
  const minDim = Math.min(w, h);
  const cornerRadius = Math.max(0, Math.min(1, ((nodeAny.cornerRadius as number) ?? 0.12) as number));
  const maxRadius = minDim / 2;
  const rx = Math.min(cornerRadius * maxRadius, maxRadius);

  const sectionsRaw = normalizeSegmentedRectangleSections(node);
  const sizing =
    ((nodeAny.segmentedRectangleSizing as string) || "equal") as "equal" | "weighted";
  const gapPx = Math.max(0, Number(nodeAny.segmentedRectangleSegmentGap) || 0);
  const showDividers = nodeAny.segmentedRectangleDividers === true;
  const divW =
    showDividers && sectionsRaw.length > 1
      ? Math.max(0.5, Math.min(8, Number(nodeAny.segmentedRectangleDividerWidth) || 1))
      : 0;
  const divColor = String(nodeAny.segmentedRectangleDividerColor || "#64748b");
  let divInsetFrac = Number(nodeAny.segmentedRectangleDividerInset);
  if (!Number.isFinite(divInsetFrac)) divInsetFrac = 0.08;
  divInsetFrac = Math.min(0.45, Math.max(0, divInsetFrac));

  const barH = Math.max(4, h);
  const placementVertical =
    ((nodeAny.segmentedRectanglePlacementOrder as string | undefined) ?? "horizontal") === "vertical";
  const layoutAlong = placementVertical ? barH : w;
  const { starts, widths } = segmentedRectangleSegmentLayout(sectionsRaw, layoutAlong, sizing, gapPx);
  const sections = sectionsRaw;
  const normSections = normalizeTimelineBarSections({ ...node, timelineBarSections: sections } as DiagramNodeData);
  /** Divider lines + boundary drag hit targets (inner coords along the stacking axis). */
  const jointAlongAxis = segmentedRectangleDividerInnerXs(sections, starts, widths, gapPx);

  /** Boundary drag matches timeline spans only when contiguous (no gap) or weighted (gap clears when dragging). */
  const boundaryResizeLayout =
    gapPx === 0 || sizing === "weighted";

  const scale = getNodeSizeMultiplier(nodeAny.nodeSize as "normal" | "half" | "quarter" | undefined);
  const baseW = node.width ?? defaultWidth;
  const baseH = node.height ?? defaultHeight;
  const snapBarWidthPx = overrideWidth ?? (node.width != null ? node.width : Math.round(baseW * scale));
  const snapBarHeightPx = overrideHeight ?? (node.height != null ? node.height : Math.round(baseH * scale));
  const snapAlongPx = placementVertical ? snapBarHeightPx : snapBarWidthPx;

  const hueStepRaw = nodeAny.segmentedRectangleHueStepDeg as number | undefined;
  const nodeForHue: DiagramNodeData = {
    ...node,
    timelineBarHueStepDeg: typeof hueStepRaw === "number" && Number.isFinite(hueStepRaw) ? hueStepRaw : undefined,
  } as DiagramNodeData;

  const endBoundaryDrag = useCallback(() => {
    if (!dragActiveRef.current) return;
    dragActiveRef.current = false;
    onSectionBoundaryDragSessionChange?.(false);
  }, [onSectionBoundaryDragSessionChange]);

  const applyClientToBoundary = useCallback(
    (clientX: number, clientY: number, boundaryIdx: number, svg: SVGSVGElement) => {
      if (!onPatch || !boundaryResizeLayout) return;
      const pt = svgUserPointFromClient(svg, clientX, clientY);
      if (!pt) return;
      let t = placementVertical
        ? (pt.y - half) / Math.max(1e-6, barH)
        : (pt.x - half) / Math.max(1e-6, w);
      t = clampTimelineBarT(t);
      const snapOrigin = placementVertical ? diagramSnapY : diagramSnapX;
      if (typeof snapOrigin === "number" && Number.isFinite(snapOrigin)) {
        t = snapTimelineBarBoundaryT(snapOrigin, snapAlongPx, t);
      }
      const minDt = timelineBarMinSegmentT(snapAlongPx);
      const next = timelineBarMoveJointAtVisualBoundary(
        workingSectionsRef.current,
        boundaryIdx,
        t,
        minDt,
      );
      if (!next) return;
      workingSectionsRef.current = next;
      onPatch({ segmentedRectangleSections: next });
    },
    [barH, boundaryResizeLayout, diagramSnapX, diagramSnapY, half, onPatch, placementVertical, snapAlongPx, w],
  );

  const onPointerDownBoundary = useCallback(
    (boundaryIdx: number) => (e: React.PointerEvent<SVGRectElement>) => {
      if (
        !sectionBoundaryInteractionEnabled ||
        !onPatch ||
        isReadOnly ||
        isEditingLabel ||
        editingSectionIndex != null ||
        !boundaryResizeLayout
      )
        return;
      e.stopPropagation();
      e.preventDefault();
      const clearGapForWeightedDrag = gapPx > 0 && sizing === "weighted";
      const secsForMigrate =
        clearGapForWeightedDrag && timelineBarUsesSpanLayout(sections)
          ? sections.map(({ spanStart: _a, spanEnd: _b, ...rest }) => rest)
          : sections;
      const migrated = timelineBarEnsureSpanSections(secsForMigrate, placementVertical ? barH : w, sizing);
      workingSectionsRef.current = migrated;
      const dragPatch: Partial<DiagramNodeData> = {};
      if (clearGapForWeightedDrag) dragPatch.segmentedRectangleSegmentGap = 0;
      if (clearGapForWeightedDrag || !timelineBarUsesSpanLayout(sections)) {
        dragPatch.segmentedRectangleSections = migrated;
      }
      if (Object.keys(dragPatch).length > 0) onPatch(dragPatch);
      boundaryIndexRef.current = boundaryIdx;
      dragActiveRef.current = true;
      onSectionBoundaryDragSessionChange?.(true);
      const svg = (e.currentTarget as SVGRectElement).ownerSVGElement;
      if (svg) applyClientToBoundary(e.clientX, e.clientY, boundaryIdx, svg);
      (e.currentTarget as SVGRectElement).setPointerCapture(e.pointerId);
    },
    [
      applyClientToBoundary,
      boundaryResizeLayout,
      barH,
      gapPx,
      isEditingLabel,
      isReadOnly,
      onPatch,
      onSectionBoundaryDragSessionChange,
      placementVertical,
      sectionBoundaryInteractionEnabled,
      editingSectionIndex,
      sections,
      sizing,
      w,
    ],
  );

  const onPointerMoveBoundary = useCallback(
    (e: React.PointerEvent<SVGRectElement>) => {
      if (!dragActiveRef.current || !onPatch) return;
      const svg = (e.currentTarget as SVGRectElement).ownerSVGElement;
      if (svg) applyClientToBoundary(e.clientX, e.clientY, boundaryIndexRef.current, svg);
    },
    [applyClientToBoundary, onPatch],
  );

  const onPointerUpBoundary = useCallback(
    (e: React.PointerEvent<SVGRectElement>) => {
      try {
        (e.currentTarget as SVGRectElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      endBoundaryDrag();
    },
    [endBoundaryDrag],
  );

  const strokePaint =
    outlineMode !== "container"
      ? "none"
      : borderStyle === "none"
        ? "none"
        : borderStyle === "gradient" && strokeRef
          ? strokeRef
          : String(nodeAny.borderColor || "#6b7280");
  const strokeDasharray = borderStyle === "dotted" ? "3,3" : undefined;

  /** Segment strokes use half-inset geometry; vb must reserve bleed like container mode (`timeline-bar.tsx`). */
  const maxSegmentOutlinePx =
    outlineMode === "segments"
      ? sections.reduce((mx, seg) => {
          const swSeg =
            typeof seg.segmentOutlineWidth === "number" && Number.isFinite(seg.segmentOutlineWidth)
              ? Math.max(0, seg.segmentOutlineWidth)
              : baseNodeStrokeW;
          if (swSeg <= 0) return mx;
          const st = seg.segmentOutlineStyle;
          const effectiveSt =
            st === "solid" || st === "dotted" || st === "none"
              ? st
              : borderStyle === "dotted"
                ? "dotted"
                : "solid";
          if (effectiveSt === "none") return mx;
          return Math.max(mx, swSeg);
        }, 0)
      : 0;

  const viewBoxStrokeBleed = Math.max(strokeWidth, maxSegmentOutlinePx);
  const vbW = w + viewBoxStrokeBleed;
  const vbH = h + viewBoxStrokeBleed;

  const textCol = String(nodeAny.textColor || "#111827");

  const canEditSectionLabel = Boolean(
    onPatch && sectionLabelInteractionEnabled && !isReadOnly && !isEditingLabel,
  );

  const handleSectionRichLabelSubmit = useCallback(
    (plainText: string, runs: RichTextRun[]) => {
      if (inlineSectionLabelCancelledRef.current) {
        inlineSectionLabelCancelledRef.current = false;
        return;
      }
      if (editingSectionIndex == null || !onPatch) return;
      const idx = editingSectionIndex;
      const norm = normalizeRuns(runs);
      const nextPlain = plainText.trim();
      const prevRuns = normalizeRuns(sections[idx].richLabel ?? labelToRuns(sections[idx].label ?? ""));
      const prevPlain = getPlainTextFromRuns(prevRuns).trim();
      if (nextPlain !== prevPlain || JSON.stringify(norm) !== JSON.stringify(prevRuns)) {
        const nextSecs = sections.map((s, j) =>
          j === idx
            ? {
                ...s,
                label: nextPlain,
                richLabel: norm.length > 0 ? norm : undefined,
              }
            : s,
        );
        onPatch({ segmentedRectangleSections: nextSecs });
      }
      setEditingSectionIndex(null);
    },
    [editingSectionIndex, onPatch, sections],
  );

  const cancelSectionLabelEdit = useCallback(() => {
    inlineSectionLabelCancelledRef.current = true;
    setEditingSectionIndex(null);
  }, []);

  const patchEditingSectionLabelVerticalAlign = useCallback(
    (position: "top" | "middle" | "bottom") => {
      if (editingSectionIndex == null || !onPatch) return;
      const labelsFollowFirst =
        (nodeAny.segmentedRectangleLabelsFollowFirstSection as boolean | undefined) === true;
      const targetIdx =
        labelsFollowFirst && editingSectionIndex > 0 ? 0 : editingSectionIndex;
      const nextSecs = sections.map((s, j) =>
        j === targetIdx ? { ...s, labelVerticalAlign: position } : s,
      );
      onPatch({ segmentedRectangleSections: nextSecs });
    },
    [editingSectionIndex, nodeAny.segmentedRectangleLabelsFollowFirstSection, onPatch, sections],
  );

  useEffect(() => {
    if (editingSectionIndex == null) return;
    if (editingSectionIndex < 0 || editingSectionIndex >= sections.length) {
      setEditingSectionIndex(null);
    }
  }, [editingSectionIndex, sections.length]);

  /** Per-track clip uses full-node `rx`; segment capsules use smaller `segRx` when each `wi < w`. Intersecting was carving endpoint lunulas beside first/last pills. Segments-outline: omit group clip — each capsule fill is sufficient. */
  const segmentFillsCompositeClipUrl = outlineMode === "segments" ? undefined : `url(#${clipId}-sr-clip)`;

  const content = (
    <>
      {bgDefs}
      <defs>
        {presentationSectionSlideStagger ? (
          <style
            type="text/css"
            dangerouslySetInnerHTML={{
              __html: chartSegmentPopKeyframesCss(sectionSlidePopInId, sectionSlidePopOutId),
            }}
          />
        ) : null}
        <clipPath id={`${clipId}-sr-clip`}>
          <rect x={half} y={half} width={w} height={barH} rx={rx} ry={rx} />
        </clipPath>
        {sections.map((seg: TimelineBarSectionData, gi: number) => {
          if ((seg.fillStyle ?? "solid") !== "gradient") return null;
          const cols = seg.fillGradientColors;
          const c0 = cols && cols.length >= 2 ? String(cols[0]) : String(seg.fill ?? "#6b7280");
          const c1 = cols && cols.length >= 2 ? String(cols[1]) : c0;
          const ang =
            typeof seg.fillGradientAngle === "number" && Number.isFinite(seg.fillGradientAngle)
              ? seg.fillGradientAngle
              : 90;
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
        {sections.map((segTh: TimelineBarSectionData, gi: number) => {
          if ((segTh.fillStyle ?? "solid") !== "theme-hue") return null;
          const thg = timelineBarSectionThemeHueFillGradient(nodeForHue, normSections, gi);
          if (!thg) return null;
          const coords = getGradientCoordinates(thg.angleDeg);
          return (
            <linearGradient
              key={`${clipId}-thfg-${gi}`}
              id={`${clipId}-th-fill-${gi}`}
              x1={coords.x1}
              y1={coords.y1}
              x2={coords.x2}
              y2={coords.y2}
            >
              <stop offset="0%" stopColor={thg.start} />
              <stop offset="100%" stopColor={thg.end} />
            </linearGradient>
          );
        })}
        {outlineMode === "segments" && borderStyle === "gradient"
          ? sections.map((segB: TimelineBarSectionData, gi: number) => {
              if ((segB.fillStyle ?? "solid") !== "theme-hue") return null;
              if (segB.segmentOutlineColor?.trim()) return null;
              const thb = timelineBarSectionThemeHueBorderGradient(nodeForHue, normSections, gi);
              if (!thb) return null;
              const coords = getGradientCoordinates(thb.angleDeg);
              return (
                <linearGradient
                  key={`${clipId}-thsg-${gi}`}
                  id={`${clipId}-th-stroke-${gi}`}
                  x1={coords.x1}
                  y1={coords.y1}
                  x2={coords.x2}
                  y2={coords.y2}
                >
                  <stop offset="0%" stopColor={thb.start} />
                  <stop offset="100%" stopColor={thb.end} />
                </linearGradient>
              );
            })
          : null}
      </defs>

      <g
        {...(segmentFillsCompositeClipUrl ? { clipPath: segmentFillsCompositeClipUrl } : {})}
        pointerEvents="none"
      >
        {sections.map((seg: TimelineBarSectionData, i: number) => {
          const wi = widths[i] ?? 0;
          const s0 = starts[i] ?? 0;
          const bx = placementVertical ? half : half + s0;
          const by = placementVertical ? half + s0 : half;
          const bw = placementVertical ? w : Math.max(0, wi);
          const bh = placementVertical ? Math.max(0, wi) : barH;
          const fs = seg.fillStyle ?? "solid";
          let fillPaint: string;
          if (fs === "none") {
            fillPaint = "transparent";
          } else if (fs === "gradient") {
            fillPaint = `url(#${clipId}-sg-${i})`;
          } else if (fs === "theme-hue") {
            const thg = timelineBarSectionThemeHueFillGradient(nodeForHue, normSections, i);
            fillPaint = thg ? `url(#${clipId}-th-fill-${i})` : timelineBarSectionThemeHueFill(nodeForHue, normSections, i);
          } else {
            fillPaint = String(seg.fill ?? "#6b7280");
          }
          /**
           * Segments-outline: per-capsule `segRx`; no composite group clip (`segRx_track ≠ segRx_segment` lunulas).
           * Container / none: `rx=0` rects + `#sr-clip` (timeline-bar parity).
           */
          const segRxFill =
            outlineMode === "segments"
              ? placementVertical
                ? Math.min(rx, wi / 2, w / 2)
                : Math.min(rx, wi / 2, barH / 2)
              : 0;
          const fillPopStyle = chartSegmentPopAnimationStyle(
            i,
            sectionSlidePopInId,
            sectionSlidePopOutId,
            0,
            0,
            presentationSectionSlideStagger,
          );
          return (
            <g key={`sr-fill-${seg.id ?? i}`} style={fillPopStyle}>
              <rect
                x={bx}
                y={by}
                width={bw}
                height={bh}
                rx={segRxFill}
                ry={segRxFill}
                fill={fillPaint}
                stroke="none"
              />
            </g>
          );
        })}
      </g>

      {showDividers && sections.length > 1 && divW > 0 ? (
        <g pointerEvents="none">
          {placementVertical
            ? jointAlongAxis.map((ja, k) => {
                const yi = half + ja;
                const x1 = half + w * divInsetFrac;
                const x2 = half + w * (1 - divInsetFrac);
                return (
                  <line
                    key={`sr-div-${k}`}
                    x1={x1}
                    y1={yi}
                    x2={x2}
                    y2={yi}
                    stroke={divColor}
                    strokeWidth={divW}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })
            : jointAlongAxis.map((ja, k) => {
                const xi = half + ja;
                const y1 = half + barH * divInsetFrac;
                const y2 = half + barH * (1 - divInsetFrac);
                return (
                  <line
                    key={`sr-div-${k}`}
                    x1={xi}
                    y1={y1}
                    x2={xi}
                    y2={y2}
                    stroke={divColor}
                    strokeWidth={divW}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
        </g>
      ) : null}

      {outlineMode === "segments"
        ? sections.map((seg: TimelineBarSectionData, i: number) => {
            const wi = widths[i] ?? 0;
            const s0 = starts[i] ?? 0;
            const bx = placementVertical ? half : half + s0;
            const by = placementVertical ? half + s0 : half;
            const bw = placementVertical ? w : Math.max(0, wi);
            const bh = placementVertical ? Math.max(0, wi) : barH;
            const segRx = placementVertical ? Math.min(rx, wi / 2, w / 2) : Math.min(rx, wi / 2, barH / 2);
            const swSeg =
              typeof seg.segmentOutlineWidth === "number" && Number.isFinite(seg.segmentOutlineWidth)
                ? Math.max(0, seg.segmentOutlineWidth)
                : baseNodeStrokeW;
            if (swSeg <= 0) return null;
            const st = seg.segmentOutlineStyle;
            const effectiveSt =
              st === "solid" || st === "dotted" || st === "none"
                ? st
                : borderStyle === "dotted"
                  ? "dotted"
                  : "solid";
            if (effectiveSt === "none") return null;
            const hasExplicitOutlineColor = Boolean(seg.segmentOutlineColor?.trim());
            const colSolid =
              seg.segmentOutlineColor?.trim() ||
              (borderStyle === "gradient"
                ? String(borderColors[0] ?? nodeAny.borderColor)
                : String(nodeAny.borderColor || "#6b7280"));
            let strokeCol: string;
            if (!hasExplicitOutlineColor && borderStyle === "gradient" && strokeRef) {
              if ((seg.fillStyle ?? "solid") === "theme-hue") {
                const thb = timelineBarSectionThemeHueBorderGradient(nodeForHue, normSections, i);
                strokeCol = thb ? `url(#${clipId}-th-stroke-${i})` : strokeRef;
              } else {
                strokeCol = strokeRef;
              }
            } else {
              strokeCol = colSolid;
            }
            const dash = effectiveSt === "dotted" ? connectionStrokeDashFromLineType(swSeg, "dotted").strokeDasharray : undefined;
            const outlinePopStyle = chartSegmentPopAnimationStyle(
              i,
              sectionSlidePopInId,
              sectionSlidePopOutId,
              0,
              0,
              presentationSectionSlideStagger,
            );
            return (
              <g key={`sr-seg-stroke-${seg.id}-${i}`} style={outlinePopStyle}>
                <rect
                  x={bx}
                  y={by}
                  width={bw}
                  height={bh}
                  rx={segRx}
                  ry={segRx}
                  fill="none"
                  stroke={strokeCol}
                  strokeWidth={swSeg}
                  strokeDasharray={dash}
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="none"
                />
              </g>
            );
          })
        : null}

      {showContainerStroke ? (
        <rect
          x={half}
          y={half}
          width={w}
          height={barH}
          rx={rx}
          ry={rx}
          fill="none"
          stroke={strokePaint === "none" ? "transparent" : strokePaint}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
      ) : null}

      {sections.map((seg: TimelineBarSectionData, i: number) => {
        const wi = widths[i] ?? 0;
        const s0 = starts[i] ?? 0;
        const lx = placementVertical ? half : half + s0;
        const ly = placementVertical ? half + s0 : half;
        const crossSpan = placementVertical ? w : barH;
        const padAlong = Math.max(2, Math.min(6, wi * 0.04));
        const padCross = Math.max(1, Math.min(4, crossSpan * 0.08));
        const foW = placementVertical ? Math.max(2, crossSpan - 2 * padCross) : Math.max(2, wi - 2 * padAlong);
        const foH = placementVertical ? Math.max(2, wi - 2 * padAlong) : Math.max(2, crossSpan - 2 * padCross);
        const fox = placementVertical ? lx + padCross : lx + padAlong;
        const foy = placementVertical ? ly + padAlong : ly + padCross;
        const displayRuns = normalizeRuns(seg.richLabel ?? labelToRuns(seg.label ?? ""));
        const plainDisplay = getPlainTextFromRuns(displayRuns).trim();
        if (!plainDisplay) return null;
        const lc = seg.labelColor ? String(seg.labelColor) : textCol;
        const isEditingSection = editingSectionIndex === i;
        const isEditing = Boolean(onPatch && !isReadOnly && isEditingSection);
        const labelPointer = canEditSectionLabel || isEditingSection ? "auto" : "none";
        const labelsFollowFirst =
          (nodeAny.segmentedRectangleLabelsFollowFirstSection as boolean | undefined) === true;
        const styleIdx = labelsFollowFirst && i > 0 ? 0 : i;
        const styleSeg = sections[styleIdx] ?? seg;
        const segFontSize = Math.min(
          crossSpan * 0.42,
          timelineBarSectionResolvedFontSizePx(styleSeg, styleIdx, normSections, node),
          22,
        );
        const textAlignResolved = timelineBarSectionResolvedTextAlign(styleSeg, styleIdx, normSections, node);
        const justifyContent = timelineBarSectionResolvedVerticalJustify(styleSeg, styleIdx, normSections, node);
        const fontWeightResolved = timelineBarSectionResolvedFontWeight(styleSeg, styleIdx, normSections, node);
        const fontFamily = timelineBarSectionResolvedFontFamily(styleSeg, styleIdx, normSections, node);
        const fontStyle = timelineBarSectionResolvedFontStyle(styleSeg, styleIdx, normSections, node) as React.CSSProperties["fontStyle"];
        const textDecoration = timelineBarSectionResolvedTextDecoration(
          styleSeg,
          styleIdx,
          normSections,
          node,
        ) as React.CSSProperties["textDecoration"];
        const lineHeightMul =
          typeof nodeAny.lineHeight === "number" && Number.isFinite(nodeAny.lineHeight)
            ? nodeAny.lineHeight
            : 1.2;
        const letterSpacingPx =
          typeof nodeAny.letterSpacing === "number" && Number.isFinite(nodeAny.letterSpacing)
            ? nodeAny.letterSpacing
            : undefined;
        const textTransform = ((nodeAny.textTransform as string) || "none") as React.CSSProperties["textTransform"];
        const textVerticalPosition: "top" | "middle" | "bottom" =
          justifyContent === "flex-start" ? "top" : justifyContent === "flex-end" ? "bottom" : "middle";
        const sectionTextNode = buildSectionLabelRichTextNode(
          node,
          lc,
          segFontSize,
          textAlignResolved,
          fontWeightResolved,
          fontFamily,
          fontStyle as DiagramNodeData["fontStyle"],
          textDecoration as DiagramNodeData["textDecoration"],
          lineHeightMul,
          letterSpacingPx,
          textTransform as DiagramNodeData["textTransform"],
          textVerticalPosition,
        );
        const editRuns = normalizeRuns(seg.richLabel ?? labelToRuns(seg.label ?? ""));
        const labelPopStyle = chartSegmentPopAnimationStyle(
          i,
          sectionSlidePopInId,
          sectionSlidePopOutId,
          0,
          0,
          presentationSectionSlideStagger,
        );

        return (
          <g key={`srlab-${seg.id}-${i}`} style={labelPopStyle}>
            <foreignObject
              x={fox}
              y={foy}
              width={foW}
              height={foH}
              style={{ overflow: isEditing ? "visible" : "hidden", pointerEvents: labelPointer }}
            >
              <div
                className={`flex h-full min-h-0 w-full flex-col ${
                  canEditSectionLabel || isEditing ? "cursor-text" : "cursor-default"
                }`}
                style={{ justifyContent }}
                onPointerDown={(e) => canEditSectionLabel && !isEditing && e.stopPropagation()}
                onDoubleClick={(e) => {
                  if (!canEditSectionLabel || isEditing) return;
                  e.stopPropagation();
                  e.preventDefault();
                  setEditingSectionIndex(i);
                }}
              >
                {isEditing ? (
                  <div
                    className="relative min-h-0 w-full flex-1 overflow-visible"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => e.stopPropagation()}
                  >
                    <TextboxRichEditor
                      key={`sr-edit-${seg.id}-${i}`}
                      node={sectionTextNode}
                      runs={editRuns}
                      onSubmit={handleSectionRichLabelSubmit}
                      toolbarFixedToViewport
                      onVerticalAlignChange={patchEditingSectionLabelVerticalAlign}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === "Escape") {
                          e.preventDefault();
                          cancelSectionLabelEdit();
                        }
                      }}
                    />
                  </div>
                ) : (
                  <div className="min-h-0 w-full overflow-hidden" style={{ padding: 2, boxSizing: "border-box" }}>
                    <TextboxRichDisplay
                      node={sectionTextNode}
                      runs={displayRuns}
                      suppressHoverBackground
                      onDoubleClick={(e) => {
                        if (!canEditSectionLabel) return;
                        e.stopPropagation();
                        e.preventDefault();
                        setEditingSectionIndex(i);
                      }}
                    />
                  </div>
                )}
              </div>
            </foreignObject>
          </g>
        );
      })}

      {sectionBoundaryInteractionEnabled &&
      onPatch &&
      !isReadOnly &&
      !isEditingLabel &&
      editingSectionIndex === null &&
      boundaryResizeLayout &&
      sections.length > 1
        ? jointAlongAxis.map((innerAlong, k) => {
            if (placementVertical) {
              const hitT = Math.max(6, Math.min(24, barH * 0.08));
              const cy = half + innerAlong;
              const hy = cy - hitT / 2;
              return (
                <rect
                  key={`sr-bound-${k}`}
                  data-dw-timeline-boundary={k}
                  x={half}
                  y={hy}
                  width={w}
                  height={hitT}
                  fill="transparent"
                  stroke="none"
                  pointerEvents="auto"
                  style={{ cursor: "row-resize", touchAction: "none" }}
                  onPointerDown={onPointerDownBoundary(k)}
                  onPointerMove={onPointerMoveBoundary}
                  onPointerUp={onPointerUpBoundary}
                  onPointerCancel={onPointerUpBoundary}
                />
              );
            }
            const hitW = Math.max(6, Math.min(24, w * 0.08));
            const cx = half + innerAlong;
            const hx = cx - hitW / 2;
            return (
              <rect
                key={`sr-bound-${k}`}
                data-dw-timeline-boundary={k}
                x={hx}
                y={half}
                width={hitW}
                height={barH}
                fill="transparent"
                stroke="none"
                pointerEvents="auto"
                style={{ cursor: "col-resize", touchAction: "none" }}
                onPointerDown={onPointerDownBoundary(k)}
                onPointerMove={onPointerMoveBoundary}
                onPointerUp={onPointerUpBoundary}
                onPointerCancel={onPointerUpBoundary}
              />
            );
          })
        : null}
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
      frostedClipRectInViewBox={{ x: half, y: half, w, h: barH, rx, ry: rx }}
      svgOverflowVisible={viewBoxStrokeBleed > 0}
      svgPointerEvents="none"
      svgContent={content}
    />
  );
}
