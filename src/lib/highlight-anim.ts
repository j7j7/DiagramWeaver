import type { CSSProperties } from 'react';
import type { DiagramNodeData } from '@/lib/types';
import { isConnectorLineNodeType } from '@/lib/utils';

export const HIGHLIGHT_ANIM_DEFAULT_DURATION_SEC = 1;
export const HIGHLIGHT_ANIM_DEFAULT_INTERVAL_SEC = 5;
export const HIGHLIGHT_ANIM_DEFAULT_GLOW_COLOR = 'rgba(59, 130, 246, 0.85)';

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
 * Top-to-bottom, then left-to-right order among nodes with highlight animation (excludes connector lines).
 * Used to spread pulse phases evenly across one full cycle so the effect reads as a vertical cascade.
 */
export function buildHighlightAnimStaggerOrder(
  nodesById: Record<string, DiagramNodeData & { x?: number; y?: number }>
): HighlightAnimStagger {
  const entries: { id: string; x: number; y: number }[] = [];
  for (const [id, n] of Object.entries(nodesById)) {
    if (!n.highlightAnim) continue;
    if (isConnectorLineNodeType(n.type)) continue;
    entries.push({ id, x: n.x ?? 0, y: n.y ?? 0 });
  }
  entries.sort((a, b) => (a.y !== b.y ? a.y - b.y : a.x - b.x));
  const indexById = new Map<string, number>();
  entries.forEach((e, i) => indexById.set(e.id, i));
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

/**
 * Registers @keyframes once per (duration, interval, color) and returns the animation name.
 */
export function ensureHighlightAnimKeyframes(
  durationSec: number,
  intervalSec: number,
  color: string
): string {
  const d = clampDurationSec(durationSec);
  const i = clampIntervalSec(intervalSec);
  const key = `${d}|${i}|${color}`;
  const hit = injectedAnimationNames.get(key);
  if (hit) return hit;

  const name = `dwHa${simpleHash(key)}`;
  injectedAnimationNames.set(key, name);

  if (typeof document === 'undefined') return name;

  const period = d + i;
  const pulseEndPct = period > 0 ? (d / period) * 100 : 100;
  const midPct = pulseEndPct / 2;

  const styleEl = document.createElement('style');
  styleEl.setAttribute('data-dw-highlight-anim-keyframes', key.replace(/"/g, ''));
  styleEl.textContent = `
@keyframes ${name} {
  0% { box-shadow: 0 0 0 0 transparent; }
  ${midPct.toFixed(4)}% { box-shadow: 0 0 28px 8px ${color}, 0 0 14px 2px ${color}; }
  ${pulseEndPct.toFixed(4)}% { box-shadow: 0 0 0 0 transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
}
`;
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
  }
): CSSProperties | undefined {
  if (opts.isLineNode || opts.isDuplicateDragPreview) return undefined;
  if (!node.highlightAnim) return undefined;

  const dur = node.highlightAnimDurationSec ?? HIGHLIGHT_ANIM_DEFAULT_DURATION_SEC;
  const intv = node.highlightAnimIntervalSec ?? HIGHLIGHT_ANIM_DEFAULT_INTERVAL_SEC;
  const color = node.highlightAnimGlowColor ?? HIGHLIGHT_ANIM_DEFAULT_GLOW_COLOR;

  const d = clampDurationSec(dur);
  const i = clampIntervalSec(intv);
  const period = d + i;

  const animName = ensureHighlightAnimKeyframes(d, i, color);
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
  };
}
