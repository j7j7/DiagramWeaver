"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { DiagramConnectionData } from "@/lib/types";
import { snapToGrid } from "@/components/editor/canvas-constants";

export type Transform = { x: number; y: number; k: number };

interface ConnectionWaypointHandlesProps {
  connection: DiagramConnectionData;
  waypoints: Array<{ x: number; y: number; id?: string }>;
  connectionColor: string;
  transform: Transform;
  onWaypointMove: (from: string, to: string, index: number, newPos: { x: number; y: number }) => void;
  disabled?: boolean;
}

export function ConnectionWaypointHandles({
  connection,
  waypoints,
  connectionColor,
  transform,
  onWaypointMove,
  disabled = false,
}: ConnectionWaypointHandlesProps) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const dragStartRef = useRef<{ clientX: number; clientY: number; waypointX: number; waypointY: number } | null>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, index: number) => {
      if (disabled) return;
      e.stopPropagation();
      e.preventDefault();
      const wp = waypoints[index];
      if (!wp) return;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setDraggingIndex(index);
      dragStartRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        waypointX: wp.x,
        waypointY: wp.y,
      };
    },
    [disabled, waypoints]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (draggingIndex === null || !dragStartRef.current) return;
      const deltaX = (e.clientX - dragStartRef.current.clientX) / transform.k;
      const deltaY = (e.clientY - dragStartRef.current.clientY) / transform.k;
      const newX = snapToGrid(dragStartRef.current.waypointX + deltaX);
      const newY = snapToGrid(dragStartRef.current.waypointY + deltaY);
      onWaypointMove(connection.from, connection.to, draggingIndex, { x: newX, y: newY });
      dragStartRef.current = {
        ...dragStartRef.current,
        clientX: e.clientX,
        clientY: e.clientY,
        waypointX: newX,
        waypointY: newY,
      };
    },
    [draggingIndex, connection.from, connection.to, onWaypointMove, transform.k]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      setDraggingIndex(null);
      dragStartRef.current = null;
    },
    []
  );

  useEffect(() => {
    if (draggingIndex === null) return;
    const handleGlobalPointerMove = (e: PointerEvent) => {
      if (draggingIndex === null || !dragStartRef.current) return;
      const deltaX = (e.clientX - dragStartRef.current.clientX) / transform.k;
      const deltaY = (e.clientY - dragStartRef.current.clientY) / transform.k;
      const newX = snapToGrid(dragStartRef.current.waypointX + deltaX);
      const newY = snapToGrid(dragStartRef.current.waypointY + deltaY);
      onWaypointMove(connection.from, connection.to, draggingIndex, { x: newX, y: newY });
      dragStartRef.current = {
        ...dragStartRef.current,
        clientX: e.clientX,
        clientY: e.clientY,
        waypointX: newX,
        waypointY: newY,
      };
    };
    const handleGlobalPointerUp = () => {
      setDraggingIndex(null);
      dragStartRef.current = null;
    };
    document.addEventListener("pointermove", handleGlobalPointerMove, true);
    document.addEventListener("pointerup", handleGlobalPointerUp, true);
    document.addEventListener("pointercancel", handleGlobalPointerUp, true);
    return () => {
      document.removeEventListener("pointermove", handleGlobalPointerMove, true);
      document.removeEventListener("pointerup", handleGlobalPointerUp, true);
      document.removeEventListener("pointercancel", handleGlobalPointerUp, true);
    };
  }, [draggingIndex, connection.from, connection.to, onWaypointMove, transform.k]);

  if (!waypoints.length || disabled) return null;

  const handleSize = 32;
  const halfSize = handleSize / 2;
  const HANDLE_Z_INDEX = 40;

  return (
    <>
      {waypoints.map((wp, index) => (
        <div
          key={wp.id ?? `wp-${index}`}
          className="absolute rounded-full border-4 cursor-move hover:scale-110 transition-transform"
          style={{
            left: `${wp.x - halfSize}px`,
            top: `${wp.y - halfSize}px`,
            width: `${handleSize}px`,
            height: `${handleSize}px`,
            borderColor: connectionColor,
            backgroundColor: draggingIndex === index ? connectionColor : "#f3f4f6",
            opacity: draggingIndex === index ? 0.9 : 1,
            zIndex: HANDLE_Z_INDEX,
            pointerEvents: "auto",
            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
          }}
          onPointerDown={(e) => handlePointerDown(e, index)}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          title="Drag to move waypoint"
        />
      ))}
    </>
  );
}
