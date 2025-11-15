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
      {/* Background circle for better visibility */}
      <circle
        r="16"
        fill="rgba(255, 255, 255, 0.9)"
        stroke={isActive ? "#10b981" : "#6b7280"}
        strokeWidth="3"
        className="transition-all duration-200 hover:stroke-blue-500"
        style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.4))' }}
      />
      
      {/* Arrow/No Arrow icon based on state */}
      <g
        transform={isActive ? "scale(1.2)" : "scale(0.9)"}
        className="transition-transform duration-200"
      >
        {isActive ? (
          // Arrow symbol when active
          <path
            d="M -8 -4 L 4 0 L -8 4 Z"
            fill="#10b981"
            className="transition-colors duration-200"
          />
        ) : (
          // X symbol when inactive
          <g>
            <line
              x1="-6"
              y1="-6"
              x2="6"
              y2="6"
              stroke="#6b7280"
              strokeWidth="2"
              className="transition-colors duration-200"
            />
            <line
              x1="-6"
              y1="6"
              x2="6"
              y2="-6"
              stroke="#6b7280"
              strokeWidth="2"
              className="transition-colors duration-200"
            />
          </g>
        )}
      </g>
      
      {/* Hover state indicator */}
      <circle
        r="16"
        fill="transparent"
        className="transition-all duration-200 hover:fill-blue-100 hover:fill-opacity-30"
      />
    </g>
  );
}