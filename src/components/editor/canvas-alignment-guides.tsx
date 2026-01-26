"use client";

import React from 'react';
import type { AlignmentGuide } from '@/hooks/use-alignment-guides';

interface CanvasAlignmentGuidesProps {
  guides: AlignmentGuide[];
  width: number;
  height: number;
  transform: { x: number; y: number; k: number };
}

/**
 * Component that renders visual alignment guide lines on the canvas
 * Shows green semi-transparent lines when objects align during drag operations
 * 
 * Note: This component is rendered inside the transformable div, so it's already
 * transformed by the parent. We don't apply transform here, just use diagram space coordinates.
 */
export function CanvasAlignmentGuides({
  guides,
  width,
  height,
  transform,
}: CanvasAlignmentGuidesProps) {
  if (guides.length === 0) return null;

  return (
    <svg
      className="absolute top-0 left-0 overflow-visible pointer-events-none"
      style={{
        width: `${width}px`,
        height: `${height}px`,
        zIndex: 10,
      }}
    >
      {guides.map((guide, index) => {
        if (guide.type === 'horizontal') {
          // Horizontal line (spans full width in diagram space)
          return (
            <line
              key={`guide-${guide.type}-${guide.position}-${index}`}
              x1={0}
              y1={guide.position}
              x2={width}
              y2={guide.position}
              stroke="rgb(34, 197, 94)" // Tailwind green-500
              strokeWidth={1.5}
              strokeOpacity={0.5}
              strokeDasharray="none"
            />
          );
        } else {
          // Vertical line (spans full height in diagram space)
          return (
            <line
              key={`guide-${guide.type}-${guide.position}-${index}`}
              x1={guide.position}
              y1={0}
              x2={guide.position}
              y2={height}
              stroke="rgb(34, 197, 94)" // Tailwind green-500
              strokeWidth={1.5}
              strokeOpacity={0.5}
              strokeDasharray="none"
            />
          );
        }
      })}
    </svg>
  );
}
