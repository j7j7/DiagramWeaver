import type {
  DiagramNodeData,
  GanttChartBar,
  GanttChartRow,
  NodeChartSpecGantt,
  RichTextRun,
} from "@/lib/types";
import { getPlainTextFromRuns } from "@/lib/rich-text";
import { newChartSliceId } from "@/lib/grid-chart-layout";
import {
  normalizeGridTrackWeights,
  type GridChartHandleRect,
  type GridChartStructureChrome,
  type GridChartTrackBoundary,
  type GridChartRowBoundary,
} from "@/lib/grid-chart-layout";

export const GANTT_MIN_COLS = 1;
export const GANTT_MAX_COLS = 24;
export const GANTT_MIN_ROWS = 1;
export const GANTT_MAX_ROWS = 24;
export const GANTT_MIN_BAR_SPAN = 0.12;

export const GANTT_TASK_BAR_FILL = "#c5cdd4";
export const GANTT_TASK_BAR_BORDER = "#8b95a1";
export const GANTT_GATE_BAR_FILL = "#ffe4d6";
export const GANTT_GATE_BAR_BORDER = "#ff8c66";
export const GANTT_GATE_LABEL = "#e86a3d";
export const GANTT_PHASE_LABEL = "#9aa3b2";
export const GANTT_TASK_LABEL = "#2d333b";
export const GANTT_LABEL_CHIP_FILL = "#e8eaed";

const GRID_CHROME_LEFT = 52;
const GRID_CHROME_TOP = 56;
const GRID_CHROME_RIGHT = 44;
const GRID_CHROME_BOTTOM = 44;

export interface GanttLayoutBar {
  id: string;
  rowId: string;
  rowIndex: number;
  start: number;
  end: number;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  variant: "task" | "gate";
  fill: string;
  border: string;
  labelColor: string;
}

export interface GanttLayoutRow {
  index: number;
  id: string;
  kind: "phase" | "task";
  label: string;
  y0: number;
  y1: number;
  chip: { x: number; y: number; w: number; h: number } | null;
  chipFill: string;
  labelColor: string;
  fontSize: number;
}

export interface GanttChartLayout {
  vbW: number;
  vbH: number;
  strokeWidth: number;
  cols: number;
  rows: number;
  subdivisions: number;
  body: { x: number; y: number; w: number; h: number; rx: number; ry: number };
  plot: { x: number; y: number; w: number; h: number };
  labelCol: { x: number; y: number; w: number; h: number };
  columnEdges: number[];
  rowEdges: number[];
  title: { text: string; x: number; y: number; fontSize: number } | null;
  columnTitles: { text: string; x: number; y: number; fontSize: number; colIndex: number }[];
  layoutRows: GanttLayoutRow[];
  bars: GanttLayoutBar[];
  weekLines: { x1: number; y1: number; x2: number; y2: number }[];
  monthLines: { x1: number; y1: number; x2: number; y2: number }[];
  phaseSeps: { x1: number; y1: number; x2: number; y2: number }[];
  colBoundaries: GridChartTrackBoundary[];
  rowBoundaries: GridChartRowBoundary[];
  axisColor: string;
  titleColor: string;
  gridLineColor: string;
  titlePadX: number;
  requiredNodeHeight: number;
  legend: {
    y: number;
    h: number;
    fontSize: number;
    items: Array<{
      kind: "gate" | "task" | "phase";
      label: string;
      x: number;
      swatch: { x: number; y: number; w: number; h: number };
    }>;
  } | null;
  structure?: GridChartStructureChrome;
}

export const GANTT_TASK_FONT = 11;
export const GANTT_PHASE_FONT = 8;
export const GANTT_BAR_FONT = 10;

function ganttTextLineCount(
  plain: string,
  rich: RichTextRun[] | undefined,
  maxWidthPx: number,
  fontSize: number
): number {
  const text = (rich?.length ? getPlainTextFromRuns(rich) : plain).replace(/\r/g, "");
  if (!text.trim()) return 1;
  const avg = Math.max(4.5, fontSize * 0.56);
  const width = Math.max(12, maxWidthPx);
  let lines = 0;
  for (const para of text.split("\n")) {
    const chars = para.length;
    if (chars <= 0) {
      lines += 1;
      continue;
    }
    lines += Math.max(1, Math.ceil((chars * avg) / width));
  }
  return Math.max(1, lines);
}

function ganttPillHeight(lines: number, fontSize: number): number {
  const padY = Math.max(5, fontSize * 0.48);
  return padY * 2 + Math.max(1, lines) * fontSize * 1.28;
}

function allocateRowPixelHeights(plotH: number, mins: number[], weights: number[]): number[] {
  const n = mins.length;
  if (n === 0) return [];
  const wsum = weights.reduce((a, b) => a + b, 0) || n;
  const minSum = mins.reduce((a, b) => a + b, 0);
  if (minSum >= plotH - 0.5) return mins.map((m) => Math.max(18, m));
  const extra = plotH - minSum;
  return mins.map((m, i) => Math.max(18, m) + extra * ((weights[i] ?? 1) / wsum));
}

function clampInt(n: number | undefined, fallback: number, min: number, max: number): number {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.round(n) : fallback;
  return Math.max(min, Math.min(max, v));
}

function cumulativeSizes(origin: number, size: number, fractions: number[]): number[] {
  const edges = [origin];
  let x = origin;
  for (const f of fractions) {
    x += size * f;
    edges.push(x);
  }
  return edges;
}

export function clampGanttCols(n: number | undefined): number {
  return clampInt(n, 3, GANTT_MIN_COLS, GANTT_MAX_COLS);
}

export function clampGanttSubdivisions(n: number | undefined): number {
  return clampInt(n, 4, 1, 8);
}

export function normalizeGanttRows(rows: GanttChartRow[] | undefined): GanttChartRow[] {
  const list = Array.isArray(rows) ? rows.filter((r) => r && typeof r.id === "string") : [];
  if (list.length === 0) {
    return [{ id: newChartSliceId(), kind: "task", label: "Task" }];
  }
  return list.slice(0, GANTT_MAX_ROWS).map((r) => ({
    ...r,
    kind: r.kind === "phase" ? "phase" : "task",
    label: String(r.label ?? ""),
  }));
}

export function normalizeGanttBars(
  bars: GanttChartBar[] | undefined,
  rows: GanttChartRow[],
  cols: number
): GanttChartBar[] {
  const ids = new Set(rows.map((r) => r.id));
  const list = Array.isArray(bars) ? bars : [];
  const out: GanttChartBar[] = [];
  for (const bar of list) {
    if (!bar || typeof bar.id !== "string" || !ids.has(bar.rowId)) continue;
    const start = clampBarEdge(bar.start, cols);
    const end = clampBarEdge(bar.end, cols);
    const lo = Math.min(start, end);
    const hi = Math.max(start, end);
    out.push({
      ...bar,
      variant: bar.variant === "gate" ? "gate" : "task",
      start: lo,
      end: Math.max(lo + GANTT_MIN_BAR_SPAN, hi),
    });
  }
  return out;
}

export function clampBarEdge(v: number | undefined, cols: number): number {
  const n = typeof v === "number" && Number.isFinite(v) ? v : 0;
  return Math.max(0, Math.min(cols, n));
}

export function snapGanttColumnUnit(u: number, subdivisions: number, cols: number): number {
  const step = 1 / Math.max(1, subdivisions);
  return Math.max(0, Math.min(cols, Math.round(u / step) * step));
}

export function plotXToColumnUnits(x: number, columnEdges: number[], cols: number): number {
  if (cols <= 0) return 0;
  const x0 = columnEdges[0]!;
  const x1 = columnEdges[cols]!;
  if (x <= x0) return 0;
  if (x >= x1) return cols;
  for (let i = 0; i < cols; i++) {
    const a = columnEdges[i]!;
    const b = columnEdges[i + 1]!;
    if (x < b || i === cols - 1) {
      const t = b === a ? 0 : (x - a) / (b - a);
      return i + Math.max(0, Math.min(1, t));
    }
  }
  return cols;
}

export function columnUnitsToPlotX(u: number, columnEdges: number[], cols: number): number {
  const clamped = Math.max(0, Math.min(cols, u));
  if (clamped >= cols) return columnEdges[cols]!;
  const i = Math.min(cols - 1, Math.floor(clamped));
  const frac = clamped - i;
  const a = columnEdges[i]!;
  const b = columnEdges[i + 1]!;
  return a + (b - a) * frac;
}

function buildStructureChrome(
  rows: number,
  cols: number,
  rowEdges: number[],
  colEdges: number[],
  plotX: number,
  plotY: number,
  plotW: number,
  plotH: number,
  bodyLeft: number,
  bodyTop: number,
  bodyRight: number,
  bodyBottom: number
): GridChartStructureChrome {
  const rowHandles = Array.from({ length: rows }, (_, r) => {
    const y0 = rowEdges[r]!;
    const y1 = rowEdges[r + 1]!;
    const mid = (y0 + y1) / 2;
    const bandH = Math.max(12, Math.min(22, y1 - y0 - 2));
    return {
      index: r,
      y0,
      y1,
      delete: { x: bodyLeft - GRID_CHROME_LEFT + 12, y: mid, r: 7 },
      drag: { x: bodyLeft - 26, y: mid - bandH / 2, w: 12, h: bandH } satisfies GridChartHandleRect,
    };
  });
  const colHandles = Array.from({ length: cols }, (_, c) => {
    const x0 = colEdges[c]!;
    const x1 = colEdges[c + 1]!;
    const mid = (x0 + x1) / 2;
    const bandW = Math.max(12, Math.min(22, x1 - x0 - 2));
    return {
      index: c,
      x0,
      x1,
      delete: { x: mid, y: bodyTop - GRID_CHROME_TOP + 14, r: 7 },
      drag: { x: mid - bandW / 2, y: bodyTop - 28, w: bandW, h: 12 } satisfies GridChartHandleRect,
    };
  });
  const btn = 18;
  return {
    chromeLeft: GRID_CHROME_LEFT,
    chromeTop: GRID_CHROME_TOP,
    chromeRight: GRID_CHROME_RIGHT,
    chromeBottom: GRID_CHROME_BOTTOM,
    rowHandles,
    colHandles,
    addRow: { x: plotX + plotW / 2 - btn / 2, y: bodyBottom + 24, w: btn, h: btn },
    addCol: { x: bodyRight + 24, y: plotY + plotH / 2 - btn / 2, w: btn, h: btn },
  };
}

export function buildGanttChartLayout(
  node: DiagramNodeData & { width?: number; height?: number },
  chart: NodeChartSpecGantt,
  options?: { structureChrome?: boolean }
): GanttChartLayout {
  const w = Math.max(40, node.width ?? 640);
  const h = Math.max(40, node.height ?? 400);
  const nodeAny = node as unknown as Record<string, unknown>;
  const borderStyle = (nodeAny.borderStyle as string) || "solid";
  const strokeWidth = borderStyle === "none" ? 0 : parseInt(String(nodeAny.borderWidth ?? 1), 10) || 1;
  const half = strokeWidth / 2;
  const minDim = Math.min(w, h);
  const cornerRadius = Math.max(0, Math.min(1, (nodeAny.cornerRadius as number) ?? 0.08));
  const radius = cornerRadius * (minDim / 2);
  const rx = Math.min(radius, minDim / 2);
  const ry = rx;
  const rowsIn = normalizeGanttRows(chart.rows);
  const cols = clampGanttCols(chart.cols);
  const subdivisions = clampGanttSubdivisions(chart.subdivisions);
  const titleText = (chart.title ?? "").trim();
  const colTitles = (chart.columnTitles ?? []).map((t) => String(t ?? "").trim());
  const hasColTitles = colTitles.some(Boolean);
  const showLegend = chart.showLegend !== false;
  const pad = Math.min(12, minDim * 0.035);
  const titleBand = titleText ? Math.min(26, h * 0.1) : 0;
  const colTitleBand = hasColTitles ? Math.min(22, h * 0.08) : 8;
  const legendBand = showLegend ? Math.min(36, h * 0.1) : 0;
  const labelW = Math.max(96, Math.min(188, w * 0.28));
  const plotX = half + labelW + pad;
  const plotY = half + titleBand + colTitleBand + pad * 0.6;
  const plotW = Math.max(8, w - labelW - pad * 2);
  const plotH = Math.max(8, h - titleBand - colTitleBand - legendBand - pad * 1.6);
  const rowCount = rowsIn.length;
  const colFrac = normalizeGridTrackWeights(cols, chart.columnWeights);
  const colEdges = cumulativeSizes(plotX, plotW, colFrac);
  const defaultWeights = rowsIn.map((r) => (r.kind === "phase" ? 0.55 : 1));
  const rowFrac = normalizeGridTrackWeights(
    rowCount,
    chart.rowWeights?.length === rowCount ? chart.rowWeights : defaultWeights
  );
  const chipW = Math.max(40, labelW - pad * 1.4);
  const chipTextW = Math.max(24, chipW - 14);
  const vPad = 8;
  const barsIn = normalizeGanttBars(chart.bars, rowsIn, cols);
  const minRowHs = rowsIn.map((row) => {
    const fontSize = row.kind === "phase" ? GANTT_PHASE_FONT : GANTT_TASK_FONT;
    const headingLines = ganttTextLineCount(row.label, row.richLabel, chipTextW, fontSize);
    let minH = ganttPillHeight(headingLines, fontSize) + vPad;
    for (const bar of barsIn) {
      if (bar.rowId !== row.id) continue;
      const x0 = columnUnitsToPlotX(bar.start, colEdges, cols);
      const x1 = columnUnitsToPlotX(bar.end, colEdges, cols);
      const barW = Math.max(8, Math.abs(x1 - x0));
      const lines = ganttTextLineCount(bar.label ?? "", bar.richLabel, Math.max(12, barW - 12), GANTT_BAR_FONT);
      minH = Math.max(minH, ganttPillHeight(lines, GANTT_BAR_FONT) + vPad);
    }
    return Math.max(row.kind === "phase" ? 20 : 26, minH);
  });
  const chromeH = (titleText ? 26 : 0) + (hasColTitles ? 22 : 8) + (showLegend ? 36 : 0) + Math.min(12, w * 0.035) * 1.6;
  const requiredNodeHeight = Math.max(40, minRowHs.reduce((a, b) => a + b, 0) + chromeH);
  const rowPx = allocateRowPixelHeights(plotH, minRowHs, rowFrac);
  const rowEdges = [plotY];
  {
    let y = plotY;
    for (const rh of rowPx) {
      y += rh;
      rowEdges.push(y);
    }
  }
  const axisColor = chart.axisColor?.trim() || "#64748b";
  const titleColor = chart.titleColor?.trim() || "#4b5563";
  const gridLineColor = chart.gridLineColor?.trim() || "rgba(148,163,184,0.45)";
  const phaseColor = chart.phaseLabelColor?.trim() || GANTT_PHASE_LABEL;
  const taskLabelColor = chart.taskLabelColor?.trim() || GANTT_TASK_LABEL;
  const defaultChipFill = chart.taskChipFill?.trim() || GANTT_LABEL_CHIP_FILL;
  const taskFill = chart.taskBarFill?.trim() || GANTT_TASK_BAR_FILL;
  const taskBorder = chart.taskBarBorder?.trim() || GANTT_TASK_BAR_BORDER;
  const gateFill = chart.gateBarFill?.trim() || GANTT_GATE_BAR_FILL;
  const gateBorder = chart.gateBarBorder?.trim() || GANTT_GATE_BAR_BORDER;
  const gateLabel = chart.gateLabelColor?.trim() || GANTT_GATE_LABEL;
  const axisFont = Math.min(13, Math.max(8, Math.min(plotW / cols, 22) * 0.42));
  const titleFont = Math.min(15, Math.max(9, titleBand * 0.5 || 11));

  const layoutRows: GanttLayoutRow[] = rowsIn.map((row, index) => {
    const y0 = rowEdges[index]!;
    const y1 = rowEdges[index + 1]!;
    const rowH = y1 - y0;
    const fontSize = row.kind === "phase" ? GANTT_PHASE_FONT : GANTT_TASK_FONT;
    const headingLines = ganttTextLineCount(row.label, row.richLabel, chipTextW, fontSize);
    const pillH = ganttPillHeight(headingLines, fontSize);
    const chipH = Math.max(16, Math.min(rowH - 4, pillH));
    const chipY = y0 + (rowH - chipH) / 2;
    const chipFill = row.chipFill?.trim() || (row.kind === "task" ? defaultChipFill : "");
    return {
      index,
      id: row.id,
      kind: row.kind,
      label: row.label,
      y0,
      y1,
      chip:
        row.kind === "task" || chipFill
          ? { x: half + pad * 0.7, y: chipY, w: chipW, h: chipH }
          : null,
      chipFill: chipFill || defaultChipFill,
      labelColor:
        row.labelColor?.trim() ||
        (row.kind === "phase" ? phaseColor : taskLabelColor),
      fontSize,
    };
  });

  const rowById = new Map(layoutRows.map((r) => [r.id, r]));
  const bars: GanttLayoutBar[] = [];
  for (const bar of barsIn) {
    const row = rowById.get(bar.rowId);
    if (!row || row.kind !== "task") continue;
    const x0 = columnUnitsToPlotX(bar.start, colEdges, cols);
    const x1 = columnUnitsToPlotX(bar.end, colEdges, cols);
    const rowH = row.y1 - row.y0;
    const barW = Math.max(8, Math.abs(x1 - x0));
    const lines = ganttTextLineCount(bar.label ?? "", bar.richLabel, Math.max(12, barW - 12), GANTT_BAR_FONT);
    const barH = Math.max(12, Math.min(rowH - 4, ganttPillHeight(lines, GANTT_BAR_FONT)));
    const isGate = bar.variant === "gate";
    bars.push({
      id: bar.id,
      rowId: bar.rowId,
      rowIndex: row.index,
      start: bar.start,
      end: bar.end,
      x: Math.min(x0, x1),
      y: row.y0 + (rowH - barH) / 2,
      w: barW,
      h: barH,
      label: (bar.label ?? "").trim(),
      variant: isGate ? "gate" : "task",
      fill: bar.fill?.trim() || (isGate ? gateFill : taskFill),
      border: bar.border?.trim() || (isGate ? gateBorder : taskBorder),
      labelColor: bar.labelColor?.trim() || (isGate ? gateLabel : axisColor),
    });
  }

  const weekLines: GanttChartLayout["weekLines"] = [];
  const monthLines: GanttChartLayout["monthLines"] = [];
  if (chart.showGridLines !== false) {
    for (let c = 0; c < cols; c++) {
      const a = colEdges[c]!;
      const b = colEdges[c + 1]!;
      monthLines.push({ x1: a, y1: plotY, x2: a, y2: plotY + plotH });
      for (let s = 1; s < subdivisions; s++) {
        const x = a + ((b - a) * s) / subdivisions;
        weekLines.push({ x1: x, y1: plotY, x2: x, y2: plotY + plotH });
      }
    }
    monthLines.push({
      x1: colEdges[cols]!,
      y1: plotY,
      x2: colEdges[cols]!,
      y2: plotY + plotH,
    });
  }

  const phaseSeps: GanttChartLayout["phaseSeps"] = [];
  for (let i = 1; i < rowCount; i++) {
    if (rowsIn[i]?.kind === "phase" || rowsIn[i - 1]?.kind === "phase") {
      const y = rowEdges[i]!;
      phaseSeps.push({
        x1: half + pad * 0.5,
        y1: y,
        x2: half + w - pad * 0.5,
        y2: y,
      });
    }
  }

  const columnTitles = hasColTitles
    ? colTitles.map((text, colIndex) => ({
        text,
        colIndex,
        x: ((colEdges[colIndex] ?? plotX) + (colEdges[colIndex + 1] ?? plotX + plotW)) / 2,
        y: half + titleBand + colTitleBand * 0.55,
        fontSize: axisFont,
      }))
    : [];

  const title =
    titleText.length > 0
      ? {
          text: titleText,
          x: half + w / 2,
          y: half + titleBand * 0.62,
          fontSize: titleFont,
        }
      : null;

  let legend: GanttChartLayout["legend"] = null;
  if (showLegend) {
    const y = half + h - legendBand + 4;
    const fontSize = Math.min(10, Math.max(7, legendBand * 0.32));
    const sw = 22;
    const sh = 10;
    const gap = 18;
    const startX = half + pad;
    const items: NonNullable<GanttChartLayout["legend"]>["items"] = [
      {
        kind: "gate",
        label: chart.legendGateLabel?.trim() || "Design review - critical gate",
        x: startX,
        swatch: { x: startX, y: y + 2, w: sw, h: sh },
      },
      {
        kind: "task",
        label: chart.legendTaskLabel?.trim() || "Task",
        x: startX + 168,
        swatch: { x: startX + 168, y: y + 2, w: sw, h: sh },
      },
      {
        kind: "phase",
        label: chart.legendPhaseLabel?.trim() || "Phase",
        x: startX + 248,
        swatch: { x: startX + 248, y: y + 2, w: sw, h: sh },
      },
    ];
    void gap;
    legend = { y, h: legendBand, fontSize, items };
  }

  const colBoundaries: GridChartTrackBoundary[] = [];
  for (let i = 1; i < cols; i++) {
    colBoundaries.push({ index: i, x: colEdges[i]!, y0: plotY, y1: plotY + plotH });
  }
  const rowBoundaries: GridChartRowBoundary[] = [];
  for (let i = 1; i < rowCount; i++) {
    rowBoundaries.push({
      index: i,
      y: rowEdges[i]!,
      x0: plotX,
      x1: plotX + plotW,
    });
  }

  const structure = options?.structureChrome
    ? buildStructureChrome(
        rowCount,
        cols,
        rowEdges,
        colEdges,
        plotX,
        plotY,
        plotW,
        plotH,
        half,
        half,
        half + w,
        half + h
      )
    : undefined;

  return {
    vbW: w + strokeWidth,
    vbH: h + strokeWidth,
    strokeWidth,
    cols,
    rows: rowCount,
    subdivisions,
    body: { x: half, y: half, w, h, rx, ry },
    plot: { x: plotX, y: plotY, w: plotW, h: plotH },
    labelCol: { x: half, y: plotY, w: labelW, h: plotH },
    columnEdges: colEdges,
    rowEdges,
    title,
    columnTitles,
    layoutRows,
    bars,
    weekLines,
    monthLines,
    phaseSeps,
    colBoundaries,
    rowBoundaries,
    axisColor,
    titleColor,
    gridLineColor,
    titlePadX: pad,
    requiredNodeHeight,
    legend,
    structure,
  };
}
