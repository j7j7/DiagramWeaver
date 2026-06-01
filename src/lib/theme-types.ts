import type { MeshGradientPoint } from '@/lib/types';

export interface ThemeProperties {
  // Border properties
  borderStyle: 'solid' | 'dotted' | 'gradient' | 'none';
  borderColor?: string;
  borderColors?: string[]; // For gradient borders [startColor, endColor]
  borderWidth?: number;
  
  // Background properties
  backgroundStyle: 'solid' | 'gradient' | 'none' | 'mesh_gradient';
  backgroundColor?: string;
  backgroundColors?: string[]; // For gradient backgrounds [startColor, endColor]
  /** Three radial hubs when `backgroundStyle` is `mesh_gradient`. */
  meshGradientPoints?: MeshGradientPoint[];
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
  textOutlineWidth?: number;
  textOutlineColor?: string;
  textGlowBlur?: number;
  textGlowColor?: string;
  textShadowOffsetX?: number;
  textShadowOffsetY?: number;
  textShadowBlur?: number;
  textShadowColor?: string;
  textDropShadowEnabled?: boolean;
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
  borderGradientAngle?: number;

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
  /**
   * Added to each chart segment’s hue step and applied as a flat shift to theme colors
   * on nodes and connections (for multi-select “step hue by layout”).
   */
  hueShiftDegrees?: number;
  /**
   * Degrees between consecutive pie / ring / bar / line series rows when applying a theme.
   * Omit to use `DIAGRAM_THEME_HUE_STEP_DEG` (36°). Themes menu passes the same value as
   * {@link ThemeMenuApplyOptions.multiSelectHueStepDegrees}.
   */
  chartSeriesHueStepDegrees?: number;
  /**
   * When true, consecutive card internal regions (agenda rows, tinted sections, icon slots)
   * step hue when applying a theme. Mirrors Themes menu “Step hue for multi-selection”.
   */
  stepHueWithinCard?: boolean;
}

/** Options passed from the Themes dropdown when applying a theme to the selection. */
export interface ThemeMenuApplyOptions {
  /** When true and multiple items are selected, stagger hue by vertical or horizontal order. */
  multiSelectHueByLayout?: boolean;
  /**
   * Degrees between consecutive items in layout order when multi-select hue stepping is on,
   * and between consecutive chart series rows (pie, ring, bar, line) within each chart.
   * Omit to use the persisted Themes “Hue step (°)” value or `DIAGRAM_THEME_HUE_STEP_DEG`.
   */
  multiSelectHueStepDegrees?: number;
}

export interface ThemeEditorState {
  selectedThemeId: string | null;
  isEditing: boolean;
  previewMode: boolean;
}