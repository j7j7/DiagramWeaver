import type { DiagramViewState } from './types';

/** Clamp zoom to sane range and ensure valid numbers */
export function sanitizeViewState(vs?: DiagramViewState | null): DiagramViewState | null {
  if (!vs || typeof vs !== 'object') return null;
  const x = typeof vs.x === 'number' && Number.isFinite(vs.x) ? vs.x : 0;
  const y = typeof vs.y === 'number' && Number.isFinite(vs.y) ? vs.y : 0;
  const kRaw = typeof vs.k === 'number' && Number.isFinite(vs.k) ? vs.k : 1;
  const k = Math.max(0.1, Math.min(2.5, kRaw));
  return { x, y, k };
}

/** Returns true if viewState exists and has valid numbers */
export function hasValidViewState(vs?: DiagramViewState | null): boolean {
  return sanitizeViewState(vs) !== null;
}
