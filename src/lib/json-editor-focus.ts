import type { DiagramConnectionData } from '@/lib/types';

export type JsonFocusTarget =
  | { itemType: 'node'; id: string }
  | { itemType: 'edge'; id: string; from: string; to: string };

type TopLevelArrayKey = 'nodes' | 'connections' | 'groupings';

function skipWs(text: string, start: number): number {
  let p = start;
  while (p < text.length && /\s/.test(text[p])) p++;
  return p;
}

function skipString(text: string, start: number): number {
  let p = start + 1;
  while (p < text.length) {
    const c = text[p];
    if (c === '\\') {
      p++;
      if (p >= text.length) break;
      if (text[p] === 'u') {
        p += 5;
        continue;
      }
      p++;
      continue;
    }
    if (c === '"') return p + 1;
    p++;
  }
  return p;
}

function skipNumber(text: string, start: number): number {
  let p = start;
  if (text[p] === '-') p++;
  while (p < text.length && /\d/.test(text[p])) p++;
  if (text[p] === '.') {
    p++;
    while (p < text.length && /\d/.test(text[p])) p++;
  }
  if (text[p] === 'e' || text[p] === 'E') {
    p++;
    if (text[p] === '+' || text[p] === '-') p++;
    while (p < text.length && /\d/.test(text[p])) p++;
  }
  return p;
}

function skipObject(text: string, start: number): number {
  let p = start;
  if (text[p] !== '{') return start;
  p++;
  p = skipWs(text, p);
  if (text[p] === '}') return p + 1;
  while (true) {
    p = skipJsonValue(text, p);
    p = skipWs(text, p);
    if (text[p] !== ':') return p;
    p++;
    p = skipJsonValue(text, p);
    p = skipWs(text, p);
    if (text[p] === ',') {
      p++;
      continue;
    }
    if (text[p] === '}') return p + 1;
    return p;
  }
}

function skipArray(text: string, start: number): number {
  let p = start;
  if (text[p] !== '[') return start;
  p++;
  p = skipWs(text, p);
  if (text[p] === ']') return p + 1;
  while (true) {
    p = skipJsonValue(text, p);
    p = skipWs(text, p);
    if (text[p] === ',') {
      p++;
      continue;
    }
    if (text[p] === ']') return p + 1;
    return p;
  }
}

function skipJsonValue(text: string, start: number): number {
  let p = skipWs(text, start);
  if (p >= text.length) return p;
  const c = text[p];
  if (c === '{') return skipObject(text, p);
  if (c === '[') return skipArray(text, p);
  if (c === '"') return skipString(text, p);
  if (c === '-' || (c >= '0' && c <= '9')) return skipNumber(text, p);
  if (text.slice(p, p + 4) === 'null') return p + 4;
  if (text.slice(p, p + 4) === 'true') return p + 4;
  if (text.slice(p, p + 5) === 'false') return p + 5;
  return p;
}

function findJsonArrayBracketIndex(text: string, key: TopLevelArrayKey): number | null {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`"${escaped}"\\s*:\\s*\\[`);
  const m = re.exec(text);
  return m ? m.index + m[0].length - 1 : null;
}

function findNthArrayElementRange(text: string, arrayOpenBracketIdx: number, n: number): { from: number; to: number } | null {
  let p = arrayOpenBracketIdx + 1;
  let idx = 0;
  while (p < text.length && /\s/.test(text[p])) p++;
  if (text[p] === ']') return null;
  while (true) {
    const start = skipWs(text, p);
    if (start >= text.length) return null;
    if (text[start] === ']') return null;
    const end = skipJsonValue(text, start);
    if (idx === n) return { from: start, to: end };
    idx++;
    p = end;
    p = skipWs(text, p);
    if (text[p] === ',') {
      p++;
      continue;
    }
    if (text[p] === ']') return null;
    return null;
  }
}

function findTopLevelArrayElementRange(
  text: string,
  arrayKey: TopLevelArrayKey,
  elementIndex: number
): { from: number; to: number } | null {
  if (elementIndex < 0) return null;
  const bracket = findJsonArrayBracketIndex(text, arrayKey);
  if (bracket === null) return null;
  return findNthArrayElementRange(text, bracket, elementIndex);
}

function findConnectionIndex(
  connections: DiagramConnectionData[],
  target: { id: string; from: string; to: string }
): number {
  const byId = connections.findIndex((c) => c.id && c.id === target.id);
  if (byId >= 0) return byId;
  return connections.findIndex((c) => c.from === target.from && c.to === target.to);
}

/**
 * Locates the byte range in the JSON editor text for the selected diagram node or connection.
 * Uses JSON.parse to resolve index order, then scans the raw string to match array element boundaries.
 */
export function findJsonRangeForDiagramSelection(
  text: string,
  target: JsonFocusTarget
): { from: number; to: number } | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;

  if (target.itemType === 'node') {
    const nodes = (parsed as { nodes?: unknown }).nodes;
    if (!Array.isArray(nodes)) return null;
    const idx = nodes.findIndex((n: unknown) => {
      if (!n || typeof n !== 'object') return false;
      return (n as { id?: string }).id === target.id;
    });
    if (idx < 0) return null;
    return findTopLevelArrayElementRange(text, 'nodes', idx);
  }

  const connections = (parsed as { connections?: unknown }).connections;
  if (!Array.isArray(connections)) return null;
  const idx = findConnectionIndex(connections as DiagramConnectionData[], target);
  if (idx < 0) return null;
  return findTopLevelArrayElementRange(text, 'connections', idx);
}
