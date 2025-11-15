"use client";

import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { DiagramNode } from "../diagram/diagram-node";
import { DiagramZone } from "../diagram/diagram-zone";
import type { DiagramData, DiagramNodeData, DiagramGroupData, DiagramZoneData, DiagramConnectionData } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Button } from "../ui/button";
import { Maximize2 } from "lucide-react";
import type { SelectedItem } from "../diagram-editor";
import { cn } from "@/lib/utils";
import { ContextMenu } from "../ui/context-menu";
import { CanvasRulers } from "./canvas-rulers";
import { RULER_SIZE, type PositionedNode, type PositionedGroup, measureNodeDims } from "./canvas-constants";
import { calculateLayout, recalculateGroupSize } from "./canvas-layout-utils";
import { useCanvasTransform } from "@/hooks/use-canvas-transform";
import { useCanvasSelection } from "@/hooks/use-canvas-selection";
import { useCanvasInteractions } from "@/hooks/use-canvas-interactions";
import { useCanvasDragDrop } from "@/hooks/use-canvas-drag-drop";
import { useCanvasClipboard } from "@/hooks/use-canvas-clipboard";
import { useCanvasExport } from "@/hooks/use-canvas-export";
import { useCanvasContextMenu } from "@/hooks/use-canvas-context-menu";
import { useCanvasOperations } from "./canvas-operations";
import { CanvasConnections } from "./canvas-connections";
import { CanvasArrowToggles } from "./canvas-arrow-toggles";
import { CanvasConnectionText } from "./canvas-connection-text";

interface EditorCanvasProps {
  diagramData: DiagramData;
  setDiagramData: React.Dispatch<React.SetStateAction<DiagramData>>;
  onItemSelect: (item: SelectedItem | null, shiftKey?: boolean) => void;
  onBatchSelect?: (itemIds: string[]) => void;
  selectedItemId?: string;
  selectedItemIds?: Set<string>;
  isConnectMode: boolean;
  onNodeClickInConnectMode: (node: DiagramNodeData) => void;
  onConnect?: (connectionOptions?: { style?: 'pathways' | 'bezier', curvature?: number }) => void;
  onDisconnect?: () => void;
  externalTransform?: { x: number; y: number; k: number };
  onTransformChange?: (transform: { x: number; y: number; k: number }) => void;
  onLabelUpdate?: (nodeId: string, newLabel: string) => void;
  onDraggingChange?: (isDragging: boolean) => void;
  onClipboardChange?: (hasClipboard: boolean) => void;
  onMousePositionChange?: (position: { x: number; y: number } | null) => void;
  onSelectionChange?: (selection: { start: { x: number; y: number } | null; end: { x: number; y: number } | null }) => void;
  onExportComplete?: () => void;
  hoverEnabled?: boolean;
  onSelectAll?: () => void;
  onTriggerTextStylingPanel?: () => void;
  onTriggerVisualStylingPanel?: () => void;
  onTriggerConnectionSettingsPanel?: () => void;
}


export type EditorCanvasHandle = {
  fitToView: () => void;
  exportPng: (options?: { backgroundColor?: 'transparent' | 'white'; selectionArea?: { x: number; y: number; width: number; height: number } }) => Promise<void>;
  startSelectionMode: (options: { backgroundColor: 'transparent' | 'white'; useSelection: boolean }) => void;
  copy: () => void;
  paste: () => void;
  canPaste: () => boolean;
};

export const EditorCanvas = React.forwardRef<EditorCanvasHandle, EditorCanvasProps>(function EditorCanvas(
  { diagramData, setDiagramData, onItemSelect, onBatchSelect, selectedItemId, selectedItemIds = new Set(), isConnectMode, onNodeClickInConnectMode, onConnect, onDisconnect, externalTransform, onTransformChange, onLabelUpdate, onDraggingChange, onClipboardChange, onMousePositionChange, onSelectionChange, onExportComplete, hoverEnabled = true, onSelectAll, onTriggerTextStylingPanel, onTriggerVisualStylingPanel, onTriggerConnectionSettingsPanel }: EditorCanvasProps,
  ref
) {
  // Calculate layout
  const { processedNodes, processedZones, width, height } = useMemo(() => {
    return calculateLayout(diagramData);
  }, [diagramData]);

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
  
  const selectedItem = useMemo(() => {
    if (!selectedItemId) return null;
    const node = nodesById[selectedItemId];
    if (node) return { ...node, itemType: 'node' as const };
    const zone = zonesById[selectedItemId];
    if (zone) return { ...zone, itemType: 'zone' as const, subType: (zone as any).subType };
    return null;
  }, [selectedItemId, nodesById, zonesById]);

  const { toast } = useToast();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 });
  
  // Client-side rendering state
  const [isClient, setIsClient] = useState(false);
  
  // Initialize hooks
  const { transform, setTransform, handleWheel, handleFitToView } = useCanvasTransform({
    externalTransform,
    onTransformChange,
    canvasRef,
    processedNodes,
    processedZones,
  });

  const { contextMenu, handleContextMenu, closeContextMenu } = useCanvasContextMenu();

  const { clipboard, handleCopy, handlePaste, handleToggleFreeflow, canPaste } = useCanvasClipboard({
    diagramData,
    selectedItemIds,
    setDiagramData,
    onItemSelect,
    onClipboardChange,
    toast,
  });

  const { isSelectionMode, pendingExportOptions, exportPng, startSelectionMode, setIsSelectionMode, setPendingExportOptions } = useCanvasExport({
    canvasRef,
    transform,
    width,
    height,
    toast,
  });

  const { selectionStart, selectionEnd, justCompletedSelection, handleCanvasClick, handleMouseDown: handleSelectionMouseDown, handleMouseMove: handleSelectionMouseMove, handleMouseUpOrLeave: handleSelectionMouseUpOrLeave } = useCanvasSelection({
    canvasRef,
    transform,
    isConnectMode,
    diagramData,
    onItemSelect,
    onBatchSelect,
    onSelectionChange,
    closeContextMenu,
    isSelectionMode,
    pendingExportOptions,
    exportPng,
    onExportComplete,
    toast,
  });

  const { isPanning, handleMouseDown: handleInteractionsMouseDown, handleMouseMove: handleInteractionsMouseMove, handleMouseUpOrLeave: handleInteractionsMouseUpOrLeave, handleTouchStart, handleTouchMove, handleTouchEnd } = useCanvasInteractions({
    canvasRef,
    transform,
    setTransform,
    isConnectMode,
    onMousePositionChange,
  });

  const operations = useCanvasOperations({
    setDiagramData,
    processedNodes,
    processedZones,
    onItemSelect,
    toast,
  });

  const { dragPosition, multiDragPositions, hoveredGroupId, drop } = useCanvasDragDrop({
    canvasRef,
    transform,
    processedZones,
    nodesById,
    zonesById,
    selectedItemIds,
    addNode: operations.addNode,
    moveItem: operations.moveItem,
    moveMultipleItems: operations.moveMultipleItems,
  });

  // Combine mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    handleSelectionMouseDown(e);
    handleInteractionsMouseDown(e);
  }, [handleSelectionMouseDown, handleInteractionsMouseDown]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    handleSelectionMouseMove(e);
    handleInteractionsMouseMove(e);
  }, [handleSelectionMouseMove, handleInteractionsMouseMove]);

  const handleMouseUpOrLeave = useCallback(async () => {
    await handleSelectionMouseUpOrLeave();
    handleInteractionsMouseUpOrLeave();
  }, [handleSelectionMouseUpOrLeave, handleInteractionsMouseUpOrLeave]);

  // Node/zone click handlers
  const handleNodeClick = (e: React.MouseEvent, node: DiagramNodeData) => {
    e.stopPropagation();
    closeContextMenu();
    if (isConnectMode) {
      onNodeClickInConnectMode(node);
    } else {
      onItemSelect({ ...node, itemType: 'node' }, e.shiftKey);
    }
  }

  const handleNodeContextMenu = (e: React.MouseEvent, node: DiagramNodeData) => {
    e.stopPropagation();
    e.preventDefault();
    // Select the node if not already selected
    if (selectedItemId !== node.id) {
      onItemSelect({ ...node, itemType: 'node' }, false);
    }
    handleContextMenu(e, node.id, 'node');
  }

  const handleZoneClick = (e: React.MouseEvent, zone: DiagramZoneData) => {
    e.stopPropagation();
    closeContextMenu();
    if (isConnectMode) {
      onNodeClickInConnectMode(zone as any);
    } else {
      onItemSelect({ ...zone, itemType: 'zone' }, e.shiftKey);
    }
  }

  const handleZoneContextMenu = (e: React.MouseEvent, zone: DiagramZoneData) => {
    e.stopPropagation();
    e.preventDefault();
    // Select the zone if not already selected
    if (selectedItemId !== zone.id) {
      onItemSelect({ ...zone, itemType: 'zone' }, false);
    }
    handleContextMenu(e, zone.id, 'zone');
  };

  // Apply drop to canvas
  drop(canvasRef);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
        e.preventDefault();
        if (selectedItemId) {
          handleCopy(selectedItemId);
        } else if (selectedItemIds && selectedItemIds.size > 0) {
          handleCopy();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
        e.preventDefault();
        if (canPaste()) {
          handlePaste();
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (selectedItemId) {
          operations.handleDelete(selectedItemId);
        } else if (selectedItemIds && selectedItemIds.size > 0) {
          operations.handleDeleteMultiple(Array.from(selectedItemIds));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedItemId, selectedItemIds, handleCopy, handlePaste, canPaste, operations]);

  // Expose imperative API
  const copyHandler = useCallback(() => {
    if (selectedItemId) {
      handleCopy(selectedItemId);
    } else if (selectedItemIds && selectedItemIds.size > 0) {
      handleCopy();
    }
  }, [selectedItemId, selectedItemIds, handleCopy]);

  const pasteHandler = useCallback(() => {
    if (canPaste()) {
      handlePaste();
    }
  }, [canPaste, handlePaste]);

  const canPasteHandler = useCallback(() => {
    return canPaste();
  }, [canPaste]);

  React.useImperativeHandle(ref, () => ({
    fitToView: handleFitToView,
    exportPng: (options?: { backgroundColor?: 'transparent' | 'white'; selectionArea?: { x: number; y: number; width: number; height: number } }) => exportPng(options),
    startSelectionMode: (options: { backgroundColor: 'transparent' | 'white'; useSelection: boolean }) => startSelectionMode(options),
    copy: copyHandler,
    paste: pasteHandler,
    canPaste: canPasteHandler,
  }), [handleFitToView, exportPng, startSelectionMode, copyHandler, pasteHandler, canPasteHandler]);

  return (
    <div className="relative w-full h-full">
        {/* Canvas Rulers */}
        {canvasDimensions.width > 0 && canvasDimensions.height > 0 && (
          <CanvasRulers
            transform={transform}
            canvasWidth={canvasDimensions.width}
            canvasHeight={canvasDimensions.height}
            rulerSize={RULER_SIZE}
          />
        )}
        
        <div
          ref={canvasRef}
          className="relative w-full h-full overflow-hidden"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onContextMenu={(e) => {
            // Only prevent default on empty canvas
            // Nodes and zones handle their own context menus and call stopPropagation
            // So if event reaches here, it's empty canvas - prevent browser context menu
            e.preventDefault();
          }}
        >
          <div
            className="relative dot-grid"
            style={{
              width: `${width}px`,
              height: `${height}px`,
              transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`,
              transformOrigin: '0 0',
            }}
          >
            {/* Render zones first (background) */}
            {processedZones.map((zone) => (
              <DiagramZone
                key={zone.id}
                zone={zone}
                isSelected={selectedItemId === zone.id || (selectedItemIds?.has(zone.id) ?? false)}
                onClick={(e: React.MouseEvent) => handleZoneClick(e, zone)}
                onContextMenu={(e: React.MouseEvent) => handleZoneContextMenu(e, zone)}
                onResize={operations.resizeGroup}
                onLabelChange={operations.updateGroupLabel}
              />
            ))}

            {/* Render nodes */}
            {processedNodes.map((node) => (
              <DiagramNode
                key={node.id}
                node={node}
                isSelected={selectedItemId === node.id || (selectedItemIds?.has(node.id) ?? false)}
                onClick={(e: React.MouseEvent) => handleNodeClick(e, node)}
                onContextMenu={(e: React.MouseEvent) => handleNodeContextMenu(e, node)}
                onResize={operations.resizeNode}
                onLabelUpdate={onLabelUpdate}
                onDraggingChange={onDraggingChange}
                hoverEnabled={hoverEnabled}
              />
            ))}

            {/* Render connections */}
            <CanvasConnections
              width={width}
              height={height}
              diagramData={diagramData}
              nodesById={nodesById}
              zonesById={zonesById}
              selectedItemId={selectedItemId}
              onItemSelect={onItemSelect}
              closeContextMenu={closeContextMenu}
            />

            {/* Render arrow toggles */}
            <CanvasArrowToggles
              selectedItemId={selectedItemId}
              diagramData={diagramData}
              nodesById={nodesById}
              zonesById={zonesById}
              setDiagramData={setDiagramData}
            />

            {/* Render connection text */}
            <CanvasConnectionText
              width={width}
              height={height}
              diagramData={diagramData}
              nodesById={nodesById}
              zonesById={zonesById}
              processedZones={processedZones}
            />
          </div>

          {/* Selection rectangle overlay */}
          {selectionStart && selectionEnd && (
            <div
              className="absolute border-2 border-blue-500 bg-blue-200/20 pointer-events-none z-[100]"
              style={{
                left: `${Math.min(selectionStart.x, selectionEnd.x) * transform.k + transform.x}px`,
                top: `${Math.min(selectionStart.y, selectionEnd.y) * transform.k + transform.y}px`,
                width: `${Math.abs(selectionEnd.x - selectionStart.x) * transform.k}px`,
                height: `${Math.abs(selectionEnd.y - selectionStart.y) * transform.k}px`,
              }}
            />
          )}

          {/* Context menu */}
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            visible={contextMenu.visible}
            onClose={closeContextMenu}
            itemType={contextMenu.itemType}
            onDelete={() => {
              if (contextMenu.itemType === 'node') {
                operations.handleDelete(contextMenu.itemId);
              } else {
                operations.handleDelete(contextMenu.itemId);
              }
              closeContextMenu();
            }}
            onCopy={() => {
              handleCopy(contextMenu.itemId);
              closeContextMenu();
            }}
            onConnect={() => {
              // onConnect expects the item to already be selected, which we do in handleNodeContextMenu/handleZoneContextMenu
              // Use setTimeout to ensure selection has been processed
              setTimeout(() => {
                if (onConnect) {
                  onConnect({ style: 'bezier', curvature: 0.6 });
                }
              }, 0);
              closeContextMenu();
            }}
            onDisconnect={() => {
              if (onDisconnect) {
                onDisconnect();
              }
              closeContextMenu();
            }}
            onTextStyling={() => {
              if (onTriggerTextStylingPanel) {
                onTriggerTextStylingPanel();
              }
              closeContextMenu();
            }}
            onVisualStyling={() => {
              if (onTriggerVisualStylingPanel) {
                onTriggerVisualStylingPanel();
              }
              closeContextMenu();
            }}
            connections={diagramData.connections?.filter((conn: DiagramConnectionData) => 
              conn.from === contextMenu.itemId || conn.to === contextMenu.itemId
            ) || []}
            triggerConnectionSettings={() => {
              if (onTriggerConnectionSettingsPanel) {
                onTriggerConnectionSettingsPanel();
              }
              closeContextMenu();
            }}
            onToggleFreeflow={() => {
              if (contextMenu.itemType === 'node') {
                handleToggleFreeflow(contextMenu.itemId);
              }
              closeContextMenu();
            }}
            isFreeflow={contextMenu.itemType === 'node' ? (diagramData.nodes.find(n => n.id === contextMenu.itemId)?.freeflow || false) : false}
            onOrientationChange={(orientation: 'auto' | 'horizontal' | 'vertical' | 'grid') => {
              const zone = diagramData.zones?.find(z => z.id === contextMenu.itemId);
              if (zone) {
                const newOrientation = orientation === 'grid' ? 'square' : orientation === 'auto' ? undefined : orientation;
                // Set sizeMode based on orientation:
                // - 'auto' orientation → 'auto' sizeMode
                // - 'grid', 'horizontal', 'vertical' → 'custom' sizeMode
                const newSizeMode = orientation === 'auto' ? 'auto' : 'custom';
                setDiagramData(prev => ({
                  ...prev,
                  zones: prev.zones?.map(z =>
                    z.id === contextMenu.itemId
                      ? { ...z, orientation: newOrientation, sizeMode: newSizeMode }
                      : z
                  ) || []
                }));
                toast({
                  title: "Orientation Changed",
                  description: `Zone orientation changed to ${orientation === 'grid' ? 'Grid' : orientation.charAt(0).toUpperCase() + orientation.slice(1)}`,
                });
              }
            }}
            currentOrientation={
              (() => {
                const zone = diagramData.zones?.find(zone => zone.id === contextMenu.itemId);
                if (!zone) return 'auto';
                // Map the data model values back to UI values
                if (!zone.orientation) return 'auto';
                if (zone.orientation === 'square') return 'grid';
                return zone.orientation;
              })()
            }
          />
        </div>
    </div>
  );
});
