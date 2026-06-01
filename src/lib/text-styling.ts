import React from 'react';
import type { CardElementData } from './card-types';
import { flexJustifyToTextJustify, textJustifyToFlexJustify } from './card-layout';
import { mapCardElementTree } from './card-utils';
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
  /** Outline width in px; 0 or unset = no outline */
  textOutlineWidth?: number;
  /** Outline stroke color (separate from fill `textColor`) */
  textOutlineColor?: string;
  /** Glow via `text-shadow`; blur px, 0 or unset = off */
  textGlowBlur?: number;
  textGlowColor?: string;
  /** Drop shadow: offsets + blur (px); all zero = off */
  textShadowOffsetX?: number;
  textShadowOffsetY?: number;
  textShadowBlur?: number;
  textShadowColor?: string;
  /** Only `true` applies drop shadow; omitted/false = off (default). */
  textDropShadowEnabled?: boolean;
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
    textOutlineWidth: node?.textOutlineWidth ?? theme?.textOutlineWidth,
    textOutlineColor: node?.textOutlineColor ?? theme?.textOutlineColor,
    textGlowBlur: node?.textGlowBlur ?? theme?.textGlowBlur,
    textGlowColor: node?.textGlowColor ?? theme?.textGlowColor,
    textShadowOffsetX: node?.textShadowOffsetX ?? theme?.textShadowOffsetX,
    textShadowOffsetY: node?.textShadowOffsetY ?? theme?.textShadowOffsetY,
    textShadowBlur: node?.textShadowBlur ?? theme?.textShadowBlur,
    textShadowColor: node?.textShadowColor ?? theme?.textShadowColor,
    textDropShadowEnabled: node?.textDropShadowEnabled ?? theme?.textDropShadowEnabled,
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
  const outlineShadow = getTextOutlineShadowCss(styling);
  const fx = getTextEffectsShadowCss(styling);
  const shadows = [outlineShadow, fx].filter(Boolean);
  if (shadows.length) css.textShadow = shadows.join(', ');
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
 * Outline via layered zero-blur `text-shadow` rings (not `-webkit-text-stroke`), so compound
 * glyphs (e.g. 4, K) do not show internal contour strokes where subpaths overlap.
 */
export function getTextOutlineShadowCss(styling: TextStyling): string | undefined {
  const w = styling.textOutlineWidth;
  if (w == null || w <= 0) return undefined;
  const color = styling.textOutlineColor ?? '#ffffff';
  const layers: string[] = [];
  const rings = Math.max(1, Math.ceil(w));
  const stepsPerRing = Math.max(8, Math.round(6 + w * 4));
  for (let ring = 1; ring <= rings; ring++) {
    for (let i = 0; i < stepsPerRing; i++) {
      const a = (i / stepsPerRing) * Math.PI * 2;
      const x = Math.cos(a) * ring;
      const y = Math.sin(a) * ring;
      layers.push(`${x.toFixed(1)}px ${y.toFixed(1)}px 0 ${color}`);
    }
  }
  return layers.join(', ');
}

/**
 * Composes `text-shadow` for glow + drop shadow (comma-separated layers).
 */
export function getTextEffectsShadowCss(styling: TextStyling): string | undefined {
  const parts: string[] = [];
  const gBlur = styling.textGlowBlur;
  if (gBlur != null && gBlur > 0) {
    const gc = styling.textGlowColor ?? 'rgba(255,255,255,0.9)';
    parts.push(`0 0 ${gBlur}px ${gc}`);
    parts.push(`0 0 ${gBlur * 1.75}px ${gc}`);
  }
  if (styling.textDropShadowEnabled === true) {
    const sx = styling.textShadowOffsetX ?? 0;
    const sy = styling.textShadowOffsetY ?? 0;
    const sb = styling.textShadowBlur ?? 0;
    const hasDrop = sb > 0 || sx !== 0 || sy !== 0;
    if (hasDrop) {
      const sc = styling.textShadowColor ?? 'rgba(0,0,0,0.45)';
      parts.push(`${sx}px ${sy}px ${sb}px ${sc}`);
    }
  }
  return parts.length ? parts.join(', ') : undefined;
}

/** `filter="url(#id)"` for SVG `<text>` when outline width > 0. */
export function getSvgTextOutlineFilterRef(filterId: string, styling: TextStyling): string | undefined {
  const w = styling.textOutlineWidth;
  if (w == null || w <= 0) return undefined;
  return `url(#${filterId})`;
}

/** Dilated-alpha outline filter — single silhouette, no per-contour stroke artifacts. */
export function SvgTextOutlineFilterDef({
  filterId,
  styling,
}: {
  filterId: string;
  styling: TextStyling;
}): React.ReactElement | null {
  const w = styling.textOutlineWidth;
  if (w == null || w <= 0) return null;
  const color = styling.textOutlineColor ?? '#ffffff';
  return React.createElement(
    'filter',
    {
      id: filterId,
      x: '-50%',
      y: '-50%',
      width: '200%',
      height: '200%',
      colorInterpolationFilters: 'sRGB',
    },
    React.createElement('feMorphology', {
      in: 'SourceAlpha',
      operator: 'dilate',
      radius: w,
      result: 'dilated',
    }),
    React.createElement('feFlood', { floodColor: color, result: 'flood' }),
    React.createElement('feComposite', {
      in: 'flood',
      in2: 'dilated',
      operator: 'in',
      result: 'outline',
    }),
    React.createElement(
      'feMerge',
      null,
      React.createElement('feMergeNode', { in: 'outline' }),
      React.createElement('feMergeNode', { in: 'SourceGraphic' }),
    ),
  );
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
    textOutlineWidth: zone.textOutlineWidth,
    textOutlineColor: zone.textOutlineColor,
    textGlowBlur: zone.textGlowBlur,
    textGlowColor: zone.textGlowColor,
    textShadowOffsetX: zone.textShadowOffsetX,
    textShadowOffsetY: zone.textShadowOffsetY,
    textShadowBlur: zone.textShadowBlur,
    textShadowColor: zone.textShadowColor,
    textDropShadowEnabled: zone.textDropShadowEnabled,
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
 * For nodes with richLabel: clears per-run overrides when matching node-level styling changes
 * so the new node values take effect (runs fall back to node defaults in TextboxRichDisplay).
 * Shapes (e.g. rounded rect) use the same rich runs; previously only text/textbox cleared lineJustify,
 * so panel justify changes were ignored when runs still had lineJustify from the editor.
 */
export function applyTextStylingToNode(
  node: DiagramNodeData | DiagramNodeItem,
  styling: Partial<TextStyling>
): DiagramNodeData | DiagramNodeItem {
  const updated: any = { ...node };

  const hasRichLabel = (node as any).richLabel && Array.isArray((node as any).richLabel) && (node as any).richLabel.length > 0;
  const isTextOrTextbox = (node as any).type === 'generic.text.text' || (node as any).type === 'generic.text.textbox';
  const shouldClearRichRuns = hasRichLabel && (isTextOrTextbox || 'textJustify' in styling);
  if (shouldClearRichRuns) {
    const runs = (node as any).richLabel as Array<Record<string, unknown>>;
    const clearedRuns = runs.map((run) => {
      const r = { ...run };
      if (isTextOrTextbox) {
        if ('fontSize' in styling) delete r.lineFontSize;
        if ('fontFamily' in styling) delete r.lineFontFamily;
        if ('fontWeight' in styling) delete r.lineFontWeight;
      }
      if ('textJustify' in styling) delete r.lineJustify;
      return r;
    });
    updated.richLabel = clearedRuns;
  }

  if (
    'textJustify' in styling &&
    updated.richHeadingLabel &&
    Array.isArray(updated.richHeadingLabel) &&
    updated.richHeadingLabel.length > 0
  ) {
    updated.richHeadingLabel = (updated.richHeadingLabel as Array<Record<string, unknown>>).map((run) => {
      const r = { ...run };
      delete r.lineJustify;
      return r;
    });
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

/** Reads text styling from a card text/tag element (layout justify falls back when textJustify unset). */
export function extractTextStylingFromCardElement(element: CardElementData): TextStyling {
  return {
    fontFamily: element.fontFamily,
    fontSize: element.fontSize,
    fontWeight: element.fontWeight as TextStyling["fontWeight"],
    fontStyle: element.fontStyle,
    textDecoration: element.textDecoration,
    textTransform: element.textTransform,
    letterSpacing: element.letterSpacing,
    lineHeight: element.lineHeight,
    textOpacity: element.textOpacity,
    textColor: element.textColor,
    textOutlineWidth: element.textOutlineWidth,
    textOutlineColor: element.textOutlineColor,
    textGlowBlur: element.textGlowBlur,
    textGlowColor: element.textGlowColor,
    textShadowOffsetX: element.textShadowOffsetX,
    textShadowOffsetY: element.textShadowOffsetY,
    textShadowBlur: element.textShadowBlur,
    textShadowColor: element.textShadowColor,
    textDropShadowEnabled: element.textDropShadowEnabled,
    textJustify: element.textJustify ?? flexJustifyToTextJustify(element.layout?.justifyContent),
    textVerticalPosition: element.textVerticalPosition,
  };
}

/** Applies text toolbar styling to a card text/tag element; syncs flex justify when alignment changes. */
export function applyTextStylingToCardElement(
  element: CardElementData,
  styling: Partial<TextStyling>,
): Partial<CardElementData> {
  const updated: Partial<CardElementData> = {};
  const hasRichText = element.richText && element.richText.length > 0;
  if (
    hasRichText &&
    ("textJustify" in styling ||
      "fontSize" in styling ||
      "fontFamily" in styling ||
      "fontWeight" in styling)
  ) {
    updated.richText = element.richText!.map((run) => {
      const r = { ...run };
      if ("fontSize" in styling) delete r.lineFontSize;
      if ("fontFamily" in styling) delete r.lineFontFamily;
      if ("fontWeight" in styling) delete r.lineFontWeight;
      if ("textJustify" in styling) delete r.lineJustify;
      return r;
    });
  }

  if ("fontFamily" in styling) updated.fontFamily = styling.fontFamily;
  if ("fontSize" in styling) updated.fontSize = styling.fontSize;
  if ("fontWeight" in styling) updated.fontWeight = styling.fontWeight;
  if ("fontStyle" in styling) updated.fontStyle = styling.fontStyle;
  if ("textDecoration" in styling) updated.textDecoration = styling.textDecoration;
  if ("textTransform" in styling) updated.textTransform = styling.textTransform;
  if ("letterSpacing" in styling) updated.letterSpacing = styling.letterSpacing;
  if ("lineHeight" in styling) updated.lineHeight = styling.lineHeight;
  if ("textOpacity" in styling) updated.textOpacity = styling.textOpacity;
  if ("textColor" in styling) updated.textColor = styling.textColor;
  if ("textOutlineWidth" in styling) updated.textOutlineWidth = styling.textOutlineWidth;
  if ("textOutlineColor" in styling) updated.textOutlineColor = styling.textOutlineColor;
  if ("textGlowBlur" in styling) updated.textGlowBlur = styling.textGlowBlur;
  if ("textGlowColor" in styling) updated.textGlowColor = styling.textGlowColor;
  if ("textShadowOffsetX" in styling) updated.textShadowOffsetX = styling.textShadowOffsetX;
  if ("textShadowOffsetY" in styling) updated.textShadowOffsetY = styling.textShadowOffsetY;
  if ("textShadowBlur" in styling) updated.textShadowBlur = styling.textShadowBlur;
  if ("textShadowColor" in styling) updated.textShadowColor = styling.textShadowColor;
  if ("textDropShadowEnabled" in styling) updated.textDropShadowEnabled = styling.textDropShadowEnabled;
  if ("textVerticalPosition" in styling) updated.textVerticalPosition = styling.textVerticalPosition;
  if ("textJustify" in styling) {
    updated.textJustify = styling.textJustify;
    const flexJustify = textJustifyToFlexJustify(styling.textJustify);
    if (flexJustify) {
      updated.layout = { ...element.layout, justifyContent: flexJustify };
    }
  }

  return updated;
}

export function isCardTextOrTagElement(element: CardElementData): boolean {
  return element.kind === "text" || element.kind === "tag";
}

/** Applies text toolbar styling to every text/tag cell in a card element tree. */
export function applyTextStylingToAllCardTextElements(
  root: CardElementData,
  styling: Partial<TextStyling>,
): CardElementData {
  if (Object.keys(styling).length === 0) return root;
  return mapCardElementTree(root, (el) => {
    if (!isCardTextOrTagElement(el)) return el;
    const patch = applyTextStylingToCardElement(el, styling);
    return Object.keys(patch).length > 0 ? { ...el, ...patch } : el;
  });
}

/** First text/tag cell styling — used when the card node is selected (not a sub-element). */
export function extractRepresentativeTextStylingFromCardElements(
  root: CardElementData,
): Partial<TextStyling> {
  let representative: Partial<TextStyling> = {};
  mapCardElementTree(root, (el) => {
    if (isCardTextOrTagElement(el) && Object.keys(representative).length === 0) {
      representative = extractTextStylingFromCardElement(el);
    }
    return el;
  });
  return representative;
}

/** Merges card element text styling onto a node without clobbering base values with `undefined`. */
export function mergeCardElementTextStylingOntoNode(
  base: DiagramNodeData,
  element: CardElementData,
): DiagramNodeData {
  const styling = extractTextStylingFromCardElement(element);
  const merged: DiagramNodeData = { ...base };
  for (const [key, value] of Object.entries(styling) as [keyof TextStyling, TextStyling[keyof TextStyling]][]) {
    if (value !== undefined) {
      (merged as unknown as Record<string, unknown>)[key] = value;
    }
  }
  merged.fontSize = styling.fontSize ?? base.fontSize ?? 12;
  merged.fontWeight = (styling.fontWeight ?? base.fontWeight ?? "normal") as DiagramNodeData["fontWeight"];
  merged.textJustify = styling.textJustify ?? base.textJustify ?? "left";
  return merged;
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