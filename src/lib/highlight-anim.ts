import type { CSSProperties } from 'react';
import type { DiagramNodeData } from '@/lib/types';
import { isConnectorLineNodeType } from '@/lib/utils';

/** Merge shape drop-shadow filter with highlight glow filter on one card shell element. */
export function mergeCardShellHighlightStyle(
  highlightStyle: CSSProperties | undefined,
  shapeShadowFilter: string | undefined,
): CSSProperties {
  if (!highlightStyle && !shapeShadowFilter) return {};
  const glowFilter =
    typeof highlightStyle?.filter === 'string' ? highlightStyle.filter : undefined;
  const mergedFilter = [shapeShadowFilter, glowFilter].filter(Boolean).join(' ') || undefined;
  if (!highlightStyle) {
    return shapeShadowFilter ? { filter: shapeShadowFilter } : {};
  }
  const { filter: _glowFilter, ...rest } = highlightStyle;
  return {
    ...rest,
    ...(mergedFilter ? { filter: mergedFilter } : {}),
  };
}

export const HIGHLIGHT_ANIM_DEFAULT_DURATION_SEC = 1;
export const HIGHLIGHT_ANIM_DEFAULT_INTERVAL_SEC = 5;
export const HIGHLIGHT_ANIM_DEFAULT_GLOW_COLOR = 'rgba(59, 130, 246, 0.85)';
/** Default spread = full legacy halo peak. Stored 0–1 maps blur radii (spatial size), not RGBA opacity. */
export const HIGHLIGHT_ANIM_DEFAULT_GLOW_INTENSITY = 1;

/** `box`: box-shadow + drop-shadow on the node frame. `alpha`: drop-shadow only, for pulses that follow SVG/canvas silhouettes (circle, triangle, …). */
export type HighlightAnimSilhouetteMode = 'box' | 'alpha';

export function clampHighlightGlowIntensity(raw: number | undefined): number {
  if (raw === undefined || !Number.isFinite(raw)) return HIGHLIGHT_ANIM_DEFAULT_GLOW_INTENSITY;
  return Math.min(1, Math.max(0, raw));
}

/** Spatial map: spread 0=tight halo, 1=peak blur radii (px). Distinct from colour-picker alpha. */
const GLOW_DROP_BLUR_MIN = 1;
const GLOW_DROP_BLUR_MAX = 30;
const GLOW_BOX_BLUR_OUTER_MIN = 0;
const GLOW_BOX_SPR_OUTER_MIN = 0;
const GLOW_BOX_BLUR_OUTER_MAX = 52;
const GLOW_BOX_SPR_OUTER_MAX = 14;
const GLOW_BOX_BLUR_INNER_MIN = 0;
const GLOW_BOX_SPR_INNER_MIN = 0;
const GLOW_BOX_BLUR_INNER_MAX = 24;
const GLOW_BOX_SPR_INNER_MAX = 4;
/** Matches dual `drop-shadow()` count for alpha/silhouette keyframes (`none` → peak). */
const GLOW_NONE_FILTER_DUAL =
  'drop-shadow(0 0 0 rgba(0,0,0,0)) drop-shadow(0 0 0 rgba(0,0,0,0))';

function lerpGlowPx(minPx: number, maxPx: number, spread01: number): number {
  const u = clampHighlightGlowIntensity(spread01);
  return minPx + u * (maxPx - minPx);
}

function pxStr(n: number): string {
  return `${Math.round(n * 100) / 100}px`;
}

/**
 * Approximate halo extent for **Visual styling → Glow spread (~size)** (~N px), aligned with `buildGlowPeakCss`.
 * Spread=0 ~**1**px (tight halo); spread=1 peaks ~56px.
 */
export function highlightGlowApproxHaloPx(spreadRaw: number | undefined): number {
  const t = clampHighlightGlowIntensity(spreadRaw);
  const drop = lerpGlowPx(GLOW_DROP_BLUR_MIN, GLOW_DROP_BLUR_MAX, t);
  const outer = lerpGlowPx(GLOW_BOX_BLUR_OUTER_MIN, GLOW_BOX_BLUR_OUTER_MAX, t);
  return Math.round(drop + outer * 0.5);
}

function buildGlowPeakCss(
  safeColor: string,
  silhouetteMode: HighlightAnimSilhouetteMode,
  spread01: number
): { peakFilter: string; peakShadow: string } {
  const dropBlur = lerpGlowPx(GLOW_DROP_BLUR_MIN, GLOW_DROP_BLUR_MAX, spread01);
  const peakFilterBase = `drop-shadow(0 0 ${pxStr(dropBlur)} ${safeColor})`;
  if (silhouetteMode === 'alpha') {
    // Second layer mirrors outer box-shadow blur so silhouette-only glow matches box + filter on rectangles.
    const outerFollow = lerpGlowPx(GLOW_BOX_BLUR_OUTER_MIN, GLOW_BOX_BLUR_OUTER_MAX, spread01);
    const peakFilter = `${peakFilterBase} drop-shadow(0 0 ${pxStr(outerFollow)} ${safeColor})`;
    return { peakFilter, peakShadow: '' };
  }
  const peakFilter = peakFilterBase;
  const b1 = lerpGlowPx(GLOW_BOX_BLUR_OUTER_MIN, GLOW_BOX_BLUR_OUTER_MAX, spread01);
  const s1 = lerpGlowPx(GLOW_BOX_SPR_OUTER_MIN, GLOW_BOX_SPR_OUTER_MAX, spread01);
  const b2 = lerpGlowPx(GLOW_BOX_BLUR_INNER_MIN, GLOW_BOX_BLUR_INNER_MAX, spread01);
  const s2 = lerpGlowPx(GLOW_BOX_SPR_INNER_MIN, GLOW_BOX_SPR_INNER_MAX, spread01);
  const peakShadow = `0 0 ${pxStr(b1)} ${pxStr(s1)} ${safeColor}, 0 0 ${pxStr(b2)} ${pxStr(s2)} ${safeColor}`;
  return { peakFilter, peakShadow };
}

const injectedAnimationNames = new Map<string, string>();

function simpleHash(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (Math.imul(31, h) + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

/** Fractional part in [0, 1), stable for negative values. */
function fract01(n: number): number {
  const f = n - Math.floor(n);
  return f < 0 ? f + 1 : f;
}

/**
 * Deterministic fallback phase in [0, periodSec) when canvas-wide stagger is unavailable.
 */
export function highlightAnimPhaseDelaySeconds(x: number, y: number, periodSec: number): number {
  if (periodSec <= 0) return 0;
  const px = Number.isFinite(x) ? x : 0;
  const py = Number.isFinite(y) ? y : 0;
  const t = fract01(Math.sin(px * 12.9898 + py * 78.233) * 43758.5453123);
  return t * periodSec;
}

export type HighlightAnimStagger = {
  indexById: ReadonlyMap<string, number>;
  count: number;
};

/**
 * Sort by y ascending then x ascending among nodes with highlight animation (excludes connector lines).
 * Stagger indices use **`n - 1 - i`** so phase order is reversed along that line (bottom-up → top-down).
 */
export function buildHighlightAnimStaggerOrder(
  nodesById: Record<string, DiagramNodeData & { x?: number; y?: number }>
): HighlightAnimStagger {
  const entries: { id: string; x: number; y: number }[] = [];
  for (const [id, n] of Object.entries(nodesById)) {
    if (!n.highlightAnim) continue;
    if (n.highlightAnimMode === 'constant') continue;
    if (isConnectorLineNodeType(n.type)) continue;
    entries.push({ id, x: n.x ?? 0, y: n.y ?? 0 });
  }
  entries.sort((a, b) => (a.y !== b.y ? a.y - b.y : a.x - b.x));
  const indexById = new Map<string, number>();
  const n = entries.length;
  entries.forEach((e, i) => indexById.set(e.id, n > 0 ? n - 1 - i : 0));
  return { indexById, count: entries.length };
}

function clampDurationSec(v: number): number {
  if (!Number.isFinite(v) || v <= 0) return HIGHLIGHT_ANIM_DEFAULT_DURATION_SEC;
  return Math.min(120, Math.max(0.05, v));
}

function clampIntervalSec(v: number): number {
  if (!Number.isFinite(v) || v < 0) return HIGHLIGHT_ANIM_DEFAULT_INTERVAL_SEC;
  return Math.min(600, v);
}

/** Avoid breaking injected @keyframes if color ever contains `;`, `}`, or newlines. */
function cssColorForKeyframes(color: string): string {
  const t = color.trim();
  if (!t || /[;{}\n\r]/.test(t)) return HIGHLIGHT_ANIM_DEFAULT_GLOW_COLOR;
  return t;
}

/**
 * Static glow matching the midpoint of highlight keyframes (`constant` mode).
 */
function getHighlightConstantGlowStyle(
  color: string,
  silhouetteMode: HighlightAnimSilhouetteMode,
  spread01: number
): CSSProperties {
  const safeColor = cssColorForKeyframes(color);
  const { peakFilter, peakShadow } = buildGlowPeakCss(safeColor, silhouetteMode, spread01);
  if (silhouetteMode === 'alpha') {
    return { filter: peakFilter, boxShadow: 'none', willChange: 'filter' };
  }
  return {
    boxShadow: peakShadow,
    filter: peakFilter,
    willChange: 'box-shadow, filter',
  };
}

/**
 * Registers @keyframes once per (duration, interval, color, spread) and returns the animation name.
 */
export function ensureHighlightAnimKeyframes(
  durationSec: number,
  intervalSec: number,
  color: string,
  silhouetteMode: HighlightAnimSilhouetteMode = 'box',
  intensity: number = HIGHLIGHT_ANIM_DEFAULT_GLOW_INTENSITY
): string {
  const d = clampDurationSec(durationSec);
  const i = clampIntervalSec(intervalSec);
  const safeColor = cssColorForKeyframes(color);
  const m = clampHighlightGlowIntensity(intensity);
  const mq = Math.round(m * 100);
  const key = `${d}|${i}|${safeColor}|${silhouetteMode}|${mq}`;
  const hit = injectedAnimationNames.get(key);
  if (hit) return hit;

  const name = `dwHa${simpleHash(key)}`;
  injectedAnimationNames.set(key, name);

  if (typeof document === 'undefined') return name;

  const period = d + i;
  const pulseEndPct = period > 0 ? (d / period) * 100 : 100;
  const midPct = pulseEndPct / 2;

  const styleEl = document.createElement('style');
  styleEl.type = 'text/css';
  styleEl.setAttribute('data-dw-highlight-anim-keyframes', key.replace(/"/g, ''));
  const { peakFilter, peakShadow } = buildGlowPeakCss(safeColor, silhouetteMode, m);
  /** Must match layered `peakFilter` (single vs dual drop-shadow). */
  const noneFilterForKeyframes =
    silhouetteMode === 'alpha'
      ? GLOW_NONE_FILTER_DUAL
      : 'drop-shadow(0 0 0 rgba(0,0,0,0))';
  if (silhouetteMode === 'alpha') {
    styleEl.textContent = `
@keyframes ${name} {
  0% { filter: ${noneFilterForKeyframes}; }
  ${midPct.toFixed(4)}% { filter: ${peakFilter}; }
  ${pulseEndPct.toFixed(4)}% { filter: ${noneFilterForKeyframes}; }
  100% { filter: ${noneFilterForKeyframes}; }
}
`;
  } else {
    // Dual box-shadow + filter: some Chromium builds (notably Windows) composite drop-shadow more reliably.
    const noneShadow = '0 0 0 0 rgba(0,0,0,0)';
    styleEl.textContent = `
@keyframes ${name} {
  0% { box-shadow: ${noneShadow}; filter: ${noneFilterForKeyframes}; }
  ${midPct.toFixed(4)}% { box-shadow: ${peakShadow}; filter: ${peakFilter}; }
  ${pulseEndPct.toFixed(4)}% { box-shadow: ${noneShadow}; filter: ${noneFilterForKeyframes}; }
  100% { box-shadow: ${noneShadow}; filter: ${noneFilterForKeyframes}; }
}
`;
  }
  document.head.appendChild(styleEl);
  return name;
}

export function getHighlightAnimStyleForNode(
  node: DiagramNodeData & { x: number; y: number },
  opts: {
    isLineNode: boolean;
    isDuplicateDragPreview: boolean;
    positionX: number;
    positionY: number;
    highlightAnimStaggerIndex?: number;
    highlightAnimStaggerCount?: number;
    /** Pulse follows painted silhouette (e.g. SVG circle/triangle), not the rectangular node frame. */
    pulseFollowsShapeSilhouette?: boolean;
    /**
     * HTML rounded shell (e.g. cards): use box-shadow on the shell's border-radius, not alpha
     * drop-shadow on the rectangular node frame or a filter-only wrapper.
     */
    roundedShellGlow?: boolean;
  }
): CSSProperties | undefined {
  if (opts.isLineNode || opts.isDuplicateDragPreview) return undefined;
  if (!node.highlightAnim) return undefined;

  const color = node.highlightAnimGlowColor ?? HIGHLIGHT_ANIM_DEFAULT_GLOW_COLOR;
  const intensity = clampHighlightGlowIntensity((node as any).highlightAnimGlowIntensity);
  const silhouetteMode: HighlightAnimSilhouetteMode = opts.roundedShellGlow
    ? 'box'
    : opts.pulseFollowsShapeSilhouette
      ? 'alpha'
      : 'box';

  if (node.highlightAnimMode === 'constant') {
    return getHighlightConstantGlowStyle(color, silhouetteMode, intensity);
  }

  const dur = node.highlightAnimDurationSec ?? HIGHLIGHT_ANIM_DEFAULT_DURATION_SEC;
  const intv = node.highlightAnimIntervalSec ?? HIGHLIGHT_ANIM_DEFAULT_INTERVAL_SEC;

  const d = clampDurationSec(dur);
  const i = clampIntervalSec(intv);
  const period = d + i;

  const animName = ensureHighlightAnimKeyframes(d, i, color, silhouetteMode, intensity);
  const staggerN = opts.highlightAnimStaggerCount ?? 0;
  const staggerI = opts.highlightAnimStaggerIndex;
  let delaySec: number;
  if (staggerN > 0 && staggerI !== undefined && staggerI >= 0) {
    delaySec = (staggerI / staggerN) * period;
  } else {
    delaySec = highlightAnimPhaseDelaySeconds(opts.positionX, opts.positionY, period);
  }

  return {
    animation: `${animName} ${period}s ease-in-out infinite`,
    animationDelay: `-${delaySec}s`,
    willChange: silhouetteMode === 'alpha' ? 'filter' : 'box-shadow, filter',
    ...(silhouetteMode === 'alpha' ? { boxShadow: 'none' } : {}),
  };
}
