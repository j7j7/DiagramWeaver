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
  fontFamily?: string; // Font family (e.g., 'Arial', 'Helvetica', 'Times New Roman')
  fontSize?: number; // Font size in pixels
  fontWeight?: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900'; // Font weight
  fontStyle?: 'normal' | 'italic' | 'oblique'; // Font style
  textDecoration?: 'none' | 'underline' | 'overline' | 'line-through'; // Text decoration
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize'; // Text transformation
  letterSpacing?: number; // Letter spacing in pixels
  lineHeight?: number; // Line height as a multiplier (e.g., 1.2, 1.5)
  
  // Gradient properties
  gradientAngle?: number;

  // Shape properties
  roundedEdges?: boolean;
}

export interface DiagramTheme {
  id: string;
  name: string;
  description?: string;
  properties: ThemeProperties;
  isDefault?: boolean;
  isBuiltIn?: boolean;
  isFavorite?: boolean;
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