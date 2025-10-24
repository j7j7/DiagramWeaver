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
  from: Positionable;
  to: Positionable;
  allObstacles: Obstacle[];
  allowedOverlapIds?: string[]; // obstacles with these IDs are ignored when routing
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

export function DiagramEdge({ from, to, allObstacles, allowedOverlapIds = [] }: DiagramEdgeProps) {
  const fromWidth = from.width || NODE_WIDTH;
  const fromHeight = from.height || NODE_HEIGHT;
  const toWidth = to.width || NODE_WIDTH;
  const toHeight = to.height || NODE_HEIGHT;

  const fromX = from.x + fromWidth / 2;
  const fromY = from.y + fromHeight / 2;
  const toX = to.x + toWidth / 2;
  const toY = to.y + toHeight / 2;

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

  return (
    <path
      d={roundedPath}
      className="stroke-current transition-all duration-300"
      strokeWidth="2.5"
      fill="none"
    />
  );
}
