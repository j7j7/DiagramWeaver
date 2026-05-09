import type { DiagramNodeData, TimelineEntryData } from "@/lib/types";
import { extractVisualStylingFromNode } from "@/lib/visual-styling";
import { extractTextStylingFromNode } from "@/lib/text-styling";
import { applyTimelineSequentialHuesToMergedVisual } from "@/lib/timeline-hues";

const ENTRY_VISUAL_KEYS = [
  "backgroundStyle",
  "backgroundColor",
  "backgroundColors",
  "gradientAngle",
  "frostedDiffusion",
  "frostedTransparency",
  "frostedPerlinNoise",
  "borderStyle",
  "borderColor",
  "borderColors",
  "borderGradientAngle",
  "shadow",
] as const;

/** Merge timeline defaults + entry overrides into a flat object for panels / rendering. */
export function mergedTimelineEntryVisualNode(
  timelineNode: DiagramNodeData,
  entry: TimelineEntryData,
): Record<string, unknown> {
  const base = timelineNode as unknown as Record<string, unknown>;
  const ent = entry as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of ENTRY_VISUAL_KEYS) {
    const v = ent[k];
    out[k] = v !== undefined ? v : base[k];
  }
  return out;
}

export function extractTimelineEntryVisualForPanel(
  timelineNode: DiagramNodeData,
  entryId: string,
): ReturnType<typeof extractVisualStylingFromNode> {
  const entries = timelineNode.timelineEntries ?? [];
  const entry = entries.find((e) => e.id === entryId);
  if (!entry) return extractVisualStylingFromNode(timelineNode as any);
  return extractVisualStylingFromNode(mergedTimelineEntryVisualNode(timelineNode, entry) as any);
}

export function extractTimelineEntryTextForPanel(
  timelineNode: DiagramNodeData,
  entryId: string,
): ReturnType<typeof extractTextStylingFromNode> {
  const entries = timelineNode.timelineEntries ?? [];
  const entry = entries.find((e) => e.id === entryId);
  const baseText = extractTextStylingFromNode(timelineNode as any);
  if (!entry || entry.textColor === undefined) return baseText;
  return { ...baseText, textColor: entry.textColor };
}

/** Synthetic timeline typography + entry `label` / `richLabel` / `textColor` for card bodies merged into {@link buildSyntheticTimelineEntryCardNode}. */
export function mergedTimelineEntryTextDisplayNode(
  timelineNode: DiagramNodeData,
  entry: TimelineEntryData,
): DiagramNodeData {
  const richFromEntry = entry.richLabel && entry.richLabel.length > 0 ? entry.richLabel : undefined;
  const next: DiagramNodeData = {
    ...timelineNode,
    label: entry.label ?? "",
    ...(entry.textColor !== undefined ? { textColor: entry.textColor } : {}),
  };
  if (richFromEntry !== undefined) {
    next.richLabel = richFromEntry;
  } else {
    delete next.richLabel;
  }
  return next;
}

/** Full card node for {@link MindmapNodeShape} — same HTML pipeline as palette composite shapes. */
export function buildSyntheticTimelineEntryCardNode(
  timelineNode: DiagramNodeData,
  entry: TimelineEntryData,
  hueRank: number,
  cardW: number,
  cardH: number,
): DiagramNodeData {
  const mergedVisRecord = applyTimelineSequentialHuesToMergedVisual(
    timelineNode,
    hueRank,
    mergedTimelineEntryVisualNode(timelineNode, entry),
  );
  const textMerged = mergedTimelineEntryTextDisplayNode(timelineNode, entry);
  return {
    ...textMerged,
    ...(mergedVisRecord as unknown as DiagramNodeData),
    width: cardW,
    height: cardH,
    cornerRadius:
      entry.cornerRadius ??
      (typeof timelineNode.timelineCornerRadius === "number" ? timelineNode.timelineCornerRadius : undefined),
    compositeBodyShape: timelineNode.compositeBodyShape,
    id: `${timelineNode.id}-tl-card-${entry.id}`,
    type: timelineNode.type,
  };
}

export function applyVisualPatchToTimelineEntry(
  timelineNode: DiagramNodeData,
  entryId: string,
  patch: Record<string, unknown>,
): DiagramNodeData {
  const entries = timelineNode.timelineEntries ?? [];
  const nextEntries = entries.map((e) => {
    if (e.id !== entryId) return e;
    const merged = { ...e } as Record<string, unknown>;
    for (const [k, v] of Object.entries(patch)) {
      if ((ENTRY_VISUAL_KEYS as readonly string[]).includes(k) || k === "cornerRadius" || k === "width" || k === "height") {
        if (v !== undefined) merged[k] = v;
      }
    }
    return merged as unknown as TimelineEntryData;
  });
  return { ...timelineNode, timelineEntries: nextEntries };
}

export function applyTextPatchToTimelineEntry(
  timelineNode: DiagramNodeData,
  entryId: string,
  patch: Record<string, unknown>,
): DiagramNodeData {
  const entries = timelineNode.timelineEntries ?? [];
  const nextEntries = entries.map((e) => {
    if (e.id !== entryId) return e;
    const merged = { ...e } as Record<string, unknown>;
    if (patch.textColor !== undefined) merged.textColor = patch.textColor;
    return merged as unknown as TimelineEntryData;
  });
  return { ...timelineNode, timelineEntries: nextEntries };
}
