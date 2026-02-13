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
      {/* Solid green circle button */}
      <circle
        r="16"
        fill="#22c55e"
        className="transition-all duration-200 hover:opacity-90 cursor-pointer"
      />
      
      {/* Solid arrow or line icon based on state */}
      <g
        transform={isActive ? "scale(1.2)" : "scale(0.9)"}
        className="transition-all duration-200 pointer-events-none"
      >
        {isActive ? (
          <path d="M -8 -4 L 4 0 L -8 4 Z" fill="white" />
        ) : (
          <rect x="-6" y="-2" width="12" height="4" fill="white" rx="0.5" />
        )}
      </g>
    </g>
  );
}