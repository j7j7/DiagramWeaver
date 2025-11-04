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
  rotation?: number; // Rotation angle in degrees (0, 45, -45, 90, -90)
  textPosition?: 'above' | 'center' | 'under'; // Text position for shape nodes
}

export interface DiagramConnectionData {
  from: string;
  to: string;
  color?: string; // Line color for this specific connection
  text?: string; // Optional text to display on the connection
  fromPreferredExit?: 'top' | 'bottom' | 'left' | 'right'; // Preferred exit direction from source node
  fromArrow?: boolean; // Enable arrow at source node edge
  toPreferredEntry?: 'top' | 'bottom' | 'left' | 'right'; // Preferred entry direction to target node
  toArrow?: boolean; // Enable arrow at target node edge
  arrow?: boolean; // Legacy arrow property - backward compatibility
}

export interface DiagramNodeItem {
  id: string;
  type: string; // Format: provider.category.resourcename (e.g., aws.compute.ec2)
  label?: string;
  info?: string;
  x?: number;
  y?: number;
  lineColor?: string; // Color for connections/borders
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
