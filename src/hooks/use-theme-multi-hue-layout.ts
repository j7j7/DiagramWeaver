"use client";

import { useEffect, useState } from "react";

export const THEME_MULTI_HUE_LAYOUT_STORAGE_KEY = "diagram-weaver-theme-multi-hue-layout";

export const THEME_MULTI_HUE_LAYOUT_CHANGED_EVENT = "diagram-weaver-theme-multi-hue-layout-changed";

/** SSR-safe: Themes menu “Step hue for multi-selection” checkbox. */
export function readThemeMultiHueLayoutFromStorage(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(THEME_MULTI_HUE_LAYOUT_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function dispatchThemeMultiHueLayoutChanged(enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(THEME_MULTI_HUE_LAYOUT_CHANGED_EVENT, { detail: { enabled } }),
  );
}

/** Synced with Themes menu multi-select hue stepping checkbox. */
export function useThemeMultiHueLayout(): boolean {
  const [enabled, setEnabled] = useState(readThemeMultiHueLayoutFromStorage);

  useEffect(() => {
    const refresh = () => setEnabled(readThemeMultiHueLayoutFromStorage());
    const onCommitted = (e: Event) => {
      const v = (e as CustomEvent<{ enabled?: boolean }>).detail?.enabled;
      if (typeof v === "boolean") setEnabled(v);
      else refresh();
    };
    window.addEventListener(THEME_MULTI_HUE_LAYOUT_CHANGED_EVENT, onCommitted);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(THEME_MULTI_HUE_LAYOUT_CHANGED_EVENT, onCommitted);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return enabled;
}
