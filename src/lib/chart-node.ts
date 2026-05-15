import type {
  ChartRingSeriesItem,
  ChartSeriesItem,
  ChartSliceFillStyle,
  NodeChartSpec,
  NodeChartSpecBar,
  NodeChartSpecLine,
  NodeChartSpecPie,
  NodeChartSpecRing,
} from "@/lib/types";

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

/** Default segment label font size (SVG viewBox units) for multi-slice wedges. */
export const DEFAULT_PIE_WEDGE_LABEL_FONT = 4.75;
/** Default label size for a single full disc slice. */
export const DEFAULT_PIE_FULL_SLICE_LABEL_FONT = 5.5;

export function resolvePieSliceLabelFontSize(
  seriesItem: ChartSeriesItem | undefined,
  spanRadians: number
): number {
  const v = seriesItem?.labelFontSize;
  if (typeof v === "number" && Number.isFinite(v) && v > 0) {
    return Math.min(14, Math.max(2, v));
  }
  return spanRadians >= 2 * Math.PI - 1e-6 ? DEFAULT_PIE_FULL_SLICE_LABEL_FONT : DEFAULT_PIE_WEDGE_LABEL_FONT;
}

/**
 * Max **chart default** radial pull (slices without `segmentPull` override).
 * Stored in JSON as `chart.segmentGapDeg` for historical reasons.
 */
export const CHART_MAX_SEGMENT_PULL = 3;

/** Max pull when a slice sets `segmentPull` (can exceed chart default). */
export const CHART_MAX_PER_SLICE_SEGMENT_PULL = 4;

/** @deprecated Use `CHART_MAX_SEGMENT_PULL`. */
export const MAX_SEGMENT_GAP_DEG = CHART_MAX_SEGMENT_PULL;

/** Floor for wedge radius when separation is large (SVG units in the pie viewBox). */
export const PIE_MIN_WEDGE_RADIUS = 5;

export function clampChartDefaultSegmentPull(v: number | undefined): number {
  return Math.max(0, Math.min(v ?? 0, CHART_MAX_SEGMENT_PULL));
}

/** Effective pull for one slice: optional `segmentPull` replaces chart default. */
export function effectiveSliceSegmentPull(
  seriesItem: ChartSeriesItem | undefined,
  chartDefaultPull: number
): number {
  if (seriesItem == null) return chartDefaultPull;
  const o = seriesItem.segmentPull;
  if (typeof o === "number" && Number.isFinite(o)) {
    return Math.max(0, Math.min(o, CHART_MAX_PER_SLICE_SEGMENT_PULL));
  }
  return chartDefaultPull;
}

/**
 * Scale per-slice pulls so `max(pull) + rDraw <= outerRadiusBudget` and `rDraw >= PIE_MIN_WEDGE_RADIUS`.
 */
export function scalePullsForOuterBudget(
  pulls: number[],
  outerRadiusBudget: number
): { rDraw: number; pullsScaled: number[] } {
  if (pulls.length === 0) {
    return { rDraw: outerRadiusBudget, pullsScaled: [] };
  }
  const maxP = Math.max(0, ...pulls);
  let rDraw = outerRadiusBudget - maxP;
  if (rDraw >= PIE_MIN_WEDGE_RADIUS) {
    return { rDraw, pullsScaled: pulls.slice() };
  }
  rDraw = PIE_MIN_WEDGE_RADIUS;
  const maxAllowed = outerRadiusBudget - PIE_MIN_WEDGE_RADIUS;
  if (maxP <= 0) {
    return { rDraw: outerRadiusBudget, pullsScaled: pulls.map(() => 0) };
  }
  if (maxP <= maxAllowed) {
    return { rDraw: outerRadiusBudget - maxP, pullsScaled: pulls.slice() };
  }
  const scale = maxAllowed / maxP;
  const scaled = pulls.map((p) => p * scale);
  const maxP2 = Math.max(0, ...scaled);
  rDraw = Math.max(outerRadiusBudget - maxP2, PIE_MIN_WEDGE_RADIUS);
  return { rDraw, pullsScaled: scaled };
}

/**
 * Wedge radius and radial pull so the outer rim stays within `outerRadiusBudget`:
 * `pull + rDraw <= outerRadiusBudget` (after pull clamp and min-radius floor).
 * For multi-slice pies with mixed pulls, use `pieSlicesForSvg` instead.
 */
export function computePieRadialLayout(
  outerRadiusBudget: number,
  segmentGapRequest: number | undefined
): { rDraw: number; pull: number } {
  const chartDefault = clampChartDefaultSegmentPull(segmentGapRequest);
  const { rDraw, pullsScaled } = scalePullsForOuterBudget([chartDefault], outerRadiusBudget);
  return { rDraw, pull: pullsScaled[0] ?? 0 };
}

export interface PieSlicesForSvgResult {
  slices: PieSliceRender[];
  /** Wedge radius after scaling pulls to fit `outerRadiusBudget`. */
  rDraw: number;
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

/** Non-negative chart datum rounded to at most 2 decimal places. */
export function roundChartDataValue(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(Math.max(0, value) * 100) / 100;
}

/** Whole non-negative values for pointer-drag edits on the canvas (modal / typed inline still use 2 dp). */
export function roundChartDragValue(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

/** Display string for modal / labels: integers plain, else up to 2 dp without trailing zeros. */
export function formatChartValueForEdit(value: number): string {
  const r = roundChartDataValue(value);
  if (Number.isInteger(r)) return String(r);
  return r.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export function defaultPieChartSpec(): NodeChartSpecPie {
  return {
    kind: "pie",
    segmentGapDeg: 1,
    series: [
      { id: newChartSliceId(), name: "Series 1", value: 100 },
      { id: newChartSliceId(), name: "Series 2", value: 50 },
    ],
  };
}

/** Inner radius baseline distance from ring center (SVG viewBox chart). */
export const DEFAULT_RING_INNER_RADIUS = 14;
/** Default radial band thickness when `ringThickness` is omitted. */
export const DEFAULT_RING_THICKNESS = 10;
const RING_MIN_THICKNESS = 2;
const RING_MAX_THICKNESS = 24;
const RING_OUTER_RADIUS_BUDGET = 28;
const RING_ABS_INNER_MIN = 3;
const RING_MAX_ANGULAR_GAP_DEG = 8;

export function defaultRingChartSpec(): NodeChartSpecRing {
  return {
    kind: "ring",
    innerRadius: DEFAULT_RING_INNER_RADIUS,
    segmentAngularGapDeg: 2,
    shadow: true,
    series: [
      {
        id: newChartSliceId(),
        name: "A",
        value: 45,
        ringThickness: DEFAULT_RING_THICKNESS,
        ringRadialOffset: 0,
      },
      {
        id: newChartSliceId(),
        name: "B",
        value: 30,
        ringThickness: DEFAULT_RING_THICKNESS,
        ringRadialOffset: 0,
      },
      {
        id: newChartSliceId(),
        name: "C",
        value: 25,
        ringThickness: DEFAULT_RING_THICKNESS,
        ringRadialOffset: 0,
      },
    ],
  };
}

const LINE_CHART_DEFAULT_CATEGORY_COUNT = 5;
const LINE_CHART_RANDOM_MIN = 1;
const LINE_CHART_RANDOM_MAX = 100;

const BAR_CHART_DEFAULT_CATEGORY_COUNT = 4;

function randomCategoryRowValues(length: number, min: number, max: number): number[] {
  const row: number[] = [];
  for (let i = 0; i < length; i++) {
    row.push(Math.floor(Math.random() * (max - min + 1)) + min);
  }
  return row;
}

function randomLineChartValues(length: number): number[] {
  return randomCategoryRowValues(length, LINE_CHART_RANDOM_MIN, LINE_CHART_RANDOM_MAX);
}

function baseBarChartSpecFields(): Omit<NodeChartSpecBar, "kind" | "series"> {
  return {
    stacked100: false,
    vertical: true,
    categoryGap: 0.22,
    stackGap: 0.12,
    showSegmentLabels: false,
    showGridX: true,
    showGridY: true,
    showValueAxis: true,
    showCategoryLabels: true,
    showSegmentValues: true,
    showLegend: true,
  };
}

/** Stable sample bar chart for palette preview, modals, and fallbacks (values in 1–100). */
export function defaultBarChartSpec(): NodeChartSpecBar {
  return {
    kind: "bar",
    series: [
      { id: newChartSliceId(), name: "Segment 1", values: [47, 82, 15, 91] },
      { id: newChartSliceId(), name: "Segment 2", values: [33, 56, 78, 12] },
    ],
    ...baseBarChartSpecFields(),
  };
}

/** Random integer values per category (new canvas bar node). */
export function randomBarChartSpec(): NodeChartSpecBar {
  const n = BAR_CHART_DEFAULT_CATEGORY_COUNT;
  return {
    kind: "bar",
    series: [
      {
        id: newChartSliceId(),
        name: "Segment 1",
        values: randomCategoryRowValues(n, LINE_CHART_RANDOM_MIN, LINE_CHART_RANDOM_MAX),
      },
      {
        id: newChartSliceId(),
        name: "Segment 2",
        values: randomCategoryRowValues(n, LINE_CHART_RANDOM_MIN, LINE_CHART_RANDOM_MAX),
      },
    ],
    ...baseBarChartSpecFields(),
  };
}

function baseLineChartSpecFields(): Omit<NodeChartSpecLine, "kind" | "series"> {
  return {
    showAreaFill: true,
    areaFillOpacity: 0.42,
    smooth: true,
    showDots: true,
    showGridX: false,
    showGridY: false,
    showValueAxis: true,
    showCategoryLabels: true,
  };
}

/** Stable sample data for palette preview, modals, and tests. */
export function defaultLineChartSpec(): NodeChartSpecLine {
  return {
    kind: "line",
    series: [
      { id: newChartSliceId(), name: "Series A", values: [12, 28, 18, 35, 22] },
      { id: newChartSliceId(), name: "Series B", values: [8, 16, 30, 14, 26] },
    ],
    ...baseLineChartSpecFields(),
  };
}

/** Random integer values per category (new canvas node). */
export function randomLineChartSpec(): NodeChartSpecLine {
  const n = LINE_CHART_DEFAULT_CATEGORY_COUNT;
  return {
    kind: "line",
    series: [
      { id: newChartSliceId(), name: "Series A", values: randomLineChartValues(n) },
      { id: newChartSliceId(), name: "Series B", values: randomLineChartValues(n) },
    ],
    ...baseLineChartSpecFields(),
  };
}

/** Palette / drop default chart payload from node `type`. */
export function defaultChartSpecForNodeType(nodeType: string | undefined): NodeChartSpec {
  if (nodeType === "generic.chart.bar") return randomBarChartSpec();
  if (nodeType === "generic.chart.line") return randomLineChartSpec();
  if (nodeType === "generic.chart.ring" || nodeType?.endsWith(".chart.ring"))
    return defaultRingChartSpec();
  return defaultPieChartSpec();
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
  /** Resolved label font size (SVG viewBox units). */
  labelFontSize: number;
  /** Segmented ring: radial midpoint for placing segment labels; pie ignores when unset. */
  segmentMidRadius?: number;
  /** Per-segment outline color (segmented ring); pie ignores when unset. */
  sliceStrokeColor?: string;
  /** Per-segment outline width in SVG vb units; pie ignores when unset. */
  sliceStrokeWidth?: number;
  /**
   * When set, pie segment hover can show this value (native SVG `<title>` tooltip).
   * Omitted for empty-chart placeholder discs.
   */
  tooltipValue?: number;
  /** Index into `chart.series` for this wedge (omitted for placeholder discs; may differ from render order when zero-value rows are skipped). */
  seriesIndex?: number;
}

export interface PieSliceBuildOptions {
  /**
   * Chart default radial pull (0–3); same as `NodeChartSpec.segmentGapDeg`.
   * Slices may override with `segmentPull` (0–4). Layout uses max pull to shrink wedge radius.
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
 * @param outerRadiusBudget — max distance from pie center to outer arc along a slice bisector after explode (e.g. 28 in a 60×60 viewBox). Wedge **`rDraw`** shrinks from **max effective pull** (chart default and/or per-slice `segmentPull`) so the pie rim stays inside this circle.
 */
export function pieSlicesForSvg(
  cx: number,
  cy: number,
  outerRadiusBudget: number,
  series: ChartSeriesItem[] | undefined,
  options?: PieSliceBuildOptions
): PieSlicesForSvgResult {
  const chartDefault = clampChartDefaultSegmentPull(options?.segmentGapDeg);
  const list = Array.isArray(series) ? series : [];
  const safe = list.map((s, i) => ({
    raw: s,
    name: (s.name ?? "").trim() || `Series ${i + 1}`,
    value: Math.max(0, Number.isFinite(s.value) ? s.value : 0),
    labelColor: s.labelColor?.trim() || DEFAULT_PIE_SLICE_LABEL_COLOR,
    ...resolveSliceFill(s, i),
  }));

  if (safe.length === 0) {
    const rDraw = outerRadiusBudget;
    return {
      rDraw,
      slices: [
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
          labelFontSize: DEFAULT_PIE_FULL_SLICE_LABEL_FONT,
        },
      ],
    };
  }

  const sum = safe.reduce((a, b) => a + b.value, 0);
  if (sum <= 0) {
    const rDraw = outerRadiusBudget;
    return {
      rDraw,
      slices: [
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
          labelFontSize: DEFAULT_PIE_FULL_SLICE_LABEL_FONT,
        },
      ],
    };
  }

  if (safe.length === 1) {
    const s = safe[0];
    const midAngle = -Math.PI / 2;
    const spanFull = 2 * Math.PI;
    const p = effectiveSliceSegmentPull(s.raw, chartDefault);
    const { rDraw, pullsScaled } = scalePullsForOuterBudget([p], outerRadiusBudget);
    const pull0 = pullsScaled[0] ?? 0;
    const ex = pull0 * Math.cos(midAngle);
    const ey = pull0 * Math.sin(midAngle);
    return {
      rDraw,
      slices: [
        {
          d: fullCirclePath(cx, cy, rDraw),
          midAngle,
          name: s.name,
          labelColor: s.labelColor,
          span: spanFull,
          explodeX: ex,
          explodeY: ey,
          fillMode: s.fillMode,
          solidFill: s.solidFill,
          gradientColor1: s.gradientColor1,
          gradientColor2: s.gradientColor2,
          labelFontSize: resolvePieSliceLabelFontSize(s.raw, spanFull),
          tooltipValue: s.value,
          seriesIndex: 0,
        },
      ],
    };
  }

  const contributors = safe
    .map((s, sourceIndex) => ({ s, sourceIndex, frac: s.value / sum }))
    .filter((x) => x.frac > 1e-10);
  const k = contributors.length;

  if (k <= 1) {
    const s = contributors[0]?.s ?? safe[0];
    const seriesIndex = contributors[0]?.sourceIndex ?? 0;
    const mid = -Math.PI / 2;
    const spanFull = 2 * Math.PI;
    const p = effectiveSliceSegmentPull(s.raw, chartDefault);
    const { rDraw, pullsScaled } = scalePullsForOuterBudget([p], outerRadiusBudget);
    const pull0 = pullsScaled[0] ?? 0;
    const ex = pull0 * Math.cos(mid);
    const ey = pull0 * Math.sin(mid);
    return {
      rDraw,
      slices: [
        {
          d: fullCirclePath(cx, cy, rDraw),
          midAngle: mid,
          name: s.name,
          labelColor: s.labelColor,
          span: spanFull,
          explodeX: ex,
          explodeY: ey,
          fillMode: s.fillMode,
          solidFill: s.solidFill,
          gradientColor1: s.gradientColor1,
          gradientColor2: s.gradientColor2,
          labelFontSize: resolvePieSliceLabelFontSize(s.raw, spanFull),
          tooltipValue: s.value,
          seriesIndex,
        },
      ],
    };
  }

  const pullsRequested = contributors.map(({ s }) => effectiveSliceSegmentPull(s.raw, chartDefault));
  const { rDraw, pullsScaled } = scalePullsForOuterBudget(pullsRequested, outerRadiusBudget);

  const paths: PieSliceRender[] = [];
  let angle = -Math.PI / 2;

  for (let i = 0; i < contributors.length; i++) {
    const { s, frac, sourceIndex } = contributors[i];
    const span = frac * 2 * Math.PI;
    const startAngle = angle;
    const endAngle = angle + span;
    const midAngle = startAngle + span / 2;
    const pullSlice = pullsScaled[i] ?? 0;
    const ex = pullSlice * Math.cos(midAngle);
    const ey = pullSlice * Math.sin(midAngle);

    if (span >= 2 * Math.PI - 1e-6) {
      const spanFull = 2 * Math.PI;
      paths.push({
        d: fullCirclePath(cx, cy, rDraw),
        midAngle: -Math.PI / 2,
        name: s.name,
        labelColor: s.labelColor,
        span: spanFull,
        explodeX: ex,
        explodeY: ey,
        fillMode: s.fillMode,
        solidFill: s.solidFill,
        gradientColor1: s.gradientColor1,
        gradientColor2: s.gradientColor2,
        labelFontSize: resolvePieSliceLabelFontSize(s.raw, spanFull),
        tooltipValue: s.value,
        seriesIndex: sourceIndex,
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
      labelFontSize: resolvePieSliceLabelFontSize(s.raw, arcSpan),
      tooltipValue: s.value,
      seriesIndex: sourceIndex,
    });
    angle = endAngle;
  }

  if (paths.length === 0) {
    const rDraw = outerRadiusBudget;
    return {
      rDraw,
      slices: [
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
          labelFontSize: DEFAULT_PIE_WEDGE_LABEL_FONT,
        },
      ],
    };
  }

  return { slices: paths, rDraw };
}

function clampRingRadialOffset(v: number | undefined): number {
  if (v == null || !Number.isFinite(v)) return 0;
  return Math.max(-8, Math.min(14, v));
}

function clampRingThickness(v: number | undefined): number {
  const t =
    v != null && Number.isFinite(v) ? v : DEFAULT_RING_THICKNESS;
  return Math.min(RING_MAX_THICKNESS, Math.max(RING_MIN_THICKNESS, t));
}

function clampRingBaselineInner(chartInner: number | undefined): number {
  const v =
    chartInner != null && Number.isFinite(chartInner)
      ? chartInner
      : DEFAULT_RING_INNER_RADIUS;
  return Math.min(
    RING_OUTER_RADIUS_BUDGET - RING_MIN_THICKNESS - 1,
    Math.max(RING_ABS_INNER_MIN, v)
  );
}

/** Full donut (closed annulus): two semicircular arcs outer + complementary inner hole. */
function fullAnnulusPath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number
): string {
  return [
    `M ${cx - rOuter} ${cy}`,
    `A ${rOuter} ${rOuter} 0 1 1 ${cx + rOuter} ${cy}`,
    `A ${rOuter} ${rOuter} 0 1 1 ${cx - rOuter} ${cy}`,
    `M ${cx - rInner} ${cy}`,
    `A ${rInner} ${rInner} 0 1 0 ${cx + rInner} ${cy}`,
    `A ${rInner} ${rInner} 0 1 0 ${cx - rInner} ${cy}`,
    "Z",
  ].join(" ");
}

function donutWedgePath(
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
  startAngle: number,
  endAngle: number
): { d: string; span: number } {
  const span = endAngle - startAngle;
  if (span <= 1e-8) return { d: "", span: 0 };
  if (span >= 2 * Math.PI - 1e-6 && rOuter - rInner > 1e-6) {
    return { d: fullAnnulusPath(cx, cy, rOuter, rInner), span: 2 * Math.PI };
  }
  const sweep = 1;
  const largeOuter = span > Math.PI ? 1 : 0;

  const p1x = cx + rOuter * Math.cos(startAngle);
  const p1y = cy + rOuter * Math.sin(startAngle);
  const p2x = cx + rOuter * Math.cos(endAngle);
  const p2y = cy + rOuter * Math.sin(endAngle);
  const p3x = cx + rInner * Math.cos(endAngle);
  const p3y = cy + rInner * Math.sin(endAngle);
  const p4x = cx + rInner * Math.cos(startAngle);
  const p4y = cy + rInner * Math.sin(startAngle);

  return {
    d: [
      `M ${p1x} ${p1y}`,
      `A ${rOuter} ${rOuter} 0 ${largeOuter} ${sweep} ${p2x} ${p2y}`,
      `L ${p3x} ${p3y}`,
      `A ${rInner} ${rInner} 0 ${largeOuter} 0 ${p4x} ${p4y}`,
      "Z",
    ].join(" "),
    span,
  };
}

function resolveRingOutlineWidth(
  row: ChartRingSeriesItem,
  chartFallback: number
): number {
  const ow = row.sliceOutlineWidth;
  if (ow !== undefined && Number.isFinite(ow)) {
    return Math.max(0, Math.min(5, ow));
  }
  return Math.max(0, Math.min(5, chartFallback));
}

/**
 * Paths and styling metadata for segmented ring arcs (pie-compatible `PieSliceRender` slices).
 */
export function ringSlicesForSvg(
  cx: number,
  cy: number,
  seriesInput: ChartRingSeriesItem[] | undefined,
  chart: Pick<
    NodeChartSpecRing,
    "innerRadius" | "segmentAngularGapDeg"
  > | undefined,
  options: { defaultOutlineWidthVb: number }
): { slices: PieSliceRender[] } {
  const vbBudget = RING_OUTER_RADIUS_BUDGET;
  const baselineInner = clampRingBaselineInner(chart?.innerRadius);
  let gapDeg =
    typeof chart?.segmentAngularGapDeg === "number" &&
    Number.isFinite(chart.segmentAngularGapDeg)
      ? chart.segmentAngularGapDeg
      : 0;
  gapDeg = Math.max(0, Math.min(RING_MAX_ANGULAR_GAP_DEG, gapDeg));

  const listRaw = Array.isArray(seriesInput) ? seriesInput : [];
  const placeholderSlice = (): PieSliceRender => ({
    d: fullAnnulusPath(cx, cy, 22, Math.max(RING_ABS_INNER_MIN + 8, baselineInner)),
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
    labelFontSize: DEFAULT_PIE_FULL_SLICE_LABEL_FONT,
    sliceStrokeWidth: options.defaultOutlineWidthVb,
  });

  if (listRaw.length === 0) {
    return {
      slices: [placeholderSlice()],
    };
  }

  const safe = listRaw.map((s, i) => ({
    raw: s,
    name: (s.name ?? "").trim() || `Series ${i + 1}`,
    value: Math.max(0, Number.isFinite(s.value) ? s.value : 0),
    labelColor: s.labelColor?.trim() || DEFAULT_PIE_SLICE_LABEL_COLOR,
    ...resolveSliceFill(s as unknown as ChartSeriesItem, i),
  }));

  const sum = safe.reduce((a, b) => a + b.value, 0);
  if (sum <= 0) {
    return { slices: [placeholderSlice()] };
  }

  const contributorsAll = safe
    .map((s, sourceIndex) => ({ s, sourceIndex, frac: s.value / sum }))
    .filter((x) => x.frac > 1e-10);
  const k = contributorsAll.length;

  if (k === 0) {
    return { slices: [placeholderSlice()] };
  }

  /** Layout radii — scale uniformly if segments exceed outer budget. */
  const layoutBands = contributorsAll.map(({ s }) => {
    const thickness = clampRingThickness(s.raw.ringThickness);
    const offset = clampRingRadialOffset(s.raw.ringRadialOffset);
    const ri = Math.max(RING_ABS_INNER_MIN, baselineInner + offset);
    const ro = ri + thickness;
    return { ri, ro };
  });
  let maxRo = layoutBands.reduce((m, x) => Math.max(m, x.ro), 0);
  const scaleFit = maxRo > vbBudget + 1e-6 ? vbBudget / maxRo : 1;
  layoutBands.forEach((b, i) => {
    layoutBands[i] = {
      ri: Math.max(RING_ABS_INNER_MIN + 0.35, b.ri * scaleFit),
      ro: Math.min(vbBudget, b.ro * scaleFit),
    };
  });
  /** Re-shrink if rounding pushed outer edges */
  maxRo = layoutBands.reduce((m, x) => Math.max(m, x.ro), 0);
  if (maxRo > vbBudget + 1e-6) {
    const sfb = vbBudget / maxRo;
    for (let i = 0; i < layoutBands.length; i++) {
      layoutBands[i] = {
        ri: Math.max(RING_ABS_INNER_MIN + 0.35, layoutBands[i]!.ri * sfb),
        ro: Math.min(vbBudget, layoutBands[i]!.ro * sfb),
      };
    }
  }

  let gapRad = gapDeg * (Math.PI / 180);
  const twoPi = 2 * Math.PI;
  while (gapRad > 1e-6 && twoPi - k * gapRad < 1e-3) {
    gapRad *= 0.92;
  }
  const availableSweep = Math.max(twoPi - k * gapRad, 1e-4);

  const paths: PieSliceRender[] = [];
  let cursor = -Math.PI / 2 + gapRad / 2;

  for (let i = 0; i < k; i++) {
    const { s, frac, sourceIndex } = contributorsAll[i]!;
    const band = layoutBands[i]!;
    const spanArc = frac * availableSweep;
    const startAngle = cursor;
    const endAngle = cursor + spanArc;
    const midAngle = startAngle + spanArc / 2;
    const { d, span } = donutWedgePath(
      cx,
      cy,
      band.ri,
      band.ro,
      startAngle,
      endAngle
    );
    const outlineW = resolveRingOutlineWidth(s.raw, options.defaultOutlineWidthVb);
    const outlineC = s.raw.sliceOutlineColor?.trim() || "";

    paths.push({
      d,
      midAngle,
      name: s.name,
      labelColor: s.labelColor,
      span,
      explodeX: 0,
      explodeY: 0,
      fillMode: s.fillMode,
      solidFill: s.solidFill,
      gradientColor1: s.gradientColor1,
      gradientColor2: s.gradientColor2,
      labelFontSize: resolvePieSliceLabelFontSize(
        s.raw as unknown as ChartSeriesItem,
        span
      ),
      tooltipValue: s.value,
      seriesIndex: sourceIndex,
      segmentMidRadius: (band.ri + band.ro) / 2,
      sliceStrokeWidth: outlineW,
      ...(outlineC ? { sliceStrokeColor: outlineC } : {}),
    });
    cursor = endAngle + gapRad;
  }

  if (paths.length === 0) {
    return { slices: [placeholderSlice()] };
  }
  return { slices: paths };
}

/** Shorten label for small pie viewBox (SVG units). */
export function truncatePieSliceLabel(name: string, maxLen = 12): string {
  const t = name.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, Math.max(1, maxLen - 1))}…`;
}
