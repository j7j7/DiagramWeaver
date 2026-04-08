import type { DiagramConnectionData } from "@/lib/types";

const MIN_W = 1;
const MAX_W = 10;

export function clampConnectionLineWidth(w: number): number {
  if (!Number.isFinite(w)) return 2.5;
  return Math.max(MIN_W, Math.min(MAX_W, w));
}

export interface ResolvedConnectionWidths {
  wStart: number;
  wEnd: number;
  /** When false, start/end may differ (`lineWidth` = start, `lineWidthEnd` = end). */
  locked: boolean;
}

export function resolveConnectionWidths(
  connection: DiagramConnectionData | undefined,
  fallback = 2.5
): ResolvedConnectionWidths {
  const base = clampConnectionLineWidth(connection?.lineWidth ?? fallback);
  const locked = connection?.lineWidthLock !== false;
  if (locked) {
    return { wStart: base, wEnd: base, locked: true };
  }
  const end = clampConnectionLineWidth(connection?.lineWidthEnd ?? base);
  return { wStart: base, wEnd: end, locked: false };
}

export interface ResolvedConnectionColors {
  cStart: string;
  cEnd: string;
  locked: boolean;
}

export function resolveConnectionColors(
  connection: DiagramConnectionData | undefined,
  fallback: string
): ResolvedConnectionColors {
  const c = connection?.color ?? fallback;
  const locked = connection?.colorLock !== false;
  if (locked) {
    return { cStart: c, cEnd: c, locked: true };
  }
  const end = connection?.colorEnd ?? c;
  return { cStart: c, cEnd: end, locked: false };
}

/** True when taper and/or color gradient should replace the simple uniform stroke. */
export function connectionNeedsAdvancedLineStyle(
  rw: ResolvedConnectionWidths,
  rc: ResolvedConnectionColors
): boolean {
  const widthVaries = !rw.locked && rw.wStart !== rw.wEnd;
  const colorVaries = !rc.locked && rc.cStart !== rc.cEnd;
  return widthVaries || colorVaries;
}

export function maxResolvedLineWidth(rw: ResolvedConnectionWidths): number {
  return Math.max(rw.wStart, rw.wEnd);
}
