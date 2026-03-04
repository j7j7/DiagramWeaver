"use client";

import React from "react";
import type { DiagramConnectionData } from "@/lib/types";

interface ArrowToggleProps {
  x: number;
  y: number;
  connection: DiagramConnectionData;
  isActive: boolean; // Whether arrow is currently enabled
}

export function ArrowToggle({ x, y, connection, isActive }: ArrowToggleProps) {
  return (
    <g
      transform={`translate(${x}, ${y})`}
    >
      {/* Green when enabled, red when disabled */}
      <circle
        r="16"
        fill={isActive ? "#22c55e" : "#ef4444"}
        className="transition-all duration-200 hover:opacity-90 cursor-pointer"
      />
      
      {/* Always show arrow icon */}
      <g
        transform={isActive ? "scale(1.2)" : "scale(0.9)"}
        className="transition-all duration-200 pointer-events-none"
      >
        <path d="M -8 -4 L 4 0 L -8 4 Z" fill="white" />
      </g>
    </g>
  );
}