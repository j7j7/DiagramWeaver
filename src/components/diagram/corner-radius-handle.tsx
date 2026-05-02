"use client";

import React, { useState } from "react";
import { Radius } from "lucide-react";
import { cn } from "@/lib/utils";

interface CornerRadiusHandleProps {
  visible: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  disabled?: boolean;
  zIndexClass?: string;
  className?: string;
}

export function CornerRadiusHandle({
  visible,
  onPointerDown,
  disabled = false,
  zIndexClass = "z-50",
  className,
}: CornerRadiusHandleProps) {
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
        "dw-corner-radius-handle",
        zIndexClass,
        isHovered && "dw-corner-radius-handle-highlighted",
        className
      )}
      data-hovered={isHovered}
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        width: "24px",
        height: "24px",
        marginBottom: "-18px",
        marginLeft: "4px",
        cursor: "ew-resize",
        touchAction: "none",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onPointerDown={handleDown}
    >
      <div className="dw-corner-radius-indicator" />
      <Radius className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4 h-4 text-green-700 pointer-events-none" />
    </div>
  );
}
