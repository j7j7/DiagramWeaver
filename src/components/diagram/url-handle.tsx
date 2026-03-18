"use client";

import React, { useState } from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface UrlHandleProps {
  visible: boolean;
  onOpen: () => void;
  disabled?: boolean;
  zIndexClass?: string;
  className?: string;
}

export function UrlHandle({
  visible,
  onOpen,
  disabled = false,
  zIndexClass = "z-50",
  className,
}: UrlHandleProps) {
  const [isHovered, setIsHovered] = useState(false);

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
    onOpen();
  };

  return (
    <div
      className={cn(
        "dw-url-handle",
        zIndexClass,
        isHovered && "dw-url-handle-highlighted",
        className
      )}
      data-hovered={isHovered}
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        width: "24px",
        height: "24px",
        transform: "translate(-50%, -50%)",
        cursor: "pointer",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
      title="Open URL"
      aria-label="Open URL"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          onOpen();
        }
      }}
    >
      <div className="dw-url-indicator" />
      <ExternalLink className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 text-green-700 pointer-events-none" />
    </div>
  );
}