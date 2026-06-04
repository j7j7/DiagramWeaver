/** Pixel tolerance for treating consecutive clicks as the same overlap stack location. */
export const CLICK_THROUGH_POINT_TOLERANCE_PX = 4;

export type ClickThroughPoint = { x: number; y: number };

export function isNearClickThroughPoint(
  previous: ClickThroughPoint | null,
  current: ClickThroughPoint,
  tolerance = CLICK_THROUGH_POINT_TOLERANCE_PX,
): boolean {
  if (!previous) return false;
  return (
    Math.abs(previous.x - current.x) <= tolerance &&
    Math.abs(previous.y - current.y) <= tolerance
  );
}

export type CanvasObjectBounds = { x: number; y: number; w: number; h: number };

export function clientPointToDiagram(
  clientX: number,
  clientY: number,
  canvasRect: { left: number; top: number },
  transform: { x: number; y: number; k: number },
): { x: number; y: number } {
  return {
    x: (clientX - canvasRect.left - transform.x) / transform.k,
    y: (clientY - canvasRect.top - transform.y) / transform.k,
  };
}

function pointInBounds(diagramX: number, diagramY: number, b: CanvasObjectBounds): boolean {
  return (
    diagramX >= b.x &&
    diagramX < b.x + b.w &&
    diagramY >= b.y &&
    diagramY < b.y + b.h
  );
}

/**
 * All node/zone ids under the diagram point, topmost first
 * (uses render sort, not DOM — stable when upper layers use pointer-events: none).
 */
export function getCanvasOverlapStackAtDiagramPoint(
  diagramX: number,
  diagramY: number,
  sortedItemIds: readonly string[],
  isPointOnItem: (id: string, diagramX: number, diagramY: number) => boolean,
): string[] {
  const stack: string[] = [];
  for (let i = sortedItemIds.length - 1; i >= 0; i--) {
    const id = sortedItemIds[i];
    if (isPointOnItem(id, diagramX, diagramY)) {
      stack.push(id);
    }
  }
  return stack;
}

/** Merge geometry + DOM stacks, then order by render sort (top first). */
export function mergeOverlapStacks(
  geometryStack: readonly string[],
  domStack: readonly string[],
  sortedItemIds: readonly string[],
): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const id of [...geometryStack, ...domStack]) {
    if (!seen.has(id)) {
      seen.add(id);
      merged.push(id);
    }
  }
  return orderIdsByCanvasRenderStack(merged, sortedItemIds);
}

/** Node/zone ids under the cursor, topmost first (DOM hit order). */
export function getCanvasObjectIdsAtPoint(clientX: number, clientY: number): string[] {
  if (typeof document === "undefined" || typeof document.elementsFromPoint !== "function") {
    return [];
  }
  const seen = new Set<string>();
  const stack: string[] = [];
  for (const el of document.elementsFromPoint(clientX, clientY)) {
    if (!(el instanceof Element)) continue;
    const nodeId = el.closest("[data-node-id]")?.getAttribute("data-node-id");
    if (nodeId && !seen.has(nodeId)) {
      seen.add(nodeId);
      stack.push(nodeId);
      continue;
    }
    const zoneId = el.closest("[data-zone-id]")?.getAttribute("data-zone-id");
    if (zoneId && !seen.has(zoneId)) {
      seen.add(zoneId);
      stack.push(zoneId);
    }
  }
  return stack;
}

/** Order overlap stack by editor render sort (higher index = drawn on top). */
export function orderIdsByCanvasRenderStack(
  ids: readonly string[],
  sortedItemIds: readonly string[],
): string[] {
  const indexById = new Map(sortedItemIds.map((id, i) => [id, i]));
  return [...ids].sort((a, b) => (indexById.get(b) ?? -1) - (indexById.get(a) ?? -1));
}

export function isCanvasObjectLocked(
  id: string,
  nodesById: Readonly<Record<string, { locked?: boolean } | undefined>>,
): boolean {
  return Boolean(nodesById[id]?.locked);
}

/**
 * Resolves which canvas object to select on left-click in an overlap stack.
 * Cycles top → bottom on repeated clicks at the same screen point; locked items are skipped when `skipLocked`.
 */
export function resolveClickThroughSelectId(args: {
  clientX: number;
  clientY: number;
  domHitId: string;
  selectedItemId: string | null | undefined;
  lastClickPoint: ClickThroughPoint | null;
  sortedItemIds: readonly string[];
  nodesById: Readonly<Record<string, { locked?: boolean } | undefined>>;
  skipLocked: boolean;
  /** Top-first overlap stack at the click (prefer geometry so cycling works when lower items are selected). */
  overlapStackTopFirst: readonly string[];
}): { targetId: string; nextLastClickPoint: ClickThroughPoint } {
  const {
    clientX,
    clientY,
    domHitId,
    selectedItemId,
    lastClickPoint,
    sortedItemIds,
    nodesById,
    skipLocked,
    overlapStackTopFirst,
  } = args;
  const point: ClickThroughPoint = { x: clientX, y: clientY };
  const orderedStack =
    overlapStackTopFirst.length > 0
      ? [...overlapStackTopFirst]
      : orderIdsByCanvasRenderStack(
          getCanvasObjectIdsAtPoint(clientX, clientY),
          sortedItemIds,
        );
  const selectableStack = skipLocked
    ? orderedStack.filter((id) => !isCanvasObjectLocked(id, nodesById))
    : orderedStack;

  if (selectableStack.length <= 1) {
    return {
      targetId: selectableStack[0] ?? domHitId,
      nextLastClickPoint: point,
    };
  }

  const topId = selectableStack[0];
  // Selected card (or any top item) clicked again — cycle even if the pointer moved slightly
  // (card inner elements stop propagation, so position-based repeat alone is unreliable).
  if (
    selectedItemId != null &&
    selectedItemId === domHitId &&
    selectedItemId === topId
  ) {
    const idx = selectableStack.indexOf(selectedItemId);
    const nextId = selectableStack[(idx + 1) % selectableStack.length];
    return { targetId: nextId, nextLastClickPoint: point };
  }

  if (!isNearClickThroughPoint(lastClickPoint, point)) {
    return { targetId: topId, nextLastClickPoint: point };
  }

  const currentId =
    selectedItemId && selectableStack.includes(selectedItemId) ? selectedItemId : null;
  if (!currentId) {
    return { targetId: topId, nextLastClickPoint: point };
  }

  const idx = selectableStack.indexOf(currentId);
  const nextId = selectableStack[(idx + 1) % selectableStack.length];
  return { targetId: nextId, nextLastClickPoint: point };
}

/** Right-click anchor: keep the current selection when it lies under the cursor in the overlap stack. */
export function resolveContextMenuAnchorId(args: {
  clientX: number;
  clientY: number;
  domHitId: string;
  primaryItemId: string | null | undefined;
  sortedItemIds: readonly string[];
  overlapStackTopFirst: readonly string[];
}): string {
  const { clientX, clientY, domHitId, primaryItemId, sortedItemIds, overlapStackTopFirst } = args;
  if (!primaryItemId) return domHitId;
  const stack =
    overlapStackTopFirst.length > 0
      ? [...overlapStackTopFirst]
      : orderIdsByCanvasRenderStack(
          getCanvasObjectIdsAtPoint(clientX, clientY),
          sortedItemIds,
        );
  if (stack.includes(primaryItemId)) return primaryItemId;
  return domHitId;
}

/** Topmost selected node/zone under the cursor (includes pointer-events:none pass-through layers). */
export function findTopSelectedCanvasObjectIdAtPoint(
  clientX: number,
  clientY: number,
  selectedItemIds: ReadonlySet<string>,
  overlapStackTopFirst?: readonly string[],
): string | null {
  if (selectedItemIds.size === 0) return null;
  const stack =
    overlapStackTopFirst && overlapStackTopFirst.length > 0
      ? overlapStackTopFirst
      : getCanvasObjectIdsAtPoint(clientX, clientY);
  for (const id of stack) {
    if (selectedItemIds.has(id)) return id;
  }
  return null;
}
