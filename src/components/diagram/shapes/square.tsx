"use client";

import React, { useId, useMemo } from "react";
import type { DiagramNodeData, RichTextRun } from "@/lib/types";
import { SvgShapeBase } from "./svg-shape-base";
import { getShapeSvgFill } from "./shape-utils";
import { useSvgGradient } from "@/hooks/use-svg-gradient";
import { clippedMeshGradientSvg, meshGradientHubMarkersSvg } from "@/lib/mesh-gradient";

interface SquareShapeProps {
  node: DiagramNodeData & { width?: number; height?: number };
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
  slideColorTransition?: string;
}

const VIEWBOX_W = 60;
const VIEWBOX_H = 60;

export function SquareShape(props: SquareShapeProps) {
  const { showMeshGradientHubIndicators = false, ...svgProps } = props;
  const { node } = svgProps;
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
  const vbW = w + strokeWidth;
  const vbH = h + strokeWidth;

  const { defs, fillRef, strokeRef } = useSvgGradient({
    colors: backgroundStyle === "gradient" ? backgroundColors : [backgroundColors[0]],
    angle: gradientAngle,
    borderColors: borderStyle === "gradient" ? borderColors : undefined,
    borderAngle: borderStyle === "gradient" ? borderGradientAngle : undefined,
    enabled: backgroundStyle === "gradient" || borderStyle === "gradient",
  });

  const meshUidBase = `dw-sq-${useId().replace(/:/g, "")}`;
  const meshPaint = useMemo(() => {
    if (!isMesh) return { defs: null as React.ReactNode | null, fillClipGroup: null as React.ReactNode | null };
    return clippedMeshGradientSvg({
      uidBase: meshUidBase,
      innerX: half,
      innerY: half,
      innerW: w,
      innerH: h,
      baseColor: nodeAny.backgroundColor || "#6b7280",
      points: nodeAny.meshGradientPoints,
      clipPathChildren: <rect x={half} y={half} width={w} height={h} />,
    });
  }, [isMesh, meshUidBase, half, w, h, nodeAny.backgroundColor, nodeAny.meshGradientPoints]);

  const meshHubMarkers = meshGradientHubMarkersSvg({
    show: Boolean(isMesh && showMeshGradientHubIndicators),
    points: nodeAny.meshGradientPoints,
    baseColor: nodeAny.backgroundColor || "#6b7280",
    innerX: half,
    innerY: half,
    innerW: w,
    innerH: h,
  });

  const fillColor = getShapeSvgFill(backgroundStyle, fillRef, nodeAny.backgroundColor);
  const strokeColor = borderStyle === "gradient" ? strokeRef : (nodeAny.borderColor || "#6b7280");
  const strokeDasharray = borderStyle === "dotted" ? "3,3" : undefined;

  return (
    <SvgShapeBase
      {...svgProps}
      defaultWidth={VIEWBOX_W}
      defaultHeight={VIEWBOX_H}
      viewBox={`0 0 ${vbW} ${vbH}`}
      frostedClipRectInViewBox={{ x: half, y: half, w, h }}
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
