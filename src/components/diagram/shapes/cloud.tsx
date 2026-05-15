"use client";

import React, { useId, useMemo } from "react";
import type { DiagramNodeData, RichTextRun } from "@/lib/types";
import { SvgShapeBase } from "./svg-shape-base";
import { getRoundedEdgesProps, getShapeSvgFill, parseViewBoxString } from "./shape-utils";
import { useSvgGradient } from "@/hooks/use-svg-gradient";
import { CLOUD_SHAPE_PATH_D, CLOUD_SHAPE_VIEW_BOX } from "@/lib/cloud-shape";
import { clippedMeshGradientSvg, meshGradientHubMarkersSvg } from "@/lib/mesh-gradient";

interface CloudShapeProps {
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

export function CloudShape(props: CloudShapeProps) {
  const { showMeshGradientHubIndicators = false, ...svgProps } = props;
  const { node } = svgProps;
  const nodeAny = node as any;
  const roundedEdges = nodeAny.roundedEdges || false;

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
  const strokeColor = borderStyle === "gradient" ? strokeRef : nodeAny.borderColor || "#6b7280";
  const strokeWidth = borderStyle === "none" ? "0" : nodeAny.borderWidth || 2;
  const strokeDasharray = borderStyle === "dotted" ? "3,3" : undefined;
  const strokeWidthNum = borderStyle === "none" ? 0 : (parseInt(String(strokeWidth), 10) || 2);

  const { vbX, vbY, vbW, vbH } = parseViewBoxString(CLOUD_SHAPE_VIEW_BOX);
  const inset = strokeWidthNum / 2;
  const meshInnerX = vbX + inset;
  const meshInnerY = vbY + inset;
  const meshInnerW = Math.max(1, vbW - strokeWidthNum);
  const meshInnerH = Math.max(1, vbH - strokeWidthNum);

  const meshUidBase = `dw-cloud-${useId().replace(/:/g, "")}`;
  const meshPaint = useMemo(() => {
    if (!isMesh) return { defs: null as React.ReactNode | null, fillClipGroup: null as React.ReactNode | null };
    return clippedMeshGradientSvg({
      uidBase: meshUidBase,
      innerX: meshInnerX,
      innerY: meshInnerY,
      innerW: meshInnerW,
      innerH: meshInnerH,
      baseColor: nodeAny.backgroundColor || "#6b7280",
      points: nodeAny.meshGradientPoints,
      clipPathChildren: <path d={CLOUD_SHAPE_PATH_D} />,
    });
  }, [isMesh, meshUidBase, meshInnerX, meshInnerY, meshInnerW, meshInnerH, nodeAny.backgroundColor, nodeAny.meshGradientPoints]);

  const meshHubMarkers = meshGradientHubMarkersSvg({
    show: Boolean(isMesh && showMeshGradientHubIndicators),
    points: nodeAny.meshGradientPoints,
    baseColor: nodeAny.backgroundColor || "#6b7280",
    innerX: meshInnerX,
    innerY: meshInnerY,
    innerW: meshInnerW,
    innerH: meshInnerH,
  });

  const pathStrokeProps = {
    stroke: strokeColor,
    strokeWidth,
    strokeDasharray,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...(strokeWidthNum > 0 ? { vectorEffect: "non-scaling-stroke" as const } : {}),
    ...getRoundedEdgesProps(roundedEdges),
  };

  return (
    <SvgShapeBase
      {...svgProps}
      viewBox={CLOUD_SHAPE_VIEW_BOX}
      defaultWidth={100}
      defaultHeight={60}
      svgContent={
        <>
          {defs}
          {meshPaint.defs}
          {isMesh ? (
            <>
              {meshPaint.fillClipGroup}
              <path d={CLOUD_SHAPE_PATH_D} fill="none" {...pathStrokeProps} />
              {meshHubMarkers}
            </>
          ) : (
            <path d={CLOUD_SHAPE_PATH_D} fill={fillColor} {...pathStrokeProps} />
          )}
        </>
      }
    />
  );
}
