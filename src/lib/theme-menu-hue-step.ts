/**
 * Default hue step (degrees) for theme stagger, charts, and card theming.
 * Lives here (not in `theme-manager`) so card/theme helpers can import it without a cycle.
 */
export const DIAGRAM_THEME_HUE_STEP_DEG = 36;

/** Persisted by Themes dropdown (`ThemeMenuSelector`). */
export const THEME_MENU_HUE_STEP_STORAGE_KEY = "diagram-weaver-theme-multi-hue-step-deg";

/** Fired on the window after the Themes menu commits a new hue step (`detail.degrees`). */
export const THEME_MENU_HUE_STEP_CHANGED_EVENT = "diagram-weaver-theme-hue-step-changed";

export function clampThemeMenuHueStepDeg(value: number): number {
  if (!Number.isFinite(value)) return DIAGRAM_THEME_HUE_STEP_DEG;
  return Math.min(360, Math.max(1, Math.round(value)));
}

/** SSR-safe: default hue step when `localStorage` is unavailable or unset. */
export function readThemeMenuHueStepDegFromStorage(): number {
  if (typeof window === "undefined") return DIAGRAM_THEME_HUE_STEP_DEG;
  try {
    const raw = window.localStorage.getItem(THEME_MENU_HUE_STEP_STORAGE_KEY);
    if (raw == null) return DIAGRAM_THEME_HUE_STEP_DEG;
    return clampThemeMenuHueStepDeg(Number(raw));
  } catch {
    return DIAGRAM_THEME_HUE_STEP_DEG;
  }
}

export function dispatchThemeMenuHueStepChanged(degrees: number): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(THEME_MENU_HUE_STEP_CHANGED_EVENT, { detail: { degrees: clampThemeMenuHueStepDeg(degrees) } }),
  );
}
