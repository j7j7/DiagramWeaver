import { useState, useCallback, useEffect } from "react";
import type { DiagramData } from "@/lib/types";
import { snapToGrid } from "@/components/editor/canvas-constants";
import type { Transform } from "./use-canvas-transform";

interface UseCanvasSelectionOptions {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  transform: Transform;
  isConnectMode: boolean;
  isReadOnly?: boolean;
  diagramData: DiagramData;
  onItemSelect: (item: any | null, shiftKey?: boolean) => void;
  onBatchSelect?: (itemIds: string[]) => void;
  onSelectionChange?: (selection: { start: { x: number; y: number } | null; end: { x: number; y: number } | null }) => void;
  closeContextMenu: () => void;
  onCloseConnectionSettingsPanel?: () => void;
}

export function useCanvasSelection({
  canvasRef,
  transform,
  isConnectMode,
  isReadOnly = false,
  diagramData,
  onItemSelect,
  onBatchSelect,
  onSelectionChange,
  closeContextMenu,
  onCloseConnectionSettingsPanel,
}: UseCanvasSelectionOptions) {
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{ x: number; y: number } | null>(null);
  const [justCompletedSelection, setJustCompletedSelection] = useState(false);

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const hasMultiSelectModifier = e.shiftKey || e.ctrlKey || e.metaKey;

    const target = e.target as HTMLElement;
    if (justCompletedSelection) return;

    // Don't clear selection when clicking context menu (e.g. Text/Visual Styling)
    // Otherwise the panel would unmount before it can show
    if (target.closest('.context-menu')) return;

    const clickedSelectable = target.closest(
      '[data-node-id], [data-zone-id], [data-connection-id], [data-waypoint-id], [data-connection-waypoint-id], [data-resize-handle]'
    );

    if (clickedSelectable) return;

    if (hasMultiSelectModifier) {
      closeContextMenu();
      return;
    }

    onItemSelect(null);
    closeContextMenu();
    onCloseConnectionSettingsPanel?.();
  }, [justCompletedSelection, onItemSelect, closeContextMenu, onCloseConnectionSettingsPanel]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isConnectMode || isReadOnly) return;
    const target = e.target as HTMLElement;
    
    // Handle selection mode with left mouse button (button === 0)
    if (e.button === 0) {
      // Check if clicking on an interactive element - if so, don't start selection
      // Be more specific - only block selection for actual interactive elements
      if (target.closest('.absolute.group') || 
          target.closest('.absolute.rounded-lg') ||
          target.closest('[data-connection-id]') ||
          target.closest('button') || 
          target.closest('input') || 
          target.closest('textarea') ||
          target.closest('[role="button"]') ||
          target.closest('.context-menu')) return;
      
      if (!canvasRef.current) return;
      const contentDiv = canvasRef.current.querySelector('.dot-grid') as HTMLElement;
      if (!contentDiv) return;
      
      // Get bounding rects - we need both to calculate accurate coordinates
      const contentRect = contentDiv.getBoundingClientRect();
      const canvasRect = canvasRef.current.getBoundingClientRect();
      
      // The content div's position in screen space (accounting for transform)
      // We need to convert mouse position to coordinates relative to the untransformed div
      // The div has transform: translate(transform.x, transform.y) scale(transform.k)
      // So: mousePos - canvasPos = canvasSpace coordinates
      // Then: (canvasSpace - transform.x) / transform.k = diagramSpace coordinates
      const mouseX = e.clientX;
      const mouseY = e.clientY;
      
      // Mouse position relative to canvas
      const canvasX = mouseX - canvasRect.left;
      const canvasY = mouseY - canvasRect.top;
      
      // Convert to diagram space (coordinates relative to untransformed .dot-grid div)
      const diagramX = (canvasX - transform.x) / transform.k;
      const diagramY = (canvasY - transform.y) / transform.k;
      
      setSelectionStart({ x: diagramX, y: diagramY });
      setSelectionEnd({ x: diagramX, y: diagramY });
    }
  }, [isConnectMode, isReadOnly, canvasRef, transform]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    // Handle selection when left mouse button is held and we have a selection start
    if (selectionStart && e.buttons === 1) { // e.buttons === 1 means left mouse is pressed
      if (!canvasRef.current) return;
      const contentDiv = canvasRef.current.querySelector('.dot-grid') as HTMLElement;
      if (!contentDiv) return;
      
      const canvasRect = canvasRef.current.getBoundingClientRect();
      const canvasX = e.clientX - canvasRect.left;
      const canvasY = e.clientY - canvasRect.top;
      
      // Convert to coordinates relative to the untransformed .dot-grid div
      const diagramX = (canvasX - transform.x) / transform.k;
      const diagramY = (canvasY - transform.y) / transform.k;
      
      setSelectionEnd({ x: diagramX, y: diagramY });
    }
  }, [selectionStart, canvasRef, transform]);

  const handleMouseUpOrLeave = useCallback(async () => {
    // Handle regular selection completion (select items within selection rectangle)
    if (selectionStart && selectionEnd) {
      const dragDeltaX = Math.abs(selectionEnd.x - selectionStart.x);
      const dragDeltaY = Math.abs(selectionEnd.y - selectionStart.y);

      // Treat click-like interactions as regular clicks, not marquee selection.
      // This avoids clearing existing selection when clicking connections.
      if (dragDeltaX < 2 && dragDeltaY < 2) {
        setSelectionStart(null);
        setSelectionEnd(null);
        return;
      }

      const x1 = Math.min(selectionStart.x, selectionEnd.x);
      const y1 = Math.min(selectionStart.y, selectionEnd.y);
      const x2 = Math.max(selectionStart.x, selectionEnd.x);
      const y2 = Math.max(selectionStart.y, selectionEnd.y);

      const pointInRect = (x: number, y: number) => x >= x1 && x <= x2 && y >= y1 && y <= y2;

      const getItemCenter = (id: string): { x: number; y: number } | null => {
        const node = diagramData.nodes.find((n) => n.id === id);
        if (node) {
          const width = node.width || 80;
          const height = node.height || 50;
          return { x: (node.x || 0) + width / 2, y: (node.y || 0) + height / 2 };
        }
        const zone = diagramData.zones?.find((z) => z.id === id);
        if (zone) {
          const width = zone.width || 300;
          const height = zone.height || 220;
          return { x: (zone.x || 0) + width / 2, y: (zone.y || 0) + height / 2 };
        }
        return null;
      };

      const orientation = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) => {
        const value = (by - ay) * (cx - bx) - (bx - ax) * (cy - by);
        if (Math.abs(value) < 1e-9) return 0;
        return value > 0 ? 1 : 2;
      };

      const onSegment = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) => (
        bx <= Math.max(ax, cx) && bx >= Math.min(ax, cx) && by <= Math.max(ay, cy) && by >= Math.min(ay, cy)
      );

      const segmentsIntersect = (
        p1x: number,
        p1y: number,
        q1x: number,
        q1y: number,
        p2x: number,
        p2y: number,
        q2x: number,
        q2y: number
      ) => {
        const o1 = orientation(p1x, p1y, q1x, q1y, p2x, p2y);
        const o2 = orientation(p1x, p1y, q1x, q1y, q2x, q2y);
        const o3 = orientation(p2x, p2y, q2x, q2y, p1x, p1y);
        const o4 = orientation(p2x, p2y, q2x, q2y, q1x, q1y);

        if (o1 !== o2 && o3 !== o4) return true;
        if (o1 === 0 && onSegment(p1x, p1y, p2x, p2y, q1x, q1y)) return true;
        if (o2 === 0 && onSegment(p1x, p1y, q2x, q2y, q1x, q1y)) return true;
        if (o3 === 0 && onSegment(p2x, p2y, p1x, p1y, q2x, q2y)) return true;
        if (o4 === 0 && onSegment(p2x, p2y, q1x, q1y, q2x, q2y)) return true;
        return false;
      };

      const segmentIntersectsRect = (xA: number, yA: number, xB: number, yB: number) => {
        if (pointInRect(xA, yA) || pointInRect(xB, yB)) return true;
        return (
          segmentsIntersect(xA, yA, xB, yB, x1, y1, x2, y1) ||
          segmentsIntersect(xA, yA, xB, yB, x2, y1, x2, y2) ||
          segmentsIntersect(xA, yA, xB, yB, x2, y2, x1, y2) ||
          segmentsIntersect(xA, yA, xB, yB, x1, y2, x1, y1)
        );
      };
      
      // Find all nodes and groups within the selection rectangle
      const selectedIds = new Set<string>();
      
      // Check nodes
      diagramData.nodes.forEach(node => {
        const nodeX = node.x || 0;
        const nodeY = node.y || 0;
        const nodeWidth = node.width || 80;
        const nodeHeight = node.height || 50;
        
        if (nodeX >= x1 && nodeX + nodeWidth <= x2 && nodeY >= y1 && nodeY + nodeHeight <= y2) {
          selectedIds.add(node.id);
        }
      });
      
      // Check groups
      diagramData.zones?.forEach(zone => {
        const zoneX = zone.x || 0;
        const zoneY = zone.y || 0;
        const zoneWidth = zone.width || 300;
        const zoneHeight = zone.height || 220;
        
        if (zoneX >= x1 && zoneX + zoneWidth <= x2 && zoneY >= y1 && zoneY + zoneHeight <= y2) {
          selectedIds.add(zone.id);
        }
      });

      // Check connections (include if any segment intersects selection rectangle)
      diagramData.connections?.forEach((connection) => {
        const fromCenter = getItemCenter(connection.from);
        const toCenter = getItemCenter(connection.to);
        if (!fromCenter || !toCenter) return;

        const points = [
          fromCenter,
          ...(connection.waypoints?.map((waypoint) => ({ x: waypoint.x, y: waypoint.y })) || []),
          toCenter,
        ];

        for (let index = 0; index < points.length - 1; index += 1) {
          const start = points[index];
          const end = points[index + 1];
          if (segmentIntersectsRect(start.x, start.y, end.x, end.y)) {
            selectedIds.add(`${connection.from}-${connection.to}`);
            break;
          }
        }
      });
      
      // Select all items within the selection rectangle
      if (selectedIds.size > 0 && onBatchSelect) {
        onBatchSelect(Array.from(selectedIds));
      } else if (selectedIds.size > 0) {
        // Fallback to individual selection if batch select not available
        const firstId = Array.from(selectedIds)[0];
        const primaryNode = diagramData.nodes.find(n => n.id === firstId);
        const primaryGroup = diagramData.zones?.find(zone => zone.id === firstId);
        
        let primaryItem = null;
        if (primaryNode) {
          primaryItem = { ...primaryNode, itemType: 'node' as const };
        } else if (primaryGroup) {
          primaryItem = { ...primaryGroup, itemType: 'zone' as const };
        }
        
        if (primaryItem) {
          onItemSelect(primaryItem);
        }
      } else {
        onItemSelect(null);
      }
      
      // Clear selection rectangle
      setSelectionStart(null);
      setSelectionEnd(null);
      
      // Set flag to prevent canvas click from clearing selection
      if (selectedIds.size > 0) {
        setJustCompletedSelection(true);
        setTimeout(() => setJustCompletedSelection(false), 100); // Clear flag after short delay
      }
    }
  }, [selectionStart, selectionEnd, diagramData, onBatchSelect, onItemSelect]);

  // Notify parent of selection changes
  useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange({ start: selectionStart, end: selectionEnd });
    }
  }, [selectionStart, selectionEnd, onSelectionChange]);

  return {
    selectionStart,
    selectionEnd,
    justCompletedSelection,
    handleCanvasClick,
    handleMouseDown,
    handleMouseMove,
    handleMouseUpOrLeave,
  };
}

