/**
 * Shift a color's hue on the HSL wheel (saturation/lightness preserved).
 * Supports #RGB, #RRGGBB, #RRGGBBAA, rgb(), rgba().
 * Unrecognized strings are returned unchanged.
 */

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      default:
        h = ((r - g) / d + 4) / 6;
    }
  }
  return { h: h * 360, s, l };
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hh = (((h % 360) + 360) % 360) / 360;
  let r: number;
  let g: number;
  let b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      let tt = t;
      if (tt < 0) tt += 1;
      if (tt > 1) tt -= 1;
      if (tt < 1 / 6) return p + (q - p) * 6 * tt;
      if (tt < 1 / 2) return q;
      if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, hh + 1 / 3);
    g = hue2rgb(p, q, hh);
    b = hue2rgb(p, q, hh - 1 / 3);
  }
  return [clampByte(r * 255), clampByte(g * 255), clampByte(b * 255)];
}

function hexToRgb(hex: string): { r: number; g: number; b: number; a?: number } | null {
  let h = hex.trim();
  if (h.startsWith("#")) h = h.slice(1);
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (h.length === 6) {
    const n = parseInt(h, 16);
    if (Number.isNaN(n)) return null;
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  if (h.length === 8) {
    const n = parseInt(h, 16);
    if (Number.isNaN(n)) return null;
    return {
      r: (n >> 24) & 255,
      g: (n >> 16) & 255,
      b: (n >> 8) & 255,
      a: (n & 255) / 255,
    };
  }
  return null;
}

function rgbFnToRgb(input: string): { r: number; g: number; b: number; a?: number } | null {
  const m = input.match(/rgba?\(\s*([^)]+)\s*\)/i);
  if (!m) return null;
  const parts = m[1].split(",").map((p) => p.trim());
  if (parts.length < 3) return null;
  const r = Number(parts[0]);
  const g = Number(parts[1]);
  const b = Number(parts[2]);
  if (![r, g, b].every((x) => Number.isFinite(x))) return null;
  const a = parts.length >= 4 ? Number(parts[3]) : undefined;
  return { r: clampByte(r), g: clampByte(g), b: clampByte(b), a: a !== undefined && Number.isFinite(a) ? a : undefined };
}

function toHex6(r: number, g: number, b: number): string {
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(clampByte(r))}${h(clampByte(g))}${h(clampByte(b))}`;
}

function toHex8(r: number, g: number, b: number, a: number): string {
  const h = (n: number) => n.toString(16).padStart(2, "0");
  const ai = clampByte(Math.round(a * 255));
  return `#${h(clampByte(r))}${h(clampByte(g))}${h(clampByte(b))}${h(ai)}`;
}

/** Degrees to add to hue (wraps). */
export function shiftHueOfColor(input: string, deltaDegrees: number): string {
  if (!Number.isFinite(deltaDegrees) || deltaDegrees === 0) return input;
  const trimmed = input.trim();
  let r = 0;
  let g = 0;
  let b = 0;
  let a: number | undefined;

  if (trimmed.startsWith("#")) {
    const hx = hexToRgb(trimmed);
    if (!hx) return input;
    r = hx.r;
    g = hx.g;
    b = hx.b;
    a = hx.a;
  } else if (trimmed.toLowerCase().startsWith("rgb")) {
    const rgb = rgbFnToRgb(trimmed);
    if (!rgb) return input;
    r = rgb.r;
    g = rgb.g;
    b = rgb.b;
    a = rgb.a;
  } else {
    return input;
  }

  const { h, s, l } = rgbToHsl(r, g, b);
  const [nr, ng, nb] = hslToRgb(h + deltaDegrees, s, l);
  if (a !== undefined && a < 1) {
    return toHex8(nr, ng, nb, a);
  }
  return toHex6(nr, ng, nb);
}

/**
 * Multiply HSL lightness by `factor`, clamped to [0, 1]. Hue and saturation unchanged.
 * Supports #RGB, #RRGGBB, #RRGGBBAA, rgb(), rgba().
 */
export function multiplyLightnessOfColor(input: string, factor: number): string {
  if (!Number.isFinite(factor)) return input;
  const trimmed = input.trim();
  let r = 0;
  let g = 0;
  let b = 0;
  let a: number | undefined;

  if (trimmed.startsWith("#")) {
    const hx = hexToRgb(trimmed);
    if (!hx) return input;
    r = hx.r;
    g = hx.g;
    b = hx.b;
    a = hx.a;
  } else if (trimmed.toLowerCase().startsWith("rgb")) {
    const rgb = rgbFnToRgb(trimmed);
    if (!rgb) return input;
    r = rgb.r;
    g = rgb.g;
    b = rgb.b;
    a = rgb.a;
  } else {
    return input;
  }

  const { h, s, l } = rgbToHsl(r, g, b);
  const l2 = Math.max(0, Math.min(1, l * factor));
  const [nr, ng, nb] = hslToRgb(h, s, l2);
  if (a !== undefined && a < 1) {
    return toHex8(nr, ng, nb, a);
  }
  return toHex6(nr, ng, nb);
}
