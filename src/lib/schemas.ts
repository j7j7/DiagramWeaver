import { z } from 'zod';
import { flattenDiagramOnImport } from './flatten-on-import';
import { normalizeHttpImageUrl, sanitizeCustomIconsInDiagram } from './custom-icon-utils';
import { ensureDiagramLayersPersisted } from './layers-utils';
import { DIAGRAM_COMPOSITE_BODY_SHAPE_KINDS, type DiagramCompositeBodyShapeKind } from './types';

// Rich text run schema for textbox nodes
const RichTextRunSchema = z.object({
  text: z.string(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  listType: z.enum(["bullet", "numbered"]).optional(),
  lineJustify: z.enum(["left", "center", "right", "full"]).optional(),
  lineFontSize: z.number().optional(),
  lineFontWeight: z.union([z.string(), z.number()]).optional(),
  lineFontFamily: z.string().optional(),
});

const CustomImageCropSchema = z.object({
  x: z.number().min(-300).max(300),
  y: z.number().min(-300).max(300),
  width: z.number().min(1).max(300),
  height: z.number().min(1).max(300),
});

const CustomImageOrientationSchema = z.object({
  rotate: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
  flipHorizontal: z.boolean(),
  flipVertical: z.boolean(),
});

const CustomImageOptionsSchema = z.object({
  width: z.number().min(16).max(512),
  height: z.number().min(16).max(512),
  scale: z.number().min(10).max(300),
  crop: CustomImageCropSchema,
  orientation: CustomImageOrientationSchema,
});

const HttpImageUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    try {
      const parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }, "imageUrl must use http or https");

const ChartPieSeriesRowSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  value: z.number(),
  color: z.string().optional(),
  labelColor: z.string().optional(),
  fillStyle: z.enum(["none", "solid", "gradient"]).optional(),
  gradientColors: z.tuple([z.string(), z.string()]).optional(),
  labelFontSize: z.number().min(2).max(14).optional(),
  segmentPull: z.number().min(0).max(4).optional(),
});

const ChartBarSeriesRowSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  values: z.array(z.number()),
  color: z.string().optional(),
  labelColor: z.string().optional(),
  fillStyle: z.enum(["none", "solid", "gradient"]).optional(),
  gradientColors: z.tuple([z.string(), z.string()]).optional(),
  labelFontSize: z.number().min(2).max(14).optional(),
});

const NodeChartPieSchema = z.object({
  kind: z.literal("pie"),
  series: z.array(ChartPieSeriesRowSchema),
  sliceBorderColor: z.string().optional(),
  shadow: z.boolean().optional(),
  segmentGapDeg: z.number().min(0).max(3).optional(),
  showSegmentLabels: z.boolean().optional(),
  valuesLocked: z.boolean().optional(),
});

const NodeChartBarSchema = z.object({
  kind: z.literal("bar"),
  series: z.array(ChartBarSeriesRowSchema),
  categoryLabels: z.array(z.string()).optional(),
  stacked100: z.boolean().optional(),
  vertical: z.boolean().optional(),
  categoryGap: z.number().min(0).max(0.85).optional(),
  stackGap: z.number().min(0).max(2).optional(),
  roundedColumnEnds: z.boolean().optional(),
  sliceBorderColor: z.string().optional(),
  shadow: z.boolean().optional(),
  showSegmentLabels: z.boolean().optional(),
  showGridX: z.boolean().optional(),
  showGridY: z.boolean().optional(),
  gridColor: z.string().optional(),
  showValueAxis: z.boolean().optional(),
  axisColor: z.string().optional(),
  showCategoryLabels: z.boolean().optional(),
  showSegmentValues: z.boolean().optional(),
  showLegend: z.boolean().optional(),
  categoryLabelFontSize: z.number().min(2).max(14).optional(),
  legendLabelFontSize: z.number().min(2).max(14).optional(),
  valuesLocked: z.boolean().optional(),
});

const NodeChartLineSchema = z.object({
  kind: z.literal("line"),
  series: z.array(ChartBarSeriesRowSchema),
  categoryLabels: z.array(z.string()).optional(),
  showAreaFill: z.boolean().optional(),
  areaFillOpacity: z.number().min(0).max(1).optional(),
  smooth: z.boolean().optional(),
  showDots: z.boolean().optional(),
  dotRadius: z.number().min(0).max(3).optional(),
  lineStrokeWidth: z.number().min(0.25).max(4).optional(),
  sliceBorderColor: z.string().optional(),
  shadow: z.boolean().optional(),
  showGridX: z.boolean().optional(),
  showGridY: z.boolean().optional(),
  gridColor: z.string().optional(),
  showValueAxis: z.boolean().optional(),
  axisColor: z.string().optional(),
  showCategoryLabels: z.boolean().optional(),
  showLegend: z.boolean().optional(),
  categoryLabelFontSize: z.number().min(2).max(14).optional(),
  legendLabelFontSize: z.number().min(2).max(14).optional(),
  valuesLocked: z.boolean().optional(),
});

const NodeChartSpecSchema = z.discriminatedUnion("kind", [
  NodeChartPieSchema,
  NodeChartBarSchema,
  NodeChartLineSchema,
]);

function normalizeChartField(chart: unknown): unknown {
  if (chart == null || typeof chart !== "object") return chart;
  const c = chart as Record<string, unknown>;
  if (c.kind === "bar") {
    const next = { ...c } as Record<string, unknown>;
    const legacyR = next.columnCornerRadius;
    if (typeof legacyR === "number" && Number.isFinite(legacyR) && legacyR > 0) {
      next.roundedColumnEnds = true;
    }
    delete next.columnCornerRadius;
    return next;
  }
  if (c.kind === "line") return chart;
  if (c.kind === "pie") return chart;
  const series = c.series;
  if (
    Array.isArray(series) &&
    series[0] != null &&
    typeof series[0] === "object" &&
    series[0] !== null &&
    "values" in (series[0] as object)
  ) {
    return { ...c, kind: "bar" };
  }
  return { ...c, kind: "pie" };
}

// Timeline entry (`generic.object.timeline` cards)
export const TimelineEntryDataSchema = z.object({
  id: z.string(),
  t: z.number().optional(),
  label: z.string().optional(),
  richLabel: z.array(RichTextRunSchema).optional(),
  backgroundStyle: z.enum(['solid', 'gradient', 'frosted', 'none']).optional(),
  backgroundColor: z.string().optional(),
  backgroundColors: z.array(z.string()).optional(),
  gradientAngle: z.number().optional(),
  frostedDiffusion: z.number().min(0).max(1).optional(),
  frostedTransparency: z.number().min(0).max(1).optional(),
  frostedPerlinNoise: z.number().min(0).max(10).optional(),
  borderStyle: z.enum(['solid', 'dotted', 'gradient', 'none']).optional(),
  borderColor: z.string().optional(),
  borderColors: z.array(z.string()).optional(),
  borderGradientAngle: z.number().optional(),
  shadow: z.boolean().optional(),
  textColor: z.string().optional(),
  cornerRadius: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  cardNormalOffsetPx: z.number().optional(),
  cardSide: z.enum(['above', 'below']).optional(),
});

const DiagramCompositeBodyShapeTuple = DIAGRAM_COMPOSITE_BODY_SHAPE_KINDS as unknown as [
  DiagramCompositeBodyShapeKind,
  ...DiagramCompositeBodyShapeKind[],
];
const DiagramCompositeBodyShapeSchema = z.enum(DiagramCompositeBodyShapeTuple);

// Schema for DiagramNodeData based on actual types
export const DiagramNodeDataSchema = z.object({
  id: z.string(),
  type: z.string(),
  label: z.string().optional(),
  richLabel: z.array(RichTextRunSchema).optional(),
  tag: z.string().optional(),
  tagPosition: z.enum(['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right']).optional(),
  info: z.string().optional(),
  linkUrl: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  imagePath: z.string().optional(), // Override icon path
  lineColor: z.string().optional(), // Color for connections/borders
  edgePosition: z.enum(['top', 'bottom', 'left', 'right']).optional(), // Position node on edge of parent group
  layer: z.string().optional(), // Layer assignment for this node
  stackWithShapes: z.boolean().optional(), // Z-index ladder with shapes (see types)
  // Label-specific styling properties
  borderColor: z.string().optional(), // Border color for label nodes
  backgroundColor: z.string().optional(), // Background color for label nodes
  textColor: z.string().optional(), // Text color for label nodes
  borderStyle: z.enum(['solid', 'dotted', 'gradient', 'none']).optional(), // Border style for label/textbox/shape nodes
  borderColors: z.array(z.string()).optional(), // Border colors for gradient [startColor, endColor]
  backgroundStyle: z.enum(['solid', 'gradient', 'frosted', 'none']).optional(), // Background style for label/textbox/shape nodes
  backgroundColors: z.array(z.string()).optional(), // Background colors for gradient [startColor, endColor]
  frostedDiffusion: z.number().min(0).max(1).optional(),
  frostedTransparency: z.number().min(0).max(1).optional(),
  frostedPerlinNoise: z.number().min(0).max(10).optional(),
  gradientAngle: z.number().optional(), // Background gradient angle in degrees
  borderGradientAngle: z.number().optional(), // Border gradient angle in degrees
  shadow: z.boolean().optional(), // Whether to show shadow around label/textbox nodes
  highlightAnim: z.boolean().optional(),
  highlightAnimDurationSec: z.number().optional(),
  highlightAnimIntervalSec: z.number().optional(),
  highlightAnimGlowColor: z.string().optional(),
  highlightAnimGlowIntensity: z.number().min(0).max(1).optional(),
  highlightAnimMode: z.enum(['constant', 'pulse']).optional(),
  rotation: z.number().optional(), // Rotation angle in degrees (0, 45, -45, 90, -90)
  textPosition: z.enum(['above', 'center', 'under']).optional(), // Text position for shape nodes
  freeflow: z.boolean().optional(), // If true, node can be placed anywhere without joining groups/zones
  ignoreConnectionAvoidance: z.boolean().optional(), // Orthogonal connectors may cross this shape
  borderWidth: z.number().optional(), // Border thickness for shapes
  cornerRadius: z.number().min(0).max(1).optional(), // Rounded-rectangle / progress-bar: 0=straight, 1=full round
  progressPercent: z.number().min(0).max(100).optional(),
  progressShowPercent: z.boolean().optional(),
  progressTrackStyle: z.enum(['solid', 'gradient']).optional(),
  progressTrackColors: z.array(z.string()).optional(),
  progressTrackGradientAngle: z.number().optional(),
  progressFillStyle: z.enum(['solid', 'gradient']).optional(),
  progressFillColors: z.array(z.string()).optional(),
  progressFillGradientAngle: z.number().optional(),
  headingEdge: z.enum(['top', 'bottom', 'left', 'right']).optional(),
  headingLabel: z.string().optional(),
  richHeadingLabel: z.array(RichTextRunSchema).optional(),
  headingBackgroundColor: z.string().optional(),
  headingBackgroundStyle: z.enum(['gradient', 'solid']).optional(),
  headingTextColor: z.string().optional(),
  // Custom sizing properties for textbox nodes
  width: z.number().optional(), // Custom width - when set, overrides auto-calculated width
  height: z.number().optional(), // Custom height - when set, overrides auto-calculated height
  sizeMode: z.enum(['auto', 'custom']).optional(), // Whether to use auto-calculated or custom dimensions
  noIconBackground: z.boolean().optional(), // If true, removes the white background from icon nodes
  nodeSize: z.enum(['normal', 'half', 'quarter']).optional(), // Size mode for nodes and icons
  labelWidth: z.number().optional(), // Label width for icon nodes - allows label wider than icon
  // Text justification for text resources
  textJustify: z.enum(['left', 'center', 'right', 'full']).optional(), // Text justification for text/textbox nodes
  textVerticalPosition: z.enum(['top', 'middle', 'bottom']).optional(), // Vertical position of text in textbox/shape nodes
  
  // Text styling properties
  fontFamily: z.string().optional(), // Font family (e.g., 'Arial', 'Helvetica', 'Times New Roman')
  fontSize: z.number().optional(), // Font size in pixels
  fontWeight: z.enum(['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900']).optional(), // Font weight
  fontStyle: z.enum(['normal', 'italic', 'oblique']).optional(), // Font style
  textDecoration: z.enum(['none', 'underline', 'overline', 'line-through']).optional(), // Text decoration
  textTransform: z.enum(['none', 'uppercase', 'lowercase', 'capitalize']).optional(), // Text transformation
  letterSpacing: z.number().optional(), // Letter spacing in pixels
  lineHeight: z.number().optional(), // Line height as a multiplier (e.g., 1.2, 1.5)
  textOpacity: z.number().optional(), // Text opacity (0-1)
  textOutlineWidth: z.number().optional(),
  textOutlineColor: z.string().optional(),
  textGlowBlur: z.number().optional(),
  textGlowColor: z.string().optional(),
  textShadowOffsetX: z.number().optional(),
  textShadowOffsetY: z.number().optional(),
  textShadowBlur: z.number().optional(),
  textShadowColor: z.string().optional(),
  textDropShadowEnabled: z.boolean().optional(),
  groupId: z.string().optional(), // Reference to grouping this node belongs to

  // Line shape specific properties (absolute canvas positions)
  startPos: z.object({ x: z.number(), y: z.number() }).optional(), // Absolute canvas position for line start
  endPos: z.object({ x: z.number(), y: z.number() }).optional(), // Absolute canvas position for line end
  startCap: z.enum(['none', 'arrow', 'dot', 'square']).optional(), // Start endpoint style for line shapes
  endCap: z.enum(['none', 'arrow', 'dot', 'square']).optional(), // End endpoint style for line shapes
  lineThickness: z.number().optional(), // Line thickness for line shapes (default: 2.5)
  lineType: z.enum(['solid', 'dashed', 'dotted']).optional(), // Line type/style for line shapes
  linePathStyle: z.enum(['straight', 'curved']).optional(),
  lineControlPoints: z
    .array(z.object({ x: z.number(), y: z.number(), id: z.string().optional() }))
    .optional(),
  lineSmoothJoints: z.boolean().optional(),
  lineTextVerticalPosition: z.enum(['above', 'middle', 'below']).optional(), // Text position relative to line
  lineColorStyle: z.enum(['solid', 'gradient']).optional(),
  lineColors: z.array(z.string()).optional(),
  lineGradientAngle: z.number().optional(),
  
  // Lock property - prevents movement when true
  locked: z.boolean().optional(), // If true, node cannot be moved

  // Standard icons (Lucide/emoji) - from Icons section under Generic
  provider: z.string().optional(),
  category: z.string().optional(),
  file: z.string().optional(),
  iconType: z.enum(['lucide', 'emoji']).optional(),
  iconName: z.string().optional(),
  emoji: z.string().optional(),
  iconColor: z.string().optional(), // Color for Lucide icons (hex)
  imageUrl: HttpImageUrlSchema.optional(),
  imageOptions: CustomImageOptionsSchema.optional(),

  metaData: z.record(z.string(), z.string()).optional(), // Key/value metadata
  subDiagramId: z.string().optional(), // Links this node to a sub-diagram (double-click to navigate)

  chart: z.preprocess(normalizeChartField, NodeChartSpecSchema).optional(),
  umlClass: z.object({
    name: z.string(),
    attributes: z.array(z.string()),
    methods: z.array(z.string()),
  }).optional(),
  umlClassStyle: z.object({
    name: z.object({
      fontFamily: z.string().optional(),
      fontSize: z.number().optional(),
      textJustify: z.string().optional(),
      textColor: z.string().optional(),
    }).optional(),
    attributes: z.object({
      fontFamily: z.string().optional(),
      fontSize: z.number().optional(),
      textJustify: z.string().optional(),
      textColor: z.string().optional(),
    }).optional(),
    methods: z.object({
      fontFamily: z.string().optional(),
      fontSize: z.number().optional(),
      textJustify: z.string().optional(),
      textColor: z.string().optional(),
    }).optional(),
    dividerLineWidth: z.number().optional(),
  }).optional(),
  compositeBodyShape: DiagramCompositeBodyShapeSchema.optional(),
  timelineEntries: z.array(TimelineEntryDataSchema).optional(),
  timelineDistribution: z.enum(['even', 'manual']).optional(),
  timelineCardSide: z.enum(['above', 'below', 'alternate']).optional(),
  timelineSections: z.number().int().min(0).optional(),
  timelineCardW: z.number().optional(),
  timelineCardH: z.number().optional(),
  timelineCornerRadius: z.number().optional(),
  timelineOffsetPx: z.number().optional(),
  timelineCardFillMode: z.enum(['solid', 'theme-hues']).optional(),
  timelineHueStepDeg: z.number().optional(),
  timelineConnectorWidth: z.number().optional(),
  timelineDotRadius: z.number().optional(),
  mindmapRootId: z.string().optional(),
  mindmapParentId: z.string().optional(),
  mindmapChildIds: z.array(z.string()).optional(),
  mindmapAngleDeg: z.number().optional(),
  mindmapRadiusPx: z.number().optional(),
  mindmapStartAngleDeg: z.number().optional(),
  mindmapFillMode: z.enum(["solid", "theme-hues"]).optional(),
  mindmapHueStepDeg: z.number().optional(),
  mindmapHueLocked: z.boolean().optional(),
  mindmapTreeDepth: z.number().int().min(0).optional(),
  mindmapSiblingHueIndex: z.number().int().min(0).optional(),
  mindmapHueAnchor: z.boolean().optional(),
});

// Schema for DiagramConnectionData 
export const DiagramConnectionDataSchema = z.object({
  id: z.string().optional(), // Unique id for multiple connections between same nodes
  from: z.string(),
  to: z.string(),
  color: z.string().optional(), // Line color for this specific connection
  text: z.string().optional(), // Optional text to display on the connection
  textPosition: z.number().optional(), // Text position along the line (0-100%, default 50%)
  fromPreferredExit: z.enum(['top', 'bottom', 'left', 'right', 'center']).optional(), // Preferred exit direction from source node
  fromArrow: z.boolean().optional(), // Enable arrow at source node edge
  toPreferredEntry: z.enum(['top', 'bottom', 'left', 'right', 'center']).optional(), // Preferred entry direction to target node
  toArrow: z.boolean().optional(), // Enable arrow at target node edge
  arrow: z.boolean().optional(), // Legacy arrow property - backward compatibility
  // Connection style options
  style: z.enum(['bezier', 'orthogonal']).optional(), // Connection rendering style (default: bezier)
  smoothCorners: z.boolean().optional(), // Rounded corners for orthogonal connection bends
  curvature: z.number().optional(), // Bezier curve intensity (0.1 to 1.0)
  lineWidth: z.number().optional(), // Line thickness for the connection (default: 2.5)
  lineWidthLock: z.boolean().optional(),
  lineWidthEnd: z.number().optional(),
  colorLock: z.boolean().optional(),
  colorEnd: z.string().optional(),
  lineType: z.enum(['solid', 'dashed', 'dotted']).optional(),
  shadow: z.boolean().optional(), // Whether to show shadow around the connection line
  useSourceLineColor: z.boolean().optional(),
  centerEdgeAnchors: z.boolean().optional(), // Attach at edge center instead of spreading along the edge
  edgeAttachmentConstraint: z.enum(['auto', 'top-bottom', 'left-right']).optional(),
  // Optional waypoints for routing connection around obstacles (absolute canvas coordinates)
  waypoints: z.array(z.object({ x: z.number(), y: z.number(), id: z.string().optional() })).optional(),
  /** Horizontal px offset of orthogonal Z-route vertical trunk from auto midline (ignored when `waypoints` set). */
  orthogonalTrunkOffsetX: z.number().optional(),
  /** Vertical px offset of orthogonal Z-route horizontal trunk from auto midline, vertical-first routes only. */
  orthogonalTrunkOffsetY: z.number().optional(),

  animation: z.object({
    enabled: z.boolean().optional(),
    shape: z.enum(['dot', 'square', 'arrow', 'triangle', 'hexagon']).optional(),
    speed: z.number().min(-100).max(100).optional(),
    size: z.number().min(0).max(10).optional(),
    color: z.string().optional(),
    autoCount: z.boolean().optional(),
    shapeCount: z.number().min(0).max(2000).optional(),
    spacing: z.number().min(0).max(10).optional(),
  }).optional(),

  mindmapRole: z.enum(["tree", "link"]).optional(),
  mindmapPrimary: z.boolean().optional(),

  metaData: z.record(z.string(), z.string()).optional(), // Key/value metadata
});

// Schema for DiagramGroupData
export const DiagramGroupDataSchema = z.object({
  id: z.string(),
  type: z.literal('zone'),
  label: z.string().optional(),
  children: z.array(z.string()),
  info: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  subType: z.enum(['zone', 'group']).optional(),
  color: z.string().optional(), // Legacy compatibility
  layer: z.string().optional(), // Layer assignment for this zone
  borderColor: z.string().optional(),
  textColor: z.string().optional(),
  backgroundColor: z.string().optional(),
  borderStyle: z.enum(['solid', 'dotted', 'gradient', 'none']).optional(),
  borderColors: z.array(z.string()).optional(), // [startColor, endColor]
  backgroundStyle: z.enum(['solid', 'gradient', 'frosted', 'none']).optional(),
  backgroundColors: z.array(z.string()).optional(), // [startColor, endColor]
  frostedDiffusion: z.number().min(0).max(1).optional(),
  frostedTransparency: z.number().min(0).max(1).optional(),
  frostedPerlinNoise: z.number().min(0).max(10).optional(),
  gradientAngle: z.number().optional(), // Background gradient angle in degrees
  borderGradientAngle: z.number().optional(), // Border gradient angle in degrees
  orientation: z.enum(['horizontal', 'vertical', 'square']).optional(),
  maxItemsPerRow: z.number().optional(),
  lineColor: z.string().optional(),
  shadow: z.boolean().optional(),
  parentId: z.string().optional(),
   objectStyle: z.string().optional(), // Predefined visual style key
   tag: z.string().optional(), // Tag text for zone identification
   tagPosition: z.enum(['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right']).optional(), // Tag position relative to zone
   borderWidth: z.number().optional(), // Border thickness for zones

   // Text positioning properties
   textPosition: z.enum(['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right', 'inside', 'inline-top', 'inline-bottom', 'outside-top', 'outside-bottom', 'outside-left', 'outside-right']).optional(),
   
   // Text justification properties
   textJustify: z.enum(['left', 'center', 'right', 'full']).optional(), // Text justification for zones
   textVerticalPosition: z.enum(['top', 'middle', 'bottom']).optional(), // Vertical position of text in zones
  
  // Text styling properties
  fontFamily: z.string().optional(), // Font family (e.g., 'Arial', 'Helvetica', 'Times New Roman')
  fontSize: z.number().optional(), // Font size in pixels
  fontWeight: z.enum(['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900']).optional(), // Font weight
  fontStyle: z.enum(['normal', 'italic', 'oblique']).optional(), // Font style
  textDecoration: z.enum(['none', 'underline', 'overline', 'line-through']).optional(), // Text decoration
  textTransform: z.enum(['none', 'uppercase', 'lowercase', 'capitalize']).optional(), // Text transformation
  letterSpacing: z.number().optional(), // Letter spacing in pixels
  lineHeight: z.number().optional(), // Line height as a multiplier (e.g., 1.2, 1.5)
  textOpacity: z.number().optional(), // Text opacity (0-1)
  textOutlineWidth: z.number().optional(),
  textOutlineColor: z.string().optional(),
  textGlowBlur: z.number().optional(),
  textGlowColor: z.string().optional(),
  textShadowOffsetX: z.number().optional(),
  textShadowOffsetY: z.number().optional(),
  textShadowBlur: z.number().optional(),
  textShadowColor: z.string().optional(),
  textDropShadowEnabled: z.boolean().optional(),
  groupId: z.string().optional(), // Reference to grouping this zone belongs to
  metaData: z.record(z.string(), z.string()).optional(), // Key/value metadata
});

// Schema for DiagramGroupingData
export const DiagramGroupingDataSchema = z.object({
  id: z.string(),
  type: z.literal('grouping'),
  memberIds: z.array(z.string()), // IDs of nodes/zones that are grouped together
  label: z.string().optional(), // Optional group name
  locked: z.boolean().optional(), // If true, prevent ungrouping or modifications
  metaData: z.record(z.string(), z.string()).optional(), // Key/value metadata
});

// Schema for LayerInfo
export const LayerInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  visible: z.boolean(),
  locked: z.boolean(),
  color: z.string().optional(), // Optional layer color for visualization
});

// Schema for LayersConfig
export const LayersConfigSchema = z.object({
  layers: z.array(LayerInfoSchema),
  activeLayerId: z.string(),
  defaultLayerId: z.string(), // Always 'background'
});

export const DiagramDeltaOperationSchema = z.object({
  op: z.enum(['add', 'remove', 'replace']),
  path: z.string(),
  value: z.unknown().optional(),
});

export const DiagramDeltaSchema = z.object({
  version: z.literal('1.0'),
  operations: z.array(DiagramDeltaOperationSchema).default([]),
  compressed: z.literal(true).default(true),
});

export const SlideAnimationStateSchema = z.object({
  enabled: z.boolean(),
  filterSourceIds: z.array(z.string()).optional(),
  disabledSourceIds: z.array(z.string()).optional(),
});

export const SlideSchema = z.object({
  id: z.string(),
  snapshotImage: z.string().optional(),
  diagramDelta: DiagramDeltaSchema,
  animationState: SlideAnimationStateSchema.optional(),
  autoZoomLevel: z.number().positive().optional(),
  viewPanX: z.number().optional(),
  viewPanY: z.number().optional(),
  visibleLayerIds: z.array(z.string()).optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  createdAt: z.number(),
});

export const PresentationDeckSchema = z.object({
  id: z.string(),
  name: z.string(),
  slides: z.array(SlideSchema).default([]),
  presentationDeltaMode: z.enum(['master', 'chain']).optional(),
  baseSnapshotImage: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const PresentationDeckListSchema = z.array(PresentationDeckSchema);

const DiagramViewStateSchema = z.object({
  x: z.number(),
  y: z.number(),
  k: z.number(),
}).optional();

// Main DiagramData schema - zones stripped on parse via flattenDiagramOnImport
// subDiagrams: recursive structure, validated loosely to avoid circular type
export const DiagramDataSchema = z.object({
  nodes: z.array(DiagramNodeDataSchema).default([]),
  connections: z.array(DiagramConnectionDataSchema).default([]),
  groupings: z.array(DiagramGroupingDataSchema).optional(),
  layers: LayersConfigSchema.optional(),
  recentColors: z.array(z.string()).optional(),
  subDiagrams: z.record(z.string(), z.any()).optional(),
  viewState: DiagramViewStateSchema,
});

export type DiagramDataValidated = z.infer<typeof DiagramDataSchema>;

/** Parse diagram JSON - if zones present, flattens automatically */
export function parseDiagramJson(raw: unknown): DiagramDataValidated {
  const flattened = flattenDiagramOnImport((raw || {}) as Parameters<typeof flattenDiagramOnImport>[0]);
  const preSanitized = {
    ...flattened,
    nodes: (flattened.nodes || []).map((node: any) => {
      if (node?.type !== 'generic.icon.custom') return node;
      const normalizedUrl = normalizeHttpImageUrl(node?.imageUrl);
      if (!normalizedUrl) {
        const { imageUrl: _discard, ...rest } = node;
        return rest;
      }
      return { ...node, imageUrl: normalizedUrl };
    }),
  };
  const parsed = DiagramDataSchema.parse(preSanitized) as DiagramDataValidated;
  return ensureDiagramLayersPersisted(
    sanitizeCustomIconsInDiagram(parsed) as DiagramDataValidated,
  ) as DiagramDataValidated;
}

// Schema for nested node items
export const DiagramNodeItemSchema = z.object({
  id: z.string(),
  type: z.string(),
  label: z.string().optional(),
  richLabel: z.array(RichTextRunSchema).optional(),
  tag: z.string().optional(),
  tagPosition: z.enum(['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right']).optional(),
  info: z.string().optional(),
  linkUrl: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  lineColor: z.string().optional(), // Color for connections/borders
  edgePosition: z.enum(['top', 'bottom', 'left', 'right']).optional(), // Position node on edge of parent group
  layer: z.string().optional(), // Layer assignment for this node
  stackWithShapes: z.boolean().optional(), // Z-index ladder with shapes (see types)
  // Label-specific styling properties
  borderColor: z.string().optional(), // Border color for label nodes
  backgroundColor: z.string().optional(), // Background color for label nodes
  textColor: z.string().optional(), // Text color for label nodes
  borderStyle: z.enum(['solid', 'dotted', 'gradient', 'none']).optional(), // Border style for label/textbox/shape nodes
  borderColors: z.array(z.string()).optional(), // Border colors for gradient [startColor, endColor]
  backgroundStyle: z.enum(['solid', 'gradient', 'frosted', 'none']).optional(), // Background style for label/textbox/shape nodes
  backgroundColors: z.array(z.string()).optional(), // Background colors for gradient [startColor, endColor]
  frostedDiffusion: z.number().min(0).max(1).optional(),
  frostedTransparency: z.number().min(0).max(1).optional(),
  frostedPerlinNoise: z.number().min(0).max(10).optional(),
  gradientAngle: z.number().optional(), // Background gradient angle in degrees
  borderGradientAngle: z.number().optional(), // Border gradient angle in degrees
  shadow: z.boolean().optional(), // Whether to show shadow around label/textbox nodes
  highlightAnim: z.boolean().optional(),
  highlightAnimDurationSec: z.number().optional(),
  highlightAnimIntervalSec: z.number().optional(),
  highlightAnimGlowColor: z.string().optional(),
  highlightAnimGlowIntensity: z.number().min(0).max(1).optional(),
  highlightAnimMode: z.enum(['constant', 'pulse']).optional(),
  rotation: z.number().optional(), // Rotation angle in degrees (0, 45, -45, 90, -90)
  textPosition: z.enum(['above', 'center', 'under']).optional(), // Text position for shape nodes
  freeflow: z.boolean().optional(), // If true, node can be placed anywhere without joining groups/zones
  ignoreConnectionAvoidance: z.boolean().optional(), // Orthogonal connectors may cross this shape
  borderWidth: z.number().optional(), // Border thickness for shapes
  cornerRadius: z.number().min(0).max(1).optional(), // Rounded-rectangle / progress-bar: 0=straight, 1=full round
  progressPercent: z.number().min(0).max(100).optional(),
  progressShowPercent: z.boolean().optional(),
  progressTrackStyle: z.enum(['solid', 'gradient']).optional(),
  progressTrackColors: z.array(z.string()).optional(),
  progressTrackGradientAngle: z.number().optional(),
  progressFillStyle: z.enum(['solid', 'gradient']).optional(),
  progressFillColors: z.array(z.string()).optional(),
  progressFillGradientAngle: z.number().optional(),
  headingEdge: z.enum(['top', 'bottom', 'left', 'right']).optional(),
  headingLabel: z.string().optional(),
  richHeadingLabel: z.array(RichTextRunSchema).optional(),
  headingBackgroundColor: z.string().optional(),
  headingBackgroundStyle: z.enum(['gradient', 'solid']).optional(),
  headingTextColor: z.string().optional(),
  // Custom sizing properties for textbox nodes
  width: z.number().optional(), // Custom width - when set, overrides auto-calculated width
  height: z.number().optional(), // Custom height - when set, overrides auto-calculated height
  sizeMode: z.enum(['auto', 'custom']).optional(), // Whether to use auto-calculated or custom dimensions
  noIconBackground: z.boolean().optional(), // If true, removes the white background from icon nodes
  nodeSize: z.enum(['normal', 'half', 'quarter']).optional(), // Size mode for nodes and icons
  labelWidth: z.number().optional(), // Label width for icon nodes - allows label wider than icon
  // Text justification for text resources
  textJustify: z.enum(['left', 'center', 'right', 'full']).optional(), // Text justification for text/textbox nodes
  textVerticalPosition: z.enum(['top', 'middle', 'bottom']).optional(), // Vertical position of text in textbox/shape nodes
  
  // Text styling properties
  fontFamily: z.string().optional(), // Font family (e.g., 'Arial', 'Helvetica', 'Times New Roman')
  fontSize: z.number().optional(), // Font size in pixels
  fontWeight: z.enum(['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900']).optional(), // Font weight
  fontStyle: z.enum(['normal', 'italic', 'oblique']).optional(), // Font style
  textDecoration: z.enum(['none', 'underline', 'overline', 'line-through']).optional(), // Text decoration
  textTransform: z.enum(['none', 'uppercase', 'lowercase', 'capitalize']).optional(), // Text transformation
  letterSpacing: z.number().optional(), // Letter spacing in pixels
  lineHeight: z.number().optional(), // Line height as a multiplier (e.g., 1.2, 1.5)
  textOpacity: z.number().optional(), // Text opacity (0-1)
  textOutlineWidth: z.number().optional(),
  textOutlineColor: z.string().optional(),
  textGlowBlur: z.number().optional(),
  textGlowColor: z.string().optional(),
  textShadowOffsetX: z.number().optional(),
  textShadowOffsetY: z.number().optional(),
  textShadowBlur: z.number().optional(),
  textShadowColor: z.string().optional(),
  textDropShadowEnabled: z.boolean().optional(),
  groupId: z.string().optional(), // Reference to grouping this node belongs to

  // Line shape specific properties (absolute canvas positions)
  startPos: z.object({ x: z.number(), y: z.number() }).optional(), // Absolute canvas position for line start
  endPos: z.object({ x: z.number(), y: z.number() }).optional(), // Absolute canvas position for line end
  startCap: z.enum(['none', 'arrow', 'dot', 'square']).optional(), // Start endpoint style for line shapes
  endCap: z.enum(['none', 'arrow', 'dot', 'square']).optional(), // End endpoint style for line shapes
  lineThickness: z.number().optional(), // Line thickness for line shapes (default: 2.5)
  lineType: z.enum(['solid', 'dashed', 'dotted']).optional(), // Line type/style for line shapes
  linePathStyle: z.enum(['straight', 'curved']).optional(),
  lineControlPoints: z
    .array(z.object({ x: z.number(), y: z.number(), id: z.string().optional() }))
    .optional(),
  lineSmoothJoints: z.boolean().optional(),
  lineTextVerticalPosition: z.enum(['above', 'middle', 'below']).optional(), // Text position relative to line
  lineColorStyle: z.enum(['solid', 'gradient']).optional(),
  lineColors: z.array(z.string()).optional(),
  lineGradientAngle: z.number().optional(),
  
  // Lock property - prevents movement when true
  locked: z.boolean().optional(), // If true, node cannot be moved
  imageUrl: HttpImageUrlSchema.optional(),
  imageOptions: CustomImageOptionsSchema.optional(),
  metaData: z.record(z.string(), z.string()).optional(), // Key/value metadata
  subDiagramId: z.string().optional(), // Links to sub-diagram (double-click to navigate)
});

// Schema for nested group items in hierarchical format
// Note: Using z.any() for children to allow flexible nested structures
// The actual validation happens when converting to flat format
export const DiagramGroupItemSchema = z.object({
  id: z.string(),
  type: z.literal('zone'),
  label: z.string().optional(),
  info: z.string().optional(),
  children: z.array(z.any()).optional(), // Allow any structure - validated during conversion
  x: z.number().optional(),
  y: z.number().optional(),
  subType: z.enum(['zone', 'group']).optional(),
  color: z.string().optional(), // For colored groups (legacy, kept for compatibility)
  layer: z.string().optional(), // Layer assignment for this zone
  borderColor: z.string().optional(), // Border color (legacy, kept for compatibility)
  textColor: z.string().optional(), // Text color
  backgroundColor: z.string().optional(), // Background color (legacy, kept for compatibility)
  borderStyle: z.enum(['solid', 'dotted', 'gradient', 'none']).optional(), // Border style
  borderColors: z.array(z.string()).optional(), // Border colors for gradient [startColor, endColor]
  backgroundStyle: z.enum(['solid', 'gradient', 'frosted', 'none']).optional(), // Background style
  backgroundColors: z.array(z.string()).optional(), // Background colors for gradient [startColor, endColor]
  frostedDiffusion: z.number().min(0).max(1).optional(),
  frostedTransparency: z.number().min(0).max(1).optional(),
  frostedPerlinNoise: z.number().min(0).max(10).optional(),
  gradientAngle: z.number().optional(), // Background gradient angle in degrees
  borderGradientAngle: z.number().optional(), // Border gradient angle in degrees
  orientation: z.enum(['horizontal', 'vertical', 'square']).optional(), // Group shape orientation
  maxItemsPerRow: z.number().optional(), // Maximum items per row (for grid layouts)
  lineColor: z.string().optional(), // Color for connections from this group
  shadow: z.boolean().optional(), // Whether to show shadow around the group/zone
  ignoreConnectionAvoidance: z.boolean().optional(), // Orthogonal connectors may cross this zone
  objectStyle: z.string().optional(), // Predefined visual style key
  
   // Text positioning properties
   textPosition: z.enum(['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right', 'inside', 'inline-top', 'inline-bottom', 'outside-top', 'outside-bottom', 'outside-left', 'outside-right']).optional(),
   
   // Text justification properties
   textJustify: z.enum(['left', 'center', 'right', 'full']).optional(), // Text justification for zones
   textVerticalPosition: z.enum(['top', 'middle', 'bottom']).optional(), // Vertical position of text in zones
   
   // Text styling properties
   fontFamily: z.string().optional(), // Font family (e.g., 'Arial', 'Helvetica', 'Times New Roman')
   fontSize: z.number().optional(), // Font size in pixels
   fontWeight: z.enum(['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900']).optional(), // Font weight
   fontStyle: z.enum(['normal', 'italic', 'oblique']).optional(), // Font style
   textDecoration: z.enum(['none', 'underline', 'overline', 'line-through']).optional(), // Text decoration
   textTransform: z.enum(['none', 'uppercase', 'lowercase', 'capitalize']).optional(), // Text transformation
   letterSpacing: z.number().optional(), // Letter spacing in pixels
   lineHeight: z.number().optional(), // Line height as a multiplier (e.g., 1.2, 1.5)
   textOpacity: z.number().optional(), // Text opacity (0-1)
   textOutlineWidth: z.number().optional(),
   textOutlineColor: z.string().optional(),
   textGlowBlur: z.number().optional(),
   textGlowColor: z.string().optional(),
   textShadowOffsetX: z.number().optional(),
   textShadowOffsetY: z.number().optional(),
   textShadowBlur: z.number().optional(),
   textShadowColor: z.string().optional(),
   textDropShadowEnabled: z.boolean().optional(),
   
   // Custom sizing properties
   width: z.number().optional(), // Custom width - when set, overrides auto-calculated width
   height: z.number().optional(), // Custom height - when set, overrides auto-calculated height
   sizeMode: z.enum(['auto', 'custom']).optional(), // Whether to use auto-calculated or custom dimensions
   minWidth: z.number().optional(), // Minimum width constraint (based on content)
   minHeight: z.number().optional(), // Minimum height constraint (based on content)
   rotation: z.number().optional(), // Rotation angle in degrees (0, 45, -45, 90, -90)
   borderWidth: z.number().optional(), // Border thickness for groups/zones
   groupId: z.string().optional(), // Reference to grouping this zone belongs to
  metaData: z.record(z.string(), z.string()).optional(), // Key/value metadata
});

// Schema for nested hierarchical diagram data
export const HierarchicalDiagramDataSchema = z.object({
  zones: z.array(DiagramGroupItemSchema).default([]),
  connections: z.array(DiagramConnectionDataSchema).default([]),
  groupings: z.array(DiagramGroupingDataSchema).optional(), // Optional groupings for coordinated movement
  layers: LayersConfigSchema.optional(), // Optional layers configuration
  recentColors: z.array(z.string()).optional(),
});