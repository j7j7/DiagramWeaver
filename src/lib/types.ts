/** Rich text run - segment with optional bold/italic/underline/list */
export interface RichTextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  /** bullet list item or numbered list item */
  listType?: "bullet" | "numbered";
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
  rotation?: number; // Rotation angle in degrees (0, 45, -45, 90, -90)
  textPosition?: 'above' | 'center' | 'under'; // Text position for shape nodes
  freeflow?: boolean; // If true, node can be placed anywhere without joining groups/zones
  borderWidth?: number; // Border thickness for shapes
  cornerRadius?: number; // Rounded-rectangle only: 0=straight, 1=full round
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

  /** Optional metadata as key/value pairs (e.g. IP Address: 192.168.1.1) */
  metaData?: Record<string, string>;

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
  style?: 'bezier'; // Connection rendering style
  curvature?: number; // Bezier curve intensity (0.1 to 1.0)
  lineWidth?: number; // Line thickness for the connection (default: 2.5)
  shadow?: boolean; // Whether to show shadow around the connection line
  
  // Multiple connection support
  connectionIndex?: number; // Index of this connection among multiple connections on the same edge of the from node (0-based)
  totalConnections?: number; // Total number of connections on the same edge of the from node
  toConnectionIndex?: number; // Index of this connection among multiple connections on the same edge of the to node (0-based)
  toTotalConnections?: number; // Total number of connections on the same edge of the to node

  // Optional waypoints for routing connection around obstacles (absolute canvas coordinates)
  waypoints?: Array<{ x: number; y: number; id?: string }>;

  /** Optional metadata as key/value pairs */
  metaData?: Record<string, string>;
}

export interface DiagramNodeItem {
  id: string;
  type: string; // Format: provider.category.resourcename (e.g., aws.compute.ec2)
  label?: string;
  info?: string;
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
  roundedEdges?: boolean; // Whether to apply rounded edges to shapes
  rotation?: number; // Rotation angle in degrees (0, 45, -45, 90, -90)
  textPosition?: 'above' | 'center' | 'under'; // Text position for shape nodes
  freeflow?: boolean; // If true, node can be placed anywhere without joining groups/zones
  borderWidth?: number; // Border thickness for shapes
  cornerRadius?: number; // Rounded-rectangle only: 0=straight, 1=full round
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

export interface DiagramData {
  nodes: DiagramNodeData[];
  connections: DiagramConnectionData[];
  /** @deprecated Zones removed - always empty, used only for parse/backward compat */
  zones?: DiagramZoneData[];
  groupings?: DiagramGroupingData[];
  layers?: LayersConfig;
  recentColors?: string[];
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
