import type { SelectedItem } from '@/components/editor/diagram-editor-types';
import type { DiagramNodeData } from '@/lib/types';
import type { ThemeProperties } from '@/lib/theme-types';
import { extractVisualStylingFromNode } from '@/lib/visual-styling';
import { isShapeNodeType } from '@/lib/utils';

const DEFAULT_THEME_PROPERTIES: ThemeProperties = {
  borderStyle: 'solid',
  borderColor: '#3b82f6',
  borderWidth: 2,
  backgroundStyle: 'solid',
  backgroundColor: '#eff6ff',
  backgroundOpacity: 1,
  lineStyle: 'solid',
  lineColor: '#3b82f6',
  lineWidth: 2.5,
  lineOpacity: 1,
  shadow: false,
  shadowColor: '#000000',
  shadowOpacity: 0.2,
  shadowBlur: 4,
  textColor: '#374151',
  textOpacity: 1,
  gradientAngle: 135,
};

/** Whether the current canvas selection can seed a user-defined theme. */
export function canCreateThemeFromSelection(item: SelectedItem | null | undefined): boolean {
  if (!item) return false;
  if (item.itemType === 'edge') return true;
  const type = item.type || '';
  return isShapeNodeType(type) || type === 'generic.text.textbox';
}

function normalizeBackgroundStyle(
  style: DiagramNodeData['backgroundStyle'] | undefined,
): ThemeProperties['backgroundStyle'] {
  if (style === 'gradient' || style === 'none' || style === 'mesh_gradient') return style;
  return 'solid';
}

/** Build theme properties from a selected shape or connection. */
export function themePropertiesFromSelection(item: SelectedItem): ThemeProperties {
  if (item.itemType === 'edge') {
    const lineColor = item.color ?? DEFAULT_THEME_PROPERTIES.lineColor!;
    return {
      ...DEFAULT_THEME_PROPERTIES,
      borderColor: lineColor,
      lineColor,
      lineWidth: item.lineWidth ?? DEFAULT_THEME_PROPERTIES.lineWidth,
    };
  }

  const node = item as DiagramNodeData;
  const vs = extractVisualStylingFromNode(node);
  const backgroundStyle = normalizeBackgroundStyle(vs.backgroundStyle);

  return {
    borderStyle: vs.borderStyle ?? 'solid',
    borderColor: vs.borderColor,
    borderColors: vs.borderColors ? [...vs.borderColors] : undefined,
    borderWidth: vs.borderWidth ?? 2,
    backgroundStyle,
    backgroundColor: vs.backgroundColor,
    backgroundColors: vs.backgroundColors ? [...vs.backgroundColors] : undefined,
    meshGradientPoints: vs.meshGradientPoints?.map((p) => ({ ...p })),
    backgroundOpacity: 1,
    lineStyle: 'solid',
    lineColor: (node as DiagramNodeData & { lineColor?: string }).lineColor ?? vs.borderColor ?? DEFAULT_THEME_PROPERTIES.lineColor,
    lineWidth: DEFAULT_THEME_PROPERTIES.lineWidth,
    lineOpacity: 1,
    shadow: vs.shadow ?? false,
    shadowColor: DEFAULT_THEME_PROPERTIES.shadowColor,
    shadowOpacity: DEFAULT_THEME_PROPERTIES.shadowOpacity,
    shadowBlur: DEFAULT_THEME_PROPERTIES.shadowBlur,
    textColor: node.textColor ?? DEFAULT_THEME_PROPERTIES.textColor,
    textOpacity: node.textOpacity ?? 1,
    textOutlineWidth: node.textOutlineWidth,
    textOutlineColor: node.textOutlineColor,
    textGlowBlur: node.textGlowBlur,
    textGlowColor: node.textGlowColor,
    fontFamily: node.fontFamily,
    fontSize: node.fontSize,
    fontWeight: node.fontWeight,
    fontStyle: node.fontStyle,
    textDecoration: node.textDecoration,
    textTransform: node.textTransform,
    letterSpacing: node.letterSpacing,
    lineHeight: node.lineHeight,
    gradientAngle: vs.gradientAngle ?? 135,
    borderGradientAngle: vs.borderGradientAngle ?? vs.gradientAngle ?? 135,
    roundedEdges: vs.roundedEdges,
  };
}

export function defaultNewThemeProperties(): ThemeProperties {
  return {
    ...DEFAULT_THEME_PROPERTIES,
    shadow: true,
    textColor: '#1e40af',
  };
}
