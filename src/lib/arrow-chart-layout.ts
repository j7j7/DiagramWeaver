import type {
  ArrowChartColorMode,
  ArrowChartDirection,
  ArrowChartFillStyle,
  ArrowChartItem,
  ArrowChartStyle,
  DiagramNodeData,
  NodeChartSpecArrow,
} from "@/lib/types";
import { lerpColors, multiplyLightnessOfColor, shiftHueOfColor } from "@/lib/color-shift";
import { DIAGRAM_THEME_HUE_STEP_DEG } from "@/lib/theme-menu-hue-step";
import { newChartSliceId } from "@/lib/grid-chart-layout";
import { buildArrowSegmentPath, type ArrowSegmentPaint } from "@/lib/arrow-chart-paths";

export const ARROW_MIN_ITEMS = 2;
export const ARROW_MAX_ITEMS = 16;
export const ARROW_CHART_DEFAULT_SIDE = 480;
export const ARROW_SEGMENT_FILL = "#8d89e1";
export const ARROW_INNER_RATIO_MIN = 0.28;
export const ARROW_INNER_RATIO_MAX = 0.72;
export const ARROW_INNER_RATIO_DEFAULT = 0.52;
export const ARROW_GAP_DEG_MIN = 0.4;
export const ARROW_GAP_DEG_MAX = 14;
export const ARROW_GAP_DEG_DEFAULT = 3;
export const ARROW_GAP_DEG_OVERLAP = 0;
export const ARROW_START_ANGLE_DEG_MIN = -45;
export const ARROW_START_ANGLE_DEG_MAX = 45;
export const ARROW_START_ANGLE_DEG_DEFAULT = 0;
export const ARROW_SEGMENT_BORDER = "#ffffff";
export const ARROW_SEGMENT_BORDER_WIDTH_MIN = 0;
export const ARROW_SEGMENT_BORDER_WIDTH_MAX = 8;
export const ARROW_SEGMENT_BORDER_WIDTH_DEFAULT = 1.5;

export interface ArrowLayoutItem {
  index: number;
  id: string;
  angle: number;
  rotation: number;
  cx: number;
  cy: number;
  textX: number;
  textY: number;
  textW: number;
  textH: number;
  title: string;
  subtitle: string;
  fill: string;
  fillStart: string;
  fillStyle: ArrowChartFillStyle;
  textColor: string;
  titleFont: number;
  subtitleFont: number;
  path: string;
  headOverlay: string;
  headBorder: string;
  bodyBorder?: string;
  tailBorder?: string;
  headRim: string;
  paint: ArrowSegmentPaint;
  gradFrom: number;
  gradTo: number;
}

export interface ArrowChartLayout {
  vbW: number;
  vbH: number;
  cx: number;
  cy: number;
  rOuter: number;
  rInner: number;
  rFan: number;
  clockwise: boolean;
  arrowStyle: ArrowChartStyle;
  items: ArrowLayoutItem[];
  segmentBorder: string;
  segmentBorderWidth: number;
  body: { x: number; y: number; w: number; h: number; rx: number; ry: number };
}

export function clampArrowItemCount(n: number): number {
  if (!Number.isFinite(n)) return ARROW_MIN_ITEMS;
  return Math.min(ARROW_MAX_ITEMS, Math.max(ARROW_MIN_ITEMS, Math.round(n)));
}

export function normalizeArrowItems(items: ArrowChartItem[] | undefined): ArrowChartItem[] {
  const list = Array.isArray(items) ? items : [];
  const sliced = list.slice(0, ARROW_MAX_ITEMS).map((item, i) => ({
    ...item,
    id: item.id?.trim() || newChartSliceId(),
    title: item.title ?? `Step ${i + 1}`,
  }));
  if (sliced.length >= ARROW_MIN_ITEMS) return sliced;
  const next = [...sliced];
  while (next.length < ARROW_MIN_ITEMS) {
    const i = next.length;
    next.push({ id: newChartSliceId(), title: `Step ${i + 1}` });
  }
  return next;
}

export function arrowChartSquareSide(width?: number, height?: number): number {
  const w = typeof width === "number" && Number.isFinite(width) ? width : ARROW_CHART_DEFAULT_SIDE;
  const h = typeof height === "number" && Number.isFinite(height) ? height : w;
  return Math.max(160, Math.min(w, h));
}

export function resolveArrowHueStepDeg(chart: Pick<NodeChartSpecArrow, "hueStepDeg">): number {
  if (typeof chart.hueStepDeg === "number" && Number.isFinite(chart.hueStepDeg)) {
    return Math.min(360, Math.max(1, chart.hueStepDeg));
  }
  return DIAGRAM_THEME_HUE_STEP_DEG;
}

export function resolveArrowStyle(chart: Pick<NodeChartSpecArrow, "arrowStyle">): ArrowChartStyle {
  if (chart.arrowStyle === "overlap" || chart.arrowStyle === "triangle") return chart.arrowStyle;
  return "chevron";
}

export function resolveArrowDirection(
  chart: Pick<NodeChartSpecArrow, "direction">
): ArrowChartDirection {
  return chart.direction === "anticlockwise" ? "anticlockwise" : "clockwise";
}

export function resolveArrowColorMode(
  chart: Pick<NodeChartSpecArrow, "colorMode">
): ArrowChartColorMode {
  if (chart.colorMode === "hint" || chart.colorMode === "hue-step") return chart.colorMode;
  return "same";
}

export function resolveArrowFillStyle(
  chart: Pick<NodeChartSpecArrow, "segmentFillStyle">
): ArrowChartFillStyle {
  return chart.segmentFillStyle === "gradient" ? "gradient" : "solid";
}

export function resolveArrowGapDeg(
  chart: Pick<NodeChartSpecArrow, "gapDeg" | "arrowStyle">
): number {
  if (resolveArrowStyle(chart) === "overlap") return ARROW_GAP_DEG_OVERLAP;
  if (typeof chart.gapDeg === "number" && Number.isFinite(chart.gapDeg)) {
    return Math.min(ARROW_GAP_DEG_MAX, Math.max(ARROW_GAP_DEG_MIN, chart.gapDeg));
  }
  return ARROW_GAP_DEG_DEFAULT;
}

export function resolveArrowStartAngleDeg(
  chart: Pick<NodeChartSpecArrow, "startAngleDeg">
): number {
  if (typeof chart.startAngleDeg === "number" && Number.isFinite(chart.startAngleDeg)) {
    return Math.min(
      ARROW_START_ANGLE_DEG_MAX,
      Math.max(ARROW_START_ANGLE_DEG_MIN, chart.startAngleDeg)
    );
  }
  return ARROW_START_ANGLE_DEG_DEFAULT;
}

export function defaultArrowSegmentFillStart(end: string): string {
  return lerpColors(end, "#ffffff", 0.5);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function hexLuminance(input: string): number {
  const s = input.trim();
  if (!s.startsWith("#")) return 0.45;
  let h = s.slice(1);
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length !== 6 && h.length !== 8) return 0.45;
  const n = parseInt(h.length === 8 ? h.slice(0, 6) : h, 16);
  if (Number.isNaN(n)) return 0.45;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function autoTextColor(fill: string): string {
  return hexLuminance(fill) < 0.55 ? "#f8fafc" : "#1e2937";
}

/** One label colour for all segments (chart → node text → contrast vs base fill). */
export function resolveArrowSegmentTextColor(
  chart: Pick<NodeChartSpecArrow, "segmentTextColor" | "segmentFill">,
  node: Pick<DiagramNodeData, "textColor">
): string {
  const fromChart = chart.segmentTextColor?.trim();
  if (fromChart) return fromChart;
  const fromNode = node.textColor?.trim();
  if (fromNode) return fromNode;
  const baseFill = chart.segmentFill?.trim() || ARROW_SEGMENT_FILL;
  return autoTextColor(baseFill);
}

function hintFill(base: string, index: number, count: number): string {
  const t = count <= 1 ? 0.5 : index / (count - 1);
  const dark = multiplyLightnessOfColor(base, 0.52);
  const light = lerpColors(base, "#ffffff", 0.42);
  return lerpColors(dark, light, t);
}

function applyColorMode(
  base: string,
  index: number,
  count: number,
  mode: ArrowChartColorMode,
  hueStepDeg: number
): string {
  if (mode === "hue-step") return shiftHueOfColor(base, index * hueStepDeg);
  if (mode === "hint") return hintFill(base, index, count);
  return base;
}

function segmentColorsFor(
  item: ArrowChartItem,
  index: number,
  count: number,
  baseEnd: string,
  baseStart: string,
  mode: ArrowChartColorMode,
  hueStepDeg: number,
  fillStyle: ArrowChartFillStyle
): { fill: string; fillStart: string; fillStyle: ArrowChartFillStyle } {
  const explicit = item.fill?.trim();
  if (explicit) return { fill: explicit, fillStart: explicit, fillStyle: "solid" };
  const fill = applyColorMode(baseEnd, index, count, mode, hueStepDeg);
  const fillStart = applyColorMode(baseStart, index, count, mode, hueStepDeg);
  return { fill, fillStart, fillStyle };
}

export function arrowItemRotation(angle: number, clockwise: boolean): number {
  let rotation = clockwise ? angle + Math.PI / 2 : angle - Math.PI / 2;
  if (Math.cos(rotation) < 0) rotation += Math.PI;
  return rotation;
}

/** First segment centre angle; slight CCW offset so the top wedge reads level on screen. */
export function arrowChartRingStartAngle(itemCount: number, startAngleOffsetDeg = 0): number {
  const n = Math.max(1, itemCount);
  const span = (Math.PI * 2) / n;
  const offsetRad = (startAngleOffsetDeg * Math.PI) / 180;
  return -Math.PI / 2 - span / 8 + offsetRad;
}

export function arrowSegmentSlotIndexFromAngle(
  angle: number,
  count: number,
  clockwise: boolean,
  startAngleOffsetDeg = 0
): number {
  const n = Math.max(1, count);
  const twoPi = Math.PI * 2;
  const start = arrowChartRingStartAngle(n, startAngleOffsetDeg);
  let a = (angle - start) % twoPi;
  if (a < 0) a += twoPi;
  if (!clockwise) a = (twoPi - a) % twoPi;
  const step = twoPi / n;
  return Math.round(a / step) % n;
}

export function buildArrowChartLayout(
  node: Pick<DiagramNodeData, "width" | "height" | "cornerRadius" | "textColor">,
  chart: NodeChartSpecArrow
): ArrowChartLayout {
  const side = arrowChartSquareSide(node.width, node.height);
  const vbW = side;
  const vbH = side;
  const cx = vbW / 2;
  const cy = vbH / 2;
  const itemsIn = normalizeArrowItems(chart.items);
  const n = itemsIn.length;
  const pad = Math.max(8, side * 0.03);
  const rOuter = Math.max(40, side / 2 - pad);
  const innerRatio = clamp(
    typeof chart.innerRatio === "number" && Number.isFinite(chart.innerRatio)
      ? chart.innerRatio
      : ARROW_INNER_RATIO_DEFAULT,
    ARROW_INNER_RATIO_MIN,
    ARROW_INNER_RATIO_MAX
  );
  const rInner = Math.max(12, rOuter * innerRatio);
  const thickness = rOuter - rInner;
  const rMid = (rInner + rOuter) / 2;
  const clockwise = resolveArrowDirection(chart) === "clockwise";
  const dir = clockwise ? 1 : -1;
  const arrowStyle = resolveArrowStyle(chart);
  const colorMode = resolveArrowColorMode(chart);
  const fillStyle = resolveArrowFillStyle(chart);
  const hueStepDeg = resolveArrowHueStepDeg(chart);
  const baseFill = chart.segmentFill?.trim() || ARROW_SEGMENT_FILL;
  const baseFillStart = chart.segmentFillStart?.trim() || defaultArrowSegmentFillStart(baseFill);
  const gapDeg = resolveArrowGapDeg(chart);
  const startAngleDeg = resolveArrowStartAngleDeg(chart);
  const span = (Math.PI * 2) / n;
  const gapRad = (gapDeg * Math.PI) / 180;
  const bodySpan = Math.max(span * 0.35, span - gapRad);
  const halfBody = bodySpan / 2;
  const chevronAng = clamp((thickness * 0.62) / Math.max(rMid, 1), 0.06, halfBody * 0.55);
  const flare = arrowStyle === "triangle" ? thickness * 0.2 : 0;
  const startAngle = arrowChartRingStartAngle(n, startAngleDeg);
  const titleFont = clamp(thickness * 0.22, 9, 16);
  const subtitleFont = clamp(titleFont * 0.72, 7, 12);
  const textH = clamp(thickness * 0.62, 22, 64);
  const textW = clamp(rMid * bodySpan * 0.72, 36, 140);
  const textBias =
    arrowStyle === "overlap"
      ? halfBody * 0.1
      : Math.min(halfBody * 0.34, chevronAng * 0.68);
  const segmentTextColor = resolveArrowSegmentTextColor(chart, node);

  const items: ArrowLayoutItem[] = itemsIn.map((item, i) => {
    const angle = startAngle + i * dir * span;
    const start = angle - dir * halfBody;
    const end = angle + dir * halfBody;
    const built = buildArrowSegmentPath({
      cx,
      cy,
      rInner,
      rOuter,
      start,
      end,
      clockwise,
      style: arrowStyle,
      chevronAng,
      flare,
    });
    const colors = segmentColorsFor(
      item,
      i,
      n,
      baseFill,
      baseFillStart,
      colorMode,
      hueStepDeg,
      fillStyle
    );
    const textAngle = angle + dir * textBias;
    const tx = cx + rMid * Math.cos(textAngle);
    const ty = cy + rMid * Math.sin(textAngle);
    return {
      index: i,
      id: item.id,
      angle,
      rotation: arrowItemRotation(textAngle, clockwise),
      cx: tx,
      cy: ty,
      textX: tx - textW / 2,
      textY: ty - textH / 2,
      textW,
      textH,
      title: item.title,
      subtitle: item.subtitle ?? "",
      fill: colors.fill,
      fillStart: colors.fillStart,
      fillStyle: colors.fillStyle,
      textColor: item.textColor?.trim() || segmentTextColor,
      titleFont,
      subtitleFont,
      path: built.path,
      headOverlay: built.headOverlay,
      headBorder: built.headBorder,
      bodyBorder: built.bodyBorder,
      tailBorder: built.tailBorder,
      headRim: built.headRim,
      paint: built.paint,
      gradFrom: built.gradFrom,
      gradTo: built.gradTo,
    };
  });

  const corner = typeof node.cornerRadius === "number" ? node.cornerRadius : 0.08;
  const bodyRx = Math.min(vbW, vbH) * Math.max(0, Math.min(1, corner)) * 0.12;
  const rawBorderW =
    typeof chart.segmentBorderWidth === "number" && Number.isFinite(chart.segmentBorderWidth)
      ? chart.segmentBorderWidth
      : 0;
  const segmentBorderWidth = clamp(
    rawBorderW,
    ARROW_SEGMENT_BORDER_WIDTH_MIN,
    ARROW_SEGMENT_BORDER_WIDTH_MAX
  );

  return {
    vbW,
    vbH,
    cx,
    cy,
    rOuter,
    rInner,
    rFan: rOuter + flare + 8,
    clockwise,
    arrowStyle,
    items,
    segmentBorder: chart.segmentBorder?.trim() || ARROW_SEGMENT_BORDER,
    segmentBorderWidth,
    body: { x: 0.5, y: 0.5, w: vbW - 1, h: vbH - 1, rx: bodyRx, ry: bodyRx },
  };
}

export function arrowItemRotateTransform(
  item: Pick<ArrowLayoutItem, "rotation" | "cx" | "cy">
): string | undefined {
  if (!item.rotation) return undefined;
  return `rotate(${(item.rotation * 180) / Math.PI} ${item.cx} ${item.cy})`;
}
