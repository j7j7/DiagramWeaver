"use client";

import React, { useEffect, useRef } from 'react';
import { type DiagramAnnotations } from '@/lib/annotation-types';

function getStrokeRenderConfig(style: string | undefined, width: number, opacity: number) {
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

export interface AnnotationRenderer {
  width: number;
  height: number;
  annotations: DiagramAnnotations;
  canvasRef?: React.RefObject<HTMLCanvasElement>;
}

/**
 * Renders stored annotations onto a canvas
 * Used for display and export
 */
export function AnnotationRenderer({
  width,
  height,
  annotations,
  canvasRef: externalCanvasRef,
}: AnnotationRenderer) {
  const internalCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = externalCanvasRef || internalCanvasRef;

  // Render annotations
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    if (!annotations.enabled) {
      return;
    }

    // Draw each stroke
    for (const stroke of annotations.strokes) {
      if (stroke.points.length < 2) continue;

      const isEraser = stroke.style === 'eraser';
      const renderConfig = getStrokeRenderConfig(stroke.style, stroke.width, stroke.opacity);
      ctx.globalCompositeOperation = renderConfig.composite;
      ctx.strokeStyle = isEraser ? '#000000' : stroke.color;
      ctx.lineWidth = renderConfig.width;
      ctx.lineCap = renderConfig.lineCap;
      ctx.lineJoin = renderConfig.lineJoin;
      ctx.globalAlpha = renderConfig.opacity;

      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }

      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }, [width, height, annotations, canvasRef]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
      }}
    />
  );
}

/**
 * Render annotations to a canvas and return as data URL
 */
export function renderAnnotationsToDataUrl(
  annotations: DiagramAnnotations,
  width: number,
  height: number
): string {
  const canvas = document.createElement('canvas');
  const dpr = window.devicePixelRatio || 1;

  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.scale(dpr, dpr);

  // Draw each stroke
  for (const stroke of annotations.strokes) {
    if (stroke.points.length < 2) continue;

    const isEraser = stroke.style === 'eraser';
    const renderConfig = getStrokeRenderConfig(stroke.style, stroke.width, stroke.opacity);
    ctx.globalCompositeOperation = renderConfig.composite;
    ctx.strokeStyle = isEraser ? '#000000' : stroke.color;
    ctx.lineWidth = renderConfig.width;
    ctx.lineCap = renderConfig.lineCap;
    ctx.lineJoin = renderConfig.lineJoin;
    ctx.globalAlpha = renderConfig.opacity;

    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }

    ctx.stroke();
  }

  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  return canvas.toDataURL();
}
