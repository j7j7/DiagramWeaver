"use client";

import React, { useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConnectHandleProps {
  visible: boolean;
  onConnect: () => void;
  isConnectMode?: boolean;
  disabled?: boolean;
  zIndexClass?: string;
  className?: string;
}

export function ConnectHandle({
  visible,
  onConnect,
  isConnectMode = false,
  disabled = false,
  zIndexClass = "z-50",
  className,
}: ConnectHandleProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Clear hover state when component becomes invisible or disabled
  React.useEffect(() => {
    if (disabled || !visible) {
      setIsHovered(false);
    }
  }, [disabled, visible]);

  if (disabled || !visible) {
    return null;
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onConnect();
  };

  return (
    <div
      className={cn(
        "dw-connect-handle",
        zIndexClass,
        isHovered && "dw-connect-handle-highlighted",
        isConnectMode && "dw-connect-handle-active",
        className
      )}
      data-hovered={isHovered}
      data-active={isConnectMode}
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: '24px',
        height: '24px',
        marginTop: '-18px',
        marginRight: '-12px',
        cursor: 'pointer',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
    >
      <div className="dw-connect-indicator" />
      <Plus className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4 h-4 text-green-700 pointer-events-none" />
    </div>
  );
}
