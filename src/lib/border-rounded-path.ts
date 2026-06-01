function dist(a: [number, number], b: [number, number]): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

function cornerFillet(
  prev: [number, number],
  curr: [number, number],
  next: [number, number],
  radius: number,
): { pIn: [number, number]; pOut: [number, number]; r: number } {
  const v1x = prev[0] - curr[0];
  const v1y = prev[1] - curr[1];
  const v2x = next[0] - curr[0];
  const v2y = next[1] - curr[1];
  const len1 = Math.hypot(v1x, v1y) || 1;
  const len2 = Math.hypot(v2x, v2y) || 1;
  const r = Math.min(radius, len1 * 0.45, len2 * 0.45);
  return {
    r,
    pIn: [curr[0] + (v1x / len1) * r, curr[1] + (v1y / len1) * r],
    pOut: [curr[0] + (v2x / len2) * r, curr[1] + (v2y / len2) * r],
  };
}

/** Build an SVG path for a polygon with uniformly rounded corners. */
export function roundedPolygonPath(points: [number, number][], radius: number): string {
  const n = points.length;
  if (n < 3) return "";

  const fillets = points.map((curr, i) =>
    cornerFillet(points[(i + n - 1) % n], curr, points[(i + 1) % n], radius),
  );

  const parts: string[] = [];
  parts.push(`M ${fillets[0].pOut[0].toFixed(3)} ${fillets[0].pOut[1].toFixed(3)}`);

  for (let i = 1; i < n; i += 1) {
    const curr = points[i];
    const { pIn, pOut } = fillets[i];
    parts.push(`L ${pIn[0].toFixed(3)} ${pIn[1].toFixed(3)}`);
    parts.push(`Q ${curr[0].toFixed(3)} ${curr[1].toFixed(3)} ${pOut[0].toFixed(3)} ${pOut[1].toFixed(3)}`);
  }

  const curr0 = points[0];
  const { pIn } = fillets[0];
  parts.push(`L ${pIn[0].toFixed(3)} ${pIn[1].toFixed(3)}`);
  parts.push(`Q ${curr0[0].toFixed(3)} ${curr0[1].toFixed(3)} ${fillets[0].pOut[0].toFixed(3)} ${fillets[0].pOut[1].toFixed(3)}`);
  parts.push("Z");
  return parts.join(" ");
}

/** Shorthand for a three-vertex rounded triangle. */
export function roundedTrianglePath(
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
  radius: number,
): string {
  return roundedPolygonPath([p1, p2, p3], radius);
}

/**
 * X coordinate on the right side of a circle at a given y.
 */
export function circleXAtY(cx: number, cy: number, r: number, y: number): number {
  const d = r * r - (y - cy) * (y - cy);
  if (d <= 0) return cx;
  return cx + Math.sqrt(d);
}

/**
 * Band between two concentric circular arcs (shared center). Visible bulge at mid-height.
 * When clipLeft is true, the band includes the left edge (first/back layer).
 */
export function concentricArcBandPath(
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
  clipLeft = false,
): string {
  const h = 24;
  const fmt = (n: number) => n.toFixed(2);
  const xOutTop = Math.max(0, circleXAtY(cx, cy, rOuter, 0));
  const xOutBot = Math.max(0, circleXAtY(cx, cy, rOuter, h));
  const ro = fmt(rOuter);
  const outerLarge = Math.abs(xOutTop - xOutBot) < 0.05 ? 1 : 0;

  if (clipLeft) {
    return `M 0 0 L 0 ${h} L ${fmt(xOutBot)} ${h} A ${ro} ${ro} 0 ${outerLarge} 1 ${fmt(xOutTop)} 0 Z`;
  }

  const xInTop = Math.max(0, circleXAtY(cx, cy, rInner, 0));
  const xInBot = Math.max(0, circleXAtY(cx, cy, rInner, h));
  const ri = fmt(rInner);
  const innerLarge = Math.abs(xInTop - xInBot) < 0.05 ? 1 : 0;

  return `M ${fmt(xOutTop)} 0 A ${ro} ${ro} 0 ${outerLarge} 1 ${fmt(xOutBot)} ${h} A ${ri} ${ri} 0 ${innerLarge} 0 ${fmt(xInTop)} 0 Z`;
}

/**
 * Vertical band whose right edge is a circular arc (large radius).
 * Left edge runs top→bottom; bottom is flat; right arc sweeps up to the top-left corner.
 */
export function circleBandPath(
  leftTopX: number,
  leftBottomX: number,
  rightBottomX: number,
  rightTopX: number,
  arcRadius: number,
): string {
  const r = arcRadius.toFixed(2);
  return `M ${leftTopX} 0 L ${leftBottomX} 24 L ${rightBottomX} 24 A ${r} ${r} 0 0 1 ${rightTopX} 0 Z`;
}
