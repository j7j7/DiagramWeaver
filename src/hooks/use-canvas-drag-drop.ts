import { useState, useRef, useEffect } from "react";
import { useDrop } from 'react-dnd';
import { ItemTypes } from "@/components/editor/draggable-item";
import { snapToGrid } from "@/components/editor/canvas-constants";
import type { Transform } from "./use-canvas-transform";
import type { PositionedNode, PositionedGroup } from "@/components/editor/canvas-constants";
import type { DiagramData, DiagramNodeData } from "@/lib/types";
import { getItemGroup, getGroupMembers } from "@/lib/grouping-utils";

type DropItem = { 
  id?: string; 
  type?: string; 
  label?: string; 
  x?: number; 
  y?: number;
};

interface UseCanvasDragDropOptions {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  transform: Transform;
  processedZones: PositionedGroup[];
  nodesById: Record<string, PositionedNode>;
  zonesById: Record<string, PositionedGroup>;
  selectedItemIds: Set<string>;
  diagramData: DiagramData;
  isReadOnly?: boolean;
  addNode: (item: any, position: { x: number; y: number }, targetGroupId: string | null) => void;
  moveItem: (item: { id: string; type: string; x?: number, y?: number }, newPos: { x: number; y: number }, targetGroupId: string | null) => void;
  moveMultipleItems: (items: Array<{ id: string; type: string; x?: number, y?: number }>, newPositions: Array<{ x: number; y: number }>, targetGroupId: string | null) => void;
  duplicateNodesAtPositions: (
    items: Array<{ id: string }>,
    newPositions: Array<{ x: number; y: number }>,
    sourceDiagram: DiagramData
  ) => DiagramNodeData[];
  /** After Alt+duplicate drop: receive new nodes so the canvas can update selection */
  onDuplicateNodesPlaced?: (newNodes: DiagramNodeData[]) => void;
  onDraggingChange?: (isDragging: boolean) => void;
}

export function useCanvasDragDrop({
  canvasRef,
  transform,
  processedZones,
  nodesById,
  zonesById,
  selectedItemIds,
  diagramData,
  isReadOnly = false,
  addNode,
  moveItem,
  moveMultipleItems,
  duplicateNodesAtPositions,
  onDuplicateNodesPlaced,
  onDraggingChange,
}: UseCanvasDragDropOptions) {
  const [altKeyHeld, setAltKeyHeld] = useState(false);
  /** Updated synchronously on modifier events so drop() sees the real Alt state (state alone can lag). */
  const altModifierRef = useRef(false);

  /**
   * During native/react-dnd drags, keydown/keyup often do not reach listeners in the bubble phase.
   * Capture-phase keyboard events + dragover/mousemove keep Alt in sync while dragging (press Alt
   * after drag starts, or release Alt mid-drag).
   */
  useEffect(() => {
    const readAlt = (e: Event) => {
      const ne = e as MouseEvent & KeyboardEvent & DragEvent;
      const alt =
        ne.altKey === true ||
        (typeof ne.getModifierState === "function" && ne.getModifierState("Alt"));
      if (altModifierRef.current !== alt) {
        altModifierRef.current = alt;
        setAltKeyHeld(alt);
      }
    };
    const onBlur = () => {
      if (altModifierRef.current) {
        altModifierRef.current = false;
        setAltKeyHeld(false);
      }
    };
    document.addEventListener("dragover", readAlt, true);
    document.addEventListener("mousemove", readAlt, true);
    window.addEventListener("pointermove", readAlt, true);
    window.addEventListener("keydown", readAlt, true);
    window.addEventListener("keyup", readAlt, true);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("dragover", readAlt, true);
      document.removeEventListener("mousemove", readAlt, true);
      window.removeEventListener("pointermove", readAlt, true);
      window.removeEventListener("keydown", readAlt, true);
      window.removeEventListener("keyup", readAlt, true);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  const [dragPosition, setDragPosition] = useState<{ x: number; y: number; itemId?: string; deltaX?: number; deltaY?: number } | null>(null);
  const [multiDragPositions, setMultiDragPositions] = useState<{ [itemId: string]: { x: number; y: number } } | null>(null);
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);
  const isDraggingRef = useRef(false);
  const multiDragStartPositions = useRef<{ [itemId: string]: { x: number; y: number } } | null>(null);
  const isDroppingOnScratchpadRef = useRef(false);
  const pendingDragRef = useRef<{
    single: { x: number; y: number; itemId?: string; deltaX?: number; deltaY?: number } | null;
    multi: { [itemId: string]: { x: number; y: number } } | null;
  } | null>(null);
  const dragRafIdRef = useRef<number | null>(null);

  const noOpDrop = () => {};

  const [, drop] = useDrop(() => ({
    accept: [ItemTypes.DIAGRAM_NODE, ItemTypes.CANVAS_NODE, ItemTypes.ZONE],
    hover: (item: DropItem, monitor) => {
      if (isReadOnly) return;
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
            // For line nodes, use the min of startPos/endPos as the initial position
            // This ensures consistency with how line nodes are rendered
            const isLineNode = originalItem.type === 'generic.object.line' || originalItem.type?.endsWith('.line');
            let initialX: number;
            let initialY: number;
            
            if (isLineNode && (originalItem as any).startPos && (originalItem as any).endPos) {
              // Use min of startPos/endPos for line nodes
              const startPos = (originalItem as any).startPos;
              const endPos = (originalItem as any).endPos;
              initialX = Math.min(startPos.x, endPos.x);
              initialY = Math.min(startPos.y, endPos.y);
            } else {
              // For other nodes, use x/y directly
              initialX = originalItem.x ?? 0;
              initialY = originalItem.y ?? 0;
            }
            
            itemX = initialX + delta.x / transform.k;
            itemY = initialY + delta.y / transform.k;
            deltaX = delta.x / transform.k;
            deltaY = delta.y / transform.k;
          }
        }
      }
      
      // Snap to grid for display
      const snappedX = snapToGrid(itemX);
      const snappedY = snapToGrid(itemY);
      
      // Recalculate delta based on snapped positions for consistency
      if (item.id && (monitor.getItemType() === ItemTypes.CANVAS_NODE || monitor.getItemType() === ItemTypes.ZONE)) {
        const originalItem = nodesById[item.id] || zonesById[item.id];
        if (originalItem) {
          const originalX = originalItem.x ?? 0;
          const originalY = originalItem.y ?? 0;
          deltaX = snappedX - originalX;
          deltaY = snappedY - originalY;
        }
      }
      
      // Check if item is in multi-select first, then check group membership
      // Multi-select takes priority over group membership when multiple items are selected
      let itemsToMove = new Set<string>();
      if (item.id) {
        if (selectedItemIds.size > 1 && selectedItemIds.has(item.id)) {
          // Multiple items are selected and the dragged item is one of them - move all selected items
          // This takes priority over group membership
          selectedItemIds.forEach(id => itemsToMove.add(id));
        } else {
          // Check if item is in a group (only if not part of multi-select)
          const group = getItemGroup(item.id, diagramData);
          if (group) {
            const members = getGroupMembers(group.id, diagramData);
            members.forEach(id => itemsToMove.add(id));
          } else {
            itemsToMove.add(item.id);
          }
        }
      }
      
      // Handle multi-item dragging (either grouped or multi-selected)
      let newMulti: { [itemId: string]: { x: number; y: number } } | null = null;
      if (item.id && itemsToMove.size > 1) {
        // Initialize start positions if not already done
        if (!multiDragStartPositions.current) {
          multiDragStartPositions.current = {};
          itemsToMove.forEach(id => {
            const node = nodesById[id] || zonesById[id];
            if (node) {
              multiDragStartPositions.current![id] = { x: node.x ?? 0, y: node.y ?? 0 };
            }
          });
        }
        
        // Calculate positions for all items
        newMulti = {};
        itemsToMove.forEach(id => {
          const startPos = multiDragStartPositions.current![id];
          if (startPos) {
            newMulti![id] = {
              x: snapToGrid(startPos.x + deltaX),
              y: snapToGrid(startPos.y + deltaY)
            };
          }
        });
      } else {
        multiDragStartPositions.current = null;
      }
      
      // Throttle: store in ref, schedule RAF to flush (max once per frame)
      if (!isDroppingOnScratchpadRef.current) {
        pendingDragRef.current = {
          single: { x: snappedX, y: snappedY, itemId: item.id, deltaX, deltaY },
          multi: newMulti,
        };
        if (dragRafIdRef.current === null) {
          dragRafIdRef.current = requestAnimationFrame(() => {
            dragRafIdRef.current = null;
            const pending = pendingDragRef.current;
            if (pending) {
              setDragPosition(pending.single);
              setMultiDragPositions(pending.multi);
            }
          });
        }
      }
      if (!isDraggingRef.current) {
        isDraggingRef.current = true;
        onDraggingChange?.(true);
      }

      // All nodes use free placement - never add to zones on drop
      const isFreeflowNode = true;
      let targetGroupId: string | null = null;

      if (false) { // Zone highlighting disabled - all nodes use free placement
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
            isAncestor = checkDescendants(item.id!);
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
      if (isReadOnly) return;
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
      
      // Check if drop is on scratchpad (don't move the item if it is)
      const scratchpadElement = document.querySelector('[data-testid="scratchpad"]') || 
                               document.querySelector('.fixed.top-20.right-20');
      const clientOffset = monitor.getClientOffset();
      const isDroppedOnScratchpad = scratchpadElement && 
        (clientOffset && 
         scratchpadElement.contains(document.elementFromPoint(
           clientOffset!.x, 
           clientOffset!.y
         )));
      


      // If dropped on scratchpad, clear drag state to let item return to data position
      if (isDroppedOnScratchpad && item.id && (itemType === ItemTypes.CANVAS_NODE || itemType === ItemTypes.ZONE)) {
        if (dragRafIdRef.current !== null) {
          cancelAnimationFrame(dragRafIdRef.current);
          dragRafIdRef.current = null;
        }
        pendingDragRef.current = null;
        setDragPosition(null);
        setMultiDragPositions(null);
        multiDragStartPositions.current = null;
        isDraggingRef.current = false;
        onDraggingChange?.(false);
        setHoveredGroupId(null);
        
        // Force browser refresh after a short delay to ensure item is added to scratchpad first
        setTimeout(() => {
          window.location.reload();
        }, 200);
        
        return;
      }

      // All nodes use free placement - never add to zones on drop
      const targetGroupIdForFreeflow: string | null = null;
      
      if (itemType === ItemTypes.DIAGRAM_NODE) { 
        // Pass full item data to preserve resource information
        addNode(item as any, { x, y }, targetGroupIdForFreeflow);
      } else if (item.id && (itemType === ItemTypes.CANVAS_NODE || itemType === ItemTypes.ZONE)) {
        // Skip move operation if dropped on scratchpad
        if (!isDroppedOnScratchpad) {
        // Check if item is in multi-select first, then check group membership
        // Multi-select takes priority over group membership when multiple items are selected
        const group = getItemGroup(item.id, diagramData);
        let itemsToMoveSet = new Set<string>();
        
        if (selectedItemIds.size > 1 && selectedItemIds.has(item.id)) {
          // Multiple items are selected and the dragged item is one of them - move all selected items
          // This takes priority over group membership
          selectedItemIds.forEach(id => itemsToMoveSet.add(id));
        } else {
          // Check if item is in a group (only if not part of multi-select)
          if (group) {
            const members = getGroupMembers(group.id, diagramData);
            members.forEach(id => itemsToMoveSet.add(id));
          } else {
            itemsToMoveSet.add(item.id);
          }
        }
        
        const wantDuplicate = altModifierRef.current;
        const allDuplicatableNodes = [...itemsToMoveSet].every((id) => Boolean(nodesById[id]));

        // Handle multi-item movement (grouped or multi-selected)
        if (itemsToMoveSet.size > 1 && multiDragStartPositions.current) {
          const initialCanvasPos = monitor.getInitialSourceClientOffset();
          const delta = monitor.getDifferenceFromInitialOffset();
          let deltaX = 0,
            deltaY = 0;
          if (initialCanvasPos && delta) {
            deltaX = delta.x / transform.k;
            deltaY = delta.y / transform.k;
          }

          const dupItems: Array<{ id: string }> = [];
          const dupPositions: Array<{ x: number; y: number }> = [];
          const itemsToMove: Array<{ id: string; type: string; x?: number; y?: number }> = [];
          const newPositions: Array<{ x: number; y: number }> = [];

          itemsToMoveSet.forEach((id) => {
            const startPos = multiDragStartPositions.current![id];
            if (!startPos) return;
            const newX = snapToGrid(startPos.x + deltaX);
            const newY = snapToGrid(startPos.y + deltaY);
            dupItems.push({ id });
            dupPositions.push({ x: newX, y: newY });
            const it = nodesById[id] ? ItemTypes.CANVAS_NODE : ItemTypes.ZONE;
            itemsToMove.push({ id, type: it, x: startPos.x, y: startPos.y });
            newPositions.push({ x: newX, y: newY });
          });

          if (wantDuplicate && allDuplicatableNodes && dupItems.length > 0) {
            const created = duplicateNodesAtPositions(dupItems, dupPositions, diagramData);
            if (created.length > 0) onDuplicateNodesPlaced?.(created);
          } else if (itemsToMove.length > 0) {
            moveMultipleItems(itemsToMove, newPositions, targetGroupIdForFreeflow);
          }
        } else if (wantDuplicate && allDuplicatableNodes && item.id && nodesById[item.id]) {
          const created = duplicateNodesAtPositions([{ id: item.id }], [{ x, y }], diagramData);
          if (created.length > 0) onDuplicateNodesPlaced?.(created);
        } else {
          // Single item movement
          moveItem({ id: item.id, type: item.type || "", x: item.x, y: item.y }, { x, y }, targetGroupIdForFreeflow);
        }
        }
      }
      
      // Clear drag position display after drop; cancel any pending RAF
      if (dragRafIdRef.current !== null) {
        cancelAnimationFrame(dragRafIdRef.current);
        dragRafIdRef.current = null;
      }
      pendingDragRef.current = null;
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
  }), [transform, processedZones, hoveredGroupId, moveItem, moveMultipleItems, duplicateNodesAtPositions, onDuplicateNodesPlaced, addNode, nodesById, zonesById, selectedItemIds, canvasRef, diagramData]);

  // Cleanup multi-drag state when drag ends outside of drop
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDraggingRef.current) {
        if (dragRafIdRef.current !== null) {
          cancelAnimationFrame(dragRafIdRef.current);
          dragRafIdRef.current = null;
        }
        pendingDragRef.current = null;
        setMultiDragPositions(null);
        multiDragStartPositions.current = null;
      }
    };
    
    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      if (dragRafIdRef.current !== null) {
        cancelAnimationFrame(dragRafIdRef.current);
        dragRafIdRef.current = null;
      }
    };
  }, []);

  return {
    dragPosition,
    multiDragPositions,
    hoveredGroupId,
    drop: isReadOnly ? noOpDrop : drop,
    altKeyHeld,
  };
}

