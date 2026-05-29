"use client";

import React from "react";

export const PLAYBACK_BAR_BOTTOM_PX = 16;
export const PLAYBACK_BAR_EDGE_MARGIN_PX = 16;

export const presentationPlaybackBarClassName =
  "pointer-events-auto fixed z-[60] flex max-w-[min(920px,calc(100vw-2rem))] cursor-grab touch-none flex-wrap items-center gap-2 rounded-lg border border-border/20 bg-card/10 px-3 py-2 text-foreground shadow-sm backdrop-blur-[2px] active:cursor-grabbing";

export const presentationPlaybackControlBtnClass = "h-8 opacity-70 hover:opacity-100";

export const presentationPlaybackCounterClass =
  "shrink-0 rounded border border-border/30 bg-muted/30 px-2 py-0.5 text-xs text-muted-foreground opacity-70";

export function clampPlaybackBarLeft(left: number, barWidth: number, viewportWidth: number): number {
  const minLeft = PLAYBACK_BAR_EDGE_MARGIN_PX;
  const maxLeft = Math.max(minLeft, viewportWidth - barWidth - PLAYBACK_BAR_EDGE_MARGIN_PX);
  return Math.min(maxLeft, Math.max(minLeft, left));
}

export function isPresentationPlaybackBarDragTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return !target.closest('button, input, label, [role="button"], a, [role="combobox"]');
}

interface UseDraggablePlaybackBarOptions {
  enabled: boolean;
  /** Re-measure / re-clamp when bar content width may change. */
  layoutRevision?: unknown;
}

export function useDraggablePlaybackBar({ enabled, layoutRevision }: UseDraggablePlaybackBarOptions) {
  const barRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef<{
    pointerId: number;
    startX: number;
    startLeft: number;
  } | null>(null);
  const [barLeft, setBarLeft] = React.useState<number | null>(null);

  const syncBarLeft = React.useCallback((nextLeft?: number) => {
    const bar = barRef.current;
    if (!bar || typeof window === "undefined") return;
    const barWidth = bar.offsetWidth;
    if (barWidth <= 0) return;
    setBarLeft((prev) => {
      const baseLeft = nextLeft ?? prev ?? (window.innerWidth - barWidth) / 2;
      return clampPlaybackBarLeft(baseLeft, barWidth, window.innerWidth);
    });
  }, []);

  React.useLayoutEffect(() => {
    if (!enabled) return;
    syncBarLeft();
  }, [enabled, layoutRevision, syncBarLeft]);

  React.useEffect(() => {
    if (!enabled) return;
    const onResize = () => syncBarLeft();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [enabled, syncBarLeft]);

  React.useEffect(() => {
    if (enabled) return;
    setBarLeft(null);
    dragRef.current = null;
  }, [enabled]);

  const handlePointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 || !isPresentationPlaybackBarDragTarget(event.target)) return;
      const bar = barRef.current;
      if (!bar) return;
      const rect = bar.getBoundingClientRect();
      const startLeft = barLeft ?? rect.left;
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startLeft,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
    },
    [barLeft]
  );

  const handlePointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      syncBarLeft(drag.startLeft + (event.clientX - drag.startX));
    },
    [syncBarLeft]
  );

  const handlePointerUp = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const barStyle = React.useMemo((): React.CSSProperties => {
    if (barLeft === null) {
      return {
        bottom: PLAYBACK_BAR_BOTTOM_PX,
        left: "50%",
        transform: "translateX(-50%)",
      };
    }
    return {
      bottom: PLAYBACK_BAR_BOTTOM_PX,
      left: barLeft,
    };
  }, [barLeft]);

  return {
    barRef,
    barStyle,
    pointerHandlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerUp,
    },
  };
}
