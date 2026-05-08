import { shiftHueOfColor } from "@/lib/color-shift";
import type { DiagramNodeData } from "@/lib/types";
import { DIAGRAM_THEME_HUE_STEP_DEG } from "@/lib/theme-manager";

/**
 * When `timelineCardFillMode === 'theme-hues'`, rotate card fill/outline hues by **`hueRank`**
 * (caller passes order along the spine — typically sort index by arc ratio `t`, not raw row index).
 */
export function applyTimelineSequentialHuesToMergedVisual(
  timelineNode: DiagramNodeData,
  hueRank: number,
  merged: Record<string, unknown>,
): Record<string, unknown> {
  if (timelineNode.timelineCardFillMode !== "theme-hues") return merged;
  const stepRaw = timelineNode.timelineHueStepDeg;
  const step =
    typeof stepRaw === "number" && Number.isFinite(stepRaw) ? stepRaw : DIAGRAM_THEME_HUE_STEP_DEG;
  const delta = hueRank * step;
  if (!Number.isFinite(delta) || delta === 0) return merged;

  const shift = (c: unknown) => (typeof c === "string" ? shiftHueOfColor(c, delta) : c);
  const next = { ...merged };
  if (typeof next.backgroundColor === "string") next.backgroundColor = shift(next.backgroundColor);
  if (Array.isArray(next.backgroundColors)) next.backgroundColors = next.backgroundColors.map(shift);
  if (typeof next.borderColor === "string") next.borderColor = shift(next.borderColor);
  if (Array.isArray(next.borderColors)) next.borderColors = next.borderColors.map(shift);
  return next;
}
