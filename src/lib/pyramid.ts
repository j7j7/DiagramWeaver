import type { DiagramNodeData, PyramidDirection, PyramidSizing, TimelineBarSectionData } from "@/lib/types";
import { normalizeTimelineBarSections } from "@/lib/timeline-bar";

export const PYRAMID_NODE_TYPE = "generic.object.pyramid" as const;

/** Segmented pyramid uses the same segment payload as the timeline bar (ticks/spans are ignored). */
export type PyramidSectionData = TimelineBarSectionData;


export interface PyramidTierLayoutVb {
  yBottom: number;
  yTop: number;
  wBottomFrac: number;
  wTopFrac: number;
}

export function isPyramidNodeType(type: string | undefined): boolean {
  return type === PYRAMID_NODE_TYPE || !!type?.endsWith(".pyramid");
}

/** Normalized pyramid sections — timeline-bar normalization with spans/ticks stripped. */
export function normalizePyramidSections(node: DiagramNodeData): TimelineBarSectionData[] {
  const raw = (node as DiagramNodeData & { pyramidSections?: TimelineBarSectionData[] }).pyramidSections;
  if (!Array.isArray(raw) || raw.length === 0) return defaultPyramidSections();
  const migrated = normalizeTimelineBarSections({
    ...(node as DiagramNodeData),
    timelineBarSections: raw,
  } as DiagramNodeData);
  return migrated.map((s) => {
    const { spanStart: _ss, spanEnd: _se, tickLabel: _tk, ...rest } = s;
    return rest;
  });
}



export function defaultPyramidSections(): TimelineBarSectionData[] {
  return Array.from({ length: 4 }, (_, i) => ({
    id: `py-${i}`,
    label: `L${i + 1}`,
    fill: "#94a3b8",
    fillStyle: "theme-hue" as const,
    weight: 1,
  }));
}

export function newPyramidSectionId(nodeId: string): string {
  const u =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 10)
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${nodeId}-py-${u}`;
}

function clampGapPx(g: number): number {
  if (!Number.isFinite(g)) return 0;
  return Math.max(0, Math.min(32, g));
}

/** Narrow-end width fraction 0 → sharp apex, 1 → same as base (square column). */
function clampPyramidApexFraction(r: number): number {
  if (!Number.isFinite(r)) return 0.12;
  return Math.max(0, Math.min(1, r));
}

export interface PyramidInterpolatedWidthParams {
  stackYWide: number;
  stackYNarrow: number;
  apexFraction: number;
  direction: PyramidDirection;
}

/** Min/max SVG Y over tier bands — outer taper uses this vertical span so gaps preserve straight sides. */
export function pyramidStackVerticalExtentFromTiers(tiers: PyramidTierLayoutVb[]): { yMin: number; yMax: number } {
  if (!tiers.length) return { yMin: 0, yMax: 0 };
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const t of tiers) {
    const a = Math.min(t.yBottom, t.yTop);
    const b = Math.max(t.yBottom, t.yTop);
    yMin = Math.min(yMin, a);
    yMax = Math.max(yMax, b);
  }
  return { yMin, yMax };
}

export function pyramidStackWideNarrowYs(
  direction: PyramidDirection,
  yMin: number,
  yMax: number,
): { stackYWide: number; stackYNarrow: number } {
  if (direction === "narrow-at-top") {
    return { stackYWide: yMax, stackYNarrow: yMin };
  }
  return { stackYWide: yMin, stackYNarrow: yMax };
}

/**
 * Fraction of inner width × [narrowEnd…wideEnd], linear vs Y across the pyramid span.
 * Gaps omit paint but widths follow the imaginary continuous taper (reference silhouette).
 */
export function pyramidWidthFracAtY(y: number, p: PyramidInterpolatedWidthParams): number {
  const apex = clampPyramidApexFraction(p.apexFraction);
  const span = Math.abs(p.stackYNarrow - p.stackYWide);
  if (!(span > 1e-9)) {
    return apex;
  }
  let rt: number;
  if (p.direction === "narrow-at-top") {
    rt = (p.stackYWide - y) / (p.stackYWide - p.stackYNarrow);
  } else {
    rt = (y - p.stackYWide) / (p.stackYNarrow - p.stackYWide);
  }
  const t = Math.max(0, Math.min(1, rt));
  return Math.max(0, Math.min(1, 1 + (apex - 1) * t));
}

export function pyramidWidthParamsFromTiers(
  tiers: PyramidTierLayoutVb[],
  apexFraction: number,
  direction: PyramidDirection,
): PyramidInterpolatedWidthParams | null {
  if (!tiers.length) return null;
  const { yMin, yMax } = pyramidStackVerticalExtentFromTiers(tiers);
  const { stackYWide, stackYNarrow } = pyramidStackWideNarrowYs(direction, yMin, yMax);
  return { stackYWide, stackYNarrow, apexFraction, direction };
}

/** Outer hull: single wedge (straight sides); matches glow / frost clip and segment ramp through gaps. */
export function pyramidWedgeHullPolygonVb(params: {
  half: number;
  innerW: number;
  stackYWide: number;
  stackYNarrow: number;
  apexFraction: number;
  direction: PyramidDirection;
}): { x: number; y: number }[] {
  const { half, innerW } = params;
  const interp: PyramidInterpolatedWidthParams = {
    stackYWide: params.stackYWide,
    stackYNarrow: params.stackYNarrow,
    apexFraction: params.apexFraction,
    direction: params.direction,
  };
  const cx = half + innerW / 2;
  const wb = pyramidWidthFracAtY(params.stackYWide, interp) * innerW;
  const wt = pyramidWidthFracAtY(params.stackYNarrow, interp) * innerW;
  return [
    { x: cx - wb / 2, y: params.stackYWide },
    { x: cx + wb / 2, y: params.stackYWide },
    { x: cx + wt / 2, y: params.stackYNarrow },
    { x: cx - wt / 2, y: params.stackYNarrow },
  ];
}

/** Same hull as wedge; apex + direction derive taper when tiers omit updated widths. */
export function pyramidOuterHullPolygonVb(
  half: number,
  innerW: number,
  tiers: PyramidTierLayoutVb[],
  apexFraction: number,
  direction: PyramidDirection,
): { x: number; y: number }[] {
  const wp = pyramidWidthParamsFromTiers(tiers, apexFraction, direction);
  if (!wp) return [];
  return pyramidWedgeHullPolygonVb({
    half,
    innerW,
    stackYWide: wp.stackYWide,
    stackYNarrow: wp.stackYNarrow,
    apexFraction: wp.apexFraction,
    direction: wp.direction,
  });
}

export function pyramidTierHeights(innerBodyH: number, gapPx: number, sections: TimelineBarSectionData[], sizing: PyramidSizing): number[] {
  const n = sections.length;
  if (n <= 0 || !(innerBodyH > 0)) return [];
  const g = clampGapPx(gapPx);
  const totalGap = g * Math.max(0, n - 1);
  const usable = Math.max(0.01 * n, innerBodyH - totalGap);
  if (sizing === "equal") return sections.map(() => usable / n);
  const wt = sections.map((s) => Math.max(1e-6, s.weight ?? 1));
  const sum = wt.reduce((a, b) => a + b, 0);
  return wt.map((w) => (w / sum) * usable);
}

export function pyramidTiersLayoutVb(params: {
  half: number;
  innerHb: number;
  wInner: number;
  gapPx: number;
  sections: TimelineBarSectionData[];
  sizing: PyramidSizing;
  apexRatio: number;
  direction: PyramidDirection;
}): PyramidTierLayoutVb[] {
  const { half, innerHb, wInner: _wInner, sections, sizing, apexRatio, direction, gapPx } = params;
  const n = sections.length;
  if (n === 0 || !(innerHb > 0)) return [];
  const heights = pyramidTierHeights(innerHb, gapPx, sections, sizing);
  let yBot = half + innerHb;
  const tiers: PyramidTierLayoutVb[] = [];
  for (let i = 0; i < n; i++) {
    const h = Math.max(0.5, heights[i] ?? 0);
    const yTop = yBot - h;
    tiers.push({
      yBottom: yBot,
      yTop,
      wBottomFrac: 1,
      wTopFrac: 1,
    });
    yBot = yTop - clampGapPx(gapPx);
  }

  const wp = pyramidWidthParamsFromTiers(tiers, apexRatio, direction);
  if (wp) {
    for (let i = 0; i < tiers.length; i++) {
      const ti = tiers[i];
      tiers[i] = {
        ...ti,
        wBottomFrac: pyramidWidthFracAtY(ti.yBottom, wp),
        wTopFrac: pyramidWidthFracAtY(ti.yTop, wp),
      };
    }
  }

  return tiers;
}

export function pyramidHullClipPathCssPercent(
  hull: { x: number; y: number }[],
  vbW: number,
  vbH: number,
): string | undefined {
  if (!hull.length || !(vbW > 0) || !(vbH > 0)) return undefined;
  const pairs = hull.map((p) => `${(p.x / vbW) * 100}% ${(p.y / vbH) * 100}%`);
  return `polygon(${pairs.join(", ")})`;
}

export function defaultPalettePyramidNodeProps(nodeId: string): Partial<DiagramNodeData> {
  const pyramidSections = defaultPyramidSections().map((s, i) => ({
    ...s,
    id: newPyramidSectionId(`${nodeId}-${i}`),
  }));
  return {
    width: 120,
    height: 140,
    sizeMode: "custom",
    pyramidSections,
    pyramidSizing: "equal",
    pyramidSegmentGap: 6,
    pyramidDirection: "narrow-at-top",
    pyramidApexWidthRatio: 0.12,
    pyramidSectionBorder: false,
    pyramidSectionBorderWidth: 1,
    pyramidSectionBorderColor: "#ffffff",
    timelineBarHueStepDeg: 10,
    textJustify: "center",
    textVerticalPosition: "middle",
    borderWidth: 2,
    borderColor: "#6b7280",
    cornerRadius: 0,
    backgroundColor: "#e5e7eb",
    backgroundStyle: "solid",
    textPosition: "above",
  };
}

export function pyramidMemoPayload(n: DiagramNodeData): string {
  const x = n as DiagramNodeData & {
    pyramidSections?: TimelineBarSectionData[];
    pyramidSizing?: PyramidSizing;
    pyramidSegmentGap?: number;
    pyramidDirection?: PyramidDirection;
    pyramidApexWidthRatio?: number;
    pyramidSectionBorder?: boolean;
    pyramidSectionBorderWidth?: number;
    pyramidSectionBorderColor?: string;
    timelineBarHueStepDeg?: number;
    pyramidHueStepDeg?: number; // legacy (read for theme fill + memo until cleared)
    pyramidLabelsFollowFirstSection?: boolean;
  };
  return JSON.stringify([
    x.pyramidSections,
    x.pyramidSizing,
    x.pyramidSegmentGap,
    x.pyramidDirection,
    x.pyramidApexWidthRatio,
    x.pyramidSectionBorder,
    x.pyramidSectionBorderWidth,
    x.pyramidSectionBorderColor,
    x.timelineBarHueStepDeg,
    x.pyramidHueStepDeg,
    x.pyramidLabelsFollowFirstSection,
    x.cornerRadius,
    x.backgroundStyle,
    x.backgroundColor,
    x.backgroundColors,
    x.borderStyle,
    x.borderColor,
    x.borderColors,
    x.gradientAngle,
    x.borderGradientAngle,
    x.fontSize,
    x.fontFamily,
    x.textJustify,
    x.textVerticalPosition,
    x.fontWeight,
    x.fontStyle,
    x.textDecoration,
    x.textOpacity,
    x.lineHeight,
    x.letterSpacing,
    x.textTransform,
  ]);
}
