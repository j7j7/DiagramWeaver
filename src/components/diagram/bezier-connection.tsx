"use client";

import type { DiagramNodeData, DiagramGroupData, DiagramConnectionData } from "@/lib/types";
import React from "react";

const NODE_WIDTH = 80;
const NODE_HEIGHT = 80;
const BASE_NODE_HEIGHT = 80;
const TEXT_NODE_HEIGHT = 40;
const EXTRA_LINE_HEIGHT = 20;

// Helper function to calculate dynamic height based on label length and node type
const calculateNodeHeight = (label: string = '', nodeType: string, sizeMode?: string, customHeight?: number) => {
  // Use custom height if sizeMode is 'custom' and customHeight is provided
  if (sizeMode === 'custom' && customHeight) {
    return customHeight;
  }
  
  // Handle larger multi-line text boxes
  if (nodeType === 'generic.text.textbox') {
    const maxCharsPerLine = 30; // More characters fit in wider textbox
    const lines = Math.max(1, Math.ceil(label.length / maxCharsPerLine)); // Minimum 1 line
    return 40 + ((lines - 1) * EXTRA_LINE_HEIGHT); // Start with 40px height
  } else if (nodeType === 'generic.text.text') {
    const maxCharsPerLine = 20; // More characters fit in text-only nodes
    const lines = Math.ceil(label.length / maxCharsPerLine);
    return TEXT_NODE_HEIGHT + ((lines - 1) * EXTRA_LINE_HEIGHT);
  } else {
    const maxCharsPerLine = 12; // Approximate characters that fit in node width
    const lines = Math.ceil(label.length / maxCharsPerLine);
    return BASE_NODE_HEIGHT + ((lines - 1) * EXTRA_LINE_HEIGHT);
  }
};

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

function getConnectionPoint(obj: any, width: number, height: number, point: 'top' | 'bottom' | 'left' | 'right' | 'center', iconHeight?: number): { x: number; y: number } {
  const centerX = obj.x + width / 2;
  // Use icon height for Y center calculation if provided (for nodes with text labels)
  // This ensures connections attach to the icon center, not the overall node center
  const centerY = iconHeight ? obj.y + iconHeight / 2 : obj.y + height / 2;
  
  // For groups/zones, always use full height for edge center calculations
  const isGroup = obj.type === 'group' || obj.subType === 'zone';
  const edgeCenterY = isGroup ? obj.y + height / 2 : centerY;
  
  // For groups/zones, add 4px offset outward from the edge (applies to both auto-fit and custom size)
  const edgeOffset = isGroup ? 4 : 0;

  switch (point) {
    case 'top':
      // For top edge, always use horizontal center and top Y
      // For groups/zones, offset 4px upward (outward)
      return { x: centerX, y: obj.y - edgeOffset };
    case 'bottom':
      // For bottom edge, always use horizontal center and bottom Y
      // For groups/zones, use full height and offset 4px downward (outward)
      const bottomY = isGroup ? obj.y + height : (iconHeight ? obj.y + iconHeight : obj.y + height);
      return { x: centerX, y: bottomY + edgeOffset };
    case 'left':
      // For left edge, always use left X and vertical center
      // For groups/zones, use full height center and offset 4px leftward (outward)
      return { x: obj.x - edgeOffset, y: edgeCenterY };
    case 'right':
      // For right edge, always use right X and vertical center
      // For groups/zones, use full height center and offset 4px rightward (outward)
      return { x: obj.x + width + edgeOffset, y: edgeCenterY };
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

function getOptimalConnectionPoints(from: any, to: any, fromWidth: number, fromHeight: number, toWidth: number, toHeight: number, connectionData?: DiagramConnectionData, fromIconHeight?: number, toIconHeight?: number): { fromX: number; fromY: number; toX: number; toY: number; fromAngle: number; toAngle: number } {
  // Use specified connection points if provided
  if (connectionData?.fromPreferredExit && connectionData?.toPreferredEntry) {
    const fromPoint = getConnectionPoint(from, fromWidth, fromHeight, connectionData.fromPreferredExit, fromIconHeight);
    const toPoint = getConnectionPoint(to, toWidth, toHeight, connectionData.toPreferredEntry, toIconHeight);
    const fromAngle = getExitAngle(connectionData.fromPreferredExit);
    const toAngle = getExitAngle(connectionData.toPreferredEntry);
    return { fromX: fromPoint.x, fromY: fromPoint.y, toX: toPoint.x, toY: toPoint.y, fromAngle, toAngle };
  }

  // Auto-determine optimal connection points
  // Use icon height for center calculation if provided (for nodes with text labels)
  const fromCenterX = from.x + fromWidth / 2;
  const fromCenterY = fromIconHeight ? from.y + fromIconHeight / 2 : from.y + fromHeight / 2;
  const toCenterX = to.x + toWidth / 2;
  const toCenterY = toIconHeight ? to.y + toIconHeight / 2 : to.y + toHeight / 2;

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

  // For groups/zones, ALWAYS use edge connections (never center) unless explicitly overridden with a non-center point
  if (isFromGroup) {
    // Only use preferred exit if it's explicitly set AND it's not 'center'
    if (connectionData?.fromPreferredExit && connectionData.fromPreferredExit !== 'center') {
      fromPoint = connectionData.fromPreferredExit;
    } else {
      // Force edge connection based on direction
      fromPoint = isHorizontal ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'bottom' : 'top');
    }
  }
  
  if (isToGroup) {
    // Only use preferred entry if it's explicitly set AND it's not 'center'
    if (connectionData?.toPreferredEntry && connectionData.toPreferredEntry !== 'center') {
      toPoint = connectionData.toPreferredEntry;
    } else {
      // Force edge connection based on direction
      toPoint = isHorizontal ? (dx > 0 ? 'left' : 'right') : (dy > 0 ? 'top' : 'bottom');
    }
  }

  const finalFromPoint = connectionData?.fromPreferredExit || fromPoint;
  const finalToPoint = connectionData?.toPreferredEntry || toPoint;
  
  // Final safety check: never allow 'center' for groups/zones
  const safeFromPoint = (isFromGroup && finalFromPoint === 'center') 
    ? (isHorizontal ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'bottom' : 'top'))
    : finalFromPoint;
  const safeToPoint = (isToGroup && finalToPoint === 'center')
    ? (isHorizontal ? (dx > 0 ? 'left' : 'right') : (dy > 0 ? 'top' : 'bottom'))
    : finalToPoint;
  
  const fromConnectionPoint = getConnectionPoint(from, fromWidth, fromHeight, safeFromPoint, fromIconHeight);
  const toConnectionPoint = getConnectionPoint(to, toWidth, toHeight, safeToPoint, toIconHeight);
  
  const fromAngle = getExitAngle(safeFromPoint);
  const toAngle = getExitAngle(safeToPoint);

  return {
    fromX: fromConnectionPoint.x,
    fromY: fromConnectionPoint.y,
    toX: toConnectionPoint.x,
    toY: toConnectionPoint.y,
    fromAngle,
    toAngle
  };
}

function calculateBezierPath(fromX: number, fromY: number, toX: number, toY: number, curvature: number = 0.6, fromAngle: number = 0, toAngle: number = 0): string {
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
  // Use measureNodeDims-like logic for shapes to get actual dimensions
  const isFromShape = (from.type === 'generic.object.square' || from.type === 'generic.object.circle' || 
                        from.type === 'generic.object.point' || from.type === 'generic.object.rectangle' || from.type === 'generic.object.triangle' ||
                        from.type === 'generic.object.star' || from.type === 'generic.object.cloud' ||
                        from.type?.endsWith('.square') || from.type?.endsWith('.circle') ||
                        from.type?.endsWith('.point') || from.type?.endsWith('.rectangle') || from.type?.endsWith('.triangle') ||
                        from.type?.endsWith('.star') || from.type?.endsWith('.cloud'));
  const isToShape = (to.type === 'generic.object.square' || to.type === 'generic.object.circle' || 
                     to.type === 'generic.object.point' || to.type === 'generic.object.rectangle' || to.type === 'generic.object.triangle' ||
                     to.type === 'generic.object.star' || to.type === 'generic.object.cloud' ||
                     to.type?.endsWith('.square') || to.type?.endsWith('.circle') ||
                     to.type?.endsWith('.point') || to.type?.endsWith('.rectangle') || to.type?.endsWith('.triangle') ||
                     to.type?.endsWith('.star') || to.type?.endsWith('.cloud'));
  
  // Calculate dynamic heights for text nodes to account for multi-line text
  const fromCalculatedHeight = calculateNodeHeight(from.label || '', from.type, from.sizeMode, from.height);
  const toCalculatedHeight = calculateNodeHeight(to.label || '', to.type, to.sizeMode, to.height);
  
  // For shapes with text underneath, add extra space for the text
  let fromTextUnderHeight = 20;
  let toTextUnderHeight = 0;
  
  if (isFromShape && from.label && (from.textPosition === 'under' || !from.textPosition)) {
    const maxCharsPerLine = 16;
    const lines = Math.ceil(from.label.length / maxCharsPerLine);
    fromTextUnderHeight = lines * 20; // Approximate line height for shape labels
  }
  
  if (isToShape && to.label && (to.textPosition === 'under' || !to.textPosition)) {
    const maxCharsPerLine = 16;
    const lines = Math.ceil(to.label.length / maxCharsPerLine);
    toTextUnderHeight = lines * 20; // Approximate line height for shape labels
  }
  
  // For regular resource nodes with labels (not text/label/textbox nodes), add space for the label text
  const isFromTextType = from.type === 'generic.text.text'  || 
                          from.type === 'generic.text.textbox';
  const isToTextType = to.type === 'generic.text.text'  || 
                         to.type === 'generic.text.textbox';
  
  if (!isFromShape && !isFromTextType && from.label && from.label.trim().length > 0) {
    const maxCharsPerLine = 16;
    const lines = Math.ceil(from.label.length / maxCharsPerLine);
    fromTextUnderHeight = 20 + ((lines - 1) * 8); // First line: 20px, then +15px for each additional line
  }
  
  if (!isToShape && !isToTextType && to.label && to.label.trim().length > 0) {
    const maxCharsPerLine = 16;
    const lines = Math.ceil(to.label.length / maxCharsPerLine);
    toTextUnderHeight = 20 + ((lines - 1) * 8); // First line: 20px, then +15px for each additional line
  }
  
  // Check if nodes are groups/zones (should use full height, not icon height)
  const isFromGroup = from.type === 'group' || from.subType === 'zone';
  const isToGroup = to.type === 'group' || to.subType === 'zone';
  
  // For groups/zones, ensure we use the calculated width/height (important for auto-fit groups)
  // For auto-fit groups, width/height should be calculated and set, but fallback to defaults if not
  const fromWidth = isFromGroup 
    ? (from.width || 300)  // Use calculated width for groups/zones, fallback to 300
    : (isFromShape && from.width ? from.width : (from.width || NODE_WIDTH));
  const fromHeight = isFromGroup
    ? (from.height || 220)  // Use calculated height for groups/zones, fallback to 220
    : (isFromShape && from.height ? from.height : (fromCalculatedHeight + fromTextUnderHeight));
  const toWidth = isToGroup
    ? (to.width || 300)  // Use calculated width for groups/zones, fallback to 300
    : (isToShape && to.width ? to.width : (to.width || NODE_WIDTH));
  const toHeight = isToGroup
    ? (to.height || 220)  // Use calculated height for groups/zones, fallback to 220
    : (isToShape && to.height ? to.height : (toCalculatedHeight + toTextUnderHeight));
  
  // Calculate icon-only heights (excluding text labels) for connection point calculations
  // This ensures connections attach to the icon center, not the overall node center
  // BUT: Groups/zones should use full height, not icon height
  let fromIconHeight: number | undefined;
  let toIconHeight: number | undefined;
  
  if (!isFromGroup) {
    if (isFromShape) {
      // For shapes, use the shape size (48px) or custom height if set
      fromIconHeight = from.height || 48;
    } else if (isFromTextType) {
      // For text nodes, use the full calculated height (no separate icon)
      fromIconHeight = fromCalculatedHeight;
    } else {
      // For regular resource nodes, use BASE_NODE_HEIGHT (icon only, ignore text)
      fromIconHeight = BASE_NODE_HEIGHT;
    }
  }
  // If isFromGroup, fromIconHeight remains undefined, so full height will be used
  
  if (!isToGroup) {
    if (isToShape) {
      // For shapes, use the shape size (48px) or custom height if set
      toIconHeight = to.height || 48;
    } else if (isToTextType) {
      // For text nodes, use the full calculated height (no separate icon)
      toIconHeight = toCalculatedHeight;
    } else {
      // For regular resource nodes, use BASE_NODE_HEIGHT (icon only, ignore text)
      toIconHeight = BASE_NODE_HEIGHT;
    }
  }
  // If isToGroup, toIconHeight remains undefined, so full height will be used

  // Use icon-only heights for connection point calculations (undefined for groups/zones = use full height)
  // Pass full heights for width calculations, but icon heights for Y positioning
  const connectionPoints = getOptimalConnectionPoints(from, to, fromWidth, fromHeight, toWidth, toHeight, connectionData, fromIconHeight, toIconHeight);
  const { fromX, fromY, toX, toY, fromAngle, toAngle } = connectionPoints;

  const curvature = connectionData?.curvature || 0.6;
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
  const hasShadow = connectionData?.shadow || false;
  const shadowFilterId = hasShadow ? `shadow-filter-${from.id}-${to.id}` : undefined;

  return (
    <>
      {/* Define arrowhead markers and shadow filter */}
      <defs>
        {hasShadow && (
          <filter id={shadowFilterId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
            <feOffset dx="0" dy="2" result="offsetblur"/>
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.3"/>
            </feComponentTransfer>
            <feMerge> 
              <feMergeNode/>
              <feMergeNode in="SourceGraphic"/> 
            </feMerge>
          </filter>
        )}
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
          strokeWidth={connectionData?.lineWidth || 2.5}
          fill="none"
          onClick={handleClick}
          markerStart={showStartArrow ? `url(#${startMarkerId})` : undefined}
          markerEnd={showEndArrow ? `url(#${endMarkerId})` : undefined}
          filter={hasShadow ? `url(#${shadowFilterId})` : undefined}
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
    // Check if nodes are groups/zones (should use full height, not icon height)
    const isFromGroup = from.type === 'group' || from.subType === 'zone';
    const isToGroup = to.type === 'group' || to.subType === 'zone';
    
    // For groups/zones, ensure we use the calculated width/height (important for auto-fit groups)
    const fromWidth = isFromGroup ? (from.width || 300) : (from.width || NODE_WIDTH);
    const fromHeight = isFromGroup ? (from.height || 220) : (from.height || NODE_HEIGHT);
    const toWidth = isToGroup ? (to.width || 300) : (to.width || NODE_WIDTH);
    const toHeight = isToGroup ? (to.height || 220) : (to.height || NODE_HEIGHT);
    
    // Calculate icon-only heights for connection text positioning (same logic as main connection)
    // BUT: Groups/zones should use full height, not icon height
    const isFromShape = (from.type === 'generic.object.square' || from.type === 'generic.object.circle' || 
                          from.type === 'generic.object.point' || from.type === 'generic.object.rectangle' || from.type === 'generic.object.triangle' ||
                          from.type === 'generic.object.star' || from.type === 'generic.object.cloud' ||
                          from.type?.endsWith('.square') || from.type?.endsWith('.circle') ||
                          from.type?.endsWith('.point') || from.type?.endsWith('.rectangle') || from.type?.endsWith('.triangle') ||
                          from.type?.endsWith('.star') || from.type?.endsWith('.cloud'));
    const isToShape = (to.type === 'generic.object.square' || to.type === 'generic.object.circle' || 
                       to.type === 'generic.object.point' || to.type === 'generic.object.rectangle' || to.type === 'generic.object.triangle' ||
                       to.type === 'generic.object.star' || to.type === 'generic.object.cloud' ||
                       to.type?.endsWith('.square') || to.type?.endsWith('.circle') ||
                       to.type?.endsWith('.point') || to.type?.endsWith('.rectangle') || to.type?.endsWith('.triangle') ||
                       to.type?.endsWith('.star') || to.type?.endsWith('.cloud'));
    const isFromTextType = from.type === 'generic.text.text' || from.type === 'generic.text.textbox';
    const isToTextType = to.type === 'generic.text.text' || to.type === 'generic.text.textbox';
    
    let fromIconHeight: number | undefined;
    let toIconHeight: number | undefined;
    
    if (!isFromGroup) {
      fromIconHeight = isFromShape ? (from.height || 48) : (isFromTextType ? fromHeight : BASE_NODE_HEIGHT);
    }
    // If isFromGroup, fromIconHeight remains undefined, so full height will be used
    
    if (!isToGroup) {
      toIconHeight = isToShape ? (to.height || 48) : (isToTextType ? toHeight : BASE_NODE_HEIGHT);
    }
    // If isToGroup, toIconHeight remains undefined, so full height will be used
    
    const connectionPoints = getOptimalConnectionPoints(from, to, fromWidth, fromHeight, toWidth, toHeight, connectionData, fromIconHeight, toIconHeight);
    const { fromX, fromY, toX, toY, fromAngle, toAngle } = connectionPoints;

    const curvature = connectionData?.curvature || 0.6;
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
  
  // Split text by explicit line breaks (\n) and also handle long text
  const explicitLines = text.split('\n');
  const lines: string[] = [];
  
  explicitLines.forEach(line => {
    if (line.length > 15) {
      // For long lines without explicit breaks, split at word boundaries
      const words = line.split(' ');
      let currentLine = '';
      
      words.forEach(word => {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (testLine.length <= 15) {
          currentLine = testLine;
        } else {
          if (currentLine) {
            lines.push(currentLine);
          }
          currentLine = word;
        }
      });
      
      if (currentLine) {
        lines.push(currentLine);
      }
    } else {
      lines.push(line);
    }
  });
  
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