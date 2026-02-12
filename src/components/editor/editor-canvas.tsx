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
import type { DiagramData, DiagramNodeData, DiagramZoneData, DiagramConnectionData } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import type { SelectedItem } from "../diagram-editor";
import { ContextMenu } from "../ui/context-menu";
import { CanvasRulers } from "./canvas-rulers";
import { RULER_SIZE, type PositionedNode, type PositionedGroup } from "./canvas-constants";
import { calculateLayout } from "./canvas-layout-utils";
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
import { getItemGroup } from "@/lib/grouping-utils";
import { computeConnectionSlots } from "@/lib/connection-order-utils";
import { CanvasRotationOverlay } from "./canvas-rotation-overlay";
import { measureNodeDims } from "./canvas-constants";
import { useAlignmentGuides } from "@/hooks/use-alignment-guides";
import { CanvasAlignmentGuides } from "./canvas-alignment-guides";
import { SearchResourcesModal } from "./search-resources-modal";
import { snapToGrid } from "./canvas-constants";
import { ConnectionWaypointHandles } from "../diagram/connection-waypoint-handles";

interface EditorCanvasProps {
  diagramData: DiagramData;
  setDiagramData: React.Dispatch<React.SetStateAction<DiagramData>>;
  onItemSelect: (item: SelectedItem | null, shiftKey?: boolean) => void;
  onBatchSelect?: (itemIds: string[]) => void;
  setSelectedItemIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setSelectedItem: React.Dispatch<React.SetStateAction<SelectedItem | null>>;
  selectedItemId?: string;
  selectedItemIds?: Set<string>;
  isConnectMode: boolean;
  onNodeClickInConnectMode: (node: DiagramNodeData) => void;
  onConnect?: (connectionOptions?: { style?: 'pathways' | 'bezier', curvature?: number }) => void;
  onDisconnect?: () => void;
  onConnectionDelete?: (from: string, to: string) => void;
  onConnectionWaypointMove?: (from: string, to: string, index: number, newPos: { x: number; y: number }) => void;
  externalTransform?: { x: number; y: number; k: number };
  onTransformChange?: (transform: { x: number; y: number; k: number }) => void;
   onLabelUpdate?: (nodeId: string, newLabel: string) => void;
   onTagUpdate?: (nodeId: string, newTag: string) => void;
   onZoneTagUpdate?: (zoneId: string, newTag: string) => void;
   onDraggingChange?: (isDragging: boolean) => void;
  onClipboardChange?: (hasClipboard: boolean) => void;
  onMousePositionChange?: (position: { x: number; y: number } | null) => void;
  onSelectionChange?: (selection: { start: { x: number; y: number } | null; end: { x: number; y: number } | null }) => void;
  onExportComplete?: () => void;
  hoverEnabled?: boolean;
  iconBackgroundEnabled?: boolean;
  onSelectAll?: () => void;
  onTriggerTextStylingPanel?: () => void;
  onTriggerVisualStylingPanel?: () => void;
  onTriggerLineStylingPanel?: () => void;
  onTriggerConnectionSettingsPanel?: () => void;
  onResetConnectionSettingsTrigger?: () => void;
  layers?: {
    getAllLayers: () => Array<{id: string; name: string}>;
    getItemLayerById: (itemId: string) => string;
    assignItemsToLayer: (itemIds: string[], layerId: string) => void;
  };
  onGroupItems?: () => void;
  onUngroupItems?: () => void;
  onRemoveFromGroup?: () => void;
  onAddToGroupItems?: (groupId: string) => void;
  onMoveToBack?: () => void;
  onMoveToFront?: () => void;
  onMoveOneBack?: () => void;
  onMoveOneForward?: () => void;
  onZoneLayoutChange?: (zoneId: string, layout: 'grid' | 'circular') => void;
  onZoneCycle?: (zoneId: string) => void;
  onZoneSort?: (zoneId: string, order: 'alpha-asc' | 'alpha-desc') => void;
  isReadOnly?: boolean;
  alignmentGuidesEnabled?: boolean;
  onResourceActivateAtPosition?: (
    resource: { name: string; file?: string; type?: string; hasWhiteVariant?: boolean; format?: string; iconType?: string; iconName?: string; emoji?: string },
    provider: string,
    category: string,
    position: { x: number; y: number },
    fullItem?: object
  ) => void;
}


export type EditorCanvasHandle = {
  fitToView: () => void;
  exportPng: (options?: { backgroundColor?: 'transparent' | 'white'; quality?: 'low' | 'medium' | 'high' }) => Promise<void>;
  copy: () => void;
  paste: () => void;
  canPaste: () => boolean;
  pastePaletteItem: (item: any, position?: { x: number; y: number }) => void;
};

export const EditorCanvas = React.forwardRef<EditorCanvasHandle, EditorCanvasProps>(function EditorCanvas(
   { diagramData, setDiagramData, onItemSelect, onBatchSelect, setSelectedItemIds, setSelectedItem, selectedItemId, selectedItemIds = new Set(), isConnectMode, onNodeClickInConnectMode, onConnect, onDisconnect, onConnectionDelete, onConnectionWaypointMove, externalTransform,      onTransformChange, onLabelUpdate, onTagUpdate, onZoneTagUpdate, onDraggingChange, onClipboardChange, onMousePositionChange, onSelectionChange, onExportComplete, hoverEnabled = true, iconBackgroundEnabled = true, onSelectAll, onTriggerTextStylingPanel, onTriggerVisualStylingPanel, onTriggerLineStylingPanel, onTriggerConnectionSettingsPanel, onResetConnectionSettingsTrigger, layers, onGroupItems, onUngroupItems, onRemoveFromGroup, onAddToGroupItems, onMoveToBack, onMoveToFront, onMoveOneBack, onMoveOneForward, onZoneLayoutChange, onZoneCycle, onZoneSort, isReadOnly = false, alignmentGuidesEnabled = true, onResourceActivateAtPosition }: EditorCanvasProps,
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

  // Connection order: which connections render in which slot (between items) for proper z-order
  const connectionSlots = useMemo(
    () => computeConnectionSlots(diagramData, processedNodes, processedZones),
    [diagramData, processedNodes, processedZones]
  );
  
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
  const [searchModalOpen, setSearchModalOpen] = React.useState(false);

  // Client-side rendering state
  const [isClient, setIsClient] = useState(false);

  // ============================================================================
  // ROTATION HANDLE STATE
  // ============================================================================
  // Track which selected item is currently hovered (for showing rotation handles)
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [hoveredItemType, setHoveredItemType] = useState<'node' | 'zone' | null>(null);

  // Rotation drag state
  const [rotationDragState, setRotationDragState] = useState<{
    isActive: boolean;
    targetId: string;
    targetType: 'node' | 'zone';
    startY: number;
    startRotation: number;
    currentRotation: number;
    capturedElement: HTMLElement | null;
  } | null>(null);

  // Store original dimensions for all selected items during multi-resize
  const originalDimensionsRef = useRef<Map<string, { width: number; height: number }>>(new Map());

  // Store original dimensions for all selected items when resize starts
  const handleResizeStart = useCallback((itemId: string, width: number, height: number) => {
    // Store original dimensions for the item being resized
    originalDimensionsRef.current.set(itemId, { width, height });
    
    // If multi-select, store original dimensions for all selected items
    if (selectedItemIds.size > 1) {
      selectedItemIds.forEach(id => {
        if (!originalDimensionsRef.current.has(id)) {
          const node = nodesById[id];
          const zone = zonesById[id];
          if (node) {
            const nodeWidth = node.width || 80;
            const nodeHeight = node.height || 80;
            originalDimensionsRef.current.set(id, { width: nodeWidth, height: nodeHeight });
          } else if (zone) {
            originalDimensionsRef.current.set(id, { width: zone.width, height: zone.height });
          }
        }
      });
    }
  }, [selectedItemIds, nodesById, zonesById]);

  // Clear original dimensions when resize ends
  const handleResizeEnd = useCallback(() => {
    originalDimensionsRef.current.clear();
  }, []);

  // Determine which item should show rotation handles
  // Handles appear when items are selected and persist until deselected
  // For multi-select, use the first selected item (or hovered item if available)
  const rotationTarget = useMemo(() => {
    // If no items selected, no rotation handles
    if (selectedItemIds.size === 0) {
      return null;
    }
    
    // Helper to check if a node is a line (exclude from rotation)
    const isLineNode = (node: any) => {
      return node?.type === 'generic.object.line' || node?.type?.endsWith('.line');
    };
    
    // If hovering a selected item, use that (for multi-select, this provides better UX)
    if (hoveredItemId && hoveredItemType && selectedItemIds.has(hoveredItemId)) {
      // Exclude line nodes from rotation
      if (hoveredItemType === 'node') {
        const node = nodesById[hoveredItemId];
        if (node && isLineNode(node)) return null;
      }
      return { id: hoveredItemId, type: hoveredItemType };
    }
    
    // For single selection, show handles for the selected item
    if (selectedItemIds.size === 1 && selectedItemId) {
      const node = nodesById[selectedItemId];
      if (node) {
        // Exclude line nodes from rotation
        if (isLineNode(node)) return null;
        return { id: selectedItemId, type: 'node' as const };
      }
      const zone = zonesById[selectedItemId];
      if (zone) return { id: selectedItemId, type: 'zone' as const };
    }
    
    // For multi-select, use the first selected item (persistent, won't flicker)
    if (selectedItemIds.size > 1) {
      // Try to find first node (excluding lines)
      for (const id of selectedItemIds) {
        const node = nodesById[id];
        if (node && !isLineNode(node)) return { id, type: 'node' as const };
      }
      // If no nodes, find first zone
      for (const id of selectedItemIds) {
        const zone = zonesById[id];
        if (zone) return { id, type: 'zone' as const };
      }
    }
    
    return null;
  }, [hoveredItemId, hoveredItemType, selectedItemIds, selectedItemId, nodesById, zonesById]);

  // Handle hover changes from nodes/zones
  // Don't clear hover when mouse moves to rotation overlay to prevent flickering
  const handleHoverChange = useCallback((id: string, itemType: 'node' | 'zone', isHovered: boolean) => {
    if (isHovered) {
      setHoveredItemId(id);
      setHoveredItemType(itemType);
    } else {
      // Only clear if this was the hovered item and we're not in multi-select
      // In multi-select, keep the hover state stable to prevent flickering
      if (hoveredItemId === id && selectedItemIds.size <= 1) {
        setHoveredItemId(null);
        setHoveredItemType(null);
      }
      // For multi-select, keep the hover state even when mouse leaves
      // This prevents flickering when moving mouse to rotation handles
    }
  }, [hoveredItemId, selectedItemIds]);

  // Update rotation for an item
  const setRotationForItem = useCallback((targetId: string, targetType: 'node' | 'zone', rotation: number, applyToAllSelected = false) => {
    // Snap to nearest 5-degree increment
    let snappedRotation = Math.round(rotation / 5) * 5;
    
    // Normalize rotation to [-180, 180)
    let normalizedRotation = snappedRotation % 360;
    if (normalizedRotation >= 180) normalizedRotation -= 360;
    if (normalizedRotation < -180) normalizedRotation += 360;

    setDiagramData(prev => {
      if (applyToAllSelected && selectedItemIds.size > 1) {
        // Apply rotation to all selected items
        const updatedNodes = prev.nodes.map(n => {
          if (selectedItemIds.has(n.id)) {
            return { ...n, rotation: normalizedRotation };
          }
          return n;
        });
        
        const updatedZones = (prev.zones || []).map(z => {
          if (selectedItemIds.has(z.id)) {
            return { ...z, rotation: normalizedRotation };
          }
          return z;
        });
        
        return { ...prev, nodes: updatedNodes, zones: updatedZones };
      } else {
        // Single item rotation
        if (targetType === 'node') {
          return {
            ...prev,
            nodes: prev.nodes.map(n => 
              n.id === targetId ? { ...n, rotation: normalizedRotation } : n
            ),
          };
        } else {
          return {
            ...prev,
            zones: (prev.zones || []).map(z =>
              z.id === targetId ? { ...z, rotation: normalizedRotation } : z
            ),
          };
        }
      }
    });

    // Update selectedItem if it's the rotated item
    if (selectedItem?.id === targetId) {
      setSelectedItem({ ...selectedItem, rotation: normalizedRotation } as any);
    }
  }, [setDiagramData, selectedItem, setSelectedItem, selectedItemIds]);

  // Handle rotation handle pointer down
  const handleRotationHandlePointerDown = useCallback((e: React.PointerEvent, corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right') => {
    if (!rotationTarget) return;

    e.preventDefault();
    e.stopPropagation();

    const target = rotationTarget.type === 'node' 
      ? nodesById[rotationTarget.id]
      : zonesById[rotationTarget.id];
    
    if (!target) return;

    const currentRotation = (target as any).rotation || 0;

    const capturedElement = e.target as HTMLElement;
    
    setRotationDragState({
      isActive: true,
      targetId: rotationTarget.id,
      targetType: rotationTarget.type,
      startY: e.clientY,
      startRotation: currentRotation,
      currentRotation: currentRotation,
      capturedElement,
    });

    // Set pointer capture for smooth dragging
    capturedElement.setPointerCapture(e.pointerId);
  }, [rotationTarget, nodesById, zonesById]);

  // Handle pointer move for rotation
  useEffect(() => {
    if (!rotationDragState) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (!rotationDragState || !rotationDragState.isActive) return;

      const deltaY = rotationDragState.startY - e.clientY;
      const sensitivityDegPerPx = 0.5; // degrees per pixel
      const deltaDeg = deltaY * sensitivityDegPerPx;
      const rawRotation = rotationDragState.startRotation + deltaDeg;
      
      // Snap to nearest 5-degree increment
      const newRotation = Math.round(rawRotation / 5) * 5;

      // Capture values for the update
      const targetId = rotationDragState.targetId;
      const targetType = rotationDragState.targetType;

      setRotationDragState(prev => prev ? { ...prev, currentRotation: newRotation } : null);

      // Update rotation (throttled via requestAnimationFrame)
      requestAnimationFrame(() => {
        setRotationForItem(targetId, targetType, newRotation, true); // Apply to all selected
      });
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!rotationDragState) return;

      // Capture values before clearing state
      const targetId = rotationDragState.targetId;
      const targetType = rotationDragState.targetType;
      const finalRotation = rotationDragState.currentRotation;
      const capturedElement = rotationDragState.capturedElement;

      // Release pointer capture
      if (capturedElement) {
        try {
          capturedElement.releasePointerCapture(e.pointerId);
        } catch (err) {
          // Ignore errors if pointer capture was already released
        }
      }

      // Final update with current rotation
      setRotationForItem(targetId, targetType, finalRotation, true); // Apply to all selected

      setRotationDragState(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [rotationDragState, setRotationForItem]);
  
  
  // ============================================================================
  // HOOK: useCanvasTransform
  // ============================================================================
  // Manages canvas panning and zooming
  // - transform: Current canvas transform (x, y, k/scale)
  // - handleWheel: Processes mouse wheel events for zooming
  // - handleFitToView: Auto-fits diagram to viewport
  // - setTransform: Updates transform state
  // See: src/hooks/use-canvas-transform.ts
  const { transform, setTransform, handleWheel, handleFitToView } = useCanvasTransform({
    externalTransform,
    onTransformChange,
    canvasRef,
    processedNodes,
    processedZones,
    wheelZoomDisabled: searchModalOpen,
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
    iconBackgroundEnabled,
  });

  // Wrapper functions for multi-item resize
  const handleNodeUpdate = useCallback((updatedNode: DiagramNodeData) => {
    setDiagramData(prevData => ({
      ...prevData,
      nodes: prevData.nodes?.map(n => n.id === updatedNode.id ? updatedNode : n) || []
    }));
  }, [setDiagramData]);

  const handleNodeResize = useCallback((nodeId: string, newWidth: number, newHeight: number) => {
    if (selectedItemIds.size > 1 && selectedItemIds.has(nodeId)) {
      // Multi-select resize: calculate scale factors from the dragged node
      const draggedOriginal = originalDimensionsRef.current.get(nodeId);
      if (draggedOriginal) {
        const scaleX = draggedOriginal.width > 0 ? newWidth / draggedOriginal.width : 1;
        const scaleY = draggedOriginal.height > 0 ? newHeight / draggedOriginal.height : 1;
        
        // Separate nodes and zones
        const selectedNodeIds: string[] = [];
        const selectedZoneIds: string[] = [];
        
        selectedItemIds.forEach(id => {
          if (nodesById[id]) {
            selectedNodeIds.push(id);
          } else if (zonesById[id]) {
            selectedZoneIds.push(id);
          }
        });
        
        if (selectedNodeIds.length > 0) {
          operations.resizeMultipleNodes(selectedNodeIds, scaleX, scaleY, originalDimensionsRef.current);
        }
        if (selectedZoneIds.length > 0) {
          operations.resizeMultipleGroups(selectedZoneIds, scaleX, scaleY, originalDimensionsRef.current);
        }
      } else {
        operations.resizeNode(nodeId, newWidth, newHeight);
      }
    } else {
      operations.resizeNode(nodeId, newWidth, newHeight);
    }
  }, [selectedItemIds, nodesById, zonesById, operations]);

  const handleZoneResize = useCallback((zoneId: string, newWidth: number, newHeight: number) => {
    if (selectedItemIds.size > 1 && selectedItemIds.has(zoneId)) {
      // Multi-select resize: calculate scale factors from the dragged zone
      const draggedOriginal = originalDimensionsRef.current.get(zoneId);
      if (draggedOriginal) {
        const scaleX = draggedOriginal.width > 0 ? newWidth / draggedOriginal.width : 1;
        const scaleY = draggedOriginal.height > 0 ? newHeight / draggedOriginal.height : 1;
        
        // Separate nodes and zones
        const selectedNodeIds: string[] = [];
        const selectedZoneIds: string[] = [];
        
        selectedItemIds.forEach(id => {
          if (nodesById[id]) {
            selectedNodeIds.push(id);
          } else if (zonesById[id]) {
            selectedZoneIds.push(id);
          }
        });
        
        if (selectedNodeIds.length > 0) {
          operations.resizeMultipleNodes(selectedNodeIds, scaleX, scaleY, originalDimensionsRef.current);
        }
        if (selectedZoneIds.length > 0) {
          operations.resizeMultipleGroups(selectedZoneIds, scaleX, scaleY, originalDimensionsRef.current);
        }
      } else {
        operations.resizeGroup(zoneId, newWidth, newHeight);
      }
    } else {
      operations.resizeGroup(zoneId, newWidth, newHeight);
    }
  }, [selectedItemIds, nodesById, zonesById, operations]);

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
    diagramData,
    isReadOnly,
    addNode: operations.addNode,
    moveItem: operations.moveItem,
    moveMultipleItems: operations.moveMultipleItems,
    onDraggingChange,
  });

  // Create display versions of nodes and zones lookup maps that include drag overrides
  const displayNodesById = useMemo(() => {
    const result = { ...nodesById };
    
    // Apply single item drag override
    if (dragPosition?.itemId && result[dragPosition.itemId]) {
      const node = result[dragPosition.itemId];
      const isLineNode = node.type === 'generic.object.line' || node.type?.endsWith('.line');
      
      if (isLineNode && dragPosition.deltaX !== undefined && dragPosition.deltaY !== undefined) {
        // For line nodes, also update startPos and endPos
        const originalNode = nodesById[dragPosition.itemId];
        if (originalNode) {
          const currentStartPos = (originalNode as any)?.startPos || { x: (originalNode?.x || 0), y: (originalNode?.y || 0) };
          const currentEndPos = (originalNode as any)?.endPos || { x: (originalNode?.x || 0) + 150, y: (originalNode?.y || 0) };
          
          result[dragPosition.itemId] = {
            ...node,
            x: dragPosition.x,
            y: dragPosition.y,
            startPos: { x: currentStartPos.x + dragPosition.deltaX, y: currentStartPos.y + dragPosition.deltaY },
            endPos: { x: currentEndPos.x + dragPosition.deltaX, y: currentEndPos.y + dragPosition.deltaY }
          };
        } else {
          result[dragPosition.itemId] = {
            ...node,
            x: dragPosition.x,
            y: dragPosition.y
          };
        }
      } else {
        result[dragPosition.itemId] = {
          ...node,
          x: dragPosition.x,
          y: dragPosition.y
        };
      }
    }
    
    // Apply multi-item drag overrides
    if (multiDragPositions) {
      Object.entries(multiDragPositions).forEach(([itemId, pos]) => {
        if (result[itemId]) {
          const node = result[itemId];
          const isLineNode = node.type === 'generic.object.line' || node.type?.endsWith('.line');
          
          if (isLineNode) {
            // For line nodes, calculate delta and update startPos and endPos
            const originalNode = nodesById[itemId];
            if (originalNode) {
              const originalX = originalNode.x ?? 0;
              const originalY = originalNode.y ?? 0;
              const deltaX = pos.x - originalX;
              const deltaY = pos.y - originalY;
              
              const currentStartPos = (originalNode as any)?.startPos || { x: originalX, y: originalY };
              const currentEndPos = (originalNode as any)?.endPos || { x: originalX + 150, y: originalY };
              
              result[itemId] = {
                ...node,
                x: pos.x,
                y: pos.y,
                startPos: { x: currentStartPos.x + deltaX, y: currentStartPos.y + deltaY },
                endPos: { x: currentEndPos.x + deltaX, y: currentEndPos.y + deltaY }
              };
            } else {
              result[itemId] = {
                ...node,
                x: pos.x,
                y: pos.y
              };
            }
          } else {
            result[itemId] = {
              ...node,
              x: pos.x,
              y: pos.y
            };
          }
        }
      });
    }
    
    return result;
  }, [nodesById, dragPosition, multiDragPositions]);

  const displayZonesById = useMemo(() => {
    const result = { ...zonesById };
    
    // Apply single item drag override
    if (dragPosition?.itemId && result[dragPosition.itemId]) {
      result[dragPosition.itemId] = {
        ...result[dragPosition.itemId],
        x: dragPosition.x,
        y: dragPosition.y
      };
    }
    
    // Apply multi-item drag overrides
    if (multiDragPositions) {
      Object.entries(multiDragPositions).forEach(([itemId, pos]) => {
        if (result[itemId]) {
          result[itemId] = {
            ...result[itemId],
            x: pos.x,
            y: pos.y
          };
        }
      });
    }
    
    return result;
  }, [zonesById, dragPosition, multiDragPositions]);

  // ============================================================================
  // HOOK: useAlignmentGuides
  // ============================================================================
  // Calculates alignment guides during drag operations
  // Shows green semi-transparent lines when objects align
  // Note: Must be called AFTER displayNodesById and displayZonesById are created
  // See: src/hooks/use-alignment-guides.ts
  const draggedItemId = dragPosition?.itemId || null;
  const draggedItemIds = multiDragPositions ? new Set(Object.keys(multiDragPositions)) : new Set<string>();

  const { guides: alignmentGuides } = useAlignmentGuides({
    diagramData,
    displayNodesById,
    displayZonesById,
    draggedItemId,
    draggedItemIds,
    transform,
    enabled: alignmentGuidesEnabled,
  });

  // ============================================================================
  // HOOK: useCanvasContextMenu
  // ============================================================================
  // Manages right-click context menu state and position
  // - contextMenu: Current menu state (visible, x, y, itemType, itemId)
  // - handleContextMenu: Opens context menu at specific position
  // - closeContextMenu: Closes the context menu
  // See: src/hooks/use-canvas-context-menu.ts
  const { contextMenu, handleContextMenu, closeContextMenu } = useCanvasContextMenu({ isReadOnly });
  const [lastRightClickItemId, setLastRightClickItemId] = React.useState<string | null>(null);
  const [searchModalPosition, setSearchModalPosition] = React.useState({ x: 0, y: 0 });
  const [searchModalDiagramPosition, setSearchModalDiagramPosition] = React.useState<{ x: number; y: number } | null>(null);



  // ============================================================================
  // HOOK: useCanvasClipboard
  // ============================================================================
  // Handles copy, paste, and clipboard operations
  // - handleCopy: Copies selected item(s) to clipboard
  // - handlePaste: Pastes clipboard content at mouse position
  // - canPaste: Checks if clipboard has content to paste
  // See: src/hooks/use-canvas-clipboard.ts
  const { clipboard, handleCopy, handlePaste, canPaste } = useCanvasClipboard({
    diagramData,
    selectedItemIds,
    setDiagramData,
    setSelectedItemIds,
    setSelectedItem,
    onItemSelect,
    onBatchSelect,
    onClipboardChange,
    toast,
  });

  // ============================================================================
  // HOOK: useCanvasExport
  // ============================================================================
  // Manages PNG export functionality
  // - exportPng: Exports current viewport to PNG
  // - startExport: Starts export with quality settings
  // See: src/hooks/use-canvas-export.ts
  const { exportPng, startExport } = useCanvasExport({
    canvasRef,
    transform,
    width,
    height,
    toast,
    diagramData,
    processedNodes,
    processedZones,
    selectedItemIds,
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
    isReadOnly,
    diagramData,
    onItemSelect,
    onBatchSelect,
    onSelectionChange,
    closeContextMenu,
    onCloseConnectionSettingsPanel: onResetConnectionSettingsTrigger,
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
  const { isPanning, handleMouseDown: handleInteractionsMouseDown, handleMouseMove: handleInteractionsMouseMove, handleMouseUpOrLeave: handleInteractionsMouseUpOrLeave, handleTouchStart, handleTouchMove, handleTouchEnd, wasLastRightClickAPan } = useCanvasInteractions({
    canvasRef,
    transform,
    setTransform,
    isConnectMode,
    onMousePositionChange,
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
  // Wrapped in useCallback for stable references (enables DiagramNode memoization)
  const handleNodeClick = useCallback((e: React.MouseEvent, node: DiagramNodeData) => {
    e.stopPropagation();
    closeContextMenu();
    onResetConnectionSettingsTrigger?.(); // Reset connection settings panel when clicking on a node
    if (isConnectMode) {
      onNodeClickInConnectMode(node); // In connect mode, clicking creates connection
    } else {
      onItemSelect({ ...node, itemType: 'node' }, e.shiftKey); // Normal selection
    }
  }, [closeContextMenu, onResetConnectionSettingsTrigger, isConnectMode, onNodeClickInConnectMode, onItemSelect]);

  const handleNodeContextMenu = useCallback((e: React.MouseEvent, node: DiagramNodeData) => {
    e.stopPropagation();
    e.preventDefault();
    // If multiple items are selected and this node is already in the selection, preserve the selection
    // Otherwise, select just this node
    if (selectedItemIds.size > 1 && selectedItemIds.has(node.id)) {
      // Preserve multi-selection - don't change selection
    } else if (selectedItemId !== node.id) {
      onItemSelect({ ...node, itemType: 'node' }, false);
    }
    // Always reset connection settings trigger when opening context menu
    onResetConnectionSettingsTrigger?.();
    setLastRightClickItemId(node.id);
    handleContextMenu(e, node.id, 'node'); // Opens context menu
  }, [selectedItemIds, selectedItemId, onItemSelect, onResetConnectionSettingsTrigger, handleContextMenu]);

  const handleZoneClick = useCallback((e: React.MouseEvent, zone: DiagramZoneData) => {
    e.stopPropagation();
    closeContextMenu();
    onResetConnectionSettingsTrigger?.(); // Reset connection settings panel when clicking on a zone
    if (isConnectMode) {
      onNodeClickInConnectMode(zone as any); // Zones can also be connection targets
    } else {
      onItemSelect({ ...zone, itemType: 'node' } as Parameters<typeof onItemSelect>[0], e.shiftKey);
    }
  }, [closeContextMenu, onResetConnectionSettingsTrigger, isConnectMode, onNodeClickInConnectMode, onItemSelect]);

  const handleZoneContextMenu = useCallback((e: React.MouseEvent, zone: DiagramZoneData) => {
    e.stopPropagation();
    e.preventDefault();
    // If multiple items are selected and this zone is already in the selection, preserve the selection
    // Otherwise, select just this zone
    if (selectedItemIds.size > 1 && selectedItemIds.has(zone.id)) {
      // Preserve multi-selection - don't change selection
    } else if (selectedItemId !== zone.id) {
      onItemSelect({ ...zone, itemType: 'node' } as Parameters<typeof onItemSelect>[0], false);
    }
    // Always reset connection settings trigger when opening context menu
    onResetConnectionSettingsTrigger?.();
    setLastRightClickItemId(zone.id);
    handleContextMenu(e, zone.id, 'zone');
  }, [selectedItemIds, selectedItemId, onItemSelect, onResetConnectionSettingsTrigger, handleContextMenu]);

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
  // CANVAS DIMENSIONS TRACKING
  // ============================================================================
  // Tracks canvas container dimensions using ResizeObserver
  // This is needed for rulers to display correctly
  useEffect(() => {
    if (!canvasRef.current) return;

    const updateDimensions = () => {
      if (canvasRef.current) {
        setCanvasDimensions({
          width: canvasRef.current.offsetWidth,
          height: canvasRef.current.offsetHeight
        });
      }
    };

    // Initial dimensions
    updateDimensions();

    // Set up ResizeObserver to track dimension changes
    if (typeof ResizeObserver !== 'undefined') {
      const resizeObserver = new ResizeObserver(() => {
        updateDimensions();
      });
      
      resizeObserver.observe(canvasRef.current);
      
      return () => {
        resizeObserver.disconnect();
      };
    } else {
      // Fallback for browsers without ResizeObserver
      const handleResize = () => {
        updateDimensions();
      };
      
      window.addEventListener('resize', handleResize);
      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }
  }, []);

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

  const pastePaletteItemHandler = useCallback((item: any, position?: { x: number; y: number }) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();

    // If diagram-space position provided (e.g. from right-click search modal), use it
    if (position && typeof position.x === 'number' && typeof position.y === 'number') {
      operations.addNode(item, { x: position.x, y: position.y }, null);
      return;
    }

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
    exportPng: (options?: { backgroundColor?: 'transparent' | 'white'; quality?: 'low' | 'medium' | 'high' }) => exportPng(options), // Exports current viewport to PNG
    copy: copyHandler, // Copies selected item(s)
    paste: pasteHandler, // Pastes from clipboard
    canPaste: canPasteHandler, // Checks if paste is available
    pastePaletteItem: pastePaletteItemHandler, // Pastes a new item from the sidebar palette
  }), [handleFitToView, exportPng, copyHandler, pasteHandler, canPasteHandler, pastePaletteItemHandler]);

  return (
    <div className="relative w-full h-full" data-tutorial-id="canvas">
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
          id="canvas-container"
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
            e.preventDefault();
            // If user right-click-dragged to pan, don't show search - they wanted to pan
            if (wasLastRightClickAPan()) return;
            // Nodes and zones handle their own context menus and call stopPropagation
            // If we reach here, it's empty canvas - show search resources modal
            const target = e.target as HTMLElement;
            if (target.closest('[data-node-id]') || target.closest('[data-zone-id]')) return;
            if (isReadOnly || !onResourceActivateAtPosition) return;
            if (!canvasRef.current) return;
            const rect = canvasRef.current.getBoundingClientRect();
            const canvasRelativeX = e.clientX - rect.left;
            const canvasRelativeY = e.clientY - rect.top;
            const diagramX = snapToGrid((canvasRelativeX - transform.x) / transform.k);
            const diagramY = snapToGrid((canvasRelativeY - transform.y) / transform.k);
            setSearchModalPosition({ x: e.clientX, y: e.clientY });
            setSearchModalDiagramPosition({ x: diagramX, y: diagramY });
            setSearchModalOpen(true);
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
            {/* Zones removed - diagram is flat (nodes only) */}

            {/* ================================================================
                NODES + CONNECTIONS (Order-aware layering)
                ================================================================
                Connections are interleaved with nodes so they respect z-order:
                - Connections go behind shapes that are "in front" of both endpoints
                - Connections go in front of shapes that are "behind" both endpoints
                See: src/lib/connection-order-utils.ts
            */}
            {connectionSlots.sortedItemIds.flatMap((itemId, i) => {
              const slotConnections = connectionSlots.connectionsBySlot.get(i);
              const connIndices = slotConnections?.length
                ? new Set(slotConnections)
                : undefined;
              const node = nodesById[itemId];
              const zone = zonesById[itemId];
              // Z-indices interleave: conn-slot-i (2*i) behind node-i (2*i+1), enabling order-aware line layering
              const connZIndex = 2 * i;
              const nodeZIndex = 2 * i + 1;
              const nodeEl = node ? (
                <DiagramNode
                  key={node.id}
                  node={displayNodesById[node.id] || node}
                  stackZIndex={nodeZIndex}
                  isSelected={selectedItemId === node.id || (selectedItemIds?.has(node.id) ?? false)}
                  isMultiSelected={selectedItemIds?.has(node.id) && (selectedItemIds?.size ?? 0) > 1}
                  isGroupMember={
                    selectedItemId !== node.id &&
                    selectedItemId !== undefined &&
                    getItemGroup(selectedItemId, diagramData) !== null &&
                    getItemGroup(node.id, diagramData) !== null &&
                    getItemGroup(selectedItemId, diagramData)?.id === getItemGroup(node.id, diagramData)?.id
                  }
                  onClick={(e: React.MouseEvent) => handleNodeClick(e, node)}
                  onContextMenu={(e: React.MouseEvent) => handleNodeContextMenu(e, node)}
                  onResize={handleNodeResize}
                  onResizeStart={handleResizeStart}
                  onResizeEnd={handleResizeEnd}
                  onLabelUpdate={onLabelUpdate}
                  onTagUpdate={onTagUpdate}
                  onDraggingChange={onDraggingChange}
                  onUpdate={handleNodeUpdate}
                  hoverEnabled={hoverEnabled}
                  isReadOnly={isReadOnly}
                  onHoverChange={handleHoverChange}
                  onConnect={onConnect}
                  isConnectMode={isConnectMode && selectedItemId === node.id}
                  transform={transform}
                  canvasRef={canvasRef}
                />
              ) : zone ? null : null;
              return [
                connIndices ? (
                  <CanvasConnections
                    key={`conn-slot-${i}`}
                    width={width}
                    height={height}
                    diagramData={diagramData}
                    nodesById={displayNodesById}
                    zonesById={displayZonesById}
                    selectedItemId={selectedItemId}
                    onItemSelect={onItemSelect}
                    closeContextMenu={closeContextMenu}
                    onConnectionDelete={onConnectionDelete}
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
                  nodesById={displayNodesById}
                  zonesById={displayZonesById}
                  selectedItemId={selectedItemId}
                  onItemSelect={onItemSelect}
                  closeContextMenu={closeContextMenu}
                  onConnectionDelete={onConnectionDelete}
                  connectionIndices={new Set(lastSlot)}
                  stackZIndex={2 * n}
                />
              );
            })()}

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
              nodesById={displayNodesById}
              zonesById={displayZonesById}
              setDiagramData={setDiagramData}
              isReadOnly={isReadOnly}
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
              nodesById={displayNodesById}
              zonesById={displayZonesById}
              processedZones={processedZones}
            />

            {/* ================================================================
                CONNECTION WAYPOINT HANDLES
                Renders draggable waypoint handles when a connection is selected
            */}
            {(() => {
              if (isReadOnly || !onConnectionWaypointMove || !selectedItemId) return null;
              const conn = diagramData.connections.find(
                (c) => `${c.from}-${c.to}` === selectedItemId && c.waypoints?.length
              );
              if (!conn?.waypoints?.length) return null;
              const fromNode = displayNodesById[conn.from] || displayZonesById[conn.from];
              const toNode = displayNodesById[conn.to] || displayZonesById[conn.to];
              const fromItem = fromNode || diagramData.nodes.find((n) => n.id === conn.from);
              const toItem = toNode || diagramData.nodes.find((n) => n.id === conn.to);
              const connColor = conn.color || (toItem as any)?.lineColor || (fromItem as any)?.lineColor || "#6b7280";
              return (
                <ConnectionWaypointHandles
                  connection={conn}
                  waypoints={conn.waypoints}
                  connectionColor={connColor}
                  transform={transform}
                  onWaypointMove={onConnectionWaypointMove}
                  disabled={isReadOnly}
                />
              );
            })()}

            {/* ================================================================
                ALIGNMENT GUIDES
                ================================================================
                Renders visual alignment guide lines during drag operations
                Shows green semi-transparent lines when objects align
                See: src/components/editor/canvas-alignment-guides.tsx
            */}
            <CanvasAlignmentGuides
              guides={alignmentGuides}
              width={width}
              height={height}
              transform={transform}
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
              ROTATION HANDLES OVERLAY
              ====================================================================
              Shows rotation handles at corners of selected/hovered items
              Includes green angle HUD while dragging
              See: src/components/editor/canvas-rotation-overlay.tsx
          */}
          {rotationTarget && (() => {
            const target = rotationTarget.type === 'node'
              ? displayNodesById[rotationTarget.id]
              : displayZonesById[rotationTarget.id];

            if (!target) return null;

            // Calculate bounds
            let bounds: { x: number; y: number; width: number; height: number };
            
            if (rotationTarget.type === 'node') {
              const node = target as PositionedNode;
              const dims = measureNodeDims(node);
              bounds = {
                x: node.x || 0,
                y: node.y || 0,
                width: dims.width,
                height: dims.height,
              };
            } else {
              const zone = target as PositionedGroup;
              bounds = {
                x: zone.x || 0,
                y: zone.y || 0,
                width: zone.width || 300,
                height: zone.height || 220,
              };
            }

            const currentRotation = (target as any).rotation || 0;
            const dragRotation = rotationDragState?.isActive && rotationDragState.targetId === rotationTarget.id
              ? rotationDragState.currentRotation
              : undefined;

            return (
              <CanvasRotationOverlay
                transform={transform}
                targetBounds={bounds}
                rotation={currentRotation}
                isDragging={(rotationDragState?.isActive && rotationDragState.targetId === rotationTarget.id) ?? false}
                dragRotation={dragRotation}
                onHandlePointerDown={handleRotationHandlePointerDown}
              />
            );
          })()}

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
            itemId={contextMenu.itemId}
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
            onLineStyling={contextMenu.itemType === 'node' && (() => {
              const node = diagramData.nodes.find(n => n.id === contextMenu.itemId);
              return node && (node.type === 'generic.object.line' || node.type?.endsWith('.line'));
            })() ? () => {
              if (onTriggerLineStylingPanel) {
                onTriggerLineStylingPanel();
              }
              closeContextMenu();
            } : undefined}
            connections={diagramData.connections?.filter((conn: DiagramConnectionData) => 
              conn.from === contextMenu.itemId || conn.to === contextMenu.itemId
            ) || []}
            triggerConnectionSettings={() => {
              if (onTriggerConnectionSettingsPanel) {
                onTriggerConnectionSettingsPanel();
              }
              closeContextMenu();
            }}
            nodeType={contextMenu.itemType === 'node' ? (diagramData.nodes.find(n => n.id === contextMenu.itemId)?.type) : undefined}
            onToggleLock={() => {
              if (contextMenu.itemType === 'node') {
                const node = diagramData.nodes.find(n => n.id === contextMenu.itemId);
                if (node) {
                  setDiagramData(prev => ({
                    ...prev,
                    nodes: prev.nodes.map(n =>
                      n.id === contextMenu.itemId
                        ? { ...n, locked: !n.locked }
                        : n
                    )
                  }));
                }
              }
              closeContextMenu();
            }}
            isLocked={contextMenu.itemType === 'node' ? (diagramData.nodes.find(n => n.id === contextMenu.itemId)?.locked || false) : false}
            currentLayer={layers ? layers.getItemLayerById(contextMenu.itemId) : undefined}
            availableLayers={layers ? layers.getAllLayers() : []}
            onChangeLayer={(layerId: string) => {
              if (layers) {
                // If multiple items are selected, move all selected items to the layer
                // Otherwise, move just the right-clicked item
                const itemsToMove = selectedItemIds.size > 1 
                  ? Array.from(selectedItemIds) 
                  : [contextMenu.itemId];
                layers.assignItemsToLayer(itemsToMove, layerId);
              }
            }}
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
                if (!zone.orientation) return 'auto';
                if (zone.orientation === 'square') return 'grid';
                return zone.orientation;
              })()
            }
            canGroup={selectedItemIds.size >= 2}
            isGrouped={getItemGroup(contextMenu.itemId, diagramData) !== null}
            canAddToGroup={(() => {
              if (selectedItemIds.size < 2) return false;
              
              // Find if any selected items are in a group
              const selectedItemsWithGroups = Array.from(selectedItemIds).map(itemId => ({
                itemId,
                group: getItemGroup(itemId, diagramData)
              })).filter(item => item.group !== null);
              
              // If no selected items are in any group, can't add to group
              if (selectedItemsWithGroups.length === 0) return false;
              
              // If all selected items are in the same group, no need to add to group
              const uniqueGroupIds = new Set(selectedItemsWithGroups.map(item => item.group!.id));
              if (uniqueGroupIds.size === 1 && selectedItemsWithGroups.length === selectedItemIds.size) return false;
              
              // If selected items are from different groups, can't add to group
              if (uniqueGroupIds.size > 1) return false;
              
              // Otherwise, we have some items in one group and some not in that group - allow adding to group
              return true;
            })()}
            onAddToGroup={() => {
              // Find the group that selected items should be added to
              const selectedItemsWithGroups = Array.from(selectedItemIds).map(itemId => ({
                itemId,
                group: getItemGroup(itemId, diagramData)
              })).filter(item => item.group !== null);
              
              if (selectedItemsWithGroups.length > 0 && onAddToGroupItems) {
                // Use the first group found (there should only be one based on canAddToGroup logic)
                const targetGroup = selectedItemsWithGroups[0].group!;
                onAddToGroupItems(targetGroup.id);
              }
            }}
            onGroup={onGroupItems}
            onUngroup={onUngroupItems}
            onRemoveFromGroup={(itemId: string) => {
              if (onRemoveFromGroup) {
                // Create a temporary selection with just this item
                const originalSelectedIds = selectedItemIds;
                setSelectedItemIds(new Set([itemId]));
                onRemoveFromGroup();
                // Restore original selection
                setSelectedItemIds(originalSelectedIds);
              }
            }}
            onMoveToBack={() => {
              if (onMoveToBack) {
                onMoveToBack();
              }
              closeContextMenu();
            }}
            onMoveToFront={() => {
              if (onMoveToFront) {
                onMoveToFront();
              }
              closeContextMenu();
            }}
            onMoveOneBack={() => {
              if (onMoveOneBack) {
                onMoveOneBack();
              }
              closeContextMenu();
            }}
            onMoveOneForward={() => {
              if (onMoveOneForward) {
                onMoveOneForward();
              }
              closeContextMenu();
            }}
            canMoveToBack={!!onMoveToBack && (contextMenu.itemType === 'node' || contextMenu.itemType === 'zone')}
            canMoveToFront={!!onMoveToFront && (contextMenu.itemType === 'node' || contextMenu.itemType === 'zone')}
            canMoveOneBack={!!onMoveOneBack && (contextMenu.itemType === 'node' || contextMenu.itemType === 'zone')}
            canMoveOneForward={!!onMoveOneForward && (contextMenu.itemType === 'node' || contextMenu.itemType === 'zone')}
            onLayoutChange={(layout) => onZoneLayoutChange?.(contextMenu.itemId, layout)}
            onCycleItems={() => onZoneCycle?.(contextMenu.itemId)}
            onSortItems={(order) => onZoneSort?.(contextMenu.itemId, order)}
          />
          {onResourceActivateAtPosition && (
            <SearchResourcesModal
              open={searchModalOpen}
              onOpenChange={(open) => {
                setSearchModalOpen(open);
                if (!open) setSearchModalDiagramPosition(null);
              }}
              position={searchModalPosition}
              onResourceActivate={(resource, provider, category, fullItem) => {
                const pos = searchModalDiagramPosition;
                if (pos) onResourceActivateAtPosition(resource as any, provider, category, pos, fullItem);
              }}
            />
          )}
        </div>
    </div>
  );
});
