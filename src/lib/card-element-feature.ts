import type { CSSProperties } from "react";
import type { CardElementData, CardElementStyle, CardLayoutBox } from "@/lib/card-types";
import type { ThemeProperties } from "@/lib/theme-types";
import { multiplyLightnessOfColor, shiftHueOfColor } from "@/lib/color-shift";
import { findCardElement, updateCardElementTree } from "@/lib/card-utils";

export const ELEMENT_FEATURE_TEMPLATE_ID = "element-feature";

export const ELEMENT_FEATURE_LABEL_ID = "label";
export const ELEMENT_FEATURE_TITLE_ID = "title";
export const ELEMENT_FEATURE_NUMBER_ID = "watermark-number";
/** @deprecated alias — element id kept for template swap compat */
export const ELEMENT_FEATURE_WATERMARK_ID = ELEMENT_FEATURE_NUMBER_ID;
export const ELEMENT_FEATURE_ACCENT_LINE_ID = "accent-line";
export const ELEMENT_FEATURE_CONTENT_ID = "content-col";

export const ELEMENT_FEATURE_ACCENT_DEFAULT = "#2ecc71";
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

function syncElementFeatureAccentElements(elements: CardElementData, accent: string): CardElementData {
  let next = elements;
  const label = findCardElement(next, ELEMENT_FEATURE_LABEL_ID);
  if (label) {
    next = updateCardElementTree(next, ELEMENT_FEATURE_LABEL_ID, {
      textColor: accent,
      textGlowColor: accent,
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

  next = syncElementFeatureAccentElements(next, options.accentColor);

  const title = findCardElement(next, ELEMENT_FEATURE_TITLE_ID);
  if (title) {
    next = updateCardElementTree(next, ELEMENT_FEATURE_TITLE_ID, {
      textColor: options.titleColor ?? ELEMENT_FEATURE_TITLE_COLOR_DEFAULT,
    });
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
  if (!isElementFeatureForegroundText(elementId, templateId)) return layout;
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
    width: layout?.width ?? "62%",
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

/** Large watermark text — absolute overlay behind content (right half, vertically centered). */
export function elementFeatureNumberSlotStyle(
  elementId: string,
  templateId: string | undefined,
  layout: CardLayoutBox | undefined,
): CSSProperties | undefined {
  if (!isElementFeatureWatermarkNumber(elementId, templateId)) return undefined;
  const width = typeof layout?.width === "string" ? layout.width : `${layout?.width ?? 62}%`;
  return {
    position: "absolute",
    top: 0,
    right: ELEMENT_FEATURE_WATERMARK_MARGIN_RIGHT,
    bottom: 0,
    width,
    height: "100%",
    zIndex: 0,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "flex-end",
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
