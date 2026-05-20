"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import type { DiagramNodeData, NodeSize, RichTextRun, TimelineBarSectionData } from "@/lib/types";
import { SvgShapeBase } from "./svg-shape-base";
import { getGradientCoordinates, getShapeSvgFill } from "./shape-utils";
import { useSvgGradient } from "@/hooks/use-svg-gradient";
import { svgUserPointFromClient } from "@/lib/chart-pointer-geometry";
import { getNodeSizeMultiplier } from "@/lib/visual-styling";
import { labelToRuns, normalizeRuns, getPlainTextFromRuns } from "@/lib/rich-text";
import { TextboxRichEditor } from "../textbox-rich-editor";
import { TextboxRichDisplay } from "../textbox-rich-display";
import { buildSectionLabelRichTextNode } from "@/lib/section-label-rich-node";
import {
  clampTimelineBarT,
  normalizeTimelineBarAxisLabels,
  normalizeTimelineBarSections,
  timelineBarEnsureSpanSections,
  timelineBarInteriorDividerXs,
  timelineBarMinSegmentT,
  timelineBarMoveJointAtVisualBoundary,
  timelineBarSectionResolvedFontFamily,
  timelineBarSectionResolvedFontSizePx,
  timelineBarSectionResolvedFontStyle,
  timelineBarSectionResolvedFontWeight,
  timelineBarSectionResolvedTextAlign,
  timelineBarSectionResolvedTextDecoration,
  timelineBarSectionResolvedVerticalJustify,
  timelineBarSectionThemeHueFill,
  timelineBarSectionThemeHueFillGradient,
  timelineBarSegmentLayout,
  timelineBarUsesSpanLayout,
  snapTimelineBarAxisTToSegmentDividers,
  snapTimelineBarBoundaryT,
} from "@/lib/timeline-bar";

interface TimelineBarShapeProps {
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
  /** Diagram X of bar's left edge (px); horizontal layout boundary snap. */
  diagramSnapX?: number;
  /** Diagram Y of bar's top edge (px); vertical layout boundary snap. */
  diagramSnapY?: number;
  onPatch?: (patch: Partial<DiagramNodeData>) => void;
  /** Single-node selection, editor — show drag handles on section boundaries. */
  sectionBoundaryInteractionEnabled?: boolean;
  /** Single-node selection, editor — inline section label edit + hit targets for wrapped labels. */
  sectionLabelInteractionEnabled?: boolean;
  onSectionBoundaryDragSessionChange?: (active: boolean) => void;
}

const VIEWBOX_W = 120;
const VIEWBOX_H = 56;

export function TimelineBarShape({
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
  isReadOnly = false,
  ...rest
}: TimelineBarShapeProps) {
  const nodeAny = node as unknown as Record<string, unknown>;
  const clipId = useId().replace(/:/g, "");
  const dragActiveRef = useRef(false);
  const axisDragActiveRef = useRef(false);
  const axisDragIdRef = useRef<string | null>(null);
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

  const { defs: bgDefs, fillRef: bgFillRef, strokeRef } = useSvgGradient({
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
  const cornerRadius = Math.max(0, Math.min(1, ((nodeAny.cornerRadius as number) ?? 0.35) as number));

  const sections = normalizeTimelineBarSections(node);
  const sizing = ((nodeAny.timelineBarSizing as string) || "equal") as "equal" | "weighted";
  const axisLabels = normalizeTimelineBarAxisLabels(node);
  const useAxisTicks = axisLabels.length > 0;
  const showTicks = nodeAny.timelineBarShowTicks !== false;
  const tickMarkers = nodeAny.timelineBarTickMarkers === true;
  const sectionBorder = nodeAny.timelineBarSectionBorder === true;
  const secBorderW =
    sectionBorder && sections.length > 1
      ? Math.max(
          0.5,
          Math.min(4, (nodeAny.timelineBarSectionBorderWidth as number) || 1),
        )
      : 0;
  const secBorderColor = String(nodeAny.timelineBarSectionBorderColor || "#ffffff");
  const isVertical = nodeAny.timelineBarOrientation === "vertical";

  const minBarNarrow = 8;
  let gapTick = 0;
  let baseTickBand = 0;
  if (showTicks) {
    const refOuter = isVertical ? VIEWBOX_W : VIEWBOX_H;
    const outerNow = isVertical ? w : h;
    const gapRef = Math.max(3, refOuter * 0.06);
    const bandRef = Math.max(12, refOuter * 0.26);
    if (outerNow >= gapRef + bandRef + minBarNarrow) {
      gapTick = gapRef;
      baseTickBand = bandRef;
    } else {
      gapTick = Math.max(3, outerNow * 0.06);
      baseTickBand = Math.max(12, outerNow * 0.26);
    }
  }
  const baseBodyFont = Number(nodeAny.fontSize) || 12;
  const rawUserAxisFs = nodeAny.timelineBarAxisLabelFontSize as number | undefined;
  const userAxisFs =
    typeof rawUserAxisFs === "number" && Number.isFinite(rawUserAxisFs) && rawUserAxisFs > 0 ? rawUserAxisFs : undefined;
  const autoAxisFs = Math.min(baseTickBand * 1.1, baseBodyFont * 1.7, 28);
  const desiredAxisFs = showTicks ? (userAxisFs ?? autoAxisFs) : 0;
  const tickBand = showTicks ? Math.max(baseTickBand, desiredAxisFs * 1.22) : 0;
  const ticksLeading = showTicks ? tickBand + gapTick : 0;
  const barNarrow = isVertical
    ? Math.max(minBarNarrow, w - ticksLeading)
    : Math.max(minBarNarrow, h - ticksLeading);
  const segmentAlongLen = isVertical ? h : w;
  const barLeft = isVertical ? half + ticksLeading : half;
  const tickFont = showTicks ? Math.min(desiredAxisFs, tickBand * 0.9) : 0;
  const { starts, widths } = timelineBarSegmentLayout(sections, segmentAlongLen, sizing);
  const dividerInnerAlong = timelineBarInteriorDividerXs(sections, starts, segmentAlongLen);

  const clipW = isVertical ? barNarrow : w;
  const clipH = isVertical ? h : barNarrow;
  const rxBasisMin = Math.min(clipW, clipH);
  const maxRadius = rxBasisMin / 2;
  const rx = Math.min(cornerRadius * maxRadius, maxRadius);

  const scale = getNodeSizeMultiplier(nodeAny.nodeSize as NodeSize | undefined);
  const baseW = node.width ?? defaultWidth;
  const baseH = node.height ?? defaultHeight;
  const snapBarWidthPx =
    overrideWidth ?? (node.width != null ? node.width : Math.round(baseW * scale));
  const snapBarHeightPx =
    overrideHeight ?? (node.height != null ? node.height : Math.round(baseH * scale));
  const snapBarExtentPx = isVertical ? snapBarHeightPx : snapBarWidthPx;
  const diagramSnapCoord = isVertical ? diagramSnapY : diagramSnapX;
  const diagramSnapOrigin =
    typeof diagramSnapCoord === "number" && Number.isFinite(diagramSnapCoord) ? diagramSnapCoord : undefined;

  const endBoundaryDrag = useCallback(() => {
    if (!dragActiveRef.current) return;
    dragActiveRef.current = false;
    onSectionBoundaryDragSessionChange?.(false);
  }, [onSectionBoundaryDragSessionChange]);

  const endAxisDrag = useCallback(() => {
    if (!axisDragActiveRef.current) return;
    axisDragActiveRef.current = false;
    axisDragIdRef.current = null;
    onSectionBoundaryDragSessionChange?.(false);
  }, [onSectionBoundaryDragSessionChange]);

  const applyClientToBoundary = useCallback(
    (clientX: number, clientY: number, boundaryIdx: number, svg: SVGSVGElement) => {
      if (!onPatch) return;
      const pt = svgUserPointFromClient(svg, clientX, clientY);
      if (!pt) return;
      let t = isVertical
        ? (pt.y - half) / Math.max(1e-6, segmentAlongLen)
        : (pt.x - half) / Math.max(1e-6, segmentAlongLen);
      t = clampTimelineBarT(t);
      if (diagramSnapOrigin != null) {
        t = snapTimelineBarBoundaryT(diagramSnapOrigin, snapBarExtentPx, t);
      }
      const minDt = timelineBarMinSegmentT(snapBarExtentPx);
      const next = timelineBarMoveJointAtVisualBoundary(
        workingSectionsRef.current,
        boundaryIdx,
        t,
        minDt,
      );
      if (!next) return;
      workingSectionsRef.current = next;
      onPatch({ timelineBarSections: next });
    },
    [diagramSnapOrigin, half, isVertical, onPatch, segmentAlongLen, snapBarExtentPx],
  );

  const applyClientToAxis = useCallback(
    (clientX: number, clientY: number, axisId: string, svg: SVGSVGElement) => {
      if (!onPatch) return;
      const pt = svgUserPointFromClient(svg, clientX, clientY);
      if (!pt) return;
      let t = isVertical
        ? (pt.y - half) / Math.max(1e-6, segmentAlongLen)
        : (pt.x - half) / Math.max(1e-6, segmentAlongLen);
      t = clampTimelineBarT(t);
      if (diagramSnapOrigin != null) {
        t = snapTimelineBarBoundaryT(diagramSnapOrigin, snapBarExtentPx, t);
      }
      t = snapTimelineBarAxisTToSegmentDividers(t, sections, starts, segmentAlongLen, snapBarExtentPx);
      const next = axisLabels.map((a) => (a.id === axisId ? { ...a, t } : a));
      onPatch({ timelineBarAxisLabels: next });
    },
    [axisLabels, diagramSnapOrigin, half, isVertical, onPatch, sections, segmentAlongLen, snapBarExtentPx, starts],
  );

  const onPointerDownBoundary = useCallback(
    (boundaryIdx: number) => (e: React.PointerEvent<SVGRectElement>) => {
      if (!sectionBoundaryInteractionEnabled || !onPatch || isReadOnly || isEditingLabel || editingSectionIndex != null)
        return;
      if (axisDragActiveRef.current) return;
      e.stopPropagation();
      e.preventDefault();
      const migrated = timelineBarEnsureSpanSections(sections, segmentAlongLen, sizing);
      workingSectionsRef.current = migrated;
      if (!timelineBarUsesSpanLayout(sections)) {
        onPatch({ timelineBarSections: migrated });
      }
      boundaryIndexRef.current = boundaryIdx;
      dragActiveRef.current = true;
      onSectionBoundaryDragSessionChange?.(true);
      const svg = (e.currentTarget as SVGRectElement).ownerSVGElement;
      if (svg) applyClientToBoundary(e.clientX, e.clientY, boundaryIdx, svg);
      (e.currentTarget as SVGRectElement).setPointerCapture(e.pointerId);
    },
    [
      applyClientToBoundary,
      isEditingLabel,
      isReadOnly,
      onPatch,
      onSectionBoundaryDragSessionChange,
      sectionBoundaryInteractionEnabled,
      editingSectionIndex,
      sections,
      sizing,
      segmentAlongLen,
    ],
  );

  const onPointerDownAxis = useCallback(
    (axisId: string) => (e: React.PointerEvent<SVGRectElement>) => {
      if (!sectionBoundaryInteractionEnabled || !onPatch || isReadOnly || isEditingLabel || editingSectionIndex != null)
        return;
      if (!useAxisTicks || axisLabels.length === 0) return;
      if (dragActiveRef.current) return;
      e.stopPropagation();
      e.preventDefault();
      axisDragIdRef.current = axisId;
      axisDragActiveRef.current = true;
      onSectionBoundaryDragSessionChange?.(true);
      const svg = (e.currentTarget as SVGRectElement).ownerSVGElement;
      if (svg) applyClientToAxis(e.clientX, e.clientY, axisId, svg);
      (e.currentTarget as SVGRectElement).setPointerCapture(e.pointerId);
    },
    [
      applyClientToAxis,
      axisLabels.length,
      editingSectionIndex,
      isEditingLabel,
      isReadOnly,
      onPatch,
      onSectionBoundaryDragSessionChange,
      sectionBoundaryInteractionEnabled,
      useAxisTicks,
    ],
  );

  const onPointerMoveAxis = useCallback(
    (e: React.PointerEvent<SVGRectElement>) => {
      if (!axisDragActiveRef.current || !onPatch) return;
      const id = axisDragIdRef.current;
      const svg = (e.currentTarget as SVGRectElement).ownerSVGElement;
      if (!id || !svg) return;
      applyClientToAxis(e.clientX, e.clientY, id, svg);
    },
    [applyClientToAxis, onPatch],
  );

  const onPointerUpAxis = useCallback(
    (e: React.PointerEvent<SVGRectElement>) => {
      try {
        (e.currentTarget as SVGRectElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      endAxisDrag();
    },
    [endAxisDrag],
  );

  const onPointerMoveBoundary = useCallback(
    (e: React.PointerEvent<SVGRectElement>) => {
      if (!dragActiveRef.current || !onPatch || axisDragActiveRef.current) return;
      const svg = (e.currentTarget as SVGRectElement).ownerSVGElement;
      if (svg)
        applyClientToBoundary(e.clientX, e.clientY, boundaryIndexRef.current, svg);
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
    borderStyle === "none"
      ? "none"
      : borderStyle === "gradient" && strokeRef
        ? strokeRef
        : String(nodeAny.borderColor || "#6b7280");
  const strokeDasharray = borderStyle === "dotted" ? "3,3" : undefined;

  const vbW = w + strokeWidth;
  const vbH = h + strokeWidth;

  const trackPaint = getShapeSvgFill(backgroundStyle, bgFillRef, nodeAny.backgroundColor as string, "#f3f4f6");

  const textCol = String(nodeAny.textColor || "#111827");
  const rawAxisFf = (nodeAny.timelineBarAxisLabelFontFamily as string | undefined)?.trim();
  const axisTickFontFamily =
    rawAxisFf && rawAxisFf.length > 0
      ? rawAxisFf
      : String((nodeAny.fontFamily as string) || "").trim() || "inherit";

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
        onPatch({ timelineBarSections: nextSecs });
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
        (nodeAny.timelineBarLabelsFollowFirstSection as boolean | undefined) === true;
      const targetIdx =
        labelsFollowFirst && editingSectionIndex > 0 ? 0 : editingSectionIndex;
      const nextSecs = sections.map((s, j) =>
        j === targetIdx ? { ...s, labelVerticalAlign: position } : s,
      );
      onPatch({ timelineBarSections: nextSecs });
    },
    [editingSectionIndex, nodeAny.timelineBarLabelsFollowFirstSection, onPatch, sections],
  );

  useEffect(() => {
    if (editingSectionIndex == null) return;
    if (editingSectionIndex < 0 || editingSectionIndex >= sections.length) {
      setEditingSectionIndex(null);
    }
  }, [editingSectionIndex, sections.length]);

  const tickRowTop = half + barNarrow + gapTick;
  const markerBelowBar = tickRowTop + tickBand * 0.35;
  /** Horizontal bar: keep edge axis labels inside the SVG viewBox (avoids clipping at t=0 / t=1). */
  const axisEdgeTol = Math.max(0.003, Math.min(0.04, (tickFont * 0.55) / Math.max(1e-6, segmentAlongLen)));
  const axisInset = Math.max(1.2, tickFont * 0.42);
  /** Vertical axis: anchor labels at the inner-left of the tick band so text grows rightward (avoids left-edge clipping). */
  const verticalAxisLabelX = half + Math.max(2, tickBand * 0.06);
  /** Tick stubs extend left from the bar but stay inside the stroke inset. */
  const markerTailX = Math.max(half + 1.5, barLeft - tickBand * 0.35);

  const axisDragEnabled =
    Boolean(
      sectionBoundaryInteractionEnabled &&
        onPatch &&
        !isReadOnly &&
        !isEditingLabel &&
        editingSectionIndex == null &&
        useAxisTicks &&
        axisLabels.length > 0,
    );

  const content = (
    <>
      {bgDefs}
      <defs>
        <clipPath id={`${clipId}-barclip`}>
          <rect x={barLeft} y={half} width={clipW} height={clipH} rx={rx} ry={rx} />
        </clipPath>
        {sections.map((seg: TimelineBarSectionData, gi: number) => {
          if ((seg.fillStyle ?? "solid") !== "gradient") return null;
          const cols = seg.fillGradientColors;
          const c0 = cols && cols.length >= 2 ? String(cols[0]) : String(seg.fill ?? "#6b7280");
          const c1 = cols && cols.length >= 2 ? String(cols[1]) : c0;
          const ang = typeof seg.fillGradientAngle === "number" && Number.isFinite(seg.fillGradientAngle) ? seg.fillGradientAngle : 90;
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
          const thg = timelineBarSectionThemeHueFillGradient(node, sections, gi);
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
      </defs>

      <g clipPath={`url(#${clipId}-barclip)`} pointerEvents="none">
        <rect x={barLeft} y={half} width={clipW} height={clipH} rx={0} ry={0} fill={trackPaint} stroke="none" />
        {sections.map((seg: TimelineBarSectionData, i: number) => {
          const wi = widths[i] ?? 0;
          const x0 = isVertical ? barLeft : half + (starts[i] ?? 0);
          const y0 = isVertical ? half + (starts[i] ?? 0) : half;
          const rw = isVertical ? barNarrow : Math.max(0, wi);
          const rh = isVertical ? Math.max(0, wi) : barNarrow;
          const fs = seg.fillStyle ?? "solid";
          let fillPaint: string;
          if (fs === "none") {
            fillPaint = "transparent";
          } else if (fs === "gradient") {
            fillPaint = `url(#${clipId}-sg-${i})`;
          } else if (fs === "theme-hue") {
            const thg = timelineBarSectionThemeHueFillGradient(node, sections, i);
            fillPaint = thg ? `url(#${clipId}-th-fill-${i})` : timelineBarSectionThemeHueFill(node, sections, i);
          } else {
            fillPaint = String(seg.fill ?? "#6b7280");
          }
          return (
            <rect
              key={seg.id || i}
              x={x0}
              y={y0}
              width={rw}
              height={rh}
              fill={fillPaint}
              stroke="none"
            />
          );
        })}
      </g>

      {sectionBorder && sections.length > 1 && secBorderW > 0
        ? (() => {
            const lines: React.ReactNode[] = [];
            for (let k = 0; k < dividerInnerAlong.length; k++) {
              const pos = half + dividerInnerAlong[k];
              lines.push(
                isVertical ? (
                  <line
                    key={`div-${k}`}
                    x1={barLeft}
                    y1={pos}
                    x2={barLeft + barNarrow}
                    y2={pos}
                    stroke={secBorderColor}
                    strokeWidth={secBorderW}
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="none"
                  />
                ) : (
                  <line
                    key={`div-${k}`}
                    x1={pos}
                    y1={half}
                    x2={pos}
                    y2={half + barNarrow}
                    stroke={secBorderColor}
                    strokeWidth={secBorderW}
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="none"
                  />
                ),
              );
            }
            return <g pointerEvents="none">{lines}</g>;
          })()
        : null}

      {strokeWidth > 0 ? (
        <rect
          x={barLeft}
          y={half}
          width={clipW}
          height={clipH}
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
        const xAlong = half + (starts[i] ?? 0);
        const displayRuns = normalizeRuns(seg.richLabel ?? labelToRuns(seg.label ?? ""));
        const plainDisplay = getPlainTextFromRuns(displayRuns).trim();
        if (!plainDisplay) return null;
        const lc = seg.labelColor ? String(seg.labelColor) : textCol;
        const padAlong = Math.max(2, Math.min(6, wi * 0.04));
        const padNarrow = Math.max(1, Math.min(4, barNarrow * 0.08));
        const foX = isVertical ? barLeft + padNarrow : xAlong + padAlong;
        const foY = isVertical ? half + (starts[i] ?? 0) + padAlong : half + padNarrow;
        const foW = Math.max(2, (isVertical ? barNarrow : wi) - 2 * (isVertical ? padNarrow : padAlong));
        const foH = Math.max(2, (isVertical ? wi : barNarrow) - 2 * (isVertical ? padAlong : padNarrow));
        const isEditingSection = editingSectionIndex === i;
        const isEditing = Boolean(onPatch && !isReadOnly && isEditingSection);
        const labelPointer = canEditSectionLabel || isEditingSection ? "auto" : "none";
        const labelsFollowFirst =
          (nodeAny.timelineBarLabelsFollowFirstSection as boolean | undefined) === true;
        const styleIdx = labelsFollowFirst && i > 0 ? 0 : i;
        const styleSeg = sections[styleIdx] ?? seg;
        const segFontSize = Math.min(
          barNarrow * 0.42,
          wi * 0.42,
          timelineBarSectionResolvedFontSizePx(styleSeg, styleIdx, sections, node),
          22,
        );
        const textAlignResolved = timelineBarSectionResolvedTextAlign(styleSeg, styleIdx, sections, node);
        const justifyContent = timelineBarSectionResolvedVerticalJustify(styleSeg, styleIdx, sections, node);
        const fontWeightResolved = timelineBarSectionResolvedFontWeight(styleSeg, styleIdx, sections, node);
        const fontFamily = timelineBarSectionResolvedFontFamily(styleSeg, styleIdx, sections, node);
        const fontStyle = timelineBarSectionResolvedFontStyle(styleSeg, styleIdx, sections, node) as React.CSSProperties["fontStyle"];
        const textDecoration = timelineBarSectionResolvedTextDecoration(
          styleSeg,
          styleIdx,
          sections,
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

        return (
          <g key={`tlab-${seg.id}-${i}`}>
            <foreignObject
              x={foX}
              y={foY}
              width={foW}
              height={foH}
              style={{ overflow: isEditing ? "visible" : "hidden", pointerEvents: labelPointer }}
            >
              <div
                className={`flex h-full min-h-0 w-full flex-col ${
                  canEditSectionLabel || isEditingSection ? "cursor-text" : "cursor-default"
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
                      key={`tb-edit-${seg.id}-${i}`}
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
                  <div className="min-h-0 w-full overflow-auto" style={{ padding: 2, boxSizing: "border-box" }}>
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

      {showTicks
        ? useAxisTicks
          ? axisLabels.map((ax, i) => {
              const tVal = clampTimelineBarT(ax.t);
              const tk = (ax.label ?? "").trim();
              if (!tk && !tickMarkers) return null;
              const cx = half + tVal * segmentAlongLen;
              if (!isVertical) {
                let textAnchor: "start" | "middle" | "end" = "middle";
                let lx = cx;
                if (tVal <= axisEdgeTol) {
                  textAnchor = "start";
                  lx = half + axisInset;
                } else if (tVal >= 1 - axisEdgeTol) {
                  textAnchor = "end";
                  lx = half + segmentAlongLen - axisInset;
                }
                const ty = tickRowTop + tickBand * 0.72;
                const hitHalf = Math.max(10, Math.min(28, segmentAlongLen * 0.055));
                return (
                  <g key={`axis-${ax.id}-${i}`}>
                    <g pointerEvents="none">
                      {tickMarkers ? (
                        <line
                          x1={cx}
                          y1={half + barNarrow}
                          x2={cx}
                          y2={markerBelowBar}
                          stroke={textCol}
                          strokeWidth={1}
                          opacity={0.45}
                          vectorEffect="non-scaling-stroke"
                        />
                      ) : null}
                      {tk ? (
                        <text
                          x={lx}
                          y={ty}
                          textAnchor={textAnchor}
                          dominantBaseline="middle"
                          fill={textCol}
                          fontSize={tickFont}
                          fontFamily={axisTickFontFamily}
                          opacity={0.9}
                        >
                          {tk}
                        </text>
                      ) : null}
                    </g>
                    {axisDragEnabled ? (
                      <rect
                        data-dw-timeline-axis={ax.id}
                        x={cx - hitHalf / 2}
                        y={tickRowTop}
                        width={hitHalf}
                        height={tickBand}
                        fill="transparent"
                        stroke="none"
                        pointerEvents="auto"
                        style={{
                          cursor: "ew-resize",
                          touchAction: "none",
                        }}
                        onPointerDown={onPointerDownAxis(ax.id)}
                        onPointerMove={onPointerMoveAxis}
                        onPointerUp={onPointerUpAxis}
                        onPointerCancel={onPointerUpAxis}
                      />
                    ) : null}
                  </g>
                );
              }
              const cy = half + tVal * segmentAlongLen;
              let ly = cy;
              if (tVal <= axisEdgeTol) {
                ly = half + axisInset + tickFont * 0.48;
              } else if (tVal >= 1 - axisEdgeTol) {
                ly = half + segmentAlongLen - axisInset - tickFont * 0.48;
              }
              const hitAlong = Math.max(10, Math.min(26, segmentAlongLen * 0.07));
              const axisLaneRight = Math.max(barLeft - 1, verticalAxisLabelX + tickFont * 2.8);
              return (
                <g key={`axis-${ax.id}-${i}`}>
                  <g pointerEvents="none">
                    {tickMarkers ? (
                      <line
                        x1={barLeft}
                        y1={cy}
                        x2={markerTailX}
                        y2={cy}
                        stroke={textCol}
                        strokeWidth={1}
                        opacity={0.45}
                        vectorEffect="non-scaling-stroke"
                      />
                    ) : null}
                    {tk ? (
                      <text
                        x={verticalAxisLabelX}
                        y={ly}
                        textAnchor="start"
                        dominantBaseline="middle"
                        fill={textCol}
                        fontSize={tickFont}
                        fontFamily={axisTickFontFamily}
                        opacity={0.9}
                      >
                        {tk}
                      </text>
                    ) : null}
                  </g>
                  {axisDragEnabled ? (
                    <rect
                      data-dw-timeline-axis={ax.id}
                      x={half}
                      y={cy - hitAlong / 2}
                      width={Math.max(6, axisLaneRight - half)}
                      height={hitAlong}
                      fill="transparent"
                      stroke="none"
                      pointerEvents="auto"
                      style={{
                        cursor: "ns-resize",
                        touchAction: "none",
                      }}
                      onPointerDown={onPointerDownAxis(ax.id)}
                      onPointerMove={onPointerMoveAxis}
                      onPointerUp={onPointerUpAxis}
                      onPointerCancel={onPointerUpAxis}
                    />
                  ) : null}
                </g>
              );
            })
          : sections.map((seg: TimelineBarSectionData, i: number) => {
              const wi = widths[i] ?? 0;
              const tk = (seg.tickLabel ?? "").trim();
              if (!tk && !tickMarkers) return null;
              if (!isVertical) {
                const cx = half + (starts[i] ?? 0) + wi / 2;
                return (
                  <g key={`tick-${seg.id}-${i}`} pointerEvents="none">
                    {tickMarkers ? (
                      <line
                        x1={cx}
                        y1={half + barNarrow}
                        x2={cx}
                        y2={markerBelowBar}
                        stroke={textCol}
                        strokeWidth={1}
                        opacity={0.45}
                        vectorEffect="non-scaling-stroke"
                      />
                    ) : null}
                    {tk ? (
                      <text
                        x={cx}
                        y={tickRowTop + tickBand * 0.72}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={textCol}
                        fontSize={tickFont}
                        fontFamily={axisTickFontFamily}
                        opacity={0.9}
                      >
                        {tk}
                      </text>
                    ) : null}
                  </g>
                );
              }
              const cy = half + (starts[i] ?? 0) + wi / 2;
              return (
                <g key={`tick-${seg.id}-${i}`} pointerEvents="none">
                  {tickMarkers ? (
                    <line
                      x1={barLeft}
                      y1={cy}
                      x2={markerTailX}
                      y2={cy}
                      stroke={textCol}
                      strokeWidth={1}
                      opacity={0.45}
                      vectorEffect="non-scaling-stroke"
                    />
                  ) : null}
                  {tk ? (
                    <text
                      x={verticalAxisLabelX}
                      y={cy}
                      textAnchor="start"
                      dominantBaseline="middle"
                      fill={textCol}
                      fontSize={tickFont}
                      fontFamily={axisTickFontFamily}
                      opacity={0.9}
                    >
                      {tk}
                    </text>
                  ) : null}
                </g>
              );
            })
        : null}

      {sectionBoundaryInteractionEnabled &&
      onPatch &&
      !isReadOnly &&
      !isEditingLabel &&
      editingSectionIndex === null &&
      sections.length > 1
        ? dividerInnerAlong.map((innerAlong, k) => {
            const hitAlong = Math.max(6, Math.min(24, segmentAlongLen * 0.08));
            const centerAlong = half + innerAlong;
            const originAlong = centerAlong - hitAlong / 2;
            return (
              <rect
                key={`tb-bound-${k}`}
                data-dw-timeline-boundary={k}
                x={isVertical ? barLeft : originAlong}
                y={isVertical ? originAlong : half}
                width={isVertical ? barNarrow : hitAlong}
                height={isVertical ? hitAlong : barNarrow}
                fill="transparent"
                stroke="none"
                pointerEvents="auto"
                style={{
                  cursor: isVertical ? "row-resize" : "col-resize",
                  touchAction: "none",
                }}
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
      frostedClipRectInViewBox={{ x: barLeft, y: half, w: clipW, h: clipH, rx, ry: rx }}
      svgOverflowVisible={isVertical}
      svgPointerEvents="none"
      svgContent={content}
    />
  );
}
