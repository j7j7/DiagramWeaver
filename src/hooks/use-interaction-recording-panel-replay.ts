"use client";

import React, { useEffect } from "react";
import {
  DW_REPLAY_OVERLAY_ACTION,
  type DwOverlayActionDetail,
} from "@/lib/interaction-recording-bridge";
import { applyReplayedOverlayValue } from "@/lib/interaction-recording-panel-value";

export type PanelReplayHandlers = Record<string, (patch: Record<string, unknown>) => void>;

export function useInteractionRecordingPanelReplay(handlers: PanelReplayHandlers): void {
  const handlersRef = React.useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const onReplay = (event: Event) => {
      const detail = (event as CustomEvent<DwOverlayActionDetail>).detail;
      if (!detail?.surface) return;
      const handler = handlersRef.current[detail.surface];
      if (!handler) return;
      applyReplayedOverlayValue(detail, handler);
    };

    document.addEventListener(DW_REPLAY_OVERLAY_ACTION, onReplay as EventListener);
    return () =>
      document.removeEventListener(DW_REPLAY_OVERLAY_ACTION, onReplay as EventListener);
  }, []);
}
