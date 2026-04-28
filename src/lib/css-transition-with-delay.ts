/**
 * Split a CSS comma-list at top-level commas (ignores commas inside parentheses, e.g. cubic-bezier).
 */
function splitTopLevelCommaList(value: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ',' && depth === 0) {
      const chunk = value.slice(start, i).trim();
      if (chunk) out.push(chunk);
      start = i + 1;
    }
  }
  const last = value.slice(start).trim();
  if (last) out.push(last);
  return out;
}

/**
 * Append the same delay to each transition in a `transition` shorthand string.
 * Avoids setting `transitionDelay` alongside `transition` on React DOM nodes (shorthand vs longhand warning).
 */
export function transitionShorthandWithDelay(
  transition: string,
  delayMs?: number | null,
): string {
  if (delayMs == null || delayMs === 0) return transition;
  const t = transition.trim();
  if (t === '' || t === 'none') return transition;

  const segments = splitTopLevelCommaList(t);
  return segments.map((seg) => `${seg} ${delayMs}ms`).join(', ');
}
