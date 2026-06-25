"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

const EDGE_ZONE_WIDTH_PX = 12;
const PEEK_CLOSE_DELAY_MS = 250;

export interface UseLeftSidebarAutoCollapseParams {
  enabled: boolean;
  leftPanelCollapsed: boolean;
  setLeftPanelCollapsed: Dispatch<SetStateAction<boolean>>;
}

export interface UseLeftSidebarAutoCollapseResult {
  effectiveLeftPanelCollapsed: boolean;
  handleToggleLeftPanelCollapse: () => void;
  leftSidebarEdgeZoneProps: {
    onMouseEnter: () => void;
  } | null;
  leftSidebarContainerProps: {
    onMouseEnter: () => void;
    onMouseLeave: () => void;
  } | null;
}

/**
 * When auto-collapse is enabled (desktop), keeps the component sidebar collapsed and
 * temporarily expands it while the pointer is in the left edge zone or over the sidebar.
 */
export function useLeftSidebarAutoCollapse({
  enabled,
  leftPanelCollapsed,
  setLeftPanelCollapsed,
}: UseLeftSidebarAutoCollapseParams): UseLeftSidebarAutoCollapseResult {
  const [peekOpen, setPeekOpen] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevEnabledRef = useRef(false);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const openPeek = useCallback(() => {
    clearCloseTimer();
    setPeekOpen(true);
  }, [clearCloseTimer]);

  const scheduleClosePeek = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      setPeekOpen(false);
    }, PEEK_CLOSE_DELAY_MS);
  }, [clearCloseTimer]);

  useEffect(() => {
    if (enabled && !prevEnabledRef.current) {
      setLeftPanelCollapsed(true);
      setPeekOpen(false);
    }
    if (!enabled) {
      setPeekOpen(false);
    }
    prevEnabledRef.current = enabled;
  }, [enabled, setLeftPanelCollapsed]);

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer]);

  const effectiveLeftPanelCollapsed = enabled ? !peekOpen : leftPanelCollapsed;

  const handleToggleLeftPanelCollapse = useCallback(() => {
    if (enabled) {
      setPeekOpen((open) => {
        const next = !open;
        if (next) clearCloseTimer();
        return next;
      });
      return;
    }
    setLeftPanelCollapsed((collapsed) => !collapsed);
  }, [enabled, clearCloseTimer, setLeftPanelCollapsed]);

  return {
    effectiveLeftPanelCollapsed,
    handleToggleLeftPanelCollapse,
    leftSidebarEdgeZoneProps: enabled
      ? {
          onMouseEnter: openPeek,
        }
      : null,
    leftSidebarContainerProps: enabled
      ? {
          onMouseEnter: openPeek,
          onMouseLeave: scheduleClosePeek,
        }
      : null,
  };
}

export { EDGE_ZONE_WIDTH_PX };
