/**
 * Diagram-level recording: capture JSON mutations directly instead of replaying every UI click.
 * Hybrid playback still shows context menus / cursor UX, then applies these changes and closes overlays.
 */

import type { InteractionRecording } from "@/lib/interaction-recording-types";
import type { DiagramConnectionData, DiagramData, DiagramNodeData, DiagramZoneData } from "@/lib/types";
import {
  DW_CONTEXT_MENU_ACTION,
  DW_DIAGRAM_CHANGE,
  emitDwDiagramChange,
  type DwDiagramChangeDetail,
} from "@/lib/interaction-recording-bridge";
import { stableDiagramConnectionId } from "@/lib/connection-order-utils";
import { deleteDiagramItemsByIds } from "@/lib/grouping-utils";
import { isInteractionRecordingCaptureActive } from "@/lib/interaction-recording-panel-value";

export type { DwDiagramChangeDetail };

function cloneForRecording<T>(value: T): T {
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return value;
  }
}

/** Record a diagram mutation while capture is active (no-op during playback). */
export function recordDiagramChange(detail: DwDiagramChangeDetail): void {
  if (!isInteractionRecordingCaptureActive()) return;
  emitDwDiagramChange(cloneForRecording(detail));
}

export function recordDiagramReplace(diagram: DiagramData): void {
  recordDiagramChange({ op: "set-diagram", diagram });
}

export function recordGeometryNodeChange(
  nodeId: string,
  dims: { width: number; height: number; x?: number; y?: number },
): void {
  const patch: Record<string, unknown> = { width: dims.width, height: dims.height };
  if (dims.x !== undefined) patch.x = dims.x;
  if (dims.y !== undefined) patch.y = dims.y;
  recordDiagramChange({ op: "update-node", nodeId, patch });
}

export function recordGeometryZoneChange(
  zoneId: string,
  dims: { width: number; height: number; x?: number; y?: number },
): void {
  const patch: Record<string, unknown> = { width: dims.width, height: dims.height };
  if (dims.x !== undefined) patch.x = dims.x;
  if (dims.y !== undefined) patch.y = dims.y;
  recordDiagramChange({ op: "update-zone", zoneId, patch });
}

export function recordPositionNodeChange(nodeId: string, x: number, y: number): void {
  recordDiagramChange({ op: "update-node", nodeId, patch: { x, y } });
}

export function recordPositionZoneChange(zoneId: string, x: number, y: number): void {
  recordDiagramChange({ op: "update-zone", zoneId, patch: { x, y } });
}

const GEOMETRY_KEYS = new Set(["x", "y", "startPos", "endPos", "lineControlPoints", "width", "height"]);

/** Build a patch from a toolbar/item merge (excludes geometry owned by canvas drag). */
export function extractDiagramItemPatch(
  updatedItem: Record<string, unknown>,
  options?: { excludeGeometry?: boolean },
): { patch: Record<string, unknown>; removeKeys: string[] } {
  const patch: Record<string, unknown> = {};
  const removeKeys: string[] = [];
  for (const key of Object.keys(updatedItem)) {
    if (key === "itemType" || key === "id") continue;
    if (options?.excludeGeometry !== false && GEOMETRY_KEYS.has(key)) continue;
    const value = updatedItem[key];
    if (value === null) removeKeys.push(key);
    else if (value !== undefined) patch[key] = value;
  }
  return { patch, removeKeys };
}

function applyPatchToRecord(
  target: Record<string, unknown>,
  patch: Record<string, unknown>,
  removeKeys?: string[],
): Record<string, unknown> {
  const next = { ...target };
  for (const key of removeKeys ?? []) {
    delete next[key];
  }
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete next[key];
    else next[key] = value;
  }
  return next;
}

function matchConnection(
  conn: DiagramConnectionData,
  idx: number,
  detail: Extract<DwDiagramChangeDetail, { op: "update-connection" }>,
): boolean {
  if (detail.applyToConnectionIds?.length) {
    const stableId = stableDiagramConnectionId(conn, idx);
    return detail.applyToConnectionIds.includes(stableId);
  }
  if (detail.connectionId) {
    return conn.id === detail.connectionId || stableDiagramConnectionId(conn, idx) === detail.connectionId;
  }
  if (detail.from && detail.to) {
    return conn.from === detail.from && conn.to === detail.to;
  }
  return false;
}

/** Apply a recorded diagram change to diagram state (pure — no React). */
export function applyDiagramChange(detail: DwDiagramChangeDetail, prev: DiagramData): DiagramData {
  switch (detail.op) {
    case "set-diagram":
      return cloneForRecording(detail.diagram);

    case "update-node": {
      const nodes = prev.nodes.map((n) =>
        n.id === detail.nodeId
          ? (applyPatchToRecord(
              n as unknown as Record<string, unknown>,
              detail.patch,
              detail.removeKeys,
            ) as unknown as DiagramNodeData)
          : n,
      );
      return { ...prev, nodes };
    }

    case "update-zone": {
      const zones = (prev.zones ?? []).map((z) =>
        z.id === detail.zoneId
          ? (applyPatchToRecord(
              z as unknown as Record<string, unknown>,
              detail.patch,
              detail.removeKeys,
            ) as unknown as DiagramZoneData)
          : z,
      );
      return { ...prev, zones };
    }

    case "update-connection": {
      const connections = (prev.connections ?? []).map((conn, idx) => {
        if (!matchConnection(conn as DiagramConnectionData, idx, detail)) return conn;
        return applyPatchToRecord(
          conn as unknown as Record<string, unknown>,
          detail.patch,
          detail.removeKeys,
        ) as unknown as DiagramConnectionData;
      });
      return { ...prev, connections };
    }

    case "delete-items": {
      const next = deleteDiagramItemsByIds(prev, detail.ids);
      return next ?? prev;
    }

    case "disconnect-node":
      return {
        ...prev,
        connections: (prev.connections ?? []).filter(
          (c) => c.from !== detail.nodeId && c.to !== detail.nodeId,
        ),
      };

    case "add-connections":
      return {
        ...prev,
        connections: [...(prev.connections ?? []), ...cloneForRecording(detail.connections)],
      };

    default:
      return prev;
  }
}

/** Normalize context-menu action slugs for replay handlers. */
export function normalizeContextMenuReplayAction(action: string): string {
  if (action === "delete-node" || action === "delete-zone" || action === "delete-card") return "delete";
  if (action.startsWith("connections")) return "connection-settings";
  return action;
}

export { DW_DIAGRAM_CHANGE };

const COSMETIC_MENU_ACTION_WINDOW_MS = 900;

/**
 * When a context-menu click is followed by a diagram change, replay should flash the menu only.
 */
export function annotateCosmeticMenuActions(recording: InteractionRecording): InteractionRecording {
  const events = recording.events.map((event) => {
    if (event.kind !== "custom" || event.name !== DW_CONTEXT_MENU_ACTION) return event;
    const actionT = event.t;
    for (const next of recording.events) {
      if (next.t < actionT) continue;
      if (next.t - actionT > COSMETIC_MENU_ACTION_WINDOW_MS) break;
      if (next.kind === "custom" && next.name === DW_DIAGRAM_CHANGE) {
        const detail = { ...(event.detail as Record<string, unknown>), cosmeticOnly: true };
        return { ...event, detail };
      }
    }
    return event;
  });
  return { ...recording, events };
}
