/** Max length for a single font-family name or stack fragment in diagram data / rich text. */
export const MAX_CSS_FONT_FAMILY_LENGTH = 200;

/**
 * Sanitize a value for use in CSS `font-family` (inline styles or `runsToHtml` style attributes).
 * Strips characters that can break out of quoted font-family values or inject other declarations.
 */
export function sanitizeCssFontFamily(value: string | undefined | null): string | undefined {
  if (value == null) return undefined;
  let trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > MAX_CSS_FONT_FAMILY_LENGTH) {
    trimmed = trimmed.slice(0, MAX_CSS_FONT_FAMILY_LENGTH);
  }
  if (/[<>"'`;{}\\()]/.test(trimmed)) return undefined;
  if (/url\s*\(|expression\s*\(/i.test(trimmed)) return undefined;
  return trimmed;
}

/** Safe numeric font-weight for inline CSS (blocks `400; evil` injection). */
export function sanitizeCssFontWeight(value: string | number | undefined | null): number | undefined {
  if (value == null) return undefined;
  if (typeof value === "number" && Number.isFinite(value)) {
    const n = Math.round(value);
    if (n >= 1 && n <= 1000) return n;
    return undefined;
  }
  const s = String(value).trim().toLowerCase();
  if (s === "normal") return 400;
  if (s === "bold") return 700;
  if (s === "bolder") return 700;
  if (s === "lighter") return 300;
  const n = parseInt(s, 10);
  if (Number.isFinite(n) && n >= 1 && n <= 1000) return n;
  return undefined;
}
