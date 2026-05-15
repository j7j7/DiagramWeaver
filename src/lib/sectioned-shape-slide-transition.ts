import type { DiagramNodeData } from "@/lib/types";
import { isPyramidNodeType, normalizePyramidSections, pyramidMemoPayload } from "@/lib/pyramid";
import {
  isSegmentedRectangleNodeType,
  normalizeSegmentedRectangleSections,
  segmentedRectangleMemoPayload,
} from "@/lib/segmented-rectangle";

/** Matches chart memo payloads — pyramid / segmented-rectangle slide appearance uses section lists + styling fields. */
export function sectionedShapePresentationSignature(node: DiagramNodeData): string | null {
  if (isPyramidNodeType(node.type)) return pyramidMemoPayload(node);
  if (isSegmentedRectangleNodeType(node.type)) return segmentedRectangleMemoPayload(node);
  return null;
}

export function sectionedShapeSegmentCount(node: DiagramNodeData): number {
  if (isPyramidNodeType(node.type)) return normalizePyramidSections(node).length;
  if (isSegmentedRectangleNodeType(node.type)) return normalizeSegmentedRectangleSections(node).length;
  return 0;
}
