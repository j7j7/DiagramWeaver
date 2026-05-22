import type { CardElementData, CardElementStyle } from "@/lib/card-types";
import type { VisualStyling } from "@/lib/visual-styling";
import {
  CARD_BACKGROUND_VISUAL_KEYS,
  applyCardBackgroundVisual,
  cardBackgroundVisualFromElements,
  partitionCardVisualStylingPatch,
} from "@/lib/card-theme";

/** @deprecated use CARD_BACKGROUND_VISUAL_KEYS */
export const PROFILE_BODY_BG_VISUAL_KEYS = CARD_BACKGROUND_VISUAL_KEYS;

/** @deprecated use cardBackgroundVisualFromElements */
export function profileBodyVisualBackgroundFromElements(elements: CardElementData): ReturnType<
  typeof cardBackgroundVisualFromElements
> {
  return cardBackgroundVisualFromElements(elements, "profile-feature");
}

/** @deprecated use applyCardBackgroundVisual */
export function applyProfileBodyVisualBackground(
  elements: CardElementData,
  styling: Partial<VisualStyling>,
): CardElementData {
  return applyCardBackgroundVisual(elements, "profile-feature", styling);
}

/** @deprecated use partitionCardVisualStylingPatch */
export function partitionProfileCardVisualStylingPatch(styling: Record<string, unknown>): {
  bodyBackground: Partial<VisualStyling>;
  nodePatch: Record<string, unknown>;
} {
  const { cardBackground, nodePatch } = partitionCardVisualStylingPatch(styling);
  return { bodyBackground: cardBackground, nodePatch };
}

export const PROFILE_CARD_TEMPLATE_ID = "profile-feature";
export const PROFILE_HERO_ID = "hero";
export const PROFILE_BODY_ID = "body";
export const PROFILE_TITLE_ID = "title";
export const PROFILE_SUBTITLE_ID = "subtitle";

export function isProfileFeatureCard(templateId: string | undefined): boolean {
  return templateId === PROFILE_CARD_TEMPLATE_ID;
}

export function getProfileCardRegions(root: CardElementData | undefined): {
  hero: CardElementData | null;
  body: CardElementData | null;
  title: CardElementData | null;
  subtitle: CardElementData | null;
} {
  if (!root?.children?.length) {
    return { hero: null, body: null, title: null, subtitle: null };
  }
  const hero = root.children.find((c) => c.id === PROFILE_HERO_ID) ?? null;
  const body = root.children.find((c) => c.id === PROFILE_BODY_ID) ?? null;
  const title = body?.children?.find((c) => c.id === PROFILE_TITLE_ID) ?? null;
  const subtitle = body?.children?.find((c) => c.id === PROFILE_SUBTITLE_ID) ?? null;
  return { hero, body, title, subtitle };
}

function clampHeroPct(n: number): number {
  return Math.min(85, Math.max(15, n));
}

/** Read hero strip height as % of card (default 55). */
export function parseProfileHeroHeightPct(hero: CardElementData | null | undefined): number {
  if (typeof hero?.layout?.flex === "number" && Number.isFinite(hero.layout.flex) && hero.layout.flex > 0) {
    return clampHeroPct(hero.layout.flex);
  }
  const h = hero?.layout?.height;
  if (typeof h === "string" && h.endsWith("%")) {
    const n = parseFloat(h);
    if (Number.isFinite(n)) return clampHeroPct(n);
  }
  return 55;
}

function heroBodyFlexWeights(pct: number): { heroFlex: number; bodyFlex: number } {
  const heroFlex = clampHeroPct(pct);
  return { heroFlex, bodyFlex: 100 - heroFlex };
}

/** Apply hero/body split using flex-grow weights (reliable in column flex; avoids % height collapse). */
export function applyProfileHeroHeightPct(elements: CardElementData, pct: number): CardElementData {
  const { heroFlex, bodyFlex } = heroBodyFlexWeights(pct);
  let next = updateProfileElement(elements, PROFILE_HERO_ID, (child) => {
    const prev = child.layout ?? {};
    const { height: _dropH, minHeight: _dropMinH, flex: _dropFlex, ...rest } = prev;
    return {
      layout: {
        ...rest,
        flex: heroFlex,
        width: "100%",
        minHeight: 0,
      },
    };
  });
  next = updateProfileElement(next, PROFILE_BODY_ID, (child) => {
    const prev = child.layout ?? {};
    const { height: _dropH, minHeight: _dropMinH, flex: _dropFlex, ...rest } = prev;
    return {
      layout: {
        ...rest,
        flex: bodyFlex,
        minHeight: 0,
      },
    };
  });
  return next;
}

export function updateProfileElementStyle(
  elements: CardElementData,
  elementId: string,
  stylePatch: Partial<CardElementStyle>,
): CardElementData {
  return updateProfileElement(elements, elementId, (el) => ({
    style: { ...el.style, ...stylePatch },
  }));
}

function updateProfileElement(
  root: CardElementData,
  elementId: string,
  patch: Partial<CardElementData> | ((el: CardElementData) => Partial<CardElementData>),
): CardElementData {
  if (root.id === elementId) {
    const p = typeof patch === "function" ? patch(root) : patch;
    return {
      ...root,
      ...p,
      layout: p.layout !== undefined ? p.layout : root.layout,
      style: p.style !== undefined ? { ...root.style, ...p.style } : root.style,
    };
  }
  if (!root.children?.length) return root;
  return {
    ...root,
    children: root.children.map((child) => {
      if (child.id === elementId) {
        const p = typeof patch === "function" ? patch(child) : patch;
        return {
          ...child,
          ...p,
          layout: p.layout !== undefined ? p.layout : child.layout,
          style: p.style !== undefined ? { ...child.style, ...p.style } : child.style,
        };
      }
      if (child.id === PROFILE_BODY_ID && (elementId === PROFILE_TITLE_ID || elementId === PROFILE_SUBTITLE_ID)) {
        return {
          ...child,
          children: child.children?.map((gc) => {
            if (gc.id !== elementId) return gc;
            const p = typeof patch === "function" ? patch(gc) : patch;
            return { ...gc, ...p };
          }),
        };
      }
      return child;
    }),
  };
}
