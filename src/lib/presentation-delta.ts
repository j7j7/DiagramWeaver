import type { DiagramData, DiagramDelta, DiagramDeltaOperation } from '@/lib/types';
import { filterByVisibleLayers, validateLayersConfig } from '@/lib/layers-utils';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function escapePathSegment(segment: string): string {
  return segment.replace(/~/g, '~0').replace(/\//g, '~1');
}

function unescapePathSegment(segment: string): string {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}

function deepClone<T>(value: T): T {
  if (value === undefined) return value;

  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch {
      // Fall back to JSON clone for plain data when structuredClone cannot clone.
    }
  }

  const serialized = JSON.stringify(value);
  if (serialized === undefined) return value;
  return JSON.parse(serialized) as T;
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function buildDeltaRecursive(
  base: unknown,
  current: unknown,
  path: string,
  operations: DiagramDeltaOperation[]
): void {
  if (deepEqual(base, current)) return;

  // Replace entire branch when type changes or arrays differ.
  if (
    Array.isArray(base) ||
    Array.isArray(current) ||
    typeof base !== typeof current ||
    base === null ||
    current === null
  ) {
    operations.push({ op: 'replace', path, value: deepClone(current) });
    return;
  }

  if (!isObject(base) || !isObject(current)) {
    operations.push({ op: 'replace', path, value: deepClone(current) });
    return;
  }

  const baseKeys = new Set(Object.keys(base));
  const currentKeys = new Set(Object.keys(current));

  for (const key of baseKeys) {
    if (!currentKeys.has(key)) {
      const nextPath = `${path}/${escapePathSegment(key)}`;
      operations.push({ op: 'remove', path: nextPath });
    }
  }

  for (const key of currentKeys) {
    const nextPath = `${path}/${escapePathSegment(key)}`;
    if (!baseKeys.has(key)) {
      operations.push({ op: 'add', path: nextPath, value: deepClone(current[key]) });
      continue;
    }
    buildDeltaRecursive(base[key], current[key], nextPath, operations);
  }
}

function normalizePath(path: string): string[] {
  if (!path || path === '/') return [];
  return path
    .split('/')
    .filter(Boolean)
    .map((segment) => unescapePathSegment(segment));
}

function setByPath(target: unknown, path: string[], value: unknown): void {
  if (path.length === 0) return;
  let cursor: any = target;
  for (let i = 0; i < path.length - 1; i += 1) {
    const segment = path[i];
    const nextSegment = path[i + 1];
    if (!(segment in cursor) || cursor[segment] === undefined || cursor[segment] === null) {
      cursor[segment] = /^\d+$/.test(nextSegment) ? [] : {};
    }
    cursor = cursor[segment];
  }
  const last = path[path.length - 1];
  if (Array.isArray(cursor) && /^\d+$/.test(last)) {
    cursor[Number(last)] = value;
  } else {
    cursor[last] = value;
  }
}

function removeByPath(target: unknown, path: string[]): void {
  if (path.length === 0) return;
  let cursor: any = target;
  for (let i = 0; i < path.length - 1; i += 1) {
    const segment = path[i];
    if (!(segment in cursor)) return;
    cursor = cursor[segment];
    if (cursor === undefined || cursor === null) return;
  }
  const last = path[path.length - 1];
  if (Array.isArray(cursor) && /^\d+$/.test(last)) {
    const index = Number(last);
    if (index >= 0 && index < cursor.length) cursor.splice(index, 1);
    return;
  }
  delete cursor[last];
}

export function projectVisibleDiagram(diagramData: DiagramData): DiagramData {
  if (diagramData.layers && validateLayersConfig(diagramData.layers)) {
    return filterByVisibleLayers(diagramData);
  }
  return diagramData;
}

export function computeDiagramDelta(baseDiagram: DiagramData, currentDiagram: DiagramData): DiagramDelta {
  const operations: DiagramDeltaOperation[] = [];
  buildDeltaRecursive(baseDiagram, currentDiagram, '', operations);
  return {
    version: '1.0',
    operations,
    compressed: true,
  };
}

export function applyDiagramDelta(baseDiagram: DiagramData, delta: DiagramDelta): DiagramData {
  let next = deepClone(baseDiagram);

  for (const operation of delta.operations) {
    const path = normalizePath(operation.path);

    if (path.length === 0 && operation.op === 'replace') {
      next = deepClone(operation.value as DiagramData);
      continue;
    }

    if (operation.op === 'remove') {
      removeByPath(next, path);
      continue;
    }

    setByPath(next, path, deepClone(operation.value));
  }

  return next;
}

export function listVisibleLayerIds(diagramData: DiagramData): string[] {
  const layers = diagramData.layers?.layers ?? [];
  return layers.filter((layer) => layer.visible).map((layer) => layer.id);
}
