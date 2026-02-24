"use client";

import React from "react";
import type { DiagramNodeData } from "@/lib/types";
import { extractTextStylingFromNode } from "@/lib/text-styling";

interface LineShapeProps {
  node: DiagramNodeData & { width?: number; height?: number };
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  onClick?: (e: React.MouseEvent, node: DiagramNodeData) => void;
  onContextMenu?: (e: React.MouseEvent, node: DiagramNodeData) => void;
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

export function LineShape({ node, fill = "#000000", stroke, strokeWidth = 2.5, onClick, onContextMenu }: LineShapeProps) {
  // Get absolute positions (required for lines)
  // Use local positions if available (for smooth dragging), otherwise use node positions
  const startPos = (node as any).__localStartPos || node.startPos || { x: (node.x || 0), y: (node.y || 0) };
  const endPos = (node as any).__localEndPos || node.endPos || { x: (node.x || 0) + 150, y: (node.y || 0) };
  
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
  const lineAngleRad = Math.atan2(dy, dx);
  // Keep text upright for right-to-left lines (angle ~180° would flip text upside down)
  const absAngle = Math.abs(angleToEnd);
  const wouldFlipUpsideDown = absAngle > 90 && absAngle < 270;
  const textRotation = (node as any).lineTextHorizontal === true || wouldFlipUpsideDown
    ? 0
    : angleToEnd;
  
  // Line caps
  const startCap = node.startCap || 'none';
  const endCap = node.endCap || 'none';
  
  // Use node's lineColor or default to grey
  const lineColor = node.lineColor || '#6b7280';
  const actualStrokeWidth = node.lineThickness || strokeWidth;
  
  // Line type - determine strokeDasharray based on lineType
  const lineType = (node as any).lineType || 'solid';
  let strokeDasharray: string | undefined;
  if (lineType === 'dashed') {
    // Dashed line: longer dashes with gaps
    strokeDasharray = `${actualStrokeWidth * 4} ${actualStrokeWidth * 2}`;
  } else if (lineType === 'dotted') {
    // Dotted line: small dots with gaps
    strokeDasharray = `0 ${actualStrokeWidth * 2}`;
  }
  
  // Get text styling from node
  const textStyling = extractTextStylingFromNode(node);
  const textColor = textStyling.textColor || lineColor;
  const fontSize = textStyling.fontSize || 12;
  const fontWeight = textStyling.fontWeight || '500';
  const fontFamily = textStyling.fontFamily || 'Inter, system-ui, sans-serif';
  const fontStyle = textStyling.fontStyle || 'normal';
  const letterSpacing = textStyling.letterSpacing || 0;
  const textOpacity = textStyling.textOpacity !== undefined ? textStyling.textOpacity : 1;
  
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
  
  // Calculate padding and SVG dimensions (include space for text)
  const padding = capSize * 3;
  const textPadding = node.label ? 30 : 0; // Extra padding for text
  const svgMinX = Math.min(relStartX, relEndX) - padding - textPadding;
  const svgMinY = Math.min(relStartY, relEndY) - padding - textPadding;
  const svgMaxX = Math.max(relStartX, relEndX) + padding + textPadding;
  const svgMaxY = Math.max(relStartY, relEndY) + padding + textPadding;
  const svgWidth = svgMaxX - svgMinX;
  const svgHeight = svgMaxY - svgMinY;
  
  // Calculate text position along the line
  const textPositionPercent = (node as any).lineTextPosition || 50; // 0-100, default 50% (middle)
  const t = textPositionPercent / 100;
  const textX = lineStartX + (lineEndX - lineStartX) * t;
  const textY = lineStartY + (lineEndY - lineStartY) * t;
  
  // Text position mode: 'above', 'below', or 'middle' (default)
  const textPosition = (node as any).lineTextVerticalPosition || 'middle';
  // Calculate offset based on font size - scale with font but keep it closer for large fonts
  const baseOffset = fontSize * 0.8; // 0.8x font size for closer spacing, especially for large fonts
  const textOffset = textPosition === 'above' ? -baseOffset : textPosition === 'below' ? baseOffset : 0;
  
  // Calculate perpendicular offset for text above/below
  const perpAngleRad = lineAngleRad + Math.PI / 2;
  const textOffsetX = Math.cos(perpAngleRad) * textOffset;
  const textOffsetY = Math.sin(perpAngleRad) * textOffset;
  
  const finalTextX = textX + textOffsetX;
  const finalTextY = textY + textOffsetY;
  
  // Process text (split by newlines and handle long lines)
  const label = node.label || '';
  const explicitLines = label.split('\n');
  const textLines: string[] = [];
  
  explicitLines.forEach(line => {
    if (line.length > 15) {
      const words = line.split(' ');
      let currentLine = '';
      words.forEach(word => {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (testLine.length <= 15) {
          currentLine = testLine;
        } else {
          if (currentLine) textLines.push(currentLine);
          currentLine = word;
        }
      });
      if (currentLine) textLines.push(currentLine);
    } else {
      textLines.push(line);
    }
  });
  
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
          pointerEvents: 'none', // Make SVG background non-clickable
        }}
      >
        {/* Invisible wider hit area for easier clicking - must be first so it's behind the visible line */}
        <line
          x1={lineStartX - svgMinX}
          y1={lineStartY - svgMinY}
          x2={lineEndX - svgMinX}
          y2={lineEndY - svgMinY}
          stroke="transparent"
          strokeWidth={Math.max(20, actualStrokeWidth * 3)} // Wider hit area (min 20px)
          strokeLinecap="round"
          style={{ pointerEvents: 'stroke', cursor: 'pointer' }} // Only stroke is clickable
          onClick={(e) => {
            e.stopPropagation();
            onClick?.(e as any, node);
          }}
          onContextMenu={(e) => {
            e.stopPropagation();
            onContextMenu?.(e as any, node);
          }}
        />
        {/* Main line */}
        <line
          x1={lineStartX - svgMinX}
          y1={lineStartY - svgMinY}
          x2={lineEndX - svgMinX}
          y2={lineEndY - svgMinY}
          stroke={stroke || lineColor}
          strokeWidth={actualStrokeWidth}
          strokeLinecap="round"
          strokeDasharray={strokeDasharray}
          style={{ pointerEvents: 'none' }} // Visual line is not clickable (hit area above handles it)
        />
        
        {/* Start cap - points outward from start (backward, away from line) */}
        {renderLineCap(startCap, relStartX - svgMinX, relStartY - svgMinY, angleToStart, lineColor, capSize)}
        
        {/* End cap - points outward from end (forward, continuing line direction) */}
        {renderLineCap(endCap, relEndX - svgMinX, relEndY - svgMinY, angleToEnd, lineColor, capSize)}
        
        {/* Text label */}
        {label && textLines.length > 0 && (
          <g transform={`translate(${finalTextX - svgMinX}, ${finalTextY - svgMinY}) rotate(${textRotation})`}>
            {textLines.map((line, index) => {
              const lineHeightValue = textStyling.lineHeight || 1.4;
              const lineHeightPx = fontSize * lineHeightValue;
              const startY = -((textLines.length - 1) * lineHeightPx) / 2;
              
              // Apply text transform if specified
              let displayText = line;
              if (textStyling.textTransform === 'uppercase') {
                displayText = line.toUpperCase();
              } else if (textStyling.textTransform === 'lowercase') {
                displayText = line.toLowerCase();
              } else if (textStyling.textTransform === 'capitalize') {
                displayText = line.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
              }
              
              return (
                <text
                  key={index}
                  x={0}
                  y={startY + (index * lineHeightPx)}
                  fill={textColor}
                  fontSize={fontSize}
                  fontWeight={fontWeight}
                  fontFamily={fontFamily}
                  fontStyle={fontStyle}
                  letterSpacing={letterSpacing ? `${letterSpacing}px` : undefined}
                  opacity={textOpacity}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="pointer-events-none select-none"
                  style={{
                    textShadow: '0 0 3px rgba(255,255,255,1), 0 0 6px rgba(255,255,255,0.8), 1px 1px 4px rgba(255,255,255,1), -1px -1px 4px rgba(255,255,255,1), 1px -1px 4px rgba(255,255,255,1), -1px 1px 4px rgba(255,255,255,1)',
                    textDecoration: textStyling.textDecoration === 'underline' ? 'underline' : 
                                   textStyling.textDecoration === 'line-through' ? 'line-through' :
                                   textStyling.textDecoration === 'overline' ? 'overline' : 'none'
                  }}
                >
                  {displayText}
                </text>
              );
            })}
          </g>
        )}
      </svg>
    </div>
  );
}
