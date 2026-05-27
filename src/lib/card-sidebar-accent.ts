import type { CardElementData, CardElementStyle, CardLayoutBox } from "@/lib/card-types";
import { findCardElement, updateCardElementTree } from "@/lib/card-utils";

export const SIDEBAR_ACCENT_TEMPLATE_ID = "sidebar-accent";
export const SIDEBAR_ACCENT_BAR_ID = "accent-bar";
export const SIDEBAR_ACCENT_CONTENT_ID = "content-col";
export const SIDEBAR_ACCENT_HEADING_ID = "heading";
export const SIDEBAR_ACCENT_BODY_ID = "body";

export const SIDEBAR_ACCENT_COLOR_DEFAULT = "#45d1af";

const DEFAULT_BAR_WIDTH = 6;
const MIN_BAR_WIDTH = 3;
const MAX_BAR_WIDTH = 20;

export function isSidebarAccentCard(templateId: string | undefined): boolean {
  return templateId === SIDEBAR_ACCENT_TEMPLATE_ID;
}

export function isSidebarAccentBar(elementId: string, templateId: string | undefined): boolean {
  return isSidebarAccentCard(templateId) && elementId === SIDEBAR_ACCENT_BAR_ID;
}

export function getSidebarAccentRegions(root: CardElementData | undefined): {
  accentBar: CardElementData | null;
  heading: CardElementData | null;
  body: CardElementData | null;
} {
  if (!root?.children?.length) {
    return { accentBar: null, heading: null, body: null };
  }
  const accentBar = root.children.find((c) => c.id === SIDEBAR_ACCENT_BAR_ID) ?? null;
  const contentCol = root.children.find((c) => c.id === SIDEBAR_ACCENT_CONTENT_ID) ?? null;
  const heading = contentCol?.children?.find((c) => c.id === SIDEBAR_ACCENT_HEADING_ID) ?? null;
  const body = contentCol?.children?.find((c) => c.id === SIDEBAR_ACCENT_BODY_ID) ?? null;
  return { accentBar, heading, body };
}

function clampBarWidth(n: number): number {
  return Math.min(MAX_BAR_WIDTH, Math.max(MIN_BAR_WIDTH, Math.round(n)));
}

/** Sidebar pill width in px (stored on accent-bar.layout.width). */
export function parseSidebarAccentBarWidth(accentBar: CardElementData | null | undefined): number {
  const w = accentBar?.layout?.width;
  if (typeof w === "number" && Number.isFinite(w) && w > 0) {
    return clampBarWidth(w);
  }
  return DEFAULT_BAR_WIDTH;
}

export function applySidebarAccentBarWidth(elements: CardElementData, widthPx: number): CardElementData {
  const width = clampBarWidth(widthPx);
  const accentBar = findCardElement(elements, SIDEBAR_ACCENT_BAR_ID);
  if (!accentBar) return elements;
  return updateCardElementTree(elements, SIDEBAR_ACCENT_BAR_ID, {
    layout: {
      ...accentBar.layout,
      width,
      flex: 0,
    },
  });
}

export function applySidebarAccentHeadingColor(elements: CardElementData, color: string): CardElementData {
  const heading = findCardElement(elements, SIDEBAR_ACCENT_HEADING_ID);
  if (!heading) return elements;
  return updateCardElementTree(elements, SIDEBAR_ACCENT_HEADING_ID, {
    textColor: color,
  });
}

export function updateSidebarAccentElementStyle(
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

export function resolveSidebarAccentTextLayout(
  elementId: string,
  templateId: string | undefined,
  layout: CardLayoutBox | undefined,
): CardLayoutBox | undefined {
  if (!isSidebarAccentCard(templateId)) return layout;
  if (elementId !== SIDEBAR_ACCENT_HEADING_ID && elementId !== SIDEBAR_ACCENT_BODY_ID) return layout;
  return {
    ...layout,
    width: "100%",
    alignSelf: "stretch",
  };
}

export function resolveSidebarAccentContentColLayout(
  elementId: string,
  templateId: string | undefined,
  layout: CardLayoutBox | undefined,
): CardLayoutBox | undefined {
  if (!isSidebarAccentCard(templateId) || elementId !== SIDEBAR_ACCENT_CONTENT_ID) return layout;
  return {
    ...layout,
    flexDirection: layout?.flexDirection ?? "column",
    flex: layout?.flex ?? 1,
    minWidth: 0,
    justifyContent: layout?.justifyContent ?? "center",
  };
}

export function resolveSidebarAccentBarLayout(
  elementId: string,
  templateId: string | undefined,
  layout: CardLayoutBox | undefined,
): CardLayoutBox | undefined {
  if (!isSidebarAccentBar(elementId, templateId)) return layout;
  const width = parseSidebarAccentBarWidth({ id: elementId, kind: "decor", layout });
  return {
    ...layout,
    width,
    flex: 0,
    alignSelf: "stretch",
  };
}

export const SIDEBAR_ACCENT_BAR_WIDTH_MIN = MIN_BAR_WIDTH;
export const SIDEBAR_ACCENT_BAR_WIDTH_MAX = MAX_BAR_WIDTH;
