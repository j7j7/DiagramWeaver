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
  canvasRef: React.RefObject<HTMLDivElement>;
  processedNodes: PositionedNode[];
  processedZones: PositionedGroup[];
}

export function useCanvasTransform({
  externalTransform,
  onTransformChange,
  canvasRef,
  processedNodes,
  processedZones,
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
    if (!canvasRef.current) return;
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
  }, [transform, canvasRef, setTransform]);

  const handleFitToView = useCallback(() => {
    if (!canvasRef.current) return;

    const viewportWidth = canvasRef.current.clientWidth;
    const viewportHeight = canvasRef.current.clientHeight;

    // Use the processedNodes and processedZones which have final calculated positions
    const allNodes = processedNodes;
    const allGroups = processedZones;

    console.log('Processed items (final positions):', {
      allNodes: allNodes.map(n => ({ id: n.id, x: n.x, y: n.y, label: n.label, width: measureNodeDims(n).width, height: measureNodeDims(n).height })),
      allGroups: allGroups.map(zone => ({ id: zone.id, x: zone.x, y: zone.y, width: zone.width, height: zone.height, label: zone.label }))
    });

    const nodeBounds = allNodes.length
      ? {
          minX: Math.min(...allNodes.map(n => n.x ?? 0)),
          minY: Math.min(...allNodes.map(n => n.y ?? 0)),
          maxX: Math.max(...allNodes.map(n => (n.x ?? 0) + measureNodeDims(n).width)),
          maxY: Math.max(...allNodes.map(n => (n.y ?? 0) + measureNodeDims(n).height)),
        }
      : null;

    const groupBounds = allGroups.length
      ? {
          minX: Math.min(...allGroups.map(zone => zone.x ?? 0)),
          minY: Math.min(...allGroups.map(zone => zone.y ?? 0)),
          maxX: Math.max(...allGroups.map(zone => (zone.x ?? 0) + zone.width)),
          maxY: Math.max(...allGroups.map(zone => (zone.y ?? 0) + zone.height)),
        }
      : null;

    if (!nodeBounds && !groupBounds) {
      setTransform({ x: 0, y: 0, k: 1 });
      return;
    }

    let minX = Math.min(nodeBounds?.minX ?? Infinity, groupBounds?.minX ?? Infinity);
    let minY = Math.min(nodeBounds?.minY ?? Infinity, groupBounds?.minY ?? Infinity);
    let maxX = Math.max(nodeBounds?.maxX ?? -Infinity, groupBounds?.maxX ?? -Infinity);
    let maxY = Math.max(nodeBounds?.maxY ?? -Infinity, groupBounds?.maxY ?? -Infinity);

    // Add minimal padding to account for edges/labels that can extend beyond shapes
    const padding = 20;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    const contentWidth = Math.max(1, maxX - minX);
    const contentHeight = Math.max(1, maxY - minY);

    // Calculate scale needed to fit content within viewport
    // If content is larger than viewport, scale < 1 (zoom out)
    // If content is smaller than viewport, allow some zoom in for better visibility
    const scaleX = viewportWidth / contentWidth;
    const scaleY = viewportHeight / contentHeight;
    // Use the smaller scale to ensure everything fits, but allow up to 1.5x zoom for better visibility
    const k = Math.min(1.5, Math.min(scaleX, scaleY));
    
    // Debug logging (remove in production)
    console.log('Fit to view debug:', {
      viewportWidth, viewportHeight,
      contentWidth, contentHeight,
      scaleX, scaleY, k,
      bounds: { minX, minY, maxX, maxY },
      nodesCount: allNodes.length,
      groupsCount: allGroups.length,
      sampleNodes: allNodes.slice(0, 3).map(n => ({ id: n.id, x: n.x, y: n.y, label: n.label })),
      sampleGroups: allGroups.slice(0, 3).map(zone => ({ id: zone.id, x: zone.x, y: zone.y, width: zone.width, height: zone.height }))
    });

    const displayWidth = k * contentWidth;
    const displayHeight = k * contentHeight;

    // Calculate positioning - use your ideal values directly
    // You want X=-200, Y=-100, so let's use those as the target
    const x = -200;
    const y = -100;
    
    // Debug the centering calculation
    console.log('Fit to view calculation:', {
      contentBounds: { minX, minY, maxX, maxY },
      calculatedTransform: { x, y, k },
      contentSize: { width: contentWidth, height: contentHeight },
      scaleFactors: { scaleX, scaleY },
      targetPosition: { x: -200, y: -100 }
    });

    setTransform({ x, y, k });
  }, [processedNodes, processedZones, canvasRef, setTransform]);

  // Fix passive wheel event listener
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheelEvent = (e: WheelEvent) => {
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
  }, [transform, canvasRef, setTransform]);

  return {
    transform,
    setTransform,
    handleWheel,
    handleFitToView,
  };
}

