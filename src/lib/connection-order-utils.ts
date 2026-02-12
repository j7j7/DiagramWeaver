import type { DiagramData, DiagramConnectionData } from "./types";
import type { PositionedNode, PositionedGroup } from "@/components/editor/canvas-constants";

export interface ConnectionSlotResult {
  /** Sorted items (nodes, then zones) in visual order: index 0 = back, last = front */
  sortedItemIds: string[];
  /** Map: slot index -> array of connection indices. Slot K renders after item K-1, before item K. Slot n renders after last item. */
  connectionsBySlot: Map<number, number[]>;
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

  const sortedNodes = [...processedNodes].sort((a, b) => {
    const layerA = layerOrder.get(a.layer || "background") ?? 0;
    const layerB = layerOrder.get(b.layer || "background") ?? 0;
    return layerA - layerB;
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
