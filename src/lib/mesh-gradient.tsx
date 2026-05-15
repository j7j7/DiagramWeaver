"use client";

import React from "react";
import type { MeshGradientPoint } from "@/lib/types";
import { meshGradientFallbackHubColors, randomMeshGradientHubColors } from "@/lib/color-shift";

/** Default base fill when first switching a shape to mesh gradient (visual styling). */
export const MESH_GRADIENT_INITIAL_BASE_COLOR = "#6b57b2";

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** sRGB relative luminance (~0–1); unknown inputs default mid so multiply wins. */
function relativeLuminance(input: string): number {
  const s = input.trim();
  if (!s.startsWith("#")) return 0.55;
  let h = s.slice(1);
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (h.length !== 6 && h.length !== 8) return 0.55;
  const n = parseInt(h.length === 8 ? h.slice(0, 6) : h, 16);
  if (Number.isNaN(n)) return 0.55;
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const lin = (x: number) => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4));
  const R = lin(r);
  const G = lin(g);
  const B = lin(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/** Light fills: multiply hubs toward colour; dark fills: screen so blobs stay visible. */
export function meshGradientBlendModeForBase(baseColor: string): "multiply" | "screen" {
  return relativeLuminance(baseColor) > 0.45 ? "multiply" : "screen";
}

/** Minimum Euclidean distance between any two hub centres in **x%/y%** space (same units as `xPct`/`yPct`). */
const MIN_MESH_HUB_PAIR_DISTANCE_PCT = 24;
const MIN_MESH_HUB_PAIR_DIST_SQ =
  MIN_MESH_HUB_PAIR_DISTANCE_PCT * MIN_MESH_HUB_PAIR_DISTANCE_PCT;

const MESH_POS_INSET = 8;
const MESH_POS_SPAN = 84;

function distSqPct(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function meshPositionsWellSeparated(
  a: { xPct: number; yPct: number },
  b: { xPct: number; yPct: number },
  c: { xPct: number; yPct: number },
): boolean {
  return (
    distSqPct(a.xPct, a.yPct, b.xPct, b.yPct) >= MIN_MESH_HUB_PAIR_DIST_SQ &&
    distSqPct(a.xPct, a.yPct, c.xPct, c.yPct) >= MIN_MESH_HUB_PAIR_DIST_SQ &&
    distSqPct(b.xPct, b.yPct, c.xPct, c.yPct) >= MIN_MESH_HUB_PAIR_DIST_SQ
  );
}

function randomPctInMeshInset(): number {
  return MESH_POS_INSET + Math.random() * MESH_POS_SPAN;
}

/** Random hub positions with pairwise separation; falls back to stratified jitter if sampling fails. */
function randomSeparatedMeshPositions(): { xPct: number; yPct: number }[] {
  for (let attempt = 0; attempt < 120; attempt++) {
    const a = { xPct: randomPctInMeshInset(), yPct: randomPctInMeshInset() };
    const b = { xPct: randomPctInMeshInset(), yPct: randomPctInMeshInset() };
    const c = { xPct: randomPctInMeshInset(), yPct: randomPctInMeshInset() };
    if (meshPositionsWellSeparated(a, b, c)) return [a, b, c];
  }

  const hi = MESH_POS_INSET + MESH_POS_SPAN;
  const r = (lo: number, hi2: number) => lo + Math.random() * (hi2 - lo);
  return [
    { xPct: r(MESH_POS_INSET, 36), yPct: r(MESH_POS_INSET, 38) },
    { xPct: r(64, hi), yPct: r(MESH_POS_INSET, 42) },
    { xPct: r(34, 66), yPct: r(62, hi) },
  ];
}

/** Random positions (within inset), pairwise separation in **%** space, full-spectrum random hub hues with **HSL L ≤ 50%**. */
export function createRandomMeshGradientPoints(baseColor: string): MeshGradientPoint[] {
  const positions = randomSeparatedMeshPositions();
  const colors = randomMeshGradientHubColors(baseColor);
  return [
    { ...positions[0], color: colors[0] ?? baseColor },
    { ...positions[1], color: colors[1] ?? baseColor },
    { ...positions[2], color: colors[2] ?? baseColor },
  ];
}

export function normalizeMeshGradientPoints(raw: unknown, baseColor: string): MeshGradientPoint[] {
  const fb = meshGradientFallbackHubColors(baseColor);
  const fallback = (): MeshGradientPoint[] => [
    { xPct: 22, yPct: 28, color: fb[0] ?? baseColor },
    { xPct: 78, yPct: 32, color: fb[1] ?? baseColor },
    { xPct: 48, yPct: 76, color: fb[2] ?? baseColor },
  ];
  if (!Array.isArray(raw) || raw.length !== 3) return fallback();
  const out: MeshGradientPoint[] = [];
  for (let i = 0; i < 3; i++) {
    const p = raw[i] as Record<string, unknown>;
    const x = Number(p?.xPct);
    const y = Number(p?.yPct);
    const c = typeof p?.color === "string" ? p.color : baseColor;
    out.push({
      xPct: clamp(Number.isFinite(x) ? x : 50, 0, 100),
      yPct: clamp(Number.isFinite(y) ? y : 50, 0, 100),
      color: c,
    });
  }
  return out;
}

export function clippedMeshGradientSvg(opts: {
  uidBase: string;
  innerX: number;
  innerY: number;
  innerW: number;
  innerH: number;
  baseColor: string;
  points: MeshGradientPoint[] | unknown;
  clipPathChildren: React.ReactNode;
}): { defs: React.ReactNode; fillClipGroup: React.ReactNode } {
  const pts = normalizeMeshGradientPoints(opts.points, opts.baseColor);
  const blendMode = meshGradientBlendModeForBase(opts.baseColor);
  const clipId = `${opts.uidBase}-mesh-clip`;

  const defs = (
    <>
      <clipPath id={clipId}>{opts.clipPathChildren}</clipPath>
      {pts.map((p, i) => (
        <radialGradient
          key={i}
          id={`${opts.uidBase}-mgr-${i}`}
          gradientUnits="objectBoundingBox"
          cx={p.xPct / 100}
          cy={p.yPct / 100}
          r={0.72}
        >
          <stop offset="0%" stopColor={p.color} stopOpacity={1} />
          <stop offset="100%" stopColor={p.color} stopOpacity={0} />
        </radialGradient>
      ))}
    </>
  );

  const fillClipGroup = (
    <g clipPath={`url(#${clipId})`}>
      <rect x={opts.innerX} y={opts.innerY} width={opts.innerW} height={opts.innerH} fill={opts.baseColor} />
      {pts.map((_, i) => (
        <rect
          key={i}
          x={opts.innerX}
          y={opts.innerY}
          width={opts.innerW}
          height={opts.innerH}
          fill={`url(#${opts.uidBase}-mgr-${i})`}
          style={{ mixBlendMode: blendMode }}
        />
      ))}
    </g>
  );

  return { defs, fillClipGroup };
}

export function roundedRectangleMeshGradientSvg(opts: {
  uidBase: string;
  innerX: number;
  innerY: number;
  innerW: number;
  innerH: number;
  rx: number;
  ry: number;
  baseColor: string;
  points: MeshGradientPoint[] | unknown;
}): { defs: React.ReactNode; fillClipGroup: React.ReactNode } {
  return clippedMeshGradientSvg({
    uidBase: opts.uidBase,
    innerX: opts.innerX,
    innerY: opts.innerY,
    innerW: opts.innerW,
    innerH: opts.innerH,
    baseColor: opts.baseColor,
    points: opts.points,
    clipPathChildren: (
      <rect x={opts.innerX} y={opts.innerY} width={opts.innerW} height={opts.innerH} rx={opts.rx} ry={opts.ry} />
    ),
  });
}

/** Editor markers for mesh hubs; coordinates match **`inner*`** fill box (same as hub % mapping). */
export function meshGradientHubMarkersSvg(opts: {
  show: boolean;
  points: unknown;
  baseColor: string;
  innerX: number;
  innerY: number;
  innerW: number;
  innerH: number;
}): React.ReactNode {
  if (!opts.show) return null;
  const base = opts.baseColor || "#6b7280";
  return (
    <g pointerEvents="none" aria-hidden>
      {normalizeMeshGradientPoints(opts.points, base).map((p, i) => {
        const cx = opts.innerX + (p.xPct / 100) * opts.innerW;
        const cy = opts.innerY + (p.yPct / 100) * opts.innerH;
        const outerR = Math.max(3.5, Math.min(opts.innerW, opts.innerH) * 0.055);
        const labelPx = Math.max(5, Math.min(opts.innerW, opts.innerH) * 0.09);
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r={outerR} fill="white" stroke="#0f172a" strokeWidth={1.25} opacity={0.95} />
            <circle cx={cx} cy={cy} r={outerR * 0.42} fill={p.color} opacity={0.9} />
            <text
              x={cx}
              y={cy}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#0f172a"
              fontSize={labelPx}
              fontWeight={700}
              stroke="white"
              strokeWidth={labelPx * 0.14}
              paintOrder="stroke fill"
              style={{ userSelect: "none" }}
            >
              {i + 1}
            </text>
          </g>
        );
      })}
    </g>
  );
}
