import type { DiagramNodeData } from "@/lib/types";
import { isCardNodeType } from "@/lib/card-utils";
import { isBorderNodeType } from "@/lib/border-utils";
import { objectKindSuffixFromNodeType } from "@/lib/shape-type-swap";
import { clampRingHoleRatio } from "@/lib/ring-shape";
import { parsePoints, getPolygonViewBoxAndPoints } from "@/components/diagram/shapes/shape-utils";
import {
  nodeBoundingBoxForFit,
  type PositionedNode,
} from "@/components/editor/canvas-constants";
import type { CanvasObjectBounds } from "@/lib/canvas-click-through";
import type { ClipMultiPolygon, ClipPair, ClipPolygon, ClipRing } from "@/lib/vector-path-utils";
import {
  bboxOfClipMultiPolygon,
  groupClipRingsToPolygons,
  isVectorPathNodeType,
  pointInClipMultiPolygon,
  refitVectorPathNodeBounds,
} from "@/lib/vector-path-utils";

const CIRCLE_SEGMENTS = 48;

/** Canonical polygon point strings (same as shape components). */
const POLYGON_POINT_DEFS: Record<string, string> = {
  triangle: "30,5 55,50 5,50",
  hexagon: "30,5 50,17.5 50,42.5 30,55 10,42.5 10,17.5",
  pentagon: "30,2 55,20 45,48 15,48 5,20",
  octagon: "30,2 52,12 58,30 52,48 30,58 8,48 2,30 8,12",
  star: "30,2 36,20 55,20 40,32 46,50 30,40 14,50 20,32 5,20 24,20",
  parallelogram: "20,2 70,2 50,40 0,40",
  trapezoid: "15,2 55,2 70,40 0,40",
  kite: "30,2 55,30 30,58 5,30",
  arrowhead: "30,2 52,20 30,30 8,20",
  chevron: "5,10 25,2 25,18 55,18 55,42 25,42 25,58 5,50",
};

function nodeDimensions(node: DiagramNodeData): { w: number; h: number } {
  return {
    w: Math.max(1, node.width ?? 80),
    h: Math.max(1, node.height ?? 50),
  };
}

function rotatePoint(x: number, y: number, cx: number, cy: number, deg: number): ClipPair {
  if (!deg) return [x, y];
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = x - cx;
  const dy = y - cy;
  return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
}

function localToCanvasRing(localRing: ClipRing, node: DiagramNodeData): ClipRing {
  const nx = node.x ?? 0;
  const ny = node.y ?? 0;
  const { w, h } = nodeDimensions(node);
  const rot = node.rotation ?? 0;
  const cx = nx + w / 2;
  const cy = ny + h / 2;
  return localRing.map(([lx, ly]) => {
    const ax = nx + lx;
    const ay = ny + ly;
    return rotatePoint(ax, ay, cx, cy, rot);
  });
}

function rectLocalRing(w: number, h: number, inset = 0): ClipRing {
  const x0 = inset;
  const y0 = inset;
  const x1 = w - inset;
  const y1 = h - inset;
  return [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
    [x0, y0],
  ];
}

function roundedRectLocalRing(w: number, h: number, cornerRadius: number, segments = 8): ClipRing {
  const minDim = Math.min(w, h);
  const maxR = minDim / 2;
  const r = Math.max(0, Math.min(1, cornerRadius)) * maxR;
  if (r <= 0.5) return rectLocalRing(w, h);

  const ring: ClipRing = [];
  const corners = [
    { cx: w - r, cy: r, start: -Math.PI / 2, end: 0 },
    { cx: w - r, cy: h - r, start: 0, end: Math.PI / 2 },
    { cx: r, cy: h - r, start: Math.PI / 2, end: Math.PI },
    { cx: r, cy: r, start: Math.PI, end: (3 * Math.PI) / 2 },
  ];
  for (const c of corners) {
    for (let i = 0; i <= segments; i++) {
      const t = c.start + ((c.end - c.start) * i) / segments;
      ring.push([c.cx + r * Math.cos(t), c.cy + r * Math.sin(t)]);
    }
  }
  if (ring.length > 0) ring.push(ring[0]);
  return ring;
}

function circleLocalRing(w: number, h: number, segments = CIRCLE_SEGMENTS): ClipRing {
  const cx = w / 2;
  const cy = h / 2;
  const rx = w / 2;
  const ry = h / 2;
  const ring: ClipRing = [];
  for (let i = 0; i <= segments; i++) {
    const t = (2 * Math.PI * i) / segments;
    ring.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]);
  }
  return ring;
}

function polygonKindLocalRing(kind: string, w: number, h: number, strokePad: number): ClipRing | null {
  const def = POLYGON_POINT_DEFS[kind];
  if (!def) return null;
  const { transformedPoints } = getPolygonViewBoxAndPoints(def, strokePad, { w, h });
  const coords = parsePoints(transformedPoints);
  if (coords.length < 3) return null;
  const ring: ClipRing = coords.map(([x, y]) => [x, y]);
  ring.push(ring[0]);
  return ring;
}

function vectorPathLocalPolygons(node: DiagramNodeData): ClipPolygon[] {
  const rings = node.vectorPath?.rings ?? [];
  const clipRings: ClipRing[] = rings
    .filter((r) => r.points.length >= 3)
    .map((r) => {
      const ring: ClipRing = r.points.map((p) => [p.x, p.y]);
      ring.push(ring[0]);
      return ring;
    });
  return groupClipRingsToPolygons(clipRings);
}

function ringLocalPolygon(w: number, h: number, holeRatio: number | undefined): ClipPolygon {
  const outer = circleLocalRing(w, h);
  const ratio = clampRingHoleRatio(holeRatio);
  const innerW = w * ratio;
  const innerH = h * ratio;
  const ox = (w - innerW) / 2;
  const oy = (h - innerH) / 2;
  const inner = circleLocalRing(innerW, innerH).map(([x, y]) => [x + ox, y + oy] as ClipPair);
  return [outer, inner];
}

function primitiveLocalRing(node: DiagramNodeData, kind: string): ClipRing | null {
  const { w, h } = nodeDimensions(node);
  const borderStyle = node.borderStyle ?? "solid";
  const strokePad = borderStyle === "none" ? 0 : (node.borderWidth ?? 2) / 2;

  switch (kind) {
    case "rectangle":
    case "square":
      return rectLocalRing(w, h, strokePad);
    case "rounded-rectangle":
      return roundedRectLocalRing(w, h, node.cornerRadius ?? 0.2);
    case "circle":
    case "point":
      return circleLocalRing(w, h);
    default:
      return polygonKindLocalRing(kind, w, h, strokePad);
  }
}

/** Convert a diagram node to one or more polygons in canvas space for boolean ops and hit tests. */
export function nodeToCanvasPolygons(node: DiagramNodeData): ClipMultiPolygon {
  const out: ClipMultiPolygon = [];

  if (isVectorPathNodeType(node.type)) {
    const rings = node.vectorPath?.rings ?? [];
    if (!rings.length) return out;
    const fitted = refitVectorPathNodeBounds(node, rings);
    const fitNode: DiagramNodeData = fitted
      ? {
          ...node,
          x: fitted.x,
          y: fitted.y,
          width: fitted.width,
          height: fitted.height,
          vectorPath: { rings: fitted.rings },
        }
      : node;
    for (const poly of vectorPathLocalPolygons(fitNode)) {
      const canvasPoly: ClipPolygon = poly.map((ring) => localToCanvasRing(ring, fitNode));
      out.push(canvasPoly);
    }
    return out;
  }

  if (isCardNodeType(node.type)) {
    const { w, h } = nodeDimensions(node);
    const ring = roundedRectLocalRing(w, h, node.cornerRadius ?? 0.12);
    out.push([localToCanvasRing(ring, node)]);
    return out;
  }

  if (isBorderNodeType(node.type)) {
    const { w, h } = nodeDimensions(node);
    const ring = rectLocalRing(w, h, 0);
    out.push([localToCanvasRing(ring, node)]);
    return out;
  }

  const kind = objectKindSuffixFromNodeType(node.type);
  if (!kind) {
    const box = nodeBoundingBoxForFit(node as PositionedNode);
    const ring: ClipRing = [
      [box.minX, box.minY],
      [box.maxX, box.minY],
      [box.maxX, box.maxY],
      [box.minX, box.maxY],
      [box.minX, box.minY],
    ];
    out.push([ring]);
    return out;
  }

  if (kind === "ring") {
    const { w, h } = nodeDimensions(node);
    const localPoly = ringLocalPolygon(w, h, node.ringHoleRatio);
    out.push(localPoly.map((ring) => localToCanvasRing(ring, node)));
    return out;
  }

  const localRing = primitiveLocalRing(node, kind);
  if (!localRing || localRing.length < 4) return out;

  out.push([localToCanvasRing(localRing, node)]);
  return out;
}

/** Axis-aligned bounds for overlap click-through (matches painted card/border/vector extent). */
export function getNodeClickThroughBounds(node: DiagramNodeData): CanvasObjectBounds | null {
  const mp = nodeToCanvasPolygons(node);
  const bbox = bboxOfClipMultiPolygon(mp);
  if (bbox) {
    return {
      x: bbox.minX,
      y: bbox.minY,
      w: bbox.maxX - bbox.minX,
      h: bbox.maxY - bbox.minY,
    };
  }
  const box = nodeBoundingBoxForFit(node as PositionedNode);
  const w = box.maxX - box.minX;
  const h = box.maxY - box.minY;
  if (w <= 0 || h <= 0) return null;
  return { x: box.minX, y: box.minY, w, h };
}

/** Whether a diagram point hits the node's visible shape (respects rotation for primitives). */
export function isDiagramPointOnNode(
  node: DiagramNodeData,
  diagramX: number,
  diagramY: number,
): boolean {
  const mp = nodeToCanvasPolygons(node);
  if (mp.length > 0) {
    return pointInClipMultiPolygon([diagramX, diagramY], mp);
  }
  const bounds = getNodeClickThroughBounds(node);
  if (!bounds) return false;
  return (
    diagramX >= bounds.x &&
    diagramX < bounds.x + bounds.w &&
    diagramY >= bounds.y &&
    diagramY < bounds.y + bounds.h
  );
}

/** Shapes eligible for boolean combine (closed palette primitives + existing vector paths). */
export const BOOLEAN_ELIGIBLE_KINDS = new Set([
  "vector-path",
  "rectangle",
  "square",
  "rounded-rectangle",
  "circle",
  "ring",
  "triangle",
  "hexagon",
  "pentagon",
  "octagon",
  "star",
  "parallelogram",
  "trapezoid",
  "kite",
  "arrowhead",
  "chevron",
]);

export function isBooleanEligibleNode(node: DiagramNodeData): boolean {
  if (node.locked) return false;
  if (isVectorPathNodeType(node.type)) return true;
  const kind = objectKindSuffixFromNodeType(node.type);
  return !!(kind && BOOLEAN_ELIGIBLE_KINDS.has(kind));
}

export function canBooleanCombineNodes(nodes: DiagramNodeData[]): boolean {
  if (nodes.length < 2) return false;
  return nodes.every(isBooleanEligibleNode);
}
