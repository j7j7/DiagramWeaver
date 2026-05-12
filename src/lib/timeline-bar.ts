import { shiftHueOfColor } from "@/lib/color-shift";
import { GRID_STEP, snapToGrid } from "@/components/editor/canvas-constants";
import type { DiagramNodeData, TimelineBarAxisLabelData, TimelineBarSectionData } from "@/lib/types";
import { DIAGRAM_THEME_HUE_STEP_DEG } from "@/lib/theme-manager";

export const TIMELINE_BAR_NODE_TYPE = "generic.object.timeline-bar" as const;

export function isTimelineBarNodeType(type: string | undefined): boolean {
  return type === TIMELINE_BAR_NODE_TYPE || !!type?.endsWith(".timeline-bar");
}

/** First background colour — chain base when section `fillStyle` is `theme-hue` (theme updates this). */
export function timelineBarThemeHueBaseColor(node: DiagramNodeData): string {
  const n = node as unknown as Record<string, unknown>;
  const bgStyle = (n.backgroundStyle as string) || "solid";
  const bg = n.backgroundColor as string | undefined;
  const bgs = n.backgroundColors as string[] | undefined;
  if (bgStyle === "gradient" && Array.isArray(bgs) && bgs.length > 0) {
    return String(bgs[0]);
  }
  if (typeof bg === "string" && bg.length > 0) {
    return bg;
  }
  if (Array.isArray(bgs) && bgs.length > 0) {
    return String(bgs[0]);
  }
  return "#f3f4f6";
}

export function clampTimelineBarT(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.min(1, Math.max(0, x));
}

/** True when every section has a valid [spanStart, spanEnd] window on 0–1 (replaces equal/weighted width layout). */
export function timelineBarUsesSpanLayout(sections: TimelineBarSectionData[]): boolean {
  if (sections.length === 0) return false;
  return sections.every((s) => {
    const a = s.spanStart;
    const b = s.spanEnd;
    return typeof a === "number" && Number.isFinite(a) && typeof b === "number" && Number.isFinite(b) && b > a;
  });
}

/** Left-to-right order: span mode sorts by `spanStart`; otherwise array index order. */
export function timelineBarVisualSortIndices(sections: TimelineBarSectionData[]): number[] {
  if (sections.length <= 1) return sections.map((_, i) => i);
  if (timelineBarUsesSpanLayout(sections)) {
    return sections
      .map((_, i) => i)
      .sort((a, b) => {
        const as = sections[a]?.spanStart ?? 0;
        const bs = sections[b]?.spanStart ?? 0;
        if (as !== bs) return as - bs;
        return a - b;
      });
  }
  return sections.map((_, i) => i);
}

/** Convert equal/weighted layout to explicit spans so boundaries can be edited. */
export function timelineBarEnsureSpanSections(
  sections: TimelineBarSectionData[],
  innerWidth: number,
  sizing: "equal" | "weighted",
): TimelineBarSectionData[] {
  if (sections.length === 0) return sections;
  if (timelineBarUsesSpanLayout(sections)) return sections;
  const iw = Math.max(1e-6, innerWidth);
  const { starts, widths } = timelineBarSegmentLayout(sections, iw, sizing);
  return sections.map((s, i) => {
    const st = starts[i] ?? 0;
    const wi = widths[i] ?? 0;
    return {
      ...s,
      spanStart: st / iw,
      spanEnd: (st + wi) / iw,
    };
  });
}

/** Map normalized boundary `t` so the corresponding diagram X lands on the canvas grid. */
export function snapTimelineBarBoundaryT(diagramX: number, diagramBarWidth: number, t: number): number {
  if (!(diagramBarWidth > 0)) return clampTimelineBarT(t);
  const abs = diagramX + clampTimelineBarT(t) * diagramBarWidth;
  const snappedAbs = snapToGrid(abs);
  return clampTimelineBarT((snappedAbs - diagramX) / diagramBarWidth);
}

/** Minimum span width in 0–1 `t` so each segment is at least one grid step wide in diagram pixels. */
export function timelineBarMinSegmentT(diagramBarWidth: number): number {
  if (!(diagramBarWidth > 0)) return 1e-4;
  return Math.min(1, GRID_STEP / diagramBarWidth);
}

/** Move the joint between two adjacent sections in visual order (`visualBoundaryIndex` 0 = first gap left→right). */
export function timelineBarMoveJointAtVisualBoundary(
  sections: TimelineBarSectionData[],
  visualBoundaryIndex: number,
  newT: number,
  minDt: number,
): TimelineBarSectionData[] | null {
  const n = sections.length;
  if (n < 2) return null;
  const ord = timelineBarVisualSortIndices(sections);
  if (visualBoundaryIndex < 0 || visualBoundaryIndex >= ord.length - 1) return null;
  const L = ord[visualBoundaryIndex]!;
  const R = ord[visualBoundaryIndex + 1]!;
  const leftS = sections[L]!.spanStart ?? 0;
  const rightE = sections[R]!.spanEnd ?? 1;
  const tLo = leftS + minDt;
  const tHi = rightE - minDt;
  if (!(tLo < tHi)) return null;
  let t = clampTimelineBarT(newT);
  t = Math.max(tLo, Math.min(tHi, t));
  return sections.map((s, i) => {
    if (i === L) return { ...s, spanEnd: t };
    if (i === R) return { ...s, spanStart: t };
    return s;
  });
}

/** Horizontal start offset and width per section index (user units along inner width `w`). */
export function timelineBarSegmentLayout(
  sections: TimelineBarSectionData[],
  innerWidth: number,
  sizing: "equal" | "weighted",
): { starts: number[]; widths: number[] } {
  const w = Math.max(0, innerWidth);
  const n = sections.length;
  if (n === 0) return { starts: [], widths: [] };

  if (timelineBarUsesSpanLayout(sections)) {
    return {
      starts: sections.map((s) => clampTimelineBarT(s.spanStart!) * w),
      widths: sections.map((s) => Math.max(0, (clampTimelineBarT(s.spanEnd!) - clampTimelineBarT(s.spanStart!)) * w)),
    };
  }

  const widthsOnly = timelineBarSegmentWidths(sections, w, sizing);
  let acc = 0;
  const starts = widthsOnly.map((wi) => {
    const s = acc;
    acc += wi;
    return s;
  });
  return { starts, widths: widthsOnly };
}

/** Vertical lines between segments: inner x positions (in user units from clip left **not** including half stroke). */
export function timelineBarInteriorDividerXs(
  sections: TimelineBarSectionData[],
  starts: number[],
  innerWidth: number,
): number[] {
  const n = sections.length;
  if (n <= 1) return [];
  if (timelineBarUsesSpanLayout(sections)) {
    const order = sections
      .map((_, i) => i)
      .sort((a, b) => (sections[a].spanStart ?? 0) - (sections[b].spanStart ?? 0));
    const xs: number[] = [];
    for (let k = 1; k < order.length; k++) {
      const i = order[k];
      xs.push(clampTimelineBarT(sections[i].spanStart!) * innerWidth);
    }
    return xs;
  }
  const xs: number[] = [];
  for (let i = 1; i < starts.length; i++) xs.push(starts[i]);
  return xs;
}

/**
 * Normalised positions (0–1) for `count` axis labels spaced evenly along the bar:
 * centres of `count` equal slices, so the gap from the left edge to the first tick,
 * between consecutive ticks, and from the last tick to the right edge are all equal
 * (e.g. four labels → 12.5%, 37.5%, 62.5%, 87.5%).
 */
export function timelineBarEvenAxisPositions(count: number): number[] {
  const n = Math.floor(count);
  if (n <= 0) return [];
  if (n === 1) return [0.5];
  return Array.from({ length: n }, (_, i) => clampTimelineBarT((i + 0.5) / n));
}

const PALETTE_TIMELINE_BAR_SECTION_COUNT = 8;

/**
 * Default visual + data for a timeline bar dropped from the palette or created via “swap shape”.
 * IDs for sections and axis rows are generated from `nodeId`.
 */
export function defaultPaletteTimelineBarNodeProps(nodeId: string): Partial<DiagramNodeData> {
  const axisTs = timelineBarEvenAxisPositions(4);
  const timelineBarAxisLabels: TimelineBarAxisLabelData[] = axisTs.map((t, i) => ({
    id: newTimelineBarAxisLabelId(nodeId),
    label: `Q${i + 1}`,
    t,
  }));
  const timelineBarSections: TimelineBarSectionData[] = Array.from({ length: PALETTE_TIMELINE_BAR_SECTION_COUNT }, (_, i) => ({
    id: newTimelineBarSectionId(nodeId),
    label: `S${i + 1}`,
    fill: "#94a3b8",
    weight: 1,
    fillStyle: "theme-hue" as const,
  }));

  return {
    borderStyle: "none",
    borderColors: ["#92400e", "#b45309"],
    borderWidth: 1,
    backgroundStyle: "gradient",
    backgroundColors: ["#ffedd5", "#fdba74"],
    backgroundOpacity: 1,
    lineStyle: "solid",
    lineColor: "#9a3412",
    lineWidth: 3,
    lineOpacity: 1,
    shadow: true,
    shadowColor: "#c2410c",
    shadowOpacity: 0.3,
    shadowBlur: 7,
    textColor: "#431407",
    textOpacity: 1,
    gradientAngle: 95,
    textJustify: "center",
    cornerRadius: 0.28,
    borderColor: "#92400e",
    textPosition: "above",
    timelineBarSections,
    timelineBarSizing: "equal",
    timelineBarShowTicks: true,
    timelineBarTickMarkers: true,
    timelineBarSectionBorder: true,
    backgroundColor: "#ffedd5",
    timelineBarHueStepDeg: 10,
    timelineBarSectionBorderWidth: 3.5,
    timelineBarAxisLabels,
  } as Partial<DiagramNodeData>;
}

export function normalizeTimelineBarAxisLabels(node: DiagramNodeData): TimelineBarAxisLabelData[] {
  type Axis = TimelineBarAxisLabelData;
  const raw = (node as DiagramNodeData & { timelineBarAxisLabels?: Axis[] }).timelineBarAxisLabels;
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return raw
    .map((a, i) => ({
      id: typeof a.id === "string" && a.id ? a.id : `tba-${i}`,
      label: String(a.label ?? ""),
      t: clampTimelineBarT(typeof a.t === "number" && Number.isFinite(a.t) ? a.t : i / Math.max(1, raw.length - 1 || 1)),
    }))
    .sort((a, b) => a.t - b.t);
}

/** Solid fill for one theme-hue section: rank follows **visual** order (left → right: by `spanStart` in span mode, else row order). */
export function timelineBarThemeHueRankAtSection(sections: TimelineBarSectionData[], sectionIndex: number): number {
  const seg = sections[sectionIndex];
  if ((seg?.fillStyle ?? "solid") !== "theme-hue") return 0;
  const spanMode = timelineBarUsesSpanLayout(sections);
  const themeBlocks = sections
    .map((s, i) => ({ i, s }))
    .filter((x) => (x.s.fillStyle ?? "solid") === "theme-hue");
  const ordered = spanMode
    ? [...themeBlocks].sort((a, b) => {
        const as = a.s.spanStart ?? 0;
        const bs = b.s.spanStart ?? 0;
        if (as !== bs) return as - bs;
        return a.i - b.i;
      })
    : themeBlocks;
  const rank = ordered.findIndex((x) => x.i === sectionIndex);
  return rank >= 0 ? rank : 0;
}

export function timelineBarSectionThemeHueFill(
  node: DiagramNodeData,
  sections: TimelineBarSectionData[],
  sectionIndex: number,
): string {
  const seg = sections[sectionIndex];
  if ((seg?.fillStyle ?? "solid") !== "theme-hue") {
    return String(seg?.fill ?? "#6b7280");
  }
  const rank = timelineBarThemeHueRankAtSection(sections, sectionIndex);
  const base = timelineBarThemeHueBaseColor(node);
  const stepRaw = (node as DiagramNodeData & { timelineBarHueStepDeg?: number }).timelineBarHueStepDeg;
  const step = typeof stepRaw === "number" && Number.isFinite(stepRaw) ? stepRaw : DIAGRAM_THEME_HUE_STEP_DEG;
  const delta = rank * step;
  if (!Number.isFinite(delta) || delta === 0) return base;
  return shiftHueOfColor(base, delta);
}

const DEFAULT_SECTION_COLORS = ["#3b82f6", "#8b5cf6", "#f97316", "#22c55e"];
const DEFAULT_TICKS = ["Jan", "Feb", "Mar", "Apr"];

export function defaultTimelineBarSections(): TimelineBarSectionData[] {
  return DEFAULT_SECTION_COLORS.map((fill, i) => ({
    id: `tb-${i}`,
    label: `Q${i + 1}`,
    fill,
    fillStyle: "solid" as const,
    weight: 1,
    tickLabel: DEFAULT_TICKS[i],
  }));
}

export function normalizeTimelineBarSections(node: DiagramNodeData): TimelineBarSectionData[] {
  const raw = (node as DiagramNodeData & { timelineBarSections?: TimelineBarSectionData[] }).timelineBarSections;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((s, i) => {
      const baseFill = s.fill ?? DEFAULT_SECTION_COLORS[i % DEFAULT_SECTION_COLORS.length];
      const fillStyle: TimelineBarSectionData["fillStyle"] =
        s.fillStyle === "gradient" || s.fillStyle === "none" || s.fillStyle === "theme-hue"
          ? s.fillStyle
          : "solid";
      const fillGradientColors =
        fillStyle === "gradient"
          ? Array.isArray(s.fillGradientColors) && s.fillGradientColors.length >= 2
            ? [String(s.fillGradientColors[0]), String(s.fillGradientColors[1])]
            : [baseFill, baseFill]
          : undefined;
      const fillGradientAngle =
        fillStyle === "gradient" && typeof s.fillGradientAngle === "number" && Number.isFinite(s.fillGradientAngle)
          ? s.fillGradientAngle
          : fillStyle === "gradient"
            ? 90
            : undefined;
      const hasSpan =
        typeof s.spanStart === "number" &&
        Number.isFinite(s.spanStart) &&
        typeof s.spanEnd === "number" &&
        Number.isFinite(s.spanEnd) &&
        s.spanEnd > s.spanStart;
      const spanStart = hasSpan ? clampTimelineBarT(s.spanStart as number) : undefined;
      const spanEnd = hasSpan ? clampTimelineBarT(s.spanEnd as number) : undefined;
      return {
        id: typeof s.id === "string" && s.id ? s.id : `tb-${i}`,
        label: s.label,
        fill: baseFill,
        fillStyle,
        fillGradientColors,
        fillGradientAngle,
        weight: typeof s.weight === "number" && Number.isFinite(s.weight) && s.weight > 0 ? s.weight : 1,
        ...(hasSpan ? { spanStart, spanEnd } : {}),
        tickLabel: s.tickLabel,
        labelColor: s.labelColor,
      };
    });
  }
  return defaultTimelineBarSections();
}

export function newTimelineBarSectionId(nodeId: string): string {
  const u =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 10)
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${nodeId}-tbs-${u}`;
}

export function newTimelineBarAxisLabelId(nodeId: string): string {
  const u =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 10)
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${nodeId}-tba-${u}`;
}

/** Memo key for `DiagramNode` re-render equality */
export function timelineBarMemoPayload(n: DiagramNodeData): string {
  const x = n as DiagramNodeData & {
    timelineBarSections?: TimelineBarSectionData[];
    timelineBarSizing?: string;
    timelineBarShowTicks?: boolean;
    timelineBarTickMarkers?: boolean;
    timelineBarSectionBorder?: boolean;
    timelineBarSectionBorderWidth?: number;
    timelineBarSectionBorderColor?: string;
    cornerRadius?: number;
    backgroundStyle?: string;
    backgroundColor?: string;
    backgroundColors?: string[];
    timelineBarHueStepDeg?: number;
    timelineBarAxisLabels?: TimelineBarAxisLabelData[];
  };
  return JSON.stringify([
    x.timelineBarSections,
    x.timelineBarSizing,
    x.timelineBarShowTicks,
    x.timelineBarTickMarkers,
    x.timelineBarSectionBorder,
    x.timelineBarSectionBorderWidth,
    x.timelineBarSectionBorderColor,
    x.cornerRadius,
    x.backgroundStyle,
    x.backgroundColor,
    x.backgroundColors,
    x.timelineBarHueStepDeg,
    x.timelineBarAxisLabels,
  ]);
}

/**
 * Horizontal widths for bar segments (user units), sum ≈ innerWidth.
 */
export function timelineBarSegmentWidths(
  sections: TimelineBarSectionData[],
  innerWidth: number,
  sizing: "equal" | "weighted",
): number[] {
  const n = sections.length;
  if (n === 0) return [];
  const w = Math.max(0, innerWidth);
  if (n === 1) return [w];
  if (sizing === "equal") {
    const each = w / n;
    return sections.map(() => each);
  }
  const weights = sections.map((s) => Math.max(1e-6, s.weight ?? 1));
  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map((wt) => (wt / sum) * w);
}
