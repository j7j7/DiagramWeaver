import type { CardElementData, CardElementStyle, CardIconRef, CardLayoutBox, CardTemplate } from "@/lib/card-types";
import type { DiagramNodeData, NodeSize } from "@/lib/types";
import { findCardElement, updateCardElementTree } from "@/lib/card-utils";
import { getNodeSizeDimensions } from "@/lib/visual-styling";
import {
  resolveIconBevelSampleSrcAsync,
  sampleIconDominantColorFromUrl,
  shadeHexColor,
} from "@/lib/icon-bevel";

export const ICON_BORDER_TEMPLATE_ID = "icon-border";
export const ICON_BORDER_ROOT_ID = "root";
export const ICON_BORDER_HEADER_ID = "header";
export const ICON_BORDER_ICON_ID = "icon";
export const ICON_BORDER_TITLE_ID = "title";

export const ICON_BORDER_BORDER_COLOR_DEFAULT = "#ed7100";
export const ICON_BORDER_FILL_DEFAULT = "#ffffff";
export const ICON_BORDER_TEXT_COLOR_DEFAULT = "#374151";
export const ICON_BORDER_DEFAULT_WIDTH = 680;
export const ICON_BORDER_DEFAULT_HEIGHT = 440;
export const ICON_BORDER_CORNER_RADIUS_DEFAULT = 0.04;
export const ICON_BORDER_TITLE_DEFAULT = "TITLE";
export const ICON_BORDER_TITLE_FONT_SIZE = 32;
export const ICON_BORDER_TITLE_FONT_WEIGHT = "400" as const;

export type IconBorderTextAlign = "left" | "center" | "right";
export const ICON_BORDER_TEXT_ALIGN_DEFAULT: IconBorderTextAlign = "left";

/** Dropped (and default) corner icon: half tile, no chrome. */
export const ICON_BORDER_ICON_NODE_SIZE: NodeSize = "half";
export const ICON_BORDER_DEFAULT_ICON_REF: CardIconRef = {
  type: "aws.compute.compute-optimizer",
  provider: "aws",
  category: "compute",
  file: "aws/Architecture-Service-Icons_01302026/Arch_Compute/64/Arch_AWS-Compute-Optimizer_64.svg",
  noIconBackground: true,
  nodeSize: ICON_BORDER_ICON_NODE_SIZE,
  iconSizeMode: "fixed",
};

const TITLE_PADDING: CardLayoutBox["padding"] = [0, 12, 0, 0];

/** Glyph identity from the drop; always half size and no icon tile border. */
export function applyIconBorderDroppedIconSettings(iconRef: CardIconRef): CardIconRef {
  return {
    ...iconRef,
    noIconBackground: true,
    nodeSize: ICON_BORDER_ICON_NODE_SIZE,
    iconSizeMode: "fixed",
  };
}

export function commitIconBorderDroppedIcon(
  elements: CardElementData,
  elementId: string,
  iconRef: CardIconRef,
): CardElementData {
  const next = updateCardElementTree(elements, elementId, {
    iconRef: applyIconBorderDroppedIconSettings(iconRef),
  });
  return applyIconBorderNodeSize(next, ICON_BORDER_ICON_NODE_SIZE);
}

/** Identity of the glyph (not size / plate settings). */
export function cardIconRefIdentity(ref?: CardIconRef | null): string {
  if (!ref) return "";
  return [ref.type ?? "", ref.file ?? "", ref.iconName ?? "", ref.emoji ?? "", ref.imageUrl ?? ""].join("\0");
}

/** Majority colour of a dropped catalog icon (Lucide/emoji: explicit iconColor only). */
export async function sampleCardIconDominantColor(iconRef: CardIconRef): Promise<string | null> {
  if (iconRef.iconType === "emoji") return null;
  if (iconRef.iconType === "lucide") {
    const tint = iconRef.iconColor?.trim();
    return tint || null;
  }
  const src = await resolveIconBevelSampleSrcAsync({
    type: iconRef.type,
    provider: iconRef.provider,
    category: iconRef.category,
    file: iconRef.file,
    imageUrl: iconRef.imageUrl,
  });
  if (src) {
    const sampled = await sampleIconDominantColorFromUrl(src);
    if (sampled) return sampled;
  }
  const fallback = iconRef.iconColor?.trim();
  return fallback || null;
}

/** Apply sampled icon colour to the Icon Border shell (solid + gradient stops). */
export function applyIconBorderShellFromHex(node: DiagramNodeData, hex: string): DiagramNodeData {
  const dark = shadeHexColor(hex, -0.18);
  return {
    ...node,
    borderColor: hex,
    borderColors: [hex, dark],
  };
}

export function isIconBorderCard(templateId: string | undefined): boolean {
  return templateId === ICON_BORDER_TEMPLATE_ID;
}

/** Tint the shell only if this node still shows the icon we sampled. */
export function iconBorderShellTintIfMatch(
  node: DiagramNodeData,
  elementId: string,
  expectedIdentity: string,
  hex: string,
): DiagramNodeData {
  if (!expectedIdentity || !hex) return node;
  if (!node.card?.elements || !isIconBorderCard(node.card.templateId)) return node;
  const cur = findCardElement(node.card.elements, elementId)?.iconRef;
  if (cardIconRefIdentity(cur) !== expectedIdentity) return node;
  return applyIconBorderShellFromHex(node, hex);
}

export function getIconBorderRegions(root: CardElementData | undefined): {
  header: CardElementData | null;
  icon: CardElementData | null;
  title: CardElementData | null;
} {
  if (!root?.children?.length) {
    return { header: null, icon: null, title: null };
  }
  const header = root.children.find((c) => c.id === ICON_BORDER_HEADER_ID) ?? null;
  const icon = header?.children?.find((c) => c.id === ICON_BORDER_ICON_ID) ?? null;
  const title = header?.children?.find((c) => c.id === ICON_BORDER_TITLE_ID) ?? null;
  return { header, icon, title };
}

export function parseIconBorderNodeSize(icon: CardElementData | null | undefined): NodeSize {
  const size = icon?.iconRef?.nodeSize;
  if (size === "half" || size === "quarter" || size === "double" || size === "normal") return size;
  return ICON_BORDER_ICON_NODE_SIZE;
}

/** Apply standard icon size preset (normal / half / quarter / double) to the corner slot. */
export function applyIconBorderNodeSize(elements: CardElementData, nodeSize: NodeSize): CardElementData {
  const icon = findCardElement(elements, ICON_BORDER_ICON_ID);
  if (!icon) return elements;
  const { container } = getNodeSizeDimensions(nodeSize);
  return updateCardElementTree(elements, ICON_BORDER_ICON_ID, {
    layout: {
      ...icon.layout,
      width: container,
      height: container,
      flex: 0,
    },
    iconRef: icon.iconRef ? { ...icon.iconRef, nodeSize } : icon.iconRef,
  });
}

/** Slot box matches canvas icon tile size for the selected nodeSize. */
export function resolveIconBorderIconLayout(
  elementId: string,
  templateId: string | undefined,
  layout: CardLayoutBox | undefined,
  iconRef?: CardElementData["iconRef"],
): CardLayoutBox | undefined {
  if (!isIconBorderCard(templateId) || elementId !== ICON_BORDER_ICON_ID) return layout;
  const { container } = getNodeSizeDimensions(iconRef?.nodeSize);
  return {
    ...layout,
    width: container,
    height: container,
    flex: 0,
  };
}

export function getIconBorderTextAlign(title: CardElementData | null | undefined): IconBorderTextAlign {
  const j = title?.textJustify;
  if (j === "left" || j === "center" || j === "right") return j;
  return ICON_BORDER_TEXT_ALIGN_DEFAULT;
}

export function applyIconBorderTextAlign(
  elements: CardElementData,
  align: IconBorderTextAlign,
): CardElementData {
  const title = findCardElement(elements, ICON_BORDER_TITLE_ID);
  if (!title) return elements;
  return updateCardElementTree(elements, ICON_BORDER_TITLE_ID, { textJustify: align });
}

export function updateIconBorderElementStyle(
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

/** Title sits against the icon’s right edge and spans the remaining card width. */
export function resolveIconBorderTextLayout(
  elementId: string,
  templateId: string | undefined,
  layout: CardLayoutBox | undefined,
): CardLayoutBox | undefined {
  if (!isIconBorderCard(templateId) || elementId !== ICON_BORDER_TITLE_ID) return layout;
  return {
    ...layout,
    flex: layout?.flex ?? 1,
    minWidth: 0,
    width: "100%",
    alignSelf: "stretch",
    padding: layout?.padding ?? TITLE_PADDING,
    justifyContent: layout?.justifyContent ?? "start",
  };
}

export function resolveIconBorderHeaderLayout(
  elementId: string,
  templateId: string | undefined,
  layout: CardLayoutBox | undefined,
): CardLayoutBox | undefined {
  if (!isIconBorderCard(templateId) || elementId !== ICON_BORDER_HEADER_ID) return layout;
  return {
    ...layout,
    flexDirection: "row",
    flex: 0,
    width: "100%",
    alignItems: "stretch",
    minWidth: 0,
  };
}

export const ICON_BORDER_TEMPLATE: CardTemplate = {
  id: ICON_BORDER_TEMPLATE_ID,
  name: "Icon Border",
  defaultWidth: ICON_BORDER_DEFAULT_WIDTH,
  defaultHeight: ICON_BORDER_DEFAULT_HEIGHT,
  cornerRadius: ICON_BORDER_CORNER_RADIUS_DEFAULT,
  root: {
    id: ICON_BORDER_ROOT_ID,
    kind: "section",
    layout: {
      flexDirection: "column",
      width: "100%",
      height: "100%",
      padding: 0,
      gap: 0,
      overflow: "hidden",
      alignItems: "stretch",
    },
    style: {
      backgroundStyle: "solid",
      backgroundColor: ICON_BORDER_FILL_DEFAULT,
    },
    children: [
      {
        id: ICON_BORDER_HEADER_ID,
        kind: "section",
        layout: {
          flexDirection: "row",
          flex: 0,
          width: "100%",
          gap: 10,
          alignItems: "stretch",
          minWidth: 0,
        },
        style: { backgroundStyle: "none" },
        children: [
          {
            id: ICON_BORDER_ICON_ID,
            kind: "icon-slot",
            layout: {
              width: getNodeSizeDimensions(ICON_BORDER_ICON_NODE_SIZE).container,
              height: getNodeSizeDimensions(ICON_BORDER_ICON_NODE_SIZE).container,
              flex: 0,
            },
            style: { backgroundStyle: "none", borderRadius: 0 },
            placeholder: "rect",
            iconFillSlot: false,
            matchCardBorder: false,
            iconSlotShadow: false,
            iconRef: { ...ICON_BORDER_DEFAULT_ICON_REF },
          },
          {
            id: ICON_BORDER_TITLE_ID,
            kind: "text",
            text: ICON_BORDER_TITLE_DEFAULT,
            editable: true,
            fontSize: ICON_BORDER_TITLE_FONT_SIZE,
            fontWeight: ICON_BORDER_TITLE_FONT_WEIGHT,
            lineHeight: 1.25,
            textColor: ICON_BORDER_TEXT_COLOR_DEFAULT,
            textJustify: "left",
            textVerticalPosition: "middle",
            textGlowBlur: 0,
            textOutlineWidth: 0,
            richText: [
              {
                text: ICON_BORDER_TITLE_DEFAULT,
                lineJustify: "left",
                lineFontSize: ICON_BORDER_TITLE_FONT_SIZE,
              },
            ],
            layout: {
              flex: 1,
              minWidth: 0,
              width: "100%",
              alignSelf: "stretch",
              padding: TITLE_PADDING,
              justifyContent: "start",
            },
            style: { backgroundStyle: "none" },
          },
        ],
      },
    ],
  },
};
