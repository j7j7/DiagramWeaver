"use client";

import React from "react";
import { Eye, EyeOff, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { LayerInfo } from "@/lib/types";
import { getItemsInLayer } from "@/lib/layers-utils";
import type { DiagramData } from "@/lib/types";

interface ViewerLayersPanelProps {
  layers: LayerInfo[];
  diagramData: DiagramData;
  onToggleVisibility: (layerId: string) => void;
  className?: string;
}

/**
 * Read-only layer visibility panel for viewer mode.
 * Allows toggling layer visibility when diagram has layers defined.
 */
export function ViewerLayersPanel({
  layers,
  diagramData,
  onToggleVisibility,
  className,
}: ViewerLayersPanelProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={cn("h-9 w-9", className)}
          title="Toggle layer visibility"
          aria-label="Toggle layer visibility"
        >
          <Layers className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="end">
        <div className="p-3 border-b">
          <h4 className="font-medium text-sm flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Layers
          </h4>
          <p className="text-xs text-muted-foreground mt-1">
            Toggle layer visibility
          </p>
        </div>
        <div className="max-h-48 overflow-y-auto p-2">
          {layers.map((layer) => {
            const itemCount = getItemsInLayer(diagramData, layer.id).nodes.length +
              getItemsInLayer(diagramData, layer.id).zones.length;
            const canToggle = layer.id !== "background";

            return (
              <div
                key={layer.id}
                className={cn(
                  "flex items-center gap-2 py-2 px-2 rounded-md",
                  "hover:bg-accent/50"
                )}
              >
                <div
                  className="w-3 h-3 rounded-full border border-border flex-shrink-0"
                  style={{ backgroundColor: layer.color || "hsl(var(--muted))" }}
                  aria-hidden
                />
                <span
                  className={cn(
                    "text-sm flex-1 truncate",
                    !layer.visible && "text-muted-foreground"
                  )}
                >
                  {layer.name}
                </span>
                {itemCount > 0 && (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {itemCount}
                  </span>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 flex-shrink-0"
                  onClick={() => canToggle && onToggleVisibility(layer.id)}
                  disabled={!canToggle}
                  title={
                    canToggle
                      ? layer.visible
                        ? "Hide layer"
                        : "Show layer"
                      : "Background layer cannot be hidden"
                  }
                >
                  {layer.visible ? (
                    <Eye className="w-3.5 h-3.5" />
                  ) : (
                    <EyeOff className="w-3.5 h-3.5" />
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
