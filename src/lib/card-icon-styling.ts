import type { CardElementData, CardIconRef, CardIconSizeMode } from "@/lib/card-types";
import type { VisualStyling } from "@/lib/visual-styling";

/** Map card icon-slot iconRef + placement to visual-styling panel fields. */
export function cardIconVisualStyling(
  iconRef: CardIconRef,
  element?: Pick<CardElementData, "iconPlacement">,
): Pick<
  VisualStyling,
  "iconColor" | "iconOpacity" | "nodeSize" | "iconPlacement" | "iconSizeMode" | "noIconBackground"
> {
  return {
    iconColor: iconRef.iconColor,
    iconOpacity: iconRef.iconOpacity,
    nodeSize: iconRef.nodeSize,
    iconSizeMode: iconRef.iconSizeMode,
    noIconBackground: iconRef.noIconBackground,
    iconPlacement: element?.iconPlacement,
  };
}

/** Split visual-styling patch into iconRef fields vs icon-slot placement. */
export function partitionCardIconVisualStylingPatch(styling: Record<string, unknown>): {
  iconRefPatch: Partial<CardIconRef>;
  elementPatch: Partial<Pick<CardElementData, "iconPlacement">>;
} {
  const iconRefPatch: Partial<CardIconRef> = {};
  const elementPatch: Partial<Pick<CardElementData, "iconPlacement">> = {};

  if (styling.iconColor !== undefined) iconRefPatch.iconColor = styling.iconColor as string;
  if (styling.iconOpacity !== undefined) iconRefPatch.iconOpacity = styling.iconOpacity as number;
  if (styling.nodeSize !== undefined) iconRefPatch.nodeSize = styling.nodeSize as CardIconRef["nodeSize"];
  if (styling.iconSizeMode !== undefined) {
    iconRefPatch.iconSizeMode = styling.iconSizeMode as CardIconSizeMode;
  }
  if (styling.noIconBackground !== undefined) {
    iconRefPatch.noIconBackground = styling.noIconBackground as boolean;
  }

  if (styling.iconPlacement !== undefined) {
    elementPatch.iconPlacement = styling.iconPlacement as CardElementData["iconPlacement"];
  }

  return { iconRefPatch, elementPatch };
}
