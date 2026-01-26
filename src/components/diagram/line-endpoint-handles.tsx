"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Circle } from "lucide-react";

export type LineHandleType = 'start' | 'end' | null;

interface LineEndpointHandlesProps {
  visible: boolean;
  activeHandle: LineHandleType;
  startPoint: { x: number; y: number }; // Absolute canvas position
  endPoint: { x: number; y: number }; // Absolute canvas position
  nodeX: number; // Node's x position on canvas
  nodeY: number; // Node's y position on canvas
  onStartDrag: (event: React.MouseEvent, handle: 'start' | 'end') => void;
  disabled?: boolean;
  zIndexClass?: string;
}

export function LineEndpointHandles({
  visible,
  activeHandle,
  startPoint,
  endPoint,
  nodeX,
  nodeY,
  onStartDrag,
  disabled = false,
  zIndexClass = "z-50",
}: LineEndpointHandlesProps) {
  const [hoveredHandle, setHoveredHandle] = React.useState<LineHandleType>(null);

  if (disabled || !visible) {
    return null;
  }

  const handleMouseDown = (e: React.MouseEvent, handle: 'start' | 'end') => {
    e.stopPropagation();
    e.preventDefault();
    onStartDrag(e, handle);
  };

  const isActive = (handle: LineHandleType) => activeHandle === handle;
  const isHovered = (handle: LineHandleType) => hoveredHandle === handle;
  const isHighlighted = (handle: LineHandleType) => isActive(handle) || isHovered(handle);
  
  // Handle size
  const handleSize = 24;
  const halfSize = handleSize / 2;
  
  // Calculate relative positions (absolute position - node position)
  // These positions are relative to the node container (which is at nodeX, nodeY)
  const relStartX = startPoint.x - nodeX;
  const relStartY = startPoint.y - nodeY;
  const relEndX = endPoint.x - nodeX;
  const relEndY = endPoint.y - nodeY;

  return (
    <>
      {/* Start point handle - hide when actively dragging */}
      {activeHandle !== 'start' && (
        <div
          className={cn(
            "absolute rounded-full border-2 border-green-500 bg-transparent cursor-move",
            isHighlighted('start') && "border-green-700 scale-125 shadow-lg",
            isActive('start') && "bg-green-200",
            zIndexClass
          )}
          style={{
            left: `${relStartX - halfSize}px`,
            top: `${relStartY - halfSize}px`,
            width: `${handleSize}px`,
            height: `${handleSize}px`,
            pointerEvents: 'auto', // Ensure handles are clickable even if parent has pointerEvents: 'none'
            transition: 'transform 0.2s, border-color 0.2s, background-color 0.2s, box-shadow 0.2s', // Only transition visual effects, not position
          }}
          onMouseEnter={() => setHoveredHandle('start')}
          onMouseLeave={() => setHoveredHandle(null)}
          onMouseDown={(e) => handleMouseDown(e, 'start')}
          title="Drag to move start point"
        />
      )}

      {/* End point handle - hide when actively dragging */}
      {activeHandle !== 'end' && (
        <div
          className={cn(
            "absolute rounded-full border-2 border-yellow-500 bg-transparent cursor-move",
            isHighlighted('end') && "border-yellow-700 scale-125 shadow-lg",
            isActive('end') && "bg-yellow-200",
            zIndexClass
          )}
          style={{
            left: `${relEndX - halfSize}px`,
            top: `${relEndY - halfSize}px`,
            width: `${handleSize}px`,
            height: `${handleSize}px`,
            pointerEvents: 'auto', // Ensure handles are clickable even if parent has pointerEvents: 'none'
            transition: 'transform 0.2s, border-color 0.2s, background-color 0.2s, box-shadow 0.2s', // Only transition visual effects, not position
          }}
          onMouseEnter={() => setHoveredHandle('end')}
          onMouseLeave={() => setHoveredHandle(null)}
          onMouseDown={(e) => handleMouseDown(e, 'end')}
          title="Drag to move end point"
        />
      )}
    </>
  );
}
