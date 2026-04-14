import type {
  ChartBarSegmentItem,
  DiagramNodeData,
  NodeChartSpec,
  NodeChartSpecBar,
  NodeChartSpecLine,
  NodeChartSpecPie,
} from "@/lib/types";
import { isChartNodeType } from "@/lib/chart-node";

function barLineSeriesShapeCompatible(
  prevS: ChartBarSegmentItem[] | undefined,
  currS: ChartBarSegmentItem[] | undefined
): boolean {
  if (!Array.isArray(prevS) || !Array.isArray(currS) || prevS.length !== currS.length) return false;
  for (let i = 0; i < currS.length; i++) {
    const a = prevS[i]?.values;
    const b = currS[i]?.values;
    const la = Array.isArray(a) ? a.length : 0;
    const lb = Array.isArray(b) ? b.length : 0;
    if (la !== lb) return false;
  }
  return true;
}

/** True when prev/curr chart can interpolate numeric values only (same topology). */
export function chartSlideLerpCompatible(prev: DiagramNodeData, curr: DiagramNodeData): boolean {
  if (!isChartNodeType(prev.type) || !isChartNodeType(curr.type)) return false;
  if (prev.type !== curr.type) return false;
  const a = prev.chart;
  const b = curr.chart;
  if (!a || !b || a.kind !== b.kind) return false;

  if (a.kind === "pie" && b.kind === "pie") {
    return Array.isArray(a.series) && Array.isArray(b.series) && a.series.length === b.series.length;
  }
  if (a.kind === "bar" && b.kind === "bar") {
    if (a.vertical !== b.vertical) return false;
    if (!!a.stacked100 !== !!b.stacked100) return false;
    return barLineSeriesShapeCompatible(a.series, b.series);
  }
  if (a.kind === "line" && b.kind === "line") {
    return barLineSeriesShapeCompatible(a.series, b.series);
  }
  return false;
}

function lerpBarLikeSeries(
  prevSeries: ChartBarSegmentItem[],
  currSeries: ChartBarSegmentItem[],
  t: number
): ChartBarSegmentItem[] {
  return currSeries.map((row, si) => {
    const prow = prevSeries[si];
    if (!prow) return row;
    const valsA = prow.values ?? [];
    const valsB = row.values ?? [];
    const n = Math.max(valsA.length, valsB.length);
    const vals = Array.from({ length: n }, (_, ci) => {
      const va = typeof valsA[ci] === "number" && Number.isFinite(valsA[ci]) ? valsA[ci] : 0;
      const vb = typeof valsB[ci] === "number" && Number.isFinite(valsB[ci]) ? valsB[ci] : 0;
      return va + (vb - va) * t;
    });
    return { ...row, values: vals };
  });
}

/** Blend chart numeric values toward `curr` as t→1. Caller ensures `chartSlideLerpCompatible`. */
export function lerpNodeChartForSlide(
  prevSpec: NodeChartSpec,
  currSpec: NodeChartSpec,
  t: number
): NodeChartSpec {
  const u = Math.max(0, Math.min(1, t));
  if (prevSpec.kind === "pie" && currSpec.kind === "pie") {
    const series = currSpec.series.map((row, i) => {
      const p = prevSpec.series[i];
      const pv = typeof p?.value === "number" && Number.isFinite(p.value) ? p.value : 0;
      const cv = typeof row.value === "number" && Number.isFinite(row.value) ? row.value : 0;
      return { ...row, value: pv + (cv - pv) * u };
    });
    return { ...currSpec, series } as NodeChartSpecPie;
  }
  if (prevSpec.kind === "bar" && currSpec.kind === "bar") {
    return {
      ...currSpec,
      series: lerpBarLikeSeries(prevSpec.series, currSpec.series, u),
    } as NodeChartSpecBar;
  }
  if (prevSpec.kind === "line" && currSpec.kind === "line") {
    return {
      ...currSpec,
      series: lerpBarLikeSeries(prevSpec.series, currSpec.series, u),
    } as NodeChartSpecLine;
  }
  return currSpec;
}
