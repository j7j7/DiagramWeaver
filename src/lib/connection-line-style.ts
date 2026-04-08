import type { DiagramConnectionData } from "@/lib/types";

const MIN_W = 1;
const MAX_W = 50;

function fmtAnimFloat(v: number): string {
  return Number.isFinite(v) ? v.toFixed(6).replace(/0+$/, '').replace(/\.$/, '') || '0' : '0';
}

export interface ResolvedConnectionWidths {
  wStart: number;
  wEnd: number;
  /** When false, start/end may differ (`lineWidth` = start, `lineWidthEnd` = end). */
  locked: boolean;
}

export function clampConnectionLineWidth(w: number): number {
  if (!Number.isFinite(w)) return 2.5;
  return Math.max(MIN_W, Math.min(MAX_W, w));
}

/** Linear width along the connection by arc-length fraction `pathFraction` in [0, 1] (start → end). */
export function lineWidthAtPathFraction(rw: ResolvedConnectionWidths, pathFraction: number): number {
  const k = Math.max(0, Math.min(1, pathFraction));
  return rw.wStart * (1 - k) + rw.wEnd * k;
}

/**
 * SMIL scale values aligned with `getLoopedAnimationPathConfig` keyPoints (path fraction 0–1 per keyframe).
 * Renders at base size `animation.size * 2 * max(wStart,wEnd)` then scales by these values.
 */
export function scaleValuesForAnimationKeyPoints(keyPointsStr: string, rw: ResolvedConnectionWidths): string {
  const maxW = Math.max(rw.wStart, rw.wEnd, 1e-6);
  return keyPointsStr
    .split(';')
    .map((s) => {
      const k = parseFloat(s.trim());
      const w = lineWidthAtPathFraction(rw, k);
      return fmtAnimFloat(w / maxW);
    })
    .join(';');
}

export function resolveConnectionWidths(
  connection: DiagramConnectionData | undefined,
  fallback = 2.5
): ResolvedConnectionWidths {
  const base = clampConnectionLineWidth(connection?.lineWidth ?? fallback);
  const locked = connection?.lineWidthLock !== false;
  if (locked) {
    return { wStart: base, wEnd: base, locked: true };
  }
  const end = clampConnectionLineWidth(connection?.lineWidthEnd ?? base);
  return { wStart: base, wEnd: end, locked: false };
}

export interface ResolvedConnectionColors {
  cStart: string;
  cEnd: string;
  locked: boolean;
}

export function resolveConnectionColors(
  connection: DiagramConnectionData | undefined,
  fallback: string
): ResolvedConnectionColors {
  const c = connection?.color ?? fallback;
  const locked = connection?.colorLock !== false;
  if (locked) {
    return { cStart: c, cEnd: c, locked: true };
  }
  const end = connection?.colorEnd ?? c;
  return { cStart: c, cEnd: end, locked: false };
}

/** True when taper and/or color gradient should replace the simple uniform stroke. */
export function connectionNeedsAdvancedLineStyle(
  rw: ResolvedConnectionWidths,
  rc: ResolvedConnectionColors
): boolean {
  const widthVaries = !rw.locked && rw.wStart !== rw.wEnd;
  const colorVaries = !rc.locked && rc.cStart !== rc.cEnd;
  return widthVaries || colorVaries;
}

export function maxResolvedLineWidth(rw: ResolvedConnectionWidths): number {
  return Math.max(rw.wStart, rw.wEnd);
}
