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
    updates: { fromPreferredExit: DiagramConnectionData["fromPreferredExit"]; toPreferredEntry: DiagramConnectionData["toPreferredEntry"] },
    connectionId?: string
  ) => void;
  disabled?: boolean;
}

const HANDLE = 12;
const HALF = HANDLE / 2;
const HANDLE_Z = CONNECTION_HELPER_Z_INDEX + 2;

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
        let newFrom = clampEdgeAttachmentForConstraint(picked, c, "from", dx, dy);
        let newTo = (connection.toPreferredEntry ?? auto.toEdge) as NonNullable<DiagramConnectionData["toPreferredEntry"]>;
        newTo = clampEdgeAttachmentForConstraint(newTo, c, "to", dx, dy);
        onEdgeAttachmentChange(
          connection.from,
          connection.to,
          { fromPreferredExit: newFrom, toPreferredEntry: newTo },
          connectionId
        );
      } else {
        const picked = closestRectangleEdge(pt.x, pt.y, geomTo.x, geomTo.y, toWidth, toHeight);
        let newTo = clampEdgeAttachmentForConstraint(picked, c, "to", dx, dy);
        let newFrom = (connection.fromPreferredExit ?? auto.fromEdge) as NonNullable<DiagramConnectionData["fromPreferredExit"]>;
        newFrom = clampEdgeAttachmentForConstraint(newFrom, c, "from", dx, dy);
        onEdgeAttachmentChange(
          connection.from,
          connection.to,
          { fromPreferredExit: newFrom, toPreferredEntry: newTo },
          connectionId
        );
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
      applyDrag(role, e.clientX, e.clientY);
    },
    [disabled, applyDrag]
  );

  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => {
      const role = draggingRef.current;
      if (!role) return;
      applyDrag(role, e.clientX, e.clientY);
    };
    const up = () => {
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
  }, [dragging, applyDrag]);

  if (disabled) return null;

  return (
    <>
      <div
        className="absolute cursor-grab active:cursor-grabbing rounded-sm border-2 border-white shadow-sm"
        style={{
          left: `${fromX - HALF}px`,
          top: `${fromY - HALF}px`,
          width: `${HANDLE}px`,
          height: `${HANDLE}px`,
          backgroundColor: dragging === "from" ? "#16a34a" : "#22c55e",
          zIndex: HANDLE_Z,
          pointerEvents: "auto",
        }}
        title="Drag to choose source edge"
        onPointerDown={(e) => onPointerDown(e, "from")}
      />
      <div
        className="absolute cursor-grab active:cursor-grabbing rounded-sm border-2 border-white shadow-sm"
        style={{
          left: `${toX - HALF}px`,
          top: `${toY - HALF}px`,
          width: `${HANDLE}px`,
          height: `${HANDLE}px`,
          backgroundColor: dragging === "to" ? "#16a34a" : "#22c55e",
          zIndex: HANDLE_Z,
          pointerEvents: "auto",
        }}
        title="Drag to choose target edge"
        onPointerDown={(e) => onPointerDown(e, "to")}
      />
    </>
  );
}
