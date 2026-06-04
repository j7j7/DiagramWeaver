"use client";

import { useEffect } from "react";
import {
  DW_REPLAY_BATCH_SELECT,
  DW_REPLAY_CLIPBOARD_COPY,
  DW_REPLAY_CLIPBOARD_PASTE,
  DW_REPLAY_SEARCH_MODAL_OPEN,
  DW_REPLAY_SEARCH_MODAL_QUERY,
  DW_REPLAY_RESOURCE_ACTIVATE,
  DW_REPLAY_SEARCH_MODAL_CLOSE,
  DW_REPLAY_SELECT_NODE,
  type DwBatchSelectDetail,
  type DwResourceActivateDetail,
  type DwSearchModalOpenDetail,
} from "@/lib/interaction-recording-bridge";

export interface InteractionRecordingCanvasReplayHandlers {
  openSearchModal: (detail: DwSearchModalOpenDetail) => void;
  closeSearchModal: () => void;
  activateResource: (detail: DwResourceActivateDetail) => void;
  selectNode: (nodeId: string, itemType: "node" | "zone") => void;
  batchSelect: (itemIds: string[]) => void;
  copy: () => void;
  paste: () => void;
}

export function useInteractionRecordingCanvasReplay(
  handlers: InteractionRecordingCanvasReplayHandlers,
): void {
  useEffect(() => {
    const onSearchOpen = (event: Event) => {
      const detail = (event as CustomEvent<DwSearchModalOpenDetail>).detail;
      if (!detail) return;
      handlers.openSearchModal(detail);
    };

    const onBatchSelect = (event: Event) => {
      const detail = (event as CustomEvent<DwBatchSelectDetail>).detail;
      if (!detail?.itemIds?.length) return;
      handlers.batchSelect(detail.itemIds);
    };

    const onCopy = () => {
      handlers.copy();
    };

    const onPaste = () => {
      handlers.paste();
    };

    const onResourceActivate = (event: Event) => {
      const detail = (event as CustomEvent<DwResourceActivateDetail>).detail;
      if (!detail?.item) return;
      handlers.activateResource(detail);
    };

    const onCloseSearch = () => {
      handlers.closeSearchModal();
    };

    const onSelectNode = (event: Event) => {
      const detail = (event as CustomEvent<{ nodeId?: string; itemType?: "node" | "zone" }>).detail;
      if (!detail?.nodeId) return;
      handlers.selectNode(detail.nodeId, detail.itemType ?? "node");
    };

    document.addEventListener(DW_REPLAY_SEARCH_MODAL_OPEN, onSearchOpen as EventListener);
    document.addEventListener(DW_REPLAY_SEARCH_MODAL_CLOSE, onCloseSearch);
    document.addEventListener(DW_REPLAY_SELECT_NODE, onSelectNode as EventListener);
    document.addEventListener(DW_REPLAY_RESOURCE_ACTIVATE, onResourceActivate as EventListener);
    document.addEventListener(DW_REPLAY_BATCH_SELECT, onBatchSelect as EventListener);
    document.addEventListener(DW_REPLAY_CLIPBOARD_COPY, onCopy);
    document.addEventListener(DW_REPLAY_CLIPBOARD_PASTE, onPaste);

    return () => {
      document.removeEventListener(DW_REPLAY_SEARCH_MODAL_OPEN, onSearchOpen as EventListener);
      document.removeEventListener(DW_REPLAY_SEARCH_MODAL_CLOSE, onCloseSearch);
      document.removeEventListener(DW_REPLAY_SELECT_NODE, onSelectNode as EventListener);
      document.removeEventListener(DW_REPLAY_RESOURCE_ACTIVATE, onResourceActivate as EventListener);
      document.removeEventListener(DW_REPLAY_BATCH_SELECT, onBatchSelect as EventListener);
      document.removeEventListener(DW_REPLAY_CLIPBOARD_COPY, onCopy);
      document.removeEventListener(DW_REPLAY_CLIPBOARD_PASTE, onPaste);
    };
  }, [handlers]);
}
