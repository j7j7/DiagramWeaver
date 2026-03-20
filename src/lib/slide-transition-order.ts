import type { DiagramData, DiagramConnectionData } from '@/lib/types';
import { calculateLayout } from '@/components/editor/canvas-layout-utils';
import { computeConnectionSlots } from '@/lib/connection-order-utils';

/** Match `use-layer-animation` stagger so slide transitions feel consistent with layer show/hide. */
export const SLIDE_STAGGER_MS = 80;

function connKey(conn: DiagramConnectionData): string {
  return (conn as any).id || `${conn.from}\u2192${conn.to}`;
}

/**
 * Stack order for slide transitions: same as viewer/editor (see `computeConnectionSlots`):
 * layers from back to front, then zones. Index 0 = back (lowest z), last = front.
 */
export function buildSlideTransitionStaggerMaps(diagramData: DiagramData): {
  nodeDelayMs: Map<string, number>;
  connectionDelayMs: Map<string, number>;
  maxStaggerMs: number;
} {
  const { processedNodes, processedZones } = calculateLayout(diagramData);
  const { sortedItemIds } = computeConnectionSlots(diagramData, processedNodes, processedZones);

  const nodeIds = new Set((diagramData.nodes || []).map((n) => n.id));

  const itemOrderById = new Map<string, number>();
  sortedItemIds.forEach((id, index) => {
    itemOrderById.set(id, index);
  });

  const nodeDelayMs = new Map<string, number>();
  let nodeOrdinal = 0;
  for (const id of sortedItemIds) {
    if (!nodeIds.has(id)) continue;
    nodeDelayMs.set(id, nodeOrdinal * SLIDE_STAGGER_MS);
    nodeOrdinal++;
  }

  const connectionDelayMs = new Map<string, number>();
  const nItems = sortedItemIds.length;
  for (const conn of diagramData.connections || []) {
    const key = connKey(conn);
    const fromIdx = itemOrderById.get(conn.from);
    const toIdx = itemOrderById.get(conn.to);
    let stackIdx = 0;
    if (fromIdx !== undefined && toIdx !== undefined) {
      stackIdx = Math.max(fromIdx, toIdx);
    } else if (fromIdx !== undefined) {
      stackIdx = fromIdx;
    } else if (toIdx !== undefined) {
      stackIdx = toIdx;
    } else {
      stackIdx = nItems;
    }
    connectionDelayMs.set(key, stackIdx * SLIDE_STAGGER_MS);
  }

  let maxStaggerMs = 0;
  for (const v of nodeDelayMs.values()) maxStaggerMs = Math.max(maxStaggerMs, v);
  for (const v of connectionDelayMs.values()) maxStaggerMs = Math.max(maxStaggerMs, v);

  return { nodeDelayMs, connectionDelayMs, maxStaggerMs };
}
