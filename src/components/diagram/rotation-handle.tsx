"use client";

import React, { useState } from "react";
import { RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface RotationHandleProps {
  visible: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  disabled?: boolean;
  /** True while a rotation drag is active on this node */
  isDragging?: boolean;
  zIndexClass?: string;
  className?: string;
}

/**
 * Top-left rotation control — matches ConnectHandle / CornerRadiusHandle placement
 * (inside the node’s rotated box) so it stays anchored like other helper icons.
 */
export function RotationHandle({
  visible,
  onPointerDown,
  disabled = false,
  isDragging = false,
  zIndexClass = "z-50",
  className,
}: RotationHandleProps) {
  const [isHovered, setIsHovered] = useState(false);

  React.useEffect(() => {
    if (disabled || !visible) {
      setIsHovered(false);
    }
  }, [disabled, visible]);

  if (disabled || !visible) {
    return null;
  }

  const handleDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onPointerDown(e);
  };

  return (
    <div
      className={cn(
        "dw-rotation-handle active:cursor-grabbing",
        zIndexClass,
        isHovered && "dw-rotation-handle-highlighted",
        isDragging && "dw-rotation-handle-active",
        className
      )}
      data-hovered={isHovered}
      data-active={isDragging}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "24px",
        height: "24px",
        marginTop: "-18px",
        marginLeft: "-12px",
        cursor: "grab",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onPointerDown={handleDown}
    >
      <div className="dw-rotation-indicator" />
      <RotateCw className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4 h-4 text-green-700 pointer-events-none" />
    </div>
  );
}
