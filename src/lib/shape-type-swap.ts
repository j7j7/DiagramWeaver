import { isChartNodeType } from "@/lib/chart-node";
import type { DiagramCompositeBodyShapeKind, DiagramNodeData } from "@/lib/types";
import { DIAGRAM_COMPOSITE_BODY_SHAPE_KINDS } from "@/lib/types";
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

  const next: DiagramNodeData = { ...node, type: buildNodeTypeForObjectKind(node.type, newKind) };

  // Connector `lineType` / spine fields must not remain on closed shapes.
  delete (next as DiagramNodeData & { lineType?: unknown }).lineType;

  stripConnectorAndTimelineFields(next);
  stripMindmapFields(next);
  stripChartAndUml(next);
  stripProgressHeading(next);
  clearIconResourceFields(next);

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
