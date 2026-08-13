import type { DiagramNodeData } from "@/lib/types";
import type { CardElementData } from "@/lib/card-types";
import { CARD_TEMPLATE_LIST, createInitialCardSpec, getCardTemplate } from "@/lib/card-templates";
import {
  cardNodeTypeForTemplate,
  getCardTemplateIdFromNodeType,
  isCardNodeType,
} from "@/lib/card-utils";

export const CARD_TEMPLATE_MENU_OPTIONS = CARD_TEMPLATE_LIST.map((t) => ({
  templateId: t.id,
  label: t.name,
}));

function mergeElementContent(templateEl: CardElementData, prevById: Map<string, CardElementData>): CardElementData {
  const prev = prevById.get(templateEl.id);
  const merged: CardElementData = {
    ...templateEl,
    text: prev?.text ?? templateEl.text,
    richText: prev?.richText ?? templateEl.richText,
    tag: prev?.tag ?? templateEl.tag,
    iconRef: prev?.iconRef ?? templateEl.iconRef,
    fontSize: prev?.fontSize ?? templateEl.fontSize,
    fontWeight: prev?.fontWeight ?? templateEl.fontWeight,
    textColor: prev?.textColor ?? templateEl.textColor,
    style: prev?.style ? { ...templateEl.style, ...prev.style } : templateEl.style,
    layout: prev?.layout ? { ...templateEl.layout, ...prev.layout } : templateEl.layout,
  };
  if (templateEl.children?.length) {
    merged.children = templateEl.children.map((c) => mergeElementContent(c, prevById));
  }
  return merged;
}

function indexElementsById(root: CardElementData, map = new Map<string, CardElementData>()): Map<string, CardElementData> {
  map.set(root.id, root);
  for (const child of root.children ?? []) indexElementsById(child, map);
  return map;
}

/** Swap card template while preserving element content matched by `id`. */
export function swapCardTemplate(node: DiagramNodeData, newTemplateId: string): DiagramNodeData {
  if (!isCardNodeType(node.type)) return node;
  const template = getCardTemplate(newTemplateId);
  if (!template) return node;
  const fresh = createInitialCardSpec(newTemplateId);
  if (!fresh) return node;
  const prevById = node.card?.elements ? indexElementsById(node.card.elements) : new Map();
  const elements = mergeElementContent(fresh.elements, prevById);
  return {
    ...node,
    type: cardNodeTypeForTemplate(newTemplateId),
    width: node.width ?? template.defaultWidth,
    height: node.height ?? template.defaultHeight,
    cornerRadius: node.cornerRadius ?? template.cornerRadius ?? 0.12,
    card: {
      templateId: newTemplateId,
      elements,
    },
  };
}

export function cardTemplateSwapMenuOptions(type: string | undefined): typeof CARD_TEMPLATE_MENU_OPTIONS {
  if (!isCardNodeType(type)) return [];
  const current = getCardTemplateIdFromNodeType(type);
  return CARD_TEMPLATE_MENU_OPTIONS.filter((o) => o.templateId !== current);
}
