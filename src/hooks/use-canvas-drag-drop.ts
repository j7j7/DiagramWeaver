import { useState, useRef, useEffect, useLayoutEffect, type MutableRefObject } from "react";
import { useDrop } from 'react-dnd';
import { ItemTypes } from "@/components/editor/draggable-item";
import { snapToGrid } from "@/components/editor/canvas-constants";
import type { Transform } from "./use-canvas-transform";
import type { PositionedNode, PositionedGroup } from "@/components/editor/canvas-constants";
import type { DiagramData, DiagramNodeData } from "@/lib/types";
import { getItemGroup, getGroupMembers } from "@/lib/grouping-utils";
import { isConnectorLineNodeType } from "@/lib/utils";
import { getConnectorLineVertices } from "@/lib/line-curve-path";

/** Diagram-space radius around drag origin: inside = free movement; crossing = lock to dominant axis */
const AXIS_CONSTRAINT_DEAD_ZONE = 15;

type AxisLock = "h" | "v" | null;

function applyCtrlAxisConstraint(
  rawDx: number,
  rawDy: number,
  ctrlHeld: boolean,
  axisLockRef: MutableRefObject<AxisLock>,
  deadZone: number
): { dx: number; dy: number } {
  if (!ctrlHeld) {
    axisLockRef.current = null;
    return { dx: rawDx, dy: rawDy };
  }
  const dist = Math.hypot(rawDx, rawDy);
  if (dist < deadZone) {
    axisLockRef.current = null;
    return { dx: rawDx, dy: rawDy };
  }
  if (axisLockRef.current === null) {
    axisLockRef.current = Math.abs(rawDx) >= Math.abs(rawDy) ? "h" : "v";
  }
  if (axisLockRef.current === "h") {
    return { dx: rawDx, dy: 0 };
  }
  return { dx: 0, dy: rawDy };
}

/**
 * Selection may include connection ids; only items that exist as nodes/zones on the canvas can be dragged.
 * Including edge ids broke multi Alt+duplicate: allDuplicatableNodes was false and commitMulti failed ids.every().
 */
function canvasDraggableIdsFromSelection(
  selectedItemIds: Set<string>,
  nodesById: Record<string, PositionedNode>,
  zonesById: Record<string, PositionedGroup>
): Set<string> {
  const out = new Set<string>();
  selectedItemIds.forEach((id) => {
    if (nodesById[id] || zonesById[id]) out.add(id);
  });
  return out;
}

function getCanvasDragAnchor(
  itemId: string,
  nodesById: Record<string, PositionedNode>,
  zonesById: Record<string, PositionedGroup>
): { x: number; y: number } | null {
  const originalItem = nodesById[itemId] || zonesById[itemId];
  if (!originalItem) return null;
  const isLineNode = isConnectorLineNodeType(originalItem.type);
  if (isLineNode && (originalItem as { startPos?: { x: number; y: number } }).startPos && (originalItem as { endPos?: { x: number; y: number } }).endPos) {
    const verts = getConnectorLineVertices(originalItem as any);
    return { x: Math.min(...verts.map((p) => p.x)), y: Math.min(...verts.map((p) => p.y)) };
  }
  return { x: originalItem.x ?? 0, y: originalItem.y ?? 0 };
}

type DropItem = {
  id?: string;
  type?: string;
  label?: string;
  x?: number;
  y?: number;
};

/** Last hover-computed positions (HTML5 drop often runs after mouseup; monitor delta can be 0/stale). */
type CanvasDragCommitSnapshot = {
  multi: { [itemId: string]: { x: number; y: number } } | null;
  single: {
    x: number;
    y: number;
    deltaX: number;
    deltaY: number;
    itemId?: string;
  } | null;
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
  /** Control key — axis constraint during canvas drag (same sync strategy as Alt). */
  const ctrlModifierRef = useRef(false);
  /** Horizontal vs vertical axis lock while Ctrl is held (see applyCtrlAxisConstraint). */
  const axisLockRef = useRef<AxisLock>(null);

  /**
   * During native/react-dnd drags, keydown/keyup often do not reach listeners in the bubble phase.
   * Capture-phase keyboard events + dragover/mousemove keep Alt in sync while dragging (press Alt
   * after drag starts, or release Alt mid-drag).
   */
  useEffect(() => {
    const readModifiers = (e: Event) => {
      const ne = e as MouseEvent & KeyboardEvent & DragEvent;
      const alt =
        ne.altKey === true ||
        (typeof ne.getModifierState === "function" && ne.getModifierState("Alt"));
      if (altModifierRef.current !== alt) {
        altModifierRef.current = alt;
        setAltKeyHeld(alt);
      }
      const ctrl =
        ne.ctrlKey === true ||
        (typeof ne.getModifierState === "function" && ne.getModifierState("Control"));
      if (ctrlModifierRef.current !== ctrl) {
        ctrlModifierRef.current = ctrl;
        if (!ctrl) axisLockRef.current = null;
      }
    };
    const onBlur = () => {
      if (altModifierRef.current) {
        altModifierRef.current = false;
        setAltKeyHeld(false);
      }
      ctrlModifierRef.current = false;
      axisLockRef.current = null;
    };
    document.addEventListener("dragover", readModifiers, true);
    document.addEventListener("mousemove", readModifiers, true);
    window.addEventListener("pointermove", readModifiers, true);
    window.addEventListener("keydown", readModifiers, true);
    window.addEventListener("keyup", readModifiers, true);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("dragover", readModifiers, true);
      document.removeEventListener("mousemove", readModifiers, true);
      window.removeEventListener("pointermove", readModifiers, true);
      window.removeEventListener("keydown", readModifiers, true);
      window.removeEventListener("keyup", readModifiers, true);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  const [dragPosition, setDragPosition] = useState<{ x: number; y: number; itemId?: string; deltaX?: number; deltaY?: number } | null>(null);
  const [multiDragPositions, setMultiDragPositions] = useState<{ [itemId: string]: { x: number; y: number } } | null>(null);
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);
  const isDraggingRef = useRef(false);
  const isDroppingOnScratchpadRef = useRef(false);
  const pendingDragRef = useRef<{
    single: { x: number; y: number; itemId?: string; deltaX?: number; deltaY?: number } | null;
    multi: { [itemId: string]: { x: number; y: number } } | null;
  } | null>(null);
  const dragRafIdRef = useRef<number | null>(null);
  const lastCanvasDragCommitRef = useRef<CanvasDragCommitSnapshot | null>(null);

  const noOpDrop = () => {};

  const [, drop] = useDrop(() => ({
    accept: [ItemTypes.DIAGRAM_NODE, ItemTypes.CANVAS_NODE, ItemTypes.ZONE],
    hover: (item: DropItem, monitor) => {
      if (isReadOnly) return;
      if (!canvasRef.current) return;

      // New drag session: drop stale commit/axis from the previous gesture (must run before we write commit below)
      if (!isDraggingRef.current) {
        axisLockRef.current = null;
        lastCanvasDragCommitRef.current = null;
      }

      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;
      
      const rect = canvasRef.current.getBoundingClientRect();
      const x = (clientOffset.x - rect.left - transform.x) / transform.k;
      const y = (clientOffset.y - rect.top - transform.y) / transform.k;

      // Update drag position for real-time display (+ optional Ctrl axis constraint)
      let itemX = x;
      let itemY = y;
      let deltaX = 0;
      let deltaY = 0;
      let usedAnchorForCanvasDelta = false;

      if (item.id && (monitor.getItemType() === ItemTypes.CANVAS_NODE || monitor.getItemType() === ItemTypes.ZONE)) {
        const initialCanvasPos = monitor.getInitialSourceClientOffset();
        const deltaPix = monitor.getDifferenceFromInitialOffset();
        if (initialCanvasPos && deltaPix) {
          const anchor = getCanvasDragAnchor(item.id, nodesById, zonesById);
          if (anchor) {
            const rawDx = deltaPix.x / transform.k;
            const rawDy = deltaPix.y / transform.k;
            const c = applyCtrlAxisConstraint(
              rawDx,
              rawDy,
              ctrlModifierRef.current,
              axisLockRef,
              AXIS_CONSTRAINT_DEAD_ZONE
            );
            itemX = anchor.x + c.dx;
            itemY = anchor.y + c.dy;
            const axSnap = snapToGrid(itemX);
            const aySnap = snapToGrid(itemY);
            deltaX = axSnap - anchor.x;
            deltaY = aySnap - anchor.y;
            itemX = axSnap;
            itemY = aySnap;
            usedAnchorForCanvasDelta = true;
          }
        }
      }

      const snappedX = snapToGrid(itemX);
      const snappedY = snapToGrid(itemY);

      if (!usedAnchorForCanvasDelta && item.id && (monitor.getItemType() === ItemTypes.CANVAS_NODE || monitor.getItemType() === ItemTypes.ZONE)) {
        const anchor = getCanvasDragAnchor(item.id, nodesById, zonesById);
        if (anchor) {
          deltaX = snappedX - anchor.x;
          deltaY = snappedY - anchor.y;
        }
      }
      
      // Check if item is in multi-select first, then check group membership
      // Multi-select takes priority over group membership when multiple items are selected
      let itemsToMove = new Set<string>();
      if (item.id) {
        if (selectedItemIds.size > 1 && selectedItemIds.has(item.id)) {
          // Multiple items are selected and the dragged item is one of them - move all selected items
          // This takes priority over group membership (omit connection ids — not draggable nodes)
          canvasDraggableIdsFromSelection(selectedItemIds, nodesById, zonesById).forEach((id) =>
            itemsToMove.add(id)
          );
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
      
      // Handle multi-item dragging (either grouped or multi-selected).
      // Always read start x/y from nodesById/zonesById (diagram state is unchanged until drop) so
      // we never rely on refs that document mouseup may clear before drop runs.
      let newMulti: { [itemId: string]: { x: number; y: number } } | null = null;
      if (item.id && itemsToMove.size > 1) {
        newMulti = {};
        itemsToMove.forEach((id) => {
          const node = nodesById[id] || zonesById[id];
          if (node) {
            const sx = node.x ?? 0;
            const sy = node.y ?? 0;
            newMulti![id] = {
              x: snapToGrid(sx + deltaX),
              y: snapToGrid(sy + deltaY),
            };
          }
        });
      }

      if (
        item.id &&
        (monitor.getItemType() === ItemTypes.CANVAS_NODE || monitor.getItemType() === ItemTypes.ZONE)
      ) {
        lastCanvasDragCommitRef.current = {
          multi: newMulti
            ? Object.fromEntries(
                Object.entries(newMulti).map(([k, v]) => [k, { x: v.x, y: v.y }])
              )
            : null,
          single:
            itemsToMove.size <= 1
              ? { x: snappedX, y: snappedY, deltaX, deltaY, itemId: item.id }
              : null,
        };
      }
      
      // Throttle: store in ref, schedule RAF to flush (max once per frame).
      // First pointermove of a drag: also apply position synchronously so the canvas sees
      // `dragPosition` / `multiDragPositions` in the same commit as `onDraggingChange(true)`.
      // Otherwise connections may reroute for one frame while moving a non-endpoint item.
      const isFirstDragHover = !isDraggingRef.current;
      if (!isDroppingOnScratchpadRef.current) {
        pendingDragRef.current = {
          single: { x: snappedX, y: snappedY, itemId: item.id, deltaX, deltaY },
          multi: newMulti,
        };
        if (isFirstDragHover) {
          setDragPosition(pendingDragRef.current.single);
          setMultiDragPositions(pendingDragRef.current.multi);
        }
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
        const committed = lastCanvasDragCommitRef.current?.single;
        if (committed && committed.itemId === item.id) {
          x = committed.x;
          y = committed.y;
        } else {
          const initialCanvasPos = monitor.getInitialSourceClientOffset();
          const delta = monitor.getDifferenceFromInitialOffset();
          if (!initialCanvasPos || !delta) {
            x = (currentPos.x - canvasRect.left - transform.x) / transform.k;
            y = (currentPos.y - canvasRect.top - transform.y) / transform.k;
          } else {
            const anchor = item.id ? getCanvasDragAnchor(item.id, nodesById, zonesById) : null;
            if (anchor) {
              const rawDx = delta.x / transform.k;
              const rawDy = delta.y / transform.k;
              const c = applyCtrlAxisConstraint(
                rawDx,
                rawDy,
                ctrlModifierRef.current,
                axisLockRef,
                AXIS_CONSTRAINT_DEAD_ZONE
              );
              x = anchor.x + c.dx;
              y = anchor.y + c.dy;
            } else {
              const originalItem = nodesById[item.id!] || zonesById[item.id!];
              const initialX = originalItem?.x ?? 0;
              const initialY = originalItem?.y ?? 0;
              x = initialX + delta.x / transform.k;
              y = initialY + delta.y / transform.k;
            }
          }
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
        isDraggingRef.current = false;
        axisLockRef.current = null;
        onDraggingChange?.(false);
        setHoveredGroupId(null);
        lastCanvasDragCommitRef.current = null;
        
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
          // This takes priority over group membership (omit connection ids — not draggable nodes)
          canvasDraggableIdsFromSelection(selectedItemIds, nodesById, zonesById).forEach((id) =>
            itemsToMoveSet.add(id)
          );
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
        /** Alt+duplicate only clones diagram nodes (not zones); edges in selection are already filtered out. */
        const allSelectedAreNodesForDuplicate = [...itemsToMoveSet].every((id) => Boolean(nodesById[id]));

        // Handle multi-item movement (grouped or multi-selected).
        // Start positions from live nodesById/zonesById — not a ref cleared by mouseup-before-drop.
        if (itemsToMoveSet.size > 1) {
          const commitMulti = lastCanvasDragCommitRef.current?.multi;
          const ids = [...itemsToMoveSet];
          const useCommit =
            commitMulti &&
            ids.length > 1 &&
            ids.every((id) => commitMulti[id] != null);

          const dupItems: Array<{ id: string }> = [];
          const dupPositions: Array<{ x: number; y: number }> = [];
          const itemsToMove: Array<{ id: string; type: string; x?: number; y?: number }> = [];
          const newPositions: Array<{ x: number; y: number }> = [];

          if (useCommit) {
            ids.forEach((id) => {
              const pos = commitMulti![id];
              const n = nodesById[id] || zonesById[id];
              if (!n) return;
              const sx = n.x ?? 0;
              const sy = n.y ?? 0;
              dupItems.push({ id });
              dupPositions.push({ x: pos.x, y: pos.y });
              const it = nodesById[id] ? ItemTypes.CANVAS_NODE : ItemTypes.ZONE;
              itemsToMove.push({ id, type: it, x: sx, y: sy });
              newPositions.push({ x: pos.x, y: pos.y });
            });
          } else {
            const initialCanvasPos = monitor.getInitialSourceClientOffset();
            const delta = monitor.getDifferenceFromInitialOffset();
            let deltaX = 0,
              deltaY = 0;
            if (initialCanvasPos && delta) {
              const rawDx = delta.x / transform.k;
              const rawDy = delta.y / transform.k;
              const c = applyCtrlAxisConstraint(
                rawDx,
                rawDy,
                ctrlModifierRef.current,
                axisLockRef,
                AXIS_CONSTRAINT_DEAD_ZONE
              );
              deltaX = c.dx;
              deltaY = c.dy;
            }

            itemsToMoveSet.forEach((id) => {
              const n = nodesById[id] || zonesById[id];
              if (!n) return;
              const sx = n.x ?? 0;
              const sy = n.y ?? 0;
              const newX = snapToGrid(sx + deltaX);
              const newY = snapToGrid(sy + deltaY);
              dupItems.push({ id });
              dupPositions.push({ x: newX, y: newY });
              const it = nodesById[id] ? ItemTypes.CANVAS_NODE : ItemTypes.ZONE;
              itemsToMove.push({ id, type: it, x: sx, y: sy });
              newPositions.push({ x: newX, y: newY });
            });
          }

          const duplicatePairs = dupItems
            .map((d, i) => ({ id: d.id, pos: dupPositions[i] }))
            .filter((p) => nodesById[p.id]);
          if (wantDuplicate && allSelectedAreNodesForDuplicate && duplicatePairs.length > 0) {
            const created = duplicateNodesAtPositions(
              duplicatePairs.map((p) => ({ id: p.id })),
              duplicatePairs.map((p) => p.pos),
              diagramData
            );
            if (created.length > 0) onDuplicateNodesPlaced?.(created);
          } else if (itemsToMove.length > 0) {
            moveMultipleItems(itemsToMove, newPositions, targetGroupIdForFreeflow);
          }
        } else if (wantDuplicate && item.id && nodesById[item.id]) {
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
      isDraggingRef.current = false;
      axisLockRef.current = null;
      lastCanvasDragCommitRef.current = null;
      onDraggingChange?.(false);
      setHoveredGroupId(null);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  }), [transform, processedZones, hoveredGroupId, moveItem, moveMultipleItems, duplicateNodesAtPositions, onDuplicateNodesPlaced, addNode, nodesById, zonesById, selectedItemIds, canvasRef, diagramData]);

  // Touch palette drops (sidebar icons/shapes): HTML5 DnD is unreliable on mobile — palette items
  // dispatch `mobileDrop` on the canvas element with viewport coordinates.
  useLayoutEffect(() => {
    const el = canvasRef.current;
    if (!el || isReadOnly) return;

    type MobileDropDetail = {
      item?: unknown;
      clientX?: number;
      clientY?: number;
      itemType?: string;
    };

    const onMobilePaletteDrop = (e: Event) => {
      const ce = e as CustomEvent<MobileDropDetail>;
      const { item, clientX, clientY, itemType } = ce.detail ?? {};
      if (itemType !== ItemTypes.DIAGRAM_NODE || item == null) return;
      if (typeof clientX !== "number" || typeof clientY !== "number") return;

      const rect = el.getBoundingClientRect();
      if (
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom
      ) {
        return;
      }

      let x = (clientX - rect.left - transform.x) / transform.k;
      let y = (clientY - rect.top - transform.y) / transform.k;
      x = snapToGrid(x);
      y = snapToGrid(y);
      addNode(item as any, { x, y }, null);
    };

    el.addEventListener("mobileDrop", onMobilePaletteDrop as EventListener);
    return () => el.removeEventListener("mobileDrop", onMobilePaletteDrop as EventListener);
  }, [isReadOnly, addNode, canvasRef, transform.x, transform.y, transform.k]);

  // Touch moves for items already on the canvas (nodes/zones): long-press-drag emits `mobileMove`.
  useLayoutEffect(() => {
    const el = canvasRef.current;
    if (!el || isReadOnly) return;

    type MobileMoveDetail = {
      id?: string;
      itemType?: string;
      clientStartX?: number;
      clientStartY?: number;
      clientEndX?: number;
      clientEndY?: number;
    };

    const onMobileMove = (e: Event) => {
      const ce = e as CustomEvent<MobileMoveDetail>;
      const d = ce.detail ?? {};
      const { id, itemType, clientStartX, clientStartY, clientEndX, clientEndY } = d;
      if (
        !id ||
        typeof clientStartX !== "number" ||
        typeof clientStartY !== "number" ||
        typeof clientEndX !== "number" ||
        typeof clientEndY !== "number"
      ) {
        return;
      }
      if (itemType !== ItemTypes.CANVAS_NODE && itemType !== ItemTypes.ZONE) return;

      const rect = el.getBoundingClientRect();
      const toDiag = (cx: number, cy: number) => ({
        x: (cx - rect.left - transform.x) / transform.k,
        y: (cy - rect.top - transform.y) / transform.k,
      });
      const start = toDiag(clientStartX, clientStartY);
      const end = toDiag(clientEndX, clientEndY);
      const dRaw = { x: end.x - start.x, y: end.y - start.y };

      const anchor = getCanvasDragAnchor(id, nodesById, zonesById);
      if (!anchor) return;

      const newAnchorX = snapToGrid(anchor.x + dRaw.x);
      const newAnchorY = snapToGrid(anchor.y + dRaw.y);
      const deltaX = newAnchorX - anchor.x;
      const deltaY = newAnchorY - anchor.y;

      const scratchpadElement =
        document.querySelector('[data-testid="scratchpad"]') ||
        document.querySelector(".fixed.top-20.right-20");
      const hit =
        typeof document.elementFromPoint === "function"
          ? document.elementFromPoint(clientEndX, clientEndY)
          : null;
      const droppedOnScratch = Boolean(scratchpadElement && hit && scratchpadElement.contains(hit));
      if (droppedOnScratch) return;

      const targetGroupIdForFreeflow: string | null = null;

      const group = getItemGroup(id, diagramData);
      let itemsToMoveSet = new Set<string>();

      if (selectedItemIds.size > 1 && selectedItemIds.has(id)) {
        canvasDraggableIdsFromSelection(selectedItemIds, nodesById, zonesById).forEach((mid) =>
          itemsToMoveSet.add(mid),
        );
      } else if (group) {
        getGroupMembers(group.id, diagramData).forEach((mid) => itemsToMoveSet.add(mid));
      } else {
        itemsToMoveSet.add(id);
      }

      if (itemsToMoveSet.size > 1) {
        const itemsToMove: Array<{ id: string; type: string; x?: number; y?: number }> = [];
        const newPositions: Array<{ x: number; y: number }> = [];
        itemsToMoveSet.forEach((nid) => {
          const n = nodesById[nid] || zonesById[nid];
          if (!n) return;
          const sx = n.x ?? 0;
          const sy = n.y ?? 0;
          const newX = snapToGrid(sx + deltaX);
          const newY = snapToGrid(sy + deltaY);
          const it = nodesById[nid] ? ItemTypes.CANVAS_NODE : ItemTypes.ZONE;
          itemsToMove.push({ id: nid, type: it, x: sx, y: sy });
          newPositions.push({ x: newX, y: newY });
        });
        if (itemsToMove.length > 0) {
          moveMultipleItems(itemsToMove, newPositions, targetGroupIdForFreeflow);
        }
      } else {
        const entity = nodesById[id] || zonesById[id];
        const mvType = nodesById[id] ? ItemTypes.CANVAS_NODE : ItemTypes.ZONE;
        moveItem(
          {
            id,
            type: mvType,
            x: entity?.x,
            y: entity?.y,
          },
          { x: newAnchorX, y: newAnchorY },
          targetGroupIdForFreeflow,
        );
      }
    };

    el.addEventListener("mobileMove", onMobileMove as EventListener);
    return () => el.removeEventListener("mobileMove", onMobileMove as EventListener);
  }, [
    isReadOnly,
    canvasRef,
    transform.x,
    transform.y,
    transform.k,
    moveItem,
    moveMultipleItems,
    nodesById,
    zonesById,
    selectedItemIds,
    diagramData,
  ]);

  // Cleanup multi-drag state when drag ends outside of drop
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDraggingRef.current) {
        if (dragRafIdRef.current !== null) {
          cancelAnimationFrame(dragRafIdRef.current);
          dragRafIdRef.current = null;
        }
        pendingDragRef.current = null;
        // Clear both so a mouseup-before-drop frame does not show only the primary node at drag delta
        setDragPosition(null);
        setMultiDragPositions(null);
        isDraggingRef.current = false;
        axisLockRef.current = null;
        onDraggingChange?.(false);
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
  }, [onDraggingChange]);

  return {
    dragPosition,
    multiDragPositions,
    hoveredGroupId,
    drop: isReadOnly ? noOpDrop : drop,
    altKeyHeld,
  };
}

