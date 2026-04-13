import type { ChartBarSegmentItem, ChartSliceFillStyle, NodeChartSpecBar } from "@/lib/types";

/** Breadth fraction used for rounded column caps (matches “subtle” rounding on other shapes). */
const BAR_COLUMN_ROUND_BREADTH_RATIO = 0.22;
import { DEFAULT_PIE_SLICE_COLORS, DEFAULT_PIE_SLICE_LABEL_COLOR } from "@/lib/chart-node";

export type BarFillMode = "none" | "solid" | "gradient";

export interface BarRect {
  segmentIndex: number;
  categoryIndex: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Raw data value for this segment × category (for value labels). */
  value: number;
  name: string;
  labelColor: string;
  labelFontSize: number;
  fillMode: BarFillMode;
  solidFill: string;
  gradientColor1: string;
  gradientColor2: string;
}

export interface BarChartLayoutModel {
  rects: BarRect[];
  categoryCount: number;
  valueAxisMax: number;
  valueTicks: number[];
  plot: { x0: number; y0: number; w: number; h: number };
  vertical: boolean;
  vbW: number;
  vbH: number;
}

function resolveBarFill(
  s: ChartBarSegmentItem,
  i: number
): {
  fillMode: BarFillMode;
  solidFill: string;
  gradientColor1: string;
  gradientColor2: string;
} {
  const declared: ChartSliceFillStyle | undefined = s.fillStyle;
  const g = s.gradientColors;
  const hasGradPair = Array.isArray(g) && g.length >= 2 && g[0]?.trim() && g[1]?.trim();

  if (declared === "none") {
    return { fillMode: "none", solidFill: "transparent", gradientColor1: "", gradientColor2: "" };
  }
  if (declared === "gradient" || (!declared && hasGradPair)) {
    const c1 = (g?.[0] ?? "").trim() || DEFAULT_PIE_SLICE_COLORS[i % DEFAULT_PIE_SLICE_COLORS.length];
    const c2 = (g?.[1] ?? "").trim() || c1;
    return { fillMode: "gradient", solidFill: "", gradientColor1: c1, gradientColor2: c2 };
  }
  const fallback = DEFAULT_PIE_SLICE_COLORS[i % DEFAULT_PIE_SLICE_COLORS.length];
  const solid = (s.color ?? "").trim() || fallback;
  return { fillMode: "solid", solidFill: solid, gradientColor1: "", gradientColor2: "" };
}

function defaultBarLabelFontSize(seriesItem: ChartBarSegmentItem | undefined): number {
  const v = seriesItem?.labelFontSize;
  if (typeof v === "number" && Number.isFinite(v) && v > 0) {
    return Math.min(14, Math.max(2, v));
  }
  return 3.25;
}

function clamp01(v: number, max = 0.85): number {
  if (!Number.isFinite(v)) return 0.2;
  return Math.max(0, Math.min(max, v));
}

function niceValueTicks(max: number, targetSteps = 4): number[] {
  if (!(max > 0) || !Number.isFinite(max)) return [0, 1];
  const rough = max / Math.max(1, targetSteps);
  const exp = Math.floor(Math.log10(rough));
  const pow10 = 10 ** exp;
  const f = rough / pow10;
  let niceUnit: number;
  if (f <= 1) niceUnit = 1;
  else if (f <= 2) niceUnit = 2;
  else if (f <= 5) niceUnit = 5;
  else niceUnit = 10;
  const step = niceUnit * pow10;
  const ticks: number[] = [];
  for (let t = 0; t <= max + step * 0.001; t += step) {
    ticks.push(Math.round(t * 1e6) / 1e6);
  }
  if (ticks.length < 2) ticks.push(max);
  return ticks;
}

function padSeriesValues(series: ChartBarSegmentItem[], categoryCount: number): number[][] {
  return series.map((row) => {
    const v = Array.isArray(row.values) ? row.values : [];
    const out: number[] = [];
    for (let j = 0; j < categoryCount; j++) {
      const raw = v[j];
      out.push(Math.max(0, Number.isFinite(raw) ? raw : 0));
    }
    return out;
  });
}

/**
 * Builds rectangle geometry for a bar chart inside a fixed SVG viewBox.
 */
export function buildBarChartLayout(
  spec: NodeChartSpecBar,
  options?: { vbW?: number; vbH?: number }
): BarChartLayoutModel {
  const vbW = options?.vbW ?? 100;
  const vbH = options?.vbH ?? 68;
  const vertical = spec.vertical !== false;
  const showValueAxis = spec.showValueAxis !== false;
  const showCategoryLabels = spec.showCategoryLabels !== false;
  const showLegend = spec.showLegend === true;
  const labels = Array.isArray(spec.categoryLabels) ? spec.categoryLabels : [];
  const seriesRaw = Array.isArray(spec.series) ? spec.series : [];

  const categoryCount = Math.max(
    1,
    seriesRaw.reduce((m, row) => Math.max(m, row.values?.length ?? 0), 0),
    labels.length > 0 ? labels.length : 0
  );

  const hasCategoryText =
    showCategoryLabels && labels.some((s) => (s ?? "").trim());
  const categoryBand = vertical && hasCategoryText ? 5.5 : 0;
  const legendBand = showLegend ? 8.5 : 0;

  const marginL = vertical ? (showValueAxis ? 15 : 9) : showCategoryLabels ? 18 : 10;
  const marginR = 8;
  const marginT = 8;
  const marginB = vertical
    ? 9 + categoryBand + legendBand
    : (showValueAxis ? 12 : 9) + legendBand;

  const plotX0 = marginL;
  const plotY0 = marginT;
  const plotW = vbW - marginL - marginR;
  const plotH = vbH - marginT - marginB;

  const safeSeries: ChartBarSegmentItem[] =
    seriesRaw.length > 0
      ? seriesRaw
      : [{ id: undefined, name: "Series 1", values: Array(categoryCount).fill(0) }];

  const valuesMatrix = padSeriesValues(safeSeries, categoryCount);
  const nSeg = valuesMatrix.length;

  const colTotals = Array.from({ length: categoryCount }, (_, j) =>
    valuesMatrix.reduce((s, row) => s + (row[j] ?? 0), 0)
  );

  let valueAxisMax = 1;
  if (spec.stacked100 === true) {
    valueAxisMax = Math.max(1e-9, ...colTotals, 1);
  } else {
    valueAxisMax = Math.max(1e-9, ...colTotals, 1);
  }
  const valueTicks = niceValueTicks(valueAxisMax, 4);

  const catGap = clamp01(spec.categoryGap ?? 0.22);
  const stackGap = Math.max(0, Math.min(2, spec.stackGap ?? 0.12));

  const rects: BarRect[] = [];

  if (vertical) {
    const catSlot = plotW / categoryCount;
    const barW = catSlot * (1 - catGap);

    for (let j = 0; j < categoryCount; j++) {
      const total = colTotals[j] ?? 0;
      const columnH =
        spec.stacked100 === true && total > 0
          ? plotH
          : (total / valueAxisMax) * plotH;

      const centerX = plotX0 + (j + 0.5) * catSlot;
      const leftX = centerX - barW / 2;
      const baseY = plotY0 + plotH;

      const gapTotal = nSeg > 1 ? stackGap * (nSeg - 1) : 0;
      const innerH = Math.max(0, columnH - gapTotal);

      if (total <= 0 || innerH <= 0) continue;

      let yCursor = baseY;
      for (let i = 0; i < nSeg; i++) {
        const row = safeSeries[i];
        const v = valuesMatrix[i][j] ?? 0;
        if (v <= 0) continue;
        const frac = spec.stacked100 === true && total > 0 ? v / total : v / total;
        const h = frac * innerH;
        yCursor -= h;
        if (h <= 0) continue;
        const fill = resolveBarFill(row, i);
        rects.push({
          segmentIndex: i,
          categoryIndex: j,
          x: leftX,
          y: yCursor,
          w: barW,
          h,
          value: v,
          name: (row.name ?? "").trim() || `Series ${i + 1}`,
          labelColor: row.labelColor?.trim() || DEFAULT_PIE_SLICE_LABEL_COLOR,
          labelFontSize: defaultBarLabelFontSize(row),
          ...fill,
        });
        if (i < nSeg - 1) yCursor -= stackGap;
      }
    }
  } else {
    const catSlot = plotH / categoryCount;
    const barH = catSlot * (1 - catGap);

    for (let j = 0; j < categoryCount; j++) {
      const total = colTotals[j] ?? 0;
      const columnW =
        spec.stacked100 === true && total > 0
          ? plotW
          : (total / valueAxisMax) * plotW;

      const centerY = plotY0 + (j + 0.5) * catSlot;
      const topY = centerY - barH / 2;
      const gapTotal = nSeg > 1 ? stackGap * (nSeg - 1) : 0;
      const innerW = Math.max(0, columnW - gapTotal);

      if (total <= 0 || innerW <= 0) continue;

      let xCursor = plotX0;
      for (let i = 0; i < nSeg; i++) {
        const row = safeSeries[i];
        const v = valuesMatrix[i][j] ?? 0;
        if (v <= 0) continue;
        const frac = spec.stacked100 === true && total > 0 ? v / total : v / total;
        const w = frac * innerW;
        if (w <= 0) continue;
        const fill = resolveBarFill(row, i);
        rects.push({
          segmentIndex: i,
          categoryIndex: j,
          x: xCursor,
          y: topY,
          w,
          h: barH,
          value: v,
          name: (row.name ?? "").trim() || `Series ${i + 1}`,
          labelColor: row.labelColor?.trim() || DEFAULT_PIE_SLICE_LABEL_COLOR,
          labelFontSize: defaultBarLabelFontSize(row),
          ...fill,
        });
        xCursor += w;
        if (i < nSeg - 1) xCursor += stackGap;
      }
    }
  }

  return {
    rects,
    categoryCount,
    valueAxisMax,
    valueTicks,
    plot: { x0: plotX0, y0: plotY0, w: plotW, h: plotH },
    vertical,
    vbW,
    vbH,
  };
}

export function truncateBarLabel(name: string, maxLen = 10): string {
  const t = name.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, Math.max(1, maxLen - 1))}…`;
}

export interface BarLegendEntry {
  segmentIndex: number;
  name: string;
  fillMode: BarFillMode;
  solidFill: string;
  gradientColor1: string;
  gradientColor2: string;
}

/** One row per stack segment for the bottom legend (series order). */
export function barChartWantsRoundedColumnEnds(spec: NodeChartSpecBar): boolean {
  if (spec.roundedColumnEnds === true) return true;
  const legacy = (spec as { columnCornerRadius?: number }).columnCornerRadius;
  return typeof legacy === "number" && Number.isFinite(legacy) && legacy > 0;
}

/**
 * Radius for one column’s rounded cap from bar thickness and column depth (viewBox units).
 */
export function barColumnAutoRoundRadius(rectsInColumn: BarRect[], vertical: boolean): number {
  if (rectsInColumn.length === 0) return 0;
  let top = Infinity;
  let bottom = -Infinity;
  let left = Infinity;
  let right = -Infinity;
  for (const r of rectsInColumn) {
    top = Math.min(top, r.y);
    bottom = Math.max(bottom, r.y + r.h);
    left = Math.min(left, r.x);
    right = Math.max(right, r.x + r.w);
  }
  const colH = bottom - top;
  const colW = right - left;
  if (vertical) {
    const barW = rectsInColumn[0].w;
    return clampBarEndRoundRadius(barW, colH);
  }
  const barH = rectsInColumn[0].h;
  return clampBarEndRoundRadius(barH, colW);
}

function clampBarEndRoundRadius(barBreadth: number, columnDepth: number): number {
  if (!(barBreadth > 0) || !(columnDepth > 0)) return 0;
  const rReq = barBreadth * BAR_COLUMN_ROUND_BREADTH_RATIO;
  const cap = Math.min(barBreadth * 0.5, columnDepth * 0.5);
  return Math.max(0, Math.min(cap, rReq));
}

/**
 * Clip path for a vertical column: flat base, rounded top (stack reads as one column).
 * Corner curves use quadratic Beziers (stable under non-uniform SVG scaling).
 * Returns `null` if there is no area or radius clamps to zero.
 */
export function barColumnClipPathVertical(
  rectsInColumn: BarRect[],
  radiusRequest: number
): string | null {
  if (rectsInColumn.length === 0) return null;
  const x = rectsInColumn[0].x;
  const w = rectsInColumn[0].w;
  let top = Infinity;
  let bottom = -Infinity;
  for (const r of rectsInColumn) {
    top = Math.min(top, r.y);
    bottom = Math.max(bottom, r.y + r.h);
  }
  const h = bottom - top;
  if (h <= 0 || w <= 0) return null;
  const r = Math.max(0, Math.min(radiusRequest, w / 2, h / 2));
  if (r <= 0) return null;
  return [
    `M ${x} ${bottom}`,
    `L ${x + w} ${bottom}`,
    `L ${x + w} ${top + r}`,
    `Q ${x + w} ${top} ${x + w - r} ${top}`,
    `L ${x + r} ${top}`,
    `Q ${x} ${top} ${x} ${top + r}`,
    `Z`,
  ].join(" ");
}

/**
 * Clip path for a horizontal column: flat left (value 0), rounded **right** cap.
 */
export function barColumnClipPathHorizontal(
  rectsInColumn: BarRect[],
  radiusRequest: number
): string | null {
  if (rectsInColumn.length === 0) return null;
  let left = Infinity;
  let right = -Infinity;
  let yTop = Infinity;
  let yBot = -Infinity;
  for (const r of rectsInColumn) {
    left = Math.min(left, r.x);
    right = Math.max(right, r.x + r.w);
    yTop = Math.min(yTop, r.y);
    yBot = Math.max(yBot, r.y + r.h);
  }
  const h = yBot - yTop;
  const wCol = right - left;
  if (h <= 0 || wCol <= 0) return null;
  const r = Math.max(0, Math.min(radiusRequest, h / 2, wCol / 2));
  if (r <= 0) return null;
  return [
    `M ${left} ${yTop}`,
    `L ${right - r} ${yTop}`,
    `Q ${right} ${yTop} ${right} ${yTop + r}`,
    `L ${right} ${yBot - r}`,
    `Q ${right} ${yBot} ${right - r} ${yBot}`,
    `L ${left} ${yBot}`,
    `Z`,
  ].join(" ");
}

export function barLegendEntries(spec: NodeChartSpecBar): BarLegendEntry[] {
  const seriesRaw = Array.isArray(spec.series) ? spec.series : [];
  if (seriesRaw.length === 0) return [];
  return seriesRaw.map((row, i) => {
    const fill = resolveBarFill(row, i);
    return {
      segmentIndex: i,
      name: (row.name ?? "").trim() || `Segment ${i + 1}`,
      ...fill,
    };
  });
}
