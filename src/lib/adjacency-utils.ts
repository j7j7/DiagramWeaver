import type { DiagramNodeData } from "@/lib/types";
import { measureNodeDims } from "@/components/editor/canvas-constants";

export interface AdjacentEdges {
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
}

/** Check if node type uses CSS border (ShapeWrapper without skipWrapperStyling) */
export function isBorderShapeNode(type?: string): boolean {
  if (!type) return false;
  return (
    type === "generic.object.square" ||
    type === "generic.object.rectangle" ||
    type === "generic.object.uml-class" ||
    type === "generic.object.rounded-rectangle" ||
    type === "generic.object.progress-bar" ||
    type === "generic.object.timeline-bar" ||
    type === "generic.object.text-box-heading" ||
    type === "generic.object.circle" ||
    type === "generic.object.point" ||
    type?.endsWith(".square") ||
    type?.endsWith(".rectangle") ||
    type?.endsWith(".rounded-rectangle") ||
    type?.endsWith(".progress-bar") ||
    type?.endsWith(".timeline-bar") ||
    type?.endsWith(".text-box-heading") ||
    type?.endsWith(".circle") ||
    type?.endsWith(".point")
  );
}

/** Check if two rect ranges overlap (for adjacency on shared edge) */
function rangesOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number
): boolean {
  return aStart < bEnd && aEnd > bStart;
}

/**
 * Compute which edges should suppress border (to avoid double lines when tessellating).
 * Rule: only the "right" or "bottom" shape in an adjacent pair suppresses - the "left" or
 * "top" shape draws the shared border so the dividing line is always visible.
 */
export function computeAdjacentEdges(
  nodeId: string,
  node: DiagramNodeData & { x?: number; y?: number },
  allNodes: Array<DiagramNodeData & { x?: number; y?: number }>
): AdjacentEdges {
  const result: AdjacentEdges = { top: false, right: false, bottom: false, left: false };
  if (!isBorderShapeNode(node.type)) return result;

  const x = node.x ?? 0;
  const y = node.y ?? 0;
  const dims = measureNodeDims(node as any);
  const w = dims.width;
  const h = dims.height;

  const myLeft = x;
  const myRight = x + w;
  const myTop = y;
  const myBottom = y + h;

  for (const other of allNodes) {
    if (other.id === nodeId || !isBorderShapeNode(other.type)) continue;

    const ox = other.x ?? 0;
    const oy = other.y ?? 0;
    const odims = measureNodeDims(other as any);
    const ow = odims.width;
    const oh = odims.height;

    const otherLeft = ox;
    const otherRight = ox + ow;
    const otherTop = oy;
    const otherBottom = oy + oh;

    const vertOverlap = rangesOverlap(myTop, myBottom, otherTop, otherBottom);
    const horizOverlap = rangesOverlap(myLeft, myRight, otherLeft, otherRight);

    // Only suppress when WE are the right/bottom shape (other draws the shared border)
    // Other is to our left: we're right of them → suppress our left
    if (vertOverlap && Math.abs(otherRight - myLeft) < 1) result.left = true;
    // Other is above us: we're below them → suppress our top
    if (horizOverlap && Math.abs(otherBottom - myTop) < 1) result.top = true;
    // Never suppress right/bottom - we draw those when we're the left/top shape
  }

  return result;
}
