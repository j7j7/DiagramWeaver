"use client";

import { useEffect, type Dispatch, type SetStateAction } from "react";

export interface UseDiagramEditorClientBootstrapParams {
  setIsClient: (v: boolean) => void;
  setJsonPanelWidth: Dispatch<SetStateAction<number>>;
  setIconBackgroundEnabled: Dispatch<SetStateAction<boolean>>;
  setDefaultTextLabelsEnabled: Dispatch<SetStateAction<boolean>>;
}

/** First client paint: hydrate JSON panel width and boolean editor defaults from localStorage (inline keys unchanged). */
export function useDiagramEditorClientBootstrap({
  setIsClient,
  setJsonPanelWidth,
  setIconBackgroundEnabled,
  setDefaultTextLabelsEnabled,
}: UseDiagramEditorClientBootstrapParams): void {
  useEffect(() => {
    setIsClient(true);
    const savedWidth = localStorage.getItem("dw:jsonEditor:width");
    if (savedWidth !== null) {
      const parsed = parseInt(savedWidth, 10);
      if (!Number.isNaN(parsed) && parsed >= 280) {
        setJsonPanelWidth(Math.min(parsed, Math.max(300, window.innerWidth * 0.5)));
      }
    }
    const savedIconBackground = localStorage.getItem("dw:iconBackground:enabled");
    if (savedIconBackground !== null) {
      setIconBackgroundEnabled(savedIconBackground === "true");
    }
    const savedDefaultTextLabels = localStorage.getItem("dw:defaultTextLabels:enabled");
    if (savedDefaultTextLabels !== null) {
      setDefaultTextLabelsEnabled(savedDefaultTextLabels === "true");
    }
  }, [setIsClient, setJsonPanelWidth, setIconBackgroundEnabled, setDefaultTextLabelsEnabled]);
}
