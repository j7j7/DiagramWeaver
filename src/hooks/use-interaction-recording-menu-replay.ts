"use client";

import { useEffect } from "react";
import {
  DW_REPLAY_CONTEXT_MENU_ACTION,
  DW_REPLAY_CONTEXT_MENU_OPEN,
  type DwContextMenuActionDetail,
  type DwContextMenuOpenDetail,
} from "@/lib/interaction-recording-bridge";
import {
  RECORDING_SURFACE_VISUAL_STYLING,
  waitForRecordingSurface,
} from "@/lib/interaction-recording-surfaces";

export interface InteractionRecordingMenuReplayHandlers {
  openContextMenu: (detail: DwContextMenuOpenDetail) => void;
  closeContextMenu: () => void;
  selectItem: (itemId: string, itemType: "node" | "zone") => void;
  copy: () => void;
  deleteItem: (itemId: string, itemType: "node" | "zone") => void;
  connect: () => void;
  disconnect: () => void;
  openTextStyling: () => void;
  openVisualStyling: () => void;
  openLineStyling: () => void;
  openConnectionSettings: () => void;
}

export function useInteractionRecordingMenuReplay(
  handlers: InteractionRecordingMenuReplayHandlers,
): void {
  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<DwContextMenuOpenDetail>).detail;
      if (!detail?.itemId) return;
      handlers.selectItem(detail.itemId, detail.itemType);
      handlers.openContextMenu(detail);
    };

    const onAction = async (event: Event) => {
      const detail = (event as CustomEvent<DwContextMenuActionDetail>).detail;
      if (!detail?.action) return;

      if (detail.itemId && detail.itemType) {
        handlers.selectItem(detail.itemId, detail.itemType);
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });
      }

      switch (detail.action) {
        case "copy":
          handlers.copy();
          handlers.closeContextMenu();
          break;
        case "visual-styling":
        case "icon-styling":
          handlers.openVisualStyling();
          handlers.closeContextMenu();
          await waitForRecordingSurface(RECORDING_SURFACE_VISUAL_STYLING, 2500);
          break;
        case "text-styling":
          handlers.openTextStyling();
          handlers.closeContextMenu();
          break;
        case "line-styling":
          handlers.openLineStyling();
          handlers.closeContextMenu();
          break;
        case "connection-settings":
        case "connections":
          handlers.openConnectionSettings();
          handlers.closeContextMenu();
          break;
        case "connect":
          handlers.connect();
          handlers.closeContextMenu();
          break;
        case "disconnect":
          handlers.disconnect();
          handlers.closeContextMenu();
          break;
        case "delete":
          if (detail.itemId && detail.itemType) {
            handlers.deleteItem(detail.itemId, detail.itemType);
          }
          handlers.closeContextMenu();
          break;
        default:
          break;
      }
    };

    document.addEventListener(DW_REPLAY_CONTEXT_MENU_OPEN, onOpen as EventListener);
    document.addEventListener(DW_REPLAY_CONTEXT_MENU_ACTION, onAction as EventListener);
    return () => {
      document.removeEventListener(DW_REPLAY_CONTEXT_MENU_OPEN, onOpen as EventListener);
      document.removeEventListener(DW_REPLAY_CONTEXT_MENU_ACTION, onAction as EventListener);
    };
  }, [handlers]);
}
