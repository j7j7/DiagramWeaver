import type { DiagramNodeData, DiagramNodeItem, DiagramZoneData, DiagramZoneItem } from './types';
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
  textJustify?: 'left' | 'center' | 'right' | 'full';
  textVerticalPosition?: 'top' | 'middle' | 'bottom';
  /** `generic.object.text-box-heading` only: heading strip text color (body uses `textColor`) */
  headingTextColor?: string;
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
    textColor: node?.textColor || theme?.textColor,
    textJustify: node?.textJustify || 'center',
    textVerticalPosition: node?.textVerticalPosition || 'middle',
    headingTextColor: (node as any)?.headingTextColor
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
  if (styling.textJustify) css.textAlign = styling.textJustify === 'full' ? 'justify' : styling.textJustify;
  if (styling.textVerticalPosition) {
    css.display = 'flex';
    switch (styling.textVerticalPosition) {
      case 'top':
        css.alignItems = 'flex-start';
        break;
      case 'middle':
        css.alignItems = 'center';
        break;
      case 'bottom':
        css.alignItems = 'flex-end';
        break;
    }
  }
  
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
    textColor: node.textColor,
    textJustify: node.textJustify,
    textVerticalPosition: node.textVerticalPosition,
    headingTextColor: node.headingTextColor
  };
}

/**
 * Extracts text styling from a zone data object
 */
export function extractTextStylingFromZone(zone: DiagramZoneData | DiagramZoneItem): TextStyling {
  return {
    fontFamily: zone.fontFamily,
    fontSize: zone.fontSize,
    fontWeight: zone.fontWeight,
    fontStyle: zone.fontStyle,
    textDecoration: zone.textDecoration,
    textTransform: zone.textTransform,
    letterSpacing: zone.letterSpacing,
    lineHeight: zone.lineHeight,
    textOpacity: zone.textOpacity,
    textColor: zone.textColor,
    textJustify: zone.textJustify,
    textVerticalPosition: zone.textVerticalPosition
  };
}

/**
 * Extracts text styling from a group data object (backward compatibility)
 */
export function extractTextStylingFromGroup(group: any): TextStyling {
  return extractTextStylingFromZone(group);
}

/**
 * Applies text styling to a node by merging with existing properties
 * If a property is explicitly set to undefined, it will be removed from the node
 * For textbox/text nodes with richLabel: clears per-run overrides (lineFontSize, lineJustify, etc.)
 * so the new node-level values take effect (runs fall back to node defaults in TextboxRichDisplay)
 */
export function applyTextStylingToNode(
  node: DiagramNodeData | DiagramNodeItem,
  styling: Partial<TextStyling>
): DiagramNodeData | DiagramNodeItem {
  const updated: any = { ...node };

  // For textbox/text with richLabel: clear run-level overrides when we change node-level styling
  // so TextboxRichDisplay uses the new node values (run.lineX ?? node.x fallback)
  const hasRichLabel = (node as any).richLabel && Array.isArray((node as any).richLabel) && (node as any).richLabel.length > 0;
  const isTextOrTextbox = (node as any).type === 'generic.text.text' || (node as any).type === 'generic.text.textbox';
  if (hasRichLabel && isTextOrTextbox) {
    const runs = (node as any).richLabel as Array<Record<string, unknown>>;
    const clearedRuns = runs.map((run) => {
      const r = { ...run };
      if ('fontSize' in styling) delete r.lineFontSize;
      if ('textJustify' in styling) delete r.lineJustify;
      if ('fontFamily' in styling) delete r.lineFontFamily;
      if ('fontWeight' in styling) delete r.lineFontWeight;
      return r;
    });
    updated.richLabel = clearedRuns;
  }

  // Handle each property - if explicitly set (including undefined), use it; otherwise keep existing
  if ('fontFamily' in styling) updated.fontFamily = styling.fontFamily;
  if ('fontSize' in styling) updated.fontSize = styling.fontSize;
  if ('fontWeight' in styling) updated.fontWeight = styling.fontWeight;
  if ('fontStyle' in styling) updated.fontStyle = styling.fontStyle;
  if ('textDecoration' in styling) updated.textDecoration = styling.textDecoration;
  if ('textTransform' in styling) updated.textTransform = styling.textTransform;
  if ('letterSpacing' in styling) updated.letterSpacing = styling.letterSpacing;
  if ('lineHeight' in styling) updated.lineHeight = styling.lineHeight;
  if ('textOpacity' in styling) updated.textOpacity = styling.textOpacity;
  if ('textColor' in styling) updated.textColor = styling.textColor;
  if ('textJustify' in styling) updated.textJustify = styling.textJustify;
  if ('textVerticalPosition' in styling) updated.textVerticalPosition = styling.textVerticalPosition;
  if ('headingTextColor' in styling) (updated as any).headingTextColor = styling.headingTextColor;

  return updated;
}

/**
 * Applies text styling to a zone by merging with existing properties
 * If a property is explicitly set to undefined, it will be removed from the zone
 */
export function applyTextStylingToZone(
  zone: DiagramZoneData | DiagramZoneItem,
  styling: Partial<TextStyling>
): DiagramZoneData | DiagramZoneItem {
  const updated: any = { ...zone };
  
  // Handle each property - if explicitly set (including undefined), use it; otherwise keep existing
  if ('fontFamily' in styling) updated.fontFamily = styling.fontFamily;
  if ('fontSize' in styling) updated.fontSize = styling.fontSize;
  if ('fontWeight' in styling) updated.fontWeight = styling.fontWeight;
  if ('fontStyle' in styling) updated.fontStyle = styling.fontStyle;
  if ('textDecoration' in styling) updated.textDecoration = styling.textDecoration;
  if ('textTransform' in styling) updated.textTransform = styling.textTransform;
  if ('letterSpacing' in styling) updated.letterSpacing = styling.letterSpacing;
  if ('lineHeight' in styling) updated.lineHeight = styling.lineHeight;
  if ('textOpacity' in styling) updated.textOpacity = styling.textOpacity;
  if ('textColor' in styling) updated.textColor = styling.textColor;
  if ('textJustify' in styling) updated.textJustify = styling.textJustify;
  if ('textVerticalPosition' in styling) updated.textVerticalPosition = styling.textVerticalPosition;
  
  return updated;
}

/**
 * Applies text styling to a group by merging with existing properties (backward compatibility)
 */
export function applyTextStylingToGroup(
  group: any,
  styling: Partial<TextStyling>
): any {
  return applyTextStylingToZone(group, styling);
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
  textColor: '#374151',
  textJustify: 'center',
  textVerticalPosition: 'middle'
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