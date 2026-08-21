import type {
  DiagramNodeData,
  NodeChartSpec,
  NodeChartSpecBar,
  NodeChartSpecLine,
  NodeChartSpecPie,
  NodeChartSpecRing,
} from "@/lib/types";
import { isChartNodeType } from "@/lib/chart-node";
import type { CardElementData, CardElementStyle } from "@/lib/card-types";
import {
  findCardElement,
  getCardTemplateIdFromNodeType,
  isCardNodeType,
  updateCardElementTree,
} from "@/lib/card-utils";
import {
  applyCardBackgroundVisual,
  cardBackgroundVisualFromElements,
} from "@/lib/card-theme";
import {
  applyFramedHeadingAlign,
  applyFramedHeadingEdge,
  applyFramedHeadingTabWidthPct,
  applyFramedHeadingTextAlign,
  FRAMED_HEADING_TEMPLATE_ID,
  getFramedHeadingAlign,
  getFramedHeadingEdge,
  getFramedHeadingRegions,
  getFramedHeadingTextAlign,
  parseFramedHeadingTabWidthPct,
} from "@/lib/card-framed-heading";
import {
  applyIconBorderNodeSize,
  applyIconBorderTextAlign,
  getIconBorderRegions,
  getIconBorderTextAlign,
  ICON_BORDER_ICON_ID,
  ICON_BORDER_TEMPLATE_ID,
  parseIconBorderNodeSize,
} from "@/lib/card-icon-border";
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
  | { kind: "chart"; chartKind: "pie" | "bar" | "line" | "ring" | "grid" | "gantt" | "loop" | "arrow" }
  | { kind: "card"; templateId: string }
  | { kind: "connectorLine" }
  | { kind: "timeline" }
  | { kind: "mindmap" }
  | { kind: "uml" }
  | { kind: "closedShape" }
  | { kind: "icon" }
  | { kind: "resourceLabel" };

function chartKindFromType(type: string): "pie" | "bar" | "line" | "ring" | "grid" | "gantt" | "loop" | "arrow" | null {
  if (type === "generic.chart.pie" || type.endsWith(".chart.pie")) return "pie";
  if (type === "generic.chart.bar" || type.endsWith(".chart.bar")) return "bar";
  if (type === "generic.chart.line" || type.endsWith(".chart.line")) return "line";
  if (type === "generic.chart.ring" || type.endsWith(".chart.ring")) return "ring";
  if (type === "generic.chart.grid" || type.endsWith(".chart.grid")) return "grid";
  if (type === "generic.chart.gantt" || type.endsWith(".chart.gantt")) return "gantt";
  if (type === "generic.chart.loop" || type.endsWith(".chart.loop")) return "loop";
  if (type === "generic.chart.arrow" || type.endsWith(".chart.arrow")) return "arrow";
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
  if (isCardNodeType(type)) {
    const templateId = getCardTemplateIdFromNodeType(type);
    return templateId ? { kind: "card", templateId } : null;
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
  if (a.kind === "card" && b.kind === "card") return a.templateId === b.templateId;
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
  if (t.kind === "arrow" && source.kind === "arrow") {
    if (source.segmentFill !== undefined) t.segmentFill = source.segmentFill;
    if (source.segmentFillStart !== undefined) t.segmentFillStart = source.segmentFillStart;
    if (source.segmentFillStyle !== undefined) t.segmentFillStyle = source.segmentFillStyle;
    if (source.segmentTextColor !== undefined) t.segmentTextColor = source.segmentTextColor;
    if (source.segmentBorder !== undefined) t.segmentBorder = source.segmentBorder;
    if (source.segmentBorderWidth !== undefined) t.segmentBorderWidth = source.segmentBorderWidth;
    if (source.colorMode !== undefined) t.colorMode = source.colorMode;
    if (source.hueStepDeg !== undefined) t.hueStepDeg = source.hueStepDeg;
    const n = Math.min(t.items.length, source.items.length);
    for (let i = 0; i < n; i++) {
      const src = source.items[i];
      const row = t.items[i];
      if (src.fill !== undefined) row.fill = src.fill;
      if (src.textColor !== undefined) row.textColor = src.textColor;
    }
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
  if (t.kind === "loop" && source.kind === "loop") {
    if (source.showInwardArrows !== undefined) t.showInwardArrows = source.showInwardArrows;
    if (source.rotateItems !== undefined) t.rotateItems = source.rotateItems;
    if (source.itemColorMode !== undefined) t.itemColorMode = source.itemColorMode;
    if (source.itemHueStepDeg !== undefined) t.itemHueStepDeg = source.itemHueStepDeg;
    if (source.arrowColorMode !== undefined) t.arrowColorMode = source.arrowColorMode;
    if (source.arrowWidth !== undefined) t.arrowWidth = source.arrowWidth;
    return t;
  }
  if (t.kind === "arrow" && source.kind === "arrow") {
    if (source.arrowStyle !== undefined) t.arrowStyle = source.arrowStyle;
    if (source.direction !== undefined) t.direction = source.direction;
    if (source.colorMode !== undefined) t.colorMode = source.colorMode;
    if (source.segmentFillStyle !== undefined) t.segmentFillStyle = source.segmentFillStyle;
    if (source.hueStepDeg !== undefined) t.hueStepDeg = source.hueStepDeg;
    if (source.innerRatio !== undefined) t.innerRatio = source.innerRatio;
    if (source.gapDeg !== undefined) t.gapDeg = source.gapDeg;
    if (source.segmentBorderWidth !== undefined) t.segmentBorderWidth = source.segmentBorderWidth;
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
    "ringHoleRatio",
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

function cloneCardElementStyle(style: CardElementStyle | undefined): CardElementStyle | undefined {
  if (!style) return undefined;
  return {
    ...style,
    backgroundColors: style.backgroundColors
      ? ([...style.backgroundColors] as [string, string])
      : undefined,
    meshGradientPoints: style.meshGradientPoints
      ? style.meshGradientPoints.map((p) => ({ ...p }))
      : undefined,
  };
}

function walkCardElements(root: CardElementData, visit: (el: CardElementData) => void): void {
  visit(root);
  for (const child of root.children ?? []) walkCardElements(child, visit);
}

const CARD_ELEMENT_TEXT_COLOUR_KEYS = [
  "textColor",
  "textOutlineColor",
  "textGlowColor",
  "textShadowColor",
] as const satisfies readonly (keyof CardElementData)[];

/**
 * Paste special Colour for cards: shell border/fill already applied by caller;
 * also copy background-region + per-element fills/borders (e.g. framed-heading tab)
 * and text/icon colour fields onto matching element ids.
 */
function applyCardColourAspect(source: DiagramNodeData, target: DiagramNodeData): DiagramNodeData {
  const srcEls = source.card?.elements;
  const tgtEls = target.card?.elements;
  if (!srcEls || !tgtEls || !isCardNodeType(source.type) || !isCardNodeType(target.type)) {
    return target;
  }
  const srcTemplate =
    source.card?.templateId ?? getCardTemplateIdFromNodeType(source.type) ?? undefined;
  const tgtTemplate =
    target.card?.templateId ?? getCardTemplateIdFromNodeType(target.type) ?? undefined;

  let elements = tgtEls;
  const bgVisual = cardBackgroundVisualFromElements(srcEls, srcTemplate);
  elements = applyCardBackgroundVisual(elements, tgtTemplate, bgVisual);

  walkCardElements(srcEls, (srcEl) => {
    if (!findCardElement(elements, srcEl.id)) return;

    const styleClone = cloneCardElementStyle(srcEl.style);
    if (styleClone) {
      // Replace (not merge) so missing source keys clear target borders/fills.
      elements = updateCardElementTree(elements, srcEl.id, { style: styleClone });
    }

    const textColourPatch: Partial<CardElementData> = {};
    for (const key of CARD_ELEMENT_TEXT_COLOUR_KEYS) {
      if (srcEl[key] !== undefined) {
        (textColourPatch as Record<string, unknown>)[key] = srcEl[key];
      }
    }
    if (Object.keys(textColourPatch).length > 0) {
      elements = updateCardElementTree(elements, srcEl.id, textColourPatch);
    }

    if (srcEl.iconRef) {
      const tgt = findCardElement(elements, srcEl.id);
      if (tgt?.iconRef) {
        elements = updateCardElementTree(elements, srcEl.id, {
          iconRef: {
            ...tgt.iconRef,
            ...(srcEl.iconRef.iconColor !== undefined
              ? { iconColor: srcEl.iconRef.iconColor }
              : {}),
            ...(srcEl.iconRef.iconColorEnabled !== undefined
              ? { iconColorEnabled: srcEl.iconRef.iconColorEnabled }
              : {}),
            ...(srcEl.iconRef.iconGreyscale !== undefined
              ? { iconGreyscale: srcEl.iconRef.iconGreyscale }
              : {}),
            ...(srcEl.iconRef.iconOpacity !== undefined
              ? { iconOpacity: srcEl.iconRef.iconOpacity }
              : {}),
          },
        });
      }
    }
  });

  return {
    ...target,
    card: {
      ...target.card!,
      elements,
    },
  };
}

/** Paste special Properties: framed-heading tab placement/size/text align; icon-border icon size/text align. */
function applyCardPropertiesAspect(source: DiagramNodeData, target: DiagramNodeData): DiagramNodeData {
  const srcEls = source.card?.elements;
  const tgtEls = target.card?.elements;
  if (!srcEls || !tgtEls) return target;
  const srcTemplate =
    source.card?.templateId ?? getCardTemplateIdFromNodeType(source.type) ?? undefined;
  const tgtTemplate =
    target.card?.templateId ?? getCardTemplateIdFromNodeType(target.type) ?? undefined;
  if (srcTemplate !== tgtTemplate) return target;

  if (srcTemplate === FRAMED_HEADING_TEMPLATE_ID) {
    const { headingTab, heading } = getFramedHeadingRegions(srcEls);
    let elements = tgtEls;
    if (headingTab) {
      elements = applyFramedHeadingEdge(elements, getFramedHeadingEdge(headingTab));
      elements = applyFramedHeadingAlign(elements, getFramedHeadingAlign(headingTab));
      elements = applyFramedHeadingTabWidthPct(elements, parseFramedHeadingTabWidthPct(headingTab));
    }
    if (heading) {
      elements = applyFramedHeadingTextAlign(elements, getFramedHeadingTextAlign(heading));
    }
    return {
      ...target,
      card: {
        ...target.card!,
        elements,
      },
    };
  }

  if (srcTemplate === ICON_BORDER_TEMPLATE_ID) {
    const { icon, title } = getIconBorderRegions(srcEls);
    let elements = tgtEls;
    if (icon) {
      elements = applyIconBorderNodeSize(elements, parseIconBorderNodeSize(icon));
      elements = updateCardElementTree(elements, ICON_BORDER_ICON_ID, {
        matchCardBorder: icon.matchCardBorder,
        iconSlotShadow: icon.iconSlotShadow,
        iconPlacement: icon.iconPlacement,
      });
    }
    if (title) {
      elements = applyIconBorderTextAlign(elements, getIconBorderTextAlign(title));
    }
    return {
      ...target,
      card: {
        ...target.card!,
        elements,
      },
    };
  }

  return target;
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
  if (isCardNodeType(source.type) && isCardNodeType(target.type)) {
    out = applyCardColourAspect(source, out);
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
  if (isCardNodeType(source.type) && isCardNodeType(target.type)) {
    return applyCardPropertiesAspect(source, out);
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
