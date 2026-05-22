import type { CardElementData, CardElementStyle } from "@/lib/card-types";
import { findCardElement, updateCardElementTree } from "@/lib/card-utils";

export const LIST_ITEM_ROW_TEMPLATE_ID = "list-item-row";
export const LIST_ITEM_INDICATOR_ID = "indicator";
export const LIST_ITEM_LABEL_ID = "label";

const DEFAULT_INDICATOR_SIZE = 20;
const MIN_INDICATOR_SIZE = 12;
const MAX_INDICATOR_SIZE = 40;

export function isListItemRowCard(templateId: string | undefined): boolean {
  return templateId === LIST_ITEM_ROW_TEMPLATE_ID;
}

export function getListItemRowRegions(root: CardElementData | undefined): {
  indicator: CardElementData | null;
  label: CardElementData | null;
} {
  if (!root?.children?.length) {
    return { indicator: null, label: null };
  }
  const indicator = root.children.find((c) => c.id === LIST_ITEM_INDICATOR_ID) ?? null;
  const label = root.children.find((c) => c.id === LIST_ITEM_LABEL_ID) ?? null;
  return { indicator, label };
}

function clampIndicatorSize(n: number): number {
  return Math.min(MAX_INDICATOR_SIZE, Math.max(MIN_INDICATOR_SIZE, Math.round(n)));
}

/** Read indicator slot size in px (default 20). */
export function parseListItemIndicatorSize(indicator: CardElementData | null | undefined): number {
  const w = indicator?.layout?.width;
  if (typeof w === "number" && Number.isFinite(w) && w > 0) {
    return clampIndicatorSize(w);
  }
  return DEFAULT_INDICATOR_SIZE;
}

/** Apply square indicator dimensions. */
export function applyListItemIndicatorSize(elements: CardElementData, sizePx: number): CardElementData {
  const size = clampIndicatorSize(sizePx);
  const indicator = findCardElement(elements, LIST_ITEM_INDICATOR_ID);
  if (!indicator) return elements;
  return updateCardElementTree(elements, LIST_ITEM_INDICATOR_ID, {
    layout: {
      ...indicator.layout,
      width: size,
      height: size,
      flex: 0,
    },
  });
}

export function updateListItemElementStyle(
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
