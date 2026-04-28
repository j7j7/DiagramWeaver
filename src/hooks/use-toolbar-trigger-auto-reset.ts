"use client";

import { useEffect, type Dispatch, type SetStateAction } from "react";

const RESET_MS = 100;

/**
 * After panels read a one-shot `trigger*Open` flag, clear it after a tick (same as four inline effects).
 */
export function useToolbarTriggerAutoResets(
  triggerTextStylingPanel: boolean,
  setTriggerTextStylingPanel: Dispatch<SetStateAction<boolean>>,
  triggerVisualStylingPanel: boolean,
  setTriggerVisualStylingPanel: Dispatch<SetStateAction<boolean>>,
  triggerLineStylingPanel: boolean,
  setTriggerLineStylingPanel: Dispatch<SetStateAction<boolean>>,
  triggerConnectionSettingsPanel: boolean,
  setTriggerConnectionSettingsPanel: Dispatch<SetStateAction<boolean>>,
): void {
  useEffect(() => {
    if (triggerTextStylingPanel) {
      const timer = setTimeout(() => setTriggerTextStylingPanel(false), RESET_MS);
      return () => clearTimeout(timer);
    }
  }, [triggerTextStylingPanel, setTriggerTextStylingPanel]);

  useEffect(() => {
    if (triggerVisualStylingPanel) {
      const timer = setTimeout(() => setTriggerVisualStylingPanel(false), RESET_MS);
      return () => clearTimeout(timer);
    }
  }, [triggerVisualStylingPanel, setTriggerVisualStylingPanel]);

  useEffect(() => {
    if (triggerLineStylingPanel) {
      const timer = setTimeout(() => setTriggerLineStylingPanel(false), RESET_MS);
      return () => clearTimeout(timer);
    }
  }, [triggerLineStylingPanel, setTriggerLineStylingPanel]);

  useEffect(() => {
    if (triggerConnectionSettingsPanel) {
      const timer = setTimeout(() => setTriggerConnectionSettingsPanel(false), RESET_MS);
      return () => clearTimeout(timer);
    }
  }, [triggerConnectionSettingsPanel, setTriggerConnectionSettingsPanel]);
}
