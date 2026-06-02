import type { CSSProperties } from "react";
import type { CardElementData, CardElementStyle, CardLayoutBox } from "@/lib/card-types";
import type { ThemeProperties } from "@/lib/theme-types";
import type { VisualStyling } from "@/lib/visual-styling";
import { multiplyLightnessOfColor, shiftHueOfColor } from "@/lib/color-shift";
import { MESH_GRADIENT_INITIAL_BASE_COLOR } from "@/lib/mesh-gradient";
import { findCardElement, updateCardElementTree } from "@/lib/card-utils";

const FRAMED_HEADING_CARD_BG_KEYS = [
  "backgroundStyle",
  "backgroundColor",
  "backgroundColors",
  "gradientAngle",
  "meshGradientPoints",
] as const;

export type FramedHeadingCardBackgroundVisual = Pick<
  VisualStyling,
  (typeof FRAMED_HEADING_CARD_BG_KEYS)[number]
>;

export const FRAMED_HEADING_TEMPLATE_ID = "framed-heading";

export const FRAMED_HEADING_ROOT_ID = "root";
/** Receives Visual styling / theme background (clipped to rounded shell). */
export const FRAMED_HEADING_FILL_ID = "frame-fill";
export const FRAMED_HEADING_TAB_ID = "heading-tab";
export const FRAMED_HEADING_TEXT_ID = "heading";

export type FramedHeadingEdge = "top" | "bottom";
export type FramedHeadingAlign = "left" | "center" | "right";
export type FramedHeadingTextAlign = "left" | "center" | "right";

export const FRAMED_HEADING_EDGE_DEFAULT: FramedHeadingEdge = "top";
export const FRAMED_HEADING_ALIGN_DEFAULT: FramedHeadingAlign = "center";
export const FRAMED_HEADING_TEXT_ALIGN_DEFAULT: FramedHeadingTextAlign = "center";

export const FRAMED_HEADING_TAB_GRADIENT: [string, string] = ["#2b6ca1", "#193661"];
export const FRAMED_HEADING_TEXT_COLOR_DEFAULT = "#ced7e3";

/** Default inset from left/right when tab is aligned to an edge (px). */
export const FRAMED_HEADING_EDGE_INSET_DEFAULT = 28;
export const FRAMED_HEADING_EDGE_INSET_MIN = 16;
export const FRAMED_HEADING_EDGE_INSET_MAX = 56;

export const FRAMED_HEADING_TAB_WIDTH_PCT_DEFAULT = 50;
export const FRAMED_HEADING_TAB_WIDTH_MIN = 15;
export const FRAMED_HEADING_TAB_WIDTH_MAX = 100;

/** Tab padding — fixed px; height grows when text wraps. */
export const FRAMED_HEADING_TAB_PAD_V = 6;
export const FRAMED_HEADING_TAB_PAD_H = 14;
export const FRAMED_HEADING_TAB_BORDER_RADIUS = 4;
export const FRAMED_HEADING_TAB_SHADOW = "0 4px 14px rgba(0, 0, 0, 0.32)";

/** Heading tab stacks above shell border ring and interior fill. */
export const FRAMED_HEADING_TAB_Z_INDEX = 20;

export function isFramedHeadingCard(templateId: string | undefined): boolean {
  return templateId === FRAMED_HEADING_TEMPLATE_ID;
}

export function isFramedHeadingTabSection(elementId: string, templateId: string | undefined): boolean {
  return isFramedHeadingCard(templateId) && elementId === FRAMED_HEADING_TAB_ID;
}

export function isFramedHeadingFillSection(elementId: string, templateId: string | undefined): boolean {
  return isFramedHeadingCard(templateId) && elementId === FRAMED_HEADING_FILL_ID;
}

export function isFramedHeadingRootSection(elementId: string, templateId: string | undefined): boolean {
  return isFramedHeadingCard(templateId) && elementId === FRAMED_HEADING_ROOT_ID;
}

export function getFramedHeadingRegions(root: CardElementData | undefined): {
  frameFill: CardElementData | null;
  headingTab: CardElementData | null;
  heading: CardElementData | null;
} {
  if (!root?.children?.length) {
    return { frameFill: null, headingTab: null, heading: null };
  }
  const frameFill = root.children.find((c) => c.id === FRAMED_HEADING_FILL_ID) ?? null;
  const headingTab = root.children.find((c) => c.id === FRAMED_HEADING_TAB_ID) ?? null;
  const heading = headingTab?.children?.find((c) => c.id === FRAMED_HEADING_TEXT_ID) ?? null;
  return { frameFill, headingTab, heading };
}

export function getFramedHeadingEdge(tab: CardElementData | null | undefined): FramedHeadingEdge {
  return tab?.framedHeadingEdge === "bottom" ? "bottom" : "top";
}

export function getFramedHeadingAlign(tab: CardElementData | null | undefined): FramedHeadingAlign {
  const a = tab?.framedHeadingAlign;
  if (a === "left" || a === "right" || a === "center") return a;
  return FRAMED_HEADING_ALIGN_DEFAULT;
}

export function getFramedHeadingTextAlign(heading: CardElementData | null | undefined): FramedHeadingTextAlign {
  const j = heading?.textJustify;
  if (j === "left" || j === "right" || j === "center") return j;
  return FRAMED_HEADING_TEXT_ALIGN_DEFAULT;
}

function clampEdgeInset(n: number): number {
  return Math.min(
    FRAMED_HEADING_EDGE_INSET_MAX,
    Math.max(FRAMED_HEADING_EDGE_INSET_MIN, Math.round(n)),
  );
}

function clampTabWidthPct(n: number): number {
  return Math.min(
    FRAMED_HEADING_TAB_WIDTH_MAX,
    Math.max(FRAMED_HEADING_TAB_WIDTH_MIN, Math.round(n)),
  );
}

export function parseFramedHeadingEdgeInset(tab: CardElementData | null | undefined): number {
  const v = tab?.framedHeadingEdgeInset;
  if (typeof v === "number" && Number.isFinite(v) && v > 0) {
    return clampEdgeInset(v);
  }
  return FRAMED_HEADING_EDGE_INSET_DEFAULT;
}

export function parseFramedHeadingTabWidthPct(tab: CardElementData | null | undefined): number {
  const v = tab?.framedHeadingTabWidthPct;
  if (typeof v === "number" && Number.isFinite(v) && v > 0) {
    return clampTabWidthPct(v);
  }
  return FRAMED_HEADING_TAB_WIDTH_PCT_DEFAULT;
}

export function applyFramedHeadingEdge(elements: CardElementData, edge: FramedHeadingEdge): CardElementData {
  const tab = findCardElement(elements, FRAMED_HEADING_TAB_ID);
  if (!tab) return elements;
  return updateCardElementTree(elements, FRAMED_HEADING_TAB_ID, { framedHeadingEdge: edge });
}

export function applyFramedHeadingAlign(
  elements: CardElementData,
  align: FramedHeadingAlign,
): CardElementData {
  const tab = findCardElement(elements, FRAMED_HEADING_TAB_ID);
  if (!tab) return elements;
  return updateCardElementTree(elements, FRAMED_HEADING_TAB_ID, { framedHeadingAlign: align });
}

export function applyFramedHeadingTextAlign(
  elements: CardElementData,
  align: FramedHeadingTextAlign,
): CardElementData {
  const heading = findCardElement(elements, FRAMED_HEADING_TEXT_ID);
  if (!heading) return elements;
  return updateCardElementTree(elements, FRAMED_HEADING_TEXT_ID, { textJustify: align });
}

export function applyFramedHeadingTabWidthPct(elements: CardElementData, widthPct: number): CardElementData {
  const tab = findCardElement(elements, FRAMED_HEADING_TAB_ID);
  if (!tab) return elements;
  return updateCardElementTree(elements, FRAMED_HEADING_TAB_ID, {
    framedHeadingTabWidthPct: clampTabWidthPct(widthPct),
  });
}

function clearFramedHeadingRootFill(
  elements: CardElementData,
  root: CardElementData,
): CardElementData {
  const needsClear =
    root.style?.backgroundStyle !== "none" ||
    root.style?.backgroundColor != null ||
    root.style?.backgroundColors != null ||
    root.style?.meshGradientPoints != null;
  if (!needsClear) return elements;
  return updateCardElementTree(elements, FRAMED_HEADING_ROOT_ID, {
    style: {
      ...root.style,
      backgroundStyle: "none",
      backgroundColor: undefined,
      backgroundColors: undefined,
      meshGradientPoints: undefined,
    },
  });
}

/** Ensure `frame-fill` exists and root stays transparent (legacy cards themed on root). */
export function ensureFramedHeadingFrameFill(elements: CardElementData): CardElementData {
  const root = findCardElement(elements, FRAMED_HEADING_ROOT_ID);
  if (!root) return elements;
  let next = clearFramedHeadingRootFill(elements, root);
  const rootAfter = findCardElement(next, FRAMED_HEADING_ROOT_ID)!;
  const existingFill = findCardElement(next, FRAMED_HEADING_FILL_ID);
  if (existingFill) {
    return next;
  }

  const migratedStyle =
    rootAfter.style?.backgroundStyle && rootAfter.style.backgroundStyle !== "none"
      ? { ...rootAfter.style }
      : { backgroundStyle: "none" as const };

  const frameFill: CardElementData = {
    id: FRAMED_HEADING_FILL_ID,
    kind: "section",
    layout: { flex: 0 },
    style: migratedStyle,
  };

  const otherChildren = (rootAfter.children ?? []).filter((c) => c.id !== FRAMED_HEADING_FILL_ID);
  return updateCardElementTree(next, FRAMED_HEADING_ROOT_ID, {
    children: [frameFill, ...otherChildren],
    style: {
      ...rootAfter.style,
      backgroundStyle: "none",
      backgroundColor: undefined,
      backgroundColors: undefined,
      meshGradientPoints: undefined,
    },
  });
}

/** Frosted interior is active only when the node says frosted and frame-fill has no opaque fill. */
export function framedHeadingUsesFrostedInterior(
  node: { backgroundStyle?: string | null },
  fillStyle: CardElementStyle | undefined,
): boolean {
  return node.backgroundStyle === "frosted" && !isFramedHeadingFillVisible(fillStyle);
}

/** Visual styling panel read — frame-fill wins over stale node frosted. */
export function framedHeadingPanelBackgroundVisual(
  node: {
    backgroundStyle?: string | null;
    backgroundColor?: string;
    frostedDiffusion?: number;
    frostedTransparency?: number;
    frostedPerlinNoise?: number;
  },
  cardBg: FramedHeadingCardBackgroundVisual,
): FramedHeadingCardBackgroundVisual &
  Pick<VisualStyling, "frostedDiffusion" | "frostedTransparency" | "frostedPerlinNoise"> {
  if (framedHeadingUsesFrostedInterior(node, cardBg as CardElementStyle)) {
    return {
      ...cardBg,
      backgroundStyle: "frosted",
      backgroundColor: node.backgroundColor ?? cardBg.backgroundColor,
      frostedDiffusion: node.frostedDiffusion,
      frostedTransparency: node.frostedTransparency,
      frostedPerlinNoise: node.frostedPerlinNoise,
    };
  }
  return cardBg;
}

function buildFramedHeadingFillStyle(
  prev: CardElementStyle | undefined,
  styling: Partial<VisualStyling>,
): CardElementStyle {
  if (styling.backgroundStyle === undefined) {
    return { ...prev, ...patchFramedHeadingFillStyleFields(prev, styling) };
  }
  const v = styling.backgroundStyle;
  if (v === "none") {
    return { backgroundStyle: "none" };
  }
  if (v === "solid") {
    return {
      backgroundStyle: "solid",
      backgroundColor:
        styling.backgroundColor ?? prev?.backgroundColor ?? "#f3f4f6",
    };
  }
  if (v === "gradient") {
    const colors =
      styling.backgroundColors ??
      prev?.backgroundColors ?? (["#3b82f6", "#1d4ed8"] as [string, string]);
    return {
      backgroundStyle: "gradient",
      backgroundColors: [colors[0], colors[1]],
      gradientAngle: styling.gradientAngle ?? prev?.gradientAngle ?? 135,
    };
  }
  if (v === "mesh_gradient") {
    return {
      backgroundStyle: "mesh_gradient",
      backgroundColor:
        styling.backgroundColor ?? prev?.backgroundColor ?? MESH_GRADIENT_INITIAL_BASE_COLOR,
      meshGradientPoints:
        styling.meshGradientPoints ?? prev?.meshGradientPoints,
    };
  }
  return prev ?? { backgroundStyle: "none" };
}

function patchFramedHeadingFillStyleFields(
  prev: CardElementStyle | undefined,
  styling: Partial<VisualStyling>,
): Partial<CardElementStyle> {
  const patch: Partial<CardElementStyle> = {};
  if (styling.backgroundColor !== undefined) patch.backgroundColor = styling.backgroundColor;
  if (styling.backgroundColors !== undefined) {
    patch.backgroundColors = styling.backgroundColors as [string, string];
  }
  if (styling.gradientAngle !== undefined) patch.gradientAngle = styling.gradientAngle;
  if (styling.meshGradientPoints !== undefined) {
    patch.meshGradientPoints = styling.meshGradientPoints;
  }
  return patch;
}

/** Apply Background accordion to `frame-fill` (replaces style when `backgroundStyle` changes). */
export function applyFramedHeadingCardBackgroundVisual(
  elements: CardElementData,
  styling: Partial<VisualStyling>,
): CardElementData {
  const fill = findCardElement(elements, FRAMED_HEADING_FILL_ID);
  if (!fill) return elements;
  const nextStyle = buildFramedHeadingFillStyle(fill.style, styling);
  return updateCardElementTree(elements, FRAMED_HEADING_FILL_ID, { style: nextStyle });
}

function framedHeadingClearNodeBackgroundPatch(): Record<string, unknown> {
  return {
    backgroundStyle: null,
    backgroundColor: null,
    backgroundColors: null,
    gradientAngle: null,
    meshGradientPoints: null,
    frostedDiffusion: null,
    frostedTransparency: null,
    frostedPerlinNoise: null,
  };
}

/** Split visual styling: frosted → node; all other fills → `frame-fill`. */
export function partitionFramedHeadingVisualStylingPatch(styling: Record<string, unknown>): {
  cardBackground: Partial<VisualStyling>;
  nodePatch: Record<string, unknown>;
} {
  if (styling.backgroundStyle === "frosted") {
    return {
      cardBackground: { backgroundStyle: "none" },
      nodePatch: { ...styling },
    };
  }

  if (styling.backgroundStyle === "none") {
    return {
      cardBackground: { backgroundStyle: "none" },
      nodePatch: framedHeadingClearNodeBackgroundPatch(),
    };
  }

  const cardBackground: Record<string, unknown> = {};
  const nodePatch: Record<string, unknown> = { ...styling };
  for (const k of FRAMED_HEADING_CARD_BG_KEYS) {
    if (k in styling) {
      cardBackground[k] = styling[k];
      delete nodePatch[k];
    }
  }
  return {
    cardBackground: cardBackground as Partial<VisualStyling>,
    nodePatch: { ...nodePatch, ...framedHeadingClearNodeBackgroundPatch() },
  };
}

/** Whether the card interior should paint a fill (border is on the shell). */
export function isFramedHeadingFillVisible(style: CardElementStyle | undefined): boolean {
  if (!style) return false;
  if (style.backgroundStyle === "none") return false;
  if (style.backgroundStyle === "gradient" && style.backgroundColors?.length === 2) return true;
  if (style.backgroundStyle === "mesh_gradient") return true;
  if (style.backgroundStyle === "solid" && style.backgroundColor && style.backgroundColor !== "transparent") {
    return true;
  }
  return false;
}

/** Primary stroke/accent from theme (shell border family). */
export function framedHeadingAccentFromTheme(
  colorProps: ThemeProperties,
  hueShift = 0,
): string {
  const raw =
    colorProps.borderColors?.[0] ??
    colorProps.borderColor ??
    colorProps.backgroundColors?.[1] ??
    colorProps.backgroundColors?.[0] ??
    colorProps.backgroundColor ??
    "#1e3a5f";
  return shiftHueOfColor(raw, hueShift);
}

/** Dark gradient tab fill derived from theme accent. */
export function framedHeadingTabStyleFromTheme(
  colorProps: ThemeProperties,
  properties: ThemeProperties,
  hueShift = 0,
): Partial<CardElementStyle> {
  const accent = framedHeadingAccentFromTheme(colorProps, hueShift);
  return {
    backgroundStyle: "gradient",
    backgroundColors: [
      multiplyLightnessOfColor(accent, 1.12),
      multiplyLightnessOfColor(accent, 0.38),
    ],
    gradientAngle: properties.gradientAngle ?? 180,
    borderColor: accent,
    borderWidth: 1,
    borderStyle: "solid",
  };
}

/** Heading label + glow on the tab. */
export function framedHeadingTextColorsFromTheme(
  colorProps: ThemeProperties,
  hueShift = 0,
): { textColor: string; textGlowColor: string } {
  const accent = framedHeadingAccentFromTheme(colorProps, hueShift);
  const textColor = multiplyLightnessOfColor(accent, 2.65);
  const textGlowColor =
    colorProps.textGlowColor != null
      ? hueShift !== 0
        ? shiftHueOfColor(colorProps.textGlowColor, hueShift)
        : colorProps.textGlowColor
      : textColor;
  return { textColor, textGlowColor };
}

/** Theme tab gradient, tab border, and heading text — frame fill handled by `card-theme`. */
export function applyFramedHeadingThemeColors(
  elements: CardElementData,
  properties: ThemeProperties,
  colorProps: ThemeProperties,
  hueShift = 0,
): CardElementData {
  const tab = findCardElement(elements, FRAMED_HEADING_TAB_ID);
  if (!tab) return elements;

  let next = updateCardElementTree(elements, FRAMED_HEADING_TAB_ID, {
    style: {
      ...tab.style,
      ...framedHeadingTabStyleFromTheme(colorProps, properties, hueShift),
    },
  });

  const heading = findCardElement(next, FRAMED_HEADING_TEXT_ID);
  if (heading) {
    const { textColor, textGlowColor } = framedHeadingTextColorsFromTheme(colorProps, hueShift);
    next = updateCardElementTree(next, FRAMED_HEADING_TEXT_ID, {
      textColor,
      textGlowColor,
      textGlowBlur: heading.textGlowBlur ?? properties.textGlowBlur ?? 5,
    });
  }

  return next;
}

export function updateFramedHeadingElementStyle(
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

export function resolveFramedHeadingTextLayout(
  elementId: string,
  templateId: string | undefined,
  layout: CardLayoutBox | undefined,
): CardLayoutBox | undefined {
  if (!isFramedHeadingCard(templateId) || elementId !== FRAMED_HEADING_TEXT_ID) return layout;
  return {
    ...layout,
    width: "100%",
    alignSelf: "stretch",
    padding: layout?.padding ?? [0, 0],
  };
}

export function framedHeadingRootLayerStyle(
  isRoot: boolean,
  templateId: string | undefined,
): CSSProperties | undefined {
  if (!isRoot || !isFramedHeadingCard(templateId)) return undefined;
  return { position: "relative", overflow: "visible" };
}

/** Root must stay transparent — theme fill lives on `frame-fill`. */
export function framedHeadingRootSectionStyle(
  elementId: string,
  templateId: string | undefined,
  style: CardElementStyle | undefined,
): CardElementStyle | undefined {
  if (!isFramedHeadingRootSection(elementId, templateId) || !style) return style;
  return { ...style, backgroundStyle: "none", backgroundColor: undefined, backgroundColors: undefined };
}

/** CSS clip for ShapeWrapper frosted stack (inner rounded rect, inset by border width). */
export function framedHeadingFrostedGlassClipPath(
  borderWidthPx: number,
  innerRadiusPx: number,
): string {
  const round = innerRadiusPx > 0 ? ` round ${innerRadiusPx}px` : "";
  if (borderWidthPx <= 0) return `inset(0${round})`;
  const b = borderWidthPx;
  return `inset(${b}px ${b}px ${b}px ${b}px${round})`;
}

/** Clipped interior fill matching the rounded card shell (theme / Background accordion). */
export function framedHeadingFillLayerStyle(
  elementId: string,
  templateId: string | undefined,
  cardShellInsetPx: number,
  cardShellInnerRadius: string,
): CSSProperties | undefined {
  if (!isFramedHeadingFillSection(elementId, templateId)) return undefined;
  /** `inset` only — `width`/`height` 100% with inset caused corner gaps (white L-shaped seam). */
  return {
    position: "absolute",
    inset: cardShellInsetPx,
    borderRadius: cardShellInnerRadius,
    overflow: "hidden",
    zIndex: 0,
    pointerEvents: "none",
    boxSizing: "border-box",
  };
}

/** Absolute tab on top/bottom border; width from slider (% of card). */
export function framedHeadingTabOverlayStyle(
  tab: CardElementData | null | undefined,
): CSSProperties {
  const edge = getFramedHeadingEdge(tab);
  const align = getFramedHeadingAlign(tab);
  const inset = parseFramedHeadingEdgeInset(tab);
  const widthPct = parseFramedHeadingTabWidthPct(tab);
  const style: CSSProperties = {
    position: "absolute",
    zIndex: FRAMED_HEADING_TAB_Z_INDEX,
    width: `${widthPct}%`,
    maxWidth: `calc(100% - ${inset * 2}px)`,
    boxSizing: "border-box",
    padding: `${FRAMED_HEADING_TAB_PAD_V}px ${FRAMED_HEADING_TAB_PAD_H}px`,
    borderRadius: FRAMED_HEADING_TAB_BORDER_RADIUS,
    boxShadow: FRAMED_HEADING_TAB_SHADOW,
    pointerEvents: "auto",
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    minWidth: 0,
  };
  if (edge === "top") {
    style.top = 0;
  } else {
    style.bottom = 0;
  }
  if (align === "left") {
    style.left = inset;
    style.transform = edge === "top" ? "translateY(-50%)" : "translateY(50%)";
  } else if (align === "right") {
    style.right = inset;
    style.transform = edge === "top" ? "translateY(-50%)" : "translateY(50%)";
  } else {
    style.left = "50%";
    style.transform =
      edge === "top" ? "translate(-50%, -50%)" : "translate(-50%, 50%)";
  }
  return style;
}
