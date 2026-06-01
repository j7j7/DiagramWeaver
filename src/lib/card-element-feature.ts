import type { CSSProperties } from "react";
import type { CardElementData, CardElementStyle, CardLayoutBox, NodeCardSpec } from "@/lib/card-types";
import type { DiagramNodeData, MeshGradientPoint } from "@/lib/types";
import type { ThemeProperties } from "@/lib/theme-types";
import { colorToRgba, multiplyLightnessOfColor, shiftHueOfColor } from "@/lib/color-shift";
import { findCardElement, updateCardElementTree } from "@/lib/card-utils";

export const ELEMENT_FEATURE_TEMPLATE_ID = "element-feature";

export const ELEMENT_FEATURE_LABEL_ID = "label";
export const ELEMENT_FEATURE_TITLE_ID = "title";
export const ELEMENT_FEATURE_NUMBER_ID = "watermark-number";
/** @deprecated alias — element id kept for template swap compat */
export const ELEMENT_FEATURE_WATERMARK_ID = ELEMENT_FEATURE_NUMBER_ID;
export const ELEMENT_FEATURE_ACCENT_LINE_ID = "accent-line";
export const ELEMENT_FEATURE_CONTENT_ID = "content-col";

export const ELEMENT_FEATURE_ACCENT_DEFAULT = "#a78bfa";
export const ELEMENT_FEATURE_ACCENT_AMBER = "#9a3412";
export const ELEMENT_FEATURE_TITLE_COLOR_DEFAULT = "#ffffff";
/** Inset for the large watermark from the card's right edge (px). */
export const ELEMENT_FEATURE_WATERMARK_MARGIN_RIGHT = 10;

const DEFAULT_NUMBER_FONT_SIZE = 130;
const MIN_NUMBER_FONT_SIZE = 72;
const MAX_NUMBER_FONT_SIZE = 220;

const DEFAULT_ACCENT_LINE_WIDTH_PCT = 78;
const MIN_ACCENT_LINE_WIDTH_PCT = 30;
const MAX_ACCENT_LINE_WIDTH_PCT = 100;

const DEFAULT_ACCENT_LINE_HEIGHT = 2;
const MIN_ACCENT_LINE_HEIGHT = 1;
const MAX_ACCENT_LINE_HEIGHT = 6;

export function isElementFeatureCard(templateId: string | undefined): boolean {
  return templateId === ELEMENT_FEATURE_TEMPLATE_ID;
}

export function isElementFeatureAccentLine(elementId: string, templateId: string | undefined): boolean {
  return isElementFeatureCard(templateId) && elementId === ELEMENT_FEATURE_ACCENT_LINE_ID;
}

export function isElementFeatureWatermarkNumber(elementId: string, templateId: string | undefined): boolean {
  return isElementFeatureCard(templateId) && elementId === ELEMENT_FEATURE_NUMBER_ID;
}

export function isElementFeatureForegroundText(elementId: string, templateId: string | undefined): boolean {
  return (
    isElementFeatureCard(templateId) &&
    (elementId === ELEMENT_FEATURE_LABEL_ID || elementId === ELEMENT_FEATURE_TITLE_ID)
  );
}

/** Subtitle, title, and watermark — full-width rows so textJustify controls alignment. */
export function isElementFeatureAlignableText(elementId: string, templateId: string | undefined): boolean {
  return (
    isElementFeatureCard(templateId) &&
    (elementId === ELEMENT_FEATURE_LABEL_ID ||
      elementId === ELEMENT_FEATURE_TITLE_ID ||
      elementId === ELEMENT_FEATURE_NUMBER_ID)
  );
}

export function getElementFeatureRegions(root: CardElementData | undefined): {
  label: CardElementData | null;
  title: CardElementData | null;
  watermark: CardElementData | null;
  accentLine: CardElementData | null;
} {
  if (!root?.children?.length) {
    return { label: null, title: null, watermark: null, accentLine: null };
  }
  const contentCol = root.children.find((c) => c.id === ELEMENT_FEATURE_CONTENT_ID) ?? null;
  const watermark = root.children.find((c) => c.id === ELEMENT_FEATURE_NUMBER_ID) ?? null;
  return {
    label: contentCol?.children?.find((c) => c.id === ELEMENT_FEATURE_LABEL_ID) ?? null,
    title: contentCol?.children?.find((c) => c.id === ELEMENT_FEATURE_TITLE_ID) ?? null,
    watermark,
    accentLine: contentCol?.children?.find((c) => c.id === ELEMENT_FEATURE_ACCENT_LINE_ID) ?? null,
  };
}

function clampNumberFontSize(n: number): number {
  return Math.min(MAX_NUMBER_FONT_SIZE, Math.max(MIN_NUMBER_FONT_SIZE, Math.round(n)));
}

function clampAccentLineWidthPct(n: number): number {
  return Math.min(MAX_ACCENT_LINE_WIDTH_PCT, Math.max(MIN_ACCENT_LINE_WIDTH_PCT, Math.round(n)));
}

function clampAccentLineHeight(n: number): number {
  return Math.min(MAX_ACCENT_LINE_HEIGHT, Math.max(MIN_ACCENT_LINE_HEIGHT, Math.round(n)));
}

function parsePercentDim(v: number | string | undefined, fallback: number): number {
  if (typeof v === "string" && v.endsWith("%")) {
    const n = parseFloat(v);
    if (Number.isFinite(n) && n > 0) return clampAccentLineWidthPct(n);
  }
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return clampAccentLineWidthPct(v);
  return fallback;
}

export function parseElementFeatureWatermarkFontSize(watermark: CardElementData | null | undefined): number {
  const raw = watermark?.fontSize;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return clampNumberFontSize(raw);
  }
  return DEFAULT_NUMBER_FONT_SIZE;
}

/** @deprecated use parseElementFeatureWatermarkFontSize */
export const parseElementFeatureNumberFontSize = parseElementFeatureWatermarkFontSize;

export function applyElementFeatureWatermarkText(elements: CardElementData, text: string): CardElementData {
  const watermark = findCardElement(elements, ELEMENT_FEATURE_NUMBER_ID);
  if (!watermark) return elements;
  return updateCardElementTree(elements, ELEMENT_FEATURE_NUMBER_ID, {
    text,
    richText: undefined,
  });
}

export function applyElementFeatureWatermarkFontSize(elements: CardElementData, fontSize: number): CardElementData {
  const size = clampNumberFontSize(fontSize);
  const watermark = findCardElement(elements, ELEMENT_FEATURE_NUMBER_ID);
  if (!watermark) return elements;
  return updateCardElementTree(elements, ELEMENT_FEATURE_NUMBER_ID, { fontSize: size });
}

/** @deprecated use applyElementFeatureWatermarkFontSize */
export const applyElementFeatureNumberFontSize = applyElementFeatureWatermarkFontSize;

export function parseElementFeatureAccentLineWidthPct(accentLine: CardElementData | null | undefined): number {
  return parsePercentDim(accentLine?.layout?.width, DEFAULT_ACCENT_LINE_WIDTH_PCT);
}

export function parseElementFeatureAccentLineHeight(accentLine: CardElementData | null | undefined): number {
  const h = accentLine?.layout?.height;
  if (typeof h === "number" && Number.isFinite(h) && h > 0) {
    return clampAccentLineHeight(h);
  }
  return DEFAULT_ACCENT_LINE_HEIGHT;
}

export function applyElementFeatureAccentLineWidth(
  elements: CardElementData,
  widthPct: number,
): CardElementData {
  const accentLine = findCardElement(elements, ELEMENT_FEATURE_ACCENT_LINE_ID);
  if (!accentLine) return elements;
  const w = clampAccentLineWidthPct(widthPct);
  return updateCardElementTree(elements, ELEMENT_FEATURE_ACCENT_LINE_ID, {
    layout: { ...accentLine.layout, width: `${w}%`, flex: 0, alignSelf: "start" },
  });
}

export function applyElementFeatureAccentLineHeight(
  elements: CardElementData,
  heightPx: number,
): CardElementData {
  const accentLine = findCardElement(elements, ELEMENT_FEATURE_ACCENT_LINE_ID);
  if (!accentLine) return elements;
  const h = clampAccentLineHeight(heightPx);
  return updateCardElementTree(elements, ELEMENT_FEATURE_ACCENT_LINE_ID, {
    layout: { ...accentLine.layout, height: h, flex: 0 },
  });
}

/** Default alpha for the card shell constant highlight glow (matches palette preset). */
export const ELEMENT_FEATURE_CONSTANT_GLOW_ALPHA = 0.2;

/** Shell highlight glow for constant mode — derived from theme text glow or accent. */
export function elementFeatureConstantGlowColor(
  colorProps: ThemeProperties,
  hueShift = 0,
): string {
  const accent = elementFeatureAccentFromTheme(colorProps, hueShift);
  const glowSource = colorProps.textGlowColor
    ? hueShift !== 0
      ? shiftHueOfColor(colorProps.textGlowColor, hueShift)
      : colorProps.textGlowColor
    : accent;
  return colorToRgba(glowSource, ELEMENT_FEATURE_CONSTANT_GLOW_ALPHA);
}

/**
 * Theme apply for element-feature shell glow: always stores `highlightAnimGlowColor`;
 * never turns highlight anim on. Visible constant glow changes only when already enabled.
 */
export function applyElementFeatureThemeHighlightGlow(
  colorProps: ThemeProperties,
  hueShift = 0,
): { highlightAnimGlowColor: string } {
  return {
    highlightAnimGlowColor: elementFeatureConstantGlowColor(colorProps, hueShift),
  };
}

/** Theme / node shell accent — line color preferred (matches card border accent). */
export function elementFeatureAccentFromTheme(
  colorProps: ThemeProperties,
  hueShift = 0,
): string {
  const raw =
    colorProps.lineColor ??
    colorProps.borderColors?.[0] ??
    colorProps.borderColor ??
    colorProps.textColor ??
    ELEMENT_FEATURE_ACCENT_DEFAULT;
  return hueShift !== 0 ? shiftHueOfColor(raw, hueShift) : raw;
}

/** Read the accent used for glow, outline, and fade line (label text color is canonical). */
export function resolveElementFeatureAccentColor(
  elements: CardElementData | undefined,
  nodeLineColor?: string,
  fallback = ELEMENT_FEATURE_ACCENT_DEFAULT,
): string {
  const label = elements ? getElementFeatureRegions(elements).label : null;
  if (label?.textColor) return label.textColor;
  if (label?.textGlowColor) return label.textGlowColor;
  if (nodeLineColor) return nodeLineColor;
  return fallback;
}

export function resolveElementFeatureAccentLineStyle(
  elements: CardElementData | undefined,
  nodeLineColor: string | undefined,
  baseStyle: CardElementStyle | undefined,
  fallback = ELEMENT_FEATURE_ACCENT_DEFAULT,
): CardElementStyle {
  const accent = resolveElementFeatureAccentColor(elements, nodeLineColor, fallback);
  return {
    ...baseStyle,
    backgroundStyle: "gradient",
    backgroundColors: [accent, "transparent"],
    gradientAngle: baseStyle?.gradientAngle ?? 90,
  };
}

function syncElementFeatureAccentElements(
  elements: CardElementData,
  accent: string,
  glowColor: string = accent,
): CardElementData {
  let next = elements;
  const label = findCardElement(next, ELEMENT_FEATURE_LABEL_ID);
  if (label) {
    next = updateCardElementTree(next, ELEMENT_FEATURE_LABEL_ID, {
      textColor: accent,
      textGlowColor: glowColor,
    });
  }
  const watermark = findCardElement(next, ELEMENT_FEATURE_NUMBER_ID);
  if (watermark) {
    next = updateCardElementTree(next, ELEMENT_FEATURE_NUMBER_ID, {
      textOutlineColor: accent,
      textGlowColor: accent,
    });
  }
  const accentLine = findCardElement(next, ELEMENT_FEATURE_ACCENT_LINE_ID);
  if (accentLine) {
    next = updateCardElementTree(next, ELEMENT_FEATURE_ACCENT_LINE_ID, {
      style: resolveElementFeatureAccentLineStyle(next, undefined, accentLine.style, accent),
    });
  }
  return next;
}

/** Mesh / dark root fill derived from theme background + accent hubs. */
export function elementFeatureRootStyleFromTheme(
  _properties: ThemeProperties,
  colorProps: ThemeProperties,
  hueShift = 0,
): Partial<CardElementStyle> {
  const accent = elementFeatureAccentFromTheme(colorProps, hueShift);
  const baseRaw =
    colorProps.backgroundColors?.[0] ??
    colorProps.backgroundColor ??
    "#121212";
  const base = multiplyLightnessOfColor(baseRaw, 0.32);

  return {
    backgroundStyle: "mesh_gradient",
    backgroundColor: base,
    meshGradientPoints: [
      { xPct: 88, yPct: 12, color: multiplyLightnessOfColor(accent, 0.5) },
      { xPct: 55, yPct: 45, color: multiplyLightnessOfColor(shiftHueOfColor(accent, 12), 0.28) },
      { xPct: 15, yPct: 85, color: multiplyLightnessOfColor(base, 1.15) },
    ],
  };
}

/** Apply diagram theme to subtitle glow, title, watermark, accent line, and root mesh. */
export function applyElementFeatureThemeColors(
  elements: CardElementData,
  options: {
    accentColor: string;
    /** Theme text glow colour — subtitle + title glow (defaults to accent). */
    glowColor?: string;
    glowBlur?: number;
    titleColor?: string;
    watermarkFillColor?: string;
    rootStyle?: Partial<CardElementStyle>;
  },
): CardElementData {
  let next = elements;
  const rootEl = findCardElement(next, "root");
  if (options.rootStyle && rootEl) {
    next = updateCardElementTree(next, "root", {
      style: { ...rootEl.style, ...options.rootStyle },
    });
  }

  const glowColor = options.glowColor ?? options.accentColor;
  next = syncElementFeatureAccentElements(next, options.accentColor, glowColor);

  const title = findCardElement(next, ELEMENT_FEATURE_TITLE_ID);
  if (title) {
    const titlePatch: Partial<CardElementData> = {
      textColor: options.titleColor ?? ELEMENT_FEATURE_TITLE_COLOR_DEFAULT,
    };
    if (options.glowColor !== undefined) {
      titlePatch.textGlowColor = options.glowColor;
    }
    if (options.glowBlur !== undefined) {
      titlePatch.textGlowBlur = options.glowBlur;
    }
    next = updateCardElementTree(next, ELEMENT_FEATURE_TITLE_ID, titlePatch);
  }

  const watermark = findCardElement(next, ELEMENT_FEATURE_NUMBER_ID);
  if (watermark && options.watermarkFillColor) {
    next = updateCardElementTree(next, ELEMENT_FEATURE_NUMBER_ID, {
      textColor: options.watermarkFillColor,
    });
  }

  return next;
}

/** Sync accent across label glow, watermark outline/glow, and fade line. */
export function applyElementFeatureAccentColor(elements: CardElementData, color: string): CardElementData {
  return syncElementFeatureAccentElements(elements, color);
}

export function updateElementFeatureElementStyle(
  elements: CardElementData,
  elementId: string,
  stylePatch: Partial<CardElementStyle>,
): CardElementData {
  const el = findCardElement(elements, elementId);
  if (!el) return elements;
  return updateCardElementTree(elements, elementId, {
    style: { ...el.style, ...stylePatch },
  });
}

export function resolveElementFeatureTextLayout(
  elementId: string,
  templateId: string | undefined,
  layout: CardLayoutBox | undefined,
): CardLayoutBox | undefined {
  if (!isElementFeatureAlignableText(elementId, templateId)) return layout;
  return {
    ...layout,
    width: "100%",
    alignSelf: "stretch",
    padding: 0,
    flex: 0,
  };
}

export function resolveElementFeatureContentColLayout(
  elementId: string,
  templateId: string | undefined,
  layout: CardLayoutBox | undefined,
): CardLayoutBox | undefined {
  if (!isElementFeatureCard(templateId) || elementId !== ELEMENT_FEATURE_CONTENT_ID) return layout;
  return {
    ...layout,
    flexDirection: layout?.flexDirection ?? "column",
    flex: layout?.flex ?? 1,
    minWidth: 0,
    width: layout?.width ?? "100%",
    justifyContent: layout?.justifyContent ?? "center",
    alignItems: layout?.alignItems ?? "stretch",
    zIndex: layout?.zIndex ?? 1,
  };
}

export function resolveElementFeatureAccentLineLayout(
  elementId: string,
  templateId: string | undefined,
  layout: CardLayoutBox | undefined,
): CardLayoutBox | undefined {
  if (!isElementFeatureAccentLine(elementId, templateId)) return layout;
  const w = parsePercentDim(layout?.width, DEFAULT_ACCENT_LINE_WIDTH_PCT);
  const h = parseElementFeatureAccentLineHeight({ id: elementId, kind: "decor", layout });
  return {
    ...layout,
    width: `${w}%`,
    height: h,
    flex: 0,
    alignSelf: "start",
  };
}

export function resolveElementFeatureNumberLayout(
  elementId: string,
  templateId: string | undefined,
  layout: CardLayoutBox | undefined,
): CardLayoutBox | undefined {
  if (!isElementFeatureWatermarkNumber(elementId, templateId)) return layout;
  return {
    ...layout,
    width: "100%",
    height: layout?.height ?? "100%",
    flex: 0,
  };
}

export function elementFeatureRootStyle(
  isRoot: boolean,
  templateId: string | undefined,
): CSSProperties | undefined {
  if (!isRoot || !isElementFeatureCard(templateId)) return undefined;
  return { position: "relative" };
}

export function elementFeatureContentSectionStyle(
  elementId: string,
  templateId: string | undefined,
): CSSProperties | undefined {
  if (!isElementFeatureCard(templateId) || elementId !== ELEMENT_FEATURE_CONTENT_ID) return undefined;
  return { position: "relative", zIndex: 1, pointerEvents: "none" };
}

export function elementFeatureEditablePointerStyle(
  templateId: string | undefined,
  element: Pick<CardElementData, "id" | "kind">,
): CSSProperties | undefined {
  if (!isElementFeatureForegroundText(element.id, templateId)) return undefined;
  if (element.kind === "text" || element.kind === "tag") {
    return { pointerEvents: "auto", position: "relative", zIndex: 2 };
  }
  return undefined;
}

export function elementFeatureWatermarkPointerStyle(
  elementId: string,
  templateId: string | undefined,
): CSSProperties | undefined {
  if (!isElementFeatureWatermarkNumber(elementId, templateId)) return undefined;
  return { pointerEvents: "auto", zIndex: 0 };
}

/** Large watermark text — full-width absolute overlay behind content; align via textJustify. */
export function elementFeatureNumberSlotStyle(
  elementId: string,
  templateId: string | undefined,
  _layout: CardLayoutBox | undefined,
): CSSProperties | undefined {
  if (!isElementFeatureWatermarkNumber(elementId, templateId)) return undefined;
  return {
    position: "absolute",
    top: 0,
    left: 0,
    right: ELEMENT_FEATURE_WATERMARK_MARGIN_RIGHT,
    bottom: 0,
    width: "100%",
    height: "100%",
    zIndex: 0,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "stretch",
    overflow: "hidden",
    padding: 0,
    margin: 0,
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: "auto",
    minHeight: 0,
    minWidth: 0,
  };
}

export const ELEMENT_FEATURE_NUMBER_FONT_MIN = MIN_NUMBER_FONT_SIZE;
export const ELEMENT_FEATURE_NUMBER_FONT_MAX = MAX_NUMBER_FONT_SIZE;
export const ELEMENT_FEATURE_ACCENT_LINE_WIDTH_MIN = MIN_ACCENT_LINE_WIDTH_PCT;
export const ELEMENT_FEATURE_ACCENT_LINE_WIDTH_MAX = MAX_ACCENT_LINE_WIDTH_PCT;
export const ELEMENT_FEATURE_ACCENT_LINE_HEIGHT_MIN = MIN_ACCENT_LINE_HEIGHT;
export const ELEMENT_FEATURE_ACCENT_LINE_HEIGHT_MAX = MAX_ACCENT_LINE_HEIGHT;

export interface ElementFeatureRootVariant {
  backgroundColor: string;
  meshGradientPoints: MeshGradientPoint[];
  accentColor: string;
  watermarkTextColor: string;
  titleColor?: string;
}

export interface ElementFeaturePaletteDropVariant {
  nodeProps: Partial<DiagramNodeData>;
  root: ElementFeatureRootVariant;
}

/** Violet mesh preset (original element-feature palette default). */
export const ELEMENT_FEATURE_VARIANT_VIOLET: ElementFeaturePaletteDropVariant = {
  nodeProps: {
    sizeMode: "custom",
    borderStyle: "gradient",
    borderColors: ["#6d28d9", "#5320ac"],
    borderWidth: 1,
    backgroundStyle: "none",
    lineStyle: "solid",
    lineColor: "#2ecc71",
    lineWidth: 2.5,
    lineOpacity: 1,
    shadow: true,
    shadowColor: "#000000",
    shadowOpacity: 0.55,
    shadowBlur: 12,
    textColor: "#ede9fe",
    textOpacity: 1,
    gradientAngle: 115,
    textJustify: "left",
    cornerRadius: 0.12,
    borderColor: "#6d28d9",
    textGlowBlur: 14,
    textGlowColor: "#c4b5fd",
    borderGradientAngle: 225,
    highlightAnim: true,
    highlightAnimMode: "constant",
    highlightAnimGlowColor: "rgba(140, 79, 255, 0.2)",
    highlightAnimGlowIntensity: 0.36,
  } as Partial<DiagramNodeData>,
  root: {
    backgroundColor: "#030206",
    meshGradientPoints: [
      { xPct: 88, yPct: 12, color: "#3508ba" },
      { xPct: 55, yPct: 45, color: "#320568" },
      { xPct: 15, yPct: 85, color: "#030207" },
    ],
    accentColor: ELEMENT_FEATURE_ACCENT_DEFAULT,
    watermarkTextColor: "#040309",
  },
};

/** Amber mesh preset — random palette alternative on canvas drop. */
export const ELEMENT_FEATURE_VARIANT_AMBER: ElementFeaturePaletteDropVariant = {
  nodeProps: {
    sizeMode: "custom",
    borderStyle: "gradient",
    borderColors: ["#c2410c", "#b45309"],
    borderWidth: 1,
    backgroundStyle: "none",
    lineStyle: "solid",
    lineColor: "#2ecc71",
    lineWidth: 2.5,
    lineOpacity: 1,
    shadow: true,
    shadowColor: "#000000",
    shadowOpacity: 0.55,
    shadowBlur: 12,
    textColor: "#7c2d12",
    textOpacity: 1,
    gradientAngle: 60,
    textJustify: "left",
    cornerRadius: 0.12,
    borderColor: "#c2410c",
    textGlowBlur: 14,
    textGlowColor: "#c4b5fd",
    borderGradientAngle: 225,
    highlightAnim: true,
    highlightAnimMode: "constant",
    highlightAnimGlowColor: "rgba(154, 52, 18, 0.2)",
    highlightAnimGlowIntensity: 0.36,
  } as Partial<DiagramNodeData>,
  root: {
    backgroundColor: "#9d5700",
    meshGradientPoints: [
      { xPct: 88, yPct: 12, color: "#4d1a09" },
      { xPct: 55, yPct: 45, color: "#2b1605" },
      { xPct: 15, yPct: 85, color: "#b56400" },
    ],
    accentColor: ELEMENT_FEATURE_ACCENT_AMBER,
    watermarkTextColor: "#dd7b00",
  },
};

const ELEMENT_FEATURE_DROP_VARIANTS: ElementFeaturePaletteDropVariant[] = [
  ELEMENT_FEATURE_VARIANT_VIOLET,
  ELEMENT_FEATURE_VARIANT_AMBER,
];

function cloneElementFeatureTree(root: CardElementData): CardElementData {
  return structuredClone(root);
}

export function pickRandomElementFeatureDropVariant(): ElementFeaturePaletteDropVariant {
  const index = Math.floor(Math.random() * ELEMENT_FEATURE_DROP_VARIANTS.length);
  return ELEMENT_FEATURE_DROP_VARIANTS[index] ?? ELEMENT_FEATURE_VARIANT_VIOLET;
}

export function buildElementFeatureRoot(variant: ElementFeatureRootVariant): CardElementData {
  const accent = variant.accentColor;
  const titleColor = variant.titleColor ?? ELEMENT_FEATURE_TITLE_COLOR_DEFAULT;
  return {
    id: "root",
    kind: "section",
    layout: {
      flexDirection: "column",
      width: "100%",
      height: "100%",
      padding: [20, 22],
      gap: 0,
      overflow: "hidden",
    },
    style: {
      backgroundColor: variant.backgroundColor,
      backgroundStyle: "mesh_gradient",
      meshGradientPoints: variant.meshGradientPoints.map((p) => ({ ...p })),
    },
    children: [
      {
        id: "watermark-number",
        kind: "text",
        text: "03",
        editable: true,
        fontSize: 130,
        fontWeight: "700",
        textColor: variant.watermarkTextColor,
        textOpacity: 0.55,
        textOutlineWidth: 1.5,
        textOutlineColor: accent,
        textGlowBlur: 14,
        textGlowColor: accent,
        textJustify: "right",
        lineHeight: 1,
        layout: { width: "62%", height: "100%", flex: 0 },
        style: { backgroundStyle: "none" },
        richText: [
          {
            text: "03",
            lineJustify: "right",
            lineFontSize: 130,
            lineFontWeight: "700",
          },
        ],
      },
      {
        id: "content-col",
        kind: "section",
        layout: {
          flexDirection: "column",
          flex: 1,
          gap: 10,
          justifyContent: "center",
          alignItems: "stretch",
          minWidth: 0,
          width: "100%",
          zIndex: 1,
        },
        children: [
          {
            id: "label",
            kind: "text",
            text: "02 - Section heading",
            editable: true,
            fontSize: 10,
            fontWeight: "600",
            textTransform: "uppercase",
            letterSpacing: 1,
            lineHeight: 1.35,
            textColor: accent,
            textGlowBlur: 10,
            textGlowColor: accent,
            layout: { width: "100%", alignSelf: "stretch", padding: 0, flex: 0 },
            style: { backgroundStyle: "none" },
            richText: [
              {
                text: "02 - Section heading",
                lineJustify: "left",
                lineFontSize: 10,
                lineFontWeight: "600",
              },
            ],
          },
          {
            id: "title",
            kind: "text",
            text: "context",
            editable: true,
            fontSize: 36,
            fontWeight: "700",
            textColor: titleColor,
            lineHeight: 1.05,
            layout: { width: "100%", alignSelf: "stretch", padding: 0, flex: 0 },
            style: { backgroundStyle: "none" },
            richText: [
              {
                text: "context",
                lineJustify: "left",
                lineFontSize: 36,
                lineFontWeight: "700",
              },
            ],
          },
          {
            id: "accent-line",
            kind: "decor",
            placeholder: "rect",
            layout: { width: "78%", height: 2, flex: 0, alignSelf: "start" },
            style: {
              backgroundStyle: "gradient",
              backgroundColors: [accent, "transparent"],
              gradientAngle: 90,
              borderRadius: 1,
            },
          },
        ],
      },
    ],
  };
}

/** Random violet or amber preset when dropping element-feature from the palette. */
export function createElementFeaturePaletteDrop(): Partial<DiagramNodeData> & { card: NodeCardSpec } {
  const variant = pickRandomElementFeatureDropVariant();
  return {
    ...variant.nodeProps,
    card: {
      templateId: ELEMENT_FEATURE_TEMPLATE_ID,
      elements: cloneElementFeatureTree(buildElementFeatureRoot(variant.root)),
    },
  };
}
