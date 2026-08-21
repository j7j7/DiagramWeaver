/** Inner hole size for `generic.object.ring` as a fraction of outer radius. */
export const RING_HOLE_RATIO_MIN = 0.05;
export const RING_HOLE_RATIO_MAX = 0.95;
export const RING_HOLE_RATIO_DEFAULT = 0.52;

export function clampRingHoleRatio(v: number | undefined): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return RING_HOLE_RATIO_DEFAULT;
  return Math.min(RING_HOLE_RATIO_MAX, Math.max(RING_HOLE_RATIO_MIN, v));
}

/** Full donut (closed annulus): two semicircular arcs outer + complementary inner hole. */
export function fullAnnulusPath(
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

export function ringRadiiInViewBox(
  strokeWidthNum: number,
  holeRatio: number
): { cx: number; cy: number; rOuter: number; rInner: number } {
  const cx = 30;
  const cy = 30;
  const rOuter = 29 - strokeWidthNum / 2;
  const rInner = Math.max(0, Math.min(rOuter - 1, rOuter * holeRatio));
  return { cx, cy, rOuter, rInner };
}

export function isRingObjectNodeType(type: string | undefined): boolean {
  if (!type) return false;
  if (type === "generic.chart.ring" || type.endsWith(".chart.ring")) return false;
  return type === "generic.object.ring" || type.endsWith(".object.ring");
}
