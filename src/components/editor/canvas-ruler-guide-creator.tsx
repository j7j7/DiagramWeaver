"use client";

import React, { useCallback, useRef, useState } from "react";
import type { CanvasGuideLine } from "@/lib/types";
import {
  CANVAS_GUIDE_LINE_COLOR,
  CANVAS_GUIDE_LINE_DASH,
  CANVAS_GUIDE_LINE_OPACITY,
  createCanvasGuideLineId,
  diagramXToCanvasRelative,
  diagramYToCanvasRelative,
  screenToDiagramCoords,
} from "@/lib/canvas-guide-lines";

type CreateMode = "vertical" | "horizontal";

interface CanvasRulerGuideCreatorProps {
  transform: { x: number; y: number; k: number };
  rulerSize: number;
  /** Horizontal inset matching `CanvasRulers.leftOffset` (component sidebar width). */
  leftOffset?: number;
  canvasRef: React.RefObject<HTMLElement | null>;
  onCreateGuide: (guide: CanvasGuideLine) => void;
}

const MIN_DRAG_INTO_CANVAS_PX = 6;

export function CanvasRulerGuideCreator({
  transform,
  rulerSize,
  leftOffset = 0,
  canvasRef,
  onCreateGuide,
}: CanvasRulerGuideCreatorProps) {
  const [preview, setPreview] = useState<{
    mode: CreateMode;
    clientX: number;
    clientY: number;
  } | null>(null);
  const dragRef = useRef<{
    mode: CreateMode;
    startClientX: number;
    startClientY: number;
  } | null>(null);

  const clearDrag = useCallback(() => {
    dragRef.current = null;
    setPreview(null);
  }, []);

  const tryCommitGuide = useCallback(
    (clientX: number, clientY: number) => {
      const drag = dragRef.current;
      if (!drag || !canvasRef.current) {
        clearDrag();
        return;
      }

      const rect = canvasRef.current.getBoundingClientRect();
      const intoCanvasX = clientX - rect.left - leftOffset - rulerSize;
      const intoCanvasY = clientY - rect.top - rulerSize;

      if (drag.mode === "horizontal") {
        if (intoCanvasY < MIN_DRAG_INTO_CANVAS_PX) {
          clearDrag();
          return;
        }
        const { y } = screenToDiagramCoords(clientX, clientY, rect, transform);
        onCreateGuide({
          id: createCanvasGuideLineId(),
          orientation: "horizontal",
          position: y,
        });
      } else {
        if (intoCanvasX < MIN_DRAG_INTO_CANVAS_PX) {
          clearDrag();
          return;
        }
        const { x } = screenToDiagramCoords(clientX, clientY, rect, transform);
        onCreateGuide({
          id: createCanvasGuideLineId(),
          orientation: "vertical",
          position: x,
        });
      }
      clearDrag();
    },
    [canvasRef, clearDrag, leftOffset, onCreateGuide, rulerSize, transform],
  );

  const startDrag = useCallback(
    (mode: CreateMode, clientX: number, clientY: number) => {
      dragRef.current = { mode, startClientX: clientX, startClientY: clientY };
      setPreview({ mode, clientX, clientY });

      const onMove = (ev: PointerEvent) => {
        if (!dragRef.current) return;
        setPreview({ mode: dragRef.current.mode, clientX: ev.clientX, clientY: ev.clientY });
      };
      const onUp = (ev: PointerEvent) => {
        tryCommitGuide(ev.clientX, ev.clientY);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [tryCommitGuide],
  );

  const previewLine = (() => {
    if (!preview || !canvasRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    const { mode, clientX, clientY } = preview;

    if (mode === "horizontal") {
      const y = diagramYToCanvasRelative(
        screenToDiagramCoords(clientX, clientY, rect, transform).y,
        transform,
      );
      return (
        <line
          x1={0}
          y1={y}
          x2={rect.width}
          y2={y}
          stroke={CANVAS_GUIDE_LINE_COLOR}
          strokeWidth={1.5}
          strokeOpacity={CANVAS_GUIDE_LINE_OPACITY}
          strokeDasharray={CANVAS_GUIDE_LINE_DASH}
        />
      );
    }

    const x = diagramXToCanvasRelative(
      screenToDiagramCoords(clientX, clientY, rect, transform).x,
      transform,
    );
    return (
      <line
        x1={x}
        y1={rulerSize}
        x2={x}
        y2={rect.height}
        stroke={CANVAS_GUIDE_LINE_COLOR}
        strokeWidth={1.5}
        strokeOpacity={CANVAS_GUIDE_LINE_OPACITY}
      />
    );
  })();

  return (
    <>
      <div
        className="absolute z-[51] cursor-row-resize"
        style={{
          top: 0,
          left: leftOffset + rulerSize,
          right: 0,
          height: rulerSize,
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          startDrag("horizontal", e.clientX, e.clientY);
        }}
        aria-label="Drag from top ruler to add horizontal guide"
      />
      <div
        className="absolute z-[51] cursor-col-resize"
        style={{
          top: rulerSize,
          left: leftOffset,
          width: rulerSize,
          bottom: 0,
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          startDrag("vertical", e.clientX, e.clientY);
        }}
        aria-label="Drag from left ruler to add vertical guide"
      />

      {preview && canvasRef.current && (
        <svg
          className="absolute top-0 left-0 pointer-events-none z-[52]"
          width={canvasRef.current.clientWidth}
          height={canvasRef.current.clientHeight}
          aria-hidden
        >
          {previewLine}
        </svg>
      )}
    </>
  );
}
