import type { DiagramConnectionData } from "@/lib/types";
import { isIconOrEmojiType } from "@/lib/utils";

const MIN_W = 1;
const MAX_W = 50;

/**
 * Reference line width (px) for connection animation **spacing along the path** only.
 * Dot **render** size still uses actual `lineWidth`; decoupling avoids huge spacing when the line is very thick
 * (which would otherwise reduce dot count to zero on short paths).
 */
export const CONNECTION_ANIMATION_SPACING_REF_LINE_PX = 2.5;

/** Default connection label font size (px) when `textFontSize` is omitted. */
export const DEFAULT_CONNECTION_TEXT_FONT_SIZE = 12;

export function clampConnectionTextFontSize(size: number | undefined): number {
  if (size === undefined || !Number.isFinite(size)) return DEFAULT_CONNECTION_TEXT_FONT_SIZE;
  return Math.max(8, Math.min(48, Math.round(size)));
}

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

function nodeLineColor(c?: string | null): string | undefined {
  if (c == null) return undefined;
  const t = String(c).trim();
  return t.length > 0 ? String(c) : undefined;
}

function explicitConnColor(connection?: DiagramConnectionData, prop?: string): string | undefined {
  return nodeLineColor(connection?.color) ?? nodeLineColor(prop);
}

/** True for theme default connector greys stored on edges — treated as "unset" for match-source fallback. */
function isDefaultConnectorFallbackColor(c: string): boolean {
  const n = c.trim().toLowerCase().replace(/\s/g, "");
  return (
    n === "#6b7280" ||
    n === "#9ca3af" ||
    n === "rgb(107,114,128)" ||
    n === "rgb(156,163,175)" ||
    n === "rgba(107,114,128,1)" ||
    n === "rgba(156,163,175,1)"
  );
}

/** Non-default explicit `connection.color` / prop (user-chosen line colour), excluding generic greys. */
function explicitUserConnectionColor(connection?: DiagramConnectionData, prop?: string): string | undefined {
  const raw = connection?.color ?? prop;
  const c = nodeLineColor(raw);
  if (!c) return undefined;
  if (isDefaultConnectorFallbackColor(c)) return undefined;
  return c;
}

/** Match-source flag from persisted / imported JSON (boolean or loose truthy). */
export function isUseSourceLineColorOn(connection?: DiagramConnectionData): boolean {
  const v = connection?.useSourceLineColor as unknown;
  return v === true || v === "true" || v === 1;
}

/** Shape/zone fields that define the visible outline when matching connection color to the source. */
export type ConnectionEndpointOutline = {
  lineColor?: string;
  borderColor?: string;
  borderStyle?: string;
  borderColors?: string[];
  type?: string;
  subType?: string;
  /** Zone legacy frame tint */
  color?: string;
  iconColor?: string;
};

/**
 * Color to use when "match source outline" is on: the **visible** stroke first (`borderColors` /
 * `borderColor` when the border is not `none`), then connector tint `lineColor`, then zone / icon
 * fallbacks. `lineColor` is often a theme default for links and can disagree with a gradient border.
 */
export function sourceOutlineTintForConnection(from?: ConnectionEndpointOutline): string | undefined {
  if (!from) return undefined;

  const bsRaw = from.borderStyle;
  const borderIsNone = typeof bsRaw === "string" && bsRaw.trim().toLowerCase() === "none";

  if (!borderIsNone) {
    // Shapes with gradient borders store stops in `borderColors`. Prefer those before `borderColor`:
    // a leftover solid `borderColor` (e.g. orange) must not override the rendered gradient outline.
    if (from.borderColors?.length) {
      const c0 = nodeLineColor(from.borderColors[0]);
      if (c0) return c0;
    }

    const solid = nodeLineColor(from.borderColor);
    if (solid) return solid;
  }

  const lc = nodeLineColor(from.lineColor);
  if (lc) return lc;

  const t = from.type;
  if (t === "zone" || from.subType === "zone") {
    const zc = nodeLineColor(from.color);
    if (zc) return zc;
  }

  if (t && isIconOrEmojiType(t)) {
    return nodeLineColor(from.iconColor);
  }

  return undefined;
}

function matchSourceFallbackBezier(
  connection: DiagramConnectionData | undefined,
  connectionColorProp: string | undefined,
  to: { lineColor?: string },
  from: ConnectionEndpointOutline
): string {
  const gray = "#6b7280";
  return (
    explicitUserConnectionColor(connection, connectionColorProp) ??
    nodeLineColor(to.lineColor) ??
    nodeLineColor(from.lineColor) ??
    gray
  );
}

function matchSourceFallbackOrthogonal(
  connection: DiagramConnectionData | undefined,
  connectionColorProp: string | undefined,
  to: { lineColor?: string },
  from: ConnectionEndpointOutline,
  themeNeutral: string
): string {
  return (
    explicitUserConnectionColor(connection, connectionColorProp) ??
    nodeLineColor(to.lineColor) ??
    nodeLineColor(from.lineColor) ??
    themeNeutral
  );
}

/** Resolved stroke colors for Bezier connections (source-line preference + gradients). */
export function resolveBezierConnectionPaint(
  connection: DiagramConnectionData | undefined,
  connectionColorProp: string | undefined,
  from: ConnectionEndpointOutline,
  to: { lineColor?: string }
): ResolvedConnectionColors {
  const gray = "#6b7280";
  const tail = () =>
    nodeLineColor(connectionColorProp) ?? nodeLineColor(to.lineColor) ?? nodeLineColor(from.lineColor) ?? gray;

  const base =
    isUseSourceLineColorOn(connection)
      ? sourceOutlineTintForConnection(from) ?? matchSourceFallbackBezier(connection, connectionColorProp, to, from)
      : explicitConnColor(connection, connectionColorProp) ?? tail();

  const locked = connection?.colorLock !== false;
  if (locked) {
    return { cStart: base, cEnd: base, locked: true };
  }
  const end = nodeLineColor(connection?.colorEnd) ?? base;
  return { cStart: base, cEnd: end, locked: false };
}

/** Resolved stroke colors for orthogonal connections (theme-aware tail matches canvas). */
export function resolveOrthogonalConnectionPaint(
  connection: DiagramConnectionData | undefined,
  connectionColorProp: string | undefined,
  from: ConnectionEndpointOutline,
  to: { lineColor?: string },
  themeNeutral: string
): ResolvedConnectionColors {
  const tail = () =>
    nodeLineColor(connectionColorProp) ??
    nodeLineColor(to.lineColor) ??
    nodeLineColor(from.lineColor) ??
    themeNeutral;

  const base =
    isUseSourceLineColorOn(connection)
      ? sourceOutlineTintForConnection(from) ??
        matchSourceFallbackOrthogonal(connection, connectionColorProp, to, from, themeNeutral)
      : explicitConnColor(connection, connectionColorProp) ?? tail();

  const locked = connection?.colorLock !== false;
  if (locked) {
    return { cStart: base, cEnd: base, locked: true };
  }
  const end = nodeLineColor(connection?.colorEnd) ?? base;
  return { cStart: base, cEnd: end, locked: false };
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
export function connectionAdvancedStyleRevisionKeyResolved(
  connection: DiagramConnectionData | undefined,
  rc: ResolvedConnectionColors
): string {
  const rw = resolveConnectionWidths(connection);
  const widthVaries = !rw.locked && rw.wStart !== rw.wEnd;
  const colorVaries = !rc.locked && rc.cStart !== rc.cEnd;
  const advanced = connectionNeedsAdvancedLineStyle(rw, rc);
  return [
    rw.locked ? "1" : "0",
    rw.wStart.toFixed(6),
    rw.wEnd.toFixed(6),
    rc.locked ? "1" : "0",
    rc.cStart,
    rc.cEnd,
    widthVaries ? "1" : "0",
    colorVaries ? "1" : "0",
    advanced ? "1" : "0",
  ].join("|");
}

export function connectionAdvancedStyleRevisionKey(
  connection: DiagramConnectionData | undefined,
  fallbackColor: string
): string {
  const rc = resolveConnectionColors(connection, fallbackColor);
  return connectionAdvancedStyleRevisionKeyResolved(connection, rc);
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
  rc: ResolvedConnectionColors,
  gradientAxis: { gx1: number; gy1: number; gx2: number; gy2: number }
): string {
  const styleKey = connectionAdvancedStyleRevisionKeyResolved(connection, rc);
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
