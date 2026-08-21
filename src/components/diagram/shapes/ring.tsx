"use client";

import React, { useId, useMemo } from "react";
import type { DiagramNodeData, RichTextRun } from "@/lib/types";
import {
  clampRingHoleRatio,
  fullAnnulusPath,
  ringRadiiInViewBox,
} from "@/lib/ring-shape";
import { SvgShapeBase } from "./svg-shape-base";
import { getShapeSvgFill } from "./shape-utils";
import { useSvgGradient } from "@/hooks/use-svg-gradient";
import { clippedMeshGradientSvg, meshGradientHubMarkersSvg } from "@/lib/mesh-gradient";

interface RingShapeProps {
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
  onVerticalAlignChange?: (position: "top" | "middle" | "bottom") => void;
  onLabelKeyDown: (e: React.KeyboardEvent) => void;
  onLabelDoubleClick: (e: React.MouseEvent) => void;
}

export function RingShape(props: RingShapeProps) {
  const { showMeshGradientHubIndicators = false, ...svgProps } = props;
  const { node } = svgProps;
  const nodeAny = node as DiagramNodeData & { ringHoleRatio?: number };

  const backgroundColors = nodeAny.backgroundColors || [nodeAny.backgroundColor || "#6b7280"];
  const borderColors = nodeAny.borderColors || [nodeAny.borderColor || "#6b7280"];
  const gradientAngle = nodeAny.gradientAngle || 135;
  const borderGradientAngle = nodeAny.borderGradientAngle ?? gradientAngle;
  const backgroundStyle = nodeAny.backgroundStyle || "solid";
  const borderStyle = nodeAny.borderStyle || "solid";
  const isMesh = backgroundStyle === "mesh_gradient";

  const { defs, fillRef, strokeRef } = useSvgGradient({
    colors: backgroundStyle === "gradient" ? backgroundColors : [backgroundColors[0]],
    angle: gradientAngle,
    borderColors: borderStyle === "gradient" ? borderColors : undefined,
    borderAngle: borderStyle === "gradient" ? borderGradientAngle : undefined,
    enabled: backgroundStyle === "gradient" || borderStyle === "gradient",
  });

  const fillColor = getShapeSvgFill(backgroundStyle, fillRef, nodeAny.backgroundColor);
  const strokeColor = borderStyle === "gradient" ? strokeRef : (nodeAny.borderColor || "#6b7280");
  const strokeWidth = borderStyle === "none" ? "0" : (nodeAny.borderWidth || 2);
  const strokeDasharray = borderStyle === "dotted" ? "3,3" : undefined;
  const strokeWidthNum = borderStyle === "none" ? 0 : (parseInt(String(strokeWidth), 10) || 2);

  const holeRatio = clampRingHoleRatio(nodeAny.ringHoleRatio);
  const { cx, cy, rOuter, rInner } = ringRadiiInViewBox(strokeWidthNum, holeRatio);
  const annulusD = fullAnnulusPath(cx, cy, rOuter, rInner);
  const meshInner = 30 - rOuter;

  const meshUidBase = `dw-ring-${useId().replace(/:/g, "")}`;
  const meshPaint = useMemo(() => {
    if (!isMesh) return { defs: null as React.ReactNode | null, fillClipGroup: null as React.ReactNode | null };
    const side = 2 * rOuter;
    return clippedMeshGradientSvg({
      uidBase: meshUidBase,
      innerX: meshInner,
      innerY: meshInner,
      innerW: side,
      innerH: side,
      baseColor: nodeAny.backgroundColor || "#6b7280",
      points: nodeAny.meshGradientPoints,
      clipPathChildren: <path fillRule="evenodd" d={annulusD} />,
    });
  }, [
    isMesh,
    meshUidBase,
    rOuter,
    meshInner,
    nodeAny.backgroundColor,
    nodeAny.meshGradientPoints,
    annulusD,
  ]);

  const meshHubMarkers = meshGradientHubMarkersSvg({
    show: Boolean(isMesh && showMeshGradientHubIndicators),
    points: nodeAny.meshGradientPoints,
    baseColor: nodeAny.backgroundColor || "#6b7280",
    innerX: meshInner,
    innerY: meshInner,
    innerW: 2 * rOuter,
    innerH: 2 * rOuter,
  });

  const annulusPathProps = {
    d: annulusD,
    fillRule: "evenodd" as const,
    stroke: strokeColor,
    strokeWidth,
    strokeDasharray,
    ...(strokeWidthNum > 0 ? { vectorEffect: "non-scaling-stroke" as const } : {}),
  };

  return (
    <SvgShapeBase
      {...svgProps}
      viewBox="0 0 60 60"
      preserveAspectRatio="xMidYMid meet"
      frostedClipAnnulusInViewBox={
        backgroundStyle === "frosted" ? { cx, cy, rOuter, rInner } : undefined
      }
      svgContent={
        <>
          {defs}
          {meshPaint.defs}
          {isMesh ? (
            <>
              {meshPaint.fillClipGroup}
              <path {...annulusPathProps} fill="none" />
              {meshHubMarkers}
            </>
          ) : (
            <path {...annulusPathProps} fill={fillColor} />
          )}
        </>
      }
    />
  );
}
