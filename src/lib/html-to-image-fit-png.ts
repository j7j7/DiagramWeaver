import { cloneNode } from 'html-to-image/es/clone-node.js';
import { embedImages } from 'html-to-image/es/embed-images.js';
import { embedResources, shouldEmbed } from 'html-to-image/es/embed-resources.js';
import { applyStyle } from 'html-to-image/es/apply-style.js';
import {
  checkCanvasDimensions,
  createImage,
  getImageSize,
  getPixelRatio,
  getStyleProperties,
  nodeToDataURL,
} from 'html-to-image/es/util.js';
import type { Options } from 'html-to-image/lib/types';
import type { Transform } from '@/hooks/use-canvas-transform';
import { hideCanvasGuideLinesInExportClone } from '@/lib/canvas-guide-lines';
import { hideDotGridOverlayInExportClone } from '@/lib/dot-grid-viewport';
import { yieldToMainThread } from '@/lib/yield-to-main-thread';

const DW_SELECTION_ITEM_IDS_KEY = '_dwSelectionItemIds' as const;
const DW_FAST_THUMBNAIL_KEY = '_dwFastThumbnail' as const;
const DW_ABORT_SIGNAL_KEY = '_dwAbortSignal' as const;

/**
 * Strip selection handles, selection borders/rings, connection selection glow, and other
 * editor-only chrome from an export clone. Always safe for full-diagram PNG (does not hide nodes).
 *
 * IMPORTANT: never remove() elements from the clone — `nodeToDataURLInLayoutHost` re-syncs styles from the source
 * by walking source and clone in parallel by child index. Removing elements desynchronises indices so a card
 * section could receive a resize-handle's computed styles, collapsing the layout.
 * Use display:none (keeps elements in the DOM tree, preserving child indices) instead of remove().
 */
function stripEditorSelectionChromeFromExportClone(clonedRoot: HTMLElement): void {
  // Hide selection handles, connection handles, rotation handles, corner-radius handles, URL handles.
  clonedRoot.querySelectorAll<HTMLElement>('.dw-resize-handle, .dw-connect-handle, .dw-rotation-handle, .dw-corner-radius-handle, .dw-url-handle, [data-handle]')
    .forEach(el => el.style.setProperty('display', 'none', 'important'));

  // Hide connection toolbar.
  clonedRoot.querySelectorAll<HTMLElement>('[data-dw-connection-toolbar]').forEach(el => {
    el.style.setProperty('display', 'none', 'important');
  });

  // Hide card edit-mode UI: delete X, reorder grip, +Add item row.
  clonedRoot.querySelectorAll<HTMLElement>('[data-dw-card-action]').forEach(el => {
    el.style.setProperty('display', 'none', 'important');
  });

  // Hide grid structure chrome (add/delete row/column), line vertex handles, and other edit-only data-dw handles.
  clonedRoot.querySelectorAll<HTMLElement>('[data-dw-grid-structure-action], [data-dw-line-vertex-handle]')
    .forEach(el => el.style.setProperty('display', 'none', 'important'));

  // Strip selection border from nodes (class may remain if render-time suppress missed).
  clonedRoot.querySelectorAll<HTMLElement>('[data-node-id].border-primary').forEach(el => {
    el.classList.remove('border-primary');
  });

  // Strip selection rings from card sub-elements and other editor-only ring indicators.
  clonedRoot.querySelectorAll<HTMLElement>('.ring-2.ring-primary.ring-inset').forEach(el => {
    el.classList.remove('ring-2', 'ring-primary', 'ring-inset');
  });

  // Strip selected-connection glow (legacy Tailwind class or semantic highlight class).
  clonedRoot.querySelectorAll<Element>('[class*="drop-shadow-[0_0_6px_rgba(0,200,150"], .connection-highlight-selected').forEach(el => {
    el.classList.remove('connection-highlight-selected');
    el.classList.forEach((cls) => {
      if (cls.startsWith('drop-shadow-[0_0_6px_rgba(0,200,150')) {
        el.classList.remove(cls);
      }
    });
    if (el instanceof HTMLElement || el instanceof SVGElement) {
      const filter = el.style.filter || '';
      if (filter.includes('rgba(0, 200, 150') || filter.includes('rgba(0,200,150')) {
        el.style.removeProperty('filter');
      }
    }
  });

  clonedRoot.querySelectorAll<Element>('.connection-solid-outline').forEach((el) => {
    el.setAttribute('display', 'none');
  });
  clonedRoot.querySelectorAll<HTMLElement>('[data-dw-canvas-selected="true"]').forEach((el) => {
    el.style.outline = 'none';
    el.removeAttribute('data-dw-canvas-selected');
  });

  // Hide dashed group selection outline.
  clonedRoot.querySelectorAll<HTMLElement>('.border-dashed.border-primary.pointer-events-none').forEach(el => {
    if (el.classList.contains('border-2') && el.getAttribute('aria-hidden') === 'true') {
      el.style.setProperty('display', 'none', 'important');
    }
  });
}

/**
 * Strip non-selected nodes plus editor selection chrome for selection-only PNG exports.
 */
function cleanCloneForSelectionExport(clonedRoot: HTMLElement, selectedIds: Set<string>): void {
  // Hide non-selected nodes (display:none preserves tree structure for child-index sync).
  clonedRoot.querySelectorAll<HTMLElement>('[data-node-id]').forEach(el => {
    const id = el.getAttribute('data-node-id');
    if (id && !selectedIds.has(id)) {
      el.style.setProperty('display', 'none', 'important');
    }
  });

  stripEditorSelectionChromeFromExportClone(clonedRoot);
}

/** Wait for `@font-face` files used on `root` so export matches live canvas typography. */
async function ensureExportFontsReady(root: HTMLElement): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) {
    return;
  }
  await document.fonts.ready;
  const seen = new Set<string>();
  const loads: Promise<unknown>[] = [];
  const visit = (el: Element) => {
    const cs = getComputedStyle(el);
    const key = `${cs.fontWeight}|${cs.fontSize}|${cs.fontFamily}`;
    if (!seen.has(key)) {
      seen.add(key);
      loads.push(document.fonts.load(`${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`).catch(() => undefined));
    }
    Array.from(el.children).forEach(visit);
  };
  visit(root);
  await Promise.all(loads);
}

/** Skip animated/interaction props when inlining computed styles for export. */
const SKIP_EXPORT_STYLE_PROPS = new Set([
  'transition',
  'transition-delay',
  'transition-duration',
  'transition-property',
  'transition-timing-function',
  'animation',
  'animation-delay',
  'animation-duration',
  'animation-name',
  'animation-iteration-count',
  'animation-timing-function',
  'animation-fill-mode',
  'animation-play-state',
  'caret-color',
  'cursor',
]);

function isDiagramLayer(el: Element): boolean {
  return el.hasAttribute('data-diagram-layer');
}

type ExportStyleSyncOptions = {
  /** Keep export root width/height from `applyStyle`, not the live viewport. */
  skipRootBox?: boolean;
  /** Keep fit transform on `[data-diagram-layer]`, not live pan/zoom. */
  preserveDiagramTransform?: boolean;
};

/**
 * html-to-image only copies `element.style.cssText` when any inline style exists, so Tailwind
 * layout (flex, min-width, display, …) is lost on card text regions. Inline the full computed
 * style snapshot from the live canvas instead — with exact font-size (no −0.1px clone hack).
 */
function applyExactExportStylesFromSource(
  sourceRoot: Element,
  clonedRoot: Element,
  options: Options = {},
  syncOptions: ExportStyleSyncOptions = {},
): void {
  const styleProps = getStyleProperties(options);
  const syncPair = (source: Element, clone: Element, isRoot: boolean) => {
    if (clone.hasAttribute('data-export-font-defs')) {
      return;
    }
    if ('style' in clone && clone.style instanceof CSSStyleDeclaration) {
      const sourceStyle = getComputedStyle(source);
      const targetStyle = clone.style;
      for (const name of styleProps) {
        if (SKIP_EXPORT_STYLE_PROPS.has(name)) continue;
        if (syncOptions.skipRootBox && isRoot && (name === 'width' || name === 'height')) {
          continue;
        }
        if (
          syncOptions.preserveDiagramTransform &&
          isDiagramLayer(clone) &&
          (name === 'transform' || name === 'transform-origin')
        ) {
          continue;
        }
        targetStyle.setProperty(
          name,
          sourceStyle.getPropertyValue(name),
          sourceStyle.getPropertyPriority(name),
        );
      }
      if (clone instanceof SVGTextElement) {
        clone.removeAttribute('font-size');
        clone.removeAttribute('font-weight');
        clone.removeAttribute('font-family');
        clone.removeAttribute('font-style');
      }
    }
    const sourceChildren = Array.from(source.children);
    const cloneChildren = Array.from(clone.children);
    const len = Math.min(sourceChildren.length, cloneChildren.length);
    for (let i = 0; i < len; i++) {
      syncPair(sourceChildren[i], cloneChildren[i], false);
    }
  };
  syncPair(sourceRoot, clonedRoot, true);
}

/**
 * After the clone is in a layout host, fix flex text columns whose used width drifted
 * (foreignObject without stylesheets can shrink `min-width: 0` flex children).
 */
function syncExportTextWidthsFromSource(sourceRoot: Element, clonedRoot: Element): void {
  const syncPair = (source: Element, clone: Element) => {
    if (clone.hasAttribute('data-export-font-defs')) {
      return;
    }
    if (source instanceof HTMLElement && clone instanceof HTMLElement) {
      const sourceWidth = source.offsetWidth;
      const cloneWidth = clone.offsetWidth;
      if (sourceWidth > 0 && cloneWidth > 0 && cloneWidth + 1 < sourceWidth) {
        clone.style.width = `${sourceWidth}px`;
        clone.style.minWidth = `${sourceWidth}px`;
      }
    }
    const sourceChildren = Array.from(source.children);
    const cloneChildren = Array.from(clone.children);
    const len = Math.min(sourceChildren.length, cloneChildren.length);
    for (let i = 0; i < len; i++) {
      syncPair(sourceChildren[i], cloneChildren[i]);
    }
  };
  syncPair(sourceRoot, clonedRoot);
}

function normalizeFontFamilyName(font: string): string {
  return font.trim().replace(/["']/g, '');
}

function collectExportFontFamilies(root: Element): Set<string> {
  const fonts = new Set<string>();
  const visit = (el: Element) => {
    const cs = getComputedStyle(el);
    cs.fontFamily.split(',').forEach((font) => {
      const name = normalizeFontFamilyName(font);
      if (name) fonts.add(name);
    });
    Array.from(el.children).forEach(visit);
  };
  visit(root);
  return fonts;
}

function usesNonSystemFont(families: Set<string>): boolean {
  const SYSTEM_FONT_FAMILIES = new Set([
    'sans-serif',
    'serif',
    'monospace',
    'system-ui',
    'ui-sans-serif',
    'ui-serif',
    'ui-monospace',
    'arial',
    'helvetica',
    'times new roman',
    'georgia',
    'courier new',
    'verdana',
    'tahoma',
    'trebuchet ms',
    'monaco',
  ]);
  return [...families].some((f) => !SYSTEM_FONT_FAMILIES.has(f.toLowerCase()));
}

function getSameOriginFontFaceRules(): CSSFontFaceRule[] {
  const rules: CSSFontFaceRule[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) {
        if (rule instanceof CSSFontFaceRule) {
          rules.push(rule);
        }
      }
    } catch {
      // Cross-origin stylesheets (legacy Google `<link>`) — skip.
    }
  }
  return rules;
}

/** Fallback when only cross-origin `@font-face` exists (e.g. before `next/font` hydrates). */
const EXPORT_WEB_FONT_STYLESHEET_URLS = [
  'https://fonts.googleapis.com/css2?family=Inter:wght@100;200;300;400;500;600;700;800;900&display=swap',
  'https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap',
] as const;

function extractFontFaceRules(cssText: string): string[] {
  const rules: string[] = [];
  const re = /@font-face\s*\{/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(cssText)) !== null) {
    let depth = 1;
    let i = match.index + match[0].length;
    while (i < cssText.length && depth > 0) {
      if (cssText[i] === '{') depth += 1;
      else if (cssText[i] === '}') depth -= 1;
      i += 1;
    }
    rules.push(cssText.slice(match.index, i));
  }
  return rules;
}

function fontFaceCssFamily(rule: string): string | null {
  const m = rule.match(/font-family\s*:\s*(['"]?)([^;'"}]+)\1/i);
  if (!m) return null;
  return normalizeFontFamilyName(m[2]);
}

async function embedFontFaceRules(rules: string[], baseUrl: string, options: Options): Promise<string[]> {
  const chunks: string[] = [];
  for (const rule of rules) {
    if (!shouldEmbed(rule)) continue;
    try {
      chunks.push(await embedResources(rule, baseUrl, options));
    } catch {
      // Keep export running if a single face fails.
    }
  }
  return chunks;
}

/**
 * Inline same-origin `@font-face` blobs (from `next/font`) so foreignObject export uses
 * identical font metrics — including real bold weights for rich text.
 */
async function buildExportFontEmbedCss(liveRoot: Element, options: Options): Promise<string> {
  const families = collectExportFontFamilies(liveRoot);
  if (!usesNonSystemFont(families)) {
    return '';
  }

  const sameOriginRules = getSameOriginFontFaceRules();
  const chunks: string[] = [];
  for (const rule of sameOriginRules) {
    if (!shouldEmbed(rule.style.getPropertyValue('src'))) continue;
    const baseUrl = rule.parentStyleSheet?.href ?? window.location.href;
    try {
      chunks.push(await embedResources(rule.cssText, baseUrl, options));
    } catch {
      // continue
    }
  }
  if (chunks.length > 0) {
    return chunks.join('\n');
  }

  // Fallback: fetch Google CSS text directly (no `cssRules` access).
  for (const sheetUrl of EXPORT_WEB_FONT_STYLESHEET_URLS) {
    try {
      const res = await fetch(sheetUrl);
      if (!res.ok) continue;
      const cssText = await res.text();
      const rules = extractFontFaceRules(cssText).filter((rule) => {
        const name = fontFaceCssFamily(rule);
        return name != null && families.has(name);
      });
      chunks.push(...(await embedFontFaceRules(rules, sheetUrl, options)));
    } catch {
      // continue
    }
  }
  return chunks.join('\n');
}

/**
 * Inject embedded `@font-face` rules without painting them in SVG foreignObject.
 * html-to-image's `embedWebFonts` prepends a bare `<style>` which Chromium can rasterize as visible text.
 */
function injectExportFontEmbedCss(clonedRoot: HTMLElement, cssText: string): void {
  const trimmed = cssText.trim();
  if (!trimmed) return;
  clonedRoot.querySelector('[data-export-font-defs]')?.remove();
  const wrapper = document.createElement('div');
  wrapper.setAttribute('data-export-font-defs', '');
  wrapper.setAttribute('aria-hidden', 'true');
  wrapper.style.cssText =
    'position:absolute;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none;visibility:hidden;';
  const styleNode = document.createElement('style');
  styleNode.setAttribute('type', 'text/css');
  styleNode.appendChild(document.createTextNode(trimmed));
  wrapper.appendChild(styleNode);
  clonedRoot.insertBefore(wrapper, clonedRoot.firstChild);
}

async function nodeToDataURLInLayoutHost(
  node: HTMLElement,
  width: number,
  height: number,
  liveSource?: HTMLElement,
  exportOptions?: Options,
  dotGridTransform?: Transform,
  /** Selection-only export: hide non-selected nodes and edit indicators. */
  selectedIds?: Set<string>,
  skipStyleSync?: boolean,
): Promise<string> {
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = [
    'position:fixed',
    'left:-14000px',
    'top:0',
    `width:${width}px`,
    `height:${height}px`,
    'margin:0',
    'padding:0',
    'opacity:0',
    'pointer-events:none',
    'overflow:hidden',
    'z-index:-1',
  ].join(';');
  document.body.appendChild(host);
  host.appendChild(node);
  void host.offsetHeight;
  if (liveSource && !skipStyleSync) {
    applyExactExportStylesFromSource(liveSource, node, exportOptions ?? {}, {
      skipRootBox: true,
      preserveDiagramTransform: true,
    });
    void host.offsetHeight;
    syncExportTextWidthsFromSource(liveSource, node);
    void host.offsetHeight;
    if (dotGridTransform) {
      applyCloneDiagramTransform(node, dotGridTransform);
    }
  } else if (dotGridTransform) {
    applyCloneDiagramTransform(node, dotGridTransform);
  }
  // Apply selection-export cleanup AFTER all style-sync is done (last setProperty wins on style object).
  // Live capture also clears selection during snapshotCaptureActive; this is a clone-side safety net.
  if (selectedIds && selectedIds.size > 0) {
    cleanCloneForSelectionExport(node, selectedIds);
  } else {
    stripEditorSelectionChromeFromExportClone(node);
  }
  if (!skipStyleSync) {
    await document.fonts.ready;
  }
  try {
    return await nodeToDataURL(node, width, height);
  } finally {
    if (node.parentNode === host) {
      host.removeChild(node);
    }
    if (host.parentNode === document.body) {
      document.body.removeChild(host);
    }
  }
}

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
  const datauri = await nodeToDataURLInLayoutHost(clone, width, height, undefined, options);
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
      const clipPath = stack.getAttribute('data-frosted-clip-path')?.trim();
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
      // Match SVG-shaped frosts (polygon / inset round): the raster underlay is a full bbox; clip like live `backdrop` layers.
      if (clipPath && clipPath.length > 0) {
        underlayDiv.style.setProperty('clip-path', clipPath, 'important');
        underlayDiv.style.setProperty('-webkit-clip-path', clipPath, 'important');
      }

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
  const fastThumbnail = Boolean((options as Record<string, unknown>)[DW_FAST_THUMBNAIL_KEY]);
  const abortSignal = (options as Record<string, unknown>)[DW_ABORT_SIGNAL_KEY] as
    | AbortSignal
    | undefined;
  if (!fastThumbnail) {
    await ensureExportFontsReady(node);
  }
  const exportOptions: Options = {
    preferredFontFormat: 'woff2',
    ...options,
  };
  const { width, height } = getImageSize(node, exportOptions);
  await yieldToMainThread(abortSignal);
  const clonedNode = await cloneNode(node, exportOptions, true);
  if (!clonedNode) {
    throw new Error('html-to-image clone failed');
  }
  await yieldToMainThread(abortSignal);
  hideDotGridOverlayInExportClone(clonedNode as HTMLElement);
  hideCanvasGuideLinesInExportClone(clonedNode as HTMLElement);
  const fontEmbedCSS = fastThumbnail
    ? ''
    : await buildExportFontEmbedCss(node, exportOptions);
  if (fontEmbedCSS) {
    injectExportFontEmbedCss(clonedNode as HTMLElement, fontEmbedCSS);
  }
  await embedImages(clonedNode, exportOptions);
  await yieldToMainThread(abortSignal);
  applyStyle(clonedNode, exportOptions);
  applyCloneDiagramTransform(clonedNode as HTMLElement, dotGridTransform);
  if (!fastThumbnail) {
    applyExactExportStylesFromSource(node, clonedNode, exportOptions, {
      skipRootBox: true,
      preserveDiagramTransform: true,
    });
  }
  applyExportShapeFallbackColors(clonedNode as HTMLElement);
  if (fastThumbnail) {
    applyFrostedExportSnapshotStyles(clonedNode as HTMLElement);
  } else {
    await injectFrostedBlurredUnderlays(clonedNode as HTMLElement, exportOptions, width, height);
    applyFrostedExportSnapshotStyles(clonedNode as HTMLElement);
  }

  const selectedIds = (exportOptions as any)[DW_SELECTION_ITEM_IDS_KEY] as Set<string> | undefined;

  await yieldToMainThread(abortSignal);
  const datauri = await nodeToDataURLInLayoutHost(
    clonedNode as HTMLElement,
    width,
    height,
    fastThumbnail ? undefined : node,
    exportOptions,
    dotGridTransform,
    selectedIds,
    fastThumbnail,
  );
  const img = await createImage(datauri);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Could not get canvas context');
  }
  const ratio = exportOptions.pixelRatio || getPixelRatio();
  const canvasWidth = exportOptions.canvasWidth || width;
  const canvasHeight = exportOptions.canvasHeight || height;
  canvas.width = canvasWidth * ratio;
  canvas.height = canvasHeight * ratio;
  if (!exportOptions.skipAutoScale) {
    checkCanvasDimensions(canvas);
  }
  canvas.style.width = `${canvasWidth}`;
  canvas.style.height = `${canvasHeight}`;
  if (exportOptions.backgroundColor) {
    context.fillStyle = exportOptions.backgroundColor;
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
