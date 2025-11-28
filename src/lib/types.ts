export interface DiagramNodeData {
  id: string;
  type: string; // Format: provider.category.resourcename (e.g., aws.compute.ec2)
  label?: string;
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
  gradientAngle?: number; // Gradient angle in degrees (0, 45, -45, 90, 180)
  shadow?: boolean; // Whether to show shadow around label/textbox nodes
  rotation?: number; // Rotation angle in degrees (0, 45, -45, 90, -90)
  textPosition?: 'above' | 'center' | 'under'; // Text position for shape nodes
  freeflow?: boolean; // If true, node can be placed anywhere without joining groups/zones
  borderWidth?: number; // Border thickness for shapes
  objectStyle?: string; // Predefined visual style key (e.g., 'solid', 'gradient', 'modern', etc.)
  
  // Custom sizing properties for textbox nodes
  width?: number; // Custom width - when set, overrides auto-calculated width
  height?: number; // Custom height - when set, overrides auto-calculated height
  sizeMode?: 'auto' | 'custom'; // Whether to use auto-calculated or custom dimensions
  noIconBackground?: boolean; // If true, removes the white background from icon nodes
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
  gradientAngle?: number; // Gradient angle in degrees (0, 45, -45, 90, 180)
  shadow?: boolean; // Whether to show shadow around label/textbox nodes
  rotation?: number; // Rotation angle in degrees (0, 45, -45, 90, -90)
  textPosition?: 'above' | 'center' | 'under'; // Text position for shape nodes
  freeflow?: boolean; // If true, node can be placed anywhere without joining groups/zones
  borderWidth?: number; // Border thickness for shapes
  objectStyle?: string; // Predefined visual style key (e.g., 'solid', 'gradient', 'modern', etc.)
  
  // Custom sizing properties for textbox nodes
  width?: number; // Custom width - when set, overrides auto-calculated width
  height?: number; // Custom height - when set, overrides auto-calculated height
  sizeMode?: 'auto' | 'custom'; // Whether to use auto-calculated or custom dimensions
  noIconBackground?: boolean; // If true, removes the white background from icon nodes
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
  gradientAngle?: number; // Gradient angle in degrees (0, 45, -45, 90, 180)
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
   groupId?: string; // Reference to grouping this zone belongs to
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
  gradientAngle?: number; // Gradient angle in degrees (0, 45, -45, 90, 180)
  orientation?: 'horizontal' | 'vertical' | 'square'; // Zone shape orientation
  maxItemsPerRow?: number; // Maximum items per row (for grid layouts)
  lineColor?: string; // Color for connections from this zone
  shadow?: boolean; // Whether to show shadow around zone
  parentId?: string; // Reference to parent zone ID for hierarchy tracking
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
   groupId?: string; // Reference to grouping this zone belongs to
 }

// Grouping management interface - for visual grouping of items (distinct from zones)
export interface DiagramGroupingData {
  id: string;
  type: 'grouping';
  memberIds: string[]; // IDs of nodes/zones that are grouped together
  label?: string; // Optional group name
  locked?: boolean; // If true, prevent ungrouping or modifications
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
  zones: DiagramZoneData[]; // Always present - even single nodes are in zones
  groupings?: DiagramGroupingData[]; // Optional groupings for coordinated movement
  rootZoneId?: string; // Optional reference to root zone
  layers?: LayersConfig; // Optional layers configuration
}

// Hierarchical format is now the standard format
export interface HierarchicalDiagramData {
  zones: DiagramZoneItem[]; // Nested format with DiagramZoneItem
  connections: DiagramConnectionData[];
  groupings?: DiagramGroupingData[]; // Optional groupings for coordinated movement
  metadata?: any;
  layers?: LayersConfig; // Optional layers configuration
}

// Backward compatibility aliases
// Legacy type alias - use DiagramZoneData directly
export type DiagramGroupData = DiagramZoneData;
export type DiagramGroupItem = DiagramZoneItem;

// Legacy support for existing data
export interface LegacyDiagramData {
  nodes: DiagramNodeData[];
  connections: DiagramConnectionData[];
  zones: DiagramZoneData[];
  rootZoneId?: string; // Root zone identifier
}
