export interface DiagramNodeData {
  id: string;
  type: string; // Format: provider.category.resourcename (e.g., aws.compute.ec2)
  label?: string;
  info?: string;
  x?: number;
  y?: number;
  lineColor?: string; // Color for connections/borders
  edgePosition?: 'top' | 'bottom' | 'left' | 'right'; // Position node on edge of parent group
  preferredExit?: 'top' | 'bottom' | 'left' | 'right'; // Preferred direction for outgoing connections
  arrow?: boolean; // Enable arrow at end of outgoing connection lines
}

export interface DiagramConnectionData {
  from: string;
  to: string;
  color?: string; // Line color for this specific connection
  text?: string; // Optional text to display on the connection
}

export interface DiagramNodeItem {
  id: string;
  type: string; // Format: provider.category.resourcename (e.g., aws.compute.ec2)
  label?: string;
  info?: string;
  x?: number;
  y?: number;
  lineColor?: string; // Color for connections/borders
  preferredExit?: 'top' | 'bottom' | 'left' | 'right'; // Preferred direction for outgoing connections
  arrow?: boolean; // Enable arrow at end of outgoing connection lines
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
  borderStyle?: 'solid' | 'gradient'; // Border style
  borderColors?: string[]; // Border colors for gradient [startColor, endColor]
  backgroundStyle?: 'solid' | 'gradient'; // Background style
  backgroundColors?: string[]; // Background colors for gradient [startColor, endColor]
  orientation?: 'horizontal' | 'vertical' | 'square'; // Group shape orientation
  maxItemsPerRow?: number; // Maximum items per row (for grid layouts)
  lineColor?: string; // Color for connections from this group
  shadow?: boolean; // Whether to show shadow around the group/zone
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
  borderStyle?: 'solid' | 'gradient'; // Border style
  borderColors?: string[]; // Border colors for gradient [startColor, endColor]
  backgroundStyle?: 'solid' | 'gradient'; // Background style
  backgroundColors?: string[]; // Background colors for gradient [startColor, endColor]
  orientation?: 'horizontal' | 'vertical' | 'square'; // Group shape orientation
  maxItemsPerRow?: number; // Maximum items per row (for grid layouts)
  lineColor?: string; // Color for connections from this group
  shadow?: boolean; // Whether to show shadow around the group/zone
  parentId?: string; // Reference to parent group ID for hierarchy tracking
  
  // Custom sizing properties
  width?: number; // Custom width - when set, overrides auto-calculated width
  height?: number; // Custom height - when set, overrides auto-calculated height
  sizeMode?: 'auto' | 'custom'; // Whether to use auto-calculated or custom dimensions
  minWidth?: number; // Minimum width constraint (based on content)
  minHeight?: number; // Minimum height constraint (based on content)
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
