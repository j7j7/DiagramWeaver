import type { DiagramNodeData } from "@/lib/types";
import type { CardElementData } from "@/lib/card-types";
import { isCardNodeType } from "@/lib/card-utils";

/** Depth-first list of animatable card regions (excludes root section shell). */
export function flattenCardElements(root: CardElementData | undefined): CardElementData[] {
  if (!root) return [];
  const out: CardElementData[] = [];
  const walk = (el: CardElementData, depth: number) => {
    if (el.kind !== "section" || depth > 0) {
      out.push(el);
    }
    for (const child of el.children ?? []) walk(child, depth + 1);
  };
  walk(root, 0);
  return out;
}

export function cardElementCount(node: DiagramNodeData): number {
  if (!isCardNodeType(node.type)) return 0;
  return flattenCardElements(node.card?.elements).length;
}

export function cardPresentationSignature(node: DiagramNodeData): string | null {
  if (!isCardNodeType(node.type) || !node.card) return null;
  return JSON.stringify({
    templateId: node.card.templateId,
    elements: node.card.elements,
  });
}
