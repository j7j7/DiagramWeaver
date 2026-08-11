import type { DiagramData, DiagramNodeData, DiagramConnectionData } from "@/lib/types";
import { measureNodeDims, type PositionedGroup, type PositionedNode } from "@/components/editor/canvas-constants";
import { hostRectToDiagramViewRect } from "@/lib/connector-obstacle-viewport-freeze";

export type ViewportBounds = { minX: number; minY: number; maxX: number; maxY: number };
export type Transform = { x: number; y: number; k: number };

/** Screen-space padding so items do not pop in/out at the viewport edge when panning. */
export const VIEWPORT_CULL_SCREEN_MARGIN_PX = 32;

/** Cap diagram-space margin so zoomed-out views do not keep distant items (128px at k=0.2 → 640 diagram units). */
export const VIEWPORT_CULL_MAX_DIAGRAM_MARGIN = 48;

/**
 * Screen margin for connection cull tests (endpoint boxes + path segments).
 * Prefer segment–vs–view over a full endpoint AABB so zoomed-out empty corners stay culled.
 */
export const VIEWPORT_CULL_CONNECTION_SCREEN_MARGIN_PX = 16;

/** Legacy threshold — kept for docs/tests; activation uses {@link shouldActivateViewportRenderCull}. */
export const VIEWPORT_CULL_MIN_ITEMS = 4;

/** Enable viewport culling whenever there is canvas content to filter (items and/or connections). */
export function shouldActivateViewportRenderCull(
  totalItems: number,
  totalConnections: number,
): boolean {
  return totalItems > 0 || totalConnections > 0;
}

export function diagramMarginFromScreenPx(
  screenPx: number,
  scale: number,
  maxDiagramMargin: number = VIEWPORT_CULL_MAX_DIAGRAM_MARGIN,
): number {
  if (!scale || scale <= 0) return Math.min(screenPx, maxDiagramMargin);
  return Math.min(screenPx / scale, maxDiagramMargin);
}

/**
 * Calculate visible viewport bounds in diagram coordinates.
 *
 * The viewport is what the user sees on screen. We need to convert screen
 * coordinates to diagram coordinates by applying the inverse transform.
 *
 * @param transform - Current pan/zoom transform {x, y, k}
 * @param viewportWidth - Canvas width in pixels
 * @param viewportHeight - Canvas height in pixels
 * @returns Viewport bounds in diagram coordinates
 */
export function calculateViewportBounds(
  transform: Transform,
  viewportWidth: number,
  viewportHeight: number
): ViewportBounds {
  const { x, y, k } = transform;

  // Inverse transform: convert screen coordinates to diagram coordinates
  // Screen to diagram: (screen - offset) / scale
  const minX = -x / k;
  const minY = -y / k;
  const maxX = (viewportWidth - x) / k;
  const maxY = (viewportHeight - y) / k;

  return { minX, minY, maxX, maxY };
}

export function viewportBoundsFromHost(
  transform: Transform,
  viewportWidth: number,
  viewportHeight: number,
): ViewportBounds | null {
  return hostRectToDiagramViewRect(viewportWidth, viewportHeight, transform);
}

function rectIntersectsExpandedView(
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  view: ViewportBounds,
  margin: number,
): boolean {
  const viewportMinX = view.minX - margin;
  const viewportMinY = view.minY - margin;
  const viewportMaxX = view.maxX + margin;
  const viewportMaxY = view.maxY + margin;
  return !(
    maxX < viewportMinX ||
    minX > viewportMaxX ||
    maxY < viewportMinY ||
    minY > viewportMaxY
  );
}

/**
 * Check if a node's bounding box intersects with the viewport.
 *
 * @param node - Node data with position
 * @param viewportBounds - Viewport bounds in diagram coordinates
 * @param margin - Additional margin in pixels (diagram coordinates) to prevent popping at edges
 * @returns true if node is visible
 */
export function isNodeInViewport(
  node: DiagramNodeData & { x: number; y: number },
  viewportBounds: ViewportBounds,
  margin: number = 100
): boolean {
  const dims = measureNodeDims(node);
  const nodeX = node.x;
  const nodeY = node.y;
  const nodeWidth = node.sizeMode === 'custom' && node.width ? node.width : dims.width;
  const nodeHeight = node.sizeMode === 'custom' && node.height ? node.height : dims.height;

  const nodeMinX = nodeX;
  const nodeMinY = nodeY;
  const nodeMaxX = nodeX + nodeWidth;
  const nodeMaxY = nodeY + nodeHeight;

  return rectIntersectsExpandedView(nodeMinX, nodeMinY, nodeMaxX, nodeMaxY, viewportBounds, margin);
}

export function isZoneInViewport(
  zone: { x?: number; y?: number; width: number; height: number },
  viewportBounds: ViewportBounds,
  margin: number = 100,
): boolean {
  const nodeMinX = zone.x ?? 0;
  const nodeMinY = zone.y ?? 0;
  const nodeMaxX = nodeMinX + zone.width;
  const nodeMaxY = nodeMinY + zone.height;
  return rectIntersectsExpandedView(nodeMinX, nodeMinY, nodeMaxX, nodeMaxY, viewportBounds, margin);
}

/**
 * Filter nodes to only those visible in the viewport.
 *
 * @param nodes - All nodes
 * @param transform - Current pan/zoom transform
 * @param viewportWidth - Canvas width in pixels
 * @param viewportHeight - Canvas height in pixels
 * @param margin - Additional margin in pixels (diagram coordinates)
 * @returns Set of visible node IDs
 */
export function filterVisibleNodes(
  nodes: (DiagramNodeData & { x: number; y: number })[],
  transform: Transform,
  viewportWidth: number,
  viewportHeight: number,
  margin: number = 100
): Set<string> {
  if (nodes.length === 0) {
    return new Set();
  }

  const viewportBounds = calculateViewportBounds(transform, viewportWidth, viewportHeight);
  const visibleNodeIds = new Set<string>();

  for (const node of nodes) {
    if (isNodeInViewport(node, viewportBounds, margin)) {
      visibleNodeIds.add(node.id);
    }
  }

  return visibleNodeIds;
}

type PositionedItemRef = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  type?: string;
  sizeMode?: DiagramNodeData["sizeMode"];
};

function itemBounds(
  item: PositionedItemRef,
  asNode: boolean,
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const x = item.x;
  const y = item.y;
  if (x === undefined || y === undefined) return null;
  if (asNode) {
    const dims = measureNodeDims(item as PositionedNode);
    const w = item.sizeMode === "custom" && item.width ? item.width : dims.width;
    const h = item.sizeMode === "custom" && item.height ? item.height : dims.height;
    return { minX: x, minY: y, maxX: x + w, maxY: y + h };
  }
  const w = item.width ?? 300;
  const h = item.height ?? 200;
  return { minX: x, minY: y, maxX: x + w, maxY: y + h };
}

function itemCenter(
  item: PositionedItemRef,
  asNode: boolean,
): { x: number; y: number } | null {
  const bounds = itemBounds(item, asNode);
  if (!bounds) return null;
  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  };
}

function pointInExpandedView(
  x: number,
  y: number,
  view: ViewportBounds,
  margin: number,
): boolean {
  return (
    x >= view.minX - margin &&
    x <= view.maxX + margin &&
    y >= view.minY - margin &&
    y <= view.maxY + margin
  );
}

/** Orientation for segment intersection (0 collinear, 1/2 clockwise/ccw). */
function orient3(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
): number {
  const value = (by - ay) * (cx - bx) - (bx - ax) * (cy - by);
  if (Math.abs(value) < 1e-9) return 0;
  return value > 0 ? 1 : 2;
}

function pointOnSegment(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
): boolean {
  return (
    bx <= Math.max(ax, cx) + 1e-9 &&
    bx >= Math.min(ax, cx) - 1e-9 &&
    by <= Math.max(ay, cy) + 1e-9 &&
    by >= Math.min(ay, cy) - 1e-9
  );
}

function segmentsIntersect(
  p1x: number,
  p1y: number,
  q1x: number,
  q1y: number,
  p2x: number,
  p2y: number,
  q2x: number,
  q2y: number,
): boolean {
  const o1 = orient3(p1x, p1y, q1x, q1y, p2x, p2y);
  const o2 = orient3(p1x, p1y, q1x, q1y, q2x, q2y);
  const o3 = orient3(p2x, p2y, q2x, q2y, p1x, p1y);
  const o4 = orient3(p2x, p2y, q2x, q2y, q1x, q1y);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && pointOnSegment(p1x, p1y, p2x, p2y, q1x, q1y)) return true;
  if (o2 === 0 && pointOnSegment(p1x, p1y, q2x, q2y, q1x, q1y)) return true;
  if (o3 === 0 && pointOnSegment(p2x, p2y, p1x, p1y, q2x, q2y)) return true;
  if (o4 === 0 && pointOnSegment(p2x, p2y, q1x, q1y, q2x, q2y)) return true;
  return false;
}

/** True if the open segment crosses or touches the padded viewport rectangle. */
export function segmentIntersectsExpandedView(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  view: ViewportBounds,
  margin: number,
): boolean {
  if (pointInExpandedView(ax, ay, view, margin) || pointInExpandedView(bx, by, view, margin)) {
    return true;
  }
  const minX = view.minX - margin;
  const minY = view.minY - margin;
  const maxX = view.maxX + margin;
  const maxY = view.maxY + margin;
  // Quick reject against padded view AABB
  if (
    Math.max(ax, bx) < minX ||
    Math.min(ax, bx) > maxX ||
    Math.max(ay, by) < minY ||
    Math.min(ay, by) > maxY
  ) {
    return false;
  }
  return (
    segmentsIntersect(ax, ay, bx, by, minX, minY, maxX, minY) ||
    segmentsIntersect(ax, ay, bx, by, maxX, minY, maxX, maxY) ||
    segmentsIntersect(ax, ay, bx, by, maxX, maxY, minX, maxY) ||
    segmentsIntersect(ax, ay, bx, by, minX, maxY, minX, minY)
  );
}

function polylineIntersectsExpandedView(
  points: Array<{ x: number; y: number }>,
  view: ViewportBounds,
  margin: number,
): boolean {
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (segmentIntersectsExpandedView(a.x, a.y, b.x, b.y, view, margin)) {
      return true;
    }
  }
  return false;
}

/**
 * Cheap path samples for cull tests (not full router output).
 * Centers + waypoints cover stored routes; orthogonal without waypoints also
 * samples both simple Z trunks so mid-path zooms keep L/Z lines mounted.
 */
function connectionCullPolylines(
  connection: DiagramConnectionData,
  fromCenter: { x: number; y: number },
  toCenter: { x: number; y: number },
): Array<Array<{ x: number; y: number }>> {
  const waypoints = (connection.waypoints ?? []).filter(
    (wp) => typeof wp.x === "number" && typeof wp.y === "number" && Number.isFinite(wp.x) && Number.isFinite(wp.y),
  );
  if (waypoints.length > 0) {
    return [[fromCenter, ...waypoints.map((wp) => ({ x: wp.x, y: wp.y })), toCenter]];
  }
  if (connection.style === "orthogonal") {
    const midX = (fromCenter.x + toCenter.x) / 2;
    const midY = (fromCenter.y + toCenter.y) / 2;
    return [
      // Chord covers mid-path zooms even when the live trunk is offset from mid
      [fromCenter, toCenter],
      // Horizontal-first Z (vertical trunk at midX)
      [fromCenter, { x: midX, y: fromCenter.y }, { x: midX, y: toCenter.y }, toCenter],
      // Vertical-first Z (horizontal trunk at midY)
      [fromCenter, { x: fromCenter.x, y: midY }, { x: toCenter.x, y: midY }, toCenter],
    ];
  }
  // Bezier / default: chord is enough for cull (curve bow stays near the chord at typical curvature)
  return [[fromCenter, toCenter]];
}

/**
 * Connection is drawn when either endpoint box intersects the padded view, or when
 * a cheap path sample (centers + waypoints, or orthogonal Z trunks) crosses the view.
 * Uses segment–vs–rect (not the endpoint AABB) so zoomed-out empty corners stay culled
 * while mid-path zoom (endpoints off-screen) still shows the line.
 */
export function isConnectionInViewport(
  connection: DiagramConnectionData,
  nodesById: Record<string, PositionedItemRef>,
  zonesById: Record<string, PositionedGroup>,
  viewportBounds: ViewportBounds,
  margin: number,
  visibleItemIds?: Set<string>,
): boolean {
  if (visibleItemIds?.has(connection.from) || visibleItemIds?.has(connection.to)) {
    return true;
  }
  const fromItem = nodesById[connection.from] ?? zonesById[connection.from];
  const toItem = nodesById[connection.to] ?? zonesById[connection.to];
  if (!fromItem || !toItem) return false;
  const fromIsNode = connection.from in nodesById;
  const toIsNode = connection.to in nodesById;
  const fromBounds = itemBounds(fromItem, fromIsNode);
  const toBounds = itemBounds(toItem, toIsNode);
  if (!fromBounds || !toBounds) return false;
  if (
    rectIntersectsExpandedView(
      fromBounds.minX,
      fromBounds.minY,
      fromBounds.maxX,
      fromBounds.maxY,
      viewportBounds,
      margin,
    ) ||
    rectIntersectsExpandedView(
      toBounds.minX,
      toBounds.minY,
      toBounds.maxX,
      toBounds.maxY,
      viewportBounds,
      margin,
    )
  ) {
    return true;
  }

  const fromCenter = itemCenter(fromItem, fromIsNode);
  const toCenter = itemCenter(toItem, toIsNode);
  if (!fromCenter || !toCenter) return false;

  for (const poly of connectionCullPolylines(connection, fromCenter, toCenter)) {
    if (polylineIntersectsExpandedView(poly, viewportBounds, margin)) {
      return true;
    }
  }
  return false;
}

/** @deprecated Prefer {@link isConnectionInViewport} — both endpoints visible is too strict for panning. */
export function isConnectionVisible(
  connection: DiagramConnectionData,
  visibleNodeIds: Set<string>,
): boolean {
  return visibleNodeIds.has(connection.from) && visibleNodeIds.has(connection.to);
}

/**
 * Filter connections to only those with visible endpoints.
 *
 * @param connections - All connections
 * @param visibleNodeIds - Set of visible node IDs
 * @returns Filtered connections
 */
export function filterVisibleConnections(
  connections: DiagramConnectionData[],
  visibleNodeIds: Set<string>
): DiagramConnectionData[] {
  if (visibleNodeIds.size === 0) {
    return [];
  }

  return connections.filter((conn) => isConnectionVisible(conn, visibleNodeIds));
}

export function filterVisibleConnectionIndices(
  connections: DiagramConnectionData[],
  nodesById: Record<string, PositionedNode>,
  zonesById: Record<string, PositionedGroup>,
  viewportBounds: ViewportBounds,
  margin: number,
  visibleItemIds: Set<string>,
): Set<number> {
  const indices = new Set<number>();
  connections.forEach((conn, index) => {
    if (
      isConnectionInViewport(conn, nodesById, zonesById, viewportBounds, margin, visibleItemIds)
    ) {
      indices.add(index);
    }
  });
  return indices;
}

/** Intersect slot connection indices with a viewport cull set (for interleaved layering). */
export function intersectConnectionIndexSet(
  slotIndices: number[] | undefined,
  visibleIndices: Set<number> | null,
): Set<number> | undefined {
  if (!slotIndices?.length) return undefined;
  if (!visibleIndices) return new Set(slotIndices);
  const merged: number[] = [];
  for (const idx of slotIndices) {
    if (visibleIndices.has(idx)) merged.push(idx);
  }
  return merged.length > 0 ? new Set(merged) : undefined;
}

export interface ViewportRenderCullInput {
  nodesById: Record<string, PositionedNode>;
  zonesById: Record<string, PositionedGroup>;
  connections: DiagramConnectionData[];
  transform: Transform;
  viewportWidth: number;
  viewportHeight: number;
  forceIncludeItemIds?: Iterable<string>;
  forceIncludeConnectionIndices?: Iterable<number>;
  screenMarginPx?: number;
  enabled?: boolean;
}

export interface ViewportRenderCullResult {
  enabled: boolean;
  visibleItemIds: Set<string>;
  visibleConnectionIndices: Set<number>;
}

/** Live stats for the editor menubar viewport-cull debug readout. */
export interface ViewportCullDebugStats {
  totalItems: number;
  renderedItems: number;
  totalConnections: number;
  renderedConnections: number;
  cullingActive: boolean;
}

export function buildViewportCullDebugStats(
  nodesById: Record<string, PositionedNode>,
  zonesById: Record<string, PositionedGroup>,
  connections: DiagramConnectionData[],
  cull: ViewportRenderCullResult,
): ViewportCullDebugStats {
  const totalItems = Object.keys(nodesById).length + Object.keys(zonesById).length;
  return {
    totalItems,
    renderedItems: cull.visibleItemIds.size,
    totalConnections: connections.length,
    renderedConnections: cull.visibleConnectionIndices.size,
    cullingActive: cull.enabled,
  };
}

/**
 * Compute which canvas items and connections should mount for the current pan/zoom.
 */
export function computeViewportRenderCull({
  nodesById,
  zonesById,
  connections,
  transform,
  viewportWidth,
  viewportHeight,
  forceIncludeItemIds = [],
  forceIncludeConnectionIndices = [],
  screenMarginPx = VIEWPORT_CULL_SCREEN_MARGIN_PX,
  enabled = true,
}: ViewportRenderCullInput): ViewportRenderCullResult {
  const allItemIds = [...Object.keys(nodesById), ...Object.keys(zonesById)];
  const totalItems = allItemIds.length;
  const allConnectionIndices = new Set(connections.map((_, i) => i));

  if (
    !enabled ||
    viewportWidth <= 0 ||
    viewportHeight <= 0 ||
    !shouldActivateViewportRenderCull(totalItems, connections.length)
  ) {
    return {
      enabled: false,
      visibleItemIds: new Set(allItemIds),
      visibleConnectionIndices: allConnectionIndices,
    };
  }

  const view = viewportBoundsFromHost(transform, viewportWidth, viewportHeight);
  if (!view) {
    return {
      enabled: false,
      visibleItemIds: new Set(allItemIds),
      visibleConnectionIndices: allConnectionIndices,
    };
  }

  const itemMargin = diagramMarginFromScreenPx(screenMarginPx, transform.k);
  const connectionMargin = diagramMarginFromScreenPx(
    VIEWPORT_CULL_CONNECTION_SCREEN_MARGIN_PX,
    transform.k,
    Math.min(VIEWPORT_CULL_MAX_DIAGRAM_MARGIN, 32),
  );
  const visibleItemIds = new Set<string>();

  for (const id of Object.keys(nodesById)) {
    const node = nodesById[id];
    if (node.x !== undefined && node.y !== undefined && isNodeInViewport(node, view, itemMargin)) {
      visibleItemIds.add(id);
    }
  }
  for (const id of Object.keys(zonesById)) {
    const zone = zonesById[id];
    if (isZoneInViewport(zone, view, itemMargin)) {
      visibleItemIds.add(id);
    }
  }

  for (const id of forceIncludeItemIds) {
    if (id) visibleItemIds.add(id);
  }

  const visibleConnectionIndices = filterVisibleConnectionIndices(
    connections,
    nodesById,
    zonesById,
    view,
    connectionMargin,
    visibleItemIds,
  );
  for (const index of forceIncludeConnectionIndices) {
    visibleConnectionIndices.add(index);
  }

  return {
    enabled: true,
    visibleItemIds,
    visibleConnectionIndices,
  };
}

/**
 * Apply viewport culling to diagram data.
 *
 * This is the main entry point for viewport culling. It returns filtered
 * nodes and connections based on the current viewport.
 *
 * @param diagramData - Full diagram data
 * @param transform - Current pan/zoom transform
 * @param viewportWidth - Canvas width in pixels
 * @param viewportHeight - Canvas height in pixels
 * @param options - Culling options
 * @returns Filtered diagram data with only visible nodes and connections
 */
export function applyViewportCulling(
  diagramData: DiagramData,
  transform: Transform,
  viewportWidth: number,
  viewportHeight: number,
  options: {
    margin?: number;
    enabled?: boolean;
  } = {}
): {
  nodes: DiagramNodeData[];
  connections: DiagramConnectionData[];
  visibleNodeIds: Set<string>;
} {
  const { margin = 100, enabled = true } = options;

  if (!enabled) {
    return {
      nodes: diagramData.nodes || [],
      connections: diagramData.connections || [],
      visibleNodeIds: new Set((diagramData.nodes || []).map((n) => n.id)),
    };
  }

  const nodes = diagramData.nodes || [];
  const connections = diagramData.connections || [];

  // Filter visible nodes (only nodes with valid x/y coordinates)
  const nodesWithCoordinates = nodes.filter((n): n is DiagramNodeData & { x: number; y: number } => 
    n.x !== undefined && n.y !== undefined
  );
  const visibleNodeIds = filterVisibleNodes(nodesWithCoordinates, transform, viewportWidth, viewportHeight, margin);

  const nodesByIdForCull = nodesWithCoordinates.reduce(
    (acc, n) => {
      acc[n.id] = n as PositionedNode;
      return acc;
    },
    {} as Record<string, PositionedNode>,
  );
  const view = viewportBoundsFromHost(transform, viewportWidth, viewportHeight);
  const visibleConnections =
    view === null
      ? connections
      : connections.filter((conn) =>
          isConnectionInViewport(conn, nodesByIdForCull, {}, view, margin, visibleNodeIds),
        );

  // Return filtered data
  const visibleNodes = nodes.filter((n) => visibleNodeIds.has(n.id));

  return {
    nodes: visibleNodes,
    connections: visibleConnections,
    visibleNodeIds,
  };
}

/**
 * Debug utility: Log viewport culling statistics.
 *
 * @param totalNodes - Total number of nodes
 * @param visibleNodes - Number of visible nodes
 * @param totalConnections - Total number of connections
 * @param visibleConnections - Number of visible connections
 */
export function logCullingStats(
  totalNodes: number,
  visibleNodes: number,
  totalConnections: number,
  visibleConnections: number
): void {
  const nodeReduction = totalNodes > 0 ? ((totalNodes - visibleNodes) / totalNodes * 100).toFixed(1) : 0;
  const connReduction = totalConnections > 0 ? ((totalConnections - visibleConnections) / totalConnections * 100).toFixed(1) : 0;

  console.log(`[Viewport Culling] Nodes: ${visibleNodes}/${totalNodes} (${nodeReduction}% culled)`);
  console.log(`[Viewport Culling] Connections: ${visibleConnections}/${totalConnections} (${connReduction}% culled)`);
}
