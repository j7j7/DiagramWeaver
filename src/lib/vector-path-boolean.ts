import polygonClipping from "polygon-clipping";
import { snapDimensionToGrid, snapToGrid } from "@/components/editor/canvas-constants";
import type { DiagramData, DiagramNodeData } from "@/lib/types";
import { extractVisualStylingFromNode, applyVisualStylingToNode } from "@/lib/visual-styling";
import { generateSequentialId } from "@/lib/id-generator";
import { nodeToCanvasPolygons, canBooleanCombineNodes } from "@/lib/shape-to-polygon";
import type { ShapeBooleanOperation } from "@/lib/vector-path-types";
import { VECTOR_PATH_NODE_TYPE } from "@/lib/vector-path-types";
import type { ClipMultiPolygon, ClipPolygon } from "@/lib/vector-path-utils";
import {
  bboxOfClipMultiPolygon,
  canvasRingsToLocalRings,
  vectorPathFromRings,
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

function multiPolygonToRings(mp: ClipMultiPolygon): { rings: ReturnType<typeof canvasRingsToLocalRings>; originX: number; originY: number; width: number; height: number } | null {
  const bbox = bboxOfClipMultiPolygon(mp);
  if (!bbox) return null;

  const pad = 4;
  const originX = snapToGrid(bbox.minX - pad);
  const originY = snapToGrid(bbox.minY - pad);
  const width = snapDimensionToGrid(Math.max(20, bbox.maxX - bbox.minX + pad * 2), 20);
  const height = snapDimensionToGrid(Math.max(20, bbox.maxY - bbox.minY + pad * 2), 20);

  const allRings: ClipPolygon[number][] = [];
  for (const poly of mp) {
    for (const ring of poly) {
      if (ring.length >= 4) allRings.push(ring);
    }
  }
  if (allRings.length === 0) return null;

  const localRings = canvasRingsToLocalRings(allRings, originX, originY);
  return { rings: localRings, originX, originY, width, height };
}

export interface CombineShapesResult {
  diagram: DiagramData;
  resultNodeId: string;
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

  const converted = multiPolygonToRings(resultMp);
  if (!converted) return null;

  const stylingSource = primary;
  const styling = extractVisualStylingFromNode(stylingSource);

  const resultId = generateSequentialId(VECTOR_PATH_NODE_TYPE, diagram);
  const resultNode: DiagramNodeData = applyVisualStylingToNode(
    {
      id: resultId,
      type: VECTOR_PATH_NODE_TYPE,
      label: stylingSource.label,
      x: converted.originX,
      y: converted.originY,
      width: converted.width,
      height: converted.height,
      sizeMode: "custom",
      vectorPath: vectorPathFromRings(converted.rings),
    },
    styling,
  );

  const removeSet = new Set(nodeIds);
  const idMap = new Map<string, string>();
  for (const id of nodeIds) idMap.set(id, resultId);

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
      nodes: [...remainingNodes, resultNode],
      connections: updatedConnections,
    },
    resultNodeId: resultId,
    removedNodeIds: [...removeSet],
  };
}
