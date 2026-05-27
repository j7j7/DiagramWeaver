import type { CardElementData, CardElementStyle, CardLayoutBox } from "@/lib/card-types";
import { findCardElement, updateCardElementTree } from "@/lib/card-utils";

export const LIST_ITEM_ROW_TEMPLATE_ID = "list-item-row";
export const LIST_ITEM_INDICATOR_ID = "indicator";
export const LIST_ITEM_LABEL_ID = "label";
export const LIST_ITEM_DRAG_HANDLE_ID = "drag-handle";

const LIST_ITEM_DRAG_HANDLE_LAYOUT = { width: 16, height: 24, flex: 0 } as const;
const LIST_ITEM_LABEL_PADDING: CardLayoutBox["padding"] = [8, 12];

const DEFAULT_INDICATOR_SIZE = 29;
const MIN_INDICATOR_SIZE = 12;
const MAX_INDICATOR_SIZE = 40;

const LIST_ITEM_CIRCLE_INDICATOR_FILL = "#e0e7ff";

/** Circle mask mode when the indicator uses a circular filled slot (default for template + legacy cards). */
export function parseListItemIndicatorCircle(indicator: CardElementData | null | undefined): boolean {
  if (!indicator) return true;
  if (indicator.placeholder === "circle") return true;
  if (indicator.iconFillSlot === true) return true;
  if (indicator.style?.borderRadius === 999) return true;
  return false;
}

/** Toggle indicator between circular masked slot and a normal icon glyph. */
export function applyListItemIndicatorCircle(elements: CardElementData, useCircle: boolean): CardElementData {
  const indicator = findCardElement(elements, LIST_ITEM_INDICATOR_ID);
  if (!indicator) return elements;

  if (useCircle) {
    return updateCardElementTree(elements, LIST_ITEM_INDICATOR_ID, {
      placeholder: "circle",
      iconFillSlot: true,
      layout: {
        ...indicator.layout,
        overflow: "hidden",
      },
      style: {
        ...indicator.style,
        borderRadius: 999,
        backgroundStyle:
          indicator.style?.backgroundStyle === "none" ? "solid" : (indicator.style?.backgroundStyle ?? "solid"),
        backgroundColor: indicator.style?.backgroundColor ?? LIST_ITEM_CIRCLE_INDICATOR_FILL,
      },
      iconRef: indicator.iconRef
        ? { ...indicator.iconRef, noIconBackground: true }
        : indicator.iconRef,
    });
  }

  return updateCardElementTree(elements, LIST_ITEM_INDICATOR_ID, {
    placeholder: "rect",
    iconFillSlot: false,
    matchCardBorder: false,
    iconSlotShadow: false,
    layout: {
      ...indicator.layout,
      overflow: undefined,
    },
    style: {
      ...indicator.style,
      borderRadius: 0,
      backgroundStyle: "none",
      backgroundColor: undefined,
      borderWidth: undefined,
      borderStyle: undefined,
      borderColor: undefined,
    },
    iconRef: indicator.iconRef
      ? { ...indicator.iconRef, noIconBackground: true }
      : indicator.iconRef,
  });
}

export function isListItemRowCard(templateId: string | undefined): boolean {
  return templateId === LIST_ITEM_ROW_TEMPLATE_ID;
}

export function getListItemRowRegions(root: CardElementData | undefined): {
  indicator: CardElementData | null;
  label: CardElementData | null;
  dragHandle: CardElementData | null;
} {
  if (!root?.children?.length) {
    return { indicator: null, label: null, dragHandle: null };
  }
  const indicator = root.children.find((c) => c.id === LIST_ITEM_INDICATOR_ID) ?? null;
  const label = root.children.find((c) => c.id === LIST_ITEM_LABEL_ID) ?? null;
  const dragHandle = root.children.find((c) => c.id === LIST_ITEM_DRAG_HANDLE_ID) ?? null;
  return { indicator, label, dragHandle };
}

/** Drag-handle dots on the right (default on for template + legacy cards). */
export function parseListItemDragHandleEnabled(root: CardElementData | undefined): boolean {
  const dragHandle = root?.children?.find((c) => c.id === LIST_ITEM_DRAG_HANDLE_ID);
  if (!dragHandle) return false;
  return dragHandle.hidden !== true;
}

export function applyListItemDragHandleEnabled(elements: CardElementData, enabled: boolean): CardElementData {
  const dragHandle = findCardElement(elements, LIST_ITEM_DRAG_HANDLE_ID);
  if (!dragHandle) return elements;
  return updateCardElementTree(elements, LIST_ITEM_DRAG_HANDLE_ID, {
    hidden: !enabled,
    layout: enabled
      ? { ...LIST_ITEM_DRAG_HANDLE_LAYOUT, ...dragHandle.layout, width: 16, height: 24, flex: 0 }
      : dragHandle.layout,
  });
}

/** Label fills the row; when the drag handle is hidden it spans to the container edge with padding. */
export function resolveListItemLabelLayout(
  elementId: string,
  templateId: string | undefined,
  layout: CardLayoutBox | undefined,
  root: CardElementData | undefined,
): CardLayoutBox | undefined {
  if (!isListItemRowCard(templateId) || elementId !== LIST_ITEM_LABEL_ID) return layout;
  const dragHandleEnabled = parseListItemDragHandleEnabled(root);
  return {
    ...layout,
    flex: 1,
    minWidth: 0,
    alignSelf: "stretch",
    width: dragHandleEnabled ? layout?.width : "100%",
    padding: layout?.padding ?? LIST_ITEM_LABEL_PADDING,
  };
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
