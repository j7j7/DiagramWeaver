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
      {/* Filled circle button */}
      <circle
        r="16"
        fill={isActive ? "#10b981" : "#6b7280"}
        className="transition-all duration-200 hover:fill-blue-500 cursor-pointer"
        style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
      />
      
      {/* Arrow/No Arrow icon based on state */}
      <g
        transform={isActive ? "scale(1.2)" : "scale(0.9)"}
        className="transition-all duration-200 hover:scale-1.4 cursor-pointer pointer-events-none"
      >
        {isActive ? (
          // Arrow symbol when active (white for contrast)
          <path
            d="M -8 -4 L 4 0 L -8 4 Z"
            fill="white"
            className="transition-all duration-200"
          />
        ) : (
          // X symbol when inactive (white for contrast)
          <g>
            <line
              x1="-6"
              y1="-6"
              x2="6"
              y2="6"
              stroke="white"
              strokeWidth="2"
              className="transition-all duration-200"
            />
            <line
              x1="-6"
              y1="6"
              x2="6"
              y2="-6"
              stroke="white"
              strokeWidth="2"
              className="transition-all duration-200"
            />
          </g>
        )}
      </g>
    </g>
  );
}