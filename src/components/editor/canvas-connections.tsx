import React from "react";
import { BezierConnection, determineConnectionEdges } from "../diagram/bezier-connection";
import type { DiagramData, DiagramConnectionData } from "@/lib/types";
import { measureNodeDims, type PositionedNode, type PositionedGroup } from "./canvas-constants";
import { cn } from "@/lib/utils";

interface CanvasConnectionsProps {
  width: number;
  height: number;
  diagramData: DiagramData;
  nodesById: Record<string, PositionedNode>;
  zonesById: Record<string, PositionedGroup>;
  selectedItemId?: string;
  onItemSelect: (item: any | null) => void;
  closeContextMenu: () => void;
}

export function CanvasConnections({
  width,
  height,
  diagramData,
  nodesById,
  zonesById,
  selectedItemId,
  onItemSelect,
  closeContextMenu,
}: CanvasConnectionsProps) {
  // Pre-calculate edge information for all connections
  const connectionEdgeInfo = new Map<string, { fromEdge: string; toEdge: string }>();
  const edgeGroups = new Map<string, any[]>();
  
  // First pass: determine edges for all connections and group by node+edge
  (diagramData.connections || []).forEach((conn: any, connIndex: number) => {
    const fromItem = nodesById[conn.from] || zonesById[conn.from];
    const toItem = nodesById[conn.to] || zonesById[conn.to];
    if (!fromItem || !toItem) return;
    
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
    
    const edges = determineConnectionEdges(fromPos, toPos, conn, fromItemDims.width, fromItemDims.height, toItemDims.width, toItemDims.height);
    const edgeKey = `${conn.from}-${edges.fromEdge}`;
    const toEdgeKey = `${conn.to}-${edges.toEdge}`;
    
    // Use a unique key for this connection
    const connKey = `${conn.from}-${conn.to}-${connIndex}`;
    connectionEdgeInfo.set(connKey, edges);
    
    // Group connections by from node + from edge
    if (!edgeGroups.has(edgeKey)) {
      edgeGroups.set(edgeKey, []);
    }
    edgeGroups.get(edgeKey)!.push({ conn, connIndex, isFrom: true });
    
    // Group connections by to node + to edge
    if (!edgeGroups.has(toEdgeKey)) {
      edgeGroups.set(toEdgeKey, []);
    }
    edgeGroups.get(toEdgeKey)!.push({ conn, connIndex, isFrom: false });
  });
  
  return (
    <svg
      width={width}
      height={height}
      className="absolute top-0 left-0 overflow-visible pointer-events-none"
      style={{ zIndex: 1 }}
    >
      <defs>
        <marker
          id="arrowhead"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" className="fill-current text-muted-foreground" />
        </marker>
      </defs>
      {/* Count connections per edge for distribution */}
      {(diagramData.connections || []).map((edge: any, index: any) => {
        const fromItem = nodesById[edge.from] || zonesById[edge.from];
        const toItem = nodesById[edge.to] || zonesById[edge.to];
        if (!fromItem || !toItem) return null;

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
        const connKey = `${edge.from}-${edge.to}-${index}`;
        const edges = connectionEdgeInfo.get(connKey) || determineConnectionEdges(fromPos, toPos, edge, fromItemDims.width, fromItemDims.height, toItemDims.width, toItemDims.height);
        
        // Calculate per-edge indices
        const fromEdgeKey = `${edge.from}-${edges.fromEdge}`;
        const toEdgeKey = `${edge.to}-${edges.toEdge}`;
        
        const fromEdgeConnections = edgeGroups.get(fromEdgeKey) || [];
        const toEdgeConnections = edgeGroups.get(toEdgeKey) || [];
        
        const fromEdgeIndex = fromEdgeConnections.findIndex((item: any) => item.connIndex === index);
        const toEdgeIndex = toEdgeConnections.findIndex((item: any) => item.connIndex === index);
        
        const fromEdgeTotal = fromEdgeConnections.length;
        const toEdgeTotal = toEdgeConnections.length;
        
        // Update edge with per-edge connection distribution info
        const enhancedEdge = {
          ...edge,
          fromPreferredExit: edges.fromEdge,
          toPreferredEntry: edges.toEdge,
          // Use from edge info for from node
          connectionIndex: fromEdgeIndex >= 0 ? fromEdgeIndex : 0,
          totalConnections: fromEdgeTotal > 0 ? fromEdgeTotal : 1,
          // Store to edge info separately for the "to" node
          toConnectionIndex: toEdgeIndex >= 0 ? toEdgeIndex : 0,
          toTotalConnections: toEdgeTotal > 0 ? toEdgeTotal : 1,
        };

        // Check if this connection is selected
        const edgeId = `${edge.from}-${edge.to}`;
        const isConnectionHighlighted = selectedItemId === edge.from || selectedItemId === edge.to || selectedItemId === edgeId;

        return (
          <g key={`${edge.from}-${edge.to}-${index}-${edge.toArrow ? 'arrow' : 'noarrow'}-${edge._updated || ''}`} className={cn(isConnectionHighlighted && 'drop-shadow-[0_0_6px_rgba(0,200,150,0.8)]')}>
            <BezierConnection
              from={fromPos}
              to={toPos}
              connectionColor={edge.color}
              connectionData={enhancedEdge}
              onClick={(connection) => {
                // Select the connection when clicked
                closeContextMenu();
                if (onItemSelect) {
                  onItemSelect({
                    ...connection,
                    itemType: 'edge',
                    id: `${connection.from}-${connection.to}`
                  });
                }
              }}
            />
          </g>
        );
      })}
    </svg>
  );
}

