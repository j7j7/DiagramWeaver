export interface DiagramNodeData {
  id: string;
  type: string; // Format: provider.category.resourcename (e.g., aws.compute.ec2)
  label?: string;
  info?: string;
  x?: number;
  y?: number;
  lineColor?: string; // Color for connections/borders
  edgePosition?: 'top' | 'bottom' | 'left' | 'right'; // Position node on edge of parent group
  // Label-specific styling properties
  borderColor?: string; // Border color for label nodes
  backgroundColor?: string; // Background color for label nodes
  textColor?: string; // Text color for label nodes
  borderStyle?: 'solid' | 'dotted' | 'gradient' | 'none'; // Border style for label/labelbox/shape nodes
  borderColors?: string[]; // Border colors for gradient [startColor, endColor]
  backgroundStyle?: 'solid' | 'gradient' | 'none'; // Background style for label/labelbox/shape nodes
  backgroundColors?: string[]; // Background colors for gradient [startColor, endColor]
  gradientAngle?: number; // Gradient angle in degrees (0, 45, -45, 90, 180)
  shadow?: boolean; // Whether to show shadow around label/labelbox nodes
  rotation?: number; // Rotation angle in degrees (0, 45, -45, 90, -90)
  textPosition?: 'above' | 'center' | 'under'; // Text position for shape nodes
  freeflow?: boolean; // If true, node can be placed anywhere without joining groups/zones
  borderWidth?: number; // Border thickness for shapes
  
  // Custom sizing properties for textbox and labelbox nodes
  width?: number; // Custom width - when set, overrides auto-calculated width
  height?: number; // Custom height - when set, overrides auto-calculated height
  sizeMode?: 'auto' | 'custom'; // Whether to use auto-calculated or custom dimensions
  noIconBackground?: boolean; // If true, removes the white background from icon nodes
  // Text justification for text resources
  textJustify?: 'left' | 'center' | 'right' | 'full'; // Text justification for text/label/textbox/labelbox nodes
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
  borderColor?: string; // Border color for label nodes
  backgroundColor?: string; // Background color for label nodes
  textColor?: string; // Text color for label nodes
  borderStyle?: 'solid' | 'dotted' | 'gradient' | 'none'; // Border style for label/labelbox/shape nodes
  borderColors?: string[]; // Border colors for gradient [startColor, endColor]
  backgroundStyle?: 'solid' | 'gradient' | 'none'; // Background style for label/labelbox/shape nodes
  backgroundColors?: string[]; // Background colors for gradient [startColor, endColor]
  gradientAngle?: number; // Gradient angle in degrees (0, 45, -45, 90, 180)
  shadow?: boolean; // Whether to show shadow around label/labelbox nodes
  rotation?: number; // Rotation angle in degrees (0, 45, -45, 90, -90)
  textPosition?: 'above' | 'center' | 'under'; // Text position for shape nodes
  freeflow?: boolean; // If true, node can be placed anywhere without joining groups/zones
  borderWidth?: number; // Border thickness for shapes
  
  // Custom sizing properties for textbox and labelbox nodes
  width?: number; // Custom width - when set, overrides auto-calculated width
  height?: number; // Custom height - when set, overrides auto-calculated height
  sizeMode?: 'auto' | 'custom'; // Whether to use auto-calculated or custom dimensions
  noIconBackground?: boolean; // If true, removes the white background from icon nodes
  // Text justification for text resources
  textJustify?: 'left' | 'center' | 'right' | 'full'; // Text justification for text/label/textbox/labelbox nodes
}

export interface DiagramGroupItem {
  id: string;
  type: 'group';
  label?: string;
  info?: string;
  children: (DiagramNodeItem | DiagramGroupItem)[];
  x?: number;
  y?: number;
  subType?: 'zone' | 'group'; // Differentiate between zone and group styling
  color?: string; // For colored groups (legacy, kept for compatibility)
  borderColor?: string; // Border color (legacy, kept for compatibility)
  textColor?: string; // Text color
  backgroundColor?: string; // Background color (legacy, kept for compatibility)
  borderStyle?: 'solid' | 'dotted' | 'gradient' | 'none'; // Border style
  borderColors?: string[]; // Border colors for gradient [startColor, endColor]
  backgroundStyle?: 'solid' | 'gradient' | 'none'; // Background style
  backgroundColors?: string[]; // Background colors for gradient [startColor, endColor]
  gradientAngle?: number; // Gradient angle in degrees (0, 45, -45, 90, 180)
  orientation?: 'horizontal' | 'vertical' | 'square'; // Group shape orientation
  maxItemsPerRow?: number; // Maximum items per row (for grid layouts)
  lineColor?: string; // Color for connections from this group
  shadow?: boolean; // Whether to show shadow around the group/zone
  
  // Text positioning properties
  textPosition?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right' | 'inside';
  
  // Custom sizing properties
  width?: number; // Custom width - when set, overrides auto-calculated width
  height?: number; // Custom height - when set, overrides auto-calculated height
  sizeMode?: 'auto' | 'custom'; // Whether to use auto-calculated or custom dimensions
  minWidth?: number; // Minimum width constraint (based on content)
  minHeight?: number; // Minimum height constraint (based on content)
  rotation?: number; // Rotation angle in degrees (0, 45, -45, 90, -90)
  borderWidth?: number; // Border thickness for groups/zones
}

export interface DiagramGroupData {
  id: string;
  type: 'group';
  label?: string;
  children: string[]; // Can contain both node IDs and group IDs - renamed from 'nodes' for clarity
  info?: string; // Add info for group descriptions/popovers
  x?: number;
  y?: number;
  subType?: 'zone' | 'group'; // Differentiate between zone and group styling
  color?: string; // For colored groups (legacy, kept for compatibility)
  borderColor?: string; // Border color (legacy, kept for compatibility)
  textColor?: string; // Text color
  backgroundColor?: string; // Background color (legacy, kept for compatibility)
  borderStyle?: 'solid' | 'dotted' | 'gradient' | 'none'; // Border style
  borderColors?: string[]; // Border colors for gradient [startColor, endColor]
  backgroundStyle?: 'solid' | 'gradient' | 'none'; // Background style
  backgroundColors?: string[]; // Background colors for gradient [startColor, endColor]
  gradientAngle?: number; // Gradient angle in degrees (0, 45, -45, 90, 180)
  orientation?: 'horizontal' | 'vertical' | 'square'; // Group shape orientation
  maxItemsPerRow?: number; // Maximum items per row (for grid layouts)
  lineColor?: string; // Color for connections from this group
  shadow?: boolean; // Whether to show shadow around the group/zone
  parentId?: string; // Reference to parent group ID for hierarchy tracking
  
  // Text positioning properties
  textPosition?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right' | 'inside';
  
  // Custom sizing properties
  width?: number; // Custom width - when set, overrides auto-calculated width
  height?: number; // Custom height - when set, overrides auto-calculated height
  sizeMode?: 'auto' | 'custom'; // Whether to use auto-calculated or custom dimensions
  minWidth?: number; // Minimum width constraint (based on content)
  minHeight?: number; // Minimum height constraint (based on content)
  rotation?: number; // Rotation angle in degrees (0, 45, -45, 90, -90)
  borderWidth?: number; // Border thickness for groups/zones
}

export interface DiagramData {
  nodes: DiagramNodeData[];
  connections: DiagramConnectionData[];
  groups: DiagramGroupData[]; // Always present - even single nodes are in groups
  rootGroupId?: string; // Optional reference to the root group
}

export interface HierarchicalDiagramData {
  groups: DiagramGroupItem[];
  connections: DiagramConnectionData[];
}
