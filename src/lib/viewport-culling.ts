import type { DiagramData, DiagramNodeData, DiagramConnectionData } from "@/lib/types";
import { measureNodeDims } from "@/components/editor/canvas-constants";

export type ViewportBounds = { minX: number; minY: number; maxX: number; maxY: number };
export type Transform = { x: number; y: number; k: number };

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

  const viewportMinX = viewportBounds.minX - margin;
  const viewportMinY = viewportBounds.minY - margin;
  const viewportMaxX = viewportBounds.maxX + margin;
  const viewportMaxY = viewportBounds.maxY + margin;

  // Check if node bounding box intersects with viewport
  return !(
    nodeMaxX < viewportMinX ||
    nodeMinX > viewportMaxX ||
    nodeMaxY < viewportMinY ||
    nodeMinY > viewportMaxY
  );
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

/**
 * Check if a connection should be rendered based on visible nodes.
 *
 * A connection is visible if both its endpoints (from and to nodes) are visible.
 * This prevents rendering connections that go off-screen.
 *
 * @param connection - Connection data
 * @param visibleNodeIds - Set of visible node IDs
 * @returns true if connection should be rendered
 */
export function isConnectionVisible(
  connection: DiagramConnectionData,
  visibleNodeIds: Set<string>
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

  return connections.filter((conn) =>
    isConnectionVisible(conn, visibleNodeIds)
  );
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

  // Filter visible connections
  const visibleConnections = filterVisibleConnections(connections, visibleNodeIds);

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
