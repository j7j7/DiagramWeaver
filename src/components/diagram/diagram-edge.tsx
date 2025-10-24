"use client";

import type { DiagramNodeData, DiagramGroupData } from "@/lib/types";
import React from "react";
import { findPath } from "@/lib/pathfinding";
import type { Obstacle } from "@/lib/pathfinding";

const NODE_WIDTH = 128;
const NODE_HEIGHT = 100;
const CANVAS_PADDING = 20;

type Positionable = (DiagramNodeData | DiagramGroupData) & { x: number; y: number; width: number; height: number; };

interface DiagramEdgeProps {
  from: Positionable;
  to: Positionable;
  allObstacles: Obstacle[];
}

export function DiagramEdge({ from, to, allObstacles }: DiagramEdgeProps) {
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

  // Exclude the 'from' and 'to' nodes from the obstacles list to allow paths to start/end inside them
  const obstaclesForPath = allObstacles.filter(o => o.id !== from.id && o.id !== to.id);

  const path = findPath(
    { x: fromX, y: fromY },
    { x: toX, y: toY },
    obstaclesForPath,
    { width: maxX, height: maxY }
  );
  
  const pathData = "M" + path.map(p => `${p.x} ${p.y}`).join(" L");

  return (
    <path
      d={pathData}
      className="stroke-current text-muted-foreground transition-all duration-300"
      strokeWidth="2"
      fill="none"
      markerEnd="url(#arrowhead)"
    />
  );
}
