"use client";

import React, { useId, useMemo } from "react";
import type { CardElementStyle } from "@/lib/card-types";
import { useSvgGradient } from "@/hooks/use-svg-gradient";
import { roundedRectangleMeshGradientSvg } from "@/lib/mesh-gradient";
import { getShapeSvgFill } from "@/components/diagram/shapes/shape-utils";
import { isFramedHeadingFillVisible } from "@/lib/card-framed-heading";

export type FramedHeadingShellSvgProps = {
  width: number;
  height: number;
  /** 0 = square corners, 1 = pill (same as diagram node `cornerRadius`). */
  cornerRadius: number;
  borderStyle: string;
  borderWidth: number;
  borderColor: string;
  borderColors?: string[];
  borderGradientAngle?: number;
  gradientAngle?: number;
  fillStyle?: CardElementStyle;
  slideColorTransition?: string;
};

/** Rounded shell stroke + interior fill — same geometry as `RoundedRectangleShape`. */
export function FramedHeadingShellSvg({
  width: w,
  height: h,
  cornerRadius: cornerRadius01,
  borderStyle,
  borderWidth: strokeWidth,
  borderColor,
  borderColors,
  borderGradientAngle,
  gradientAngle: nodeGradientAngle = 135,
  fillStyle,
  slideColorTransition,
}: FramedHeadingShellSvgProps) {
  const fillBgStyle = fillStyle?.backgroundStyle;
  const fillVisible = isFramedHeadingFillVisible(fillStyle);
  const isMesh = fillVisible && fillBgStyle === "mesh_gradient";

  const fillColors =
    fillBgStyle === "gradient" && fillStyle?.backgroundColors?.length === 2
      ? fillStyle.backgroundColors
      : [fillStyle?.backgroundColor ?? "#f3f4f6"];
  const fillGradientAngle = fillStyle?.gradientAngle ?? nodeGradientAngle;

  const strokeWidthFinal = borderStyle === "none" ? 0 : strokeWidth;
  const half = strokeWidthFinal / 2;
  const minDim = Math.min(w, h);
  const cornerRadius = Math.max(0, Math.min(1, cornerRadius01));
  const maxRadius = minDim / 2;
  const radius = cornerRadius * maxRadius;
  const rx = Math.min(radius, maxRadius);
  const ry = rx;

  const vbW = w + strokeWidthFinal;
  const vbH = h + strokeWidthFinal;

  const needsFillGradient = fillBgStyle === "gradient" && fillStyle?.backgroundColors?.length === 2;
  const needsBorderGradient = borderStyle === "gradient" && borderColors && borderColors.length >= 2;

  const { defs, fillRef, strokeRef } = useSvgGradient({
    colors: needsFillGradient ? fillColors : [fillColors[0]],
    angle: fillGradientAngle,
    borderColors: needsBorderGradient ? borderColors : undefined,
    borderAngle: needsBorderGradient ? (borderGradientAngle ?? nodeGradientAngle) : undefined,
    enabled: needsFillGradient || needsBorderGradient,
  });

  const fillColor = getShapeSvgFill(fillBgStyle, fillRef, fillStyle?.backgroundColor, "#f3f4f6");
  const strokeColor =
    borderStyle === "gradient" && strokeRef ? strokeRef : borderColor;
  const strokeDasharray = borderStyle === "dotted" ? "3,3" : undefined;

  const meshUidBase = `dw-fh-${useId().replace(/:/g, "")}`;
  const meshPaint = useMemo(() => {
    if (!isMesh || !fillStyle) return { defs: null as React.ReactNode, fillClipGroup: null as React.ReactNode };
    const baseCol = fillStyle.backgroundColor ?? "#6b7280";
    return roundedRectangleMeshGradientSvg({
      uidBase: meshUidBase,
      innerX: half,
      innerY: half,
      innerW: w,
      innerH: h,
      rx,
      ry,
      baseColor: baseCol,
      points: fillStyle.meshGradientPoints,
    });
  }, [isMesh, meshUidBase, half, w, h, rx, ry, fillStyle]);

  const paintTransition = slideColorTransition ? (
    <style>{`
      .dw-fh-shell-paint :is(rect) {
        transition: ${slideColorTransition};
      }
    `}</style>
  ) : null;

  return (
    <svg
      aria-hidden
      className="dw-fh-shell-paint pointer-events-none absolute inset-0 h-full w-full"
      viewBox={`0 0 ${vbW} ${vbH}`}
      preserveAspectRatio="none"
    >
      {paintTransition}
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
            strokeWidth={strokeWidthFinal}
            strokeDasharray={strokeDasharray}
            {...(strokeWidthFinal > 0 ? { vectorEffect: "non-scaling-stroke" as const } : {})}
          />
        </>
      ) : (
        <rect
          x={half}
          y={half}
          width={w}
          height={h}
          rx={rx}
          ry={ry}
          fill={fillVisible ? fillColor : "transparent"}
          stroke={strokeColor}
          strokeWidth={strokeWidthFinal}
          strokeDasharray={strokeDasharray}
          {...(strokeWidthFinal > 0 ? { vectorEffect: "non-scaling-stroke" as const } : {})}
        />
      )}
    </svg>
  );
}
