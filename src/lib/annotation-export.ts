/**
 * Annotation Export Utilities
 * Provides functions to composite annotations onto exported diagrams
 */

import { type DiagramAnnotations, type SlideAnnotations } from './annotation-types';

export interface CompositeOptions {
  diagramDataUrl: string;
  annotations?: DiagramAnnotations | SlideAnnotations;
  width: number;
  height: number;
}

/**
 * Composite annotations onto a diagram data URL
 * Returns a new data URL with annotations overlaid
 */
export async function compositeAnnotationsOntoImage(options: CompositeOptions): Promise<string> {
  const { diagramDataUrl, annotations, width, height } = options;

  if (!annotations || !annotations.enabled || annotations.strokes.length === 0) {
    return diagramDataUrl;
  }

  return new Promise((resolve) => {
    // Create canvas for compositing
    const canvas = document.createElement('canvas');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      resolve(diagramDataUrl);
      return;
    }

    ctx.scale(dpr, dpr);

    // Load diagram image
    const diagramImg = new Image();
    diagramImg.onload = () => {
      // Draw diagram
      ctx.drawImage(diagramImg, 0, 0, width, height);

      // Draw annotations
      for (const stroke of annotations.strokes) {
        if (stroke.points.length < 2) continue;

        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = stroke.opacity;

        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }

        ctx.stroke();
      }

      ctx.globalAlpha = 1;
      resolve(canvas.toDataURL('image/png'));
    };

    diagramImg.onerror = () => {
      // If image fails to load, return original
      resolve(diagramDataUrl);
    };

    diagramImg.src = diagramDataUrl;
  });
}

/**
 * Composite annotations onto multiple images (for GIF export)
 */
export async function compositeAnnotationsOntoImages(
  imageDataUrls: string[],
  annotations: SlideAnnotations,
  width: number,
  height: number
): Promise<string[]> {
  const results: string[] = [];

  for (const dataUrl of imageDataUrls) {
    const result = await compositeAnnotationsOntoImage({
      diagramDataUrl: dataUrl,
      annotations,
      width,
      height,
    });
    results.push(result);
  }

  return results;
}

/**
 * Create a canvas with just the annotations
 * Useful for layering or compositing manually
 */
export function createAnnotationCanvas(
  annotations: DiagramAnnotations | SlideAnnotations,
  width: number,
  height: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  if (!annotations.enabled || annotations.strokes.length === 0) {
    return canvas;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.scale(dpr, dpr);

  // Draw each stroke
  for (const stroke of annotations.strokes) {
    if (stroke.points.length < 2) continue;

    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = stroke.opacity;

    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }

    ctx.stroke();
  }

  ctx.globalAlpha = 1;
  return canvas;
}

/**
 * Get annotation bounds and calculate crop rectangle
 */
export function getAnnotationBoundsInViewport(
  annotations: DiagramAnnotations | SlideAnnotations,
  padding: number = 10
): { x: number; y: number; width: number; height: number } | null {
  if (annotations.strokes.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const stroke of annotations.strokes) {
    for (const point of stroke.points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
  }

  if (!isFinite(minX) || !isFinite(minY)) return null;

  return {
    x: Math.max(0, minX - padding),
    y: Math.max(0, minY - padding),
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  };
}

/**
 * Apply blending mode to annotations
 */
export function applyBlendingMode(
  ctx: CanvasRenderingContext2D,
  mode: 'normal' | 'multiply' | 'screen' | 'overlay' | 'soft-light' = 'normal'
) {
  switch (mode) {
    case 'multiply':
      ctx.globalCompositeOperation = 'multiply';
      break;
    case 'screen':
      ctx.globalCompositeOperation = 'screen';
      break;
    case 'overlay':
      ctx.globalCompositeOperation = 'overlay';
      break;
    case 'soft-light':
      ctx.globalCompositeOperation = 'soft-light';
      break;
    default:
      ctx.globalCompositeOperation = 'source-over';
  }
}
