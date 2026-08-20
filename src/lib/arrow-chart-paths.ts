import type { ArrowChartStyle } from "@/lib/types";
import { lerpColors } from "@/lib/color-shift";

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
  /** Inner/outer ring arcs only (no end caps); overlap borders use this instead of the closed fill path. */
  bodyBorder?: string;
  /** Tail notch outline; drawn before the next segment head so overlap stays masked. */
  tailBorder?: string;
  /** Open path along the leading tip, used when segment borders are on. */
  headRim: string;
  /**
   * `stroke-arc`: centreline at mid-radius; renderer strokes with ring thickness and round caps.
   * Keeps inner/outer edges circular (overlap style).
   */
  paint: ArrowSegmentPaint;
  /** Tail angle (colour B). */
  gradFrom: number;
  /** Head / tip angle (colour A). */
  gradTo: number;
}

export interface ArrowConicSlice {
  d: string;
  color: string;
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

function ringArcBodyBorder(
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
  start: number,
  end: number,
  clockwise: boolean
): string {
  const oS = polar(cx, cy, rOuter, start);
  const oE = polar(cx, cy, rOuter, end);
  const iS = polar(cx, cy, rInner, start);
  const iE = polar(cx, cy, rInner, end);
  return [
    `M ${pt(oS)}`,
    arcTo(rOuter, start, end, clockwise, oE),
    `M ${pt(iE)}`,
    arcTo(rInner, end, start, !clockwise, iS),
  ].join(" ");
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
  const tailBorder = [`M ${pt(iS)}`, `L ${pt(tail)}`, `L ${pt(oS)}`].join(" ");
  return {
    path,
    headOverlay,
    headBorder,
    bodyBorder: ringArcBodyBorder(cx, cy, rInner, rOuter, start, end, clockwise),
    tailBorder,
    headRim,
    paint: "fill",
    gradFrom: start,
    gradTo: end + dir * chevronAng,
  };
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
  const tailBorder = [`M ${pt(iS)}`, `L ${pt(tail)}`, `L ${pt(oS)}`].join(" ");
  return {
    path,
    headOverlay,
    headBorder,
    bodyBorder: ringArcBodyBorder(cx, cy, rInner, rOuter, start, end, clockwise),
    tailBorder,
    headRim,
    paint: "fill",
    gradFrom: start,
    gradTo: end + dir * headAng,
  };
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
  const inset = Math.min(capAng * 0.12, Math.max(0, (body - capAng * 0.35) * 0.12));
  const tailA = start + dir * inset;
  const headA = end - dir * inset;
  const oS = polar(cx, cy, rOuter, tailA);
  const oE = polar(cx, cy, rOuter, headA);
  const iS = polar(cx, cy, rInner, tailA);
  const iE = polar(cx, cy, rInner, headA);
  const headC = polar(cx, cy, rMid, headA);
  const tailC = polar(cx, cy, rMid, tailA);
  const headNose = {
    x: headC.x + halfW * Math.cos(headA + dir * (Math.PI / 2)),
    y: headC.y + halfW * Math.sin(headA + dir * (Math.PI / 2)),
  };
  const tailNose = {
    x: tailC.x + halfW * Math.cos(tailA - dir * (Math.PI / 2)),
    y: tailC.y + halfW * Math.sin(tailA - dir * (Math.PI / 2)),
  };
  const path = [
    `M ${pt(oS)}`,
    arcTo(rOuter, tailA, headA, clockwise, oE),
    capArc(halfW, headNose, clockwise),
    capArc(halfW, iE, clockwise),
    arcTo(rInner, headA, tailA, !clockwise, iS),
    capArc(halfW, tailNose, !clockwise),
    capArc(halfW, oS, !clockwise),
    "Z",
  ].join(" ");
  const overlayLen = Math.min(capAng * 1.25, Math.abs(wrapDelta(tailA, headA, clockwise)) * 0.35);
  const back = headA - dir * overlayLen;
  const oB = polar(cx, cy, rOuter, back);
  const iB = polar(cx, cy, rInner, back);
  const headOverlay = [
    `M ${pt(oB)}`,
    arcTo(rOuter, back, headA, clockwise, oE),
    capArc(halfW, headNose, clockwise),
    capArc(halfW, iE, clockwise),
    arcTo(rInner, headA, back, !clockwise, iB),
    "Z",
  ].join(" ");
  const headBorder = [
    `M ${pt(oB)}`,
    arcTo(rOuter, back, headA, clockwise, oE),
    capArc(halfW, headNose, clockwise),
    capArc(halfW, iE, clockwise),
    arcTo(rInner, headA, back, !clockwise, iB),
  ].join(" ");
  const headRim = [`M ${pt(oE)}`, capArc(halfW, headNose, clockwise), capArc(halfW, iE, clockwise)].join(
    " "
  );
  const bodyBorder = ringArcBodyBorder(cx, cy, rInner, rOuter, tailA, headA, clockwise);
  const tailBorder = [
    `M ${pt(iS)}`,
    capArc(halfW, tailNose, !clockwise),
    capArc(halfW, oS, !clockwise),
  ].join(" ");
  return {
    path,
    headOverlay,
    headBorder,
    bodyBorder,
    tailBorder,
    headRim,
    paint: "fill",
    gradFrom: tailA,
    gradTo: headA + dir * capAng,
  };
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

/** Angular fan from the ring centre: colourStart at `from`, colourEnd at `to`. */
export function buildArrowConicFan(args: {
  cx: number;
  cy: number;
  r: number;
  from: number;
  to: number;
  clockwise: boolean;
  colorStart: string;
  colorEnd: string;
}): ArrowConicSlice[] {
  const { cx, cy, r, from, to, clockwise, colorStart, colorEnd } = args;
  const delta = wrapDelta(from, to, clockwise);
  const abs = Math.abs(delta);
  if (abs < 1e-4) {
    const p = polar(cx, cy, r, from);
    return [
      {
        d: `M ${n(cx)} ${n(cy)} L ${pt(p)} L ${pt(polar(cx, cy, r, from + 0.02))} Z`,
        color: colorEnd,
      },
    ];
  }
  const steps = Math.max(16, Math.min(96, Math.ceil(abs / (Math.PI / 120))));
  const overlap = (abs / steps) * 0.4;
  const slices: ArrowConicSlice[] = [];
  for (let i = 0; i < steps; i++) {
    const t0 = i / steps;
    const t1 = (i + 1) / steps;
    const a0 = from + delta * t0;
    const a1 = from + delta * t1 + (i === steps - 1 ? 0 : overlap * Math.sign(delta || 1));
    const p0 = polar(cx, cy, r, a0);
    const p1 = polar(cx, cy, r, a1);
    slices.push({
      d: `M ${n(cx)} ${n(cy)} L ${pt(p0)} L ${pt(p1)} Z`,
      color: lerpColors(colorStart, colorEnd, (t0 + t1) / 2),
    });
  }
  return slices;
}
