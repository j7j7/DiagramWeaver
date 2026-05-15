import type { DiagramConnectionData, DiagramNodeData } from './types';

function connectionKey(c: DiagramConnectionData): string {
  return c.id ?? `${c.from}-${c.to}`;
}

/** Match alignment heuristics in the editor for batch layout operations. */
function estimateNodeDimensions(node: DiagramNodeData): { width: number; height: number } {
  const type = node.type ?? '';
  const isShapeNode =
    type === 'generic.object.square' ||
    type === 'generic.object.circle' ||
    type === 'generic.object.point' ||
    type === 'generic.object.rectangle' ||
    type === 'generic.object.uml-class' ||
    type === 'generic.object.rounded-rectangle' ||
    type === 'generic.object.mind-map-node' ||
    type === 'generic.object.progress-bar' ||
    type === 'generic.object.timeline-bar' ||
    type === 'generic.object.segmented-rectangle' ||
    type === 'generic.object.pyramid' ||
    type.endsWith('.pyramid') ||
    type === 'generic.object.text-box-heading' ||
    type === 'generic.object.triangle' ||
    type === 'generic.object.star' ||
    type === 'generic.object.cloud';
  const isTextboxNode = type === 'generic.text.textbox';
  const isPlainTextNode = type === 'generic.text.text';

  if (
    (isTextboxNode || isPlainTextNode || isShapeNode) &&
    node.sizeMode === 'custom' &&
    node.width &&
    node.height
  ) {
    return { width: node.width, height: node.height };
  }
  if (isShapeNode && node.width && node.height) {
    return { width: node.width, height: node.height };
  }
  if (type === 'generic.object.text-box-heading' || type.endsWith('.text-box-heading')) {
    return { width: 180, height: 90 };
  }
  if (type.startsWith('generic.text')) {
    if (type === 'generic.text.textbox' || type === 'generic.text.text') {
      return { width: 120, height: 60 };
    }
    return { width: 100, height: 40 };
  }
  return { width: 80, height: 50 };
}

function nodeCenter(node: DiagramNodeData): { cx: number; cy: number } {
  const { width, height } = estimateNodeDimensions(node);
  const x = node.x ?? 0;
  const y = node.y ?? 0;
  return { cx: x + width / 2, cy: y + height / 2 };
}

function connectionSortPoint(
  conn: DiagramConnectionData,
  nodeById: Map<string, DiagramNodeData>
): { cx: number; cy: number } {
  const fromN = nodeById.get(conn.from);
  const toN = nodeById.get(conn.to);
  if (fromN && toN) {
    const a = nodeCenter(fromN);
    const b = nodeCenter(toN);
    return { cx: (a.cx + b.cx) / 2, cy: (a.cy + b.cy) / 2 };
  }
  if (fromN) return nodeCenter(fromN);
  if (toN) return nodeCenter(toN);
  return { cx: 0, cy: 0 };
}

/**
 * Order selected nodes and connections for per-item theme hue steps.
 * Uses top-to-bottom when vertical spread dominates, otherwise left-to-right.
 */
export function orderSelectedIdsForThemeHue(
  selectedIds: Set<string>,
  nodes: DiagramNodeData[],
  connections: DiagramConnectionData[]
): Map<string, number> {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const connByKey = new Map<string, DiagramConnectionData>();
  for (const c of connections) {
    connByKey.set(connectionKey(c), c);
  }

  type Entry = { id: string; cx: number; cy: number };
  const entries: Entry[] = [];

  for (const id of selectedIds) {
    const node = nodeById.get(id);
    if (node) {
      const { cx, cy } = nodeCenter(node);
      entries.push({ id, cx, cy });
      continue;
    }
    const conn = connByKey.get(id);
    if (conn) {
      entries.push({ id, ...connectionSortPoint(conn, nodeById) });
      continue;
    }
    entries.push({ id, cx: 0, cy: 0 });
  }

  if (entries.length <= 1) {
    return new Map(entries.map((e, i) => [e.id, i]));
  }

  const xs = entries.map((e) => e.cx);
  const ys = entries.map((e) => e.cy);
  const dx = Math.max(...xs) - Math.min(...xs);
  const dy = Math.max(...ys) - Math.min(...ys);
  const sortByVertical = dy >= dx;

  const sorted = [...entries].sort((a, b) => {
    if (sortByVertical) {
      if (a.cy !== b.cy) return a.cy - b.cy;
      if (a.cx !== b.cx) return a.cx - b.cx;
    } else {
      if (a.cx !== b.cx) return a.cx - b.cx;
      if (a.cy !== b.cy) return a.cy - b.cy;
    }
    return a.id.localeCompare(b.id);
  });

  return new Map(sorted.map((e, i) => [e.id, i]));
}
