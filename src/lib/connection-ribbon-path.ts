/**
 * Builds a closed SVG path for a ribbon (variable stroke width) along a polyline.
 * Width interpolates linearly from wStart at the first point to wEnd at the last.
 */
export function buildRibbonPolygonPath(
  points: Array<{ x: number; y: number }>,
  wStart: number,
  wEnd: number
): string {
  const n = points.length;
  if (n < 2) return "";

  const halfStart = Math.max(0.25, wStart) / 2;
  const halfEnd = Math.max(0.25, wEnd) / 2;

  const left: Array<{ x: number; y: number }> = [];
  const right: Array<{ x: number; y: number }> = [];

  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1);
    const half = halfStart * (1 - t) + halfEnd * t;

    let dx: number;
    let dy: number;
    if (i === 0) {
      dx = points[1].x - points[0].x;
      dy = points[1].y - points[0].y;
    } else if (i === n - 1) {
      dx = points[n - 1].x - points[n - 2].x;
      dy = points[n - 1].y - points[n - 2].y;
    } else {
      dx = points[i + 1].x - points[i - 1].x;
      dy = points[i + 1].y - points[i - 1].y;
    }

    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = (-dy / len) * half;
    const ny = (dx / len) * half;

    left.push({ x: points[i].x + nx, y: points[i].y + ny });
    right.push({ x: points[i].x - nx, y: points[i].y - ny });
  }

  const fmt = (p: { x: number; y: number }) => `${p.x},${p.y}`;
  const parts: string[] = [`M ${fmt(left[0])}`];
  for (let i = 1; i < n; i++) {
    parts.push(`L ${fmt(left[i])}`);
  }
  for (let i = n - 1; i >= 0; i--) {
    parts.push(`L ${fmt(right[i])}`);
  }
  parts.push("Z");
  return parts.join(" ");
}
