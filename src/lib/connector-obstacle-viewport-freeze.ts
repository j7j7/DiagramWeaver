import type { MutableRefObject } from "react";
import { actsAsConnectorRoutingObstacle } from "@/lib/orthogonal-routing";
import type { PositionedNode, PositionedGroup } from "@/components/editor/canvas-constants";

/** Visible area of the diagram in diagram space; from host rect + pan/zoom. */
export type DiagramViewRect = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

/** Default padding (diagram units) so routing near the edge of the screen is stable. */
export const DEFAULT_VIEWPORT_OBSTACLE_PAD = 400;

const NODE_PREFIX = "n:" as const;
const ZONE_PREFIX = "z:" as const;

function getNodeObstacleRect(n: { x?: number; y?: number; width?: number; height?: number }): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  return {
    x: n.x ?? 0,
    y: n.y ?? 0,
    width: n.width ?? 80,
    height: n.height ?? 80,
  };
}

function getZoneObstacleRect(z: { x?: number; y?: number; width: number; height: number }): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  return {
    x: z.x ?? 0,
    y: z.y ?? 0,
    width: z.width,
    height: z.height,
  };
}

/**
 * AABB of `item` intersects the expanded view rect.
 */
function rectIntersectsExpandedView(
  x: number,
  y: number,
  w: number,
  h: number,
  view: DiagramViewRect,
  pad: number,
): boolean {
  const minX = view.minX - pad;
  const minY = view.minY - pad;
  const maxX = view.maxX + pad;
  const maxY = view.maxY + pad;
  return !(x + w < minX || x > maxX || y + h < minY || y > maxY);
}

type FrozenEntry = { x: number; y: number; width: number; height: number };

/**
 * For connector obstacles only: while an item is outside the (padded) visible diagram
 * area, keep its last on-screen (or first seen off-screen) bounds for routing so
 * panning / moving other items do not re-run avoidance for far-away objects.
 * When the item re-enters the view, the snapshot is dropped and live geometry is used.
 */
export function mergeObstaclesByViewport(
  nodesById: Record<string, PositionedNode>,
  zonesById: Record<string, PositionedGroup>,
  view: DiagramViewRect | null,
  hostWidth: number,
  hostHeight: number,
  padDiagramPx: number,
  stateRef: MutableRefObject<Map<string, FrozenEntry>>,
): { nodesForObstacles: Record<string, PositionedNode>; zonesForObstacles: Record<string, PositionedGroup> } {
  if (
    !view ||
    !Number.isFinite(view.minX) ||
    !Number.isFinite(view.maxX) ||
    !Number.isFinite(view.minY) ||
    !Number.isFinite(view.maxY) ||
    hostWidth <= 0 ||
    hostHeight <= 0
  ) {
    // Unknown viewport: keep using live positions; preserve frozen state for when
    // dimensions/transform become valid (do not clear ref — avoids spurious re-routing).
    return { nodesForObstacles: nodesById, zonesForObstacles: zonesById };
  }

  const nextFrozen: Map<string, FrozenEntry> = new Map();
  for (const [k, v] of stateRef.current) {
    nextFrozen.set(k, { ...v });
  }

  const nodeIdSet = new Set(Object.keys(nodesById));
  const zoneIdSet = new Set(Object.keys(zonesById));
  let outNodes: Record<string, PositionedNode> | null = null;
  let outZones: Record<string, PositionedGroup> | null = null;
  const getNodes = () => {
    if (!outNodes) outNodes = { ...nodesById };
    return outNodes;
  };
  const getZones = () => {
    if (!outZones) outZones = { ...zonesById };
    return outZones;
  };

  for (const [id, n] of Object.entries(nodesById)) {
    if (!actsAsConnectorRoutingObstacle(n)) continue;
    const r = getNodeObstacleRect(n);
    const key = `${NODE_PREFIX}${id}`;
    if (rectIntersectsExpandedView(r.x, r.y, r.width, r.height, view, padDiagramPx)) {
      nextFrozen.delete(key);
      continue;
    }
    const existing = stateRef.current.get(key);
    const stored = { x: r.x, y: r.y, width: r.width, height: r.height };
    if (existing) {
      getNodes()[id] = { ...n, x: existing.x, y: existing.y, width: existing.width, height: existing.height };
    } else {
      nextFrozen.set(key, stored);
    }
  }

  for (const [id, z] of Object.entries(zonesById)) {
    if (!actsAsConnectorRoutingObstacle(z)) continue;
    const r = getZoneObstacleRect(z);
    const key = `${ZONE_PREFIX}${id}`;
    if (rectIntersectsExpandedView(r.x, r.y, r.width, r.height, view, padDiagramPx)) {
      nextFrozen.delete(key);
      continue;
    }
    const existing = stateRef.current.get(key);
    const stored = { x: r.x, y: r.y, width: r.width, height: r.height };
    if (existing) {
      getZones()[id] = { ...z, x: existing.x, y: existing.y, width: existing.width, height: existing.height };
    } else {
      nextFrozen.set(key, stored);
    }
  }

  for (const key of [...nextFrozen.keys()]) {
    if (key.startsWith(NODE_PREFIX)) {
      if (!nodeIdSet.has(key.slice(NODE_PREFIX.length))) {
        nextFrozen.delete(key);
      }
    } else if (key.startsWith(ZONE_PREFIX)) {
      if (!zoneIdSet.has(key.slice(ZONE_PREFIX.length))) {
        nextFrozen.delete(key);
      }
    } else {
      nextFrozen.delete(key);
    }
  }

  stateRef.current = nextFrozen;
  return {
    nodesForObstacles: outNodes ?? nodesById,
    zonesForObstacles: outZones ?? zonesById,
  };
}

/**
 * Map host pixel rect + transform to the visible diagram AABB in diagram space.
 * Matches `px = x_diagram * k + tx` in the content layer.
 */
export function hostRectToDiagramViewRect(
  hostWidth: number,
  hostHeight: number,
  transform: { x: number; y: number; k: number },
): DiagramViewRect | null {
  if (hostWidth <= 0 || hostHeight <= 0) return null;
  const { x: tx, y: ty, k } = transform;
  if (!k || k === 0) return null;
  const minX = -tx / k;
  const minY = -ty / k;
  const maxX = minX + hostWidth / k;
  const maxY = minY + hostHeight / k;
  if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) {
    return null;
  }
  return { minX, minY, maxX, maxY };
}
