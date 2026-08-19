import type { GanttChartBar, GanttChartRow, NodeChartSpecGantt } from "@/lib/types";
import { newChartSliceId, resizeGridTrackWeights } from "@/lib/grid-chart-layout";
import {
  GANTT_MAX_COLS,
  GANTT_MAX_ROWS,
  GANTT_MIN_BAR_SPAN,
  clampBarEdge,
  clampGanttCols,
  normalizeGanttBars,
  normalizeGanttRows,
} from "@/lib/gantt-chart-layout";

function reorderIndexList(len: number, from: number, to: number): number[] {
  const order = Array.from({ length: len }, (_, i) => i);
  if (from < 0 || from >= len || to < 0 || to >= len || from === to) return order;
  const [item] = order.splice(from, 1);
  order.splice(to, 0, item!);
  return order;
}

function remapColumnUnit(u: number, fromCol: number, toCol: number, cols: number): number {
  if (u >= cols) return cols;
  const order = reorderIndexList(cols, fromCol, toCol);
  const inv = new Array<number>(cols);
  order.forEach((oldI, newI) => {
    inv[oldI] = newI;
  });
  const i = Math.min(cols - 1, Math.max(0, Math.floor(u)));
  const f = u - Math.floor(u);
  return (inv[i] ?? i) + f;
}

function remapBarsInsertColumn(bars: GanttChartBar[], atCol: number): GanttChartBar[] {
  return bars.map((bar) => ({
    ...bar,
    start: bar.start >= atCol ? bar.start + 1 : bar.start,
    end: bar.end > atCol ? bar.end + 1 : bar.end,
  }));
}

function remapBarsDeleteColumn(bars: GanttChartBar[], atCol: number, colsBefore: number): GanttChartBar[] {
  const next: GanttChartBar[] = [];
  for (const bar of bars) {
    let s = bar.start;
    let e = bar.end;
    if (s >= atCol + 1) s -= 1;
    else if (s > atCol) s = atCol;
    if (e >= atCol + 1) e -= 1;
    else if (e > atCol) e = atCol;
    if (e - s < GANTT_MIN_BAR_SPAN) e = Math.min(colsBefore - 1, s + GANTT_MIN_BAR_SPAN);
    if (e <= 0 && s <= 0) continue;
    next.push({ ...bar, start: Math.max(0, s), end: Math.max(s + GANTT_MIN_BAR_SPAN, e) });
  }
  return next;
}

export function moveGanttRow(chart: NodeChartSpecGantt, fromRow: number, toRow: number): NodeChartSpecGantt {
  const rows = normalizeGanttRows(chart.rows);
  if (fromRow === toRow || fromRow < 0 || fromRow >= rows.length || toRow < 0 || toRow >= rows.length) {
    return chart;
  }
  const order = reorderIndexList(rows.length, fromRow, toRow);
  const nextRows = order.map((i) => rows[i]!);
  const rowWeights = chart.rowWeights?.length
    ? order.map((i) => chart.rowWeights![i] ?? 1)
    : chart.rowWeights;
  return { ...chart, kind: "gantt", rows: nextRows, rowWeights };
}

export function moveGanttColumn(chart: NodeChartSpecGantt, fromCol: number, toCol: number): NodeChartSpecGantt {
  const cols = clampGanttCols(chart.cols);
  if (fromCol === toCol || fromCol < 0 || fromCol >= cols || toCol < 0 || toCol >= cols) return chart;
  const order = reorderIndexList(cols, fromCol, toCol);
  const columnTitles = chart.columnTitles?.length
    ? order.map((i) => chart.columnTitles![i] ?? "")
    : chart.columnTitles;
  const richColumnTitles = chart.richColumnTitles?.length
    ? order.map((i) => chart.richColumnTitles![i])
    : chart.richColumnTitles;
  const columnWeights = chart.columnWeights?.length
    ? order.map((i) => chart.columnWeights![i] ?? 1)
    : chart.columnWeights;
  const bars = normalizeGanttBars(chart.bars, normalizeGanttRows(chart.rows), cols).map((bar) => ({
    ...bar,
    start: remapColumnUnit(bar.start, fromCol, toCol, cols),
    end: remapColumnUnit(bar.end, fromCol, toCol, cols),
  }));
  return { ...chart, kind: "gantt", cols, columnTitles, richColumnTitles, columnWeights, bars };
}

export function deleteGanttRowAt(chart: NodeChartSpecGantt, rowIndex: number): NodeChartSpecGantt {
  const rows = normalizeGanttRows(chart.rows);
  if (rows.length <= 1 || rowIndex < 0 || rowIndex >= rows.length) return chart;
  const removed = rows[rowIndex]!;
  const nextRows = rows.filter((_, i) => i !== rowIndex);
  const bars = normalizeGanttBars(chart.bars, rows, clampGanttCols(chart.cols)).filter(
    (b) => b.rowId !== removed.id
  );
  const rowWeights = chart.rowWeights?.filter((_, i) => i !== rowIndex);
  return {
    ...chart,
    kind: "gantt",
    rows: nextRows,
    bars,
    rowWeights: resizeGridTrackWeights(nextRows.length, rows.length, rowWeights),
  };
}

export function deleteGanttColumnAt(chart: NodeChartSpecGantt, colIndex: number): NodeChartSpecGantt {
  const cols = clampGanttCols(chart.cols);
  const rows = normalizeGanttRows(chart.rows);
  if (cols <= 1 || colIndex < 0 || colIndex >= cols) return chart;
  const bars = remapBarsDeleteColumn(normalizeGanttBars(chart.bars, rows, cols), colIndex, cols);
  return {
    ...chart,
    kind: "gantt",
    cols: cols - 1,
    bars,
    columnTitles: chart.columnTitles?.filter((_, i) => i !== colIndex),
    richColumnTitles: chart.richColumnTitles?.filter((_, i) => i !== colIndex),
    columnWeights: resizeGridTrackWeights(
      cols - 1,
      cols,
      chart.columnWeights?.filter((_, i) => i !== colIndex)
    ),
  };
}

export function insertGanttRowAt(
  chart: NodeChartSpecGantt,
  atRow: number,
  kind: GanttChartRow["kind"] = "task"
): NodeChartSpecGantt {
  const rows = normalizeGanttRows(chart.rows);
  if (rows.length >= GANTT_MAX_ROWS) return chart;
  const at = Math.max(0, Math.min(rows.length, Math.round(atRow)));
  const row: GanttChartRow = {
    id: newChartSliceId(),
    kind,
    label: kind === "phase" ? "PHASE" : "Task",
  };
  const nextRows = [...rows.slice(0, at), row, ...rows.slice(at)];
  const cols = clampGanttCols(chart.cols);
  const bars = [...normalizeGanttBars(chart.bars, rows, cols)];
  if (kind === "task") {
    const start = Math.min(cols - 1, Math.max(0, cols * 0.15));
    bars.push({
      id: newChartSliceId(),
      rowId: row.id,
      start,
      end: Math.min(cols, start + Math.max(1, cols * 0.28)),
      variant: "task",
    });
  }
  return {
    ...chart,
    kind: "gantt",
    rows: nextRows,
    bars,
    rowWeights: resizeGridTrackWeights(nextRows.length, rows.length, chart.rowWeights),
  };
}

export function insertGanttColumnAt(chart: NodeChartSpecGantt, atCol: number): NodeChartSpecGantt {
  const cols = clampGanttCols(chart.cols);
  const rows = normalizeGanttRows(chart.rows);
  if (cols >= GANTT_MAX_COLS) return chart;
  const at = Math.max(0, Math.min(cols, Math.round(atCol)));
  const titles = [...(chart.columnTitles ?? [])];
  while (titles.length < cols) titles.push("");
  titles.splice(at, 0, "Month");
  const rich = [...(chart.richColumnTitles ?? [])];
  while (rich.length < cols) rich.push(undefined);
  rich.splice(at, 0, undefined);
  return {
    ...chart,
    kind: "gantt",
    cols: cols + 1,
    columnTitles: titles,
    richColumnTitles: rich,
    bars: remapBarsInsertColumn(normalizeGanttBars(chart.bars, rows, cols), at),
    columnWeights: resizeGridTrackWeights(cols + 1, cols, chart.columnWeights),
  };
}

export function patchGanttBar(
  chart: NodeChartSpecGantt,
  barId: string,
  patch: Partial<Pick<GanttChartBar, "start" | "end" | "label" | "richLabel" | "variant">>
): NodeChartSpecGantt {
  const cols = clampGanttCols(chart.cols);
  const rows = normalizeGanttRows(chart.rows);
  const bars = normalizeGanttBars(chart.bars, rows, cols).map((bar) => {
    if (bar.id !== barId) return bar;
    const start = clampBarEdge(patch.start ?? bar.start, cols);
    const end = clampBarEdge(patch.end ?? bar.end, cols);
    const lo = Math.min(start, end);
    const hi = Math.max(start, end);
    return {
      ...bar,
      ...patch,
      start: lo,
      end: Math.max(lo + GANTT_MIN_BAR_SPAN, hi),
    };
  });
  return { ...chart, kind: "gantt", bars };
}

export function patchGanttRowLabel(
  chart: NodeChartSpecGantt,
  rowIndex: number,
  plainText: string,
  runs: import("@/lib/types").RichTextRun[]
): NodeChartSpecGantt {
  const rows = normalizeGanttRows(chart.rows);
  if (rowIndex < 0 || rowIndex >= rows.length) return chart;
  const next = rows.map((row, i) =>
    i === rowIndex
      ? { ...row, label: plainText, richLabel: runs.length > 0 ? runs : undefined }
      : row
  );
  return { ...chart, kind: "gantt", rows: next };
}

export function patchGanttColumnTitle(
  chart: NodeChartSpecGantt,
  colIndex: number,
  plainText: string,
  runs: import("@/lib/types").RichTextRun[]
): NodeChartSpecGantt {
  const cols = clampGanttCols(chart.cols);
  if (colIndex < 0 || colIndex >= cols) return chart;
  const titles = [...(chart.columnTitles ?? [])];
  const rich = [...(chart.richColumnTitles ?? [])];
  while (titles.length < cols) titles.push("");
  while (rich.length < cols) rich.push(undefined);
  titles[colIndex] = plainText;
  rich[colIndex] = runs.length > 0 ? runs : undefined;
  return { ...chart, kind: "gantt", columnTitles: titles, richColumnTitles: rich };
}
