import type { DiagramTheme, ThemeProperties } from './theme-types';

function pickThemeAccentHex(p: ThemeProperties): string {
  return (
    p.lineColor ??
    p.borderColors?.[0] ??
    p.borderColor ??
    p.backgroundColors?.[0] ??
    p.backgroundColor ??
    '#6b7280'
  );
}

function parseHex(hex: string): [number, number, number] | null {
  let h = hex.trim();
  if (h.startsWith('#')) h = h.slice(1);
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (h.length !== 6) return null;
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return null;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
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

/** Sort key for ordering themes around the hue wheel (neutrals last). */
export function getThemeSpectrumSortKey(theme: DiagramTheme): number {
  const rgb = parseHex(pickThemeAccentHex(theme.properties));
  if (!rgb) return 1_000;
  const { h, s, l } = rgbToHsl(rgb[0], rgb[1], rgb[2]);
  if (s < 0.11) {
    return 400 + l * 80 + s * 5;
  }
  return h + s * 0.02 + l * 0.001;
}
