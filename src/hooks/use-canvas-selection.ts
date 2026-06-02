import { useState, useCallback, useEffect, useMemo } from "react";
import type { DiagramData, DiagramConnectionData } from "@/lib/types";
import type { Transform } from "./use-canvas-transform";

export type MarqueeSelectionMode = "none" | "objects" | "connections";

interface MarqueePlan {
  mode: MarqueeSelectionMode;
  itemIds: string[];
}

/** Pure marquee hit-test: picks object vs connection mode by top-left-first candidate. */
export function computeMarqueeSelectionPlan(diagramData: DiagramData, x1: number, y1: number, x2: number, y2: number): MarqueePlan {
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

  const onSegment = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) =>
    bx <= Math.max(ax, cx) && bx >= Math.min(ax, cx) && by <= Math.max(ay, cy) && by >= Math.min(ay, cy);

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

  type ObjectHit = { id: string; sortY: number; sortX: number };
  const objectHits: ObjectHit[] = [];

  diagramData.nodes.forEach((node) => {
    if (node.locked) return;
    const nodeX = node.x || 0;
    const nodeY = node.y || 0;
    const nodeWidth = node.width || 80;
    const nodeHeight = node.height || 50;
    if (nodeX >= x1 && nodeX + nodeWidth <= x2 && nodeY >= y1 && nodeY + nodeHeight <= y2) {
      objectHits.push({ id: node.id, sortY: nodeY, sortX: nodeX });
    }
  });

  diagramData.zones?.forEach((zone) => {
    const zoneX = zone.x || 0;
    const zoneY = zone.y || 0;
    const zoneWidth = zone.width || 300;
    const zoneHeight = zone.height || 220;
    if (zoneX >= x1 && zoneX + zoneWidth <= x2 && zoneY >= y1 && zoneY + zoneHeight <= y2) {
      objectHits.push({ id: zone.id, sortY: zoneY, sortX: zoneX });
    }
  });

  objectHits.sort((a, b) => (a.sortY !== b.sortY ? a.sortY - b.sortY : a.sortX - b.sortX));

  type ConnHit = { id: string; sortY: number; sortX: number };
  const connectionHits: ConnHit[] = [];

  (diagramData.connections ?? []).forEach((connection, index) => {
    const fromCenter = getItemCenter(connection.from);
    const toCenter = getItemCenter(connection.to);
    if (!fromCenter || !toCenter) return;

    const points = [
      fromCenter,
      ...(connection.waypoints?.map((waypoint) => ({ x: waypoint.x, y: waypoint.y })) || []),
      toCenter,
    ];

    for (let i = 0; i < points.length - 1; i += 1) {
      const start = points[i];
      const end = points[i + 1];
      if (segmentIntersectsRect(start.x, start.y, end.x, end.y)) {
        const conn = connection as DiagramConnectionData;
        const cid = conn.id ?? `${conn.from}-${conn.to}-${index}`;
        const sortY = (fromCenter.y + toCenter.y) / 2;
        const sortX = (fromCenter.x + toCenter.x) / 2;
        connectionHits.push({ id: cid, sortY, sortX });
        break;
      }
    }
  });

  connectionHits.sort((a, b) => (a.sortY !== b.sortY ? a.sortY - b.sortY : a.sortX - b.sortX));

  const firstObject = objectHits[0];
  const firstConn = connectionHits[0];

  if (!firstObject && !firstConn) {
    return { mode: "none", itemIds: [] };
  }

  if (firstObject && !firstConn) {
    return { mode: "objects", itemIds: objectHits.map((h) => h.id) };
  }

  if (!firstObject && firstConn) {
    return { mode: "connections", itemIds: connectionHits.map((h) => h.id) };
  }

  const objectFirst =
    firstObject.sortY < firstConn.sortY ||
    (firstObject.sortY === firstConn.sortY && firstObject.sortX < firstConn.sortX);

  if (objectFirst) {
    return { mode: "objects", itemIds: objectHits.map((h) => h.id) };
  }
  return { mode: "connections", itemIds: connectionHits.map((h) => h.id) };
}

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

  const liveMarqueePlan = useMemo((): MarqueePlan | null => {
    if (!selectionStart || !selectionEnd) return null;
    const dragDeltaX = Math.abs(selectionEnd.x - selectionStart.x);
    const dragDeltaY = Math.abs(selectionEnd.y - selectionStart.y);
    if (dragDeltaX < 2 && dragDeltaY < 2) return null;
    const x1 = Math.min(selectionStart.x, selectionEnd.x);
    const y1 = Math.min(selectionStart.y, selectionEnd.y);
    const x2 = Math.max(selectionStart.x, selectionEnd.x);
    const y2 = Math.max(selectionStart.y, selectionEnd.y);
    return computeMarqueeSelectionPlan(diagramData, x1, y1, x2, y2);
  }, [selectionStart, selectionEnd, diagramData]);

  const selectionMarqueeMode: MarqueeSelectionMode = liveMarqueePlan?.mode === "connections" ? "connections" : "objects";

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

      const plan = computeMarqueeSelectionPlan(diagramData, x1, y1, x2, y2);
      const selectedIds = plan.itemIds;

      if (selectedIds.length > 0 && onBatchSelect) {
        onBatchSelect(selectedIds);
      } else if (selectedIds.length > 0) {
        const firstId = selectedIds[0];
        const primaryNode = diagramData.nodes.find((n) => n.id === firstId);
        const primaryGroup = diagramData.zones?.find((zone) => zone.id === firstId);

        let primaryItem = null;
        if (primaryNode) {
          primaryItem = { ...primaryNode, itemType: "node" as const };
        } else if (primaryGroup) {
          primaryItem = { ...primaryGroup, itemType: "zone" as const };
        }

        if (primaryItem) {
          onItemSelect(primaryItem);
        }
      } else {
        onItemSelect(null);
      }

      setSelectionStart(null);
      setSelectionEnd(null);

      if (selectedIds.length > 0) {
        setJustCompletedSelection(true);
        setTimeout(() => setJustCompletedSelection(false), 100);
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
    selectionMarqueeMode,
    justCompletedSelection,
    handleCanvasClick,
    handleMouseDown,
    handleMouseMove,
    handleMouseUpOrLeave,
  };
}

