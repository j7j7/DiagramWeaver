import {
  DEFAULT_PIE_SLICE_COLORS,
  DEFAULT_PIE_SLICE_LABEL_COLOR,
} from "@/lib/chart-node";
import { shiftHueOfColor } from "@/lib/color-shift";
import { readThemeMenuHueStepDegFromStorage } from "@/lib/theme-menu-hue-step";
import type { ChartGridCell, DiagramNodeData, NodeChartSpecGrid } from "@/lib/types";

export type GridCellFillMode = "none" | "solid" | "gradient";

export interface GridChartLayoutCell {
  row: number;
  col: number;
  x: number;
  y: number;
  size: number;
  fillMode: GridCellFillMode;
  solidFill: string;
  gradientColor1: string;
  gradientColor2: string;
  text: string;
  labelColor: string;
}

export interface GridChartLayout {
  vbW: number;
  vbH: number;
  strokeWidth: number;
  body: { x: number; y: number; w: number; h: number; rx: number; ry: number };
  title: { text: string; x: number; y: number; fontSize: number } | null;
  columnTitles: { text: string; x: number; y: number; fontSize: number }[];
  rowTitles: { text: string; x: number; y: number; fontSize: number }[];
  cells: GridChartLayoutCell[];
  gridLines: { x1: number; y1: number; x2: number; y2: number }[];
  gridLineColor: string;
  axisColor: string;
  titleColor: string;
}

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

function resolveCellFill(
  cell: ChartGridCell,
  index: number,
  prevSolid: string,
  themeBase: string,
  hueStep: number,
  themeHueRank: number
): {
  fillMode: GridCellFillMode;
  solidFill: string;
  gradientColor1: string;
  gradientColor2: string;
  nextSolid: string;
  nextThemeRank: number;
} {
  const filled = cell.filled !== false && (cell.filled === true || !!cell.fillStyle);
  if (!filled) {
    return {
      fillMode: "none",
      solidFill: "transparent",
      gradientColor1: "",
      gradientColor2: "",
      nextSolid: prevSolid,
      nextThemeRank: themeHueRank,
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
      nextThemeRank: themeHueRank,
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
      nextThemeRank: themeHueRank + 1,
    };
  }

  const fallback = DEFAULT_PIE_SLICE_COLORS[index % DEFAULT_PIE_SLICE_COLORS.length];
  let solid = (cell.color ?? "").trim() || fallback;

  if (declared === "theme-hue") {
    solid = shiftHueOfColor(themeBase, themeHueRank * hueStep);
  } else if (declared === "hue-step") {
    const base = prevSolid.trim() || themeBase;
    solid = shiftHueOfColor(base, hueStep);
  }

  return {
    fillMode: "solid",
    solidFill: solid,
    gradientColor1: "",
    gradientColor2: "",
    nextSolid: solid,
    nextThemeRank: themeHueRank + 1,
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

export function buildGridChartLayout(
  node: DiagramNodeData & { width?: number; height?: number },
  chart: NodeChartSpecGrid,
  options?: { hueStepDeg?: number }
): GridChartLayout {
  const w = Math.max(40, node.width ?? 320);
  const h = Math.max(40, node.height ?? 260);
  const nodeAny = node as unknown as Record<string, unknown>;
  const borderStyle = (nodeAny.borderStyle as string) || "solid";
  const strokeWidth = borderStyle === "none" ? 0 : (parseInt(String(nodeAny.borderWidth ?? 2), 10) || 2);
  const half = strokeWidth / 2;
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

  const slotW = plotW / cols;
  const slotH = plotH / rows;
  const cellSize = Math.min(slotW, slotH);
  const gridW = cellSize * cols;
  const gridH = cellSize * rows;
  const originX = plotX + (plotW - gridW) / 2;
  const originY = plotY + (plotH - gridH) / 2;
  const inset = cellSize * cellGap * 0.5;
  const drawSize = Math.max(1, cellSize - inset * 2);

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
  let themeRank = 0;
  const layoutCells: GridChartLayoutCell[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const raw = cellsRaw[idx] ?? { filled: false };
      const resolved = resolveCellFill(raw, idx, prevSolid, themeBase, hueStep, themeRank);
      prevSolid = resolved.nextSolid;
      themeRank = resolved.nextThemeRank;

      layoutCells.push({
        row: r,
        col: c,
        x: originX + c * cellSize + inset,
        y: originY + r * cellSize + inset,
        size: drawSize,
        fillMode: resolved.fillMode,
        solidFill: resolved.solidFill,
        gradientColor1: resolved.gradientColor1,
        gradientColor2: resolved.gradientColor2,
        text: (raw.text ?? "").trim(),
        labelColor: raw.labelColor?.trim() || DEFAULT_PIE_SLICE_LABEL_COLOR,
      });
    }
  }

  const axisFont = Math.min(14, Math.max(7, cellSize * 0.22));
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
        x: originX + c * cellSize + cellSize / 2,
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
        x: bandX,
        y: originY + r * cellSize + cellSize / 2,
        fontSize: axisFont,
      });
    }
  }

  const gridLines: GridChartLayout["gridLines"] = [];
  if (chart.showGridLines !== false) {
    for (let c = 0; c <= cols; c++) {
      const x = originX + c * cellSize;
      gridLines.push({ x1: x, y1: originY, x2: x, y2: originY + gridH });
    }
    for (let r = 0; r <= rows; r++) {
      const y = originY + r * cellSize;
      gridLines.push({ x1: originX, y1: y, x2: originX + gridW, y2: y });
    }
  }

  return {
    vbW,
    vbH,
    strokeWidth,
    body: { x: half, y: half, w, h, rx, ry },
    title,
    columnTitles,
    rowTitles: rowTitlesOut,
    cells: layoutCells,
    gridLines,
    gridLineColor,
    axisColor,
    titleColor,
  };
}
