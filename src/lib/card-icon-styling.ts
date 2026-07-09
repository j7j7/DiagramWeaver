import type { CardElementData, CardIconRef, CardIconSizeMode } from "@/lib/card-types";
import type { VisualStyling } from "@/lib/visual-styling";
import { isDiagramRasterIconTile, resolveIconGlyphCssFilter, resolveActiveIconColor } from "@/lib/icon-glyph-filter";
import type { CSSProperties } from "react";

/** Map card icon-slot iconRef + placement to visual-styling panel fields. */
export function cardIconVisualStyling(
  iconRef: CardIconRef,
  element?: Pick<CardElementData, "iconPlacement">,
): Pick<
  VisualStyling,
  "iconColor" | "iconColorEnabled" | "iconGreyscale" | "iconOpacity" | "nodeSize" | "iconPlacement" | "iconSizeMode" | "noIconBackground"
> {
  return {
    iconColor: iconRef.iconColor,
    iconColorEnabled: iconRef.iconColorEnabled,
    iconGreyscale: iconRef.iconGreyscale,
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
  if (styling.iconColorEnabled !== undefined) {
    iconRefPatch.iconColorEnabled = styling.iconColorEnabled as boolean;
  }
  if (styling.iconGreyscale !== undefined) iconRefPatch.iconGreyscale = styling.iconGreyscale as boolean;
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

/** Inline styles for card icon-slot glyph (opacity + raster greyscale/tint). */
export function cardIconGlyphImageStyle(iconRef: CardIconRef): CSSProperties {
  const useRasterTint = isDiagramRasterIconTile(iconRef.type, iconRef.iconType);
  const filter = resolveIconGlyphCssFilter({
    iconColor: iconRef.iconColor,
    iconColorEnabled: iconRef.iconColorEnabled,
    iconGreyscale: iconRef.iconGreyscale,
    useRasterTint,
  });
  const rawOpacity = iconRef.iconOpacity;
  const opacity =
    typeof rawOpacity === "number" && Number.isFinite(rawOpacity)
      ? Math.min(1, Math.max(0, rawOpacity))
      : undefined;
  return {
    ...(opacity !== undefined ? { opacity } : {}),
    ...(filter ? { filter } : {}),
  };
}

export function cardIconResolvedLucideColor(iconRef: CardIconRef): string | undefined {
  if (isDiagramRasterIconTile(iconRef.type, iconRef.iconType)) return undefined;
  return resolveActiveIconColor(iconRef);
}

export function cardIconUsesRasterTint(iconRef: CardIconRef): boolean {
  return isDiagramRasterIconTile(iconRef.type, iconRef.iconType);
}
