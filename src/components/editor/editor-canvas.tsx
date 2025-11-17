"use client";

/**
 * EditorCanvas Component
 * 
 * Main orchestrator component for the diagram editor canvas. This component was refactored
 * from a single large file (~4100 lines) into smaller, focused modules for better
 * maintainability and testability.
 * 
 * Architecture:
 * - Uses custom hooks for state management and side effects
 * - Delegates rendering to specialized sub-components
 * - Coordinates event handling between multiple systems
 * - Provides imperative API via ref forwarding
 * 
 * See tree.md for detailed documentation of all modules.
 */

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
  pastePaletteItem: (item: any) => void;
};

export const EditorCanvas = React.forwardRef<EditorCanvasHandle, EditorCanvasProps>(function EditorCanvas(
  { diagramData, setDiagramData, onItemSelect, onBatchSelect, selectedItemId, selectedItemIds = new Set(), isConnectMode, onNodeClickInConnectMode, onConnect, onDisconnect, externalTransform, onTransformChange, onLabelUpdate, onDraggingChange, onClipboardChange, onMousePositionChange, onSelectionChange, onExportComplete, hoverEnabled = true, onSelectAll, onTriggerTextStylingPanel, onTriggerVisualStylingPanel, onTriggerConnectionSettingsPanel }: EditorCanvasProps,
  ref
) {
  // ============================================================================
  // LAYOUT CALCULATION
  // ============================================================================
  // Uses canvas-layout-utils.ts to calculate positions for all nodes and zones
  // This runs whenever diagramData changes and returns:
  // - processedNodes: Nodes with calculated x/y positions
  // - processedZones: Zones with calculated x/y/width/height
  // - width/height: Total canvas dimensions needed to contain all items
  const { processedNodes, processedZones, width, height } = useMemo(() => {
    return calculateLayout(diagramData);
  }, [diagramData]);

  // ============================================================================
  // LOOKUP MAPS
  // ============================================================================
  // Create fast lookup maps for O(1) access to nodes and zones by ID
  // Used by sub-components that need to find items quickly
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
  
  // Get the currently selected item (node or zone) for internal use
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
  
  // ============================================================================
  // HOOK: useCanvasTransform
  // ============================================================================
  // Manages canvas panning and zooming
  // - transform: Current canvas transform (x, y, k/scale)
  // - handleWheel: Processes mouse wheel events for zooming
  // - handleFitToView: Auto-fits diagram to viewport
  // See: src/hooks/use-canvas-transform.ts
  const { transform, setTransform, handleWheel, handleFitToView } = useCanvasTransform({
    externalTransform,
    onTransformChange,
    canvasRef,
    processedNodes,
    processedZones,
  });

  // ============================================================================
  // HOOK: useCanvasContextMenu
  // ============================================================================
  // Manages right-click context menu state and position
  // - contextMenu: Current menu state (visible, x, y, itemType, itemId)
  // - handleContextMenu: Opens menu at mouse position for an item
  // - closeContextMenu: Closes the menu
  // See: src/hooks/use-canvas-context-menu.ts
  const { contextMenu, handleContextMenu, closeContextMenu } = useCanvasContextMenu();

  // ============================================================================
  // HOOK: useCanvasClipboard
  // ============================================================================
  // Handles copy, paste, and clipboard operations
  // - handleCopy: Copies selected item(s) to clipboard
  // - handlePaste: Pastes clipboard content at mouse position
  // - handleToggleFreeflow: Toggles freeflow mode for nodes
  // - canPaste: Checks if clipboard has content to paste
  // See: src/hooks/use-canvas-clipboard.ts
  const { clipboard, handleCopy, handlePaste, handleToggleFreeflow, canPaste } = useCanvasClipboard({
    diagramData,
    selectedItemIds,
    setDiagramData,
    onItemSelect,
    onClipboardChange,
    toast,
  });

  // ============================================================================
  // HOOK: useCanvasExport
  // ============================================================================
  // Manages PNG export functionality
  // - exportPng: Exports canvas to PNG (supports transparent/white background, selection area)
  // - startSelectionMode: Enters selection mode for area export
  // - isSelectionMode: Whether export selection mode is active
  // See: src/hooks/use-canvas-export.ts
  const { isSelectionMode, pendingExportOptions, exportPng, startSelectionMode, setIsSelectionMode, setPendingExportOptions } = useCanvasExport({
    canvasRef,
    transform,
    width,
    height,
    toast,
  });

  // ============================================================================
  // HOOK: useCanvasSelection
  // ============================================================================
  // Handles multi-item selection with selection rectangle
  // - selectionStart/End: Selection rectangle coordinates
  // - handleCanvasClick: Clears selection when clicking empty canvas
  // - handleMouseDown/Move/Up: Manages selection rectangle drawing
  // - justCompletedSelection: Flag to prevent immediate deselection
  // See: src/hooks/use-canvas-selection.ts
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

  // ============================================================================
  // HOOK: useCanvasInteractions
  // ============================================================================
  // Handles mouse position tracking and panning
  // - handleMouseMove: Tracks mouse position (throttled for performance)
  // - handleMouseDown: Initiates right-click panning
  // - handleTouchStart/Move/End: Handles touch gestures for mobile
  // - isPanning: Whether canvas is currently being panned
  // See: src/hooks/use-canvas-interactions.ts
  const { isPanning, handleMouseDown: handleInteractionsMouseDown, handleMouseMove: handleInteractionsMouseMove, handleMouseUpOrLeave: handleInteractionsMouseUpOrLeave, handleTouchStart, handleTouchMove, handleTouchEnd } = useCanvasInteractions({
    canvasRef,
    transform,
    setTransform,
    isConnectMode,
    onMousePositionChange,
  });

  // ============================================================================
  // HOOK: useCanvasOperations
  // ============================================================================
  // Provides CRUD operations for diagram items
  // - addNode: Adds a new node to the diagram
  // - resizeNode: Resizes a node with minimum size constraints
  // - resizeGroup: Resizes a zone with minimum size constraints
  // - moveItem: Moves a single item
  // - moveMultipleItems: Moves multiple selected items
  // - handleDelete: Deletes a single item
  // - handleDeleteMultiple: Deletes multiple items
  // - updateGroupLabel: Updates zone label
  // See: src/components/editor/canvas-operations.ts
  const operations = useCanvasOperations({
    setDiagramData,
    processedNodes,
    processedZones,
    onItemSelect,
    toast,
  });

  // ============================================================================
  // HOOK: useCanvasDragDrop
  // ============================================================================
  // Handles drag and drop functionality using react-dnd
  // - drop: Configures drop target for canvas
  // - dragPosition: Current drag position for visual feedback
  // - multiDragPositions: Positions for multi-item dragging
  // - hoveredGroupId: ID of zone currently being hovered during drag
  // See: src/hooks/use-canvas-drag-drop.ts
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
    onDraggingChange,
  });

  // ============================================================================
  // EVENT HANDLER COMBINATION
  // ============================================================================
  // Combines mouse handlers from multiple hooks to handle all mouse interactions
  // Selection and interaction handlers are called in sequence for each event
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    handleSelectionMouseDown(e);  // Handles selection rectangle start
    handleInteractionsMouseDown(e); // Handles right-click panning start
  }, [handleSelectionMouseDown, handleInteractionsMouseDown]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    handleSelectionMouseMove(e);  // Updates selection rectangle while dragging
    handleInteractionsMouseMove(e); // Tracks mouse position and handles panning
  }, [handleSelectionMouseMove, handleInteractionsMouseMove]);

  const handleMouseUpOrLeave = useCallback(async () => {
    await handleSelectionMouseUpOrLeave(); // Completes selection and selects items
    handleInteractionsMouseUpOrLeave(); // Stops panning and cleans up
  }, [handleSelectionMouseUpOrLeave, handleInteractionsMouseUpOrLeave]);

  // ============================================================================
  // NODE/ZONE EVENT HANDLERS
  // ============================================================================
  // Handles clicks and context menus for individual nodes and zones
  const handleNodeClick = (e: React.MouseEvent, node: DiagramNodeData) => {
    e.stopPropagation();
    closeContextMenu();
    if (isConnectMode) {
      onNodeClickInConnectMode(node); // In connect mode, clicking creates connection
    } else {
      onItemSelect({ ...node, itemType: 'node' }, e.shiftKey); // Normal selection
    }
  }

  const handleNodeContextMenu = (e: React.MouseEvent, node: DiagramNodeData) => {
    e.stopPropagation();
    e.preventDefault();
    // Select the node if not already selected (required for context menu actions)
    if (selectedItemId !== node.id) {
      onItemSelect({ ...node, itemType: 'node' }, false);
    }
    handleContextMenu(e, node.id, 'node'); // Opens context menu
  }

  const handleZoneClick = (e: React.MouseEvent, zone: DiagramZoneData) => {
    e.stopPropagation();
    closeContextMenu();
    if (isConnectMode) {
      onNodeClickInConnectMode(zone as any); // Zones can also be connection targets
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

  // ============================================================================
  // DRAG AND DROP SETUP
  // ============================================================================
  // Configures the canvas as a drop target for drag-and-drop operations
  // This allows items to be dropped onto the canvas from the sidebar
  drop(canvasRef);

  // ============================================================================
  // KEYBOARD SHORTCUTS
  // ============================================================================
  // Global keyboard shortcuts for common operations
  // Helper function to check if any text is being edited
  const isAnyTextBeingEdited = () => {
    // Check if any input, textarea, or contentEditable element is focused
    const activeElement = document.activeElement;
    if (!activeElement) return false;
    
    // Check for input/textarea elements
    if (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA') {
      return true;
    }
    
    // Check for contentEditable elements
    if (activeElement.getAttribute('contenteditable') === 'true') {
      return true;
    }
    
    // Check for CodeMirror editor (JSON editor)
    if (activeElement.closest('.cm-editor')) {
      return true;
    }
    
    // Check for any CodeMirror focused element
    if (activeElement.classList.contains('cm-focused') || activeElement.closest('.cm-focused')) {
      return true;
    }
    
    return false;
  };

  // - Cmd/Ctrl+C: Copy selected item(s)
  // - Cmd/Ctrl+V: Paste from clipboard
  // - Delete/Backspace: Delete selected item(s) (only when not editing text)
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
        // Prevent item deletion when editing text
        if (isAnyTextBeingEdited()) {
          // Allow normal text editing behavior (don't prevent default)
          return;
        }
        
        e.preventDefault();
        // If there are multiple selected items, delete all of them
        if (selectedItemIds && selectedItemIds.size > 0) {
          operations.handleDeleteMultiple(Array.from(selectedItemIds));
        } else if (selectedItemId) {
          // Fallback: delete single selected item
          operations.handleDelete(selectedItemId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedItemId, selectedItemIds, handleCopy, handlePaste, canPaste, operations]);

  // ============================================================================
  // IMPERATIVE API (via ref forwarding)
  // ============================================================================
  // Exposes methods that parent components can call via ref
  // Used by diagram-editor.tsx for menu bar actions and other external controls
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

  const pastePaletteItemHandler = useCallback((item: any) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();

    // Use the same zoom/viewport center reference as useCanvasTransform
    if (typeof window !== 'undefined') {
      const viewportCenterX = window.innerWidth / 2;
      const viewportCenterY = window.innerHeight / 2;

      // Place new items near the center of the current viewport with slight randomness
      const jitter = 80; // px
      const offsetX = (Math.random() - 0.5) * 2 * jitter;
      const offsetY = (Math.random() - 0.5) * 2 * jitter;

      const adjustedViewportX = viewportCenterX + offsetX;
      const adjustedViewportY = viewportCenterY + offsetY;

      // Convert browser viewport coordinates to canvas-relative coordinates
      const canvasRelativeX = adjustedViewportX - rect.left;
      const canvasRelativeY = adjustedViewportY - rect.top;

      // Convert to diagram-space coordinates using current transform
      const canvasX = (canvasRelativeX - transform.x) / transform.k;
      const canvasY = (canvasRelativeY - transform.y) / transform.k;

      operations.addNode(item, { x: canvasX, y: canvasY }, null);
      return;
    }

    // Fallback (SSR/defensive): center within canvas element
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const canvasX = (centerX - transform.x) / transform.k;
    const canvasY = (centerY - transform.y) / transform.k;
    operations.addNode(item, { x: canvasX, y: canvasY }, null);
  }, [transform, operations]);

  const canPasteHandler = useCallback(() => {
    return canPaste();
  }, [canPaste]);

  React.useImperativeHandle(ref, () => ({
    fitToView: handleFitToView, // Auto-fits diagram to viewport
    exportPng: (options?: { backgroundColor?: 'transparent' | 'white'; selectionArea?: { x: number; y: number; width: number; height: number } }) => exportPng(options), // Exports canvas to PNG
    startSelectionMode: (options: { backgroundColor: 'transparent' | 'white'; useSelection: boolean }) => startSelectionMode(options), // Enters export selection mode
    copy: copyHandler, // Copies selected item(s)
    paste: pasteHandler, // Pastes from clipboard
    canPaste: canPasteHandler, // Checks if paste is available
    pastePaletteItem: pastePaletteItemHandler, // Pastes a new item from the sidebar palette
  }), [handleFitToView, exportPng, startSelectionMode, copyHandler, pasteHandler, canPasteHandler, pastePaletteItemHandler]);

  return (
    <div className="relative w-full h-full">
        {/* ========================================================================
            CANVAS RULERS
            ========================================================================
            Renders horizontal and vertical rulers along canvas edges
            Shows pixel measurements and grid markers
            See: src/components/editor/canvas-rulers.tsx
        */}
        {canvasDimensions.width > 0 && canvasDimensions.height > 0 && (
          <CanvasRulers
            transform={transform}
            canvasWidth={canvasDimensions.width}
            canvasHeight={canvasDimensions.height}
            rulerSize={RULER_SIZE}
          />
        )}
        
        {/* ========================================================================
            MAIN CANVAS CONTAINER
            ========================================================================
            This div handles all mouse/touch/wheel events and contains the
            transformable diagram content area
        */}
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
          {/* ====================================================================
              TRANSFORMABLE DIAGRAM CONTENT AREA
              ====================================================================
              This div contains all diagram items and is transformed (translated
              and scaled) based on pan/zoom state. The transform CSS property
              applies pan (x, y) and zoom (scale k) transformations.
          */}
          <div
            className="relative dot-grid"
            style={{
              width: `${width}px`,
              height: `${height}px`,
              transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`,
              transformOrigin: '0 0',
            }}
          >
            {/* ================================================================
                ZONES (Background Layer)
                ================================================================
                Zones are rendered first so they appear behind nodes. To ensure
                nested zones remain interactive, we render parent zones before
                their children (lower depth first, higher depth last).
                See: src/components/diagram/diagram-zone.tsx
            */}
            {(() => {
              // Compute depth per zone based on parent/child relationships inferred
              // from children arrays (more robust than relying on parentId, which
              // can get out of sync when editing JSON).
              const depthCache = new Map<string, number>();
              const zonesForDepth = diagramData.zones || [];

              const getParentId = (childId: string): string | null => {
                const parent = zonesForDepth.find(z => (z.children || []).includes(childId));
                return parent ? parent.id : null;
              };

              const getDepth = (zoneId: string): number => {
                if (depthCache.has(zoneId)) return depthCache.get(zoneId)!;
                let depth = 0;
                let currentId: string | null = zoneId;
                const visited = new Set<string>();

                while (currentId) {
                  const parentId = getParentId(currentId);
                  if (!parentId || visited.has(parentId)) break;
                  visited.add(parentId);
                  depth += 1;
                  currentId = parentId;
                }

                depthCache.set(zoneId, depth);
                return depth;
              };

              const zonesWithDepth = processedZones
                .map(z => ({ zone: z, depth: getDepth(z.id) }))
                .sort((a, b) => a.depth - b.depth);

              return zonesWithDepth.map(({ zone }) => (
                <DiagramZone
                  key={zone.id}
                  zone={zone}
                  isSelected={selectedItemId === zone.id || (selectedItemIds?.has(zone.id) ?? false)}
                  isDropTarget={hoveredGroupId === zone.id}
                  isTargetable={hoveredGroupId === zone.id}
                  isMultiSelected={selectedItemIds?.has(zone.id) && (selectedItemIds?.size ?? 0) > 1}
                  onClick={(e: React.MouseEvent) => handleZoneClick(e, zone)}
                  onContextMenu={(e: React.MouseEvent) => handleZoneContextMenu(e, zone)}
                  onResize={operations.resizeGroup} // Allows resizing zones
                  onLabelChange={operations.updateGroupLabel} // Allows editing zone labels
                />
              ));
            })()}

            {/* ================================================================
                NODES (Foreground Layer)
                ================================================================
                Nodes are rendered after zones so they appear on top
                Each node represents a diagram element (text, shape, etc.)
                See: src/components/diagram/diagram-node.tsx
            */}
            {processedNodes.map((node) => (
              <DiagramNode
                key={node.id}
                node={node}
                isSelected={selectedItemId === node.id || (selectedItemIds?.has(node.id) ?? false)}
                onClick={(e: React.MouseEvent) => handleNodeClick(e, node)}
                onContextMenu={(e: React.MouseEvent) => handleNodeContextMenu(e, node)}
                onResize={operations.resizeNode} // Allows resizing nodes
                onLabelUpdate={onLabelUpdate} // Allows editing node labels
                onDraggingChange={onDraggingChange} // Notifies parent of drag state
                hoverEnabled={hoverEnabled} // Controls hover effects
              />
            ))}

            {/* ================================================================
                CONNECTIONS
                ================================================================
                Renders bezier curves connecting nodes/zones
                Handles connection selection and highlighting
                See: src/components/editor/canvas-connections.tsx
            */}
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

            {/* ================================================================
                ARROW TOGGLES
                ================================================================
                Renders arrow toggle buttons on selected connections
                Allows toggling arrow direction (from/to/both)
                See: src/components/editor/canvas-arrow-toggles.tsx
            */}
            <CanvasArrowToggles
              selectedItemId={selectedItemId}
              diagramData={diagramData}
              nodesById={nodesById}
              zonesById={zonesById}
              setDiagramData={setDiagramData}
            />

            {/* ================================================================
                CONNECTION TEXT
                ================================================================
                Renders and manages text labels on connections
                Allows editing connection labels
                See: src/components/editor/canvas-connection-text.tsx
            */}
            <CanvasConnectionText
              width={width}
              height={height}
              diagramData={diagramData}
              nodesById={nodesById}
              zonesById={zonesById}
              processedZones={processedZones}
            />
          </div>

          {/* ====================================================================
              SELECTION RECTANGLE OVERLAY
              ====================================================================
              Visual feedback for drag-to-select operation
              Shows a blue rectangle while user drags to select multiple items
              Position is calculated in diagram space and converted to screen space
          */}
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

          {/* ====================================================================
              CONTEXT MENU
              ====================================================================
              Right-click context menu for nodes and zones
              Provides actions like copy, delete, connect, styling, etc.
              See: src/components/ui/context-menu.tsx
          */}
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
