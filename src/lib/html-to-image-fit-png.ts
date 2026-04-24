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

/**
 * Strip `backdrop-filter` after we inject a real blurred underlay (foreignObject export does not paint backdrop).
 * When underlay injection ran, keep original translucent fills; otherwise use opaque fallback colors.
 */
function applyFrostedExportSnapshotStyles(root: HTMLElement) {
  const layers = root.querySelectorAll<HTMLElement>('[data-frosted-backdrop]');
  layers.forEach((el) => {
    el.style.setProperty('backdrop-filter', 'none', 'important');
    el.style.setProperty('-webkit-backdrop-filter', 'none', 'important');
    const injected = el.closest('[data-frosted-glass-stack][data-frosted-export-injected]');
    if (injected) {
      return;
    }
    const fallback = el.getAttribute('data-frosted-export-fallback-bg');
    if (fallback && fallback.trim().length > 0) {
      el.style.setProperty('background-color', fallback, 'important');
    }
  });
}

function applyCloneDiagramTransform(clonedRoot: HTMLElement, dotGridTransform?: Transform) {
  if (!dotGridTransform) return;
  const diagramLayer =
    (clonedRoot.querySelector('[data-diagram-layer]') as HTMLElement | null)
    ?? (clonedRoot.querySelector('.dot-grid') as HTMLElement | null);
  if (diagramLayer) {
    applyExportDotGridTransform(diagramLayer, dotGridTransform);
  }
}

async function rasterizeCloneToCanvas(
  clone: HTMLElement,
  options: Options,
  width: number,
  height: number
): Promise<HTMLCanvasElement> {
  const ratio = options.pixelRatio || getPixelRatio();
  const canvasWidth = options.canvasWidth || width;
  const canvasHeight = options.canvasHeight || height;
  const datauri = await nodeToDataURL(clone, width, height);
  const img = await createImage(datauri);
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth * ratio;
  canvas.height = canvasHeight * ratio;
  if (!options.skipAutoScale) {
    checkCanvasDimensions(canvas);
  }
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Could not get canvas context');
  }
  if (options.backgroundColor) {
    context.fillStyle = options.backgroundColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  context.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * Rasterize with frosted stacks hidden so each shape “sees through” to real diagram pixels behind it,
 * then blur those regions and inject as static backgrounds (matches live `backdrop-filter`).
 */
async function injectFrostedBlurredUnderlays(
  clonedRoot: HTMLElement,
  options: Options,
  width: number,
  height: number
): Promise<void> {
  const stacks = Array.from(clonedRoot.querySelectorAll<HTMLElement>('[data-frosted-glass-stack]'));
  if (stacks.length === 0) {
    return;
  }

  const ratio = options.pixelRatio || getPixelRatio();
  const canvasWidth = options.canvasWidth || width;
  const canvasHeight = options.canvasHeight || height;

  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = [
    'position:fixed',
    'left:-14000px',
    'top:0',
    `width:${canvasWidth}px`,
    `height:${canvasHeight}px`,
    'margin:0',
    'padding:0',
    'opacity:0',
    'pointer-events:none',
    'overflow:hidden',
    'z-index:-1',
  ].join(';');

  document.body.appendChild(host);
  host.appendChild(clonedRoot);

  try {
    void host.offsetHeight;

    stacks.forEach((s) => s.style.setProperty('display', 'none', 'important'));
    void host.offsetHeight;

    const underlayCanvas = await rasterizeCloneToCanvas(clonedRoot, options, width, height);

    /*
     * `nodeToDataURL` uses `foreignObject.appendChild(node)`, which *moves* the clone out of `host`.
     * Put it back so layout and `getBoundingClientRect` work for stack placement.
     */
    host.appendChild(clonedRoot);
    void host.offsetHeight;

    stacks.forEach((s) => s.style.removeProperty('display'));
    void host.offsetHeight;

    const rootRectAfter = clonedRoot.getBoundingClientRect();

    const uW = underlayCanvas.width;
    const uH = underlayCanvas.height;

    for (const stack of stacks) {
      const br = stack.getBoundingClientRect();
      const sx = (br.left - rootRectAfter.left) * ratio;
      const sy = (br.top - rootRectAfter.top) * ratio;
      const sw = br.width * ratio;
      const sh = br.height * ratio;

      if (sw < 1 || sh < 1) {
        continue;
      }

      const blurAttr = stack.getAttribute('data-frosted-export-blur');
      let blurPx = blurAttr ? parseFloat(blurAttr) : 12;
      if (!Number.isFinite(blurPx)) blurPx = 12;
      blurPx = Math.max(0, blurPx);

      const satAttr = stack.getAttribute('data-frosted-export-saturate');
      let sat = satAttr ? parseFloat(satAttr) : 1.14;
      if (!Number.isFinite(sat)) sat = 1.14;
      sat = Math.min(2, Math.max(0.5, sat));

      const sx0 = Math.max(0, Math.floor(sx));
      const sy0 = Math.max(0, Math.floor(sy));
      const sx1 = Math.min(uW, Math.ceil(sx + sw));
      const sy1 = Math.min(uH, Math.ceil(sy + sh));
      const cw = Math.max(1, sx1 - sx0);
      const ch = Math.max(1, sy1 - sy0);

      const crop = document.createElement('canvas');
      crop.width = cw;
      crop.height = ch;
      const cctx = crop.getContext('2d');
      if (!cctx) continue;

      cctx.drawImage(underlayCanvas, sx0, sy0, cw, ch, 0, 0, cw, ch);

      const blurred = document.createElement('canvas');
      blurred.width = cw;
      blurred.height = ch;
      const bctx = blurred.getContext('2d');
      if (!bctx) continue;

      const deviceBlur = blurPx * ratio;
      if (deviceBlur > 0.04) {
        bctx.filter = `blur(${deviceBlur}px) saturate(${sat}) contrast(1.04) brightness(1.02)`;
      } else {
        bctx.filter = `saturate(${sat}) contrast(1.04) brightness(1.02)`;
      }
      bctx.drawImage(crop, 0, 0);

      const url = blurred.toDataURL('image/png');
      const underlayDiv = document.createElement('div');
      underlayDiv.setAttribute('data-frosted-export-blurred-underlay', '');
      underlayDiv.setAttribute('aria-hidden', 'true');
      underlayDiv.style.cssText = [
        'position:absolute',
        'inset:0',
        'border-radius:inherit',
        'pointer-events:none',
        'z-index:-1',
        `background-image:url(${url})`,
        'background-size:100% 100%',
        'background-repeat:no-repeat',
      ].join(';');

      stack.insertBefore(underlayDiv, stack.firstChild);
      stack.setAttribute('data-frosted-export-injected', '');
    }
  } finally {
    if (host.parentNode === document.body) {
      if (clonedRoot.parentNode === host) {
        host.removeChild(clonedRoot);
      }
      document.body.removeChild(host);
    }
  }
}

/**
 * html-to-image `toPng` with diagram export fixes (frosted glass underlay + shape fallbacks).
 * Pass `dotGridTransform` only when the bitmap should use a fitted/cloned transform; omit for a straight viewport capture.
 */
export async function toPngWithDiagramExportFixes(
  node: HTMLElement,
  options: Options,
  dotGridTransform?: Transform
): Promise<string> {
  const { width, height } = getImageSize(node, options);
  const clonedNode = await cloneNode(node, options, true);
  if (!clonedNode) {
    throw new Error('html-to-image clone failed');
  }
  await embedWebFonts(clonedNode, options);
  await embedImages(clonedNode, options);
  applyStyle(clonedNode, options);
  applyCloneDiagramTransform(clonedNode as HTMLElement, dotGridTransform);
  applyExportShapeFallbackColors(clonedNode as HTMLElement);
  await injectFrostedBlurredUnderlays(clonedNode as HTMLElement, options, width, height);
  applyFrostedExportSnapshotStyles(clonedNode as HTMLElement);

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

/** Same as {@link toPngWithDiagramExportFixes} with a non-optional fit transform. */
export async function toPngWithDotGridTransform(
  node: HTMLElement,
  options: Options,
  dotGridTransform: Transform
): Promise<string> {
  return toPngWithDiagramExportFixes(node, options, dotGridTransform);
}
