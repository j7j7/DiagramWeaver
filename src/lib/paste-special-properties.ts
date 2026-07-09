import type {
  DiagramNodeData,
  NodeChartSpec,
  NodeChartSpecBar,
  NodeChartSpecLine,
  NodeChartSpecPie,
  NodeChartSpecRing,
} from "@/lib/types";
import { isChartNodeType } from "@/lib/chart-node";
import {
  isConnectorLineNodeType,
  isIconOrEmojiType,
  isMindmapNodeType,
  isTimelineNodeType,
} from "@/lib/utils";
import { applyVisualStylingToNode, extractVisualStylingFromNode } from "@/lib/visual-styling";

export type PasteSpecialAspect = "size" | "colour" | "text" | "description" | "properties";

/** Clipboard payload shape from `use-canvas-clipboard` (nodes + optional single node). */
export type PasteSpecialClipboardLike = {
  node?: DiagramNodeData;
  nodes?: DiagramNodeData[];
};

export function getClipboardTemplateNode(c: PasteSpecialClipboardLike | null): DiagramNodeData | null {
  if (!c) return null;
  if (c.nodes && c.nodes.length > 0) {
    return c.nodes[0];
  }
  if (c.node) return c.node;
  return null;
}

export type PastePropertyFamily =
  | { kind: "chart"; chartKind: "pie" | "bar" | "line" | "ring" | "grid" }
  | { kind: "connectorLine" }
  | { kind: "timeline" }
  | { kind: "mindmap" }
  | { kind: "uml" }
  | { kind: "closedShape" }
  | { kind: "icon" }
  | { kind: "resourceLabel" };

function chartKindFromType(type: string): "pie" | "bar" | "line" | "ring" | "grid" | null {
  if (type === "generic.chart.pie" || type.endsWith(".chart.pie")) return "pie";
  if (type === "generic.chart.bar" || type.endsWith(".chart.bar")) return "bar";
  if (type === "generic.chart.line" || type.endsWith(".chart.line")) return "line";
  if (type === "generic.chart.ring" || type.endsWith(".chart.ring")) return "ring";
  if (type === "generic.chart.grid" || type.endsWith(".chart.grid")) return "grid";
  return null;
}

/**
 * Coarse families so rectangle ↔ circle works, rectangle ↔ chart does not,
 * and pie ↔ bar does not.
 */
export function getPastePropertyFamily(type: string | undefined): PastePropertyFamily | null {
  if (!type) return null;
  if (isChartNodeType(type)) {
    const ck = chartKindFromType(type);
    return ck ? { kind: "chart", chartKind: ck } : null;
  }
  if (isConnectorLineNodeType(type)) return { kind: "connectorLine" };
  if (isTimelineNodeType(type)) return { kind: "timeline" };
  if (isMindmapNodeType(type)) return { kind: "mindmap" };
  if (type === "generic.object.uml-class" || type.endsWith(".uml-class")) return { kind: "uml" };
  if (isIconOrEmojiType(type)) return { kind: "icon" };
  if (type.startsWith("generic.object.") || type.includes(".object.")) {
    if (isConnectorLineNodeType(type)) return { kind: "connectorLine" };
    return { kind: "closedShape" };
  }
  return { kind: "resourceLabel" };
}

export function pasteSpecialFamiliesCompatible(
  sourceType: string | undefined,
  targetType: string | undefined,
): boolean {
  const a = getPastePropertyFamily(sourceType);
  const b = getPastePropertyFamily(targetType);
  if (!a || !b) return false;
  if (a.kind !== b.kind) return false;
  if (a.kind === "chart" && b.kind === "chart") return a.chartKind === b.chartKind;
  return true;
}

function cloneRich(runs: DiagramNodeData["richLabel"]): DiagramNodeData["richLabel"] | undefined {
  if (!runs) return undefined;
  return runs.map((run) => ({ ...run }));
}

function mergePieRingColourPieLike(
  target: NodeChartSpecPie | NodeChartSpecRing,
  source: NodeChartSpecPie | NodeChartSpecRing
): void {
  if (source.sliceBorderColor !== undefined) target.sliceBorderColor = source.sliceBorderColor;
  if ("sliceBorderWidth" in source && "sliceBorderWidth" in target) {
    const sw = source.sliceBorderWidth;
    if (sw !== undefined) (target as NodeChartSpecRing).sliceBorderWidth = sw;
  }
  if (source.shadow !== undefined) target.shadow = source.shadow;
  const n = Math.min(target.series.length, source.series.length);
  for (let i = 0; i < n; i++) {
    const src = source.series[i];
    const row = target.series[i];
    if (src.color !== undefined) row.color = src.color;
    if (src.labelColor !== undefined) row.labelColor = src.labelColor;
    if (src.fillStyle !== undefined) row.fillStyle = src.fillStyle;
    if (src.gradientColors !== undefined)
      row.gradientColors = [...src.gradientColors] as [string, string];
    const srcRing = src as ChartRingSliceLike;
    const rowRing = row as ChartRingSliceLike;
    if (srcRing.sliceOutlineColor !== undefined) rowRing.sliceOutlineColor = srcRing.sliceOutlineColor;
    if (srcRing.sliceOutlineWidth !== undefined) rowRing.sliceOutlineWidth = srcRing.sliceOutlineWidth;
  }
}

/** Narrow fields reused when merging paste colour onto pie or ring slices. */
type ChartRingSliceLike = {
  sliceOutlineColor?: string;
  sliceOutlineWidth?: number;
};

function mergeBarLineSeriesColour<T extends { series: NodeChartSpecBar["series"] }>(t: T, s: T): void {
  const n = Math.min(t.series.length, s.series.length);
  for (let i = 0; i < n; i++) {
    const src = s.series[i];
    const row = t.series[i];
    if (src.color !== undefined) row.color = src.color;
    if (src.labelColor !== undefined) row.labelColor = src.labelColor;
    if (src.fillStyle !== undefined) row.fillStyle = src.fillStyle;
    if (src.gradientColors !== undefined) row.gradientColors = [...src.gradientColors] as [string, string];
  }
}

function mergeChartColour(target: NodeChartSpec, source: NodeChartSpec): NodeChartSpec {
  if (target.kind !== source.kind) return target;
  const t = structuredClone(target);
  if (t.kind === "pie" && source.kind === "pie") {
    mergePieRingColourPieLike(t, source);
    return t;
  }
  if (t.kind === "ring" && source.kind === "ring") {
    mergePieRingColourPieLike(t, source);
    return t;
  }
  if (t.kind === "bar" && source.kind === "bar") {
    if (source.sliceBorderColor !== undefined) t.sliceBorderColor = source.sliceBorderColor;
    if (source.shadow !== undefined) t.shadow = source.shadow;
    if (source.gridColor !== undefined) t.gridColor = source.gridColor;
    if (source.axisColor !== undefined) t.axisColor = source.axisColor;
    mergeBarLineSeriesColour(t, source);
    return t;
  }
  if (t.kind === "line" && source.kind === "line") {
    if (source.sliceBorderColor !== undefined) t.sliceBorderColor = source.sliceBorderColor;
    if (source.shadow !== undefined) t.shadow = source.shadow;
    if (source.gridColor !== undefined) t.gridColor = source.gridColor;
    if (source.axisColor !== undefined) t.axisColor = source.axisColor;
    mergeBarLineSeriesColour(t, source);
    return t;
  }
  return t;
}

function mergeChartText(target: NodeChartSpec, source: NodeChartSpec): NodeChartSpec {
  if (target.kind !== source.kind) return target;
  const t = structuredClone(target);
  if (t.kind === "pie" && source.kind === "pie") {
    if (source.showSegmentLabels !== undefined) t.showSegmentLabels = source.showSegmentLabels;
    const n = Math.min(t.series.length, source.series.length);
    for (let i = 0; i < n; i++) {
      const src = source.series[i];
      const row = t.series[i];
      if (src.labelFontSize !== undefined) row.labelFontSize = src.labelFontSize;
    }
    return t;
  }
  if (t.kind === "ring" && source.kind === "ring") {
    if (source.showSegmentLabels !== undefined) t.showSegmentLabels = source.showSegmentLabels;
    const n = Math.min(t.series.length, source.series.length);
    for (let i = 0; i < n; i++) {
      const src = source.series[i];
      const row = t.series[i];
      if (src.labelFontSize !== undefined) row.labelFontSize = src.labelFontSize;
    }
    return t;
  }
  if (t.kind === "bar" && source.kind === "bar") {
    if (source.categoryLabels !== undefined) t.categoryLabels = source.categoryLabels ? [...source.categoryLabels] : undefined;
    if (source.showSegmentLabels !== undefined) t.showSegmentLabels = source.showSegmentLabels;
    if (source.showCategoryLabels !== undefined) t.showCategoryLabels = source.showCategoryLabels;
    if (source.showSegmentValues !== undefined) t.showSegmentValues = source.showSegmentValues;
    if (source.showLegend !== undefined) t.showLegend = source.showLegend;
    if (source.categoryLabelFontSize !== undefined) t.categoryLabelFontSize = source.categoryLabelFontSize;
    if (source.legendLabelFontSize !== undefined) t.legendLabelFontSize = source.legendLabelFontSize;
    const n = Math.min(t.series.length, source.series.length);
    for (let i = 0; i < n; i++) {
      if (source.series[i].labelFontSize !== undefined) {
        t.series[i].labelFontSize = source.series[i].labelFontSize;
      }
    }
    return t;
  }
  if (t.kind === "line" && source.kind === "line") {
    if (source.categoryLabels !== undefined) t.categoryLabels = source.categoryLabels ? [...source.categoryLabels] : undefined;
    if (source.showCategoryLabels !== undefined) t.showCategoryLabels = source.showCategoryLabels;
    if (source.showLegend !== undefined) t.showLegend = source.showLegend;
    if (source.categoryLabelFontSize !== undefined) t.categoryLabelFontSize = source.categoryLabelFontSize;
    if (source.legendLabelFontSize !== undefined) t.legendLabelFontSize = source.legendLabelFontSize;
    const n = Math.min(t.series.length, source.series.length);
    for (let i = 0; i < n; i++) {
      if (source.series[i].labelFontSize !== undefined) {
        t.series[i].labelFontSize = source.series[i].labelFontSize;
      }
    }
    return t;
  }
  return t;
}

function mergeChartProperties(target: NodeChartSpec, source: NodeChartSpec): NodeChartSpec {
  if (target.kind !== source.kind) return target;
  const t = structuredClone(target);
  if (t.kind === "pie" && source.kind === "pie") {
    if (source.segmentGapDeg !== undefined) t.segmentGapDeg = source.segmentGapDeg;
    if (source.valuesLocked !== undefined) t.valuesLocked = source.valuesLocked;
    const n = Math.min(t.series.length, source.series.length);
    for (let i = 0; i < n; i++) {
      if (source.series[i].segmentPull !== undefined) {
        t.series[i].segmentPull = source.series[i].segmentPull;
      }
    }
    return t;
  }
  if (t.kind === "ring" && source.kind === "ring") {
    if (source.valuesLocked !== undefined) t.valuesLocked = source.valuesLocked;
    if (source.innerRadius !== undefined) t.innerRadius = source.innerRadius;
    if (source.segmentAngularGapDeg !== undefined) t.segmentAngularGapDeg = source.segmentAngularGapDeg;
    if (source.sliceBorderWidth !== undefined) t.sliceBorderWidth = source.sliceBorderWidth;
    const n = Math.min(t.series.length, source.series.length);
    for (let i = 0; i < n; i++) {
      const sr = source.series[i];
      const tr = t.series[i];
      if (sr.ringThickness !== undefined) tr.ringThickness = sr.ringThickness;
      if (sr.ringRadialOffset !== undefined) tr.ringRadialOffset = sr.ringRadialOffset;
      if (sr.sliceOutlineColor !== undefined) tr.sliceOutlineColor = sr.sliceOutlineColor;
      if (sr.sliceOutlineWidth !== undefined) tr.sliceOutlineWidth = sr.sliceOutlineWidth;
    }
    return t;
  }
  if (t.kind === "bar" && source.kind === "bar") {
    if (source.stacked100 !== undefined) t.stacked100 = source.stacked100;
    if (source.vertical !== undefined) t.vertical = source.vertical;
    if (source.categoryGap !== undefined) t.categoryGap = source.categoryGap;
    if (source.stackGap !== undefined) t.stackGap = source.stackGap;
    if (source.roundedColumnEnds !== undefined) t.roundedColumnEnds = source.roundedColumnEnds;
    if (source.showGridX !== undefined) t.showGridX = source.showGridX;
    if (source.showGridY !== undefined) t.showGridY = source.showGridY;
    if (source.showValueAxis !== undefined) t.showValueAxis = source.showValueAxis;
    if (source.valuesLocked !== undefined) t.valuesLocked = source.valuesLocked;
    return t;
  }
  if (t.kind === "line" && source.kind === "line") {
    if (source.showGridX !== undefined) t.showGridX = source.showGridX;
    if (source.showGridY !== undefined) t.showGridY = source.showGridY;
    if (source.showValueAxis !== undefined) t.showValueAxis = source.showValueAxis;
    if (source.showDots !== undefined) t.showDots = source.showDots;
    if (source.smooth !== undefined) t.smooth = source.smooth;
    if (source.dotRadius !== undefined) t.dotRadius = source.dotRadius;
    if (source.lineStrokeWidth !== undefined) t.lineStrokeWidth = source.lineStrokeWidth;
    if (source.showAreaFill !== undefined) t.showAreaFill = source.showAreaFill;
    if (source.areaFillOpacity !== undefined) t.areaFillOpacity = source.areaFillOpacity;
    if (source.valuesLocked !== undefined) t.valuesLocked = source.valuesLocked;
    return t;
  }
  return t;
}

function pickDefined<T extends object>(target: T, source: T, keys: (keyof T)[]): void {
  for (const k of keys) {
    const v = source[k];
    if (v !== undefined) (target as any)[k] = v;
  }
}

function applySizeAspect(source: DiagramNodeData, target: DiagramNodeData): DiagramNodeData {
  const out = { ...target };
  pickDefined(out, source, [
    "width",
    "height",
    "sizeMode",
    "nodeSize",
    "labelWidth",
    "cornerRadius",
    "borderWidth",
    "lineThickness",
    "timelineCardW",
    "timelineCardH",
    "timelineCornerRadius",
    "timelineConnectorWidth",
    "timelineDotRadius",
    "mindmapRadiusPx",
  ] as (keyof DiagramNodeData)[]);
  if (source.imageOptions !== undefined) {
    out.imageOptions = structuredClone(source.imageOptions);
  }
  return out;
}

function applyColourAspect(source: DiagramNodeData, target: DiagramNodeData): DiagramNodeData {
  let out = applyVisualStylingToNode(target, extractVisualStylingFromNode(source)) as DiagramNodeData;
  pickDefined(out, source, [
    "textColor",
    "headingTextColor",
    "headingBackgroundColor",
    "iconColor",
    "iconColorEnabled",
    "iconGreyscale",
    "iconOpacity",
    "iconBevel",
    "iconBevelRotation",
    "iconBevelDepth",
    "iconBevelBlockColor",
    "iconBevelMatchIconBackground",
    "iconBevelGridOffset",
    "lineColor",
    "lineColors",
    "lineColorStyle",
    "lineGradientAngle",
  ] as (keyof DiagramNodeData)[]);
  if (isChartNodeType(target.type) && source.chart && target.chart) {
    out = { ...out, chart: mergeChartColour(target.chart, source.chart) };
  }
  return out;
}

function applyTextAspect(source: DiagramNodeData, target: DiagramNodeData): DiagramNodeData {
  const out = { ...target };
  pickDefined(out, source, [
    "label",
    "textJustify",
    "textVerticalPosition",
    "fontFamily",
    "fontSize",
    "fontWeight",
    "fontStyle",
    "textDecoration",
    "textTransform",
    "letterSpacing",
    "lineHeight",
    "textOpacity",
    "textOutlineWidth",
    "textOutlineColor",
    "textGlowBlur",
    "textGlowColor",
    "textShadowOffsetX",
    "textShadowOffsetY",
    "textShadowBlur",
    "textShadowColor",
    "textDropShadowEnabled",
    "lineTextPosition",
    "lineTextVerticalPosition",
    "lineTextHorizontal",
    "tag",
    "tagPosition",
    "headingLabel",
    "headingEdge",
  ] as (keyof DiagramNodeData)[]);
  if (source.richLabel !== undefined) {
    out.richLabel = cloneRich(source.richLabel);
  } else if (source.label !== undefined) {
    delete out.richLabel;
  }
  if (source.richHeadingLabel !== undefined) {
    out.richHeadingLabel = cloneRich(source.richHeadingLabel);
  } else if (source.headingLabel !== undefined) {
    delete out.richHeadingLabel;
  }
  if (source.umlClass !== undefined) {
    out.umlClass = structuredClone(source.umlClass);
  }
  if (source.umlClassStyle !== undefined) {
    out.umlClassStyle = structuredClone(source.umlClassStyle);
  }
  if (isChartNodeType(target.type) && source.chart && target.chart) {
    out.chart = mergeChartText(target.chart, source.chart);
  }
  return out;
}

function applyDescriptionAspect(source: DiagramNodeData, target: DiagramNodeData): DiagramNodeData {
  const out = { ...target };
  if (source.info !== undefined) {
    out.info = source.info;
  }
  return out;
}

function applyPropertiesAspect(source: DiagramNodeData, target: DiagramNodeData): DiagramNodeData {
  const out = { ...target };
  pickDefined(out, source, [
    "rotation",
    "layer",
    "stackWithShapes",
    "objectStyle",
    "freeflow",
    "edgePosition",
    "textPosition",
    "ignoreConnectionAvoidance",
    "shadow",
    "highlightAnim",
    "highlightAnimDurationSec",
    "highlightAnimIntervalSec",
    "highlightAnimGlowColor",
    "highlightAnimGlowIntensity",
    "highlightAnimMode",
    "startCap",
    "endCap",
    "lineType",
    "linePathStyle",
    "lineSmoothJoints",
    "compositeBodyShape",
    "timelineDistribution",
    "timelineCardSide",
    "timelineSections",
    "timelineCardFillMode",
    "timelineHueStepDeg",
    "mindmapFillMode",
    "mindmapHueStepDeg",
    "mindmapHueLocked",
    "mindmapHueAnchor",
    "mindmapStartAngleDeg",
    "headingBackgroundStyle",
    "progressShowPercent",
    "progressFillStyle",
    "progressFillColors",
    "progressFillGradientAngle",
    "noIconBackground",
    "linkUrl",
  ] as (keyof DiagramNodeData)[]);
  if (source.metaData !== undefined) {
    out.metaData = structuredClone(source.metaData);
  }
  if (isChartNodeType(target.type) && source.chart && target.chart) {
    out.chart = mergeChartProperties(target.chart, source.chart);
  }
  return out;
}

/**
 * Apply a single aspect from `source` (clipboard template) onto `target`, preserving id and canvas geometry.
 */
export function applyPasteSpecialAspect(
  source: DiagramNodeData,
  target: DiagramNodeData,
  aspect: PasteSpecialAspect,
): DiagramNodeData {
  if (!pasteSpecialFamiliesCompatible(source.type, target.type)) {
    return target;
  }
  switch (aspect) {
    case "size":
      return applySizeAspect(source, target);
    case "colour":
      return applyColourAspect(source, target);
    case "text":
      return applyTextAspect(source, target);
    case "description":
      return applyDescriptionAspect(source, target);
    case "properties":
      return applyPropertiesAspect(source, target);
    default:
      return target;
  }
}
