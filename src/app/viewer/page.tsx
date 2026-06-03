"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { ViewerCanvas, type ViewerSelectedItem } from "@/components/viewer/viewer-canvas";
import { ViewerControls } from "@/components/viewer/viewer-controls";
import { ViewerLayersPanel } from "@/components/viewer/viewer-layers-panel";
import { ViewerPresentationBar } from "@/components/viewer/viewer-presentation-bar";
import { PresentationPlayer } from "@/components/editor/presentation-player";
import { PropertiesPanel } from "@/components/editor/properties-panel";
import { DiagramBreadcrumb, type BreadcrumbSegment } from "@/components/editor/diagram-breadcrumb";
import { loadViewerData, parseViewerParams, type ViewerData } from "@/lib/viewer-utils";
import { ViewerLocalFilePanel } from "@/components/viewer/viewer-local-file-panel";
import { filterByVisibleLayers, toggleLayerVisibility, validateLayersConfig } from "@/lib/layers-utils";
import { getDiagramAtStack } from "@/lib/sub-diagram-utils";
import { sanitizeViewState } from "@/lib/view-state-utils";
import { getDownstreamAnimationChainNodes } from "@/lib/connection-animation";
import { isEventFromEditableElement } from "@/lib/keyboard-utils";
import { getPresentationDeltaMode, resolvePresentationSlideDiagrams } from "@/lib/presentation-slide-chain";
import {
  getElementVisibleViewportSize,
  pruneConnectionsToVisibleNodes,
} from "@/lib/presentation-viewport-fit";
import { buildPresentationGlobalVariableContext } from "@/lib/builtin-global-variables";
import { usePresentationSlideView } from "@/hooks/use-presentation-slide-view";
import { usePresentationPlaybackCamera } from "@/hooks/use-presentation-playback-camera";
import { cn } from "@/lib/utils";
import type { DiagramData, DiagramNodeData, LayersConfig, PresentationDeck } from "@/lib/types";
import type { Transform } from "@/hooks/use-canvas-transform";

function ViewerPageContent() {
  const searchParams = useSearchParams();
  const [diagramData, setDiagramData] = useState<DiagramData | null>(null);
  const [layersConfig, setLayersConfig] = useState<LayersConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, k: 1 });
  const [selectedItem, setSelectedItem] = useState<ViewerSelectedItem | null>(null);
  const [propertiesPanelVisible, setPropertiesPanelVisible] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(true);
  const [metadataPopupsEnabled, setMetadataPopupsEnabled] = useState(true);
  const [animationConnectionsEnabled, setAnimationConnectionsEnabled] = useState(true);
  const [showAnimationsForSelectedOnly, setShowAnimationsForSelectedOnly] = useState(false);
  const [animationToggleOnClickEnabled, setAnimationToggleOnClickEnabled] = useState(false);
  const [animationDisabledSources, setAnimationDisabledSources] = useState<Set<string>>(new Set());
  const [isInitialized, setIsInitialized] = useState(false);
  const [activeDiagramStack, setActiveDiagramStack] = useState<BreadcrumbSegment[]>([]);
  const [presentationDecks, setPresentationDecks] = useState<PresentationDeck[]>([]);
  const [viewerPresentationDeckId, setViewerPresentationDeckId] = useState<string | null>(null);
  const [presentationSlideIndex, setPresentationSlideIndex] = useState(0);
  const [presentationTransform, setPresentationTransform] = useState<Transform>({ x: 0, y: 0, k: 1 });
  const [presentationPlayerOpen, setPresentationPlayerOpen] = useState(false);
  const [presentationPlayerSessionKey, setPresentationPlayerSessionKey] = useState(0);
  const presentationCanvasHostRef = useRef<HTMLDivElement>(null);
  const [presentationUnionHostSize, setPresentationUnionHostSize] = useState({ w: 0, h: 0 });
  const sessionFileChosenRef = useRef(false);
  const [localFileError, setLocalFileError] = useState<string | null>(null);

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

  const activeViewerPresentationDeck = useMemo(
    () => presentationDecks.find((d) => d.id === viewerPresentationDeckId) ?? presentationDecks[0] ?? null,
    [presentationDecks, viewerPresentationDeckId]
  );

  const viewerSlidesUnified = useMemo(
    () => activeViewerPresentationDeck?.slides ?? [],
    [activeViewerPresentationDeck?.slides]
  );

  const presentationEligible =
    Boolean(diagramData) &&
    activeDiagramStack.length === 0 &&
    presentationDecks.length > 0 &&
    Boolean(activeViewerPresentationDeck) &&
    (activeViewerPresentationDeck?.slides.length ?? 0) > 0;

  const slideDiagramsForViewerPresentation = useMemo(() => {
    if (!diagramData || !presentationEligible) return undefined;
    const slides = activeViewerPresentationDeck?.slides ?? [];
    const mode = activeViewerPresentationDeck
      ? getPresentationDeltaMode(activeViewerPresentationDeck)
      : "master";
    return resolvePresentationSlideDiagrams(diagramData, slides, mode);
  }, [
    diagramData,
    presentationEligible,
    activeViewerPresentationDeck?.slides,
    activeViewerPresentationDeck?.presentationDeltaMode,
    activeViewerPresentationDeck?.id,
  ]);

  const slideDiagramsForViewerUnionFit = useMemo(() => {
    if (!slideDiagramsForViewerPresentation?.length) return [];
    return slideDiagramsForViewerPresentation.map((d) => pruneConnectionsToVisibleNodes(d));
  }, [slideDiagramsForViewerPresentation]);

  const slidePresentationView = usePresentationSlideView({
    enabled: presentationEligible && !presentationPlayerOpen,
    slides: viewerSlidesUnified,
    slideDiagrams: slideDiagramsForViewerPresentation,
    slideIndex: presentationSlideIndex,
  });

  const handleViewerPresentationDeckChange = useCallback((deckId: string) => {
    setViewerPresentationDeckId(deckId);
    setPresentationSlideIndex(0);
  }, []);

  useEffect(() => {
    if (!presentationEligible || presentationPlayerOpen) return;
    const n = viewerSlidesUnified.length;
    if (n === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (isEventFromEditableElement(e)) return;
      if (e.key === " " || e.key === "ArrowRight") {
        e.preventDefault();
        setPresentationSlideIndex((i) => (i + 1) % n);
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setPresentationSlideIndex((i) => (i - 1 + n) % n);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setPresentationSlideIndex(0);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setPresentationSlideIndex(Math.max(n - 1, 0));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [presentationPlayerOpen, presentationEligible, viewerSlidesUnified]);

  const presentationAnimationFilterIds = useMemo(() => {
    const ids = slidePresentationView.currentSlide?.animationState?.filterSourceIds;
    if (!ids || ids.length === 0) return undefined;
    return new Set(ids);
  }, [slidePresentationView.currentSlide?.animationState?.filterSourceIds]);

  const presentationAnimationDisabledSources = useMemo(
    () => new Set(slidePresentationView.currentSlide?.animationState?.disabledSourceIds ?? []),
    [slidePresentationView.currentSlide?.animationState?.disabledSourceIds]
  );

  useEffect(() => {
    const n = viewerSlidesUnified.length;
    const maxIdx = Math.max(n - 1, 0);
    setPresentationSlideIndex((i) => Math.min(Math.max(i, 0), maxIdx));
  }, [activeViewerPresentationDeck?.id, viewerSlidesUnified.length]);

  useEffect(() => {
    if (!diagramData) {
      setPresentationUnionHostSize({ w: 0, h: 0 });
      return;
    }
    const el = presentationCanvasHostRef.current;
    if (!el) return;

    const measure = () => {
      const { width, height } = getElementVisibleViewportSize(el);
      setPresentationUnionHostSize((prev) =>
        prev.w === width && prev.h === height ? prev : { w: width, h: height }
      );
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [diagramData, propertiesPanelVisible, rightPanelCollapsed]);

  usePresentationPlaybackCamera({
    enabled: presentationEligible && !presentationPlayerOpen,
    useSlideZoom: false,
    slideIndex: slidePresentationView.safeIndex,
    currentSlide: slidePresentationView.currentSlide,
    renderedDiagram: slidePresentationView.renderedDiagram,
    slideDiagramsForUnionFit: slideDiagramsForViewerUnionFit,
    viewportWidth: presentationUnionHostSize.w,
    viewportHeight: presentationUnionHostSize.h,
    transform: presentationTransform,
    setTransform: setPresentationTransform,
    instantApplyRevision: activeViewerPresentationDeck?.id,
  });

  useEffect(() => {
    async function loadDiagram() {
      const baseHref = typeof window !== "undefined" ? window.location.href : undefined;
      const rawSearch = typeof window !== "undefined" ? window.location.search : undefined;

      let params: ReturnType<typeof parseViewerParams>;
      try {
        params = parseViewerParams(searchParams, baseHref, rawSearch);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Invalid viewer URL";
        setError(message);
        setIsLoading(false);
        return;
      }

      if (params.mode === "localPick") {
        if (!sessionFileChosenRef.current) {
          setLocalFileError(null);
          setDiagramData(null);
          setActiveDiagramStack([]);
          setPresentationDecks([]);
          setViewerPresentationDeckId(null);
          setPresentationSlideIndex(0);
          setPresentationPlayerOpen(false);
          setSelectedItem(null);
        }
        setError(null);
        setIsLoading(false);
        return;
      }

      sessionFileChosenRef.current = false;

      try {
        setIsLoading(true);
        setError(null);

        const data = await loadViewerData(params);
        setDiagramData(data.diagramData);
        setActiveDiagramStack([]);
        const decks = data.presentation?.decks ?? [];
        setPresentationDecks(decks);
        const nextDeckId = data.presentation?.activeDeckId ?? decks[0]?.id ?? null;
        setViewerPresentationDeckId(nextDeckId);
        setPresentationSlideIndex(0);
        setPresentationPlayerOpen(false);
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

  const handleLocalFileLoaded = useCallback((data: ViewerData) => {
    sessionFileChosenRef.current = true;
    setLocalFileError(null);
    setDiagramData(data.diagramData);
    setActiveDiagramStack([]);
    const decks = data.presentation?.decks ?? [];
    setPresentationDecks(decks);
    const nextDeckId = data.presentation?.activeDeckId ?? decks[0]?.id ?? null;
    setViewerPresentationDeckId(nextDeckId);
    setPresentationSlideIndex(0);
    setPresentationPlayerOpen(false);
    setSelectedItem(null);
    setError(null);
  }, []);

  const handleLocalFileError = useCallback((message: string) => {
    setLocalFileError(message);
  }, []);

  const parsedViewerParams = useMemo(() => {
    try {
      const rawSearch = typeof window !== "undefined" ? window.location.search : undefined;
      return parseViewerParams(
        searchParams,
        typeof window !== "undefined" ? window.location.href : undefined,
        rawSearch
      );
    } catch {
      return null;
    }
  }, [searchParams]);

  const handleZoomIn = useCallback(() => {
    const bump = (prev: Transform) => ({
      ...prev,
      k: Math.min(prev.k * 1.2, 2.5),
    });
    if (presentationEligible && !presentationPlayerOpen) {
      setPresentationTransform(bump);
    } else {
      setTransform(bump);
    }
  }, [presentationEligible, presentationPlayerOpen]);

  const handleZoomOut = useCallback(() => {
    const bump = (prev: Transform) => ({
      ...prev,
      k: Math.max(prev.k / 1.2, 0.1),
    });
    if (presentationEligible && !presentationPlayerOpen) {
      setPresentationTransform(bump);
    } else {
      setTransform(bump);
    }
  }, [presentationEligible, presentationPlayerOpen]);

  const handleFitToView = useCallback(() => {
    // Trigger fit to view via the canvas component
    if ((window as any).__viewerFitToView) {
      (window as any).__viewerFitToView();
    }
  }, []);

  const handleTogglePropertiesPanel = useCallback(() => {
    setPropertiesPanelVisible((prev) => {
      const next = !prev;
      if (next) setRightPanelCollapsed(false);
      return next;
    });
  }, []);

  const handleBreadcrumbNavigate = useCallback(
    (index: number) => {
      setActiveDiagramStack((s) => s.slice(0, index));
      setSelectedItem(null);
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
  }, []);

  /** Restore viewState when navigating; use fitToView if no saved state */
  const lastRestoredStackRef = useRef<string | null>(null);
  useEffect(() => {
    lastRestoredStackRef.current = null;
  }, [diagramData]);
  useEffect(() => {
    if (!diagramData) return;
    const stackKey = JSON.stringify(activeDiagramStack);
    if (lastRestoredStackRef.current === stackKey) return;
    lastRestoredStackRef.current = stackKey;

    const targetDiagram = getDiagramAtStack(diagramData, activeDiagramStack);
    const vs = sanitizeViewState(targetDiagram?.viewState);
    const rootDeck =
      activeDiagramStack.length === 0
        ? presentationDecks.find((d) => d.id === viewerPresentationDeckId) ?? presentationDecks[0] ?? null
        : null;
    const rootPresentation = Boolean(rootDeck);

    if (vs) {
      setTransform(vs);
      if (rootPresentation) setPresentationTransform(vs);
    } else {
      const t = setTimeout(() => {
        if ((window as any).__viewerFitToView) (window as any).__viewerFitToView();
      }, 100);
      return () => clearTimeout(t);
    }
  }, [activeDiagramStack, diagramData, presentationDecks, viewerPresentationDeckId]);

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

  /** Must run on every render — cannot sit after loading/file-picker early returns (React #310). */
  const displayData = useMemo(() => {
    if (
      presentationEligible &&
      !presentationPlayerOpen &&
      slidePresentationView.diagramDataForCanvas
    ) {
      return slidePresentationView.diagramDataForCanvas;
    }
    return filteredDiagramData ?? currentDiagramData ?? diagramData;
  }, [
    presentationEligible,
    presentationPlayerOpen,
    slidePresentationView.diagramDataForCanvas,
    filteredDiagramData,
    currentDiagramData,
    diagramData,
  ]);

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
            Use <span className="font-mono">json</span>, <span className="font-mono">url</span>, or{" "}
            <span className="font-mono">file=</span> (empty) to open a file from your computer.
          </p>
        </div>
      </div>
    );
  }

  if (!diagramData) {
    if (parsedViewerParams?.mode === "localPick") {
      return (
        <ViewerLocalFilePanel
          onLoaded={handleLocalFileLoaded}
          onError={handleLocalFileError}
          errorMessage={localFileError}
        />
      );
    }
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-background">
        <div className="text-muted-foreground">No diagram data available</div>
      </div>
    );
  }

  /** `displayData` hook runs before `diagramData` guard; here `diagramData` is set. */
  const canvasDiagramData: DiagramData = displayData ?? diagramData;

  const slideCanvasActive = presentationEligible && !presentationPlayerOpen;

  const canvasTransform = slideCanvasActive ? presentationTransform : transform;
  const slidePlaybackAnimEnabled = slideCanvasActive
    ? (slidePresentationView.currentSlide?.animationState?.enabled ?? true)
    : animationConnectionsEnabled;

  const selectedItemId = selectedItem?.itemType === "node" ? selectedItem.id : selectedItem?.itemType === "edge" ? selectedItem.id : undefined;

  // Show chain animations only when a node is selected. No animations when nothing selected.
  const effectiveAnimationFilterIds = showAnimationsForSelectedOnly
    ? (selectedItem?.itemType === "node" && selectedItemId && canvasDiagramData.connections
        ? getDownstreamAnimationChainNodes(selectedItemId, canvasDiagramData.connections)
        : new Set<string>())  // Empty set = no animations when nothing selected
    : undefined;

  const globalVariableContext = useMemo(() => {
    if (slideCanvasActive) {
      return buildPresentationGlobalVariableContext(
        slidePresentationView.safeIndex,
        slidePresentationView.totalSlides,
      );
    }
    return buildPresentationGlobalVariableContext(0, 1);
  }, [
    slideCanvasActive,
    slidePresentationView.safeIndex,
    slidePresentationView.totalSlides,
  ]);

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
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-row">
          <div
            ref={presentationCanvasHostRef}
            className={cn(
              "relative min-h-0 min-w-0 flex-1",
              presentationPlayerOpen && "pointer-events-none"
            )}
          >
            <ViewerCanvas
              diagramData={canvasDiagramData}
              transform={canvasTransform}
              onTransformChange={slideCanvasActive ? setPresentationTransform : setTransform}
              onFitToView={handleFitToView}
              selectedItemId={selectedItemId}
              selectedItem={selectedItem}
              onItemSelect={handleItemSelect}
              onSubDiagramDoubleClick={handleSubDiagramDoubleClick}
              getHasLinkedSubDiagram={getHasLinkedSubDiagram}
              metadataPopupsEnabled={metadataPopupsEnabled}
              openNodeLinksOnClick={true}
              animationConnectionsEnabled={slidePlaybackAnimEnabled}
              showAnimationsForSelectedOnly={
                slideCanvasActive ? false : showAnimationsForSelectedOnly && animationConnectionsEnabled
              }
              animationFilterSourceIds={
                slideCanvasActive ? presentationAnimationFilterIds : effectiveAnimationFilterIds
              }
              animationToggleOnClickEnabled={
                slideCanvasActive ? false : animationToggleOnClickEnabled && animationConnectionsEnabled
              }
              animationDisabledSources={
                slideCanvasActive ? presentationAnimationDisabledSources : animationDisabledSources
              }
              onAnimationDisabledSourcesChange={setAnimationDisabledSources}
              nodeTransitionStyles={slideCanvasActive ? slidePresentationView.nodeTransitionStyles : undefined}
              connectionTransitionStyles={
                slideCanvasActive ? slidePresentationView.connectionTransitionStyles : undefined
              }
              skipInitialFitToView={slideCanvasActive}
              connectionRenderRevision={
                slideCanvasActive
                  ? `${slidePresentationView.safeIndex}-${slidePresentationView.currentSlide?.id ?? ""}`
                  : undefined
              }
              showDotGrid={!presentationPlayerOpen}
              globalVariableContext={globalVariableContext}
            />
            {slideCanvasActive && activeViewerPresentationDeck && (
                <ViewerPresentationBar
                  decks={presentationDecks}
                  activeDeckId={activeViewerPresentationDeck.id}
                  onDeckChange={handleViewerPresentationDeckChange}
                  slideIndex={slidePresentationView.safeIndex}
                  totalSlides={slidePresentationView.totalSlides}
                  onPrevious={() =>
                    setPresentationSlideIndex(
                      (i) => (i - 1 + viewerSlidesUnified.length) % viewerSlidesUnified.length
                    )
                  }
                  onNext={() =>
                    setPresentationSlideIndex((i) => (i + 1) % viewerSlidesUnified.length)
                  }
                  onFullscreen={() => {
                    setPresentationPlayerSessionKey((k) => k + 1);
                    setPresentationPlayerOpen(true);
                  }}
                />
              )}
          </div>
          {propertiesPanelVisible && (
            <div
              data-dw-viewer-properties
              className={cn(
                "flex h-full shrink-0",
                rightPanelCollapsed && "absolute top-0 bottom-0 right-0 z-30 shadow-md",
                presentationPlayerOpen && "pointer-events-none"
              )}
            >
              <PropertiesPanel
                selectedItem={selectedItem as Parameters<typeof PropertiesPanel>[0]["selectedItem"]}
                diagramData={canvasDiagramData}
                onItemUpdate={() => {}}
                collapsed={rightPanelCollapsed}
                onToggleCollapse={() => setRightPanelCollapsed((v) => !v)}
                isReadOnly={true}
                narrowCollapsed
              />
            </div>
          )}
          {!presentationPlayerOpen && (
            <ViewerControls
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onFitToView={handleFitToView}
              onTogglePropertiesPanel={handleTogglePropertiesPanel}
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
                <>
                  {hasLayers && layersConfig && diagramData && !presentationEligible && (
                    <>
                      <div className="h-px bg-border my-1" />
                      <ViewerLayersPanel
                        layers={layersConfig.layers}
                        diagramData={diagramData}
                        onToggleVisibility={handleToggleLayerVisibility}
                      />
                    </>
                  )}
                </>
              }
            />
          )}
        </div>
        {presentationDecks.length > 0 && viewerSlidesUnified.length > 0 && (
          <PresentationPlayer
            key={presentationPlayerSessionKey}
            open={presentationPlayerOpen}
            slides={viewerSlidesUnified}
            slideDiagrams={slideDiagramsForViewerPresentation}
            currentIndex={presentationSlideIndex}
            onOpenChange={setPresentationPlayerOpen}
            onIndexChange={setPresentationSlideIndex}
            showPlaybackToolbar={false}
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
