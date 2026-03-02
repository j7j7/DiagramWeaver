import React from "react";
import { BezierConnection, determineConnectionEdges, getOptimalConnectionPoints, calculateBezierControlPoints, getBezierPoint } from "../diagram/bezier-connection";
import type { DiagramData, DiagramConnectionData } from "@/lib/types";
import { measureNodeDims, type PositionedNode, type PositionedGroup, NODE_WIDTH, BASE_NODE_HEIGHT, TEXT_NODE_HEIGHT, EXTRA_LINE_HEIGHT } from "./canvas-constants";
import { getNodeSizeDimensions } from "@/lib/visual-styling";
import { cn, isIconOrEmojiType, isShapeNodeType } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface CanvasConnectionsProps {
  width: number;
  height: number;
  diagramData: DiagramData;
  nodesById: Record<string, PositionedNode>;
  zonesById: Record<string, PositionedGroup>;
  selectedItemId?: string;
  selectedItem?: any;
  selectedItemIds?: Set<string>;
  onItemSelect: (item: any | null, multiSelectModifier?: boolean) => void;
  closeContextMenu: () => void;
  onConnectionDelete?: (from: string, to: string) => void;
  /** Called when user right-clicks on a connection line */
  onConnectionContextMenu?: (e: React.MouseEvent, connection: DiagramConnectionData) => void;
  /** Called when connection properties need to be updated */
  onConnectionUpdate?: (from: string, to: string, updates: Record<string, unknown>) => void;
  /** Called when a waypoint needs to be added */
  onConnectionWaypointAdd?: (from: string, to: string) => void;
  /** When set, only render connections whose index is in this set (for order-aware layering) */
  connectionIndices?: Set<number>;
  /** Z-index for this connection layer when using order-aware layering (enables interleaving with nodes) */
  stackZIndex?: number;
  /** During GIF export, advances animation deterministically per frame */
  exportAnimationTimeSeconds?: number | null;
}

function setsEqual(a: Set<number> | undefined, b: Set<number> | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return a === b;
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

function areCanvasConnectionsPropsEqual(prev: CanvasConnectionsProps, next: CanvasConnectionsProps): boolean {
  return prev.width === next.width &&
    prev.height === next.height &&
    prev.selectedItemId === next.selectedItemId &&
    prev.selectedItemIds === next.selectedItemIds &&
    prev.stackZIndex === next.stackZIndex &&
    prev.exportAnimationTimeSeconds === next.exportAnimationTimeSeconds &&
    prev.diagramData === next.diagramData &&
    prev.nodesById === next.nodesById &&
    prev.zonesById === next.zonesById &&
    prev.onItemSelect === next.onItemSelect &&
    prev.closeContextMenu === next.closeContextMenu &&
    prev.onConnectionDelete === next.onConnectionDelete &&
    prev.onConnectionContextMenu === next.onConnectionContextMenu &&
    setsEqual(prev.connectionIndices, next.connectionIndices);
}

function CanvasConnectionsInner(props: CanvasConnectionsProps) {
  const {
    width,
    height,
    diagramData,
    nodesById,
    zonesById,
    selectedItemId,
    selectedItem,
    selectedItemIds,
    onItemSelect,
    closeContextMenu,
    onConnectionDelete,
    onConnectionContextMenu,
    onConnectionUpdate,
    onConnectionWaypointAdd,
    connectionIndices,
    stackZIndex,
    exportAnimationTimeSeconds,
  } = props;
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
    
    // Compute center for sorting by relative target position
    const toCenterY = (toPos as any).y + ((toPos as any).height ?? toItemDims.height) / 2;
    const toCenterX = (toPos as any).x + ((toPos as any).width ?? toItemDims.width) / 2;
    const fromCenterY = (fromPos as any).y + ((fromPos as any).height ?? fromItemDims.height) / 2;
    const fromCenterX = (fromPos as any).x + ((fromPos as any).width ?? fromItemDims.width) / 2;

    // Group connections by from node + from edge
    if (!edgeGroups.has(edgeKey)) {
      edgeGroups.set(edgeKey, []);
    }
    // For from edge: sort by target position so connections fan out toward their destinations
    const fromSortCoord = edges.fromEdge === 'left' || edges.fromEdge === 'right' ? toCenterY : toCenterX;
    edgeGroups.get(edgeKey)!.push({ conn, connIndex, isFrom: true, sortCoord: fromSortCoord });

    // Group connections by to node + to edge
    if (!edgeGroups.has(toEdgeKey)) {
      edgeGroups.set(toEdgeKey, []);
    }
    // For to edge: sort by source position so incoming connections align with their origins
    const toSortCoord = edges.toEdge === 'left' || edges.toEdge === 'right' ? fromCenterY : fromCenterX;
    edgeGroups.get(toEdgeKey)!.push({ conn, connIndex, isFrom: false, sortCoord: toSortCoord });
  });

  // Sort each edge group by relative position to reduce overlapping lines
  edgeGroups.forEach((arr) => {
    arr.sort((a: { sortCoord: number }, b: { sortCoord: number }) => a.sortCoord - b.sortCoord);
  });
  
  return (
    <>
    <svg
      width={width}
      height={height}
      className="absolute top-0 left-0 overflow-visible pointer-events-none"
      style={{ zIndex: stackZIndex ?? (connectionIndices !== undefined ? 0 : 1) }}
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
      {(diagramData.connections || [])
        .map((edge: any, index: number) => (connectionIndices ? { edge, index } : { edge, index }))
        .filter(({ index }: { index: number }) => !connectionIndices || connectionIndices.has(index))
        .map(({ edge, index }: { edge: any; index: number }) => {
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

        // Check if this connection is selected (only highlight when connection itself is selected, not when a node is selected)
        const edgeId = `${edge.from}-${edge.to}`;
        const isConnectionHighlighted = selectedItemId === edgeId || (selectedItemIds?.has(edgeId) ?? false);
        
        // Only show delete button if a node/zone is selected and this connection is associated with it
        const shouldShowDeleteButton = selectedItemId && (selectedItemId === edge.from || selectedItemId === edge.to) && onConnectionDelete;

        // Calculate center point for delete button
        // Reuse similar logic from bezier-connection.tsx for calculating connection points
        const isFromShape = isShapeNodeType(fromPos.type);
        const isToShape = isShapeNodeType(toPos.type);
        
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
        
        const isFromIconNode = !isFromGroup && !isFromShape && !isFromTextType;
        const isToIconNode = !isToGroup && !isToShape && !isToTextType;
        const fromIconContainer = isFromIconNode ? getNodeSizeDimensions((fromPos as any).nodeSize).container : undefined;
        const toIconContainer = isToIconNode ? getNodeSizeDimensions((toPos as any).nodeSize).container : undefined;

        if (!isFromGroup) {
          if (isFromShape) {
            fromIconHeight = (fromPos as any).height || 48;
          } else if (isFromTextType) {
            fromIconHeight = fromCalculatedHeight;
          } else {
            fromIconHeight = fromIconContainer ?? BASE_NODE_HEIGHT;
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
            toIconHeight = toIconContainer ?? BASE_NODE_HEIGHT;
            const textVerticalPosition = (toPos as any).textVerticalPosition || 'bottom';
            if (textVerticalPosition === 'top' && (toPos as any).label && ((toPos as any).label || '').trim().length > 0) {
              const maxCharsPerLine = 16;
              const lines = Math.ceil(((toPos as any).label || '').length / maxCharsPerLine);
              toIconOffset = 20 + ((lines - 1) * 8);
            }
          }
        }

        const fromIconWidth = isFromIconNode && fromIconContainer && fromWidth > fromIconContainer ? fromIconContainer : undefined;
        const fromIconOffsetX = fromIconWidth ? (fromWidth - fromIconWidth) / 2 : undefined;
        const toIconWidth = isToIconNode && toIconContainer && toWidth > toIconContainer ? toIconContainer : undefined;
        const toIconOffsetX = toIconWidth ? (toWidth - toIconWidth) / 2 : undefined;

        // Calculate connection points
        const connectionPoints = getOptimalConnectionPoints(fromPos, toPos, fromWidth, fromHeight, toWidth, toHeight, enhancedEdge, fromIconHeight, toIconHeight, fromIconOffset, toIconOffset, fromIconWidth, fromIconOffsetX, toIconWidth, toIconOffsetX);
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
              exportAnimationTimeSeconds={exportAnimationTimeSeconds}
              onClick={(connection, event) => {
                // Select the connection when clicked
                closeContextMenu();
                if (onItemSelect) {
                  const isAdditiveSelection = event.shiftKey || event.ctrlKey || event.metaKey;
                  onItemSelect({
                    ...connection,
                    itemType: 'edge',
                    id: `${connection.from}-${connection.to}`
                  }, isAdditiveSelection);
                }
              }}
              onContextMenu={(e, connection) => {
                closeContextMenu();
                if (onItemSelect) {
                  const edgeId = `${connection.from}-${connection.to}`;
                  const isAlreadySelected = selectedItemIds?.has(edgeId) || selectedItemId === edgeId;

                  if (!isAlreadySelected) {
                    onItemSelect({
                      ...connection,
                      itemType: 'edge',
                      id: edgeId
                    });
                  }
                }
                onConnectionContextMenu?.(e, connection);
              }}
            />
          </g>
        );
      })}
    </svg>
    {/* Render action buttons for selected connections */}
    <TooltipProvider>
    {(diagramData.connections || [])
      .map((edge: any, index: number) => ({ edge, index }))
      .filter(({ index }: { index: number }) => !connectionIndices || connectionIndices.has(index))
      .map(({ edge, index }: { edge: any; index: number }) => {
      const fromItem = nodesById[edge.from] || zonesById[edge.from];
      const toItem = nodesById[edge.to] || zonesById[edge.to];
      if (!fromItem || !toItem) return null;

      const edgeId = `${edge.from}-${edge.to}`;
      const isConnectionSelected = selectedItem?.itemType === 'edge' && selectedItem?.id === edgeId;
      
      if (!isConnectionSelected) return null;

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

      const isFromShape = isShapeNodeType(fromPos.type);
      const isToShape = isShapeNodeType(toPos.type);
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
      
      const isFromIconNode = !isFromGroup && !isFromShape && !isFromTextType;
      const isToIconNode = !isToGroup && !isToShape && !isToTextType;
      const fromIconContainer = isFromIconNode ? getNodeSizeDimensions((fromPos as any).nodeSize).container : undefined;
      const toIconContainer = isToIconNode ? getNodeSizeDimensions((toPos as any).nodeSize).container : undefined;

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
          fromIconHeight = fromIconContainer ?? BASE_NODE_HEIGHT;
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
          toIconHeight = toIconContainer ?? BASE_NODE_HEIGHT;
          const textVerticalPosition = (toPos as any).textVerticalPosition || 'bottom';
          if (textVerticalPosition === 'top' && (toPos as any).label && ((toPos as any).label || '').trim().length > 0) {
            const maxCharsPerLine = 16;
            const lines = Math.ceil(((toPos as any).label || '').length / maxCharsPerLine);
            toIconOffset = 20 + ((lines - 1) * 8);
          }
        }
      }

      const fromIconWidth = isFromIconNode && fromIconContainer && fromWidth > fromIconContainer ? fromIconContainer : undefined;
      const fromIconOffsetX = fromIconWidth ? (fromWidth - fromIconWidth) / 2 : undefined;
      const toIconWidth = isToIconNode && toIconContainer && toWidth > toIconContainer ? toIconContainer : undefined;
      const toIconOffsetX = toIconWidth ? (toWidth - toIconWidth) / 2 : undefined;
      
      const connectionPoints = getOptimalConnectionPoints(fromPos, toPos, fromWidth, fromHeight, toWidth, toHeight, enhancedEdge, fromIconHeight, toIconHeight, fromIconOffset, toIconOffset, fromIconWidth, fromIconOffsetX, toIconWidth, toIconOffsetX);
      const { fromX, fromY, toX, toY, fromAngle, toAngle } = connectionPoints;
      const curvature = edge?.curvature || 0.6;
      const { cp1X, cp1Y, cp2X, cp2Y } = calculateBezierControlPoints(fromX, fromY, toX, toY, curvature, fromAngle, toAngle);
      const centerPoint = getBezierPoint(0.5, fromX, fromY, cp1X, cp1Y, cp2X, cp2Y, toX, toY);
      const arrowPoint = getBezierPoint(0.9, fromX, fromY, cp1X, cp1Y, cp2X, cp2Y, toX, toY);
      const hasArrow = edge.toArrow === true || edge.arrow === true;

      const buttonOffset = 36;
      const ICON_SIZE = 29; // 24 * 1.2 ~20% bigger
      const ICON_HALF = Math.round(ICON_SIZE / 2);
      const BUTTON_Z_INDEX = 50;

      return (
        <React.Fragment key={`actions-${edge.from}-${edge.to}-${index}`}>
          {/* Arrow toggle button - positioned at 90% along the line */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className="absolute cursor-pointer"
                style={{
                  zIndex: BUTTON_Z_INDEX,
                  left: `${arrowPoint.x - ICON_HALF}px`,
                  top: `${arrowPoint.y - ICON_HALF}px`,
                  width: `${ICON_SIZE}px`,
                  height: `${ICON_SIZE}px`,
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (onConnectionUpdate) {
                    onConnectionUpdate(edge.from, edge.to, {
                      arrow: !hasArrow,
                      toArrow: !hasArrow,
                    });
                  }
                }}
              >
                <svg
                  width={ICON_SIZE}
                  height={ICON_SIZE}
                  viewBox="0 0 24 24"
                  className="pointer-events-none"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="12"
                    fill="#22c55e"
                  />
                  {hasArrow ? (
                    <path d="M 11 7 L 17 12 L 11 17 Z" fill="white" />
                  ) : (
                    <rect x="6" y="10.5" width="12" height="3" fill="white" rx="0.5" />
                  )}
                </svg>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top">
              Toggle arrow
            </TooltipContent>
          </Tooltip>

          {/* Add waypoint button - at center left */}
          {onConnectionWaypointAdd && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="absolute cursor-pointer"
                  style={{
                    zIndex: BUTTON_Z_INDEX,
                    left: `${centerPoint.x - buttonOffset - ICON_HALF}px`,
                    top: `${centerPoint.y - ICON_HALF}px`,
                    width: `${ICON_SIZE}px`,
                    height: `${ICON_SIZE}px`,
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (onConnectionWaypointAdd) {
                      onConnectionWaypointAdd(edge.from, edge.to);
                    }
                  }}
                >
                  <svg
                    width={ICON_SIZE}
                    height={ICON_SIZE}
                    viewBox="0 0 24 24"
                    className="pointer-events-none"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="12"
                      fill="#22c55e"
                    />
                    <rect x="10.5" y="6" width="3" height="12" fill="white" rx="0.5" />
                    <rect x="6" y="10.5" width="12" height="3" fill="white" rx="0.5" />
                  </svg>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">
                Add waypoint
              </TooltipContent>
            </Tooltip>
          )}

          {/* Delete button - at center right */}
          {onConnectionDelete && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="absolute cursor-pointer"
                  style={{
                    zIndex: BUTTON_Z_INDEX,
                    left: `${centerPoint.x + buttonOffset - ICON_HALF}px`,
                    top: `${centerPoint.y - ICON_HALF}px`,
                    width: `${ICON_SIZE}px`,
                    height: `${ICON_SIZE}px`,
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (onConnectionDelete) {
                      onConnectionDelete(edge.from, edge.to);
                    }
                  }}
                >
                  <svg
                    width={ICON_SIZE}
                    height={ICON_SIZE}
                    viewBox="0 0 24 24"
                    className="pointer-events-none"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="12"
                      fill="#ef4444"
                    />
                    <path
                      d="M 8 8 L 16 16 M 16 8 L 8 16"
                      stroke="white"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">
                Delete connection
              </TooltipContent>
            </Tooltip>
          )}
        </React.Fragment>
      );
    })}
    </TooltipProvider>
    </>
  );
}

export const CanvasConnections = React.memo(CanvasConnectionsInner, areCanvasConnectionsPropsEqual);

