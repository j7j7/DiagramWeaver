import type { DiagramNodeData } from "@/lib/types";
import type { VectorPathRing, VectorPathSpec } from "@/lib/vector-path-types";
import { VECTOR_PATH_NODE_TYPE } from "@/lib/vector-path-types";
import { snapDimensionToGrid, snapToGrid } from "@/components/editor/canvas-constants";

export type { VectorPathRing, VectorPathSpec } from "@/lib/vector-path-types";

/** polygon-clipping coordinate pair */
export type ClipPair = [number, number];
export type ClipRing = ClipPair[];
export type ClipPolygon = ClipRing[];
export type ClipMultiPolygon = ClipPolygon[];

function clipRingVertices(ring: ClipRing): ClipRing {
  if (ring.length > 1) {
    const [fx, fy] = ring[0];
    const [lx, ly] = ring[ring.length - 1];
    if (fx === lx && fy === ly) return ring.slice(0, -1);
  }
  return ring;
}

function clipRingCentroid(ring: ClipRing): ClipPair {
  const pts = clipRingVertices(ring);
  if (pts.length === 0) return [0, 0];
  let sx = 0;
  let sy = 0;
  for (const [x, y] of pts) {
    sx += x;
    sy += y;
  }
  const n = pts.length;
  return [sx / n, sy / n];
}

function clipRingAbsArea(ring: ClipRing): number {
  const pts = clipRingVertices(ring);
  if (pts.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    sum += x0 * y1 - x1 * y0;
  }
  return Math.abs(sum / 2);
}

/** Even-odd fill: inside outer, outside holes. */
export function pointInClipPolygon(point: ClipPair, poly: ClipPolygon): boolean {
  if (!poly.length) return false;
  if (!pointInClipRing(point, poly[0])) return false;
  for (let i = 1; i < poly.length; i++) {
    if (pointInClipRing(point, poly[i])) return false;
  }
  return true;
}

export function pointInClipMultiPolygon(point: ClipPair, mp: ClipMultiPolygon): boolean {
  for (const poly of mp) {
    if (pointInClipPolygon(point, poly)) return true;
  }
  return false;
}

/** Ray-cast point-in-polygon for a closed ring. */
export function pointInClipRing(point: ClipPair, ring: ClipRing): boolean {
  const [x, y] = point;
  const pts = ring.length > 1 ? ring : clipRingVertices(ring);
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function clipRingContainsRing(outer: ClipRing, inner: ClipRing): boolean {
  return pointInClipRing(clipRingCentroid(inner), outer);
}

/**
 * Group evenodd vector rings into polygon-clipping polygons.
 * Disjoint rings become separate polygons; nested rings become outer + holes.
 */
export function groupClipRingsToPolygons(rings: ClipRing[]): ClipPolygon[] {
  if (rings.length === 0) return [];
  if (rings.length === 1) return [[rings[0]]];

  const areas = rings.map(clipRingAbsArea);
  const parent = new Array<number>(rings.length).fill(-1);

  for (let i = 0; i < rings.length; i++) {
    let bestParent = -1;
    let bestArea = Infinity;
    for (let j = 0; j < rings.length; j++) {
      if (i === j || areas[j] <= areas[i]) continue;
      if (!clipRingContainsRing(rings[j], rings[i])) continue;
      if (areas[j] < bestArea) {
        bestArea = areas[j];
        bestParent = j;
      }
    }
    parent[i] = bestParent;
  }

  const childrenOf = (idx: number): number[] => {
    const out: number[] = [];
    for (let i = 0; i < rings.length; i++) {
      if (parent[i] === idx) out.push(i);
    }
    return out;
  };

  const polys: ClipPolygon[] = [];
  const walk = (outerIdx: number) => {
    const poly: ClipPolygon = [rings[outerIdx]];
    for (const childIdx of childrenOf(outerIdx)) {
      poly.push(rings[childIdx]);
      for (const islandIdx of childrenOf(childIdx)) {
        walk(islandIdx);
      }
    }
    polys.push(poly);
  };

  for (let i = 0; i < rings.length; i++) {
    if (parent[i] === -1) walk(i);
  }

  return polys;
}

export function isVectorPathNodeType(type: string | undefined): boolean {
  return type === VECTOR_PATH_NODE_TYPE || (type?.endsWith(".vector-path") ?? false);
}

export function ringsToPathD(rings: VectorPathRing[]): string {
  const parts: string[] = [];
  for (const ring of rings) {
    const pts = ring.points;
    if (pts.length < 2) continue;
    parts.push(`M ${pts[0].x} ${pts[0].y}`);
    for (let i = 1; i < pts.length; i++) {
      parts.push(`L ${pts[i].x} ${pts[i].y}`);
    }
    parts.push("Z");
  }
  return parts.join(" ");
}

export function vectorPathFromRings(rings: VectorPathRing[]): VectorPathSpec {
  return { rings };
}

/** Flatten all ring vertices to absolute canvas coordinates. */
export function vectorPathVerticesCanvas(
  node: DiagramNodeData,
  localRings?: VectorPathRing[] | null,
): { x: number; y: number }[] {
  const nx = node.x ?? 0;
  const ny = node.y ?? 0;
  const rings = localRings ?? node.vectorPath?.rings ?? [];
  const out: { x: number; y: number }[] = [];
  for (const ring of rings) {
    for (const p of ring.points) {
      out.push({ x: nx + p.x, y: ny + p.y });
    }
  }
  return out;
}

/** Map canvas-space rings into local coords for a node positioned at (originX, originY). */
export function canvasRingsToLocalRings(
  canvasRings: ClipRing[],
  originX: number,
  originY: number,
): VectorPathRing[] {
  return canvasRings.map((ring) => {
    let pts = ring;
    if (pts.length > 1) {
      const [fx, fy] = pts[0];
      const [lx, ly] = pts[pts.length - 1];
      if (fx === lx && fy === ly) pts = pts.slice(0, -1);
    }
    return {
      points: pts.map(([x, y]) => ({ x: x - originX, y: y - originY })),
    };
  });
}

export function bboxOfClipPolygon(poly: ClipPolygon): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const ring of poly) {
    for (const [x, y] of ring) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (!Number.isFinite(minX)) return null;
  return { minX, minY, maxX, maxY };
}

export function bboxOfClipMultiPolygon(mp: ClipMultiPolygon): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const poly of mp) {
    for (const ring of poly) {
      for (const [x, y] of ring) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  if (!Number.isFinite(minX)) return null;
  return { minX, minY, maxX, maxY };
}

export function bboxOfVectorPathRings(
  rings: VectorPathRing[],
  nodeX: number,
  nodeY: number,
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const verts = vectorPathVerticesCanvas({ x: nodeX, y: nodeY } as DiagramNodeData, rings);
  if (verts.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const v of verts) {
    minX = Math.min(minX, v.x);
    minY = Math.min(minY, v.y);
    maxX = Math.max(maxX, v.x);
    maxY = Math.max(maxY, v.y);
  }
  return { minX, minY, maxX, maxY };
}

/** Scale local ring points when the node box is resized. */
export function scaleVectorPathRings(
  rings: VectorPathRing[],
  oldW: number,
  oldH: number,
  newW: number,
  newH: number,
): VectorPathRing[] {
  if (oldW <= 0 || oldH <= 0) return rings;
  const sx = newW / oldW;
  const sy = newH / oldH;
  return rings.map((ring) => ({
    points: ring.points.map((p) => ({ ...p, x: p.x * sx, y: p.y * sy })),
  }));
}

export function flattenRingsToVertexList(rings: VectorPathRing[]): Array<{
  ringIndex: number;
  pointIndex: number;
  x: number;
  y: number;
}> {
  const out: Array<{ ringIndex: number; pointIndex: number; x: number; y: number }> = [];
  rings.forEach((ring, ringIndex) => {
    ring.points.forEach((p, pointIndex) => {
      out.push({ ringIndex, pointIndex, x: p.x, y: p.y });
    });
  });
  return out;
}

export function updateVectorPathPoint(
  rings: VectorPathRing[],
  ringIndex: number,
  pointIndex: number,
  localX: number,
  localY: number,
): VectorPathRing[] {
  return rings.map((ring, ri) => {
    if (ri !== ringIndex) return ring;
    return {
      points: ring.points.map((p, pi) =>
        pi === pointIndex ? { ...p, x: localX, y: localY } : p,
      ),
    };
  });
}

function vectorPathStrokePadding(node: Pick<DiagramNodeData, "borderWidth" | "borderStyle">): number {
  return (node.borderStyle === "none" ? 0 : (node.borderWidth ?? 2) / 2) + 4;
}

/** Recompute node box so all path points fit; re-normalizes ring coords to the new origin. */
export function refitVectorPathNodeBounds(
  node: Pick<DiagramNodeData, "x" | "y" | "width" | "height" | "borderWidth" | "borderStyle">,
  rings: VectorPathRing[],
  options?: { force?: boolean },
): { x: number; y: number; width: number; height: number; rings: VectorPathRing[] } | null {
  if (!rings.length) return null;

  const nx = node.x ?? 0;
  const ny = node.y ?? 0;
  const w = node.width ?? 80;
  const h = node.height ?? 50;
  const pad = vectorPathStrokePadding(node);
  const bbox = bboxOfVectorPathRings(rings, nx, ny);
  if (!bbox) return null;

  const fitsCurrent =
    bbox.minX >= nx - 0.5 &&
    bbox.minY >= ny - 0.5 &&
    bbox.maxX <= nx + w + 0.5 &&
    bbox.maxY <= ny + h + 0.5;

  if (fitsCurrent && !options?.force) {
    return { x: nx, y: ny, width: w, height: h, rings };
  }

  const minW = 20;
  const minH = 20;
  const originX = snapToGrid(bbox.minX - pad);
  const originY = snapToGrid(bbox.minY - pad);
  const width = snapDimensionToGrid(Math.max(minW, bbox.maxX - bbox.minX + pad * 2), minW);
  const height = snapDimensionToGrid(Math.max(minH, bbox.maxY - bbox.minY + pad * 2), minH);

  const fittedRings = rings.map((ring) => ({
    points: ring.points.map((p) => ({
      ...p,
      x: nx + p.x - originX,
      y: ny + p.y - originY,
    })),
  }));

  return { x: originX, y: originY, width, height, rings: fittedRings };
}

export type VectorPathCanvasRing = Array<{ x: number; y: number; id?: string }>;

/** Snapshot local rings as absolute canvas coordinates. */
export function vectorPathRingsToCanvas(
  rings: VectorPathRing[],
  originX: number,
  originY: number,
): VectorPathCanvasRing[] {
  return rings.map((ring) =>
    ring.points.map((p) => ({ x: originX + p.x, y: originY + p.y, id: p.id })),
  );
}

/** Build fitted node from canvas-space ring points (used while dragging vertices). */
export function refitVectorPathFromCanvasRings(
  canvasRings: VectorPathCanvasRing[],
  node: Pick<DiagramNodeData, "borderWidth" | "borderStyle">,
): { x: number; y: number; width: number; height: number; rings: VectorPathRing[] } | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const ring of canvasRings) {
    for (const p of ring) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }
  if (!Number.isFinite(minX)) return null;

  const pad = vectorPathStrokePadding(node);
  const minW = 20;
  const minH = 20;
  const originX = snapToGrid(minX - pad);
  const originY = snapToGrid(minY - pad);
  const width = snapDimensionToGrid(Math.max(minW, maxX - minX + pad * 2), minW);
  const height = snapDimensionToGrid(Math.max(minH, maxY - minY + pad * 2), minH);

  const rings: VectorPathRing[] = canvasRings.map((ring) => ({
    points: ring.map((p) => ({ x: p.x - originX, y: p.y - originY, id: p.id })),
  }));

  return { x: originX, y: originY, width, height, rings };
}
