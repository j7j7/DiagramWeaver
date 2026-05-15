import type { DiagramNodeData, RichTextRun, TimelineBarSectionData } from "@/lib/types";
import {
  normalizeTimelineBarSections,
  timelineBarSegmentLayout,
} from "@/lib/timeline-bar";

export const SEGMENTED_RECTANGLE_NODE_TYPE = "generic.object.segmented-rectangle" as const;

export function isSegmentedRectangleNodeType(type: string | undefined): boolean {
  return type === SEGMENTED_RECTANGLE_NODE_TYPE || !!type?.endsWith(".segmented-rectangle");
}

export function normalizeSegmentedRectangleSections(node: DiagramNodeData): TimelineBarSectionData[] {
  const raw = (node as DiagramNodeData & { segmentedRectangleSections?: TimelineBarSectionData[] })
    .segmentedRectangleSections;
  if (!Array.isArray(raw) || raw.length === 0) {
    return defaultSegmentedRectangleSections();
  }
  return normalizeTimelineBarSections({ ...node, timelineBarSections: raw } as DiagramNodeData);
}

export function newSegmentedRectangleSectionId(nodeId: string): string {
  const u =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 10)
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${nodeId}-sr-${u}`;
}

const DEFAULT_SEG_FILLS = ["#fb923c", "#fbbf24", "#fcd34d", "#fde68a"];
const DEFAULT_SECTION_SUBLABELS = ["One", "Two", "Three", "Four"] as const;

function defaultSegmentedRectangleSectionRichLabel(suffix: string): RichTextRun[] {
  return [
    { text: "Section", lineJustify: "center", lineFontSize: 12, lineFontWeight: "600" },
    { text: "\n" },
    { text: suffix, lineJustify: "center", lineFontSize: 12, lineFontWeight: "600" },
  ];
}

export function defaultSegmentedRectangleSections(): TimelineBarSectionData[] {
  return DEFAULT_SECTION_SUBLABELS.map((suffix, i) => ({
    id: `sr-${i}`,
    label: `Section\n${suffix}`,
    richLabel: defaultSegmentedRectangleSectionRichLabel(suffix),
    fill: DEFAULT_SEG_FILLS[i % DEFAULT_SEG_FILLS.length] ?? "#94a3b8",
    fillStyle: "theme-hue" as const,
    weight: 1,
    ...(i === 0 ? { labelVerticalAlign: "middle" as const } : {}),
  }));
}

/** Palette / shape-swap defaults for `generic.object.segmented-rectangle`. */
export function defaultPaletteSegmentedRectangleNodeProps(nodeId: string): Partial<DiagramNodeData> {
  const segmentedRectangleSections: TimelineBarSectionData[] = DEFAULT_SECTION_SUBLABELS.map((suffix, i) => ({
    id: newSegmentedRectangleSectionId(nodeId),
    label: `Section\n${suffix}`,
    richLabel: defaultSegmentedRectangleSectionRichLabel(suffix),
    fill: DEFAULT_SEG_FILLS[i % DEFAULT_SEG_FILLS.length] ?? "#94a3b8",
    fillStyle: "theme-hue",
    weight: 1,
    ...(i === 0 ? { labelVerticalAlign: "middle" as const } : {}),
  }));

  return {
    borderStyle: "gradient",
    borderColors: ["#9a3412", "#b45309"],
    borderWidth: 2,
    borderColor: "#9a3412",
    backgroundStyle: "gradient",
    backgroundColors: ["#fef3c7", "#fed7aa"],
    backgroundColor: "#fef3c7",
    backgroundOpacity: 1,
    lineStyle: "solid",
    lineColor: "#3b82f6",
    lineWidth: 2.5,
    lineOpacity: 1,
    shadow: true,
    shadowColor: "#000000",
    shadowOpacity: 0.5,
    shadowBlur: 8,
    textColor: "#7c2d12",
    textOpacity: 1,
    gradientAngle: 115,
    textJustify: "center",
    textVerticalPosition: "middle",
    cornerRadius: 0.12,
    segmentedRectangleSections,
    segmentedRectangleSizing: "equal",
    segmentedRectangleSegmentGap: 64,
    segmentedRectangleOutlineMode: "segments",
    segmentedRectangleDividers: true,
    segmentedRectangleDividerWidth: 2,
    segmentedRectangleDividerColor: "#64748b",
    segmentedRectangleDividerInset: 0.1,
    segmentedRectangleHueStepDeg: 14,
  } as Partial<DiagramNodeData>;
}

/** Layout: `starts`/`widths` are in user units along inner width `innerWidth`; gaps between segments are `gapPx`. */
export function segmentedRectangleSegmentLayout(
  sections: TimelineBarSectionData[],
  innerWidth: number,
  sizing: "equal" | "weighted",
  gapPx: number,
): { starts: number[]; widths: number[] } {
  const gap = Math.max(0, gapPx);
  const n = sections.length;
  if (n === 0) return { starts: [], widths: [] };
  const gapsTotal = (n - 1) * gap;
  const contentW = Math.max(0, innerWidth - gapsTotal);
  const { starts: s0, widths } = timelineBarSegmentLayout(sections, contentW, sizing);
  const starts = s0.map((s, i) => s + i * gap);
  return { starts, widths };
}

/** X positions (inner coords, 0–`innerWidth`) for vertical divider lines between segments. */
export function segmentedRectangleDividerInnerXs(
  sections: TimelineBarSectionData[],
  starts: number[],
  widths: number[],
  gapPx: number,
): number[] {
  const n = sections.length;
  if (n <= 1) return [];
  const gap = Math.max(0, gapPx);
  const xs: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const edge = (starts[i] ?? 0) + (widths[i] ?? 0);
    xs.push(gap > 0 ? edge + gap / 2 : edge);
  }
  return xs;
}

export function segmentedRectangleMemoPayload(n: DiagramNodeData): string {
  const x = n as DiagramNodeData & {
    segmentedRectangleSections?: TimelineBarSectionData[];
    segmentedRectangleSizing?: string;
    segmentedRectangleSegmentGap?: number;
    segmentedRectangleOutlineMode?: string;
    segmentedRectangleDividers?: boolean;
    segmentedRectangleDividerWidth?: number;
    segmentedRectangleDividerColor?: string;
    segmentedRectangleDividerInset?: number;
    segmentedRectangleHueStepDeg?: number;
    segmentedRectangleLabelsFollowFirstSection?: boolean;
    cornerRadius?: number;
    backgroundStyle?: string;
    backgroundColor?: string;
    backgroundColors?: string[];
    fontSize?: number;
    fontFamily?: string;
    textJustify?: string;
    textVerticalPosition?: string;
    fontWeight?: string;
    fontStyle?: string;
    textDecoration?: string;
    textOpacity?: number;
    lineHeight?: number;
    letterSpacing?: number;
    textTransform?: string;
  };
  return JSON.stringify([
    x.segmentedRectangleSections,
    x.segmentedRectangleSizing,
    x.segmentedRectangleSegmentGap,
    x.segmentedRectangleOutlineMode,
    x.segmentedRectangleDividers,
    x.segmentedRectangleDividerWidth,
    x.segmentedRectangleDividerColor,
    x.segmentedRectangleDividerInset,
    x.segmentedRectangleHueStepDeg,
    x.segmentedRectangleLabelsFollowFirstSection,
    x.cornerRadius,
    x.backgroundStyle,
    x.backgroundColor,
    x.backgroundColors,
    x.fontSize,
    x.fontFamily,
    x.textJustify,
    x.textVerticalPosition,
    x.fontWeight,
    x.fontStyle,
    x.textDecoration,
    x.textOpacity,
    x.lineHeight,
    x.letterSpacing,
    x.textTransform,
  ]);
}
