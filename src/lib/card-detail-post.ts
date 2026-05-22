import type { CardElementData, CardElementStyle, CardLayoutBox } from "@/lib/card-types";
import { findCardElement, updateCardElementTree } from "@/lib/card-utils";

export const DETAIL_POST_TEMPLATE_ID = "detail-post";
export const DETAIL_POST_HEADER_ICON_ID = "header-icon";
export const DETAIL_POST_HEADER_TAG_ID = "header-tag";
export const DETAIL_POST_HEADLINE_ID = "headline";
export const DETAIL_POST_BODY_LINE_1_ID = "body-line-1";
export const DETAIL_POST_BODY_LINE_2_ID = "body-line-2";
export const DETAIL_POST_FOOTER_ID = "footer";
export const DETAIL_POST_CTA_ID = "cta";

const DEFAULT_HEADER_ICON_SIZE = 28;
const MIN_HEADER_ICON_SIZE = 20;
const MAX_HEADER_ICON_SIZE = 48;

export function isDetailPostCard(templateId: string | undefined): boolean {
  return templateId === DETAIL_POST_TEMPLATE_ID;
}

export function getDetailPostRegions(root: CardElementData | undefined): {
  headerIcon: CardElementData | null;
  headerTag: CardElementData | null;
  headline: CardElementData | null;
  bodyLine1: CardElementData | null;
  bodyLine2: CardElementData | null;
  footer: CardElementData | null;
  cta: CardElementData | null;
} {
  if (!root?.children?.length) {
    return {
      headerIcon: null,
      headerTag: null,
      headline: null,
      bodyLine1: null,
      bodyLine2: null,
      footer: null,
      cta: null,
    };
  }

  const header = root.children.find((c) => c.id === "header") ?? null;
  const body = root.children.find((c) => c.id === "body") ?? null;
  const footer = root.children.find((c) => c.id === "footer") ?? null;

  return {
    headerIcon: header?.children?.find((c) => c.id === DETAIL_POST_HEADER_ICON_ID) ?? null,
    headerTag: header?.children?.find((c) => c.id === DETAIL_POST_HEADER_TAG_ID) ?? null,
    headline: body?.children?.find((c) => c.id === DETAIL_POST_HEADLINE_ID) ?? null,
    bodyLine1: body?.children?.find((c) => c.id === DETAIL_POST_BODY_LINE_1_ID) ?? null,
    bodyLine2: body?.children?.find((c) => c.id === DETAIL_POST_BODY_LINE_2_ID) ?? null,
    footer: footer ?? null,
    cta: footer?.children?.find((c) => c.id === DETAIL_POST_CTA_ID) ?? null,
  };
}

function clampHeaderIconSize(n: number): number {
  return Math.min(MAX_HEADER_ICON_SIZE, Math.max(MIN_HEADER_ICON_SIZE, Math.round(n)));
}

/** Read header icon slot size in px (default 28). */
export function parseDetailPostHeaderIconSize(icon: CardElementData | null | undefined): number {
  const w = icon?.layout?.width;
  if (typeof w === "number" && Number.isFinite(w) && w > 0) {
    return clampHeaderIconSize(w);
  }
  return DEFAULT_HEADER_ICON_SIZE;
}

/** Apply square header icon dimensions. */
export function applyDetailPostHeaderIconSize(elements: CardElementData, sizePx: number): CardElementData {
  const size = clampHeaderIconSize(sizePx);
  const icon = findCardElement(elements, DETAIL_POST_HEADER_ICON_ID);
  if (!icon) return elements;
  return updateCardElementTree(elements, DETAIL_POST_HEADER_ICON_ID, {
    layout: {
      ...icon.layout,
      width: size,
      height: size,
      flex: 0,
    },
  });
}

export function updateDetailPostElementStyle(
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

/** Flex-filler layout for body line 2 — also applied at render for legacy cards missing it. */
export function resolveDetailPostBodyLine2Layout(
  elementId: string,
  templateId: string | undefined,
  layout: CardLayoutBox | undefined,
): CardLayoutBox | undefined {
  if (templateId !== DETAIL_POST_TEMPLATE_ID || elementId !== DETAIL_POST_BODY_LINE_2_ID) {
    return layout;
  }
  return {
    padding: [8, 12],
    ...layout,
    width: "95%",
    flex: 1,
    minHeight: 0,
    flexDirection: "column",
    justifyContent: "start",
    alignSelf: "start",
    fillRemaining: true,
  };
}

/** Body column must shrink/grow in the card shell for line 2 to fill remaining space. */
export function resolveDetailPostBodySectionLayout(
  elementId: string,
  templateId: string | undefined,
  layout: CardLayoutBox | undefined,
): CardLayoutBox | undefined {
  if (templateId !== DETAIL_POST_TEMPLATE_ID || elementId !== "body") {
    return layout;
  }
  return {
    ...layout,
    flexDirection: layout?.flexDirection ?? "column",
    flex: layout?.flex ?? 1,
    width: layout?.width ?? "100%",
    minHeight: 0,
  };
}

/** CTA chip no longer uses a dashed inner border. */
export function resolveDetailPostCtaStyle(
  elementId: string,
  templateId: string | undefined,
  style: CardElementStyle | undefined,
): CardElementStyle | undefined {
  if (templateId !== DETAIL_POST_TEMPLATE_ID || elementId !== DETAIL_POST_CTA_ID || !style) {
    return style;
  }
  const { borderStyle: _bs, borderColor: _bc, borderWidth: _bw, ...rest } = style;
  return rest;
}
