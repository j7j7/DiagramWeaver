import type { NodeCardSpec } from "@/lib/card-types";
import type { NodeBorderSpec } from "@/lib/border-types";

/** Rich text run - segment with optional bold/italic/underline/list and per-line formatting */
export interface RichTextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  /** bullet list item or numbered list item */
  listType?: "bullet" | "numbered";
  /** Per-line: text alignment for the line this run starts. Falls back to node.textJustify when unset. */
  lineJustify?: "left" | "center" | "right" | "full";
  /** Per-line: font size in px for the line this run starts. Falls back to node.fontSize when unset. */
  lineFontSize?: number;
  /** Per-line: font weight for the line this run starts. Falls back to node.fontWeight when unset. */
  lineFontWeight?: string | number;
  /** Per-line: font family for the line this run starts. Falls back to node.fontFamily when unset. */
  lineFontFamily?: string;
}

export interface CustomImageCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CustomImageOrientation {
  rotate: 0 | 90 | 180 | 270;
  flipHorizontal: boolean;
  flipVertical: boolean;
}

export interface CustomImageOptions {
  width: number;
  height: number;
  scale: number;
  crop: CustomImageCrop;
  orientation: CustomImageOrientation;
}

/** Icon/shape size preset: normal=1×, half=0.5×, quarter=0.25×, double=2× (base container 80px). */
export type NodeSize = "normal" | "half" | "quarter" | "double";

/** Extensible chart kinds — add new renderers and editors per kind. */
export type ChartKind = "pie" | "bar" | "line" | "ring";

/** Slice fill mode — mirrors shape `backgroundStyle` (none / solid / gradient). */
export type ChartSliceFillStyle = "none" | "solid" | "gradient";

/** One slice / row of chart data (pie segment today; future charts reuse name/value/color). */
export interface ChartSeriesItem {
  /** Stable row id; omitted in imported JSON is OK — editors assign one when saving. */
  id?: string;
  name: string;
  value: number;
  /** Optional expression (`%var%`, math); re-evaluated at display time. */
  valueExpr?: string;
  /** When `fillStyle` is solid or omitted with a color, used as slice fill. */
  color?: string;
  /** Label text color on the slice (defaults in renderer when unset). */
  labelColor?: string;
  /** Fill mode; omitted = solid when `color` / defaults apply. */
  fillStyle?: ChartSliceFillStyle;
  /** Gradient stops [start, end] when `fillStyle` is `gradient`. */
  gradientColors?: [string, string];
  /**
   * Segment label font size in pie SVG viewBox units (~2–14; defaults ~4.75 wedge / ~5.5 full disc when omitted).
   */
  labelFontSize?: number;
  /**
   * Optional radial pull for this slice only (SVG viewBox units, 0–4). When set, replaces chart `segmentGapDeg` for this slice.
   */
  segmentPull?: number;
}

/** One angular segment row for segmented ring charts (`kind: 'ring'`). */
export interface ChartRingSeriesItem {
  id?: string;
  name: string;
  /** Relative arc size vs other segments (same semantics as pie `value`). */
  value: number;
  /** Optional expression (`%var%`, math); re-evaluated at display time. */
  valueExpr?: string;
  color?: string;
  labelColor?: string;
  fillStyle?: ChartSliceFillStyle;
  gradientColors?: [string, string];
  labelFontSize?: number;
  /**
   * Radial band thickness in ring SVG viewBox units (inside→outside); default renderer ~10 when omitted.
   */
  ringThickness?: number;
  /**
   * Shifts the segment band outward (+) / inward (−) from chart `innerRadius` before thickness is applied.
   */
  ringRadialOffset?: number;
  /** Per-segment outline color; omitted uses chart `sliceBorderColor` then node border. */
  sliceOutlineColor?: string;
  /** Per-segment outline width (SVG vb units); 0 hides stroke; omitted uses chart default. */
  sliceOutlineWidth?: number;
}

/** One stacked segment row for bar charts (`kind: 'bar'`): parallel values per category column. */
export interface ChartBarSegmentItem {
  id?: string;
  name: string;
  /** Per-category magnitudes; shorter arrays pad with 0 at the end when rendering. */
  values: number[];
  /** Optional comma-separated value expressions (`%var%`, math); re-evaluated at display time. */
  valuesExpr?: string;
  /** Bar: segment fill when `fillStyle` is solid/omitted. Line chart: stroke (and dots); with `fillStyle: 'none'`, area is unfilled but this still sets the line color. */
  color?: string;
  labelColor?: string;
  fillStyle?: ChartSliceFillStyle;
  gradientColors?: [string, string];
  /** Label font size in bar chart SVG viewBox units (~2–14; default ~3.25 when omitted). */
  labelFontSize?: number;
}

/** Pie chart data (`generic.chart.pie`). */
export interface NodeChartSpecPie {
  kind: "pie";
  series: ChartSeriesItem[];
  /** Wedge outline color; falls back to node `borderColor`, then `#6b7280`. */
  sliceBorderColor?: string;
  /** SVG drop shadow on the pie (separate from node Visual styling shadow). */
  shadow?: boolean;
  /**
   * Default radial pull for slices without `segmentPull` (SVG units, 0–3).
   * JSON key kept as `segmentGapDeg` for backward compatibility.
   */
  segmentGapDeg?: number;
  /** When `false`, segment names are not drawn on the pie. Omitted or `true` = show labels. */
  showSegmentLabels?: boolean;
  /** When true, slice values cannot be changed by dragging on the canvas (modal still edits). */
  valuesLocked?: boolean;
}

/** Segmented ring / donut (`generic.chart.ring`). */
export interface NodeChartSpecRing {
  kind: "ring";
  series: ChartRingSeriesItem[];
  /** Default segment outline color; falls back to node `borderColor`, then `#6b7280`. */
  sliceBorderColor?: string;
  /** Default segment outline width in SVG viewBox units when rows omit `sliceOutlineWidth`; falls back like pie to node border. */
  sliceBorderWidth?: number;
  shadow?: boolean;
  showSegmentLabels?: boolean;
  valuesLocked?: boolean;
  /**
   * Inner radius baseline (hole edge distance from chart center); segment inner rim ≈ `innerRadius + ringRadialOffset`.
   * When omitted renderer uses ~14 in a 60×60 viewBox chart.
   */
  innerRadius?: number;
  /** Angular gap between segments in degrees (0 = flush arcs). Renderer clamps to stay within circumference. */
  segmentAngularGapDeg?: number;
}

/** Bar / stacked bar chart data (`generic.chart.bar`). */
export interface NodeChartSpecBar {
  kind: "bar";
  /** Stack layers; each row is one color segment across all category columns. */
  series: ChartBarSegmentItem[];
  /** Optional label per category column (same length as columns; extra entries ignored). */
  categoryLabels?: string[];
  /** When true, each column fills the value axis (proportions only). */
  stacked100?: boolean;
  /**
   * When true (default), categories on X and values on Y (columns grow upward).
   * When false, horizontal bars (categories on Y, values on X).
   */
  vertical?: boolean;
  /** Space between category groups as a fraction of one category slot (0–0.85). */
  categoryGap?: number;
  /** Gap between stacked segment bands inside a column (SVG viewBox units). */
  stackGap?: number;
  /**
   * When true, column caps use rounded ends (whole stack as one outline).
   * Vertical bars: rounded **top** only. Horizontal bars: rounded **right** (value) end only.
   * Radius scales from bar thickness in viewBox units (like other shape rounding toggles).
   */
  roundedColumnEnds?: boolean;
  /** Segment outline color; falls back to node `borderColor`, then `#6b7280`. */
  sliceBorderColor?: string;
  shadow?: boolean;
  /** When false, in-bar segment names are hidden. */
  showSegmentLabels?: boolean;
  /** Grid lines parallel to the value axis (horizontal lines when `vertical`). */
  showGridX?: boolean;
  /** Grid lines parallel to the category axis (vertical lines when `vertical`). */
  showGridY?: boolean;
  gridColor?: string;
  /** Draw numeric ticks on the value axis. */
  showValueAxis?: boolean;
  axisColor?: string;
  /** When false, category labels under (or beside) the plot are omitted. */
  showCategoryLabels?: boolean;
  /** When true, draw the numeric magnitude inside each segment (when the segment is large enough). */
  showSegmentValues?: boolean;
  /** When true, draw a color swatch + segment name row at the bottom of the chart. */
  showLegend?: boolean;
  /** Category axis label font size (SVG viewBox units, 2–14). Omitted = default ~2.75. */
  categoryLabelFontSize?: number;
  /** Bottom legend segment name font size (SVG viewBox units, 2–14). Omitted = default ~2.7. */
  legendLabelFontSize?: number;
  /** When true, segment values cannot be changed by dragging on the canvas (modal still edits). */
  valuesLocked?: boolean;
}

/** Line chart (`generic.chart.line`). Series rows are separate lines; each has `values[]` per category. */
export interface NodeChartSpecLine {
  kind: "line";
  series: ChartBarSegmentItem[];
  categoryLabels?: string[];
  /** Gradient fill from the line down to the baseline (per series). */
  showAreaFill?: boolean;
  /** Peak opacity of the area at the line (0-1); fades to transparent at baseline. Default ~0.42. */
  areaFillOpacity?: number;
  /** Draw smooth Catmull–Rom–style curves between points. */
  smooth?: boolean;
  /** Show markers at each category point. Omitted = true. */
  showDots?: boolean;
  /** Point marker radius in SVG viewBox units (0 hides markers when point markers are on). Default ~1.85 when omitted. Max 3. */
  dotRadius?: number;
  /** Polyline stroke width in SVG viewBox units (0.25–4). Omitted = derived from node border (~1.35 when border off). */
  lineStrokeWidth?: number;
  sliceBorderColor?: string;
  shadow?: boolean;
  showGridX?: boolean;
  showGridY?: boolean;
  gridColor?: string;
  showValueAxis?: boolean;
  axisColor?: string;
  showCategoryLabels?: boolean;
  showLegend?: boolean;
  categoryLabelFontSize?: number;
  legendLabelFontSize?: number;
  /** When true, point values cannot be changed by dragging on the canvas (modal still edits). */
  valuesLocked?: boolean;
}

/** One cell in a grid chart (`generic.chart.grid`), row-major order. */
export interface ChartGridCell {
  id?: string;
  /** When false or omitted with no fill style, the cell is empty. */
  filled?: boolean;
  color?: string;
  fillStyle?: ChartSliceFillStyle | "hue-step" | "theme-hue" | "default";
  gradientColors?: [string, string];
  /** In-cell label (not the row/column axis titles). */
  text?: string;
  /** Rich in-cell label; plain `text` is kept in sync on canvas edit. */
  richText?: RichTextRun[];
  labelColor?: string;
}

/** Matrix / heatmap-style grid (`generic.chart.grid`). Container uses node Visual styling (rounded rect). */
export interface NodeChartSpecGrid {
  kind: "grid";
  cols: number;
  rows: number;
  cells: ChartGridCell[];
  /** Shown above the matrix when non-empty. */
  title?: string;
  richTitle?: RichTextRun[];
  columnTitles?: string[];
  /** Parallel to `columnTitles` (same length as `cols` when saved from editor). */
  richColumnTitles?: (RichTextRun[] | undefined)[];
  rowTitles?: string[];
  richRowTitles?: (RichTextRun[] | undefined)[];
  /** Gap between cells as a fraction of cell slot size (0 = flush). */
  cellGap?: number;
  /** Draw lines between cell slots (independent of node border). */
  showGridLines?: boolean;
  gridLineColor?: string;
  /** Hue step (°) for `hue-step` and `theme-hue` cells; falls back to Themes menu step. */
  themeHueStepDeg?: number;
  /**
   * Order for chaining `hue-step` / `theme-hue` fills: `row` = left→right per row (default);
   * `column` = top→bottom per column.
   */
  hueStepDirection?: "row" | "column";
  /** Relative column widths (positive; normalized at render). Length should match `cols`. */
  columnWeights?: number[];
  /** Relative row heights (positive; normalized at render). Length should match `rows`. */
  rowWeights?: number[];
  /**
   * Fill applied when clicking empty cells on the canvas (grid selected).
   * `same` copies the previous filled cell's color as solid; `hue-step` / `theme-hue` as elsewhere.
   */
  canvasPaintFill?: ChartSliceFillStyle | "hue-step" | "theme-hue" | "same" | "default";
  /** Gradient stops for canvas paint when {@link canvasPaintFill} is `gradient`. */
  canvasPaintGradientColors?: [string, string];
  /** Default filled-cell color for this grid (overrides diagram `gridCellFill` global). */
  defaultCellFill?: string;
  /** Default in-cell label color when a cell omits `labelColor`. */
  defaultCellLabelColor?: string;
  /**
   * @deprecated Use {@link canvasPaintFill}. `same` → solid from previous; `hue-step` → hue-step.
   */
  paintFromPrevious?: "same" | "hue-step";
  axisColor?: string;
  titleColor?: string;
}

/** Chart configuration on a node (`generic.chart.*`). */
export type NodeChartSpec =
  | NodeChartSpecPie
  | NodeChartSpecBar
  | NodeChartSpecLine
  | NodeChartSpecRing
  | NodeChartSpecGrid;

/**
 * Card silhouette for `generic.object.timeline` / `generic.object.mind-map-node`; `type` stays timeline/mind-map.
 * Swapped via context-menu “Change shape” (`shape-type-swap.ts`).
 */
export const DIAGRAM_COMPOSITE_BODY_SHAPE_KINDS = [
  "rounded-rectangle",
  "rectangle",
  "square",
  "circle",
  "triangle",
  "hexagon",
  "pentagon",
  "octagon",
  "star",
  "cloud",
  "parallelogram",
  "trapezoid",
  "kite",
] as const;

export type DiagramCompositeBodyShapeKind = (typeof DIAGRAM_COMPOSITE_BODY_SHAPE_KINDS)[number];

export type PyramidSizing = "equal" | "weighted";
export type PyramidDirection = "narrow-at-top" | "narrow-at-bottom";

/** Hub for `backgroundStyle: 'mesh_gradient'` (rounded rectangle / mind-map rounded body). */
export interface MeshGradientPoint {
  /** 0–100, relative to fill box width. */
  xPct: number;
  /** 0–100, relative to fill box height. */
  yPct: number;
  color: string;
}

export interface DiagramNodeData {
  id: string;
  type: string; // Format: provider.category.resourcename (e.g., aws.compute.ec2)
  label?: string;
  /** Rich formatting for textbox nodes - per-segment bold/italic/underline. When set, used for display instead of plain label. */
  richLabel?: RichTextRun[];
  tag?: string;
  tagPosition?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  info?: string;
  linkUrl?: string;
  x?: number;
  y?: number;
  lineColor?: string; // Color for connections/borders
  edgePosition?: 'top' | 'bottom' | 'left' | 'right'; // Position node on edge of parent group
  layer?: string; // Layer assignment for this node
  /**
   * When true on icon/label nodes, use the same z-index ladder as shapes so item order within
   * a diagram layer controls stacking. Default icon tier (+100) keeps connectors under icons;
   * with this set, connectors may draw above the node per connection slot order.
   */
  stackWithShapes?: boolean;
  // Label-specific styling properties
  borderColor?: string; // Border color for label nodes
  backgroundColor?: string; // Background color for label nodes
  textColor?: string; // Text color for label nodes
  borderStyle?: 'solid' | 'dotted' | 'gradient' | 'none'; // Border style for label/textbox/shape nodes
  borderColors?: string[]; // Border colors for gradient [startColor, endColor]
  backgroundStyle?: 'solid' | 'gradient' | 'frosted' | 'none' | 'mesh_gradient'; // Background style for label/textbox/shape nodes
  backgroundColors?: string[]; // Background colors for gradient [startColor, endColor]
  /** When `backgroundStyle` is `mesh_gradient`: three radial colour hubs (% positions in the fill box). */
  meshGradientPoints?: MeshGradientPoint[];
  /** `backgroundStyle: 'frosted'`: 0 = sharp, 1 = heavy blur (backdrop diffusion). */
  frostedDiffusion?: number;
  /** `backgroundStyle: 'frosted'`: 0 = fully transparent, 1 = more opaque (see-through of content below). */
  frostedTransparency?: number;
  /** `backgroundStyle: 'frosted'`: smooth Perlin-style noise 0=off, 10=strong. */
  frostedPerlinNoise?: number;
  gradientAngle?: number; // Background gradient angle in degrees
  borderGradientAngle?: number; // Border gradient angle in degrees
  shadow?: boolean; // Whether to show shadow around label/textbox nodes
  /** Repeating glow pulse on canvas; phase staggered from x/y so nearby items flow. */
  highlightAnim?: boolean;
  /** Pulse length in seconds (default 1). */
  highlightAnimDurationSec?: number;
  /** Idle time between pulses in seconds (default 5). */
  highlightAnimIntervalSec?: number;
  /** Glow color for the pulse (default blue). */
  highlightAnimGlowColor?: string;
  /** Halo spatial spread `0–1` (blur radii), not RGBA opacity; default 1 = legacy full-sized glow. */
  highlightAnimGlowIntensity?: number;
  /** When `highlightAnim` is on: **`'constant'`** = steady glow; **`'pulse'`** or omit = repeating pulse (legacy omitted = pulse). */
  highlightAnimMode?: 'constant' | 'pulse';
  rotation?: number; // Rotation angle in degrees (0, 45, -45, 90, -90)
  textPosition?: 'above' | 'center' | 'under'; // Text position for shape nodes
  freeflow?: boolean; // If true, node can be placed anywhere without joining groups/zones
  /** When true, orthogonal connectors do not route around this item (may cross its bounds). */
  ignoreConnectionAvoidance?: boolean;
  borderWidth?: number; // Border thickness for shapes
  /** Rounded rectangle & progress bar: 0=straight, 1=full pill */
  cornerRadius?: number;
  /** Segmented bar (`generic.object.timeline-bar`): sections left-to-right */
  timelineBarSections?: TimelineBarSectionData[];
  /** `equal` = same width per section; `weighted` = width ∝ `weight` */
  timelineBarSizing?: "equal" | "weighted";
  /** `'horizontal'` (default): segments along width; axis row below. `'vertical'`: segments along height; axis labels left of the bar. */
  timelineBarOrientation?: "horizontal" | "vertical";
  /** Show optional date/tick row below the bar */
  timelineBarShowTicks?: boolean;
  /** Small vertical ticks at section boundaries on the tick row */
  timelineBarTickMarkers?: boolean;
  /** Outline between segments (interior vertical lines) */
  timelineBarSectionBorder?: boolean;
  timelineBarSectionBorderWidth?: number;
  timelineBarSectionBorderColor?: string;
  /** Degrees between consecutive **theme hue** section fills (defaults to diagram theme step, see `DIAGRAM_THEME_HUE_STEP_DEG`). */
  timelineBarHueStepDeg?: number;
  /**
   * Optional timeline axis under the bar (e.g. Q1–Q4): labels at fractional positions **independent** of segment count.
   * When non-empty, the tick row uses these instead of each section’s `tickLabel`.
   */
  timelineBarAxisLabels?: TimelineBarAxisLabelData[];
  /** Optional axis-row font size (shape units, same as `fontSize`); omit for automatic sizing (~2× former default). */
  timelineBarAxisLabelFontSize?: number;
  /** Optional axis/tick row font; omit to use the shape’s `fontFamily`. */
  timelineBarAxisLabelFontFamily?: string;
  /** When true, segments after the first use the first segment’s bar-label alignment and typography (not per-segment overrides). */
  timelineBarLabelsFollowFirstSection?: boolean;

  /** Segmented pyramid (`generic.object.pyramid`): bottom tier first, stacked upward; reuse timeline segment fill/label payload. */
  pyramidSections?: TimelineBarSectionData[];
  /** `equal` = same tier height; `weighted` = height ∝ `weight`. */
  pyramidSizing?: PyramidSizing;
  /** Vertical gap between tiers (diagram px, clipped to 0–32). */
  pyramidSegmentGap?: number;
  /** Taper orientation: `'narrow-at-top'` = classical wide base. */
  pyramidDirection?: PyramidDirection;
  /** Width of the apex / narrow end as a fraction of the base (`0.02`–`1`, default ~0.12). */
  pyramidApexWidthRatio?: number;
  pyramidSectionBorder?: boolean;
  pyramidSectionBorderWidth?: number;
  pyramidSectionBorderColor?: string;
  pyramidHueStepDeg?: number;
  /** When true, segments after the first mirror the first tier’s segment-label typography (timeline-bar parity). */
  pyramidLabelsFollowFirstSection?: boolean;

  /** Segmented rectangle (`generic.object.segmented-rectangle`): sections along one axis (same payload as timeline-bar sections). */
  segmentedRectangleSections?: TimelineBarSectionData[];
  segmentedRectangleSizing?: "equal" | "weighted";
  /** Default `horizontal` — segments pack left→right; `vertical` — top→bottom. */
  segmentedRectanglePlacementOrder?: "horizontal" | "vertical";
  /** Gap between segments along the stacking axis in shape units (0 = flush). */
  segmentedRectangleSegmentGap?: number;
  /** `container` = one outer border; `segments` = stroke each segment; `none` = no strokes. */
  segmentedRectangleOutlineMode?: "container" | "segments" | "none";
  /** Dividers between adjacent segments along the cross-axis (inset via `segmentedRectangleDividerInset`). */
  segmentedRectangleDividers?: boolean;
  segmentedRectangleDividerWidth?: number;
  segmentedRectangleDividerColor?: string;
  /** Fraction inset along the cross-axis from each side at divider endpoints (horizontal layout: top/bottom; vertical: left/right); clamped ~0–0.45. */
  segmentedRectangleDividerInset?: number;
  /** Hue step between consecutive **theme-hue** segments (defaults like timeline bar). */
  segmentedRectangleHueStepDeg?: number;
  segmentedRectangleLabelsFollowFirstSection?: boolean;

  /** Progress bar (`generic.object.progress-bar`): completed amount 0–100 */
  progressPercent?: number;
  /** Progress bar: show numeric percent on the bar (default true) */
  progressShowPercent?: boolean;
  /** @deprecated Ignored — unfilled portion uses `background*`; kept for backward-compatible JSON imports. */
  progressTrackStyle?: 'solid' | 'gradient';
  /** @deprecated Ignored — use `backgroundColor` / `backgroundColors`; kept for legacy imports. */
  progressTrackColors?: string[];
  /** @deprecated Ignored — use `gradientAngle`; kept for legacy imports. */
  progressTrackGradientAngle?: number;
  /** Progress bar: filled section style */
  progressFillStyle?: 'solid' | 'gradient';
  progressFillColors?: string[];
  progressFillGradientAngle?: number;
  /** Text box with linked heading (generic.object.text-box-heading): which edge the heading strip sits on */
  headingEdge?: 'top' | 'bottom' | 'left' | 'right';
  /** Heading text (separate from main body label) */
  headingLabel?: string;
  richHeadingLabel?: RichTextRun[];
  /** Heading strip fill color (see `headingBackgroundStyle`) */
  headingBackgroundColor?: string;
  /** Heading strip: `gradient` = fade color to transparent into body; `solid` = uniform fill */
  headingBackgroundStyle?: 'gradient' | 'solid';
  /** Heading strip text color (body uses `textColor`) */
  headingTextColor?: string;
  objectStyle?: string; // Predefined visual style key (e.g., 'solid', 'gradient', 'modern', etc.)
  
  // Custom sizing properties for textbox nodes
  width?: number; // Custom width - when set, overrides auto-calculated width
  height?: number; // Custom height - when set, overrides auto-calculated height
  sizeMode?: 'auto' | 'custom'; // Whether to use auto-calculated or custom dimensions
  noIconBackground?: boolean; // If true, removes the white background from icon nodes
  nodeSize?: NodeSize; // Size mode for nodes and icons
  labelWidth?: number; // Label width for icon/resource nodes - allows label wider than 80px icon
  // Text justification for text resources
  textJustify?: 'left' | 'center' | 'right' | 'full'; // Text justification for text/textbox nodes
  textVerticalPosition?: 'top' | 'middle' | 'bottom'; // Vertical position of text in textbox nodes
  
  // Text styling properties
  fontFamily?: string; // Font family (e.g., 'Arial', 'Helvetica', 'Times New Roman')
  fontSize?: number; // Font size in pixels
  fontWeight?: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900'; // Font weight
  fontStyle?: 'normal' | 'italic' | 'oblique'; // Font style
  textDecoration?: 'none' | 'underline' | 'overline' | 'line-through'; // Text decoration
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize'; // Text transformation
  letterSpacing?: number; // Letter spacing in pixels
  lineHeight?: number; // Line height as a multiplier (e.g., 1.2, 1.5)
  textOpacity?: number; // Text opacity (0-1)
  /** Text outline width in px; omit or 0 for no outline */
  textOutlineWidth?: number;
  /** Outline color when `textOutlineWidth` > 0 (independent of `textColor`) */
  textOutlineColor?: string;
  /** Glow: blur radius in px; 0 or unset = off */
  textGlowBlur?: number;
  textGlowColor?: string;
  /** Drop shadow: offset and blur (px); all zero = off */
  textShadowOffsetX?: number;
  textShadowOffsetY?: number;
  textShadowBlur?: number;
  textShadowColor?: string;
  /** When true, drop shadow is rendered. Omitted or false = off (default). */
  textDropShadowEnabled?: boolean;
  groupId?: string; // Reference to grouping this node belongs to
  importId?: string; // ID for tracking imported items from Scratch Pad
  
  // Line shape specific properties (absolute canvas positions)
  startPos?: { x: number; y: number }; // Absolute canvas position for line start
  endPos?: { x: number; y: number }; // Absolute canvas position for line end
  startCap?: 'none' | 'arrow' | 'dot' | 'square'; // Start endpoint style for line shapes
  endCap?: 'none' | 'arrow' | 'dot' | 'square'; // End endpoint style for line shapes
  lineThickness?: number; // Line thickness for line shapes (default: 2.5)
  lineType?: 'solid' | 'dashed' | 'dotted'; // Line type/style for line shapes
  /** Polyline connector: straight segment vs smooth curve through interior control points */
  linePathStyle?: 'straight' | 'curved';
  /** Interior points (absolute canvas coords) between `startPos` and `endPos` — straight polylines or curved splines */
  lineControlPoints?: Array<{ x: number; y: number; id?: string }>;
  /** When `linePathStyle` is straight and there are interior points, draw slight rounding at corners (quadratic fillets) */
  lineSmoothJoints?: boolean;
  lineTextPosition?: number; // Text position along line (0-100%, default 50%)
  lineTextVerticalPosition?: 'above' | 'middle' | 'below'; // Text position relative to line
  lineTextHorizontal?: boolean; // When true, keep text horizontal (readable) for right-to-left lines
  /** Connector body paint: `solid` uses `lineColor`; `gradient` uses `lineColors` + `lineGradientAngle`. */
  lineColorStyle?: 'solid' | 'gradient';
  lineColors?: string[];
  lineGradientAngle?: number;
  
  // Lock property - prevents movement when true
  locked?: boolean; // If true, node cannot be moved
  
  // Resource information for icon rendering
  provider?: string; // Provider name (e.g., 'aws', 'azure', 'gcp')
  category?: string; // Category name (e.g., 'compute', 'storage', 'network')
  file?: string; // Resource filename (e.g., 'ec2.png', 's3.png')
  // Standard icons from Icons section (Lucide symbols or emojis)
  iconType?: 'lucide' | 'emoji'; // Render as Lucide icon or emoji
  iconName?: string; // Lucide icon name (e.g. 'Home', 'Shield')
  emoji?: string; // Emoji character for emoji icons
  iconColor?: string; // Color for Lucide icons (hex, e.g. '#3b82f6')
  /** Opacity for the icon glyph only (0–1); omit for fully opaque. */
  iconOpacity?: number;
  /** Lucide/generic icon nodes: extruded 3D square behind the glyph. */
  iconBevel?: boolean;
  /** Bevel light direction / extrusion bearing in degrees (0–360). */
  iconBevelRotation?: number;
  /** Block thickness as fraction of icon size (0.01–0.42; default 0.1). */
  iconBevelDepth?: number;
  /** Fill colour for the 3D block (top + sides). */
  iconBevelBlockColor?: string;
  /** When true, block + top face colour follows the icon (edge-sampled for rasters; tile bg for vectors). */
  iconBevelMatchIconBackground?: boolean;
  /** Fine Z rotation (degrees) added to `iconBevelRotation` for grid tessellation (-20–20). */
  iconBevelGridOffset?: number;
  imageUrl?: string; // External image URL for generic.icon.custom nodes (http/https only)
  imageOptions?: CustomImageOptions; // Crop/scale/orientation options for custom icon images

  /** Optional metadata as key/value pairs (e.g. IP Address: 192.168.1.1) */
  metaData?: Record<string, string>;

  /** When set, this icon/node links to a sub-diagram. Double-click navigates to it. */
  subDiagramId?: string;

  /** Live chart data for `generic.chart.*` nodes (pie and bar). */
  chart?: NodeChartSpec;

  /** Composite card layout for `generic.card.*` template nodes. */
  card?: NodeCardSpec;

  /** Slide border / base frame for `generic.border.*` template nodes. */
  border?: NodeBorderSpec;

  /** Custom vector path geometry for `generic.object.vector-path` nodes. */
  vectorPath?: import("@/lib/vector-path-types").VectorPathSpec;

  /** Agenda card: step row background hues (defaults to Themes menu multi-select hue setting). */
  agendaRowThemeHue?: boolean;
  /** Agenda card: show divider lines between sections and rows (default true). */
  agendaDividersEnabled?: boolean;

  /** Bullet list card: step hue per bullet cube (defaults to Themes menu multi-select hue setting). */
  bulletListItemThemeHue?: boolean;
  /** Bullet list card: per-item icons instead of colored bullet markers. */
  bulletListUseItemIcons?: boolean;

  /** UML class diagram compartments: name, attributes, methods in separate sections */
  umlClass?: {
    name: string;
    attributes: string[];
    methods: string[];
  };
  /** Per-compartment text styling for UML class shape */
  umlClassStyle?: {
    name?: { fontFamily?: string; fontSize?: number; textJustify?: string; textColor?: string };
    attributes?: { fontFamily?: string; fontSize?: number; textJustify?: string; textColor?: string };
    methods?: { fontFamily?: string; fontSize?: number; textJustify?: string; textColor?: string };
    dividerLineWidth?: number;
  };

  /** Hull for timeline/mind-map card bodies — `type` stays timeline or mind-map-node. */
  compositeBodyShape?: DiagramCompositeBodyShapeKind;

  /** `generic.object.timeline`: one rounded card along the spine (see timeline-layout.ts). */
  timelineEntries?: TimelineEntryData[];
  /** Even spacing uses `(i+1)/(n+1)` along arc length; manual keeps per-entry `t`. */
  timelineDistribution?: 'even' | 'manual';
  timelineCardSide?: 'above' | 'below' | 'alternate';
  /** Number of sections (≥2 draws internal ticks); 0 or omitted = none. */
  timelineSections?: number;
  timelineCardW?: number;
  timelineCardH?: number;
  /** Corner radius for cards (px-ish, same spirit as shape rounding scale). */
  timelineCornerRadius?: number;
  /** Distance from spine anchor toward card (px). */
  timelineOffsetPx?: number;
  timelineCardFillMode?: 'solid' | 'theme-hues';
  /** Degrees added per entry for `theme-hues` (defaults to diagram theme hue step). */
  timelineHueStepDeg?: number;
  timelineConnectorWidth?: number;
  timelineDotRadius?: number;

  /** `generic.object.mind-map-node`: radial mind-map tree (see `mindmap-layout.ts`). */
  mindmapRootId?: string;
  /** Tree parent node id — sync with a primary `mindmapRole: 'tree'` connection from parent → this node. */
  mindmapParentId?: string;
  /** Ordered child ids for radial layout / sibling order. */
  mindmapChildIds?: string[];
  /** Polar angle in degrees from parent center to this node (0° = +X, 90° = downward on canvas). */
  mindmapAngleDeg?: number;
  /** Orbit radius in px from parent center to this node’s center. */
  mindmapRadiusPx?: number;
  /** Parent-only: first child angle in degrees (default 90). */
  mindmapStartAngleDeg?: number;
  /** `theme-hues`: shift fill/border hue by (`mindmapTreeDepth` + `mindmapSiblingHueIndex`) × step. */
  mindmapFillMode?: 'solid' | 'theme-hues';
  mindmapHueStepDeg?: number;
  /** When true, skip automatic hue shift for this node. */
  mindmapHueLocked?: boolean;
  /** Depth in tree from root — computed when structure changes. */
  mindmapTreeDepth?: number;
  /** 0-based index among direct siblings (parent `mindmapChildIds` order) for theme-hues variance. */
  mindmapSiblingHueIndex?: number;
  /** When true, this node's stored fill/border colors are the base for theme-hues for itself and descendants until another anchor. */
  mindmapHueAnchor?: boolean;
}

/** Label on the optional timeline axis row (`timelineBarAxisLabels`) — positions are 0–1 along the bar. */
export interface TimelineBarAxisLabelData {
  id: string;
  label: string;
  /** Rich axis label (optional); plain `label` is kept for search / modal row text. */
  richLabel?: RichTextRun[];
  /** 0 = left edge, 1 = right edge of the inner bar; label is centered here. */
  t: number;
}

/** When stored on sections after the first, bar-label fields resolve from section 0’s effective values for that property. */
export const TIMELINE_BAR_LABEL_FIRST_SECTION = "first-section" as const;

/** One segment of `generic.object.timeline-bar` (stacked horizontal bar). */
export interface TimelineBarSectionData {
  id: string;
  /** Text drawn inside the segment (optional). */
  label?: string;
  /** Rich text for the segment label (optional); plain `label` is kept in sync for search/export. */
  richLabel?: RichTextRun[];
  /** Solid fill when `fillStyle` is solid or omitted (legacy). */
  fill?: string;
  /** Segment fill: solid (default), linear gradient, transparent track, or **theme hue** (shifts from bar `background*` like timeline cards). */
  fillStyle?: "solid" | "gradient" | "none" | "theme-hue";
  /** When `fillStyle` is gradient: two colours [start, end]. */
  fillGradientColors?: string[];
  /** When `fillStyle` is gradient: angle in degrees (default 90). */
  fillGradientAngle?: number;
  /** Layout weight when `timelineBarSizing` is `weighted` (default 1). */
  weight?: number;
  /**
   * When **all** sections define `spanStart` / `spanEnd` (0–1 along the bar), widths use these instead of equal/weighted layout.
   * Lets segments span multiple “timeline” units while the axis row shows a different grid (e.g. quarters).
   */
  spanStart?: number;
  spanEnd?: number;
  /** Optional label below the bar when no `timelineBarAxisLabels` (or extra hint). Ignored for the tick row when axis labels are set. */
  tickLabel?: string;
  /** Override for segment label color; falls back to node `textColor`. */
  labelColor?: string;
  /** Segment bar-label horizontal alignment; inherits node `textJustify` when omitted (then defaults to center in the renderer). Use `first-section` on sections 1+ to mirror section 0. */
  labelTextJustify?: "left" | "center" | "right" | "full" | typeof TIMELINE_BAR_LABEL_FIRST_SECTION;
  /** Segment bar-label vertical placement inside the coloured band; inherits node `textVerticalPosition` when omitted (then defaults to middle). */
  labelVerticalAlign?:
    | "top"
    | "middle"
    | "bottom"
    | typeof TIMELINE_BAR_LABEL_FIRST_SECTION;
  /** Override font family for this segment’s bar label; inherits node `fontFamily`. Reserved string `first-section` mirrors section 0 (sections 1+ only). */
  labelFontFamily?: string;
  /** Override font size (px) for this segment’s bar label; `first-section` mirrors section 0. Inherits node `fontSize` when omitted (still capped by bar height in the renderer). */
  labelFontSize?: number | typeof TIMELINE_BAR_LABEL_FIRST_SECTION;
  /** Override font weight for this segment’s bar label; `first-section` mirrors section 0. Inherits node `fontWeight` (renderer defaults to 600 when both unset). */
  labelFontWeight?: DiagramNodeData["fontWeight"] | typeof TIMELINE_BAR_LABEL_FIRST_SECTION;
  /** Override font style for this segment’s bar label; `first-section` mirrors section 0. */
  labelFontStyle?: DiagramNodeData["fontStyle"] | typeof TIMELINE_BAR_LABEL_FIRST_SECTION;
  /** Override text decoration for this segment’s bar label; `first-section` mirrors section 0. */
  labelTextDecoration?: DiagramNodeData["textDecoration"] | typeof TIMELINE_BAR_LABEL_FIRST_SECTION;
  /** Per-segment outline for `generic.object.segmented-rectangle` when `segmentedRectangleOutlineMode` is `segments`. */
  segmentOutlineColor?: string;
  segmentOutlineWidth?: number;
  segmentOutlineStyle?: "solid" | "dotted" | "none";
}

/** Timeline card row — optional visual overrides inherit from the parent timeline node when omitted. */
export interface TimelineEntryData {
  id: string;
  /** Arc-length ratio along spine when `timelineDistribution` is `manual`. */
  t?: number;
  label?: string;
  richLabel?: RichTextRun[];
  backgroundStyle?: 'solid' | 'gradient' | 'frosted' | 'none' | 'mesh_gradient';
  backgroundColor?: string;
  backgroundColors?: string[];
  meshGradientPoints?: MeshGradientPoint[];
  gradientAngle?: number;
  frostedDiffusion?: number;
  frostedTransparency?: number;
  frostedPerlinNoise?: number;
  borderStyle?: 'solid' | 'dotted' | 'gradient' | 'none';
  borderColor?: string;
  borderColors?: string[];
  borderGradientAngle?: number;
  shadow?: boolean;
  textColor?: string;
  cornerRadius?: number;
  width?: number;
  height?: number;
  /** Extra px along the card-side normal from spine (drag cards nearer/further or across spine); negative pulls toward spine. */
  cardNormalOffsetPx?: number;
  /** When set, pins this card above/below (overrides node `timelineCardSide` / alternate for this row). */
  cardSide?: 'above' | 'below';
}

export interface ScratchPadItem {
  id: string;
  label: string;
  type: string;
  data: Partial<DiagramNodeData>;
  isFavorite: boolean;
  importId?: string;
  objectType?: 'shape' | 'icon' | 'text'; // Type of object for proper handling
  // Store resource info at item level for easy access
  provider?: string;
  category?: string;
  file?: string;
}

export interface DiagramConnectionData {
  /** Unique identifier for the connection. Required when multiple connections exist between same nodes. */
  id?: string;
  from: string;
  to: string;
  color?: string; // Line color for this specific connection
  text?: string; // Optional text to display on the connection
  textPosition?: number; // Text position along the line (0-100%, default 50%)
  fromPreferredExit?: 'top' | 'bottom' | 'left' | 'right' | 'center'; // Preferred exit direction from source node
  fromArrow?: boolean; // Enable arrow at source node edge
  toPreferredEntry?: 'top' | 'bottom' | 'left' | 'right' | 'center'; // Preferred entry direction to target node
  toArrow?: boolean; // Enable arrow at target node edge
  arrow?: boolean; // Legacy arrow property - backward compatibility
  
  // Connection style options
  style?: 'bezier' | 'orthogonal'; // Connection rendering style (default: bezier)
  smoothCorners?: boolean; // When true, orthogonal 90-degree bends render with small rounded corners
  curvature?: number; // Bezier curve intensity (0.1 to 1.0)
  lineWidth?: number; // Line thickness for the connection (default: 2.5; clamped 1–50 px)
  /** When false, `lineWidth` is the start thickness and `lineWidthEnd` is the end (smooth taper). Default: locked (uniform `lineWidth`). */
  lineWidthLock?: boolean;
  /** End thickness when `lineWidthLock === false` (px, clamped like `lineWidth`). */
  lineWidthEnd?: number;
  /** When false, `color` is the start colour and `colorEnd` is the end (gradient along the line). Default: locked (single `color`). */
  colorLock?: boolean;
  /** End colour when `colorLock === false`. */
  colorEnd?: string;
  /** Stroke pattern: solid (default), dashed, or dotted — same semantics as line shapes (`lineType`). */
  lineType?: 'solid' | 'dashed' | 'dotted';
  shadow?: boolean; // Whether to show shadow around the connection line
  /** When true, stroke follows the source outline: visible border (`borderColors` / `borderColor`) before `lineColor`, then zone/icon fallbacks; else connection `color` and usual fallbacks. */
  useSourceLineColor?: boolean;

  // Multiple connection support
  connectionIndex?: number; // Index of this connection among multiple connections on the same edge of the from node (0-based)
  totalConnections?: number; // Total number of connections on the same edge of the from node
  toConnectionIndex?: number; // Index of this connection among multiple connections on the same edge of the to node (0-based)
  toTotalConnections?: number; // Total number of connections on the same edge of the to node

  /** When true, attach at the center of each chosen edge instead of spreading along the edge (default: subdivided). */
  centerEdgeAnchors?: boolean;

  /**
   * Limits which sides of each endpoint may be used when choosing attach edges.
   * `auto` (default): allow top, bottom, left, or right based on layout.
   * `top-bottom`: only top and bottom edges.
   * `left-right`: only left and right edges.
   */
  edgeAttachmentConstraint?: 'auto' | 'top-bottom' | 'left-right';

  // Optional waypoints for routing connection around obstacles (absolute canvas coordinates)
  waypoints?: Array<{ x: number; y: number; id?: string }>;

  /**
   * Orthogonal Z-routes only (no manual `waypoints`): horizontal offset in px from the auto midline
   * for the vertical trunk. Negative moves the trunk toward the left when the link runs left→right.
   */
  orthogonalTrunkOffsetX?: number;

  /**
   * Orthogonal Z-routes only (no manual `waypoints`, vertical-first exit): vertical offset in px from
   * the auto midline for the horizontal trunk. Negative moves the trunk **up** when the link runs top→bottom.
   */
  orthogonalTrunkOffsetY?: number;

  /** Optional metadata as key/value pairs */
  metaData?: Record<string, string>;

  /** Mind-map: `tree` = hierarchy + layout; `link` = visual only (no parent assignment). */
  mindmapRole?: 'tree' | 'link';
  /** When multiple edges target a node, marks which `tree` edge sets `mindmapParentId`. */
  mindmapPrimary?: boolean;

  /** Per-connection animation settings */
  animation?: {
    enabled?: boolean; // Whether animated shapes are shown on this connection
    shape?: 'dot' | 'square' | 'arrow' | 'triangle' | 'hexagon';
    speed?: number; // -100 to 100, units/sec in connection coordinates
    size?: number; // 0–10 in 0.5 steps, scaled by line width
    color?: string; // Fallback to connection color when not provided
    autoCount?: boolean; // true: derive shape count from length + spacing
    shapeCount?: number; // Manual mode: 0 to 2000 (effective max is dynamically clamped by path length/spacing)
    spacing?: number; // Shape-size spacing ratio, 0 to 10
  };
}

export interface DiagramNodeItem {
  id: string;
  type: string; // Format: provider.category.resourcename (e.g., aws.compute.ec2)
  label?: string;
  /** Rich formatting for textbox nodes - per-segment bold/italic/underline. When set, used for display instead of plain label. */
  richLabel?: RichTextRun[];
  info?: string;
  linkUrl?: string;
  x?: number;
  y?: number;
  lineColor?: string; // Color for connections/borders
  edgePosition?: 'top' | 'bottom' | 'left' | 'right'; // Position node on edge of parent group
  layer?: string; // Layer assignment for this node
  /** See `DiagramNodeData.stackWithShapes`. */
  stackWithShapes?: boolean;
  borderColor?: string; // Border color for label nodes
  backgroundColor?: string; // Background color for label nodes
  textColor?: string; // Text color for label nodes
  borderStyle?: 'solid' | 'dotted' | 'gradient' | 'none'; // Border style for label/textbox/shape nodes
  borderColors?: string[]; // Border colors for gradient [startColor, endColor]
  backgroundStyle?: 'solid' | 'gradient' | 'frosted' | 'none' | 'mesh_gradient'; // Background style for label/textbox/shape nodes
  backgroundColors?: string[]; // Background colors for gradient [startColor, endColor]
  meshGradientPoints?: MeshGradientPoint[];
  frostedDiffusion?: number;
  frostedTransparency?: number;
  frostedPerlinNoise?: number;
  gradientAngle?: number; // Background gradient angle in degrees
  borderGradientAngle?: number; // Border gradient angle in degrees
  shadow?: boolean; // Whether to show shadow around label/textbox nodes
  highlightAnim?: boolean;
  highlightAnimDurationSec?: number;
  highlightAnimIntervalSec?: number;
  highlightAnimGlowColor?: string;
  /** See `DiagramNodeData.highlightAnimGlowIntensity`. */
  highlightAnimGlowIntensity?: number;
  /** See `DiagramNodeData.highlightAnimMode`. */
  highlightAnimMode?: 'constant' | 'pulse';
  roundedEdges?: boolean; // Whether to apply rounded edges to shapes
  rotation?: number; // Rotation angle in degrees (0, 45, -45, 90, -90)
  textPosition?: 'above' | 'center' | 'under'; // Text position for shape nodes
  freeflow?: boolean; // If true, node can be placed anywhere without joining groups/zones
  /** When true, orthogonal connectors do not route around this item (may cross its bounds). */
  ignoreConnectionAvoidance?: boolean;
  borderWidth?: number; // Border thickness for shapes
  /** Rounded rectangle & progress bar: 0=straight, 1=full pill */
  cornerRadius?: number;
  progressPercent?: number;
  progressShowPercent?: boolean;
  /** @deprecated Ignored — unfilled uses `background*`; legacy JSON only. */
  progressTrackStyle?: 'solid' | 'gradient';
  /** @deprecated Ignored — legacy JSON only. */
  progressTrackColors?: string[];
  /** @deprecated Ignored — legacy JSON only. */
  progressTrackGradientAngle?: number;
  progressFillStyle?: 'solid' | 'gradient';
  progressFillColors?: string[];
  progressFillGradientAngle?: number;
  headingEdge?: 'top' | 'bottom' | 'left' | 'right';
  headingLabel?: string;
  richHeadingLabel?: RichTextRun[];
  headingBackgroundColor?: string;
  headingBackgroundStyle?: 'gradient' | 'solid';
  headingTextColor?: string;
  objectStyle?: string; // Predefined visual style key (e.g., 'solid', 'gradient', 'modern', etc.)
  
  // Custom sizing properties for textbox nodes
  width?: number; // Custom width - when set, overrides auto-calculated width
  height?: number; // Custom height - when set, overrides auto-calculated height
  sizeMode?: 'auto' | 'custom'; // Whether to use auto-calculated or custom dimensions
  noIconBackground?: boolean; // If true, removes the white background from icon nodes
  nodeSize?: NodeSize; // Size mode for nodes and icons
  labelWidth?: number; // Label width for icon/resource nodes - allows label wider than 80px icon
  // Text justification for text resources
  textJustify?: 'left' | 'center' | 'right' | 'full'; // Text justification for text/textbox nodes
  textVerticalPosition?: 'top' | 'middle' | 'bottom'; // Vertical position of text in textbox nodes
  
  // Text styling properties
  fontFamily?: string; // Font family (e.g., 'Arial', 'Helvetica', 'Times New Roman')
  fontSize?: number; // Font size in pixels
  fontWeight?: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900'; // Font weight
  fontStyle?: 'normal' | 'italic' | 'oblique'; // Font style
  textDecoration?: 'none' | 'underline' | 'overline' | 'line-through'; // Text decoration
   textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize'; // Text transformation
   letterSpacing?: number; // Letter spacing in pixels
   lineHeight?: number; // Line height as a multiplier (e.g., 1.2, 1.5)
   textOpacity?: number; // Text opacity (0-1)
   textOutlineWidth?: number;
   textOutlineColor?: string;
   textGlowBlur?: number;
   textGlowColor?: string;
   textShadowOffsetX?: number;
   textShadowOffsetY?: number;
   textShadowBlur?: number;
   textShadowColor?: string;
   textDropShadowEnabled?: boolean;
   tag?: string; // Tag text for node identification
   tagPosition?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'; // Tag position relative to node
   groupId?: string; // Reference to grouping this node belongs to
   
  // Line shape specific properties (absolute canvas positions)
  startPos?: { x: number; y: number }; // Absolute canvas position for line start
  endPos?: { x: number; y: number }; // Absolute canvas position for line end
  startCap?: 'none' | 'arrow' | 'dot' | 'square'; // Start endpoint style for line shapes
  endCap?: 'none' | 'arrow' | 'dot' | 'square'; // End endpoint style for line shapes
  lineThickness?: number; // Line thickness for line shapes (default: 2.5)
  lineType?: 'solid' | 'dashed' | 'dotted'; // Line type/style for line shapes
  lineTextVerticalPosition?: 'above' | 'middle' | 'below'; // Text position relative to line
  lineColorStyle?: 'solid' | 'gradient';
  lineColors?: string[];
  lineGradientAngle?: number;
  
  // Lock property - prevents movement when true
  locked?: boolean; // If true, node cannot be moved

  // External image URL support for custom icon nodes
  imageUrl?: string; // External image URL for generic.icon.custom nodes (http/https only)
  imageOptions?: CustomImageOptions; // Crop/scale/orientation options for custom icon images

  /** Optional metadata as key/value pairs */
  metaData?: Record<string, string>;
}

export interface DiagramZoneItem {
  id: string;
  type: 'zone';
  subType?: 'zone' | 'group'; // For backward compatibility during migration
  label?: string;
  info?: string;
  children: (DiagramNodeItem | DiagramZoneItem)[];
  x?: number;
  y?: number;
  color?: string; // For colored zones (legacy, kept for compatibility)
  layer?: string; // Layer assignment for this zone
  borderColor?: string; // Border color (legacy, kept for compatibility)
  textColor?: string; // Text color
  backgroundColor?: string; // Background color (legacy, kept for compatibility)
  borderStyle?: 'solid' | 'dotted' | 'gradient' | 'none'; // Border style
  borderColors?: string[]; // Border colors for gradient [startColor, endColor]
  backgroundStyle?: 'solid' | 'gradient' | 'frosted' | 'none' | 'mesh_gradient'; // Background style
  backgroundColors?: string[]; // Background colors for gradient [startColor, endColor]
  frostedDiffusion?: number;
  frostedTransparency?: number;
  frostedPerlinNoise?: number;
  gradientAngle?: number; // Background gradient angle in degrees
  borderGradientAngle?: number; // Border gradient angle in degrees
  orientation?: 'horizontal' | 'vertical' | 'square'; // Zone shape orientation
  maxItemsPerRow?: number; // Maximum items per row (for grid layouts)
  lineColor?: string; // Color for connections from this zone
  shadow?: boolean; // Whether to show shadow around zone
  objectStyle?: string; // Predefined visual style key (e.g., 'solid', 'gradient', 'modern', etc.)
   
   // Text positioning properties - extended for flexible zone labeling
   textPosition?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right' | 'inside' | 'inline-top' | 'inline-bottom' | 'outside-top' | 'outside-bottom' | 'outside-left' | 'outside-right';
     
   // Text justification properties
   textJustify?: 'left' | 'center' | 'right' | 'full'; // Text justification for text/textbox nodes
   textVerticalPosition?: 'top' | 'middle' | 'bottom'; // Vertical position of text in textbox nodes
     
   // Text styling properties
   fontFamily?: string; // Font family (e.g., 'Arial', 'Helvetica', 'Times New Roman')
   fontSize?: number; // Font size in pixels
   fontWeight?: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900'; // Font weight
   fontStyle?: 'normal' | 'italic' | 'oblique'; // Font style
   textDecoration?: 'none' | 'underline' | 'overline' | 'line-through'; // Text decoration
   textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize'; // Text transformation
   letterSpacing?: number; // Letter spacing in pixels
   lineHeight?: number; // Line height as a multiplier (e.g., 1.2, 1.5)
   textOpacity?: number; // Text opacity (0-1)
   textOutlineWidth?: number;
   textOutlineColor?: string;
   textGlowBlur?: number;
   textGlowColor?: string;
   textShadowOffsetX?: number;
   textShadowOffsetY?: number;
   textShadowBlur?: number;
   textShadowColor?: string;
   textDropShadowEnabled?: boolean;
   
   // Custom sizing properties
   width?: number; // Custom width - when set, overrides auto-calculated width
   height?: number; // Custom height - when set, overrides auto-calculated height
   sizeMode?: 'auto' | 'custom'; // Whether to use auto-calculated or custom dimensions
   minWidth?: number; // Minimum width constraint (based on content)
   minHeight?: number; // Minimum height constraint (based on content)
    rotation?: number; // Rotation angle in degrees (0, 45, -45, 90, -90)
    borderWidth?: number; // Border thickness for zones
    tag?: string; // Tag text for zone identification
    tagPosition?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'; // Tag position relative to zone
    groupId?: string; // Reference to grouping this zone belongs to

    /** Optional metadata as key/value pairs */
    metaData?: Record<string, string>;
  }

export interface DiagramZoneData {
  id: string;
  type: 'zone';
  subType?: 'zone' | 'group'; // For backward compatibility during migration
  label?: string;
  children: string[]; // Can contain both node IDs and zone IDs - renamed from 'nodes' for clarity
  info?: string; // Add info for zone descriptions/popovers
  x?: number;
  y?: number;
  color?: string; // For colored zones (legacy, kept for compatibility)
  layer?: string; // Layer assignment for this zone
  borderColor?: string; // Border color (legacy, kept for compatibility)
  textColor?: string; // Text color
  backgroundColor?: string; // Background color (legacy, kept for compatibility)
  borderStyle?: 'solid' | 'dotted' | 'gradient' | 'none'; // Border style
  borderColors?: string[]; // Border colors for gradient [startColor, endColor]
  backgroundStyle?: 'solid' | 'gradient' | 'frosted' | 'none' | 'mesh_gradient'; // Background style
  backgroundColors?: string[]; // Background colors for gradient [startColor, endColor]
  frostedDiffusion?: number;
  frostedTransparency?: number;
  frostedPerlinNoise?: number;
  gradientAngle?: number; // Background gradient angle in degrees
  borderGradientAngle?: number; // Border gradient angle in degrees
  orientation?: 'horizontal' | 'vertical' | 'square'; // Zone shape orientation
  maxItemsPerRow?: number; // Maximum items per row (for grid layouts)
  lineColor?: string; // Color for connections from this zone
  shadow?: boolean; // Whether to show shadow around zone
  /** When true, orthogonal connectors do not route around this zone (may cross its bounds). */
  ignoreConnectionAvoidance?: boolean;
   parentId?: string; // Reference to parent zone ID for hierarchy tracking
   objectStyle?: string; // Predefined visual style key (e.g., 'solid', 'gradient', 'modern', etc.)
   tag?: string; // Tag text for zone identification
   tagPosition?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'; // Tag position relative to zone

   // Text positioning properties - extended for flexible zone labeling
   textPosition?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right' | 'inside' | 'inline-top' | 'inline-bottom' | 'outside-top' | 'outside-bottom' | 'outside-left' | 'outside-right';
     
   // Text justification properties
   textJustify?: 'left' | 'center' | 'right' | 'full'; // Text justification for text/textbox nodes
   textVerticalPosition?: 'top' | 'middle' | 'bottom'; // Vertical position of text in textbox nodes
     
   // Text styling properties
   fontFamily?: string; // Font family (e.g., 'Arial', 'Helvetica', 'Times New Roman')
   fontSize?: number; // Font size in pixels
   fontWeight?: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900'; // Font weight
   fontStyle?: 'normal' | 'italic' | 'oblique'; // Font style
   textDecoration?: 'none' | 'underline' | 'overline' | 'line-through'; // Text decoration
   textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize'; // Text transformation
   letterSpacing?: number; // Letter spacing in pixels
   lineHeight?: number; // Line height as a multiplier (e.g., 1.2, 1.5)
   textOpacity?: number; // Text opacity (0-1)
   textOutlineWidth?: number;
   textOutlineColor?: string;
   textGlowBlur?: number;
   textGlowColor?: string;
   textShadowOffsetX?: number;
   textShadowOffsetY?: number;
   textShadowBlur?: number;
   textShadowColor?: string;
   textDropShadowEnabled?: boolean;
   
   // Custom sizing properties
   width?: number; // Custom width - when set, overrides auto-calculated width
   height?: number; // Custom height - when set, overrides auto-calculated height
   sizeMode?: 'auto' | 'custom'; // Whether to use auto-calculated or custom dimensions
   minWidth?: number; // Minimum width constraint (based on content)
   minHeight?: number; // Minimum height constraint (based on content)
  rotation?: number; // Rotation angle in degrees (0, 45, -45, 90, -90)
  borderWidth?: number; // Border thickness for zones
  groupId?: string; // Reference to grouping this zone belongs to
  layoutMode?: 'grid' | 'free'; // Layout mode for children: 'grid' (default) or 'free' (preserve x/y)
  layoutType?: 'grid' | 'circular'; // Visual layout arrangement
  sorting?: 'manual' | 'alpha-asc' | 'alpha-desc'; // Sorting order for children

  /** Optional metadata as key/value pairs */
  metaData?: Record<string, string>;
}

export interface DiagramGroupingData {
  id: string;
  type: 'grouping';
  memberIds: string[]; // IDs of nodes that are grouped together (for coordinated movement)
  label?: string; // Optional group name
  locked?: boolean; // If true, prevent ungrouping or modifications

  /** Optional metadata as key/value pairs */
  metaData?: Record<string, string>;
}

// Layer management interfaces
export interface LayerInfo {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  color?: string; // Optional layer color for visualization
}

export interface LayersConfig {
  layers: LayerInfo[];
  activeLayerId: string;
  defaultLayerId: string; // Always 'background'
}

export interface DiagramDeltaOperation {
  op: 'add' | 'remove' | 'replace';
  path: string;
  value?: unknown;
}

export interface DiagramDelta {
  version: '1.0';
  operations: DiagramDeltaOperation[];
  compressed: true;
}

export interface SlideAnimationState {
  enabled: boolean;
  filterSourceIds?: string[];
  disabledSourceIds?: string[];
}

export interface Slide {
  id: string;
  snapshotImage?: string; // base64 PNG (optional in compact file payload)
  diagramDelta: DiagramDelta;
  animationState?: SlideAnimationState;
  autoZoomLevel?: number;
  /** Saved pan (screen-space transform x/y) when the snapshot was taken — used with autoZoomLevel in playback */
  viewPanX?: number;
  viewPanY?: number;
  visibleLayerIds?: string[];
  title?: string;
  description?: string;
  createdAt: number;
}

export interface PresentationDeck {
  id: string;
  name: string;
  slides: Slide[];
  /**
   * How `diagramDelta` on each slide is interpreted vs the visible master (`presentationMasterDiagram` / primary tab diagram).
   * **`master`** (default when omitted; recommended): each slide is **`applyDiagramDelta(master, slide.diagramDelta)`** independently.
   * **`chain`** (legacy persisted mode): slide 0 vs master; slide *i*&gt;0 vs the diagram after slide *i-1* (**removals on one slide affected later slides** until re-saved under **`master`**).
   */
  presentationDeltaMode?: 'master' | 'chain';
  /** @deprecated Legacy only; migrated to `slides[0].snapshotImage` on load. */
  baseSnapshotImage?: string;
  createdAt: number;
  updatedAt: number;
}

/** Pan/zoom state stored per diagram level for restore on navigation */
export interface DiagramViewState {
  x: number;
  y: number;
  k: number;
}

export interface DiagramData {
  nodes: DiagramNodeData[];
  connections: DiagramConnectionData[];
  /** @deprecated Zones removed - always empty, used only for parse/backward compat */
  zones?: DiagramZoneData[];
  groupings?: DiagramGroupingData[];
  layers?: LayersConfig;
  recentColors?: string[];
  /** Nested sub-diagrams keyed by subDiagramId. Nodes with subDiagramId reference these. */
  subDiagrams?: Record<string, DiagramData>;
  /** Saved pan/zoom for this diagram level - restored when navigating to it */
  viewState?: DiagramViewState;
  /** Optional viewport background (hex/rgba); omitted = theme `bg-background` */
  canvasBackgroundColor?: string;
  /** Diagram-wide `%varname%` placeholders resolved at display time (not in stored labels). */
  globalProperties?: Record<string, string>;
}

/** @deprecated Zones removed - kept only for flatten-on-import of legacy JSON */
export interface HierarchicalDiagramData {
  zones: DiagramZoneItem[];
  connections: DiagramConnectionData[];
  groupings?: DiagramGroupingData[];
  metadata?: unknown;
  layers?: LayersConfig;
  recentColors?: string[];
  canvasBackgroundColor?: string;
}

/** @deprecated Zones removed - use DiagramData without zones */
export type DiagramGroupData = DiagramZoneData;
/** @deprecated Zones removed */
export type DiagramGroupItem = DiagramZoneItem;
