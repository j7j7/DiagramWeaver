import type { CSSProperties } from "react";
import type { DiagramNodeData } from "@/lib/types";
import { isChartNodeType } from "@/lib/chart-node";

/** Passed from slide transition into chart shapes for per-segment pop-in/out. */
export interface ChartSlideStagger {
  baseDelayMs: number;
  staggerMs: number;
  durationMs: number;
  /** CSS timing function, e.g. cubic-bezier(0.4, 0, 0.2, 1) */
  easingCss: string;
  /** True: sequential segment fade-out (chart removed on next slide). */
  exit?: boolean;
  /** Card shell: fade outer `ShapeWrapper` in with the first stagger wave (dashboard, etc.). */
  shellEntrance?: boolean;
}

/** Delay between segment i and i+1 so the cascade reads clearly (ms). */
export const CHART_SLIDE_SEGMENT_STAGGER_MS = 58;

/** Grid chart: frame (background, border, grid lines, titles) fades before/after cell stagger. */
export const GRID_CHART_SHELL_FADE_MS = 140;

/** Cell stagger config: on enter, cells start after the shell fade. */
export function gridChartCellSlideStagger(cfg: ChartSlideStagger): ChartSlideStagger {
  if (cfg.exit) return cfg;
  return { ...cfg, baseDelayMs: cfg.baseDelayMs + GRID_CHART_SHELL_FADE_MS };
}

/** Shell fades in first (enter) or out last (exit, after all cells). */
export function gridChartShellPopAnimationStyle(
  cfg: ChartSlideStagger,
  cellCount: number,
  animationNameIn: string,
  animationNameOut: string
): CSSProperties | undefined {
  const name = cfg.exit ? animationNameOut : animationNameIn;
  const n = Math.max(1, cellCount);
  const delay = cfg.exit
    ? cfg.baseDelayMs + (n - 1) * cfg.staggerMs + cfg.durationMs
    : cfg.baseDelayMs;
  return {
    animation: `${name} ${GRID_CHART_SHELL_FADE_MS}ms ${cfg.easingCss} ${delay}ms both`,
    willChange: "opacity",
  };
}

/** Total ms for a grid appear/disappear stagger sequence (shell + cells). */
export function gridChartSlideStaggerTailMs(
  baseDelayMs: number,
  cellCount: number,
  segmentStaggerMs: number,
  segmentDurationMs: number,
  exit: boolean
): number {
  const n = Math.max(1, cellCount);
  const cellsSpan = (n - 1) * segmentStaggerMs + segmentDurationMs;
  if (exit) {
    return baseDelayMs + cellsSpan + GRID_CHART_SHELL_FADE_MS;
  }
  return baseDelayMs + GRID_CHART_SHELL_FADE_MS + cellsSpan;
}

export function chartPresentationSignature(node: DiagramNodeData): string | null {
  if (!isChartNodeType(node.type)) return null;
  return JSON.stringify((node as { chart?: unknown }).chart ?? null);
}

/** Upper bound for slide timeout so the last segment animation can finish. */
export function chartSegmentCountForStagger(node: DiagramNodeData): number {
  const c = (node as { chart?: { kind?: string; series?: unknown[] } }).chart;
  if (!c || typeof c !== "object") return 0;
  if (c.kind === "pie" || c.kind === "ring") {
    return Array.isArray(c.series) ? c.series.length : 0;
  }
  if (c.kind === "bar") {
    const s = c.series;
    if (!Array.isArray(s) || s.length === 0) return 0;
    let cat = 0;
    for (const row of s) {
      const rowObj = row as { values?: unknown[] };
      const len = Array.isArray(rowObj.values) ? rowObj.values.length : 0;
      cat = Math.max(cat, len);
    }
    const cols = Math.max(1, cat);
    return cols * s.length;
  }
  if (c.kind === "line") {
    return Array.isArray(c.series) ? c.series.length : 0;
  }
  if (c.kind === "grid") {
    const cols = Math.max(1, (c as { cols?: number }).cols ?? 4);
    const rows = Math.max(1, (c as { rows?: number }).rows ?? 4);
    return cols * rows;
  }
  if (c.kind === "gantt") {
    return Array.isArray((c as { bars?: unknown[] }).bars) ? (c as { bars: unknown[] }).bars.length : 0;
  }
  return 0;
}

/** Opacity-only: sequential reveals (in) or hides (out). */
export function chartSegmentPopKeyframesCss(
  animationNameIn: string,
  animationNameOut: string
): string {
  return `@keyframes ${animationNameIn}{0%{opacity:0}100%{opacity:1}}@keyframes ${animationNameOut}{0%{opacity:1}100%{opacity:0}}`;
}

export function chartSegmentPopAnimationStyle(
  segmentIndex: number,
  animationNameIn: string,
  animationNameOut: string,
  _originX: number,
  _originY: number,
  cfg: ChartSlideStagger | undefined
): CSSProperties | undefined {
  if (!cfg) return undefined;
  const name = cfg.exit ? animationNameOut : animationNameIn;
  const delay = cfg.baseDelayMs + segmentIndex * cfg.staggerMs;
  return {
    animation: `${name} ${cfg.durationMs}ms ${cfg.easingCss} ${delay}ms both`,
    willChange: "opacity",
  };
}

/** Scale at start of slide-in / end of slide-out (1 = final card size). */
const TIMELINE_SLIDE_POP_SCALE_FROM = 0.82;

/** Grow + fade in / shrink + fade out — sequential stagger matches `chartSegmentPopAnimationStyle` timing. */
export function timelineEntryPopKeyframesCss(
  animationNameIn: string,
  animationNameOut: string
): string {
  const s = TIMELINE_SLIDE_POP_SCALE_FROM;
  return (
    `@keyframes ${animationNameIn}{0%{opacity:0;transform:scale(${s})}100%{opacity:1;transform:scale(1)}}` +
    `@keyframes ${animationNameOut}{0%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(${s})}}`
  );
}

export function timelineEntryPopAnimationStyle(
  entryIndex: number,
  animationNameIn: string,
  animationNameOut: string,
  cfg: ChartSlideStagger | undefined
): CSSProperties | undefined {
  if (!cfg) return undefined;
  const name = cfg.exit ? animationNameOut : animationNameIn;
  const delay = cfg.baseDelayMs + entryIndex * cfg.staggerMs;
  return {
    animation: `${name} ${cfg.durationMs}ms ${cfg.easingCss} ${delay}ms both`,
    transformOrigin: "center center",
    willChange: "opacity, transform",
  };
}
