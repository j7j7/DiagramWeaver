"use client";

import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { DiagramNode } from "../diagram/diagram-node";
import { DiagramZone } from "../diagram/diagram-zone";
import type { DiagramData } from "@/lib/types";
import { calculateLayout } from "../editor/canvas-layout-utils";
import { useCanvasTransform, type Transform } from "@/hooks/use-canvas-transform";
import { CanvasConnections } from "../editor/canvas-connections";
import { RULER_SIZE, type PositionedNode, type PositionedGroup } from "../editor/canvas-constants";
import { CanvasRulers } from "../editor/canvas-rulers";

interface ViewerCanvasProps {
  diagramData: DiagramData;
  onFitToView?: () => void;
  transform?: Transform;
  onTransformChange?: (transform: Transform) => void;
}

export function ViewerCanvas({ diagramData, onFitToView, transform: externalTransform, onTransformChange }: ViewerCanvasProps) {
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
      // Store the fitToView function reference
      (window as any).__viewerFitToView = handleFitToView;
    }
  }, [handleFitToView, onFitToView]);

  // Handle mouse drag for panning
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left mouse button
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      transform: { ...transform },
    };
    e.preventDefault();
  }, [transform]);

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
  const handleNodeHover = useCallback((id: string, isHovered: boolean) => {
    // Tooltips are handled by DiagramNode component via Popover
    // No state needed here for viewer mode
  }, []);

  // Handle zone hover (for tooltips)
  const handleZoneHover = useCallback((id: string, isHovered: boolean) => {
    // Tooltips are handled by DiagramZone component via Popover
    // No state needed here for viewer mode
  }, []);

  // No-op handlers for viewer mode (no editing)
  const handleNodeClick = useCallback(() => {
    // No selection in viewer mode
  }, []);

  const handleZoneClick = useCallback(() => {
    // No selection in viewer mode
  }, []);

  // Expose zoom controls to parent (must be before any conditional returns)
  useEffect(() => {
    (window as any).__viewerZoomIn = handleZoomIn;
    (window as any).__viewerZoomOut = handleZoomOut;
    (window as any).__viewerFitToView = handleFitToView;
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
        width={canvasDimensions.width}
        height={canvasDimensions.height}
      />

      {/* Canvas content */}
      <div
        className="absolute dot-grid"
        style={{
          width: `${width}px`,
          height: `${height}px`,
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`,
          transformOrigin: '0 0',
          cursor: 'grab',
        }}
      >
        {/* Render zones first (background) */}
        {processedZones.map((zone) => {
          const zoneData = zonesById[zone.id];
          if (!zoneData) return null;

          return (
            <DiagramZone
              key={zone.id}
              zone={zoneData}
              isSelected={false}
              isMultiSelected={false}
              isReadOnly={true}
              onHoverChange={handleZoneHover}
              onClick={handleZoneClick}
            />
          );
        })}

        {/* Render nodes */}
        {processedNodes.map((node) => {
          const nodeData = nodesById[node.id];
          if (!nodeData) return null;

          return (
            <DiagramNode
              key={node.id}
              node={nodeData}
              isSelected={false}
              isMultiSelected={false}
              isReadOnly={true}
              onHoverChange={handleNodeHover}
              onClick={handleNodeClick}
            />
          );
        })}

        {/* Render connections */}
        <CanvasConnections
          width={width}
          height={height}
          diagramData={diagramData}
          nodesById={nodesById}
          zonesById={zonesById}
          selectedItemId={undefined}
          onItemSelect={() => {}}
          closeContextMenu={() => {}}
          onConnectionDelete={undefined}
        />
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
