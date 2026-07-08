"use client";

import React, { useId, useMemo } from "react";
import type { DiagramNodeData, RichTextRun } from "@/lib/types";
import { SvgShapeBase } from "./svg-shape-base";
import { getShapeSvgFill } from "./shape-utils";
import { useSvgGradient } from "@/hooks/use-svg-gradient";
import { ringsToPathD } from "@/lib/vector-path-utils";

interface VectorPathShapeProps {
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
  /** Live local rings during vertex drag (editor). */
  localRings?: import("@/lib/vector-path-types").VectorPathRing[] | null;
}

export function VectorPathShape(props: VectorPathShapeProps) {
  const { showMeshGradientHubIndicators = false, localRings, ...svgProps } = props;
  const { node } = svgProps;
  const nodeAny = node as DiagramNodeData & { width?: number; height?: number };

  const w = node.width ?? 80;
  const h = node.height ?? 50;
  const rings = localRings ?? node.vectorPath?.rings ?? [];
  const pathD = ringsToPathD(rings);

  const backgroundColors = nodeAny.backgroundColors || [nodeAny.backgroundColor || "#6b7280"];
  const borderColors = nodeAny.borderColors || [nodeAny.borderColor || "#6b7280"];
  const gradientAngle = nodeAny.gradientAngle || 135;
  const borderGradientAngle = nodeAny.borderGradientAngle ?? gradientAngle;
  const backgroundStyle = nodeAny.backgroundStyle || "solid";
  const borderStyle = nodeAny.borderStyle || "solid";

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
  const strokeWidthNum = borderStyle === "none" ? 0 : parseInt(String(strokeWidth), 10) || 2;
  const half = strokeWidthNum / 2;
  const vbW = w + strokeWidthNum;
  const vbH = h + strokeWidthNum;

  const viewBox = `0 0 ${vbW} ${vbH}`;
  const pathTransform = half > 0 ? `translate(${half}, ${half})` : undefined;
  const strokeProps =
    strokeWidthNum > 0
      ? ({
          vectorEffect: "non-scaling-stroke" as const,
          strokeLinejoin: "round" as const,
          strokeMiterlimit: 1,
        } as const)
      : {};
  const clipUid = useId().replace(/:/g, "");
  const clipId = `dw-vpath-${clipUid}`;

  const meshPaint = useMemo(() => {
    if (backgroundStyle !== "mesh_gradient" || !pathD) return null;
    return null;
  }, [backgroundStyle, pathD]);

  void meshPaint;
  void showMeshGradientHubIndicators;

  return (
    <SvgShapeBase
      {...svgProps}
      node={node}
      viewBox={viewBox}
      preserveAspectRatio="none"
      defaultWidth={80}
      defaultHeight={50}
      svgContent={
        <>
          {defs}
          {pathD ? (
            <>
              {backgroundStyle === "frosted" && (
                <defs>
                  <clipPath id={clipId}>
                    <path d={pathD} transform={pathTransform} />
                  </clipPath>
                </defs>
              )}
              <g transform={pathTransform}>
                <path
                  d={pathD}
                  fill={fillColor}
                  fillRule="evenodd"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeDasharray={strokeDasharray}
                  {...strokeProps}
                  clipPath={backgroundStyle === "frosted" ? `url(#${clipId})` : undefined}
                />
              </g>
            </>
          ) : (
            <rect
              x={half}
              y={half}
              width={Math.max(0, w)}
              height={Math.max(0, h)}
              fill="none"
              stroke="#94a3b8"
              strokeDasharray="4,4"
            />
          )}
        </>
      }
    />
  );
}
