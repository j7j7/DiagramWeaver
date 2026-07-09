import { snapDimensionToGrid } from "@/components/editor/canvas-constants";
import { isChartNodeType } from "@/lib/chart-node";
import type { DiagramCompositeBodyShapeKind, DiagramNodeData, TimelineBarSectionData } from "@/lib/types";
import { DIAGRAM_COMPOSITE_BODY_SHAPE_KINDS } from "@/lib/types";
import { defaultPalettePyramidNodeProps } from "@/lib/pyramid";
import { defaultPaletteTimelineBarNodeProps } from "@/lib/timeline-bar";
import { defaultPaletteSegmentedRectangleNodeProps } from "@/lib/segmented-rectangle";
import { isMindmapNodeType, isTimelineNodeType } from "@/lib/utils";

export type CompositeBodyShapeKind = DiagramCompositeBodyShapeKind;

export { DIAGRAM_COMPOSITE_BODY_SHAPE_KINDS as COMPOSITE_BODY_SHAPE_KINDS };

const COMPOSITE_BODY_SHAPE_KIND_SET = new Set<string>(DIAGRAM_COMPOSITE_BODY_SHAPE_KINDS);

export function isCompositeBodyShapeKind(s: string | undefined): s is CompositeBodyShapeKind {
  return typeof s === "string" && COMPOSITE_BODY_SHAPE_KIND_SET.has(s);
}

export function normalizeCompositeBodyShapeKind(v: unknown): CompositeBodyShapeKind {
  return isCompositeBodyShapeKind(v as string) ? (v as CompositeBodyShapeKind) : "rounded-rectangle";
}

/** Palette `generic.object.*` shapes that share closed bounding-box connection semantics.
 * Excludes line, timeline, mind-map-node, and charts (`generic.chart.*`).
 */
export const SWAPPABLE_OBJECT_SHAPE_OPTIONS = [
  { kind: "rounded-rectangle", label: "Rounded rectangle" },
  { kind: "rectangle", label: "Rectangle" },
  { kind: "square", label: "Square" },
  { kind: "circle", label: "Circle" },
  { kind: "point", label: "Point" },
  { kind: "triangle", label: "Triangle" },
  { kind: "hexagon", label: "Hexagon" },
  { kind: "pentagon", label: "Pentagon" },
  { kind: "octagon", label: "Octagon" },
  { kind: "star", label: "Star" },
  { kind: "cloud", label: "Cloud" },
  { kind: "parallelogram", label: "Parallelogram" },
  { kind: "trapezoid", label: "Trapezoid" },
  { kind: "kite", label: "Kite" },
  { kind: "jigsaw", label: "Jigsaw" },
  { kind: "arrowhead", label: "Arrowhead" },
  { kind: "chevron", label: "Chevron" },
  { kind: "progress-bar", label: "Progress bar" },
  { kind: "timeline-bar", label: "Timeline bar" },
  { kind: "segmented-rectangle", label: "Segmented rectangle" },
  { kind: "pyramid", label: "Pyramid" },
  { kind: "text-box-heading", label: "Text box heading" },
  { kind: "uml-class", label: "UML class" },
] as const;

const SWAPPABLE_KIND_SET = new Set<string>(
  SWAPPABLE_OBJECT_SHAPE_OPTIONS.map((o) => o.kind),
);

export type SwappableObjectKind = (typeof SWAPPABLE_OBJECT_SHAPE_OPTIONS)[number]["kind"];

/** Labels aligned with {@link SWAPPABLE_OBJECT_SHAPE_OPTIONS} for timeline / mind-map card hull submenu. */
export const COMPOSITE_BODY_SHAPE_MENU_OPTIONS: { kind: CompositeBodyShapeKind; label: string }[] =
  SWAPPABLE_OBJECT_SHAPE_OPTIONS.filter((o) => COMPOSITE_BODY_SHAPE_KIND_SET.has(o.kind)).map((o) => ({
    kind: o.kind as CompositeBodyShapeKind,
    label: o.label,
  }));

const OBJECT_TYPE_RE = /^(.+\.object\.)([^.]+)$/;

/** Last segment after `.object.` (e.g. `rounded-rectangle`), or null. */
export function objectKindSuffixFromNodeType(type: string | undefined): string | null {
  if (!type || isChartNodeType(type)) return null;
  const m = type.match(OBJECT_TYPE_RE);
  return m ? m[2] : null;
}

export function isSwappableClosedObjectNodeType(type: string | undefined): boolean {
  const k = objectKindSuffixFromNodeType(type);
  return !!(k && SWAPPABLE_KIND_SET.has(k));
}

/** Preserve `provider.object.` prefix when present; otherwise `generic.object.{kind}`. */
export function buildNodeTypeForObjectKind(currentType: string, newKind: string): string {
  const m = currentType.match(OBJECT_TYPE_RE);
  if (m) return `${m[1]}${newKind}`;
  return `generic.object.${newKind}`;
}

/** Mirrors palette `addNode` width/height for closed shapes in `canvas-operations`. */
function defaultDimensionsForSwappableKind(kind: SwappableObjectKind): { width: number; height: number } {
  let wRaw: number;
  let hRaw: number;
  switch (kind) {
    case "point":
      wRaw = 20;
      hRaw = 20;
      break;
    case "rectangle":
    case "rounded-rectangle":
      wRaw = 80;
      hRaw = 50;
      break;
    case "uml-class":
      wRaw = 120;
      hRaw = 80;
      break;
    case "progress-bar":
      wRaw = 80;
      hRaw = 50;
      break;
    case "timeline-bar":
      wRaw = 790;
      hRaw = 150;
      break;
    case "segmented-rectangle":
      wRaw = 780;
      hRaw = 210;
      break;
    case "pyramid":
      wRaw = 120;
      hRaw = 140;
      break;
    case "text-box-heading":
      wRaw = 180;
      hRaw = 90;
      break;
    case "cloud":
      wRaw = 80;
      hRaw = 50;
      break;
    default:
      wRaw = 60;
      hRaw = 60;
      break;
  }
  return {
    width: snapDimensionToGrid(wRaw),
    height: snapDimensionToGrid(hRaw),
  };
}

/** Pyramid ignores `spanStart`/`spanEnd`/`tickLabel`; omit when copying from a timeline bar. */
function timelineBarSectionsToPyramidSections(sections: TimelineBarSectionData[]): TimelineBarSectionData[] {
  return sections.map(({ spanStart: _ss, spanEnd: _se, tickLabel: _tk, ...rest }) => ({ ...rest }));
}

function stripConnectorAndTimelineFields(n: DiagramNodeData): void {
  delete n.startPos;
  delete n.endPos;
  delete n.startCap;
  delete n.endCap;
  delete n.lineThickness;
  delete n.linePathStyle;
  delete n.lineControlPoints;
  delete n.lineSmoothJoints;
  delete n.lineTextPosition;
  delete n.lineTextVerticalPosition;
  delete n.lineTextHorizontal;
  delete n.lineColorStyle;
  delete n.lineColors;
  delete n.lineGradientAngle;
  delete n.timelineEntries;
  delete n.timelineDistribution;
  delete n.timelineCardSide;
  delete n.timelineSections;
  delete n.timelineCardW;
  delete n.timelineCardH;
  delete n.timelineCornerRadius;
  delete n.timelineOffsetPx;
  delete n.timelineCardFillMode;
  delete n.timelineHueStepDeg;
  delete n.timelineConnectorWidth;
  delete n.timelineDotRadius;
  delete (n as DiagramNodeData & { compositeBodyShape?: unknown }).compositeBodyShape;
}

function stripMindmapFields(n: DiagramNodeData): void {
  delete n.mindmapRootId;
  delete n.mindmapParentId;
  delete n.mindmapChildIds;
  delete n.mindmapAngleDeg;
  delete n.mindmapRadiusPx;
  delete n.mindmapStartAngleDeg;
  delete n.mindmapFillMode;
  delete n.mindmapHueStepDeg;
  delete n.mindmapHueLocked;
  delete n.mindmapTreeDepth;
  delete n.mindmapSiblingHueIndex;
  delete n.mindmapHueAnchor;
  delete (n as DiagramNodeData & { compositeBodyShape?: unknown }).compositeBodyShape;
}

function stripChartAndUml(n: DiagramNodeData): void {
  delete n.chart;
  delete n.umlClass;
  delete n.umlClassStyle;
}

function stripTimelineBarFields(n: DiagramNodeData): void {
  delete (n as DiagramNodeData & { timelineBarSections?: unknown }).timelineBarSections;
  delete (n as DiagramNodeData & { timelineBarSizing?: unknown }).timelineBarSizing;
  delete (n as DiagramNodeData & { timelineBarShowTicks?: unknown }).timelineBarShowTicks;
  delete (n as DiagramNodeData & { timelineBarTickMarkers?: unknown }).timelineBarTickMarkers;
  delete (n as DiagramNodeData & { timelineBarSectionBorder?: unknown }).timelineBarSectionBorder;
  delete (n as DiagramNodeData & { timelineBarSectionBorderWidth?: unknown }).timelineBarSectionBorderWidth;
  delete (n as DiagramNodeData & { timelineBarSectionBorderColor?: unknown }).timelineBarSectionBorderColor;
  delete (n as DiagramNodeData & { timelineBarAxisLabels?: unknown }).timelineBarAxisLabels;
  delete (n as DiagramNodeData & { timelineBarLabelsFollowFirstSection?: unknown }).timelineBarLabelsFollowFirstSection;
  delete (n as DiagramNodeData & { timelineBarHueStepDeg?: unknown }).timelineBarHueStepDeg;
}

function stripSegmentedRectangleFields(n: DiagramNodeData): void {
  delete (n as DiagramNodeData & { segmentedRectangleSections?: unknown }).segmentedRectangleSections;
  delete (n as DiagramNodeData & { segmentedRectangleSizing?: unknown }).segmentedRectangleSizing;
  delete (n as DiagramNodeData & { segmentedRectanglePlacementOrder?: unknown }).segmentedRectanglePlacementOrder;
  delete (n as DiagramNodeData & { segmentedRectangleSegmentGap?: unknown }).segmentedRectangleSegmentGap;
  delete (n as DiagramNodeData & { segmentedRectangleOutlineMode?: unknown }).segmentedRectangleOutlineMode;
  delete (n as DiagramNodeData & { segmentedRectangleDividers?: unknown }).segmentedRectangleDividers;
  delete (n as DiagramNodeData & { segmentedRectangleDividerWidth?: unknown }).segmentedRectangleDividerWidth;
  delete (n as DiagramNodeData & { segmentedRectangleDividerColor?: unknown }).segmentedRectangleDividerColor;
  delete (n as DiagramNodeData & { segmentedRectangleDividerInset?: unknown }).segmentedRectangleDividerInset;
  delete (n as DiagramNodeData & { segmentedRectangleHueStepDeg?: unknown }).segmentedRectangleHueStepDeg;
  delete (n as DiagramNodeData & { segmentedRectangleLabelsFollowFirstSection?: unknown })
    .segmentedRectangleLabelsFollowFirstSection;
}

function stripPyramidFields(n: DiagramNodeData): void {
  delete (n as DiagramNodeData & { pyramidSections?: unknown }).pyramidSections;
  delete (n as DiagramNodeData & { pyramidSizing?: unknown }).pyramidSizing;
  delete (n as DiagramNodeData & { pyramidSegmentGap?: unknown }).pyramidSegmentGap;
  delete (n as DiagramNodeData & { pyramidDirection?: unknown }).pyramidDirection;
  delete (n as DiagramNodeData & { pyramidApexWidthRatio?: unknown }).pyramidApexWidthRatio;
  delete (n as DiagramNodeData & { pyramidSectionBorder?: unknown }).pyramidSectionBorder;
  delete (n as DiagramNodeData & { pyramidSectionBorderWidth?: unknown }).pyramidSectionBorderWidth;
  delete (n as DiagramNodeData & { pyramidSectionBorderColor?: unknown }).pyramidSectionBorderColor;
  delete (n as DiagramNodeData & { pyramidHueStepDeg?: unknown }).pyramidHueStepDeg;
  delete (n as DiagramNodeData & { pyramidLabelsFollowFirstSection?: unknown }).pyramidLabelsFollowFirstSection;
}

function stripProgressHeading(n: DiagramNodeData): void {
  delete n.progressPercent;
  delete n.progressShowPercent;
  delete n.progressTrackStyle;
  delete n.progressTrackColors;
  delete n.progressTrackGradientAngle;
  delete n.progressFillStyle;
  delete n.progressFillColors;
  delete n.progressFillGradientAngle;

  delete n.headingEdge;
  delete n.headingLabel;
  delete n.richHeadingLabel;
  delete n.headingBackgroundColor;
  delete n.headingBackgroundStyle;
  delete n.headingTextColor;
}

function clearIconResourceFields(n: DiagramNodeData): void {
  delete n.provider;
  delete n.category;
  delete n.file;
  delete n.iconType;
  delete n.iconName;
  delete n.emoji;
  delete n.iconColor;
  delete (n as DiagramNodeData & { iconColorEnabled?: unknown }).iconColorEnabled;
  delete (n as DiagramNodeData & { iconGreyscale?: unknown }).iconGreyscale;
  delete (n as DiagramNodeData & { iconOpacity?: unknown }).iconOpacity;
  delete (n as DiagramNodeData & { iconBevel?: unknown }).iconBevel;
  delete (n as DiagramNodeData & { iconBevelRotation?: unknown }).iconBevelRotation;
  delete (n as DiagramNodeData & { iconBevelDepth?: unknown }).iconBevelDepth;
  delete (n as DiagramNodeData & { iconBevelBlockColor?: unknown }).iconBevelBlockColor;
  delete (n as DiagramNodeData & { iconBevelMatchIconBackground?: unknown }).iconBevelMatchIconBackground;
  delete (n as DiagramNodeData & { iconBevelGridOffset?: unknown }).iconBevelGridOffset;
  delete n.imageUrl;
  delete n.imageOptions;
  delete n.noIconBackground;
}

/**
 * Same node id/position/connections; new `type` and payload suitable for the target kind.
 */
export function swapDiagramNodeObjectKind(node: DiagramNodeData, newKind: SwappableObjectKind): DiagramNodeData {
  if (!SWAPPABLE_KIND_SET.has(newKind)) return node;

  if (isTimelineNodeType(node.type) || isMindmapNodeType(node.type)) {
    if (!isCompositeBodyShapeKind(newKind)) return node;
    return { ...node, compositeBodyShape: newKind };
  }

  const prevKindSuffix = objectKindSuffixFromNodeType(node.type);
  const capturedTimelineSections = Array.isArray(node.timelineBarSections)
    ? node.timelineBarSections.map((s) => ({ ...s }))
    : undefined;
  const capturedPyramidSections = Array.isArray(node.pyramidSections)
    ? node.pyramidSections.map((s) => ({ ...s }))
    : undefined;
  const capturedSegmentedSections = Array.isArray(
    (node as DiagramNodeData & { segmentedRectangleSections?: TimelineBarSectionData[] }).segmentedRectangleSections,
  )
    ? (node as DiagramNodeData & { segmentedRectangleSections: TimelineBarSectionData[] }).segmentedRectangleSections.map(
        (s) => ({ ...s }),
      )
    : undefined;

  const next: DiagramNodeData = { ...node, type: buildNodeTypeForObjectKind(node.type, newKind) };

  // Connector `lineType` / spine fields must not remain on closed shapes.
  delete (next as DiagramNodeData & { lineType?: unknown }).lineType;

  stripConnectorAndTimelineFields(next);
  stripMindmapFields(next);
  stripChartAndUml(next);
  stripProgressHeading(next);
  stripTimelineBarFields(next);
  stripSegmentedRectangleFields(next);
  stripPyramidFields(next);
  clearIconResourceFields(next);

  if (newKind === "timeline-bar") {
    Object.assign(next, defaultPaletteTimelineBarNodeProps(next.id));
    if (prevKindSuffix === "pyramid" && capturedPyramidSections?.length) {
      next.timelineBarSections = capturedPyramidSections.map((s) => ({ ...s }));
      if (node.pyramidSizing === "equal" || node.pyramidSizing === "weighted") {
        next.timelineBarSizing = node.pyramidSizing;
      }
      if (typeof node.timelineBarHueStepDeg === "number") next.timelineBarHueStepDeg = node.timelineBarHueStepDeg;
      else if (typeof node.pyramidHueStepDeg === "number") next.timelineBarHueStepDeg = node.pyramidHueStepDeg;
      if (typeof node.pyramidLabelsFollowFirstSection === "boolean") {
        next.timelineBarLabelsFollowFirstSection = node.pyramidLabelsFollowFirstSection;
      }
      if (typeof node.pyramidSectionBorder === "boolean") next.timelineBarSectionBorder = node.pyramidSectionBorder;
      if (typeof node.pyramidSectionBorderWidth === "number") next.timelineBarSectionBorderWidth = node.pyramidSectionBorderWidth;
      if (node.pyramidSectionBorderColor != null) next.timelineBarSectionBorderColor = node.pyramidSectionBorderColor;
    }
    if (prevKindSuffix === "segmented-rectangle" && capturedSegmentedSections?.length) {
      next.timelineBarSections = capturedSegmentedSections.map((s) => ({ ...s }));
      if (node.segmentedRectangleSizing === "equal" || node.segmentedRectangleSizing === "weighted") {
        next.timelineBarSizing = node.segmentedRectangleSizing;
      }
      if (typeof node.segmentedRectangleHueStepDeg === "number") {
        next.timelineBarHueStepDeg = node.segmentedRectangleHueStepDeg;
      }
      if (typeof node.segmentedRectangleLabelsFollowFirstSection === "boolean") {
        next.timelineBarLabelsFollowFirstSection = node.segmentedRectangleLabelsFollowFirstSection;
      }
    }
  }

  if (newKind === "segmented-rectangle") {
    Object.assign(next, defaultPaletteSegmentedRectangleNodeProps(next.id));
    if (prevKindSuffix === "timeline-bar" && capturedTimelineSections?.length) {
      next.segmentedRectangleSections = capturedTimelineSections.map((s) => ({ ...s }));
      if (node.timelineBarSizing === "equal" || node.timelineBarSizing === "weighted") {
        next.segmentedRectangleSizing = node.timelineBarSizing;
      }
      if (typeof node.timelineBarHueStepDeg === "number") {
        next.segmentedRectangleHueStepDeg = node.timelineBarHueStepDeg;
      }
      if (typeof node.timelineBarLabelsFollowFirstSection === "boolean") {
        next.segmentedRectangleLabelsFollowFirstSection = node.timelineBarLabelsFollowFirstSection;
      }
    }
    if (prevKindSuffix === "pyramid" && capturedPyramidSections?.length) {
      next.segmentedRectangleSections = timelineBarSectionsToPyramidSections(capturedPyramidSections).map((s) => ({
        ...s,
      }));
      if (node.pyramidSizing === "equal" || node.pyramidSizing === "weighted") {
        next.segmentedRectangleSizing = node.pyramidSizing;
      }
      if (typeof node.pyramidHueStepDeg === "number") next.segmentedRectangleHueStepDeg = node.pyramidHueStepDeg;
      if (typeof node.pyramidLabelsFollowFirstSection === "boolean") {
        next.segmentedRectangleLabelsFollowFirstSection = node.pyramidLabelsFollowFirstSection;
      }
    }
  }

  if (newKind === "pyramid") {
    Object.assign(next, defaultPalettePyramidNodeProps(next.id));
    if (prevKindSuffix === "timeline-bar" && capturedTimelineSections?.length) {
      next.pyramidSections = timelineBarSectionsToPyramidSections(capturedTimelineSections);
      if (node.timelineBarSizing === "equal" || node.timelineBarSizing === "weighted") {
        next.pyramidSizing = node.timelineBarSizing;
      }
      if (typeof node.timelineBarHueStepDeg === "number") next.pyramidHueStepDeg = node.timelineBarHueStepDeg;
      if (typeof node.timelineBarLabelsFollowFirstSection === "boolean") {
        next.pyramidLabelsFollowFirstSection = node.timelineBarLabelsFollowFirstSection;
      }
      if (typeof node.timelineBarSectionBorder === "boolean") next.pyramidSectionBorder = node.timelineBarSectionBorder;
      if (typeof node.timelineBarSectionBorderWidth === "number") {
        next.pyramidSectionBorderWidth = node.timelineBarSectionBorderWidth;
      }
      if (node.timelineBarSectionBorderColor != null) {
        next.pyramidSectionBorderColor = node.timelineBarSectionBorderColor;
      }
    }
    if (prevKindSuffix === "segmented-rectangle" && capturedSegmentedSections?.length) {
      next.pyramidSections = timelineBarSectionsToPyramidSections(capturedSegmentedSections);
      if (node.segmentedRectangleSizing === "equal" || node.segmentedRectangleSizing === "weighted") {
        next.pyramidSizing = node.segmentedRectangleSizing;
      }
      if (typeof node.segmentedRectangleHueStepDeg === "number") {
        next.pyramidHueStepDeg = node.segmentedRectangleHueStepDeg;
      }
      if (typeof node.segmentedRectangleLabelsFollowFirstSection === "boolean") {
        next.pyramidLabelsFollowFirstSection = node.segmentedRectangleLabelsFollowFirstSection;
      }
    }
  }

  if (newKind !== "uml-class") {
    const umlName = node.umlClass?.name?.trim();
    if (umlName && !(next.label ?? "").trim()) {
      next.label = umlName;
    }
  }

  if (newKind === "progress-bar") {
    next.progressPercent = typeof node.progressPercent === "number" ? node.progressPercent : 50;
    next.progressShowPercent = node.progressShowPercent !== false;
    next.progressFillStyle = node.progressFillStyle ?? "solid";
  }

  if (newKind === "text-box-heading") {
    next.headingEdge = node.headingEdge ?? "top";
    if (node.headingLabel != null) next.headingLabel = node.headingLabel;
    if (node.richHeadingLabel != null) next.richHeadingLabel = node.richHeadingLabel;
    if (node.headingBackgroundColor != null) next.headingBackgroundColor = node.headingBackgroundColor;
    if (node.headingBackgroundStyle != null) next.headingBackgroundStyle = node.headingBackgroundStyle;
    if (node.headingTextColor != null) next.headingTextColor = node.headingTextColor;
  }

  if (newKind === "uml-class") {
    const name = node.umlClass?.name?.trim() || node.label?.trim() || "Class";
    next.umlClass = node.umlClass
      ? { ...node.umlClass, name: node.umlClass.name?.trim() || name }
      : { name, attributes: [], methods: [] };
    if (node.umlClassStyle) next.umlClassStyle = { ...node.umlClassStyle };
  }

  const oldIsPoint = prevKindSuffix === "point";
  const newIsPoint = newKind === "point";
  if (
    prevKindSuffix &&
    SWAPPABLE_KIND_SET.has(prevKindSuffix) &&
    oldIsPoint !== newIsPoint
  ) {
    const dims = defaultDimensionsForSwappableKind(newKind);
    next.width = dims.width;
    next.height = dims.height;
    next.sizeMode = "custom";
  }

  return next;
}

export function shapeSwapMenuOptions(
  currentType: string | undefined,
  compositeBodyShape?: string | undefined,
): { kind: SwappableObjectKind; label: string }[] {
  if (isTimelineNodeType(currentType) || isMindmapNodeType(currentType)) {
    const current = normalizeCompositeBodyShapeKind(compositeBodyShape);
    return COMPOSITE_BODY_SHAPE_MENU_OPTIONS.filter((o) => o.kind !== current).map((o) => ({
      kind: o.kind as SwappableObjectKind,
      label: o.label,
    }));
  }
  const k = objectKindSuffixFromNodeType(currentType);
  if (!k || !SWAPPABLE_KIND_SET.has(k)) return [];
  return SWAPPABLE_OBJECT_SHAPE_OPTIONS.filter((o) => o.kind !== k).map((o) => ({
    kind: o.kind as SwappableObjectKind,
    label: o.label,
  }));
}
