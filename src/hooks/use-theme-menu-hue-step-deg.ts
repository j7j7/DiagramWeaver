"use client";

import { useEffect, useState } from "react";
import {
  clampThemeMenuHueStepDeg,
  readThemeMenuHueStepDegFromStorage,
  THEME_MENU_HUE_STEP_CHANGED_EVENT,
} from "@/lib/theme-menu-hue-step";

/** Current Themes-menu hue step (°), synced with `localStorage` and same-tab commits. */
export function useThemeMenuHueStepDeg(): number {
  const [deg, setDeg] = useState(readThemeMenuHueStepDegFromStorage);

  useEffect(() => {
    const refreshFromStorage = () => setDeg(readThemeMenuHueStepDegFromStorage());

    const onCommitted = (e: Event) => {
      const d = (e as CustomEvent<{ degrees?: number }>).detail?.degrees;
      if (typeof d === "number" && Number.isFinite(d)) setDeg(clampThemeMenuHueStepDeg(d));
      else refreshFromStorage();
    };

    window.addEventListener(THEME_MENU_HUE_STEP_CHANGED_EVENT, onCommitted);
    window.addEventListener("storage", refreshFromStorage);
    return () => {
      window.removeEventListener(THEME_MENU_HUE_STEP_CHANGED_EVENT, onCommitted);
      window.removeEventListener("storage", refreshFromStorage);
    };
  }, []);

  return deg;
}
