"use client";

import React, { useId, useMemo } from "react";
import type { CardElementStyle } from "@/lib/card-types";
import { clippedMeshGradientSvg } from "@/lib/mesh-gradient";

interface CardElementMeshBackgroundProps {
  style: CardElementStyle;
  borderRadius?: number | string;
}

/** SVG mesh gradient layer for card element regions (absolute fill). */
export function CardElementMeshBackground({ style, borderRadius }: CardElementMeshBackgroundProps) {
  const uid = useId().replace(/:/g, "");
  const baseColor = style.backgroundColor ?? "#6b7280";

  const paint = useMemo(() => {
    const rx =
      typeof borderRadius === "number"
        ? borderRadius
        : typeof borderRadius === "string" && borderRadius.endsWith("px")
          ? parseFloat(borderRadius) || 0
          : 0;
    return clippedMeshGradientSvg({
      uidBase: uid,
      innerX: 0,
      innerY: 0,
      innerW: 100,
      innerH: 100,
      baseColor,
      points: style.meshGradientPoints,
      clipPathChildren: <rect x={0} y={0} width={100} height={100} rx={rx} ry={rx} />,
    });
  }, [uid, baseColor, style.meshGradientPoints, borderRadius]);

  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      {paint.defs}
      {paint.fillClipGroup}
    </svg>
  );
}
