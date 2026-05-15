"use client";

import React, { useId, useMemo } from "react";
import type { DiagramNodeData, RichTextRun } from "@/lib/types";
import { SvgShapeBase } from "./svg-shape-base";
import { getShapeSvgFill } from "./shape-utils";
import { useSvgGradient } from "@/hooks/use-svg-gradient";
import { roundedRectangleMeshGradientSvg, meshGradientHubMarkersSvg } from "@/lib/mesh-gradient";

interface RoundedRectangleShapeProps {
  node: DiagramNodeData & { width?: number; height?: number };
  /** When true (editor, single-selected), draw numbered markers at mesh hub positions. */
  showMeshGradientHubIndicators?: boolean;
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
  onVerticalAlignChange?: (position: 'top' | 'middle' | 'bottom') => void;
  onLabelKeyDown: (e: React.KeyboardEvent) => void;
  onLabelDoubleClick: (e: React.MouseEvent) => void;
}

const VIEWBOX_W = 80;
const VIEWBOX_H = 50;

export function RoundedRectangleShape(props: RoundedRectangleShapeProps) {
  const { showMeshGradientHubIndicators = false, ...svgShapeRest } = props;
  const { node } = svgShapeRest;
  const nodeAny = node as any;

  const backgroundColors = nodeAny.backgroundColors || [nodeAny.backgroundColor || "#6b7280"];
  const borderColors = nodeAny.borderColors || [nodeAny.borderColor || "#6b7280"];
  const gradientAngle = nodeAny.gradientAngle || 135;
  const borderGradientAngle = nodeAny.borderGradientAngle ?? gradientAngle;
  const backgroundStyle = nodeAny.backgroundStyle || "solid";
  const borderStyle = nodeAny.borderStyle || "solid";
  const isMesh = backgroundStyle === "mesh_gradient";

  const strokeWidth = borderStyle === "none" ? 0 : (parseInt(String(nodeAny.borderWidth || 2), 10) || 2);
  const half = strokeWidth / 2;

  const w = node.width ?? VIEWBOX_W;
  const h = node.height ?? VIEWBOX_H;
  const minDim = Math.min(w, h);
  // cornerRadius 0=straight, 1=full pill; use rx=ry for uniform circular arcs
  const cornerRadius = Math.max(0, Math.min(1, nodeAny.cornerRadius ?? 0.2));
  const maxRadius = minDim / 2;
  const radius = cornerRadius * maxRadius;
  const rx = Math.min(radius, maxRadius);
  const ry = rx;

  // viewBox matches actual node size so scaling is 1:1; stroke outer edge maps to container
  const vbW = w + strokeWidth;
  const vbH = h + strokeWidth;

  const { defs, fillRef, strokeRef } = useSvgGradient({
    colors: backgroundStyle === "gradient" ? backgroundColors : [backgroundColors[0]],
    angle: gradientAngle,
    borderColors: borderStyle === "gradient" ? borderColors : undefined,
    borderAngle: borderStyle === "gradient" ? borderGradientAngle : undefined,
    enabled: backgroundStyle === "gradient" || borderStyle === "gradient"
  });

  const fillColor = getShapeSvgFill(backgroundStyle, fillRef, nodeAny.backgroundColor);
  const strokeColor = borderStyle === "gradient" ? strokeRef : (nodeAny.borderColor || "#6b7280");
  const strokeDasharray = borderStyle === "dotted" ? "3,3" : undefined;

  const meshUidBase = `dw-rr-${useId().replace(/:/g, "")}`;
  const meshPaint = useMemo(() => {
    if (!isMesh) return { defs: null as React.ReactNode, fillClipGroup: null as React.ReactNode };
    const baseCol = nodeAny.backgroundColor || "#6b7280";
    return roundedRectangleMeshGradientSvg({
      uidBase: meshUidBase,
      innerX: half,
      innerY: half,
      innerW: w,
      innerH: h,
      rx,
      ry,
      baseColor: baseCol,
      points: nodeAny.meshGradientPoints,
    });
  }, [isMesh, meshUidBase, half, w, h, rx, ry, nodeAny.backgroundColor, nodeAny.meshGradientPoints]);

  const meshHubMarkers = meshGradientHubMarkersSvg({
    show: Boolean(isMesh && showMeshGradientHubIndicators),
    points: nodeAny.meshGradientPoints,
    baseColor: nodeAny.backgroundColor || "#6b7280",
    innerX: half,
    innerY: half,
    innerW: w,
    innerH: h,
  });

  return (
    <SvgShapeBase
      {...svgShapeRest}
      defaultWidth={VIEWBOX_W}
      defaultHeight={VIEWBOX_H}
      viewBox={`0 0 ${vbW} ${vbH}`}
      frostedClipRectInViewBox={{ x: half, y: half, w, h, rx, ry }}
      svgContent={
        <>
          {defs}
          {meshPaint.defs}
          {isMesh ? (
            <>
              {meshPaint.fillClipGroup}
              <rect
                x={half}
                y={half}
                width={w}
                height={h}
                rx={rx}
                ry={ry}
                fill="none"
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                {...(strokeWidth > 0 ? { vectorEffect: "non-scaling-stroke" as const } : {})}
              />
              {meshHubMarkers}
            </>
          ) : (
            <rect
              x={half}
              y={half}
              width={w}
              height={h}
              rx={rx}
              ry={ry}
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              {...(strokeWidth > 0 ? { vectorEffect: "non-scaling-stroke" as const } : {})}
            />
          )}
        </>
      }
    />
  );
}
