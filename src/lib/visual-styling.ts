import type { DiagramNodeData, DiagramNodeItem, DiagramGroupData, DiagramGroupItem } from './types';
import type { ThemeProperties } from './theme-types';

// Visual styling interface for consistency
export interface VisualStyling {
  borderStyle?: 'solid' | 'dotted' | 'gradient' | 'none';
  borderColor?: string;
  borderColors?: string[]; // For gradient borders [startColor, endColor]
  backgroundStyle?: 'solid' | 'gradient' | 'none';
  backgroundColor?: string;
  backgroundColors?: string[]; // For gradient backgrounds [startColor, endColor]
  gradientAngle?: number; // Background gradient angle in degrees
  borderGradientAngle?: number; // Border gradient angle in degrees
  shadow?: boolean;
  borderWidth?: number; // Border thickness
  roundedEdges?: boolean; // Whether to apply rounded edges to shapes
  cornerRadius?: number; // Rounded-rectangle only: 0=straight, 1=full pill
  /** Text box with heading: gradient start color for the heading strip */
  headingBackgroundColor?: string;
  iconColor?: string; // Color for Lucide icons (context-aware, icons only)
  noIconBackground?: boolean; // Remove background from icon/resource nodes
  nodeSize?: 'normal' | 'half' | 'quarter'; // Size mode for nodes and icons
}

// Predefined visual styles for dropdown selection
export const VISUAL_STYLES = {
  none: {
    name: 'None',
    description: 'No border or background',
    borderStyle: 'none' as const,
    backgroundStyle: 'none' as const,
    shadow: false
  },
  solid: {
    name: 'Solid',
    description: 'Solid border and background',
    borderStyle: 'solid' as const,
    backgroundStyle: 'solid' as const,
    borderColor: '#d1d5db',
    backgroundColor: '#f3f4f6',
    shadow: false
  },
  solidWithShadow: {
    name: 'Solid with Shadow',
    description: 'Solid border and background with shadow',
    borderStyle: 'solid' as const,
    backgroundStyle: 'solid' as const,
    borderColor: '#d1d5db',
    backgroundColor: '#f3f4f6',
    shadow: true
  },
  gradient: {
    name: 'Gradient',
    description: 'Gradient border and background',
    borderStyle: 'gradient' as const,
    backgroundStyle: 'gradient' as const,
    borderColors: ['#6b7280', '#3b82f6'],
    backgroundColors: ['#f3f4f6', '#e5e7eb'],
    gradientAngle: 135,
    borderGradientAngle: 135,
    shadow: false
  },
  gradientWithShadow: {
    name: 'Gradient with Shadow',
    description: 'Gradient border and background with shadow',
    borderStyle: 'gradient' as const,
    backgroundStyle: 'gradient' as const,
    borderColors: ['#6b7280', '#3b82f6'],
    backgroundColors: ['#f3f4f6', '#e5e7eb'],
    gradientAngle: 135,
    borderGradientAngle: 135,
    shadow: true
  },
  borderOnly: {
    name: 'Border Only',
    description: 'Only border, no background',
    borderStyle: 'solid' as const,
    backgroundStyle: 'none' as const,
    borderColor: '#d1d5db',
    shadow: false
  },
  backgroundOnly: {
    name: 'Background Only',
    description: 'Only background, no border',
    borderStyle: 'none' as const,
    backgroundStyle: 'solid' as const,
    backgroundColor: '#f3f4f6',
    shadow: false
  },
  modern: {
    name: 'Modern',
    description: 'Clean modern style with subtle shadow',
    borderStyle: 'solid' as const,
    backgroundStyle: 'solid' as const,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    shadow: true
  },
  dark: {
    name: 'Dark',
    description: 'Dark theme style',
    borderStyle: 'solid' as const,
    backgroundStyle: 'solid' as const,
    borderColor: '#374151',
    backgroundColor: '#1f2937',
    shadow: true
  },
  colorful: {
    name: 'Colorful',
    description: 'Vibrant gradient style',
    borderStyle: 'gradient' as const,
    backgroundStyle: 'gradient' as const,
    borderColors: ['#8b5cf6', '#3b82f6'],
    backgroundColors: ['#ddd6fe', '#dbeafe'],
    gradientAngle: 45,
    borderGradientAngle: 45,
    shadow: true
  }
};

/**
 * Merges visual styling from node and theme, with node properties taking precedence
 */
export function getVisualStyling(
  node?: Partial<VisualStyling>,
  theme?: Partial<ThemeProperties>
): VisualStyling {
  return {
    borderStyle: node?.borderStyle || theme?.borderStyle || 'solid',
    borderColor: node?.borderColor || theme?.borderColor || '#d1d5db',
    borderColors: node?.borderColors || theme?.borderColors,
    backgroundStyle: node?.backgroundStyle || theme?.backgroundStyle || 'solid',
    backgroundColor: node?.backgroundColor || theme?.backgroundColor || '#f3f4f6',
    backgroundColors: node?.backgroundColors || theme?.backgroundColors,
    gradientAngle: node?.gradientAngle || theme?.gradientAngle || 135,
    borderGradientAngle: node?.borderGradientAngle ?? theme?.borderGradientAngle ?? node?.gradientAngle ?? theme?.gradientAngle ?? 135,
    shadow: node?.shadow ?? theme?.shadow ?? false,
    borderWidth: node?.borderWidth ?? theme?.borderWidth ?? 2,
    roundedEdges: node?.roundedEdges ?? theme?.roundedEdges ?? false
  };
}

/**
 * Maps diagram theme properties to VisualStyling for shared CSS (e.g. menu swatches).
 * Keeps swatch borders readable by capping border width.
 */
export function themePropertiesToVisualStyling(p: ThemeProperties): VisualStyling {
  return {
    borderStyle: p.borderStyle,
    borderColor: p.borderColor,
    borderColors: p.borderColors,
    backgroundStyle: p.backgroundStyle,
    backgroundColor: p.backgroundColor,
    backgroundColors: p.backgroundColors,
    gradientAngle: p.gradientAngle,
    borderGradientAngle: p.borderGradientAngle ?? p.gradientAngle,
    borderWidth: Math.min(p.borderWidth ?? 2, 2),
    shadow: false,
  };
}

/**
 * Converts visual styling object to CSS style object
 */
export function getVisualStylingCSS(styling: VisualStyling): React.CSSProperties {
  const css: React.CSSProperties = {};
  
  // Border styling
  if (styling.borderStyle === 'none') {
    css.border = 'none';
  } else if (styling.borderStyle === 'gradient' && styling.borderColors) {
    css.border = `${styling.borderWidth || 2}px solid`;
    css.borderImage = `linear-gradient(${styling.borderGradientAngle ?? styling.gradientAngle ?? 135}deg, ${styling.borderColors[0]}, ${styling.borderColors[1]}) 1`;
  } else if (styling.borderStyle === 'solid' || styling.borderStyle === 'dotted') {
    css.border = `${styling.borderWidth || 2}px ${styling.borderStyle} ${styling.borderColor || '#d1d5db'}`;
  }
  
  // Background styling
  if (styling.backgroundStyle === 'none') {
    css.background = 'transparent';
  } else if (styling.backgroundStyle === 'gradient' && styling.backgroundColors) {
    css.background = `linear-gradient(${styling.gradientAngle || 135}deg, ${styling.backgroundColors[0]}, ${styling.backgroundColors[1]})`;
  } else if (styling.backgroundStyle === 'solid') {
    css.backgroundColor = styling.backgroundColor || '#f3f4f6';
  }
  
  // Shadow
  if (styling.shadow) {
    css.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
  }
  
  return css;
}

/**
 * Extracts visual styling from a node data object
 */
export function extractVisualStylingFromNode(node: DiagramNodeData | DiagramNodeItem): VisualStyling {
  return {
    borderStyle: node.borderStyle,
    borderColor: node.borderColor,
    borderColors: node.borderColors,
    backgroundStyle: node.backgroundStyle,
    backgroundColor: node.backgroundColor,
    backgroundColors: node.backgroundColors,
    gradientAngle: node.gradientAngle,
    borderGradientAngle: node.borderGradientAngle,
    shadow: node.shadow,
    borderWidth: node.borderWidth,
    roundedEdges: (node as any).roundedEdges,
    cornerRadius: (node as any).cornerRadius,
    headingBackgroundColor: (node as any).headingBackgroundColor,
    iconColor: (node as DiagramNodeData).iconColor,
    noIconBackground: (node as any).noIconBackground,
    nodeSize: (node as any).nodeSize
  };
}

/** Size multiplier for nodeSize: normal=1, half=0.5, quarter=0.25 */
export function getNodeSizeMultiplier(nodeSize?: 'normal' | 'half' | 'quarter'): number {
  switch (nodeSize) {
    case 'half': return 0.5;
    case 'quarter': return 0.25;
    default: return 1;
  }
}

/** Icon/container dimensions in px for a given nodeSize */
export function getNodeSizeDimensions(nodeSize?: 'normal' | 'half' | 'quarter'): { container: number; icon: number } {
  const m = getNodeSizeMultiplier(nodeSize);
  return { container: Math.round(80 * m), icon: Math.round(70 * m) };
}

/**
 * Extracts visual styling from a group data object
 */
export function extractVisualStylingFromGroup(group: DiagramGroupData | DiagramGroupItem): VisualStyling {
  return {
    borderStyle: group.borderStyle,
    borderColor: group.borderColor,
    borderColors: group.borderColors,
    backgroundStyle: group.backgroundStyle,
    backgroundColor: group.backgroundColor,
    backgroundColors: group.backgroundColors,
    gradientAngle: group.gradientAngle,
    borderGradientAngle: group.borderGradientAngle,
    shadow: group.shadow,
    borderWidth: group.borderWidth
  };
}

/**
 * Applies visual styling to a node by merging with existing properties
 */
export function applyVisualStylingToNode(
  node: DiagramNodeData | DiagramNodeItem,
  styling: Partial<VisualStyling>
): DiagramNodeData | DiagramNodeItem {
  return {
    ...node,
    borderStyle: styling.borderStyle ?? node.borderStyle,
    borderColor: styling.borderColor ?? node.borderColor,
    borderColors: styling.borderColors ?? node.borderColors,
    backgroundStyle: styling.backgroundStyle ?? node.backgroundStyle,
    backgroundColor: styling.backgroundColor ?? node.backgroundColor,
    backgroundColors: styling.backgroundColors ?? node.backgroundColors,
    gradientAngle: styling.gradientAngle ?? node.gradientAngle,
    borderGradientAngle: styling.borderGradientAngle ?? node.borderGradientAngle ?? node.gradientAngle,
    shadow: styling.shadow ?? node.shadow,
    borderWidth: styling.borderWidth ?? node.borderWidth,
    roundedEdges: styling.roundedEdges ?? (node as any).roundedEdges,
    cornerRadius: styling.cornerRadius !== undefined ? styling.cornerRadius : (node as any).cornerRadius,
    headingBackgroundColor:
      styling.headingBackgroundColor !== undefined ? styling.headingBackgroundColor : (node as any).headingBackgroundColor,
    iconColor: styling.iconColor !== undefined ? styling.iconColor : (node as DiagramNodeData).iconColor,
    noIconBackground: styling.noIconBackground !== undefined ? styling.noIconBackground : (node as any).noIconBackground,
    nodeSize: styling.nodeSize !== undefined ? styling.nodeSize : (node as any).nodeSize
  } as DiagramNodeData | DiagramNodeItem;
}

/**
 * Applies visual styling to a group by merging with existing properties
 */
export function applyVisualStylingToGroup(
  group: DiagramGroupData | DiagramGroupItem,
  styling: Partial<VisualStyling>
): DiagramGroupData | DiagramGroupItem {
  return {
    ...group,
    borderStyle: styling.borderStyle ?? group.borderStyle,
    borderColor: styling.borderColor ?? group.borderColor,
    borderColors: styling.borderColors ?? group.borderColors,
    backgroundStyle: styling.backgroundStyle ?? group.backgroundStyle,
    backgroundColor: styling.backgroundColor ?? group.backgroundColor,
    backgroundColors: styling.backgroundColors ?? group.backgroundColors,
    gradientAngle: styling.gradientAngle ?? group.gradientAngle,
    borderGradientAngle: styling.borderGradientAngle ?? group.borderGradientAngle ?? group.gradientAngle,
    shadow: styling.shadow ?? group.shadow,
    borderWidth: styling.borderWidth ?? group.borderWidth
  };
}

/**
 * Gets a predefined visual style by key
 */
export function getPredefinedVisualStyle(key: keyof typeof VISUAL_STYLES): VisualStyling {
  return { ...VISUAL_STYLES[key] };
}

/**
 * Finds the closest matching predefined style for a given visual styling
 */
export function findClosestPredefinedStyle(styling: VisualStyling): keyof typeof VISUAL_STYLES | null {
  for (const [key, predefinedStyle] of Object.entries(VISUAL_STYLES)) {
    if (
      styling.borderStyle === predefinedStyle.borderStyle &&
      styling.backgroundStyle === predefinedStyle.backgroundStyle &&
      styling.shadow === predefinedStyle.shadow
    ) {
      // Check if colors match (for non-gradient styles)
      if (styling.borderStyle !== 'gradient' && styling.backgroundStyle !== 'gradient') {
        if (
          styling.borderColor === (predefinedStyle as any).borderColor &&
          styling.backgroundColor === (predefinedStyle as any).backgroundColor
        ) {
          return key as keyof typeof VISUAL_STYLES;
        }
      } else {
        // For gradient styles, just check the structure
        return key as keyof typeof VISUAL_STYLES;
      }
    }
  }
  return null;
}

/**
 * Default visual styling values
 */
export const DEFAULT_VISUAL_STYLING: VisualStyling = {
  borderStyle: 'solid',
  borderColor: '#d1d5db',
  backgroundStyle: 'solid',
  backgroundColor: '#f3f4f6',
  shadow: false,
  borderWidth: 2
};