import type { DiagramData, DiagramNodeData, DiagramZoneData } from "./types";
import { DEFAULT_LAYER_ID } from "./layers-utils";
import { calculateLayout } from "@/components/editor/canvas-layout-utils";
import { computeConnectionSlots } from "./connection-order-utils";

/**
 * Back-to-forward render list from connection slot logic (index 0 = back, last = front).
 * Matches `EditorCanvas` / `computeConnectionSlots`.
 */
export function getBackToForwardItemOrder(diagramData: DiagramData): string[] {
  const { processedNodes, processedZones } = calculateLayout(diagramData);
  return computeConnectionSlots(diagramData, processedNodes, processedZones).sortedItemIds;
}

/** Front (top) → back (bottom) for UI: top row is drawn on top. */
export function frontToBackFromBackToForward(b2f: string[]): string[] {
  return [...b2f].reverse();
}

export function backToForwardFromFrontToBack(f2b: string[]): string[] {
  return [...f2b].reverse();
}

/** Per-item key so render-order runs (layer blocks + zone block) stay contiguous. */
export function stackKeyForZOrder(id: string, diagramData: DiagramData): string {
  const n = diagramData.nodes.find((x) => x.id === id);
  if (n) return `n:${(n as DiagramNodeData).layer || DEFAULT_LAYER_ID}`;
  if (diagramData.zones?.some((z) => z.id === id)) return "z:zones";
  return `n:${DEFAULT_LAYER_ID}`;
}

export function runKeySequenceString(f2b: string[], diagramData: DiagramData): string {
  if (f2b.length === 0) return "";
  const parts: string[] = [];
  let prev: string | null = null;
  for (const id of f2b) {
    const k = stackKeyForZOrder(id, diagramData);
    if (k !== prev) {
      parts.push(k);
      prev = k;
    }
  }
  return parts.join("|");
}

/**
 * Move a contiguous set of items (in list order) to sit before `beforeIndex` in the front-to-back list.
 * Rejects if that would break layer / zone run boundaries.
 */
export function moveBlockToBeforeInFrontToBack(
  f2b: string[],
  selectedIds: string[],
  beforeIndex: number,
  diagramData: DiagramData
): string[] | null {
  if (selectedIds.length === 0) return null;
  const set = new Set(selectedIds);
  if (set.size !== selectedIds.length) return null;

  const block = f2b.filter((id) => set.has(id));
  if (block.length !== selectedIds.length) return null;
  if (block.length === 0) return null;

  const key0 = stackKeyForZOrder(block[0]!, diagramData);
  for (const id of block) {
    if (stackKeyForZOrder(id, diagramData) !== key0) return null;
  }

  const beforeIdx = Math.max(0, Math.min(beforeIndex, f2b.length));
  const without = f2b.filter((id) => !set.has(id));
  let dest = 0;
  for (let i = 0; i < beforeIdx; i++) {
    if (!set.has(f2b[i]!)) dest++;
  }
  const next = [...without.slice(0, dest), ...block, ...without.slice(dest)];
  if (runKeySequenceString(next, diagramData) !== runKeySequenceString(f2b, diagramData)) {
    return null;
  }
  return next;
}

export function applyBackToForwardOrderToDiagramData(
  b2f: string[],
  diagramData: DiagramData
): DiagramData {
  const byNode = new Map(diagramData.nodes.map((n) => [n.id, n as DiagramNodeData]));
  const zlist = diagramData.zones || [];
  const byZone = new Map(zlist.map((z) => [z.id, z as DiagramZoneData]));
  const nodeIds = new Set(diagramData.nodes.map((n) => n.id));
  const zoneIds = new Set(zlist.map((z) => z.id));
  const newNodes: DiagramNodeData[] = [];
  const newZones: DiagramZoneData[] = [];
  for (const id of b2f) {
    if (nodeIds.has(id)) {
      const n = byNode.get(id);
      if (n) newNodes.push(n);
    } else if (zoneIds.has(id)) {
      const z = byZone.get(id);
      if (z) newZones.push(z);
    }
  }
  for (const n of diagramData.nodes) {
    if (!newNodes.some((x) => x.id === n.id)) newNodes.push(n);
  }
  for (const z of zlist) {
    if (!newZones.some((x) => x.id === z.id)) newZones.push(z);
  }
  return {
    ...diagramData,
    nodes: newNodes,
    zones: newZones.length > 0 ? newZones : diagramData.zones,
  };
}

export function applyFrontToBackOrderToDiagramData(
  f2b: string[],
  diagramData: DiagramData
): DiagramData {
  const b2f = backToForwardFromFrontToBack(f2b);
  return applyBackToForwardOrderToDiagramData(b2f, diagramData);
}
