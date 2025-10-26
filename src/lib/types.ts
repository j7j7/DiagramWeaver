export interface DiagramNodeData {
  id: string;
  type: string;
  label: string;
  info: string;
  x?: number;
  y?: number;
  lineColor?: string; // Color for connections/borders
}

export interface DiagramEdgeData {
  from: string;
  to: string;
  color?: string; // Line color for this specific edge
}

export interface DiagramGroupData {
  id: string;
  type: 'group';
  label: string;
  nodes: string[];
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
}

export interface DiagramData {
  nodes: DiagramNodeData[];
  edges: DiagramEdgeData[];
  groups?: DiagramGroupData[];
}
