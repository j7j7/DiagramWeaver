import { useMemo } from 'react';
import type { DiagramData } from '@/lib/types';
import type { PositionedNode, PositionedGroup } from '@/components/editor/canvas-constants';
import { measureNodeDims } from '@/components/editor/canvas-constants';

// Alignment tolerance threshold (in diagram space pixels)
const ALIGNMENT_TOLERANCE = 5;

// Maximum distance to check for alignments (performance optimization)
const MAX_CHECK_DISTANCE = 500;

export interface AlignmentGuide {
  type: 'horizontal' | 'vertical';
  position: number; // Y coordinate for horizontal, X coordinate for vertical
  referenceItemId: string; // ID of the item we're aligning to
  alignmentType: 'center' | 'top' | 'bottom' | 'left' | 'right'; // Type of alignment
}

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  top: number;
  bottom: number;
  left: number;
  right: number;
}

interface UseAlignmentGuidesOptions {
  diagramData: DiagramData;
  displayNodesById: Record<string, PositionedNode>;
  displayZonesById: Record<string, PositionedGroup>;
  draggedItemId: string | null;
  draggedItemIds: Set<string>; // For multi-select drag
  transform: { x: number; y: number; k: number };
  enabled: boolean;
}

interface UseAlignmentGuidesReturn {
  guides: AlignmentGuide[];
}

/**
 * Calculates bounding box for a node
 */
function calculateNodeBoundingBox(node: PositionedNode): BoundingBox {
  const dims = measureNodeDims(node);
  const x = node.x || 0;
  const y = node.y || 0;
  const width = dims.width;
  const height = dims.height;

  return {
    x,
    y,
    width,
    height,
    centerX: x + width / 2,
    centerY: y + height / 2,
    top: y,
    bottom: y + height,
    left: x,
    right: x + width,
  };
}

/**
 * Calculates bounding box for a zone
 */
function calculateZoneBoundingBox(zone: PositionedGroup): BoundingBox {
  const x = zone.x || 0;
  const y = zone.y || 0;
  const width = zone.width || 300;
  const height = zone.height || 220;

  return {
    x,
    y,
    width,
    height,
    centerX: x + width / 2,
    centerY: y + height / 2,
    top: y,
    bottom: y + height,
    left: x,
    right: x + width,
  };
}

/**
 * Calculates union bounding box for multiple items (multi-select)
 */
function calculateUnionBoundingBox(boxes: BoundingBox[]): BoundingBox | null {
  if (boxes.length === 0) return null;
  if (boxes.length === 1) return boxes[0];

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  boxes.forEach(box => {
    minX = Math.min(minX, box.left);
    minY = Math.min(minY, box.top);
    maxX = Math.max(maxX, box.right);
    maxY = Math.max(maxY, box.bottom);
  });

  const width = maxX - minX;
  const height = maxY - minY;

  return {
    x: minX,
    y: minY,
    width,
    height,
    centerX: minX + width / 2,
    centerY: minY + height / 2,
    top: minY,
    bottom: maxY,
    left: minX,
    right: maxX,
  };
}

/**
 * Checks if two values are within tolerance
 */
function isWithinTolerance(a: number, b: number, tolerance: number = ALIGNMENT_TOLERANCE): boolean {
  return Math.abs(a - b) <= tolerance;
}

/**
 * Checks if two bounding boxes are within check distance
 */
function isWithinCheckDistance(box1: BoundingBox, box2: BoundingBox, maxDistance: number = MAX_CHECK_DISTANCE): boolean {
  const dx = box1.centerX - box2.centerX;
  const dy = box1.centerY - box2.centerY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance <= maxDistance;
}

/**
 * Detects alignments between dragged item and reference items
 */
function detectAlignments(
  draggedBox: BoundingBox,
  referenceBox: BoundingBox,
  referenceId: string
): AlignmentGuide[] {
  const guides: AlignmentGuide[] = [];

  // Center alignments (highest priority)
  if (isWithinTolerance(draggedBox.centerX, referenceBox.centerX)) {
    guides.push({
      type: 'vertical',
      position: draggedBox.centerX,
      referenceItemId: referenceId,
      alignmentType: 'center',
    });
  }

  if (isWithinTolerance(draggedBox.centerY, referenceBox.centerY)) {
    guides.push({
      type: 'horizontal',
      position: draggedBox.centerY,
      referenceItemId: referenceId,
      alignmentType: 'center',
    });
  }

  // Edge alignments (lower priority, but still useful)
  if (isWithinTolerance(draggedBox.top, referenceBox.top)) {
    guides.push({
      type: 'horizontal',
      position: draggedBox.top,
      referenceItemId: referenceId,
      alignmentType: 'top',
    });
  }

  if (isWithinTolerance(draggedBox.bottom, referenceBox.bottom)) {
    guides.push({
      type: 'horizontal',
      position: draggedBox.bottom,
      referenceItemId: referenceId,
      alignmentType: 'bottom',
    });
  }

  if (isWithinTolerance(draggedBox.left, referenceBox.left)) {
    guides.push({
      type: 'vertical',
      position: draggedBox.left,
      referenceItemId: referenceId,
      alignmentType: 'left',
    });
  }

  if (isWithinTolerance(draggedBox.right, referenceBox.right)) {
    guides.push({
      type: 'vertical',
      position: draggedBox.right,
      referenceItemId: referenceId,
      alignmentType: 'right',
    });
  }

  return guides;
}

/**
 * Checks if a bounding box is within viewport (with margin for better UX)
 */
function isInViewport(
  box: BoundingBox,
  transform: { x: number; y: number; k: number },
  viewportWidth: number = typeof window !== 'undefined' ? window.innerWidth : 1920,
  viewportHeight: number = typeof window !== 'undefined' ? window.innerHeight : 1080,
  margin: number = 200 // Margin in diagram space
): boolean {
  // Convert viewport bounds to diagram space
  const viewportLeft = -transform.x / transform.k - margin;
  const viewportRight = (viewportWidth - transform.x) / transform.k + margin;
  const viewportTop = -transform.y / transform.k - margin;
  const viewportBottom = (viewportHeight - transform.y) / transform.k + margin;

  // Check if box intersects viewport
  return !(
    box.right < viewportLeft ||
    box.left > viewportRight ||
    box.bottom < viewportTop ||
    box.top > viewportBottom
  );
}

/**
 * Custom hook to calculate alignment guides during drag operations
 * Includes performance optimizations: spatial partitioning and viewport culling
 */
export function useAlignmentGuides({
  diagramData,
  displayNodesById,
  displayZonesById,
  draggedItemId,
  draggedItemIds,
  transform,
  enabled,
}: UseAlignmentGuidesOptions): UseAlignmentGuidesReturn {
  const guides = useMemo(() => {
    if (!enabled) return [];

    const isDragging = draggedItemId !== null || draggedItemIds.size > 0;
    if (!isDragging) return [];

    let draggedBox: BoundingBox | null = null;

    if (draggedItemIds.size > 1) {
      const draggedBoxes: BoundingBox[] = [];
      draggedItemIds.forEach(id => {
        const node = displayNodesById[id];
        if (node) {
          draggedBoxes.push(calculateNodeBoundingBox(node));
        } else {
          const zone = displayZonesById[id];
          if (zone) draggedBoxes.push(calculateZoneBoundingBox(zone));
        }
      });
      draggedBox = calculateUnionBoundingBox(draggedBoxes);
    } else if (draggedItemId) {
      const node = displayNodesById[draggedItemId];
      if (node) {
        draggedBox = calculateNodeBoundingBox(node);
      } else {
        const zone = displayZonesById[draggedItemId];
        if (zone) draggedBox = calculateZoneBoundingBox(zone);
      }
    }

    if (!draggedBox) return [];

    const referenceBoxes: Array<{ box: BoundingBox; id: string }> = [];

    Object.entries(displayNodesById).forEach(([id, node]) => {
      if (draggedItemId === id || draggedItemIds.has(id)) return;
      if (node.locked) return;
      const box = calculateNodeBoundingBox(node);
      if (!isInViewport(box, transform)) return;
      if (isWithinCheckDistance(draggedBox!, box)) referenceBoxes.push({ box, id });
    });

    Object.entries(displayZonesById).forEach(([id, zone]) => {
      if (draggedItemId === id || draggedItemIds.has(id)) return;
      const box = calculateZoneBoundingBox(zone);
      if (!isInViewport(box, transform)) return;
      if (isWithinCheckDistance(draggedBox!, box)) referenceBoxes.push({ box, id });
    });

    const allGuides: AlignmentGuide[] = [];
    referenceBoxes.forEach(({ box, id }) => {
      allGuides.push(...detectAlignments(draggedBox!, box, id));
    });

    const horizontalGuides: AlignmentGuide[] = [];
    const verticalGuides: AlignmentGuide[] = [];
    allGuides.forEach(guide => {
      if (guide.type === 'horizontal') horizontalGuides.push(guide);
      else verticalGuides.push(guide);
    });

    const prioritizeGuides = (guides: AlignmentGuide[]): AlignmentGuide[] =>
      guides
        .sort((a, b) => {
          if (a.alignmentType === 'center' && b.alignmentType !== 'center') return -1;
          if (a.alignmentType !== 'center' && b.alignmentType === 'center') return 1;
          const distA = Math.abs(a.position - (a.type === 'horizontal' ? draggedBox!.centerY : draggedBox!.centerX));
          const distB = Math.abs(b.position - (b.type === 'horizontal' ? draggedBox!.centerY : draggedBox!.centerX));
          return distA - distB;
        })
        .slice(0, 2);

    return [...prioritizeGuides(horizontalGuides), ...prioritizeGuides(verticalGuides)];
  }, [
    enabled,
    draggedItemId,
    draggedItemIds,
    displayNodesById,
    displayZonesById,
    transform.k,
  ]);

  return { guides };
}
