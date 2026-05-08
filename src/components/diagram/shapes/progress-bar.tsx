"use client";

import React, { useCallback, useId, useRef } from "react";
import type { DiagramNodeData, RichTextRun } from "@/lib/types";
import { SvgShapeBase } from "./svg-shape-base";
import { getGradientCoordinates } from "./shape-utils";

interface ProgressBarShapeProps {
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
  onProgressDragSessionChange?: (active: boolean) => void;
}

const VIEWBOX_W = 80;
const VIEWBOX_H = 50;

function clampPct(p: number): number {
  if (!Number.isFinite(p)) return 0;
  return Math.max(0, Math.min(100, p));
}

export function ProgressBarShape({
  node,
  slideColorTransition,
  defaultWidth = VIEWBOX_W,
  defaultHeight = VIEWBOX_H,
  overrideWidth,
  overrideHeight,
  isReadOnly = false,
  onPatch,
  onProgressDragSessionChange,
  isEditingLabel,
  ...rest
}: ProgressBarShapeProps) {
  const nodeAny = node as any;
  const safeId = useId().replace(/:/g, "");
  const dragActiveRef = useRef(false);

  const borderColors = (nodeAny.borderColors as string[] | undefined) || [
    String(nodeAny.borderColor || "#6b7280"),
  ];
  const borderStyle = (nodeAny.borderStyle as string) || "solid";
  const borderGradientAngle = (nodeAny.borderGradientAngle as number) ?? (nodeAny.gradientAngle as number) ?? 135;
  const strokeWidth = borderStyle === "none" ? 0 : (parseInt(String(nodeAny.borderWidth || 2), 10) || 2);
  const half = strokeWidth / 2;

  const w = (node.width ?? VIEWBOX_W) as number;
  const h = (node.height ?? VIEWBOX_H) as number;
  const minDim = Math.min(w, h);
  const cornerRadius = Math.max(0, Math.min(1, (nodeAny.cornerRadius as number) ?? 0.35));
  const maxRadius = minDim / 2;
  const rx = Math.min(cornerRadius * maxRadius, maxRadius);

  const trackStyle = ((nodeAny.progressTrackStyle as string) || "solid") as "solid" | "gradient";
  const trackColors = ((nodeAny.progressTrackColors as string[])?.length ? nodeAny.progressTrackColors : ["#e5e7eb"]) as string[];
  const trackGradAngle = (nodeAny.progressTrackGradientAngle as number) ?? 90;

  const fillStyle = ((nodeAny.progressFillStyle as string) || "gradient") as "solid" | "gradient";
  const fillColors = ((nodeAny.progressFillColors as string[])?.length
    ? nodeAny.progressFillColors
    : ["#22c55e", "#15803d"]) as string[];
  const fillGradAngle = (nodeAny.progressFillGradientAngle as number) ?? 90;

  const progressPct = clampPct(Number(nodeAny.progressPercent ?? 62));
  const showPct = nodeAny.progressShowPercent !== false;
  const plainLabel = typeof rest.label === "string" ? rest.label.trim() : "";
  const vp = nodeAny.textVerticalPosition as "top" | "middle" | "bottom" | undefined;
  const tp = nodeAny.textPosition as "above" | "center" | "under" | undefined;
  let barTitleBand: "top" | "middle" | "bottom";
  if (vp === "top" || vp === "middle" || vp === "bottom") {
    barTitleBand = vp;
  } else if (tp === "above") barTitleBand = "top";
  else if (tp === "under") barTitleBand = "bottom";
  else barTitleBand = "middle";
  const hasCenterTitle = barTitleBand === "middle" && !!plainLabel;

  const fillW = Math.max(0, (w * progressPct) / 100);

  /** Hit strip on the fill/track boundary (viewBox user units), ~px feel when bar is wide. */
  const thumbUw = Math.max(8, Math.min(20, w * 0.11));
  const dividerX = half + fillW;
  let thumbX = dividerX - thumbUw / 2;
  thumbX = Math.max(half, Math.min(thumbX, half + w - thumbUw));

  const vbW = w + strokeWidth;
  const vbH = h + strokeWidth;

  const borderGradCoords =
    borderStyle === "gradient" && borderColors.length >= 2 ? getGradientCoordinates(borderGradientAngle) : null;

  const strokePaint =
    borderStyle === "none"
      ? "none"
      : borderStyle === "gradient" && borderColors.length >= 2 && borderGradCoords
        ? `url(#${safeId}-bord)`
        : String(nodeAny.borderColor || "#6b7280");
  const strokeDasharray = borderStyle === "dotted" ? "3,3" : undefined;

  const trackPaint =
    trackStyle === "gradient" && trackColors.length >= 2 ? `url(#${safeId}-ptrack)` : (trackColors[0] ?? "#e5e7eb");

  const barFillPaint =
    fillStyle === "gradient" && fillColors.length >= 2 ? `url(#${safeId}-pfill)` : (fillColors[0] ?? "#22c55e");

  const tCoordsTrack = trackStyle === "gradient" && trackColors.length >= 2 ? getGradientCoordinates(trackGradAngle) : null;
  const tCoordsFill = fillStyle === "gradient" && fillColors.length >= 2 ? getGradientCoordinates(fillGradAngle) : null;

  const pctFont = Math.min(h * 0.38, Number(nodeAny.fontSize) || 14, 28);
  const textCol = String(nodeAny.textColor || "#111827");

  const setProgressFromClientX = useCallback(
    (clientX: number, svg: SVGSVGElement) => {
      if (!onPatch) return;
      const r = svg.getBoundingClientRect();
      const u = clampPct(((clientX - r.left) / Math.max(1e-6, r.width)) * 100);
      onPatch({ progressPercent: Math.round(u) });
    },
    [onPatch],
  );

  const endDrag = useCallback(() => {
    if (!dragActiveRef.current) return;
    dragActiveRef.current = false;
    onProgressDragSessionChange?.(false);
  }, [onProgressDragSessionChange]);

  const onPointerDownBar = useCallback(
    (e: React.PointerEvent<SVGRectElement>) => {
      if (isReadOnly || !onPatch) return;
      e.stopPropagation();
      e.preventDefault();
      dragActiveRef.current = true;
      onProgressDragSessionChange?.(true);
      const svg = (e.currentTarget as SVGRectElement).ownerSVGElement;
      if (svg) setProgressFromClientX(e.clientX, svg);
      (e.currentTarget as SVGRectElement).setPointerCapture(e.pointerId);
    },
    [isReadOnly, onPatch, onProgressDragSessionChange, setProgressFromClientX],
  );

  const onPointerMoveBar = useCallback(
    (e: React.PointerEvent<SVGRectElement>) => {
      if (!dragActiveRef.current || !onPatch) return;
      const svg = (e.currentTarget as SVGRectElement).ownerSVGElement;
      if (svg) setProgressFromClientX(e.clientX, svg);
    },
    [onPatch, setProgressFromClientX],
  );

  const onPointerUpBar = useCallback(
    (e: React.PointerEvent<SVGRectElement>) => {
      try {
        (e.currentTarget as SVGRectElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      endDrag();
    },
    [endDrag],
  );

  const showPercentInSvg = showPct && !(hasCenterTitle && plainLabel);

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
      frostedClipRectInViewBox={{ x: half, y: half, w, h, rx, ry: rx }}
      svgPointerEvents="none"
      svgContent={
        <>
          <defs>
            {borderStyle === "gradient" && borderColors.length >= 2 && borderGradCoords ? (
              <linearGradient
                id={`${safeId}-bord`}
                x1={borderGradCoords.x1}
                y1={borderGradCoords.y1}
                x2={borderGradCoords.x2}
                y2={borderGradCoords.y2}
              >
                <stop offset="0%" stopColor={borderColors[0]} />
                <stop offset="100%" stopColor={borderColors[1]} />
              </linearGradient>
            ) : null}
            {trackStyle === "gradient" && trackColors.length >= 2 && tCoordsTrack ? (
              <linearGradient
                id={`${safeId}-ptrack`}
                x1={tCoordsTrack.x1}
                y1={tCoordsTrack.y1}
                x2={tCoordsTrack.x2}
                y2={tCoordsTrack.y2}
              >
                <stop offset="0%" stopColor={trackColors[0]} />
                <stop offset="100%" stopColor={trackColors[1]} />
              </linearGradient>
            ) : null}
            {fillStyle === "gradient" && fillColors.length >= 2 && tCoordsFill ? (
              <linearGradient
                id={`${safeId}-pfill`}
                x1={tCoordsFill.x1}
                y1={tCoordsFill.y1}
                x2={tCoordsFill.x2}
                y2={tCoordsFill.y2}
              >
                <stop offset="0%" stopColor={fillColors[0]} />
                <stop offset="100%" stopColor={fillColors[1]} />
              </linearGradient>
            ) : null}
            <clipPath id={`${safeId}-inner`}>
              <rect x={half} y={half} width={w} height={h} rx={rx} ry={rx} />
            </clipPath>
          </defs>

          <g clipPath={`url(#${safeId}-inner)`} pointerEvents="none">
            <rect x={half} y={half} width={w} height={h} rx={rx} ry={rx} fill={trackPaint} stroke="none" />
            {fillW > 0 ? (
              <rect x={half} y={half} width={fillW} height={h} rx={rx} ry={rx} fill={barFillPaint} stroke="none" />
            ) : null}
          </g>

          {strokeWidth > 0 ? (
            <rect
              x={half}
              y={half}
              width={w}
              height={h}
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

          {showPercentInSvg ? (
            <text
              x={(half + w / 2) as number}
              y={(half + h / 2) as number}
              textAnchor="middle"
              dominantBaseline="central"
              fill={textCol}
              fontSize={pctFont}
              fontWeight={600}
              fontFamily={(nodeAny.fontFamily as string) || "inherit"}
              pointerEvents="none"
              style={{
                ...(Number(nodeAny.textOpacity) >= 0 && Number(nodeAny.textOpacity) !== 1
                  ? { opacity: Number(nodeAny.textOpacity) }
                  : {}),
              }}
            >
              {`${Math.round(progressPct)}%`}
            </text>
          ) : null}

          {!isReadOnly && onPatch && !isEditingLabel ? (
            <rect
              data-dw-progress-bar-drag=""
              x={thumbX}
              y={half}
              width={thumbUw}
              height={h}
              fill="transparent"
              stroke="none"
              pointerEvents="auto"
              style={{ cursor: "ew-resize", touchAction: "none" }}
              onPointerDown={onPointerDownBar}
              onPointerMove={onPointerMoveBar}
              onPointerUp={onPointerUpBar}
              onPointerCancel={() => endDrag()}
            />
          ) : null}
        </>
      }
    />
  );
}
