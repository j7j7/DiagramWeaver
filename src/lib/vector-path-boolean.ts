import polygonClipping from "polygon-clipping";
import { snapDimensionToGrid, snapToGrid } from "@/components/editor/canvas-constants";
import type { DiagramData, DiagramNodeData } from "@/lib/types";
import { extractVisualStylingFromNode, applyVisualStylingToNode } from "@/lib/visual-styling";
import { generateSequentialId } from "@/lib/id-generator";
import { nodeToCanvasPolygons, canBooleanCombineNodes } from "@/lib/shape-to-polygon";
import type { ShapeBooleanOperation } from "@/lib/vector-path-types";
import { VECTOR_PATH_NODE_TYPE } from "@/lib/vector-path-types";
import type { ClipMultiPolygon, ClipPolygon, ClipPair, ClipRing } from "@/lib/vector-path-utils";
import {
  bboxOfClipPolygon,
  canvasRingsToLocalRings,
  pointInClipRing,
  vectorPathFromRings,
  vectorPathStrokePadding,
} from "@/lib/vector-path-utils";

function foldMultiPolygons(
  polys: ClipMultiPolygon[],
  op: ShapeBooleanOperation,
): ClipMultiPolygon {
  if (polys.length === 0) return [];
  let acc = polys[0];
  for (let i = 1; i < polys.length; i++) {
    const next = polys[i];
    if (acc.length === 0) {
      acc = next;
      continue;
    }
    if (next.length === 0) {
      if (op === "intersect") acc = [];
      continue;
    }
    switch (op) {
      case "union":
        acc = polygonClipping.union(acc, next) as ClipMultiPolygon;
        break;
      case "subtract":
        acc = polygonClipping.difference(acc, next) as ClipMultiPolygon;
        break;
      case "intersect":
        acc = polygonClipping.intersection(acc, next) as ClipMultiPolygon;
        break;
      case "exclude":
        acc = polygonClipping.xor(acc, next) as ClipMultiPolygon;
        break;
    }
  }
  return acc;
}

interface VectorPathNodeGeometry {
  rings: ReturnType<typeof canvasRingsToLocalRings>;
  originX: number;
  originY: number;
  width: number;
  height: number;
}

function clipPolygonToNodeGeometry(
  poly: ClipPolygon,
  strokePad: number,
): VectorPathNodeGeometry | null {
  const bbox = bboxOfClipPolygon(poly);
  if (!bbox) return null;

  const pad = strokePad;
  const originX = snapToGrid(bbox.minX - pad);
  const originY = snapToGrid(bbox.minY - pad);
  const width = snapDimensionToGrid(Math.max(20, bbox.maxX - bbox.minX + pad * 2), 20);
  const height = snapDimensionToGrid(Math.max(20, bbox.maxY - bbox.minY + pad * 2), 20);

  const rings = poly.filter((ring) => ring.length >= 4);
  if (rings.length === 0) return null;

  return {
    rings: canvasRingsToLocalRings(rings, originX, originY),
    originX,
    originY,
    width,
    height,
  };
}

function multiPolygonToSeparateGeometries(
  mp: ClipMultiPolygon,
  strokePad: number,
): VectorPathNodeGeometry[] {
  return mp
    .map((poly) => clipPolygonToNodeGeometry(poly, strokePad))
    .filter((piece): piece is VectorPathNodeGeometry => !!piece);
}

function nodeCenterCanvas(node: DiagramNodeData): ClipPair {
  const nx = node.x ?? 0;
  const ny = node.y ?? 0;
  const w = Math.max(1, node.width ?? 80);
  const h = Math.max(1, node.height ?? 50);
  return [nx + w / 2, ny + h / 2];
}

function pickPrimaryResultIndex(anchor: ClipPair, pieces: VectorPathNodeGeometry[]): number {
  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i];
    const outer = piece.rings[0];
    if (!outer || outer.points.length < 3) continue;
    const ring: ClipRing = outer.points.map((p) => [p.x + piece.originX, p.y + piece.originY]);
    ring.push(ring[0]);
    if (pointInClipRing(anchor, ring)) return i;
  }

  let bestIdx = 0;
  let bestArea = -1;
  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i];
    const area = piece.width * piece.height;
    if (area > bestArea) {
      bestArea = area;
      bestIdx = i;
    }
  }
  return bestIdx;
}

export interface CombineShapesResult {
  diagram: DiagramData;
  /** Primary result node (largest piece or piece containing the base shape center). */
  resultNodeId: string;
  /** All result nodes — one per disjoint polygon piece. */
  resultNodeIds: string[];
  removedNodeIds: string[];
}

/**
 * Combine 2+ closed shapes via boolean op. Primary node (right-click target) is the base for subtract.
 * Returns updated diagram or null when the operation yields empty geometry.
 */
export function combineShapeNodes(
  diagram: DiagramData,
  nodeIds: string[],
  operation: ShapeBooleanOperation,
  primaryNodeId: string,
): CombineShapesResult | null {
  const nodes = nodeIds
    .map((id) => diagram.nodes.find((n) => n.id === id))
    .filter((n): n is DiagramNodeData => !!n);

  if (!canBooleanCombineNodes(nodes)) return null;

  const primary = nodes.find((n) => n.id === primaryNodeId) ?? nodes[0];
  const others = nodes.filter((n) => n.id !== primary.id);

  const primaryMp = nodeToCanvasPolygons(primary);
  const otherMps = others.map(nodeToCanvasPolygons);

  let resultMp: ClipMultiPolygon;
  if (operation === "subtract") {
    resultMp = foldMultiPolygons([primaryMp, ...otherMps], "subtract");
  } else {
    resultMp = foldMultiPolygons([primaryMp, ...otherMps], operation);
  }

  const stylingSource = primary;
  const strokePad = vectorPathStrokePadding(stylingSource);

  const pieces = multiPolygonToSeparateGeometries(resultMp, strokePad);
  if (pieces.length === 0) return null;
  const styling = extractVisualStylingFromNode(stylingSource);
  const primaryPieceIndex = pickPrimaryResultIndex(nodeCenterCanvas(primary), pieces);

  const resultIds: string[] = [];
  const extraOccupied = new Set<string>();
  const resultNodes: DiagramNodeData[] = [];

  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i];
    const resultId = generateSequentialId(VECTOR_PATH_NODE_TYPE, diagram, extraOccupied);
    extraOccupied.add(resultId);
    resultIds.push(resultId);

    resultNodes.push(
      applyVisualStylingToNode(
        {
          id: resultId,
          type: VECTOR_PATH_NODE_TYPE,
          label: i === primaryPieceIndex ? stylingSource.label : "",
          x: piece.originX,
          y: piece.originY,
          width: piece.width,
          height: piece.height,
          sizeMode: "custom",
          vectorPath: vectorPathFromRings(piece.rings),
        },
        styling,
      ),
    );
  }

  const resultNodeId = resultIds[primaryPieceIndex] ?? resultIds[0];
  const removeSet = new Set(nodeIds);
  const idMap = new Map<string, string>();
  for (const id of nodeIds) idMap.set(id, resultNodeId);

  const remainingNodes = diagram.nodes.filter((n) => !removeSet.has(n.id));
  const updatedConnections = (diagram.connections ?? []).map((conn) => {
    const newFrom = idMap.get(conn.from) ?? conn.from;
    const newTo = idMap.get(conn.to) ?? conn.to;
    if (newFrom === conn.from && newTo === conn.to) return conn;
    return { ...conn, from: newFrom, to: newTo, waypoints: undefined };
  });

  return {
    diagram: {
      ...diagram,
      nodes: [...remainingNodes, ...resultNodes],
      connections: updatedConnections,
    },
    resultNodeId,
    resultNodeIds: resultIds,
    removedNodeIds: [...removeSet],
  };
}
