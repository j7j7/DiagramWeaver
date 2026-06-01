import type { NodeBorderSpec } from "@/lib/border-types";
import { BORDER_NODE_TYPE_PREFIX } from "@/lib/border-types";
import { getBorderTemplate } from "@/lib/border-templates";

export function isBorderNodeType(type: string | undefined): boolean {
  return !!type?.startsWith(BORDER_NODE_TYPE_PREFIX);
}

export function getBorderTemplateIdFromNodeType(type: string | undefined): string | null {
  if (!isBorderNodeType(type)) return null;
  return type!.slice(BORDER_NODE_TYPE_PREFIX.length) || null;
}

export function borderNodeTypeForTemplate(templateId: string): string {
  return `${BORDER_NODE_TYPE_PREFIX}${templateId}`;
}

export function createInitialBorderSpec(templateId: string): NodeBorderSpec | undefined {
  if (!getBorderTemplate(templateId)) return undefined;
  return { templateId, colorMode: "light" };
}
