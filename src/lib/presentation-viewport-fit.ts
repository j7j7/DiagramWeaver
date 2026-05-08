import { calculateLayout } from '@/components/editor/canvas-layout-utils';
import {
  nodeBoundingBoxForFit,
  type PositionedGroup,
  type PositionedNode,
} from '@/components/editor/canvas-constants';
import type { DiagramData, Slide } from '@/lib/types';
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
    const b = nodeBoundingBoxForFit(n);
    nodeMinX = Math.min(nodeMinX, b.minX);
    nodeMinY = Math.min(nodeMinY, b.minY);
    nodeMaxX = Math.max(nodeMaxX, b.maxX);
    nodeMaxY = Math.max(nodeMaxY, b.maxY);
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

/**
 * Like {@link computeContentBounds} but expands the box to include connection waypoints and a
 * margin for stroke width, bezier overshoot, and arrowheads — content that can extend past
 * node/zone AABBs (tight PNG export uses this so lines are not clipped).
 */
export function computeExportContentBounds(
  diagramData: DiagramData,
  processedNodes: PositionedNode[],
  processedZones: PositionedGroup[]
): ContentBounds | null {
  const base = computeContentBounds(processedNodes, processedZones);
  if (!base) return null;

  let minX = base.minX;
  let minY = base.minY;
  let maxX = base.maxX;
  let maxY = base.maxY;

  for (const conn of diagramData.connections ?? []) {
    for (const wp of conn.waypoints ?? []) {
      if (
        typeof wp.x === 'number' &&
        typeof wp.y === 'number' &&
        Number.isFinite(wp.x) &&
        Number.isFinite(wp.y)
      ) {
        minX = Math.min(minX, wp.x);
        minY = Math.min(minY, wp.y);
        maxX = Math.max(maxX, wp.x);
        maxY = Math.max(maxY, wp.y);
      }
    }
  }

  const curvePad = 40;
  return {
    minX: minX - curvePad,
    minY: minY - curvePad,
    maxX: maxX + curvePad,
    maxY: maxY + curvePad,
  };
}

/** Union of {@link computeExportContentBounds} across diagrams (e.g. presentation deck). */
export function computeUnionExportContentBounds(diagrams: DiagramData[]): ContentBounds | null {
  let unionMinX = Infinity;
  let unionMinY = Infinity;
  let unionMaxX = -Infinity;
  let unionMaxY = -Infinity;
  let hasAny = false;

  for (const diagram of diagrams) {
    const { processedNodes, processedZones } = calculateLayout(diagram);
    const b = computeExportContentBounds(diagram, processedNodes, processedZones);
    if (!b) continue;
    hasAny = true;
    unionMinX = Math.min(unionMinX, b.minX);
    unionMinY = Math.min(unionMinY, b.minY);
    unionMaxX = Math.max(unionMaxX, b.maxX);
    unionMaxY = Math.max(unionMaxY, b.maxY);
  }

  if (!hasAny) return null;
  return { minX: unionMinX, minY: unionMinY, maxX: unionMaxX, maxY: unionMaxY };
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
 * PNG pixel size and clone transform so the bitmap tightly wraps diagram content at the same
 * scale as `fitTransform.k`, with `borderPadPx` empty margin on each side in output pixels.
 */
export function computeTightPngFrameForBounds(
  bounds: ContentBounds,
  fitTransform: Transform,
  borderPadPx: number
): { width: number; height: number; transform: Transform } {
  const k = fitTransform.k;
  const { minX, minY, maxX, maxY } = bounds;
  const cw = maxX - minX;
  const ch = maxY - minY;
  const wPx = cw * k;
  const hPx = ch * k;
  const width = Math.max(1, Math.ceil(wPx + 1e-4) + 2 * borderPadPx);
  const height = Math.max(1, Math.ceil(hPx + 1e-4) + 2 * borderPadPx);
  const transform: Transform = {
    x: borderPadPx - minX * k,
    y: borderPadPx - minY * k,
    k,
  };
  return { width, height, transform };
}

/** Center content at a fixed zoom (same x/y math as fit, but k is chosen by the slide). */
export function transformToFitBoundsWithFixedZoom(
  bounds: ContentBounds,
  viewportWidth: number,
  viewportHeight: number,
  k: number,
  padding = 40
): Transform {
  const clampedK = Math.max(0.1, Math.min(2.5, k));
  const { minX, minY, maxX, maxY } = bounds;
  const contentCenterX = (minX + maxX) / 2;
  const contentCenterY = (minY + maxY) / 2;
  const viewportCenterX = viewportWidth / 2;
  const viewportCenterY = viewportHeight / 2;
  const x = viewportCenterX - contentCenterX * clampedK;
  const y = viewportCenterY - contentCenterY * clampedK;
  return { x, y, k: clampedK };
}

/**
 * Playback camera for one slide: prefers stored pan from snapshot; otherwise centers
 * slide content at the saved zoom (legacy slides that only stored `autoZoomLevel`).
 */
export function computeSlidePlaybackTransform(
  slide: Pick<Slide, 'autoZoomLevel' | 'viewPanX' | 'viewPanY'>,
  diagram: DiagramData | null,
  viewportWidth: number,
  viewportHeight: number
): Transform | null {
  if (typeof slide.autoZoomLevel !== 'number' || !Number.isFinite(slide.autoZoomLevel)) {
    return null;
  }
  const k = Math.max(0.1, Math.min(2.5, slide.autoZoomLevel));
  if (
    typeof slide.viewPanX === 'number' &&
    Number.isFinite(slide.viewPanX) &&
    typeof slide.viewPanY === 'number' &&
    Number.isFinite(slide.viewPanY)
  ) {
    return { x: slide.viewPanX, y: slide.viewPanY, k };
  }
  if (!diagram) {
    return { x: 0, y: 0, k };
  }
  const { processedNodes, processedZones } = calculateLayout(diagram);
  const bounds = computeContentBounds(processedNodes, processedZones);
  if (!bounds) {
    return { x: 0, y: 0, k };
  }
  return transformToFitBoundsWithFixedZoom(bounds, viewportWidth, viewportHeight, k);
}

/** Union axis-aligned bounds of every diagram’s layout (same geometry as union-fit zoom). */
export function computeUnionContentBounds(diagrams: DiagramData[]): ContentBounds | null {
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
  return { minX: unionMinX, minY: unionMinY, maxX: unionMaxX, maxY: unionMaxY };
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
  const bounds = computeUnionContentBounds(diagrams);
  if (!bounds) return null;
  return transformToFitBounds(bounds, viewportWidth, viewportHeight, padding);
}

/**
 * Size of the canvas host used for interactive fit math (union fit, resize observers).
 * Uses the element’s layout box — same as {@link getCanvasElementSizeForImageCapture} — not
 * the intersection with the window (which broke pan/zoom centering when the canvas is smaller
 * than the viewport or inset in the layout).
 */
export function getElementVisibleViewportSize(element: HTMLElement): { width: number; height: number } {
  return getCanvasElementSizeForImageCapture(element);
}

/**
 * Full layout size of the canvas host (what html-to-image rasterizes). Prefer this for pan/zoom
 * and fit math so dimensions match the transformed layer’s coordinate system.
 */
export function getCanvasElementSizeForImageCapture(element: HTMLElement): { width: number; height: number } {
  const w = element.clientWidth;
  const h = element.clientHeight;
  if (w > 0 && h > 0) {
    return { width: w, height: h };
  }
  const rect = element.getBoundingClientRect();
  return { width: Math.max(1, rect.width), height: Math.max(1, rect.height) };
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
