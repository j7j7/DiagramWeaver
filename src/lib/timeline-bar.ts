import { shiftHueOfColor } from "@/lib/color-shift";
import { GRID_STEP, snapToGrid } from "@/components/editor/canvas-constants";
import { normalizeRuns } from "@/lib/rich-text";
import {
  TIMELINE_BAR_LABEL_FIRST_SECTION,
  type DiagramNodeData,
  type TimelineBarAxisLabelData,
  type TimelineBarSectionData,
} from "@/lib/types";
import { DIAGRAM_THEME_HUE_STEP_DEG } from "@/lib/theme-manager";

export const TIMELINE_BAR_NODE_TYPE = "generic.object.timeline-bar" as const;

export function isTimelineBarNodeType(type: string | undefined): boolean {
  return type === TIMELINE_BAR_NODE_TYPE || !!type?.endsWith(".timeline-bar");
}

/** When timeline-bar orientation flips horizontal↔vertical, swap intrinsic `width`/`height` so axes match footprint (parity with segmented rectangle). */
export function augmentTimelineBarOrientationPatch(
  nodeBefore: DiagramNodeData,
  stylingPatch: Record<string, unknown>,
): Record<string, unknown> {
  if (!isTimelineBarNodeType(nodeBefore.type)) return stylingPatch;
  if (stylingPatch.timelineBarOrientation === undefined) return stylingPatch;
  const next = stylingPatch.timelineBarOrientation === "vertical" ? ("vertical" as const) : ("horizontal" as const);
  const prev = nodeBefore.timelineBarOrientation === "vertical" ? ("vertical" as const) : ("horizontal" as const);
  if (prev === next) return stylingPatch;

  const w = nodeBefore.width;
  const h = nodeBefore.height;
  if (typeof w === "number" && typeof h === "number" && Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
    return { ...stylingPatch, width: h, height: w };
  }
  return stylingPatch;
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

/** Snaps normalized boundary `t` so the diagram coordinate along the bar axis hits the grid (`diagramBarOrigin` = bar min along that axis; extent = bar length in px). */
export function snapTimelineBarBoundaryT(diagramBarOrigin: number, diagramBarExtentPx: number, t: number): number {
  if (!(diagramBarExtentPx > 0)) return clampTimelineBarT(t);
  const abs = diagramBarOrigin + clampTimelineBarT(t) * diagramBarExtentPx;
  const snappedAbs = snapToGrid(abs);
  return clampTimelineBarT((snappedAbs - diagramBarOrigin) / diagramBarExtentPx);
}

/** Minimum span in 0–1 `t` so each segment is at least one grid step along the bar axis in diagram px. */
export function timelineBarMinSegmentT(diagramBarExtentPx: number): number {
  if (!(diagramBarExtentPx > 0)) return 1e-4;
  return Math.min(1, GRID_STEP / diagramBarExtentPx);
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
 * Weak magnet: snap axis `t` toward the nearest interior segment boundary when the bar has multiple segments.
 * Threshold scales from diagram px extent so small shapes still feel responsive.
 */
export function snapTimelineBarAxisTToSegmentDividers(
  t: number,
  sections: TimelineBarSectionData[],
  starts: number[],
  innerAlongLen: number,
  diagramBarExtentPx: number,
): number {
  const tClamped = clampTimelineBarT(t);
  if (sections.length <= 1 || !(innerAlongLen > 0)) return tClamped;
  const xs = timelineBarInteriorDividerXs(sections, starts, innerAlongLen);
  const targets = xs.map((x) => clampTimelineBarT(x / innerAlongLen));
  if (targets.length === 0) return tClamped;
  const pxMagnet = 10;
  const tMagnet = Math.min(0.055, pxMagnet / Math.max(8, diagramBarExtentPx));
  let nearest = targets[0]!;
  let best = Math.abs(nearest - tClamped);
  for (let i = 1; i < targets.length; i++) {
    const tg = targets[i]!;
    const d = Math.abs(tg - tClamped);
    if (d < best) {
      best = d;
      nearest = tg;
    }
  }
  return best <= tMagnet ? nearest : tClamped;
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

/** Hue shift (`°`) applied to a theme-hue section (rank × step). Returns `0` when the section is not theme-hue. */
export function timelineBarSectionThemeHueDeltaDeg(
  node: DiagramNodeData,
  sections: TimelineBarSectionData[],
  sectionIndex: number,
  /** Optional hue step (`°`). Pyramid passes a finite 4th arg from the Themes menu; timeline / segmented rectangle omit → use node `timelineBarHueStepDeg` / segmented override. */
  hueStepDegOverride?: number,
): number {
  const seg = sections[sectionIndex];
  if ((seg?.fillStyle ?? "solid") !== "theme-hue") return 0;
  const rank = timelineBarThemeHueRankAtSection(sections, sectionIndex);
  const explicitMenuStep =
    arguments.length >= 4 && typeof hueStepDegOverride === "number" && Number.isFinite(hueStepDegOverride)
      ? hueStepDegOverride
      : undefined;
  const stepRaw =
    explicitMenuStep !== undefined
      ? explicitMenuStep
      : (node as DiagramNodeData & { timelineBarHueStepDeg?: number }).timelineBarHueStepDeg;
  const step = typeof stepRaw === "number" && Number.isFinite(stepRaw) ? stepRaw : DIAGRAM_THEME_HUE_STEP_DEG;
  return rank * step;
}

export function timelineBarSectionThemeHueFill(
  node: DiagramNodeData,
  sections: TimelineBarSectionData[],
  sectionIndex: number,
  /** Optional hue step (`°`). Pass **only** when caller passes a 4th argument (pyramid uses Themes-menu step via `useThemeMenuHueStepDeg`; timeline omits this). */
  hueStepDegOverride?: number,
): string {
  const seg = sections[sectionIndex];
  if ((seg?.fillStyle ?? "solid") !== "theme-hue") {
    return String(seg?.fill ?? "#6b7280");
  }
  const base = timelineBarThemeHueBaseColor(node);
  const delta = timelineBarSectionThemeHueDeltaDeg(node, sections, sectionIndex, hueStepDegOverride);
  if (!Number.isFinite(delta) || delta === 0) return base;
  return shiftHueOfColor(base, delta);
}

/** When the shape background is a linear gradient, theme-hue sections use hue-shifted stops at the same angle; otherwise `null` — use solid {@link timelineBarSectionThemeHueFill}. */
export function timelineBarSectionThemeHueFillGradient(
  node: DiagramNodeData,
  sections: TimelineBarSectionData[],
  sectionIndex: number,
  hueStepDegOverride?: number,
): { start: string; end: string; angleDeg: number } | null {
  const seg = sections[sectionIndex];
  if ((seg?.fillStyle ?? "solid") !== "theme-hue") return null;
  const n = node as unknown as Record<string, unknown>;
  const bgStyle = (n.backgroundStyle as string) || "solid";
  if (bgStyle !== "gradient") return null;
  const bgs = n.backgroundColors as string[] | undefined;
  if (!Array.isArray(bgs) || bgs.length < 2) return null;
  const c0 = String(bgs[0]);
  const c1 = String(bgs[1] ?? bgs[0]);
  const angleDeg = typeof n.gradientAngle === "number" && Number.isFinite(n.gradientAngle) ? n.gradientAngle : 135;
  const delta = timelineBarSectionThemeHueDeltaDeg(node, sections, sectionIndex, hueStepDegOverride);
  const start = !Number.isFinite(delta) || delta === 0 ? c0 : shiftHueOfColor(c0, delta);
  const end = !Number.isFinite(delta) || delta === 0 ? c1 : shiftHueOfColor(c1, delta);
  return { start, end, angleDeg };
}

/** When the shape border is a linear gradient, theme-hue sections can use hue-shifted border stops (e.g. per-segment outline). */
export function timelineBarSectionThemeHueBorderGradient(
  node: DiagramNodeData,
  sections: TimelineBarSectionData[],
  sectionIndex: number,
  hueStepDegOverride?: number,
): { start: string; end: string; angleDeg: number } | null {
  const seg = sections[sectionIndex];
  if ((seg?.fillStyle ?? "solid") !== "theme-hue") return null;
  const n = node as unknown as Record<string, unknown>;
  const borderStyle = ((n.borderStyle as string) || "solid") as string;
  if (borderStyle !== "gradient") return null;
  const bc = n.borderColors as string[] | undefined;
  if (!Array.isArray(bc) || bc.length < 2) return null;
  const c0 = String(bc[0]);
  const c1 = String(bc[1] ?? bc[0]);
  const gradientAngle = typeof n.gradientAngle === "number" && Number.isFinite(n.gradientAngle) ? n.gradientAngle : 135;
  const angleDeg =
    typeof n.borderGradientAngle === "number" && Number.isFinite(n.borderGradientAngle) ? n.borderGradientAngle : gradientAngle;
  const delta = timelineBarSectionThemeHueDeltaDeg(node, sections, sectionIndex, hueStepDegOverride);
  const start = !Number.isFinite(delta) || delta === 0 ? c0 : shiftHueOfColor(c0, delta);
  const end = !Number.isFinite(delta) || delta === 0 ? c1 : shiftHueOfColor(c1, delta);
  return { start, end, angleDeg };
}

const DEFAULT_SECTION_COLORS = ["#3b82f6", "#8b5cf6", "#f97316", "#22c55e"];
const DEFAULT_TICKS = ["Jan", "Feb", "Mar", "Apr"];

function effectiveTimelineBarLabelTextJustify(
  seg: TimelineBarSectionData,
  sectionIndex: number,
  sections: TimelineBarSectionData[],
): "left" | "center" | "right" | "full" | undefined {
  let j = seg.labelTextJustify;
  if (j === TIMELINE_BAR_LABEL_FIRST_SECTION) {
    if (sectionIndex === 0) return undefined;
    j = sections[0]?.labelTextJustify;
    if (j === TIMELINE_BAR_LABEL_FIRST_SECTION) return undefined;
  }
  if (j === "left" || j === "center" || j === "right" || j === "full") return j;
  return undefined;
}

function effectiveTimelineBarLabelVerticalAlign(
  seg: TimelineBarSectionData,
  sectionIndex: number,
  sections: TimelineBarSectionData[],
): "top" | "middle" | "bottom" | undefined {
  let v = seg.labelVerticalAlign;
  if (v === TIMELINE_BAR_LABEL_FIRST_SECTION) {
    if (sectionIndex === 0) return undefined;
    v = sections[0]?.labelVerticalAlign;
    if (v === TIMELINE_BAR_LABEL_FIRST_SECTION) return undefined;
  }
  if (v === "top" || v === "middle" || v === "bottom") return v;
  return undefined;
}

function effectiveTimelineBarLabelFontFamily(
  seg: TimelineBarSectionData,
  sectionIndex: number,
  sections: TimelineBarSectionData[],
): string | undefined {
  let f = seg.labelFontFamily;
  if (f === TIMELINE_BAR_LABEL_FIRST_SECTION) {
    if (sectionIndex === 0) return undefined;
    f = sections[0]?.labelFontFamily;
    if (f === TIMELINE_BAR_LABEL_FIRST_SECTION) return undefined;
  }
  const t = f?.trim();
  return t || undefined;
}

function effectiveTimelineBarLabelFontSize(
  seg: TimelineBarSectionData,
  sectionIndex: number,
  sections: TimelineBarSectionData[],
): number | undefined {
  let fs = seg.labelFontSize;
  if (fs === TIMELINE_BAR_LABEL_FIRST_SECTION) {
    if (sectionIndex === 0) return undefined;
    fs = sections[0]?.labelFontSize;
    if (fs === TIMELINE_BAR_LABEL_FIRST_SECTION) return undefined;
  }
  if (typeof fs === "number" && Number.isFinite(fs) && fs > 0) return fs;
  return undefined;
}

function effectiveTimelineBarLabelFontWeight(
  seg: TimelineBarSectionData,
  sectionIndex: number,
  sections: TimelineBarSectionData[],
): DiagramNodeData["fontWeight"] | undefined {
  let w = seg.labelFontWeight;
  if (w === TIMELINE_BAR_LABEL_FIRST_SECTION) {
    if (sectionIndex === 0) return undefined;
    w = sections[0]?.labelFontWeight;
    if (w === TIMELINE_BAR_LABEL_FIRST_SECTION) return undefined;
  }
  if (
    w === "normal" ||
    w === "bold" ||
    w === "100" ||
    w === "200" ||
    w === "300" ||
    w === "400" ||
    w === "500" ||
    w === "600" ||
    w === "700" ||
    w === "800" ||
    w === "900"
  )
    return w;
  return undefined;
}

function effectiveTimelineBarLabelFontStyle(
  seg: TimelineBarSectionData,
  sectionIndex: number,
  sections: TimelineBarSectionData[],
): DiagramNodeData["fontStyle"] | undefined {
  let fst = seg.labelFontStyle;
  if (fst === TIMELINE_BAR_LABEL_FIRST_SECTION) {
    if (sectionIndex === 0) return undefined;
    fst = sections[0]?.labelFontStyle;
    if (fst === TIMELINE_BAR_LABEL_FIRST_SECTION) return undefined;
  }
  if (fst === "normal" || fst === "italic" || fst === "oblique") return fst;
  return undefined;
}

function effectiveTimelineBarLabelTextDecoration(
  seg: TimelineBarSectionData,
  sectionIndex: number,
  sections: TimelineBarSectionData[],
): DiagramNodeData["textDecoration"] | undefined {
  let td = seg.labelTextDecoration;
  if (td === TIMELINE_BAR_LABEL_FIRST_SECTION) {
    if (sectionIndex === 0) return undefined;
    td = sections[0]?.labelTextDecoration;
    if (td === TIMELINE_BAR_LABEL_FIRST_SECTION) return undefined;
  }
  if (td === "none" || td === "underline" || td === "overline" || td === "line-through") return td;
  return undefined;
}

/** Resolved horizontal text-align for SVG/HTML (`full` → `justify`). */
export function timelineBarSectionResolvedTextAlign(
  seg: TimelineBarSectionData,
  sectionIndex: number,
  sections: TimelineBarSectionData[],
  node: DiagramNodeData,
): "left" | "center" | "right" | "justify" {
  const eff = effectiveTimelineBarLabelTextJustify(seg, sectionIndex, sections);
  const j = eff ?? node.textJustify ?? "center";
  return j === "full" ? "justify" : j;
}

/** Vertical placement of the bar label inside the segment foreignObject. */
export function timelineBarSectionResolvedVerticalJustify(
  seg: TimelineBarSectionData,
  sectionIndex: number,
  sections: TimelineBarSectionData[],
  node: DiagramNodeData,
): "flex-start" | "center" | "flex-end" {
  const eff = effectiveTimelineBarLabelVerticalAlign(seg, sectionIndex, sections);
  const v = eff ?? node.textVerticalPosition ?? "middle";
  return v === "top" ? "flex-start" : v === "bottom" ? "flex-end" : "center";
}

export function timelineBarSectionResolvedFontWeight(
  seg: TimelineBarSectionData,
  sectionIndex: number,
  sections: TimelineBarSectionData[],
  node: DiagramNodeData,
): string | number {
  const eff = effectiveTimelineBarLabelFontWeight(seg, sectionIndex, sections);
  const w = eff ?? node.fontWeight;
  if (w === undefined || w === null) return 600;
  return w;
}

export function timelineBarSectionResolvedFontFamily(
  seg: TimelineBarSectionData,
  sectionIndex: number,
  sections: TimelineBarSectionData[],
  node: DiagramNodeData,
): string {
  const eff = effectiveTimelineBarLabelFontFamily(seg, sectionIndex, sections);
  const raw = eff ?? node.fontFamily;
  return (typeof raw === "string" ? raw.trim() : "") || "ui-sans-serif, system-ui, sans-serif";
}

export function timelineBarSectionResolvedFontSizePx(
  seg: TimelineBarSectionData,
  sectionIndex: number,
  sections: TimelineBarSectionData[],
  node: DiagramNodeData,
): number {
  const eff = effectiveTimelineBarLabelFontSize(seg, sectionIndex, sections);
  return Number(eff ?? node.fontSize) || 12;
}

export function timelineBarSectionResolvedFontStyle(
  seg: TimelineBarSectionData,
  sectionIndex: number,
  sections: TimelineBarSectionData[],
  node: DiagramNodeData,
): DiagramNodeData["fontStyle"] {
  return effectiveTimelineBarLabelFontStyle(seg, sectionIndex, sections) ?? node.fontStyle ?? "normal";
}

export function timelineBarSectionResolvedTextDecoration(
  seg: TimelineBarSectionData,
  sectionIndex: number,
  sections: TimelineBarSectionData[],
  node: DiagramNodeData,
): DiagramNodeData["textDecoration"] {
  return (
    effectiveTimelineBarLabelTextDecoration(seg, sectionIndex, sections) ?? node.textDecoration ?? "none"
  );
}

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
      const jRaw = s.labelTextJustify;
      let labelTextJustify: TimelineBarSectionData["labelTextJustify"] | undefined;
      if (
        jRaw === "left" ||
        jRaw === "center" ||
        jRaw === "right" ||
        jRaw === "full" ||
        jRaw === TIMELINE_BAR_LABEL_FIRST_SECTION
      ) {
        if (!(i === 0 && jRaw === TIMELINE_BAR_LABEL_FIRST_SECTION)) {
          labelTextJustify = jRaw;
        }
      }
      const vaRaw = s.labelVerticalAlign;
      let labelVerticalAlign: TimelineBarSectionData["labelVerticalAlign"] | undefined;
      if (
        vaRaw === "top" ||
        vaRaw === "middle" ||
        vaRaw === "bottom" ||
        vaRaw === TIMELINE_BAR_LABEL_FIRST_SECTION
      ) {
        if (!(i === 0 && vaRaw === TIMELINE_BAR_LABEL_FIRST_SECTION)) {
          labelVerticalAlign = vaRaw;
        }
      }
      const fwRaw = s.labelFontWeight;
      let labelFontWeight: TimelineBarSectionData["labelFontWeight"] | undefined;
      if (fwRaw === TIMELINE_BAR_LABEL_FIRST_SECTION) {
        if (i > 0) labelFontWeight = fwRaw;
      } else if (
        fwRaw === "normal" ||
        fwRaw === "bold" ||
        fwRaw === "100" ||
        fwRaw === "200" ||
        fwRaw === "300" ||
        fwRaw === "400" ||
        fwRaw === "500" ||
        fwRaw === "600" ||
        fwRaw === "700" ||
        fwRaw === "800" ||
        fwRaw === "900"
      ) {
        labelFontWeight = fwRaw;
      }
      const fstRaw = s.labelFontStyle;
      let labelFontStyle: TimelineBarSectionData["labelFontStyle"] | undefined;
      if (fstRaw === TIMELINE_BAR_LABEL_FIRST_SECTION) {
        if (i > 0) labelFontStyle = fstRaw;
      } else if (fstRaw === "normal" || fstRaw === "italic" || fstRaw === "oblique") {
        labelFontStyle = fstRaw;
      }
      const tdRaw = s.labelTextDecoration;
      let labelTextDecoration: TimelineBarSectionData["labelTextDecoration"] | undefined;
      if (tdRaw === TIMELINE_BAR_LABEL_FIRST_SECTION) {
        if (i > 0) labelTextDecoration = tdRaw;
      } else if (
        tdRaw === "none" ||
        tdRaw === "underline" ||
        tdRaw === "overline" ||
        tdRaw === "line-through"
      ) {
        labelTextDecoration = tdRaw;
      }

      let labelFontFamily: string | undefined;
      const famRaw = typeof s.labelFontFamily === "string" ? s.labelFontFamily.trim() : "";
      if (famRaw === TIMELINE_BAR_LABEL_FIRST_SECTION) {
        if (i > 0) labelFontFamily = TIMELINE_BAR_LABEL_FIRST_SECTION;
      } else if (famRaw) {
        labelFontFamily = famRaw;
      }

      let labelFontSize: TimelineBarSectionData["labelFontSize"] | undefined;
      const szRaw = s.labelFontSize;
      if (szRaw === TIMELINE_BAR_LABEL_FIRST_SECTION) {
        if (i > 0) labelFontSize = TIMELINE_BAR_LABEL_FIRST_SECTION;
      } else if (typeof szRaw === "number" && Number.isFinite(szRaw) && szRaw > 0) {
        labelFontSize = szRaw;
      }

      const richLabelNorm =
        Array.isArray(s.richLabel) && s.richLabel.length > 0 ? normalizeRuns(s.richLabel) : undefined;

      return {
        id: typeof s.id === "string" && s.id ? s.id : `tb-${i}`,
        label: s.label,
        ...(richLabelNorm && richLabelNorm.length > 0 ? { richLabel: richLabelNorm } : {}),
        fill: baseFill,
        fillStyle,
        fillGradientColors,
        fillGradientAngle,
        weight: typeof s.weight === "number" && Number.isFinite(s.weight) && s.weight > 0 ? s.weight : 1,
        ...(hasSpan ? { spanStart, spanEnd } : {}),
        tickLabel: s.tickLabel,
        labelColor: s.labelColor,
        ...(labelTextJustify ? { labelTextJustify } : {}),
        ...(labelVerticalAlign ? { labelVerticalAlign } : {}),
        ...(labelFontFamily ? { labelFontFamily } : {}),
        ...(labelFontSize !== undefined ? { labelFontSize } : {}),
        ...(labelFontWeight ? { labelFontWeight } : {}),
        ...(labelFontStyle ? { labelFontStyle } : {}),
        ...(labelTextDecoration ? { labelTextDecoration } : {}),
        ...(typeof s.segmentOutlineColor === "string" && s.segmentOutlineColor.trim()
          ? { segmentOutlineColor: s.segmentOutlineColor.trim() }
          : {}),
        ...(typeof s.segmentOutlineWidth === "number" &&
        Number.isFinite(s.segmentOutlineWidth) &&
        s.segmentOutlineWidth >= 0
          ? { segmentOutlineWidth: s.segmentOutlineWidth }
          : {}),
        ...(s.segmentOutlineStyle === "solid" || s.segmentOutlineStyle === "dotted" || s.segmentOutlineStyle === "none"
          ? { segmentOutlineStyle: s.segmentOutlineStyle }
          : {}),
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
    timelineBarOrientation?: string;
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
    timelineBarLabelsFollowFirstSection?: boolean;
    fontSize?: number;
    fontFamily?: string;
    textJustify?: string;
    textVerticalPosition?: string;
    fontWeight?: string;
    fontStyle?: string;
    textDecoration?: string;
    textOpacity?: number;
    lineHeight?: number;
    letterSpacing?: number;
    textTransform?: string;
  };
  return JSON.stringify([
    x.timelineBarSections,
    x.timelineBarSizing,
    x.timelineBarOrientation,
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
    x.timelineBarAxisLabelFontSize,
    x.timelineBarAxisLabelFontFamily,
    x.timelineBarLabelsFollowFirstSection,
    x.fontSize,
    x.fontFamily,
    x.textJustify,
    x.textVerticalPosition,
    x.fontWeight,
    x.fontStyle,
    x.textDecoration,
    x.textOpacity,
    x.lineHeight,
    x.letterSpacing,
    x.textTransform,
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
