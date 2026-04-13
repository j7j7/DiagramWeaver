import type { ChartSeriesItem, NodeChartSpec } from "@/lib/types";

export const DEFAULT_PIE_SLICE_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#eab308",
  "#ef4444",
  "#a855f7",
  "#14b8a6",
  "#f97316",
  "#64748b",
];

export function isChartNodeType(nodeType: string | undefined): boolean {
  return !!nodeType?.startsWith("generic.chart.");
}

export function newChartSliceId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `chart-slice-${Math.random().toString(36).slice(2, 11)}`;
}

export function defaultPieChartSpec(): NodeChartSpec {
  return {
    kind: "pie",
    series: [{ id: newChartSliceId(), name: "Series 1", value: 100 }],
  };
}

export interface PieSlicePath {
  d: string;
  fill: string;
}

function fullCirclePath(cx: number, cy: number, r: number): string {
  return `M ${cx} ${cy} m ${-r} 0 a ${r} ${r} 0 1 1 ${r * 2} 0 a ${r} ${r} 0 1 1 ${-r * 2} 0`;
}

/**
 * SVG path commands for pie slices (viewBox coordinates).
 */
export function pieSlicesForSvg(
  cx: number,
  cy: number,
  r: number,
  series: ChartSeriesItem[] | undefined
): PieSlicePath[] {
  const list = Array.isArray(series) ? series : [];
  const safe = list.map((s, i) => ({
    value: Math.max(0, Number.isFinite(s.value) ? s.value : 0),
    fill: s.color ?? DEFAULT_PIE_SLICE_COLORS[i % DEFAULT_PIE_SLICE_COLORS.length],
  }));

  if (safe.length === 0) {
    return [{ d: fullCirclePath(cx, cy, r), fill: DEFAULT_PIE_SLICE_COLORS[0] }];
  }

  const sum = safe.reduce((a, b) => a + b.value, 0);
  if (sum <= 0) {
    return [{ d: fullCirclePath(cx, cy, r), fill: "#e5e7eb" }];
  }

  if (safe.length === 1) {
    return [{ d: fullCirclePath(cx, cy, r), fill: safe[0].fill }];
  }

  const paths: PieSlicePath[] = [];
  let angle = -Math.PI / 2;

  for (let i = 0; i < safe.length; i++) {
    const frac = safe[i].value / sum;
    const span = frac * 2 * Math.PI;
    if (span <= 1e-8) continue;

    if (span >= 2 * Math.PI - 1e-6) {
      paths.push({ d: fullCirclePath(cx, cy, r), fill: safe[i].fill });
      break;
    }

    const end = angle + span;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    const large = span > Math.PI ? 1 : 0;
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
    paths.push({ d, fill: safe[i].fill });
    angle = end;
  }

  if (paths.length === 0) {
    return [{ d: fullCirclePath(cx, cy, r), fill: "#e5e7eb" }];
  }

  return paths;
}
