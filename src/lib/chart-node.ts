import type { ChartSeriesItem, ChartSliceFillStyle, NodeChartSpec } from "@/lib/types";

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

/** Default slice label color when `labelColor` is omitted on a series row. */
export const DEFAULT_PIE_SLICE_LABEL_COLOR = "#f9fafb";

/**
 * Max radial pull per slice in the pie SVG viewBox (60×60).
 * Stored in JSON as `chart.segmentGapDeg` for historical reasons.
 */
export const CHART_MAX_SEGMENT_PULL = 24;

/** @deprecated Use `CHART_MAX_SEGMENT_PULL`. */
export const MAX_SEGMENT_GAP_DEG = CHART_MAX_SEGMENT_PULL;

/** Floor for wedge radius when separation is large (SVG units in the pie viewBox). */
export const PIE_MIN_WEDGE_RADIUS = 5;

/**
 * Wedge radius and radial pull so the outer rim stays within `outerRadiusBudget`:
 * `pull + rDraw <= outerRadiusBudget` (after pull clamp and min-radius floor).
 */
export function computePieRadialLayout(
  outerRadiusBudget: number,
  segmentGapRequest: number | undefined
): { rDraw: number; pull: number } {
  let pull = Math.max(0, Math.min(segmentGapRequest ?? 0, CHART_MAX_SEGMENT_PULL));
  let rDraw = outerRadiusBudget - pull;
  if (rDraw < PIE_MIN_WEDGE_RADIUS) {
    rDraw = PIE_MIN_WEDGE_RADIUS;
    pull = Math.max(0, outerRadiusBudget - rDraw);
  }
  return { rDraw, pull };
}

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

export type PieSliceFillMode = "none" | "solid" | "gradient";

export interface PieSliceRender {
  d: string;
  /** Radians;0 = +x, increasing = CW in SVG y-down space */
  midAngle: number;
  name: string;
  labelColor: string;
  /** Angular span in radians (for hiding labels on tiny slices) */
  span: number;
  explodeX: number;
  explodeY: number;
  fillMode: PieSliceFillMode;
  /** Solid fill when `fillMode === 'solid'` */
  solidFill: string;
  /** Gradient stops when `fillMode === 'gradient'` */
  gradientColor1: string;
  gradientColor2: string;
}

export interface PieSliceBuildOptions {
  /**
   * Requested radial pull (SVG units); same as `NodeChartSpec.segmentGapDeg` in JSON.
   * Actual pull may be reduced so wedge radius stays ≥ `PIE_MIN_WEDGE_RADIUS`.
   */
  segmentGapDeg?: number;
}

function fullCirclePath(cx: number, cy: number, r: number): string {
  return `M ${cx} ${cy} m ${-r} 0 a ${r} ${r} 0 1 1 ${r * 2} 0 a ${r} ${r} 0 1 1 ${-r * 2} 0`;
}

function wedgePath(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number
): { d: string; span: number } {
  const span = endAngle - startAngle;
  if (span >= 2 * Math.PI - 1e-6) {
    return { d: fullCirclePath(cx, cy, r), span: 2 * Math.PI };
  }
  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy + r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy + r * Math.sin(endAngle);
  const large = span > Math.PI ? 1 : 0;
  const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
  return { d, span };
}

function resolveSliceFill(
  s: ChartSeriesItem,
  i: number
): {
  fillMode: PieSliceFillMode;
  solidFill: string;
  gradientColor1: string;
  gradientColor2: string;
} {
  const declared: ChartSliceFillStyle | undefined = s.fillStyle;
  const g = s.gradientColors;
  const hasGradPair = Array.isArray(g) && g.length >= 2 && g[0]?.trim() && g[1]?.trim();

  if (declared === "none") {
    return {
      fillMode: "none",
      solidFill: "transparent",
      gradientColor1: "",
      gradientColor2: "",
    };
  }
  if (declared === "gradient" || (!declared && hasGradPair)) {
    const c1 = (g?.[0] ?? "").trim() || DEFAULT_PIE_SLICE_COLORS[i % DEFAULT_PIE_SLICE_COLORS.length];
    const c2 = (g?.[1] ?? "").trim() || c1;
    return {
      fillMode: "gradient",
      solidFill: "",
      gradientColor1: c1,
      gradientColor2: c2,
    };
  }

  const fallback = DEFAULT_PIE_SLICE_COLORS[i % DEFAULT_PIE_SLICE_COLORS.length];
  const solid = (s.color ?? "").trim() || fallback;
  return {
    fillMode: "solid",
    solidFill: solid,
    gradientColor1: "",
    gradientColor2: "",
  };
}

/**
 * SVG path commands and label metadata for pie slices (viewBox coordinates).
 * @param outerRadiusBudget — max distance from pie center to outer arc along a slice bisector after explode (e.g. 28 in a 60×60 viewBox). Wedge radius is reduced when separation &gt; 0 so the chart does not grow past this circle.
 */
export function pieSlicesForSvg(
  cx: number,
  cy: number,
  outerRadiusBudget: number,
  series: ChartSeriesItem[] | undefined,
  options?: PieSliceBuildOptions
): PieSliceRender[] {
  const { rDraw, pull } = computePieRadialLayout(outerRadiusBudget, options?.segmentGapDeg);
  const list = Array.isArray(series) ? series : [];
  const safe = list.map((s, i) => ({
    raw: s,
    name: (s.name ?? "").trim() || `Series ${i + 1}`,
    value: Math.max(0, Number.isFinite(s.value) ? s.value : 0),
    labelColor: s.labelColor?.trim() || DEFAULT_PIE_SLICE_LABEL_COLOR,
    ...resolveSliceFill(s, i),
  }));

  if (safe.length === 0) {
    return [
      {
        d: fullCirclePath(cx, cy, rDraw),
        midAngle: -Math.PI / 2,
        name: "",
        labelColor: DEFAULT_PIE_SLICE_LABEL_COLOR,
        span: 2 * Math.PI,
        explodeX: 0,
        explodeY: 0,
        fillMode: "solid",
        solidFill: DEFAULT_PIE_SLICE_COLORS[0],
        gradientColor1: "",
        gradientColor2: "",
      },
    ];
  }

  const sum = safe.reduce((a, b) => a + b.value, 0);
  if (sum <= 0) {
    return [
      {
        d: fullCirclePath(cx, cy, rDraw),
        midAngle: -Math.PI / 2,
        name: "",
        labelColor: DEFAULT_PIE_SLICE_LABEL_COLOR,
        span: 2 * Math.PI,
        explodeX: 0,
        explodeY: 0,
        fillMode: "solid",
        solidFill: "#e5e7eb",
        gradientColor1: "",
        gradientColor2: "",
      },
    ];
  }

  if (safe.length === 1) {
    const s = safe[0];
    const midAngle = -Math.PI / 2;
    const ex = pull * Math.cos(midAngle);
    const ey = pull * Math.sin(midAngle);
    return [
      {
        d: fullCirclePath(cx, cy, rDraw),
        midAngle,
        name: s.name,
        labelColor: s.labelColor,
        span: 2 * Math.PI,
        explodeX: ex,
        explodeY: ey,
        fillMode: s.fillMode,
        solidFill: s.solidFill,
        gradientColor1: s.gradientColor1,
        gradientColor2: s.gradientColor2,
      },
    ];
  }

  const contributors = safe
    .map((s) => ({ s, frac: s.value / sum }))
    .filter((x) => x.frac > 1e-10);
  const k = contributors.length;

  if (k <= 1) {
    const s = contributors[0]?.s ?? safe[0];
    const mid = -Math.PI / 2;
    const ex = pull * Math.cos(mid);
    const ey = pull * Math.sin(mid);
    return [
      {
        d: fullCirclePath(cx, cy, rDraw),
        midAngle: mid,
        name: s.name,
        labelColor: s.labelColor,
        span: 2 * Math.PI,
        explodeX: ex,
        explodeY: ey,
        fillMode: s.fillMode,
        solidFill: s.solidFill,
        gradientColor1: s.gradientColor1,
        gradientColor2: s.gradientColor2,
      },
    ];
  }

  const paths: PieSliceRender[] = [];
  let angle = -Math.PI / 2;

  for (let i = 0; i < contributors.length; i++) {
    const { s, frac } = contributors[i];
    const span = frac * 2 * Math.PI;
    const startAngle = angle;
    const endAngle = angle + span;
    const midAngle = startAngle + span / 2;
    const ex = pull * Math.cos(midAngle);
    const ey = pull * Math.sin(midAngle);

    if (span >= 2 * Math.PI - 1e-6) {
      paths.push({
        d: fullCirclePath(cx, cy, rDraw),
        midAngle: -Math.PI / 2,
        name: s.name,
        labelColor: s.labelColor,
        span: 2 * Math.PI,
        explodeX: ex,
        explodeY: ey,
        fillMode: s.fillMode,
        solidFill: s.solidFill,
        gradientColor1: s.gradientColor1,
        gradientColor2: s.gradientColor2,
      });
      break;
    }

    const { d, span: arcSpan } = wedgePath(cx, cy, rDraw, startAngle, endAngle);
    paths.push({
      d,
      midAngle,
      name: s.name,
      labelColor: s.labelColor,
      span: arcSpan,
      explodeX: ex,
      explodeY: ey,
      fillMode: s.fillMode,
      solidFill: s.solidFill,
      gradientColor1: s.gradientColor1,
      gradientColor2: s.gradientColor2,
    });
    angle = endAngle;
  }

  if (paths.length === 0) {
    return [
      {
        d: fullCirclePath(cx, cy, rDraw),
        midAngle: -Math.PI / 2,
        name: "",
        labelColor: DEFAULT_PIE_SLICE_LABEL_COLOR,
        span: 2 * Math.PI,
        explodeX: 0,
        explodeY: 0,
        fillMode: "solid",
        solidFill: "#e5e7eb",
        gradientColor1: "",
        gradientColor2: "",
      },
    ];
  }

  return paths;
}

/** Shorten label for small pie viewBox (SVG units). */
export function truncatePieSliceLabel(name: string, maxLen = 12): string {
  const t = name.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, Math.max(1, maxLen - 1))}…`;
}
