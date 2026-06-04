"use client";

import React, { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { ArrowRight, ArrowDown, ArrowUp, ArrowLeft, MoveDiagonal2 } from "lucide-react";
import { computeResizeHandleEdgeOffsets } from "@/lib/resize-handle-offsets";

export type ResizeHandleType = 'top' | 'left' | 'right' | 'bottom' | 'bottom-right' | null;

interface ResizeHandlesProps {
  visible: boolean;
  activeHandle: ResizeHandleType;
  hoveredHandle: ResizeHandleType;
  onStart: (
    event: React.MouseEvent | React.PointerEvent,
    handle: "top" | "left" | "right" | "bottom" | "bottom-right"
  ) => void;
  disabled?: boolean;
  zIndexClass?: string;
  className?: string;
  /** When set, only show these handles (e.g. ['right'] for icon node label width) */
  handles?: ('top' | 'left' | 'right' | 'bottom' | 'bottom-right')[];
  /** Diagram px — used to push edge handles outward on very narrow / short boxes */
  boxWidth?: number;
  boxHeight?: number;
}

export function ResizeHandles({
  visible,
  activeHandle,
  hoveredHandle,
  onStart,
  disabled = false,
  zIndexClass = "z-50",
  className,
  handles = ['top', 'left', 'right', 'bottom', 'bottom-right'],
  boxWidth,
  boxHeight,
}: ResizeHandlesProps) {
  const [localHoveredHandle, setLocalHoveredHandle] = useState<ResizeHandleType>(null);
  const edgeOffsets = useMemo(
    () => computeResizeHandleEdgeOffsets(boxWidth, boxHeight),
    [boxWidth, boxHeight],
  );

  // Use hoveredHandle prop if provided, otherwise fall back to local state
  const effectiveHoveredHandle = hoveredHandle ?? localHoveredHandle;

  // Clear local hover state when component becomes invisible or disabled
  useEffect(() => {
    if (disabled || !visible) {
      setLocalHoveredHandle(null);
    }
  }, [disabled, visible]);

  if (disabled || !visible) {
    return null;
  }

  const handleMouseEnter = (handle: ResizeHandleType) => {
    setLocalHoveredHandle(handle);
  };

  const handleMouseLeave = () => {
    setLocalHoveredHandle(null);
  };

  const handlePointerDown = (e: React.PointerEvent, handle: 'top' | 'left' | 'right' | 'bottom' | 'bottom-right') => {
    e.stopPropagation();
    e.preventDefault();
    onStart(e, handle);
  };

  const isActive = (handle: ResizeHandleType) => activeHandle === handle;
  const isHovered = (handle: ResizeHandleType) => effectiveHoveredHandle === handle;
  const isHighlighted = (handle: ResizeHandleType) => isActive(handle) || isHovered(handle);

  const showTop = handles.includes('top');
  const showLeft = handles.includes('left');
  const showRight = handles.includes('right');
  const showBottom = handles.includes('bottom');
  const showBottomRight = handles.includes('bottom-right');

  return (
    <>
      {showTop && (
      /* Top edge handle - drag up to expand (bottom stays fixed), drag down to shrink */
      <div
        className={cn(
          "dw-resize-handle dw-resize-rail dw-resize-rail-top",
          zIndexClass,
          isHighlighted('top') && "dw-resize-handle-highlighted",
          isActive('top') && "dw-resize-handle-active",
          className
        )}
        data-handle="top"
        data-active={isActive('top')}
        data-hovered={isHovered('top')}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '12px',
          marginTop: `-${edgeOffsets.top}px`,
          cursor: 'ns-resize',
          touchAction: 'none',
        }}
        onMouseEnter={() => handleMouseEnter('top')}
        onMouseLeave={handleMouseLeave}
        onPointerDown={(e) => handlePointerDown(e, 'top')}
      >
        <div className="dw-resize-indicator dw-resize-indicator-rail" />
        <ArrowUp className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-3 h-3 text-green-700 pointer-events-none" />
      </div>
      )}

      {showLeft && (
      /* Left edge handle - drag left to expand (right stays fixed), drag right to shrink */
      <div
        className={cn(
          "dw-resize-handle dw-resize-rail dw-resize-rail-left",
          zIndexClass,
          isHighlighted('left') && "dw-resize-handle-highlighted",
          isActive('left') && "dw-resize-handle-active",
          className
        )}
        data-handle="left"
        data-active={isActive('left')}
        data-hovered={isHovered('left')}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '12px',
          height: '100%',
          marginLeft: `-${edgeOffsets.left}px`,
          cursor: 'ew-resize',
          touchAction: 'none',
        }}
        onMouseEnter={() => handleMouseEnter('left')}
        onMouseLeave={handleMouseLeave}
        onPointerDown={(e) => handlePointerDown(e, 'left')}
      >
        <div className="dw-resize-indicator dw-resize-indicator-rail" />
        <ArrowLeft className="absolute top-1/2 left-0 transform -translate-x-1/2 -translate-y-1/2 w-3 h-3 text-green-700 pointer-events-none" />
      </div>
      )}

      {showRight && (
      /* Right edge handle */
      <div
        className={cn(
          "dw-resize-handle dw-resize-rail dw-resize-rail-right",
          zIndexClass,
          isHighlighted('right') && "dw-resize-handle-highlighted",
          isActive('right') && "dw-resize-handle-active",
          className
        )}
        data-handle="right"
        data-active={isActive('right')}
        data-hovered={isHovered('right')}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '12px',
          height: '100%',
          marginRight: `-${edgeOffsets.right}px`,
          cursor: 'ew-resize',
          touchAction: 'none',
        }}
        onMouseEnter={() => handleMouseEnter('right')}
        onMouseLeave={handleMouseLeave}
        onPointerDown={(e) => handlePointerDown(e, 'right')}
      >
        <div className="dw-resize-indicator dw-resize-indicator-rail" />
        <ArrowRight className="absolute top-1/2 right-0 transform translate-x-1/2 -translate-y-1/2 w-3 h-3 text-green-700 pointer-events-none" />
      </div>
      )}

      {showBottom && (
      /* Bottom edge handle */
      <div
        className={cn(
          "dw-resize-handle dw-resize-rail dw-resize-rail-bottom",
          zIndexClass,
          isHighlighted('bottom') && "dw-resize-handle-highlighted",
          isActive('bottom') && "dw-resize-handle-active",
          className
        )}
        data-handle="bottom"
        data-active={isActive('bottom')}
        data-hovered={isHovered('bottom')}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          height: '12px',
          marginBottom: `-${edgeOffsets.bottom}px`,
          cursor: 'ns-resize',
          touchAction: 'none',
        }}
        onMouseEnter={() => handleMouseEnter('bottom')}
        onMouseLeave={handleMouseLeave}
        onPointerDown={(e) => handlePointerDown(e, 'bottom')}
      >
        <div className="dw-resize-indicator dw-resize-indicator-rail" />
        <ArrowDown className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 w-3 h-3 text-green-700 pointer-events-none" />
      </div>
      )}

      {showBottomRight && (
      /* Bottom-right corner handle */
      <div
        className={cn(
          "dw-resize-handle dw-resize-knob",
          zIndexClass,
          isHighlighted('bottom-right') && "dw-resize-handle-highlighted",
          isActive('bottom-right') && "dw-resize-handle-active",
          className
        )}
        data-handle="bottom-right"
        data-active={isActive('bottom-right')}
        data-hovered={isHovered('bottom-right')}
        style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: '12px',
          height: '12px',
          marginBottom: `-${edgeOffsets.bottom}px`,
          marginRight: `-${edgeOffsets.right}px`,
          cursor: 'nwse-resize',
          touchAction: 'none',
        }}
        onMouseEnter={() => handleMouseEnter('bottom-right')}
        onMouseLeave={handleMouseLeave}
        onPointerDown={(e) => handlePointerDown(e, 'bottom-right')}
      >
        <div className="dw-resize-indicator dw-resize-indicator-knob" />
        <MoveDiagonal2 className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4 h-4 text-green-700 pointer-events-none" />
      </div>
      )}
    </>
  );
}
