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
}

/** Delay between segment i and i+1 so the cascade reads clearly (ms). */
export const CHART_SLIDE_SEGMENT_STAGGER_MS = 58;

export function chartPresentationSignature(node: DiagramNodeData): string | null {
  if (!isChartNodeType(node.type)) return null;
  return JSON.stringify((node as { chart?: unknown }).chart ?? null);
}

/** Upper bound for slide timeout so the last segment animation can finish. */
export function chartSegmentCountForStagger(node: DiagramNodeData): number {
  const c = (node as { chart?: { kind?: string; series?: unknown[] } }).chart;
  if (!c || typeof c !== "object") return 0;
  if (c.kind === "pie") {
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
