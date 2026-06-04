import { useState, useCallback } from "react";
import { emitDwContextMenuOpen } from "@/lib/interaction-recording-bridge";
import type { DwContextMenuOpenDetail } from "@/lib/interaction-recording-bridge";

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  itemType: 'node' | 'zone';
  itemId: string;
  /** Timeline: card under cursor when opened from entry hit-target */
  timelineEntryId?: string;
  /** Timeline: arc-length ratio along spine when menu opened from spine right-click (for insert position). */
  timelineSpineArcRatio?: number;
  /** Card: icon-slot element id when menu opened from an assigned card icon */
  cardElementId?: string;
}

interface UseCanvasContextMenuOptions {
  isReadOnly?: boolean;
  /** Fired when the node/zone context menu opens (pause heavy canvas work e.g. connection animations). */
  onContextMenuOpen?: () => void;
}

export function useCanvasContextMenu({ isReadOnly = false, onContextMenuOpen }: UseCanvasContextMenuOptions = {}) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    itemType: 'node',
    itemId: '',
    timelineEntryId: undefined,
    timelineSpineArcRatio: undefined,
  });

  const handleContextMenu = (
    event: React.MouseEvent,
    itemId: string,
    itemType: 'node' | 'zone',
    opts?: { timelineEntryId?: string; timelineSpineArcRatio?: number; cardElementId?: string },
  ) => {
    if (isReadOnly) return;
    event.preventDefault();

    // Calculate smart positioning to keep menu on-screen
    // Context menus are typically 150-200px wide and vary in height
    const menuWidth = 200; // Approximate menu width including submenus
    const menuHeight = 400; // Maximum expected menu height
    const padding = 8; // Padding from screen edges

    let x = event.clientX;
    let y = event.clientY;

    // Determine available space in each direction
    const spaceRight = window.innerWidth - x;
    const spaceLeft = x;
    const spaceBottom = window.innerHeight - y;
    const spaceTop = y;

    // Position horizontally: prefer right side, but use left if not enough space for menu + submenus
    if (spaceRight < menuWidth && spaceLeft >= menuWidth) {
      // Position to the left of the cursor
      x = x - menuWidth;
    } else {
      // Keep on the right, but don't go off-screen
      x = Math.min(x, window.innerWidth - menuWidth - padding);
    }

    // Position vertically: prefer below cursor, but use above if not enough space
    if (spaceBottom < menuHeight && spaceTop >= menuHeight) {
      // Position above the cursor
      y = y - menuHeight;
    } else {
      // Keep below, but don't go off-screen
      y = Math.min(y, window.innerHeight - menuHeight - padding);
    }

    // Ensure minimum distance from edges
    x = Math.max(padding, x);
    y = Math.max(padding, y);

    onContextMenuOpen?.();
    const menuState = {
      visible: true,
      x,
      y,
      itemType,
      itemId,
      timelineEntryId: opts?.timelineEntryId,
      timelineSpineArcRatio: opts?.timelineSpineArcRatio,
      cardElementId: opts?.cardElementId,
    };
    setContextMenu(menuState);
    emitDwContextMenuOpen({
      itemId,
      itemType,
      x,
      y,
      timelineEntryId: opts?.timelineEntryId,
      timelineSpineArcRatio: opts?.timelineSpineArcRatio,
      cardElementId: opts?.cardElementId,
    });
  };

  const openContextMenuForReplay = useCallback((detail: DwContextMenuOpenDetail) => {
    onContextMenuOpen?.();
    setContextMenu({
      visible: true,
      x: detail.x,
      y: detail.y,
      itemType: detail.itemType,
      itemId: detail.itemId,
      timelineEntryId: detail.timelineEntryId,
      timelineSpineArcRatio: detail.timelineSpineArcRatio,
      cardElementId: detail.cardElementId,
    });
  }, [onContextMenuOpen]);

  const closeContextMenu = useCallback(() => {
    setContextMenu((prev) => ({
      ...prev,
      visible: false,
      timelineEntryId: undefined,
      timelineSpineArcRatio: undefined,
      cardElementId: undefined,
    }));
  }, []);

  return {
    contextMenu,
    handleContextMenu,
    closeContextMenu,
    openContextMenuForReplay,
  };
}

