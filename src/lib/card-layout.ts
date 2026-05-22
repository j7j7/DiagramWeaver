import type { CSSProperties } from "react";
import type { CardElementStyle, CardFlexAlign, CardFlexJustify, CardLayoutBox } from "@/lib/card-types";

function mapAlign(a?: CardFlexAlign): CSSProperties["alignItems"] {
  switch (a) {
    case "start": return "flex-start";
    case "end": return "flex-end";
    case "stretch": return "stretch";
    case "center": return "center";
    default: return undefined;
  }
}

function mapJustify(j?: CardFlexJustify): CSSProperties["justifyContent"] {
  switch (j) {
    case "start": return "flex-start";
    case "end": return "flex-end";
    case "center": return "center";
    case "space-between": return "space-between";
    default: return undefined;
  }
}

function normalizePadding(p?: CardLayoutBox["padding"]): CSSProperties["padding"] {
  if (p == null) return undefined;
  if (typeof p === "number") return p;
  if (p.length === 2) return `${p[0]}px ${p[1]}px`;
  return `${p[0]}px ${p[1]}px ${p[2]}px ${p[3]}px`;
}

function dim(v?: number | string): string | number | undefined {
  if (v == null) return undefined;
  if (typeof v === "number") return v;
  return v;
}

/** Card layout uses flex as grow weight; `0` means fixed-size (not CSS `flex: 0` which collapses to 0 basis). */
function layoutFlexToCss(flex: number | undefined): CSSProperties["flex"] | undefined {
  if (flex == null) return undefined;
  if (flex === 0) return "0 0 auto";
  return flex;
}

export function cardElementStyleToCss(style?: CardElementStyle): CSSProperties {
  if (!style) return {};
  const out: CSSProperties = {};
  if (style.opacity != null) out.opacity = style.opacity;
  if (style.borderRadius != null) out.borderRadius = style.borderRadius;
  if (style.borderWidth != null && style.borderWidth > 0) {
    out.borderWidth = style.borderWidth;
    out.borderStyle = style.borderStyle ?? "solid";
    out.borderColor = style.borderColor ?? "#0f172a";
  }
  if (style.backgroundStyle === "gradient" && style.backgroundColors?.length === 2) {
    const angle = style.gradientAngle ?? 135;
    out.background = `linear-gradient(${angle}deg, ${style.backgroundColors[0]}, ${style.backgroundColors[1]})`;
  } else if (style.backgroundStyle === "mesh_gradient") {
    /* Mesh painted by CardElementMeshBackground */
  } else if (style.backgroundColor && style.backgroundStyle !== "none") {
    out.backgroundColor = style.backgroundColor;
  } else if (style.backgroundStyle === "none") {
    out.backgroundColor = "transparent";
  }
  return out;
}

export function cardLayoutToCss(layout?: CardLayoutBox, isSection = false): CSSProperties {
  if (!layout) return isSection ? { display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0 } : {};
  const hasFlexChild = layout.flex != null || layout.flexDirection != null || isSection;
  const hasFixedWidth = layout.width != null && layout.flex !== 1;
  return {
    display: hasFlexChild ? "flex" : undefined,
    flex: layoutFlexToCss(layout.flex),
    flexShrink: hasFixedWidth ? 0 : undefined,
    flexDirection: layout.flexDirection,
    alignItems: mapAlign(layout.alignItems),
    justifyContent: mapJustify(layout.justifyContent),
    alignSelf: mapAlign(layout.alignSelf),
    gap: layout.gap,
    padding: normalizePadding(layout.padding),
    width: dim(layout.width),
    height: dim(layout.height),
    minWidth: layout.minWidth != null ? dim(layout.minWidth) : (isSection ? 0 : undefined),
    minHeight: layout.minHeight != null ? dim(layout.minHeight) : (isSection ? 0 : undefined),
    maxHeight: dim(layout.maxHeight),
    borderRadius: layout.borderRadius,
    overflow: layout.overflow,
  };
}
