import { useState, useCallback, useEffect } from "react";
import type { DiagramData } from "@/lib/types";
import { snapToGrid } from "@/components/editor/canvas-constants";
import type { Transform } from "./use-canvas-transform";

interface UseCanvasSelectionOptions {
  canvasRef: React.RefObject<HTMLDivElement>;
  transform: Transform;
  isConnectMode: boolean;
  diagramData: DiagramData;
  onItemSelect: (item: any | null, shiftKey?: boolean) => void;
  onBatchSelect?: (itemIds: string[]) => void;
  onSelectionChange?: (selection: { start: { x: number; y: number } | null; end: { x: number; y: number } | null }) => void;
  closeContextMenu: () => void;
  onCloseConnectionSettingsPanel?: () => void;
  isSelectionMode: boolean;
  pendingExportOptions: { backgroundColor?: 'transparent' | 'white'; useSelection: boolean } | null;
  exportPng: (options?: { backgroundColor?: 'transparent' | 'white'; selectionArea?: { x: number; y: number; width: number; height: number } }) => Promise<void>;
  onExportComplete?: () => void;
  toast: (options: { variant?: 'destructive' | 'default'; title: string; description: string }) => void;
}

export function useCanvasSelection({
  canvasRef,
  transform,
  isConnectMode,
  diagramData,
  onItemSelect,
  onBatchSelect,
  onSelectionChange,
  closeContextMenu,
  onCloseConnectionSettingsPanel,
  isSelectionMode,
  pendingExportOptions,
  exportPng,
  onExportComplete,
  toast,
}: UseCanvasSelectionOptions) {
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{ x: number; y: number } | null>(null);
  const [justCompletedSelection, setJustCompletedSelection] = useState(false);

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.absolute') === null && !justCompletedSelection) {
      onItemSelect(null);
      closeContextMenu();
      onCloseConnectionSettingsPanel?.();
    }
  }, [justCompletedSelection, onItemSelect, closeContextMenu, onCloseConnectionSettingsPanel]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isConnectMode) return;
    const target = e.target as HTMLElement;
    
    // Handle selection mode with left mouse button (button === 0)
    if (e.button === 0) {
      // Check if clicking on an interactive element - if so, don't start selection
      // Be more specific - only block selection for actual interactive elements
      if (target.closest('.absolute.group') || 
          target.closest('.absolute.rounded-lg') ||
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
  }, [isConnectMode, canvasRef, transform]);

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
    // Handle selection completion for export
    if (isSelectionMode && selectionStart && selectionEnd && pendingExportOptions) {
      // Complete selection and export
      // Selection coordinates are already in diagram space (relative to .dot-grid)
      const x = Math.min(selectionStart.x, selectionEnd.x);
      const y = Math.min(selectionStart.y, selectionEnd.y);
      const width = Math.abs(selectionEnd.x - selectionStart.x);
      const height = Math.abs(selectionEnd.y - selectionStart.y);
      
      if (width > 10 && height > 10) {
        // Debug: log coordinates
        console.log('Export selection:', { x, y, width, height, transform });
        
        try {
          // Pass coordinates directly in diagram space (they're relative to the .dot-grid div)
          await exportPng({
            backgroundColor: pendingExportOptions.backgroundColor,
            selectionArea: { x, y, width, height },
          });
          
          // Wait a bit to ensure transform is fully restored before resetting state
          await new Promise(resolve => requestAnimationFrame(resolve));
          
          // Notify parent that export is complete
          if (onExportComplete) {
            onExportComplete();
          }
        } catch (error) {
          console.error('Export failed:', error);
          toast({ variant: 'destructive', title: 'Export failed', description: 'Export encountered an issue.' });
        }
      }
      
      setSelectionStart(null);
      setSelectionEnd(null);
      return;
    }
    
    // Handle regular selection completion (select items within selection rectangle)
    if (selectionStart && selectionEnd) {
      const x1 = Math.min(selectionStart.x, selectionEnd.x);
      const y1 = Math.min(selectionStart.y, selectionEnd.y);
      const x2 = Math.max(selectionStart.x, selectionEnd.x);
      const y2 = Math.max(selectionStart.y, selectionEnd.y);
      
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
  }, [isSelectionMode, selectionStart, selectionEnd, pendingExportOptions, exportPng, onExportComplete, toast, transform, diagramData, onBatchSelect, onItemSelect]);

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

