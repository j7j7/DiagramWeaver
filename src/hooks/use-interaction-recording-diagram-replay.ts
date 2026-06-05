"use client";

import React, { useEffect } from "react";
import {
  DW_REPLAY_CLOSE_OVERLAYS,
  DW_REPLAY_DIAGRAM_CHANGE,
  type DwDiagramChangeDetail,
} from "@/lib/interaction-recording-bridge";

export interface InteractionRecordingDiagramReplayHandlers {
  applyChange: (detail: DwDiagramChangeDetail) => void;
  closeOverlays?: () => void;
}

export function useInteractionRecordingDiagramReplay(
  handlers: InteractionRecordingDiagramReplayHandlers,
): void {
  const handlersRef = React.useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<DwDiagramChangeDetail>).detail;
      if (!detail?.op) return;
      handlersRef.current.applyChange(detail);
      handlersRef.current.closeOverlays?.();
    };

    const onCloseOverlays = () => {
      handlersRef.current.closeOverlays?.();
    };

    document.addEventListener(DW_REPLAY_DIAGRAM_CHANGE, onChange as EventListener);
    document.addEventListener(DW_REPLAY_CLOSE_OVERLAYS, onCloseOverlays);
    return () => {
      document.removeEventListener(DW_REPLAY_DIAGRAM_CHANGE, onChange as EventListener);
      document.removeEventListener(DW_REPLAY_CLOSE_OVERLAYS, onCloseOverlays);
    };
  }, []);
}
