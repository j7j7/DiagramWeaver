import type { CardElementData, CardElementStyle, CardLayoutBox } from "@/lib/card-types";
import { findCardElement, updateCardElementTree } from "@/lib/card-utils";
import { isDetailPostCard } from "@/lib/card-detail-post";
import { isDashboardStatCard } from "@/lib/card-dashboard-stat";
import { isListItemRowCard } from "@/lib/card-list-item";
import { isAgendaCard } from "@/lib/card-agenda";
import { isBulletListCard } from "@/lib/card-bullet-list";
import { isProfileSocialCard } from "@/lib/card-profile-social";
import { isProfileDiagonalSplitCard } from "@/lib/card-profile-diagonal-split";
import { isSidebarAccentCard } from "@/lib/card-sidebar-accent";
import { isElementFeatureCard } from "@/lib/card-element-feature";
import { isFramedHeadingCard } from "@/lib/card-framed-heading";
import { isIconBorderCard } from "@/lib/card-icon-border";

export const COMPACT_HORIZONTAL_TEMPLATE_ID = "compact-horizontal";
export const COMPACT_AVATAR_ID = "avatar";
export const COMPACT_TEXT_COL_ID = "text-col";
export const COMPACT_NAME_ID = "name";
export const COMPACT_STATUS_ID = "status";

const DEFAULT_AVATAR_SIZE = 44;
const MIN_AVATAR_SIZE = 28;
const MAX_AVATAR_SIZE = 72;

const COMPACT_TEXT_SEGMENT_PADDING: CardLayoutBox["padding"] = [4, 10];

/** Name and status segments share the full text column width. */
export function resolveCompactHorizontalTextLayout(
  elementId: string,
  templateId: string | undefined,
  layout: CardLayoutBox | undefined,
): CardLayoutBox | undefined {
  if (!isCompactHorizontalCard(templateId)) return layout;
  if (elementId !== COMPACT_NAME_ID && elementId !== COMPACT_STATUS_ID) return layout;
  return {
    ...layout,
    width: "100%",
    alignSelf: "stretch",
    padding: layout?.padding ?? COMPACT_TEXT_SEGMENT_PADDING,
  };
}

export function resolveCompactHorizontalTextColLayout(
  elementId: string,
  templateId: string | undefined,
  layout: CardLayoutBox | undefined,
): CardLayoutBox | undefined {
  if (!isCompactHorizontalCard(templateId) || elementId !== COMPACT_TEXT_COL_ID) return layout;
  return {
    ...layout,
    flexDirection: layout?.flexDirection ?? "column",
    flex: layout?.flex ?? 1,
    minWidth: 0,
    alignItems: "stretch",
  };
}

export function isCompactHorizontalCard(templateId: string | undefined): boolean {
  return templateId === COMPACT_HORIZONTAL_TEMPLATE_ID;
}

export function cardTemplateHasDedicatedPropertiesPanel(templateId: string | undefined): boolean {
  return (
    templateId === "profile-feature" ||
    isProfileSocialCard(templateId) ||
    isProfileDiagonalSplitCard(templateId) ||
    isCompactHorizontalCard(templateId) ||
    isListItemRowCard(templateId) ||
    isDetailPostCard(templateId) ||
    isDashboardStatCard(templateId) ||
    isAgendaCard(templateId) ||
    isBulletListCard(templateId) ||
    isSidebarAccentCard(templateId) ||
    isElementFeatureCard(templateId) ||
    isFramedHeadingCard(templateId) ||
    isIconBorderCard(templateId)
  );
}

export function getCompactHorizontalRegions(root: CardElementData | undefined): {
  avatar: CardElementData | null;
  name: CardElementData | null;
  status: CardElementData | null;
} {
  if (!root?.children?.length) {
    return { avatar: null, name: null, status: null };
  }
  const avatar = root.children.find((c) => c.id === COMPACT_AVATAR_ID) ?? null;
  const textCol = root.children.find((c) => c.id === COMPACT_TEXT_COL_ID) ?? null;
  const name = textCol?.children?.find((c) => c.id === COMPACT_NAME_ID) ?? null;
  const status = textCol?.children?.find((c) => c.id === COMPACT_STATUS_ID) ?? null;
  return { avatar, name, status };
}

function clampAvatarSize(n: number): number {
  return Math.min(MAX_AVATAR_SIZE, Math.max(MIN_AVATAR_SIZE, Math.round(n)));
}

/** Read avatar slot size in px (default 44). */
export function parseCompactAvatarSize(avatar: CardElementData | null | undefined): number {
  const w = avatar?.layout?.width;
  if (typeof w === "number" && Number.isFinite(w) && w > 0) {
    return clampAvatarSize(w);
  }
  return DEFAULT_AVATAR_SIZE;
}

/** Apply square avatar dimensions. */
export function applyCompactAvatarSize(elements: CardElementData, sizePx: number): CardElementData {
  const size = clampAvatarSize(sizePx);
  const avatar = findCardElement(elements, COMPACT_AVATAR_ID);
  if (!avatar) return elements;
  return updateCardElementTree(elements, COMPACT_AVATAR_ID, {
    layout: {
      ...avatar.layout,
      width: size,
      height: size,
      flex: 0,
    },
  });
}

export function updateCompactElementStyle(
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
