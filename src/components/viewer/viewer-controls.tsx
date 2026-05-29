"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ZoomIn, ZoomOut, Maximize2, PanelRight, Info } from "lucide-react";
import { ThemeToggleButton } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

/** Pixels from the left viewport edge that count as “near” to reveal the toolbar. */
const LEFT_EDGE_REVEAL_PX = 28;
/** First paint: toolbar visible, then auto-hide after this. Same delay after pointer leaves chrome once revealed again. */
const TOOLBAR_AUTO_HIDE_DELAY_MS = 1000;

const VIEWER_PROPERTIES_SELECTOR = "[data-dw-viewer-properties]";

interface ViewerControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToView: () => void;
  onTogglePropertiesPanel?: () => void;
  propertiesPanelVisible?: boolean;
  onToggleMetadataPopups?: () => void;
  metadataPopupsEnabled?: boolean;
  onToggleAnimationConnections?: () => void;
  animationConnectionsEnabled?: boolean;
  onToggleAnimationsForSelected?: () => void;
  showAnimationsForSelectedOnly?: boolean;
  onToggleAnimationClickMode?: () => void;
  animationToggleOnClickEnabled?: boolean;
  additionalControls?: React.ReactNode;
  className?: string;
}

export function ViewerControls({
  onZoomIn,
  onZoomOut,
  onFitToView,
  onTogglePropertiesPanel,
  propertiesPanelVisible,
  onToggleMetadataPopups,
  metadataPopupsEnabled = true,
  onToggleAnimationConnections,
  animationConnectionsEnabled = true,
  onToggleAnimationsForSelected,
  showAnimationsForSelectedOnly = false,
  onToggleAnimationClickMode,
  animationToggleOnClickEnabled = false,
  additionalControls,
  className,
}: ViewerControlsProps) {
  const [toolbarRevealed, setToolbarRevealed] = useState(true);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current !== null) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const clearInitialHideTimer = useCallback(() => {
    if (initialHideTimerRef.current !== null) {
      clearTimeout(initialHideTimerRef.current);
      initialHideTimerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      setToolbarRevealed(false);
      hideTimerRef.current = null;
    }, TOOLBAR_AUTO_HIDE_DELAY_MS);
  }, [clearHideTimer]);

  useEffect(() => {
    initialHideTimerRef.current = setTimeout(() => {
      setToolbarRevealed(false);
      initialHideTimerRef.current = null;
    }, TOOLBAR_AUTO_HIDE_DELAY_MS);
    return () => {
      if (initialHideTimerRef.current !== null) {
        clearTimeout(initialHideTimerRef.current);
        initialHideTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      const nearLeft = e.clientX <= LEFT_EDGE_REVEAL_PX;
      const overToolbar = Boolean(target && toolbarRef.current?.contains(target));
      const overProperties = Boolean(target?.closest(VIEWER_PROPERTIES_SELECTOR));

      if (nearLeft || overToolbar || overProperties) {
        clearInitialHideTimer();
        clearHideTimer();
        setToolbarRevealed(true);
      } else {
        scheduleHide();
      }
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      clearHideTimer();
    };
  }, [clearHideTimer, clearInitialHideTimer, scheduleHide]);

  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      if (toolbarRef.current?.contains(e.target as Node)) {
        clearInitialHideTimer();
        clearHideTimer();
        setToolbarRevealed(true);
      }
    };
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, [clearHideTimer, clearInitialHideTimer]);

  return (
    <>
      {/* Coarse pointers: thin strip (hidden when mouse is primary input) */}
      <div
        aria-hidden
        className={cn(
          "fixed top-0 bottom-0 left-0 z-[89] w-[14px] touch-none select-none [@media(pointer:fine)]:hidden",
          toolbarRevealed && "pointer-events-none"
        )}
        onPointerDown={() => {
          clearInitialHideTimer();
          clearHideTimer();
          setToolbarRevealed(true);
        }}
      />
      <div
        ref={toolbarRef}
        inert={!toolbarRevealed}
        role="toolbar"
        aria-label="Viewer controls"
        className={cn(
          "absolute top-4 left-4 z-[90] flex flex-col gap-2 rounded-lg border border-border/60 bg-card/80 p-2 shadow-lg backdrop-blur-md transition-transform duration-300 ease-out will-change-transform",
          toolbarRevealed ? "translate-x-0" : "pointer-events-none -translate-x-[calc(100%+1rem)]",
          className
        )}
      >
        {onTogglePropertiesPanel && (
          <button
            type="button"
            onClick={onTogglePropertiesPanel}
            className={cn(
              "rounded-md p-2 transition-colors hover:bg-accent",
              propertiesPanelVisible && "bg-accent"
            )}
            title={propertiesPanelVisible ? "Hide properties panel" : "Show properties panel"}
            aria-label={propertiesPanelVisible ? "Hide properties panel" : "Show properties panel"}
            aria-pressed={propertiesPanelVisible}
          >
            <PanelRight className="h-4 w-4" />
          </button>
        )}
        {onTogglePropertiesPanel && <div className="my-1 h-px bg-border/80" />}
        <button
          type="button"
          onClick={onZoomIn}
          className="rounded-md p-2 transition-colors hover:bg-accent"
          title="Zoom In"
          aria-label="Zoom In"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onZoomOut}
          className="rounded-md p-2 transition-colors hover:bg-accent"
          title="Zoom Out"
          aria-label="Zoom Out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        {onToggleMetadataPopups && (
          <>
            <div className="my-1 h-px bg-border" />
            <button
              type="button"
              onClick={onToggleMetadataPopups}
              className={cn(
                "rounded-md p-2 transition-colors hover:bg-accent",
                !metadataPopupsEnabled && "opacity-50"
              )}
              title={metadataPopupsEnabled ? "Disable Properties popups" : "Enable Properties popups"}
              aria-label={metadataPopupsEnabled ? "Disable Properties popups" : "Enable Properties popups"}
            >
              <Info className="h-4 w-4" />
            </button>
          </>
        )}
        {onToggleAnimationConnections && (
          <>
            <div className="my-1 h-px bg-border" />
            <button
              type="button"
              onClick={onToggleAnimationConnections}
              className={cn(
                "rounded-md p-2 transition-colors hover:bg-accent",
                !animationConnectionsEnabled && "opacity-50"
              )}
              title={animationConnectionsEnabled ? "Disable all animations" : "Enable all animations"}
              aria-label={animationConnectionsEnabled ? "Disable all animations" : "Enable all animations"}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </button>
          </>
        )}
        {onToggleAnimationsForSelected && (
          <>
            <div className="my-1 h-px bg-border" />
            <button
              type="button"
              onClick={onToggleAnimationsForSelected}
              disabled={!animationConnectionsEnabled}
              className={cn(
                "rounded-md p-2 transition-colors hover:bg-accent",
                showAnimationsForSelectedOnly && "bg-accent",
                !animationConnectionsEnabled && "cursor-not-allowed opacity-50"
              )}
              title={showAnimationsForSelectedOnly ? "Show all animations" : "Show animations from selected element only"}
              aria-label={showAnimationsForSelectedOnly ? "Show all animations" : "Show animations from selected element only"}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </button>
          </>
        )}
        {onToggleAnimationClickMode && (
          <>
            <div className="my-1 h-px bg-border" />
            <button
              type="button"
              onClick={onToggleAnimationClickMode}
              disabled={!animationConnectionsEnabled}
              className={cn(
                "rounded-md p-2 transition-colors hover:bg-accent",
                animationToggleOnClickEnabled && "bg-accent",
                !animationConnectionsEnabled && "cursor-not-allowed opacity-50"
              )}
              title={animationToggleOnClickEnabled ? "Disable click-to-toggle animations" : "Enable click-to-toggle: click elements to toggle their animations on/off"}
              aria-label={animationToggleOnClickEnabled ? "Disable click-to-toggle animations" : "Enable click-to-toggle: click elements to toggle their animations on/off"}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="22" />
              </svg>
            </button>
          </>
        )}
        {additionalControls && (
          <>
            <div className="my-1 h-px bg-border" />
            {additionalControls}
            <div className="my-1 h-px bg-border" />
          </>
        )}
        <div className="my-1 h-px bg-border" />
        <ThemeToggleButton className="w-full justify-center" />
        <button
          type="button"
          onClick={onFitToView}
          className="rounded-md p-2 transition-colors hover:bg-accent"
          title="Fit to View"
          aria-label="Fit to View"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>
    </>
  );
}
