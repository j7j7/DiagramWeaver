/**
 * Evaluates CSS cubic-bezier(p1x, p1y, p2x, p2y) at time t ∈ [0,1].
 * P0=(0,0), P3=(1,1). Returns the eased output (y) for input time t (x).
 */
export function easeCssCubicBezier(
  t: number,
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number,
): number {
  const x = Math.max(0, Math.min(1, t));
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  const cx = 3 * p1x;
  const bx = 3 * (p2x - p1x) - cx;
  const ax = 1 - cx - bx;

  const cy = 3 * p1y;
  const by = 3 * (p2y - p1y) - cy;
  const ay = 1 - cy - by;

  const sampleX = (u: number) => ((ax * u + bx) * u + cx) * u;

  let uLow = 0;
  let uHigh = 1;
  for (let i = 0; i < 12; i++) {
    const uMid = (uLow + uHigh) / 2;
    if (sampleX(uMid) < x) uLow = uMid;
    else uHigh = uMid;
  }
  const u = (uLow + uHigh) / 2;
  return ((ay * u + by) * u + cy) * u;
}

/** Matches `EASE_IN_OUT` in use-slide-transition: cubic-bezier(0.4, 0.0, 0.2, 1) */
export function easeSlideTransitionInOut(t: number): number {
  return easeCssCubicBezier(t, 0.4, 0, 0.2, 1);
}
