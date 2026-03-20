import { calculateLayout } from '@/components/editor/canvas-layout-utils';
import {
  measureNodeDims,
  type PositionedGroup,
  type PositionedNode,
} from '@/components/editor/canvas-constants';
import type { DiagramData } from '@/lib/types';
import type { Transform } from '@/hooks/use-canvas-transform';

export type ContentBounds = { minX: number; minY: number; maxX: number; maxY: number };

/**
 * Axis-aligned bounds of all nodes and zones after layout — same geometry as
 * {@link useCanvasTransform} `handleFitToView`.
 */
export function computeContentBounds(
  processedNodes: PositionedNode[],
  processedZones: PositionedGroup[]
): ContentBounds | null {
  const validNodes = processedNodes.filter(
    (n) =>
      typeof n.x === 'number' &&
      typeof n.y === 'number' &&
      !Number.isNaN(n.x) &&
      !Number.isNaN(n.y) &&
      Number.isFinite(n.x) &&
      Number.isFinite(n.y)
  );

  const validZones = processedZones.filter(
    (z) =>
      typeof z.x === 'number' &&
      typeof z.y === 'number' &&
      typeof z.width === 'number' &&
      typeof z.height === 'number' &&
      !Number.isNaN(z.x) &&
      !Number.isNaN(z.y) &&
      !Number.isNaN(z.width) &&
      !Number.isNaN(z.height) &&
      Number.isFinite(z.x) &&
      Number.isFinite(z.y) &&
      Number.isFinite(z.width) &&
      Number.isFinite(z.height) &&
      z.width > 0 &&
      z.height > 0
  );

  if (validNodes.length === 0 && validZones.length === 0) return null;

  let nodeMinX = Infinity;
  let nodeMinY = Infinity;
  let nodeMaxX = -Infinity;
  let nodeMaxY = -Infinity;

  validNodes.forEach((n) => {
    const dims = measureNodeDims(n);
    const x = n.x!;
    const y = n.y!;
    const width = dims.width;
    const height = dims.height;
    const nodeWidth = n.sizeMode === 'custom' && n.width ? n.width : width;
    const nodeHeight = n.sizeMode === 'custom' && n.height ? n.height : height;

    nodeMinX = Math.min(nodeMinX, x);
    nodeMinY = Math.min(nodeMinY, y);
    nodeMaxX = Math.max(nodeMaxX, x + nodeWidth);
    nodeMaxY = Math.max(nodeMaxY, y + nodeHeight);
  });

  let zoneMinX = Infinity;
  let zoneMinY = Infinity;
  let zoneMaxX = -Infinity;
  let zoneMaxY = -Infinity;

  validZones.forEach((z) => {
    const x = z.x!;
    const y = z.y!;
    const width = z.width!;
    const height = z.height!;
    zoneMinX = Math.min(zoneMinX, x);
    zoneMinY = Math.min(zoneMinY, y);
    zoneMaxX = Math.max(zoneMaxX, x + width);
    zoneMaxY = Math.max(zoneMaxY, y + height);
  });

  const minX = Math.min(
    validNodes.length > 0 ? nodeMinX : Infinity,
    validZones.length > 0 ? zoneMinX : Infinity
  );
  const minY = Math.min(
    validNodes.length > 0 ? nodeMinY : Infinity,
    validZones.length > 0 ? zoneMinY : Infinity
  );
  const maxX = Math.max(
    validNodes.length > 0 ? nodeMaxX : -Infinity,
    validZones.length > 0 ? zoneMaxX : -Infinity
  );
  const maxY = Math.max(
    validNodes.length > 0 ? nodeMaxY : -Infinity,
    validZones.length > 0 ? zoneMaxY : -Infinity
  );

  const contentWidth = maxX - minX;
  const contentHeight = maxY - minY;
  if (contentWidth <= 0 || contentHeight <= 0) return null;

  return { minX, minY, maxX, maxY };
}

/** Pan/zoom to fit bounds in viewport (matches viewer `handleToView` math). */
export function transformToFitBounds(
  bounds: ContentBounds,
  viewportWidth: number,
  viewportHeight: number,
  padding = 40
): Transform {
  const { minX, minY, maxX, maxY } = bounds;
  const contentWidth = maxX - minX;
  const contentHeight = maxY - minY;

  if (viewportWidth <= 0 || viewportHeight <= 0 || contentWidth <= 0 || contentHeight <= 0) {
    return { x: 0, y: 0, k: 1 };
  }

  const availableWidth = viewportWidth - 2 * padding;
  const availableHeight = viewportHeight - 2 * padding;
  const scaleX = availableWidth / contentWidth;
  const scaleY = availableHeight / contentHeight;
  let k = Math.min(scaleX, scaleY);
  k = Math.max(0.1, Math.min(2.5, k));

  const contentCenterX = (minX + maxX) / 2;
  const contentCenterY = (minY + maxY) / 2;
  const viewportCenterX = viewportWidth / 2;
  const viewportCenterY = viewportHeight / 2;
  const x = viewportCenterX - contentCenterX * k;
  const y = viewportCenterY - contentCenterY * k;

  return { x, y, k };
}

/**
 * One camera for all slides: union of every slide’s layout bounds, then fit that
 * rectangle to the viewport so no slide’s content is clipped at the chosen zoom.
 */
export function computeUnionFitTransformForDiagrams(
  diagrams: DiagramData[],
  viewportWidth: number,
  viewportHeight: number,
  padding = 40
): Transform | null {
  let unionMinX = Infinity;
  let unionMinY = Infinity;
  let unionMaxX = -Infinity;
  let unionMaxY = -Infinity;
  let hasAny = false;

  for (const diagram of diagrams) {
    const { processedNodes, processedZones } = calculateLayout(diagram);
    const b = computeContentBounds(processedNodes, processedZones);
    if (!b) continue;
    hasAny = true;
    unionMinX = Math.min(unionMinX, b.minX);
    unionMinY = Math.min(unionMinY, b.minY);
    unionMaxX = Math.max(unionMaxX, b.maxX);
    unionMaxY = Math.max(unionMaxY, b.maxY);
  }

  if (!hasAny) return null;
  return transformToFitBounds(
    { minX: unionMinX, minY: unionMinY, maxX: unionMaxX, maxY: unionMaxY },
    viewportWidth,
    viewportHeight,
    padding
  );
}

/** Matches `handleFitToView` in `use-canvas-transform`: clip element rect to the window. */
export function getElementVisibleViewportSize(element: HTMLElement): { width: number; height: number } {
  const rect = element.getBoundingClientRect();
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;
  const visibleLeft = Math.max(0, rect.left);
  const visibleTop = Math.max(0, rect.top);
  const visibleRight = Math.min(windowWidth, rect.right);
  const visibleBottom = Math.min(windowHeight, rect.bottom);
  return {
    width: visibleRight - visibleLeft,
    height: visibleBottom - visibleTop,
  };
}

/** Drop connections whose endpoints are not both visible (same as presentation playback). */
export function pruneConnectionsToVisibleNodes(diagram: DiagramData): DiagramData {
  const visibleNodeIds = new Set((diagram.nodes ?? []).map((node) => node.id));
  return {
    ...diagram,
    connections: (diagram.connections ?? []).filter(
      (conn) => visibleNodeIds.has(conn.from) && visibleNodeIds.has(conn.to)
    ),
  };
}
