"use client";

import React from "react";
import type { DiagramNodeData, TimelineEntryData } from "@/lib/types";
import { connectionStrokeDashFromLineType, cn } from "@/lib/utils";
import {
  connectorLinePathD,
  curveBoundsExpanded,
  getConnectorLineVertices,
  isConnectorLineGeometryClosed,
  linePathTangentAtEnd,
  linePathTangentAtStart,
  pointAtLengthRatio,
  type LinePathStyle,
} from "@/lib/line-curve-path";
import { extractTextStylingFromNode, getSvgTextOutlineProps, getTextEffectsShadowCss } from "@/lib/text-styling";
import { useTheme } from "@/components/theme-provider";
import { useSvgGradient } from "@/hooks/use-svg-gradient";
import { getPlainTextFromRuns } from "@/lib/rich-text";
import { mergedTimelineEntryVisualNode } from "@/lib/timeline-styling";
import {
  layoutTimelineEntriesAbs,
  projectDiagramPointToTimelineStrokeRatio,
  sideMultiplier,
  unitNormalAtRatio,
} from "@/lib/timeline-layout";
import { getShapeSvgFill } from "@/components/diagram/shapes/shape-utils";
import { applyTimelineSequentialHuesToMergedVisual } from "@/lib/timeline-hues";
import { renderConnectorLineCapSvg } from "@/components/diagram/shapes/line";

function diagramCoordsFromTimelineSvgClick(
  e: React.MouseEvent,
  svgEl: SVGSVGElement,
  expanded: { minX: number; minY: number },
): { x: number; y: number } | null {
  const pt = svgEl.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const ctm = svgEl.getScreenCTM();
  if (!ctm) return null;
  const loc = pt.matrixTransform(ctm.inverse());
  return { x: loc.x + expanded.minX, y: loc.y + expanded.minY };
}

function normalizeTwoColors(value: unknown, fallbackA: string, fallbackB: string): [string, string] {
  if (Array.isArray(value)) {
    const vals = value.filter((v): v is string => typeof v === "string" && v.length > 0);
    if (vals.length >= 2) return [vals[0], vals[1]];
    if (vals.length === 1) return [vals[0], vals[0]];
  }
  return [fallbackA, fallbackB];
}

export interface TimelineShapeProps {
  node: DiagramNodeData & {
    __localStartPos?: { x: number; y: number };
    __localEndPos?: { x: number; y: number };
    __localControlPoints?: { x: number; y: number }[];
  };
  onClick?: (e: React.MouseEvent, node: DiagramNodeData) => void;
  onContextMenu?: (e: React.MouseEvent, node: DiagramNodeData) => void;
  /** Editor: spine right-click with arc ratio for “add card” insert position */
  onTimelineSpineContextMenu?: (e: React.MouseEvent, arcRatio: number) => void;
  onSpinePointerDown?: (e: React.PointerEvent) => void;
  activeEntryId?: string | null;
  onEntryPointerDown?: (e: React.PointerEvent, entryId: string) => void;
  onEntryClick?: (e: React.MouseEvent, entryId: string) => void;
  onEntryDoubleClick?: (e: React.MouseEvent, entryId: string) => void;
  onEntryContextMenu?: (e: React.MouseEvent, entryId: string) => void;
  slideColorTransition?: string;
}

function entryLabelText(entry: TimelineEntryData): string {
  if (entry.richLabel?.length) return getPlainTextFromRuns(entry.richLabel);
  return entry.label ?? "";
}

export function TimelineShape({
  node,
  onClick,
  onContextMenu,
  onTimelineSpineContextMenu,
  onSpinePointerDown,
  activeEntryId,
  onEntryPointerDown,
  onEntryClick,
  onEntryDoubleClick,
  onEntryContextMenu,
  slideColorTransition,
}: TimelineShapeProps) {
  const { resolvedTheme } = useTheme();
  const vertices = getConnectorLineVertices(node as DiagramNodeData);
  const startPos = vertices[0];
  const endPos = vertices[vertices.length - 1];
  const closed = isConnectorLineGeometryClosed(node as DiagramNodeData);
  const linePathStyle = (node as DiagramNodeData & { linePathStyle?: LinePathStyle }).linePathStyle;
  const lineSmoothJoints = (node as DiagramNodeData & { lineSmoothJoints?: boolean }).lineSmoothJoints === true;
  const pathD = connectorLinePathD(vertices, linePathStyle, lineSmoothJoints);

  const nodeAny = node as DiagramNodeData & {
    lineColorStyle?: "solid" | "gradient";
    lineColors?: string[];
    lineGradientAngle?: number;
  };
  const lineColor = node.lineColor || "#6b7280";
  const lineColorStyleVs = (nodeAny.lineColorStyle || "solid") as "solid" | "gradient";
  const needsLineBodyGradient =
    lineColorStyleVs === "gradient" && Array.isArray(nodeAny.lineColors) && nodeAny.lineColors.length >= 2;
  const [lineGradStart, lineGradEnd] = normalizeTwoColors(nodeAny.lineColors, lineColor, lineColor);
  const { defs: lineGradientDefs, lineStrokeRef } = useSvgGradient({
    colors: [lineGradStart],
    angle: nodeAny.lineGradientAngle ?? 135,
    lineColors: needsLineBodyGradient ? [lineGradStart, lineGradEnd] : undefined,
    lineAngle: nodeAny.lineGradientAngle ?? 135,
    enabled: needsLineBodyGradient,
  });
  const lineBodyPaint = needsLineBodyGradient ? (lineStrokeRef ?? lineColor) : lineColor;

  const actualStrokeWidth = typeof node.lineThickness === "number" ? node.lineThickness : 2.5;
  const lineType = (node as DiagramNodeData & { lineType?: string }).lineType || "solid";
  const dash = connectionStrokeDashFromLineType(actualStrokeWidth, lineType as "solid" | "dashed" | "dotted");

  const connectorW =
    typeof node.timelineConnectorWidth === "number" ? node.timelineConnectorWidth : Math.max(1.5, actualStrokeWidth * 0.85);
  const dotR = typeof node.timelineDotRadius === "number" ? node.timelineDotRadius : 5;

  const nodeX = node.x ?? curveBoundsExpanded(vertices, 20, linePathStyle, lineSmoothJoints).minX;
  const nodeY = node.y ?? curveBoundsExpanded(vertices, 20, linePathStyle, lineSmoothJoints).minY;

  const layouts = layoutTimelineEntriesAbs(node as DiagramNodeData, node as any);
  const sequentialHueRankByEntryId = new Map<string, number>();
  [...layouts]
    .sort((a, b) => (a.ratio !== b.ratio ? a.ratio - b.ratio : a.entryIndex - b.entryIndex))
    .forEach((L, rank) => sequentialHueRankByEntryId.set(L.entryId, rank));
  const sections = Math.max(0, Math.floor(node.timelineSections ?? 0));

  const expanded = curveBoundsExpanded(
    vertices,
    Math.max(36, actualStrokeWidth * 3 + 28),
    linePathStyle,
    lineSmoothJoints,
  );
  for (const L of layouts) {
    expanded.minX = Math.min(expanded.minX, L.cardCenter.x - L.cardW / 2 - 8);
    expanded.maxX = Math.max(expanded.maxX, L.cardCenter.x + L.cardW / 2 + 8);
    expanded.minY = Math.min(expanded.minY, L.cardCenter.y - L.cardH / 2 - 8);
    expanded.maxY = Math.max(expanded.maxY, L.cardCenter.y + L.cardH / 2 + 8);
  }

  const svgMinX = expanded.minX - nodeX;
  const svgMinY = expanded.minY - nodeY;
  const svgWidth = Math.max(1, expanded.maxX - expanded.minX);
  const svgHeight = Math.max(1, expanded.maxY - expanded.minY);

  const tangentStart = linePathTangentAtStart(vertices, linePathStyle);
  const tangentEnd = linePathTangentAtEnd(vertices, linePathStyle);
  const angleToStartCap = tangentStart + 180;
  const startCap = (node as DiagramNodeData & { startCap?: string }).startCap || "none";
  const endCap = (node as DiagramNodeData & { endCap?: string }).endCap || "none";
  const capSize = 10;
  const relStartX = startPos.x - nodeX;
  const relStartY = startPos.y - nodeY;
  const relEndX = endPos.x - nodeX;
  const relEndY = endPos.y - nodeY;

  const themeLabelShadow =
    resolvedTheme === "dark"
      ? "0 0 2px rgba(0,0,0,1), 1px 1px 3px rgba(0,0,0,0.9)"
      : "0 0 2px rgba(255,255,255,1), 1px 1px 3px rgba(255,255,255,0.9)";

  return (
    <div
      style={{
        position: "absolute",
        left: `${svgMinX}px`,
        top: `${svgMinY}px`,
        width: `${svgWidth}px`,
        height: `${svgHeight}px`,
        pointerEvents: "none",
      }}
    >
      <svg
        data-node-id={node.id}
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        style={{ overflow: "visible", pointerEvents: "auto" }}
      >
        <g transform={`translate(${-(nodeX + svgMinX)}, ${-(nodeY + svgMinY)})`}>
          {lineGradientDefs}
          <path
            d={pathD}
            fill="none"
            stroke="transparent"
            strokeWidth={Math.max(22, actualStrokeWidth * 4)}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ pointerEvents: "stroke", cursor: onClick ? "pointer" : undefined }}
            onPointerDown={(e) => onSpinePointerDown?.(e)}
            onClick={(e) => {
              e.stopPropagation();
              onClick?.(e as any, node);
            }}
            onContextMenu={(e) => {
              e.stopPropagation();
              e.preventDefault();
              const svg = (e.currentTarget as SVGGraphicsElement).ownerSVGElement as SVGSVGElement | null;
              if (svg && onTimelineSpineContextMenu) {
                let arcRatio = 0.5;
                const d = diagramCoordsFromTimelineSvgClick(e, svg, expanded);
                if (d) {
                  arcRatio = projectDiagramPointToTimelineStrokeRatio(
                    d.x,
                    d.y,
                    vertices,
                    linePathStyle,
                    lineSmoothJoints,
                  );
                }
                onTimelineSpineContextMenu(e as any, arcRatio);
              } else {
                onContextMenu?.(e as any, node);
              }
            }}
          />
          <path
            d={pathD}
            fill="none"
            stroke={lineBodyPaint}
            strokeWidth={actualStrokeWidth}
            strokeLinecap={dash.strokeLinecap ?? "round"}
            strokeLinejoin="round"
            strokeDasharray={dash.strokeDasharray}
            vectorEffect="non-scaling-stroke"
            className="pointer-events-none"
            style={slideColorTransition !== undefined ? { transition: slideColorTransition } : undefined}
          />

          {sections >= 2 &&
            Array.from({ length: sections - 1 }, (_, j) => {
              const r = (j + 1) / sections;
              const p = pointAtLengthRatio(vertices, r, linePathStyle, lineSmoothJoints);
              const { nx, ny } = unitNormalAtRatio(vertices, r, linePathStyle, lineSmoothJoints);
              const tick = 10;
              const m = sideMultiplier("below");
              const x1 = p.x + nx * m * tick * 0.2;
              const y1 = p.y + ny * m * tick * 0.2;
              const x2 = p.x - nx * m * tick;
              const y2 = p.y - ny * m * tick;
              return (
                <line
                  key={`sec-${j}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={lineColor}
                  strokeWidth={1}
                  opacity={0.45}
                  className="pointer-events-none"
                />
              );
            })}

          {layouts.map((L) => {
            const entry = (node.timelineEntries ?? [])[L.entryIndex];
            if (!entry) return null;
            const hueRank =
              (node as DiagramNodeData).timelineCardFillMode === "theme-hues"
                ? sequentialHueRankByEntryId.get(entry.id) ?? L.entryIndex
                : L.entryIndex;
            const merged = applyTimelineSequentialHuesToMergedVisual(
              node as DiagramNodeData,
              hueRank,
              mergedTimelineEntryVisualNode(node as DiagramNodeData, entry) as Record<string, unknown>,
            );
            const bgStyle = (merged.backgroundStyle as string | undefined) || "solid";
            const bgColor = (merged.backgroundColor as string | undefined) || "#f3f4f6";
            const bgColors = (merged.backgroundColors as string[] | undefined) || [bgColor, bgColor];
            const borderStyle = (merged.borderStyle as string | undefined) || "solid";
            const borderColor = (merged.borderColor as string | undefined) || "#d1d5db";
            const borderColors = (merged.borderColors as string[] | undefined) || [borderColor, borderColor];
            const gradId = `tl-bg-${node.id}-${entry.id}`;
            const borderGradId = `tl-bd-${node.id}-${entry.id}`;
            const needsGrad = bgStyle === "gradient";
            const needsBorderGrad = borderStyle === "gradient";

            const cx = L.cardCenter.x;
            const cy = L.cardCenter.y;
            const halfW = L.cardW / 2;
            const halfH = L.cardH / 2;
            const rx = Math.min(L.cornerR, halfW * 0.45, halfH * 0.45);

            const textStyling = extractTextStylingFromNode({
              ...(node as DiagramNodeData),
              textColor: entry.textColor ?? (node as DiagramNodeData).textColor,
            } as DiagramNodeData);
            const textColor =
              entry.textColor ?? textStyling.textColor ?? (bgStyle === "none" ? lineColor : "#111827");
            const outlineSvg = getSvgTextOutlineProps(textStyling);
            const effectsShadow = getTextEffectsShadowCss(textStyling);
            const label = entryLabelText(entry);
            const selected = activeEntryId === entry.id;

            const mult = sideMultiplier(L.side);
            const { nx, ny } = unitNormalAtRatio(vertices, L.ratio, linePathStyle, lineSmoothJoints);
            const offsetPxSpine = node.timelineOffsetPx ?? 44;
            const extra =
              typeof entry.cardNormalOffsetPx === "number" && Number.isFinite(entry.cardNormalOffsetPx)
                ? entry.cardNormalOffsetPx
                : 0;
            const arm = Math.max(dotR * 0.35, dotR + offsetPxSpine * 0.45 + extra);
            const stemEnd = {
              x: L.anchor.x + nx * mult * arm,
              y: L.anchor.y + ny * mult * arm,
            };

            return (
              <g key={entry.id}>
                <defs>
                  {needsGrad && (
                    <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1={cx - halfW} y1={cy - halfH} x2={cx + halfW} y2={cy + halfH}>
                      <stop offset="0%" stopColor={bgColors[0]} />
                      <stop offset="100%" stopColor={bgColors[1] ?? bgColors[0]} />
                    </linearGradient>
                  )}
                  {needsBorderGrad && (
                    <linearGradient id={borderGradId} gradientUnits="userSpaceOnUse" x1={cx - halfW} y1={cy - halfH} x2={cx + halfW} y2={cy + halfH}>
                      <stop offset="0%" stopColor={borderColors[0]} />
                      <stop offset="100%" stopColor={borderColors[1] ?? borderColors[0]} />
                    </linearGradient>
                  )}
                </defs>

                <circle cx={L.anchor.x} cy={L.anchor.y} r={dotR} fill={lineBodyPaint} className="pointer-events-none" />

                <line
                  x1={L.anchor.x}
                  y1={L.anchor.y}
                  x2={stemEnd.x}
                  y2={stemEnd.y}
                  stroke={lineBodyPaint}
                  strokeWidth={connectorW}
                  strokeLinecap="round"
                  className="pointer-events-none"
                />

                <rect
                  x={cx - halfW}
                  y={cy - halfH}
                  width={L.cardW}
                  height={L.cardH}
                  rx={rx}
                  ry={rx}
                  fill={getShapeSvgFill(bgStyle, `url(#${gradId})`, bgColor, "#e5e7eb")}
                  stroke={
                    selected
                      ? "hsl(var(--primary))"
                      : borderStyle === "gradient"
                        ? `url(#${borderGradId})`
                        : borderStyle === "none"
                          ? "none"
                          : borderColor
                  }
                  strokeWidth={selected ? 2.75 : borderStyle === "none" ? 0 : 1.5}
                  vectorEffect="non-scaling-stroke"
                  style={{
                    filter: merged.shadow ? "drop-shadow(0 4px 6px rgba(0,0,0,0.12))" : undefined,
                    cursor: onEntryPointerDown ? "grab" : undefined,
                    pointerEvents: "auto",
                  }}
                  onPointerDown={(e) => onEntryPointerDown?.(e, entry.id)}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEntryClick?.(e as any, entry.id);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onEntryDoubleClick?.(e as any, entry.id);
                  }}
                  onContextMenu={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onEntryContextMenu?.(e as any, entry.id);
                  }}
                />

                {label ? (
                  <text
                    x={cx}
                    y={cy}
                    fill={textColor}
                    stroke={outlineSvg.stroke}
                    strokeWidth={outlineSvg.strokeWidth}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    fontSize={textStyling.fontSize || 12}
                    fontWeight={textStyling.fontWeight || "500"}
                    fontFamily={textStyling.fontFamily || "Inter, system-ui, sans-serif"}
                    fontStyle={textStyling.fontStyle || "normal"}
                    opacity={textStyling.textOpacity ?? 1}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className={cn("pointer-events-none select-none")}
                    style={{
                      paintOrder: outlineSvg.paintOrder,
                      textShadow: effectsShadow ?? (outlineSvg.stroke ? undefined : themeLabelShadow),
                    }}
                  >
                    {label.length > 42 ? `${label.slice(0, 40)}…` : label}
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>
        {!closed &&
          renderConnectorLineCapSvg(
            (startCap || "none") as "none" | "arrow" | "dot" | "square",
            relStartX - svgMinX,
            relStartY - svgMinY,
            angleToStartCap,
            lineBodyPaint,
            capSize,
          )}
        {!closed &&
          renderConnectorLineCapSvg(
            (endCap || "none") as "none" | "arrow" | "dot" | "square",
            relEndX - svgMinX,
            relEndY - svgMinY,
            tangentEnd,
            lineBodyPaint,
            capSize,
          )}
      </svg>
    </div>
  );
}
