export interface ThemeProperties {
  // Border properties
  borderStyle: 'solid' | 'dotted' | 'gradient' | 'none';
  borderColor?: string;
  borderColors?: string[]; // For gradient borders [startColor, endColor]
  borderWidth?: number;
  
  // Background properties
  backgroundStyle: 'solid' | 'gradient' | 'none';
  backgroundColor?: string;
  backgroundColors?: string[]; // For gradient backgrounds [startColor, endColor]
  backgroundOpacity?: number; // 0-1
  
  // Line properties (for connections)
  lineStyle?: 'solid' | 'dotted' | 'dashed';
  lineColor?: string;
  lineWidth?: number;
  lineOpacity?: number; // 0-1
  
  // Shadow properties
  shadow: boolean;
  shadowColor?: string;
  shadowOpacity?: number; // 0-1
  shadowBlur?: number;
  
  // Text properties
  textColor?: string;
  textOpacity?: number; // 0-1
  
  // Gradient properties
  gradientAngle?: number;
}

export interface DiagramTheme {
  id: string;
  name: string;
  description?: string;
  properties: ThemeProperties;
  isDefault?: boolean;
  isBuiltIn?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ThemeApplicationOptions {
  applyToNodes?: boolean;
  applyToGroups?: boolean;
  applyToConnections?: boolean;
  preserveExistingColors?: boolean;
}

export interface ThemeEditorState {
  selectedThemeId: string | null;
  isEditing: boolean;
  previewMode: boolean;
}