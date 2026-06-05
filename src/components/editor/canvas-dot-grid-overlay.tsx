"use client";

import React, { useId } from "react";
import type { Transform } from "@/hooks/use-canvas-transform";
import { useTheme } from "@/components/theme-provider";
import { DIAGRAM_GRID_SIZE } from "@/lib/dot-grid-viewport";

interface CanvasDotGridOverlayProps {
  transform: Transform;
  visible?: boolean;
}

/** Screen-space SVG dot grid aligned to diagram snap grid (20px) at any pan/zoom. */
export function CanvasDotGridOverlay({ transform, visible = true }: CanvasDotGridOverlayProps) {
  const patternId = `dw-dot-grid-${useId().replace(/:/g, "")}`;
  const { resolvedTheme } = useTheme();

  if (!visible) return null;

  const step = Math.max(4, DIAGRAM_GRID_SIZE * transform.k);
  const isDark = resolvedTheme === "dark";
  const dotColor = isDark ? "#94a3b8" : "#64748b";
  const dotOpacity = isDark ? 0.42 : 0.45;
  const dotRadius = Math.max(1, Math.min(2, 1.25 * transform.k));

  return (
    <svg
      aria-hidden
      data-dot-grid-overlay
      className="pointer-events-none absolute inset-0 z-0 h-full w-full"
    >
      <defs>
        <pattern
          id={patternId}
          x={transform.x}
          y={transform.y}
          width={step}
          height={step}
          patternUnits="userSpaceOnUse"
        >
          <circle cx={0} cy={0} r={dotRadius} fill={dotColor} fillOpacity={dotOpacity} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
}
