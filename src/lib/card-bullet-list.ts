import type {
  CardElementData,
  CardElementStyle,
  CardIconRef,
  CardLayoutBox,
  CardTemplate,
} from "@/lib/card-types";
import type { DiagramNodeData, RichTextRun } from "@/lib/types";
import { flexJustifyToTextJustify } from "@/lib/card-layout";
import { applyTextStylingToCardElement, extractTextStylingFromCardElement, type TextStyling } from "@/lib/text-styling";
import { findCardElement, updateCardElementTree } from "@/lib/card-utils";
import { shiftHueOfColor, hueDeltaBetweenColors } from "@/lib/color-shift";
import { DIAGRAM_THEME_HUE_STEP_DEG } from "@/lib/theme-manager";

export const BULLET_LIST_TEMPLATE_ID = "bullet-list";

export const BULLET_LIST_TITLE_ID = "title";
export const BULLET_LIST_ENTRIES_ID = "entries";
export const BULLET_LIST_ADD_ROW_ID = "add-row";
export const BULLET_LIST_ADD_ROW_LABEL_ID = "add-row-label";
export const BULLET_LIST_ROW_PREFIX = "row-";
export const BULLET_LIST_CUBE_SUFFIX = "-cube";
export const BULLET_LIST_TEXT_SUFFIX = "-text";

export const BULLET_LIST_MIN_ROWS = 1;
export const BULLET_LIST_CUBE_SIZE_PX = 8;
export const BULLET_SIZE_MIN = 4;
export const BULLET_SIZE_MAX = 50;
/** Minimum square marker when item icons are enabled (easier drop target, fits line height). */
export const BULLET_LIST_ICON_MARKER_MIN = 14;

export const BULLET_LIST_TITLE_FONT_SIZE = 14;
export const BULLET_LIST_ITEM_FONT_SIZE = 12;
export const BULLET_LIST_TITLE_FONT_MIN = 11;
export const BULLET_LIST_ITEM_FONT_MIN = 10;

export type BulletListBulletShape = "square" | "circle";

export const BULLET_LIST_DEFAULT_WIDTH = 320;
export const BULLET_LIST_DEFAULT_HEIGHT = 160;
export const BULLET_LIST_DEFAULT_CORNER_RADIUS = 0.12;
export const BULLET_LIST_GRADIENT_ANGLE = 135;
export const BULLET_LIST_LINE_WIDTH = 2.5;

export const BULLET_LIST_ACCENT_DEFAULT = "#06b6d4";
export const BULLET_LIST_ITEM_TEXT_DEFAULT = "#ecfeff";
export const BULLET_LIST_BG_DEFAULT = "#0f1a12";
export const BULLET_LIST_BG_GRADIENT_COLORS = ["#0f172a", "#164e63"] as const;
export const BULLET_LIST_ADD_LABEL_DEFAULT = "#06b6d4";
export const BULLET_LIST_BORDER_COLOR = "#06b6d4";
export const BULLET_LIST_BORDER_COLORS = ["#06b6d4", "#0891b2"] as const;
export const BULLET_LIST_LINE_COLOR = "#84cc16";
export const BULLET_LIST_DEFAULT_ROW_CUBE_COLORS = ["#06b6d4", "#066ad4", "#061fd4"] as const;

/** Default drop preset — dark cyan gradient card with stepped bullet hues. */
export const BULLET_LIST_DEFAULT_THEME = {
  accentColor: BULLET_LIST_ACCENT_DEFAULT,
  itemTextColor: BULLET_LIST_ITEM_TEXT_DEFAULT,
  backgroundColor: BULLET_LIST_BG_DEFAULT,
  backgroundStyle: "gradient" as const,
  backgroundColors: [...BULLET_LIST_BG_GRADIENT_COLORS] as [string, string],
  gradientAngle: BULLET_LIST_GRADIENT_ANGLE,
  addRowTextColor: BULLET_LIST_ADD_LABEL_DEFAULT,
  titleText: "TITLE HEADING",
};

export interface BulletListRowData {
  id: string;
  text: string;
  cubeStyle?: CardElementStyle;
  iconRef?: CardIconRef;
}

const DEFAULT_ROWS: Omit<BulletListRowData, "id">[] = [
  { text: "Item one" },
  { text: "Item two" },
  { text: "Item three" },
];

export type BulletListResizeMetrics = {
  /** Width-based scale for title/item typography and horizontal spacing. */
  typographyScale: number;
  /** Height ratio — compresses vertical padding/gaps when the card is shortened. */
  paddingScale: number;
  scaleW: number;
  scaleH: number;
};

function clampBulletSize(n: number): number {
  return Math.min(BULLET_SIZE_MAX, Math.max(BULLET_SIZE_MIN, Math.round(n)));
}

export function parseBulletListBulletSize(
  marker: CardElementData | null | undefined,
): number {
  const w = marker?.layout?.width;
  if (typeof w === "number" && Number.isFinite(w) && w > 0) {
    return clampBulletSize(w);
  }
  return BULLET_LIST_CUBE_SIZE_PX;
}

export function parseBulletListBulletShape(
  marker: CardElementData | null | undefined,
): BulletListBulletShape {
  if (!marker || marker.kind === "icon-slot") return "square";
  return marker.placeholder === "circle" ? "circle" : "square";
}

function normalizeBulletListIconRef(iconRef: CardIconRef | undefined): CardIconRef | undefined {
  if (!iconRef) return undefined;
  return {
    ...iconRef,
    iconSizeMode: iconRef.iconSizeMode ?? "scaled",
    noIconBackground: iconRef.noIconBackground ?? true,
  };
}

function bulletIconSlot(
  id: string,
  size: number,
  iconRef?: CardIconRef,
): CardElementData {
  return {
    id,
    kind: "icon-slot",
    iconRef: normalizeBulletListIconRef(iconRef),
    iconFillSlot: true,
    layout: {
      width: size,
      height: size,
      flex: 0,
      alignSelf: "center",
      overflow: "hidden",
    },
    style: { backgroundStyle: "none" },
  };
}

function markerDecorToIconSlot(
  decor: CardElementData,
  iconRef?: CardIconRef,
): CardElementData {
  const size = parseBulletListBulletSize(decor);
  return bulletIconSlot(decor.id, size, iconRef);
}

function markerIconSlotToDecor(
  slot: CardElementData,
  accentColor: string,
  shape: BulletListBulletShape,
  cubeStyle?: CardElementStyle,
): CardElementData {
  const size = parseBulletListBulletSize(slot);
  const borderRadius = resolveBulletListBulletBorderRadius(size, shape);
  return {
    id: slot.id,
    kind: "decor",
    placeholder: shape === "circle" ? "circle" : "rect",
    layout: {
      ...slot.layout,
      width: size,
      height: size,
      flex: 0,
      alignSelf: "center",
    },
    style: cubeStyle ?? {
      backgroundColor: accentColor,
      backgroundStyle: "solid",
      borderRadius,
    },
  };
}

export function resolveBulletListBulletBorderRadius(
  sizePx: number,
  shape: BulletListBulletShape,
): number {
  return shape === "circle" ? sizePx / 2 : 1;
}

/** Row marker: colored bullet (`decor`) or per-item icon (`icon-slot`). */
export function getBulletListRowMarker(
  row: CardElementData | undefined,
): CardElementData | null {
  return row?.children?.find((c) => c.id.endsWith(BULLET_LIST_CUBE_SUFFIX)) ?? null;
}

function getBulletListFirstMarker(root: CardElementData | undefined): CardElementData | null {
  const firstRow = root ? getBulletListRows(root)[0] : undefined;
  return getBulletListRowMarker(firstRow);
}

/** @deprecated Use {@link getBulletListFirstMarker}. */
function getBulletListFirstCube(root: CardElementData | undefined): CardElementData | null {
  return getBulletListFirstMarker(root);
}

export function bulletListUsesItemIcons(root: CardElementData | undefined): boolean {
  return getBulletListFirstMarker(root)?.kind === "icon-slot";
}

export function bulletListUseItemIconsEnabled(
  nodeValue: boolean | undefined,
  root: CardElementData | undefined,
): boolean {
  if (typeof nodeValue === "boolean") return nodeValue;
  return bulletListUsesItemIcons(root);
}

function readBulletListBulletConfig(root: CardElementData): {
  size: number;
  shape: BulletListBulletShape;
} {
  const cube = getBulletListFirstCube(root);
  return {
    size: parseBulletListBulletSize(cube),
    shape: parseBulletListBulletShape(cube),
  };
}

/** Uniform scale vs default drop size (200×240). Typography tracks width; padding tracks height. */
export function computeBulletListResizeMetrics(
  width: number,
  height: number,
  shellInsetPx = 0,
): BulletListResizeMetrics {
  const innerW = Math.max(1, width - shellInsetPx * 2);
  const innerH = Math.max(1, height - shellInsetPx * 2);
  const scaleW = innerW / BULLET_LIST_DEFAULT_WIDTH;
  const scaleH = innerH / BULLET_LIST_DEFAULT_HEIGHT;
  const typographyScale = Math.max(0.85, Math.min(1.15, scaleW));
  const paddingScale = Math.max(0.12, Math.min(1, scaleH));
  return { typographyScale, paddingScale, scaleW, scaleH };
}

export function scaleBulletListPadding(
  padding: CardLayoutBox["padding"],
  scale: number,
): CardLayoutBox["padding"] {
  if (padding == null) return padding;
  if (typeof padding === "number") return padding * scale;
  return padding.map((n) => n * scale) as CardLayoutBox["padding"];
}

export function scaleBulletListFontSize(size: number | undefined, scale: number, minPx = 6): number {
  return Math.max(minPx, (size ?? 12) * scale);
}

export function scaleBulletListTitleFontSize(
  size: number | undefined,
  metrics: BulletListResizeMetrics,
): number {
  return scaleBulletListFontSize(
    size ?? BULLET_LIST_TITLE_FONT_SIZE,
    metrics.typographyScale,
    BULLET_LIST_TITLE_FONT_MIN,
  );
}

export function scaleBulletListItemFontSize(
  size: number | undefined,
  metrics: BulletListResizeMetrics,
): number {
  return scaleBulletListFontSize(
    size ?? BULLET_LIST_ITEM_FONT_SIZE,
    metrics.typographyScale,
    BULLET_LIST_ITEM_FONT_MIN,
  );
}

function scaleBulletListAxisPadding(
  padding: CardLayoutBox["padding"],
  typographyScale: number,
  paddingScale: number,
): CardLayoutBox["padding"] {
  if (padding == null) return padding;
  if (typeof padding === "number") return padding * paddingScale;
  if (padding.length === 2) {
    return [padding[0] * paddingScale, padding[1] * typographyScale] as [number, number];
  }
  if (padding.length === 4) {
    return [
      padding[0] * paddingScale,
      padding[1] * typographyScale,
      padding[2] * paddingScale,
      padding[3] * typographyScale,
    ] as [number, number, number, number];
  }
  return padding;
}

/** Stretch rows to fill entries height; compress vertical gaps before shrinking text. */
export function applyBulletListResizeLayout(
  elementId: string,
  layout: CardElementData["layout"],
  metrics: BulletListResizeMetrics,
): CardElementData["layout"] {
  const { typographyScale, paddingScale } = metrics;
  let next = layout ?? {};

  if (elementId === "root") {
    next = {
      ...next,
      padding: scaleBulletListAxisPadding(
        next.padding ?? ([12, 0, 8, 0] as [number, number, number, number]),
        typographyScale,
        paddingScale,
      ),
    };
  }

  if (elementId === BULLET_LIST_TITLE_ID) {
    next = {
      ...mergeBulletListTitleBandLayout(next),
      padding: scaleBulletListAxisPadding(
        next.padding ?? ([0, 14] as [number, number]),
        typographyScale,
        paddingScale,
      ),
      marginBottom: (next.marginBottom ?? 6) * paddingScale,
    };
  }

  if (isBulletListRowId(elementId)) {
    next = {
      ...next,
      flex: 1,
      minHeight: "auto",
      alignItems: "center",
      padding: scaleBulletListAxisPadding(
        next.padding ?? ([4, 14] as [number, number]),
        typographyScale,
        paddingScale,
      ),
    };
  }

  if (elementId === BULLET_LIST_ADD_ROW_ID) {
    next = {
      ...next,
      padding: scaleBulletListAxisPadding(
        next.padding ?? ([6, 14] as [number, number]),
        typographyScale,
        paddingScale,
      ),
      marginTop: (next.marginTop ?? 2) * paddingScale,
    };
  }

  if (elementId === BULLET_LIST_ADD_ROW_LABEL_ID) {
    next = {
      ...next,
      padding: scaleBulletListAxisPadding(
        next.padding ?? ([4, 8] as [number, number]),
        typographyScale,
        paddingScale,
      ),
    };
  }

  if (elementId.endsWith(BULLET_LIST_TEXT_SUFFIX)) {
    next = {
      ...next,
      alignItems: "start",
      justifyContent: "start",
      padding: scaleBulletListAxisPadding(
        next.padding ?? ([0, 0] as [number, number]),
        typographyScale,
        paddingScale,
      ),
    };
  }

  return next;
}

export function getBulletListRowTextElement(
  root: CardElementData,
  rowId: string,
): CardElementData | null {
  const row = findCardElement(root, rowId);
  return row?.children?.find((c) => c.id.endsWith(BULLET_LIST_TEXT_SUFFIX)) ?? null;
}

function bulletCube(
  id: string,
  accentColor: string,
  size: number = BULLET_LIST_CUBE_SIZE_PX,
  shape: BulletListBulletShape = "square",
): CardElementData {
  const borderRadius = resolveBulletListBulletBorderRadius(size, shape);
  return {
    id,
    kind: "decor",
    placeholder: shape === "circle" ? "circle" : "rect",
    layout: {
      width: size,
      height: size,
      flex: 0,
      alignSelf: "center",
    },
    style: {
      backgroundColor: accentColor,
      backgroundStyle: "solid",
      borderRadius,
    },
  };
}

function bulletText(id: string, text: string, textColor: string): CardElementData {
  return {
    id,
    kind: "text",
    text,
    editable: true,
    fontSize: BULLET_LIST_ITEM_FONT_SIZE,
    fontWeight: "400",
    textColor,
    layout: {
      flex: 1,
      minWidth: 0,
      padding: [0, 0] as [number, number],
      justifyContent: "start",
      alignItems: "start",
    },
    style: { backgroundStyle: "none" },
  };
}

function bulletRowSection(
  row: BulletListRowData,
  accentColor: string,
  itemTextColor: string,
  bulletSize: number,
  bulletShape: BulletListBulletShape,
  useIcons: boolean,
): CardElementData {
  const markerId = `${row.id}${BULLET_LIST_CUBE_SUFFIX}`;
  const borderRadius = resolveBulletListBulletBorderRadius(bulletSize, bulletShape);
  const marker: CardElementData = useIcons
    ? bulletIconSlot(markerId, bulletSize, row.iconRef)
    : {
        ...bulletCube(markerId, accentColor, bulletSize, bulletShape),
        style: row.cubeStyle ?? {
          backgroundColor: accentColor,
          backgroundStyle: "solid",
          borderRadius,
        },
        placeholder: bulletShape === "circle" ? "circle" : "rect",
      };
  return {
    id: row.id,
    kind: "section",
    layout: {
      flexDirection: "row",
      width: "100%",
      flex: 1,
      minHeight: "auto",
      alignItems: "center",
      gap: 10,
      padding: [4, 14] as [number, number],
    },
    style: { backgroundStyle: "none" },
    children: [marker, bulletText(`${row.id}${BULLET_LIST_TEXT_SUFFIX}`, row.text, itemTextColor)],
  };
}

function bulletAddRowButton(addLabelColor: string): CardElementData {
  return {
    id: BULLET_LIST_ADD_ROW_ID,
    kind: "section",
    layout: {
      width: "100%",
      flex: 0,
      padding: [8, 14] as [number, number],
      justifyContent: "center",
      alignItems: "center",
      marginTop: 2,
    },
    style: { backgroundStyle: "none" },
    children: [
      {
        id: BULLET_LIST_ADD_ROW_LABEL_ID,
        kind: "text",
        text: "+ Add item",
        editable: false,
        fontSize: 10,
        fontWeight: "600",
        textColor: addLabelColor,
        layout: { flex: 0, padding: [4, 8], justifyContent: "center", alignItems: "center" },
        style: { backgroundStyle: "none" },
      },
    ],
  };
}

export function createBulletListRoot(
  theme: typeof BULLET_LIST_DEFAULT_THEME = BULLET_LIST_DEFAULT_THEME,
  rows: BulletListRowData[] = defaultStyledBulletListRows(theme),
): CardElementData {
  const entryChildren: CardElementData[] = rows.map((row) =>
    bulletRowSection(row, theme.accentColor, theme.itemTextColor, BULLET_LIST_CUBE_SIZE_PX, "square", false),
  );
  entryChildren.push(bulletAddRowButton(theme.addRowTextColor));

  return {
    id: "root",
    kind: "section",
    layout: {
      flexDirection: "column",
      width: "100%",
      height: "100%",
      gap: 0,
      padding: [12, 0, 8, 0] as [number, number, number, number],
      overflow: "hidden",
    },
    style: {
      backgroundColor: theme.backgroundColor,
      backgroundStyle: theme.backgroundStyle,
      backgroundColors: theme.backgroundColors,
      gradientAngle: theme.gradientAngle,
    },
    children: [
      {
        id: BULLET_LIST_TITLE_ID,
        kind: "text",
        text: theme.titleText,
        editable: true,
        fontSize: BULLET_LIST_TITLE_FONT_SIZE,
        fontWeight: "700",
        textColor: theme.accentColor,
        textTransform: "uppercase",
        textJustify: "center",
        layout: mergeBulletListTitleBandLayout({
          flex: 0,
          padding: [0, 14] as [number, number],
          marginBottom: 6,
        }),
        style: { backgroundStyle: "none" },
      },
      {
        id: BULLET_LIST_ENTRIES_ID,
        kind: "section",
        layout: {
          flexDirection: "column",
          width: "100%",
          flex: 1,
          minHeight: 0,
          gap: 0,
          padding: 0,
          alignSelf: "stretch",
        },
        style: { backgroundStyle: "none" },
        children: entryChildren,
      },
    ],
  };
}

export function defaultStyledBulletListRows(
  theme: typeof BULLET_LIST_DEFAULT_THEME = BULLET_LIST_DEFAULT_THEME,
): BulletListRowData[] {
  return DEFAULT_ROWS.map((r, i) => ({
    ...r,
    id: `${BULLET_LIST_ROW_PREFIX}${i + 1}`,
    cubeStyle: {
      backgroundColor: BULLET_LIST_DEFAULT_ROW_CUBE_COLORS[i] ?? theme.accentColor,
      backgroundStyle: "solid",
      borderRadius: 1,
    },
  }));
}

export function createDefaultBulletListRoot(): CardElementData {
  return createBulletListRoot();
}

export function createBulletListTemplate(): CardTemplate {
  return {
    id: BULLET_LIST_TEMPLATE_ID,
    name: "Bullet List",
    defaultWidth: BULLET_LIST_DEFAULT_WIDTH,
    defaultHeight: BULLET_LIST_DEFAULT_HEIGHT,
    cornerRadius: BULLET_LIST_DEFAULT_CORNER_RADIUS,
    root: createDefaultBulletListRoot(),
  };
}

export function isBulletListCard(templateId: string | undefined): boolean {
  return templateId === BULLET_LIST_TEMPLATE_ID;
}

export function isBulletListRowId(elementId: string): boolean {
  return /^row-\d+$/.test(elementId);
}

export function isBulletListCubeId(elementId: string): boolean {
  return /^row-\d+-cube$/.test(elementId);
}

export function isBulletListAddRowId(elementId: string): boolean {
  return elementId === BULLET_LIST_ADD_ROW_ID;
}

export function getBulletListEntriesSection(root: CardElementData | undefined): CardElementData | null {
  if (!root?.children?.length) return null;
  return root.children.find((c) => c.id === BULLET_LIST_ENTRIES_ID) ?? null;
}

export function getBulletListRows(root: CardElementData | undefined): CardElementData[] {
  const entries = getBulletListEntriesSection(root);
  if (!entries?.children?.length) return [];
  return entries.children.filter((c) => c.kind === "section" && isBulletListRowId(c.id));
}

export function getBulletListAccentColor(root: CardElementData | undefined): string {
  const firstRow = root ? getBulletListRows(root)[0] : undefined;
  const marker = getBulletListRowMarker(firstRow ?? undefined);
  if (marker?.kind !== "icon-slot") {
    const cubeColor = marker?.style?.backgroundColor;
    if (cubeColor) return cubeColor;
  }
  const addLabel = root ? findCardElement(root, BULLET_LIST_ADD_ROW_LABEL_ID) : null;
  return addLabel?.textColor ?? BULLET_LIST_ACCENT_DEFAULT;
}

export function getBulletListTitleTextColor(root: CardElementData | undefined): string {
  const title = root ? findCardElement(root, BULLET_LIST_TITLE_ID) : null;
  return title?.textColor ?? BULLET_LIST_ACCENT_DEFAULT;
}

export type BulletListTitleAlign = "left" | "center" | "right" | "full";

const BULLET_LIST_TITLE_BAND_LAYOUT: Pick<
  CardLayoutBox,
  "width" | "alignSelf" | "alignItems" | "justifyContent"
> = {
  width: "100%",
  alignSelf: "stretch",
  alignItems: "stretch",
  justifyContent: "start",
};

export function mergeBulletListTitleBandLayout(
  layout: CardLayoutBox | undefined,
): CardLayoutBox {
  return { ...layout, ...BULLET_LIST_TITLE_BAND_LAYOUT };
}

/** Text styling modal + card properties — keeps full-width band; alignment via `textJustify`. */
export function applyTextStylingPatchToBulletListTitle(
  title: CardElementData,
  styling: Partial<TextStyling>,
): Partial<CardElementData> {
  const patch = applyTextStylingToCardElement(title, styling);
  if (Object.keys(patch).length === 0) return patch;
  return {
    ...patch,
    layout: mergeBulletListTitleBandLayout({ ...title.layout, ...patch.layout }),
  };
}

/** Text styling modal: orientation → title. */
export const BULLET_LIST_MODAL_TITLE_STYLING_KEYS = ["textJustify"] as const satisfies readonly (keyof TextStyling)[];

/** Text styling modal: case & spacing → all item rows. */
export const BULLET_LIST_MODAL_ITEM_STYLING_KEYS = [
  "textTransform",
  "letterSpacing",
  "lineHeight",
] as const satisfies readonly (keyof TextStyling)[];

function pickTextStylingKeys<K extends keyof TextStyling>(
  styling: Partial<TextStyling>,
  keys: readonly K[],
): Partial<Pick<TextStyling, K>> {
  const out: Partial<TextStyling> = {};
  for (const key of keys) {
    if (key in styling) (out as Record<string, unknown>)[key] = styling[key];
  }
  return out as Partial<Pick<TextStyling, K>>;
}

export function getBulletListTextStylingForModal(root: CardElementData): Partial<TextStyling> {
  const title = findCardElement(root, BULLET_LIST_TITLE_ID);
  const firstRow = getBulletListRows(root)[0];
  const itemText = firstRow?.children?.find((c) => c.id.endsWith(BULLET_LIST_TEXT_SUFFIX));
  const titleStyling = title ? extractTextStylingFromCardElement(title) : {};
  const itemStyling = itemText ? extractTextStylingFromCardElement(itemText) : {};
  return {
    textJustify: titleStyling.textJustify ?? getBulletListTitleAlign(root),
    fontFamily: titleStyling.fontFamily ?? itemStyling.fontFamily,
    fontWeight: itemStyling.fontWeight,
    fontStyle: itemStyling.fontStyle,
    textDecoration: itemStyling.textDecoration,
    textTransform: itemStyling.textTransform,
    letterSpacing: itemStyling.letterSpacing,
    lineHeight: itemStyling.lineHeight,
    textOpacity: itemStyling.textOpacity,
    textColor: itemStyling.textColor,
    textOutlineWidth: itemStyling.textOutlineWidth,
    textOutlineColor: itemStyling.textOutlineColor,
    textGlowBlur: itemStyling.textGlowBlur,
    textGlowColor: itemStyling.textGlowColor,
    textShadowOffsetX: itemStyling.textShadowOffsetX,
    textShadowOffsetY: itemStyling.textShadowOffsetY,
    textShadowBlur: itemStyling.textShadowBlur,
    textShadowColor: itemStyling.textShadowColor,
    textDropShadowEnabled: itemStyling.textDropShadowEnabled,
  };
}

export function applyBulletListItemTextStyling(
  elements: CardElementData,
  styling: Partial<TextStyling>,
): CardElementData {
  const itemStyling = pickTextStylingKeys(styling, BULLET_LIST_MODAL_ITEM_STYLING_KEYS);
  if (Object.keys(itemStyling).length === 0) return elements;
  let next = elements;
  for (const row of getBulletListRows(next)) {
    const textEl = row.children?.find((c) => c.id.endsWith(BULLET_LIST_TEXT_SUFFIX));
    if (!textEl) continue;
    const patch = applyTextStylingToCardElement(textEl, itemStyling);
    if (Object.keys(patch).length === 0) continue;
    next = updateCardElementTree(next, textEl.id, patch);
  }
  return next;
}

/** Routes modal fields: title orientation vs item case/spacing. */
export function applyBulletListTextStylingFromModal(
  elements: CardElementData,
  styling: Partial<TextStyling>,
): CardElementData {
  let next = elements;
  const titleStyling = pickTextStylingKeys(styling, BULLET_LIST_MODAL_TITLE_STYLING_KEYS);
  if (Object.keys(titleStyling).length > 0) {
    const title = findCardElement(next, BULLET_LIST_TITLE_ID);
    if (title) {
      next = updateCardElementTree(
        next,
        BULLET_LIST_TITLE_ID,
        applyTextStylingPatchToBulletListTitle(title, titleStyling),
      );
    }
  }
  return applyBulletListItemTextStyling(next, styling);
}

export function getBulletListTitleAlign(root: CardElementData | undefined): BulletListTitleAlign {
  const title = root ? findCardElement(root, BULLET_LIST_TITLE_ID) : null;
  if (title?.textJustify) return title.textJustify;
  return flexJustifyToTextJustify(title?.layout?.justifyContent) ?? "center";
}

export function applyBulletListTitleAlign(
  elements: CardElementData,
  justify: BulletListTitleAlign,
): CardElementData {
  const title = findCardElement(elements, BULLET_LIST_TITLE_ID);
  if (!title) return elements;
  const patch = applyTextStylingPatchToBulletListTitle(title, { textJustify: justify });
  return updateCardElementTree(elements, BULLET_LIST_TITLE_ID, patch);
}

/** Full-width title band — alignment comes from `textJustify`, not flex justify. */
export function resolveBulletListTitleTextLayout(
  elementId: string,
  templateId: string | undefined,
  layout: CardLayoutBox | undefined,
): CardLayoutBox | undefined {
  if (!isBulletListCard(templateId)) return layout;
  if (elementId !== BULLET_LIST_TITLE_ID) return layout;
  return mergeBulletListTitleBandLayout(layout);
}

export function getBulletListItemTextColor(root: CardElementData | undefined): string {
  const firstRow = getBulletListRows(root)[0];
  if (!firstRow) return BULLET_LIST_ITEM_TEXT_DEFAULT;
  const textEl = firstRow.children?.find((c) => c.id.endsWith(BULLET_LIST_TEXT_SUFFIX));
  return textEl?.textColor ?? BULLET_LIST_ITEM_TEXT_DEFAULT;
}

/** Canonical item font size — first row wins so every item renders at the same px size. */
export function getBulletListItemFontSize(root: CardElementData | undefined): number {
  const firstRow = getBulletListRows(root)[0];
  const textEl = firstRow?.children?.find((c) => c.id.endsWith(BULLET_LIST_TEXT_SUFFIX));
  return textEl?.fontSize ?? BULLET_LIST_ITEM_FONT_SIZE;
}

export function resolveBulletListItemFontSizeForRender(
  root: CardElementData | undefined,
  metrics: BulletListResizeMetrics | null,
): number {
  const base = getBulletListItemFontSize(root);
  return metrics ? scaleBulletListItemFontSize(base, metrics) : base;
}

/** Strip per-line font sizes so wrapped / multi-line items match single-line items. */
export function normalizeBulletListItemDisplayRuns(runs: RichTextRun[]): RichTextRun[] {
  return runs.map(({ lineFontSize: _lineFontSize, ...run }) => run);
}

export function applyBulletListUniformItemFontSize(root: CardElementData): CardElementData {
  const fontSize = getBulletListItemFontSize(root);
  let next = root;
  for (const row of getBulletListRows(root)) {
    const textEl = row.children?.find((c) => c.id.endsWith(BULLET_LIST_TEXT_SUFFIX));
    if (!textEl) continue;
    const patch: Partial<CardElementData> = { fontSize };
    if (textEl.richText?.length) {
      patch.richText = normalizeBulletListItemDisplayRuns(textEl.richText);
    }
    next = updateCardElementTree(next, textEl.id, patch);
  }
  return next;
}

export function parseBulletListRow(row: CardElementData): BulletListRowData {
  const textEl = row.children?.find((c) => c.id.endsWith(BULLET_LIST_TEXT_SUFFIX));
  const markerEl = getBulletListRowMarker(row);
  const useIcons = markerEl?.kind === "icon-slot";
  return {
    id: row.id,
    text: textEl?.text ?? "",
    cubeStyle: !useIcons && markerEl?.style ? { ...markerEl.style } : undefined,
    iconRef:
      useIcons && markerEl?.iconRef ? { ...markerEl.iconRef } : undefined,
  };
}

function nextBulletListRowId(rows: CardElementData[]): string {
  let max = 0;
  for (const row of rows) {
    const n = Number.parseInt(row.id.slice(BULLET_LIST_ROW_PREFIX.length), 10);
    if (Number.isFinite(n)) max = Math.max(max, n);
  }
  return `${BULLET_LIST_ROW_PREFIX}${max + 1}`;
}

function readAddRowLabelColor(root: CardElementData): string {
  const addLabel = findCardElement(root, BULLET_LIST_ADD_ROW_LABEL_ID);
  return addLabel?.textColor ?? BULLET_LIST_ADD_LABEL_DEFAULT;
}

export function getBulletListFirstCubeColor(root: CardElementData | undefined): string {
  const firstRow = root ? getBulletListRows(root)[0] : undefined;
  const cube = firstRow?.children?.find((c) => c.id.endsWith(BULLET_LIST_CUBE_SUFFIX));
  return cube?.style?.backgroundColor ?? getBulletListAccentColor(root);
}

export function resolveBulletCubeColor(
  root: CardElementData,
  rowIndex: number,
  storedColor: string | undefined,
  themeHue: boolean,
  hueStepDeg: number,
): string {
  const accent = getBulletListAccentColor(root);
  if (!themeHue) return accent;
  const base = getBulletListFirstCubeColor(root);
  const fill = storedColor ?? accent;
  if (fill === base) {
    return rowIndex === 0 ? base : shiftHueOfColor(base, rowIndex * hueStepDeg);
  }
  return fill;
}

export function inferBulletListHueStepDeg(
  root: CardElementData,
  themeHue: boolean,
  fallbackDeg: number,
): number {
  const rows = getBulletListRows(root);
  if (rows.length < 2) return fallbackDeg;

  const deltas: number[] = [];
  for (let i = 1; i < rows.length; i++) {
    const prevColor = resolveBulletCubeColor(
      root,
      i - 1,
      rows[i - 1]?.children?.find((c) => c.id.endsWith(BULLET_LIST_CUBE_SUFFIX))?.style?.backgroundColor,
      themeHue,
      fallbackDeg,
    );
    const currColor = resolveBulletCubeColor(
      root,
      i,
      rows[i]?.children?.find((c) => c.id.endsWith(BULLET_LIST_CUBE_SUFFIX))?.style?.backgroundColor,
      themeHue,
      fallbackDeg,
    );
    deltas.push(hueDeltaBetweenColors(prevColor, currColor));
  }

  const nonTrivial = deltas.filter((d) => Math.abs(d) >= 0.25);
  if (nonTrivial.length === 0) return fallbackDeg;
  return nonTrivial.reduce((acc, d) => acc + d, 0) / nonTrivial.length;
}

function nextBulletCubeStyle(
  root: CardElementData,
  themeHue: boolean,
  fallbackHueStepDeg: number,
): CardElementStyle {
  const rows = getBulletListRows(root);
  const lastIndex = Math.max(0, rows.length - 1);
  const last = rows[lastIndex];
  const cubeEl = last?.children?.find((c) => c.id.endsWith(BULLET_LIST_CUBE_SUFFIX));
  const stepDeg = inferBulletListHueStepDeg(root, themeHue, fallbackHueStepDeg);
  const prevFill = resolveBulletCubeColor(
    root,
    lastIndex,
    cubeEl?.style?.backgroundColor,
    themeHue,
    fallbackHueStepDeg,
  );
  return {
    backgroundStyle: cubeEl?.style?.backgroundStyle ?? "solid",
    backgroundColor: shiftHueOfColor(prevFill, stepDeg),
    borderRadius:
      cubeEl?.style?.borderRadius ??
      resolveBulletListBulletBorderRadius(
        parseBulletListBulletSize(cubeEl),
        parseBulletListBulletShape(cubeEl),
      ),
  };
}

function rebuildBulletListEntries(root: CardElementData, rows: BulletListRowData[]): CardElementData {
  const accent = getBulletListAccentColor(root);
  const itemTextColor = getBulletListItemTextColor(root);
  const addRowLabelColor = readAddRowLabelColor(root);
  const { size, shape } = readBulletListBulletConfig(root);
  const useIcons = bulletListUsesItemIcons(root);
  const entryChildren: CardElementData[] = rows.map((row) =>
    bulletRowSection(row, accent, itemTextColor, size, shape, useIcons),
  );
  entryChildren.push(bulletAddRowButton(addRowLabelColor));
  let next = updateCardElementTree(root, BULLET_LIST_ENTRIES_ID, { children: entryChildren });
  return applyBulletListUniformItemFontSize(next);
}

/** Switch row markers between colored bullets and per-item icon slots (preserves icons and cube styles). */
export function applyBulletListUseItemIcons(
  elements: CardElementData,
  useIcons: boolean,
): CardElementData {
  if (bulletListUsesItemIcons(elements) === useIcons) return elements;
  const accent = getBulletListAccentColor(elements);
  const { shape } = readBulletListBulletConfig(elements);
  const rows = getBulletListRows(elements).map(parseBulletListRow);
  let next = elements;
  for (const row of getBulletListRows(next)) {
    const marker = getBulletListRowMarker(row);
    if (!marker) continue;
    const markerId = marker.id;
    const parsed = rows.find((r) => r.id === row.id);
    const patch: CardElementData = useIcons
      ? markerDecorToIconSlot(marker, parsed?.iconRef)
      : markerIconSlotToDecor(marker, accent, shape, parsed?.cubeStyle);
    next = updateCardElementTree(next, markerId, patch);
  }
  if (useIcons) {
    const { size } = readBulletListBulletConfig(next);
    if (size < BULLET_LIST_ICON_MARKER_MIN) {
      next = applyBulletListBulletSize(next, BULLET_LIST_ICON_MARKER_MIN);
    }
  }
  return next;
}

export function addBulletListRow(
  elements: CardElementData,
  options?: { hueStepDeg?: number; themeHue?: boolean },
): CardElementData {
  const rows = getBulletListRows(elements);
  const newId = nextBulletListRowId(rows);
  const parsed = rows.map(parseBulletListRow);
  const hueStepDeg = options?.hueStepDeg ?? DIAGRAM_THEME_HUE_STEP_DEG;
  const themeHue = options?.themeHue ?? false;
  parsed.push({
    id: newId,
    text: "New item",
    cubeStyle: themeHue ? nextBulletCubeStyle(elements, themeHue, hueStepDeg) : undefined,
  });
  return rebuildBulletListEntries(elements, parsed);
}

export function removeBulletListRow(elements: CardElementData, rowId: string): CardElementData {
  const rows = getBulletListRows(elements);
  if (rows.length <= BULLET_LIST_MIN_ROWS) return elements;
  const parsed = rows.map(parseBulletListRow).filter((r) => r.id !== rowId);
  return rebuildBulletListEntries(elements, parsed);
}

export function reorderBulletListRows(
  elements: CardElementData,
  fromIndex: number,
  toIndex: number,
): CardElementData {
  const rows = getBulletListRows(elements);
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= rows.length ||
    toIndex >= rows.length
  ) {
    return elements;
  }
  const parsed = rows.map(parseBulletListRow);
  const [moved] = parsed.splice(fromIndex, 1);
  parsed.splice(toIndex, 0, moved);
  return rebuildBulletListEntries(elements, parsed);
}

export function getBulletListRowIndex(elements: CardElementData, rowId: string): number {
  return getBulletListRows(elements).findIndex((r) => r.id === rowId);
}

/** Sync accent color to add-row label and all cube fills (not the title heading). */
export function applyBulletListAccentColor(elements: CardElementData, color: string): CardElementData {
  let next = elements;
  const addLabel = findCardElement(next, BULLET_LIST_ADD_ROW_LABEL_ID);
  if (addLabel) {
    next = updateCardElementTree(next, BULLET_LIST_ADD_ROW_LABEL_ID, { textColor: color });
  }
  for (const row of getBulletListRows(next)) {
    const cubeId = `${row.id}${BULLET_LIST_CUBE_SUFFIX}`;
    const cube = findCardElement(next, cubeId);
    if (!cube || cube.kind === "icon-slot") continue;
    next = updateCardElementTree(next, cubeId, {
      style: { ...cube.style, backgroundColor: color, backgroundStyle: "solid" },
    });
  }
  return next;
}

export function applyBulletListTitleTextColor(elements: CardElementData, color: string): CardElementData {
  const title = findCardElement(elements, BULLET_LIST_TITLE_ID);
  if (!title) return elements;
  return updateCardElementTree(elements, BULLET_LIST_TITLE_ID, { textColor: color });
}

export function applyBulletListItemTextColor(elements: CardElementData, color: string): CardElementData {
  let next = elements;
  for (const row of getBulletListRows(next)) {
    const textId = `${row.id}${BULLET_LIST_TEXT_SUFFIX}`;
    const textEl = findCardElement(next, textId);
    if (textEl) {
      next = updateCardElementTree(next, textId, { textColor: color });
    }
  }
  return next;
}

/** Apply diagram theme accent to title, add-row label, bullets, and item body text. */
export function applyBulletListThemeColors(
  elements: CardElementData,
  accentColor: string,
  itemTextColor: string,
  options?: { stepHueWithinCard?: boolean; hueStepDeg?: number },
): CardElementData {
  let next = applyBulletListAccentColor(elements, accentColor);
  next = applyBulletListTitleTextColor(next, accentColor);
  next = applyBulletListItemTextColor(next, itemTextColor);

  if (options?.stepHueWithinCard && !bulletListUsesItemIcons(next)) {
    const step = options.hueStepDeg ?? DIAGRAM_THEME_HUE_STEP_DEG;
    for (const [index, row] of getBulletListRows(next).entries()) {
      const cubeId = `${row.id}${BULLET_LIST_CUBE_SUFFIX}`;
      const cube = findCardElement(next, cubeId);
      if (!cube || cube.kind === "icon-slot") continue;
      const fill = index === 0 ? accentColor : shiftHueOfColor(accentColor, index * step);
      next = updateCardElementTree(next, cubeId, {
        style: { ...cube.style, backgroundColor: fill, backgroundStyle: "solid" },
      });
    }
  }

  return next;
}

export function applyBulletListBulletSize(elements: CardElementData, sizePx: number): CardElementData {
  const size = clampBulletSize(sizePx);
  const { shape } = readBulletListBulletConfig(elements);
  const borderRadius = resolveBulletListBulletBorderRadius(size, shape);
  let next = elements;
  for (const row of getBulletListRows(next)) {
    const cubeId = `${row.id}${BULLET_LIST_CUBE_SUFFIX}`;
    const cube = findCardElement(next, cubeId);
    if (!cube) continue;
    const layoutPatch = {
      ...cube.layout,
      width: size,
      height: size,
      flex: 0,
      alignSelf: "center" as const,
    };
    if (cube.kind === "icon-slot") {
      next = updateCardElementTree(next, cubeId, { layout: layoutPatch });
      continue;
    }
    next = updateCardElementTree(next, cubeId, {
      layout: layoutPatch,
      style: { ...cube.style, borderRadius },
    });
  }
  return next;
}

export function applyBulletListBulletShape(
  elements: CardElementData,
  shape: BulletListBulletShape,
): CardElementData {
  const { size } = readBulletListBulletConfig(elements);
  const borderRadius = resolveBulletListBulletBorderRadius(size, shape);
  let next = elements;
  for (const row of getBulletListRows(next)) {
    const cubeId = `${row.id}${BULLET_LIST_CUBE_SUFFIX}`;
    const cube = findCardElement(next, cubeId);
    if (!cube || cube.kind === "icon-slot") continue;
    next = updateCardElementTree(next, cubeId, {
      placeholder: shape === "circle" ? "circle" : "rect",
      style: { ...cube.style, borderRadius },
    });
  }
  return next;
}

export function bulletListItemThemeHueEnabled(
  nodeValue: boolean | undefined,
  globalMultiHue: boolean,
): boolean {
  if (typeof nodeValue === "boolean") return nodeValue;
  return globalMultiHue;
}

export function defaultBulletListPaletteNodeProps(): Partial<DiagramNodeData> {
  return {
    width: BULLET_LIST_DEFAULT_WIDTH,
    height: BULLET_LIST_DEFAULT_HEIGHT,
    borderStyle: "gradient",
    borderColors: [...BULLET_LIST_BORDER_COLORS],
    borderWidth: 1,
    backgroundStyle: "none",
    backgroundOpacity: 1,
    shadow: true,
    shadowColor: "#14532d",
    shadowOpacity: 0.35,
    shadowBlur: 6,
    textColor: BULLET_LIST_ITEM_TEXT_DEFAULT,
    textOpacity: 1,
    gradientAngle: BULLET_LIST_GRADIENT_ANGLE,
    textJustify: "center",
    cornerRadius: BULLET_LIST_DEFAULT_CORNER_RADIUS,
    borderColor: BULLET_LIST_BORDER_COLOR,
    lineStyle: "solid",
    lineColor: BULLET_LIST_LINE_COLOR,
    lineWidth: BULLET_LIST_LINE_WIDTH,
    lineOpacity: 1,
    bulletListItemThemeHue: true,
  } as Partial<DiagramNodeData>;
}
