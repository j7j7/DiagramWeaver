import type { CSSProperties } from "react";
import type { CardElementData, CardElementStyle, CardIconRef, CardLayoutBox, CardTemplate } from "@/lib/card-types";
import { findCardElement, updateCardElementTree } from "@/lib/card-utils";

export const DASHBOARD_STAT_TEMPLATE_PREFIX = "dashboard-";

export const METRIC_TITLE_ID = "metric-title";
export const METRIC_SUBTITLE_ID = "metric-subtitle";
export const METRIC_VALUE_ID = "metric-value";
export const METRIC_ACTION_ID = "metric-action";
export const METRIC_DECOR_ID = "metric-decor";
export const METRIC_BODY_ID = "metric-body";

const DEFAULT_ACTION_SIZE = 26;
const MIN_ACTION_SIZE = 18;
const MAX_ACTION_SIZE = 40;

const DEFAULT_DECOR_WIDTH_PCT = 52;
const DEFAULT_DECOR_HEIGHT_PCT = 58;
const MIN_DECOR_PCT = 35;
const MAX_DECOR_PCT = 80;

/** Oversized icon — only one quadrant (top-right of asset) stays in the clip slot. */
export const DASHBOARD_DECOR_ICON_SCALE = 4;

const DEFAULT_DECOR_ICON_OPACITY = 1;

export const DECOR_OPACITY_MIN = 0.2;
export const DECOR_OPACITY_MAX = 0.5;

export function isDashboardStatCard(templateId: string | undefined): boolean {
  return !!templateId?.startsWith(DASHBOARD_STAT_TEMPLATE_PREFIX);
}

export function getDashboardStatRegions(root: CardElementData | undefined): {
  title: CardElementData | null;
  subtitle: CardElementData | null;
  value: CardElementData | null;
  action: CardElementData | null;
  decor: CardElementData | null;
} {
  if (!root?.children?.length) {
    return { title: null, subtitle: null, value: null, action: null, decor: null };
  }

  const header = root.children.find((c) => c.id === "header") ?? null;
  const titleCol = header?.children?.find((c) => c.id === "title-col") ?? null;
  const body = root.children.find((c) => c.id === METRIC_BODY_ID) ?? null;
  const decor = root.children.find((c) => c.id === METRIC_DECOR_ID) ?? null;
  const action =
    root.children.find((c) => c.id === METRIC_ACTION_ID) ??
    header?.children?.find((c) => c.id === METRIC_ACTION_ID) ??
    null;

  return {
    title: titleCol?.children?.find((c) => c.id === METRIC_TITLE_ID) ?? null,
    subtitle: titleCol?.children?.find((c) => c.id === METRIC_SUBTITLE_ID) ?? null,
    value: body?.children?.find((c) => c.id === METRIC_VALUE_ID) ?? null,
    action,
    decor,
  };
}

function clampActionSize(n: number): number {
  return Math.min(MAX_ACTION_SIZE, Math.max(MIN_ACTION_SIZE, Math.round(n)));
}

function clampDecorPct(n: number): number {
  return Math.min(MAX_DECOR_PCT, Math.max(MIN_DECOR_PCT, Math.round(n)));
}

function parsePercentDim(v: number | string | undefined, fallback: number): number {
  if (typeof v === "string" && v.endsWith("%")) {
    const n = parseFloat(v);
    if (Number.isFinite(n) && n > 0) return clampDecorPct(n);
  }
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return clampDecorPct(v);
  return fallback;
}

export function parseDashboardActionSize(action: CardElementData | null | undefined): number {
  const w = action?.layout?.width;
  if (typeof w === "number" && Number.isFinite(w) && w > 0) {
    return clampActionSize(w);
  }
  return DEFAULT_ACTION_SIZE;
}

export function parseDashboardDecorWidthPct(decor: CardElementData | null | undefined): number {
  return parsePercentDim(decor?.layout?.width, DEFAULT_DECOR_WIDTH_PCT);
}

export function parseDashboardDecorHeightPct(decor: CardElementData | null | undefined): number {
  return parsePercentDim(decor?.layout?.height, DEFAULT_DECOR_HEIGHT_PCT);
}

export function parseDashboardDecorIconOpacity(decor: CardElementData | null | undefined): number {
  const raw = decor?.iconRef?.iconOpacity;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.min(1, Math.max(0, raw));
  }
  return DEFAULT_DECOR_ICON_OPACITY;
}

export function applyDashboardActionSize(elements: CardElementData, sizePx: number): CardElementData {
  const size = clampActionSize(sizePx);
  const action = findCardElement(elements, METRIC_ACTION_ID);
  if (!action) return elements;
  return updateCardElementTree(elements, METRIC_ACTION_ID, {
    layout: { ...action.layout, width: size, height: size, flex: 0 },
  });
}

export function applyDashboardDecorSize(
  elements: CardElementData,
  widthPct: number,
  heightPct: number,
): CardElementData {
  const decor = findCardElement(elements, METRIC_DECOR_ID);
  if (!decor) return elements;
  const w = clampDecorPct(widthPct);
  const h = clampDecorPct(heightPct);
  return updateCardElementTree(elements, METRIC_DECOR_ID, {
    layout: { ...decor.layout, width: `${w}%`, height: `${h}%`, flex: 0 },
  });
}

export function applyDashboardDecorIconOpacity(elements: CardElementData, opacity: number): CardElementData {
  const decor = findCardElement(elements, METRIC_DECOR_ID);
  if (!decor) return elements;
  const iconRef = decor.iconRef ?? { type: "generic.icon.lucide", iconType: "lucide" as const };
  return updateCardElementTree(elements, METRIC_DECOR_ID, {
    iconRef: { ...iconRef, iconOpacity: Math.min(1, Math.max(0, opacity)) },
  });
}

export function updateDashboardElementStyle(
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

/** Decorative icon slot — absolute bottom-right overlay. */
export function resolveDashboardStatDecorLayout(
  elementId: string,
  templateId: string | undefined,
  layout: CardLayoutBox | undefined,
): CardLayoutBox | undefined {
  if (!isDashboardStatCard(templateId) || elementId !== METRIC_DECOR_ID) return layout;
  const w = parsePercentDim(layout?.width, DEFAULT_DECOR_WIDTH_PCT);
  const h = parsePercentDim(layout?.height, DEFAULT_DECOR_HEIGHT_PCT);
  return { ...layout, width: `${w}%`, height: `${h}%`, flex: 0 };
}

/** Header and body paint above the decorative icon; pointer-events pass through to decor below. */
export function dashboardStatSectionStyle(
  elementId: string,
  templateId: string | undefined,
): CSSProperties | undefined {
  if (!isDashboardStatCard(templateId)) return undefined;
  if (elementId !== "header" && elementId !== METRIC_BODY_ID) return undefined;
  return { position: "relative", zIndex: 1, pointerEvents: "none" };
}

export function dashboardStatSectionClassName(
  elementId: string,
  templateId: string | undefined,
): string | undefined {
  if (!isDashboardStatCard(templateId)) return undefined;
  if (elementId !== "header" && elementId !== METRIC_BODY_ID) return undefined;
  return "[&>*]:pointer-events-auto";
}

export function dashboardStatDecorSlotStyle(
  elementId: string,
  templateId: string | undefined,
  layout: CardLayoutBox | undefined,
): CSSProperties | undefined {
  if (!isDashboardStatCard(templateId) || elementId !== METRIC_DECOR_ID) return undefined;
  const w = parsePercentDim(layout?.width, DEFAULT_DECOR_WIDTH_PCT);
  const h = parsePercentDim(layout?.height, DEFAULT_DECOR_HEIGHT_PCT);
  return {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: `${w}%`,
    height: `${h}%`,
    zIndex: 0,
    overflow: "hidden",
    pointerEvents: "auto",
  };
}

/** Action circle — absolute top-right on the card, above pass-through header/body layers. */
export function dashboardStatActionSlotStyle(
  elementId: string,
  templateId: string | undefined,
): CSSProperties | undefined {
  if (!isDashboardStatCard(templateId) || elementId !== METRIC_ACTION_ID) return undefined;
  return {
    position: "absolute",
    top: 0,
    right: 0,
    zIndex: 3,
    pointerEvents: "auto",
  };
}

export function normalizeDashboardDecorIconRef(
  elements: CardElementData,
  elementId: string,
  iconRef: CardIconRef,
): CardIconRef {
  const el = findCardElement(elements, elementId);
  if (!el?.iconDecorGradient) return iconRef;
  return {
    ...iconRef,
    noIconBackground: true,
    iconColor: iconRef.iconColor ?? "#ffffff",
    iconOpacity: iconRef.iconOpacity ?? DEFAULT_DECOR_ICON_OPACITY,
  };
}

/** Clip region for the decor icon (fills the decor slot). */
export function dashboardStatDecorClipStyle(): CSSProperties {
  return { position: "absolute", inset: 0, overflow: "hidden" };
}

/** 2× clip size at top-left of clip → visible region is the icon's top-left quadrant. */
export function dashboardStatDecorIconPositionStyle(): CSSProperties {
  return {
    position: "absolute",
    left: 0,
    top: 0,
    width: `${(DASHBOARD_DECOR_ICON_SCALE / 2) * 100}%`,
    height: `${(DASHBOARD_DECOR_ICON_SCALE / 2) * 100}%`,
  };
}

/** Opacity gradient on the watermark: 20% top-left → 50% bottom-right. */
export function dashboardStatDecorOpacityMaskStyle(iconOpacity: number): CSSProperties {
  const strength = Math.min(1, Math.max(0, iconOpacity));
  const minAlpha = DECOR_OPACITY_MIN * strength;
  const maxAlpha = DECOR_OPACITY_MAX * strength;
  return {
    WebkitMaskImage: `linear-gradient(to bottom right, rgba(0,0,0,${minAlpha}) 0%, rgba(0,0,0,${maxAlpha}) 100%)`,
    maskImage: `linear-gradient(to bottom right, rgba(0,0,0,${minAlpha}) 0%, rgba(0,0,0,${maxAlpha}) 100%)`,
    WebkitMaskSize: "100% 100%",
    maskSize: "100% 100%",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
  };
}

/** Combined wrap styles for the decor icon layer (position only). */
export function dashboardStatDecorIconWrapStyle(_iconOpacity: number): CSSProperties {
  return dashboardStatDecorIconPositionStyle();
}

/** Styles passed to ResourceIcon inside the decor watermark. */
export function dashboardStatDecorIconImageStyle(
  useWhiteFilter: boolean,
  iconOpacity: number,
): CSSProperties {
  return {
    ...dashboardStatDecorOpacityMaskStyle(iconOpacity),
    width: "100%",
    height: "100%",
    objectFit: "contain",
    objectPosition: "left top",
    display: "block",
    ...(useWhiteFilter ? { filter: "brightness(0) invert(1)" } : {}),
  };
}

/** Raster/catalog icons ignore iconColor — force white watermark via filter. */
export function dashboardStatDecorUsesWhiteFilter(iconRef: CardIconRef | undefined): boolean {
  if (!iconRef) return false;
  if (iconRef.iconType === "lucide" || iconRef.iconType === "emoji") return false;
  if (iconRef.type?.startsWith("generic.icon.") || iconRef.type?.startsWith("generic.emoji.")) {
    return false;
  }
  return !!(iconRef.file || iconRef.provider || iconRef.imageUrl);
}

/** @deprecated use dashboardStatDecorClipStyle + dashboardStatDecorIconWrapStyle */
export function dashboardStatDecorGlyphLayout(): CSSProperties {
  return dashboardStatDecorClipStyle();
}

/** @deprecated use dashboardStatDecorIconWrapStyle */
export function dashboardStatDecorGlyphStyle(
  iconDecorGradient: boolean | undefined,
  iconOpacity: number,
): CSSProperties {
  if (!iconDecorGradient) return { opacity: iconOpacity };
  return {};
}

export function createDashboardStatTemplate(config: {
  id: string;
  name: string;
  defaultWidth: number;
  defaultHeight: number;
  gradient: [string, string];
  title: string;
  subtitle?: string;
  value: string;
  valueFontSize?: number;
}): CardTemplate {
  const titleColChildren: CardElementData[] = [
    {
      id: METRIC_TITLE_ID,
      kind: "text",
      text: config.title,
      editable: true,
      fontSize: 13,
      fontWeight: "500",
      textColor: "#ffffff",
      lineHeight: 1.3,
      layout: { width: "100%", padding: 0 },
      style: { backgroundStyle: "none" },
    },
  ];

  if (config.subtitle) {
    titleColChildren.push({
      id: METRIC_SUBTITLE_ID,
      kind: "text",
      text: config.subtitle,
      editable: true,
      fontSize: 11,
      fontWeight: "400",
      textColor: "rgba(255,255,255,0.82)",
      lineHeight: 1.25,
      layout: { width: "100%", padding: 0 },
      style: { backgroundStyle: "none" },
    });
  }

  return {
    id: config.id,
    name: config.name,
    defaultWidth: config.defaultWidth,
    defaultHeight: config.defaultHeight,
    cornerRadius: 0.22,
    root: {
      id: "root",
      kind: "section",
      layout: {
        flexDirection: "column",
        width: "100%",
        height: "100%",
        padding: [14, 16],
        gap: 4,
        overflow: "hidden",
      },
      style: {
        backgroundStyle: "gradient",
        backgroundColors: config.gradient,
        gradientAngle: 135,
      },
      children: [
        {
          id: "header",
          kind: "section",
          layout: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "start",
            width: "100%",
            flex: 0,
            gap: 8,
          },
          children: [
            {
              id: "title-col",
              kind: "section",
              layout: { flexDirection: "column", flex: 1, minWidth: 0, gap: 2, width: "100%" },
              children: titleColChildren,
            },
          ],
        },
        {
          id: METRIC_BODY_ID,
          kind: "section",
          layout: {
            flexDirection: "column",
            flex: 1,
            justifyContent: "end",
            width: "100%",
            minHeight: 0,
          },
          children: [
            {
              id: METRIC_VALUE_ID,
              kind: "text",
              text: config.value,
              editable: true,
              fontSize: config.valueFontSize ?? 34,
              fontWeight: "700",
              textColor: "#ffffff",
              lineHeight: 1,
              layout: { width: "100%", padding: 0, alignSelf: "start" },
              style: { backgroundStyle: "none" },
            },
          ],
        },
        {
          id: METRIC_DECOR_ID,
          kind: "icon-slot",
          iconDecorGradient: true,
          layout: {
            width: `${DEFAULT_DECOR_WIDTH_PCT}%`,
            height: `${DEFAULT_DECOR_HEIGHT_PCT}%`,
            flex: 0,
          },
          style: { backgroundStyle: "none" },
        },
        {
          id: METRIC_ACTION_ID,
          kind: "icon-slot",
          layout: { width: DEFAULT_ACTION_SIZE, height: DEFAULT_ACTION_SIZE, flex: 0 },
          style: {
            backgroundColor: "rgba(255,255,255,0.22)",
            backgroundStyle: "solid",
            borderRadius: 999,
          },
          placeholder: "circle",
          iconFillSlot: true,
        },
      ],
    },
  };
}
