import React from "react";
import { BezierConnection, determineConnectionEdges, getOptimalConnectionPoints, calculateBezierControlPoints, getBezierPoint } from "../diagram/bezier-connection";
import type { DiagramData, DiagramConnectionData } from "@/lib/types";
import { measureNodeDims, type PositionedNode, type PositionedGroup, NODE_WIDTH, BASE_NODE_HEIGHT, TEXT_NODE_HEIGHT, EXTRA_LINE_HEIGHT } from "./canvas-constants";
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
  onConnectionDelete?: (from: string, to: string) => void;
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
  onConnectionDelete,
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
    <>
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
        
        // Only show delete button if a node/zone is selected and this connection is associated with it
        const shouldShowDeleteButton = selectedItemId && (selectedItemId === edge.from || selectedItemId === edge.to) && onConnectionDelete;

        // Calculate center point for delete button
        // Reuse similar logic from bezier-connection.tsx for calculating connection points
        const isFromShape = (fromPos.type === 'generic.object.square' || fromPos.type === 'generic.object.circle' ||
                             fromPos.type === 'generic.object.point' || fromPos.type === 'generic.object.rectangle' || fromPos.type === 'generic.object.rounded-rectangle' || fromPos.type === 'generic.object.triangle' ||
                             fromPos.type === 'generic.object.star' || fromPos.type === 'generic.object.cloud' ||
                             fromPos.type?.endsWith('.square') || fromPos.type?.endsWith('.circle') ||
                             fromPos.type?.endsWith('.point') || fromPos.type?.endsWith('.rectangle') || fromPos.type?.endsWith('.rounded-rectangle') || fromPos.type?.endsWith('.triangle') ||
                             fromPos.type?.endsWith('.star') || fromPos.type?.endsWith('.cloud'));
        const isToShape = (toPos.type === 'generic.object.square' || toPos.type === 'generic.object.circle' ||
                          toPos.type === 'generic.object.point' || toPos.type === 'generic.object.rectangle' || toPos.type === 'generic.object.rounded-rectangle' || toPos.type === 'generic.object.triangle' ||
                          toPos.type === 'generic.object.star' || toPos.type === 'generic.object.cloud' ||
                          toPos.type?.endsWith('.square') || toPos.type?.endsWith('.circle') ||
                          toPos.type?.endsWith('.point') || toPos.type?.endsWith('.rectangle') || toPos.type?.endsWith('.rounded-rectangle') || toPos.type?.endsWith('.triangle') ||
                          toPos.type?.endsWith('.star') || toPos.type?.endsWith('.cloud'));
        
        const isFromTextType = fromPos.type === 'generic.text.text' || fromPos.type === 'generic.text.textbox';
        const isToTextType = toPos.type === 'generic.text.text' || toPos.type === 'generic.text.textbox';
        
        const isFromGroup = fromPos.type === 'group' || fromPos.subType === 'zone';
        const isToGroup = toPos.type === 'group' || toPos.subType === 'zone';
        
        // Calculate node heights
        const calculateNodeHeight = (label: string = '', nodeType: string, sizeMode?: string, customHeight?: number) => {
          if (sizeMode === 'custom' && customHeight) return customHeight;
          if (nodeType === 'generic.text.textbox') {
            const maxCharsPerLine = 30;
            const lines = Math.max(1, Math.ceil(label.length / maxCharsPerLine));
            return 40 + ((lines - 1) * EXTRA_LINE_HEIGHT);
          } else if (nodeType === 'generic.text.text') {
            const maxCharsPerLine = 20;
            const lines = Math.ceil(label.length / maxCharsPerLine);
            return TEXT_NODE_HEIGHT + ((lines - 1) * EXTRA_LINE_HEIGHT);
          } else {
            const maxCharsPerLine = 12;
            const lines = Math.ceil(label.length / maxCharsPerLine);
            return BASE_NODE_HEIGHT + ((lines - 1) * EXTRA_LINE_HEIGHT);
          }
        };
        
        const fromCalculatedHeight = calculateNodeHeight((fromPos as any).label || '', fromPos.type, (fromPos as any).sizeMode, (fromPos as any).height);
        const toCalculatedHeight = calculateNodeHeight((toPos as any).label || '', toPos.type, (toPos as any).sizeMode, (toPos as any).height);
        
        // Calculate text under heights
        let fromTextUnderHeight = 0;
        let toTextUnderHeight = 0;
        
        if (isFromShape && (fromPos as any).label && ((fromPos as any).textPosition === 'under' || !(fromPos as any).textPosition)) {
          const maxCharsPerLine = 16;
          const lines = Math.ceil(((fromPos as any).label || '').length / maxCharsPerLine);
          fromTextUnderHeight = lines * 20;
        }
        
        if (isToShape && (toPos as any).label && ((toPos as any).textPosition === 'under' || !(toPos as any).textPosition)) {
          const maxCharsPerLine = 16;
          const lines = Math.ceil(((toPos as any).label || '').length / maxCharsPerLine);
          toTextUnderHeight = lines * 20;
        }
        
        if (!isFromShape && !isFromTextType && (fromPos as any).label && ((fromPos as any).label || '').trim().length > 0) {
          const maxCharsPerLine = 16;
          const lines = Math.ceil(((fromPos as any).label || '').length / maxCharsPerLine);
          fromTextUnderHeight = 20 + ((lines - 1) * 8);
        }
        
        if (!isToShape && !isToTextType && (toPos as any).label && ((toPos as any).label || '').trim().length > 0) {
          const maxCharsPerLine = 16;
          const lines = Math.ceil(((toPos as any).label || '').length / maxCharsPerLine);
          toTextUnderHeight = 20 + ((lines - 1) * 8);
        }
        
        const fromWidth = isFromGroup 
          ? ((fromPos as any).width || 300)
          : (isFromShape && (fromPos as any).width ? (fromPos as any).width : ((fromPos as any).width || NODE_WIDTH));
        const fromHeight = isFromGroup
          ? ((fromPos as any).height || 220)
          : (isFromShape && (fromPos as any).height ? (fromPos as any).height : (fromCalculatedHeight + fromTextUnderHeight));
        const toWidth = isToGroup
          ? ((toPos as any).width || 300)
          : (isToShape && (toPos as any).width ? (toPos as any).width : ((toPos as any).width || NODE_WIDTH));
        const toHeight = isToGroup
          ? ((toPos as any).height || 220)
          : (isToShape && (toPos as any).height ? (toPos as any).height : (toCalculatedHeight + toTextUnderHeight));
        
        // Calculate icon heights and offsets
        let fromIconHeight: number | undefined;
        let toIconHeight: number | undefined;
        let fromIconOffset: number | undefined;
        let toIconOffset: number | undefined;
        
        if (!isFromGroup) {
          if (isFromShape) {
            fromIconHeight = (fromPos as any).height || 48;
          } else if (isFromTextType) {
            fromIconHeight = fromCalculatedHeight;
          } else {
            fromIconHeight = BASE_NODE_HEIGHT;
            const textVerticalPosition = (fromPos as any).textVerticalPosition || 'bottom';
            if (textVerticalPosition === 'top' && (fromPos as any).label && ((fromPos as any).label || '').trim().length > 0) {
              const maxCharsPerLine = 16;
              const lines = Math.ceil(((fromPos as any).label || '').length / maxCharsPerLine);
              fromIconOffset = 20 + ((lines - 1) * 8);
            }
          }
        }
        
        if (!isToGroup) {
          if (isToShape) {
            toIconHeight = (toPos as any).height || 48;
          } else if (isToTextType) {
            toIconHeight = toCalculatedHeight;
          } else {
            toIconHeight = BASE_NODE_HEIGHT;
            const textVerticalPosition = (toPos as any).textVerticalPosition || 'bottom';
            if (textVerticalPosition === 'top' && (toPos as any).label && ((toPos as any).label || '').trim().length > 0) {
              const maxCharsPerLine = 16;
              const lines = Math.ceil(((toPos as any).label || '').length / maxCharsPerLine);
              toIconOffset = 20 + ((lines - 1) * 8);
            }
          }
        }
        
        // Calculate connection points
        const connectionPoints = getOptimalConnectionPoints(fromPos, toPos, fromWidth, fromHeight, toWidth, toHeight, enhancedEdge, fromIconHeight, toIconHeight, fromIconOffset, toIconOffset);
        const { fromX, fromY, toX, toY, fromAngle, toAngle } = connectionPoints;
        
        // Calculate control points for bezier curve
        const curvature = edge?.curvature || 0.6;
        const { cp1X, cp1Y, cp2X, cp2Y } = calculateBezierControlPoints(
          fromX, 
          fromY, 
          toX, 
          toY, 
          curvature, 
          fromAngle, 
          toAngle
        );
        
        // Get center point (t = 0.5)
        const centerPoint = getBezierPoint(0.5, fromX, fromY, cp1X, cp1Y, cp2X, cp2Y, toX, toY);

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
    {/* Render delete buttons outside SVG so they're clickable */}
    {(diagramData.connections || []).map((edge: any, index: any) => {
      const fromItem = nodesById[edge.from] || zonesById[edge.from];
      const toItem = nodesById[edge.to] || zonesById[edge.to];
      if (!fromItem || !toItem) return null;

      // Only show delete button if a node/zone is selected and this connection is associated with it
      const shouldShowDeleteButton = selectedItemId && (selectedItemId === edge.from || selectedItemId === edge.to) && onConnectionDelete;
      if (!shouldShowDeleteButton) return null;

      // Recalculate center point for delete button (same logic as above)
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
      
      fromPos.lineColor = (fromItem as any).lineColor;
      toPos.lineColor = (toItem as any).lineColor;
      
      const connKey = `${edge.from}-${edge.to}-${index}`;
      const edges = connectionEdgeInfo.get(connKey) || determineConnectionEdges(fromPos, toPos, edge, fromItemDims.width, fromItemDims.height, toItemDims.width, toItemDims.height);
      
      const fromEdgeKey = `${edge.from}-${edges.fromEdge}`;
      const toEdgeKey = `${edge.to}-${edges.toEdge}`;
      const fromEdgeConnections = edgeGroups.get(fromEdgeKey) || [];
      const toEdgeConnections = edgeGroups.get(toEdgeKey) || [];
      const fromEdgeIndex = fromEdgeConnections.findIndex((item: any) => item.connIndex === index);
      const toEdgeIndex = toEdgeConnections.findIndex((item: any) => item.connIndex === index);
      
      const enhancedEdge = {
        ...edge,
        fromPreferredExit: edges.fromEdge,
        toPreferredEntry: edges.toEdge,
        connectionIndex: fromEdgeIndex >= 0 ? fromEdgeIndex : 0,
        totalConnections: fromEdgeConnections.length > 0 ? fromEdgeConnections.length : 1,
        toConnectionIndex: toEdgeIndex >= 0 ? toEdgeIndex : 0,
        toTotalConnections: toEdgeConnections.length > 0 ? toEdgeConnections.length : 1,
      };

      // Calculate center point (simplified - reuse same calculation logic)
      const isFromShape = (fromPos.type === 'generic.object.square' || fromPos.type === 'generic.object.circle' ||
                           fromPos.type === 'generic.object.point' || fromPos.type === 'generic.object.rectangle' || fromPos.type === 'generic.object.rounded-rectangle' || fromPos.type === 'generic.object.triangle' ||
                           fromPos.type === 'generic.object.star' || fromPos.type === 'generic.object.cloud' ||
                           fromPos.type?.endsWith('.square') || fromPos.type?.endsWith('.circle') ||
                           fromPos.type?.endsWith('.point') || fromPos.type?.endsWith('.rectangle') || fromPos.type?.endsWith('.rounded-rectangle') || fromPos.type?.endsWith('.triangle') ||
                           fromPos.type?.endsWith('.star') || fromPos.type?.endsWith('.cloud'));
      const isToShape = (toPos.type === 'generic.object.square' || toPos.type === 'generic.object.circle' ||
                        toPos.type === 'generic.object.point' || toPos.type === 'generic.object.rectangle' || toPos.type === 'generic.object.rounded-rectangle' || toPos.type === 'generic.object.triangle' ||
                        toPos.type === 'generic.object.star' || toPos.type === 'generic.object.cloud' ||
                        toPos.type?.endsWith('.square') || toPos.type?.endsWith('.circle') ||
                        toPos.type?.endsWith('.point') || toPos.type?.endsWith('.rectangle') || toPos.type?.endsWith('.rounded-rectangle') || toPos.type?.endsWith('.triangle') ||
                        toPos.type?.endsWith('.star') || toPos.type?.endsWith('.cloud'));
      const isFromTextType = fromPos.type === 'generic.text.text' || fromPos.type === 'generic.text.textbox';
      const isToTextType = toPos.type === 'generic.text.text' || toPos.type === 'generic.text.textbox';
      const isFromGroup = fromPos.type === 'group' || fromPos.subType === 'zone';
      const isToGroup = toPos.type === 'group' || toPos.subType === 'zone';
      
      const calculateNodeHeight = (label: string = '', nodeType: string, sizeMode?: string, customHeight?: number) => {
        if (sizeMode === 'custom' && customHeight) return customHeight;
        if (nodeType === 'generic.text.textbox') {
          const maxCharsPerLine = 30;
          const lines = Math.max(1, Math.ceil(label.length / maxCharsPerLine));
          return 40 + ((lines - 1) * EXTRA_LINE_HEIGHT);
        } else if (nodeType === 'generic.text.text') {
          const maxCharsPerLine = 20;
          const lines = Math.ceil(label.length / maxCharsPerLine);
          return TEXT_NODE_HEIGHT + ((lines - 1) * EXTRA_LINE_HEIGHT);
        } else {
          const maxCharsPerLine = 12;
          const lines = Math.ceil(label.length / maxCharsPerLine);
          return BASE_NODE_HEIGHT + ((lines - 1) * EXTRA_LINE_HEIGHT);
        }
      };
      
      const fromCalculatedHeight = calculateNodeHeight((fromPos as any).label || '', fromPos.type, (fromPos as any).sizeMode, (fromPos as any).height);
      const toCalculatedHeight = calculateNodeHeight((toPos as any).label || '', toPos.type, (toPos as any).sizeMode, (toPos as any).height);
      
      let fromTextUnderHeight = 0;
      let toTextUnderHeight = 0;
      if (isFromShape && (fromPos as any).label && ((fromPos as any).textPosition === 'under' || !(fromPos as any).textPosition)) {
        const maxCharsPerLine = 16;
        const lines = Math.ceil(((fromPos as any).label || '').length / maxCharsPerLine);
        fromTextUnderHeight = lines * 20;
      }
      if (isToShape && (toPos as any).label && ((toPos as any).textPosition === 'under' || !(toPos as any).textPosition)) {
        const maxCharsPerLine = 16;
        const lines = Math.ceil(((toPos as any).label || '').length / maxCharsPerLine);
        toTextUnderHeight = lines * 20;
      }
      if (!isFromShape && !isFromTextType && (fromPos as any).label && ((fromPos as any).label || '').trim().length > 0) {
        const maxCharsPerLine = 16;
        const lines = Math.ceil(((fromPos as any).label || '').length / maxCharsPerLine);
        fromTextUnderHeight = 20 + ((lines - 1) * 8);
      }
      if (!isToShape && !isToTextType && (toPos as any).label && ((toPos as any).label || '').trim().length > 0) {
        const maxCharsPerLine = 16;
        const lines = Math.ceil(((toPos as any).label || '').length / maxCharsPerLine);
        toTextUnderHeight = 20 + ((lines - 1) * 8);
      }
      
      const fromWidth = isFromGroup ? ((fromPos as any).width || 300) : (isFromShape && (fromPos as any).width ? (fromPos as any).width : ((fromPos as any).width || NODE_WIDTH));
      const fromHeight = isFromGroup ? ((fromPos as any).height || 220) : (isFromShape && (fromPos as any).height ? (fromPos as any).height : (fromCalculatedHeight + fromTextUnderHeight));
      const toWidth = isToGroup ? ((toPos as any).width || 300) : (isToShape && (toPos as any).width ? (toPos as any).width : ((toPos as any).width || NODE_WIDTH));
      const toHeight = isToGroup ? ((toPos as any).height || 220) : (isToShape && (toPos as any).height ? (toPos as any).height : (toCalculatedHeight + toTextUnderHeight));
      
      let fromIconHeight: number | undefined;
      let toIconHeight: number | undefined;
      let fromIconOffset: number | undefined;
      let toIconOffset: number | undefined;
      
      if (!isFromGroup) {
        if (isFromShape) {
          fromIconHeight = (fromPos as any).height || 48;
        } else if (isFromTextType) {
          fromIconHeight = fromCalculatedHeight;
        } else {
          fromIconHeight = BASE_NODE_HEIGHT;
          const textVerticalPosition = (fromPos as any).textVerticalPosition || 'bottom';
          if (textVerticalPosition === 'top' && (fromPos as any).label && ((fromPos as any).label || '').trim().length > 0) {
            const maxCharsPerLine = 16;
            const lines = Math.ceil(((fromPos as any).label || '').length / maxCharsPerLine);
            fromIconOffset = 20 + ((lines - 1) * 8);
          }
        }
      }
      
      if (!isToGroup) {
        if (isToShape) {
          toIconHeight = (toPos as any).height || 48;
        } else if (isToTextType) {
          toIconHeight = toCalculatedHeight;
        } else {
          toIconHeight = BASE_NODE_HEIGHT;
          const textVerticalPosition = (toPos as any).textVerticalPosition || 'bottom';
          if (textVerticalPosition === 'top' && (toPos as any).label && ((toPos as any).label || '').trim().length > 0) {
            const maxCharsPerLine = 16;
            const lines = Math.ceil(((toPos as any).label || '').length / maxCharsPerLine);
            toIconOffset = 20 + ((lines - 1) * 8);
          }
        }
      }
      
      const connectionPoints = getOptimalConnectionPoints(fromPos, toPos, fromWidth, fromHeight, toWidth, toHeight, enhancedEdge, fromIconHeight, toIconHeight, fromIconOffset, toIconOffset);
      const { fromX, fromY, toX, toY, fromAngle, toAngle } = connectionPoints;
      const curvature = edge?.curvature || 0.6;
      const { cp1X, cp1Y, cp2X, cp2Y } = calculateBezierControlPoints(fromX, fromY, toX, toY, curvature, fromAngle, toAngle);
      const centerPoint = getBezierPoint(0.5, fromX, fromY, cp1X, cp1Y, cp2X, cp2Y, toX, toY);

      return (
        <div
          key={`delete-${edge.from}-${edge.to}-${index}`}
          className="absolute cursor-pointer"
          style={{
            zIndex: 15,
            left: `${centerPoint.x - 12}px`,
            top: `${centerPoint.y - 12}px`,
            width: '24px',
            height: '24px',
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            if (onConnectionDelete) {
              onConnectionDelete(edge.from, edge.to);
            }
          }}
          title="Remove connection"
        >
          <svg
            width="24"
            height="24"
            className="pointer-events-none"
          >
            {/* White circle background */}
            <circle
              cx="12"
              cy="12"
              r="12"
              fill="white"
              stroke="#ef4444"
              strokeWidth="2"
              style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}
            />
            {/* Red X icon */}
            <g stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="6" y1="18" x2="18" y2="6" />
            </g>
          </svg>
        </div>
      );
    })}
    </>
  );
}

