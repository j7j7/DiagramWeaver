import type {
  DiagramNodeData,
  LoopChartItem,
  NodeChartSpecLoop,
} from "@/lib/types";
import { newChartSliceId } from "@/lib/grid-chart-layout";

export const LOOP_MIN_ITEMS = 1;
export const LOOP_MAX_ITEMS = 16;

export const LOOP_HUB_FILL = "#1e2937";
export const LOOP_HUB_TEXT = "#f8fafc";
export const LOOP_HUB_BORDER = "#1e2937";
export const LOOP_ITEM_FILL = "#ffffff";
export const LOOP_ITEM_BORDER = "#4b5563";
export const LOOP_ITEM_TEXT = "#374151";
export const LOOP_ARROW = "#4b5563";
export const LOOP_INWARD = "#9ca3af";
export const LOOP_SPOKE_TEXT = "#6b7280";
export const LOOP_ARROW_WIDTH_MIN = 0.5;
export const LOOP_ARROW_WIDTH_MAX = 6;
/** Midpoint of the auto-scaled default at the standard 520 side. */
export const LOOP_ARROW_WIDTH_DEFAULT = 1.65;

export interface LoopLayoutItem {
  index: number;
  id: string;
  angle: number;
  /** SVG rotate around (cx, cy), radians. 0 when boxes stay upright. */
  rotation: number;
  cx: number;
  cy: number;
  x: number;
  y: number;
  w: number;
  h: number;
  rx: number;
  title: string;
  subtitle: string;
  spokeLabel: string;
  fill: string;
  border: string;
  textColor: string;
  titleFont: number;
  subtitleFont: number;
}

export interface LoopLayoutArrow {
  d: string;
  head: { x: number; y: number; angle: number };
}

export interface LoopLayoutSpoke {
  itemIndex: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  tipX: number;
  tipY: number;
  headAngle: number;
  label?: { text: string; x: number; y: number; angle: number };
}

export interface LoopChartLayout {
  vbW: number;
  vbH: number;
  cx: number;
  cy: number;
  radius: number;
  itemW: number;
  itemH: number;
  hub: { x: number; y: number; w: number; h: number; rx: number };
  hubFill: string;
  hubBorder: string;
  hubTextColor: string;
  title: string;
  subtitle: string;
  titleFont: number;
  subtitleFont: number;
  items: LoopLayoutItem[];
  loopArrows: LoopLayoutArrow[];
  spokes: LoopLayoutSpoke[];
  showInwardArrows: boolean;
  rotateItems: boolean;
  arrowColor: string;
  inwardArrowColor: string;
  spokeLabelColor: string;
  arrowWidth: number;
  arrowHeadSize: number;
  inwardArrowHeadSize: number;
  body: { x: number; y: number; w: number; h: number; rx: number; ry: number };
}

export function clampLoopItemCount(n: number): number {
  if (!Number.isFinite(n)) return LOOP_MIN_ITEMS;
  return Math.min(LOOP_MAX_ITEMS, Math.max(LOOP_MIN_ITEMS, Math.round(n)));
}

export function normalizeLoopItems(items: LoopChartItem[] | undefined): LoopChartItem[] {
  const list = Array.isArray(items) ? items : [];
  return list.slice(0, LOOP_MAX_ITEMS).map((item, i) => ({
    ...item,
    id: item.id?.trim() || newChartSliceId(),
    title: item.title ?? `Step ${i + 1}`,
  }));
}

/** Intersection of a ray from a rect centre at `angle` with the rect edge. */
export function rayRectExit(
  cx: number,
  cy: number,
  w: number,
  h: number,
  angle: number
): { x: number; y: number } {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const hw = w / 2;
  const hh = h / 2;
  const tx = Math.abs(dx) < 1e-8 ? Number.POSITIVE_INFINITY : hw / Math.abs(dx);
  const ty = Math.abs(dy) < 1e-8 ? Number.POSITIVE_INFINITY : hh / Math.abs(dy);
  const t = Math.min(tx, ty);
  return { x: cx + t * dx, y: cy + t * dy };
}

export function loopItemSlotIndexFromAngle(angle: number, count: number): number {
  const n = Math.max(1, count);
  const twoPi = Math.PI * 2;
  const start = -Math.PI / 2;
  let a = (angle - start) % twoPi;
  if (a < 0) a += twoPi;
  const step = twoPi / n;
  return Math.round(a / step) % n;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** Pull the shaft back from the arrow tip so the head sits cleanly on thick strokes. */
export function loopShaftInset(headSize: number, strokeWidth: number): number {
  return Math.max(headSize * 0.62, strokeWidth * 0.42);
}

export function formatLoopArrowHeadPoints(
  tipX: number,
  tipY: number,
  angle: number,
  size: number
): string {
  const ax = tipX - size * Math.cos(angle - 0.45);
  const ay = tipY - size * Math.sin(angle - 0.45);
  const bx = tipX - size * Math.cos(angle + 0.45);
  const by = tipY - size * Math.sin(angle + 0.45);
  return `${tipX},${tipY} ${ax},${ay} ${bx},${by}`;
}

function shortenSegment(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  startPad: number,
  endPad: number
): { x1: number; y1: number; x2: number; y2: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 1e-3) return { x1, y1, x2, y2 };
  const ux = dx / len;
  const uy = dy / len;
  const s = Math.min(startPad, len * 0.35);
  const e = Math.min(endPad, len * 0.35);
  return { x1: x1 + ux * s, y1: y1 + uy * s, x2: x2 - ux * e, y2: y2 - uy * e };
}

function clockwiseMidAngle(from: number, to: number): number {
  let end = to;
  const twoPi = Math.PI * 2;
  while (end <= from) end += twoPi;
  return from + (end - from) / 2;
}

function offsetAtAngle(
  x: number,
  y: number,
  angle: number,
  dist: number
): { x: number; y: number } {
  return { x: x + dist * Math.cos(angle), y: y + dist * Math.sin(angle) };
}

/**
 * Ring arrow from box A to box B.
 * Attaches at the side-centres (clockwise tangent out of A, counter-clockwise into B)
 * so cardinal items hit mid-side; cubic handles keep the head aimed at B's centre.
 */
function loopRingArrow(
  a: LoopLayoutItem,
  b: LoopLayoutItem,
  cx: number,
  cy: number,
  radius: number,
  shaftInset: number
): LoopLayoutArrow {
  const outA = a.angle + Math.PI / 2;
  const inB = b.angle - Math.PI / 2;
  const rawStart = rayRectExit(a.cx, a.cy, a.w, a.h, outA);
  const rawEnd = rayRectExit(b.cx, b.cy, b.w, b.h, inB);
  const gap = Math.hypot(rawStart.x - rawEnd.x, rawStart.y - rawEnd.y);
  const pad = Math.min(10, Math.max(5, gap * 0.08));
  const start = offsetAtAngle(rawStart.x, rawStart.y, outA, pad);
  const end = offsetAtAngle(rawEnd.x, rawEnd.y, inB, pad);
  const mid = clockwiseMidAngle(a.angle, b.angle);
  const ctrl = {
    x: cx + radius * Math.cos(mid),
    y: cy + radius * Math.sin(mid),
  };
  const handle = Math.min(
    gap * 0.42,
    radius * 0.42,
    Math.hypot(ctrl.x - start.x, ctrl.y - start.y) * 0.7,
    Math.hypot(ctrl.x - end.x, ctrl.y - end.y) * 0.7
  );
  const c1 = offsetAtAngle(start.x, start.y, outA, handle);
  const headAngle = Math.atan2(b.cy - end.y, b.cx - end.x);
  const shaftEnd = offsetAtAngle(end.x, end.y, headAngle + Math.PI, shaftInset);
  const c2 = offsetAtAngle(shaftEnd.x, shaftEnd.y, inB, handle);
  return {
    d: `M ${start.x} ${start.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${shaftEnd.x} ${shaftEnd.y}`,
    head: { x: end.x, y: end.y, angle: headAngle },
  };
}

function polar(cx: number, cy: number, r: number, angle: number): { x: number; y: number } {
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

/**
 * Clockwise circular arc from the clockwise side of A to the counter-clockwise side of B
 * (pie-slice gap on the item ring).
 */
function loopPieSliceArrow(
  a: LoopLayoutItem,
  b: LoopLayoutItem,
  cx: number,
  cy: number,
  radius: number,
  shaftInset: number
): LoopLayoutArrow {
  const hw = a.w / 2;
  const half = Math.atan2(hw, Math.max(1, radius));
  const r = Math.hypot(radius, hw);
  let startA = a.angle + half;
  let endA = b.angle - half;
  const twoPi = Math.PI * 2;
  while (endA <= startA) endA += twoPi;
  const span = endA - startA;
  const pad = Math.min(span * 0.12, 0.1);
  startA += pad;
  endA -= pad;
  if (endA <= startA) {
    const mid = (startA + endA + pad * 2) / 2;
    startA = mid - 0.04;
    endA = mid + 0.04;
  }
  const start = polar(cx, cy, r, startA);
  const end = polar(cx, cy, r, endA);
  const headAngle = endA + Math.PI / 2;
  const shaftEndA = Math.max(startA + 0.02, endA - shaftInset / Math.max(r, 1));
  const shaftEnd = polar(cx, cy, r, shaftEndA);
  const large = shaftEndA - startA > Math.PI ? 1 : 0;
  return {
    d: `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${shaftEnd.x} ${shaftEnd.y}`,
    head: { x: end.x, y: end.y, angle: headAngle },
  };
}

export const LOOP_CHART_DEFAULT_SIDE = 520;

/** Loop charts always layout in a square so the satellite ring stays circular. */
export function loopChartSquareSide(width?: number, height?: number): number {
  const w = typeof width === "number" && Number.isFinite(width) ? width : LOOP_CHART_DEFAULT_SIDE;
  const h = typeof height === "number" && Number.isFinite(height) ? height : w;
  return Math.max(160, Math.min(w, h));
}

export function buildLoopChartLayout(
  node: Pick<DiagramNodeData, "width" | "height" | "cornerRadius">,
  chart: NodeChartSpecLoop
): LoopChartLayout {
  const side = loopChartSquareSide(node.width, node.height);
  const vbW = side;
  const vbH = side;
  const cx = vbW / 2;
  const cy = vbH / 2;
  const itemsIn = normalizeLoopItems(chart.items);
  const n = Math.max(1, itemsIn.length);
  const sizeBudget = Math.min(vbW, vbH);
  const pad = Math.max(10, sizeBudget * 0.035);

  const rotateItems = chart.rotateItems === true;
  let itemW = clamp(sizeBudget * (0.3 - Math.min(n, 12) * 0.01), 64, 168);
  let itemH = clamp(itemW * 0.52, 40, 86);
  const hubW = clamp(sizeBudget * 0.28, 88, 196);
  const hubH = clamp(hubW * 0.58, 52, 112);
  const itemClear = rotateItems
    ? itemH / 2 + itemW * 0.08
    : Math.hypot(itemW / 2, itemH / 2);
  const hubClear = Math.hypot(hubW / 2, hubH / 2);
  let radius = Math.min(vbW, vbH) / 2 - itemClear - pad;
  radius = Math.max(hubClear + itemClear + 18, radius);

  if (n >= 2) {
    if (rotateItems) {
      const innerR = Math.max(8, radius - itemH / 2);
      const half = Math.atan2(itemW / 2, innerR);
      const maxHalf = (Math.PI / n) * 0.82;
      if (half > maxHalf && maxHalf > 0.02) {
        const scale = maxHalf / half;
        itemW = Math.max(52, itemW * scale);
        itemH = Math.max(32, itemH * scale);
      }
    } else {
      const chord = 2 * radius * Math.sin(Math.PI / n);
      const maxDiag = chord * 0.82;
      const diag = Math.hypot(itemW, itemH);
      if (diag > maxDiag && maxDiag > 40) {
        const scale = maxDiag / diag;
        itemW = Math.max(52, itemW * scale);
        itemH = Math.max(32, itemH * scale);
      }
    }
  }

  const startAngle = -Math.PI / 2;
  const step = (Math.PI * 2) / n;
  const itemRx = Math.min(8, itemH * 0.18);
  const titleFont = clamp(itemH * 0.28, 9, 14);
  const subtitleFont = clamp(titleFont * 0.72, 7, 11);
  const itemFill = chart.itemFill?.trim() || LOOP_ITEM_FILL;
  const itemBorder = chart.itemBorder?.trim() || LOOP_ITEM_BORDER;
  const itemText = chart.itemTextColor?.trim() || LOOP_ITEM_TEXT;

  const items: LoopLayoutItem[] = itemsIn.map((item, i) => {
    const angle = startAngle + i * step;
    const ix = cx + radius * Math.cos(angle);
    const iy = cy + radius * Math.sin(angle);
    return {
      index: i,
      id: item.id,
      angle,
      rotation: loopItemRotation(angle, rotateItems),
      cx: ix,
      cy: iy,
      x: ix - itemW / 2,
      y: iy - itemH / 2,
      w: itemW,
      h: itemH,
      rx: itemRx,
      title: item.title,
      subtitle: item.subtitle ?? "",
      spokeLabel: item.spokeLabel ?? "",
      fill: item.fill?.trim() || itemFill,
      border: item.border?.trim() || itemBorder,
      textColor: item.textColor?.trim() || itemText,
      titleFont,
      subtitleFont,
    };
  });

  const autoArrowWidth = clamp(sizeBudget * 0.0032, 1.1, 2.2);
  const arrowWidth =
    typeof chart.arrowWidth === "number" && Number.isFinite(chart.arrowWidth)
      ? clamp(chart.arrowWidth, LOOP_ARROW_WIDTH_MIN, LOOP_ARROW_WIDTH_MAX)
      : autoArrowWidth;
  const arrowHeadSize = Math.max(arrowWidth * 3, 3.5);
  const inwardArrowHeadSize = Math.max(arrowWidth * 2.5, 3);
  const loopShaftTrim = loopShaftInset(arrowHeadSize, arrowWidth);
  const inwardShaftTrim = loopShaftInset(inwardArrowHeadSize, arrowWidth * 0.9);

  const loopArrows: LoopLayoutArrow[] = [];
  if (n >= 2) {
    for (let i = 0; i < n; i++) {
      const a = items[i]!;
      const b = items[(i + 1) % n]!;
      loopArrows.push(
        rotateItems
          ? loopPieSliceArrow(a, b, cx, cy, radius, loopShaftTrim)
          : loopRingArrow(a, b, cx, cy, radius, loopShaftTrim)
      );
    }
  }

  const showInwardArrows = chart.showInwardArrows !== false;
  const spokes: LoopLayoutSpoke[] = [];
  if (showInwardArrows) {
    for (const item of items) {
      const inner = rotateItems
        ? polar(cx, cy, Math.max(1, radius - item.h / 2), item.angle)
        : rayRectExit(item.cx, item.cy, item.w, item.h, item.angle + Math.PI);
      const hubEdge = rayRectExit(cx, cy, hubW, hubH, item.angle);
      const seg = shortenSegment(inner.x, inner.y, hubEdge.x, hubEdge.y, 3, 4);
      const headAngle = Math.atan2(seg.y2 - seg.y1, seg.x2 - seg.x1);
      const tipX = seg.x2;
      const tipY = seg.y2;
      const spoke: LoopLayoutSpoke = {
        itemIndex: item.index,
        x1: seg.x1,
        y1: seg.y1,
        x2: tipX - inwardShaftTrim * Math.cos(headAngle),
        y2: tipY - inwardShaftTrim * Math.sin(headAngle),
        tipX,
        tipY,
        headAngle,
      };
      const label = item.spokeLabel.trim();
      if (label) {
        const mx = (seg.x1 + seg.x2) / 2;
        const my = (seg.y1 + seg.y2) / 2;
        const dx = seg.x2 - seg.x1;
        const dy = seg.y2 - seg.y1;
        const len = Math.hypot(dx, dy) || 1;
        const px = (-dy / len) * 10;
        const py = (dx / len) * 10;
        spoke.label = { text: label, x: mx + px, y: my + py, angle: item.angle };
      }
      spokes.push(spoke);
    }
  }

  const corner = typeof node.cornerRadius === "number" ? node.cornerRadius : 0.08;
  const bodyRx = Math.min(vbW, vbH) * Math.max(0, Math.min(1, corner)) * 0.12;

  return {
    vbW,
    vbH,
    cx,
    cy,
    radius,
    itemW,
    itemH,
    hub: {
      x: cx - hubW / 2,
      y: cy - hubH / 2,
      w: hubW,
      h: hubH,
      rx: Math.min(10, hubH * 0.16),
    },
    hubFill: chart.hubFill?.trim() || LOOP_HUB_FILL,
    hubBorder: chart.hubBorder?.trim() || LOOP_HUB_BORDER,
    hubTextColor: chart.hubTextColor?.trim() || LOOP_HUB_TEXT,
    title: chart.title ?? "",
    subtitle: chart.subtitle ?? "",
    titleFont: clamp(hubH * 0.28, 11, 18),
    subtitleFont: clamp(hubH * 0.18, 8, 12),
    items,
    loopArrows,
    spokes,
    showInwardArrows,
    rotateItems,
    arrowColor: chart.arrowColor?.trim() || LOOP_ARROW,
    inwardArrowColor: chart.inwardArrowColor?.trim() || LOOP_INWARD,
    spokeLabelColor: chart.spokeLabelColor?.trim() || LOOP_SPOKE_TEXT,
    arrowWidth,
    arrowHeadSize,
    inwardArrowHeadSize,
    body: { x: 0.5, y: 0.5, w: vbW - 1, h: vbH - 1, rx: bodyRx, ry: bodyRx },
  };
}

/** Tangent-to-ring rotation; +π on the lower half so text stays upright. */
export function loopItemRotation(angle: number, rotateItems: boolean): number {
  if (!rotateItems) return 0;
  let rotation = angle + Math.PI / 2;
  if (Math.cos(rotation) < 0) rotation += Math.PI;
  return rotation;
}

export function loopItemRotateTransform(
  item: Pick<LoopLayoutItem, "rotation" | "cx" | "cy">
): string | undefined {
  if (!item.rotation) return undefined;
  return `rotate(${(item.rotation * 180) / Math.PI} ${item.cx} ${item.cy})`;
}
