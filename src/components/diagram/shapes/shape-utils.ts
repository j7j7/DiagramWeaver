import type { CSSProperties } from "react";
import type { DiagramNodeData } from "@/lib/types";
import { getTextStylingCSS, extractTextStylingFromNode } from "@/lib/text-styling";

// Helper function to get gradient CSS with angle
export const getGradientWithAngle = (colors: string[], angle: number = 135) => {
  // Convert angle to CSS gradient direction
  let gradientDirection = '';
  switch (angle) {
    case 0:
      gradientDirection = 'to right';
      break;
    case 45:
      gradientDirection = 'to bottom right';
      break;
    case -45:
      gradientDirection = 'to top right';
      break;
    case 90:
      gradientDirection = 'to bottom';
      break;
    case 180:
      gradientDirection = 'to left';
      break;
    default:
      gradientDirection = `${angle}deg`;
  }
  // Ensure unique string by including angle in all cases
  const gradient = `linear-gradient(${gradientDirection}, ${colors[0]}, ${colors[1]})`;
  return gradient;
};

// Helper function to determine if a color is dark or light
const isColorDark = (color: string): boolean => {
  // Convert hex to RGB
  let r = 0, g = 0, b = 0;
  
  if (color.startsWith('#')) {
    const hex = color.replace('#', '');
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    }
  } else if (color.startsWith('rgb')) {
    const matches = color.match(/\d+/g);
    if (matches) {
      r = parseInt(matches[0]);
      g = parseInt(matches[1]);
      b = parseInt(matches[2]);
    }
  }
  
  // Calculate relative luminance (perceived brightness)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return true if dark (luminance < 0.5)
  return luminance < 0.5;
};

// Helper function to get text color based on background
export const getTextColorForBackground = (backgroundColor: string, customTextColor?: string): string => {
  if (customTextColor) return customTextColor;
  return isColorDark(backgroundColor) ? '#ffffff' : '#000000';
};

// Helper function to get text styling CSS for a node
export const getTextStylingForNode = (node: DiagramNodeData) => {
  const textStyling = extractTextStylingFromNode(node);
  return getTextStylingCSS(textStyling);
};

// Helper function to get text justification class
export const getTextJustifyClass = (justify?: string) => {
  switch (justify) {
    case 'left':
      return 'text-left';
    case 'center':
      return 'text-center';
    case 'right':
      return 'text-right';
    case 'full':
      return 'text-justify';
    default:
      return 'text-center';
  }
};

// Helper function to get vertical positioning class (for flex containers with flex-col)
export const getVerticalPositionClass = (position?: string) => {
  switch (position) {
    case 'top':
      return 'items-start';
    case 'middle':
      return 'items-center';
    case 'bottom':
      return 'items-end';
    default:
      return 'items-center';
  }
};

// Helper function to get vertical justification class (for flex containers with flex-col to position content)
export const getVerticalJustifyClass = (position?: string) => {
  switch (position) {
    case 'top':
      return 'justify-start';
    case 'middle':
      return 'justify-center';
    case 'bottom':
      return 'justify-end';
    default:
      return 'justify-center';
  }
};

// Helper function to get tag positioning classes
export const getTagPositionClasses = (position?: string) => {
  switch (position) {
    case 'top-left':
      return '-top-[30px] left-0';
    case 'top-center':
      return '-top-[30px] left-1/2 transform -translate-x-1/2';
    case 'top-right':
      return '-top-[30px] right-0';
    case 'bottom-left':
      return '-bottom-[30px] left-0';
    case 'bottom-center':
      return '-bottom-[30px] left-1/2 transform -translate-x-1/2';
    case 'bottom-right':
      return '-bottom-[30px] right-0';
    default:
      return '-top-[30px] left-1/2 transform -translate-x-1/2'; // Default to top-center
  }
};

/** #rgb / #rrggbb / #rgba → rgba() for glass tint. Falls back to rgba(255,255,255,a). */
export function hexToRgbaString(hex: string | undefined, alpha: number): string {
  const a = Math.min(1, Math.max(0, alpha));
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) {
    return `rgba(255, 255, 255, ${a})`;
  }
  const raw = hex.replace('#', '');
  let r = 255;
  let g = 255;
  let b = 255;
  if (raw.length === 3) {
    r = parseInt(raw[0] + raw[0], 16);
    g = parseInt(raw[1] + raw[1], 16);
    b = parseInt(raw[2] + raw[2], 16);
  } else if (raw.length >= 6) {
    r = parseInt(raw.substring(0, 2), 16);
    g = parseInt(raw.substring(2, 4), 16);
    b = parseInt(raw.substring(4, 6), 16);
  }
  if (![r, g, b].every((n) => Number.isFinite(n))) {
    return `rgba(255, 255, 255, ${a})`;
  }
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

const DEFAULT_FROSTED_DIFFUSION = 0.45;
const DEFAULT_FROSTED_TRANSPARENCY = 0.55; // 0 = opaque, 1 = more see-through

function clamp01(n: number | undefined, fallback: number): number {
  if (n === undefined || !Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

export type FrostedGlassParams = {
  /** Backdrop blur radius in px */
  blurPx: number;
  /** CSS saturate() argument */
  saturation: number;
  /** Tint alpha applied on top of backdrop (0–1) */
  tintAlpha: number;
  /** Solid color string for the tint (rgba) */
  tintRgba: string;
  /** Glass fill over blur (glassmorphism-style translucent layer) */
  fillRgba: string;
  /** Compound box-shadow: outer depth + inset rim / highlights */
  glassBoxShadow: string;
  /** Grain / noise overlay opacity (0–1), scales with diffusion */
  grainOpacity: number;
  /** Perlin-style smooth noise 0=off, 10=max (independent of diffusion grain). */
  frostedPerlinNoise: number;
};

function clampFrostedPerlin10(n: number | undefined): number {
  if (n === undefined || !Number.isFinite(n)) return 0;
  return Math.min(10, Math.max(0, n));
}

/** Tiled fractal noise for frosted-glass grain (SVG filter). */
const FROST_GRAIN_DATA_URL = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">' +
    '<filter id="g" x="-15%" y="-15%" width="130%" height="130%">' +
    '<feTurbulence type="fractalNoise" baseFrequency="0.72" numOctaves="4" seed="7" stitchTiles="stitch"/>' +
    '</filter>' +
    '<rect width="100%" height="100%" filter="url(#g)"/>' +
    '</svg>'
)}")`;

/** Finer speckle (higher frequency) layered with {@link FROST_GRAIN_DATA_URL}. */
const FROST_GRAIN_FINE_DATA_URL = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">' +
    '<filter id="f" x="-20%" y="-20%" width="140%" height="140%">' +
    '<feTurbulence type="fractalNoise" baseFrequency="1.15" numOctaves="3" seed="23" stitchTiles="stitch"/>' +
    '</filter>' +
    '<rect width="100%" height="100%" filter="url(#f)"/>' +
    '</svg>'
)}")`;

/** Must match `background-size` 1:1 (no extra scaling) so `repeat` does not re-interpolate tile edges. */
const FROST_PERLIN_TILE_PX = 256;

/**
 * Billowy Perlin-style texture (`fractalNoise` + `stitchTiles="stitch"`).
 * Filter region = tile bounds; `userSpaceOnUse` + `primitiveUnits="userSpaceOnUse"` so edge stitching
 * lines up with the repeated bitmap (oversized filter regions and arbitrary `background-size` caused seams).
 */
const FROST_PERLIN_DATA_URL = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">' +
    '<filter id="fp" x="0" y="0" width="256" height="256" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse">' +
    '<feTurbulence type="fractalNoise" baseFrequency="0.024 0.032" numOctaves="4" seed="59" stitchTiles="stitch" result="turb"/>' +
    '<feColorMatrix in="turb" type="matrix" result="luma" values="0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0"/>' +
    '</filter>' +
    '<rect x="0" y="0" width="256" height="256" filter="url(#fp)"/>' +
    '</svg>'
)}")`;

/**
 * `frostedTransparency`: 0 = least see-through, 1 = most see-through (clearer view of content below).
 * `frostedDiffusion`: 0 = sharp, 1 = strong blur.
 * `frostedPerlinNoise`: 0–10, smooth Perlin-style overlay (independent of diffusion speckle).
 */
export function getFrostedGlassParams(
  baseColor: string | undefined,
  frostedDiffusion: number | undefined,
  frostedTransparency: number | undefined,
  options?: { forInlineStacking?: boolean; frostedPerlinNoise?: number }
): FrostedGlassParams {
  const d = clamp01(frostedDiffusion, DEFAULT_FROSTED_DIFFUSION);
  const t = clamp01(frostedTransparency, DEFAULT_FROSTED_TRANSPARENCY);
  // Blur: steeper power curve — very low diffusion ≈ almost sharp; high end still ~48px.
  const blurPx = d < 0.02 ? 0 : 0.35 + Math.pow(d, 1.88) * 47.2;
  // Saturation lift ramps up mostly in the upper half of the slider
  const saturation = 1.005 + d * 0.18 + d * d * 0.42;
  // Tint wash (slightly stronger when “less transparent”)
  const tintAlpha = 0.04 + (1 - t) * 0.52;
  // Glass fill: low diffusion = much less wash over content
  let fillAlpha = (0.052 + (1 - t) * 0.19) * (0.18 + 0.82 * d);
  let grainOpacity = d < 0.02 ? 0 : 0.012 + Math.pow(d, 1.48) * 0.32;
  /** Lighter wash + grain so real `backdrop-filter` is visible under pan/zoom (portal keeps full strength). */
  if (options?.forInlineStacking) {
    fillAlpha *= 0.68;
    grainOpacity *= 0.52;
  }
  const dDepth = 0.35 + 0.65 * d;
  const depth = (0.035 + d * 0.1) * dDepth;
  const rim = (0.11 + (1 - t) * 0.16) * (0.4 + 0.6 * d);
  const hi = (0.2 + (1 - t) * 0.32) * (0.45 + 0.55 * d);
  const lo = (0.05 + (1 - t) * 0.09) * (0.45 + 0.55 * d);
  const y = (3 + d * 9) * dDepth;
  const blur = (16 + d * 26) * dDepth;
  const spread = (0.45 + d * 1.35) * (0.5 + 0.5 * d);
  const glassBoxShadow = [
    `0 ${y}px ${blur}px rgba(0, 0, 0, ${depth})`,
    `inset 0 1px 0 rgba(255, 255, 255, ${hi})`,
    `inset 0 -1px 0 rgba(255, 255, 255, ${lo})`,
    `inset 0 0 0 ${spread}px rgba(255, 255, 255, ${rim})`,
  ].join(", ");
  return {
    blurPx,
    saturation,
    tintAlpha,
    tintRgba: hexToRgbaString(baseColor, tintAlpha),
    fillRgba: hexToRgbaString(baseColor, fillAlpha),
    glassBoxShadow,
    grainOpacity,
    frostedPerlinNoise: clampFrostedPerlin10(options?.frostedPerlinNoise),
  };
}

function frostBackdropFilterValue(p: FrostedGlassParams): string {
  const blurPx = p.blurPx < 0.02 ? 0 : p.blurPx;
  return `blur(${blurPx}px) saturate(${p.saturation})`;
}

/** Force new backdrop layers when diffusion/tint changes — Chromium often ignores `blur()` updates on the same element. */
export function getFrostedInlineBackdropReactKey(
  p: FrostedGlassParams,
  frostedGlassClipPath?: string
): string {
  return `${p.blurPx}|${p.saturation}|${p.fillRgba}|${p.tintRgba}|${frostedGlassClipPath ?? ""}`;
}

/**
 * `clip-path` on inline frosted **backdrop** / **tint** layers so blur + wash match the shape.
 * Do **not** put these clips on a common ancestor of `backdrop-filter` (breaks blur in Chromium)
 * — use {@link getFrostedShouldClipFrostedStackRoot} = false; clip each layer only.
 * Supports: `inset(…)`, `polygon(…)`, `circle(…)`, `ellipse(…)`.
 */
export function getFrostedBackdropLayerClipStyle(
  frostedGlassClipPath: string | undefined
): Pick<CSSProperties, "clipPath" | "WebkitClipPath"> | undefined {
  if (!frostedGlassClipPath) return undefined;
  const s = frostedGlassClipPath.trimStart().toLowerCase();
  if (
    s.startsWith("inset(") ||
    s.startsWith("polygon(") ||
    s.startsWith("circle(") ||
    s.startsWith("ellipse(")
  ) {
    return { clipPath: frostedGlassClipPath, WebkitClipPath: frostedGlassClipPath };
  }
  return undefined;
}

/** @deprecated Use {@link getFrostedBackdropLayerClipStyle} */
export const getFrostedInsetClipStyleForBackdropLayers = getFrostedBackdropLayerClipStyle;

/**
 * Stronger blur + micro contrast/brightness for **inline** glass (layer-order mode).
 * For shaped clips, merge {@link getFrostedBackdropLayerClipStyle} so corners/edges match.
 */
export function getFrostedGlassInlineBackdropPrimaryStyle(p: FrostedGlassParams): CSSProperties {
  const raw = p.blurPx < 0.02 ? 0 : 1.55 + p.blurPx * 1.38;
  const blurPx = Math.min(92, raw);
  const sat = Math.min(1.92, p.saturation * 1.14);
  const f =
    raw < 0.02
      ? "none"
      : `blur(${blurPx}px) saturate(${sat}) contrast(1.04) brightness(1.02)`;
  return {
    position: "absolute",
    inset: 0,
    borderRadius: "inherit",
    pointerEvents: "none",
    zIndex: 1,
    backgroundColor: p.fillRgba,
    backdropFilter: f,
    WebkitBackdropFilter: f,
  };
}

/** Primary blur (px) for PNG underlay — matches {@link getFrostedGlassInlineBackdropPrimaryStyle}. */
export function getFrostedGlassExportRasterBackdropBlurPx(p: FrostedGlassParams): number {
  const raw = p.blurPx < 0.02 ? 0 : 1.55 + p.blurPx * 1.38;
  return Math.min(92, raw);
}

/** Saturate factor for PNG underlay canvas filter — matches primary inline backdrop. */
export function getFrostedGlassExportRasterBackdropSaturate(p: FrostedGlassParams): number {
  return Math.min(1.92, p.saturation * 1.14);
}

/**
 * Effective blur for export raster (primary + softened second pass when present).
 * Matches on-canvas stacked backdrop passes closely enough for PNG.
 */
export function getFrostedGlassExportRasterStackBlurPx(p: FrostedGlassParams): number {
  const primary = getFrostedGlassExportRasterBackdropBlurPx(p);
  if (p.blurPx < 0.18) return primary;
  const second = Math.min(32, 3.2 + p.blurPx * 0.36);
  return primary + second * 0.38;
}

/** Second compositing pass: softer blur so stacked backdrops read “thicker” frosted glass. */
export function getFrostedGlassInlineBackdropSecondPassStyle(p: FrostedGlassParams): CSSProperties | undefined {
  if (p.blurPx < 0.18) return undefined;
  const blurPx = Math.min(32, 3.2 + p.blurPx * 0.36);
  return {
    position: "absolute",
    inset: 0,
    borderRadius: "inherit",
    pointerEvents: "none",
    zIndex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.035)",
    backdropFilter: `blur(${blurPx}px) saturate(1.08)`,
    WebkitBackdropFilter: `blur(${blurPx}px) saturate(1.08)`,
  };
}

function frostedRgbaComponents(rgba: string): { r: number; g: number; b: number; a: number } | null {
  const m = rgba.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/);
  if (!m) return null;
  return { r: +m[1], g: +m[2], b: +m[3], a: m[4] !== undefined ? parseFloat(m[4]) : 1 };
}

/**
 * html-to-image rasterizes via SVG `foreignObject`, where `backdrop-filter` does not composite.
 * Use this as `data-frosted-export-fallback-bg` so PNG export keeps a milky glass read.
 */
export function getFrostedGlassExportBackdropPrimaryFallbackColor(p: FrostedGlassParams): string {
  const fill = frostedRgbaComponents(p.fillRgba);
  const tint = frostedRgbaComponents(p.tintRgba);
  const fillA = fill?.a ?? 0;
  const tintA = tint?.a ?? 0;
  const blurBoost = p.blurPx < 0.02 ? 0 : Math.min(0.4, 0.07 + (p.blurPx / 92) * 0.33);
  const outA = Math.min(0.9, fillA + tintA * 0.52 + blurBoost);
  const tr = tint?.r ?? 255;
  const tg = tint?.g ?? 255;
  const tb = tint?.b ?? 255;
  const fr = fill?.r ?? tr;
  const fg = fill?.g ?? tg;
  const fb = fill?.b ?? tb;
  const w = Math.min(1, tintA * 2 + 0.35);
  const r = Math.round(fr * (1 - w) + tr * w);
  const g = Math.round(fg * (1 - w) + tg * w);
  const b = Math.round(fb * (1 - w) + tb * w);
  return `rgba(${r}, ${g}, ${b}, ${outA})`;
}

/** Second frosted backdrop pass: visible wash when export strips `backdrop-filter`. */
export function getFrostedGlassExportBackdropSecondFallbackColor(p: FrostedGlassParams): string {
  if (p.blurPx < 0.18) return "rgba(255, 255, 255, 0)";
  const a = Math.min(0.18, 0.04 + (p.blurPx / 48) * 0.14);
  return `rgba(255, 255, 255, ${a})`;
}

/** Inset/outer shadows only — keep off the element that runs `backdrop-filter` (Chromium often drops blur when combined). */
export function getFrostedGlassDropShadowLayerStyle(p: FrostedGlassParams): CSSProperties {
  return {
    position: "absolute",
    inset: 0,
    borderRadius: "inherit",
    pointerEvents: "none",
    zIndex: 0,
    boxShadow: p.glassBoxShadow,
  };
}

/** Colour wash from **background / tint** (`tintRgba`) — stacked above blur passes, under grain. */
export function getFrostedGlassTintLayerStyle(p: FrostedGlassParams): CSSProperties {
  return {
    position: "absolute",
    inset: 0,
    borderRadius: "inherit",
    pointerEvents: "none",
    zIndex: 1,
    backgroundColor: p.tintRgba,
  };
}

/** Top edge highlight (Hype4 glass ::before analogue). */
export function getFrostedGlassTopEdgeHighlightStyle(): CSSProperties {
  return {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    pointerEvents: "none",
    zIndex: 3,
    background:
      "linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.82) 50%, transparent 100%)",
    opacity: 0.9,
  };
}

/** Left edge highlight (Hype4 glass ::after analogue). */
export function getFrostedGlassLeftEdgeHighlightStyle(): CSSProperties {
  return {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: 1,
    pointerEvents: "none",
    zIndex: 3,
    background:
      "linear-gradient(180deg, rgba(255, 255, 255, 0.78) 0%, transparent 45%, rgba(255, 255, 255, 0.28) 100%)",
    opacity: 0.85,
  };
}

/** Speckled grain on top of the blurred layer (realistic diffusion). */
export function getFrostedGrainOverlayStyle(grainOpacity: number): CSSProperties {
  if (!Number.isFinite(grainOpacity) || grainOpacity < 0.02) {
    return { display: "none" };
  }
  return {
    position: "absolute",
    inset: 0,
    borderRadius: "inherit",
    pointerEvents: "none",
    zIndex: 1,
    opacity: Math.min(1, grainOpacity),
    backgroundImage: FROST_GRAIN_DATA_URL,
    backgroundRepeat: "repeat",
    backgroundSize: "96px 96px",
    mixBlendMode: "overlay",
  };
}

/** Extra high-frequency speckle (same diffusion slider as coarse grain). */
export function getFrostedFineGrainOverlayStyle(grainOpacity: number): CSSProperties {
  if (!Number.isFinite(grainOpacity) || grainOpacity < 0.02) {
    return { display: "none" };
  }
  const o = Math.min(1, grainOpacity * 0.88);
  return {
    position: "absolute",
    inset: 0,
    borderRadius: "inherit",
    pointerEvents: "none",
    zIndex: 1,
    opacity: o,
    backgroundImage: FROST_GRAIN_FINE_DATA_URL,
    backgroundRepeat: "repeat",
    backgroundSize: "48px 48px",
    mixBlendMode: "soft-light",
  };
}

/**
 * Smooth Perlin-style (`fractalNoise` → sRGB luma on **R,G,B** via `feColorMatrix`) texture; 0 = off, 10 = strong.
 * **`luminosity`**: backdrop provides hue/sat; the tile is strictly luminance (no chroma from `feTurbulence`).
 * Render before speckle grain.
 */
export function getFrostedPerlinNoiseOverlayStyle(level0to10: number): CSSProperties {
  const n = clampFrostedPerlin10(level0to10);
  if (n < 0.04) {
    return { display: "none" };
  }
  const t = n / 10;
  const px = FROST_PERLIN_TILE_PX;
  return {
    position: "absolute",
    inset: 0,
    borderRadius: "inherit",
    pointerEvents: "none",
    zIndex: 0,
    opacity: Math.min(0.52, 0.05 + t * 0.47),
    backgroundImage: FROST_PERLIN_DATA_URL,
    backgroundRepeat: "repeat",
    /** Pixel-perfect repeat: size must match {@link FROST_PERLIN_TILE_PX} / intrinsic SVG (see {@link FROST_PERLIN_DATA_URL}). */
    backgroundSize: `${px}px ${px}px`,
    backgroundPosition: "0 0",
    mixBlendMode: "luminosity",
  };
}

// Get shape styling properties from node
export const getShapeStyles = (node: DiagramNodeData & { width?: number; height?: number }) => {
  const nodeAny = node as any;
  const backgroundStyle = nodeAny.backgroundStyle || 'solid';
  const backgroundColors = nodeAny.backgroundColors || [nodeAny.backgroundColor || '#6b7280', nodeAny.backgroundColor || '#6b7280'];
  const backgroundColor = nodeAny.backgroundColor || '#6b7280';
  const gradientAngle = nodeAny.gradientAngle || 135;
  const borderGradientAngle = nodeAny.borderGradientAngle ?? nodeAny.gradientAngle ?? 135;
  const borderStyle = nodeAny.borderStyle || 'solid';
  const borderColor = nodeAny.borderColor || '#6b7280';
  const borderColors = nodeAny.borderColors || [nodeAny.borderColor || '#6b7280', nodeAny.borderColor || '#6b7280'];
  const borderWidth = nodeAny.borderWidth || 2;
  const shadow = nodeAny.shadow || false;
  const roundedEdges = nodeAny.roundedEdges || false;

  const isFrosted = backgroundStyle === 'frosted';
  const frostedGlass = isFrosted
    ? getFrostedGlassParams(
        backgroundColor,
        nodeAny.frostedDiffusion as number | undefined,
        nodeAny.frostedTransparency as number | undefined,
        {
          forInlineStacking: true,
          frostedPerlinNoise: nodeAny.frostedPerlinNoise as number | undefined,
        }
      )
    : null;

  return {
    background: isFrosted
      ? 'transparent'
      : backgroundStyle === 'gradient'
        ? getGradientWithAngle(backgroundColors, gradientAngle)
        : backgroundStyle === 'none'
          ? 'transparent'
          : backgroundColor,
    borderWidth: borderStyle === 'none' ? '0' : `${borderWidth}px`,
    borderStyle: borderStyle === 'gradient' ? 'solid' : borderStyle,
    borderColor: borderStyle === 'gradient' ? 'transparent' : borderColor,
    borderColors,
    borderImage: borderStyle === 'gradient' ? `${getGradientWithAngle(borderColors, borderGradientAngle)} 1` : undefined,
    shadow,
    roundedEdges,
    backgroundColor:
      isFrosted
        ? 'transparent'
        : backgroundStyle === 'gradient'
          ? backgroundColors[0]
          : backgroundStyle === 'none'
            ? 'transparent'
            : backgroundColor,
    frostedGlass,
  };
};

/** SVG interior fill from visual styling — `none` is fully transparent, not the solid gray fallback. */
export function getShapeSvgFill(
  backgroundStyle: string | undefined,
  gradientFillRef: string,
  solidColor: string | undefined,
  solidFallback = '#6b7280'
): string {
  if (backgroundStyle === 'frosted') return 'transparent';
  if (backgroundStyle === 'gradient') return gradientFillRef;
  if (backgroundStyle === 'none') return 'transparent';
  return solidColor || solidFallback;
}

/**
 * Convert polygon points string to array of [x, y] coordinates
 */
export const parsePoints = (points: string): [number, number][] => {
  return points.split(/\s+/).map(point => {
    const [x, y] = point.split(',').map(Number);
    return [x, y];
  });
};

/** Parse SVG `viewBox="minX minY width height"`. */
export function parseViewBoxString(viewBox: string): { vbX: number; vbY: number; vbW: number; vbH: number } {
  const p = viewBox
    .trim()
    .split(/[\s,]+/)
    .map((s) => parseFloat(s));
  return {
    vbX: p[0] ?? 0,
    vbY: p[1] ?? 0,
    vbW: p[2] ?? 0,
    vbH: p[3] ?? 0,
  };
}

/**
 * CSS `clip-path: polygon(...)` as % of the shape box, from SVG `transformedPoints` in viewBox space.
 * Matches `preserveAspectRatio="none"` SVG layout (fills width×height).
 */
export function getFrostedPolygonClipPathCss(transformedPoints: string, viewBox: string): string | undefined {
  const { vbX, vbY, vbW, vbH } = parseViewBoxString(viewBox);
  if (vbW <= 0 || vbH <= 0) return undefined;
  const coords = parsePoints(transformedPoints);
  if (coords.length < 3) return undefined;
  const pairs = coords.map(([x, y]) => {
    const pctX = ((x - vbX) / vbW) * 100;
    const pctY = ((y - vbY) / vbH) * 100;
    return `${pctX}% ${pctY}%`;
  });
  return `polygon(${pairs.join(", ")})`;
}

/** Use with SvgShapeBase polygon shapes (`preserveAspectRatio` default `none`). */
export function frostedPolygonClipForSvgPolygon(
  backgroundStyle: string | undefined,
  transformedPoints: string,
  viewBox: string
): string | undefined {
  if (backgroundStyle !== "frosted") return undefined;
  return getFrostedPolygonClipPathCss(transformedPoints, viewBox);
}

/**
 * CSS `clip-path: circle(… at …)` (or `ellipse(…)` when `preserveAspectRatio` is `none`) so
 * frosted inline layers match a transparent SVG circle fill.
 */
export function getFrostedCircleClipPathCss(
  viewBox: string,
  c: { cx: number; cy: number; r: number },
  width: number,
  height: number,
  preserveAspectRatio: string | undefined
): string | undefined {
  const { vbX, vbY, vbW, vbH } = parseViewBoxString(viewBox);
  if (vbW <= 0 || vbH <= 0 || width <= 0 || height <= 0) return undefined;
  if (!(c.r > 0) || !Number.isFinite(c.r)) return undefined;
  const ar = (preserveAspectRatio ?? "xMidYMid meet").trim().toLowerCase();
  if (ar === "none") {
    const scaleX = width / vbW;
    const scaleY = height / vbH;
    const cxPx = (c.cx - vbX) * scaleX;
    const cyPx = (c.cy - vbY) * scaleY;
    const rxPx = c.r * scaleX;
    const ryPx = c.r * scaleY;
    return `ellipse(${rxPx}px ${ryPx}px at ${cxPx}px ${cyPx}px)`;
  }
  const s = Math.min(width / vbW, height / vbH);
  const tx = (width - vbW * s) / 2;
  const ty = (height - vbH * s) / 2;
  const cxPx = tx + (c.cx - vbX) * s;
  const cyPx = ty + (c.cy - vbY) * s;
  const rPx = c.r * s;
  return `circle(${rPx}px at ${cxPx}px ${cyPx}px)`;
}

/**
 * Compute viewBox and transformed points so the shape fills its container.
 * Without this, shapes like kite/triangle use oversized viewBoxes which leave
 * visible padding and cause misalignment with other shapes (e.g. rectangles).
 * @param points - Polygon points string (e.g., "30,5 55,50 5,50")
 * @param strokePadding - Padding for stroke (default 1) so stroke isn't clipped
 * @param targetSize - When provided, viewBox matches node size (w+2*pad, h+2*pad)
 *   and points are scaled to fill; prevents scaling gaps when resizing
 * @returns viewBox string, dimensions, and transformed points for polygon/path
 */
export const getPolygonViewBoxAndPoints = (
  points: string,
  strokePadding = 1,
  targetSize?: { w: number; h: number }
): { viewBox: string; width: number; height: number; transformedPoints: string } => {
  const coords = parsePoints(points);
  if (coords.length < 3) {
    return { viewBox: "0 0 60 60", width: 60, height: 60, transformedPoints: points };
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of coords) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  const pad = strokePadding;
  const naturalW = maxX - minX;
  const naturalH = maxY - minY;

  let w: number;
  let h: number;
  let transformedPoints: string;

  if (targetSize && naturalW > 0 && naturalH > 0) {
    const tw = targetSize.w;
    const th = targetSize.h;
    w = tw + 2 * pad;
    h = th + 2 * pad;
    const scaleX = tw / naturalW;
    const scaleY = th / naturalH;
    transformedPoints = coords
      .map(([x, y]) => `${(x - minX) * scaleX + pad},${(y - minY) * scaleY + pad}`)
      .join(" ");
  } else {
    w = naturalW + 2 * pad;
    h = naturalH + 2 * pad;
    transformedPoints = coords
      .map(([x, y]) => `${x - minX + pad},${y - minY + pad}`)
      .join(" ");
  }

  return { viewBox: `0 0 ${w} ${h}`, width: w, height: h, transformedPoints };
};

/**
 * Calculate the angle between two points
 */
const angleBetween = (p1: [number, number], p2: [number, number]): number => {
  return Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
};

/**
 * Calculate distance between two points
 */
const distance = (p1: [number, number], p2: [number, number]): number => {
  return Math.sqrt(Math.pow(p2[0] - p1[0], 2) + Math.pow(p2[1] - p1[1], 2));
};

/**
 * Convert polygon points to a path with rounded corners
 * @param points - Polygon points string (e.g., "30,5 55,50 5,50")
 * @param radius - Corner radius (default: 5% of average edge length)
 * @param viewBox - ViewBox dimensions [width, height] for calculating relative radius
 */
export const polygonToRoundedPath = (
  points: string,
  radius?: number,
  viewBox?: [number, number]
): string => {
  const coords = parsePoints(points);
  if (coords.length < 3) return '';

  // Calculate default radius if not provided (6% of average edge length for subtle rounding)
  let defaultRadius = radius;
  if (defaultRadius === undefined) {
    let totalLength = 0;
    for (let i = 0; i < coords.length; i++) {
      const next = (i + 1) % coords.length;
      totalLength += distance(coords[i], coords[next]);
    }
    const avgLength = totalLength / coords.length;
    defaultRadius = avgLength * 0.06; // 6% of average edge length (subtle rounding)
  }

  // Clamp radius to prevent it from being too large
  let minEdgeLength = Infinity;
  for (let i = 0; i < coords.length; i++) {
    const next = (i + 1) % coords.length;
    const edgeLength = distance(coords[i], coords[next]);
    minEdgeLength = Math.min(minEdgeLength, edgeLength);
  }
  const maxRadius = minEdgeLength * 0.25; // Max 25% of shortest edge (prevents over-exaggeration)
  
  // Ensure minimum radius for small shapes (at least 1 unit to keep rounding visible)
  const minRadius = 1;
  const actualRadius = Math.max(minRadius, Math.min(defaultRadius, maxRadius));

  const pathParts: string[] = [];
  
  for (let i = 0; i < coords.length; i++) {
    const prev = coords[(i - 1 + coords.length) % coords.length];
    const curr = coords[i];
    const next = coords[(i + 1) % coords.length];

    // Calculate edge vectors pointing AWAY from the corner (along the edges)
    // Edge 1: from prev to curr (pointing toward curr, then away from prev)
    const edge1 = [curr[0] - prev[0], curr[1] - prev[1]];
    // Edge 2: from curr to next (pointing away from curr toward next)
    const edge2 = [next[0] - curr[0], next[1] - curr[1]];
    
    // Normalize edge vectors
    const len1 = Math.sqrt(edge1[0] * edge1[0] + edge1[1] * edge1[1]);
    const len2 = Math.sqrt(edge2[0] * edge2[0] + edge2[1] * edge2[1]);
    
    if (len1 === 0 || len2 === 0) continue;
    
    const dir1 = [edge1[0] / len1, edge1[1] / len1]; // Direction along edge 1 (toward curr)
    const dir2 = [edge2[0] / len2, edge2[1] / len2]; // Direction along edge 2 (away from curr)
    
    // Calculate the angle between the two edges
    const dotProduct = dir1[0] * dir2[0] + dir1[1] * dir2[1];
    const angle = Math.acos(Math.max(-1, Math.min(1, dotProduct)));
    
    // Calculate distance from corner to start/end of rounded corner
    // Use a smaller multiplier to create subtle rounding without bulging
    const dist = actualRadius / Math.tan(angle / 2);
    
    // Clamp distance to prevent it from exceeding a smaller portion of edge length
    // This creates more subtle rounding
    const maxDist1 = len1 * 0.3;
    const maxDist2 = len2 * 0.3;
    const clampedDist = Math.min(dist, maxDist1, maxDist2, actualRadius * 1.5);
    
    // Calculate rounded corner start point (along edge 1, before reaching curr)
    const startX = curr[0] - dir1[0] * clampedDist;
    const startY = curr[1] - dir1[1] * clampedDist;
    
    // Calculate rounded corner end point (along edge 2, after leaving curr)
    const endX = curr[0] + dir2[0] * clampedDist;
    const endY = curr[1] + dir2[1] * clampedDist;
    
    if (i === 0) {
      pathParts.push(`M ${startX},${startY}`);
    } else {
      pathParts.push(`L ${startX},${startY}`);
    }
    
    // Add smooth curve to round the corner
    // Use a control point that's positioned to create a smooth rounded corner
    // Position it between start and end, offset slightly toward the corner
    // but not at the corner itself (to avoid bulging)
    
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;
    
    // Calculate direction from midpoint toward corner
    const toCornerX = curr[0] - midX;
    const toCornerY = curr[1] - midY;
    const toCornerLen = Math.sqrt(toCornerX * toCornerX + toCornerY * toCornerY);
    
    if (toCornerLen > 0.01) {
      // Position control point closer to midpoint than corner
      // This creates a smooth curve without bulging
      const controlOffset = Math.min(actualRadius * 0.5, toCornerLen * 0.3);
      const controlX = midX + (toCornerX / toCornerLen) * controlOffset;
      const controlY = midY + (toCornerY / toCornerLen) * controlOffset;
      
      pathParts.push(`Q ${controlX},${controlY} ${endX},${endY}`);
    } else {
      // Fallback: straight line
      pathParts.push(`L ${endX},${endY}`);
    }
  }
  
  pathParts.push('Z');
  return pathParts.join(' ');
};

/**
 * Convert gradient angle to SVG linear gradient coordinates
 * @param angle - Gradient angle in degrees (0-360)
 * @returns SVG gradient coordinates object with x1, y1, x2, y2 as percentage strings
 */
export const getGradientCoordinates = (angle: number = 135) => {
  const radians = (angle * Math.PI) / 180;
  const x2 = 50 + 50 * Math.cos(radians);
  const y2 = 50 + 50 * Math.sin(radians);
  const x1 = 50 - 50 * Math.cos(radians);
  const y1 = 50 - 50 * Math.sin(radians);
  return {
    x1: `${x1}%`,
    y1: `${y1}%`,
    x2: `${x2}%`,
    y2: `${y2}%`
  };
};

/**
 * Generate SVG gradient coordinate data (no JSX - for use in .ts files)
 * @param gradientId - Unique ID for the gradient
 * @param colors - Array of two colors for the gradient
 * @param angle - Fill gradient angle in degrees (default: 135)
 * @param borderGradientId - Optional unique ID for border gradient
 * @param borderColors - Optional array of two colors for border gradient
 * @param borderAngle - Border gradient angle in degrees (defaults to fill angle)
 */
export const createSvgGradientData = (
  gradientId: string,
  colors: string[],
  angle: number = 135,
  borderGradientId?: string,
  borderColors?: string[],
  borderAngle?: number
) => {
  const coords = getGradientCoordinates(angle);
  const borderCoords = borderGradientId && borderColors
    ? getGradientCoordinates(borderAngle ?? angle)
    : undefined;
  return {
    gradientData: { id: gradientId, ...coords, color1: colors[0], color2: colors[1] },
    borderGradientData: borderGradientId && borderColors && borderCoords
      ? { id: borderGradientId, ...borderCoords, color1: borderColors[0], color2: borderColors[1] }
      : undefined,
    fillRef: `url(#${gradientId})`,
    strokeRef: borderGradientId ? `url(#${borderGradientId})` : undefined
  };
};

/**
 * Get SVG stroke properties for rounded edges (for path-based shapes)
 * Returns strokeLinejoin and strokeLinecap properties when roundedEdges is enabled
 */
export const getRoundedEdgesProps = (roundedEdges: boolean) => {
  if (!roundedEdges) {
    return {};
  }
  return {
    strokeLinejoin: 'round' as const,
    strokeLinecap: 'round' as const,
  };
};

/**
 * <input> styles for SVG foreignObject:1em-tall box with no UA padding so glyphs
 * line up with <text dominantBaseline="middle" fontSize={same}> on the canvas.
 */
/** Upper bound for inline chart editor width (SVG user units); large enough to type long labels. */
export const CHART_INLINE_FOREIGN_OBJECT_MAX_WIDTH = 220;

/** Grows with character count; caps at {@link CHART_INLINE_FOREIGN_OBJECT_MAX_WIDTH} by default. */
export function chartInlineForeignObjectWidth(opts: {
  charCount: number;
  fontSize: number;
  minWidth?: number;
  widthPerChar?: number;
  extraPad?: number;
  maxWidth?: number;
}): number {
  const {
    charCount,
    fontSize,
    minWidth = 8,
    widthPerChar = 0.58,
    extraPad = 6,
    maxWidth = CHART_INLINE_FOREIGN_OBJECT_MAX_WIDTH,
  } = opts;
  return Math.min(
    maxWidth,
    Math.max(minWidth, charCount * fontSize * widthPerChar + extraPad)
  );
}

export function svgForeignObjectInlineInputStyle(opts: {
  fontSize: number;
  fontWeight: number | string;
  color: string;
  caretColor: string;
  textAlign: "left" | "center" | "right" | "justify";
  textShadow?: string;
}): CSSProperties {
  const fs = opts.fontSize;
  return {
    display: "block",
    boxSizing: "border-box",
    width: "100%",
    height: fs,
    minHeight: fs,
    maxHeight: fs,
    margin: 0,
    padding: 0,
    border: "none",
    borderRadius: 0,
    fontFamily: "ui-sans-serif, system-ui, sans-serif",
    fontWeight: opts.fontWeight,
    fontSize: fs,
    lineHeight: `${fs}px`,
    textAlign: opts.textAlign,
    color: opts.color,
    caretColor: opts.caretColor,
    ...(opts.textShadow ? { textShadow: opts.textShadow } : {}),
    WebkitAppearance: "none",
    appearance: "none",
    outline: "none",
  };
}
