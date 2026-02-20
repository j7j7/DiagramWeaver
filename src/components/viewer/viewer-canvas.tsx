"use client";

import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { DiagramNode } from "../diagram/diagram-node";
import type { DiagramData } from "@/lib/types";
import { calculateLayout } from "../editor/canvas-layout-utils";
import { useCanvasTransform, type Transform } from "@/hooks/use-canvas-transform";
import { CanvasConnections } from "../editor/canvas-connections";
import { RULER_SIZE, type PositionedNode, type PositionedGroup } from "../editor/canvas-constants";
import { CanvasRulers } from "../editor/canvas-rulers";
import { computeConnectionSlots } from "@/lib/connection-order-utils";

export type ViewerSelectedItem =
  | (DiagramData["nodes"][number] & { itemType: "node" })
  | (DiagramData["connections"][number] & { itemType: "edge"; id: string });

interface ViewerCanvasProps {
  diagramData: DiagramData;
  onFitToView?: () => void;
  transform?: Transform;
  onTransformChange?: (transform: Transform) => void;
  selectedItemId?: string;
  onItemSelect?: (item: ViewerSelectedItem | null) => void;
}

export function ViewerCanvas({ diagramData, onFitToView, transform: externalTransform, onTransformChange, selectedItemId, onItemSelect }: ViewerCanvasProps) {
  // Calculate layout for all nodes and zones
  const { processedNodes, processedZones, width, height } = useMemo(() => {
    return calculateLayout(diagramData);
  }, [diagramData]);

  // Create lookup maps
  const nodesById = useMemo(() => {
    return processedNodes.reduce((acc, node) => {
      acc[node.id] = node;
      return acc;
    }, {} as Record<string, PositionedNode>);
  }, [processedNodes]);
  
  const zonesById = useMemo(() => {
    return processedZones.reduce((acc, zone) => {
      acc[zone.id] = zone;
      return acc;
    }, {} as Record<string, PositionedGroup>);
  }, [processedZones]);

  const connectionSlots = useMemo(
    () => computeConnectionSlots(diagramData, processedNodes, processedZones),
    [diagramData, processedNodes, processedZones]
  );

  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 });
  const [isClient, setIsClient] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; transform: Transform } | null>(null);
  const hasFittedToViewRef = useRef(false);

  // Canvas transform (pan/zoom)
  const { transform: internalTransform, setTransform: setInternalTransform, handleFitToView } = useCanvasTransform({
    externalTransform,
    onTransformChange,
    canvasRef,
    processedNodes,
    processedZones,
  });

  const transform = externalTransform || internalTransform;
  const setTransform = onTransformChange || setInternalTransform;

  // Expose fitToView to parent
  useEffect(() => {
    if (onFitToView) {
      (window as any).__viewerFitToView = handleFitToView;
    }
    return () => {
      delete (window as any).__viewerFitToView;
    };
  }, [handleFitToView, onFitToView]);

  // Handle mouse drag for panning (only when clicking background, not nodes/connections)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left mouse button
    const target = e.target as HTMLElement;
    const bgEl = target.closest?.("[data-viewer-background]");
    const isBackground = bgEl === target;
    if (!isBackground) return; // Click on node/connection - let selection handle it
    onItemSelect?.(null); // Clear selection when clicking background
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      transform: { ...transform },
    };
    e.preventDefault();
  }, [transform, onItemSelect]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !dragStartRef.current) return;
    
    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;
    
    setTransform({
      x: dragStartRef.current.transform.x + deltaX,
      y: dragStartRef.current.transform.y + deltaY,
      k: dragStartRef.current.transform.k,
    });
  }, [isDragging, setTransform]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    dragStartRef.current = null;
  }, []);

  // Handle zoom in/out
  const handleZoomIn = useCallback(() => {
    const newK = Math.min(transform.k * 1.2, 2.5);
    setTransform({ ...transform, k: newK });
  }, [transform, setTransform]);

  const handleZoomOut = useCallback(() => {
    const newK = Math.max(transform.k / 1.2, 0.1);
    setTransform({ ...transform, k: newK });
  }, [transform, setTransform]);

  // Update canvas dimensions on resize
  useEffect(() => {
    if (!isClient || !canvasRef.current) return;

    const updateDimensions = () => {
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        setCanvasDimensions({ width: rect.width, height: rect.height });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [isClient]);

  // Auto fit to view on first load
  useEffect(() => {
    if (
      !isClient || 
      !canvasRef.current || 
      hasFittedToViewRef.current ||
      processedNodes.length === 0 && processedZones.length === 0 ||
      canvasDimensions.width === 0 || canvasDimensions.height === 0
    ) {
      return;
    }

    // Wait a bit for the canvas to fully render
    const timeoutId = setTimeout(() => {
      if (handleFitToView && !hasFittedToViewRef.current) {
        handleFitToView();
        hasFittedToViewRef.current = true;
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [isClient, canvasDimensions, processedNodes.length, processedZones.length, handleFitToView]);

  // Client-side rendering
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Handle node hover (for tooltips)
  const handleNodeHover = useCallback((id: string, _itemType: 'node' | 'zone', isHovered: boolean) => {
    // Tooltips are handled by DiagramNode component via Popover
    // No state needed here for viewer mode
  }, []);

  // Handle zone hover (for tooltips)
  const handleZoneHover = useCallback((id: string, _itemType: 'node' | 'zone', isHovered: boolean) => {
    // Tooltips are handled by DiagramZone component via Popover
    // No state needed here for viewer mode
  }, []);

  const handleNodeClick = useCallback(
    (_e: React.MouseEvent, node: import("@/lib/types").DiagramNodeData) => {
      onItemSelect?.({ ...node, itemType: "node" } as ViewerSelectedItem);
    },
    [onItemSelect]
  );

  const handleViewerItemSelect = useCallback(
    (item: ViewerSelectedItem | null) => {
      onItemSelect?.(item);
    },
    [onItemSelect]
  );

  const handleZoneClick = useCallback(() => {
    // Zones removed from flat diagram
  }, []);

  // Expose zoom controls to parent (must be before any conditional returns)
  useEffect(() => {
    (window as any).__viewerZoomIn = handleZoomIn;
    (window as any).__viewerZoomOut = handleZoomOut;
    (window as any).__viewerFitToView = handleFitToView;
    return () => {
      delete (window as any).__viewerZoomIn;
      delete (window as any).__viewerZoomOut;
      delete (window as any).__viewerFitToView;
    };
  }, [handleZoomIn, handleZoomOut, handleFitToView]);

  if (!isClient) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <div className="text-muted-foreground">Loading diagram...</div>
      </div>
    );
  }

  return (
    <div
      ref={canvasRef}
      className="relative w-full h-full overflow-hidden bg-background"
      style={{
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Rulers */}
      <CanvasRulers
        transform={transform}
        canvasWidth={canvasDimensions.width}
        canvasHeight={canvasDimensions.height}
      />

        {/* Canvas content */}
      <div
        className="absolute dot-grid"
        data-viewer-background
        style={{
          width: `${width}px`,
          height: `${height}px`,
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`,
          transformOrigin: '0 0',
          cursor: 'grab',
        }}
      >
        {/* Zones removed - diagram is flat (nodes only) */}

        {/* Nodes + Connections (Order-aware layering) */}
        {connectionSlots.sortedItemIds.flatMap((itemId, i) => {
          const slotConnections = connectionSlots.connectionsBySlot.get(i);
          const connIndices = slotConnections?.length
            ? new Set(slotConnections)
            : undefined;
          const node = nodesById[itemId];
          const zone = zonesById[itemId];
          const connZIndex = 2 * i;
          const nodeZIndex = 2 * i + 1;
          const nodeEl = node ? (
            <DiagramNode
              key={node.id}
              node={node}
              stackZIndex={nodeZIndex}
              isSelected={selectedItemId === node.id}
              isMultiSelected={false}
              isReadOnly={true}
              onHoverChange={handleNodeHover}
              onClick={handleNodeClick}
            />
          ) : null;
          return [
            connIndices ? (
              <CanvasConnections
                key={`conn-slot-${i}`}
                width={width}
                height={height}
                diagramData={diagramData}
                nodesById={nodesById}
                zonesById={zonesById}
                selectedItemId={selectedItemId}
                onItemSelect={handleViewerItemSelect}
                closeContextMenu={() => {}}
                onConnectionDelete={undefined}
                connectionIndices={connIndices}
                stackZIndex={connZIndex}
              />
            ) : null,
            nodeEl,
          ].filter(Boolean);
        })}
        {/* Connections that render after the last item (in front of everything) */}
        {(() => {
          const n = connectionSlots.sortedItemIds.length;
          const lastSlot = connectionSlots.connectionsBySlot.get(n);
          if (!lastSlot?.length) return null;
          return (
            <CanvasConnections
              key="conn-slot-last"
              width={width}
              height={height}
              diagramData={diagramData}
              nodesById={nodesById}
              zonesById={zonesById}
              selectedItemId={selectedItemId}
              onItemSelect={handleViewerItemSelect}
              closeContextMenu={() => {}}
              onConnectionDelete={undefined}
              connectionIndices={new Set(lastSlot)}
              stackZIndex={2 * n}
            />
          );
        })()}
      </div>
    </div>
  );
}

// Export zoom control functions
export function useViewerControls() {
  return {
    zoomIn: () => {
      if ((window as any).__viewerZoomIn) {
        (window as any).__viewerZoomIn();
      }
    },
    zoomOut: () => {
      if ((window as any).__viewerZoomOut) {
        (window as any).__viewerZoomOut();
      }
    },
    fitToView: () => {
      if ((window as any).__viewerFitToView) {
        (window as any).__viewerFitToView();
      }
    },
  };
}
