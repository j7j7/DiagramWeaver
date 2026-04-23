"use client";

import React, { useEffect, useState } from "react";
import type { DiagramNodeData } from "@/lib/types";
import {
  BORDER_BEAM_DEFAULT_COLORS,
  BORDER_BEAM_DEFAULT_DURATION_SEC,
  BORDER_BEAM_DEFAULT_GLOW,
  BORDER_BEAM_DEFAULT_LENGTH,
  BORDER_BEAM_DEFAULT_WIDTH,
  BORDER_BEAM_DEFAULT_WOBBLE,
} from "@/lib/border-beam-defaults";

const PATH_LENGTH_NORM = 1000;

function sanitizeSvgIdFragment(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function normalizeBeamColors(raw: unknown): string[] {
  const base = [...BORDER_BEAM_DEFAULT_COLORS];
  if (!Array.isArray(raw)) return base;
  const vals = raw.filter((v): v is string => typeof v === "string" && v.length > 0);
  if (vals.length >= 3) return [vals[0], vals[1], vals[2]];
  if (vals.length === 2) return [vals[0], vals[1], vals[1]];
  if (vals.length === 1) return [vals[0], vals[0], vals[0]];
  return base;
}

export interface SvgBorderBeamLayerProps {
  node: DiagramNodeData;
  /** Closed path in the same user space as the shape's viewBox (outline centerline). */
  pathD: string;
}

/**
 * SVG overlay: animated stroke-dash along a closed path (pathLength-normalized),
 * with optional glow filter and dasharray wobble. Respects prefers-reduced-motion.
 */
export function SvgBorderBeamLayer({ node, pathD }: SvgBorderBeamLayerProps) {
  const n = node as DiagramNodeData & {
    borderBeam?: boolean;
    borderBeamColors?: string[];
    borderBeamDurationSec?: number;
    borderBeamLength?: number;
    borderBeamGlow?: number;
    borderBeamWidth?: number;
    borderBeamWobble?: number;
  };

  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduceMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  if (!n.borderBeam || reduceMotion) return null;

  const colors = normalizeBeamColors(n.borderBeamColors);
  const dur = Math.min(120, Math.max(0.5, n.borderBeamDurationSec ?? BORDER_BEAM_DEFAULT_DURATION_SEC));
  const lengthFrac = Math.min(0.55, Math.max(0.04, n.borderBeamLength ?? BORDER_BEAM_DEFAULT_LENGTH));
  const glow = Math.min(24, Math.max(0, n.borderBeamGlow ?? BORDER_BEAM_DEFAULT_GLOW));
  const strokeW = Math.min(16, Math.max(1, n.borderBeamWidth ?? BORDER_BEAM_DEFAULT_WIDTH));
  const wobble = Math.min(0.25, Math.max(0, n.borderBeamWobble ?? BORDER_BEAM_DEFAULT_WOBBLE));

  const beam = lengthFrac * PATH_LENGTH_NORM;
  const gap = PATH_LENGTH_NORM - beam;
  const beamLo = Math.max(8, beam * (1 - wobble));
  const beamHi = Math.min(PATH_LENGTH_NORM - 8, beam * (1 + wobble));
  const gapLo = PATH_LENGTH_NORM - beamHi;
  const gapHi = PATH_LENGTH_NORM - beamLo;

  const idBase = `dw-bb-${sanitizeSvgIdFragment(n.id)}`;
  const gradId = `${idBase}-grad`;
  const filterId = `${idBase}-blur`;

  const wobbleDur = Math.max(0.4, dur * 0.45);

  return (
    <g className="pointer-events-none" style={{ mixBlendMode: "screen" }}>
      <defs>
        <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={colors[0]} stopOpacity="1" />
          <stop offset="45%" stopColor={colors[1]} stopOpacity="1" />
          <stop offset="100%" stopColor={colors[2]} stopOpacity="0" />
        </linearGradient>
        {glow > 0.5 ? (
          <filter id={filterId} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur in="SourceGraphic" stdDeviation={glow} result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        ) : null}
      </defs>
      <path
        d={pathD}
        pathLength={PATH_LENGTH_NORM}
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth={strokeW}
        strokeDasharray={`${beam} ${gap}`}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        filter={glow > 0.5 ? `url(#${filterId})` : undefined}
        opacity={0.95}
      >
        <animate
          attributeName="stroke-dashoffset"
          from="0"
          to={String(-PATH_LENGTH_NORM)}
          dur={`${dur}s`}
          repeatCount="indefinite"
          calcMode="linear"
        />
        {wobble > 0.001 ? (
          <animate
            attributeName="stroke-dasharray"
            values={`${beamLo} ${gapLo};${beamHi} ${gapHi};${beamLo} ${gapLo}`}
            keyTimes="0;0.5;1"
            dur={`${wobbleDur}s`}
            repeatCount="indefinite"
            calcMode="spline"
            keySplines="0.4 0 0.2 1;0.4 0 0.2 1"
          />
        ) : null}
      </path>
    </g>
  );
}
