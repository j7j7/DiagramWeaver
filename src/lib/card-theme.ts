import type { CardElementData, CardElementStyle } from "@/lib/card-types";
import type { ThemeProperties } from "@/lib/theme-types";
import {
  augmentGradientBackgroundPatch,
  deriveBackgroundGradientColors,
  type VisualStyling,
} from "@/lib/visual-styling";
import { multiplyLightnessOfColor, shiftHueOfColor } from "@/lib/color-shift";
import { DIAGRAM_THEME_HUE_STEP_DEG } from "@/lib/theme-manager";
import {
  findCardElement,
  getCardTemplateIdFromNodeType,
  isCardNodeType,
  mapCardElementTree,
  updateCardElementTree,
} from "@/lib/card-utils";
import {
  applyBulletListThemeColors,
  BULLET_LIST_TEMPLATE_ID,
  getBulletListItemTextColor,
} from "@/lib/card-bullet-list";
import {
  ELEMENT_FEATURE_TEMPLATE_ID,
  ELEMENT_FEATURE_TITLE_COLOR_DEFAULT,
  applyElementFeatureThemeColors,
  elementFeatureAccentFromTheme,
  elementFeatureRootStyleFromTheme,
} from "@/lib/card-element-feature";
import {
  FRAMED_HEADING_FILL_ID,
  FRAMED_HEADING_TEMPLATE_ID,
  applyFramedHeadingCardBackgroundVisual,
  applyFramedHeadingThemeColors,
  ensureFramedHeadingFrameFill,
  isFramedHeadingFillVisible,
  partitionFramedHeadingVisualStylingPatch,
} from "@/lib/card-framed-heading";

/** Profile Social theme apply — kept here to avoid card-theme ↔ card-profile-social import cycle. */
const PROFILE_SOCIAL_TEMPLATE_ID = "profile-social";
const PROFILE_DIAGONAL_SPLIT_TEMPLATE_ID = "profile-diagonal-split";
const PROFILE_DIAGONAL_AVATAR_ID = "avatar";
const PROFILE_SOCIAL_AVATAR_ID = "avatar";
const PROFILE_SOCIAL_DIVIDER_ID = "divider";
/** Lighten theme body stop slightly for card interior (same hue). */
const PROFILE_SOCIAL_BODY_LIGHTNESS_FACTOR = 1.1;
/** Darken theme accent stop for header strip (same hue, stronger contrast). */
const PROFILE_SOCIAL_HERO_LIGHTNESS_FACTOR = 0.78;
/** Muted divider from theme accent (same hue, lighter). */
const PROFILE_SOCIAL_DIVIDER_LIGHTNESS_FACTOR = 1.42;

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
  if (templateId === FRAMED_HEADING_TEMPLATE_ID) return FRAMED_HEADING_FILL_ID;
  return templateId === "profile-feature" ||
    templateId === "profile-social" ||
    templateId === "profile-diagonal-split"
    ? "body"
    : "root";
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

function cardStyleFromVisualBackground(
  styling: Partial<VisualStyling>,
  templateId?: string,
): Partial<CardElementStyle> {
  const style: Partial<CardElementStyle> = {};
  if (styling.backgroundStyle !== undefined) {
    const v = styling.backgroundStyle;
    if (v === "mesh_gradient") style.backgroundStyle = "mesh_gradient";
    else if (v === "none" || v === "solid" || v === "gradient") style.backgroundStyle = v;
    else if (v === "frosted") {
      style.backgroundStyle = "none";
    }
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
  if (bgStyle === "mesh_gradient") {
    const base = colorProps.backgroundColor ?? "#121212";
    const hubs =
      colorProps.meshGradientPoints ??
      properties.meshGradientPoints ??
      [];
    return {
      backgroundStyle: "mesh_gradient",
      backgroundColor: base,
      meshGradientPoints: hubs.length === 3 ? hubs.map((p) => ({ ...p })) : undefined,
    };
  }
  return {
    backgroundStyle: "solid",
    backgroundColor: colorProps.backgroundColor ?? "#f3f4f6",
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
  if (templateId === FRAMED_HEADING_TEMPLATE_ID) {
    return applyFramedHeadingCardBackgroundVisual(elements, styling);
  }
  const bgId = getCardBackgroundElementId(templateId);
  const prev = findCardElement(elements, bgId)?.style;
  const patch = cardStyleFromVisualBackground(styling, templateId);
  if (
    patch.backgroundStyle === "gradient" &&
    !patch.backgroundColors &&
    prev &&
    (prev.backgroundStyle === "solid" || prev.backgroundStyle === "mesh_gradient")
  ) {
    patch.backgroundColors = deriveBackgroundGradientColors({
      backgroundStyle: prev.backgroundStyle,
      backgroundColor: prev.backgroundColor,
      backgroundColors: prev.backgroundColors,
      meshGradientPoints: prev.meshGradientPoints,
    });
  }
  return updateCardElementStyleTree(elements, bgId, patch);
}

function cardClearNodeBackgroundPatch(): Record<string, unknown> {
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

/** Frosted shell fill is stored on the card node; the background region stays transparent. */
export function cardShellUsesFrostedInterior(
  node: { backgroundStyle?: string | null },
  fillStyle: CardElementStyle | undefined,
): boolean {
  return node.backgroundStyle === "frosted" && !isFramedHeadingFillVisible(fillStyle);
}

/** Visual styling panel read — node frosted wins when the card background region has no opaque fill. */
export function cardPanelBackgroundVisual(
  node: {
    backgroundStyle?: string | null;
    backgroundColor?: string;
    frostedDiffusion?: number;
    frostedTransparency?: number;
    frostedPerlinNoise?: number;
  },
  cardBg: CardBackgroundVisual,
): CardBackgroundVisual &
  Pick<VisualStyling, "frostedDiffusion" | "frostedTransparency" | "frostedPerlinNoise"> {
  if (cardShellUsesFrostedInterior(node, cardBg as CardElementStyle)) {
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

/**
 * Route a Visual styling panel patch onto a card: background fields update the
 * card background region; remaining fields stay on the node shell.
 * Non-cards pass `stylingObj` through unchanged.
 */
export function routeCardVisualStylingPatch(
  node: { type?: string; card?: { templateId?: string; elements?: CardElementData } },
  stylingObj: Record<string, unknown>,
): {
  cardElements?: CardElementData;
  stylingForNode: Record<string, unknown>;
} {
  const elements = node.card?.elements;
  if (!isCardNodeType(node.type) || !elements) {
    return { stylingForNode: stylingObj };
  }
  const cardTemplateId =
    node.card?.templateId ?? getCardTemplateIdFromNodeType(node.type) ?? undefined;
  const cardBg = cardBackgroundVisualFromElements(elements, cardTemplateId);
  const stylingInput = augmentGradientBackgroundPatch(cardBg, stylingObj);
  const { cardBackground, nodePatch } = partitionCardVisualStylingPatch(
    stylingInput,
    cardTemplateId,
  );
  let cardElements = elements;
  if (Object.keys(cardBackground).length > 0) {
    cardElements = applyCardBackgroundVisual(cardElements, cardTemplateId, cardBackground);
  }
  return { cardElements, stylingForNode: nodePatch };
}

/** Split visual styling patch: card background region vs shell/node fields. */
export function partitionCardVisualStylingPatch(
  styling: Record<string, unknown>,
  templateId?: string,
): {
  cardBackground: Partial<VisualStyling>;
  nodePatch: Record<string, unknown>;
} {
  if (templateId === FRAMED_HEADING_TEMPLATE_ID) {
    return partitionFramedHeadingVisualStylingPatch(styling);
  }

  if (styling.backgroundStyle === "frosted") {
    return {
      cardBackground: { backgroundStyle: "none" },
      nodePatch: { ...styling },
    };
  }

  if (styling.backgroundStyle === "none") {
    return {
      cardBackground: { backgroundStyle: "none" },
      nodePatch: cardClearNodeBackgroundPatch(),
    };
  }

  const cardBackground: Record<string, unknown> = {};
  const nodePatch = { ...styling };
  for (const k of CARD_BACKGROUND_VISUAL_KEYS) {
    if (k in styling) {
      cardBackground[k] = styling[k];
      delete nodePatch[k];
    }
  }
  return {
    cardBackground: cardBackground as Partial<VisualStyling>,
    nodePatch: { ...nodePatch, ...cardClearNodeBackgroundPatch() },
  };
}

function withMergedStyle(el: CardElementData, stylePatch: Partial<CardElementStyle>): CardElementData {
  return { ...el, style: { ...el.style, ...stylePatch } };
}

function profileSocialThemeAccentColor(colorProps: ThemeProperties, accentFallback: string): string {
  return (
    colorProps.backgroundColors?.[1] ??
    colorProps.borderColor ??
    colorProps.borderColors?.[0] ??
    accentFallback
  );
}

function profileSocialThemeBodyStyle(
  properties: ThemeProperties,
  colorProps: ThemeProperties,
): Partial<CardElementStyle> {
  const base = themeBackgroundToCardStyle(properties, colorProps);
  if (base.backgroundStyle === "gradient" && base.backgroundColors?.length === 2) {
    return {
      ...base,
      backgroundColors: [
        multiplyLightnessOfColor(base.backgroundColors[0], PROFILE_SOCIAL_BODY_LIGHTNESS_FACTOR),
        multiplyLightnessOfColor(base.backgroundColors[1], PROFILE_SOCIAL_BODY_LIGHTNESS_FACTOR),
      ],
    };
  }
  if (base.backgroundColor) {
    return {
      ...base,
      backgroundColor: multiplyLightnessOfColor(base.backgroundColor, PROFILE_SOCIAL_BODY_LIGHTNESS_FACTOR),
    };
  }
  return base;
}

function profileSocialThemeBodyRingColor(bodyStyle: Partial<CardElementStyle>): string {
  return bodyStyle.backgroundColor ?? bodyStyle.backgroundColors?.[0] ?? "#ffffff";
}

/** Apply diagram theme colours to card shell border + internal regions. */
export function applyThemeToCardElements(
  elements: CardElementData,
  templateId: string,
  properties: ThemeProperties,
  colorProps: ThemeProperties,
  options: {
    hueShiftDegrees?: number;
    hueStepDegrees?: number;
    stepHueWithinCard?: boolean;
  } = {},
): CardElementData {
  const hueShift = options.hueShiftDegrees ?? 0;
  const hueStep = options.hueStepDegrees ?? DIAGRAM_THEME_HUE_STEP_DEG;
  const stepWithin = options.stepHueWithinCard === true;
  const regionHueDelta = (index: number): number => (stepWithin ? index * hueStep : 0);
  const bgId = getCardBackgroundElementId(templateId);
  const isProfileSocial = templateId === PROFILE_SOCIAL_TEMPLATE_ID;
  const isProfileDiagonalSplit = templateId === PROFILE_DIAGONAL_SPLIT_TEMPLATE_ID;
  const isBulletList = templateId === BULLET_LIST_TEMPLATE_ID;
  const isElementFeature = templateId === ELEMENT_FEATURE_TEMPLATE_ID;
  const isFramedHeading = templateId === FRAMED_HEADING_TEMPLATE_ID;
  const chipBase = colorProps.backgroundColor ?? colorProps.backgroundColors?.[0] ?? "#93c5fd";
  const accentBase =
    colorProps.backgroundColors?.[1] ??
    colorProps.backgroundColors?.[0] ??
    colorProps.borderColor ??
    colorProps.backgroundColor ??
    "#3b82f6";

  const profileSocialBodyStyle = isProfileSocial
    ? profileSocialThemeBodyStyle(properties, colorProps)
    : null;
  const profileSocialHeroColor = isProfileSocial
    ? multiplyLightnessOfColor(
        profileSocialThemeAccentColor(colorProps, accentBase),
        PROFILE_SOCIAL_HERO_LIGHTNESS_FACTOR,
      )
    : null;
  const profileSocialDividerColor = isProfileSocial
    ? multiplyLightnessOfColor(
        profileSocialThemeAccentColor(colorProps, accentBase),
        PROFILE_SOCIAL_DIVIDER_LIGHTNESS_FACTOR,
      )
    : null;
  const profileSocialAvatarRingColor = profileSocialBodyStyle
    ? profileSocialThemeBodyRingColor(profileSocialBodyStyle)
    : "#ffffff";

  if (isFramedHeading) {
    let root = ensureFramedHeadingFrameFill(elements);
    root = updateCardElementStyleTree(
      root,
      FRAMED_HEADING_FILL_ID,
      themeBackgroundToCardStyle(properties, colorProps),
    );
    return applyFramedHeadingThemeColors(root, properties, colorProps, hueShift);
  }

  let root = updateCardElementStyleTree(
    elements,
    bgId,
    isElementFeature
      ? elementFeatureRootStyleFromTheme(properties, colorProps, hueShift)
      : profileSocialBodyStyle ?? themeBackgroundToCardStyle(properties, colorProps),
  );

  const borderBase =
    colorProps.borderColor ??
    (colorProps.borderColors && colorProps.borderColors.length > 0
      ? colorProps.borderColors[0]
      : undefined);

  let iconIndex = 0;
  let chipIndex = 0;

  root = mapCardElementTree(root, (el) => {
    if (el.id === bgId) return el;

    if (isProfileSocial && el.id === "hero" && profileSocialHeroColor) {
      return withMergedStyle(el, { backgroundColor: profileSocialHeroColor, backgroundStyle: "solid" });
    }

    if (isProfileSocial && el.id === PROFILE_SOCIAL_AVATAR_ID && profileSocialHeroColor) {
      return withMergedStyle(el, {
        backgroundColor: profileSocialHeroColor,
        backgroundStyle: "solid",
        borderColor: profileSocialAvatarRingColor,
        borderWidth: el.style?.borderWidth ?? 4,
        borderStyle: "solid",
      });
    }

    if (isProfileSocial && el.id === PROFILE_SOCIAL_DIVIDER_ID && profileSocialDividerColor) {
      return withMergedStyle(el, {
        backgroundColor: profileSocialDividerColor,
        backgroundStyle: "solid",
      });
    }

    if (isProfileDiagonalSplit && el.id === "hero") {
      const c0 = shiftHueOfColor(accentBase, hueShift);
      const c1 = shiftHueOfColor(accentBase, hueStep + hueShift);
      return withMergedStyle(el, {
        backgroundStyle: "gradient",
        backgroundColors: [c0, c1],
        gradientAngle: properties.gradientAngle ?? 135,
      });
    }

    if (isProfileDiagonalSplit && el.id === PROFILE_DIAGONAL_AVATAR_ID) {
      const color = shiftHueOfColor(accentBase, hueShift);
      const ring = profileSocialBodyStyle
        ? profileSocialThemeBodyRingColor(profileSocialBodyStyle)
        : themeBackgroundToCardStyle(properties, colorProps).backgroundColor ?? "#ffffff";
      return withMergedStyle(el, {
        backgroundColor: color,
        backgroundStyle: "solid",
        borderColor: ring,
        borderWidth: el.style?.borderWidth ?? 2,
        borderStyle: "solid",
      });
    }

    if (el.id === "hero" || (el.kind === "icon-slot" && !el.iconDecorGradient)) {
      const color = shiftHueOfColor(accentBase, regionHueDelta(iconIndex) + hueShift);
      iconIndex += 1;
      return withMergedStyle(el, { backgroundColor: color, backgroundStyle: "solid" });
    }

    if (el.kind === "text" && el.style?.backgroundColor && el.style.backgroundColor !== "transparent") {
      const color = shiftHueOfColor(chipBase, regionHueDelta(chipIndex) + hueShift);
      chipIndex += 1;
      return withMergedStyle(el, { backgroundColor: color, backgroundStyle: "solid" });
    }

    if (el.kind === "tag" && el.style?.backgroundColor) {
      const color = shiftHueOfColor(chipBase, regionHueDelta(chipIndex) + hueShift);
      chipIndex += 1;
      return withMergedStyle(el, { backgroundColor: color, backgroundStyle: "solid" });
    }

    if (el.kind === "section" && el.style?.backgroundColor && el.id !== bgId) {
      const color = shiftHueOfColor(chipBase, regionHueDelta(chipIndex) + hueShift);
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

  if (isElementFeature) {
    const accent = elementFeatureAccentFromTheme(colorProps, hueShift);
    const glowColor = colorProps.textGlowColor
      ? hueShift !== 0
        ? shiftHueOfColor(colorProps.textGlowColor, hueShift)
        : colorProps.textGlowColor
      : accent;
    const baseRaw =
      colorProps.backgroundColors?.[0] ??
      colorProps.backgroundColor ??
      "#121212";
    root = applyElementFeatureThemeColors(root, {
      accentColor: accent,
      glowColor,
      glowBlur: properties.textGlowBlur,
      titleColor: colorProps.textColor ?? ELEMENT_FEATURE_TITLE_COLOR_DEFAULT,
      watermarkFillColor: multiplyLightnessOfColor(baseRaw, 0.45),
    });
    return root;
  }

  if (colorProps.textColor || isBulletList) {
    if (isBulletList) {
      const bulletAccent =
        colorProps.borderColors?.[0] ??
        colorProps.borderColor ??
        accentBase;
      root = applyBulletListThemeColors(
        root,
        shiftHueOfColor(bulletAccent, hueShift),
        colorProps.textColor ?? getBulletListItemTextColor(root),
        { stepHueWithinCard: stepWithin, hueStepDeg: hueStep },
      );
    } else {
      root = mapCardElementTree(root, (el) => {
        if (el.kind === "text" || el.kind === "tag") {
          return { ...el, textColor: colorProps.textColor };
        }
        return el;
      });
    }
  }

  return root;
}
