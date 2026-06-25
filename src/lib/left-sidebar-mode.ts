export type LeftSidebarMode = "disabled" | "enabled" | "auto";

export const LEFT_SIDEBAR_MODE_STORAGE_KEY = "dw:leftSidebar:mode";

const LEGACY_AUTO_COLLAPSE_STORAGE_KEY = "dw:leftSidebar:autoCollapse:enabled";

export function parseLeftSidebarMode(value: string | null): LeftSidebarMode | null {
  if (value === "disabled" || value === "enabled" || value === "auto") {
    return value;
  }
  return null;
}

/** Restore mode from current or legacy localStorage keys. */
export function readLeftSidebarModeFromStorage(
  getItem: (key: string) => string | null,
): LeftSidebarMode | null {
  const saved = parseLeftSidebarMode(getItem(LEFT_SIDEBAR_MODE_STORAGE_KEY));
  if (saved) return saved;

  const legacyAuto = getItem(LEGACY_AUTO_COLLAPSE_STORAGE_KEY);
  if (legacyAuto === "true") return "auto";
  if (legacyAuto === "false") return "enabled";
  return null;
}
