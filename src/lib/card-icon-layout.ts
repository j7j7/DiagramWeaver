import type { CSSProperties } from "react";
import type { CardIconPlacement, CardIconSizeMode } from "@/lib/card-types";
import type { NodeSize } from "@/lib/types";
import { getNodeSizeDimensions, getNodeSizeMultiplier } from "@/lib/visual-styling";

export const CARD_ICON_PLACEMENTS: Array<{ value: CardIconPlacement; label: string }> = [
  { value: "center", label: "Center" },
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
  { value: "top", label: "Top" },
  { value: "bottom", label: "Bottom" },
  { value: "top-left", label: "Top left" },
  { value: "top-right", label: "Top right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-right", label: "Bottom right" },
];

export const CARD_ICON_SIZE_MODES: Array<{ value: CardIconSizeMode; label: string; description: string }> = [
  { value: "scaled", label: "Scaled", description: "Resizes with the icon region" },
  { value: "fixed", label: "Fixed", description: "Stays the same px size when the region resizes" },
];

export function cardIconPlacementToFlex(placement?: CardIconPlacement): {
  alignItems: "flex-start" | "center" | "flex-end";
  justifyContent: "flex-start" | "center" | "flex-end";
} {
  return cardIconPlacementToAbsoluteStyle(placement ?? "center").flex;
}

/** Absolute position for icon glyph inside an icon-slot (flush to edges when left/right/top/bottom). */
export function cardIconPlacementToAbsoluteStyle(placement: CardIconPlacement): {
  flex: { alignItems: "flex-start" | "center" | "flex-end"; justifyContent: "flex-start" | "center" | "flex-end" };
  style: CSSProperties;
} {
  const center = "50%";
  switch (placement) {
    case "left":
      return {
        flex: { alignItems: "center", justifyContent: "flex-start" },
        style: { left: 0, top: center, transform: "translateY(-50%)" },
      };
    case "right":
      return {
        flex: { alignItems: "center", justifyContent: "flex-end" },
        style: { right: 0, top: center, transform: "translateY(-50%)" },
      };
    case "top":
      return {
        flex: { alignItems: "flex-start", justifyContent: "center" },
        style: { top: 0, left: center, transform: "translateX(-50%)" },
      };
    case "bottom":
      return {
        flex: { alignItems: "flex-end", justifyContent: "center" },
        style: { bottom: 0, left: center, transform: "translateX(-50%)" },
      };
    case "top-left":
      return {
        flex: { alignItems: "flex-start", justifyContent: "flex-start" },
        style: { top: 0, left: 0 },
      };
    case "top-right":
      return {
        flex: { alignItems: "flex-start", justifyContent: "flex-end" },
        style: { top: 0, right: 0 },
      };
    case "bottom-left":
      return {
        flex: { alignItems: "flex-end", justifyContent: "flex-start" },
        style: { bottom: 0, left: 0 },
      };
    case "bottom-right":
      return {
        flex: { alignItems: "flex-end", justifyContent: "flex-end" },
        style: { bottom: 0, right: 0 },
      };
    case "center":
    default:
      return {
        flex: { alignItems: "center", justifyContent: "center" },
        style: { left: center, top: center, transform: "translate(-50%, -50%)" },
      };
  }
}

/** Icon footprint within an icon-slot as a percentage of the slot box (matches canvas icon/container ratio × nodeSize). */
export function cardIconSlotSizePercent(nodeSize?: NodeSize): number {
  const { container, icon } = getNodeSizeDimensions(nodeSize);
  const ratio = container > 0 ? icon / container : 0.875;
  const scale = getNodeSizeMultiplier(nodeSize ?? "normal");
  return Math.min(100, Math.round(ratio * scale * 100));
}

/** Enable container queries so scaled glyph size can use min(cqw, cqh). */
export function cardIconSlotContainerStyle(sizeMode?: CardIconSizeMode): CSSProperties {
  if ((sizeMode ?? "scaled") === "fixed") return {};
  return { containerType: "size" };
}

/**
 * Square icon box: scaled uses min(cqw,cqh) from slot; fixed uses canvas icon px from nodeSize preset.
 */
export function cardIconGlyphSizeStyle(
  nodeSize?: NodeSize,
  sizeMode?: CardIconSizeMode,
  fillSlot?: boolean,
): CSSProperties {
  if (fillSlot) {
    return { width: "100%", height: "100%" };
  }
  const mode = sizeMode ?? "scaled";
  if (mode === "fixed") {
    const { icon } = getNodeSizeDimensions(nodeSize);
    return { width: icon, height: icon };
  }
  const iconSizePct = cardIconSlotSizePercent(nodeSize);
  const size = `min(${iconSizePct}cqw, ${iconSizePct}cqh)`;
  return { width: size, height: size };
}
