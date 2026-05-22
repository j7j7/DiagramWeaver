import type { CardElementData, CardElementStyle } from "@/lib/card-types";
import type { ThemeProperties } from "@/lib/theme-types";
import type { VisualStyling } from "@/lib/visual-styling";
import { shiftHueOfColor } from "@/lib/color-shift";
import { DIAGRAM_THEME_HUE_STEP_DEG } from "@/lib/theme-manager";
import { findCardElement, updateCardElementTree } from "@/lib/card-utils";

export const CARD_BACKGROUND_VISUAL_KEYS = [
  "backgroundStyle",
  "backgroundColor",
  "backgroundColors",
  "gradientAngle",
  "meshGradientPoints",
] as const;

export type CardBackgroundVisual = Pick<
  VisualStyling,
  (typeof CARD_BACKGROUND_VISUAL_KEYS)[number]
>;

/** Element id that receives Visual styling → Background for each card template. */
export function getCardBackgroundElementId(templateId: string | undefined): string {
  return templateId === "profile-feature" ? "body" : "root";
}

export function updateCardElementStyleTree(
  root: CardElementData,
  elementId: string,
  stylePatch: Partial<CardElementStyle>,
): CardElementData {
  const el = findCardElement(root, elementId);
  if (!el) return root;
  return updateCardElementTree(root, elementId, {
    style: { ...el.style, ...stylePatch },
  });
}

function cardStyleFromVisualBackground(styling: Partial<VisualStyling>): Partial<CardElementStyle> {
  const style: Partial<CardElementStyle> = {};
  if (styling.backgroundStyle !== undefined) {
    const v = styling.backgroundStyle;
    if (v === "mesh_gradient") style.backgroundStyle = "mesh_gradient";
    else if (v === "none" || v === "solid" || v === "gradient") style.backgroundStyle = v;
    else if (v === "frosted") style.backgroundStyle = "solid";
  }
  if (styling.backgroundColor !== undefined) style.backgroundColor = styling.backgroundColor;
  if (styling.backgroundColors !== undefined) {
    style.backgroundColors = styling.backgroundColors as [string, string];
  }
  if (styling.gradientAngle !== undefined) style.gradientAngle = styling.gradientAngle;
  if (styling.meshGradientPoints !== undefined) {
    style.meshGradientPoints = styling.meshGradientPoints;
  }
  return style;
}

function themeBackgroundToCardStyle(
  properties: ThemeProperties,
  colorProps: ThemeProperties,
): Partial<CardElementStyle> {
  const bgStyle = properties.backgroundStyle ?? "solid";
  if (bgStyle === "none") {
    return { backgroundStyle: "none", backgroundColor: "transparent" };
  }
  if (bgStyle === "gradient" && colorProps.backgroundColors && colorProps.backgroundColors.length >= 2) {
    return {
      backgroundStyle: "gradient",
      backgroundColors: [colorProps.backgroundColors[0], colorProps.backgroundColors[1]],
      gradientAngle: properties.gradientAngle ?? 135,
    };
  }
  return {
    backgroundStyle: "solid",
    backgroundColor: colorProps.backgroundColor ?? "#f3f4f6",
  };
}

function mapCardElementTree(
  root: CardElementData,
  mapFn: (el: CardElementData) => CardElementData,
): CardElementData {
  const mapped = mapFn(root);
  if (!mapped.children?.length) return mapped;
  return {
    ...mapped,
    children: mapped.children.map((child) => mapCardElementTree(child, mapFn)),
  };
}

/** Read Background accordion values from the card's background region element. */
export function cardBackgroundVisualFromElements(
  elements: CardElementData,
  templateId: string | undefined,
): CardBackgroundVisual {
  const bgId = getCardBackgroundElementId(templateId);
  const el = findCardElement(elements, bgId);
  const s = el?.style;
  if (!s) {
    return { backgroundStyle: "solid", backgroundColor: "#f3f4f6" };
  }
  const bgStyle = s.backgroundStyle ?? "solid";
  return {
    backgroundStyle:
      bgStyle === "mesh_gradient"
        ? ("mesh_gradient" as const)
        : bgStyle === "gradient"
          ? ("gradient" as const)
          : bgStyle === "none"
            ? ("none" as const)
            : ("solid" as const),
    backgroundColor: s.backgroundColor,
    backgroundColors: s.backgroundColors,
    gradientAngle: s.gradientAngle,
    meshGradientPoints: s.meshGradientPoints,
  };
}

/** Apply Visual styling Background changes to the card background region. */
export function applyCardBackgroundVisual(
  elements: CardElementData,
  templateId: string | undefined,
  styling: Partial<VisualStyling>,
): CardElementData {
  const bgId = getCardBackgroundElementId(templateId);
  return updateCardElementStyleTree(elements, bgId, cardStyleFromVisualBackground(styling));
}

/** Split visual styling patch: card background region vs shell/node fields. */
export function partitionCardVisualStylingPatch(styling: Record<string, unknown>): {
  cardBackground: Partial<VisualStyling>;
  nodePatch: Record<string, unknown>;
} {
  const cardBackground: Record<string, unknown> = {};
  const nodePatch = { ...styling };
  for (const k of CARD_BACKGROUND_VISUAL_KEYS) {
    if (k in styling) {
      cardBackground[k] = styling[k];
      delete nodePatch[k];
    }
  }
  return { cardBackground: cardBackground as Partial<VisualStyling>, nodePatch };
}

function withMergedStyle(el: CardElementData, stylePatch: Partial<CardElementStyle>): CardElementData {
  return { ...el, style: { ...el.style, ...stylePatch } };
}

/** Apply diagram theme colours to card shell border + internal regions. */
export function applyThemeToCardElements(
  elements: CardElementData,
  templateId: string,
  properties: ThemeProperties,
  colorProps: ThemeProperties,
  options: { hueShiftDegrees?: number; hueStepDegrees?: number } = {},
): CardElementData {
  const hueShift = options.hueShiftDegrees ?? 0;
  const hueStep = options.hueStepDegrees ?? DIAGRAM_THEME_HUE_STEP_DEG;
  const bgId = getCardBackgroundElementId(templateId);

  let root = updateCardElementStyleTree(
    elements,
    bgId,
    themeBackgroundToCardStyle(properties, colorProps),
  );

  const accentBase =
    colorProps.backgroundColors?.[1] ??
    colorProps.backgroundColors?.[0] ??
    colorProps.borderColor ??
    colorProps.backgroundColor ??
    "#3b82f6";
  const chipBase = colorProps.backgroundColor ?? colorProps.backgroundColors?.[0] ?? "#93c5fd";
  const borderBase =
    colorProps.borderColor ??
    (colorProps.borderColors && colorProps.borderColors.length > 0
      ? colorProps.borderColors[0]
      : undefined);

  let iconIndex = 0;
  let chipIndex = 0;

  root = mapCardElementTree(root, (el) => {
    if (el.id === bgId) return el;

    if (el.id === "hero" || el.kind === "icon-slot") {
      const color = shiftHueOfColor(accentBase, iconIndex * hueStep + hueShift);
      iconIndex += 1;
      return withMergedStyle(el, { backgroundColor: color, backgroundStyle: "solid" });
    }

    if (el.kind === "text" && el.style?.backgroundColor && el.style.backgroundColor !== "transparent") {
      const color = shiftHueOfColor(chipBase, chipIndex * hueStep + hueShift);
      chipIndex += 1;
      return withMergedStyle(el, { backgroundColor: color, backgroundStyle: "solid" });
    }

    if (el.kind === "tag" && el.style?.backgroundColor) {
      const color = shiftHueOfColor(chipBase, chipIndex * hueStep + hueShift);
      chipIndex += 1;
      return withMergedStyle(el, { backgroundColor: color, backgroundStyle: "solid" });
    }

    if (el.kind === "section" && el.style?.backgroundColor && el.id !== bgId) {
      const color = shiftHueOfColor(chipBase, chipIndex * hueStep + hueShift);
      chipIndex += 1;
      let next = withMergedStyle(el, { backgroundColor: color, backgroundStyle: "solid" });
      if (borderBase && el.style.borderWidth) {
        next = withMergedStyle(next, {
          borderColor: borderBase,
          borderStyle: el.style.borderStyle ?? "solid",
          borderWidth: el.style.borderWidth,
        });
      }
      return next;
    }

    if (el.kind === "text" && el.style?.borderColor && borderBase) {
      return withMergedStyle(el, { borderColor: borderBase });
    }

    return el;
  });

  if (colorProps.textColor) {
    root = mapCardElementTree(root, (el) => {
      if (el.kind === "text" || el.kind === "tag") {
        return { ...el, textColor: colorProps.textColor };
      }
      return el;
    });
  }

  return root;
}
