import React from "react";
import { BezierConnectionText } from "../diagram/bezier-connection";
import { determineConnectionEdges } from "../diagram/bezier-connection";
import type { DiagramData } from "@/lib/types";
import { measureNodeDims, type PositionedNode, type PositionedGroup } from "./canvas-constants";

interface CanvasConnectionTextProps {
  width: number;
  height: number;
  diagramData: DiagramData;
  nodesById: Record<string, PositionedNode>;
  zonesById: Record<string, PositionedGroup>;
  processedZones: PositionedGroup[];
}

export function CanvasConnectionText({
  width,
  height,
  diagramData,
  nodesById,
  zonesById,
  processedZones,
}: CanvasConnectionTextProps) {
  return (
    <svg
      width={width}
      height={height}
      className="absolute top-0 left-0 overflow-visible pointer-events-none"
      style={{ zIndex: 2 }}
    >
      {(diagramData.connections || []).map((edge: any, index: any) => {
        const fromItem = nodesById[edge.from] || zonesById[edge.from];
        const toItem = nodesById[edge.to] || zonesById[edge.to];
        if (!fromItem || !toItem || !edge.text) return null;

        // Use measured dimensions for nodes to ensure proper connection alignment
        const fromItemDims = 'type' in fromItem ? measureNodeDims(fromItem as PositionedNode) : { width: (fromItem as any).width, height: (fromItem as any).height };
        const toItemDims = 'type' in toItem ? measureNodeDims(toItem as PositionedNode) : { width: (toItem as any).width, height: (toItem as any).height };
        
        const fromPos: any = {
          ...fromItem,
          width: 'width' in fromItem ? (fromItem as any).width : fromItemDims.width,
          height: 'height' in fromItem ? (fromItem as any).height : fromItemDims.height,
        };
        const toPos: any = {
          ...toItem,
          width: 'width' in toItem ? (toItem as any).width : toItemDims.width,
          height: 'height' in toItem ? (toItem as any).height : toItemDims.height,
        };

        // Explicitly set lineColor after spreading to ensure it's not overwritten
        fromPos.lineColor = (fromItem as any).lineColor;
        toPos.lineColor = (toItem as any).lineColor;
        
        // Get edge information for this connection
        const edges = determineConnectionEdges(fromPos, toPos, edge, fromItemDims.width, fromItemDims.height, toItemDims.width, toItemDims.height);

        return (
          <BezierConnectionText
            key={`connection-text-${edge.from}-${edge.to}-${index}`}
            connectionData={{
              ...edge,
              fromPreferredExit: edges.fromEdge,
              toPreferredEntry: edges.toEdge,
            }}
            from={fromPos}
            to={toPos}
            connectionColor={edge.color}
          />
        );
      })}
    </svg>
  );
}

