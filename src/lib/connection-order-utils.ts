import type { DiagramData, DiagramConnectionData } from "./types";
import type { PositionedNode, PositionedGroup } from "@/components/editor/canvas-constants";

/** Generate a unique connection id for new connections */
export function generateConnectionId(): string {
  return `conn-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/** Ensure all connections have unique ids. Mutates and returns connections. */
export function ensureConnectionIds(connections: DiagramConnectionData[]): DiagramConnectionData[] {
  return connections.map((c, idx) =>
    c.id ? c : { ...c, id: `conn-${idx}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}` }
  );
}

/** Same key as marquee selection, batch select, and `applyConnectionUpdates` (uuid or `from-to-index`). */
export function stableDiagramConnectionId(conn: DiagramConnectionData, index: number): string {
  return conn.id ?? `${conn.from}-${conn.to}-${index}`;
}

/**
 * True if `rawId` from tab selection / marquee refers to this connection row (uuid, `from-to-index`,
 * or unique legacy `from-to` when only one parallel edge exists).
 */
export function connectionSelectionIdMatches(
  rawId: string,
  conn: DiagramConnectionData,
  index: number,
  allConnections: DiagramConnectionData[]
): boolean {
  if (conn.id && rawId === conn.id) return true;
  if (`${conn.from}-${conn.to}-${index}` === rawId) return true;
  if (`${conn.from}-${conn.to}` === rawId) {
    const parallel = allConnections.filter((c) => c.from === conn.from && c.to === conn.to);
    return parallel.length === 1;
  }
  return false;
}

/** Whether this connection is included in the current selection set or is the primary selected edge. */
export function isDiagramConnectionInCanvasSelection(
  conn: DiagramConnectionData,
  index: number,
  allConnections: DiagramConnectionData[],
  selectedItemIds: Set<string> | undefined,
  selectedItemId: string | undefined,
  selectedItem: { itemType?: string; id?: string } | null | undefined
): boolean {
  if (selectedItem?.itemType === "edge" && selectedItem.id && connectionSelectionIdMatches(selectedItem.id, conn, index, allConnections)) {
    return true;
  }
  if (selectedItemId && connectionSelectionIdMatches(selectedItemId, conn, index, allConnections)) {
    return true;
  }
  if (!selectedItemIds?.size) return false;
  for (const id of selectedItemIds) {
    if (connectionSelectionIdMatches(id, conn, index, allConnections)) return true;
  }
  return false;
}

/** True if the selection set includes this connection row (any id form: uuid, from-to-index, unique from-to). */
export function selectionSetContainsConnection(
  selectedItemIds: Set<string>,
  conn: DiagramConnectionData,
  index: number,
  allConnections: DiagramConnectionData[]
): boolean {
  for (const raw of selectedItemIds) {
    if (connectionSelectionIdMatches(raw, conn, index, allConnections)) return true;
  }
  return false;
}

export interface ConnectionSlotResult {
  /** Sorted items (nodes, then zones) in visual order: index 0 = back, last = front */
  sortedItemIds: string[];
  /** Map: slot index -> array of connection indices. Slot K renders after item K-1, before item K. Slot n renders after last item. */
  connectionsBySlot: Map<number, number[]>;
}

/**
 * Z-indices for order-aware canvas interleaving per slot/item index `i`:
 * connections at `3*i`, labels at `3*i+1`, nodes at `3*i+2`.
 * All node types share the node tier so stacking order controls overlap.
 */
export function getInterleavedStackZIndices(itemIndex: number): {
  connectionZIndex: number;
  connectionTextZIndex: number;
  nodeZIndex: number;
} {
  const base = 3 * itemIndex;
  return {
    connectionZIndex: base,
    connectionTextZIndex: base + 1,
    nodeZIndex: base + 2,
  };
}

/** Lines-behind-nodes mode: all lines, then all labels, then nodes by stacking index. */
export function getLinesBehindNodesStackZIndices(nodeIndex: number): {
  connectionZIndex: number;
  connectionTextZIndex: number;
  nodeZIndex: number;
} {
  return {
    connectionZIndex: 0,
    connectionTextZIndex: 1,
    nodeZIndex: 10 + nodeIndex,
  };
}

/**
 * Computes connection rendering order based on item (node/zone) order.
 * A connection from A to B should render:
 * - Behind any item that is "in front of" both A and B (higher order than both endpoints)
 * - In front of any item that is "behind" both A and B (lower order than both endpoints)
 *
 * Slot assignment: connection goes in slot maxIdx+1, meaning it renders after the
 * "front" endpoint (maxIdx) and before the first item in front of both (maxIdx+1).
 */
export function computeConnectionSlots(
  diagramData: DiagramData,
  processedNodes: PositionedNode[],
  processedZones: PositionedGroup[]
): ConnectionSlotResult {
  const connections = diagramData.connections || [];

  // Build unified sorted item list: layer order for nodes, then zones
  const layerOrder = new Map<string, number>();
  if (diagramData.layers?.layers) {
    diagramData.layers.layers.forEach((layer, index) => {
      layerOrder.set(layer.id, index);
    });
  }

  const nodeIndexById = new Map<string, number>();
  diagramData.nodes.forEach((n, index) => {
    nodeIndexById.set(n.id, index);
  });

  const sortedNodes = [...processedNodes].sort((a, b) => {
    const layerA = layerOrder.get(a.layer || "background") ?? 0;
    const layerB = layerOrder.get(b.layer || "background") ?? 0;
    if (layerA !== layerB) return layerA - layerB;
    return (nodeIndexById.get(a.id) ?? 0) - (nodeIndexById.get(b.id) ?? 0);
  });

  // Combine nodes and zones; nodes first (zones are deprecated but may exist)
  const sortedItems: Array<{ id: string; isZone: boolean }> = [
    ...sortedNodes.map((n) => ({ id: n.id, isZone: false })),
    ...processedZones.map((z) => ({ id: z.id, isZone: true })),
  ];

  const itemOrderById = new Map<string, number>();
  sortedItems.forEach((item, index) => {
    itemOrderById.set(item.id, index);
  });

  const n = sortedItems.length;
  const connectionsBySlot = new Map<number, number[]>();

  connections.forEach((conn: DiagramConnectionData, connIndex: number) => {
    const fromIdx = itemOrderById.get(conn.from);
    const toIdx = itemOrderById.get(conn.to);

    if (fromIdx === undefined || toIdx === undefined) {
      // Endpoint not in our list (e.g. nested); put at front
      const slot = n;
      if (!connectionsBySlot.has(slot)) connectionsBySlot.set(slot, []);
      connectionsBySlot.get(slot)!.push(connIndex);
      return;
    }

    const minIdx = Math.min(fromIdx, toIdx);
    const maxIdx = Math.max(fromIdx, toIdx);
    // Slot = maxIdx+1: render after item[maxIdx], before item[maxIdx+1]
    // When maxIdx+1 >= n, slot n = after last item (in front of everything)
    const slot = maxIdx + 1;

    if (!connectionsBySlot.has(slot)) connectionsBySlot.set(slot, []);
    connectionsBySlot.get(slot)!.push(connIndex);
  });

  return {
    sortedItemIds: sortedItems.map((i) => i.id),
    connectionsBySlot,
  };
}
