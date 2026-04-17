import type { DiagramData, DiagramNodeData } from '@/lib/types';

/** Node and zone ids from the selection set, in insertion order (first selected first). */
export function collectObjectIdsInSelectionOrder(selectedItemIds: Set<string>, diagram: DiagramData): string[] {
  const nodeIds = new Set(diagram.nodes.map((n) => n.id));
  const zoneIds = new Set((diagram.zones ?? []).map((z) => z.id));
  const result: string[] = [];
  const seen = new Set<string>();
  for (const id of selectedItemIds) {
    if (seen.has(id)) continue;
    if (nodeIds.has(id) || zoneIds.has(id)) {
      result.push(id);
      seen.add(id);
    }
  }
  return result;
}

/**
 * Strip a leading numeric token (one or more digits) and following whitespace from the start of the string.
 * Used so re-running Auto-number replaces `3 Foo` → assigned index with `1 Foo`, etc.
 */
function bodyAfterLeadingNumericToken(trimmed: string): string {
  const m = trimmed.match(/^(\d+)(\s*)([\s\S]*)$/);
  if (!m) return trimmed;
  return (m[3] ?? '').trim();
}

/**
 * Leading auto-number: `n` alone, or `n` + space + text. If the text started with digits, those are replaced by `n`.
 */
export function formatLabelWithLeadingAutoNumber(existing: string, n: number): string {
  const trimmed = existing.replace(/^\s+/, '').replace(/\s+$/, '');
  if (trimmed.length === 0) return String(n);
  const body = bodyAfterLeadingNumericToken(trimmed);
  if (body.length === 0) return String(n);
  return `${n} ${body}`;
}

/**
 * `anchorId` is numbered 1; remaining ids follow by ascending Euclidean distance from the anchor center.
 * Tie-break: stable lexical id sort.
 */
export function sortObjectIdsByDistanceFromAnchor(
  anchorId: string,
  objectIds: string[],
  centerById: Map<string, { x: number; y: number }>
): string[] {
  if (objectIds.length === 0) return [];
  const anchor = centerById.get(anchorId);
  const rest = objectIds.filter((id) => id !== anchorId);
  if (!anchor) {
    return [anchorId, ...rest];
  }
  const dist2 = (id: string) => {
    const p = centerById.get(id);
    if (!p) return Number.POSITIVE_INFINITY;
    const dx = p.x - anchor.x;
    const dy = p.y - anchor.y;
    return dx * dx + dy * dy;
  };
  rest.sort((a, b) => {
    const da = dist2(a);
    const db = dist2(b);
    if (da !== db) return da - db;
    return a.localeCompare(b);
  });
  return [anchorId, ...rest];
}

/** Plain display text for auto-number (rich runs flattened). */
function plainLabelFromNode(node: DiagramNodeData): string {
  if (node.richLabel?.length) return node.richLabel.map((r) => r.text).join('');
  return node.label ?? '';
}

export function nextNodeLabelForAutoNumber(node: DiagramNodeData, n: number): { label: string } {
  return { label: formatLabelWithLeadingAutoNumber(plainLabelFromNode(node), n) };
}

export function nextZoneLabelForAutoNumber(zoneLabel: string | undefined, n: number): string {
  return formatLabelWithLeadingAutoNumber(zoneLabel ?? '', n);
}
