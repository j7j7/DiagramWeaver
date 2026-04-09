import type { DiagramConnectionData } from "@/lib/types";

const MIN_W = 1;
const MAX_W = 50;

/**
 * Reference line width (px) for connection animation **spacing along the path** only.
 * Dot **render** size still uses actual `lineWidth`; decoupling avoids huge spacing when the line is very thick
 * (which would otherwise reduce dot count to zero on short paths).
 */
export const CONNECTION_ANIMATION_SPACING_REF_LINE_PX = 2.5;

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

/**
 * Stable fingerprint of resolved taper + color gradient (same inputs as render-time
 * `resolveConnectionWidths` / `resolveConnectionColors`). Used by connection memo
 * equality so slide/presentation diagram swaps cannot reuse a stale "flat" render
 * when lock flags or end colors change without other props moving.
 */
export function connectionAdvancedStyleRevisionKey(
  connection: DiagramConnectionData | undefined,
  fallbackColor: string
): string {
  const rw = resolveConnectionWidths(connection);
  const rc = resolveConnectionColors(connection, fallbackColor);
  const widthVaries = !rw.locked && rw.wStart !== rw.wEnd;
  const colorVaries = !rc.locked && rc.cStart !== rc.cEnd;
  const advanced = connectionNeedsAdvancedLineStyle(rw, rc);
  return [
    rw.locked ? '1' : '0',
    rw.wStart.toFixed(6),
    rw.wEnd.toFixed(6),
    rc.locked ? '1' : '0',
    rc.cStart,
    rc.cEnd,
    widthVaries ? '1' : '0',
    colorVaries ? '1' : '0',
    advanced ? '1' : '0',
  ].join('|');
}

/** Same fallback as BezierConnection before `resolveConnectionColors` (prop + node line colors). */
export function bezierConnectionColorFallback(
  connectionColor: string | undefined,
  from: { lineColor?: string },
  to: { lineColor?: string }
): string {
  return connectionColor || to.lineColor || from.lineColor || '#6b7280';
}

/** Same color resolution order as OrthogonalConnection `finalConnectionColor` (theme-neutral tail for memo). */
export function orthogonalConnectionColorFallback(
  connectionData: DiagramConnectionData | undefined,
  connectionColor: string | undefined,
  from: { lineColor?: string },
  to: { lineColor?: string }
): string {
  if (connectionData?.color) return connectionData.color;
  if (connectionColor) return connectionColor;
  if (to?.lineColor) return to.lineColor;
  if (from?.lineColor) return from.lineColor;
  return '#6b7280';
}

function formatGradientAxisCoord(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return n.toFixed(4).replace(/\.?0+$/, '') || '0';
}

/**
 * Short stable id segment for SVG gradient `id`s: includes resolved taper/color revision **and**
 * the gradient axis in user space (`userSpaceOnUse`). Same colors with new endpoint positions
 * must get a new id so engines do not keep a stale gradient vector.
 */
export function connectionGradientIdSuffix(
  connection: DiagramConnectionData | undefined,
  fallbackColor: string,
  gradientAxis: { gx1: number; gy1: number; gx2: number; gy2: number }
): string {
  const styleKey = connectionAdvancedStyleRevisionKey(connection, fallbackColor);
  const geom = [
    formatGradientAxisCoord(gradientAxis.gx1),
    formatGradientAxisCoord(gradientAxis.gy1),
    formatGradientAxisCoord(gradientAxis.gx2),
    formatGradientAxisCoord(gradientAxis.gy2),
  ].join('|');
  const combined = `${styleKey}|axis|${geom}`;
  let h = 2166136261;
  for (let i = 0; i < combined.length; i++) {
    h ^= combined.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}
