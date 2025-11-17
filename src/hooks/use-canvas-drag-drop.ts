import { useState, useRef, useEffect } from "react";
import { useDrop } from 'react-dnd';
import { ItemTypes } from "@/components/editor/draggable-item";
import { snapToGrid } from "@/components/editor/canvas-constants";
import type { Transform } from "./use-canvas-transform";
import type { PositionedNode, PositionedGroup } from "@/components/editor/canvas-constants";
import type { DiagramData } from "@/lib/types";

type DropItem = { 
  id?: string; 
  type?: string; 
  label?: string; 
  x?: number; 
  y?: number;
};

interface UseCanvasDragDropOptions {
  canvasRef: React.RefObject<HTMLDivElement>;
  transform: Transform;
  processedZones: PositionedGroup[];
  nodesById: Record<string, PositionedNode>;
  zonesById: Record<string, PositionedGroup>;
  selectedItemIds: Set<string>;
  addNode: (item: any, position: { x: number; y: number }, targetGroupId: string | null) => void;
  moveItem: (item: { id: string; type: string; x?: number, y?: number }, newPos: { x: number; y: number }, targetGroupId: string | null) => void;
  moveMultipleItems: (items: Array<{ id: string; type: string; x?: number, y?: number }>, newPositions: Array<{ x: number; y: number }>, targetGroupId: string | null) => void;
  onDraggingChange?: (isDragging: boolean) => void;
}

export function useCanvasDragDrop({
  canvasRef,
  transform,
  processedZones,
  nodesById,
  zonesById,
  selectedItemIds,
  addNode,
  moveItem,
  moveMultipleItems,
  onDraggingChange,
}: UseCanvasDragDropOptions) {
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number; itemId?: string } | null>(null);
  const [multiDragPositions, setMultiDragPositions] = useState<{ [itemId: string]: { x: number; y: number } } | null>(null);
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);
  const isDraggingRef = useRef(false);
  const multiDragStartPositions = useRef<{ [itemId: string]: { x: number; y: number } } | null>(null);

  const [, drop] = useDrop(() => ({
    accept: [ItemTypes.DIAGRAM_NODE, ItemTypes.CANVAS_NODE, ItemTypes.ZONE],
    hover: (item: DropItem, monitor) => {
      if (!canvasRef.current) return;
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;
      
      const rect = canvasRef.current.getBoundingClientRect();
      const x = (clientOffset.x - rect.left - transform.x) / transform.k;
      const y = (clientOffset.y - rect.top - transform.y) / transform.k;

      // Update drag position for real-time display
      // hover is only called during drag, so we always update
      let itemX = x;
      let itemY = y;
      let deltaX = 0;
      let deltaY = 0;
      
      if (item.id && (monitor.getItemType() === ItemTypes.CANVAS_NODE || monitor.getItemType() === ItemTypes.ZONE)) {
        // For existing items, calculate based on initial position and delta
        const initialCanvasPos = monitor.getInitialSourceClientOffset();
        const delta = monitor.getDifferenceFromInitialOffset();
        if (initialCanvasPos && delta) {
          const originalItem = nodesById[item.id] || zonesById[item.id];
          if (originalItem) {
            const initialX = originalItem.x ?? 0;
            const initialY = originalItem.y ?? 0;
            itemX = initialX + delta.x / transform.k;
            itemY = initialY + delta.y / transform.k;
            deltaX = delta.x / transform.k;
            deltaY = delta.y / transform.k;
          }
        }
      }
      
      // Snap to grid for display
      itemX = snapToGrid(itemX);
      itemY = snapToGrid(itemY);
      
      // Handle multi-select dragging
      if (item.id && selectedItemIds.has(item.id) && selectedItemIds.size > 1) {
        // Initialize start positions if not already done
        if (!multiDragStartPositions.current) {
          multiDragStartPositions.current = {};
          selectedItemIds.forEach(id => {
            const node = nodesById[id] || zonesById[id];
            if (node) {
              multiDragStartPositions.current![id] = { x: node.x ?? 0, y: node.y ?? 0 };
            }
          });
        }
        
        // Calculate positions for all selected items
        const newPositions: { [itemId: string]: { x: number; y: number } } = {};
        selectedItemIds.forEach(id => {
          const startPos = multiDragStartPositions.current![id];
          if (startPos) {
            newPositions[id] = {
              x: snapToGrid(startPos.x + deltaX),
              y: snapToGrid(startPos.y + deltaY)
            };
          }
        });
        
        setMultiDragPositions(newPositions);
      } else {
        // Single item drag
        setMultiDragPositions(null);
        multiDragStartPositions.current = null;
      }
      
      setDragPosition({ x: itemX, y: itemY, itemId: item.id });
      if (!isDraggingRef.current) {
        isDraggingRef.current = true;
        onDraggingChange?.(true);
      }

      // Check if item is a freeflow node
      const isFreeflowNode = item.id && nodesById[item.id]?.freeflow;

      let targetGroupId: string | null = null;
      
      // Only check for group highlighting if item is NOT a freeflow node
      if (!isFreeflowNode) {
        // Collect all candidate zones that contain the point, then prefer the
        // smallest one (so child zones win over parents when nested).
        const candidateZones: { id: string; area: number }[] = [];

        for (let i = 0; i < processedZones.length; i++) {
          const zone = processedZones[i];
          if (zone.id === item.id) continue;
          
          // Check if item being dragged is an ancestor of potential target zone
          let isAncestor = false;
          if (item.id) {
            const visited = new Set<string>();
            const checkDescendants = (currentZoneId: string): boolean => {
              if (visited.has(currentZoneId)) return false;
              visited.add(currentZoneId);
              if (currentZoneId === zone.id) return true;
              const currentZoneData = processedZones.find(zone => zone.id === currentZoneId);
              if (!currentZoneData) return false;
              return currentZoneData.children.some((childId: string) => {
                const childZone = processedZones.find(zone => zone.id === childId);
                return childZone ? checkDescendants(childZone.id) : false;
              });
            };
            isAncestor = checkDescendants(item.id);
          }
          if (isAncestor) continue;

          if (x > zone.x && x < zone.x + zone.width && y > zone.y && y < zone.y + zone.height) {
            const area = (zone.width || 0) * (zone.height || 0);
            candidateZones.push({ id: zone.id, area: area || Number.MAX_SAFE_INTEGER });
          }
        }

        if (candidateZones.length > 0) {
          candidateZones.sort((a, b) => a.area - b.area);
          targetGroupId = candidateZones[0].id;
        }
      }
      
      setHoveredGroupId(targetGroupId);
    },
    drop: (item: DropItem, monitor) => {
      if (!canvasRef.current) return;
      const canvasRect = canvasRef.current.getBoundingClientRect();
      
      const itemType = monitor.getItemType();
      let x, y;
      
      const currentPos = monitor.getClientOffset();
      if (!currentPos) return;

      if (itemType === ItemTypes.DIAGRAM_NODE) {
        // This is a new item from the sidebar
        x = (currentPos.x - canvasRect.left - transform.x) / transform.k;
        y = (currentPos.y - canvasRect.top - transform.y) / transform.k;
      } else {
        // This is an existing item being moved
        const initialCanvasPos = monitor.getInitialSourceClientOffset();
        const delta = monitor.getDifferenceFromInitialOffset();
        if (!initialCanvasPos || !delta) {
          // If delta isn't available, use client offset as fallback
          x = (currentPos.x - canvasRect.left - transform.x) / transform.k;
          y = (currentPos.y - canvasRect.top - transform.y) / transform.k;
        } else {
          const originalItem = nodesById[item.id!] || zonesById[item.id!];
          const initialX = originalItem?.x ?? 0;
          const initialY = originalItem?.y ?? 0;
          x = initialX + delta.x / transform.k;
          y = initialY + delta.y / transform.k;
        }
      }
      
      // Snap to grid before dropping
      x = snapToGrid(x);
      y = snapToGrid(y);
      
      // Check if item is a freeflow node
      const isFreeflowNode = item.id && nodesById[item.id]?.freeflow;
      const targetGroupIdForFreeflow = isFreeflowNode ? null : hoveredGroupId;
      
      if (itemType === ItemTypes.DIAGRAM_NODE) { 
        // Pass full item data to preserve resource information
        addNode(item as any, { x, y }, targetGroupIdForFreeflow);
      } else if (item.id && (itemType === ItemTypes.CANVAS_NODE || itemType === ItemTypes.ZONE)) {
        // Handle multi-select movement
        if (selectedItemIds.has(item.id) && selectedItemIds.size > 1 && multiDragStartPositions.current) {
          // Move all selected items maintaining relative spacing
          const initialCanvasPos = monitor.getInitialSourceClientOffset();
          const delta = monitor.getDifferenceFromInitialOffset();
          let deltaX = 0, deltaY = 0;
          
          if (initialCanvasPos && delta) {
            deltaX = delta.x / transform.k;
            deltaY = delta.y / transform.k;
          }
          
          const itemsToMove: Array<{ id: string; type: string; x?: number, y?: number }> = [];
          const newPositions: Array<{ x: number; y: number }> = [];
          
          selectedItemIds.forEach(id => {
            const startPos = multiDragStartPositions.current![id];
            if (startPos) {
              const newX = snapToGrid(startPos.x + deltaX);
              const newY = snapToGrid(startPos.y + deltaY);
              const itemType = nodesById[id] ? ItemTypes.CANVAS_NODE : ItemTypes.ZONE;
              itemsToMove.push({ id, type: itemType, x: startPos.x, y: startPos.y });
              newPositions.push({ x: newX, y: newY });
            }
          });
          
          if (itemsToMove.length > 0) {
            moveMultipleItems(itemsToMove, newPositions, targetGroupIdForFreeflow);
          }
        } else {
          // Single item movement
          moveItem({ id: item.id, type: item.type || '', x: item.x, y: item.y }, { x, y }, targetGroupIdForFreeflow);
        }
      }
      
      // Clear drag position display after drop
      setDragPosition(null);
      setMultiDragPositions(null);
      multiDragStartPositions.current = null;
      isDraggingRef.current = false;
      onDraggingChange?.(false);
      setHoveredGroupId(null);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  }), [transform, processedZones, hoveredGroupId, moveItem, moveMultipleItems, addNode, nodesById, zonesById, selectedItemIds, canvasRef]);

  // Cleanup multi-drag state when drag ends outside of drop
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDraggingRef.current) {
        setMultiDragPositions(null);
        multiDragStartPositions.current = null;
      }
    };
    
    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  return {
    dragPosition,
    multiDragPositions,
    hoveredGroupId,
    drop,
  };
}

