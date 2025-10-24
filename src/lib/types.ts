export interface DiagramNodeData {
  id: string;
  type: string;
  label: string;
  info: string;
  x?: number;
  y?: number;
}

export interface DiagramEdgeData {
  from: string;
  to: string;
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
  color?: string; // For colored groups
}

export interface DiagramData {
  nodes: DiagramNodeData[];
  edges: DiagramEdgeData[];
  groups?: DiagramGroupData[];
}
