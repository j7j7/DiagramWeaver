"use client";

import React, { useState, useMemo, useRef, useCallback, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { DiagramNode } from "../diagram/diagram-node";
import type { DiagramData } from "@/lib/types";
import { calculateLayout } from "../editor/canvas-layout-utils";
import { useCanvasTransform, type Transform } from "@/hooks/use-canvas-transform";
import { CanvasConnections } from "../editor/canvas-connections";
import { CanvasConnectionText } from "../editor/canvas-connection-text";
import { type PositionedNode, type PositionedGroup } from "../editor/canvas-constants";
import { CanvasRulers } from "../editor/canvas-rulers";
import { computeConnectionSlots } from "@/lib/connection-order-utils";
import { isShapeNodeType } from "@/lib/utils";
import { getDownstreamAnimationChainNodes } from "@/lib/connection-animation";
import { MetadataPopup } from "../editor/metadata-popup";
import type { DiagramConnectionData } from "@/lib/types";
function connKey(conn: DiagramConnectionData): string {
  return (conn as any).id || `${conn.from}\u2192${conn.to}`;
}

export type ViewerSelectedItem =
  | (DiagramData["nodes"][number] & { itemType: "node" })
  | (DiagramData["connections"][number] & { itemType: "edge"; id: string });

interface ViewerCanvasProps {
  diagramData: DiagramData;
  showRulers?: boolean;
  onFitToView?: () => void;
  transform?: Transform;
  onTransformChange?: (transform: Transform) => void;
  selectedItemId?: string;
  selectedItem?: ViewerSelectedItem | null;
  onItemSelect?: (item: ViewerSelectedItem | null) => void;
  metadataPopupsEnabled?: boolean;
  /** When true, show animations. When false, hide all animations */
  animationConnectionsEnabled?: boolean;
  /** When true, connection lines render behind all nodes. When false, order-aware interleaving. Default from localStorage. */
  connectionsBehindNodesEnabled?: boolean;
  /** When true and a node is selected, only show animations from that node */
  showAnimationsForSelectedOnly?: boolean;
  /** When set, only show animations for connections from these source node IDs (chain). Same as editor. */
  animationFilterSourceIds?: Set<string>;
  /** When true, clicking nodes toggles their outbound animations */
  animationToggleOnClickEnabled?: boolean;
  /** Set of node IDs whose animations are disabled */
  animationDisabledSources?: Set<string>;
  /** Callback to update disabled animation sources */
  onAnimationDisabledSourcesChange?: (sources: Set<string>) => void;
  /** When true, clicking a node with a valid URL opens it in a new browser tab. */
  openNodeLinksOnClick?: boolean;
  /** Node transition styles for slide transitions */
  nodeTransitionStyles?: Map<string, {
    opacity: number;
    transition: string;
    transitionDelayMs?: number;
    transform?: string;
    transformOrigin?: string;
    visualColorMerge?: Record<string, unknown>;
    visualColorMergeTransition?: string;
    visualColorCrossfade?: { from: Record<string, unknown>; to: Record<string, unknown> };
    visualColorCrossfadeTopOpacity?: number;
    visualColorCrossfadeTopTransition?: string;
  }>;
  /** Connection transition styles for slide transitions */
  connectionTransitionStyles?: Map<string, {
    opacity: number;
    transition: string;
    transform?: string;
    transformOrigin?: string;
    transitionDelayMs?: number;
    slideEndpointOffset?: { fromDx: number; fromDy: number; toDx: number; toDy: number };
    slideWaypointOffsets?: Array<{ dx: number; dy: number }>;
  }>;
  /** Double-click on node with subDiagramId navigates to sub-diagram */
  onSubDiagramDoubleClick?: (node: import("@/lib/types").DiagramNodeData) => void;
  /** True when node has subDiagramId and the linked sub exists */
  getHasLinkedSubDiagram?: (node: import("@/lib/types").DiagramNodeData) => boolean;
  /** When true, skip the one-shot auto fit-to-view on mount (parent owns transform). */
  skipInitialFitToView?: boolean;
  /** Bump when the logical diagram revision changes (e.g. presentation slide index) so connections remount cleanly. */
  connectionRenderRevision?: string | number;
}

export function ViewerCanvas({ diagramData, showRulers = false, onFitToView, transform: externalTransform, onTransformChange, selectedItemId, selectedItem, onItemSelect, metadataPopupsEnabled = true, animationConnectionsEnabled = true, connectionsBehindNodesEnabled: connectionsBehindNodesProp, showAnimationsForSelectedOnly = false, animationFilterSourceIds, animationToggleOnClickEnabled = false, animationDisabledSources = new Set(), onAnimationDisabledSourcesChange, openNodeLinksOnClick = false, nodeTransitionStyles = new Map(), connectionTransitionStyles = new Map(), onSubDiagramDoubleClick, getHasLinkedSubDiagram, skipInitialFitToView = false, connectionRenderRevision }: ViewerCanvasProps) {
  const [connectionsBehindNodesEnabled, setConnectionsBehindNodesEnabled] = useState(true);
  useEffect(() => {
    if (connectionsBehindNodesProp !== undefined) {
      setConnectionsBehindNodesEnabled(connectionsBehindNodesProp);
    } else if (typeof window !== "undefined") {
      const saved = localStorage.getItem("dw:connectionsBehindNodes:enabled");
      if (saved !== null) setConnectionsBehindNodesEnabled(saved !== "false");
    }
  }, [connectionsBehindNodesProp]);
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
  const [metadataPopupRect, setMetadataPopupRect] = useState<{
    top: number;
    left: number;
    right: number;
    width: number;
    height: number;
    bottom: number;
  } | null>(null);
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

  // Measure selected item rect for metadata popup (anchored to object)
  useLayoutEffect(() => {
    if (!metadataPopupsEnabled || !selectedItemId || !selectedItem) {
      setMetadataPopupRect(null);
      return;
    }
    const metaData = selectedItem && "metaData" in selectedItem ? selectedItem.metaData : undefined;
    if (!metaData || Object.keys(metaData).length === 0) {
      setMetadataPopupRect(null);
      return;
    }
    const container = canvasRef.current;
    if (!container) {
      setMetadataPopupRect(null);
      return;
    }
    const isEdge = selectedItem?.itemType === "edge";
    const selector = isEdge ? `[data-connection-id="${selectedItemId}"]` : `[data-node-id="${selectedItemId}"]`;
    const el = container.querySelector(selector);
    if (!el) {
      setMetadataPopupRect(null);
      return;
    }
    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      setMetadataPopupRect({
        top: rect.top,
        left: rect.left,
        right: rect.right,
        width: rect.width,
        height: rect.height,
        bottom: rect.bottom,
      });
    };
    measure();
    const raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, [metadataPopupsEnabled, selectedItemId, selectedItem, transform.x, transform.y, transform.k]);

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
      skipInitialFitToView ||
      !isClient ||
      !canvasRef.current ||
      hasFittedToViewRef.current ||
      (processedNodes.length === 0 && processedZones.length === 0) ||
      canvasDimensions.width === 0 ||
      canvasDimensions.height === 0
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
  }, [
    skipInitialFitToView,
    isClient,
    canvasDimensions,
    processedNodes.length,
    processedZones.length,
    handleFitToView,
  ]);

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
      // When animation mode is on: select = enable animations for this node's chain, deselect = stop.
      if (animationToggleOnClickEnabled && onAnimationDisabledSourcesChange && diagramData?.connections) {
        const chainNodes = getDownstreamAnimationChainNodes(node.id, diagramData.connections);
        const newDisabledSources = new Set(animationDisabledSources);
        chainNodes.forEach((id) => newDisabledSources.delete(id));
        onAnimationDisabledSourcesChange(newDisabledSources);
      }

      onItemSelect?.({ ...node, itemType: "node" } as ViewerSelectedItem);
    },
    [onItemSelect, animationToggleOnClickEnabled, animationDisabledSources, onAnimationDisabledSourcesChange, diagramData]
  );

  const handleSubDiagramDoubleClick = useCallback(
    (node: import("@/lib/types").DiagramNodeData) => {
      onSubDiagramDoubleClick?.(node);
    },
    [onSubDiagramDoubleClick]
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
    <>
      {metadataPopupRect &&
        selectedItem &&
        "metaData" in selectedItem &&
        selectedItem.metaData &&
        Object.keys(selectedItem.metaData).length > 0 &&
        createPortal(
          <MetadataPopup
            anchorRect={metadataPopupRect}
            metaData={selectedItem.metaData}
          />,
          document.body
        )}
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
      {showRulers && (
        <CanvasRulers
          transform={transform}
          canvasWidth={canvasDimensions.width}
          canvasHeight={canvasDimensions.height}
        />
      )}

        {/* Canvas content */}
      <div
        data-diagram-layer
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

        {connectionsBehindNodesEnabled ? (
          <>
            <CanvasConnections
              key="conn-all"
              width={width}
              height={height}
              diagramData={diagramData}
              nodesById={nodesById}
              zonesById={zonesById}
              selectedItemId={selectedItemId}
              onItemSelect={handleViewerItemSelect}
              closeContextMenu={() => {}}
              onConnectionDelete={undefined}
              stackZIndex={0}
              animationConnectionsEnabled={animationConnectionsEnabled}
              animationFilterSourceIds={animationFilterSourceIds}
              animationDisabledSources={animationDisabledSources}
              connectionAnimationStyles={connectionTransitionStyles}
              connectionKey={connKey}
              isReadOnly
              connectionRenderRevision={connectionRenderRevision}
            />
            {connectionSlots.sortedItemIds.map((itemId, i) => {
              const node = nodesById[itemId];
              const zone = zonesById[itemId];
              const nodeZIndex = 10 + i;
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
                  onSubDiagramDoubleClick={onSubDiagramDoubleClick ? handleSubDiagramDoubleClick : undefined}
                  hasLinkedSubDiagram={getHasLinkedSubDiagram?.(node) ?? Boolean(node.subDiagramId)}
                  showUrlHandleWhenReadOnly={openNodeLinksOnClick}
                  animationStyle={nodeTransitionStyles.get(node.id)}
                />
              ) : null;
              return nodeEl;
            })}
          </>
        ) : (
          <>
            {connectionSlots.sortedItemIds.flatMap((itemId, i) => {
              const slotConnections = connectionSlots.connectionsBySlot.get(i);
              const connIndices = slotConnections?.length ? new Set(slotConnections) : undefined;
              const node = nodesById[itemId];
              const zone = zonesById[itemId];
              const connZIndex = 2 * i;
              // Icon/text nodes: elevate z so labels stay on top of connectors. Shapes: keep original so lines can pass in front.
              const NODE_LAYER_BASE = 100;
              const isShape = node && isShapeNodeType(node.type);
              const nodeZIndex = isShape ? 2 * i + 1 : NODE_LAYER_BASE + 2 * i + 1;
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
                    onSubDiagramDoubleClick={onSubDiagramDoubleClick ? handleSubDiagramDoubleClick : undefined}
                    hasLinkedSubDiagram={getHasLinkedSubDiagram?.(node) ?? Boolean(node.subDiagramId)}
                    showUrlHandleWhenReadOnly={openNodeLinksOnClick}
                    animationStyle={nodeTransitionStyles.get(node.id)}
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
                    animationConnectionsEnabled={animationConnectionsEnabled}
                    animationFilterSourceIds={animationFilterSourceIds}
                    animationDisabledSources={animationDisabledSources}
                    connectionAnimationStyles={connectionTransitionStyles}
                    connectionKey={connKey}
                    isReadOnly
                    connectionRenderRevision={connectionRenderRevision}
                  />
                ) : null,
                nodeEl,
              ].filter(Boolean);
            })}
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
                  animationConnectionsEnabled={animationConnectionsEnabled}
                  animationFilterSourceIds={animationFilterSourceIds}
                  animationDisabledSources={animationDisabledSources}
                  connectionAnimationStyles={connectionTransitionStyles}
                  connectionKey={connKey}
                  isReadOnly
                  connectionRenderRevision={connectionRenderRevision}
                />
              );
            })()}
          </>
        )}

        {/* Connection text labels (Bezier only; orthogonal renders inline) */}
        <CanvasConnectionText
          width={width}
          height={height}
          diagramData={diagramData}
          nodesById={nodesById}
          zonesById={zonesById}
          processedZones={processedZones}
          connectionAnimationStyles={connectionTransitionStyles}
          connectionKey={connKey}
        />
      </div>
    </div>
    </>
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
