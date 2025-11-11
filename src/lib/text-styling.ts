import type { DiagramNodeData, DiagramNodeItem, DiagramGroupData, DiagramGroupItem } from './types';
import type { ThemeProperties } from './theme-types';

// Text styling interface for consistency
export interface TextStyling {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
  fontStyle?: 'normal' | 'italic' | 'oblique';
  textDecoration?: 'none' | 'underline' | 'overline' | 'line-through';
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  letterSpacing?: number;
  lineHeight?: number;
  textOpacity?: number;
  textColor?: string;
}

/**
 * Merges text styling from node and theme, with node properties taking precedence
 */
export function getTextStyling(
  node?: Partial<TextStyling>,
  theme?: Partial<ThemeProperties>
): TextStyling {
  return {
    fontFamily: node?.fontFamily || theme?.fontFamily,
    fontSize: node?.fontSize || theme?.fontSize,
    fontWeight: node?.fontWeight || theme?.fontWeight || 'normal',
    fontStyle: node?.fontStyle || theme?.fontStyle || 'normal',
    textDecoration: node?.textDecoration || theme?.textDecoration || 'none',
    textTransform: node?.textTransform || theme?.textTransform || 'none',
    letterSpacing: node?.letterSpacing || theme?.letterSpacing,
    lineHeight: node?.lineHeight || theme?.lineHeight,
    textOpacity: node?.textOpacity || theme?.textOpacity,
    textColor: node?.textColor || theme?.textColor
  };
}

/**
 * Converts text styling object to CSS style object
 */
export function getTextStylingCSS(styling: TextStyling): React.CSSProperties {
  const css: React.CSSProperties = {};
  
  if (styling.fontFamily) css.fontFamily = styling.fontFamily;
  if (styling.fontSize) css.fontSize = `${styling.fontSize}px`;
  if (styling.fontWeight) css.fontWeight = styling.fontWeight;
  if (styling.fontStyle) css.fontStyle = styling.fontStyle;
  if (styling.textDecoration) css.textDecoration = styling.textDecoration;
  if (styling.textTransform) css.textTransform = styling.textTransform;
  if (styling.letterSpacing) css.letterSpacing = `${styling.letterSpacing}px`;
  if (styling.lineHeight) css.lineHeight = styling.lineHeight;
  if (styling.textOpacity !== undefined) css.opacity = styling.textOpacity;
  if (styling.textColor) css.color = styling.textColor;
  
  return css;
}

/**
 * Extracts text styling from a node data object
 */
export function extractTextStylingFromNode(node: DiagramNodeData | DiagramNodeItem): TextStyling {
  return {
    fontFamily: node.fontFamily,
    fontSize: node.fontSize,
    fontWeight: node.fontWeight,
    fontStyle: node.fontStyle,
    textDecoration: node.textDecoration,
    textTransform: node.textTransform,
    letterSpacing: node.letterSpacing,
    lineHeight: node.lineHeight,
    textOpacity: node.textOpacity,
    textColor: node.textColor
  };
}

/**
 * Extracts text styling from a group data object
 */
export function extractTextStylingFromGroup(group: DiagramGroupData | DiagramGroupItem): TextStyling {
  return {
    fontFamily: group.fontFamily,
    fontSize: group.fontSize,
    fontWeight: group.fontWeight,
    fontStyle: group.fontStyle,
    textDecoration: group.textDecoration,
    textTransform: group.textTransform,
    letterSpacing: group.letterSpacing,
    lineHeight: group.lineHeight,
    textOpacity: group.textOpacity,
    textColor: group.textColor
  };
}

/**
 * Applies text styling to a node by merging with existing properties
 */
export function applyTextStylingToNode(
  node: DiagramNodeData | DiagramNodeItem,
  styling: Partial<TextStyling>
): DiagramNodeData | DiagramNodeItem {
  return {
    ...node,
    fontFamily: styling.fontFamily ?? node.fontFamily,
    fontSize: styling.fontSize ?? node.fontSize,
    fontWeight: styling.fontWeight ?? node.fontWeight,
    fontStyle: styling.fontStyle ?? node.fontStyle,
    textDecoration: styling.textDecoration ?? node.textDecoration,
    textTransform: styling.textTransform ?? node.textTransform,
    letterSpacing: styling.letterSpacing ?? node.letterSpacing,
    lineHeight: styling.lineHeight ?? node.lineHeight,
    textOpacity: styling.textOpacity ?? node.textOpacity,
    textColor: styling.textColor ?? node.textColor
  };
}

/**
 * Applies text styling to a group by merging with existing properties
 */
export function applyTextStylingToGroup(
  group: DiagramGroupData | DiagramGroupItem,
  styling: Partial<TextStyling>
): DiagramGroupData | DiagramGroupItem {
  return {
    ...group,
    fontFamily: styling.fontFamily ?? group.fontFamily,
    fontSize: styling.fontSize ?? group.fontSize,
    fontWeight: styling.fontWeight ?? group.fontWeight,
    fontStyle: styling.fontStyle ?? group.fontStyle,
    textDecoration: styling.textDecoration ?? group.textDecoration,
    textTransform: styling.textTransform ?? group.textTransform,
    letterSpacing: styling.letterSpacing ?? group.letterSpacing,
    lineHeight: styling.lineHeight ?? group.lineHeight,
    textOpacity: styling.textOpacity ?? group.textOpacity,
    textColor: styling.textColor ?? group.textColor
  };
}

/**
 * Default text styling values
 */
export const DEFAULT_TEXT_STYLING: TextStyling = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 14,
  fontWeight: 'normal',
  fontStyle: 'normal',
  textDecoration: 'none',
  textTransform: 'none',
  letterSpacing: 0,
  lineHeight: 1.4,
  textOpacity: 1,
  textColor: '#374151'
};

/**
 * Common font families for selection
 */
export const COMMON_FONT_FAMILIES = [
  'Inter, system-ui, sans-serif',
  'Arial, sans-serif',
  'Helvetica, sans-serif',
  'Times New Roman, serif',
  'Georgia, serif',
  'Courier New, monospace',
  'Monaco, monospace',
  'Verdana, sans-serif',
  'Tahoma, sans-serif',
  'Trebuchet MS, sans-serif'
];

/**
 * Font weight options with labels
 */
export const FONT_WEIGHT_OPTIONS = [
  { value: '100', label: 'Thin (100)' },
  { value: '200', label: 'Extra Light (200)' },
  { value: '300', label: 'Light (300)' },
  { value: '400', label: 'Normal (400)' },
  { value: '500', label: 'Medium (500)' },
  { value: '600', label: 'Semi Bold (600)' },
  { value: '700', label: 'Bold (700)' },
  { value: '800', label: 'Extra Bold (800)' },
  { value: '900', label: 'Black (900)' },
  { value: 'normal', label: 'Normal' },
  { value: 'bold', label: 'Bold' }
];