"use client";

import type { DiagramNodeData, DiagramGroupData, DiagramConnectionData } from "@/lib/types";
import React from "react";

const NODE_WIDTH = 104;
const NODE_HEIGHT = 100;

type Positionable = (DiagramNodeData | DiagramGroupData) & { x: number; y: number; width: number; height: number; };

interface BezierConnectionProps {
  from: Positionable & { lineColor?: string };
  to: Positionable & { lineColor?: string };
  connectionColor?: string; // Specific color for this connection
  connectionData?: DiagramConnectionData; // Full connection data including text
  onClick?: (connection: DiagramConnectionData) => void; // Click handler
}

interface BezierConnectionTextProps {
  connectionData?: DiagramConnectionData;
  from?: Positionable & { lineColor?: string };
  to?: Positionable & { lineColor?: string };
  connectionColor?: string;
}

function getConnectionPoint(obj: any, width: number, height: number, point: 'top' | 'bottom' | 'left' | 'right' | 'center'): { x: number; y: number } {
  const centerX = obj.x + width / 2;
  const centerY = obj.y + height / 2;

  switch (point) {
    case 'top':
      return { x: centerX, y: obj.y };
    case 'bottom':
      return { x: centerX, y: obj.y + height };
    case 'left':
      return { x: obj.x, y: centerY };
    case 'right':
      return { x: obj.x + width, y: centerY };
    case 'center':
      return { x: centerX, y: centerY };
    default:
      return { x: centerX, y: centerY };
  }
}

function getExitAngle(exitPoint: 'top' | 'bottom' | 'left' | 'right' | 'center'): number {
  switch (exitPoint) {
    case 'top': return 0;
    case 'right': return 90;
    case 'bottom': return 180;
    case 'left': return 270;
    case 'center': return 0; // Default to 0 for center
    default: return 0;
  }
}

function getOptimalConnectionPoints(from: any, to: any, fromWidth: number, fromHeight: number, toWidth: number, toHeight: number, connectionData?: DiagramConnectionData): { fromX: number; fromY: number; toX: number; toY: number; fromAngle: number; toAngle: number } {
  // Use specified connection points if provided
  if (connectionData?.fromPreferredExit && connectionData?.toPreferredEntry) {
    const fromPoint = getConnectionPoint(from, fromWidth, fromHeight, connectionData.fromPreferredExit);
    const toPoint = getConnectionPoint(to, toWidth, toHeight, connectionData.toPreferredEntry);
    const fromAngle = getExitAngle(connectionData.fromPreferredExit);
    const toAngle = getExitAngle(connectionData.toPreferredEntry);
    return { fromX: fromPoint.x, fromY: fromPoint.y, toX: toPoint.x, toY: toPoint.y, fromAngle, toAngle };
  }

  // Auto-determine optimal connection points
  const fromCenterX = from.x + fromWidth / 2;
  const fromCenterY = from.y + fromHeight / 2;
  const toCenterX = to.x + toWidth / 2;
  const toCenterY = to.y + toHeight / 2;

  const dx = toCenterX - fromCenterX;
  const dy = toCenterY - fromCenterY;

  // Determine primary direction
  const isHorizontal = Math.abs(dx) > Math.abs(dy);
  
  let fromPoint: 'top' | 'bottom' | 'left' | 'right' | 'center';
  let toPoint: 'top' | 'bottom' | 'left' | 'right' | 'center';

  if (isHorizontal) {
    // Horizontal connection
    fromPoint = dx > 0 ? 'right' : 'left';
    toPoint = dx > 0 ? 'left' : 'right';
  } else {
    // Vertical connection
    fromPoint = dy > 0 ? 'bottom' : 'top';
    toPoint = dy > 0 ? 'top' : 'bottom';
  }

  // Check for special cases (groups/zones)
  const isFromGroup = from.type === 'group' || from.subType === 'zone';
  const isToGroup = to.type === 'group' || to.subType === 'zone';

  // For groups/zones, prefer edge connections unless center is specified
  if (isFromGroup && !connectionData?.fromPreferredExit) {
    fromPoint = isHorizontal ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'bottom' : 'top');
  }
  if (isToGroup && !connectionData?.toPreferredEntry) {
    toPoint = isHorizontal ? (dx > 0 ? 'left' : 'right') : (dy > 0 ? 'top' : 'bottom');
  }

  const finalFromPoint = connectionData?.fromPreferredExit || fromPoint;
  const finalToPoint = connectionData?.toPreferredEntry || toPoint;
  
  const fromConnectionPoint = getConnectionPoint(from, fromWidth, fromHeight, finalFromPoint);
  const toConnectionPoint = getConnectionPoint(to, toWidth, toHeight, finalToPoint);
  
  const fromAngle = getExitAngle(finalFromPoint);
  const toAngle = getExitAngle(finalToPoint);

  return {
    fromX: fromConnectionPoint.x,
    fromY: fromConnectionPoint.y,
    toX: toConnectionPoint.x,
    toY: toConnectionPoint.y,
    fromAngle,
    toAngle
  };
}

function calculateBezierPath(fromX: number, fromY: number, toX: number, toY: number, curvature: number = 0.3, fromAngle: number = 0, toAngle: number = 0): string {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // Adjust curvature based on distance
  const adjustedCurvature = Math.min(curvature, distance / 4);
  
  // Calculate control points based on exit/entry angles
  const controlOffset = adjustedCurvature * distance;
  
  // Calculate control points that extend outward from exit/entry points
  let cp1X, cp1Y, cp2X, cp2Y;
  
  switch (fromAngle) {
    case 0: // Top - control point goes upward
      cp1X = fromX;
      cp1Y = fromY - controlOffset;
      break;
    case 90: // Right - control point goes rightward
      cp1X = fromX + controlOffset;
      cp1Y = fromY;
      break;
    case 180: // Bottom - control point goes downward
      cp1X = fromX;
      cp1Y = fromY + controlOffset;
      break;
    case 270: // Left - control point goes leftward
      cp1X = fromX - controlOffset;
      cp1Y = fromY;
      break;
    default:
      // Fallback to original logic
      cp1X = fromX + controlOffset;
      cp1Y = fromY;
  }
  
  switch (toAngle) {
    case 0: // Top - control point comes from above
      cp2X = toX;
      cp2Y = toY - controlOffset;
      break;
    case 90: // Right - control point comes from right
      cp2X = toX + controlOffset;
      cp2Y = toY;
      break;
    case 180: // Bottom - control point comes from below
      cp2X = toX;
      cp2Y = toY + controlOffset;
      break;
    case 270: // Left - control point comes from left
      cp2X = toX - controlOffset;
      cp2Y = toY;
      break;
    default:
      // Fallback to original logic
      cp2X = toX - controlOffset;
      cp2Y = toY;
  }
  
  return `M ${fromX} ${fromY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${toX} ${toY}`;
}

export function BezierConnection({ from, to, connectionColor, connectionData, onClick }: BezierConnectionProps) {
  const fromWidth = from.width || NODE_WIDTH;
  const fromHeight = from.height || NODE_HEIGHT;
  const toWidth = to.width || NODE_WIDTH;
  const toHeight = to.height || NODE_HEIGHT;

  const connectionPoints = getOptimalConnectionPoints(from, to, fromWidth, fromHeight, toWidth, toHeight, connectionData);
  const { fromX, fromY, toX, toY, fromAngle, toAngle } = connectionPoints;

  const curvature = connectionData?.curvature || 0.3;
  const pathData = calculateBezierPath(fromX, fromY, toX, toY, curvature, fromAngle, toAngle);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClick && connectionData) {
      onClick(connectionData);
    }
  };

  // Use connection color first, then 'to' node, fallback to 'from' node, then default
  const finalConnectionColor = connectionColor || to.lineColor || from.lineColor || '#6b7280';
  
  // Check for arrows
  const hasFromArrow = connectionData?.fromArrow === true;
  const hasToArrow = connectionData?.toArrow === true;
  const hasLegacyArrow = connectionData?.arrow === true; // Backward compatibility
  
  const showStartArrow = hasFromArrow;
  const showEndArrow = hasToArrow || hasLegacyArrow;
  
  const startMarkerId = showStartArrow ? `arrowhead-start-${from.id}-${to.id}` : undefined;
  const endMarkerId = showEndArrow ? `arrowhead-end-${from.id}-${to.id}` : undefined;

  return (
    <>
      {/* Define arrowhead markers */}
      <defs>
        {showStartArrow && (
          <marker
            id={startMarkerId}
            markerWidth="10"
            markerHeight="7"
            refX="1"
            refY="3.5"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <polygon
              points="10 0, 0 3.5, 10 7"
              fill={finalConnectionColor}
            />
          </marker>
        )}
        {showEndArrow && (
          <marker
            id={endMarkerId}
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <polygon
              points="0 0, 10 3.5, 0 7"
              fill={finalConnectionColor}
            />
          </marker>
        )}
      </defs>
      
      <g>
        <path
          d={pathData}
          stroke={finalConnectionColor}
          className="transition-all duration-300 cursor-pointer hover:stroke-opacity-80"
          strokeWidth="2.5"
          fill="none"
          onClick={handleClick}
          markerStart={showStartArrow ? `url(#${startMarkerId})` : undefined}
          markerEnd={showEndArrow ? `url(#${endMarkerId})` : undefined}
        />
      </g>
    </>
  );
}

// Helper function to calculate bezier curve point at parameter t (0 to 1)
function getBezierPoint(t: number, fromX: number, fromY: number, cp1X: number, cp1Y: number, cp2X: number, cp2Y: number, toX: number, toY: number): { x: number; y: number } {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;

  const x = uuu * fromX + 3 * uu * t * cp1X + 3 * u * tt * cp2X + ttt * toX;
  const y = uuu * fromY + 3 * uu * t * cp1Y + 3 * u * tt * cp2Y + ttt * toY;

  return { x, y };
}

// Helper function to render connection text separately
export function BezierConnectionText({ connectionData, from, to, connectionColor }: BezierConnectionTextProps) {
  if (!connectionData?.text) return null;

  // Calculate midpoint for text placement along the bezier curve
  let textX = 0, textY = 0;

  if (connectionData && from && to) {
    const fromWidth = from.width || NODE_WIDTH;
    const fromHeight = from.height || NODE_HEIGHT;
    const toWidth = to.width || NODE_WIDTH;
    const toHeight = to.height || NODE_HEIGHT;

    const connectionPoints = getOptimalConnectionPoints(from, to, fromWidth, fromHeight, toWidth, toHeight, connectionData);
    const { fromX, fromY, toX, toY, fromAngle, toAngle } = connectionPoints;

    const curvature = connectionData?.curvature || 0.3;
    const dx = toX - fromX;
    const dy = toY - fromY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const adjustedCurvature = Math.min(curvature, distance / 4);
    const controlOffset = adjustedCurvature * distance;

    // Calculate control points based on exit/entry angles
    let cp1X, cp1Y, cp2X, cp2Y;
    
    switch (fromAngle) {
      case 0: // Top
        cp1X = fromX;
        cp1Y = fromY - controlOffset;
        break;
      case 90: // Right
        cp1X = fromX + controlOffset;
        cp1Y = fromY;
        break;
      case 180: // Bottom
        cp1X = fromX;
        cp1Y = fromY + controlOffset;
        break;
      case 270: // Left
        cp1X = fromX - controlOffset;
        cp1Y = fromY;
        break;
      default:
        cp1X = fromX + controlOffset;
        cp1Y = fromY;
    }
    
    switch (toAngle) {
      case 0: // Top
        cp2X = toX;
        cp2Y = toY - controlOffset;
        break;
      case 90: // Right
        cp2X = toX + controlOffset;
        cp2Y = toY;
        break;
      case 180: // Bottom
        cp2X = toX;
        cp2Y = toY + controlOffset;
        break;
      case 270: // Left
        cp2X = toX - controlOffset;
        cp2Y = toY;
        break;
      default:
        cp2X = toX - controlOffset;
        cp2Y = toY;
    }

    // Get the actual point on the bezier curve at the specified text position
    const textPositionPercent = connectionData.textPosition || 50; // Default to 50%
    const t = textPositionPercent / 100; // Convert percentage to 0-1 range
    const textPoint = getBezierPoint(t, fromX, fromY, cp1X, cp1Y, cp2X, cp2Y, toX, toY);
    textX = textPoint.x;
    textY = textPoint.y;
  }

  // Use connection color first, then 'to' node, fallback to 'from' node, then default
  const finalConnectionColor = connectionColor || to?.lineColor || from?.lineColor || '#6b7280';

  const text = connectionData.text;
  const shouldSplit = text.length > 4;
  const lines = shouldSplit ? [text.slice(0, Math.ceil(text.length / 2)), text.slice(Math.ceil(text.length / 2))] : [text];
  const lineHeight = 14;
  const startY = textY - ((lines.length - 1) * lineHeight) / 2;

  return lines.map((line, index) => (
    <text
      key={index}
      x={textX}
      y={startY + (index * lineHeight)}
      fill={finalConnectionColor}
      fontSize="12"
      fontWeight="500"
      textAnchor="middle"
      dominantBaseline="middle"
      className="pointer-events-none select-none"
      style={{
        textShadow: '0 0 3px rgba(255,255,255,1), 0 0 6px rgba(255,255,255,0.8), 1px 1px 4px rgba(255,255,255,1), -1px -1px 4px rgba(255,255,255,1), 1px -1px 4px rgba(255,255,255,1), -1px 1px 4px rgba(255,255,255,1)'
      }}
    >
      {line}
    </text>
  ));
}