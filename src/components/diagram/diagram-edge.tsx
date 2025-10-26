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

interface DiagramEdgeProps {
  from: Positionable & { lineColor?: string };
  to: Positionable & { lineColor?: string };
  allObstacles: Obstacle[];
  allowedOverlapIds?: string[]; // obstacles with these IDs are ignored when routing
  edgeColor?: string; // Specific color for this edge
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

  // For group-to-group connections, use boundary points instead of centers
  const isFromGroup = 'type' in from && from.type === 'group';
  const isToGroup = 'type' in to && to.type === 'group';

  if (isFromGroup && isToGroup) {
    // Calculate direction from from-center to to-center
    const dx = toCenterX - fromCenterX;
    const dy = toCenterY - fromCenterY;
    
    // Determine connection points on group boundaries
    let fromX = fromCenterX;
    let fromY = fromCenterY;
    let toX = toCenterX;
    let toY = toCenterY;

    // Find the best edge for each group based on direction
    if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal connection is primary
      if (dx > 0) {
        // From left to right
        fromX = from.x + fromWidth;
        toX = to.x;
      } else {
        // From right to left
        fromX = from.x;
        toX = to.x + toWidth;
      }
      // Keep Y coordinates at center for vertical alignment
    } else {
      // Vertical connection is primary
      if (dy > 0) {
        // From top to bottom
        fromY = from.y + fromHeight;
        toY = to.y;
      } else {
        // From bottom to top
        fromY = from.y;
        toY = to.y + toHeight;
      }
      // Keep X coordinates at center for horizontal alignment
    }

    return { fromX, fromY, toX, toY };
  }

  // For non-group-to-group connections, use centers
  return {
    fromX: fromCenterX,
    fromY: fromCenterY,
    toX: toCenterX,
    toY: toCenterY
  };
}

export function DiagramEdge({ from, to, allObstacles, allowedOverlapIds = [], edgeColor }: DiagramEdgeProps) {
  const connectionPoints = getGroupBoundaryConnection(from, to);
  const { fromX, fromY, toX, toY } = connectionPoints;

  // Determine grid dimensions
  const maxX = Math.max(...allObstacles.map(e => e.x + e.width)) + CANVAS_PADDING * 2;
  const maxY = Math.max(...allObstacles.map(e => e.y + e.height)) + CANVAS_PADDING * 2;

  // Exclude endpoints and any allowedOverlapIds (e.g., ancestor groups of endpoints) from obstacles
  const allowed = new Set<string>([from.id, to.id, ...allowedOverlapIds]);
  const obstaclesForPath = allObstacles.filter(o => !allowed.has(o.id));

  const path = findPath(
    { x: fromX, y: fromY },
    { x: toX, y: toY },
    obstaclesForPath,
    { width: maxX, height: maxY }
  );

  const roundedPath = roundedPathData(path, CORNER_RADIUS);

  // Use edge color first, then 'to' node, fallback to 'from' node, then default
  const finalEdgeColor = edgeColor || to.lineColor || from.lineColor || '#6b7280';

  return (
    <path
      d={roundedPath}
      stroke={finalEdgeColor}
      className="transition-all duration-300"
      strokeWidth="2.5"
      fill="none"
    />
  );
}
