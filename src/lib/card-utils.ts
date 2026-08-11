import type { CardElementData, CardIconRef, NodeCardSpec } from "@/lib/card-types";
import { CARD_NODE_TYPE_PREFIX } from "@/lib/card-types";
import { AGENDA_TEMPLATE_ID, createDefaultAgendaRoot } from "@/lib/card-agenda";
import { getCardTemplate } from "@/lib/card-templates";

export function isCardNodeType(type: string | undefined): boolean {
  return !!type?.startsWith(CARD_NODE_TYPE_PREFIX);
}

export function getCardTemplateIdFromNodeType(type: string | undefined): string | null {
  if (!isCardNodeType(type)) return null;
  return type!.slice(CARD_NODE_TYPE_PREFIX.length) || null;
}

export function cardNodeTypeForTemplate(templateId: string): string {
  return `${CARD_NODE_TYPE_PREFIX}${templateId}`;
}

function deepCloneElement(el: CardElementData): CardElementData {
  return {
    ...el,
    richText: el.richText ? el.richText.map((r) => ({ ...r })) : undefined,
    iconRef: el.iconRef ? { ...el.iconRef } : undefined,
    style: el.style
      ? {
          ...el.style,
          backgroundColors: el.style.backgroundColors
            ? ([...el.style.backgroundColors] as [string, string])
            : undefined,
          meshGradientPoints: el.style.meshGradientPoints
            ? el.style.meshGradientPoints.map((p) => ({ ...p }))
            : undefined,
        }
      : undefined,
    layout: el.layout ? { ...el.layout } : undefined,
    children: el.children ? el.children.map(deepCloneElement) : undefined,
  };
}

export function createInitialCardSpec(templateId: string): NodeCardSpec | undefined {
  const template = getCardTemplate(templateId);
  if (!template) return undefined;
  if (templateId === AGENDA_TEMPLATE_ID) {
    return {
      templateId,
      elements: createDefaultAgendaRoot(new Date()),
    };
  }
  return {
    templateId,
    elements: cloneCardElementTree(template.root),
  };
}

/** Deep-clone a card element tree (palette drops, template swap). */
export function cloneCardElementTree(el: CardElementData): CardElementData {
  return deepCloneElement(el);
}

export function findCardElement(root: CardElementData, elementId: string): CardElementData | null {
  if (root.id === elementId) return root;
  for (const child of root.children ?? []) {
    const found = findCardElement(child, elementId);
    if (found) return found;
  }
  return null;
}

export function updateCardElementTree(
  root: CardElementData,
  elementId: string,
  patch: Partial<CardElementData>,
): CardElementData {
  if (root.id === elementId) {
    return { ...root, ...patch };
  }
  if (!root.children?.length) return root;
  return {
    ...root,
    children: root.children.map((c) => updateCardElementTree(c, elementId, patch)),
  };
}

export type CardElementFieldPatch = {
  id: string;
  patch: Partial<CardElementData>;
};

function walkCardElementsById(
  root: CardElementData,
  into: Map<string, CardElementData>,
): void {
  into.set(root.id, root);
  for (const child of root.children ?? []) {
    walkCardElementsById(child, into);
  }
}

function cardElementFieldEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/**
 * Diff two card element trees by id (ignores newly added ids / children arrays).
 * Used to replay Visual styling Heading/Border/Card-property edits onto multi-selected cards.
 */
export function diffCardElementTreePatches(
  prev: CardElementData,
  next: CardElementData,
): CardElementFieldPatch[] {
  const prevById = new Map<string, CardElementData>();
  const nextById = new Map<string, CardElementData>();
  walkCardElementsById(prev, prevById);
  walkCardElementsById(next, nextById);
  const patches: CardElementFieldPatch[] = [];
  for (const [id, nextEl] of nextById) {
    const prevEl = prevById.get(id);
    if (!prevEl) continue;
    const patch: Partial<CardElementData> = {};
    const keys = new Set([
      ...Object.keys(prevEl),
      ...Object.keys(nextEl),
    ]) as Set<keyof CardElementData>;
    for (const key of keys) {
      if (key === "children" || key === "id") continue;
      if (!cardElementFieldEqual(prevEl[key], nextEl[key])) {
        (patch as Record<string, unknown>)[key] = nextEl[key];
      }
    }
    if (Object.keys(patch).length > 0) {
      patches.push({ id, patch });
    }
  }
  return patches;
}

/** Apply id-targeted field patches onto a card tree (skips missing ids). */
export function applyCardElementFieldPatches(
  root: CardElementData,
  patches: readonly CardElementFieldPatch[],
): CardElementData {
  let out = root;
  for (const { id, patch } of patches) {
    const el = findCardElement(out, id);
    if (!el) continue;
    const merged: Partial<CardElementData> = { ...patch };
    if (patch.style) {
      merged.style = { ...el.style, ...patch.style };
    }
    out = updateCardElementTree(out, id, merged);
  }
  return out;
}

export function mapCardElementTree(
  root: CardElementData,
  mapFn: (el: CardElementData) => CardElementData,
): CardElementData {
  const mapped = mapFn(root);
  if (!mapped.children?.length) return mapped;
  return {
    ...mapped,
    children: mapped.children.map((child) => mapCardElementTree(child, mapFn)),
  };
}

export function iconDragItemToCardIconRef(item: {
  type: string;
  provider?: string;
  category?: string;
  file?: string;
  iconType?: "lucide" | "emoji";
  iconName?: string;
  emoji?: string;
  iconColor?: string;
  imageUrl?: string;
  imageOptions?: CardIconRef["imageOptions"];
}): CardIconRef {
  return {
    type: item.type,
    provider: item.provider,
    category: item.category,
    file: item.file,
    iconType: item.iconType,
    iconName: item.iconName,
    emoji: item.emoji,
    iconColor: item.iconColor,
    imageUrl: item.imageUrl,
    imageOptions: item.imageOptions,
  };
}

export function resolveCardIconDropFromPoint(
  clientX: number,
  clientY: number,
): { nodeId: string; elementId: string } | null {
  return resolveCardIconSlotFromPoint(clientX, clientY);
}

/** Bullet list rows: drop on row text/section still targets the row icon-slot marker. */
function resolveRowSectionIconSlotFromElement(
  el: Element,
  nodeId?: string,
): { nodeId: string; elementId: string } | null {
  const section = el.closest(
    '[data-dw-card-element-kind="section"]',
  ) as HTMLElement | null;
  if (!section) return null;
  const sectionId = section.dataset.dwCardElementId ?? "";
  if (!/^row-\d+$/.test(sectionId)) return null;
  const marker = section.querySelector("[data-dw-card-icon-slot]") as HTMLElement | null;
  if (!marker) return null;
  const hitNodeId = marker.dataset.dwCardNodeId;
  const elementId = marker.dataset.dwCardElementId;
  if (!hitNodeId || !elementId) return null;
  if (nodeId && hitNodeId !== nodeId) return null;
  return { nodeId: hitNodeId, elementId };
}

/** Hit-test icon-slot under cursor; walks the full pointer stack (resize rails, etc.). */
export function resolveCardIconSlotFromPoint(
  clientX: number,
  clientY: number,
  nodeId?: string,
): { nodeId: string; elementId: string } | null {
  if (typeof document === "undefined") return null;
  const stack =
    typeof document.elementsFromPoint === "function"
      ? document.elementsFromPoint(clientX, clientY)
      : [document.elementFromPoint(clientX, clientY)].filter(Boolean);
  for (const el of stack) {
    if (!(el instanceof Element)) continue;
    const slot = el.closest("[data-dw-card-icon-slot]") as HTMLElement | null;
    if (slot) {
      const hitNodeId = slot.dataset.dwCardNodeId;
      const elementId = slot.dataset.dwCardElementId;
      if (hitNodeId && elementId && (!nodeId || hitNodeId === nodeId)) {
        return { nodeId: hitNodeId, elementId };
      }
    }
    const rowSlot = resolveRowSectionIconSlotFromElement(el, nodeId);
    if (rowSlot) return rowSlot;
  }
  return null;
}

export function isIconPaletteDragItem(item: { type?: string }): boolean {
  const t = item.type ?? "";
  return (
    t.startsWith("generic.icon.") ||
    t.startsWith("generic.emoji.") ||
    (!!t && t.split(".").length >= 3 && !t.startsWith("generic.object.") && !t.startsWith("generic.card.") && !t.startsWith("generic.border.") && !t.startsWith("generic.chart.") && !t.startsWith("generic.text."))
  );
}
