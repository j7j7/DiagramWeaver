import { useState, useCallback, useEffect, useRef } from "react";
import { measureNodeDims, type PositionedNode, type PositionedGroup } from "@/components/editor/canvas-constants";

export interface Transform {
  x: number;
  y: number;
  k: number;
}

interface UseCanvasTransformOptions {
  externalTransform?: Transform;
  onTransformChange?: (transform: Transform) => void;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  processedNodes: PositionedNode[];
  processedZones: PositionedGroup[];
  /** When true, wheel zoom is disabled (e.g. when search modal or overlay is open) */
  wheelZoomDisabled?: boolean;
}

export function useCanvasTransform({
  externalTransform,
  onTransformChange,
  canvasRef,
  processedNodes,
  processedZones,
  wheelZoomDisabled = false,
}: UseCanvasTransformOptions) {
  const [internalTransform, setInternalTransform] = useState<Transform>({ x: 0, y: 0, k: 1 });
  const transform = externalTransform || internalTransform;
  
  const setTransform = useCallback((newTransform: Transform) => {
    if (onTransformChange) {
      onTransformChange(newTransform);
    } else {
      setInternalTransform(newTransform);
    }
  }, [onTransformChange]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (wheelZoomDisabled || !canvasRef.current) return;
    const { deltaY } = e;
    const rect = canvasRef.current.getBoundingClientRect();
    const s = Math.pow(0.9975, deltaY); // More precise zoom (twice as precise)
    
    const newK = Math.max(0.1, Math.min(transform.k * s, 2.5)); // Max zoom set to 250% (2.5x)
    
    // Only update position if zoom actually changed (not at limit)
    if (newK !== transform.k) {
      // Use center of visible canvas area instead of mouse cursor position
      // The canvas rect.left already accounts for sidebar, so we just need to browser center
      if (typeof window === 'undefined') return; // SSR guard
      const browserViewportCenterX = window.innerWidth / 2;
      const browserViewportCenterY = window.innerHeight / 2;
      
      // Manual 10% adjustment to test horizontal center offset
      const adjustedCenterX = browserViewportCenterX + (window.innerWidth * 0.1);
      
      // Convert adjusted browser viewport center to canvas-relative coordinates
      // rect.left already includes the sidebar offset, so no need to subtract it again
      const canvasRelativeCenterX = adjustedCenterX - rect.left;
      const canvasRelativeCenterY = browserViewportCenterY - rect.top;
      
      // Convert to canvas coordinates (accounting for current transform)
      const canvasCenterX = (canvasRelativeCenterX - transform.x) / transform.k;
      const canvasCenterY = (canvasRelativeCenterY - transform.y) / transform.k;
      
      // Calculate new position to keep the same canvas point at browser viewport center
      const newX = canvasRelativeCenterX - canvasCenterX * newK;
      const newY = canvasRelativeCenterY - canvasCenterY * newK;
      
      setTransform({ x: newX, y: newY, k: newK });
    }
    // If zoom didn't change (at limit), do nothing - no position updates
  }, [transform, canvasRef, setTransform, wheelZoomDisabled]);

  const handleFitToView = useCallback(() => {
    if (!canvasRef.current) return;

    const container = canvasRef.current;
    
    // Get the actual bounding rectangle which shows where the element is on screen
    const rect = container.getBoundingClientRect();
    
    // The canvas might be larger than the browser window, so we need to clip it
    // to only the visible portion
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    // Calculate the visible portion of the canvas
    // If canvas extends beyond window, clip it
    const visibleLeft = Math.max(0, rect.left);
    const visibleTop = Math.max(0, rect.top);
    const visibleRight = Math.min(windowWidth, rect.right);
    const visibleBottom = Math.min(windowHeight, rect.bottom);
    
    // The actual visible viewport dimensions
    const viewportWidth = visibleRight - visibleLeft;
    const viewportHeight = visibleBottom - visibleTop;

    if (viewportWidth === 0 || viewportHeight === 0) {
      return; // Can't fit if viewport has no size
    }

    // Filter out items with invalid positions
    const validNodes = processedNodes.filter(n => 
      typeof n.x === 'number' && 
      typeof n.y === 'number' && 
      !isNaN(n.x) && 
      !isNaN(n.y) &&
      isFinite(n.x) &&
      isFinite(n.y)
    );

    const validZones = processedZones.filter(z => 
      typeof z.x === 'number' && 
      typeof z.y === 'number' && 
      typeof z.width === 'number' &&
      typeof z.height === 'number' &&
      !isNaN(z.x) && 
      !isNaN(z.y) &&
      !isNaN(z.width) &&
      !isNaN(z.height) &&
      isFinite(z.x) &&
      isFinite(z.y) &&
      isFinite(z.width) &&
      isFinite(z.height) &&
      z.width > 0 &&
      z.height > 0
    );

    // If no valid items, reset transform
    if (validNodes.length === 0 && validZones.length === 0) {
      setTransform({ x: 0, y: 0, k: 1 });
      return;
    }

    // Calculate bounds for nodes
    let nodeMinX = Infinity;
    let nodeMinY = Infinity;
    let nodeMaxX = -Infinity;
    let nodeMaxY = -Infinity;

    validNodes.forEach(n => {
      const dims = measureNodeDims(n);
      const x = n.x!;
      const y = n.y!;
      const width = dims.width;
      const height = dims.height;

      // Use custom dimensions if available (for custom sizeMode nodes)
      const nodeWidth = (n.sizeMode === 'custom' && n.width) ? n.width : width;
      const nodeHeight = (n.sizeMode === 'custom' && n.height) ? n.height : height;

      nodeMinX = Math.min(nodeMinX, x);
      nodeMinY = Math.min(nodeMinY, y);
      nodeMaxX = Math.max(nodeMaxX, x + nodeWidth);
      nodeMaxY = Math.max(nodeMaxY, y + nodeHeight);
    });

    // Calculate bounds for zones
    let zoneMinX = Infinity;
    let zoneMinY = Infinity;
    let zoneMaxX = -Infinity;
    let zoneMaxY = -Infinity;

    validZones.forEach(z => {
      const x = z.x!;
      const y = z.y!;
      const width = z.width!;
      const height = z.height!;

      zoneMinX = Math.min(zoneMinX, x);
      zoneMinY = Math.min(zoneMinY, y);
      zoneMaxX = Math.max(zoneMaxX, x + width);
      zoneMaxY = Math.max(zoneMaxY, y + height);
    });

    // Combine bounds from nodes and zones
    const minX = Math.min(
      validNodes.length > 0 ? nodeMinX : Infinity,
      validZones.length > 0 ? zoneMinX : Infinity
    );
    const minY = Math.min(
      validNodes.length > 0 ? nodeMinY : Infinity,
      validZones.length > 0 ? zoneMinY : Infinity
    );
    const maxX = Math.max(
      validNodes.length > 0 ? nodeMaxX : -Infinity,
      validZones.length > 0 ? zoneMaxX : -Infinity
    );
    const maxY = Math.max(
      validNodes.length > 0 ? nodeMaxY : -Infinity,
      validZones.length > 0 ? zoneMaxY : -Infinity
    );

    // Calculate content dimensions
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    if (contentWidth <= 0 || contentHeight <= 0) {
      setTransform({ x: 0, y: 0, k: 1 });
      return;
    }

    // Add padding around content
    const padding = 40;
    
    // Calculate available space (viewport minus padding on both sides)
    const availableWidth = viewportWidth - (2 * padding);
    const availableHeight = viewportHeight - (2 * padding);

    // Calculate zoom to fit content in available space
    const scaleX = availableWidth / contentWidth;
    const scaleY = availableHeight / contentHeight;
    
    // Use the smaller scale to ensure both dimensions fit
    let k = Math.min(scaleX, scaleY);
    
    // Clamp zoom to reasonable bounds
    k = Math.max(0.1, Math.min(2.5, k));
    
    // Calculate the center of the content in canvas coordinates
    const contentCenterX = (minX + maxX) / 2;
    const contentCenterY = (minY + maxY) / 2;
    
    // Calculate the center of the viewport
    const viewportCenterX = viewportWidth / 2;
    const viewportCenterY = viewportHeight / 2;
    
    // Transform formula: viewport_point = canvas_point * k + offset
    // We want: contentCenter * k + offset = viewportCenter
    // So: offset = viewportCenter - contentCenter * k
    const x = viewportCenterX - (contentCenterX * k);
    const y = viewportCenterY - (contentCenterY * k);

    setTransform({ x, y, k });
  }, [processedNodes, processedZones, canvasRef, setTransform]);

  // Fix passive wheel event listener
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheelEvent = (e: WheelEvent) => {
      if (wheelZoomDisabled) return;
      e.preventDefault();
      const { deltaY } = e;
      const rect = canvas.getBoundingClientRect();
      const s = Math.pow(0.995, deltaY);
      
      const newK = Math.max(0.1, Math.min(transform.k * s, 2.5));
      
      // Only update position if zoom actually changed (not at limit)
      if (newK !== transform.k) {
        // Use center of browser viewport instead of mouse cursor position
        if (typeof window === 'undefined') return; // SSR guard
        const browserViewportCenterX = window.innerWidth / 2;
        const browserViewportCenterY = window.innerHeight / 2;
        
        // Manual 10% adjustment to test horizontal center offset
        const adjustedCenterX = browserViewportCenterX + (window.innerWidth * 0.1);
        
        // Convert adjusted browser viewport center to canvas-relative coordinates
        // rect.left already includes the sidebar offset, so no need to subtract it again
        const canvasRelativeCenterX = adjustedCenterX - rect.left;
        const canvasRelativeCenterY = browserViewportCenterY - rect.top;
        
        // Use actual zoom ratio, not raw scaling factor
        const actualZoomRatio = newK / transform.k;
        const newX = canvasRelativeCenterX - (canvasRelativeCenterX - transform.x) * actualZoomRatio;
        const newY = canvasRelativeCenterY - (canvasRelativeCenterY - transform.y) * actualZoomRatio;
        
        setTransform({ x: newX, y: newY, k: newK });
      }
      // If zoom didn't change (at limit), do nothing - no position updates
    };

    canvas.addEventListener('wheel', handleWheelEvent, { passive: false });
    
    return () => {
      canvas.removeEventListener('wheel', handleWheelEvent);
    };
  }, [transform, canvasRef, setTransform, wheelZoomDisabled]);

  return {
    transform,
    setTransform,
    handleWheel,
    handleFitToView,
  };
}

