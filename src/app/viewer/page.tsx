"use client";

import React, { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { ViewerCanvas, type ViewerSelectedItem } from "@/components/viewer/viewer-canvas";
import { ViewerControls } from "@/components/viewer/viewer-controls";
import { ViewerLayersPanel } from "@/components/viewer/viewer-layers-panel";
import { PropertiesPanel } from "@/components/editor/properties-panel";
import { loadViewerData, parseViewerParams } from "@/lib/viewer-utils";
import { filterByVisibleLayers, toggleLayerVisibility, validateLayersConfig } from "@/lib/layers-utils";
import type { DiagramData, LayersConfig } from "@/lib/types";
import type { Transform } from "@/hooks/use-canvas-transform";

function ViewerPageContent() {
  const searchParams = useSearchParams();
  const [diagramData, setDiagramData] = useState<DiagramData | null>(null);
  const [layersConfig, setLayersConfig] = useState<LayersConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, k: 1 });
  const [selectedItem, setSelectedItem] = useState<ViewerSelectedItem | null>(null);
  const [propertiesPanelVisible, setPropertiesPanelVisible] = useState(true);

  // Sync layers config from diagram data when it has valid layers
  useEffect(() => {
    if (diagramData?.layers && validateLayersConfig(diagramData.layers)) {
      setLayersConfig(diagramData.layers);
    } else {
      setLayersConfig(null);
    }
  }, [diagramData?.layers]);

  const handleToggleLayerVisibility = useCallback((layerId: string) => {
    setLayersConfig((prev) => {
      if (!prev) return prev;
      try {
        return toggleLayerVisibility(prev, layerId);
      } catch {
        return prev;
      }
    });
  }, []);

  const filteredDiagramData = useMemo(() => {
    if (!diagramData) return null;
    if (!layersConfig || layersConfig.layers.length <= 1) return diagramData;
    return filterByVisibleLayers({ ...diagramData, layers: layersConfig });
  }, [diagramData, layersConfig]);

  const hasLayers = diagramData?.layers && validateLayersConfig(diagramData.layers) && diagramData.layers.layers.length > 1;

  useEffect(() => {
    async function loadDiagram() {
      try {
        setIsLoading(true);
        setError(null);

        // Parse URL parameters
        const params = parseViewerParams(searchParams);
        
        // Load diagram data
        const data = await loadViewerData(params);
        setDiagramData(data.diagramData);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load diagram";
        setError(message);
        console.error("Viewer error:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadDiagram();
  }, [searchParams]);

  const handleZoomIn = useCallback(() => {
    setTransform(prev => ({
      ...prev,
      k: Math.min(prev.k * 1.2, 2.5),
    }));
  }, []);

  const handleZoomOut = useCallback(() => {
    setTransform(prev => ({
      ...prev,
      k: Math.max(prev.k / 1.2, 0.1),
    }));
  }, []);

  const handleFitToView = useCallback(() => {
    // Trigger fit to view via the canvas component
    if ((window as any).__viewerFitToView) {
      (window as any).__viewerFitToView();
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-background">
        <div className="text-muted-foreground">Loading diagram...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-background">
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold mb-4 text-destructive">Error Loading Diagram</h1>
          <p className="text-muted-foreground">{error}</p>
          <p className="text-sm text-muted-foreground mt-4">
            Make sure the URL contains a valid "json" or "url" parameter.
          </p>
        </div>
      </div>
    );
  }

  if (!diagramData) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-background">
        <div className="text-muted-foreground">No diagram data available</div>
      </div>
    );
  }

  const displayData = filteredDiagramData ?? diagramData;
  const selectedItemId = selectedItem?.itemType === "node" ? selectedItem.id : selectedItem?.itemType === "edge" ? selectedItem.id : undefined;

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex w-full h-screen bg-background overflow-hidden">
        <div className="flex-1 relative min-w-0">
          <ViewerCanvas
            diagramData={displayData}
            transform={transform}
            onTransformChange={setTransform}
            onFitToView={handleFitToView}
            selectedItemId={selectedItemId}
            onItemSelect={setSelectedItem}
          />
          <ViewerControls
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onFitToView={handleFitToView}
            onTogglePropertiesPanel={() => setPropertiesPanelVisible((v) => !v)}
            propertiesPanelVisible={propertiesPanelVisible}
            additionalControls={
            hasLayers && layersConfig && diagramData ? (
              <ViewerLayersPanel
                layers={layersConfig.layers}
                diagramData={diagramData}
                onToggleVisibility={handleToggleLayerVisibility}
              />
            ) : undefined
          }
        />
        </div>
        {propertiesPanelVisible && (
          <PropertiesPanel
            selectedItem={selectedItem as Parameters<typeof PropertiesPanel>[0]["selectedItem"]}
            diagramData={displayData}
            onItemUpdate={() => {}}
            isReadOnly={true}
          />
        )}
      </div>
    </DndProvider>
  );
}

export default function ViewerPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen w-screen bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    }>
      <ViewerPageContent />
    </Suspense>
  );
}
