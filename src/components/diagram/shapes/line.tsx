"use client";

import React from "react";
import type { DiagramNodeData } from "@/lib/types";

interface LineShapeProps {
  node: DiagramNodeData & { width?: number; height?: number };
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

// Helper to render different line cap styles
const renderLineCap = (
  capType: 'none' | 'arrow' | 'dot' | 'square' | undefined,
  x: number,
  y: number,
  angle: number,
  color: string,
  size: number = 10
) => {
  if (!capType || capType === 'none') return null;

  const angleRad = (angle * Math.PI) / 180;

  if (capType === 'arrow') {
    // Arrow pointing in the direction of the line
    const baseWidth = size;
    const height = size * 1.5;
    
    // Arrow points in the direction of the angle
    const p1 = {
      x: x + Math.cos(angleRad) * height,
      y: y + Math.sin(angleRad) * height
    };
    const p2 = {
      x: x + Math.cos(angleRad + Math.PI * 2/3) * baseWidth,
      y: y + Math.sin(angleRad + Math.PI * 2/3) * baseWidth
    };
    const p3 = {
      x: x + Math.cos(angleRad - Math.PI * 2/3) * baseWidth,
      y: y + Math.sin(angleRad - Math.PI * 2/3) * baseWidth
    };

    return (
      <polygon
        points={`${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`}
        fill={color}
        stroke={color}
        strokeWidth={1}
      />
    );
  }

  if (capType === 'dot') {
    return (
      <circle
        cx={x}
        cy={y}
        r={size / 2}
        fill={color}
        stroke={color}
        strokeWidth={1}
      />
    );
  }

  if (capType === 'square') {
    const halfSize = size / 2;
    return (
      <rect
        x={x - halfSize}
        y={y - halfSize}
        width={size}
        height={size}
        fill={color}
        stroke={color}
        strokeWidth={1}
        transform={`rotate(${angle} ${x} ${y})`}
      />
    );
  }

  return null;
};

export function LineShape({ node, fill = "#000000", stroke, strokeWidth = 2.5 }: LineShapeProps) {
  // Get absolute positions (required for lines)
  const startPos = node.startPos || { x: (node.x || 0), y: (node.y || 0) + 50 };
  const endPos = node.endPos || { x: (node.x || 0) + 150, y: (node.y || 0) + 50 };
  
  // Calculate bounding box
  const minX = Math.min(startPos.x, endPos.x);
  const minY = Math.min(startPos.y, endPos.y);
  const maxX = Math.max(startPos.x, endPos.x);
  const maxY = Math.max(startPos.y, endPos.y);
  
  // Node position should be at top-left of bounding box (this is informational - actual positioning handled by parent)
  const nodeX = node.x || minX;
  const nodeY = node.y || minY;
  
  // Calculate relative coordinates for rendering (relative to node position)
  const relStartX = startPos.x - nodeX;
  const relStartY = startPos.y - nodeY;
  const relEndX = endPos.x - nodeX;
  const relEndY = endPos.y - nodeY;
  
  // Calculate angle for caps
  const dx = endPos.x - startPos.x;
  const dy = endPos.y - startPos.y;
  const angleToEnd = Math.atan2(dy, dx) * (180 / Math.PI);
  const angleToStart = angleToEnd + 180;
  
  // Line caps
  const startCap = node.startCap || 'none';
  const endCap = node.endCap || 'arrow';
  
  // Use node's lineColor or default to fill color
  const lineColor = node.lineColor || fill;
  const actualStrokeWidth = node.lineThickness || strokeWidth;
  
  // Calculate the actual line endpoints, adjusted for cap sizes
  const capSize = 10;
  const capOffset = capSize + actualStrokeWidth / 2;
  
  // Adjust line start/end based on caps to prevent overlap
  let lineStartX = relStartX;
  let lineStartY = relStartY;
  let lineEndX = relEndX;
  let lineEndY = relEndY;
  
  if (startCap !== 'none') {
    const startAngleRad = (angleToEnd * Math.PI) / 180;
    lineStartX += Math.cos(startAngleRad) * capOffset;
    lineStartY += Math.sin(startAngleRad) * capOffset;
  }
  
  if (endCap !== 'none') {
    const endAngleRad = (angleToStart * Math.PI) / 180;
    lineEndX += Math.cos(endAngleRad) * capOffset;
    lineEndY += Math.sin(endAngleRad) * capOffset;
  }
  
  // Calculate padding and SVG dimensions
  const padding = capSize * 3;
  const svgMinX = Math.min(relStartX, relEndX) - padding;
  const svgMinY = Math.min(relStartY, relEndY) - padding;
  const svgMaxX = Math.max(relStartX, relEndX) + padding;
  const svgMaxY = Math.max(relStartY, relEndY) + padding;
  const svgWidth = svgMaxX - svgMinX;
  const svgHeight = svgMaxY - svgMinY;
  
  return (
    <div style={{
      position: 'absolute',
      left: `${svgMinX}px`,
      top: `${svgMinY}px`,
      width: `${svgWidth}px`,
      height: `${svgHeight}px`,
      pointerEvents: 'none',
    }}>
      <svg
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        style={{
          overflow: 'visible',
          pointerEvents: 'auto',
        }}
      >
        {/* Main line */}
        <line
          x1={lineStartX - svgMinX}
          y1={lineStartY - svgMinY}
          x2={lineEndX - svgMinX}
          y2={lineEndY - svgMinY}
          stroke={stroke || lineColor}
          strokeWidth={actualStrokeWidth}
          strokeLinecap="round"
        />
        
        {/* Start cap */}
        {renderLineCap(startCap, relStartX - svgMinX, relStartY - svgMinY, angleToEnd, lineColor, capSize)}
        
        {/* End cap */}
        {renderLineCap(endCap, relEndX - svgMinX, relEndY - svgMinY, angleToStart, lineColor, capSize)}
      </svg>
    </div>
  );
}
