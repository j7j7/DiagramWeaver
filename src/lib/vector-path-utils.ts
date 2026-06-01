import type { DiagramNodeData } from "@/lib/types";
import type { VectorPathRing, VectorPathSpec } from "@/lib/vector-path-types";
import { VECTOR_PATH_NODE_TYPE } from "@/lib/vector-path-types";

export type { VectorPathRing, VectorPathSpec } from "@/lib/vector-path-types";

/** polygon-clipping coordinate pair */
export type ClipPair = [number, number];
export type ClipRing = ClipPair[];
export type ClipPolygon = ClipRing[];
export type ClipMultiPolygon = ClipPolygon[];

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
