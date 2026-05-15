"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import type { DiagramNodeData, RichTextRun, TimelineBarSectionData } from "@/lib/types";
import { SvgShapeBase } from "./svg-shape-base";
import { getGradientCoordinates, getShapeSvgFill, svgForeignObjectInlineInputStyle } from "./shape-utils";
import { useSvgGradient } from "@/hooks/use-svg-gradient";
import { svgUserPointFromClient } from "@/lib/chart-pointer-geometry";
import { getNodeSizeMultiplier } from "@/lib/visual-styling";
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
  timelineBarSegmentLayout,
  timelineBarUsesSpanLayout,
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
  /** Diagram X of bar's left edge (px) for snapping section boundaries to the canvas grid. */
  diagramSnapX?: number;
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
  const workingSectionsRef = useRef<TimelineBarSectionData[]>([]);
  const boundaryIndexRef = useRef(0);
  const inlineSectionLabelCancelledRef = useRef(false);

  const [editingSectionIndex, setEditingSectionIndex] = useState<number | null>(null);
  const [sectionLabelDraft, setSectionLabelDraft] = useState("");

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
  const minDim = Math.min(w, h);
  const cornerRadius = Math.max(0, Math.min(1, ((nodeAny.cornerRadius as number) ?? 0.35) as number));
  const maxRadius = minDim / 2;
  const rx = Math.min(cornerRadius * maxRadius, maxRadius);

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
  /** Gap + tick band scale with **short** nodes; once tall enough, lock to the default (`VIEWBOX_H`) footprint so axis labels stay a fixed distance below the bar when height grows. Axis font can widen the tick band. */
  const minBarH = 8;
  let gapTick = 0;
  let baseTickBand = 0;
  if (showTicks) {
    const refH = VIEWBOX_H;
    const gapRef = Math.max(3, refH * 0.06);
    const bandRef = Math.max(12, refH * 0.26);
    if (h >= gapRef + bandRef + minBarH) {
      gapTick = gapRef;
      baseTickBand = bandRef;
    } else {
      gapTick = Math.max(3, h * 0.06);
      baseTickBand = Math.max(12, h * 0.26);
    }
  }
  const baseBodyFont = Number(nodeAny.fontSize) || 12;
  const rawUserAxisFs = nodeAny.timelineBarAxisLabelFontSize as number | undefined;
  const userAxisFs =
    typeof rawUserAxisFs === "number" && Number.isFinite(rawUserAxisFs) && rawUserAxisFs > 0 ? rawUserAxisFs : undefined;
  /** ~2× legacy caps (`0.55·band`, `0.85·fontSize`, max 14). */
  const autoAxisFs = Math.min(baseTickBand * 1.1, baseBodyFont * 1.7, 28);
  const desiredAxisFs = showTicks ? (userAxisFs ?? autoAxisFs) : 0;
  const tickBand = showTicks ? Math.max(baseTickBand, desiredAxisFs * 1.22) : 0;
  const barH = Math.max(minBarH, h - tickBand - gapTick);
  const tickFont = showTicks ? Math.min(desiredAxisFs, tickBand * 0.9) : 0;
  const { starts, widths } = timelineBarSegmentLayout(sections, w, sizing);
  const dividerInnerXs = timelineBarInteriorDividerXs(sections, starts, w);

  const scale = getNodeSizeMultiplier(nodeAny.nodeSize as "normal" | "half" | "quarter" | undefined);
  const baseW = node.width ?? defaultWidth;
  const snapBarWidthPx =
    overrideWidth ?? (node.width != null ? node.width : Math.round(baseW * scale));

  const endBoundaryDrag = useCallback(() => {
    if (!dragActiveRef.current) return;
    dragActiveRef.current = false;
    onSectionBoundaryDragSessionChange?.(false);
  }, [onSectionBoundaryDragSessionChange]);

  const applyClientToBoundary = useCallback(
    (clientX: number, _clientY: number, boundaryIdx: number, svg: SVGSVGElement) => {
      if (!onPatch) return;
      const pt = svgUserPointFromClient(svg, clientX, _clientY);
      if (!pt) return;
      let t = (pt.x - half) / Math.max(1e-6, w);
      t = clampTimelineBarT(t);
      if (typeof diagramSnapX === "number" && Number.isFinite(diagramSnapX)) {
        t = snapTimelineBarBoundaryT(diagramSnapX, snapBarWidthPx, t);
      }
      const minDt = timelineBarMinSegmentT(snapBarWidthPx);
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
    [diagramSnapX, half, onPatch, snapBarWidthPx, w],
  );

  const onPointerDownBoundary = useCallback(
    (boundaryIdx: number) => (e: React.PointerEvent<SVGRectElement>) => {
      if (!sectionBoundaryInteractionEnabled || !onPatch || isReadOnly || isEditingLabel || editingSectionIndex != null)
        return;
      e.stopPropagation();
      e.preventDefault();
      const migrated = timelineBarEnsureSpanSections(sections, w, sizing);
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
      w,
    ],
  );

  const onPointerMoveBoundary = useCallback(
    (e: React.PointerEvent<SVGRectElement>) => {
      if (!dragActiveRef.current || !onPatch) return;
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
      onPatch({ timelineBarSections: nextSecs });
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

  const tickTop = half + barH + gapTick;
  const markerBottom = tickTop + tickBand * 0.35;

  const content = (
    <>
      {bgDefs}
      <defs>
        <clipPath id={`${clipId}-barclip`}>
          <rect x={half} y={half} width={w} height={barH} rx={rx} ry={rx} />
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
      </defs>

      <g clipPath={`url(#${clipId}-barclip)`} pointerEvents="none">
        <rect x={half} y={half} width={w} height={barH} rx={0} ry={0} fill={trackPaint} stroke="none" />
        {sections.map((seg: TimelineBarSectionData, i: number) => {
          const wi = widths[i] ?? 0;
          const x0 = half + (starts[i] ?? 0);
          const fs = seg.fillStyle ?? "solid";
          let fillPaint: string;
          if (fs === "none") {
            fillPaint = "transparent";
          } else if (fs === "gradient") {
            fillPaint = `url(#${clipId}-sg-${i})`;
          } else if (fs === "theme-hue") {
            fillPaint = timelineBarSectionThemeHueFill(node, sections, i);
          } else {
            fillPaint = String(seg.fill ?? "#6b7280");
          }
          return (
            <rect
              key={seg.id || i}
              x={x0}
              y={half}
              width={Math.max(0, wi)}
              height={barH}
              fill={fillPaint}
              stroke="none"
            />
          );
        })}
      </g>

      {sectionBorder && sections.length > 1 && secBorderW > 0
        ? (() => {
            const lines: React.ReactNode[] = [];
            for (let k = 0; k < dividerInnerXs.length; k++) {
              const xi = half + dividerInnerXs[k];
              lines.push(
                <line
                  key={`div-${k}`}
                  x1={xi}
                  y1={half}
                  x2={xi}
                  y2={half + barH}
                  stroke={secBorderColor}
                  strokeWidth={secBorderW}
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="none"
                />,
              );
            }
            return <g pointerEvents="none">{lines}</g>;
          })()
        : null}

      {strokeWidth > 0 ? (
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
        const x0 = half + (starts[i] ?? 0);
        const lab = (seg.label ?? "").trim();
        if (!lab) return null;
        const lc = seg.labelColor ? String(seg.labelColor) : textCol;
        const padX = Math.max(2, Math.min(6, wi * 0.04));
        const padY = Math.max(1, Math.min(4, barH * 0.08));
        const foW = Math.max(2, wi - 2 * padX);
        const foH = Math.max(2, barH - 2 * padY);
        const isEditing = canEditSectionLabel && editingSectionIndex === i;
        const labelPointer = canEditSectionLabel ? "auto" : "none";
        const labelsFollowFirst =
          (nodeAny.timelineBarLabelsFollowFirstSection as boolean | undefined) === true;
        const styleIdx = labelsFollowFirst && i > 0 ? 0 : i;
        const styleSeg = sections[styleIdx] ?? seg;
        const segFontSize = Math.min(
          barH * 0.42,
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
        const opacityStyle =
          Number(nodeAny.textOpacity) >= 0 && Number(nodeAny.textOpacity) !== 1
            ? { opacity: Number(nodeAny.textOpacity) }
            : {};

        return (
          <g key={`tlab-${seg.id}-${i}`}>
            <foreignObject
              x={x0 + padX}
              y={half + padY}
              width={foW}
              height={foH}
              style={{ overflow: "hidden", pointerEvents: labelPointer }}
            >
              <div
                className={`flex h-full min-h-0 w-full flex-col ${
                  canEditSectionLabel ? "cursor-text" : "cursor-default"
                }`}
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
                    aria-label="Edit section label"
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
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      overflowWrap: "anywhere",
                      ...(letterSpacingPx !== undefined ? { letterSpacing: `${letterSpacingPx}px` } : {}),
                      textTransform,
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

      {showTicks
        ? useAxisTicks
          ? axisLabels.map((ax, i) => {
              /** Same inner span as segments: `t ∈ [0,1]` → x from `half` to `half + w` (stroke inset only, not rounded-cap correction). */
              const cx = half + clampTimelineBarT(ax.t) * w;
              const tk = (ax.label ?? "").trim();
              if (!tk && !tickMarkers) return null;
              return (
                <g key={`axis-${ax.id}-${i}`} pointerEvents="none">
                  {tickMarkers ? (
                    <line
                      x1={cx}
                      y1={half + barH}
                      x2={cx}
                      y2={markerBottom}
                      stroke={textCol}
                      strokeWidth={1}
                      opacity={0.45}
                      vectorEffect="non-scaling-stroke"
                    />
                  ) : null}
                  {tk ? (
                    <text
                      x={cx}
                      y={tickTop + tickBand * 0.72}
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
            })
          : sections.map((seg: TimelineBarSectionData, i: number) => {
              const wi = widths[i] ?? 0;
              const cx = half + (starts[i] ?? 0) + wi / 2;
            const tk = (seg.tickLabel ?? "").trim();
            if (!tk && !tickMarkers) return null;
            return (
              <g key={`tick-${seg.id}-${i}`} pointerEvents="none">
                {tickMarkers ? (
                  <line
                    x1={cx}
                    y1={half + barH}
                    x2={cx}
                    y2={markerBottom}
                    stroke={textCol}
                    strokeWidth={1}
                    opacity={0.45}
                    vectorEffect="non-scaling-stroke"
                  />
                ) : null}
                {tk ? (
                  <text
                    x={cx}
                    y={tickTop + tickBand * 0.72}
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
          })
        : null}

      {sectionBoundaryInteractionEnabled &&
      onPatch &&
      !isReadOnly &&
      !isEditingLabel &&
      editingSectionIndex === null &&
      sections.length > 1
        ? dividerInnerXs.map((innerX, k) => {
            const hitW = Math.max(6, Math.min(24, w * 0.08));
            const cx = half + innerX;
            const hx = cx - hitW / 2;
            return (
              <rect
                key={`tb-bound-${k}`}
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
      svgPointerEvents="none"
      svgContent={content}
    />
  );
}
