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

/** Extensible chart kinds — add new renderers and editors per kind. */
export type ChartKind = "pie" | "bar" | "line";

/** Slice fill mode — mirrors shape `backgroundStyle` (none / solid / gradient). */
export type ChartSliceFillStyle = "none" | "solid" | "gradient";

/** One slice / row of chart data (pie segment today; future charts reuse name/value/color). */
export interface ChartSeriesItem {
  /** Stable row id; omitted in imported JSON is OK — editors assign one when saving. */
  id?: string;
  name: string;
  value: number;
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

/** One stacked segment row for bar charts (`kind: 'bar'`): parallel values per category column. */
export interface ChartBarSegmentItem {
  id?: string;
  name: string;
  /** Per-category magnitudes; shorter arrays pad with 0 at the end when rendering. */
  values: number[];
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

/** Chart configuration on a node (`generic.chart.*`). */
export type NodeChartSpec = NodeChartSpecPie | NodeChartSpecBar | NodeChartSpecLine;

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
  // Label-specific styling properties
  borderColor?: string; // Border color for label nodes
  backgroundColor?: string; // Background color for label nodes
  textColor?: string; // Text color for label nodes
  borderStyle?: 'solid' | 'dotted' | 'gradient' | 'none'; // Border style for label/textbox/shape nodes
  borderColors?: string[]; // Border colors for gradient [startColor, endColor]
  backgroundStyle?: 'solid' | 'gradient' | 'none'; // Background style for label/textbox/shape nodes
  backgroundColors?: string[]; // Background colors for gradient [startColor, endColor]
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
  rotation?: number; // Rotation angle in degrees (0, 45, -45, 90, -90)
  textPosition?: 'above' | 'center' | 'under'; // Text position for shape nodes
  freeflow?: boolean; // If true, node can be placed anywhere without joining groups/zones
  /** When true, orthogonal connectors do not route around this item (may cross its bounds). */
  ignoreConnectionAvoidance?: boolean;
  borderWidth?: number; // Border thickness for shapes
  cornerRadius?: number; // Rounded-rectangle only: 0=straight, 1=full round
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
  nodeSize?: 'normal' | 'half' | 'quarter'; // Size mode for nodes and icons
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
  lineTextPosition?: number; // Text position along line (0-100%, default 50%)
  lineTextVerticalPosition?: 'above' | 'middle' | 'below'; // Text position relative to line
  lineTextHorizontal?: boolean; // When true, keep text horizontal (readable) for right-to-left lines
  
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
  imageUrl?: string; // External image URL for generic.icon.custom nodes (http/https only)
  imageOptions?: CustomImageOptions; // Crop/scale/orientation options for custom icon images

  /** Optional metadata as key/value pairs (e.g. IP Address: 192.168.1.1) */
  metaData?: Record<string, string>;

  /** When set, this icon/node links to a sub-diagram. Double-click navigates to it. */
  subDiagramId?: string;

  /** Live chart data for `generic.chart.*` nodes (pie and bar). */
  chart?: NodeChartSpec;

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
  borderColor?: string; // Border color for label nodes
  backgroundColor?: string; // Background color for label nodes
  textColor?: string; // Text color for label nodes
  borderStyle?: 'solid' | 'dotted' | 'gradient' | 'none'; // Border style for label/textbox/shape nodes
  borderColors?: string[]; // Border colors for gradient [startColor, endColor]
  backgroundStyle?: 'solid' | 'gradient' | 'none'; // Background style for label/textbox/shape nodes
  backgroundColors?: string[]; // Background colors for gradient [startColor, endColor]
  gradientAngle?: number; // Background gradient angle in degrees
  borderGradientAngle?: number; // Border gradient angle in degrees
  shadow?: boolean; // Whether to show shadow around label/textbox nodes
  highlightAnim?: boolean;
  highlightAnimDurationSec?: number;
  highlightAnimIntervalSec?: number;
  highlightAnimGlowColor?: string;
  roundedEdges?: boolean; // Whether to apply rounded edges to shapes
  rotation?: number; // Rotation angle in degrees (0, 45, -45, 90, -90)
  textPosition?: 'above' | 'center' | 'under'; // Text position for shape nodes
  freeflow?: boolean; // If true, node can be placed anywhere without joining groups/zones
  /** When true, orthogonal connectors do not route around this item (may cross its bounds). */
  ignoreConnectionAvoidance?: boolean;
  borderWidth?: number; // Border thickness for shapes
  cornerRadius?: number; // Rounded-rectangle only: 0=straight, 1=full round
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
  nodeSize?: 'normal' | 'half' | 'quarter'; // Size mode for nodes and icons
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
  backgroundStyle?: 'solid' | 'gradient' | 'none'; // Background style
  backgroundColors?: string[]; // Background colors for gradient [startColor, endColor]
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
  backgroundStyle?: 'solid' | 'gradient' | 'none'; // Background style
  backgroundColors?: string[]; // Background colors for gradient [startColor, endColor]
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
}

/** @deprecated Zones removed - kept only for flatten-on-import of legacy JSON */
export interface HierarchicalDiagramData {
  zones: DiagramZoneItem[];
  connections: DiagramConnectionData[];
  groupings?: DiagramGroupingData[];
  metadata?: unknown;
  layers?: LayersConfig;
  recentColors?: string[];
}

/** @deprecated Zones removed - use DiagramData without zones */
export type DiagramGroupData = DiagramZoneData;
/** @deprecated Zones removed */
export type DiagramGroupItem = DiagramZoneItem;
