import type { DiagramNodeData, RichTextRun } from "@/lib/types";
import { buildSectionLabelRichTextNode } from "@/lib/section-label-rich-node";

/** Grid in-cell labels are always horizontally centered (per-line `lineJustify` included). */
export function gridChartCellRunsCentered(runs: RichTextRun[]): RichTextRun[] {
  return runs.map((r) => (r.lineJustify === "center" ? r : { ...r, lineJustify: "center" }));
}

export function resolveDiagramNodeTextAlign(
  node: DiagramNodeData,
  fallback: "left" | "center" | "right" = "center"
): "left" | "center" | "right" | "justify" {
  const tj = (node as unknown as Record<string, unknown>).textJustify;
  if (tj === "full") return "justify";
  if (tj === "left" || tj === "right" || tj === "center") return tj;
  return fallback;
}

/** Synthetic node for grid chart cell / title rich text (inherits shape typography + per-slot colour). */
export function buildGridChartInlineTextNode(
  node: DiagramNodeData,
  opts: {
    labelColor: string;
    fontSize: number;
    textAlign?: "left" | "center" | "right" | "justify";
    fontWeight?: string | number;
    textVerticalPosition?: "top" | "middle" | "bottom";
  }
): DiagramNodeData {
  const nodeAny = node as unknown as Record<string, unknown>;
  const textAlignResolved = opts.textAlign ?? resolveDiagramNodeTextAlign(node);
  const fontWeightResolved =
    opts.fontWeight ??
    (nodeAny.fontWeight as string | number | undefined) ??
    600;
  const fontFamily = String(nodeAny.fontFamily ?? "inherit");
  const fontStyle = (nodeAny.fontStyle as DiagramNodeData["fontStyle"]) ?? "normal";
  const textDecoration = (nodeAny.textDecoration as DiagramNodeData["textDecoration"]) ?? "none";
  const lineHeightMul =
    typeof nodeAny.lineHeight === "number" && Number.isFinite(nodeAny.lineHeight)
      ? nodeAny.lineHeight
      : 1.2;
  const letterSpacingPx =
    typeof nodeAny.letterSpacing === "number" && Number.isFinite(nodeAny.letterSpacing)
      ? nodeAny.letterSpacing
      : undefined;
  const textTransform = ((nodeAny.textTransform as string) || "none") as DiagramNodeData["textTransform"];
  const textVerticalPosition = opts.textVerticalPosition ?? "middle";
  return buildSectionLabelRichTextNode(
    node,
    opts.labelColor,
    opts.fontSize,
    textAlignResolved,
    fontWeightResolved,
    fontFamily,
    fontStyle,
    textDecoration,
    lineHeightMul,
    letterSpacingPx,
    textTransform,
    textVerticalPosition
  );
}
