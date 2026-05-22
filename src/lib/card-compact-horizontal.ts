import type { CardElementData, CardElementStyle } from "@/lib/card-types";
import { findCardElement, updateCardElementTree } from "@/lib/card-utils";

export const COMPACT_HORIZONTAL_TEMPLATE_ID = "compact-horizontal";
export const COMPACT_AVATAR_ID = "avatar";
export const COMPACT_TEXT_COL_ID = "text-col";
export const COMPACT_NAME_ID = "name";
export const COMPACT_STATUS_ID = "status";

const DEFAULT_AVATAR_SIZE = 44;
const MIN_AVATAR_SIZE = 28;
const MAX_AVATAR_SIZE = 72;

export function isCompactHorizontalCard(templateId: string | undefined): boolean {
  return templateId === COMPACT_HORIZONTAL_TEMPLATE_ID;
}

export function cardTemplateHasDedicatedPropertiesPanel(templateId: string | undefined): boolean {
  return templateId === "profile-feature" || isCompactHorizontalCard(templateId);
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
