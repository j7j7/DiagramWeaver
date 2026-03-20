"use client";

import React from "react";
import { ZoomIn, ZoomOut, Maximize2, PanelRight, Info } from "lucide-react";
import { ThemeToggleButton } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

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
  return (
    <div
      className={cn(
        "absolute top-4 left-4 z-50 flex flex-col gap-2 rounded-lg border border-border/60 bg-card/80 p-2 shadow-lg backdrop-blur-md",
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
          <div className="h-px bg-border my-1" />
          <button
            onClick={onToggleMetadataPopups}
            className={cn(
              "p-2 hover:bg-accent rounded-md transition-colors",
              !metadataPopupsEnabled && "opacity-50"
            )}
            title={metadataPopupsEnabled ? "Disable Properties popups" : "Enable Properties popups"}
            aria-label={metadataPopupsEnabled ? "Disable Properties popups" : "Enable Properties popups"}
          >
            <Info className="w-4 h-4" />
          </button>
        </>
      )}
      {onToggleAnimationConnections && (
        <>
          <div className="h-px bg-border my-1" />
          <button
            onClick={onToggleAnimationConnections}
            className={cn(
              "p-2 hover:bg-accent rounded-md transition-colors",
              !animationConnectionsEnabled && "opacity-50"
            )}
            title={animationConnectionsEnabled ? "Disable all animations (Wave)" : "Enable all animations (Wave)"}
            aria-label={animationConnectionsEnabled ? "Disable all animations (Wave)" : "Enable all animations (Wave)"}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </button>
        </>
      )}
      {onToggleAnimationsForSelected && (
        <>
          <div className="h-px bg-border my-1" />
          <button
            onClick={onToggleAnimationsForSelected}
            disabled={!animationConnectionsEnabled}
            className={cn(
              "p-2 hover:bg-accent rounded-md transition-colors",
              showAnimationsForSelectedOnly && "bg-accent",
              !animationConnectionsEnabled && "opacity-50 cursor-not-allowed"
            )}
            title={showAnimationsForSelectedOnly ? "Show all animations" : "Show animations from selected element only (Clock)"}
            aria-label={showAnimationsForSelectedOnly ? "Show all animations" : "Show animations from selected element only (Clock)"}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </button>
        </>
      )}
      {onToggleAnimationClickMode && (
        <>
          <div className="h-px bg-border my-1" />
          <button
            onClick={onToggleAnimationClickMode}
            disabled={!animationConnectionsEnabled}
            className={cn(
              "p-2 hover:bg-accent rounded-md transition-colors",
              animationToggleOnClickEnabled && "bg-accent",
              !animationConnectionsEnabled && "opacity-50 cursor-not-allowed"
            )}
            title={animationToggleOnClickEnabled ? "Disable click-to-toggle animations (Mic)" : "Enable click-to-toggle: click elements to toggle their animations on/off (Mic)"}
            aria-label={animationToggleOnClickEnabled ? "Disable click-to-toggle animations (Mic)" : "Enable click-to-toggle: click elements to toggle their animations on/off (Mic)"}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="22"/>
            </svg>
          </button>
        </>
      )}
      {additionalControls && (
        <>
          <div className="h-px bg-border my-1" />
          {additionalControls}
          <div className="h-px bg-border my-1" />
        </>
      )}
      <div className="h-px bg-border my-1" />
      <ThemeToggleButton className="w-full justify-center" />
      <button
        onClick={onFitToView}
        className="p-2 hover:bg-accent rounded-md transition-colors"
        title="Fit to View"
        aria-label="Fit to View"
      >
        <Maximize2 className="w-4 h-4" />
      </button>
    </div>
  );
}
