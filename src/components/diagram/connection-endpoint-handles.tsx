"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { DiagramConnectionData } from "@/lib/types";
import {
  determineConnectionEdges,
  computeAxisDeltasForConnectionNodes,
  clampEdgeAttachmentForConstraint,
  type Positionable,
} from "./bezier-connection";
import { CONNECTION_HELPER_Z_INDEX } from "@/components/editor/canvas-constants";

export type DiagramTransform = { x: number; y: number; k: number };

/** Diagram px: inside this distance from the node rect we apply edge picks; beyond on release we clear a forced end. */
const EDGE_INTERACTION_DISTANCE = 120;

function stripEdgeAttachmentPreferences(conn: DiagramConnectionData): DiagramConnectionData {
  return { ...conn, fromPreferredExit: undefined, toPreferredEntry: undefined };
}

type EdgeSide = "top" | "bottom" | "left" | "right";

function closestRectangleEdge(
  px: number,
  py: number,
  x: number,
  y: number,
  w: number,
  h: number
): EdgeSide {
  if (w <= 0 || h <= 0) return "top";
  if (px > x && px < x + w && py > y && py < y + h) {
    const dTop = py - y;
    const dBottom = y + h - py;
    const dLeft = px - x;
    const dRight = x + w - px;
    const m = Math.min(dTop, dBottom, dLeft, dRight);
    if (m === dTop) return "top";
    if (m === dBottom) return "bottom";
    if (m === dLeft) return "left";
    return "right";
  }
  const clampedX = Math.max(x, Math.min(px, x + w));
  const clampedY = Math.max(y, Math.min(py, y + h));
  if (clampedY === y) return "top";
  if (clampedY === y + h) return "bottom";
  if (clampedX === x) return "left";
  return "right";
}

/** Distance from point to axis-aligned rectangle (0 if inside). */
function distancePointToRect(px: number, py: number, x: number, y: number, w: number, h: number): number {
  if (px >= x && px <= x + w && py >= y && py <= y + h) return 0;
  const dx = px < x ? x - px : px > x + w ? px - (x + w) : 0;
  const dy = py < y ? y - py : py > y + h ? py - (y + h) : 0;
  return Math.hypot(dx, dy);
}

function clientToDiagram(
  clientX: number,
  clientY: number,
  canvasRef: React.RefObject<HTMLElement | null>,
  transform: DiagramTransform
): { x: number; y: number } | null {
  const el = canvasRef.current;
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  const canvasRelativeX = clientX - rect.left;
  const canvasRelativeY = clientY - rect.top;
  return {
    x: (canvasRelativeX - transform.x) / transform.k,
    y: (canvasRelativeY - transform.y) / transform.k,
  };
}

interface ConnectionEndpointHandlesProps {
  connection: DiagramConnectionData;
  connectionId: string;
  geomFrom: Positionable;
  geomTo: Positionable;
  fromWidth: number;
  fromHeight: number;
  toWidth: number;
  toHeight: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  transform: DiagramTransform;
  canvasRef: React.RefObject<HTMLElement | null>;
  onEdgeAttachmentChange: (
    from: string,
    to: string,
    updates: {
      fromPreferredExit?: DiagramConnectionData["fromPreferredExit"];
      toPreferredEntry?: DiagramConnectionData["toPreferredEntry"];
    },
    connectionId?: string
  ) => void;
  disabled?: boolean;
}

const HANDLE = 12;
const HALF = HANDLE / 2;
/** Above connection helper buttons (arrow / waypoint / delete) so start handle is not blocked by delete at ~10% along path */
const HANDLE_Z = CONNECTION_HELPER_Z_INDEX + 50;

const GREEN = "#22c55e";
const GREEN_ACTIVE = "#16a34a";
const YELLOW = "#eab308";
const YELLOW_ACTIVE = "#ca8a04";

export function ConnectionEndpointHandles({
  connection,
  connectionId,
  geomFrom,
  geomTo,
  fromWidth,
  fromHeight,
  toWidth,
  toHeight,
  fromX,
  fromY,
  toX,
  toY,
  transform,
  canvasRef,
  onEdgeAttachmentChange,
  disabled = false,
}: ConnectionEndpointHandlesProps) {
  const [dragging, setDragging] = useState<"from" | "to" | null>(null);
  const draggingRef = useRef<"from" | "to" | null>(null);
  const captureRef = useRef<{ el: HTMLElement; pointerId: number } | null>(null);

  const fromForced = connection.fromPreferredExit !== undefined;
  const toForced = connection.toPreferredEntry !== undefined;

  const applyDrag = useCallback(
    (role: "from" | "to", clientX: number, clientY: number) => {
      const pt = clientToDiagram(clientX, clientY, canvasRef, transform);
      if (!pt) return;

      const auto = determineConnectionEdges(
        geomFrom,
        geomTo,
        stripEdgeAttachmentPreferences(connection),
        fromWidth,
        fromHeight,
        toWidth,
        toHeight
      );
      const { dx, dy } = computeAxisDeltasForConnectionNodes(
        geomFrom,
        geomTo,
        fromWidth,
        fromHeight,
        toWidth,
        toHeight
      );
      const c = connection.edgeAttachmentConstraint;

      if (role === "from") {
        const picked = closestRectangleEdge(pt.x, pt.y, geomFrom.x, geomFrom.y, fromWidth, fromHeight);
        const newFrom = clampEdgeAttachmentForConstraint(picked, c, "from", dx, dy);
        const updates: {
          fromPreferredExit: NonNullable<DiagramConnectionData["fromPreferredExit"]>;
          toPreferredEntry?: DiagramConnectionData["toPreferredEntry"];
        } = { fromPreferredExit: newFrom };
        if (connection.toPreferredEntry !== undefined) {
          updates.toPreferredEntry = connection.toPreferredEntry;
        }
        onEdgeAttachmentChange(connection.from, connection.to, updates, connectionId);
      } else {
        const picked = closestRectangleEdge(pt.x, pt.y, geomTo.x, geomTo.y, toWidth, toHeight);
        const newTo = clampEdgeAttachmentForConstraint(picked, c, "to", dx, dy);
        const updates: {
          toPreferredEntry: NonNullable<DiagramConnectionData["toPreferredEntry"]>;
          fromPreferredExit?: DiagramConnectionData["fromPreferredExit"];
        } = { toPreferredEntry: newTo };
        if (connection.fromPreferredExit !== undefined) {
          updates.fromPreferredExit = connection.fromPreferredExit;
        }
        onEdgeAttachmentChange(connection.from, connection.to, updates, connectionId);
      }
    },
    [
      canvasRef,
      transform,
      connection,
      connectionId,
      geomFrom,
      geomTo,
      fromWidth,
      fromHeight,
      toWidth,
      toHeight,
      onEdgeAttachmentChange,
    ]
  );

  const maybeApplyDragNearNode = useCallback(
    (role: "from" | "to", clientX: number, clientY: number) => {
      const pt = clientToDiagram(clientX, clientY, canvasRef, transform);
      if (!pt) return;
      const x = role === "from" ? geomFrom.x : geomTo.x;
      const y = role === "from" ? geomFrom.y : geomTo.y;
      const w = role === "from" ? fromWidth : toWidth;
      const h = role === "from" ? fromHeight : toHeight;
      const d = distancePointToRect(pt.x, pt.y, x, y, w, h);
      if (d <= EDGE_INTERACTION_DISTANCE) {
        applyDrag(role, clientX, clientY);
      }
    },
    [applyDrag, canvasRef, transform, geomFrom, geomTo, fromWidth, fromHeight, toWidth, toHeight]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent, role: "from" | "to") => {
      if (disabled) return;
      e.stopPropagation();
      e.preventDefault();
      const el = e.target as HTMLElement;
      el.setPointerCapture(e.pointerId);
      captureRef.current = { el, pointerId: e.pointerId };
      draggingRef.current = role;
      setDragging(role);
      maybeApplyDragNearNode(role, e.clientX, e.clientY);
    },
    [disabled, maybeApplyDragNearNode]
  );

  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => {
      const role = draggingRef.current;
      if (!role) return;
      maybeApplyDragNearNode(role, e.clientX, e.clientY);
    };
    const up = (e: PointerEvent) => {
      const role = draggingRef.current;
      if (role) {
        const pt = clientToDiagram(e.clientX, e.clientY, canvasRef, transform);
        if (pt) {
          const x = role === "from" ? geomFrom.x : geomTo.x;
          const y = role === "from" ? geomFrom.y : geomTo.y;
          const w = role === "from" ? fromWidth : toWidth;
          const h = role === "from" ? fromHeight : toHeight;
          const d = distancePointToRect(pt.x, pt.y, x, y, w, h);
          if (d > EDGE_INTERACTION_DISTANCE) {
            // Always emit clear for this end (applyConnectionUpdates deletes key). Avoids stale closure
            // missing a clear on the start handle when prefs changed during the same drag.
            if (role === "from") {
              onEdgeAttachmentChange(connection.from, connection.to, { fromPreferredExit: undefined }, connectionId);
            } else {
              onEdgeAttachmentChange(connection.from, connection.to, { toPreferredEntry: undefined }, connectionId);
            }
          }
        }
      }
      const cap = captureRef.current;
      if (cap) {
        try {
          cap.el.releasePointerCapture(cap.pointerId);
        } catch {
          /* capture may already be released */
        }
        captureRef.current = null;
      }
      draggingRef.current = null;
      setDragging(null);
    };
    document.addEventListener("pointermove", move, true);
    document.addEventListener("pointerup", up, true);
    document.addEventListener("pointercancel", up, true);
    return () => {
      document.removeEventListener("pointermove", move, true);
      document.removeEventListener("pointerup", up, true);
      document.removeEventListener("pointercancel", up, true);
    };
  }, [
    dragging,
    maybeApplyDragNearNode,
    canvasRef,
    transform,
    geomFrom,
    geomTo,
    fromWidth,
    fromHeight,
    toWidth,
    toHeight,
    connection.from,
    connection.to,
    connection.fromPreferredExit,
    connection.toPreferredEntry,
    connectionId,
    onEdgeAttachmentChange,
  ]);

  if (disabled) return null;

  const fromColor =
    dragging === "from" ? (fromForced ? YELLOW_ACTIVE : GREEN_ACTIVE) : fromForced ? YELLOW : GREEN;
  const toColor =
    dragging === "to" ? (toForced ? YELLOW_ACTIVE : GREEN_ACTIVE) : toForced ? YELLOW : GREEN;

  return (
    <>
      <div
        className="absolute cursor-grab active:cursor-grabbing rounded-sm border-2 border-white shadow-sm"
        style={{
          left: `${fromX - HALF}px`,
          top: `${fromY - HALF}px`,
          width: `${HANDLE}px`,
          height: `${HANDLE}px`,
          backgroundColor: fromColor,
          zIndex: HANDLE_Z,
          pointerEvents: "auto",
        }}
        title={fromForced ? "Drag on the shape to adjust edge, or drag away to clear" : "Drag on the shape to pin exit edge (yellow = pinned)"}
        onPointerDown={(e) => onPointerDown(e, "from")}
      />
      <div
        className="absolute cursor-grab active:cursor-grabbing rounded-sm border-2 border-white shadow-sm"
        style={{
          left: `${toX - HALF}px`,
          top: `${toY - HALF}px`,
          width: `${HANDLE}px`,
          height: `${HANDLE}px`,
          backgroundColor: toColor,
          zIndex: HANDLE_Z,
          pointerEvents: "auto",
        }}
        title={toForced ? "Drag on the shape to adjust edge, or drag away to clear" : "Drag on the shape to pin entry edge (yellow = pinned)"}
        onPointerDown={(e) => onPointerDown(e, "to")}
      />
    </>
  );
}
