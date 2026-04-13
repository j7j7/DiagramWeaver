import type { ChartBarSegmentItem, ChartSliceFillStyle, NodeChartSpecBar } from "@/lib/types";
import { DEFAULT_PIE_SLICE_COLORS, DEFAULT_PIE_SLICE_LABEL_COLOR } from "@/lib/chart-node";

/** Breadth fraction used for rounded column caps (matches “subtle” rounding on other shapes). */
const BAR_COLUMN_ROUND_BREADTH_RATIO = 0.22;

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
  categoryLabelFontSize: number;
  legendLabelFontSize: number;
  /** Wrapped lines per category column index (length `categoryCount`). */
  categoryLabelLines: string[][];
  /** Wrapped lines per legend entry (same order as `barLegendEntries`). */
  legendLabelLines: string[][];
}

export interface BarLegendEntry {
  segmentIndex: number;
  name: string;
  fillMode: BarFillMode;
  solidFill: string;
  gradientColor1: string;
  gradientColor2: string;
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

/** Average glyph width factor for Latin sans-serif in SVG user units (relative to `fontSize`). */
const BAR_LABEL_CHAR_WIDTH_EM = 0.55;
const BAR_LABEL_LINE_HEIGHT_EM = 1.15;

export function resolveBarCategoryLabelFontSize(spec: NodeChartSpecBar): number {
  const v = spec.categoryLabelFontSize;
  if (typeof v === "number" && Number.isFinite(v) && v > 0) {
    return Math.min(14, Math.max(2, v));
  }
  return 2.75;
}

export function resolveBarLegendLabelFontSize(spec: NodeChartSpecBar): number {
  const v = spec.legendLabelFontSize;
  if (typeof v === "number" && Number.isFinite(v) && v > 0) {
    return Math.min(14, Math.max(2, v));
  }
  return 2.7;
}

export function estimateBarLabelLineWidth(text: string, fontSize: number): number {
  if (!text || fontSize <= 0) return 0;
  return text.length * fontSize * BAR_LABEL_CHAR_WIDTH_EM;
}

/**
 * Word-wrap bar labels to a max width (viewBox units). Breaks on spaces; splits long tokens to fit.
 * With `maxLines`, extra lines collapse and the last kept line may end with an ellipsis.
 */
export function wrapBarLabelLines(
  raw: string,
  maxWidth: number,
  fontSize: number,
  maxLines?: number
): string[] {
  const t = raw.replace(/\s+/g, " ").trim();
  if (!t || maxWidth <= 0 || fontSize <= 0) return t ? [t] : [];

  const words = t.split(" ");
  const lines: string[] = [];
  let cur = "";

  const flushCur = () => {
    if (cur) lines.push(cur);
    cur = "";
  };

  const fits = (s: string) => estimateBarLabelLineWidth(s, fontSize) <= maxWidth;

  for (const w of words) {
    if (!w) continue;
    const tryLine = cur ? `${cur} ${w}` : w;
    if (fits(tryLine)) {
      cur = tryLine;
      continue;
    }
    if (cur) flushCur();
    if (fits(w)) {
      cur = w;
    } else {
      let rest = w;
      while (rest.length > 0) {
        let take = rest.length;
        while (take > 0 && !fits(rest.slice(0, take))) take--;
        if (take <= 0) take = 1;
        lines.push(rest.slice(0, take));
        rest = rest.slice(take);
      }
    }
  }
  flushCur();
  if (lines.length === 0) lines.push(t);

  if (maxLines != null && maxLines > 0 && lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1] ?? "";
    const ell = "…";
    while (last.length > 0 && !fits(last + ell)) {
      last = last.slice(0, -1);
    }
    kept[maxLines - 1] = last + ell;
    return kept;
  }
  return lines;
}

function computeBarLegendBandHeight(
  entries: BarLegendEntry[],
  plotW: number,
  fontSize: number
): number {
  if (entries.length === 0) return 0;
  const slotW = plotW / entries.length;
  const textMaxW = Math.max(2, slotW - 5);
  const lineH = fontSize * BAR_LABEL_LINE_HEIGHT_EM;
  let maxLines = 1;
  for (const en of entries) {
    const lines = wrapBarLabelLines(en.name, textMaxW, fontSize);
    maxLines = Math.max(maxLines, lines.length);
  }
  const swatchH = 3;
  const textBlock = maxLines * lineH;
  const rowH = Math.max(swatchH, textBlock);
  return rowH + 5;
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

type BarLayoutPack = {
  marginL: number;
  plotW: number;
  plotH: number;
  marginB: number;
  categoryBand: number;
  categoryLabelLines: string[][];
  legendLabelLines: string[][];
  /** Widest category label line (horizontal layout), for growing `marginL`. */
  widestCategoryLine: number;
};

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
  const catFont = resolveBarCategoryLabelFontSize(spec);
  const legFont = resolveBarLegendLabelFontSize(spec);
  const marginR = 8;
  const marginT = 8;
  const legendList = showLegend ? barLegendEntries(spec) : [];

  const categoryLabelForIndex = (j: number) => (labels[j] ?? "").trim();

  const finalizeLayout = (marginL: number): BarLayoutPack => {
    const plotW = vbW - marginL - marginR;
    const legendBand =
      legendList.length > 0 ? computeBarLegendBandHeight(legendList, plotW, legFont) : 0;

    let categoryBand = 0;
    const categoryLabelLines: string[][] = Array.from({ length: categoryCount }, () => []);

    if (vertical && hasCategoryText) {
      const catSlot = plotW / Math.max(1, categoryCount);
      const maxW = Math.max(2, catSlot - 1);
      let maxLineCount = 1;
      for (let j = 0; j < categoryCount; j++) {
        const lab = categoryLabelForIndex(j);
        if (!lab) continue;
        const lines = wrapBarLabelLines(lab, maxW, catFont);
        categoryLabelLines[j] = lines;
        maxLineCount = Math.max(maxLineCount, lines.length);
      }
      const lineH = catFont * BAR_LABEL_LINE_HEIGHT_EM;
      categoryBand = 2.5 + maxLineCount * lineH + 1.5;
    }

    const marginB = vertical
      ? 9 + categoryBand + legendBand
      : (showValueAxis ? 12 : 9) + legendBand;
    const plotH = vbH - marginT - marginB;

    let widestCategoryLine = 0;

    if (!vertical && hasCategoryText) {
      const catSlot = plotH / Math.max(1, categoryCount);
      const lineH = catFont * BAR_LABEL_LINE_HEIGHT_EM;
      const maxLinesPerCat = Math.max(1, Math.floor((catSlot * 0.88) / lineH));
      const maxLabelW = Math.max(4, marginL - 6);
      for (let j = 0; j < categoryCount; j++) {
        const lab = categoryLabelForIndex(j);
        if (!lab) continue;
        const lines = wrapBarLabelLines(lab, maxLabelW, catFont, maxLinesPerCat);
        categoryLabelLines[j] = lines;
        for (const ln of lines) {
          widestCategoryLine = Math.max(widestCategoryLine, estimateBarLabelLineWidth(ln, catFont));
        }
      }
    }

    const legendLabelLines = legendList.map((en) => {
      const slotW = plotW / Math.max(1, legendList.length);
      return wrapBarLabelLines(en.name, Math.max(2, slotW - 5), legFont);
    });

    return {
      marginL,
      plotW,
      plotH,
      marginB,
      categoryBand,
      categoryLabelLines,
      legendLabelLines,
      widestCategoryLine,
    };
  };

  let marginL = vertical ? (showValueAxis ? 15 : 9) : showCategoryLabels ? 18 : 10;
  let pack = finalizeLayout(marginL);
  if (!vertical && hasCategoryText) {
    const needL = Math.max(
      showCategoryLabels ? 18 : 10,
      pack.widestCategoryLine + 9
    );
    if (needL > marginL + 0.25) {
      marginL = needL;
      pack = finalizeLayout(marginL);
    }
  }

  const { plotW, plotH, categoryLabelLines, legendLabelLines } = pack;
  const plotX0 = pack.marginL;
  const plotY0 = marginT;

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
    categoryLabelFontSize: catFont,
    legendLabelFontSize: legFont,
    categoryLabelLines,
    legendLabelLines,
  };
}

export function truncateBarLabel(name: string, maxLen = 10): string {
  const t = name.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, Math.max(1, maxLen - 1))}…`;
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
