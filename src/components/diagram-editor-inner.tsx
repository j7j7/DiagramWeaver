"use client";

import React, { useMemo, useCallback, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import dynamic from "next/dynamic";

import { ComponentSidebar } from "./editor/component-sidebar";
import { EditorCanvas } from "./editor/editor-canvas";
import { ConnectionContextModal } from "./editor/connection-context-modal";
import { UmlClassEditorModal } from "./editor/uml-class-editor-modal";
import { ChartDataEditorModal } from "./editor/chart-data-editor-modal";
import { ZOrderListModal } from "./editor/z-order-list-modal";
import { computeUmlClassDimensions } from "@/lib/uml-utils";
import { PresentationPlayer } from "./editor/presentation-player";
import { TabBar } from "./editor/tab-bar";
import { ExportDialog } from "./editor/export-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { DiagramData, DiagramNodeData, PresentationDeck, Slide } from "@/lib/types";
import { useTutorial } from "./tutorial/tutorial-provider";
import { getTutorialSteps } from "./tutorial/tutorial-steps";
import { DiagramBreadcrumb } from "./editor/diagram-breadcrumb";
import type { DiagramEditorInnerProps } from "./editor/diagram-editor-inner-props";
import { useTutorialCIntroConnectionEffect } from "@/hooks/use-tutorial-c-intro-connection-effect";

const TopMenuBar = dynamic(() => import("./editor/top-menu-bar").then((mod) => ({ default: mod.TopMenuBar })), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[2.5rem] items-center overflow-x-auto border-b bg-card">
      <div className="flex h-10 items-center space-x-1 rounded-md border bg-background p-1">
        <div className="flex cursor-default select-none items-center rounded-sm px-3 py-1.5 text-sm font-medium">
          Loading...
        </div>
      </div>
    </div>
  ),
});

const JsonEditorPanel = dynamic(() => import("./editor/json-editor-panel").then((mod) => ({ default: mod.JsonEditorPanel })), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-w-[200px] flex-shrink-0 items-center justify-center border-l bg-card">
      <div className="text-sm text-muted-foreground">Loading JSON…</div>
    </div>
  ),
});

const PresentationEditorPanel = dynamic(
  () => import("./editor/presentation-editor-panel").then((mod) => ({ default: mod.PresentationEditorPanel })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-12 items-center justify-center border-b bg-card">
        <div className="text-sm text-muted-foreground">Loading Presentation Editor...</div>
      </div>
    ),
  },
);

const LayersPanel = dynamic(() => import("./editor/layers-panel").then((mod) => ({ default: mod.LayersPanel })), {
  ssr: false,
  loading: () => (
    <div className="rounded-md border bg-card p-4 shadow-lg">
      <div className="text-sm text-muted-foreground">Loading Layers Panel...</div>
    </div>
  ),
});

const PropertiesPanel = dynamic(() => import("./editor/properties-panel").then((mod) => ({ default: mod.PropertiesPanel })), {
  ssr: false,
  loading: () => (
    <div className="border-t bg-card p-4">
      <div className="text-sm text-muted-foreground">Loading Properties Panel...</div>
    </div>
  ),
});

const ScratchPad = dynamic(() => import("./editor/scratch-pad").then((mod) => ({ default: mod.ScratchPad })), {
  ssr: false,
});

const PRESENTATION_PANEL_SETTINGS_KEY = 'dw:presentation:panelSettings';

export function DiagramEditorInner({
  canPasteFromMenu,
  isMobile,
  sidebarOpen,
  setSidebarOpen,
  leftPanelCollapsed,
  setLeftPanelCollapsed,
  rightPanelCollapsed,
  setRightPanelCollapsed,
  propertiesPanelVisible,
  onTogglePropertiesPanel,
  metadataPopupsEnabled,
  onToggleMetadataPopups,
  selectedItem,
  selectedItemIds,
  handleItemUpdate,
  handleBulkMetadataUpdate,
  startConnecting,
  handleItemDelete,
  connectorLineFocusedVertex,
  handleConnectorLineVertexFocus,
  tryDeleteConnectorLineVertexBeforeNodeDelete,
  handleResourceSelect,
  handleResourceActivate,
  handleResourceActivateAtPosition,
  toggleJsonPanel,
  jsonPanelOpen,
  jsonPanelWidth,
  setJsonPanelWidth,
  editorRef,
  handleConnectionUpdate,
  disconnectConnection,
  handleConnectionWaypointAdd,
  handleConnectionInsertNode,
  handleConnectionWaypointRemove,
  handleConnectionWaypointMove,
  handleConnectionContextMenu,
  connectionContextModal,
  setConnectionContextModal,
  umlClassEditorModal,
  setUmlClassEditorModal,
  chartDataEditorModal,
  setChartDataEditorModal,
  setDiagramData,
  updateTutorialDiagramData,
  setCurrentDiagramData,
  currentDiagramData,
  activeDiagramStack,
  handleBreadcrumbNavigate,
  handleBreadcrumbSegmentRename,
  handleSubDiagramDoubleClick,
  getHasLinkedSubDiagram,
  handleCreateSubDiagram,
  handleRemoveSubDiagramLink,
  onImportIntoSubDiagram,
  onSubDiagramFileChange,
  subDiagramImportInputRef,
  layers,
  layerAnimationsEnabled,
  setLayerAnimationsEnabled,
  displayDiagramData,
  layerAnimation,
  handleToggleLayerVisibility,
  canvasTransform,
  setCanvasTransform,
  handleNew,
  handleLoadClick,
  handleMermaidImportClick,
  handleMermaidFileChange,
  mermaidInputRef,
  handleSave,
  handleLoadExample,
  createTab,
  handleExportSvg,
  handleExportGif,
  handleMenuCopy,
  handleMenuPaste,
  canPaste,
  undo,
  redo,
  historyIndex,
  history,
  handleSelectAll,
  mousePosition,
  hoverEnabled,
  setHoverEnabled,
  iconBackgroundEnabled,
  setIconBackgroundEnabled,
  defaultTextLabelsEnabled,
  setDefaultTextLabelsEnabled,
  alignmentGuidesEnabled,
  setAlignmentGuidesEnabled,
  connectionsBehindNodesEnabled,
  setConnectionsBehindNodesEnabled,
  animationConnectionsEnabled,
  animationConnectionsUserEnabled,
  animationConnectionsIdlePaused,
  animationConnectionsMenuPaused,
  setAnimationConnectionsMenuPaused,
  pauseConnectionAnimationsForOverlayUi,
  setAnimationConnectionsEnabled: setAnimationConnectionsUserEnabled,
  animationToggleOnClickEnabled,
  setAnimationToggleOnClickEnabled,
  effectiveAnimationFilterIds,
  animationDisabledSources,
  setAnimationDisabledSources,
  isReadOnly,
  setIsReadOnly,
  handleAlignObjects,
  handleLayoutGridStep,
  handleAutoLayout,
  handleThemeApplyToSelected,
  triggerTextStylingPanel,
  setTriggerTextStylingPanel,
  triggerVisualStylingPanel,
  setTriggerVisualStylingPanel,
  triggerLineStylingPanel,
  setTriggerLineStylingPanel,
  triggerConnectionSettingsPanel,
  setTriggerConnectionSettingsPanel,
  setScratchPadOpen,
  scratchPadOpen,
  rulesEditorOpen,
  setRulesEditorOpen,
  rules,
  setRules,
  presentationDecks,
  activePresentationDeckId,
  activePresentationSlideId,
  presentationDisabledLayerIds,
  activePresentationSlides,
  activePresentationSlideDiagrams,
  handleSelectPresentationBaseSlide,
  handleAutoZoomPresentation,
  handleApplyPresentationZoomToCurrent,
  handleApplyPresentationZoomToAll,
  handleAddPresentationSnapshot,
  handleAddBlankPresentationSlide,
  handleDeletePresentationSlide,
  presentationHasLaterSlides,
  handlePropagateAddToLaterSlides,
  handlePropagateDeleteToLaterSlides,
  simulationModeEnabled,
  handleToggleSimulationMode,
  handleMovePresentationSlide,
  handleSelectPresentationSlide,
  handleTogglePresentationSlideSelection,
  handlePreviousPresentationSlide,
  handleNextPresentationSlide,
  handleEnterPresentationPlayMode,
  presentationPlayerSlides,
  presentationPlayerSlideDiagrams,
  presentationPlayerOpen,
  setPresentationPlayerOpen,
  presentationPlayerIndex,
  setPresentationPlayerIndex,
  tabs,
  activeTabId,
  isLoaded,
  switchTab,
  handleTabClose,
  reorderTabs,
  fileInputRef,
  handleFileChange,
  diagramData,
  handleJsonValidChange,
  exportDialogOpen,
  exportDialogFormat,
  setExportDialogOpen,
  handleExport,
  refreshCanvas,
  updateHistory,
  closeTabDialogOpen,
  setCloseTabDialogOpen,
  pendingCloseTabId,
  setPendingCloseTabId,
  handleCloseTabConfirm,
  handleCloseTabSave,
  animationSelectionDialogOpen,
  setAnimationSelectionDialogOpen,
  animationOverwriteDialogOpen,
  setAnimationOverwriteDialogOpen,
  animationDisableConfirmDialogOpen,
  setAnimationDisableConfirmDialogOpen,
  animationCurrentOnlyDialogOpen,
  setAnimationCurrentOnlyDialogOpen,
  handleAnimationApplyCurrentOnly,
  handleAnimationApplySelectedConfirm,
  handleAnimationDisableConfirm,
  handleAnimationOverwriteConfirm,
  handleItemSelect,
  handleBatchSelect,
  setSelectedItemIds,
  setSelectedItem,
  isConnectMode,
  handleConnect,
  setIsConnectMode,
  disconnectSelected,
  handleLabelUpdate,
  handleTagUpdate,
  setIsDragging,
  setCanPaste,
  setMousePosition,
  handleGroupItems,
  handleUngroupItems,
  handleRemoveFromGroup,
  handleAddToGroup,
  handleMoveToBack,
  handleMoveToFront,
  handleMoveOneBack,
  handleMoveOneForward,
  canvasRefreshKey,
  activeTab,
  toast,
}: DiagramEditorInnerProps) {
  const presentationConnectionRenderRevision = React.useMemo(
    () => `${activePresentationDeckId ?? ''}-${activePresentationSlideId ?? ''}`,
    [activePresentationDeckId, activePresentationSlideId],
  );

  const exportPresentationSlidesInfo = React.useMemo(() => {
    if (activeDiagramStack.length > 0) return null;
    const deck = presentationDecks.find((d: PresentationDeck) => d.id === activePresentationDeckId);
    if (!deck || deck.slides.length < 1) return null;
    const slideIdx = deck.slides.findIndex((s: Slide) => s.id === activePresentationSlideId);
    const activeSlideNumber = slideIdx >= 0 ? slideIdx + 1 : 1;
    return {
      totalSlides: deck.slides.length,
      tabName: activeTab?.name ?? 'diagram',
      activeSlideNumber,
    };
  }, [
    activeDiagramStack.length,
    presentationDecks,
    activePresentationDeckId,
    activePresentationSlideId,
    activeTab?.name,
  ]);

  const isPrimaryPresentationSlideActiveInner = React.useMemo(() => {
    const deck = presentationDecks.find((d: PresentationDeck) => d.id === activePresentationDeckId);
    const pid = deck?.slides[0]?.id;
    return Boolean(pid && activePresentationSlideId === pid);
  }, [presentationDecks, activePresentationDeckId, activePresentationSlideId]);

  const [presentationSnapshotsCollapsed, setPresentationSnapshotsCollapsed] = React.useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const saved = localStorage.getItem(PRESENTATION_PANEL_SETTINGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, unknown>;
        if (typeof parsed.snapshotsCollapsed === 'boolean') return parsed.snapshotsCollapsed;
      }
    } catch {
      /* ignore */
    }
    return false;
  });

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const prevRaw = localStorage.getItem(PRESENTATION_PANEL_SETTINGS_KEY);
      const prev = prevRaw ? (JSON.parse(prevRaw) as Record<string, unknown>) : {};
      const {
        snapshotsFloating: _sF,
        snapshotsPosition: _sP,
        toolbarFloating: _tF,
        toolbarPosition: _tP,
        ...rest
      } = prev;
      localStorage.setItem(
        PRESENTATION_PANEL_SETTINGS_KEY,
        JSON.stringify({ ...rest, snapshotsCollapsed: presentationSnapshotsCollapsed }),
      );
    } catch {
      /* ignore */
    }
  }, [presentationSnapshotsCollapsed]);

  const { start, isOpen: tutorialOpen, steps: tutorialSteps, currentIndex: tutorialStepIndex } = useTutorial();

  const handleStartTutorial = React.useCallback(() => {
    start(getTutorialSteps());
  }, [start]);

  const tutorialStepId = tutorialSteps[tutorialStepIndex]?.id;
  useTutorialCIntroConnectionEffect(
    tutorialOpen,
    tutorialSteps.length,
    tutorialStepIndex,
    tutorialStepId,
    activeDiagramStack.length,
    updateTutorialDiagramData,
  );

  const [zOrderListModal, setZOrderListModal] = React.useState<{
    open: boolean;
    x: number;
    y: number;
  }>({ open: false, x: 100, y: 80 });

  const openZOrderList = React.useCallback(
    (point?: { x: number; y: number }, initialItemId?: string) => {
      pauseConnectionAnimationsForOverlayUi();
      if (initialItemId) {
        handleBatchSelect([initialItemId]);
      }
      if (typeof window === 'undefined') {
        setZOrderListModal({ open: true, x: 100, y: 80 });
        return;
      }
      const w = 380;
      const h = 480;
      const padding = 8;
      const cx = point?.x ?? window.innerWidth / 2 - w / 2;
      const cy = point?.y ?? 88;
      const x = Math.max(padding, Math.min(cx, window.innerWidth - w - padding));
      const y = Math.max(padding, Math.min(cy, window.innerHeight - h - padding));
      setZOrderListModal({ open: true, x, y });
    },
    [pauseConnectionAnimationsForOverlayUi, handleBatchSelect]
  );

  const getLayerDisplayNameForZOrder = React.useCallback(
    (layerId: string) =>
      layers.layersConfig.layers.find((l: { id: string; name: string }) => l.id === layerId)?.name || layerId,
    [layers.layersConfig.layers]
  );

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex h-screen w-screen bg-background text-foreground font-body relative overflow-hidden">
        {/* Mobile sidebar overlay */}
        {isMobile && sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        
        {/* Sidebar - fixed on mobile, normal on desktop */}
        <div className={`${isMobile ? 'fixed left-0 top-0 h-full z-50 transform transition-transform duration-300 ease-in-out' : ''} ${isMobile && !sidebarOpen ? '-translate-x-full' : ''} ${isMobile ? (leftPanelCollapsed ? 'w-12' : 'w-80') : ''}`}>
 <ComponentSidebar
    selectedItem={selectedItem}
    selectedItemIds={selectedItemIds}
    onItemUpdate={handleItemUpdate}
    onConnect={startConnecting}
    onDisconnect={disconnectSelected}
    onItemDelete={handleItemDelete}
    diagramData={diagramData}
    onResourceSelect={handleResourceSelect}
    onResourceActivate={handleResourceActivate}
    onToggleJsonPanel={toggleJsonPanel}
    jsonPanelOpen={jsonPanelOpen}
    onFitToView={() => editorRef.current?.fitToView()}
    onConnectionUpdate={handleConnectionUpdate}
    onConnectionDisconnect={disconnectConnection}
    onCloseSidebar={() => setSidebarOpen(false)}
    isMobile={isMobile}
    transform={canvasTransform}
    onTransformChange={setCanvasTransform}
    collapsed={leftPanelCollapsed}
    onToggleCollapse={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
  />
        </div>
        
        {/* Mobile menu toggle button */}
        {isMobile && (
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="fixed left-4 top-4 z-30 p-3 bg-card border border-border rounded-md shadow-lg touch-target"
            style={{ touchAction: 'manipulation' }}
            aria-label="Toggle sidebar"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
        )}
        
        <main className={`flex-1 flex flex-col min-h-0 ${isMobile ? 'w-full' : ''} ${isMobile && sidebarOpen ? 'pointer-events-none' : ''} ${(jsonPanelOpen || propertiesPanelVisible) ? 'min-w-0' : ''}`}>
            <header className="flex shrink-0 flex-col border-b bg-card">
                <TopMenuBar
                    onNew={handleNew}
                    onLoad={handleLoadClick}
                    onImportMermaid={handleMermaidImportClick}
                    onImportIntoSubDiagram={onImportIntoSubDiagram}
                    onSave={handleSave}
                    onLoadExample={handleLoadExample}
                    onNewTab={createTab}
                    onExportSvg={handleExportSvg}
                    onExportGif={handleExportGif}
                    onToggleJsonPanel={toggleJsonPanel}
                    jsonPanelOpen={jsonPanelOpen}
                    onTogglePropertiesPanel={onTogglePropertiesPanel}
                    propertiesPanelVisible={propertiesPanelVisible}
                    onToggleMetadataPopups={onToggleMetadataPopups}
                    metadataPopupsEnabled={metadataPopupsEnabled}
                    onToggleLayersPanel={layers.toggleLayersPanel}
                    layersPanelOpen={layers.layersPanelOpen}
                    layerAnimationsEnabled={layerAnimationsEnabled}
                    onToggleLayerAnimations={() => setLayerAnimationsEnabled(!layerAnimationsEnabled)}
                    onFitToView={() => editorRef.current?.fitToView()}
                    onCopy={handleMenuCopy}
                    onPaste={handleMenuPaste}
                    canPaste={canPasteFromMenu}
                    onUndo={undo}
                    onRedo={redo}
                    canUndo={historyIndex > 0}
                    canRedo={historyIndex < history.length - 1}
                    onSelectAll={handleSelectAll}
                    selectedItem={selectedItem}
                    selectedItemIds={selectedItemIds}
                    onItemUpdate={handleItemUpdate}
                    onBulkMetadataUpdate={handleBulkMetadataUpdate}
                    onConnect={startConnecting}
                    onDisconnect={disconnectSelected}
                    onDelete={() => {
                      if (selectedItem) {
                        handleItemDelete(selectedItem);
                      }
                    }}
                    onConnectionUpdate={handleConnectionUpdate}
                    onConnectionDisconnect={disconnectConnection}
                    onConnectionWaypointAdd={handleConnectionWaypointAdd}
                    onConnectionWaypointRemove={handleConnectionWaypointRemove}
                    diagramData={diagramData}
                    onDiagramDataUpdate={setDiagramData}
                    currentDiagramData={currentDiagramData}
                    onCurrentDiagramDataUpdate={setCurrentDiagramData}
                    mousePosition={mousePosition}
                    hoverEnabled={hoverEnabled}
                    onToggleHover={() => setHoverEnabled(!hoverEnabled)}
                    iconBackgroundEnabled={iconBackgroundEnabled}
                    onToggleIconBackground={() => setIconBackgroundEnabled(!iconBackgroundEnabled)}
                    defaultTextLabelsEnabled={defaultTextLabelsEnabled}
                    onToggleDefaultTextLabels={() => setDefaultTextLabelsEnabled(!defaultTextLabelsEnabled)}
                    alignmentGuidesEnabled={alignmentGuidesEnabled}
                    onToggleAlignmentGuides={() => setAlignmentGuidesEnabled(!alignmentGuidesEnabled)}
                    connectionsBehindNodesEnabled={connectionsBehindNodesEnabled}
                    onToggleConnectionsBehindNodes={() => setConnectionsBehindNodesEnabled(!connectionsBehindNodesEnabled)}
                    animationConnectionsEnabled={animationConnectionsEnabled}
                    animationConnectionsUserEnabled={animationConnectionsUserEnabled}
                    animationConnectionsIdlePaused={animationConnectionsIdlePaused}
                    animationConnectionsMenuPaused={animationConnectionsMenuPaused}
                    onConnectionAnimationPauseFromMenu={pauseConnectionAnimationsForOverlayUi}
                    onToggleAnimationConnections={() => setAnimationConnectionsUserEnabled((v: boolean) => !v)}
                    animationToggleOnClickEnabled={animationToggleOnClickEnabled}
                    onToggleAnimationToggleOnClick={() => setAnimationToggleOnClickEnabled(!animationToggleOnClickEnabled)}
                    isReadOnly={isReadOnly}
                    onToggleReadOnly={() => setIsReadOnly(!isReadOnly)}
                    onAlignObjects={handleAlignObjects}
                    onLayoutGridStep={handleLayoutGridStep}
                    onAutoLayout={handleAutoLayout}
                    onOpenZOrderList={() => openZOrderList()}
                    onThemeApplyToSelected={handleThemeApplyToSelected}
                    triggerTextStylingPanel={triggerTextStylingPanel}
                    triggerVisualStylingPanel={triggerVisualStylingPanel}
                    triggerLineStylingPanel={triggerLineStylingPanel}
                    triggerConnectionSettingsPanel={triggerConnectionSettingsPanel}
                    onCloseConnectionSettingsPanel={() => {
                      // This will be passed down to close the connection settings panel
                      // We need to emit an event or call a callback to top-menu-bar
                    }}
                    onToggleScratchPad={() => setScratchPadOpen(!scratchPadOpen)}
                    scratchPadOpen={scratchPadOpen}
                    onToggleRulesEditor={() => setRulesEditorOpen(true)}
                    onRulesEditorOpenChange={setRulesEditorOpen}
                    rulesEditorOpen={rulesEditorOpen}
                    rules={rules}
                    onRulesChange={setRules}
                    presentationHasLaterSlides={presentationHasLaterSlides}
                    onPropagateAddToLaterSlides={handlePropagateAddToLaterSlides}
                    onPropagateDeleteToLaterSlides={handlePropagateDeleteToLaterSlides}
                    simulationModeEnabled={simulationModeEnabled}
                    onToggleSimulationMode={handleToggleSimulationMode}
                    onStartTutorial={handleStartTutorial}
                    presentationToolbar={{
                      decks: presentationDecks,
                      activeDeckId: activePresentationDeckId,
                      activeSlideId: activePresentationSlideId,
                      snapshotsCollapsed: presentationSnapshotsCollapsed,
                      onToggleSnapshotsCollapsed: () =>
                        setPresentationSnapshotsCollapsed((c) => !c),
                      onAutoZoom: handleAutoZoomPresentation,
                      onApplyZoomToCurrent: handleApplyPresentationZoomToCurrent,
                      onApplyZoomToAll: handleApplyPresentationZoomToAll,
                      onAddSnapshot: handleAddPresentationSnapshot,
                      onAddBlankSlide: handleAddBlankPresentationSlide,
                      onPreviousSlide: handlePreviousPresentationSlide,
                      onNextSlide: handleNextPresentationSlide,
                      onEnterPlayMode: handleEnterPresentationPlayMode,
                    }}
                />
                {!isLoaded ? (
                  <div className="flex items-center gap-1 border-b bg-card px-3 py-2 text-sm text-muted-foreground">
                    Loading tabs…
                  </div>
                ) : (
                  activeTabId && (
                    <TabBar
                      tabs={tabs}
                      activeTabId={activeTabId}
                      onTabSelect={switchTab}
                      onTabClose={handleTabClose}
                      onTabReorder={reorderTabs}
                    />
                  )
                )}
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".json,application/json,.mmd,.mermaid,text/plain"
                    style={{ display: 'none' }}
                />
                <input
                    type="file"
                    ref={mermaidInputRef}
                    onChange={handleMermaidFileChange}
                    accept=".mmd,.mermaid,text/plain"
                    style={{ display: 'none' }}
                />
                <input
                    type="file"
                    ref={subDiagramImportInputRef}
                    onChange={onSubDiagramFileChange}
                    accept=".json,application/json,.mmd,.mermaid,text/plain"
                    style={{ display: 'none' }}
                />
                <PresentationEditorPanel
                  decks={presentationDecks}
                  activeDeckId={activePresentationDeckId}
                  activeSlideId={activePresentationSlideId}
                  snapshotsCollapsed={presentationSnapshotsCollapsed}
                  onDeleteSlide={handleDeletePresentationSlide}
                  onMoveSlide={handleMovePresentationSlide}
                  onSelectSlide={handleSelectPresentationSlide}
                  onSelectBaseSlide={handleSelectPresentationBaseSlide}
                />
            </header>
            <div className="flex min-h-0 flex-1 flex-col">
                {activeDiagramStack.length > 0 && (
                  <DiagramBreadcrumb
                    segments={[{ diagramId: null }, ...activeDiagramStack]}
                    rootLabel={activeTab?.name || 'Main Diagram'}
                    onNavigate={handleBreadcrumbNavigate}
                    onSegmentRename={handleBreadcrumbSegmentRename}
                    isReadOnly={isReadOnly}
                  />
                )}
                <div className={`flex min-h-0 flex-1 ${(jsonPanelOpen || propertiesPanelVisible) ? 'overflow-x-auto' : ''}`}>
                  <div className={`flex-1 h-full min-h-0 min-w-0 ${(jsonPanelOpen || propertiesPanelVisible) ? 'mr-2' : ''}`}>
                <EditorCanvas
                    key={canvasRefreshKey}
                    ref={editorRef}
                    diagramData={displayDiagramData}
                    nodeAnimationStyles={layerAnimation.nodeAnimationStyles}
                    connectionAnimationStyles={layerAnimation.connectionAnimationStyles}
                    connectionKey={layerAnimation.connectionKey}
                    connectionRenderRevision={presentationConnectionRenderRevision}
                    setDiagramData={setCurrentDiagramData}
                    onItemSelect={handleItemSelect}
                    onBatchSelect={handleBatchSelect}
                    setSelectedItemIds={setSelectedItemIds}
                    setSelectedItem={setSelectedItem as any}
                    selectedItemId={selectedItem?.id}
                    selectedItem={selectedItem}
                    selectedItemIds={selectedItemIds}
                    connectorLineFocusedVertex={connectorLineFocusedVertex}
                    onConnectorLineVertexFocus={handleConnectorLineVertexFocus}
                    tryDeleteConnectorLineVertexBeforeNodeDelete={tryDeleteConnectorLineVertexBeforeNodeDelete}
                    isConnectMode={isConnectMode}
                    onNodeClickInConnectMode={handleConnect}
                    onConnect={startConnecting}
                    onDisconnect={() => {
                             // Remove all connections from selected item
                             if (selectedItem) {
                                 setCurrentDiagramData((prevData: DiagramData) => ({
                                     ...prevData,
                                     connections: prevData.connections?.filter((e: any) => e.from !== selectedItem.id && e.to !== selectedItem.id) || []
                                 }));
                                 toast({
                                     title: "Connections Disconnected",
                                     description: "All connections from the selected item have been removed.",
                                 });
                             }
                        }}
                    onConnectionDelete={disconnectConnection}
                    onConnectionWaypointMove={handleConnectionWaypointMove}
                    onConnectionUpdate={handleConnectionUpdate}
                    onConnectionWaypointAdd={handleConnectionWaypointAdd}
                    onConnectionInsertNode={handleConnectionInsertNode}
                    onConnectionContextMenu={handleConnectionContextMenu}
                    onPauseConnectionAnimationsForOverlayUi={pauseConnectionAnimationsForOverlayUi}
                    externalTransform={canvasTransform}
                     onTransformChange={setCanvasTransform}
                     onLabelUpdate={handleLabelUpdate}
                     onTagUpdate={handleTagUpdate}
                     onDraggingChange={setIsDragging}
                    onClipboardChange={setCanPaste}
                    onMousePositionChange={setMousePosition}
                    onExportComplete={() => setExportDialogOpen(false)}
                    hoverEnabled={hoverEnabled}
                    iconBackgroundEnabled={iconBackgroundEnabled}
                    defaultTextLabelsEnabled={defaultTextLabelsEnabled}
                    onSelectAll={handleSelectAll}
                    onTriggerTextStylingPanel={() => setTriggerTextStylingPanel(true)}
                    onTriggerVisualStylingPanel={() => setTriggerVisualStylingPanel(true)}
                    onTriggerLineStylingPanel={() => setTriggerLineStylingPanel(true)}
                    onTriggerConnectionSettingsPanel={() => setTriggerConnectionSettingsPanel(true)}
                    onResetConnectionSettingsTrigger={() => setTriggerConnectionSettingsPanel(false)}
                    layers={{
                      getAllLayers: layers.getAllLayers,
                      getItemLayerById: layers.getItemLayerById,
                      assignItemsToLayer: layers.assignItemsToLayer
                    }}
                    onGroupItems={handleGroupItems}
                    onUngroupItems={handleUngroupItems}
                    onRemoveFromGroup={handleRemoveFromGroup}
                    onAddToGroupItems={handleAddToGroup}
                    onMoveToBack={handleMoveToBack}
                    onMoveToFront={handleMoveToFront}
                    onMoveOneBack={handleMoveOneBack}
                    onMoveOneForward={handleMoveOneForward}
                    isReadOnly={isReadOnly}
                    alignmentGuidesEnabled={alignmentGuidesEnabled}
                    connectionsBehindNodesEnabled={connectionsBehindNodesEnabled}
                    animationConnectionsEnabled={animationConnectionsEnabled}
                    animationToggleOnClickEnabled={animationToggleOnClickEnabled}
                    animationFilterSourceIds={effectiveAnimationFilterIds}
                    animationDisabledSources={animationDisabledSources}
                    onAnimationDisabledSourcesChange={setAnimationDisabledSources}
                    onResourceActivateAtPosition={handleResourceActivateAtPosition}
                    metadataPopupsEnabled={metadataPopupsEnabled}
                    setUmlClassEditorModal={setUmlClassEditorModal}
                    setChartDataEditorModal={setChartDataEditorModal}
                    onSubDiagramDoubleClick={handleSubDiagramDoubleClick}
                    getHasLinkedSubDiagram={getHasLinkedSubDiagram}
                    onCreateSubDiagram={handleCreateSubDiagram}
                    onRemoveSubDiagramLink={handleRemoveSubDiagramLink}
                    simulationModeEnabled={simulationModeEnabled}
                    onOpenZOrderList={openZOrderList}
                    wheelZoomSuppressed={zOrderListModal.open}
                    />
                  </div>

                  {/* Properties Panel (metadata, item name/type) */}
                  {propertiesPanelVisible && (
                  <PropertiesPanel
                    selectedItem={selectedItem}
                    diagramData={currentDiagramData}
                    onItemUpdate={handleItemUpdate}
                    onConnectionUpdate={handleConnectionUpdate}
                    collapsed={rightPanelCollapsed}
                    onToggleCollapse={() => setRightPanelCollapsed((prev: boolean) => !prev)}
                    isReadOnly={isReadOnly}
                  />
                  )}
                  
                  {/* Layers Panel */}
                  {layers.layersPanelOpen && (
                    <div className="absolute top-4 right-4 z-50">
                      <LayersPanel
                        layers={layers.getAllLayers()}
                        activeLayerId={layers.layersConfig.activeLayerId}
                        disabledLayerIds={Array.from(presentationDisabledLayerIds)}
                        selectedItemsLayerIds={selectedItemIds.size > 0 ? 
                          Array.from(selectedItemIds).map(id => layers.getItemLayerById(id)) : []
                        }
                        onAddLayer={(name: string) => {
                          void name;
                          if (!isPrimaryPresentationSlideActiveInner) {
                            toast({
                              variant: 'destructive',
                              title: 'Layer Editing Disabled',
                              description: 'Layer structure is locked while editing a snapshot so deltas stay valid.',
                            });
                            return;
                          }
                          layers.addNewLayer(name);
                        }}
                        onRemoveLayer={(layerId: string) => {
                          void layerId;
                          if (!isPrimaryPresentationSlideActiveInner) {
                            toast({
                              variant: 'destructive',
                              title: 'Layer Editing Disabled',
                              description: 'Layer structure is locked while editing a snapshot so deltas stay valid.',
                            });
                            return;
                          }
                          layers.removeLayerById(layerId);
                        }}
                        onRenameLayer={(layerId: string, newName: string) => {
                          void layerId;
                          void newName;
                          if (!isPrimaryPresentationSlideActiveInner) {
                            toast({
                              variant: 'destructive',
                              title: 'Layer Editing Disabled',
                              description: 'Layer structure is locked while editing a snapshot so deltas stay valid.',
                            });
                            return;
                          }
                          layers.renameLayerById(layerId, newName);
                        }}
                        onToggleVisibility={(layerId: string) => {
                          if (presentationDisabledLayerIds.has(layerId)) {
                            toast({
                              variant: 'destructive',
                              title: 'Layer Editing Disabled',
                              description: `Layer "${layers.getLayer(layerId)?.name || layerId}" was impacted by slide edits and cannot be toggled here.`,
                            });
                            return;
                          }
                          handleToggleLayerVisibility(layerId);
                        }}
                        onSetActiveLayer={(layerId: string) => {
                          void layerId;
                          if (!isPrimaryPresentationSlideActiveInner) {
                            toast({
                              variant: 'destructive',
                              title: 'Layer Editing Disabled',
                              description: 'Layer structure is locked while editing a snapshot so deltas stay valid.',
                            });
                            return;
                          }
                          layers.setActiveLayerById(layerId);
                        }}
                        onReorderLayers={(fromIndex: number, toIndex: number) => {
                          void fromIndex;
                          void toIndex;
                          if (!isPrimaryPresentationSlideActiveInner) {
                            toast({
                              variant: 'destructive',
                              title: 'Layer Editing Disabled',
                              description: 'Layer structure is locked while editing a snapshot so deltas stay valid.',
                            });
                            return;
                          }
                          layers.reorderLayers(fromIndex, toIndex);
                        }}
                        onAssignSelectedItemsToLayer={selectedItemIds.size > 0 ? (layerId: string) => {
                          if (!isPrimaryPresentationSlideActiveInner) {
                            toast({
                              variant: 'destructive',
                              title: 'Layer Editing Disabled',
                              description: 'Layer structure is locked while editing a snapshot so deltas stay valid.',
                            });
                            return;
                          }
                          layers.assignItemsToLayer(Array.from(selectedItemIds), layerId);
                        } : undefined}
                        onClose={layers.toggleLayersPanel}
                        getLayerItemCount={(layerId: string) => {
                          const items = layers.getLayerItems(layerId);
                          return (items.nodes?.length || 0);
                        }}
                      />
                    </div>
                  )}
                  
                  {jsonPanelOpen && (
                    <div className="flex-shrink-0">
                      <JsonEditorPanel
                        value={diagramData}
                        onValidJsonChange={handleJsonValidChange}
                        isOpen={jsonPanelOpen}
                        onToggleOpen={toggleJsonPanel}
                        widthPx={jsonPanelWidth}
                        onWidthChange={setJsonPanelWidth}
                        isReadOnly={isReadOnly}
                        focusTarget={
                          selectedItem
                            ? selectedItem.itemType === 'node'
                              ? { itemType: 'node' as const, id: selectedItem.id }
                              : {
                                  itemType: 'edge' as const,
                                  id: selectedItem.id,
                                  from: selectedItem.from,
                                  to: selectedItem.to,
                                }
                            : null
                        }
                      />
                    </div>
                  )}
                </div>
            </div>
        </main>
        <ExportDialog
          open={exportDialogOpen}
          onOpenChange={setExportDialogOpen}
          initialFormat={exportDialogFormat}
          presentationSlides={exportPresentationSlidesInfo}
          onExport={handleExport}
        />
        {umlClassEditorModal.visible && umlClassEditorModal.itemId && typeof window !== 'undefined' && createPortal(
          <UmlClassEditorModal
            x={umlClassEditorModal.x}
            y={umlClassEditorModal.y}
            visible={umlClassEditorModal.visible}
            onClose={() => setUmlClassEditorModal({ visible: false, x: 0, y: 0, itemId: '' })}
            node={diagramData.nodes?.find((n: DiagramNodeData) => n.id === umlClassEditorModal.itemId) ?? null}
            onSave={(nodeId, umlClass) => {
              const dims = computeUmlClassDimensions(umlClass.name, umlClass.attributes, umlClass.methods);
              setDiagramData((prev: DiagramData) => ({
                ...prev,
                nodes: prev.nodes?.map((n: DiagramNodeData) =>
                  n.id === nodeId ? { ...n, umlClass, width: dims.width, height: dims.height } : n
                ) ?? [],
              }));
              setUmlClassEditorModal({ visible: false, x: 0, y: 0, itemId: '' });
            }}
            isReadOnly={isReadOnly}
          />,
          document.body
        )}
        {chartDataEditorModal.visible && chartDataEditorModal.itemId && typeof window !== 'undefined' && createPortal(
          <ChartDataEditorModal
            x={chartDataEditorModal.x}
            y={chartDataEditorModal.y}
            visible={chartDataEditorModal.visible}
            onClose={() => setChartDataEditorModal({ visible: false, x: 0, y: 0, itemId: '' })}
            node={diagramData.nodes?.find((n: DiagramNodeData) => n.id === chartDataEditorModal.itemId) ?? null}
            onSave={(nodeId, chart) => {
              setDiagramData((prev: DiagramData) => ({
                ...prev,
                nodes: prev.nodes?.map((n: DiagramNodeData) =>
                  n.id === nodeId ? { ...n, chart } : n
                ) ?? [],
              }));
              setChartDataEditorModal({ visible: false, x: 0, y: 0, itemId: '' });
            }}
            isReadOnly={isReadOnly}
          />,
          document.body
        )}
        {zOrderListModal.open && typeof window !== 'undefined' && createPortal(
          <ZOrderListModal
            x={zOrderListModal.x}
            y={zOrderListModal.y}
            open={zOrderListModal.open}
            onOpenChange={(o: boolean) => setZOrderListModal((s) => ({ ...s, open: o }))}
            diagramData={currentDiagramData}
            onApply={setCurrentDiagramData}
            getLayerDisplayName={getLayerDisplayNameForZOrder}
            isReadOnly={isReadOnly}
            selectedItemIds={selectedItemIds}
            onSelectCanvasItems={handleBatchSelect}
          />,
          document.body
        )}
        {connectionContextModal.connection && typeof window !== 'undefined' && createPortal(
          <ConnectionContextModal
            x={connectionContextModal.x}
            y={connectionContextModal.y}
            visible={connectionContextModal.visible}
            onClose={() => setConnectionContextModal({ visible: false, x: 0, y: 0, connection: null })}
            connection={connectionContextModal.connection}
            diagramData={diagramData}
            onConnectionUpdate={handleConnectionUpdate}
            onConnectionDisconnect={disconnectConnection}
            onConnectionWaypointAdd={handleConnectionWaypointAdd}
            onConnectionWaypointRemove={handleConnectionWaypointRemove}
            isReadOnly={isReadOnly}
          />,
          document.body
        )}
        <ScratchPad 
          isOpen={scratchPadOpen} 
          onClose={() => setScratchPadOpen(false)} 
          diagramData={diagramData}
          setDiagramData={setDiagramData}
          onCanvasRefresh={refreshCanvas}
          onHistoryUpdate={updateHistory}
        />
        <PresentationPlayer
          open={presentationPlayerOpen}
          slides={presentationPlayerSlides}
          slideDiagrams={presentationPlayerSlideDiagrams}
          currentIndex={presentationPlayerIndex}
          onOpenChange={setPresentationPlayerOpen}
          onIndexChange={setPresentationPlayerIndex}
          onApplyZoomToCurrentSlide={handleApplyPresentationZoomToCurrent}
          onApplyZoomToAllSlides={handleApplyPresentationZoomToAll}
        />
        <AlertDialog
          open={animationSelectionDialogOpen}
          onOpenChange={setAnimationSelectionDialogOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Apply animation setting</AlertDialogTitle>
              <AlertDialogDescription>
                Other selected connections are detected. Do you want to apply this animation setting to all selected connections, or only the current connection?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleAnimationApplyCurrentOnly}>Current Only</AlertDialogCancel>
              <AlertDialogAction onClick={handleAnimationApplySelectedConfirm}>Apply to Selected</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog
          open={animationOverwriteDialogOpen}
          onOpenChange={setAnimationOverwriteDialogOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Overwrite animation setting</AlertDialogTitle>
              <AlertDialogDescription>
                Some selected connections already have animation settings. These settings will be overwritten by the new setting. Continue?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleAnimationApplyCurrentOnly}>Current Only</AlertDialogCancel>
              <AlertDialogAction onClick={handleAnimationOverwriteConfirm}>Overwrite and Apply</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog
          open={animationDisableConfirmDialogOpen}
          onOpenChange={setAnimationDisableConfirmDialogOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Disable animation for selected connections</AlertDialogTitle>
              <AlertDialogDescription>
                This will disable animation for all currently selected connections. Continue?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleAnimationApplyCurrentOnly}>Current Only</AlertDialogCancel>
              <AlertDialogAction onClick={handleAnimationDisableConfirm}>Disable and Apply</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog
          open={animationCurrentOnlyDialogOpen}
          onOpenChange={setAnimationCurrentOnlyDialogOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Applied to current connection only</AlertDialogTitle>
              <AlertDialogDescription>
                Only the current connection will apply the animation setting.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => setAnimationCurrentOnlyDialogOpen(false)}>OK</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog open={closeTabDialogOpen} onOpenChange={setCloseTabDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
              <AlertDialogDescription>
                This tab has unsaved changes. Do you want to save them before closing?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                setPendingCloseTabId(null);
                setCloseTabDialogOpen(false);
              }}>Cancel</AlertDialogCancel>
              <Button variant="outline" onClick={handleCloseTabConfirm}>Don&apos;t Save</Button>
              <Button onClick={handleCloseTabSave}>Save</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DndProvider>
  );
}

export type {
  DiagramEditorInnerProps,
  ConnectionContextModalState,
  UmlOrChartModalState,
  ConnectorLineFocusedVertex,
  DiagramEditorExportOptions,
  DiagramEditorToastFn,
} from "./editor/diagram-editor-inner-props";
