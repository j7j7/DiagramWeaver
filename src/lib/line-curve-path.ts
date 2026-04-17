import type { DiagramNodeData } from "@/lib/types";

const SAMPLE_STEPS = 24;

export type LinePathStyle = "straight" | "curved";

export interface LineControlPoint {
  x: number;
  y: number;
  id?: string;
}

/** Resolved absolute canvas points: [start, ...interior controls, end] */
export function getConnectorLineVertices(
  node: DiagramNodeData & { __localStartPos?: { x: number; y: number }; __localEndPos?: { x: number; y: number }; __localControlPoints?: LineControlPoint[] }
): { x: number; y: number }[] {
  const n = node as DiagramNodeData & {
    __localStartPos?: { x: number; y: number };
    __localEndPos?: { x: number; y: number };
    __localControlPoints?: LineControlPoint[];
  };
  const start =
    n.__localStartPos || n.startPos || { x: n.x || 0, y: n.y || 0 };
  const end =
    n.__localEndPos ||
    n.endPos || { x: (n.x || 0) + 150, y: n.y || 0 };
  const style = (n as { linePathStyle?: LinePathStyle }).linePathStyle;
  const stored = (n.__localControlPoints ||
    (n as { lineControlPoints?: LineControlPoint[] }).lineControlPoints ||
    []) as LineControlPoint[];

  if (style === "curved") {
    const interior =
      stored.length === 0
        ? [{ x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }]
        : [...stored];
    return [start, ...interior, end];
  }

  if (stored.length === 0) {
    return [start, end];
  }
  return [start, ...stored, end];
}

/** True when the rendered polyline/spline closes (start ≈ end). Enables area fill on connector lines. */
export function isConnectorLineGeometryClosed(
  node: DiagramNodeData & { __localStartPos?: { x: number; y: number }; __localEndPos?: { x: number; y: number }; __localControlPoints?: LineControlPoint[] },
  epsPx: number = 6,
): boolean {
  const v = getConnectorLineVertices(node);
  if (v.length < 2) return false;
  const a = v[0];
  const b = v[v.length - 1];
  return Math.hypot(b.x - a.x, b.y - a.y) <= epsPx;
}

const JOINT_FILLET_MAX = 14;
const JOINT_FILLET_RATIO = 0.34;

/** Straight polyline: sharp corners or quadratic fillets at interior vertices. */
export function straightPolylineToSvgPathD(
  points: { x: number; y: number }[],
  smoothJoints: boolean
): string {
  if (points.length < 2) return "";
  if (points.length === 2) {
    const a = points[0];
    const b = points[1];
    return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  }
  if (!smoothJoints) {
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x} ${points[i].y}`;
    }
    return d;
  }

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const next = points[i + 1];
    const len1 = Math.hypot(cur.x - prev.x, cur.y - prev.y);
    const len2 = Math.hypot(next.x - cur.x, next.y - cur.y);
    const r = Math.min(JOINT_FILLET_MAX, len1 * JOINT_FILLET_RATIO, len2 * JOINT_FILLET_RATIO);
    if (r > 0.75 && len1 > 1e-6 && len2 > 1e-6) {
      const u1x = (cur.x - prev.x) / len1;
      const u1y = (cur.y - prev.y) / len1;
      const u2x = (next.x - cur.x) / len2;
      const u2y = (next.y - cur.y) / len2;
      const p1 = { x: cur.x - u1x * r, y: cur.y - u1y * r };
      const p2 = { x: cur.x + u2x * r, y: cur.y + u2y * r };
      d += ` L ${p1.x} ${p1.y} Q ${cur.x} ${cur.y} ${p2.x} ${p2.y}`;
    } else {
      d += ` L ${cur.x} ${cur.y}`;
    }
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

export function connectorLinePathD(
  vertices: { x: number; y: number }[],
  linePathStyle: LinePathStyle | undefined,
  lineSmoothJoints: boolean | undefined
): string {
  if (linePathStyle === "curved") {
    return catmullRomToSvgPathD(vertices);
  }
  return straightPolylineToSvgPathD(vertices, lineSmoothJoints === true);
}

export function connectorLinePointBounds(vertices: { x: number; y: number }[]): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  let minX = vertices[0]?.x ?? 0;
  let maxX = minX;
  let minY = vertices[0]?.y ?? 0;
  let maxY = minY;
  for (const p of vertices) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, maxX, minY, maxY };
}

/** Catmull–Rom (uniform) as cubic Bézier segments; 2 points → straight line. */
export function catmullRomToSvgPathD(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  if (points.length === 2) {
    const a = points[0];
    const b = points[1];
    return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  }
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i === 0 ? points[0] : points[i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = i + 2 < points.length ? points[i + 2] : points[i + 1];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`;
  }
  return d;
}

function cubicPoint(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  t: number
): { x: number; y: number } {
  const u = 1 - t;
  const uu = u * u;
  const tt = t * t;
  return {
    x: uu * u * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + tt * t * p3.x,
    y: uu * u * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + tt * t * p3.y,
  };
}

function cubicTangent(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  t: number
): { x: number; y: number } {
  const u = 1 - t;
  return {
    x:
      3 * u * u * (p1.x - p0.x) +
      6 * u * t * (p2.x - p1.x) +
      3 * t * t * (p3.x - p2.x),
    y:
      3 * u * u * (p1.y - p0.y) +
      6 * u * t * (p2.y - p1.y) +
      3 * t * t * (p3.y - p2.y),
  };
}

export function linePathTangentAtStart(
  points: { x: number; y: number }[],
  linePathStyle?: LinePathStyle
): number {
  if (points.length < 2) return 0;
  if (linePathStyle !== "curved" || points.length === 2) {
    const dx = points[1].x - points[0].x;
    const dy = points[1].y - points[0].y;
    return (Math.atan2(dy, dx) * 180) / Math.PI;
  }
  const p0 = points[0];
  const p1 = points[0];
  const p2 = points[1];
  const p3 = points[2];
  const cp1x = p1.x + (p2.x - p0.x) / 6;
  const cp1y = p1.y + (p2.y - p0.y) / 6;
  const cp2x = p2.x - (p3.x - p1.x) / 6;
  const cp2y = p2.y - (p3.y - p1.y) / 6;
  const tan = cubicTangent(p1, { x: cp1x, y: cp1y }, { x: cp2x, y: cp2y }, p2, 0);
  return (Math.atan2(tan.y, tan.x) * 180) / Math.PI;
}

export function linePathTangentAtEnd(
  points: { x: number; y: number }[],
  linePathStyle?: LinePathStyle
): number {
  if (points.length < 2) return 0;
  if (linePathStyle !== "curved" || points.length === 2) {
    const n = points.length;
    const dx = points[n - 1].x - points[n - 2].x;
    const dy = points[n - 1].y - points[n - 2].y;
    return (Math.atan2(dy, dx) * 180) / Math.PI;
  }
  const n = points.length;
  const p0 = points[n - 3];
  const p1 = points[n - 2];
  const p2 = points[n - 1];
  const p3 = points[n - 1];
  const cp1x = p1.x + (p2.x - p0.x) / 6;
  const cp1y = p1.y + (p2.y - p0.y) / 6;
  const cp2x = p2.x - (p3.x - p1.x) / 6;
  const cp2y = p2.y - (p3.y - p1.y) / 6;
  const tan = cubicTangent(p1, { x: cp1x, y: cp1y }, { x: cp2x, y: cp2y }, p2, 1);
  return (Math.atan2(tan.y, tan.x) * 180) / Math.PI;
}

function sampleSegment(
  a: { x: number; y: number },
  b: { x: number; y: number },
  n: number
): { x: number; y: number }[] {
  if (n <= 1) return [{ ...b }];
  const out: { x: number; y: number }[] = [];
  for (let s = 1; s <= n; s++) {
    const t = s / n;
    out.push({
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
    });
  }
  return out;
}

function quadBezierSample(
  p0: { x: number; y: number },
  c: { x: number; y: number },
  p1: { x: number; y: number },
  n: number
): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let s = 1; s <= n; s++) {
    const t = s / n;
    const u = 1 - t;
    out.push({
      x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x,
      y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y,
    });
  }
  return out;
}

/** Flatten Catmull–Rom stroke for length / bbox sampling */
function flattenCatmullRomInternal(
  points: { x: number; y: number }[],
  stepsPerSegment: number
): { x: number; y: number }[] {
  if (points.length < 2) return [...points];
  if (points.length === 2) {
    const out: { x: number; y: number }[] = [];
    for (let s = 0; s <= stepsPerSegment; s++) {
      const t = s / stepsPerSegment;
      out.push({
        x: points[0].x + (points[1].x - points[0].x) * t,
        y: points[0].y + (points[1].y - points[0].y) * t,
      });
    }
    return out;
  }
  const out: { x: number; y: number }[] = [{ ...points[0] }];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i === 0 ? points[0] : points[i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = i + 2 < points.length ? points[i + 2] : points[i + 1];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    const c1 = { x: cp1x, y: cp1y };
    const c2 = { x: cp2x, y: cp2y };
    for (let s = 1; s <= stepsPerSegment; s++) {
      const t = s / stepsPerSegment;
      if (i < points.length - 2 && s === stepsPerSegment) continue;
      out.push(cubicPoint(p1, c1, c2, p2, t));
    }
  }
  return out;
}

function flattenStraightSmoothInternal(
  points: { x: number; y: number }[],
  stepsLine: number,
  stepsCorner: number
): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [{ ...points[0] }];
  let cursor = points[0];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const next = points[i + 1];
    const len1 = Math.hypot(cur.x - prev.x, cur.y - prev.y);
    const len2 = Math.hypot(next.x - cur.x, next.y - cur.y);
    const r = Math.min(JOINT_FILLET_MAX, len1 * JOINT_FILLET_RATIO, len2 * JOINT_FILLET_RATIO);
    if (r > 0.75 && len1 > 1e-6 && len2 > 1e-6) {
      const u1x = (cur.x - prev.x) / len1;
      const u1y = (cur.y - prev.y) / len1;
      const u2x = (next.x - cur.x) / len2;
      const u2y = (next.y - cur.y) / len2;
      const p1 = { x: cur.x - u1x * r, y: cur.y - u1y * r };
      const p2 = { x: cur.x + u2x * r, y: cur.y + u2y * r };
      out.push(...sampleSegment(cursor, p1, Math.max(3, Math.floor(stepsLine / 2))));
      out.push(...quadBezierSample(p1, cur, p2, Math.max(8, stepsCorner)));
      cursor = p2;
    } else {
      out.push(...sampleSegment(cursor, cur, stepsLine));
      cursor = cur;
    }
  }
  out.push(...sampleSegment(cursor, points[points.length - 1], stepsLine));
  return out;
}

/** Dense polyline approximating rendered stroke (length, bounds, hit padding). */
export function flattenConnectorStroke(
  points: { x: number; y: number }[],
  linePathStyle: LinePathStyle | undefined,
  lineSmoothJoints: boolean | undefined
): { x: number; y: number }[] {
  if (points.length < 2) return [...points];
  if (linePathStyle === "curved") {
    return flattenCatmullRomInternal(points, SAMPLE_STEPS);
  }
  if (lineSmoothJoints === true && points.length > 2) {
    return flattenStraightSmoothInternal(points, SAMPLE_STEPS, Math.max(8, Math.floor(SAMPLE_STEPS / 2)));
  }
  return [...points];
}

function polylineLength(pts: { x: number; y: number }[]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x;
    const dy = pts[i].y - pts[i - 1].y;
    len += Math.hypot(dx, dy);
  }
  return len;
}

/** Point at fraction u in [0,1] along approximate path length */
export function pointAtLengthRatio(
  points: { x: number; y: number }[],
  ratio: number,
  linePathStyle?: LinePathStyle,
  lineSmoothJoints?: boolean
): { x: number; y: number } {
  const flat = flattenConnectorStroke(points, linePathStyle, lineSmoothJoints);
  if (flat.length === 0) return { x: 0, y: 0 };
  if (flat.length === 1) return { ...flat[0] };
  const total = polylineLength(flat);
  if (total <= 0) return { ...flat[0] };
  let target = Math.max(0, Math.min(1, ratio)) * total;
  for (let i = 1; i < flat.length; i++) {
    const dx = flat[i].x - flat[i - 1].x;
    const dy = flat[i].y - flat[i - 1].y;
    const seg = Math.hypot(dx, dy);
    if (target <= seg) {
      const t = seg > 0 ? target / seg : 0;
      return {
        x: flat[i - 1].x + dx * t,
        y: flat[i - 1].y + dy * t,
      };
    }
    target -= seg;
  }
  return { ...flat[flat.length - 1] };
}

export function curveBoundsExpanded(
  points: { x: number; y: number }[],
  pad: number,
  linePathStyle?: LinePathStyle,
  lineSmoothJoints?: boolean
): { minX: number; maxX: number; minY: number; maxY: number } {
  const flat = flattenConnectorStroke(points, linePathStyle, lineSmoothJoints);
  const b = connectorLinePointBounds(flat);
  return {
    minX: b.minX - pad,
    maxX: b.maxX + pad,
    minY: b.minY - pad,
    maxY: b.maxY + pad,
  };
}

/**
 * Remove one polyline/spline vertex from a connector line node (by resolved vertex index:
 * `[start, ...lineControlPoints, end]`, with curved + empty storage using the synthetic midpoint).
 * Returns updated node or `null` if removal would leave too few points.
 */
export function removeConnectorLineVertexAtIndex(
  node: DiagramNodeData,
  vertexIndex: number,
): DiagramNodeData | null {
  const style = (((node as DiagramNodeData & { linePathStyle?: LinePathStyle }).linePathStyle ||
    "straight") as LinePathStyle);
  const startBase =
    (node as DiagramNodeData & { startPos?: { x: number; y: number } }).startPos || {
      x: node.x || 0,
      y: node.y || 0,
    };
  const endBase =
    (node as DiagramNodeData & { endPos?: { x: number; y: number } }).endPos || {
      x: (node.x || 0) + 150,
      y: node.y || 0,
    };
  const storedRaw = ((node as DiagramNodeData & { lineControlPoints?: LineControlPoint[] })
    .lineControlPoints || []) as LineControlPoint[];

  let vertices: { x: number; y: number }[];
  if (style === "curved" && storedRaw.length === 0) {
    vertices = [
      { ...startBase },
      { x: (startBase.x + endBase.x) / 2, y: (startBase.y + endBase.y) / 2 },
      { ...endBase },
    ];
  } else if (style === "curved") {
    vertices = [{ ...startBase }, ...storedRaw.map((p) => ({ ...p })), { ...endBase }];
  } else if (storedRaw.length === 0) {
    vertices = [{ ...startBase }, { ...endBase }];
  } else {
    vertices = [{ ...startBase }, ...storedRaw.map((p) => ({ ...p })), { ...endBase }];
  }

  if (vertexIndex < 0 || vertexIndex >= vertices.length) return null;

  const closed = isConnectorLineGeometryClosed({
    ...node,
    startPos: startBase,
    endPos: endBase,
    lineControlPoints: storedRaw,
  } as DiagramNodeData);

  const next = vertices.filter((_, i) => i !== vertexIndex);

  if (!closed && next.length < 2) return null;
  if (closed && next.length < 3) return null;

  const newStart = { ...next[0] };
  let newEnd = { ...next[next.length - 1] };
  let interior = next.slice(1, -1).map((p) => ({ ...p }));

  let nextStyle: LinePathStyle = style;

  if (closed) {
    newEnd = { ...newStart };
    interior = next.slice(1, -1).map((p) => ({ ...p }));
  }

  if (nextStyle === "curved" && next.length === 2) {
    nextStyle = "straight";
  }

  const flatForBounds = closed ? [newStart, ...interior] : [newStart, ...interior, newEnd];
  const minX = Math.min(...flatForBounds.map((p) => p.x));
  const minY = Math.min(...flatForBounds.map((p) => p.y));

  const nextNode = {
    ...node,
    x: minX,
    y: minY,
    startPos: newStart,
    endPos: newEnd,
    linePathStyle: nextStyle,
  } as DiagramNodeData;

  if (interior.length > 0) {
    (nextNode as DiagramNodeData & { lineControlPoints?: LineControlPoint[] }).lineControlPoints =
      interior;
  } else {
    delete (nextNode as DiagramNodeData & { lineControlPoints?: LineControlPoint[] })
      .lineControlPoints;
  }

  return nextNode;
}

/**
 * Insert a new vertex at the midpoint of the segment **after** `afterVertexIndex`
 * (between `vertices[afterVertexIndex]` and `vertices[afterVertexIndex + 1]`).
 * For **closed** lines, if `afterVertexIndex` is the last index, wraps to the segment closing the loop.
 * Returns a full updated node or `null` if the segment is invalid (caller may fall back to longest-edge insert).
 */
export function insertConnectorLinePointAfterVertexIndex(
  node: DiagramNodeData,
  afterVertexIndex: number,
): DiagramNodeData | null {
  const style = (((node as DiagramNodeData & { linePathStyle?: LinePathStyle }).linePathStyle ||
    "straight") as LinePathStyle);
  const startBase =
    (node as DiagramNodeData & { startPos?: { x: number; y: number } }).startPos || {
      x: node.x || 0,
      y: node.y || 0,
    };
  const endBase =
    (node as DiagramNodeData & { endPos?: { x: number; y: number } }).endPos || {
      x: (node.x || 0) + 150,
      y: node.y || 0,
    };
  const storedRaw = ((node as DiagramNodeData & { lineControlPoints?: LineControlPoint[] })
    .lineControlPoints || []) as LineControlPoint[];

  let vertices: { x: number; y: number }[];
  if (style === "curved" && storedRaw.length === 0) {
    vertices = [
      { ...startBase },
      { x: (startBase.x + endBase.x) / 2, y: (startBase.y + endBase.y) / 2 },
      { ...endBase },
    ];
  } else if (style === "curved") {
    vertices = [{ ...startBase }, ...storedRaw.map((p) => ({ ...p })), { ...endBase }];
  } else if (storedRaw.length === 0) {
    vertices = [{ ...startBase }, { ...endBase }];
  } else {
    vertices = [{ ...startBase }, ...storedRaw.map((p) => ({ ...p })), { ...endBase }];
  }

  const n = vertices.length;
  if (afterVertexIndex < 0 || afterVertexIndex >= n) return null;

  const closed = isConnectorLineGeometryClosed({
    ...node,
    startPos: startBase,
    endPos: endBase,
    lineControlPoints: storedRaw,
  } as DiagramNodeData);

  let j = afterVertexIndex + 1;
  if (j >= n) {
    if (!closed) return null;
    j = 0;
  }

  const a = vertices[afterVertexIndex];
  const b = vertices[j];
  const segLen = Math.hypot(b.x - a.x, b.y - a.y);
  if (segLen < 1e-6) return null;

  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const inserted = [
    ...vertices.slice(0, afterVertexIndex + 1),
    mid,
    ...vertices.slice(afterVertexIndex + 1),
  ];

  const newStart = { ...inserted[0] };
  let newEnd = { ...inserted[inserted.length - 1] };
  let interior = inserted.slice(1, -1).map((p) => ({ ...p }));

  let nextStyle: LinePathStyle = style;

  if (closed) {
    newEnd = { ...newStart };
    interior = inserted.slice(1, -1).map((p) => ({ ...p }));
  }

  if (nextStyle === "curved" && inserted.length === 2) {
    nextStyle = "straight";
  }

  const flatForBounds = closed ? [newStart, ...interior] : [newStart, ...interior, newEnd];
  const minX = Math.min(...flatForBounds.map((p) => p.x));
  const minY = Math.min(...flatForBounds.map((p) => p.y));

  const nextNode = {
    ...node,
    x: minX,
    y: minY,
    startPos: newStart,
    endPos: newEnd,
    linePathStyle: nextStyle,
  } as DiagramNodeData;

  if (interior.length > 0) {
    (nextNode as DiagramNodeData & { lineControlPoints?: LineControlPoint[] }).lineControlPoints =
      interior;
  } else {
    delete (nextNode as DiagramNodeData & { lineControlPoints?: LineControlPoint[] })
      .lineControlPoints;
  }

  return nextNode;
}

/** Insert a control at the midpoint of the longest segment of the open polyline. */
export function insertConnectorLineMidControl(
  start: { x: number; y: number },
  end: { x: number; y: number },
  interior: LineControlPoint[]
): LineControlPoint[] {
  const all = [start, ...interior, end];
  let best = 0;
  let bestLen = -1;
  for (let i = 0; i < all.length - 1; i++) {
    const dx = all[i + 1].x - all[i].x;
    const dy = all[i + 1].y - all[i].y;
    const L = Math.hypot(dx, dy);
    if (L > bestLen) {
      bestLen = L;
      best = i;
    }
  }
  const mid = {
    x: (all[best].x + all[best + 1].x) / 2,
    y: (all[best].y + all[best + 1].y) / 2,
  };
  const next = [...interior];
  if (best === 0) next.unshift(mid);
  else if (best === all.length - 2) next.push(mid);
  else next.splice(best, 0, mid);
  return next;
}
