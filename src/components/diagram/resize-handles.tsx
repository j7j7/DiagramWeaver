"use client";

import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ArrowRight, ArrowDown, MoveDiagonal2 } from "lucide-react";

export type ResizeHandleType = 'right' | 'bottom' | 'bottom-right' | null;

interface ResizeHandlesProps {
  visible: boolean;
  activeHandle: ResizeHandleType;
  hoveredHandle: ResizeHandleType;
  onStart: (event: React.MouseEvent, handle: 'right' | 'bottom' | 'bottom-right') => void;
  disabled?: boolean;
  zIndexClass?: string;
  className?: string;
  /** When set, only show these handles (e.g. ['right'] for icon node label width) */
  handles?: ('right' | 'bottom' | 'bottom-right')[];
}

export function ResizeHandles({
  visible,
  activeHandle,
  hoveredHandle,
  onStart,
  disabled = false,
  zIndexClass = "z-50",
  className,
  handles = ['right', 'bottom', 'bottom-right'],
}: ResizeHandlesProps) {
  const [localHoveredHandle, setLocalHoveredHandle] = useState<ResizeHandleType>(null);

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

  const handleMouseDown = (e: React.MouseEvent, handle: 'right' | 'bottom' | 'bottom-right') => {
    e.stopPropagation();
    e.preventDefault();
    onStart(e, handle);
  };

  const isActive = (handle: ResizeHandleType) => activeHandle === handle;
  const isHovered = (handle: ResizeHandleType) => effectiveHoveredHandle === handle;
  const isHighlighted = (handle: ResizeHandleType) => isActive(handle) || isHovered(handle);

  const showRight = handles.includes('right');
  const showBottom = handles.includes('bottom');
  const showBottomRight = handles.includes('bottom-right');

  return (
    <>
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
          marginRight: '-10px',
          cursor: 'ew-resize',
        }}
        onMouseEnter={() => handleMouseEnter('right')}
        onMouseLeave={handleMouseLeave}
        onMouseDown={(e) => handleMouseDown(e, 'right')}
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
          marginBottom: '-10px',
          cursor: 'ns-resize',
        }}
        onMouseEnter={() => handleMouseEnter('bottom')}
        onMouseLeave={handleMouseLeave}
        onMouseDown={(e) => handleMouseDown(e, 'bottom')}
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
          marginBottom: '-10px',
          marginRight: '-10px',
          cursor: 'nwse-resize',
        }}
        onMouseEnter={() => handleMouseEnter('bottom-right')}
        onMouseLeave={handleMouseLeave}
        onMouseDown={(e) => handleMouseDown(e, 'bottom-right')}
      >
        <div className="dw-resize-indicator dw-resize-indicator-knob" />
        <MoveDiagonal2 className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4 h-4 text-green-700 pointer-events-none" />
      </div>
      )}
    </>
  );
}
