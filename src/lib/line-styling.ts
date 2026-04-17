import type { DiagramNodeData, DiagramNodeItem } from './types';
import type { TextStyling } from './text-styling';
import { isConnectorLineGeometryClosed } from './line-curve-path';
import { isConnectorLineNodeType } from './utils';

// Line styling interface combining line properties and text properties
export interface LineStyling extends TextStyling {
  // Line-specific properties
  lineThickness?: number; // Line thickness (0.5-10px)
  lineType?: 'solid' | 'dashed' | 'dotted'; // Line type/style
  startCap?: 'none' | 'arrow' | 'dot' | 'square'; // Start endpoint style
  endCap?: 'none' | 'arrow' | 'dot' | 'square'; // End endpoint style
  lineColor?: string; // Line color
  lineTextVerticalPosition?: 'above' | 'middle' | 'below'; // Text position relative to line
  lineColorStyle?: 'solid' | 'gradient';
  lineColors?: string[];
  lineGradientAngle?: number;
}

/**
 * Extracts line styling from a node data object
 */
export function extractLineStylingFromNode(node: DiagramNodeData | DiagramNodeItem): LineStyling {
  return {
    // Line properties
    lineThickness: node.lineThickness,
    lineType: (node as any).lineType,
    startCap: node.startCap,
    endCap: node.endCap,
    lineColor: node.lineColor,
    lineTextVerticalPosition: (node as any).lineTextVerticalPosition,
    lineColorStyle: (node as any).lineColorStyle,
    lineColors: (node as any).lineColors,
    lineGradientAngle: (node as any).lineGradientAngle,
    // Text properties
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
    textOutlineWidth: node.textOutlineWidth,
    textOutlineColor: node.textOutlineColor,
    textGlowBlur: node.textGlowBlur,
    textGlowColor: node.textGlowColor,
    textShadowOffsetX: node.textShadowOffsetX,
    textShadowOffsetY: node.textShadowOffsetY,
    textShadowBlur: node.textShadowBlur,
    textShadowColor: node.textShadowColor,
    textDropShadowEnabled: node.textDropShadowEnabled,
    textJustify: node.textJustify,
    textVerticalPosition: node.textVerticalPosition
  };
}

/**
 * Applies line styling to a node by merging with existing properties
 */
export function applyLineStylingToNode(
  node: DiagramNodeData | DiagramNodeItem,
  styling: Partial<LineStyling>
): DiagramNodeData | DiagramNodeItem {
  const updated: any = { ...node };
  
  // Line properties
  if ('lineThickness' in styling) updated.lineThickness = styling.lineThickness;
  if ('lineType' in styling) updated.lineType = styling.lineType;
  if ('startCap' in styling) updated.startCap = styling.startCap;
  if ('endCap' in styling) updated.endCap = styling.endCap;
  if ('lineColor' in styling) updated.lineColor = styling.lineColor;
  if ('lineTextVerticalPosition' in styling) updated.lineTextVerticalPosition = styling.lineTextVerticalPosition;
  if ('lineColorStyle' in styling) updated.lineColorStyle = styling.lineColorStyle;
  if ('lineColors' in styling) updated.lineColors = styling.lineColors;
  if ('lineGradientAngle' in styling) updated.lineGradientAngle = styling.lineGradientAngle;
  
  // Text properties
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
  if ('textOutlineWidth' in styling) updated.textOutlineWidth = styling.textOutlineWidth;
  if ('textOutlineColor' in styling) updated.textOutlineColor = styling.textOutlineColor;
  if ('textGlowBlur' in styling) updated.textGlowBlur = styling.textGlowBlur;
  if ('textGlowColor' in styling) updated.textGlowColor = styling.textGlowColor;
  if ('textShadowOffsetX' in styling) updated.textShadowOffsetX = styling.textShadowOffsetX;
  if ('textShadowOffsetY' in styling) updated.textShadowOffsetY = styling.textShadowOffsetY;
  if ('textShadowBlur' in styling) updated.textShadowBlur = styling.textShadowBlur;
  if ('textShadowColor' in styling) updated.textShadowColor = styling.textShadowColor;
  if ('textDropShadowEnabled' in styling) updated.textDropShadowEnabled = styling.textDropShadowEnabled;
  if ('textJustify' in styling) updated.textJustify = styling.textJustify;
  if ('textVerticalPosition' in styling) updated.textVerticalPosition = styling.textVerticalPosition;
  
  return syncClosedConnectorLineBorderWidth(updated);
}

/**
 * Default line styling values
 */
export const DEFAULT_LINE_STYLING: LineStyling = {
  lineThickness: 2.5,
  lineType: 'solid',
  startCap: 'none',
  endCap: 'none',
  lineColor: '#6b7280',
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 12,
  fontWeight: 'normal',
  fontStyle: 'normal',
  textDecoration: 'none',
  textTransform: 'none',
  letterSpacing: 0,
  lineHeight: 1.4,
  textOpacity: 1,
  textColor: '#000000',
  textJustify: 'center',
  textVerticalPosition: 'middle'
};

/** Closed connector lines use stroke width from line thickness; keep `borderWidth` in sync for visual styling. */
export function syncClosedConnectorLineBorderWidth<T extends DiagramNodeData | DiagramNodeItem>(node: T): T {
  if (!isConnectorLineNodeType(node.type)) return node;
  if (!isConnectorLineGeometryClosed(node as DiagramNodeData)) return node;
  const lt = (node as DiagramNodeData).lineThickness;
  const w =
    typeof lt === 'number' && lt > 0 ? lt : DEFAULT_LINE_STYLING.lineThickness ?? 2.5;
  return { ...(node as object), borderWidth: w } as T;
}
