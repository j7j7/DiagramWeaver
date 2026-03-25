import React from "react";
import { BezierConnectionText } from "../diagram/bezier-connection";
import { determineConnectionEdges } from "../diagram/bezier-connection";
import type { DiagramConnectionData, DiagramData } from "@/lib/types";
import { measureNodeDims, type PositionedNode, type PositionedGroup } from "./canvas-constants";

interface CanvasConnectionTextProps {
  width: number;
  height: number;
  diagramData: DiagramData;
  nodesById: Record<string, PositionedNode>;
  zonesById: Record<string, PositionedGroup>;
  processedZones: PositionedGroup[];
  /** Slide / layer transition styles (same keys as CanvasConnections) */
  connectionAnimationStyles?: Map<string, {
    opacity: number;
    transition: string;
    slideEndpointOffset?: { fromDx: number; fromDy: number; toDx: number; toDy: number };
    slideWaypointOffsets?: Array<{ dx: number; dy: number }>;
  }>;
  connectionKey?: (conn: DiagramConnectionData) => string;
}

function areCanvasConnectionTextPropsEqual(prev: CanvasConnectionTextProps, next: CanvasConnectionTextProps): boolean {
  return prev.width === next.width &&
    prev.height === next.height &&
    prev.diagramData === next.diagramData &&
    prev.nodesById === next.nodesById &&
    prev.zonesById === next.zonesById &&
    prev.processedZones === next.processedZones &&
    prev.connectionAnimationStyles === next.connectionAnimationStyles &&
    prev.connectionKey === next.connectionKey;
}

function CanvasConnectionTextInner(props: CanvasConnectionTextProps) {
  const { width, height, diagramData, nodesById, zonesById, processedZones, connectionAnimationStyles, connectionKey } = props;
  return (
    <svg
      width={width}
      height={height}
      className="absolute top-0 left-0 overflow-visible pointer-events-none"
      style={{ zIndex: 9999 }}
    >
      {(diagramData.connections || []).map((edge: any, index: any) => {
        const fromItem = nodesById[edge.from] || zonesById[edge.from];
        const toItem = nodesById[edge.to] || zonesById[edge.to];
        if (!fromItem || !toItem || !edge.text) return null;
        // Orthogonal connections render text inline; skip here
        if (edge.style === 'orthogonal') return null;

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

        const stableConnKey = connectionKey ? connectionKey(edge) : null;
        const slideConnStyle = stableConnKey && connectionAnimationStyles ? connectionAnimationStyles.get(stableConnKey) : undefined;
        const slideOff = slideConnStyle?.slideEndpointOffset;
        const slideWpOff = slideConnStyle?.slideWaypointOffsets;

        const geomFrom = slideOff
          ? { ...fromPos, x: (fromPos.x ?? 0) + slideOff.fromDx, y: (fromPos.y ?? 0) + slideOff.fromDy }
          : fromPos;
        const geomTo = slideOff
          ? { ...toPos, x: (toPos.x ?? 0) + slideOff.toDx, y: (toPos.y ?? 0) + slideOff.toDy }
          : toPos;
        
        // Get edge information for this connection
        const edges = determineConnectionEdges(geomFrom, geomTo, edge, fromItemDims.width, fromItemDims.height, toItemDims.width, toItemDims.height);

        let edgeConnData: any = {
          ...edge,
          fromPreferredExit: edges.fromEdge,
          toPreferredEntry: edges.toEdge,
        };
        if (slideWpOff && edgeConnData.waypoints?.length) {
          edgeConnData = {
            ...edgeConnData,
            waypoints: edgeConnData.waypoints.map((w: { x: number; y: number }, i: number) => ({
              ...w,
              x: w.x + (slideWpOff[i]?.dx ?? 0),
              y: w.y + (slideWpOff[i]?.dy ?? 0),
            })),
          };
        }

        return (
          <BezierConnectionText
            key={`connection-text-${edge.from}-${edge.to}-${index}`}
            connectionData={edgeConnData}
            from={geomFrom}
            to={geomTo}
            connectionColor={edge.color}
          />
        );
      })}
    </svg>
  );
}

export const CanvasConnectionText = React.memo(CanvasConnectionTextInner, areCanvasConnectionTextPropsEqual);

