import type { DiagramData, DiagramConnectionData } from '@/lib/types';
import { calculateLayout } from '@/components/editor/canvas-layout-utils';
import { computeConnectionSlots } from '@/lib/connection-order-utils';

/** Match `use-layer-animation` stagger so slide transitions feel consistent with layer show/hide. */
export const SLIDE_STAGGER_MS = 80;

function connectionKey(conn: DiagramConnectionData): string {
  return (conn as any).id || `${conn.from}\u2192${conn.to}`;
}

function getSortedNodeIds(diagramData: DiagramData): string[] {
  const { processedNodes, processedZones } = calculateLayout(diagramData);
  const { sortedItemIds } = computeConnectionSlots(diagramData, processedNodes, processedZones);
  const nodeIds = new Set((diagramData.nodes || []).map((n) => n.id));
  return sortedItemIds.filter((id) => nodeIds.has(id));
}

function buildItemOrderMap(diagramData: DiagramData): Map<string, number> {
  const { processedNodes, processedZones } = calculateLayout(diagramData);
  const { sortedItemIds } = computeConnectionSlots(diagramData, processedNodes, processedZones);
  const m = new Map<string, number>();
  sortedItemIds.forEach((id, index) => {
    m.set(id, index);
  });
  return m;
}

/**
 * Stagger delays only for items that actually transition (caller filters).
 * Order: canvas stack order (back → front): current diagram order first, then prev-only nodes.
 */
export function buildStaggerDelaysForSlideTransition(
  changingNodeIds: Set<string>,
  changingConnKeys: Set<string>,
  currentDiagram: DiagramData,
  previousDiagram: DiagramData,
): { nodeDelayMs: Map<string, number>; connectionDelayMs: Map<string, number>; maxStaggerMs: number } {
  const nodeDelayMs = new Map<string, number>();
  const connectionDelayMs = new Map<string, number>();

  if (changingNodeIds.size === 0 && changingConnKeys.size === 0) {
    return { nodeDelayMs, connectionDelayMs, maxStaggerMs: 0 };
  }

  const currSorted = getSortedNodeIds(currentDiagram);
  const prevSorted = getSortedNodeIds(previousDiagram);

  const orderedNodes: string[] = [];
  const seen = new Set<string>();
  for (const id of currSorted) {
    if (changingNodeIds.has(id)) {
      orderedNodes.push(id);
      seen.add(id);
    }
  }
  for (const id of prevSorted) {
    if (changingNodeIds.has(id) && !seen.has(id)) {
      orderedNodes.push(id);
      seen.add(id);
    }
  }

  orderedNodes.forEach((id, i) => {
    nodeDelayMs.set(id, i * SLIDE_STAGGER_MS);
  });

  const currOrder = buildItemOrderMap(currentDiagram);
  const prevOrder = buildItemOrderMap(previousDiagram);

  function stackIndexForConnection(conn: DiagramConnectionData): number {
    const cf = currOrder.get(conn.from);
    const ct = currOrder.get(conn.to);
    if (cf !== undefined && ct !== undefined) {
      return Math.max(cf, ct);
    }
    const pf = prevOrder.get(conn.from);
    const pt = prevOrder.get(conn.to);
    if (pf !== undefined && pt !== undefined) {
      return Math.max(pf, pt);
    }
    const candidates = [cf, ct, pf, pt].filter((x): x is number => x !== undefined);
    return candidates.length ? Math.max(...candidates) : 0;
  }

  const connEntries = [...changingConnKeys]
    .map((key) => {
      const conn =
        (currentDiagram.connections || []).find((c) => connectionKey(c) === key) ??
        (previousDiagram.connections || []).find((c) => connectionKey(c) === key);
      return conn ? { key, stackIdx: stackIndexForConnection(conn) } : null;
    })
    .filter((e): e is { key: string; stackIdx: number } => e !== null);

  connEntries.sort((a, b) => a.stackIdx - b.stackIdx);
  connEntries.forEach((e, i) => {
    connectionDelayMs.set(e.key, i * SLIDE_STAGGER_MS);
  });

  let maxStaggerMs = 0;
  for (const v of nodeDelayMs.values()) maxStaggerMs = Math.max(maxStaggerMs, v);
  for (const v of connectionDelayMs.values()) maxStaggerMs = Math.max(maxStaggerMs, v);

  return { nodeDelayMs, connectionDelayMs, maxStaggerMs };
}
