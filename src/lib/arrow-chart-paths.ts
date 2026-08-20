import type { ArrowChartStyle } from "@/lib/types";

export interface ArrowPathPoint {
  x: number;
  y: number;
}

export type ArrowSegmentPaint = "fill" | "stroke-arc";

export interface ArrowSegmentPathSpec {
  path: string;
  /** Arrowhead drawn above the next segment's tail (including wrap-around). */
  headOverlay: string;
  /** Open outer outline of the head (no closing chord); used for segment border stroke. */
  headBorder: string;
  /** Open path along the leading tip, used when segment borders are on. */
  headRim: string;
  /**
   * `stroke-arc`: centreline at mid-radius; renderer strokes with ring thickness and round caps.
   * Keeps inner/outer edges circular (overlap style).
   */
  paint: ArrowSegmentPaint;
}

function polar(cx: number, cy: number, r: number, a: number): ArrowPathPoint {
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function n(v: number): string {
  return v.toFixed(3);
}

function pt(p: ArrowPathPoint): string {
  return `${n(p.x)} ${n(p.y)}`;
}

function wrapDelta(from: number, to: number, clockwise: boolean): number {
  let delta = to - from;
  const twoPi = Math.PI * 2;
  if (clockwise) {
    while (delta < 0) delta += twoPi;
    while (delta >= twoPi) delta -= twoPi;
  } else {
    while (delta > 0) delta -= twoPi;
    while (delta <= -twoPi) delta += twoPi;
  }
  return delta;
}

function arcTo(r: number, from: number, to: number, clockwise: boolean, dest: ArrowPathPoint): string {
  const abs = Math.abs(wrapDelta(from, to, clockwise));
  const large = abs > Math.PI + 1e-6 ? 1 : 0;
  const sweep = clockwise ? 1 : 0;
  return `A ${n(r)} ${n(r)} 0 ${large} ${sweep} ${pt(dest)}`;
}

function capArc(r: number, dest: ArrowPathPoint, clockwise: boolean): string {
  const sweep = clockwise ? 1 : 0;
  return `A ${n(r)} ${n(r)} 0 0 ${sweep} ${pt(dest)}`;
}

function chevronPath(
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
  start: number,
  end: number,
  chevronAng: number,
  clockwise: boolean
): ArrowSegmentPathSpec {
  const dir = clockwise ? 1 : -1;
  const rMid = (rInner + rOuter) / 2;
  const oS = polar(cx, cy, rOuter, start);
  const oE = polar(cx, cy, rOuter, end);
  const iS = polar(cx, cy, rInner, start);
  const iE = polar(cx, cy, rInner, end);
  const head = polar(cx, cy, rMid, end + dir * chevronAng);
  const tail = polar(cx, cy, rMid, start + dir * chevronAng);
  const back = end - dir * Math.min(0.08, Math.abs(wrapDelta(start, end, clockwise)) * 0.12);
  const oB = polar(cx, cy, rOuter, back);
  const iB = polar(cx, cy, rInner, back);
  const path = [
    `M ${pt(oS)}`,
    arcTo(rOuter, start, end, clockwise, oE),
    `L ${pt(head)}`,
    `L ${pt(iE)}`,
    arcTo(rInner, end, start, !clockwise, iS),
    `L ${pt(tail)}`,
    "Z",
  ].join(" ");
  const headOverlay = [
    `M ${pt(oB)}`,
    arcTo(rOuter, back, end, clockwise, oE),
    `L ${pt(head)}`,
    `L ${pt(iE)}`,
    arcTo(rInner, end, back, !clockwise, iB),
    "Z",
  ].join(" ");
  const headBorder = [
    `M ${pt(oB)}`,
    arcTo(rOuter, back, end, clockwise, oE),
    `L ${pt(head)}`,
    `L ${pt(iE)}`,
    arcTo(rInner, end, back, !clockwise, iB),
  ].join(" ");
  const headRim = [`M ${pt(oE)}`, `L ${pt(head)}`, `L ${pt(iE)}`].join(" ");
  return { path, headOverlay, headBorder, headRim, paint: "fill" };
}

function trianglePath(
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
  start: number,
  end: number,
  headAng: number,
  flare: number,
  clockwise: boolean
): ArrowSegmentPathSpec {
  const dir = clockwise ? 1 : -1;
  const rMid = (rInner + rOuter) / 2;
  const oS = polar(cx, cy, rOuter, start);
  const oE = polar(cx, cy, rOuter, end);
  const iS = polar(cx, cy, rInner, start);
  const iE = polar(cx, cy, rInner, end);
  const shoulderO = polar(cx, cy, rOuter + flare, end);
  const shoulderI = polar(cx, cy, Math.max(2, rInner - flare), end);
  const head = polar(cx, cy, rMid, end + dir * headAng);
  const tail = polar(cx, cy, rMid, start + dir * headAng);
  const back = end - dir * Math.min(0.08, Math.abs(wrapDelta(start, end, clockwise)) * 0.12);
  const oB = polar(cx, cy, rOuter, back);
  const iB = polar(cx, cy, rInner, back);
  const path = [
    `M ${pt(oS)}`,
    arcTo(rOuter, start, end, clockwise, oE),
    `L ${pt(shoulderO)}`,
    `L ${pt(head)}`,
    `L ${pt(shoulderI)}`,
    `L ${pt(iE)}`,
    arcTo(rInner, end, start, !clockwise, iS),
    `L ${pt(tail)}`,
    "Z",
  ].join(" ");
  const headOverlay = [
    `M ${pt(oB)}`,
    arcTo(rOuter, back, end, clockwise, oE),
    `L ${pt(shoulderO)}`,
    `L ${pt(head)}`,
    `L ${pt(shoulderI)}`,
    `L ${pt(iE)}`,
    arcTo(rInner, end, back, !clockwise, iB),
    "Z",
  ].join(" ");
  const headBorder = [
    `M ${pt(oB)}`,
    arcTo(rOuter, back, end, clockwise, oE),
    `L ${pt(shoulderO)}`,
    `L ${pt(head)}`,
    `L ${pt(shoulderI)}`,
    `L ${pt(iE)}`,
    arcTo(rInner, end, back, !clockwise, iB),
  ].join(" ");
  const headRim = [
    `M ${pt(oE)}`,
    `L ${pt(shoulderO)}`,
    `L ${pt(head)}`,
    `L ${pt(shoulderI)}`,
    `L ${pt(iE)}`,
  ].join(" ");
  return { path, headOverlay, headBorder, headRim, paint: "fill" };
}

function overlapPaths(
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
  start: number,
  end: number,
  clockwise: boolean
): ArrowSegmentPathSpec {
  const dir = clockwise ? 1 : -1;
  const halfW = Math.max(2, (rOuter - rInner) / 2);
  const rMid = (rInner + rOuter) / 2;
  const body = Math.abs(wrapDelta(start, end, clockwise));
  const capAng = halfW / Math.max(rMid, 1);
  const inset = Math.min(capAng * 0.12, body * 0.12);
  const tailA = start + dir * inset;
  const headA = end - dir * inset;
  const midS = polar(cx, cy, rMid, tailA);
  const midE = polar(cx, cy, rMid, headA);
  const path = `M ${pt(midS)} ${arcTo(rMid, tailA, headA, clockwise, midE)}`;
  const overlayLen = Math.min(capAng * 1.25, Math.abs(wrapDelta(tailA, headA, clockwise)) * 0.35);
  const back = headA - dir * overlayLen;
  const midB = polar(cx, cy, rMid, back);
  const headOverlay = `M ${pt(midB)} ${arcTo(rMid, back, headA, clockwise, midE)}`;
  const oE = polar(cx, cy, rOuter, headA);
  const iE = polar(cx, cy, rInner, headA);
  const headC = polar(cx, cy, rMid, headA);
  const headNose = {
    x: headC.x + halfW * Math.cos(headA + dir * (Math.PI / 2)),
    y: headC.y + halfW * Math.sin(headA + dir * (Math.PI / 2)),
  };
  const headRim = [
    `M ${pt(oE)}`,
    capArc(halfW, headNose, clockwise),
    capArc(halfW, iE, clockwise),
  ].join(" ");
  return { path, headOverlay, headBorder: headRim, headRim, paint: "stroke-arc" };
}

export function buildArrowSegmentPath(args: {
  cx: number;
  cy: number;
  rInner: number;
  rOuter: number;
  start: number;
  end: number;
  clockwise: boolean;
  style: ArrowChartStyle;
  chevronAng: number;
  flare: number;
}): ArrowSegmentPathSpec {
  const { cx, cy, rInner, rOuter, start, end, clockwise, style, chevronAng, flare } = args;
  if (style === "triangle") {
    return trianglePath(cx, cy, rInner, rOuter, start, end, chevronAng, flare, clockwise);
  }
  if (style === "overlap") {
    return overlapPaths(cx, cy, rInner, rOuter, start, end, clockwise);
  }
  return chevronPath(cx, cy, rInner, rOuter, start, end, chevronAng, clockwise);
}
