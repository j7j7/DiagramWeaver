import { cloneNode } from 'html-to-image/es/clone-node.js';
import { embedImages } from 'html-to-image/es/embed-images.js';
import { embedWebFonts } from 'html-to-image/es/embed-webfonts.js';
import { applyStyle } from 'html-to-image/es/apply-style.js';
import {
  checkCanvasDimensions,
  createImage,
  getImageSize,
  getPixelRatio,
  nodeToDataURL,
} from 'html-to-image/es/util.js';
import type { Options } from 'html-to-image/lib/types';
import type { Transform } from '@/hooks/use-canvas-transform';

/**
 * Same as html-to-image `toPng`, but after cloning, overrides the diagram layer transform.
 * Uses `[data-diagram-layer]` so export still finds the node when `.dot-grid` is temporarily removed.
 */
function applyExportDotGridTransform(dotGrid: HTMLElement, dotGridTransform: Transform) {
  const v = `translate(${dotGridTransform.x}px, ${dotGridTransform.y}px) scale(${dotGridTransform.k})`;
  dotGrid.style.setProperty('transform', v, 'important');
  dotGrid.style.setProperty('transform-origin', '0 0', 'important');
}

function applyExportShapeFallbackColors(root: HTMLElement) {
  const shapeNodes = root.querySelectorAll<HTMLElement>('[data-shape-bg-fallback]');
  shapeNodes.forEach((el) => {
    const bgFallback = el.getAttribute('data-shape-bg-fallback');
    const borderFallback = el.getAttribute('data-shape-border-fallback');
    if (bgFallback && bgFallback.trim().length > 0) {
      el.style.setProperty('background-color', bgFallback, 'important');
    }
    if (borderFallback && borderFallback.trim().length > 0) {
      el.style.setProperty('border-color', borderFallback, 'important');
    }
  });
}

export async function toPngWithDotGridTransform(
  node: HTMLElement,
  options: Options,
  dotGridTransform: Transform
): Promise<string> {
  const { width, height } = getImageSize(node, options);
  const clonedNode = await cloneNode(node, options, true);
  if (!clonedNode) {
    throw new Error('html-to-image clone failed');
  }
  await embedWebFonts(clonedNode, options);
  await embedImages(clonedNode, options);
  applyStyle(clonedNode, options);
  const diagramLayer =
    (clonedNode.querySelector('[data-diagram-layer]') as HTMLElement | null)
    ?? (clonedNode.querySelector('.dot-grid') as HTMLElement | null);
  if (diagramLayer) {
    applyExportDotGridTransform(diagramLayer, dotGridTransform);
  }
  applyExportShapeFallbackColors(clonedNode as HTMLElement);
  const datauri = await nodeToDataURL(clonedNode, width, height);
  const img = await createImage(datauri);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Could not get canvas context');
  }
  const ratio = options.pixelRatio || getPixelRatio();
  const canvasWidth = options.canvasWidth || width;
  const canvasHeight = options.canvasHeight || height;
  canvas.width = canvasWidth * ratio;
  canvas.height = canvasHeight * ratio;
  if (!options.skipAutoScale) {
    checkCanvasDimensions(canvas);
  }
  canvas.style.width = `${canvasWidth}`;
  canvas.style.height = `${canvasHeight}`;
  if (options.backgroundColor) {
    context.fillStyle = options.backgroundColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  context.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL();
}
