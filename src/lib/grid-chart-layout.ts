import {
  DEFAULT_PIE_SLICE_COLORS,
  DEFAULT_PIE_SLICE_LABEL_COLOR,
  newChartSliceId,
} from "@/lib/chart-node";
import { shiftHueOfColor } from "@/lib/color-shift";
import { readThemeMenuHueStepDegFromStorage } from "@/lib/theme-menu-hue-step";
import type { ChartGridCell, DiagramNodeData, NodeChartSpecGrid } from "@/lib/types";

export type GridCellFillMode = "none" | "solid" | "gradient";

export interface GridChartLayoutCell {
  row: number;
  col: number;
  /** Cell fill rect (inside slot, after gap). */
  x: number;
  y: number;
  w: number;
  h: number;
  fillMode: GridCellFillMode;
  solidFill: string;
  gradientColor1: string;
  gradientColor2: string;
  /** 0–1; used during play-mode slide lerp (fade none ↔ fill). Default 1. */
  fillOpacity?: number;
  text: string;
  labelColor: string;
}

export interface GridChartTrackBoundary {
  /** Boundary index: column `i` is between columns `i-1` and `i` (1 … cols-1). */
  index: number;
  x: number;
  y0: number;
  y1: number;
}

export interface GridChartRowBoundary {
  index: number;
  y: number;
  x0: number;
  x1: number;
}

export interface GridChartLayout {
  vbW: number;
  vbH: number;
  strokeWidth: number;
  cols: number;
  rows: number;
  body: { x: number; y: number; w: number; h: number; rx: number; ry: number };
  plot: { x: number; y: number; w: number; h: number };
  /** Slot edges in viewBox units (`length === cols + 1` / `rows + 1`). */
  columnEdges: number[];
  rowEdges: number[];
  title: { text: string; x: number; y: number; fontSize: number } | null;
  columnTitles: { text: string; x: number; y: number; fontSize: number; colIndex: number }[];
  rowTitles: { text: string; x: number; y: number; fontSize: number; rowIndex: number }[];
  cells: GridChartLayoutCell[];
  colBoundaries: GridChartTrackBoundary[];
  rowBoundaries: GridChartRowBoundary[];
  gridLines: { x1: number; y1: number; x2: number; y2: number }[];
  gridLineColor: string;
  axisColor: string;
  titleColor: string;
  /** Horizontal inset for the chart title band (same as plot edge `pad`). */
  titlePadX: number;
  /** Row/column handles outside the rounded body (when `structureChrome` build option). */
  structure?: GridChartStructureChrome;
}

export interface GridChartHandleRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GridChartStructureChrome {
  chromeLeft: number;
  chromeTop: number;
  chromeRight: number;
  chromeBottom: number;
  rowHandles: Array<{
    index: number;
    y0: number;
    y1: number;
    delete: { x: number; y: number; r: number };
    drag: GridChartHandleRect;
  }>;
  colHandles: Array<{
    index: number;
    x0: number;
    x1: number;
    delete: { x: number; y: number; r: number };
    drag: GridChartHandleRect;
  }>;
  addRow: GridChartHandleRect;
  addCol: GridChartHandleRect;
}

/** Gutter outside the rounded body (clears ~12px resize rails + ~24px corner knobs). */
const GRID_CHROME_LEFT = 52;
const GRID_CHROME_TOP = 56;
const GRID_CHROME_RIGHT = 44;
const GRID_CHROME_BOTTOM = 44;

const MIN_TRACK_WEIGHT = 0.06;
const TRACK_EDGE_HIT_PAD = 3;

const MIN_COLS = 1;
const MAX_COLS = 24;
const MIN_ROWS = 1;
const MAX_ROWS = 24;

function clampGridDim(n: number | undefined, fallback: number): number {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.round(n) : fallback;
  return Math.max(MIN_COLS, Math.min(MAX_COLS, v));
}

function clampRows(n: number | undefined, fallback: number): number {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.round(n) : fallback;
  return Math.max(MIN_ROWS, Math.min(MAX_ROWS, v));
}

function clampCellGap(g: number | undefined): number {
  if (g == null || !Number.isFinite(g)) return 0.1;
  return Math.max(0, Math.min(0.45, g));
}

export function gridChartHueStepDeg(
  chart: Pick<NodeChartSpecGrid, "themeHueStepDeg"> | undefined,
  fallbackDeg: number
): number {
  const v = chart?.themeHueStepDeg;
  if (typeof v === "number" && Number.isFinite(v)) {
    return Math.min(360, Math.max(1, Math.round(v)));
  }
  return fallbackDeg;
}

export type GridHueStepDirection = "row" | "column";

/** How `hue-step` / `theme-hue` cells chain when resolving colors (default: row). */
export function gridChartHueStepDirection(
  chart: Pick<NodeChartSpecGrid, "hueStepDirection"> | undefined
): GridHueStepDirection {
  return chart?.hueStepDirection === "column" ? "column" : "row";
}

/** Cell indices in fill-resolution order (storage remains row-major). */
export function gridCellResolveOrder(
  cols: number,
  rows: number,
  direction: GridHueStepDirection
): number[] {
  const c = Math.max(1, cols);
  const r = Math.max(1, rows);
  const order: number[] = [];
  if (direction === "column") {
    for (let col = 0; col < c; col++) {
      for (let row = 0; row < r; row++) {
        order.push(row * c + col);
      }
    }
  } else {
    for (let row = 0; row < r; row++) {
      for (let col = 0; col < c; col++) {
        order.push(row * c + col);
      }
    }
  }
  return order;
}

/** First cell in its row (`row` direction) or column (`column` direction) for hue-step resets. */
export function isGridHueStepTrackAnchor(
  index: number,
  cols: number,
  direction: GridHueStepDirection
): boolean {
  const c = Math.max(1, cols);
  const col = index % c;
  const row = Math.floor(index / c);
  return direction === "column" ? row === 0 : col === 0;
}

function gridHueStepTrackKey(
  index: number,
  cols: number,
  direction: GridHueStepDirection
): number {
  const c = Math.max(1, cols);
  return direction === "column" ? index % c : Math.floor(index / c);
}

/** Whether a stored cell row counts as filled for layout and paint. */
export function isGridCellFilled(cell: ChartGridCell | undefined): boolean {
  if (!cell) return false;
  if (cell.filled === false) return false;
  if (cell.fillStyle === "none") return false;
  return cell.filled === true || !!cell.fillStyle;
}

function resolveHueStepForChart(
  chart: Pick<NodeChartSpecGrid, "themeHueStepDeg"> | undefined,
  fallbackDeg: number
): number {
  return gridChartHueStepDeg(chart, fallbackDeg);
}

/** Resolved solid color of the last filled cell before `beforeIndex` in hue-step order. */
export function gridCellSolidBeforeIndex(
  cells: ChartGridCell[],
  beforeIndex: number,
  cols: number,
  rows: number,
  themeBase: string,
  hueStepDeg: number,
  chart?: Pick<
    NodeChartSpecGrid,
    "themeHueStepDeg" | "canvasPaintFill" | "paintFromPrevious" | "hueStepDirection"
  >,
  defaultCellFill?: string
): string {
  const hueStep = resolveHueStepForChart(chart, hueStepDeg);
  const chartPick = chart ?? {};
  const direction = gridChartHueStepDirection(chart);
  const order = gridCellResolveOrder(cols, rows, direction);
  const pos = order.indexOf(beforeIndex);
  const prior = pos < 0 ? [] : order.slice(0, pos);
  const trackPrevSolid = new Map<number, string>();
  const trackThemeRank = new Map<number, number>();
  let prevSolid = themeBase;
  for (const i of prior) {
    const raw = cells[i] ?? { filled: false };
    if (!isGridCellFilled(raw)) continue;
    const resolved = resolveCellFill(
      raw,
      i,
      prevSolid,
      themeBase,
      hueStep,
      chartPick,
      cols,
      rows,
      direction,
      trackPrevSolid,
      trackThemeRank,
      defaultCellFill
    );
    prevSolid = resolved.nextSolid;
  }
  return prevSolid;
}

/** Diagram `globalProperties` key for default filled-cell background (CSS color). */
export const GRID_CELL_FILL_GLOBAL_PROPERTY = "gridCellFill";

export type GridCanvasPaintFill =
  | "solid"
  | "gradient"
  | "none"
  | "hue-step"
  | "theme-hue"
  | "same"
  | "default";

/** Resolved in-cell label color (cell → chart default → node text → fallback). */
export function resolveGridCellLabelColor(
  cell: ChartGridCell | undefined,
  chart: Pick<NodeChartSpecGrid, "defaultCellLabelColor">,
  node: DiagramNodeData
): string {
  const fromCell = cell?.labelColor?.trim();
  if (fromCell) return fromCell;
  const fromChart = chart.defaultCellLabelColor?.trim();
  if (fromChart) return fromChart;
  const nodeAny = node as unknown as Record<string, unknown>;
  const fromNode = String(nodeAny.textColor ?? "").trim();
  if (fromNode) return fromNode;
  return DEFAULT_PIE_SLICE_LABEL_COLOR;
}

/** Last explicit `labelColor` before `beforeIndex` (row-major), else chart/node defaults. */
export function gridCellLabelColorBeforeIndex(
  cells: ChartGridCell[],
  beforeIndex: number,
  chart?: Pick<NodeChartSpecGrid, "defaultCellLabelColor">,
  nodeTextColor?: string
): string | undefined {
  for (let i = beforeIndex - 1; i >= 0; i--) {
    const lc = cells[i]?.labelColor?.trim();
    if (lc) return lc;
  }
  const chartDef = chart?.defaultCellLabelColor?.trim();
  if (chartDef) return chartDef;
  const node = nodeTextColor?.trim();
  if (node) return node;
  return undefined;
}

/** Color used for grid cells in default / global fill mode. */
export function resolveGridDefaultCellFill(
  effectiveGlobals?: Record<string, string>,
  fallback = DEFAULT_PIE_SLICE_COLORS[0],
  chartDefault?: string
): string {
  const fromChart = chartDefault?.trim();
  if (fromChart) return fromChart;
  const v = effectiveGlobals?.[GRID_CELL_FILL_GLOBAL_PROPERTY]?.trim();
  return v || fallback;
}

function cellHasExplicitFillStyle(cell: ChartGridCell): boolean {
  const fs = cell.fillStyle;
  if (
    fs === "solid" ||
    fs === "gradient" ||
    fs === "hue-step" ||
    fs === "theme-hue"
  ) {
    return true;
  }
  if ((cell.color ?? "").trim()) return true;
  const g = cell.gradientColors;
  return Array.isArray(g) && !!(g[0]?.trim() && g[1]?.trim());
}

/** Filled cell should use {@link resolveGridDefaultCellFill} instead of per-cell style. */
export function cellUsesGlobalDefaultFill(
  cell: ChartGridCell,
  chart: Pick<NodeChartSpecGrid, "canvasPaintFill" | "paintFromPrevious">
): boolean {
  if (!isGridCellFilled(cell)) return false;
  if (cell.fillStyle === "default") return true;
  if (resolveGridCanvasPaintFill(chart) !== "default") return false;
  return !cellHasExplicitFillStyle(cell);
}

/** @deprecated Use {@link resolveGridCanvasPaintFill}. */
export type GridPaintFromPrevious = "same" | "hue-step";

export function normalizeGridTrackWeights(
  len: number,
  weights: number[] | undefined
): number[] {
  const raw = Array.from({ length: len }, (_, i) => {
    const w = weights?.[i];
    return typeof w === "number" && Number.isFinite(w) && w > 0 ? w : 1;
  });
  const sum = raw.reduce((a, b) => a + b, 0);
  if (sum <= 0) return raw.map(() => 1 / len);
  return raw.map((w) => w / sum);
}

export function resizeGridTrackWeights(
  newLen: number,
  oldLen: number,
  weights: number[] | undefined
): number[] {
  if (newLen <= 0) return [];
  if (newLen === oldLen && weights?.length === newLen) {
    return weights.map((w) =>
      typeof w === "number" && Number.isFinite(w) && w > 0 ? w : 1
    );
  }
  return Array.from({ length: newLen }, () => 1);
}

function cumulativeSizes(
  plotOrigin: number,
  plotSize: number,
  fractions: number[]
): number[] {
  const edges = [plotOrigin];
  let x = plotOrigin;
  for (const f of fractions) {
    x += plotSize * f;
    edges.push(x);
  }
  return edges;
}

export function resolveGridCanvasPaintFill(
  chart: Pick<NodeChartSpecGrid, "canvasPaintFill" | "paintFromPrevious">
): GridCanvasPaintFill {
  const v = chart.canvasPaintFill;
  if (
    v === "solid" ||
    v === "gradient" ||
    v === "none" ||
    v === "hue-step" ||
    v === "theme-hue" ||
    v === "same" ||
    v === "default"
  ) {
    return v;
  }
  return chart.paintFromPrevious === "same" ? "same" : "hue-step";
}

export function gridCellCornerRx(w: number, h: number): number {
  return Math.min(Math.min(w, h) * 0.12, 3);
}

/** Clear cell paint; keeps id, text, and label colour. */
export function clearGridCellFillKeepingContent(
  current: ChartGridCell,
  id: string
): ChartGridCell {
  const cleared: ChartGridCell = { id, filled: false, fillStyle: "none" };
  if (current.text?.trim()) cleared.text = current.text.trim();
  if (current.richText?.length) cleared.richText = current.richText;
  if (current.labelColor?.trim()) cleared.labelColor = current.labelColor.trim();
  return cleared;
}

/**
 * Canvas click: empty cell → apply current {@link resolveGridCanvasPaintFill}; filled cell → clear fill only.
 */
export function nextGridCellAfterPaintClick(
  cell: ChartGridCell | undefined,
  cellIndex: number,
  cells: ChartGridCell[],
  chart: Pick<
    NodeChartSpecGrid,
    | "canvasPaintFill"
    | "paintFromPrevious"
    | "themeHueStepDeg"
    | "hueStepDirection"
    | "cols"
    | "rows"
    | "canvasPaintGradientColors"
    | "defaultCellLabelColor"
    | "defaultCellFill"
  >,
  themeBase: string,
  hueStepDeg: number,
  nodeTextColor?: string,
  /** Chart/global default fill for {@link resolveGridCanvasPaintFill} `solid` (from {@link resolveGridDefaultCellFill}). */
  resolvedDefaultCellFill?: string
): ChartGridCell {
  const current = cell ?? { filled: false };
  const id = current.id ?? newChartSliceId();

  if (isGridCellFilled(current)) {
    return clearGridCellFillKeepingContent(current, id);
  }

  const mode = resolveGridCanvasPaintFill(chart);
  if (mode === "none") {
    return clearGridCellFillKeepingContent(current, id);
  }

  const base: ChartGridCell = { id, filled: true };
  if (current.text?.trim()) base.text = current.text.trim();
  if (current.richText?.length) base.richText = current.richText;
  if (current.labelColor?.trim()) {
    base.labelColor = current.labelColor.trim();
  } else {
    const inherited = gridCellLabelColorBeforeIndex(
      cells,
      cellIndex,
      chart,
      nodeTextColor
    );
    if (inherited) base.labelColor = inherited;
  }

  if (mode === "default") {
    return { ...base, fillStyle: "default" };
  }

  const cols = Math.max(1, chart.cols ?? 4);
  const rows = Math.max(1, chart.rows ?? 4);
  const prevSolid = gridCellSolidBeforeIndex(
    cells,
    cellIndex,
    cols,
    rows,
    themeBase,
    hueStepDeg,
    chart
  );
  const fb = DEFAULT_PIE_SLICE_COLORS[cellIndex % DEFAULT_PIE_SLICE_COLORS.length];
  const hueStep = gridChartHueStepDeg(chart, hueStepDeg);

  if (mode === "solid") {
    const color =
      (resolvedDefaultCellFill ?? "").trim() ||
      resolveGridDefaultCellFill(
        undefined,
        DEFAULT_PIE_SLICE_COLORS[0],
        chart.defaultCellFill
      );
    return { ...base, fillStyle: "solid", color };
  }
  if (mode === "same") {
    return { ...base, fillStyle: "solid", color: prevSolid };
  }
  if (mode === "hue-step") {
    const direction = gridChartHueStepDirection(chart);
    if (isGridHueStepTrackAnchor(cellIndex, cols, direction)) {
      const color = themeBase.trim() || fb;
      return { ...base, fillStyle: "solid", color };
    }
    return { ...base, fillStyle: "hue-step" };
  }
  if (mode === "theme-hue") {
    return { ...base, fillStyle: "theme-hue" };
  }
  if (mode === "gradient") {
    const g = chart.canvasPaintGradientColors;
    const c1 = (g?.[0] ?? "").trim() || prevSolid || fb;
    const c2 =
      (g?.[1] ?? "").trim() ||
      shiftHueOfColor(c1, hueStep) ||
      shiftHueOfColor(prevSolid, hueStep) ||
      fb;
    return {
      ...base,
      fillStyle: "gradient",
      gradientColors: [c1, c2] as [string, string],
    };
  }

  return { ...base, fillStyle: "solid", color: prevSolid };
}

/** Drag internal column boundary; returns new raw column weights. */
export function adjustColumnWeightsAtPointer(
  weights: number[],
  boundaryIndex: number,
  pointerX: number,
  plotX: number,
  plotW: number
): number[] {
  const n = weights.length;
  if (boundaryIndex < 1 || boundaryIndex >= n || plotW <= 0) return weights.slice();
  const w = normalizeGridTrackWeights(n, weights);
  const left = boundaryIndex - 1;
  const right = boundaryIndex;
  const cumBefore = w.slice(0, left).reduce((a, b) => a + b, 0);
  const pairSum = w[left]! + w[right]!;
  const pairStartX = plotX + plotW * cumBefore;
  const pairW = plotW * pairSum;
  let leftFrac = pairW > 1e-6 ? (pointerX - pairStartX) / pairW : 0.5;
  const minFrac = Math.min(0.45, MIN_TRACK_WEIGHT / Math.max(pairSum, 1e-6));
  leftFrac = Math.max(minFrac, Math.min(1 - minFrac, leftFrac));
  const out = [...w];
  out[left] = pairSum * leftFrac;
  out[right] = pairSum * (1 - leftFrac);
  return out.map((x, i) => Math.max(MIN_TRACK_WEIGHT, x));
}

/** Drag internal row boundary; returns new raw row weights. */
export function adjustRowWeightsAtPointer(
  weights: number[],
  boundaryIndex: number,
  pointerY: number,
  plotY: number,
  plotH: number
): number[] {
  const n = weights.length;
  if (boundaryIndex < 1 || boundaryIndex >= n || plotH <= 0) return weights.slice();
  const w = normalizeGridTrackWeights(n, weights);
  const top = boundaryIndex - 1;
  const bottom = boundaryIndex;
  const cumBefore = w.slice(0, top).reduce((a, b) => a + b, 0);
  const pairSum = w[top]! + w[bottom]!;
  const pairStartY = plotY + plotH * cumBefore;
  const pairH = plotH * pairSum;
  let topFrac = pairH > 1e-6 ? (pointerY - pairStartY) / pairH : 0.5;
  const minFrac = Math.min(0.45, MIN_TRACK_WEIGHT / Math.max(pairSum, 1e-6));
  topFrac = Math.max(minFrac, Math.min(1 - minFrac, topFrac));
  const out = [...w];
  out[top] = pairSum * topFrac;
  out[bottom] = pairSum * (1 - topFrac);
  return out.map((x) => Math.max(MIN_TRACK_WEIGHT, x));
}

export { TRACK_EDGE_HIT_PAD };

function resolveCellFill(
  cell: ChartGridCell,
  index: number,
  prevSolid: string,
  themeBase: string,
  hueStep: number,
  chart: Pick<NodeChartSpecGrid, "canvasPaintFill" | "paintFromPrevious" | "hueStepDirection" | "cols">,
  cols: number,
  _rows: number,
  direction: GridHueStepDirection,
  trackPrevSolid: Map<number, string>,
  trackThemeRank: Map<number, number>,
  defaultCellFill?: string
): {
  fillMode: GridCellFillMode;
  solidFill: string;
  gradientColor1: string;
  gradientColor2: string;
  nextSolid: string;
} {
  const filled = cell.filled !== false && (cell.filled === true || !!cell.fillStyle);
  if (!filled) {
    return {
      fillMode: "none",
      solidFill: "transparent",
      gradientColor1: "",
      gradientColor2: "",
      nextSolid: prevSolid,
    };
  }

  const declared = cell.fillStyle;
  const g = cell.gradientColors;
  const hasGradPair = Array.isArray(g) && g.length >= 2 && g[0]?.trim() && g[1]?.trim();

  if (declared === "none") {
    return {
      fillMode: "none",
      solidFill: "transparent",
      gradientColor1: "",
      gradientColor2: "",
      nextSolid: prevSolid,
    };
  }

  const trackKey = gridHueStepTrackKey(index, cols, direction);

  if (cellUsesGlobalDefaultFill(cell, chart)) {
    const fallback = DEFAULT_PIE_SLICE_COLORS[index % DEFAULT_PIE_SLICE_COLORS.length];
    const solid =
      (defaultCellFill ?? "").trim() ||
      resolveGridDefaultCellFill(undefined, DEFAULT_PIE_SLICE_COLORS[0], undefined);
    trackPrevSolid.set(trackKey, solid);
    return {
      fillMode: "solid",
      solidFill: solid,
      gradientColor1: "",
      gradientColor2: "",
      nextSolid: solid,
    };
  }

  if (declared === "gradient" || (!declared && hasGradPair)) {
    const fb = DEFAULT_PIE_SLICE_COLORS[index % DEFAULT_PIE_SLICE_COLORS.length];
    const c1 = (g?.[0] ?? "").trim() || fb;
    const c2 = (g?.[1] ?? "").trim() || c1;
    return {
      fillMode: "gradient",
      solidFill: "",
      gradientColor1: c1,
      gradientColor2: c2,
      nextSolid: c1,
    };
  }

  const fallback = DEFAULT_PIE_SLICE_COLORS[index % DEFAULT_PIE_SLICE_COLORS.length];
  let solid = (cell.color ?? "").trim() || fallback;

  if (declared === "theme-hue") {
    const rank = trackThemeRank.get(trackKey) ?? 0;
    solid = shiftHueOfColor(themeBase, rank * hueStep);
    trackThemeRank.set(trackKey, rank + 1);
  } else if (declared === "hue-step") {
    if (isGridHueStepTrackAnchor(index, cols, direction)) {
      solid = themeBase.trim() || fallback;
    } else {
      const base = (trackPrevSolid.get(trackKey) ?? themeBase).trim() || themeBase;
      solid = shiftHueOfColor(base, hueStep);
    }
  }

  trackPrevSolid.set(trackKey, solid);

  return {
    fillMode: "solid",
    solidFill: solid,
    gradientColor1: "",
    gradientColor2: "",
    nextSolid: solid,
  };
}

/** Normalize `cells` length to `cols * rows`, preserving existing entries. */
export function normalizeGridChartCells(
  cells: ChartGridCell[] | undefined,
  cols: number,
  rows: number
): ChartGridCell[] {
  const n = cols * rows;
  const list = Array.isArray(cells) ? cells : [];
  const out: ChartGridCell[] = [];
  for (let i = 0; i < n; i++) {
    out.push(list[i] ? { ...list[i] } : { filled: false });
  }
  return out;
}

function reorderIndexList(len: number, from: number, to: number): number[] {
  const order = Array.from({ length: len }, (_, i) => i);
  if (from < 0 || from >= len || to < 0 || to >= len || from === to) return order;
  const [item] = order.splice(from, 1);
  order.splice(to, 0, item!);
  return order;
}

/** Which track (row or column) index contains this plot-space coordinate. */
export function gridTrackIndexAtPointer(
  pointer: number,
  edges: number[],
  count: number
): number {
  if (count <= 0) return 0;
  for (let i = 0; i < count; i++) {
    if (pointer >= edges[i]! && pointer < edges[i + 1]!) return i;
  }
  if (pointer < edges[0]!) return 0;
  return count - 1;
}

export function moveGridChartRow(
  chart: NodeChartSpecGrid,
  fromRow: number,
  toRow: number
): NodeChartSpecGrid {
  const cols = clampGridDim(chart.cols, 4);
  const rows = clampRows(chart.rows, 4);
  if (fromRow === toRow || fromRow < 0 || fromRow >= rows || toRow < 0 || toRow >= rows) {
    return chart;
  }
  const cells = normalizeGridChartCells(chart.cells, cols, rows);
  const rowOrder = reorderIndexList(rows, fromRow, toRow);
  const newCells: ChartGridCell[] = [];
  for (let r = 0; r < rows; r++) {
    const srcR = rowOrder[r]!;
    for (let c = 0; c < cols; c++) {
      newCells.push(cells[srcR * cols + c] ?? { filled: false });
    }
  }
  const rowTitles = chart.rowTitles?.length
    ? rowOrder.map((i) => chart.rowTitles![i] ?? "")
    : chart.rowTitles;
  const richRowTitles = chart.richRowTitles?.length
    ? rowOrder.map((i) => chart.richRowTitles![i])
    : chart.richRowTitles;
  const rowWeights = chart.rowWeights?.length
    ? rowOrder.map((i) => chart.rowWeights![i] ?? 1)
    : chart.rowWeights;
  return { ...chart, cols, rows, cells: newCells, rowTitles, richRowTitles, rowWeights };
}

export function moveGridChartColumn(
  chart: NodeChartSpecGrid,
  fromCol: number,
  toCol: number
): NodeChartSpecGrid {
  const cols = clampGridDim(chart.cols, 4);
  const rows = clampRows(chart.rows, 4);
  if (fromCol === toCol || fromCol < 0 || fromCol >= cols || toCol < 0 || toCol >= cols) {
    return chart;
  }
  const cells = normalizeGridChartCells(chart.cells, cols, rows);
  const colOrder = reorderIndexList(cols, fromCol, toCol);
  const newCells: ChartGridCell[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const srcC = colOrder[c]!;
      newCells.push(cells[r * cols + srcC] ?? { filled: false });
    }
  }
  const columnTitles = chart.columnTitles?.length
    ? colOrder.map((i) => chart.columnTitles![i] ?? "")
    : chart.columnTitles;
  const richColumnTitles = chart.richColumnTitles?.length
    ? colOrder.map((i) => chart.richColumnTitles![i])
    : chart.richColumnTitles;
  const columnWeights = chart.columnWeights?.length
    ? colOrder.map((i) => chart.columnWeights![i] ?? 1)
    : chart.columnWeights;
  return {
    ...chart,
    cols,
    rows,
    cells: newCells,
    columnTitles,
    richColumnTitles,
    columnWeights,
  };
}

export function deleteGridChartRowAt(
  chart: NodeChartSpecGrid,
  rowIndex: number
): NodeChartSpecGrid {
  const cols = clampGridDim(chart.cols, 4);
  const rows = clampRows(chart.rows, 4);
  if (rows <= 1 || rowIndex < 0 || rowIndex >= rows) return chart;
  const cells = normalizeGridChartCells(chart.cells, cols, rows);
  const nextCells: ChartGridCell[] = [];
  for (let r = 0; r < rows; r++) {
    if (r === rowIndex) continue;
    for (let c = 0; c < cols; c++) nextCells.push(cells[r * cols + c] ?? { filled: false });
  }
  const rowTitles = chart.rowTitles?.filter((_, i) => i !== rowIndex);
  const richRowTitles = chart.richRowTitles?.filter((_, i) => i !== rowIndex);
  const rowWeights = chart.rowWeights?.filter((_, i) => i !== rowIndex);
  return {
    ...chart,
    kind: "grid",
    cols,
    rows: rows - 1,
    cells: nextCells,
    rowTitles,
    richRowTitles,
    rowWeights: resizeGridTrackWeights(rows - 1, rows, rowWeights),
    columnWeights: resizeGridTrackWeights(cols, cols, chart.columnWeights),
  };
}

export function deleteGridChartColumnAt(
  chart: NodeChartSpecGrid,
  colIndex: number
): NodeChartSpecGrid {
  const cols = clampGridDim(chart.cols, 4);
  const rows = clampRows(chart.rows, 4);
  if (cols <= 1 || colIndex < 0 || colIndex >= cols) return chart;
  const cells = normalizeGridChartCells(chart.cells, cols, rows);
  const nextCells: ChartGridCell[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (c === colIndex) continue;
      nextCells.push(cells[r * cols + c] ?? { filled: false });
    }
  }
  const columnTitles = chart.columnTitles?.filter((_, i) => i !== colIndex);
  const richColumnTitles = chart.richColumnTitles?.filter((_, i) => i !== colIndex);
  const columnWeights = chart.columnWeights?.filter((_, i) => i !== colIndex);
  return {
    ...chart,
    kind: "grid",
    cols: cols - 1,
    rows,
    cells: nextCells,
    columnTitles,
    richColumnTitles,
    columnWeights: resizeGridTrackWeights(cols - 1, cols, columnWeights),
    rowWeights: resizeGridTrackWeights(rows, rows, chart.rowWeights),
  };
}

function spliceEmptyRow(
  cells: ChartGridCell[],
  cols: number,
  rows: number,
  atRow: number
): ChartGridCell[] {
  const out: ChartGridCell[] = [];
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (r === atRow) out.push({ filled: false, id: newChartSliceId() });
      else if (r < atRow) out.push(cells[r * cols + c] ?? { filled: false });
      else out.push(cells[(r - 1) * cols + c] ?? { filled: false });
    }
  }
  return out;
}

function spliceEmptyColumn(
  cells: ChartGridCell[],
  cols: number,
  rows: number,
  atCol: number
): ChartGridCell[] {
  const out: ChartGridCell[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c <= cols; c++) {
      if (c === atCol) out.push({ filled: false, id: newChartSliceId() });
      else if (c < atCol) out.push(cells[r * cols + c] ?? { filled: false });
      else out.push(cells[r * cols + (c - 1)] ?? { filled: false });
    }
  }
  return out;
}

export function insertGridChartRowAt(
  chart: NodeChartSpecGrid,
  atRow: number
): NodeChartSpecGrid {
  const cols = clampGridDim(chart.cols, 4);
  const rows = clampRows(chart.rows, 4);
  if (rows >= MAX_ROWS) return chart;
  const insertAt = Math.max(0, Math.min(rows, Math.round(atRow)));
  const cells = spliceEmptyRow(
    normalizeGridChartCells(chart.cells, cols, rows),
    cols,
    rows,
    insertAt
  );
  const rowTitles = [...(chart.rowTitles ?? [])];
  while (rowTitles.length < rows) rowTitles.push("");
  rowTitles.splice(insertAt, 0, "");
  const richRowTitles = [...(chart.richRowTitles ?? [])];
  while (richRowTitles.length < rows) richRowTitles.push(undefined);
  richRowTitles.splice(insertAt, 0, undefined);
  const rowWeights = chart.rowWeights?.length
    ? [...chart.rowWeights.slice(0, insertAt), 1, ...chart.rowWeights.slice(insertAt)]
    : chart.rowWeights;
  return {
    ...chart,
    kind: "grid",
    cols,
    rows: rows + 1,
    cells,
    rowTitles,
    richRowTitles,
    rowWeights: resizeGridTrackWeights(rows + 1, rows, rowWeights),
    columnWeights: resizeGridTrackWeights(cols, cols, chart.columnWeights),
  };
}

export function insertGridChartColumnAt(
  chart: NodeChartSpecGrid,
  atCol: number
): NodeChartSpecGrid {
  const cols = clampGridDim(chart.cols, 4);
  const rows = clampRows(chart.rows, 4);
  if (cols >= MAX_COLS) return chart;
  const insertAt = Math.max(0, Math.min(cols, Math.round(atCol)));
  const cells = spliceEmptyColumn(
    normalizeGridChartCells(chart.cells, cols, rows),
    cols,
    rows,
    insertAt
  );
  const columnTitles = [...(chart.columnTitles ?? [])];
  while (columnTitles.length < cols) columnTitles.push("");
  columnTitles.splice(insertAt, 0, "");
  const richColumnTitles = [...(chart.richColumnTitles ?? [])];
  while (richColumnTitles.length < cols) richColumnTitles.push(undefined);
  richColumnTitles.splice(insertAt, 0, undefined);
  const columnWeights = chart.columnWeights?.length
    ? [...chart.columnWeights.slice(0, insertAt), 1, ...chart.columnWeights.slice(insertAt)]
    : chart.columnWeights;
  return {
    ...chart,
    kind: "grid",
    cols: cols + 1,
    rows,
    cells,
    columnTitles,
    richColumnTitles,
    columnWeights: resizeGridTrackWeights(cols + 1, cols, columnWeights),
    rowWeights: resizeGridTrackWeights(rows, rows, chart.rowWeights),
  };
}

export function buildGridChartLayout(
  node: DiagramNodeData & { width?: number; height?: number },
  chart: NodeChartSpecGrid,
  options?: {
    hueStepDeg?: number;
    defaultCellFill?: string;
    structureChrome?: boolean;
  }
): GridChartLayout {
  const w = Math.max(40, node.width ?? 320);
  const h = Math.max(40, node.height ?? 260);
  const nodeAny = node as unknown as Record<string, unknown>;
  const borderStyle = (nodeAny.borderStyle as string) || "solid";
  const strokeWidth = borderStyle === "none" ? 0 : (parseInt(String(nodeAny.borderWidth ?? 2), 10) || 2);
  const half = strokeWidth / 2;
  const structureChrome = options?.structureChrome === true;
  const minDim = Math.min(w, h);
  const cornerRadius = Math.max(0, Math.min(1, (nodeAny.cornerRadius as number) ?? 0.2));
  const maxRadius = minDim / 2;
  const radius = cornerRadius * maxRadius;
  const rx = Math.min(radius, maxRadius);
  const ry = rx;

  const vbW = w + strokeWidth;
  const vbH = h + strokeWidth;

  const cols = clampGridDim(chart.cols, 4);
  const rows = clampRows(chart.rows, 4);
  const cellGap = clampCellGap(chart.cellGap);
  const cellsRaw = normalizeGridChartCells(chart.cells, cols, rows);

  const titleText = (chart.title ?? "").trim();
  const colTitles = (chart.columnTitles ?? []).map((t) => String(t ?? "").trim());
  const rowTitles = (chart.rowTitles ?? []).map((t) => String(t ?? "").trim());
  const hasColTitles = colTitles.some(Boolean);
  const hasRowTitles = rowTitles.some(Boolean);

  const titleBand = titleText ? Math.min(28, h * 0.14) : 0;
  const colTitleBand = hasColTitles ? Math.min(22, h * 0.1) : 0;
  const rowTitleBand = hasRowTitles ? Math.min(36, w * 0.14) : 0;
  const pad = Math.min(10, minDim * 0.04);

  const plotX = half + rowTitleBand + pad;
  const plotY = half + titleBand + colTitleBand + pad;
  const plotW = Math.max(8, w - rowTitleBand - pad * 2);
  const plotH = Math.max(8, h - titleBand - colTitleBand - pad * 2);

  const colFrac = normalizeGridTrackWeights(cols, chart.columnWeights);
  const rowFrac = normalizeGridTrackWeights(rows, chart.rowWeights);
  const colEdges = cumulativeSizes(plotX, plotW, colFrac);
  const rowEdges = cumulativeSizes(plotY, plotH, rowFrac);

  const themeBase =
    (nodeAny.backgroundColor as string)?.trim() ||
    DEFAULT_PIE_SLICE_COLORS[0];
  const hueStep =
    typeof chart.themeHueStepDeg === "number" && Number.isFinite(chart.themeHueStepDeg)
      ? Math.min(360, Math.max(1, Math.round(chart.themeHueStepDeg)))
      : options?.hueStepDeg ?? readThemeMenuHueStepDegFromStorage();

  const axisColor = chart.axisColor?.trim() || "#64748b";
  const titleColor = chart.titleColor?.trim() || axisColor;
  const gridLineColor = chart.gridLineColor?.trim() || "rgba(148,163,184,0.55)";

  let prevSolid = themeBase;
  const hueDirection = gridChartHueStepDirection(chart);
  const resolveOrder = gridCellResolveOrder(cols, rows, hueDirection);
  const trackPrevSolid = new Map<number, string>();
  const trackThemeRank = new Map<number, number>();
  const fillByIndex: Array<{
    fillMode: GridCellFillMode;
    solidFill: string;
    gradientColor1: string;
    gradientColor2: string;
  }> = [];

  for (const idx of resolveOrder) {
    const raw = cellsRaw[idx] ?? { filled: false };
    const resolved = resolveCellFill(
      raw,
      idx,
      prevSolid,
      themeBase,
      hueStep,
      chart,
      cols,
      rows,
      hueDirection,
      trackPrevSolid,
      trackThemeRank,
      options?.defaultCellFill
    );
    prevSolid = resolved.nextSolid;
    fillByIndex[idx] = {
      fillMode: resolved.fillMode,
      solidFill: resolved.solidFill,
      gradientColor1: resolved.gradientColor1,
      gradientColor2: resolved.gradientColor2,
    };
  }

  const layoutCells: GridChartLayoutCell[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const raw = cellsRaw[idx] ?? { filled: false };
      const fill = fillByIndex[idx] ?? {
        fillMode: "none" as GridCellFillMode,
        solidFill: "transparent",
        gradientColor1: "",
        gradientColor2: "",
      };
      const slotX0 = colEdges[c]!;
      const slotX1 = colEdges[c + 1]!;
      const slotY0 = rowEdges[r]!;
      const slotY1 = rowEdges[r + 1]!;
      const slotW = slotX1 - slotX0;
      const slotH = slotY1 - slotY0;
      const insetX = slotW * cellGap * 0.5;
      const insetY = slotH * cellGap * 0.5;
      const cellW = Math.max(1, slotW - insetX * 2);
      const cellH = Math.max(1, slotH - insetY * 2);

      layoutCells.push({
        row: r,
        col: c,
        x: slotX0 + insetX,
        y: slotY0 + insetY,
        w: cellW,
        h: cellH,
        fillMode: fill.fillMode,
        solidFill: fill.solidFill,
        gradientColor1: fill.gradientColor1,
        gradientColor2: fill.gradientColor2,
        text: (raw.text ?? "").trim(),
        labelColor: resolveGridCellLabelColor(raw, chart, node),
      });
    }
  }

  const minSlot = Math.min(
    plotW / Math.max(1, cols),
    plotH / Math.max(1, rows)
  );
  const axisFont = Math.min(14, Math.max(7, minSlot * 0.22));
  const titleFont = Math.min(16, Math.max(9, titleBand * 0.55 || 11));

  const title =
    titleText.length > 0
      ? {
          text: titleText,
          x: half + w / 2,
          y: half + titleBand * 0.55,
          fontSize: titleFont,
        }
      : null;

  const columnTitles: GridChartLayout["columnTitles"] = [];
  if (hasColTitles) {
    const bandY = half + titleBand + colTitleBand * 0.55;
    for (let c = 0; c < cols; c++) {
      const text = (colTitles[c] ?? "").trim();
      if (!text) continue;
      columnTitles.push({
        text,
        colIndex: c,
        x: (colEdges[c]! + colEdges[c + 1]!) / 2,
        y: bandY,
        fontSize: axisFont,
      });
    }
  }

  const rowTitlesOut: GridChartLayout["rowTitles"] = [];
  if (hasRowTitles) {
    const bandX = half + rowTitleBand * 0.5;
    for (let r = 0; r < rows; r++) {
      const text = (rowTitles[r] ?? "").trim();
      if (!text) continue;
      rowTitlesOut.push({
        text,
        rowIndex: r,
        x: bandX,
        y: (rowEdges[r]! + rowEdges[r + 1]!) / 2,
        fontSize: axisFont,
      });
    }
  }

  const gridLines: GridChartLayout["gridLines"] = [];
  if (chart.showGridLines !== false) {
    for (let c = 0; c <= cols; c++) {
      const x = colEdges[c]!;
      gridLines.push({ x1: x, y1: rowEdges[0]!, x2: x, y2: rowEdges[rows]! });
    }
    for (let r = 0; r <= rows; r++) {
      const y = rowEdges[r]!;
      gridLines.push({ x1: colEdges[0]!, y1: y, x2: colEdges[cols]!, y2: y });
    }
  }

  const colBoundaries: GridChartTrackBoundary[] = [];
  for (let i = 1; i < cols; i++) {
    const x = colEdges[i]!;
    colBoundaries.push({
      index: i,
      x,
      y0: rowEdges[0]!,
      y1: rowEdges[rows]!,
    });
  }

  const rowBoundaries: GridChartRowBoundary[] = [];
  for (let i = 1; i < rows; i++) {
    const y = rowEdges[i]!;
    rowBoundaries.push({
      index: i,
      y,
      x0: colEdges[0]!,
      x1: colEdges[cols]!,
    });
  }

  let structure: GridChartStructureChrome | undefined;
  if (structureChrome) {
    const bodyLeft = half;
    const bodyTop = half;
    const bodyRight = half + w;
    const bodyBottom = half + h;
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
        drag: {
          x: bodyLeft - 26,
          y: mid - bandH / 2,
          w: 12,
          h: bandH,
        },
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
        drag: {
          x: mid - bandW / 2,
          y: bodyTop - 28,
          w: bandW,
          h: 12,
        },
      };
    });
    const btn = 18;
    structure = {
      chromeLeft: GRID_CHROME_LEFT,
      chromeTop: GRID_CHROME_TOP,
      chromeRight: GRID_CHROME_RIGHT,
      chromeBottom: GRID_CHROME_BOTTOM,
      rowHandles,
      colHandles,
      addRow: {
        x: plotX + plotW / 2 - btn / 2,
        y: bodyBottom + 24,
        w: btn,
        h: btn,
      },
      addCol: {
        x: bodyRight + 24,
        y: plotY + plotH / 2 - btn / 2,
        w: btn,
        h: btn,
      },
    };
  }

  return {
    vbW,
    vbH,
    strokeWidth,
    cols,
    rows,
    body: { x: half, y: half, w, h, rx, ry },
    plot: { x: plotX, y: plotY, w: plotW, h: plotH },
    columnEdges: colEdges,
    rowEdges: rowEdges,
    title,
    columnTitles,
    rowTitles: rowTitlesOut,
    cells: layoutCells,
    colBoundaries,
    rowBoundaries,
    gridLines,
    gridLineColor,
    axisColor,
    titleColor,
    titlePadX: pad,
    structure,
  };
}
