"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import type { CanvasGuideLine } from "@/lib/types";
import {
  CANVAS_GUIDE_LINE_COLOR,
  CANVAS_GUIDE_LINE_DASH,
  CANVAS_GUIDE_LINE_HIT_PX,
  CANVAS_GUIDE_LINE_OPACITY,
  CANVAS_GUIDE_LINE_SELECTED_OPACITY,
  getGuideLineSpanBounds,
  screenToDiagramCoords,
  updateCanvasGuideLinePosition,
} from "@/lib/canvas-guide-lines";

interface CanvasGuideLinesOverlayProps {
  guides: CanvasGuideLine[];
  contentWidth: number;
  contentHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  transform: { x: number; y: number; k: number };
  canvasRef: React.RefObject<HTMLElement | null>;
  selectedGuideId: string | null;
  onSelectGuide: (guideId: string | null) => void;
  onGuidesChange: (guides: CanvasGuideLine[]) => void;
  isReadOnly?: boolean;
}

type DragState = {
  guideId: string;
  orientation: CanvasGuideLine["orientation"];
};

export function CanvasGuideLinesOverlay({
  guides,
  contentWidth,
  contentHeight,
  viewportWidth,
  viewportHeight,
  transform,
  canvasRef,
  selectedGuideId,
  onSelectGuide,
  onGuidesChange,
  isReadOnly = false,
}: CanvasGuideLinesOverlayProps) {
  const [hoveredGuideId, setHoveredGuideId] = useState<string | null>(null);
  const [dragPreviewPosition, setDragPreviewPosition] = useState<number | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const span = useMemo(
    () =>
      getGuideLineSpanBounds(
        transform,
        viewportWidth,
        viewportHeight,
        contentWidth,
        contentHeight,
      ),
    [transform, viewportWidth, viewportHeight, contentWidth, contentHeight],
  );

  const spanWidth = span.maxX - span.minX;
  const spanHeight = span.maxY - span.minY;

  const getGuidePosition = useCallback(
    (guide: CanvasGuideLine) => {
      if (dragRef.current?.guideId === guide.id && dragPreviewPosition !== null) {
        return dragPreviewPosition;
      }
      return guide.position;
    },
    [dragPreviewPosition],
  );

  const commitDrag = useCallback(
    (clientX: number, clientY: number) => {
      const drag = dragRef.current;
      dragRef.current = null;
      setDragPreviewPosition(null);
      if (!drag || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const { x, y } = screenToDiagramCoords(clientX, clientY, rect, transform);
      const position = drag.orientation === "vertical" ? x : y;
      onGuidesChange(updateCanvasGuideLinePosition(guides, drag.guideId, position));
    },
    [canvasRef, guides, onGuidesChange, transform],
  );

  const handleGuidePointerDown = useCallback(
    (e: React.PointerEvent, guide: CanvasGuideLine) => {
      if (isReadOnly) return;
      e.stopPropagation();
      e.preventDefault();
      onSelectGuide(guide.id);
      dragRef.current = { guideId: guide.id, orientation: guide.orientation };

      const onMove = (ev: PointerEvent) => {
        if (!dragRef.current || !canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const { x, y } = screenToDiagramCoords(ev.clientX, ev.clientY, rect, transform);
        setDragPreviewPosition(dragRef.current.orientation === "vertical" ? x : y);
      };
      const onUp = (ev: PointerEvent) => {
        commitDrag(ev.clientX, ev.clientY);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [canvasRef, commitDrag, isReadOnly, onSelectGuide, transform],
  );

  if (guides.length === 0 || spanWidth <= 0 || spanHeight <= 0) return null;

  return (
    <div
      data-canvas-guide-lines
      className="absolute pointer-events-none overflow-visible"
      style={{
        left: `${span.minX}px`,
        top: `${span.minY}px`,
        width: `${spanWidth}px`,
        height: `${spanHeight}px`,
        zIndex: 15,
      }}
    >
      <svg
        className="absolute top-0 left-0 overflow-visible"
        width={spanWidth}
        height={spanHeight}
        aria-hidden
      >
        {guides.map((guide) => {
          const position = getGuidePosition(guide);
          const isSelected = guide.id === selectedGuideId;
          const isHovered = guide.id === hoveredGuideId;
          const opacity =
            isSelected || isHovered ? CANVAS_GUIDE_LINE_SELECTED_OPACITY : CANVAS_GUIDE_LINE_OPACITY;
          if (guide.orientation === "horizontal") {
            const localY = position - span.minY;
            return (
              <line
                key={guide.id}
                x1={0}
                y1={localY}
                x2={spanWidth}
                y2={localY}
                stroke={CANVAS_GUIDE_LINE_COLOR}
                strokeWidth={1.5}
                strokeOpacity={opacity}
                strokeDasharray={CANVAS_GUIDE_LINE_DASH}
              />
            );
          }
          const localX = position - span.minX;
          return (
            <line
              key={guide.id}
              x1={localX}
              y1={0}
              x2={localX}
              y2={spanHeight}
              stroke={CANVAS_GUIDE_LINE_COLOR}
              strokeWidth={1.5}
              strokeOpacity={opacity}
            />
          );
        })}
      </svg>

      {guides.map((guide) => {
        const position = getGuidePosition(guide);
        const isSelected = guide.id === selectedGuideId;
        if (guide.orientation === "horizontal") {
          const localY = position - span.minY;
          return (
            <div
              key={`hit-${guide.id}`}
              className="absolute pointer-events-auto"
              style={{
                left: 0,
                top: `${localY - CANVAS_GUIDE_LINE_HIT_PX / 2}px`,
                width: `${spanWidth}px`,
                height: `${CANVAS_GUIDE_LINE_HIT_PX}px`,
                cursor: isReadOnly ? "default" : "row-resize",
                zIndex: 1,
              }}
              onPointerDown={(e) => handleGuidePointerDown(e, guide)}
              onPointerEnter={() => setHoveredGuideId(guide.id)}
              onPointerLeave={() => setHoveredGuideId((prev) => (prev === guide.id ? null : prev))}
              onClick={(e) => {
                e.stopPropagation();
                onSelectGuide(guide.id);
              }}
              aria-label={isSelected ? "Selected horizontal guide line" : "Horizontal guide line"}
            />
          );
        }

        const localX = position - span.minX;
        return (
          <div
            key={`hit-${guide.id}`}
            className="absolute pointer-events-auto"
            style={{
              left: `${localX - CANVAS_GUIDE_LINE_HIT_PX / 2}px`,
              top: 0,
              width: `${CANVAS_GUIDE_LINE_HIT_PX}px`,
              height: `${spanHeight}px`,
              cursor: isReadOnly ? "default" : "col-resize",
              zIndex: 1,
            }}
            onPointerDown={(e) => handleGuidePointerDown(e, guide)}
            onPointerEnter={() => setHoveredGuideId(guide.id)}
            onPointerLeave={() => setHoveredGuideId((prev) => (prev === guide.id ? null : prev))}
            onClick={(e) => {
              e.stopPropagation();
              onSelectGuide(guide.id);
            }}
            aria-label={isSelected ? "Selected vertical guide line" : "Vertical guide line"}
          />
        );
      })}
    </div>
  );
}
