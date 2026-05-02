"use client";

import React from "react";
import { cn } from "@/lib/utils";

/** Start/end: green (match `connection-endpoint-handles.tsx`); interior curve points: yellow */
const GREEN = "#22c55e";
const GREEN_ACTIVE = "#16a34a";
const YELLOW = "#eab308";
const YELLOW_ACTIVE = "#ca8a04";
const HANDLE = 12;
const HALF = HANDLE / 2;

export interface LineVertexHandlesProps {
  visible: boolean;
  /** Index of vertex being dragged (hidden while dragging that handle); null = show all */
  activeVertexIndex: number | null;
  /** Click-selected vertex (e.g. for delete-point); shown with a ring */
  focusedVertexIndex?: number | null;
  /** Absolute canvas positions: [start, ...interior controls (curved only), end] */
  vertices: { x: number; y: number }[];
  nodeX: number;
  nodeY: number;
  onVertexPointerDown: (
    event: React.PointerEvent | React.MouseEvent,
    vertexIndex: number,
  ) => void;
  disabled?: boolean;
  zIndexClass?: string;
}

export function LineVertexHandles({
  visible,
  activeVertexIndex,
  focusedVertexIndex = null,
  vertices,
  nodeX,
  nodeY,
  onVertexPointerDown,
  disabled = false,
  zIndexClass = "z-50",
}: LineVertexHandlesProps) {
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);

  if (disabled || !visible || vertices.length < 2) {
    return null;
  }

  const handlePointerDown = (e: React.PointerEvent, vertexIndex: number) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    onVertexPointerDown(e, vertexIndex);
  };

  return (
    <>
      {vertices.map((pt, index) => {
        if (activeVertexIndex === index) return null;
        const relX = pt.x - nodeX;
        const relY = pt.y - nodeY;
        const highlighted =
          hoveredIndex === index || activeVertexIndex === index || focusedVertexIndex === index;
        const isEndpoint = index === 0 || index === vertices.length - 1;
        const fill = highlighted
          ? isEndpoint
            ? GREEN_ACTIVE
            : YELLOW_ACTIVE
          : isEndpoint
            ? GREEN
            : YELLOW;
        const focused = focusedVertexIndex === index;
        return (
          <div
            key={`line-v-${index}`}
            data-dw-line-vertex-handle
            className={cn(
              "absolute cursor-grab active:cursor-grabbing rounded-sm border-2 border-white shadow-sm",
              focused && "ring-2 ring-primary ring-offset-1 ring-offset-background",
              zIndexClass
            )}
            style={{
              left: `${relX - HALF}px`,
              top: `${relY - HALF}px`,
              width: `${HANDLE}px`,
              height: `${HANDLE}px`,
              backgroundColor: fill,
              pointerEvents: "auto",
              touchAction: "none",
            }}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
            onPointerDown={(e) => handlePointerDown(e, index)}
            title={
              index === 0
                ? "Click to select; drag to move start"
                : index === vertices.length - 1
                  ? "Click to select; drag to move end"
                  : "Click to select; drag to move point"
            }
          />
        );
      })}
    </>
  );
}

/** @deprecated Use `LineVertexHandles` */
export type LineHandleType = "start" | "end" | null;

/** @deprecated Use `LineVertexHandles` */
export const LineEndpointHandles = LineVertexHandles;
