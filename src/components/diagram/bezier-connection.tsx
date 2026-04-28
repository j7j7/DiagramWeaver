"use client";

import type { DiagramNodeData, DiagramGroupData, DiagramConnectionData } from "@/lib/types";
import React from "react";
import { useTheme } from "@/components/theme-provider";
import { measureNodeDims } from "@/components/editor/canvas-constants";
import { isIconOrEmojiType, isShapeNodeType, isGenericObjectOrChartShapeType } from "@/lib/utils";
import { getNodeSizeDimensions } from "@/lib/visual-styling";
import { getShapeEdgeBounds, shapeEdgeToPoint, isKiteShapeType, getKiteConnectionPoint } from "@/lib/shape-connection-bounds";
import { clampConnectionAnimation } from "@/lib/connection-animation";
import { buildRibbonPolygonPath } from "@/lib/connection-ribbon-path";
import {
  resolveConnectionWidths,
  connectionNeedsAdvancedLineStyle,
  maxResolvedLineWidth,
  lineWidthAtPathFraction,
  scaleValuesForAnimationKeyPoints,
  CONNECTION_ANIMATION_SPACING_REF_LINE_PX,
  connectionAdvancedStyleRevisionKeyResolved,
  resolveBezierConnectionPaint,
  connectionGradientIdSuffix,
  isUseSourceLineColorOn,
} from "@/lib/connection-line-style";
import { connectionStrokeDashFromLineType } from "@/lib/utils";

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
  
  // Plain text + textbox: same wrap height model
  if (nodeType === 'generic.text.textbox' || nodeType === 'generic.text.text') {
    const maxCharsPerLine = 30;
    const lines = Math.max(1, Math.ceil(label.length / maxCharsPerLine));
    return TEXT_NODE_HEIGHT + ((lines - 1) * EXTRA_LINE_HEIGHT);
  } else {
    const maxCharsPerLine = 12; // Approximate characters that fit in node width
    const lines = Math.ceil(label.length / maxCharsPerLine);
    return BASE_NODE_HEIGHT + ((lines - 1) * EXTRA_LINE_HEIGHT);
  }
};

export type Positionable = (DiagramNodeData | DiagramGroupData) & { x: number; y: number; width: number; height: number; subType?: string; };

interface BezierConnectionProps {
  from: Positionable & { lineColor?: string };
  to: Positionable & { lineColor?: string };
  connectionColor?: string; // Specific color for this connection
  connectionData?: DiagramConnectionData; // Full connection data including text
  exportAnimationTimeSeconds?: number | null;
  animationConnectionsEnabled?: boolean; // When false, hide all animation shapes
  onClick?: (connection: DiagramConnectionData, event: React.MouseEvent) => void; // Click handler
  onDoubleClick?: (connection: DiagramConnectionData, event: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent, connection: DiagramConnectionData) => void;
  /** Opacity/transform for slide/layer transitions — applied to path group only, not defs (gradients stay aligned). */
  slideTransitionStyle?: React.CSSProperties;
}

function positionableKey(p: BezierConnectionProps['from']): string {
  const a = p as any;
  return `${p?.id ?? ''}|${p?.x ?? ''}|${p?.y ?? ''}|${p?.width ?? ''}|${p?.height ?? ''}|${p?.type ?? ''}|${a?.label ?? ''}|${a?.lineColor ?? ''}|${a?.borderColor ?? ''}|${a?.borderStyle ?? ''}|${a?.borderColors?.join?.(',') ?? ''}|${a?.iconColor ?? ''}|${a?.color ?? ''}|${a?.nodeSize ?? ''}|${a?.sizeMode ?? ''}|${a?.textPosition ?? ''}|${a?.textVerticalPosition ?? ''}|${a?.subType ?? ''}`;
}

function connectionDataKey(c?: DiagramConnectionData): string {
  if (!c) return '';
  const wp = c.waypoints?.map((w) => `${w.x},${w.y}`).join(';') ?? '';
  const anim = c.animation ? JSON.stringify(c.animation) : '';
  return `${c.from ?? ''}|${c.to ?? ''}|${(c as any).id ?? ''}|${c.style ?? ''}|${c.curvature ?? ''}|${wp}|${c.lineWidth ?? ''}|${c.lineWidthLock ?? ''}|${c.lineWidthEnd ?? ''}|${c.lineType ?? ''}|${c.shadow ?? ''}|${isUseSourceLineColorOn(c) ? '1' : ''}|${c.fromArrow ?? ''}|${c.toArrow ?? ''}|${c.arrow ?? ''}|${anim}|${c.color ?? ''}|${c.colorLock ?? ''}|${c.colorEnd ?? ''}|${c.centerEdgeAnchors ? '1' : ''}|${c.edgeAttachmentConstraint ?? ''}|${c.fromPreferredExit ?? ''}|${c.toPreferredEntry ?? ''}`;
}

function slideTransitionStyleEqual(
  a?: React.CSSProperties,
  b?: React.CSSProperties
): boolean {
  if (a === b) return true;
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    a.opacity === b.opacity &&
    a.transform === b.transform &&
    a.transition === b.transition
  );
}

function areBezierConnectionPropsEqual(prev: BezierConnectionProps, next: BezierConnectionProps): boolean {
  const prevRc = resolveBezierConnectionPaint(prev.connectionData, prev.connectionColor, prev.from, prev.to);
  const nextRc = resolveBezierConnectionPaint(next.connectionData, next.connectionColor, next.from, next.to);
  return (
    positionableKey(prev.from) === positionableKey(next.from) &&
    positionableKey(prev.to) === positionableKey(next.to) &&
    prev.connectionColor === next.connectionColor &&
    connectionDataKey(prev.connectionData) === connectionDataKey(next.connectionData) &&
    connectionAdvancedStyleRevisionKeyResolved(prev.connectionData, prevRc) ===
      connectionAdvancedStyleRevisionKeyResolved(next.connectionData, nextRc) &&
    prev.exportAnimationTimeSeconds === next.exportAnimationTimeSeconds &&
    prev.animationConnectionsEnabled === next.animationConnectionsEnabled &&
    slideTransitionStyleEqual(prev.slideTransitionStyle, next.slideTransitionStyle) &&
    prev.onClick === next.onClick &&
    prev.onDoubleClick === next.onDoubleClick &&
    prev.onContextMenu === next.onContextMenu
  );
}

interface BezierConnectionTextProps {
  connectionData?: DiagramConnectionData;
  from?: Positionable & { lineColor?: string };
  to?: Positionable & { lineColor?: string };
  connectionColor?: string;
}

const MAX_RENDERED_ANIMATION_SHAPES = 2000;

/** Returns color at 50% opacity. Handles hex and rgb/rgba; falls back to original if unparseable. */
export function colorWithHalfOpacity(color: string): string {
  const hexMatch = color.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (hexMatch) {
    const hex = hexMatch[1];
    const r = hex.length === 3 ? parseInt(hex[0] + hex[0], 16) : parseInt(hex.slice(0, 2), 16);
    const g = hex.length === 3 ? parseInt(hex[1] + hex[1], 16) : parseInt(hex.slice(2, 4), 16);
    const b = hex.length === 3 ? parseInt(hex[2] + hex[2], 16) : parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, 0.5)`;
  }
  const rgbaMatch = color.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*[\d.]+)?\s*\)$/);
  if (rgbaMatch) {
    return `rgba(${rgbaMatch[1]}, ${rgbaMatch[2]}, ${rgbaMatch[3]}, 0.5)`;
  }
  return color;
}

function formatAnimFloat(value: number): string {
  return Number.isFinite(value) ? value.toFixed(6).replace(/0+$/, '').replace(/\.$/, '') || '0' : '0';
}

export function getLoopedAnimationPathConfig(progress: number, speed: number): { keyPoints: string; keyTimes: string } {
  const normalized = Math.max(0, Math.min(1, progress));

  if (speed < 0) {
    const jumpTime = normalized;
    return {
      keyPoints: `${formatAnimFloat(normalized)};0;1;${formatAnimFloat(normalized)}`,
      keyTimes: `0;${formatAnimFloat(jumpTime)};${formatAnimFloat(jumpTime)};1`,
    };
  }

  const jumpTime = 1 - normalized;
  return {
    keyPoints: `${formatAnimFloat(normalized)};1;0;${formatAnimFloat(normalized)}`,
    keyTimes: `0;${formatAnimFloat(jumpTime)};${formatAnimFloat(jumpTime)};1`,
  };
}

interface PathDistanceLookup {
  totalLength: number;
  resolveT: (distance: number, wrap?: boolean) => number;
}

/** Lightweight path length estimate (60 samples). Use when only length is needed for live animation. */
function computePathLengthLight(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  fromAngle: number,
  toAngle: number,
  curvature: number,
  waypoints?: Array<{ x: number; y: number }>
): number {
  const samples = 60;
  let total = 0;
  let previous = getPointOnConnectionPath(0, fromX, fromY, toX, toY, fromAngle, toAngle, curvature, waypoints);

  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    const point = getPointOnConnectionPath(t, fromX, fromY, toX, toY, fromAngle, toAngle, curvature, waypoints);
    const dx = point.x - previous.x;
    const dy = point.y - previous.y;
    total += Math.sqrt(dx * dx + dy * dy);
    previous = point;
  }

  return total;
}

/** Full path distance lookup for GIF export (needs resolveT). Uses 90 samples for simple paths, 180 for waypoints. */
function buildPathDistanceLookup(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  fromAngle: number,
  toAngle: number,
  curvature: number,
  waypoints?: Array<{ x: number; y: number }>
): PathDistanceLookup {
  const samples = waypoints?.length ? 180 : 90;
  const distances: number[] = [0];
  const tValues: number[] = [0];
  let totalLength = 0;
  let previous = getPointOnConnectionPath(0, fromX, fromY, toX, toY, fromAngle, toAngle, curvature, waypoints);

  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    const point = getPointOnConnectionPath(t, fromX, fromY, toX, toY, fromAngle, toAngle, curvature, waypoints);
    const dx = point.x - previous.x;
    const dy = point.y - previous.y;
    totalLength += Math.sqrt(dx * dx + dy * dy);
    distances.push(totalLength);
    tValues.push(t);
    previous = point;
  }

  const resolveT = (distance: number, wrap: boolean = true): number => {
    if (totalLength <= 0) return 0;

    const targetDistance = wrap
      ? ((distance % totalLength) + totalLength) % totalLength
      : Math.max(0, Math.min(totalLength, distance));

    let low = 0;
    let high = distances.length - 1;

    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (distances[mid] < targetDistance) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    const index = low;
    if (index <= 0) return 0;

    const d0 = distances[index - 1];
    const d1 = distances[index];
    const t0 = tValues[index - 1];
    const t1 = tValues[index];

    if (d1 <= d0) return t1;
    const ratio = (targetDistance - d0) / (d1 - d0);
    return t0 + (t1 - t0) * ratio;
  };

  return {
    totalLength,
    resolveT,
  };
}

export function renderAnimatedShape(shape: 'dot' | 'square' | 'arrow' | 'triangle' | 'hexagon', size: number, color: string) {
  const half = size / 2;

  if (shape === 'dot') {
    return <circle cx={0} cy={0} r={half} fill={color} />;
  }

  if (shape === 'square') {
    return <rect x={-half} y={-half} width={size} height={size} fill={color} />;
  }

  if (shape === 'triangle') {
    return <polygon points={`0,${-half} ${half},${half} ${-half},${half}`} fill={color} />;
  }

  if (shape === 'hexagon') {
    const q = half * 0.55;
    return <polygon points={`${-half},0 ${-q},${-half} ${q},${-half} ${half},0 ${q},${half} ${-q},${half}`} fill={color} />;
  }

  return (
    <path
      d={`M ${-half} ${-half * 0.35} L ${half * 0.25} ${-half * 0.35} L ${half * 0.25} ${-half * 0.8} L ${half} 0 L ${half * 0.25} ${half * 0.8} L ${half * 0.25} ${half * 0.35} L ${-half} ${half * 0.35} Z`}
      fill={color}
    />
  );
}

export function getConnectionPoint(obj: any, width: number, height: number, point: 'top' | 'bottom' | 'left' | 'right' | 'center', iconHeight?: number, connectionIndex?: number, totalConnections?: number, isToNode: boolean = false, toConnectionIndex?: number, toTotalConnections?: number, iconOffset?: number, iconWidth?: number, iconOffsetX?: number, centerEdgeAnchors?: boolean): { x: number; y: number; angleDeg?: number } {
  const isGroup = obj.type === 'group' || obj.subType === 'zone';
  const isTextNode = obj.type === 'generic.text.text' || obj.type === 'generic.text.textbox';
  const isObjectNode = isGenericObjectOrChartShapeType(obj.type);
  const isIconLikeNode = !isGroup && !isTextNode && !isObjectNode;
  const inferredIconContainer = isIconLikeNode ? getNodeSizeDimensions((obj as any).nodeSize).container : undefined;

  // For icon-like nodes with labels, use icon-only dimensions so text doesn't affect anchors.
  const resolvedIconWidth = isIconLikeNode
    ? (iconWidth ?? inferredIconContainer ?? iconHeight)
    : iconWidth;
  const resolvedIconHeight = iconHeight ?? inferredIconContainer;
  const resolvedIconXOffset = iconOffsetX ?? (
    resolvedIconWidth && width > resolvedIconWidth ? (width - resolvedIconWidth) / 2 : 0
  );
  const resolvedIconYOffset = iconOffset ?? (
    (obj as any).textVerticalPosition === 'top' && resolvedIconHeight && height > resolvedIconHeight
      ? height - resolvedIconHeight
      : 0
  );
  const effectiveWidth = resolvedIconWidth ?? width;
  const centerX = resolvedIconWidth ? obj.x + resolvedIconXOffset + resolvedIconWidth / 2 : obj.x + width / 2;
  const leftX = resolvedIconWidth ? obj.x + resolvedIconXOffset : obj.x;
  const rightX = resolvedIconWidth ? obj.x + resolvedIconXOffset + resolvedIconWidth : obj.x + width;
  const centerY = resolvedIconHeight ? obj.y + resolvedIconYOffset + resolvedIconHeight / 2 : obj.y + height / 2;
  
  // For groups/zones, always use full height for edge center calculations
  const edgeCenterY = isGroup ? obj.y + height / 2 : centerY;
  
  // For groups/zones, add 4px offset outward from the edge (applies to both auto-fit and custom size)
  const edgeOffset = isGroup ? 4 : 0;

  // Calculate offset for multiple connections
  let offsetX = 0;
  let offsetY = 0;
  
  // Use to-specific indices if this is the "to" node and they're provided
  const effectiveIndex = (isToNode && toConnectionIndex !== undefined) ? toConnectionIndex : connectionIndex;
  const effectiveTotal = (isToNode && toTotalConnections !== undefined) ? toTotalConnections : totalConnections;
  const spreadAlongEdge = centerEdgeAnchors !== true && effectiveIndex !== undefined && effectiveTotal !== undefined && effectiveTotal > 1;

  if (spreadAlongEdge) {
    // Distribute connections evenly along the edge length
    // Edge length divided by number of connections gives us the spacing
    let edgeLength: number;
    let offsetFromStart: number;
    
    if (point === 'top' || point === 'bottom') {
      // For horizontal edges (top/bottom), distribute along the icon width
      edgeLength = effectiveWidth;
      // Divide edge into (effectiveTotal + 1) segments, place connections at segment boundaries
      // Start from the first segment boundary (not at the very edge)
      const segmentSize = edgeLength / (effectiveTotal + 1);
      offsetFromStart = segmentSize * (effectiveIndex + 1) - (edgeLength / 2);
      offsetX = offsetFromStart;
    } else if (point === 'left' || point === 'right') {
      // For vertical edges (left/right), distribute along the height
      // Use full height for groups, icon height for regular nodes
      edgeLength = isGroup ? height : (resolvedIconHeight || height);
      // Divide edge into (effectiveTotal + 1) segments, place connections at segment boundaries
      const segmentSize = edgeLength / (effectiveTotal + 1);
      offsetFromStart = segmentSize * (effectiveIndex + 1) - (edgeLength / 2);
      offsetY = offsetFromStart;
    } else {
      // For center connections, distribute in a circular pattern
      const angle = (effectiveIndex * 2 * Math.PI) / effectiveTotal;
      const radius = Math.min(effectiveWidth, resolvedIconHeight || height) / 4;
      offsetX = Math.cos(angle) * radius;
      offsetY = Math.sin(angle) * radius;
    }
  }

  // Kite: parametric placement along edges with edge-aligned angles.
  // Match sort order: connections are sorted by target/source position (left→right for top/bottom, top→bottom for left/right).
  // Bottom and left edges have path orientation reversed: invert t so leftmost/topmost destination gets the correct slot.
  if (isKiteShapeType(obj.type) && point !== 'center' && (point === 'top' || point === 'bottom' || point === 'left' || point === 'right')) {
    const kiteEffectiveIndex = (isToNode && toConnectionIndex !== undefined) ? toConnectionIndex : connectionIndex;
    const kiteEffectiveTotal = (isToNode && toTotalConnections !== undefined) ? toTotalConnections : totalConnections;
    let t: number;
    if (centerEdgeAnchors) {
      t = 0.5;
    } else if (kiteEffectiveIndex !== undefined && kiteEffectiveTotal !== undefined && kiteEffectiveTotal >= 1) {
      const n = kiteEffectiveTotal;
      const i = kiteEffectiveIndex;
      if (point === 'bottom' || point === 'left') {
        t = (n - i) / (n + 1); // inverted: low index (leftmost/topmost dest) → high t → correct slot
      } else {
        t = (i + 1) / (n + 1); // top/right: low index → low t
      }
    } else {
      t = 0.5;
    }
    const result = getKiteConnectionPoint(point, t, obj, width, height);
    return { x: result.x, y: result.y, angleDeg: result.angleDeg };
  }

  // For polygon shapes (octagon, hexagon, pentagon, etc.), use shape-specific edge geometry
  // so connectors land on the visible boundary instead of the rectangular bounding box
  const shapeBounds = isObjectNode ? getShapeEdgeBounds(obj.type) : null;
  if (shapeBounds && point !== 'center') {
    const pt = shapeEdgeToPoint(shapeBounds, obj, width, height, point);
    // Apply multi-connection offset along the edge
    if (point === 'top' || point === 'bottom') {
      pt.x += offsetX;
    } else {
      pt.y += offsetY;
    }
    return pt;
  }

  switch (point) {
    case 'top':
      // For top edge, always use horizontal center and top Y
      // For groups/zones, offset 4px upward (outward)
      return { x: centerX + offsetX, y: obj.y - edgeOffset };
    case 'bottom':
      // For bottom edge, always use horizontal center and bottom Y
      // For groups/zones, use full height and offset 4px downward (outward)
      const bottomY = isGroup ? obj.y + height : (resolvedIconHeight ? obj.y + resolvedIconYOffset + resolvedIconHeight : obj.y + height);
      return { x: centerX + offsetX, y: bottomY + edgeOffset };
    case 'left':
      // For left edge - use icon left when iconWidth provided
      return { x: leftX - edgeOffset, y: edgeCenterY + offsetY };
    case 'right':
      // For right edge - use icon right when iconWidth provided
      return { x: rightX + edgeOffset, y: edgeCenterY + offsetY };
    case 'center':
      return { x: centerX + offsetX, y: centerY + offsetY };
    default:
      return { x: centerX + offsetX, y: centerY + offsetY };
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

type AxisConstraintKind = 'top-bottom' | 'left-right';

/** Map an attach edge to the allowed axis set (same dx/dy rules as auto layout). */
function clampEdgeToAxisConstraint(
  edge: 'top' | 'bottom' | 'left' | 'right' | 'center',
  constraint: AxisConstraintKind,
  role: 'from' | 'to',
  dx: number,
  dy: number
): 'top' | 'bottom' | 'left' | 'right' | 'center' {
  if (constraint === 'top-bottom') {
    if (edge === 'top' || edge === 'bottom') return edge;
    if (edge === 'center') {
      return role === 'from' ? (dy > 0 ? 'bottom' : 'top') : (dy > 0 ? 'top' : 'bottom');
    }
    return role === 'from' ? (dy > 0 ? 'bottom' : 'top') : (dy > 0 ? 'top' : 'bottom');
  }
  if (edge === 'left' || edge === 'right') return edge;
  if (edge === 'center') {
    return role === 'from' ? (dx > 0 ? 'right' : 'left') : (dx > 0 ? 'left' : 'right');
  }
  return role === 'from' ? (dx > 0 ? 'right' : 'left') : (dx > 0 ? 'left' : 'right');
}

/** Exported for connection endpoint drag handles (editor). */
export function clampEdgeAttachmentForConstraint(
  edge: 'top' | 'bottom' | 'left' | 'right' | 'center',
  constraint: DiagramConnectionData['edgeAttachmentConstraint'],
  role: 'from' | 'to',
  dx: number,
  dy: number
): 'top' | 'bottom' | 'left' | 'right' | 'center' {
  if (!constraint || constraint === 'auto') return edge;
  const kind: AxisConstraintKind = constraint === 'top-bottom' ? 'top-bottom' : 'left-right';
  return clampEdgeToAxisConstraint(edge, kind, role, dx, dy);
}

function applyEdgeAttachmentConstraintToEdges(
  edges: { fromEdge: 'top' | 'bottom' | 'left' | 'right' | 'center'; toEdge: 'top' | 'bottom' | 'left' | 'right' | 'center' },
  constraint: DiagramConnectionData['edgeAttachmentConstraint'],
  dx: number,
  dy: number
): { fromEdge: 'top' | 'bottom' | 'left' | 'right' | 'center'; toEdge: 'top' | 'bottom' | 'left' | 'right' | 'center' } {
  const c = constraint;
  if (!c || c === 'auto') return edges;
  const kind: AxisConstraintKind = c === 'top-bottom' ? 'top-bottom' : 'left-right';
  return {
    fromEdge: clampEdgeToAxisConstraint(edges.fromEdge, kind, 'from', dx, dy),
    toEdge: clampEdgeToAxisConstraint(edges.toEdge, kind, 'to', dx, dy),
  };
}

/** Icon-aware center deltas between endpoints (matches auto edge selection). */
export function computeAxisDeltasForConnectionNodes(
  from: Positionable,
  to: Positionable,
  resolvedFromWidth: number,
  resolvedFromHeight: number,
  resolvedToWidth: number,
  resolvedToHeight: number
): { dx: number; dy: number } {
  const fromIsGroup = from.type === 'group' || from.subType === 'zone';
  const toIsGroup = to.type === 'group' || to.subType === 'zone';
  const fromIsText = from.type === 'generic.text.text' || from.type === 'generic.text.textbox';
  const toIsText = to.type === 'generic.text.text' || to.type === 'generic.text.textbox';
  const fromIsObjectNode = isGenericObjectOrChartShapeType(from.type);
  const toIsObjectNode = isGenericObjectOrChartShapeType(to.type);
  const fromIsIconLike = !fromIsGroup && !fromIsText && !fromIsObjectNode;
  const toIsIconLike = !toIsGroup && !toIsText && !toIsObjectNode;

  const fromIconContainer = fromIsIconLike ? getNodeSizeDimensions((from as any).nodeSize).container : undefined;
  const toIconContainer = toIsIconLike ? getNodeSizeDimensions((to as any).nodeSize).container : undefined;
  const fromIconOffsetX = fromIconContainer && resolvedFromWidth > fromIconContainer ? (resolvedFromWidth - fromIconContainer) / 2 : 0;
  const toIconOffsetX = toIconContainer && resolvedToWidth > toIconContainer ? (resolvedToWidth - toIconContainer) / 2 : 0;
  const fromIconOffsetY = fromIsIconLike && (from as any).textVerticalPosition === 'top' && fromIconContainer && resolvedFromHeight > fromIconContainer
    ? resolvedFromHeight - fromIconContainer
    : 0;
  const toIconOffsetY = toIsIconLike && (to as any).textVerticalPosition === 'top' && toIconContainer && resolvedToHeight > toIconContainer
    ? resolvedToHeight - toIconContainer
    : 0;

  const fromCenterX = fromIsIconLike && fromIconContainer
    ? from.x + fromIconOffsetX + fromIconContainer / 2
    : from.x + resolvedFromWidth / 2;
  const fromCenterY = fromIsIconLike && fromIconContainer
    ? from.y + fromIconOffsetY + fromIconContainer / 2
    : from.y + resolvedFromHeight / 2;
  const toCenterX = toIsIconLike && toIconContainer
    ? to.x + toIconOffsetX + toIconContainer / 2
    : to.x + resolvedToWidth / 2;
  const toCenterY = toIsIconLike && toIconContainer
    ? to.y + toIconOffsetY + toIconContainer / 2
    : to.y + resolvedToHeight / 2;

  return { dx: toCenterX - fromCenterX, dy: toCenterY - fromCenterY };
}

// Helper function to determine the edge for a connection (for grouping connections by edge)
export function determineConnectionEdges(
  from: Positionable,
  to: Positionable,
  connectionData?: DiagramConnectionData,
  fromWidth?: number,
  fromHeight?: number,
  toWidth?: number,
  toHeight?: number
): { fromEdge: 'top' | 'bottom' | 'left' | 'right' | 'center'; toEdge: 'top' | 'bottom' | 'left' | 'right' | 'center' } {
  const resolvedFromWidth = fromWidth || from.width;
  const resolvedFromHeight = fromHeight || from.height;
  const resolvedToWidth = toWidth || to.width;
  const resolvedToHeight = toHeight || to.height;
  const { dx, dy } = computeAxisDeltasForConnectionNodes(
    from,
    to,
    resolvedFromWidth,
    resolvedFromHeight,
    resolvedToWidth,
    resolvedToHeight
  );

  // Both sides explicitly set — full user override
  if (
    connectionData?.fromPreferredExit !== undefined &&
    connectionData?.toPreferredEntry !== undefined
  ) {
    return applyEdgeAttachmentConstraintToEdges(
      { fromEdge: connectionData.fromPreferredExit, toEdge: connectionData.toPreferredEntry },
      connectionData.edgeAttachmentConstraint,
      dx,
      dy
    );
  }

  // Only one side forced — merge with auto layout for the other end
  if (
    connectionData?.fromPreferredExit !== undefined ||
    connectionData?.toPreferredEntry !== undefined
  ) {
    const stripped: DiagramConnectionData = {
      ...connectionData,
      fromPreferredExit: undefined,
      toPreferredEntry: undefined,
    };
    const auto = determineConnectionEdges(
      from,
      to,
      stripped,
      resolvedFromWidth,
      resolvedFromHeight,
      resolvedToWidth,
      resolvedToHeight
    );
    let fromEdge = auto.fromEdge;
    let toEdge = auto.toEdge;
    if (connectionData.fromPreferredExit !== undefined) {
      fromEdge = connectionData.fromPreferredExit;
    }
    if (connectionData.toPreferredEntry !== undefined) {
      toEdge = connectionData.toPreferredEntry;
    }
    return applyEdgeAttachmentConstraintToEdges(
      { fromEdge, toEdge },
      connectionData.edgeAttachmentConstraint,
      dx,
      dy
    );
  }

  // When waypoints exist, use first/last waypoint to determine which edge the connector should exit/enter
  const waypoints = connectionData?.waypoints;
  if (waypoints?.length) {
    const fromCenterX = from.x + (resolvedFromWidth || 0) / 2;
    const fromCenterY = from.y + (resolvedFromHeight || 0) / 2;
    const toCenterX = to.x + (resolvedToWidth || 0) / 2;
    const toCenterY = to.y + (resolvedToHeight || 0) / 2;

    const firstWp = waypoints[0];
    const lastWp = waypoints[waypoints.length - 1];

    const fromDx = firstWp.x - fromCenterX;
    const fromDy = firstWp.y - fromCenterY;
    const toDx = lastWp.x - toCenterX;
    const toDy = lastWp.y - toCenterY;

    const fromIsHorizontal = Math.abs(fromDx) > Math.abs(fromDy);
    const toIsHorizontal = Math.abs(toDx) > Math.abs(toDy);

    const fromEdge: 'top' | 'bottom' | 'left' | 'right' = fromIsHorizontal
      ? fromDx > 0 ? 'right' : 'left'
      : fromDy > 0 ? 'bottom' : 'top';
    const toEdge: 'top' | 'bottom' | 'left' | 'right' = toIsHorizontal
      ? toDx > 0 ? 'right' : 'left'
      : toDy > 0 ? 'bottom' : 'top';

    return applyEdgeAttachmentConstraintToEdges({ fromEdge, toEdge }, connectionData?.edgeAttachmentConstraint, dx, dy);
  }

  const constraint = connectionData?.edgeAttachmentConstraint;
  let useHorizontal: boolean;
  if (constraint === 'left-right') useHorizontal = true;
  else if (constraint === 'top-bottom') useHorizontal = false;
  else useHorizontal = Math.abs(dx) > Math.abs(dy);

  let fromEdge: 'top' | 'bottom' | 'left' | 'right' | 'center';
  let toEdge: 'top' | 'bottom' | 'left' | 'right' | 'center';

  if (useHorizontal) {
    fromEdge = dx > 0 ? 'right' : 'left';
    toEdge = dx > 0 ? 'left' : 'right';
  } else {
    fromEdge = dy > 0 ? 'bottom' : 'top';
    toEdge = dy > 0 ? 'top' : 'bottom';
  }

  // Handle groups/zones - never use center
  const isFromGroup = from.type === 'group' || from.subType === 'zone';
  const isToGroup = to.type === 'group' || to.subType === 'zone';

  if (isFromGroup && connectionData?.fromPreferredExit !== 'center') {
    fromEdge = connectionData?.fromPreferredExit || fromEdge;
  }
  if (isToGroup && connectionData?.toPreferredEntry !== 'center') {
    toEdge = connectionData?.toPreferredEntry || toEdge;
  }

  return applyEdgeAttachmentConstraintToEdges({ fromEdge, toEdge }, connectionData?.edgeAttachmentConstraint, dx, dy);
}

export function getOptimalConnectionPoints(from: any, to: any, fromWidth: number, fromHeight: number, toWidth: number, toHeight: number, connectionData?: DiagramConnectionData, fromIconHeight?: number, toIconHeight?: number, fromIconOffset?: number, toIconOffset?: number, fromIconWidth?: number, fromIconOffsetX?: number, toIconWidth?: number, toIconOffsetX?: number): { fromX: number; fromY: number; toX: number; toY: number; fromAngle: number; toAngle: number } {
  const fromIsGroup = from.type === 'group' || from.subType === 'zone';
  const toIsGroup = to.type === 'group' || to.subType === 'zone';
  const fromIsText = from.type === 'generic.text.text' || from.type === 'generic.text.textbox';
  const toIsText = to.type === 'generic.text.text' || to.type === 'generic.text.textbox';
  const fromIsObjectNode = isGenericObjectOrChartShapeType(from.type);
  const toIsObjectNode = isGenericObjectOrChartShapeType(to.type);
  const fromIsIconLike = !fromIsGroup && !fromIsText && !fromIsObjectNode;
  const toIsIconLike = !toIsGroup && !toIsText && !toIsObjectNode;

  const inferredFromIconContainer = fromIsIconLike ? getNodeSizeDimensions((from as any).nodeSize).container : undefined;
  const inferredToIconContainer = toIsIconLike ? getNodeSizeDimensions((to as any).nodeSize).container : undefined;
  const resolvedFromIconWidth = fromIsIconLike
    ? (fromIconWidth ?? inferredFromIconContainer ?? fromIconHeight)
    : fromIconWidth;
  const resolvedToIconWidth = toIsIconLike
    ? (toIconWidth ?? inferredToIconContainer ?? toIconHeight)
    : toIconWidth;
  const resolvedFromIconOffsetX = fromIconOffsetX ?? (
    resolvedFromIconWidth && fromWidth > resolvedFromIconWidth ? (fromWidth - resolvedFromIconWidth) / 2 : 0
  );
  const resolvedToIconOffsetX = toIconOffsetX ?? (
    resolvedToIconWidth && toWidth > resolvedToIconWidth ? (toWidth - resolvedToIconWidth) / 2 : 0
  );
  const resolvedFromIconHeight = fromIconHeight ?? inferredFromIconContainer;
  const resolvedToIconHeight = toIconHeight ?? inferredToIconContainer;
  const resolvedFromIconOffset = fromIconOffset ?? (
    fromIsIconLike && (from as any).textVerticalPosition === 'top' && resolvedFromIconHeight && fromHeight > resolvedFromIconHeight
      ? fromHeight - resolvedFromIconHeight
      : 0
  );
  const resolvedToIconOffset = toIconOffset ?? (
    toIsIconLike && (to as any).textVerticalPosition === 'top' && resolvedToIconHeight && toHeight > resolvedToIconHeight
      ? toHeight - resolvedToIconHeight
      : 0
  );

  const centerEdgeAnchors = connectionData?.centerEdgeAnchors === true;

  // Auto-determine optimal connection points — shared axis deltas for constraint + auto layout
  const fromCenterX = resolvedFromIconWidth ? from.x + resolvedFromIconOffsetX + resolvedFromIconWidth / 2 : from.x + fromWidth / 2;
  const fromCenterY = resolvedFromIconHeight ? from.y + resolvedFromIconOffset + resolvedFromIconHeight / 2 : from.y + fromHeight / 2;
  const toCenterX = resolvedToIconWidth ? to.x + resolvedToIconOffsetX + resolvedToIconWidth / 2 : to.x + toWidth / 2;
  const toCenterY = resolvedToIconHeight ? to.y + resolvedToIconOffset + resolvedToIconHeight / 2 : to.y + toHeight / 2;

  const dx = toCenterX - fromCenterX;
  const dy = toCenterY - fromCenterY;

  const edgeConstraint = connectionData?.edgeAttachmentConstraint;
  const constraintKind: AxisConstraintKind | null =
    edgeConstraint === 'top-bottom' ? 'top-bottom' : edgeConstraint === 'left-right' ? 'left-right' : null;

  // User-specified edge on one or both ends (undefined = auto for that end)
  if (
    connectionData?.fromPreferredExit !== undefined ||
    connectionData?.toPreferredEntry !== undefined
  ) {
    const edges = determineConnectionEdges(
      from,
      to,
      connectionData,
      fromWidth,
      fromHeight,
      toWidth,
      toHeight
    );
    let fromExit = edges.fromEdge;
    let toEntry = edges.toEdge;
    if (constraintKind) {
      fromExit = clampEdgeToAxisConstraint(fromExit, constraintKind, 'from', dx, dy);
      toEntry = clampEdgeToAxisConstraint(toEntry, constraintKind, 'to', dx, dy);
    }
    const fromPoint = getConnectionPoint(from, fromWidth, fromHeight, fromExit, resolvedFromIconHeight, connectionData?.connectionIndex, connectionData?.totalConnections, false, undefined, undefined, resolvedFromIconOffset, resolvedFromIconWidth, resolvedFromIconOffsetX, centerEdgeAnchors);
    const toPoint = getConnectionPoint(to, toWidth, toHeight, toEntry, resolvedToIconHeight, connectionData?.toConnectionIndex, connectionData?.toTotalConnections, true, connectionData?.toConnectionIndex, connectionData?.toTotalConnections, resolvedToIconOffset, resolvedToIconWidth, resolvedToIconOffsetX, centerEdgeAnchors);
    const fromAngle = fromPoint.angleDeg ?? getExitAngle(fromExit);
    const toAngle = toPoint.angleDeg ?? getExitAngle(toEntry);
    return { fromX: fromPoint.x, fromY: fromPoint.y, toX: toPoint.x, toY: toPoint.y, fromAngle, toAngle };
  }

  // Determine primary direction
  let isHorizontal: boolean;
  if (edgeConstraint === 'left-right') isHorizontal = true;
  else if (edgeConstraint === 'top-bottom') isHorizontal = false;
  else isHorizontal = Math.abs(dx) > Math.abs(dy);
  
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
  // For groups/zones, ALWAYS use edge connections (never center) unless explicitly overridden with a non-center point
  if (fromIsGroup) {
    // Only use preferred exit if it's explicitly set AND it's not 'center'
    if (connectionData?.fromPreferredExit && connectionData.fromPreferredExit !== 'center') {
      fromPoint = connectionData.fromPreferredExit;
    } else {
      // Force edge connection based on direction
      fromPoint = isHorizontal ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'bottom' : 'top');
    }
  }
  
  if (toIsGroup) {
    // Only use preferred entry if it's explicitly set AND it's not 'center'
    if (connectionData?.toPreferredEntry && connectionData.toPreferredEntry !== 'center') {
      toPoint = connectionData.toPreferredEntry;
    } else {
      // Force edge connection based on direction
      toPoint = isHorizontal ? (dx > 0 ? 'left' : 'right') : (dy > 0 ? 'top' : 'bottom');
    }
  }

  const finalFromPoint = (connectionData?.fromPreferredExit ?? fromPoint) as
    'top' | 'bottom' | 'left' | 'right' | 'center';
  const finalToPoint = (connectionData?.toPreferredEntry ?? toPoint) as
    'top' | 'bottom' | 'left' | 'right' | 'center';
  
  // Final safety check: never allow 'center' for groups/zones
  const safeFromPoint = (fromIsGroup && finalFromPoint === 'center') 
    ? (isHorizontal ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'bottom' : 'top'))
    : finalFromPoint;
  const safeToPoint = (toIsGroup && finalToPoint === 'center')
    ? (isHorizontal ? (dx > 0 ? 'left' : 'right') : (dy > 0 ? 'top' : 'bottom'))
    : finalToPoint;

  let clampedFrom = safeFromPoint;
  let clampedTo = safeToPoint;
  if (constraintKind) {
    clampedFrom = clampEdgeToAxisConstraint(safeFromPoint, constraintKind, 'from', dx, dy);
    clampedTo = clampEdgeToAxisConstraint(safeToPoint, constraintKind, 'to', dx, dy);
  }

  const fromConnectionPoint = getConnectionPoint(from, fromWidth, fromHeight, clampedFrom, resolvedFromIconHeight, connectionData?.connectionIndex, connectionData?.totalConnections, false, undefined, undefined, resolvedFromIconOffset, resolvedFromIconWidth, resolvedFromIconOffsetX, centerEdgeAnchors);
  const toConnectionPoint = getConnectionPoint(to, toWidth, toHeight, clampedTo, resolvedToIconHeight, connectionData?.toConnectionIndex, connectionData?.toTotalConnections, true, connectionData?.toConnectionIndex, connectionData?.toTotalConnections, resolvedToIconOffset, resolvedToIconWidth, resolvedToIconOffsetX, centerEdgeAnchors);
  
  const fromAngle = fromConnectionPoint.angleDeg ?? getExitAngle(clampedFrom);
  const toAngle = toConnectionPoint.angleDeg ?? getExitAngle(clampedTo);

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
    default: {
      const uv = angleToUnitVector(fromAngle);
      cp1X = fromX + controlOffset * uv.x;
      cp1Y = fromY + controlOffset * uv.y;
    }
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
    default: {
      const uv = angleToUnitVector(toAngle);
      cp2X = toX + controlOffset * uv.x;
      cp2Y = toY + controlOffset * uv.y;
    }
  }
  
  return `M ${fromX} ${fromY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${toX} ${toY}`;
}

/** Unit vector for angle in degrees (0=up, 90=right, 180=down, 270=left) */
function angleToUnitVector(angle: number): { x: number; y: number } {
  const rad = (angle * Math.PI) / 180;
  return { x: Math.sin(rad), y: -Math.cos(rad) };
}

/**
 * Builds a smooth multi-point bezier path through waypoints.
 * Uses Catmull-Rom style tangents for C1 continuity at each waypoint.
 */
function calculateMultiPointBezierPath(
  fromX: number, fromY: number,
  toX: number, toY: number,
  waypoints: Array<{ x: number; y: number }>,
  curvature: number,
  fromAngle: number,
  toAngle: number
): string {
  if (!waypoints.length) {
    return calculateBezierPath(fromX, fromY, toX, toY, curvature, fromAngle, toAngle);
  }

  const distance = Math.sqrt((toX - fromX) ** 2 + (toY - fromY) ** 2);
  const offset = Math.min(curvature * distance * 0.25, 40);

  const fromVec = angleToUnitVector(fromAngle);
  const toVec = angleToUnitVector(toAngle);
  const pBefore = { x: fromX - fromVec.x * offset, y: fromY - fromVec.y * offset };
  const pAfter = { x: toX + toVec.x * offset, y: toY + toVec.y * offset };

  const points: Array<{ x: number; y: number }> = [
    { x: fromX, y: fromY },
    ...waypoints,
    { x: toX, y: toY }
  ];

  const d = 1 / 6;
  const parts: string[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i === 0 ? pBefore : points[i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = i === points.length - 2 ? pAfter : points[i + 2];

    const cp1X = p1.x + (p2.x - p0.x) * d;
    const cp1Y = p1.y + (p2.y - p0.y) * d;
    const cp2X = p2.x - (p3.x - p1.x) * d;
    const cp2Y = p2.y - (p3.y - p1.y) * d;

    if (i === 0) {
      parts.push(`M ${p1.x} ${p1.y} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${p2.x} ${p2.y}`);
    } else {
      parts.push(`C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${p2.x} ${p2.y}`);
    }
  }

  return parts.join(' ');
}

/**
 * Returns control points for segment i of a multi-point path (for getPointOnPath).
 */
function getSegmentControlPoints(
  fromX: number, fromY: number, toX: number, toY: number,
  waypoints: Array<{ x: number; y: number }>,
  curvature: number, fromAngle: number, toAngle: number,
  segmentIndex: number
): { p0x: number; p0y: number; cp1x: number; cp1y: number; cp2x: number; cp2y: number; p3x: number; p3y: number } | null {
  if (!waypoints.length) return null;
  const offset = Math.min(curvature * Math.sqrt((toX - fromX) ** 2 + (toY - fromY) ** 2) * 0.25, 40);
  const fromVec = angleToUnitVector(fromAngle);
  const toVec = angleToUnitVector(toAngle);
  const pBefore = { x: fromX - fromVec.x * offset, y: fromY - fromVec.y * offset };
  const pAfter = { x: toX + toVec.x * offset, y: toY + toVec.y * offset };
  const points = [{ x: fromX, y: fromY }, ...waypoints, { x: toX, y: toY }];
  const d = 1 / 6;
  if (segmentIndex < 0 || segmentIndex >= points.length - 1) return null;
  const p0 = segmentIndex === 0 ? pBefore : points[segmentIndex - 1];
  const p1 = points[segmentIndex];
  const p2 = points[segmentIndex + 1];
  const p3 = segmentIndex === points.length - 2 ? pAfter : points[segmentIndex + 2];
  return {
    p0x: p1.x, p0y: p1.y,
    cp1x: p1.x + (p2.x - p0.x) * d, cp1y: p1.y + (p2.y - p0.y) * d,
    cp2x: p2.x - (p3.x - p1.x) * d, cp2y: p2.y - (p3.y - p1.y) * d,
    p3x: p2.x, p3y: p2.y
  };
}

/**
 * Get point on connection path at t in [0, 1]. Works for both single and multi-waypoint paths.
 */
export function getPointOnConnectionPath(
  t: number,
  fromX: number, fromY: number, toX: number, toY: number,
  fromAngle: number, toAngle: number,
  curvature: number,
  waypoints?: Array<{ x: number; y: number }>
): { x: number; y: number } {
  if (!waypoints?.length) {
    const { cp1X, cp1Y, cp2X, cp2Y } = calculateBezierControlPoints(fromX, fromY, toX, toY, curvature, fromAngle, toAngle);
    return getBezierPoint(t, fromX, fromY, cp1X, cp1Y, cp2X, cp2Y, toX, toY);
  }
  const points = [{ x: fromX, y: fromY }, ...waypoints, { x: toX, y: toY }];
  const numSegments = points.length - 1;
  const segmentIndex = Math.min(Math.floor(t * numSegments), numSegments - 1);
  const localT = numSegments <= 1 ? t : (t - segmentIndex / numSegments) * numSegments;
  const seg = getSegmentControlPoints(fromX, fromY, toX, toY, waypoints, curvature, fromAngle, toAngle, segmentIndex);
  if (!seg) return { x: toX, y: toY };
  return getBezierPoint(localT, seg.p0x, seg.p0y, seg.cp1x, seg.cp1y, seg.cp2x, seg.cp2y, seg.p3x, seg.p3y);
}

/** Parameter t in [0,1] on the same path as `getPointOnConnectionPath`, closest to diagram point (px, py). */
export function closestTOnConnectionPath(
  px: number,
  py: number,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  fromAngle: number,
  toAngle: number,
  curvature: number,
  waypoints?: Array<{ x: number; y: number }>,
): number {
  const samples = 96;
  let bestT = 0.5;
  let bestD = Infinity;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const p = getPointOnConnectionPath(t, fromX, fromY, toX, toY, fromAngle, toAngle, curvature, waypoints);
    const d = (p.x - px) ** 2 + (p.y - py) ** 2;
    if (d < bestD) {
      bestD = d;
      bestT = t;
    }
  }
  let step = 1 / samples;
  for (let iter = 0; iter < 8; iter++) {
    for (const dir of [-1, 1]) {
      const t2 = Math.max(0, Math.min(1, bestT + dir * step));
      const p = getPointOnConnectionPath(t2, fromX, fromY, toX, toY, fromAngle, toAngle, curvature, waypoints);
      const d = (p.x - px) ** 2 + (p.y - py) ** 2;
      if (d < bestD) {
        bestD = d;
        bestT = t2;
      }
    }
    step *= 0.5;
  }
  return bestT;
}

function BezierConnectionInner({
  from,
  to,
  connectionColor,
  connectionData,
  exportAnimationTimeSeconds,
  animationConnectionsEnabled = true,
  onClick,
  onDoubleClick,
  onContextMenu,
  slideTransitionStyle,
}: BezierConnectionProps) {
  // Use measureNodeDims-like logic for shapes to get actual dimensions
  const isFromShape = isShapeNodeType(from.type);
  const isToShape = isShapeNodeType(to.type);
  
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
  // For icon nodes, use measureNodeDims to get labelWidth-aware dimensions
  const isFromIconNode = !isFromGroup && !isFromShape && !isFromTextType;
  const isToIconNode = !isToGroup && !isToShape && !isToTextType;
  const fromDims = isFromIconNode ? measureNodeDims(from as any) : null;
  const toDims = isToIconNode ? measureNodeDims(to as any) : null;
  const fromIconContainer = isFromIconNode ? getNodeSizeDimensions((from as any).nodeSize).container : undefined;
  const toIconContainer = isToIconNode ? getNodeSizeDimensions((to as any).nodeSize).container : undefined;
  const fromWidth = isFromGroup 
    ? (from.width || 300)
    : (isFromShape && from.width ? from.width : (fromDims?.width ?? from.width ?? NODE_WIDTH));
  const fromHeight = isFromGroup
    ? (from.height || 220)
    : (isFromShape && from.height ? from.height : (isFromIconNode ? (fromIconContainer ?? BASE_NODE_HEIGHT) : (fromDims?.height ?? fromCalculatedHeight + fromTextUnderHeight)));
  const toWidth = isToGroup
    ? (to.width || 300)
    : (isToShape && to.width ? to.width : (toDims?.width ?? to.width ?? NODE_WIDTH));
  const toHeight = isToGroup
    ? (to.height || 220)
    : (isToShape && to.height ? to.height : (isToIconNode ? (toIconContainer ?? BASE_NODE_HEIGHT) : (toDims?.height ?? toCalculatedHeight + toTextUnderHeight)));
  
  // Calculate icon-only heights (excluding text labels) for connection point calculations
  // This ensures connections attach to the icon center, not the overall node center
  // BUT: Groups/zones should use full height, not icon height
  let fromIconHeight: number | undefined;
  let toIconHeight: number | undefined;
  let fromIconOffset: number | undefined;
  let toIconOffset: number | undefined;
  
  if (!isFromGroup) {
    if (isFromShape) {
      // For shapes, use the shape size (48px) or custom height if set
      fromIconHeight = from.height || 48;
    } else if (isFromTextType) {
      // For text nodes, use the full calculated height (no separate icon)
      fromIconHeight = fromCalculatedHeight;
    } else {
      // For regular icon/resource nodes, use explicit icon container size (ignore label text)
      fromIconHeight = fromIconContainer ?? BASE_NODE_HEIGHT;
      // If text is above, shift icon down by the non-icon measured height.
      const textVerticalPosition = (from as any).textVerticalPosition || 'bottom';
      if (textVerticalPosition === 'top' && fromDims?.height && fromIconHeight) {
        fromIconOffset = Math.max(0, fromDims.height - fromIconHeight);
      }
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
      // For regular icon/resource nodes, use explicit icon container size (ignore label text)
      toIconHeight = toIconContainer ?? BASE_NODE_HEIGHT;
      // If text is above, shift icon down by the non-icon measured height.
      const textVerticalPosition = (to as any).textVerticalPosition || 'bottom';
      if (textVerticalPosition === 'top' && toDims?.height && toIconHeight) {
        toIconOffset = Math.max(0, toDims.height - toIconHeight);
      }
    }
  }
  // If isToGroup, toIconHeight remains undefined, so full height will be used

  // For icon nodes with labelWidth > icon container: connections attach to icon, not the full node
  // Use getNodeSizeDimensions so half/quarter nodeSize is respected
  const fromIconSize = isFromIconNode ? fromIconContainer ?? 80 : undefined;
  const toIconSize = isToIconNode ? toIconContainer ?? 80 : undefined;
  const fromIconWidth = isFromIconNode && fromIconSize && fromWidth > fromIconSize ? fromIconSize : undefined;
  const fromIconOffsetX = fromIconWidth ? (fromWidth - fromIconWidth) / 2 : undefined;
  const toIconWidth = isToIconNode && toIconSize && toWidth > toIconSize ? toIconSize : undefined;
  const toIconOffsetX = toIconWidth ? (toWidth - toIconWidth) / 2 : undefined;

  // Use icon-only heights for connection point calculations (undefined for groups/zones = use full height)
  const connectionPoints = getOptimalConnectionPoints(from, to, fromWidth, fromHeight, toWidth, toHeight, connectionData, fromIconHeight, toIconHeight, fromIconOffset, toIconOffset, fromIconWidth, fromIconOffsetX, toIconWidth, toIconOffsetX);
  const { fromX, fromY, toX, toY, fromAngle, toAngle } = connectionPoints;

  const curvature = connectionData?.curvature || 0.6;
  const waypoints = connectionData?.waypoints;
  const waypointsKey = waypoints?.length ? waypoints.map((w) => `${w.x},${w.y}`).join(';') : '';
  const pathData = waypoints?.length
    ? calculateMultiPointBezierPath(fromX, fromY, toX, toY, waypoints, curvature, fromAngle, toAngle)
    : calculateBezierPath(fromX, fromY, toX, toY, curvature, fromAngle, toAngle);

  const rw = resolveConnectionWidths(connectionData);
  const rc = resolveBezierConnectionPaint(connectionData, connectionColor, from, to);
  const advancedLine = connectionNeedsAdvancedLineStyle(rw, rc);
  const widthVaries = !rw.locked && rw.wStart !== rw.wEnd;
  const colorVaries = !rc.locked && rc.cStart !== rc.cEnd;
  const ribbonLayout = React.useMemo(() => {
    const baseGrad = { gx1: fromX, gy1: fromY, gx2: toX, gy2: toY };
    if (!widthVaries) {
      return { ribbonPathD: '', ...baseGrad };
    }
    const pts = Array.from({ length: 72 }, (_, i) =>
      getPointOnConnectionPath(i / 71, fromX, fromY, toX, toY, fromAngle, toAngle, curvature, waypoints)
    );
    return {
      ribbonPathD: buildRibbonPolygonPath(pts, rw.wStart, rw.wEnd),
      gx1: pts[0].x,
      gy1: pts[0].y,
      gx2: pts[pts.length - 1].x,
      gy2: pts[pts.length - 1].y,
    };
  }, [widthVaries, fromX, fromY, toX, toY, fromAngle, toAngle, curvature, waypointsKey, rw.wStart, rw.wEnd]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClick && connectionData) {
      onClick(connectionData, e);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (onDoubleClick && connectionData) {
      onDoubleClick(connectionData, e);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (onContextMenu && connectionData) {
      onContextMenu(e, connectionData);
    }
  };

  // Check for arrows
  const hasFromArrow = connectionData?.fromArrow === true;
  const hasToArrow = connectionData?.toArrow === true;
  const hasLegacyArrow = connectionData?.arrow === true; // Backward compatibility
  
  const showStartArrow = hasFromArrow;
  const showEndArrow = hasToArrow || hasLegacyArrow;
  
  const startMarkerId = showStartArrow ? `arrowhead-start-${from.id}-${to.id}` : undefined;
  const endMarkerId = showEndArrow ? `arrowhead-end-${from.id}-${to.id}` : undefined;
  const { resolvedTheme } = useTheme();
  const hasShadow = connectionData?.shadow || false;
  const shadowFilterId = hasShadow ? `shadow-filter-${from.id}-${to.id}-${resolvedTheme}` : undefined;
  const animation = clampConnectionAnimation(connectionData?.animation);
  const connectionThickness = maxResolvedLineWidth(rw);
  const shapeSize = animation.size * 2 * connectionThickness;
  const baseAnimShapeSize = animation.size * 2 * Math.max(rw.wStart, rw.wEnd, 1e-6);
  /** Spacing for count/layout only — uses ref line width so frequency does not collapse when the stroke is very wide. */
  const spacingDistance =
    (animation.size * 2 * CONNECTION_ANIMATION_SPACING_REF_LINE_PX) * (1 + animation.spacing);
  const hasExportAnimationTime = typeof exportAnimationTimeSeconds === 'number' && Number.isFinite(exportAnimationTimeSeconds);
  const pathLengthForCount = computePathLengthLight(fromX, fromY, toX, toY, fromAngle, toAngle, curvature, waypoints);
  const maxShapeCountByLength = spacingDistance > 0 ? Math.floor(pathLengthForCount / spacingDistance) : 0;
  const requestedShapeCount = animation.autoCount ? maxShapeCountByLength : animation.shapeCount;
  const renderedShapeCount = Math.max(
    0,
    Math.min(
      MAX_RENDERED_ANIMATION_SHAPES,
      Math.min(requestedShapeCount, maxShapeCountByLength)
    )
  );
  const shouldRenderAnimationShapes = animationConnectionsEnabled && animation.enabled && renderedShapeCount > 0 && pathLengthForCount > 0;
  const speedMagnitude = Math.abs(animation.speed);
  const shouldAnimateShapes = shouldRenderAnimationShapes && speedMagnitude > 0;
  const useStaticExportAnimation = shouldAnimateShapes && hasExportAnimationTime;
  const needsPathDistanceLookup = useStaticExportAnimation || (shouldRenderAnimationShapes && !shouldAnimateShapes);
  const pathDistanceLookup = needsPathDistanceLookup
    ? React.useMemo(
        () => buildPathDistanceLookup(fromX, fromY, toX, toY, fromAngle, toAngle, curvature, waypoints),
        [fromX, fromY, toX, toY, fromAngle, toAngle, curvature, waypointsKey]
      )
    : null;
  const pathLength = pathDistanceLookup ? pathDistanceLookup.totalLength : pathLengthForCount;
  const distributedShapeSpacing = renderedShapeCount > 0 ? pathLength / renderedShapeCount : 0;
  const animationDuration = shouldAnimateShapes ? pathLength / speedMagnitude : 0;
  const animationColor = animation.color ? animation.color : colorWithHalfOpacity(rc.cStart);
  const connectionKey = `${connectionData?.from ?? from.id}-${connectionData?.to ?? to.id}-${(connectionData as { id?: string })?.id ?? ''}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  const gradIdSuffix = connectionGradientIdSuffix(connectionData, rc, ribbonLayout);
  const lineGradientId = `conn-line-grad-${connectionKey}-${gradIdSuffix}`;
  const animationPhaseResetKey = [
    animation.enabled ? '1' : '0',
    animation.shape,
    animation.speed,
    animation.size,
    connectionThickness,
    Math.round(shapeSize * 100) / 100,
    animation.autoCount ? 'auto' : 'manual',
    animation.shapeCount,
    animation.spacing,
    renderedShapeCount,
    Math.round(pathLength),
  ].join('-').replace(/[^a-zA-Z0-9_-]/g, '_');
  const motionPathId = `connection-motion-${connectionKey}-${animationPhaseResetKey}`;
  const strokeDashProps = advancedLine
    ? {}
    : connectionStrokeDashFromLineType(maxResolvedLineWidth(rw), connectionData?.lineType);
  const markerFillStart = rc.cStart;
  const markerFillEnd = rc.cEnd;

  return (
    <>
      {/* Define arrowhead markers and shadow filter */}
      <defs>
        {hasShadow && (
          <filter id={shadowFilterId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
            <feOffset dx="0" dy="2" result="offsetblur"/>
            <feComponentTransfer result="shadow">
              <feFuncA type="linear" slope={resolvedTheme === "dark" ? "0.5" : "0.3"}/>
            </feComponentTransfer>
            {resolvedTheme === "dark" && (
              <>
                <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="glur"/>
                <feColorMatrix in="glur" type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.2 0" result="glow"/>
              </>
            )}
            <feMerge>
              {resolvedTheme === "dark" && <feMergeNode in="glow"/>}
              <feMergeNode in="shadow"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        )}
        {advancedLine && colorVaries && (
          <linearGradient
            id={lineGradientId}
            gradientUnits="userSpaceOnUse"
            x1={ribbonLayout.gx1}
            y1={ribbonLayout.gy1}
            x2={ribbonLayout.gx2}
            y2={ribbonLayout.gy2}
          >
            <stop offset="0%" stopColor={rc.cStart} />
            <stop offset="100%" stopColor={rc.cEnd} />
          </linearGradient>
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
              fill={markerFillStart}
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
              fill={markerFillEnd}
            />
          </marker>
        )}
      </defs>
      
      <g
        className="group"
        style={{ pointerEvents: 'auto', ...slideTransitionStyle }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        data-connection-id={connectionData?.from && connectionData?.to ? `${connectionData.from}-${connectionData.to}` : undefined}
      >
        {shouldRenderAnimationShapes && (
          <path id={motionPathId} d={pathData} fill="none" stroke="none" />
        )}
        <path
          d={pathData}
          stroke="transparent"
          strokeWidth={Math.max(20, maxResolvedLineWidth(rw) * 4)}
          fill="none"
        />
        {advancedLine ? (
          <>
            {ribbonLayout.ribbonPathD ? (
              <path
                d={ribbonLayout.ribbonPathD}
                fill={colorVaries ? `url(#${lineGradientId})` : rc.cStart}
                stroke="none"
                className="cursor-pointer connection-glow-hover transition-[filter] duration-200"
                filter={hasShadow ? `url(#${shadowFilterId})` : undefined}
              />
            ) : (
              <path
                d={pathData}
                stroke={colorVaries ? `url(#${lineGradientId})` : rc.cStart}
                strokeWidth={rw.wStart}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="cursor-pointer connection-glow-hover transition-[filter] duration-200"
                filter={hasShadow ? `url(#${shadowFilterId})` : undefined}
              />
            )}
            {showStartArrow && (
              <path
                d={pathData}
                fill="none"
                stroke="transparent"
                strokeWidth={rw.wStart}
                markerStart={`url(#${startMarkerId})`}
                pointerEvents="none"
              />
            )}
            {showEndArrow && (
              <path
                d={pathData}
                fill="none"
                stroke="transparent"
                strokeWidth={rw.wEnd}
                markerEnd={`url(#${endMarkerId})`}
                pointerEvents="none"
              />
            )}
          </>
        ) : (
          <path
            d={pathData}
            stroke={rc.cStart}
            className="cursor-pointer connection-glow-hover transition-[filter] duration-200"
            strokeWidth={connectionData?.lineWidth || 2.5}
            fill="none"
            strokeLinecap={strokeDashProps.strokeLinecap}
            strokeDasharray={strokeDashProps.strokeDasharray}
            markerStart={showStartArrow ? `url(#${startMarkerId})` : undefined}
            markerEnd={showEndArrow ? `url(#${endMarkerId})` : undefined}
            filter={hasShadow ? `url(#${shadowFilterId})` : undefined}
          />
        )}
        {shouldRenderAnimationShapes && Array.from({ length: renderedShapeCount }).map((_, index) => {
          const progress = renderedShapeCount > 0 ? index / renderedShapeCount : 0;

          if (shouldAnimateShapes && !useStaticExportAnimation) {
            const loopConfig = getLoopedAnimationPathConfig(progress, animation.speed);
            const scaleValues = scaleValuesForAnimationKeyPoints(loopConfig.keyPoints, rw);
            return (
              <g key={`animated-shape-${animationPhaseResetKey}-${index}`}>
                <g>
                  <animateTransform
                    attributeName="transform"
                    type="scale"
                    additive="replace"
                    values={scaleValues}
                    keyTimes={loopConfig.keyTimes}
                    dur={`${animationDuration}s`}
                    begin="0s"
                    repeatCount="indefinite"
                    calcMode="linear"
                  />
                  {renderAnimatedShape(animation.shape, baseAnimShapeSize, animationColor)}
                </g>
                <animateMotion
                  dur={`${animationDuration}s`}
                  begin="0s"
                  repeatCount="indefinite"
                  calcMode="linear"
                  keyTimes={loopConfig.keyTimes}
                  keyPoints={loopConfig.keyPoints}
                  rotate={animation.shape === 'arrow' || animation.shape === 'triangle' ? 'auto' : undefined}
                >
                  <mpath href={`#${motionPathId}`} />
                </animateMotion>
              </g>
            );
          }

          let effectiveProgress = progress;
          if (useStaticExportAnimation && pathLength > 0 && exportAnimationTimeSeconds !== null && exportAnimationTimeSeconds !== undefined) {
            const cyclesPerSecond = speedMagnitude / pathLength;
            const direction = animation.speed < 0 ? -1 : 1;
            const offset = exportAnimationTimeSeconds * cyclesPerSecond * direction;
            const wrapped = (progress + offset) % 1;
            effectiveProgress = wrapped < 0 ? wrapped + 1 : wrapped;
          }

          const distance = effectiveProgress * pathLength;
          const lookup = pathDistanceLookup!;
          const t = lookup.resolveT(distance, false);
          const point = getPointOnConnectionPath(t, fromX, fromY, toX, toY, fromAngle, toAngle, curvature, waypoints);
          const tangentT = lookup.resolveT(distance + 2, false);
          const tangentPoint = getPointOnConnectionPath(tangentT, fromX, fromY, toX, toY, fromAngle, toAngle, curvature, waypoints);
          const angleDeg = Math.atan2(tangentPoint.y - point.y, tangentPoint.x - point.x) * (180 / Math.PI);
          const arcFraction = pathLength > 0 ? Math.min(1, Math.max(0, distance / pathLength)) : 0;
          const staticShapeSize = animation.size * 2 * lineWidthAtPathFraction(rw, arcFraction);

          return (
            <g key={`static-shape-${animationPhaseResetKey}-${index}`} transform={`translate(${point.x}, ${point.y}) rotate(${angleDeg})`}>
              {renderAnimatedShape(animation.shape, staticShapeSize, animationColor)}
            </g>
          );
        })}
      </g>
    </>
  );
}

export const BezierConnection = React.memo(BezierConnectionInner, areBezierConnectionPropsEqual);

// Helper function to calculate bezier curve point at parameter t (0 to 1)
export function getBezierPoint(t: number, fromX: number, fromY: number, cp1X: number, cp1Y: number, cp2X: number, cp2Y: number, toX: number, toY: number): { x: number; y: number } {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;

  const x = uuu * fromX + 3 * uu * t * cp1X + 3 * u * tt * cp2X + ttt * toX;
  const y = uuu * fromY + 3 * uu * t * cp1Y + 3 * u * tt * cp2Y + ttt * toY;

  return { x, y };
}

// Helper function to calculate control points for bezier curve
export function calculateBezierControlPoints(fromX: number, fromY: number, toX: number, toY: number, curvature: number = 0.6, fromAngle: number = 0, toAngle: number = 0): { cp1X: number; cp1Y: number; cp2X: number; cp2Y: number } {
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
    default: {
      const uv = angleToUnitVector(fromAngle);
      cp1X = fromX + controlOffset * uv.x;
      cp1Y = fromY + controlOffset * uv.y;
    }
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
    default: {
      const uv = angleToUnitVector(toAngle);
      cp2X = toX + controlOffset * uv.x;
      cp2Y = toY + controlOffset * uv.y;
    }
  }
  
  return { cp1X, cp1Y, cp2X, cp2Y };
}

// Helper function to render connection text separately
export function BezierConnectionText({ connectionData, from, to, connectionColor }: BezierConnectionTextProps) {
  const { resolvedTheme } = useTheme();
  if (!connectionData?.text) return null;

  const connectionTextShadow = resolvedTheme === "dark"
    ? "0 0 3px rgba(0,0,0,1), 0 0 6px rgba(0,0,0,0.9), 1px 1px 4px rgba(0,0,0,0.9), -1px -1px 4px rgba(0,0,0,0.9), 1px -1px 4px rgba(0,0,0,0.9), -1px 1px 4px rgba(0,0,0,0.9)"
    : "0 0 3px rgba(255,255,255,1), 0 0 6px rgba(255,255,255,0.8), 1px 1px 4px rgba(255,255,255,1), -1px -1px 4px rgba(255,255,255,1), 1px -1px 4px rgba(255,255,255,1), -1px 1px 4px rgba(255,255,255,1)";

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
    const isFromShape = isShapeNodeType(from.type);
    const isToShape = isShapeNodeType(to.type);
    const isFromTextType = from.type === 'generic.text.text' || from.type === 'generic.text.textbox';
    const isToTextType = to.type === 'generic.text.text' || to.type === 'generic.text.textbox';
    
    const isFromIconNode = !isFromGroup && !isFromShape && !isFromTextType;
    const isToIconNode = !isToGroup && !isToShape && !isToTextType;
    const fromIconContainer = isFromIconNode ? getNodeSizeDimensions((from as any).nodeSize).container : undefined;
    const toIconContainer = isToIconNode ? getNodeSizeDimensions((to as any).nodeSize).container : undefined;

    let fromIconHeight: number | undefined;
    let toIconHeight: number | undefined;
    let fromIconOffset: number | undefined;
    let toIconOffset: number | undefined;
    
    if (!isFromGroup) {
      fromIconHeight = isFromShape ? (from.height || 48) : (isFromTextType ? fromHeight : (fromIconContainer ?? BASE_NODE_HEIGHT));
      // Calculate icon offset if text is positioned above (for regular nodes only)
      if (!isFromShape && !isFromTextType) {
        const textVerticalPosition = (from as any).textVerticalPosition || 'bottom';
        if (textVerticalPosition === 'top' && from.label && from.label.trim().length > 0) {
          const maxCharsPerLine = 16;
          const lines = Math.ceil(from.label.length / maxCharsPerLine);
          fromIconOffset = 20 + ((lines - 1) * 8);
        }
      }
    }
    // If isFromGroup, fromIconHeight remains undefined, so full height will be used
    
    if (!isToGroup) {
      toIconHeight = isToShape ? (to.height || 48) : (isToTextType ? toHeight : (toIconContainer ?? BASE_NODE_HEIGHT));
      // Calculate icon offset if text is positioned above (for regular nodes only)
      if (!isToShape && !isToTextType) {
        const textVerticalPosition = (to as any).textVerticalPosition || 'bottom';
        if (textVerticalPosition === 'top' && to.label && to.label.trim().length > 0) {
          const maxCharsPerLine = 16;
          const lines = Math.ceil(to.label.length / maxCharsPerLine);
          toIconOffset = 20 + ((lines - 1) * 8);
        }
      }
    }
    // If isToGroup, toIconHeight remains undefined, so full height will be used
    
    const fromIconWidth = isFromIconNode && fromIconContainer && fromWidth > fromIconContainer ? fromIconContainer : undefined;
    const fromIconOffsetX = fromIconWidth ? (fromWidth - fromIconWidth) / 2 : undefined;
    const toIconWidth = isToIconNode && toIconContainer && toWidth > toIconContainer ? toIconContainer : undefined;
    const toIconOffsetX = toIconWidth ? (toWidth - toIconWidth) / 2 : undefined;
    const connectionPoints = getOptimalConnectionPoints(from, to, fromWidth, fromHeight, toWidth, toHeight, connectionData, fromIconHeight, toIconHeight, fromIconOffset, toIconOffset, fromIconWidth, fromIconOffsetX, toIconWidth, toIconOffsetX);
    const { fromX, fromY, toX, toY, fromAngle, toAngle } = connectionPoints;

    const curvature = connectionData?.curvature || 0.6;
    const textPositionPercent = connectionData.textPosition || 50;
    const t = textPositionPercent / 100;
    const textPoint = getPointOnConnectionPath(t, fromX, fromY, toX, toY, fromAngle, toAngle, curvature, connectionData.waypoints);
    textX = textPoint.x;
    textY = textPoint.y;
  }

  const textColor = resolveBezierConnectionPaint(
    connectionData,
    connectionColor,
    from ?? { lineColor: undefined },
    to ?? { lineColor: undefined }
  ).cStart;

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
      fill={textColor}
      fontSize="12"
      fontWeight="500"
      textAnchor="middle"
      dominantBaseline="middle"
      className="pointer-events-none select-none"
      style={{
        textShadow: connectionTextShadow
      }}
    >
      {line}
    </text>
  ));
}