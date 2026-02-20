"use client";

import React from "react";
import { ZoomIn, ZoomOut, Maximize2, PanelRight, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface ViewerControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToView: () => void;
  onTogglePropertiesPanel?: () => void;
  propertiesPanelVisible?: boolean;
  onToggleMetadataPopups?: () => void;
  metadataPopupsEnabled?: boolean;
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
  additionalControls,
  className,
}: ViewerControlsProps) {
  return (
    <div
      className={cn(
        "absolute top-4 right-4 z-50 flex flex-col gap-2 bg-card border border-border rounded-lg shadow-lg p-2",
        className
      )}
    >
      <button
        onClick={onZoomIn}
        className="p-2 hover:bg-accent rounded-md transition-colors"
        title="Zoom In"
        aria-label="Zoom In"
      >
        <ZoomIn className="w-4 h-4" />
      </button>
      <button
        onClick={onZoomOut}
        className="p-2 hover:bg-accent rounded-md transition-colors"
        title="Zoom Out"
        aria-label="Zoom Out"
      >
        <ZoomOut className="w-4 h-4" />
      </button>
      {onTogglePropertiesPanel && (
        <>
          <div className="h-px bg-border my-1" />
          <button
            onClick={onTogglePropertiesPanel}
            className="p-2 hover:bg-accent rounded-md transition-colors"
            title={propertiesPanelVisible ? "Hide Properties" : "Show Properties"}
            aria-label={propertiesPanelVisible ? "Hide Properties" : "Show Properties"}
          >
            <PanelRight className="w-4 h-4" />
          </button>
        </>
      )}
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
      {additionalControls && (
        <>
          <div className="h-px bg-border my-1" />
          {additionalControls}
          <div className="h-px bg-border my-1" />
        </>
      )}
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
