import type { DiagramNodeData } from "@/lib/types";
import type { NodeBorderSpec } from "@/lib/border-types";
import { getBorderTemplate, BORDER_TEMPLATE_LIST } from "@/lib/border-templates";
import { borderNodeTypeForTemplate } from "@/lib/border-utils";

export { BORDER_TEMPLATE_LIST as borderTemplateSwapMenuOptions };

export function swapBorderTemplate(node: DiagramNodeData, newTemplateId: string): DiagramNodeData {
  if (!getBorderTemplate(newTemplateId)) return node;
  const colorMode = node.border?.colorMode ?? "light";
  return {
    ...node,
    type: borderNodeTypeForTemplate(newTemplateId),
    border: {
      templateId: newTemplateId,
      colorMode,
    } satisfies NodeBorderSpec,
  };
}

export function patchBorderSpec(
  node: DiagramNodeData,
  patch: Partial<NodeBorderSpec>,
): DiagramNodeData {
  const prevTemplateId =
    node.border?.templateId ?? node.type.replace(/^generic\.border\./, "");
  const templateId = patch.templateId ?? prevTemplateId;
  const templateChanged = patch.templateId != null && patch.templateId !== prevTemplateId;

  let rolePaints = node.border?.rolePaints;
  if (templateChanged) {
    rolePaints = undefined;
  } else if (patch.rolePaints !== undefined) {
    rolePaints = patch.rolePaints;
  }

  return {
    ...node,
    ...(patch.templateId ? { type: borderNodeTypeForTemplate(patch.templateId) } : {}),
    border: {
      templateId,
      colorMode: patch.colorMode ?? node.border?.colorMode ?? "light",
      ...(rolePaints ? { rolePaints } : {}),
    },
  };
}
