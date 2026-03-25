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
 * Same as html-to-image `toPng`, but after cloning the DOM, overrides the `.dot-grid` transform.
 * Used so snapshot PNGs can show fit-to-content framing without changing the live canvas pan/zoom.
 */
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
  const dotGrid = clonedNode.querySelector('.dot-grid') as HTMLElement | null;
  if (dotGrid) {
    dotGrid.style.transform = `translate(${dotGridTransform.x}px, ${dotGridTransform.y}px) scale(${dotGridTransform.k})`;
    dotGrid.style.transformOrigin = '0 0';
  }
  await embedWebFonts(clonedNode, options);
  await embedImages(clonedNode, options);
  applyStyle(clonedNode, options);
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
