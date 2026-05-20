import React from "react";
import { ArrowToggle } from "../diagram/arrow-toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { determineConnectionEdges, getOptimalConnectionPoints, calculateBezierControlPoints, getBezierPoint } from "../diagram/bezier-connection";
import type { DiagramData } from "@/lib/types";
import { 
  NODE_WIDTH, 
  NODE_HEIGHT, 
  BASE_NODE_HEIGHT, 
  TEXT_NODE_HEIGHT, 
  EXTRA_LINE_HEIGHT,
  CONNECTION_HELPER_Z_INDEX,
  measureNodeDims,
  type PositionedNode,
  type PositionedGroup,
} from "./canvas-constants";
import { getIconTileAnchorSize } from "@/lib/icon-bevel";
import { getNodeSizeDimensions } from "@/lib/visual-styling";
import { isIconOrEmojiType, isShapeNodeType } from "@/lib/utils";

interface CanvasArrowTogglesProps {
  selectedItemId?: string;
  diagramData: DiagramData;
  nodesById: Record<string, PositionedNode>;
  zonesById: Record<string, PositionedGroup>;
  setDiagramData: React.Dispatch<React.SetStateAction<DiagramData>>;
  isReadOnly?: boolean;
}

function areCanvasArrowTogglesPropsEqual(prev: CanvasArrowTogglesProps, next: CanvasArrowTogglesProps): boolean {
  return prev.selectedItemId === next.selectedItemId &&
    prev.diagramData === next.diagramData &&
    prev.nodesById === next.nodesById &&
    prev.zonesById === next.zonesById &&
    prev.setDiagramData === next.setDiagramData &&
    prev.isReadOnly === next.isReadOnly;
}

function CanvasArrowTogglesInner(props: CanvasArrowTogglesProps) {
  const {
    selectedItemId,
    diagramData,
    nodesById,
    zonesById,
    setDiagramData,
    isReadOnly = false,
  } = props;
  if (!selectedItemId) return null;

  // Reuse the same edge calculation that was used for rendering connections
  // We need to match the exact same connection data and indices
  const allConnections = diagramData.connections || [];
  
  // Pre-calculate edge information for ALL connections (same as connection rendering)
  const connectionEdgeInfo = new Map<string, { fromEdge: string; toEdge: string }>();
  const edgeGroups = new Map<string, any[]>();
  
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
  
  // Filter to only selected node connections
  const selectedNodeConnections = allConnections
    .map((conn: any, originalIndex: number) => ({ conn, originalIndex }))
    .filter(({ conn }: any) => 
      conn.from === selectedItemId || conn.to === selectedItemId
    );
  
  return (
    <>
      {selectedNodeConnections.map(({ conn, originalIndex }: any) => {
        const fromItem = nodesById[conn.from] || zonesById[conn.from];
        const toItem = nodesById[conn.to] || zonesById[conn.to];
        if (!fromItem || !toItem) return null;

        // Calculate dimensions and icon heights similar to BezierConnection
        const isFromShape = isShapeNodeType(fromItem.type);
        const isToShape = isShapeNodeType(toItem.type);
        
        const isFromTextType = fromItem.type === 'generic.text.text' || fromItem.type === 'generic.text.textbox';
        const isToTextType = toItem.type === 'generic.text.text' || toItem.type === 'generic.text.textbox';
        
        const isFromGroup = fromItem.type === 'group' || (fromItem as any).subType === 'zone';
        const isToGroup = toItem.type === 'group' || (toItem as any).subType === 'zone';
        
        // Calculate node heights
        const calculateNodeHeight = (label: string = '', nodeType: string, sizeMode?: string, customHeight?: number) => {
          if (sizeMode === 'custom' && customHeight) return customHeight;
          if (nodeType === 'generic.text.textbox' || nodeType === 'generic.text.text') {
            const maxCharsPerLine = 30;
            const lines = Math.max(1, Math.ceil(label.length / maxCharsPerLine));
            return TEXT_NODE_HEIGHT + ((lines - 1) * EXTRA_LINE_HEIGHT);
          } else {
            const maxCharsPerLine = 12;
            const lines = Math.ceil(label.length / maxCharsPerLine);
            return BASE_NODE_HEIGHT + ((lines - 1) * EXTRA_LINE_HEIGHT);
          }
        };
        
        const fromCalculatedHeight = calculateNodeHeight((fromItem as any).label || '', fromItem.type, (fromItem as any).sizeMode, (fromItem as any).height);
        const toCalculatedHeight = calculateNodeHeight((toItem as any).label || '', toItem.type, (toItem as any).sizeMode, (toItem as any).height);
        
        // Calculate text under heights
        let fromTextUnderHeight = 0;
        let toTextUnderHeight = 0;
        
        if (isFromShape && (fromItem as any).label && ((fromItem as any).textPosition === 'under' || !(fromItem as any).textPosition)) {
          const maxCharsPerLine = 16;
          const lines = Math.ceil(((fromItem as any).label || '').length / maxCharsPerLine);
          fromTextUnderHeight = lines * 20;
        }
        
        if (isToShape && (toItem as any).label && ((toItem as any).textPosition === 'under' || !(toItem as any).textPosition)) {
          const maxCharsPerLine = 16;
          const lines = Math.ceil(((toItem as any).label || '').length / maxCharsPerLine);
          toTextUnderHeight = lines * 20;
        }
        
        if (!isFromShape && !isFromTextType && (fromItem as any).label && ((fromItem as any).label || '').trim().length > 0) {
          const maxCharsPerLine = 16;
          const lines = Math.ceil(((fromItem as any).label || '').length / maxCharsPerLine);
          fromTextUnderHeight = 20 + ((lines - 1) * 8);
        }
        
        if (!isToShape && !isToTextType && (toItem as any).label && ((toItem as any).label || '').trim().length > 0) {
          const maxCharsPerLine = 16;
          const lines = Math.ceil(((toItem as any).label || '').length / maxCharsPerLine);
          toTextUnderHeight = 20 + ((lines - 1) * 8);
        }
        
        // Calculate widths and heights
        const fromWidth = isFromGroup 
          ? ((fromItem as any).width || 300)
          : (isFromShape && (fromItem as any).width ? (fromItem as any).width : ((fromItem as any).width || NODE_WIDTH));
        const fromHeight = isFromGroup
          ? ((fromItem as any).height || 220)
          : (isFromShape && (fromItem as any).height ? (fromItem as any).height : (fromCalculatedHeight + fromTextUnderHeight));
        const toWidth = isToGroup
          ? ((toItem as any).width || 300)
          : (isToShape && (toItem as any).width ? (toItem as any).width : ((toItem as any).width || NODE_WIDTH));
        const toHeight = isToGroup
          ? ((toItem as any).height || 220)
          : (isToShape && (toItem as any).height ? (toItem as any).height : (toCalculatedHeight + toTextUnderHeight));
        
        const isFromIconNode = !isFromGroup && !isFromShape && !isFromTextType;
        const isToIconNode = !isToGroup && !isToShape && !isToTextType;
        const fromIconContainer = isFromIconNode ? getIconTileAnchorSize(fromItem as any) : undefined;
        const toIconContainer = isToIconNode ? getIconTileAnchorSize(toItem as any) : undefined;

        // Calculate icon heights and offsets (respect nodeSize: half=40, quarter=20)
        let fromIconHeight: number | undefined;
        let toIconHeight: number | undefined;
        let fromIconOffset: number | undefined;
        let toIconOffset: number | undefined;
        
        if (!isFromGroup) {
          if (isFromShape) {
            fromIconHeight = (fromItem as any).height || 48;
          } else if (isFromTextType) {
            fromIconHeight = fromCalculatedHeight;
          } else {
            fromIconHeight = fromIconContainer ?? BASE_NODE_HEIGHT;
            const textVerticalPosition = (fromItem as any).textVerticalPosition || 'bottom';
            if (textVerticalPosition === 'top' && (fromItem as any).label && ((fromItem as any).label || '').trim().length > 0) {
              const maxCharsPerLine = 16;
              const lines = Math.ceil(((fromItem as any).label || '').length / maxCharsPerLine);
              fromIconOffset = 20 + ((lines - 1) * 8);
            }
          }
        }
        
        if (!isToGroup) {
          if (isToShape) {
            toIconHeight = (toItem as any).height || 48;
          } else if (isToTextType) {
            toIconHeight = toCalculatedHeight;
          } else {
            toIconHeight = toIconContainer ?? BASE_NODE_HEIGHT;
            const textVerticalPosition = (toItem as any).textVerticalPosition || 'bottom';
            if (textVerticalPosition === 'top' && (toItem as any).label && ((toItem as any).label || '').trim().length > 0) {
              const maxCharsPerLine = 16;
              const lines = Math.ceil(((toItem as any).label || '').length / maxCharsPerLine);
              toIconOffset = 20 + ((lines - 1) * 8);
            }
          }
        }

        const fromIconWidth = isFromIconNode && fromIconContainer && fromWidth > fromIconContainer ? fromIconContainer : undefined;
        const fromIconOffsetX = fromIconWidth ? (fromWidth - fromIconWidth) / 2 : undefined;
        const toIconWidth = isToIconNode && toIconContainer && toWidth > toIconContainer ? toIconContainer : undefined;
        const toIconOffsetX = toIconWidth ? (toWidth - toIconWidth) / 2 : undefined;
        
        // Get edge information for this connection using the same key format as connection rendering
        const connKey = `${conn.from}-${conn.to}-${originalIndex}`;
        const edges = connectionEdgeInfo.get(connKey);
        if (!edges) return null; // Skip if edge info not found (shouldn't happen)
        
        // Calculate per-edge indices exactly as done in connection rendering
        const fromEdgeKey = `${conn.from}-${edges.fromEdge}`;
        const toEdgeKey = `${conn.to}-${edges.toEdge}`;
        
        const fromEdgeConnections = edgeGroups.get(fromEdgeKey) || [];
        const toEdgeConnections = edgeGroups.get(toEdgeKey) || [];
        
        // Find the index using connIndex (which matches originalIndex in the full array)
        const fromEdgeIndex = fromEdgeConnections.findIndex((item: any) => item.connIndex === originalIndex);
        const toEdgeIndex = toEdgeConnections.findIndex((item: any) => item.connIndex === originalIndex);
        
        const fromEdgeTotal = fromEdgeConnections.length;
        const toEdgeTotal = toEdgeConnections.length;
        
        // Determine if this is an incoming or outgoing connection
        const isIncoming = conn.to === selectedItemId;
        const isOutgoing = conn.from === selectedItemId;
        
        // Create enhanced connection data with indices (same as connection rendering)
        const enhancedConn = {
          ...conn,
          fromPreferredExit: edges.fromEdge,
          toPreferredEntry: edges.toEdge,
          // Use from edge info for from node
          connectionIndex: fromEdgeIndex >= 0 ? fromEdgeIndex : 0,
          totalConnections: fromEdgeTotal > 0 ? fromEdgeTotal : 1,
          // Store to edge info separately for the "to" node
          toConnectionIndex: toEdgeIndex >= 0 ? toEdgeIndex : 0,
          toTotalConnections: toEdgeTotal > 0 ? toEdgeTotal : 1,
        };
        
        // Use the appropriate index based on whether it's incoming or outgoing
        const connectionIndex = isOutgoing ? enhancedConn.connectionIndex : enhancedConn.toConnectionIndex;
        const totalConnections = isOutgoing ? enhancedConn.totalConnections : enhancedConn.toTotalConnections;
        
        // Calculate connection points along bezier curve
        const connectionPoints = getOptimalConnectionPoints(
          fromItem, 
          toItem, 
          fromWidth, 
          fromHeight, 
          toWidth, 
          toHeight, 
          enhancedConn, 
          fromIconHeight, 
          toIconHeight,
          fromIconOffset,
          toIconOffset,
          fromIconWidth,
          fromIconOffsetX,
          toIconWidth,
          toIconOffsetX
        );
        const { fromX, fromY, toX, toY, fromAngle, toAngle } = connectionPoints;
        
        // Calculate control points for bezier curve
        const curvature = conn?.curvature || 0.6;
        const { cp1X, cp1Y, cp2X, cp2Y } = calculateBezierControlPoints(
          fromX, 
          fromY, 
          toX, 
          toY, 
          curvature, 
          fromAngle, 
          toAngle
        );
        
        // Offset position based on connection index when there are multiple connections
        // Spread connections along the curve by adjusting the t parameter
        // Base position is 85% along the curve, distribute multiple connections around that point
        let offsetT = 0.85; // Default to 85% along the curve
        if (totalConnections > 1) {
          // Distribute connections along a small range around 85% (e.g., 80% to 90%)
          const tRange = 0.10; // 10% range
          const tStart = 0.80;
          const tStep = tRange / (totalConnections - 1);
          offsetT = tStart + (connectionIndex * tStep);
        }
        
        // Get final position along bezier curve
        const bezierPoint = getBezierPoint(offsetT, fromX, fromY, cp1X, cp1Y, cp2X, cp2Y, toX, toY);
        const midX = bezierPoint.x;
        const midY = bezierPoint.y;

        const handleArrowToggle = (connection: any, connectionOriginalIndex: number, newState: boolean) => {
          setDiagramData(prevData => {
            // Create a completely new connections array to ensure React re-renders
            const oldConnections = prevData.connections || [];
            const updatedConnections = oldConnections.map((c: any, idx: number) => {
              // Match by original index to ensure we update the correct connection
              // when there are multiple connections between the same nodes
              if (idx === connectionOriginalIndex) {
                // Create a new object with updated toArrow state
                return { 
                  ...c, 
                  toArrow: newState,
                  arrow: newState, // Set both for backward compatibility
                  // Add a timestamp to force re-rendering
                  _updated: Date.now()
                };
              }
              return { ...c }; // Create new object for all connections to ensure re-render
            });
            
            // Ensure completely new array reference
            const newConnectionsArray = [...updatedConnections];
            
            return { 
              ...prevData, 
              connections: newConnectionsArray 
            };
          });
        };

        const iconSize = 48; // 40 * 1.2 ~20% bigger
        const iconHalf = iconSize / 2;

        return (
          <Tooltip key={`arrow-toggle-${conn.from}-${conn.to}-${originalIndex}`}>
            <TooltipTrigger asChild>
              <div
                className={`absolute ${isReadOnly ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                style={{ 
                  zIndex: CONNECTION_HELPER_Z_INDEX,
                  left: `${midX - iconHalf}px`,
                  top: `${midY - iconHalf}px`,
                  width: `${iconSize}px`,
                  height: `${iconSize}px`,
                }}
                  onMouseDown={(e) => {
                    if (isReadOnly) {
                      e.stopPropagation();
                      e.preventDefault();
                      return;
                    }
                    e.stopPropagation();
                    e.preventDefault();
                    handleArrowToggle(conn, originalIndex, !conn.toArrow && !conn.arrow);
                  }}
                >
                  <svg
                    width={iconSize}
                    height={iconSize}
                    viewBox="0 0 40 40"
                    className="pointer-events-none"
                  >
                    <ArrowToggle
                      x={20}
                      y={20}
                      connection={conn}
                      isActive={conn.toArrow === true || conn.arrow === true}
                    />
                  </svg>
                </div>
              </TooltipTrigger>
            <TooltipContent side="top">Toggle arrow</TooltipContent>
          </Tooltip>
        );
      })}
    </>
  );
}

export const CanvasArrowToggles = React.memo(CanvasArrowTogglesInner, areCanvasArrowTogglesPropsEqual);

