import type { CSSProperties } from "react";
import type { CardElementData, CardElementStyle, CardLayoutBox } from "@/lib/card-types";
import { findCardElement, updateCardElementTree } from "@/lib/card-utils";
import {
  PROFILE_BODY_ID,
  PROFILE_HERO_ID,
  applyProfileHeroHeightPct,
  parseProfileHeroHeightPct,
} from "@/lib/card-profile";

export const PROFILE_SOCIAL_TEMPLATE_ID = "profile-social";
export const PROFILE_SOCIAL_AVATAR_ID = "avatar";
export const PROFILE_SOCIAL_NAME_ID = "name";
export const PROFILE_SOCIAL_AGE_ID = "age";
export const PROFILE_SOCIAL_LOCATION_ID = "location";
export const PROFILE_SOCIAL_DESCRIPTION_ID = "description";
export const PROFILE_SOCIAL_FOOTER_ID = "footer";
export const PROFILE_SOCIAL_DIVIDER_ID = "divider";
export const PROFILE_SOCIAL_STATS_ID = "stats";
export const PROFILE_SOCIAL_STAT_VALUE_IDS = ["stat-1-value", "stat-2-value", "stat-3-value"] as const;
export const PROFILE_SOCIAL_STAT_LABEL_IDS = ["stat-1-label", "stat-2-label", "stat-3-label"] as const;

const DEFAULT_AVATAR_SIZE = 56;
const MIN_AVATAR_SIZE = 40;
const MAX_AVATAR_SIZE = 88;

export function isProfileSocialCard(templateId: string | undefined): boolean {
  return templateId === PROFILE_SOCIAL_TEMPLATE_ID;
}

export function getProfileSocialRegions(root: CardElementData | undefined): {
  hero: CardElementData | null;
  body: CardElementData | null;
  avatar: CardElementData | null;
  name: CardElementData | null;
  age: CardElementData | null;
  location: CardElementData | null;
  description: CardElementData | null;
  footer: CardElementData | null;
  divider: CardElementData | null;
  stats: CardElementData | null;
  statValues: CardElementData[];
  statLabels: CardElementData[];
} {
  if (!root?.children?.length) {
    return {
      hero: null,
      body: null,
      avatar: null,
      name: null,
      age: null,
      location: null,
      description: null,
      footer: null,
      divider: null,
      stats: null,
      statValues: [],
      statLabels: [],
    };
  }

  const hero = root.children.find((c) => c.id === PROFILE_HERO_ID) ?? null;
  const body = root.children.find((c) => c.id === PROFILE_BODY_ID) ?? null;
  const avatar = body?.children?.find((c) => c.id === PROFILE_SOCIAL_AVATAR_ID) ?? null;
  const info = body?.children?.find((c) => c.id === "info") ?? null;
  const nameRow = info?.children?.find((c) => c.id === "name-row") ?? null;
  const name = nameRow?.children?.find((c) => c.id === PROFILE_SOCIAL_NAME_ID) ?? null;
  const age = nameRow?.children?.find((c) => c.id === PROFILE_SOCIAL_AGE_ID) ?? null;
  const location = info?.children?.find((c) => c.id === PROFILE_SOCIAL_LOCATION_ID) ?? null;
  const description = body?.children?.find((c) => c.id === PROFILE_SOCIAL_DESCRIPTION_ID) ?? null;
  const footer = body?.children?.find((c) => c.id === PROFILE_SOCIAL_FOOTER_ID) ?? null;
  const divider =
    footer?.children?.find((c) => c.id === PROFILE_SOCIAL_DIVIDER_ID) ??
    body?.children?.find((c) => c.id === PROFILE_SOCIAL_DIVIDER_ID) ??
    null;
  const stats =
    footer?.children?.find((c) => c.id === PROFILE_SOCIAL_STATS_ID) ??
    body?.children?.find((c) => c.id === PROFILE_SOCIAL_STATS_ID) ??
    null;

  const statValues = PROFILE_SOCIAL_STAT_VALUE_IDS.map(
    (id) => stats?.children?.find((c) => c.id === id) ?? null,
  ).filter((el): el is CardElementData => el != null);
  const statLabels = PROFILE_SOCIAL_STAT_LABEL_IDS.map(
    (id) => stats?.children?.find((c) => c.id === id) ?? null,
  ).filter((el): el is CardElementData => el != null);

  return { hero, body, avatar, name, age, location, description, footer, divider, stats, statValues, statLabels };
}

export { applyProfileHeroHeightPct, parseProfileHeroHeightPct, PROFILE_HERO_ID, PROFILE_BODY_ID };

function clampAvatarSize(n: number): number {
  return Math.min(MAX_AVATAR_SIZE, Math.max(MIN_AVATAR_SIZE, Math.round(n)));
}

/** Read avatar slot size in px (default 56). */
export function parseProfileSocialAvatarSize(avatar: CardElementData | null | undefined): number {
  const w = avatar?.layout?.width;
  if (typeof w === "number" && Number.isFinite(w) && w > 0) {
    return clampAvatarSize(w);
  }
  return DEFAULT_AVATAR_SIZE;
}

function avatarOverlapMargin(sizePx: number): number {
  return -Math.round(sizePx / 2);
}

/** Apply square avatar dimensions and overlap margin. */
export function applyProfileSocialAvatarSize(elements: CardElementData, sizePx: number): CardElementData {
  const size = clampAvatarSize(sizePx);
  const avatar = findCardElement(elements, PROFILE_SOCIAL_AVATAR_ID);
  if (!avatar) return elements;
  return updateCardElementTree(elements, PROFILE_SOCIAL_AVATAR_ID, {
    layout: {
      ...avatar.layout,
      width: size,
      height: size,
      flex: 0,
      marginTop: avatarOverlapMargin(size),
    },
  });
}

export function updateProfileSocialElementStyle(
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

export function resolveProfileSocialAvatarLayout(
  elementId: string,
  templateId: string | undefined,
  layout: CardLayoutBox | undefined,
): CardLayoutBox | undefined {
  if (templateId !== PROFILE_SOCIAL_TEMPLATE_ID || elementId !== PROFILE_SOCIAL_AVATAR_ID) {
    return layout;
  }
  const size = parseProfileSocialAvatarSize({ id: elementId, kind: "icon-slot", layout });
  return {
    ...layout,
    alignSelf: "center",
    marginTop: layout?.marginTop ?? avatarOverlapMargin(size),
    zIndex: layout?.zIndex ?? 2,
  };
}

export function resolveProfileSocialBodySectionLayout(
  elementId: string,
  templateId: string | undefined,
  layout: CardLayoutBox | undefined,
): CardLayoutBox | undefined {
  if (templateId !== PROFILE_SOCIAL_TEMPLATE_ID || elementId !== PROFILE_BODY_ID) {
    return layout;
  }
  return {
    ...layout,
    flexDirection: layout?.flexDirection ?? "column",
    alignItems: layout?.alignItems ?? "center",
    flex: layout?.flex ?? 62,
    minHeight: 0,
    width: layout?.width ?? "100%",
  };
}

/** Footer (divider + stats) stays pinned to the bottom when the card grows taller. */
export function resolveProfileSocialFooterSectionLayout(
  elementId: string,
  templateId: string | undefined,
  layout: CardLayoutBox | undefined,
): CardLayoutBox | undefined {
  if (templateId !== PROFILE_SOCIAL_TEMPLATE_ID || elementId !== PROFILE_SOCIAL_FOOTER_ID) {
    return layout;
  }
  return {
    ...layout,
    flexDirection: layout?.flexDirection ?? "column",
    width: layout?.width ?? "100%",
    alignSelf: "stretch",
    flex: 0,
    minHeight: 0,
  };
}

/** Multiline description grows between location and the stats footer. */
export function resolveProfileSocialDescriptionLayout(
  elementId: string,
  templateId: string | undefined,
  layout: CardLayoutBox | undefined,
): CardLayoutBox | undefined {
  if (templateId !== PROFILE_SOCIAL_TEMPLATE_ID || elementId !== PROFILE_SOCIAL_DESCRIPTION_ID) {
    return layout;
  }
  return {
    padding: [4, 8],
    ...layout,
    width: "100%",
    flex: 1,
    minHeight: 0,
    flexDirection: "column",
    justifyContent: "start",
    alignSelf: "stretch",
    fillRemaining: true,
    overflow: "hidden",
  };
}

export function resolveProfileSocialTextLayout(
  elementId: string,
  templateId: string | undefined,
  layout: CardLayoutBox | undefined,
): CardLayoutBox | undefined {
  return resolveProfileSocialDescriptionLayout(elementId, templateId, layout);
}

export function resolveProfileSocialSectionLayout(
  elementId: string,
  templateId: string | undefined,
  layout: CardLayoutBox | undefined,
): CardLayoutBox | undefined {
  return (
    resolveProfileSocialBodySectionLayout(elementId, templateId, layout) ??
    resolveProfileSocialFooterSectionLayout(elementId, templateId, layout)
  );
}

export function resolveProfileSocialTextStyle(
  elementId: string,
  templateId: string | undefined,
): CSSProperties | undefined {
  if (templateId !== PROFILE_SOCIAL_TEMPLATE_ID) return undefined;
  const centeredIds = new Set<string>([
    PROFILE_SOCIAL_NAME_ID,
    PROFILE_SOCIAL_AGE_ID,
    PROFILE_SOCIAL_LOCATION_ID,
    PROFILE_SOCIAL_DESCRIPTION_ID,
    ...PROFILE_SOCIAL_STAT_VALUE_IDS,
    ...PROFILE_SOCIAL_STAT_LABEL_IDS,
  ]);
  if (!centeredIds.has(elementId)) return undefined;
  return { textAlign: "center" };
}
