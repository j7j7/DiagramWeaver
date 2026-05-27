import type { CardElementData, CardElementStyle } from "@/lib/card-types";
import type { ThemeProperties } from "@/lib/theme-types";
import type { VisualStyling } from "@/lib/visual-styling";
import { multiplyLightnessOfColor, shiftHueOfColor } from "@/lib/color-shift";
import { DIAGRAM_THEME_HUE_STEP_DEG } from "@/lib/theme-manager";
import { findCardElement, mapCardElementTree, updateCardElementTree } from "@/lib/card-utils";
import {
  applyBulletListThemeColors,
  BULLET_LIST_TEMPLATE_ID,
  getBulletListItemTextColor,
} from "@/lib/card-bullet-list";

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

  let root = updateCardElementStyleTree(
    elements,
    bgId,
    profileSocialBodyStyle ?? themeBackgroundToCardStyle(properties, colorProps),
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
