import { useState, useCallback, useRef } from "react";
import type { Transform } from "./use-canvas-transform";
import { snapToGrid } from "@/components/editor/canvas-constants";

interface UseCanvasInteractionsOptions {
  canvasRef: React.RefObject<HTMLDivElement>;
  transform: Transform;
  setTransform: (transform: Transform) => void;
  isConnectMode: boolean;
  onMousePositionChange?: (position: { x: number; y: number } | null) => void;
}

export function useCanvasInteractions({
  canvasRef,
  transform,
  setTransform,
  isConnectMode,
  onMousePositionChange,
}: UseCanvasInteractionsOptions) {
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [touchStart, setTouchStart] = useState<{ x: number; y: number; distance: number } | null>(null);
  const [lastTouchDistance, setLastTouchDistance] = useState<number | null>(null);
  
  // Throttle mouse position updates to avoid performance warnings
  const mousePositionThrottleRef = useRef<number | null>(null);
  const lastMousePositionRef = useRef<{ x: number; y: number } | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isConnectMode) return;
    const target = e.target as HTMLElement;
    
    // Handle panning with right mouse button (button === 2)
    if (e.button === 2 && !target.closest('.absolute')) {
      e.preventDefault(); // Prevent context menu
      setIsPanning(true);
      setPanStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
    }
  }, [isConnectMode, transform]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    // Track mouse position for display (throttled to avoid performance warnings)
    if (canvasRef.current && onMousePositionChange) {
      const canvasRect = canvasRef.current.getBoundingClientRect();
      const canvasX = e.clientX - canvasRect.left;
      const canvasY = e.clientY - canvasRect.top;
      
      // Convert to diagram space (coordinates relative to untransformed .dot-grid div)
      const diagramX = (canvasX - transform.x) / transform.k;
      const diagramY = (canvasY - transform.y) / transform.k;
      
      // Snap to grid for display consistency
      const snappedPosition = { x: snapToGrid(diagramX), y: snapToGrid(diagramY) };
      
      // Only update if position actually changed (avoid unnecessary updates)
      if (!lastMousePositionRef.current || 
          lastMousePositionRef.current.x !== snappedPosition.x || 
          lastMousePositionRef.current.y !== snappedPosition.y) {
        // Throttle updates using requestAnimationFrame (max ~60fps)
        if (mousePositionThrottleRef.current === null) {
          mousePositionThrottleRef.current = requestAnimationFrame(() => {
            onMousePositionChange(snappedPosition);
            lastMousePositionRef.current = snappedPosition;
            mousePositionThrottleRef.current = null;
          });
        }
      }
    }
    
    if (!isPanning) return;
    setTransform({ ...transform, x: e.clientX - panStart.x, y: e.clientY - panStart.y });
  }, [canvasRef, transform, onMousePositionChange, isPanning, panStart, setTransform]);

  const handleMouseUpOrLeave = useCallback(() => {
    setIsPanning(false);
    // Clean up any pending mouse position update
    if (mousePositionThrottleRef.current !== null) {
      cancelAnimationFrame(mousePositionThrottleRef.current);
      mousePositionThrottleRef.current = null;
    }
    // Clear mouse position when leaving canvas
    if (onMousePositionChange) {
      onMousePositionChange(null);
      lastMousePositionRef.current = null;
    }
  }, [onMousePositionChange]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isConnectMode) return;
    const target = e.target as HTMLElement;
    
    // Check if touching an interactive element - let them handle their own touch events
    // This includes nodes, zones, buttons, inputs, etc.
    if (target.closest('.absolute') || 
        target.closest('button') || 
        target.closest('input') || 
        target.closest('textarea') ||
        target.closest('[role="button"]') ||
        target.closest('.cursor-move')) {
      return; // Don't handle canvas pan/zoom when touching interactive elements
    }
    
    if (e.touches.length === 1) {
      // Single touch - start panning
      const touch = e.touches[0];
      setIsPanning(true);
      setPanStart({ x: touch.clientX - transform.x, y: touch.clientY - transform.y });
    } else if (e.touches.length === 2) {
      // Two touches - prepare for zoom
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
      setTouchStart({ x: (touch1.clientX + touch2.clientX) / 2, y: (touch1.clientY + touch2.clientY) / 2, distance });
      setLastTouchDistance(distance);
      setIsPanning(false);
    }
  }, [isConnectMode, transform]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    
    // Don't handle if touching interactive elements
    if (target.closest('.absolute') || 
        target.closest('button') || 
        target.closest('input') || 
        target.closest('textarea') ||
        target.closest('[role="button"]') ||
        target.closest('.cursor-move')) {
      return;
    }
    
    if (e.touches.length === 1 && isPanning) {
      // Single touch - pan
      e.preventDefault(); // Only prevent default for panning
      const touch = e.touches[0];
      setTransform({ ...transform, x: touch.clientX - panStart.x, y: touch.clientY - panStart.y });
    } else if (e.touches.length === 2 && touchStart && lastTouchDistance !== null) {
      // Two touches - zoom
      e.preventDefault(); // Prevent page zoom
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const currentDistance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
      
      if (!canvasRef.current) return;
      
      // Calculate zoom
      const scale = currentDistance / lastTouchDistance;
      const newK = Math.max(0.1, Math.min(transform.k * scale, 2.5));
      
      // Keep the same center point for zoom
      setTransform({ ...transform, k: newK });
      setLastTouchDistance(currentDistance);
    }
  }, [canvasRef, transform, isPanning, panStart, touchStart, lastTouchDistance, setTransform]);

  const handleTouchEnd = useCallback(() => {
    setIsPanning(false);
    setTouchStart(null);
    setLastTouchDistance(null);
  }, []);

  return {
    isPanning,
    handleMouseDown,
    handleMouseMove,
    handleMouseUpOrLeave,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
}

