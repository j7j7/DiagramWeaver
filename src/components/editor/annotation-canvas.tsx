"use client";

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { type AnnotationStroke, type StrokePoint, type AnnotationToolConfig } from '@/lib/annotation-types';

function getStrokeRenderConfig(style: AnnotationToolConfig['style'], width: number, opacity: number) {
  if (style === 'eraser') {
    return {
      composite: 'destination-out' as GlobalCompositeOperation,
      width,
      opacity: 1,
      lineCap: 'round' as CanvasLineCap,
      lineJoin: 'round' as CanvasLineJoin,
    };
  }

  if (style === 'marker') {
    return {
      composite: 'source-over' as GlobalCompositeOperation,
      width: Math.max(1, width * 1.35),
      opacity: Math.min(opacity, 0.7),
      lineCap: 'square' as CanvasLineCap,
      lineJoin: 'round' as CanvasLineJoin,
    };
  }

  if (style === 'highlighter') {
    return {
      composite: 'multiply' as GlobalCompositeOperation,
      width: Math.max(1, width * 1.9),
      opacity: Math.min(opacity, 0.28),
      lineCap: 'square' as CanvasLineCap,
      lineJoin: 'round' as CanvasLineJoin,
    };
  }

  return {
    composite: 'source-over' as GlobalCompositeOperation,
    width,
    opacity,
    lineCap: 'round' as CanvasLineCap,
    lineJoin: 'round' as CanvasLineJoin,
  };
}

function createStrokeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `stroke-${crypto.randomUUID()}`;
  }
  return `stroke-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

export interface AnnotationCanvasProps {
  enabled: boolean;
  width: number;
  height: number;
  canvasRef?: React.RefObject<HTMLCanvasElement | null>;
  onStrokeComplete?: (stroke: AnnotationStroke) => void;
  onStrokeCancelled?: () => void;
  toolConfig: AnnotationToolConfig;
  isDrawing?: boolean;
  onDrawingChange?: (isDrawing: boolean) => void;
  resetToken?: string | number;
}

/**
 * Hand drawing canvas overlay component
 * Provides freehand drawing capability for annotations
 */
export function AnnotationCanvas({
  enabled,
  width,
  height,
  canvasRef: externalCanvasRef,
  onStrokeComplete,
  onStrokeCancelled,
  toolConfig,
  isDrawing: externalIsDrawing,
  onDrawingChange,
  resetToken,
}: AnnotationCanvasProps) {
  const internalCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = externalCanvasRef || internalCanvasRef;
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<StrokePoint[]>([]);
  const contextRef = useRef<MemoryCanvas2DContext | null>(null);
  
  const isDrawingLocal = externalIsDrawing ?? isDrawing;

  // Sync canvas size
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      ctx.scale(dpr, dpr);
      contextRef.current = ctx;
    }
  }, [width, height, canvasRef]);

  // Clear canvas
  const clearCanvas = useCallback(() => {
    if (!contextRef.current) return;
    contextRef.current.clearRect(0, 0, width, height);
  }, [width, height]);

  // Draw stroke
  const drawStroke = useCallback(() => {
    if (!contextRef.current || currentStroke.length < 2) return;

    const ctx = contextRef.current;
    const isEraser = toolConfig.style === 'eraser';
    const renderConfig = getStrokeRenderConfig(toolConfig.style, toolConfig.width, toolConfig.opacity);
    ctx.globalCompositeOperation = renderConfig.composite;
    ctx.strokeStyle = isEraser ? '#000000' : toolConfig.color;
    ctx.lineWidth = renderConfig.width;
    ctx.lineCap = renderConfig.lineCap;
    ctx.lineJoin = renderConfig.lineJoin;
    ctx.globalAlpha = renderConfig.opacity;

    ctx.beginPath();
    ctx.moveTo(currentStroke[0].x, currentStroke[0].y);

    for (let i = 1; i < currentStroke.length; i++) {
      ctx.lineTo(currentStroke[i].x, currentStroke[i].y);
    }

    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }, [currentStroke, toolConfig]);

  // Handle mouse/touch down
  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!enabled || !canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      setCurrentStroke([{ x, y }]);
      setIsDrawing(true);
      onDrawingChange?.(true);
    },
    [enabled, canvasRef, onDrawingChange]
  );

  // Handle mouse/touch move
  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!enabled || !isDrawingLocal || !canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const pressure = (event as any).pressure || 1;
      setCurrentStroke((prev) => [...prev, { x, y, pressure }]);
    },
    [enabled, isDrawingLocal, canvasRef]
  );

  // Handle mouse/touch up
  const handlePointerUp = useCallback(() => {
    if (!isDrawingLocal) return;

    setIsDrawing(false);
    onDrawingChange?.(false);

    if (currentStroke.length > 1) {
      const stroke: AnnotationStroke = {
        id: createStrokeId(),
        points: currentStroke,
        color: toolConfig.color,
        width: toolConfig.width,
        opacity: toolConfig.opacity,
        timestamp: Date.now(),
        style: toolConfig.style,
      };

      onStrokeComplete?.(stroke);
      clearCanvas();
    } else {
      onStrokeCancelled?.();
    }

    setCurrentStroke([]);
  }, [isDrawingLocal, currentStroke, toolConfig, onStrokeComplete, onStrokeCancelled, clearCanvas]);

  // Re-draw on current stroke changes
  useEffect(() => {
    clearCanvas();
    drawStroke();
  }, [currentStroke, clearCanvas, drawStroke]);

  // Reset in-progress stroke when page/slide context changes
  const previousResetTokenRef = useRef<string | number | undefined>(resetToken);
  useEffect(() => {
    if (previousResetTokenRef.current === resetToken) return;
    previousResetTokenRef.current = resetToken;
    setCurrentStroke([]);
    setIsDrawing(false);
    onDrawingChange?.(false);
    clearCanvas();
  }, [resetToken, onDrawingChange, clearCanvas]);

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: enabled ? 'auto' : 'none',
        cursor: enabled ? (toolConfig.style === 'eraser' ? 'cell' : 'crosshair') : 'auto',
        touchAction: 'none',
      }}
    />
  );
}

// Type alias for canvas context
type MemoryCanvas2DContext = CanvasRenderingContext2D;
