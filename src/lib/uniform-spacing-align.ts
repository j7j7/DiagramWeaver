import {
  GRID_STEP,
  measureNodeDims,
  snapToGrid,
  type PositionedNode,
} from "@/components/editor/canvas-constants";
import { getIconBevelStackHeight, getIconTileAnchorSize } from "@/lib/icon-bevel";
import type { DiagramNodeData } from "@/lib/types";
import { isIconOrEmojiType } from "@/lib/utils";
import { getNodeSizeDimensions } from "@/lib/visual-styling";

export interface SpacingAlignItem {
  id: string;
  x: number;
  y: number;
  /** Full node container width (may include wide labels). */
  width: number;
  /** Full node container height. */
  height: number;
  /** When set, spacing uses icon tile edges instead of container edges. */
  iconOffsetX?: number;
  iconOffsetY?: number;
  iconWidth?: number;
  iconHeight?: number;
}

type ItemPos = { x: number; y: number };

const GAP_CLUSTER_TOLERANCE = GRID_STEP / 2;
/** Primary-axis center spread must exceed the other axis by this factor. */
const AXIS_DOMINANCE_RATIO = 1.25;

function usesIconExtents(item: SpacingAlignItem): boolean {
  return item.iconWidth != null && item.iconHeight != null;
}

function itemPos(item: SpacingAlignItem, positions?: Map<string, ItemPos>): ItemPos {
  return positions?.get(item.id) ?? { x: item.x, y: item.y };
}

function primaryStart(item: SpacingAlignItem, pos: ItemPos, axis: "horizontal" | "vertical"): number {
  if (axis === "horizontal") {
    return usesIconExtents(item) ? pos.x + (item.iconOffsetX ?? 0) : pos.x;
  }
  return usesIconExtents(item) ? pos.y + (item.iconOffsetY ?? 0) : pos.y;
}

function primaryEnd(item: SpacingAlignItem, pos: ItemPos, axis: "horizontal" | "vertical"): number {
  const size =
    axis === "horizontal"
      ? usesIconExtents(item)
        ? item.iconWidth!
        : item.width
      : usesIconExtents(item)
        ? item.iconHeight!
        : item.height;
  return primaryStart(item, pos, axis) + size;
}

function primaryCenter(item: SpacingAlignItem, pos: ItemPos, axis: "horizontal" | "vertical"): number {
  return (primaryStart(item, pos, axis) + primaryEnd(item, pos, axis)) / 2;
}

function containerCoordFromPrimaryStart(
  item: SpacingAlignItem,
  alignStart: number,
  axis: "horizontal" | "vertical",
): number {
  if (axis === "horizontal") {
    return usesIconExtents(item) ? alignStart - (item.iconOffsetX ?? 0) : alignStart;
  }
  return usesIconExtents(item) ? alignStart - (item.iconOffsetY ?? 0) : alignStart;
}

function iconVerticalOffsetY(node: DiagramNodeData, containerHeight: number, iconHeight: number): number {
  if ((node as { textVerticalPosition?: string }).textVerticalPosition !== "top") {
    return 0;
  }
  if (containerHeight <= iconHeight) return 0;
  const label = (node.label ?? "").toString();
  if (!label.trim()) return 0;
  const maxCharsPerLine = 16;
  const lines = Math.ceil(label.length / maxCharsPerLine);
  const textBlockHeight = 20 + (lines - 1) * 8;
  return Math.max(0, containerHeight - iconHeight - textBlockHeight);
}

export function nodeToSpacingAlignItem(node: DiagramNodeData): SpacingAlignItem | null {
  if (node.x === undefined || node.y === undefined) return null;
  const positioned = { ...node, x: node.x, y: node.y } as PositionedNode;
  const dims = measureNodeDims(positioned);
  const width = node.sizeMode === "custom" && node.width ? node.width : dims.width;
  const height = node.sizeMode === "custom" && node.height ? node.height : dims.height;

  const item: SpacingAlignItem = {
    id: node.id,
    x: node.x,
    y: node.y,
    width,
    height,
  };

  if (isIconOrEmojiType(node.type)) {
    const iconTileSize = getIconTileAnchorSize(node);
    const { container } = getNodeSizeDimensions(node.nodeSize);
    const iconStackHeight = node.iconBevel ? getIconBevelStackHeight(container) : iconTileSize;
    const iconWidth = width > iconTileSize ? iconTileSize : width;
    const iconHeight = iconStackHeight;
    item.iconOffsetX = width > iconTileSize ? (width - iconTileSize) / 2 : 0;
    item.iconOffsetY = iconVerticalOffsetY(node, height, iconHeight);
    item.iconWidth = iconWidth;
    item.iconHeight = iconHeight;
  }

  return item;
}

export function detectUniformSpacingAxis(items: SpacingAlignItem[]): "horizontal" | "vertical" | null {
  if (items.length < 3) return null;

  const centersX = items.map((item) => primaryCenter(item, itemPos(item), "horizontal"));
  const centersY = items.map((item) => primaryCenter(item, itemPos(item), "vertical"));
  const spreadX = Math.max(...centersX) - Math.min(...centersX);
  const spreadY = Math.max(...centersY) - Math.min(...centersY);

  if (spreadX < GRID_STEP && spreadY < GRID_STEP) return null;

  const topYs = items.map((i) => primaryStart(i, itemPos(i), "vertical"));
  const leftXs = items.map((i) => primaryStart(i, itemPos(i), "horizontal"));
  const perpSpreadForRow = Math.max(...topYs) - Math.min(...topYs);
  const perpSpreadForCol = Math.max(...leftXs) - Math.min(...leftXs);
  const avgIconHeight =
    items.reduce((sum, i) => sum + (usesIconExtents(i) ? i.iconHeight! : i.height), 0) / items.length;
  const avgIconWidth =
    items.reduce((sum, i) => sum + (usesIconExtents(i) ? i.iconWidth! : i.width), 0) / items.length;

  const horizontalCandidate =
    spreadX >= spreadY * AXIS_DOMINANCE_RATIO && perpSpreadForRow <= avgIconHeight * 0.65;
  const verticalCandidate =
    spreadY >= spreadX * AXIS_DOMINANCE_RATIO && perpSpreadForCol <= avgIconWidth * 0.65;

  if (horizontalCandidate && !verticalCandidate) return "horizontal";
  if (verticalCandidate && !horizontalCandidate) return "vertical";
  if (horizontalCandidate && verticalCandidate) {
    return spreadX >= spreadY ? "horizontal" : "vertical";
  }
  return null;
}

function sortItems(items: SpacingAlignItem[], axis: "horizontal" | "vertical"): SpacingAlignItem[] {
  return [...items].sort((a, b) => {
    const aStart = primaryStart(a, itemPos(a), axis);
    const bStart = primaryStart(b, itemPos(b), axis);
    if (aStart !== bStart) return aStart - bStart;
    return a.id.localeCompare(b.id);
  });
}

/** Snap a measured edge gap to the layout grid before clustering. */
function snapGapToGrid(gap: number): number {
  return Math.max(0, snapToGrid(gap));
}

/** Pick the gap value supported by the largest cluster (mode with tolerance). Input gaps are grid-snapped. */
function findCanonicalGap(gaps: number[]): number {
  if (gaps.length === 0) return GRID_STEP;

  const gridGaps = gaps.map(snapGapToGrid);

  let bestRepresentative = gridGaps[0];
  let bestScore = 0;

  for (const candidate of gridGaps) {
    const cluster = gridGaps.filter((g) => Math.abs(g - candidate) <= GAP_CLUSTER_TOLERANCE);
    const score = cluster.length;
    if (score > bestScore || (score === bestScore && candidate < bestRepresentative)) {
      bestScore = score;
      const sortedCluster = [...cluster].sort((a, b) => a - b);
      bestRepresentative = sortedCluster[Math.floor(sortedCluster.length / 2)];
    }
  }

  return bestRepresentative;
}

function computeEdgeGaps(sorted: SpacingAlignItem[], axis: "horizontal" | "vertical"): number[] {
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const prevPos = itemPos(prev);
    const currPos = itemPos(curr);
    gaps.push(primaryStart(curr, currPos, axis) - primaryEnd(prev, prevPos, axis));
  }
  return gaps;
}

export interface UniformSpacingAlignResult {
  axis: "horizontal" | "vertical";
  /** Anchor (leftmost / topmost) — never moved. */
  anchorId: string;
  /** New positions for items after the anchor only. */
  positions: Map<string, { x: number; y: number }>;
  /** Grid-aligned edge gap applied between consecutive items. */
  spacing: number;
  changed: boolean;
}

export function computeUniformSpacingPositions(
  items: SpacingAlignItem[],
): UniformSpacingAlignResult | null {
  const axis = detectUniformSpacingAxis(items);
  if (!axis) return null;

  const sorted = sortItems(items, axis);
  const anchor = sorted[0];
  const gaps = computeEdgeGaps(sorted, axis);
  const spacing = findCanonicalGap(gaps);

  const positions = new Map<string, { x: number; y: number }>();

  let changed = false;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const prevPos = i === 1 ? itemPos(anchor) : positions.get(prev.id)!;

    if (axis === "horizontal") {
      const targetIconLeft = snapToGrid(primaryEnd(prev, prevPos, axis) + spacing);
      const newX = snapToGrid(containerCoordFromPrimaryStart(curr, targetIconLeft, axis));
      const newY = curr.y;
      positions.set(curr.id, { x: newX, y: newY });
      if (newX !== curr.x) changed = true;
    } else {
      const targetIconTop = snapToGrid(primaryEnd(prev, prevPos, axis) + spacing);
      const newX = curr.x;
      const newY = snapToGrid(containerCoordFromPrimaryStart(curr, targetIconTop, axis));
      positions.set(curr.id, { x: newX, y: newY });
      if (newY !== curr.y) changed = true;
    }
  }

  if (!changed) {
    for (const gap of gaps) {
      if (snapGapToGrid(gap) !== spacing) {
        changed = true;
        break;
      }
    }
  }

  return { axis, anchorId: anchor.id, positions, spacing, changed };
}

export function canUniformSpacingAlign(
  nodes: DiagramNodeData[],
  selectedIds: Iterable<string>,
): boolean {
  const ids = Array.from(selectedIds);
  if (ids.length < 3) return false;

  const items: SpacingAlignItem[] = [];
  for (const id of ids) {
    const node = nodes.find((n) => n.id === id);
    if (!node) return false;
    const item = nodeToSpacingAlignItem(node);
    if (!item) return false;
    items.push(item);
  }

  return detectUniformSpacingAxis(items) !== null;
}
