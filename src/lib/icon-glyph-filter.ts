import { isDiagramIconTileNodeType, isIconOrEmojiType } from "@/lib/utils";

type Rgb = { r: number; g: number; b: number };

function parseHexColor(input: string): Rgb | null {
  const hex = input.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    return {
      r: Number.parseInt(hex.slice(0, 2), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      b: Number.parseInt(hex.slice(4, 6), 16),
    };
  }
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    return {
      r: Number.parseInt(hex[0] + hex[0], 16),
      g: Number.parseInt(hex[1] + hex[1], 16),
      b: Number.parseInt(hex[2] + hex[2], 16),
    };
  }
  return null;
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
        break;
      case gn:
        h = ((bn - rn) / d + 2) / 6;
        break;
      default:
        h = ((rn - gn) / d + 4) / 6;
        break;
    }
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

/** Default picker colour when custom icon colour is first enabled. */
export const DEFAULT_ICON_COLOR = "#374151";

export function isIconColorActive(opts: {
  iconColor?: string;
  iconColorEnabled?: boolean;
}): boolean {
  if (opts.iconColorEnabled === false) return false;
  if (opts.iconColorEnabled === true) return true;
  return Boolean(opts.iconColor?.trim());
}

export function resolveActiveIconColor(opts: {
  iconColor?: string;
  iconColorEnabled?: boolean;
}): string | undefined {
  if (!isIconColorActive(opts)) return undefined;
  return opts.iconColor?.trim() || DEFAULT_ICON_COLOR;
}

export function isDiagramLucideIconTile(
  type: string | undefined,
  iconType?: string,
): boolean {
  if (iconType === "lucide") return true;
  if (!type?.startsWith("generic.icon.") || type === "generic.icon.custom") return false;
  return true;
}

/** Provider/custom raster icons — tint via CSS filter (not Lucide SVG colour or emoji). */
export function isDiagramRasterIconTile(
  type: string | undefined,
  iconType?: string,
): boolean {
  if (!type) return false;
  if (type === "generic.icon.custom") return true;
  if (iconType === "lucide" || iconType === "emoji") return false;
  if (isIconOrEmojiType(type)) return false;
  return isDiagramIconTileNodeType(type, iconType);
}

/** Greyscale first, then sepia/hue tint — for catalog PNG/SVG icons. */
export function buildRasterIconTintFilter(hex: string): string {
  const rgb = parseHexColor(hex);
  if (!rgb) return "grayscale(100%)";
  const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const hueRotate = Math.round(h - 30);
  const saturate = Math.max(100, Math.round(s * 4));
  const brightness = Math.min(200, Math.max(50, Math.round((l / 50) * 100)));
  return `grayscale(100%) sepia(100%) hue-rotate(${hueRotate}deg) saturate(${saturate}%) brightness(${brightness}%)`;
}

export function mergeCssFilters(...parts: Array<string | undefined>): string | undefined {
  const merged = parts.filter(Boolean).join(" ").trim();
  return merged || undefined;
}

export function resolveIconGlyphCssFilter(opts: {
  iconColor?: string;
  iconColorEnabled?: boolean;
  iconGreyscale?: boolean;
  useRasterTint?: boolean;
}): string | undefined {
  const activeColor = resolveActiveIconColor(opts);
  if (opts.useRasterTint && activeColor) {
    return buildRasterIconTintFilter(activeColor);
  }
  if (opts.iconGreyscale) {
    return "grayscale(100%)";
  }
  return undefined;
}
