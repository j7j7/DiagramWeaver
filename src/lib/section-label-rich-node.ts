import type { DiagramNodeData } from "@/lib/types";

/**
 * Synthetic node for `TextboxRichDisplay` / `TextboxRichEditor` when editing a timeline / pyramid /
 * segmented-rectangle section label (inherits shape typography + per-segment colour).
 */
export function buildSectionLabelRichTextNode(
  node: DiagramNodeData,
  labelColor: string,
  segFontSize: number,
  textAlignResolved: "left" | "center" | "right" | "justify",
  fontWeightResolved: string | number,
  fontFamily: string,
  fontStyle: DiagramNodeData["fontStyle"],
  textDecoration: DiagramNodeData["textDecoration"],
  lineHeightMul: number,
  letterSpacingPx: number | undefined,
  textTransform: DiagramNodeData["textTransform"],
  textVerticalPosition: "top" | "middle" | "bottom",
): DiagramNodeData {
  const nodeAny = node as unknown as Record<string, unknown>;
  const textJustify: DiagramNodeData["textJustify"] =
    textAlignResolved === "justify"
      ? "full"
      : textAlignResolved === "left" || textAlignResolved === "right" || textAlignResolved === "center"
        ? textAlignResolved
        : "center";
  const topOpacity = Number(nodeAny.textOpacity);
  return {
    ...node,
    textColor: labelColor,
    fontSize: segFontSize,
    fontWeight: fontWeightResolved as DiagramNodeData["fontWeight"],
    fontFamily,
    fontStyle,
    textDecoration,
    textJustify,
    textVerticalPosition,
    lineHeight: lineHeightMul,
    ...(letterSpacingPx !== undefined ? { letterSpacing: letterSpacingPx } : {}),
    textTransform: textTransform ?? "none",
    ...(topOpacity >= 0 && topOpacity !== 1 ? { textOpacity: topOpacity } : {}),
  } as DiagramNodeData;
}
