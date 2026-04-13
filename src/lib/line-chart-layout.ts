import type { ChartBarSegmentItem, NodeChartSpecLine } from "@/lib/types";
import { DEFAULT_PIE_SLICE_LABEL_COLOR } from "@/lib/chart-node";
import {
  BAR_LABEL_LINE_HEIGHT_EM,
  chartSegmentLegendEntries,
  computeBarLegendBandHeight,
  type BarLegendEntry,
  wrapBarLabelLines,
} from "@/lib/bar-chart-layout";

function resolveLineCategoryLabelFontSize(spec: NodeChartSpecLine): number {
  const v = spec.categoryLabelFontSize;
  if (typeof v === "number" && Number.isFinite(v) && v > 0) {
    return Math.min(14, Math.max(2, v));
  }
  return 2.75;
}

function resolveLineLegendLabelFontSize(spec: NodeChartSpecLine): number {
  const v = spec.legendLabelFontSize;
  if (typeof v === "number" && Number.isFinite(v) && v > 0) {
    return Math.min(14, Math.max(2, v));
  }
  return 2.7;
}

/** Min/max SVG viewBox stroke for line chart polylines (editor slider range). */
export const LINE_CHART_POLYLINE_STROKE_MIN = 0.25;
export const LINE_CHART_POLYLINE_STROKE_MAX = 4;

/** Legacy polyline width from node border width (before `lineStrokeWidth` on the chart spec). */
export function lineChartPolylineStrokeFallbackFromNodeBorder(nodeStrokeW: number): number {
  return nodeStrokeW > 0
    ? Math.min(2.85, Math.max(0.95, nodeStrokeW * 0.48))
    : 1.35;
}

/** When `spec.lineStrokeWidth` is set, use it (clamped); otherwise `fallbackFromNodeBorder`. */
export function resolveLineChartPolylineStrokeWidth(
  spec: NodeChartSpecLine,
  fallbackFromNodeBorder: number
): number {
  if (typeof spec.lineStrokeWidth === "number" && Number.isFinite(spec.lineStrokeWidth)) {
    return Math.min(
      LINE_CHART_POLYLINE_STROKE_MAX,
      Math.max(LINE_CHART_POLYLINE_STROKE_MIN, spec.lineStrokeWidth)
    );
  }
  return fallbackFromNodeBorder;
}

export interface LinePoint {
  categoryIndex: number;
  x: number;
  y: number;
  value: number;
}

export interface LineSeriesLayout {
  segmentIndex: number;
  name: string;
  labelColor: string;
  labelFontSize: number;
  points: LinePoint[];
  stroke: string;
  /** Solid hex/rgb for area gradient and dots */
  strokeRgb: string;
  fillMode: "none" | "solid" | "gradient";
  gradientColor1: string;
  gradientColor2: string;
}

export interface LineChartLayoutModel {
  series: LineSeriesLayout[];
  categoryCount: number;
  valueAxisMax: number;
  valueTicks: number[];
  plot: { x0: number; y0: number; w: number; h: number };
  baseY: number;
  vbW: number;
  vbH: number;
  categoryLabelFontSize: number;
  legendLabelFontSize: number;
  categoryLabelLines: string[][];
  legendLabelLines: string[][];
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

function defaultLineLabelFontSize(seriesItem: ChartBarSegmentItem | undefined): number {
  const v = seriesItem?.labelFontSize;
  if (typeof v === "number" && Number.isFinite(v) && v > 0) {
    return Math.min(14, Math.max(2, v));
  }
  return 3.25;
}

function strokeRgbForSeries(
  row: ChartBarSegmentItem,
  i: number,
  solidFill: string,
  g1: string,
  g2: string,
  fillMode: "none" | "solid" | "gradient"
): string {
  if (fillMode === "gradient" && g1.trim()) return g1.trim();
  if (fillMode === "solid" && solidFill.trim() && solidFill !== "transparent") return solidFill.trim();
  const c = (row.color ?? "").trim();
  if (c) return c;
  const palette = ["#3b82f6", "#22c55e", "#eab308", "#ef4444", "#a855f7", "#14b8a6"];
  return palette[i % palette.length];
}

/**
 * Vertical line chart layout (categories on X). Reuses bar chart margin/legend math.
 */
export function buildLineChartLayout(
  spec: NodeChartSpecLine,
  options?: { vbW?: number; vbH?: number }
): LineChartLayoutModel {
  const vbW = options?.vbW ?? 100;
  const vbH = options?.vbH ?? 68;
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

  const hasCategoryText = showCategoryLabels && labels.some((s) => (s ?? "").trim());
  const catFont = resolveLineCategoryLabelFontSize(spec);
  const legFont = resolveLineLegendLabelFontSize(spec);
  const marginR = 8;
  const marginT = 8;
  const legendList: BarLegendEntry[] =
    showLegend && seriesRaw.length > 0 ? chartSegmentLegendEntries(seriesRaw) : [];

  const categoryLabelForIndex = (j: number) => (labels[j] ?? "").trim();

  const finalizeLayout = (marginL: number) => {
    const plotW = vbW - marginL - marginR;
    const legendBand =
      legendList.length > 0 ? computeBarLegendBandHeight(legendList, plotW, legFont) : 0;

    let categoryBand = 0;
    const categoryLabelLines: string[][] = Array.from({ length: categoryCount }, () => []);

    if (hasCategoryText) {
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

    const verticalBelowPlot = legendList.length > 0 ? 5 : 9;
    const marginB = verticalBelowPlot + categoryBand + legendBand;
    const plotH = vbH - marginT - marginB;

    return {
      marginL,
      plotW,
      plotH,
      marginB,
      categoryBand,
      categoryLabelLines,
      legendLabelLines: legendList.map((en) => {
        const slotW = plotW / Math.max(1, legendList.length);
        return wrapBarLabelLines(en.name, Math.max(2, slotW - 5), legFont);
      }),
    };
  };

  let marginL = showValueAxis ? 15 : 9;
  let pack = finalizeLayout(marginL);

  const { plotW, plotH, categoryLabelLines, legendLabelLines } = pack;
  const plotX0 = pack.marginL;
  const plotY0 = marginT;

  const safeSeries: ChartBarSegmentItem[] =
    seriesRaw.length > 0
      ? seriesRaw
      : [{ id: undefined, name: "Series 1", values: Array(categoryCount).fill(0) }];

  const valuesMatrix = padSeriesValues(safeSeries, categoryCount);
  let flatMax = 0;
  for (const row of valuesMatrix) {
    for (const v of row) flatMax = Math.max(flatMax, v);
  }
  const valueAxisMax = Math.max(1e-9, flatMax, 1);
  const valueTicks = niceValueTicks(valueAxisMax, 4);

  const catSlot = plotW / Math.max(1, categoryCount);

  const seriesLayouts: LineSeriesLayout[] = [];

  for (let i = 0; i < safeSeries.length; i++) {
    const row = safeSeries[i];
    const declared = row.fillStyle;
    const g = row.gradientColors;
    const hasGradPair = Array.isArray(g) && g.length >= 2 && g[0]?.trim() && g[1]?.trim();

    let fillMode: "none" | "solid" | "gradient" = "solid";
    let solidFill = "";
    let gradientColor1 = "";
    let gradientColor2 = "";

    if (declared === "none") {
      fillMode = "none";
      solidFill = "transparent";
    } else if (declared === "gradient" || (!declared && hasGradPair)) {
      fillMode = "gradient";
      const palette = ["#3b82f6", "#22c55e", "#eab308", "#ef4444", "#a855f7", "#14b8a6"];
      gradientColor1 = (g?.[0] ?? "").trim() || palette[i % palette.length];
      gradientColor2 = (g?.[1] ?? "").trim() || gradientColor1;
    } else {
      const palette = ["#3b82f6", "#22c55e", "#eab308", "#ef4444", "#a855f7", "#14b8a6"];
      solidFill = (row.color ?? "").trim() || palette[i % palette.length];
    }

    const strokeRgb = strokeRgbForSeries(row, i, solidFill, gradientColor1, gradientColor2, fillMode);
    const stroke =
      fillMode === "none"
        ? strokeRgb
        : fillMode === "gradient"
          ? gradientColor1
          : solidFill;

    const points: LinePoint[] = [];
    for (let j = 0; j < categoryCount; j++) {
      const v = valuesMatrix[i][j] ?? 0;
      const cx = plotX0 + (j + 0.5) * catSlot;
      const y = plotY0 + plotH - (v / valueAxisMax) * plotH;
      points.push({ categoryIndex: j, x: cx, y, value: v });
    }

    seriesLayouts.push({
      segmentIndex: i,
      name: (row.name ?? "").trim() || `Series ${i + 1}`,
      labelColor: row.labelColor?.trim() || DEFAULT_PIE_SLICE_LABEL_COLOR,
      labelFontSize: defaultLineLabelFontSize(row),
      points,
      stroke,
      strokeRgb,
      fillMode,
      gradientColor1,
      gradientColor2,
    });
  }

  const baseY = plotY0 + plotH;

  return {
    series: seriesLayouts,
    categoryCount,
    valueAxisMax,
    valueTicks,
    plot: { x0: plotX0, y0: plotY0, w: plotW, h: plotH },
    baseY,
    vbW,
    vbH,
    categoryLabelFontSize: catFont,
    legendLabelFontSize: legFont,
    categoryLabelLines,
    legendLabelLines,
  };
}

/** Build SVG `d` for a polyline (M + L). */
export function linePathPolyline(points: LinePoint[]): string {
  if (points.length === 0) return "";
  const [p0, ...rest] = points;
  let d = `M ${p0.x} ${p0.y}`;
  for (const p of rest) {
    d += ` L ${p.x} ${p.y}`;
  }
  return d;
}

/**
 * Catmull-Rom to cubic Bezier path (open curve through points).
 */
export function linePathSmooth(points: LinePoint[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    const p = points[0];
    return `M ${p.x} ${p.y}`;
  }
  if (points.length === 2) {
    return linePathPolyline(points);
  }
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`;
  }
  return d;
}

/** Closed path: baseline, along the line (polyline or smooth), back along baseline. */
export function lineAreaClosedPath(points: LinePoint[], smooth: boolean, baseY: number): string {
  if (points.length === 0) return "";
  const first = points[0];
  const last = points[points.length - 1];
  const top = smooth ? linePathSmooth(points) : linePathPolyline(points);
  const tail = top.replace(/^M\s*[\d.-]+\s*[\d.-]+\s*/, "").trim();
  if (!tail) {
    return `M ${first.x} ${baseY} L ${first.x} ${first.y} L ${last.x} ${baseY} Z`;
  }
  return `M ${first.x} ${baseY} L ${first.x} ${first.y} ${tail} L ${last.x} ${baseY} Z`;
}
