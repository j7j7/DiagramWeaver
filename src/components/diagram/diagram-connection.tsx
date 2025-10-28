"use client";

import type { DiagramNodeData, DiagramGroupData } from "@/lib/types";
import React from "react";
import { findPath } from "@/lib/pathfinding";
import type { Obstacle } from "@/lib/pathfinding";

const NODE_WIDTH = 104;
const NODE_HEIGHT = 100;
const CANVAS_PADDING = 20;
const CORNER_RADIUS = 12;

type Positionable = (DiagramNodeData | DiagramGroupData) & { x: number; y: number; width: number; height: number; };

interface DiagramConnectionProps {
  from: Positionable & { lineColor?: string };
  to: Positionable & { lineColor?: string };
  allObstacles: Obstacle[];
  allowedOverlapIds?: string[]; // obstacles with these IDs are ignored when routing
  connectionColor?: string; // Specific color for this connection
}

function roundedPathData(points: {x: number; y: number}[], r: number): string {
  if (!points.length) return '';
  if (points.length < 2) return `M${points[0].x} ${points[0].y}`;
  const cmds: string[] = [];
  cmds.push(`M${points[0].x} ${points[0].y}`);
  for (let i = 1; i < points.length; i++) {
    const p0 = points[i - 1];
    const p1 = points[i];

    // Shorten current segment to leave space for a corner into the next segment
    let endX = p1.x, endY = p1.y;
    if (i < points.length - 1) {
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      const len = Math.max(Math.abs(dx), Math.abs(dy));
      const cut = Math.min(r, len / 2);
      if (dx !== 0) {
        endX = dx > 0 ? p1.x - cut : p1.x + cut;
      } else if (dy !== 0) {
        endY = dy > 0 ? p1.y - cut : p1.y + cut;
      }
    }
    cmds.push(`L${endX} ${endY}`);

    if (i < points.length - 1) {
      // Draw rounded corner using p1 as control point towards the next segment
      const p2 = points[i + 1];
      const dx2 = p2.x - p1.x;
      const dy2 = p2.y - p1.y;
      const len2 = Math.max(Math.abs(dx2), Math.abs(dy2));
      const cut2 = Math.min(r, len2 / 2);
      let cornerEndX = p1.x, cornerEndY = p1.y;
      if (dx2 !== 0) {
        cornerEndX = dx2 > 0 ? p1.x + cut2 : p1.x - cut2;
        cornerEndY = p1.y;
      } else if (dy2 !== 0) {
        cornerEndX = p1.x;
        cornerEndY = dy2 > 0 ? p1.y + cut2 : p1.y - cut2;
      }
      cmds.push(`Q${p1.x} ${p1.y} ${cornerEndX} ${cornerEndY}`);
    }
  }
  return cmds.join(' ');
}

function getGroupBoundaryConnection(from: any, to: any): { fromX: number; fromY: number; toX: number; toY: number } {
  const fromWidth = from.width || NODE_WIDTH;
  const fromHeight = from.height || NODE_HEIGHT;
  const toWidth = to.width || NODE_WIDTH;
  const toHeight = to.height || NODE_HEIGHT;

  const fromCenterX = from.x + fromWidth / 2;
  const fromCenterY = from.y + fromHeight / 2;
  const toCenterX = to.x + toWidth / 2;
  const toCenterY = to.y + toHeight / 2;

  // Check if either object is a group or zone
  const isFromGroup = 'type' in from && from.type === 'group';
  const isToGroup = 'type' in to && to.type === 'group';
  const isFromZone = from.subType === 'zone';
  const isToZone = to.subType === 'zone';

  // For connections involving groups or zones, calculate smart boundary points
  if (isFromGroup || isToGroup || isFromZone || isToZone) {
    return getSmartBoundaryConnection(from, to, fromCenterX, fromCenterY, toCenterX, toCenterY, fromWidth, fromHeight, toWidth, toHeight);
  }

  // For node-to-node connections, use centers
  return {
    fromX: fromCenterX,
    fromY: fromCenterY,
    toX: toCenterX,
    toY: toCenterY
  };
}

// Advanced multi-point connection analysis to prevent edge-hugging
function getSmartBoundaryConnection(from: any, to: any, fromCenterX: number, fromCenterY: number, toCenterX: number, toCenterY: number, fromWidth: number, fromHeight: number, toWidth: number, toHeight: number): { fromX: number; fromY: number; toX: number; toY: number } {
  const isFromContainer = from.type === 'group' || from.subType === 'zone';
  const isToContainer = to.type === 'group' || to.subType === 'zone';
  
  // For non-containers, use centers
  let fromX = fromCenterX;
  let fromY = fromCenterY;
  let toX = toCenterX;
  let toY = toCenterY;
  
  // If neither is a container, return centers
  if (!isFromContainer && !isToContainer) {
    return { fromX, fromY, toX, toY };
  }
  
  // Generate all possible connection points
  const fromPoints = isFromContainer ? generateConnectionPoints(from, fromWidth, fromHeight) : [{ x: fromCenterX, y: fromCenterY, side: 'center' }];
  const toPoints = isToContainer ? generateConnectionPoints(to, toWidth, toHeight) : [{ x: toCenterX, y: toCenterY, side: 'center' }];
  
  // Evaluate all combinations and find the best one
  let bestConnection = { fromX, fromY, toX, toY };
  let bestScore = -Infinity;
  
  for (const fromPoint of fromPoints) {
    for (const toPoint of toPoints) {
      const score = evaluateConnectionPath(fromPoint, toPoint, from, to);
      
      
      
      if (score > bestScore) {
        bestScore = score;
        bestConnection = {
          fromX: fromPoint.x,
          fromY: fromPoint.y,
          toX: toPoint.x,
          toY: toPoint.y
        };
      }
    }
  }
  
  
  
  return bestConnection;
}

// Generate the 4 cardinal connection points for a container
function generateConnectionPoints(obj: any, width: number, height: number) {
  const centerX = obj.x + width / 2;
  const centerY = obj.y + height / 2;
  
  return [
    { x: obj.x + width, y: centerY, side: 'right' },   // Right edge
    { x: obj.x, y: centerY, side: 'left' },            // Left edge
    { x: centerX, y: obj.y, side: 'top' },             // Top edge
    { x: centerX, y: obj.y + height, side: 'bottom' }  // Bottom edge
  ];
}

// Evaluate a connection path to determine if it would cause edge-hugging
function evaluateConnectionPath(fromPoint: any, toPoint: any, fromObj: any, toObj: any): number {
  let score = 1000; // Start with a base score
  
  const dx = toPoint.x - fromPoint.x;
  const dy = toPoint.y - fromPoint.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // Factor 1: Prefer shorter connections (but don't let this dominate)
  score -= distance / 20;
  
  // Factor 2: Heavily penalize connections that would cause edge-hugging (this is the most important)
  const edgeHuggingPenalty = detectPotentialEdgeHugging(fromPoint, toPoint, fromObj, toObj);
  score -= edgeHuggingPenalty;
  
  // Factor 3: Prefer orthogonal paths (horizontal or vertical alignment)
  if (Math.abs(dx) < 10) score += 100;  // Nearly vertical
  if (Math.abs(dy) < 10) score += 100;  // Nearly horizontal
  
  // Factor 4: Directional logic - prefer connections that make sense geometrically
  const geometricScore = calculateGeometricScore(fromPoint, toPoint, fromObj, toObj);
  score += geometricScore;
  
  // Factor 5: Bonus for clean L-shaped paths that avoid problematic routing
  if (isCleanLShapedPath(fromPoint, toPoint, fromObj, toObj)) {
    score += 200;
  }
  
  return score;
}

// Check if this would create a clean L-shaped path
function isCleanLShapedPath(fromPoint: any, toPoint: any, fromObj: any, toObj: any): boolean {
  const dx = toPoint.x - fromPoint.x;
  const dy = toPoint.y - fromPoint.y;
  
  // Reward paths that go perpendicular to the exit direction
  if (fromPoint.side === 'bottom' && Math.abs(dx) > Math.abs(dy) * 2) {
    return true; // Exiting bottom and going mostly horizontal
  }
  if (fromPoint.side === 'right' && Math.abs(dy) > Math.abs(dx) * 2) {
    return true; // Exiting right and going mostly vertical
  }
  if (fromPoint.side === 'top' && Math.abs(dx) > Math.abs(dy) * 2) {
    return true; // Exiting top and going mostly horizontal
  }
  if (fromPoint.side === 'left' && Math.abs(dy) > Math.abs(dx) * 2) {
    return true; // Exiting left and going mostly vertical
  }
  
  return false;
}

// Detect if a connection would cause edge-hugging by simulating the path
function detectPotentialEdgeHugging(fromPoint: any, toPoint: any, fromObj: any, toObj: any): number {
  let penalty = 0;
  
  // Check if the connection runs along any container edges
  const containers = [fromObj, toObj].filter(obj => obj.type === 'group' || obj.subType === 'zone');
  
  for (const container of containers) {
    // Check if the path runs along container edges
    const edgeHuggingScore = checkForEdgeParallelism(fromPoint, toPoint, container);
    penalty += edgeHuggingScore;
    
    // Also check general proximity
    const edgeProximity = calculatePathEdgeProximity(fromPoint, toPoint, container);
    if (edgeProximity < 40) { // Path runs very close to or along an edge
      penalty += 300 - (edgeProximity * 5); // Higher penalty for closer proximity
    }
  }
  
  return penalty;
}

// Check if a path runs parallel to any container edge
function checkForEdgeParallelism(fromPoint: any, toPoint: any, container: any): number {
  const dx = toPoint.x - fromPoint.x;
  const dy = toPoint.y - fromPoint.y;
  let penalty = 0;
  
  // Define container edges
  const edges = {
    top: { y: container.y, isHorizontal: true },
    bottom: { y: container.y + container.height, isHorizontal: true },
    left: { x: container.x, isHorizontal: false },
    right: { x: container.x + container.width, isHorizontal: false }
  };
  
  // Check for horizontal path along top/bottom edges
  if (Math.abs(dy) < 20) { // Nearly horizontal path
    const pathY = fromPoint.y;
    if (Math.abs(pathY - edges.top.y) < 30) {
      penalty += 1000; // Massive penalty for running along top edge
    }
    if (Math.abs(pathY - edges.bottom.y) < 30) {
      penalty += 1000; // Massive penalty for running along bottom edge
    }
  }
  
  // Check for vertical path along left/right edges
  if (Math.abs(dx) < 20) { // Nearly vertical path
    const pathX = fromPoint.x;
    if (Math.abs(pathX - edges.left.x) < 30) {
      penalty += 1000; // Massive penalty for running along left edge
    }
    if (Math.abs(pathX - edges.right.x) < 30) {
      penalty += 1000; // Massive penalty for running along right edge
    }
  }
  
  // Special case: Check if the path exits from one edge and immediately runs along another
  if (fromPoint.side) {
    const exitProximityPenalty = checkExitEdgeProximity(fromPoint, toPoint, container);
    penalty += exitProximityPenalty;
  }
  
  return penalty;
}

// Check if exiting from one edge leads to running along another edge
function checkExitEdgeProximity(fromPoint: any, toPoint: any, container: any): number {
  const dx = toPoint.x - fromPoint.x;
  const dy = toPoint.y - fromPoint.y;
  let penalty = 0;
  
  // If exiting from bottom of container and path goes horizontally
  if (fromPoint.side === 'bottom' && Math.abs(dy) < Math.abs(dx)) {
    const exitY = fromPoint.y;
    const bottomEdgeY = container.y + container.height;
    if (Math.abs(exitY - bottomEdgeY) < 10) {
      penalty += 800; // Heavy penalty for horizontal path from bottom edge
    }
  }
  
  // If exiting from right of container and path goes vertically
  if (fromPoint.side === 'right' && Math.abs(dx) < Math.abs(dy)) {
    const exitX = fromPoint.x;
    const rightEdgeX = container.x + container.width;
    if (Math.abs(exitX - rightEdgeX) < 10) {
      penalty += 800; // Heavy penalty for vertical path from right edge
    }
  }
  
  // Similar checks for left and top
  if (fromPoint.side === 'left' && Math.abs(dx) < Math.abs(dy)) {
    const exitX = fromPoint.x;
    const leftEdgeX = container.x;
    if (Math.abs(exitX - leftEdgeX) < 10) {
      penalty += 800;
    }
  }
  
  if (fromPoint.side === 'top' && Math.abs(dy) < Math.abs(dx)) {
    const exitY = fromPoint.y;
    const topEdgeY = container.y;
    if (Math.abs(exitY - topEdgeY) < 10) {
      penalty += 800;
    }
  }
  
  return penalty;
}

// Calculate how close a straight path would come to the edges of a container
function calculatePathEdgeProximity(fromPoint: any, toPoint: any, container: any): number {
  const edges = [
    { x1: container.x, y1: container.y, x2: container.x + container.width, y2: container.y }, // Top
    { x1: container.x + container.width, y1: container.y, x2: container.x + container.width, y2: container.y + container.height }, // Right
    { x1: container.x, y1: container.y + container.height, x2: container.x + container.width, y2: container.y + container.height }, // Bottom
    { x1: container.x, y1: container.y, x2: container.x, y2: container.y + container.height } // Left
  ];
  
  let minDistance = Infinity;
  
  for (const edge of edges) {
    const distance = distanceFromPointToLineSegment(fromPoint, toPoint, edge);
    minDistance = Math.min(minDistance, distance);
  }
  
  return minDistance;
}

// Calculate distance from a line (path) to a line segment (edge)
function distanceFromPointToLineSegment(fromPoint: any, toPoint: any, edge: any): number {
  // This is a simplified version - we check key points along the path
  const pathPoints = [
    fromPoint,
    { x: fromPoint.x + (toPoint.x - fromPoint.x) * 0.25, y: fromPoint.y + (toPoint.y - fromPoint.y) * 0.25 },
    { x: fromPoint.x + (toPoint.x - fromPoint.x) * 0.5, y: fromPoint.y + (toPoint.y - fromPoint.y) * 0.5 },
    { x: fromPoint.x + (toPoint.x - fromPoint.x) * 0.75, y: fromPoint.y + (toPoint.y - fromPoint.y) * 0.75 },
    toPoint
  ];
  
  let minDistance = Infinity;
  
  for (const point of pathPoints) {
    const distance = distanceFromPointToLine(point, edge);
    minDistance = Math.min(minDistance, distance);
  }
  
  return minDistance;
}

// Calculate distance from a point to a line segment
function distanceFromPointToLine(point: any, edge: any): number {
  const dx = edge.x2 - edge.x1;
  const dy = edge.y2 - edge.y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  
  if (length === 0) return Math.sqrt(Math.pow(point.x - edge.x1, 2) + Math.pow(point.y - edge.y1, 2));
  
  const t = Math.max(0, Math.min(1, ((point.x - edge.x1) * dx + (point.y - edge.y1) * dy) / (length * length)));
  const projectionX = edge.x1 + t * dx;
  const projectionY = edge.y1 + t * dy;
  
  return Math.sqrt(Math.pow(point.x - projectionX, 2) + Math.pow(point.y - projectionY, 2));
}

// Calculate geometric score based on connection logic
function calculateGeometricScore(fromPoint: any, toPoint: any, fromObj: any, toObj: any): number {
  let score = 0;
  
  const dx = toPoint.x - fromPoint.x;
  const dy = toPoint.y - fromPoint.y;
  
  // Reward connections that make geometric sense
  if (fromPoint.side === 'right' && dx > 0) score += 30;  // Exiting right and going right
  if (fromPoint.side === 'left' && dx < 0) score += 30;   // Exiting left and going left
  if (fromPoint.side === 'bottom' && dy > 0) score += 30; // Exiting bottom and going down
  if (fromPoint.side === 'top' && dy < 0) score += 30;    // Exiting top and going up
  
  // Penalize connections that go backwards
  if (fromPoint.side === 'right' && dx < -20) score -= 50;
  if (fromPoint.side === 'left' && dx > 20) score -= 50;
  if (fromPoint.side === 'bottom' && dy < -20) score -= 50;
  if (fromPoint.side === 'top' && dy > 20) score -= 50;
  
  return score;
}

function getDirectConnectionForCloseObjects(from: any, to: any, fromCenterX: number, fromCenterY: number, toCenterX: number, toCenterY: number, fromWidth: number, fromHeight: number, toWidth: number, toHeight: number, dx: number, dy: number): { fromX: number; fromY: number; toX: number; toY: number } {
  // For close objects, find the most direct connection possible
  
  // Check if objects are overlapping or very close horizontally
  const horizontalOverlap = Math.max(0, Math.min(from.x + fromWidth, to.x + toWidth) - Math.max(from.x, to.x));
  const verticalOverlap = Math.max(0, Math.min(from.y + fromHeight, to.y + toHeight) - Math.max(from.y, to.y));
  
  // If there's significant overlap, use the closest edges
  if (horizontalOverlap > 20) {
    // Vertical alignment - connect top to bottom or bottom to top
    if (from.y < to.y) {
      return {
        fromX: fromCenterX,
        fromY: from.y + fromHeight,
        toX: toCenterX,
        toY: to.y
      };
    } else {
      return {
        fromX: fromCenterX,
        fromY: from.y,
        toX: toCenterX,
        toY: to.y + toHeight
      };
    }
  }
  
  if (verticalOverlap > 20) {
    // Horizontal alignment - connect left to right or right to left
    if (from.x < to.x) {
      return {
        fromX: from.x + fromWidth,
        fromY: fromCenterY,
        toX: to.x,
        toY: toCenterY
      };
    } else {
      return {
        fromX: from.x,
        fromY: fromCenterY,
        toX: to.x + toWidth,
        toY: toCenterY
      };
    }
  }
  
  // No significant overlap - try more flexible connection points for close objects
  const isFromZone = from.subType === 'zone';
  const isToZone = to.subType === 'zone';
  
  // Generate more candidate connection points including center entries for zones
  const candidates = [];
  
  // Standard edge connections
  candidates.push(
    { fromX: from.x + fromWidth, fromY: fromCenterY, toX: to.x, toY: toCenterY, dist: Math.abs(to.x - (from.x + fromWidth)) + Math.abs(toCenterY - fromCenterY) },
    { fromX: from.x, fromY: fromCenterY, toX: to.x + toWidth, toY: toCenterY, dist: Math.abs((to.x + toWidth) - from.x) + Math.abs(toCenterY - fromCenterY) },
    { fromX: fromCenterX, fromY: from.y + fromHeight, toX: toCenterX, toY: to.y, dist: Math.abs(toCenterX - fromCenterX) + Math.abs(to.y - (from.y + fromHeight)) },
    { fromX: fromCenterX, fromY: from.y, toX: toCenterX, toY: to.y + toHeight, dist: Math.abs(toCenterX - fromCenterX) + Math.abs((to.y + toHeight) - from.y) }
  );
  
  // For zones, allow center entry points for more direct routing
  if (isToZone) {
    candidates.push(
      { fromX: from.x + fromWidth, fromY: fromCenterY, toX: toCenterX, toY: toCenterY, dist: Math.abs(toCenterX - (from.x + fromWidth)) + Math.abs(toCenterY - fromCenterY) },
      { fromX: from.x, fromY: fromCenterY, toX: toCenterX, toY: toCenterY, dist: Math.abs(toCenterX - from.x) + Math.abs(toCenterY - fromCenterY) },
      { fromX: fromCenterX, fromY: from.y + fromHeight, toX: toCenterX, toY: toCenterY, dist: Math.abs(toCenterX - fromCenterX) + Math.abs(toCenterY - (from.y + fromHeight)) },
      { fromX: fromCenterX, fromY: from.y, toX: toCenterX, toY: toCenterY, dist: Math.abs(toCenterX - fromCenterX) + Math.abs(toCenterY - from.y) }
    );
  }
  
  if (isFromZone) {
    candidates.push(
      { fromX: fromCenterX, fromY: fromCenterY, toX: to.x, toY: toCenterY, dist: Math.abs(to.x - fromCenterX) + Math.abs(toCenterY - fromCenterY) },
      { fromX: fromCenterX, fromY: fromCenterY, toX: to.x + toWidth, toY: toCenterY, dist: Math.abs((to.x + toWidth) - fromCenterX) + Math.abs(toCenterY - fromCenterY) },
      { fromX: fromCenterX, fromY: fromCenterY, toX: toCenterX, toY: to.y, dist: Math.abs(toCenterX - fromCenterX) + Math.abs(to.y - fromCenterY) },
      { fromX: fromCenterX, fromY: fromCenterY, toX: toCenterX, toY: to.y + toHeight, dist: Math.abs(toCenterX - fromCenterX) + Math.abs((to.y + toHeight) - fromCenterY) }
    );
  }
  
  // Sort by distance and return the closest
  candidates.sort((a, b) => a.dist - b.dist);
  const closest = candidates[0];
  
  return {
    fromX: closest.fromX,
    fromY: closest.fromY,
    toX: closest.toX,
    toY: closest.toY
  };
}

// Revolutionary middle-point connection strategy for groups and zones
function getMiddlePointConnection(from: any, to: any, fromCenterX: number, fromCenterY: number, toCenterX: number, toCenterY: number, fromWidth: number, fromHeight: number, toWidth: number, toHeight: number, dx: number, dy: number): { fromX: number; fromY: number; toX: number; toY: number } {
  // For proper group entry, we need to ensure the connection goes INTO the group, not along its edge
  const isFromGroup = from.type === 'group';
  const isToGroup = to.type === 'group';
  const isFromZone = from.subType === 'zone';
  const isToZone = to.subType === 'zone';
  
  // Calculate clearance distances to avoid edge routing
  const clearanceDistance = 20; // Minimum distance from edges
  
  // Determine connection strategy based on object types and positions
  let fromX, fromY, toX, toY;
  
  // For zone-to-group or node-to-group connections, prioritize proper group entry
  if (!isFromGroup && (isToGroup || isToZone)) {
    // Target is a group/zone - ensure we enter it properly, not along its edge
    const targetClearanceX = Math.min(clearanceDistance, toWidth * 0.2);
    const targetClearanceY = Math.min(clearanceDistance, toHeight * 0.2);
    
    if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal primary direction
      if (dx > 0) {
        // Entering from the left
        fromX = from.x + fromWidth;
        fromY = fromCenterY;
        toX = to.x + targetClearanceX; // Enter well inside the group
        toY = to.y + toHeight / 2;
      } else {
        // Entering from the right
        fromX = from.x;
        fromY = fromCenterY;
        toX = to.x + toWidth - targetClearanceX; // Enter well inside the group
        toY = to.y + toHeight / 2;
      }
    } else {
      // Vertical primary direction
      if (dy > 0) {
        // Entering from the top
        fromX = fromCenterX;
        fromY = from.y + fromHeight;
        toX = to.x + toWidth / 2;
        toY = to.y + targetClearanceY; // Enter well inside the group
      } else {
        // Entering from the bottom
        fromX = fromCenterX;
        fromY = from.y;
        toX = to.x + toWidth / 2;
        toY = to.y + toHeight - targetClearanceY; // Enter well inside the group
      }
    }
  } else if ((isFromGroup || isFromZone) && !isToGroup) {
    // Source is a group/zone, target is not - ensure we exit properly
    const sourceClearanceX = Math.min(clearanceDistance, fromWidth * 0.2);
    const sourceClearanceY = Math.min(clearanceDistance, fromHeight * 0.2);
    
    if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal primary direction
      if (dx > 0) {
        // Exiting to the right
        fromX = from.x + fromWidth - sourceClearanceX; // Exit from well inside
        fromY = from.y + fromHeight / 2;
        toX = to.x;
        toY = toCenterY;
      } else {
        // Exiting to the left
        fromX = from.x + sourceClearanceX; // Exit from well inside
        fromY = from.y + fromHeight / 2;
        toX = to.x + toWidth;
        toY = toCenterY;
      }
    } else {
      // Vertical primary direction
      if (dy > 0) {
        // Exiting downward
        fromX = from.x + fromWidth / 2;
        fromY = from.y + fromHeight - sourceClearanceY; // Exit from well inside
        toX = toCenterX;
        toY = to.y;
      } else {
        // Exiting upward
        fromX = from.x + fromWidth / 2;
        fromY = from.y + sourceClearanceY; // Exit from well inside
        toX = toCenterX;
        toY = to.y + toHeight;
      }
    }
  } else {
    // Group-to-group or zone-to-zone connections
    const sourceClearanceX = Math.min(clearanceDistance, fromWidth * 0.15);
    const sourceClearanceY = Math.min(clearanceDistance, fromHeight * 0.15);
    const targetClearanceX = Math.min(clearanceDistance, toWidth * 0.15);
    const targetClearanceY = Math.min(clearanceDistance, toHeight * 0.15);
    
    if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal connection
      if (dx > 0) {
        fromX = from.x + fromWidth - sourceClearanceX;
        fromY = from.y + fromHeight / 2;
        toX = to.x + targetClearanceX;
        toY = to.y + toHeight / 2;
      } else {
        fromX = from.x + sourceClearanceX;
        fromY = from.y + fromHeight / 2;
        toX = to.x + toWidth - targetClearanceX;
        toY = to.y + toHeight / 2;
      }
    } else {
      // Vertical connection
      if (dy > 0) {
        fromX = from.x + fromWidth / 2;
        fromY = from.y + fromHeight - sourceClearanceY;
        toX = to.x + toWidth / 2;
        toY = to.y + targetClearanceY;
      } else {
        fromX = from.x + fromWidth / 2;
        fromY = from.y + sourceClearanceY;
        toX = to.x + toWidth / 2;
        toY = to.y + toHeight - targetClearanceY;
      }
    }
  }
  
  return { fromX, fromY, toX, toY };
}

// Generate smart connection points that consider object types and relationships
function generateSmartConnectionPoints(obj: any, centerX: number, centerY: number, width: number, height: number, dx: number, dy: number, role: 'from' | 'to') {
  const isGroup = obj.type === 'group';
  const isZone = obj.subType === 'zone';
  const points = [];
  
  // Base connection points (edge midpoints)
  const basePoints = [
    { x: obj.x + width, y: centerY, side: 'right', direction: { x: 1, y: 0 } },
    { x: obj.x, y: centerY, side: 'left', direction: { x: -1, y: 0 } },
    { x: centerX, y: obj.y + height, side: 'bottom', direction: { x: 0, y: 1 } },
    { x: centerX, y: obj.y, side: 'top', direction: { x: 0, y: -1 } }
  ];
  
  // For groups and zones, add additional strategic points
  if (isGroup || isZone) {
    // Add quarter points for better connection flexibility
    points.push(
      { x: obj.x + width, y: obj.y + height * 0.25, side: 'right', direction: { x: 1, y: 0 } },
      { x: obj.x + width, y: obj.y + height * 0.75, side: 'right', direction: { x: 1, y: 0 } },
      { x: obj.x, y: obj.y + height * 0.25, side: 'left', direction: { x: -1, y: 0 } },
      { x: obj.x, y: obj.y + height * 0.75, side: 'left', direction: { x: -1, y: 0 } },
      { x: obj.x + width * 0.25, y: obj.y + height, side: 'bottom', direction: { x: 0, y: 1 } },
      { x: obj.x + width * 0.75, y: obj.y + height, side: 'bottom', direction: { x: 0, y: 1 } },
      { x: obj.x + width * 0.25, y: obj.y, side: 'top', direction: { x: 0, y: -1 } },
      { x: obj.x + width * 0.75, y: obj.y, side: 'top', direction: { x: 0, y: -1 } }
    );
  }
  
  // Always include the base points
  points.push(...basePoints);
  
  return points;
}

// Enhanced connection scoring with improved logic for groups and zones
function calculateEnhancedConnectionScore(fromPoint: any, toPoint: any, from: any, to: any, dx: number, dy: number, centerDistance: number): number {
  let score = 0;

  const connectionDx = toPoint.x - fromPoint.x;
  const connectionDy = toPoint.y - fromPoint.y;
  const connectionDistance = Math.sqrt(connectionDx * connectionDx + connectionDy * connectionDy);
  
  // Factor 1: Directional alignment - heavily reward connections that follow the general direction
  const directionAlignment = (connectionDx * dx + connectionDy * dy) / (Math.sqrt(dx * dx + dy * dy) * connectionDistance + 0.001);
  score += directionAlignment * 70; // Increased weight for better alignment

  // Factor 2: Distance efficiency - reward shorter connections
  score -= connectionDistance * 0.3;

  // Factor 3: Group/Zone specific bonuses
  const isFromGroup = from.type === 'group' || from.subType === 'zone';
  const isToGroup = to.type === 'group' || to.subType === 'zone';
  
  if (isFromGroup && isToGroup) {
    // Both are groups/zones - heavily reward middle-point connections
    const isFromMiddle = fromPoint.side === 'right' || fromPoint.side === 'left' ? 
      Math.abs(fromPoint.y - (from.y + from.height / 2)) < 5 : 
      Math.abs(fromPoint.x - (from.x + from.width / 2)) < 5;
      
    const isToMiddle = toPoint.side === 'right' || toPoint.side === 'left' ? 
      Math.abs(toPoint.y - (to.y + to.height / 2)) < 5 : 
      Math.abs(toPoint.x - (to.x + to.width / 2)) < 5;
    
    if (isFromMiddle) score += 50;
    if (isToMiddle) score += 50;
    
    // Heavily penalize edge-hugging for group-to-group connections
    if (fromPoint.side === 'right' && Math.abs(connectionDy) > Math.abs(connectionDx) * 0.5) {
      score -= 100; // Very heavy penalty
    }
    if (fromPoint.side === 'bottom' && Math.abs(connectionDx) > Math.abs(connectionDy) * 0.5) {
      score -= 100; // Very heavy penalty
    }
  }

  // Factor 4: Orthogonal preference
  const isOrthogonal = (Math.abs(connectionDx) < 10 || Math.abs(connectionDy) < 10);
  if (isOrthogonal) {
    score += 30; // Strong bonus for orthogonal connections
  }

  // Factor 5: Avoid backwards connections
  if (fromPoint.side === 'right' && connectionDx < -20) score -= 50;
  if (fromPoint.side === 'left' && connectionDx > 20) score -= 50;
  if (fromPoint.side === 'bottom' && connectionDy < -20) score -= 50;
  if (fromPoint.side === 'top' && connectionDy > 20) score -= 50;

  // Factor 6: Proximity bonus for close objects
  if (centerDistance < 200) {
    score += 25;
    if (connectionDistance < 100) {
      score += 25; // Extra bonus for very direct close connections
    }
  }
  
  // Factor 7: Primary direction alignment
  const isPrimaryHorizontal = Math.abs(dx) > Math.abs(dy);
  if (isPrimaryHorizontal) {
    if (fromPoint.side === 'right' || fromPoint.side === 'left') {
      score += 30; // Reward horizontal exits for horizontal movement
    }
  } else {
    if (fromPoint.side === 'top' || fromPoint.side === 'bottom') {
      score += 30; // Reward vertical exits for vertical movement
    }
  }

  return score;
}

// Legacy function for backward compatibility
function calculateConnectionScore(fromPoint: any, toPoint: any, from: any, to: any, dx: number, dy: number): number {
  return calculateEnhancedConnectionScore(fromPoint, toPoint, from, to, dx, dy, Math.sqrt(dx * dx + dy * dy));
}

export function DiagramConnection({ from, to, allObstacles, allowedOverlapIds = [], connectionColor }: DiagramConnectionProps) {
  const connectionPoints = getGroupBoundaryConnection(from, to);
  const { fromX, fromY, toX, toY } = connectionPoints;

  // Determine grid dimensions
  const maxX = Math.max(...allObstacles.map((e: any) => e.x + e.width)) + CANVAS_PADDING * 2;
  const maxY = Math.max(...allObstacles.map((e: any) => e.y + e.height)) + CANVAS_PADDING * 2;

  // Exclude endpoints and any allowedOverlapIds (e.g., ancestor groups of endpoints) from obstacles
  const allowed = new Set<string>([from.id, to.id, ...allowedOverlapIds]);
  const obstaclesForPath = allObstacles.filter((o: any) => !allowed.has(o.id));

  const path = findPath(
    { x: fromX, y: fromY },
    { x: toX, y: toY },
    obstaclesForPath,
    { width: maxX, height: maxY }
  );

  const roundedPath = roundedPathData(path, CORNER_RADIUS);

  // Use connection color first, then 'to' node, fallback to 'from' node, then default
  const finalConnectionColor = connectionColor || to.lineColor || from.lineColor || '#6b7280';

  return (
    <path
      d={roundedPath}
      stroke={finalConnectionColor}
      className="transition-all duration-300"
      strokeWidth="2.5"
      fill="none"
    />
  );
}
