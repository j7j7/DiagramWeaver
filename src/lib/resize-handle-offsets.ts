import { GRID_STEP } from "@/components/editor/canvas-constants";

const BASE_EDGE_OFFSET_PX = 10;
const MAX_EXTRA_OFFSET_PX = 24;
/** Start pushing top/bottom handles outward when width is below this (px). */
const NARROW_WIDTH_THRESHOLD_PX = GRID_STEP * 4;
/** Start pushing left/right handles outward when height is below this (px). */
const SHORT_HEIGHT_THRESHOLD_PX = GRID_STEP * 4;
const MIN_DIM_FOR_FULL_EXTRA_PX = GRID_STEP;

export type ResizeHandleEdgeOffsets = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

function rampExtraOffset(
  dim: number | undefined,
  threshold: number,
): number {
  if (dim == null || !Number.isFinite(dim) || dim >= threshold) {
    return 0;
  }
  const span = threshold - MIN_DIM_FOR_FULL_EXTRA_PX;
  if (span <= 0) return MAX_EXTRA_OFFSET_PX;
  const t = (threshold - dim) / span;
  return Math.min(MAX_EXTRA_OFFSET_PX, Math.max(0, t) * MAX_EXTRA_OFFSET_PX);
}

/**
 * Extra outward margin for resize rails when the box is very narrow (top/bottom)
 * or very short (left/right), so rotation / connect / corner handles stay clear.
 */
export function computeResizeHandleEdgeOffsets(
  boxWidth: number | undefined,
  boxHeight: number | undefined,
): ResizeHandleEdgeOffsets {
  const narrowExtra = rampExtraOffset(boxWidth, NARROW_WIDTH_THRESHOLD_PX);
  const shortExtra = rampExtraOffset(boxHeight, SHORT_HEIGHT_THRESHOLD_PX);
  return {
    top: BASE_EDGE_OFFSET_PX + narrowExtra,
    bottom: BASE_EDGE_OFFSET_PX + narrowExtra,
    left: BASE_EDGE_OFFSET_PX + shortExtra,
    right: BASE_EDGE_OFFSET_PX + shortExtra,
  };
}
