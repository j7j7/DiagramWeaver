"use client";

import React, { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { ViewerCanvas, type ViewerSelectedItem } from "@/components/viewer/viewer-canvas";
import { ViewerControls } from "@/components/viewer/viewer-controls";
import { ViewerLayersPanel } from "@/components/viewer/viewer-layers-panel";
import { PropertiesPanel } from "@/components/editor/properties-panel";
import { DiagramBreadcrumb, type BreadcrumbSegment } from "@/components/editor/diagram-breadcrumb";
import { loadViewerData, parseViewerParams } from "@/lib/viewer-utils";
import { filterByVisibleLayers, toggleLayerVisibility, validateLayersConfig } from "@/lib/layers-utils";
import { getDiagramAtStack } from "@/lib/sub-diagram-utils";
import { getDownstreamAnimationChainNodes } from "@/lib/connection-animation";
import { isEventFromEditableElement } from "@/lib/keyboard-utils";
import type { DiagramData, DiagramNodeData, LayersConfig } from "@/lib/types";
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
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(true);
  const [metadataPopupsEnabled, setMetadataPopupsEnabled] = useState(true);
  const [animationConnectionsEnabled, setAnimationConnectionsEnabled] = useState(true);
  const [showAnimationsForSelectedOnly, setShowAnimationsForSelectedOnly] = useState(false);
  const [animationToggleOnClickEnabled, setAnimationToggleOnClickEnabled] = useState(false);
  const [animationDisabledSources, setAnimationDisabledSources] = useState<Set<string>>(new Set());
  const [isInitialized, setIsInitialized] = useState(false);
  const [activeDiagramStack, setActiveDiagramStack] = useState<BreadcrumbSegment[]>([]);

  // Persist master animation toggle setting
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("dw:viewer:animationConnections:enabled");
      if (saved !== null) setAnimationConnectionsEnabled(saved === "true");
      setIsInitialized(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("dw:viewer:animationConnections:enabled", String(animationConnectionsEnabled));
    }
  }, [animationConnectionsEnabled]);

  // Reset selected-only filter and disabled sources when re-enabling animations (only after initialization)
  useEffect(() => {
    if (!isInitialized) return;
    if (animationConnectionsEnabled) {
      setShowAnimationsForSelectedOnly(false);
      setAnimationDisabledSources(new Set());
    }
  }, [animationConnectionsEnabled, isInitialized]);

  // Persist animation toggle on click setting
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("dw:viewer:animationToggleOnClick:enabled");
      if (saved !== null) setAnimationToggleOnClickEnabled(saved === "true");
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("dw:viewer:animationToggleOnClick:enabled", String(animationToggleOnClickEnabled));
    }
  }, [animationToggleOnClickEnabled]);

  // Reset click-to-toggle disabled sources when it's enabled
  useEffect(() => {
    if (animationToggleOnClickEnabled) {
      setAnimationDisabledSources(new Set());
    }
  }, [animationToggleOnClickEnabled]);

  // Disable click-to-toggle when master animation toggle is off
  useEffect(() => {
    if (!animationConnectionsEnabled && animationToggleOnClickEnabled) {
      setAnimationToggleOnClickEnabled(false);
    }
  }, [animationConnectionsEnabled, animationToggleOnClickEnabled]);

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

  const currentDiagramData = useMemo(() => {
    if (!diagramData) return null;
    return getDiagramAtStack(diagramData, activeDiagramStack);
  }, [diagramData, activeDiagramStack]);

  const filteredDiagramData = useMemo(() => {
    if (!currentDiagramData) return null;
    if (!layersConfig || layersConfig.layers.length <= 1) return currentDiagramData;
    return filterByVisibleLayers({ ...currentDiagramData, layers: layersConfig });
  }, [currentDiagramData, layersConfig]);

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
        setActiveDiagramStack([]);
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

  const handleBreadcrumbNavigate = useCallback(
    (index: number) => {
      setActiveDiagramStack((s) => s.slice(0, index));
      setSelectedItem(null);
      setTimeout(() => {
        if ((window as any).__viewerFitToView) (window as any).__viewerFitToView();
      }, 100);
    },
    []
  );

  const handleSubDiagramDoubleClick = useCallback((node: DiagramNodeData) => {
    if (!node.subDiagramId) return;
    setActiveDiagramStack((s) => [
      ...s,
      { diagramId: node.subDiagramId!, fromNodeId: node.id, fromNodeLabel: node.label || "Sub-diagram" },
    ]);
    setSelectedItem(null);
    setTimeout(() => {
      if ((window as any).__viewerFitToView) (window as any).__viewerFitToView();
    }, 100);
  }, []);

  const getHasLinkedSubDiagram = useCallback(
    (node: DiagramNodeData) => {
      if (!node.subDiagramId) return false;
      const subId = node.subDiagramId;
      if (currentDiagramData?.subDiagrams?.[subId]) return true;
      if (activeDiagramStack.length > 0 && diagramData?.subDiagrams?.[subId]) return true;
      return false;
    },
    [currentDiagramData, activeDiagramStack, diagramData]
  );

  const handleItemSelect = useCallback(
    (item: ViewerSelectedItem | null) => {
      if (!item && (animationToggleOnClickEnabled || showAnimationsForSelectedOnly)) {
        setAnimationDisabledSources(new Set());
      }
      setSelectedItem(item);
    },
    [animationToggleOnClickEnabled, showAnimationsForSelectedOnly]
  );

  // Keyboard shortcuts for animation toggles
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.userAgent.toUpperCase().includes('MAC');

      if (isEventFromEditableElement(e)) return;
      
      // Ctrl+Alt+A (or Cmd+Option+A on Mac) - Toggle Animation Connections
      if ((isMac ? e.metaKey : e.ctrlKey) && e.altKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setAnimationConnectionsEnabled(!animationConnectionsEnabled);
        return;
      }
      
      // Ctrl+Alt+C (or Cmd+Option+C on Mac) - Toggle Click to Toggle Animations
      if ((isMac ? e.metaKey : e.ctrlKey) && e.altKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        if (animationConnectionsEnabled) {
          setAnimationToggleOnClickEnabled(!animationToggleOnClickEnabled);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [animationConnectionsEnabled, setAnimationConnectionsEnabled, setAnimationToggleOnClickEnabled]);

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

  const displayData = filteredDiagramData ?? currentDiagramData ?? diagramData;
  const selectedItemId = selectedItem?.itemType === "node" ? selectedItem.id : selectedItem?.itemType === "edge" ? selectedItem.id : undefined;

  // Show chain animations only when a node is selected. No animations when nothing selected.
  const effectiveAnimationFilterIds = showAnimationsForSelectedOnly
    ? (selectedItem?.itemType === "node" && selectedItemId && displayData?.connections
        ? getDownstreamAnimationChainNodes(selectedItemId, displayData.connections)
        : new Set<string>())  // Empty set = no animations when nothing selected
    : undefined;

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex w-full h-screen bg-background overflow-hidden flex-col">
        {activeDiagramStack.length > 0 && (
          <DiagramBreadcrumb
            segments={[{ diagramId: null }, ...activeDiagramStack]}
            rootLabel="Main Diagram"
            onNavigate={handleBreadcrumbNavigate}
            isReadOnly={true}
          />
        )}
        <div className="flex-1 relative min-w-0">
          <ViewerCanvas
            diagramData={displayData}
            transform={transform}
            onTransformChange={setTransform}
            onFitToView={handleFitToView}
            selectedItemId={selectedItemId}
            selectedItem={selectedItem}
            onItemSelect={handleItemSelect}
            onSubDiagramDoubleClick={handleSubDiagramDoubleClick}
            getHasLinkedSubDiagram={getHasLinkedSubDiagram}
            metadataPopupsEnabled={metadataPopupsEnabled}
            openNodeLinksOnClick={true}
            animationConnectionsEnabled={animationConnectionsEnabled}
            showAnimationsForSelectedOnly={showAnimationsForSelectedOnly && animationConnectionsEnabled}
            animationFilterSourceIds={effectiveAnimationFilterIds}
            animationToggleOnClickEnabled={animationToggleOnClickEnabled && animationConnectionsEnabled}
            animationDisabledSources={animationDisabledSources}
            onAnimationDisabledSourcesChange={setAnimationDisabledSources}
          />
          <ViewerControls
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onFitToView={handleFitToView}
            onTogglePropertiesPanel={() => setPropertiesPanelVisible((v) => !v)}
            propertiesPanelVisible={propertiesPanelVisible}
            onToggleMetadataPopups={() => setMetadataPopupsEnabled((v) => !v)}
            metadataPopupsEnabled={metadataPopupsEnabled}
            onToggleAnimationConnections={() => setAnimationConnectionsEnabled((v) => !v)}
            animationConnectionsEnabled={animationConnectionsEnabled}
            onToggleAnimationsForSelected={() => setShowAnimationsForSelectedOnly((v) => !v)}
            showAnimationsForSelectedOnly={showAnimationsForSelectedOnly && animationConnectionsEnabled}
            onToggleAnimationClickMode={() => setAnimationToggleOnClickEnabled((v) => !v)}
            animationToggleOnClickEnabled={animationToggleOnClickEnabled && animationConnectionsEnabled}
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
            collapsed={rightPanelCollapsed}
            onToggleCollapse={() => setRightPanelCollapsed((v) => !v)}
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
