"use client";
import React, { useRef, useCallback, useEffect } from 'react';
import { flushSync } from 'react-dom';
import type { EditorCanvasHandle } from './editor/editor-canvas';
import type { DiagramData, DiagramNodeData, DiagramZoneData, DiagramConnectionData, PresentationDeck, Slide, DiagramDelta, LayersConfig, UserDefinedObject } from '@/lib/types';
import { generateSequentialId } from '@/lib/id-generator';
import type { LeftSidebarMode } from '@/lib/left-sidebar-mode';
import { validateLayersConfig, ensureDiagramLayersPersisted } from '@/lib/layers-utils';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { useDiagramTabs, TUTORIAL_TAB_NAME } from '@/hooks/use-diagram-tabs';
import { useLayers } from '@/hooks/use-layers';
import { useLayerAnimation } from '@/hooks/use-layer-animation';
import { useConnectionAnimationIdlePause } from '@/hooks/use-connection-animation-idle';
import { collectAllIdsInDiagram, sanitizeImportedDiagram } from '@/lib/import-sanitize';
import { parseImportJsonText } from '@/lib/import-json-limits';
import { parseDiagramJson, parseDiagramJsonSync } from '@/lib/diagram-json-import';
import { getDiagramAtStack, updateDiagramAtStack, addSubDiagramAtStack, removeSubDiagramAtStack } from '@/lib/sub-diagram-utils';
import { sanitizeViewState } from '@/lib/view-state-utils';
import { parseMermaidFlowchart, parseMermaidClassDiagram, parseMermaidSequenceDiagram, detectMermaidDiagramType } from '@/lib/mermaid-parser';
import { mermaidToDiagramData, classDiagramToDiagramData, sequenceDiagramToDiagramData } from '@/lib/mermaid-to-diagram';
import { applyMindmapHueAnchorsAfterVisualChanges } from "@/lib/mindmap-layout";
import { themeManager, DEFAULT_THEMES } from '@/lib/theme-manager';
import { readThemeMenuHueStepDegFromStorage } from '@/lib/theme-menu-hue-step';
import { orderSelectedIdsForThemeHue } from '@/lib/selection-theme-order';
import { DiagramTheme, ThemeMenuApplyOptions } from '@/lib/theme-types';
import { TutorialProvider } from './tutorial/tutorial-provider';
import { emitDwCanvasTransform, emitDwResourceActivate, DW_REPLAY_CANVAS_TRANSFORM } from '@/lib/interaction-recording-bridge';
import { useInteractionRecordingDiagramReplay } from '@/hooks/use-interaction-recording-diagram-replay';
import {
  applyDiagramChange,
  extractDiagramItemPatch,
  recordDiagramChange,
  recordDiagramReplace,
} from '@/lib/interaction-recording-diagram';
import type { DwDiagramChangeDetail } from '@/lib/interaction-recording-bridge';
import type { InteractionRecordingCanvasTransform } from '@/lib/interaction-recording-types';
import { TutorialOverlay } from './tutorial/tutorial-overlay';
import { TooltipProvider } from '@/components/ui/tooltip';
import { 
  createGroup, 
  addToGroup,
  removeFromGroup, 
  ungroup, 
  getItemGroup,
  getGroupMembers,
  deleteDiagramItemsByIds,
} from '@/lib/grouping-utils';
import { 
  moveItemToBack,
  moveItemToFront,
  moveItemOneBack,
  moveItemOneForward,
  getItemPosition,
  getItemCount
} from '@/lib/rendering-order-utils';
import { performAutoLayout } from '@/lib/auto-layout';
import {
  generateConnectionId,
  ensureConnectionIds,
  stableDiagramConnectionId,
  connectionSelectionIdMatches,
  selectionSetContainsConnection,
} from '@/lib/connection-order-utils';
import {
  GRID_STEP,
  snapToGrid,
  snapDimensionToGrid,
  measureNodeDims,
  type PositionedNode,
} from '@/components/editor/canvas-constants';
import { DEFAULT_CONNECTION_ANIMATION, toConnectionAnimationPatch, getDownstreamAnimationChainNodes } from '@/lib/connection-animation';
import {
  applyDiagramDelta,
  computeDiagramDelta,
  listVisibleLayerIds,
  projectVisibleDiagram,
} from '@/lib/presentation-delta';
import {
  cumulativeDiagramThroughSlideIndex,
  getPresentationDeltaMode,
  migratePresentationDeckToMaster,
  rebasePresentationSlidesOnMasterEdit,
  rechainSlideDeltasFromAbsoluteDiagrams,
  resolvePresentationSlideDiagrams,
} from '@/lib/presentation-slide-chain';
import { computeUnionFitTransformForDiagrams, pruneConnectionsToVisibleNodes } from '@/lib/presentation-viewport-fit';
import { extractEmbeddedPresentations } from '@/lib/extract-embedded-presentations';
import { savePresentationsByTab } from '@/lib/presentation-storage';
import { collapsePresentationDecksToOne } from '@/lib/presentation-deck-merge';
import { createPresentationPrimarySlide } from '@/lib/presentation-primary-slide';
import {
  createPresentationSlideClipboardPayload,
  insertAbsoluteSlideIntoDeck,
  readPresentationSlideClipboard,
  resolveActiveSlideAbsoluteDiagram,
  writePresentationSlideClipboard,
} from '@/lib/presentation-slide-clipboard';
import { usePresentationSlideClipboardAvailable } from '@/hooks/use-presentation-slide-clipboard';
import type { BreadcrumbSegment } from './editor/diagram-breadcrumb';
import { removeConnectorLineVertexAtIndex, isConnectorLineGeometryClosed } from '@/lib/line-curve-path';
import {
  syncClosedConnectorLineBorderWidth,
  syncClosedConnectorVisualBorderFromLineStyling,
} from '@/lib/line-styling';
import { isConnectorLikeSpineNodeType, isMindmapNodeType, isTimelineNodeType } from '@/lib/utils';
import {
  makeTimelineEntryKey,
  parseTimelineEntryKey,
} from '@/lib/timeline-layout';
import {
  computeDistributeAlongAxisPositions,
  computeUniformSpacingPositions,
  nodeToSpacingAlignItem,
} from '@/lib/uniform-spacing-align';

import type { SelectedItem, PaletteResource, PaletteSelection } from '@/components/editor/diagram-editor-types';
export type { SelectedItem } from '@/components/editor/diagram-editor-types';
import {
  EMPTY_TAB_DIAGRAM_FALLBACK,
  collectConnectSourceIdsFromDiagram,
  getSelectionIdKind,
  connectionIdsFromSelectionSet,
  clearPendingConnectionWindowState,
  safeClone,
  blankSlideVisibleFromMaster,
  createPaletteItem,
  presentationThumbnailCaptureBackground,
  buildPresentationThumbnailCaptureOptions,
  diagramForPresentationThumbnailFingerprint,
  withPresentationThumbnailThemeFingerprintTag,
} from '@/lib/diagram-editor/editor-support';
import { useTheme } from '@/components/theme-provider';
import { DiagramEditorInner } from './diagram-editor-inner';
import { useDiagramEditorHistory } from '@/hooks/use-diagram-editor-history';
import { useDiagramEditorKeyboard } from '@/hooks/use-diagram-editor-keyboard';
import { usePresentationStorageHydration } from '@/hooks/use-presentation-storage-hydration';
import { usePresentationTabSwitchSync } from '@/hooks/use-presentation-tab-switch-sync';
import type { ParsedEditorHistorySnapshot } from '@/lib/editor-history-snapshot';
import {
  mergePresentationDeckThumbnails,
  presentationDecksStructurallyEqual,
} from '@/lib/editor-history-snapshot';
import {
  capturePresentationRestorePoint,
  type PresentationRestorePoint,
} from '@/lib/presentation-restore-point';
import { useDiagramEditorRulesScratchLayerEffects } from '@/hooks/use-diagram-editor-rules-scratch-layer-effects';
import { useToolbarTriggerAutoResets } from '@/hooks/use-toolbar-trigger-auto-reset';
import { useDiagramEditorClientBootstrap } from '@/hooks/use-diagram-editor-client-bootstrap';
import { usePresentationSlideViewportSync } from '@/hooks/use-presentation-slide-viewport-sync';
import { useDiagramEditorOptionPersistence } from '@/hooks/use-diagram-editor-option-persistence';
import { usePresentationThumbnails } from '@/hooks/use-presentation-thumbnails';
import type { PresentationThumbnailInteractionRef } from '@/hooks/use-presentation-thumbnails';
import { createDiagramSaveHandler } from '@/lib/diagram-editor/diagram-editor-save-handler';
import {
  buildEditDiagramFromUserDefinedObject,
  createUserDefinedObjectFromGroup,
  getUserDefinedObjectDragItem,
  loadUserDefinedObjectsLibrary,
  mergeDiagramObjectsIntoLibrary,
  findNewUserDefinedObjectsForLibrary,
  collectUserDefinedObjectsFromDiagramTree,
  resolveGroupForUserDefinedCreation,
  saveUserDefinedObjectsLibrary,
  saveUserDefinedObjectsLibraryImmediate,
  updateUserDefinedObjectFromEditDiagram,
  propagateUserDefinedObjectToDiagram,
  attachUserDefinedObjectToDiagram,
  removeUserDefinedObjectFromDiagram,
} from '@/lib/user-defined-objects';
import { createDiagramExportHandlers } from '@/lib/diagram-editor/diagram-editor-export-handlers';
import type { DiagramEditorToastFn } from '@/components/editor/diagram-editor-inner-props';

/** Align / layout steps often patch only `x,y`; spine nodes must translate stored vertices too (same idea as canvas move). */
function positionNodeWithSpineTranslate(
  node: DiagramNodeData,
  newX: number,
  newY: number,
): DiagramNodeData {
  const prevX = node.x ?? 0;
  const prevY = node.y ?? 0;
  const dx = newX - prevX;
  const dy = newY - prevY;
  if (!isConnectorLikeSpineNodeType(node.type) || (dx === 0 && dy === 0)) {
    return { ...node, x: newX, y: newY };
  }
  const currentStartPos =
    (node as DiagramNodeData & { startPos?: { x: number; y: number } }).startPos || {
      x: prevX,
      y: prevY,
    };
  const currentEndPos =
    (node as DiagramNodeData & { endPos?: { x: number; y: number } }).endPos || {
      x: prevX + 150,
      y: prevY,
    };
  const ctrls = (node as DiagramNodeData & { lineControlPoints?: { x: number; y: number }[] })
    .lineControlPoints;
  return {
    ...node,
    x: newX,
    y: newY,
    startPos: { x: currentStartPos.x + dx, y: currentStartPos.y + dy },
    endPos: { x: currentEndPos.x + dx, y: currentEndPos.y + dy },
    ...(ctrls?.length
      ? {
          lineControlPoints: ctrls.map((c) => ({
            ...c,
            x: c.x + dx,
            y: c.y + dy,
          })),
        }
      : {}),
  };
}

function getFilenameStem(filename: string) {
  return filename.replace(/\.[^.]+$/, '') || filename;
}

/**
 * Placement owned by the canvas (drag, guides, spine vertices). Toolbar patches use `{ ...selectedItem, … }`;
 * selection can lag `diagramData` briefly after a move — never apply these keys from `handleItemUpdate`.
 */
const DIAGRAM_GEOMETRY_KEYS_FROM_SELECTED_MERGE = new Set<string>([
  'x',
  'y',
  'startPos',
  'endPos',
  'lineControlPoints',
]);

export default function DiagramEditor() {
  const [isClient, setIsClient] = React.useState<boolean>(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { resolvedTheme } = useTheme();
  const editorRef = React.useRef<EditorCanvasHandle>(null);
  const [exportDialogOpen, setExportDialogOpen] = React.useState(false);
  const [exportDialogFormat, setExportDialogFormat] = React.useState<'png' | 'gif'>('png');
  const [closeTabDialogOpen, setCloseTabDialogOpen] = React.useState(false);
  const [pendingCloseTabId, setPendingCloseTabId] = React.useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = React.useState<boolean>(false);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = React.useState<boolean>(false);
  const [leftSidebarMode, setLeftSidebarMode] = React.useState<LeftSidebarMode>("enabled");
  // Use fixed defaults for SSR/hydration; restore from localStorage in useEffect
  const [rightPanelCollapsed, setRightPanelCollapsed] = React.useState<boolean>(true);
  const [metadataPopupsEnabled, setMetadataPopupsEnabled] = React.useState<boolean>(true);
  const [propertiesPanelVisible, setPropertiesPanelVisible] = React.useState<boolean>(true);
  const [scratchPadOpen, setScratchPadOpen] = React.useState<boolean>(false);
  const [userDefinedObjectsLibrary, setUserDefinedObjectsLibrary] = React.useState<
    Record<string, UserDefinedObject>
  >(() => (typeof window !== 'undefined' ? loadUserDefinedObjectsLibrary() : {}));
  const [createUserDefinedObjectDialogOpen, setCreateUserDefinedObjectDialogOpen] =
    React.useState(false);
  const [manageUserDefinedObjectsDialogOpen, setManageUserDefinedObjectsDialogOpen] =
    React.useState(false);
  const [layerAnimationsEnabled, setLayerAnimationsEnabled] = React.useState<boolean>(true);
  const [rulesEditorOpen, setRulesEditorOpen] = React.useState<boolean>(false);
  const [rules, setRules] = React.useState<import('@/lib/rules-types').DiagramRule[]>([]);
  const [simulationModeEnabled, setSimulationModeEnabled] = React.useState<boolean>(false);
  const [presentationDecks, setPresentationDecks] = React.useState<PresentationDeck[]>([]);
  const presentationDecksRef = React.useRef(presentationDecks);
  presentationDecksRef.current = presentationDecks;
  const [activePresentationDeckId, setActivePresentationDeckId] = React.useState<string | null>(null);
  const [activePresentationSlideId, setActivePresentationSlideId] = React.useState<string | null>(null);
  const activePresentationDeck = React.useMemo(
    () =>
      activePresentationDeckId
        ? presentationDecks.find((d) => d.id === activePresentationDeckId) ?? null
        : null,
    [presentationDecks, activePresentationDeckId],
  );
  const activePresentationPrimarySlideId = activePresentationDeck?.slides[0]?.id ?? null;
  const isPrimaryPresentationSlideActive = Boolean(
    activePresentationPrimarySlideId && activePresentationSlideId === activePresentationPrimarySlideId,
  );
  const canPastePresentationSlide = usePresentationSlideClipboardAvailable();
  const [selectedPresentationSlideIds, setSelectedPresentationSlideIds] = React.useState<Set<string>>(new Set());
  const [presentationPlayerOpen, setPresentationPlayerOpen] = React.useState<boolean>(false);
  const [presentationPlayerIndex, setPresentationPlayerIndex] = React.useState<number>(0);
  /** Remount `PresentationPlayer` on each open so slide-transition state does not compare to the last fullscreen session. */
  const [presentationPlayerSessionKey, setPresentationPlayerSessionKey] = React.useState(0);
  const [presentationMasterDiagram, setPresentationMasterDiagram] = React.useState<DiagramData | null>(null);
  const [presentationDraftDiagram, setPresentationDraftDiagram] = React.useState<DiagramData | null>(null);
  /** `${deckId}:${slideId}` → JSON fingerprint of diagram delta vs master — thumbnail matches this until the slide is edited. */
  const presentationThumbDeltaFingerprintBySlideRef = React.useRef<Record<string, string>>({});
  /** `${tabId}:${deckId}:${slideId}` — last canvas re-sync from tab + slide delta (refresh / deck load). */
  const presentationSlideCanvasKeyRef = React.useRef<string | null>(null);
  /** Last `${tabId}:${JSON.stringify(tabDiagram)}` applied in base-slide → master sync (avoids setState on reference-only churn). */
  const presentationMasterFromTabSyncKeyRef = React.useRef<string | null>(null);
  /** Last `${deckId}:${slideId}` for which thumbnail fingerprint baseline was set (layout + hydration). */
  const presentationThumbFingerprintSlideKeyRef = React.useRef<string | null>(null);
  /** Skip persisting slide delta while temporarily switching slides for multi-slide PNG export. */
  const presentationPersistSuppressedForExportRef = React.useRef(false);
  const canvasTransformRef = React.useRef<{ x: number; y: number; k: number }>({ x: 0, y: 0, k: 1 });
  /** Tracks last slide we applied viewport for — avoids re-applying on every deck update; used when switching slides. */
  const prevPresentationSlideIdForViewportRef = React.useRef<string | null>(null);
  const presentationStateByTabRef = React.useRef<Record<string, {
    decks: PresentationDeck[];
    activeDeckId: string | null;
    activeSlideId: string | null;
    selectedSlideIds: string[];
    masterDiagram: DiagramData | null;
    draftDiagram: DiagramData | null;
  }>>({});
  const presentationPersistTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Last serialized tab diagram on base slide — used to rebase snapshot deltas when the base diagram edits. */
  const presentationPrevBaseJsonRef = React.useRef<string | null>(null);
  const lastRestoredStackRef = React.useRef<string | null>(null);
  const [presentationStorageHydrated, setPresentationStorageHydrated] = React.useState(false);

  useDiagramEditorRulesScratchLayerEffects({
    rules,
    setRules,
    scratchPadOpen,
    setScratchPadOpen,
    layerAnimationsEnabled,
    setLayerAnimationsEnabled,
  });

  const [jsonPanelWidth, setJsonPanelWidth] = React.useState<number>(420);
  const [isDragging, setIsDragging] = React.useState<boolean>(false);
  /** Bar/line/pie value drag updates diagramData continuously; defer undo/redo snapshots until pointer-up. */
  const [chartValueDragActive, setChartValueDragActive] = React.useState(false);
  /** Resize / rotation on canvas (EditorCanvas session counter); combined with drag for thumbnail deferral. */
  const [canvasGeometrySessionActive, setCanvasGeometrySessionActive] = React.useState(false);
  const presentationThumbnailInteractionRef =
    React.useRef<PresentationThumbnailInteractionRef | null>(null);
  const canvasGeometryInteractionActive =
    isDragging || chartValueDragActive || canvasGeometrySessionActive;

  const pausePresentationThumbnailsForCanvasInteraction = React.useCallback(() => {
    presentationThumbnailInteractionRef.current?.pauseForCanvasInteraction();
  }, []);

  const handleCanvasGeometrySessionChange = React.useCallback(
    (active: boolean) => {
      if (active) pausePresentationThumbnailsForCanvasInteraction();
      setCanvasGeometrySessionActive(active);
    },
    [pausePresentationThumbnailsForCanvasInteraction],
  );

  const handleCanvasDraggingChange = React.useCallback(
    (dragging: boolean) => {
      if (dragging) pausePresentationThumbnailsForCanvasInteraction();
      setIsDragging(dragging);
    },
    [pausePresentationThumbnailsForCanvasInteraction],
  );

  const handleChartValueDragSessionChange = React.useCallback(
    (active: boolean) => {
      if (active) pausePresentationThumbnailsForCanvasInteraction();
      setChartValueDragActive(active);
    },
    [pausePresentationThumbnailsForCanvasInteraction],
  );
  const [canPaste, setCanPaste] = React.useState<boolean>(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const mermaidInputRef = React.useRef<HTMLInputElement>(null);
  const subDiagramImportInputRef = React.useRef<HTMLInputElement>(null);
  const [hoverEnabled, setHoverEnabled] = React.useState<boolean>(false);
  const [iconBackgroundEnabled, setIconBackgroundEnabled] = React.useState<boolean>(true);
  const [defaultTextLabelsEnabled, setDefaultTextLabelsEnabled] = React.useState<boolean>(true);
  const [alignmentGuidesEnabled, setAlignmentGuidesEnabled] = React.useState<boolean>(true);
  const [dotGridEnabled, setDotGridEnabled] = React.useState<boolean>(true);
  const [rulerGuidesEnabled, setRulerGuidesEnabled] = React.useState<boolean>(true);
  const [simplifyFillsDuringCanvasDragEnabled, setSimplifyFillsDuringCanvasDragEnabled] =
    React.useState<boolean>(true);
  const [
    suppressShadowsOnAllObjectsDuringCanvasDragEnabled,
    setSuppressShadowsOnAllObjectsDuringCanvasDragEnabled,
  ] = React.useState<boolean>(true);
  const [presentationThumbnailUpdatesEnabled, setPresentationThumbnailUpdatesEnabled] =
    React.useState<boolean>(true);
  const [presentationThumbnailGenerating, setPresentationThumbnailGenerating] =
    React.useState<boolean>(false);
  const [connectionsBehindNodesEnabled, setConnectionsBehindNodesEnabled] = React.useState<boolean>(false);
  const [animationConnectionsUserEnabled, setAnimationConnectionsUserEnabled] = React.useState<boolean>(true);
  const [animationConnectionsMenuPaused, setAnimationConnectionsMenuPaused] = React.useState(false);
  const {
    idlePaused: animationConnectionsIdlePaused,
    onCanvasActivity: onConnectionAnimationCanvasActivityFromHook,
  } = useConnectionAnimationIdlePause(animationConnectionsUserEnabled);
  const onConnectionAnimationCanvasActivity = React.useCallback(() => {
    setAnimationConnectionsMenuPaused(false);
    onConnectionAnimationCanvasActivityFromHook();
  }, [onConnectionAnimationCanvasActivityFromHook]);
  const animationConnectionsEnabled =
    animationConnectionsUserEnabled &&
    !animationConnectionsIdlePaused &&
    !animationConnectionsMenuPaused;

  React.useEffect(() => {
    if (!animationConnectionsUserEnabled) {
      setAnimationConnectionsMenuPaused(false);
    }
  }, [animationConnectionsUserEnabled]);

  const pauseConnectionAnimationsForOverlayUi = React.useCallback(() => {
    if (animationConnectionsUserEnabled) {
      setAnimationConnectionsMenuPaused(true);
    }
  }, [animationConnectionsUserEnabled]);

  const [animationToggleOnClickEnabled, setAnimationToggleOnClickEnabled] = React.useState<boolean>(false);
  const [animationDisabledSources, setAnimationDisabledSources] = React.useState<Set<string>>(new Set());
  const [isReadOnly, setIsReadOnly] = React.useState<boolean>(false);
  const [triggerTextStylingPanel, setTriggerTextStylingPanel] = React.useState<boolean>(false);
  const [triggerVisualStylingPanel, setTriggerVisualStylingPanel] = React.useState<boolean>(false);
  const [triggerLineStylingPanel, setTriggerLineStylingPanel] = React.useState<boolean>(false);
  const [triggerConnectionSettingsPanel, setTriggerConnectionSettingsPanel] = React.useState<boolean>(false);
  const [connectionContextModal, setConnectionContextModal] = React.useState<{
    visible: boolean;
    x: number;
    y: number;
    connection: import('@/lib/types').DiagramConnectionData | null;
  }>({ visible: false, x: 0, y: 0, connection: null });
  const [umlClassEditorModal, setUmlClassEditorModal] = React.useState<{
    visible: boolean;
    x: number;
    y: number;
    itemId: string;
  }>({ visible: false, x: 0, y: 0, itemId: '' });
  const [chartDataEditorModal, setChartDataEditorModal] = React.useState<{
    visible: boolean;
    x: number;
    y: number;
    itemId: string;
  }>({ visible: false, x: 0, y: 0, itemId: '' });
  const [timelineBarEditorModal, setTimelineBarEditorModal] = React.useState<{
    visible: boolean;
    x: number;
    y: number;
    itemId: string;
  }>({ visible: false, x: 0, y: 0, itemId: '' });
  const [pyramidEditorModal, setPyramidEditorModal] = React.useState<{
    visible: boolean;
    x: number;
    y: number;
    itemId: string;
  }>({ visible: false, x: 0, y: 0, itemId: '' });
  const [lastRightClickItemId, setLastRightClickItemId] = React.useState<string | null>(null);
  const [selectedResource, setSelectedResource] = React.useState<PaletteSelection | null>(null);
  const [paletteClipboardItem, setPaletteClipboardItem] = React.useState<any | null>(null);
  const [animationSelectionDialogOpen, setAnimationSelectionDialogOpen] = React.useState(false);
  const [animationOverwriteDialogOpen, setAnimationOverwriteDialogOpen] = React.useState(false);
  const [animationDisableConfirmDialogOpen, setAnimationDisableConfirmDialogOpen] = React.useState(false);
  const [animationCurrentOnlyDialogOpen, setAnimationCurrentOnlyDialogOpen] = React.useState(false);
  const [pendingAnimationUpdate, setPendingAnimationUpdate] = React.useState<{
    from: string;
    to: string;
    connectionId?: string;
    mode: 'enable' | 'disable';
    updates: {
      text?: string;
      color?: string;
      textPosition?: number;
      lineWidth?: number;
      shadow?: boolean;
      style?: 'bezier' | 'orthogonal';
      smoothCorners?: boolean;
      curvature?: number;
      fromPreferredExit?: 'top' | 'bottom' | 'left' | 'right' | 'center';
      fromArrow?: boolean;
      toPreferredEntry?: 'top' | 'bottom' | 'left' | 'right' | 'center';
      toArrow?: boolean;
      arrow?: boolean;
      waypoints?: Array<{ x: number; y: number; id?: string }>;
      metaData?: Record<string, string>;
      animation?: DiagramConnectionData['animation'];
    };
    selectedConnectionIds: string[];
    /** When set, animation dialog applies full `updates` to every listed connection (stable ids). */
    applyAllConnectionIds?: string[];
  } | null>(null);

  const setMousePositionForIdle = React.useCallback(
    (pos: { x: number; y: number } | null) => {
      if (pos !== null) {
        onConnectionAnimationCanvasActivity();
      }
    },
    [onConnectionAnimationCanvasActivity],
  );

  useToolbarTriggerAutoResets(
    triggerTextStylingPanel,
    setTriggerTextStylingPanel,
    triggerVisualStylingPanel,
    setTriggerVisualStylingPanel,
    triggerLineStylingPanel,
    setTriggerLineStylingPanel,
    triggerConnectionSettingsPanel,
    setTriggerConnectionSettingsPanel,
  );

  // Tab management
  const {
    tabs,
    activeTabId,
    isLoaded,
    activeTab,
    createTab,
    ensureTutorialTab,
    switchTab,
    closeTab,
    updateActiveTab,
    updateTab,
    getTab,
    reorderTabs,
    markTabAsSaved,
    getHistoryRef,
    setHistoryRef,
  } = useDiagramTabs({
    isClient,
    onToast: toast,
  });

  usePresentationStorageHydration({
    isLoaded,
    presentationStorageHydrated,
    setPresentationStorageHydrated,
    activeTabId,
    presentationStateByTabRef,
    setPresentationDecks,
    setActivePresentationDeckId,
    setActivePresentationSlideId,
  });

  React.useEffect(() => {
    const liveTabIds = new Set(tabs.map((tab) => tab.id));
    for (const tabId of Object.keys(presentationStateByTabRef.current)) {
      if (!liveTabIds.has(tabId)) {
        delete presentationStateByTabRef.current[tabId];
      }
    }
  }, [tabs]);

  // Sync active tab state to local state for component use
  const tabDiagramData = activeTab?.diagramData ?? EMPTY_TAB_DIAGRAM_FALLBACK;
  const diagramData = isPrimaryPresentationSlideActive
    ? tabDiagramData
    : (presentationDraftDiagram ?? tabDiagramData);

  const presentationDraftDiagramRef = React.useRef(presentationDraftDiagram);
  presentationDraftDiagramRef.current = presentationDraftDiagram;
  const presentationMasterDiagramRef = React.useRef(presentationMasterDiagram);
  presentationMasterDiagramRef.current = presentationMasterDiagram;
  const tabDiagramDataRef = React.useRef(tabDiagramData);
  tabDiagramDataRef.current = tabDiagramData;
  const diagramDataRef = React.useRef(diagramData);
  diagramDataRef.current = diagramData;

  const presentationLayersSyncFingerprint = React.useMemo(
    () => (tabDiagramData.layers ? JSON.stringify(tabDiagramData.layers) : ''),
    [tabDiagramData.layers],
  );

  /** Snapshot slides derive from deltas; stale `layers` in resolved JSON must match tab (global toggles sync all slides). */
  React.useEffect(() => {
    if (isPrimaryPresentationSlideActive) return;
    setPresentationDraftDiagram((prev) => {
      if (!prev) return prev;
      const canonical = tabDiagramDataRef.current?.layers;
      if (!canonical || !validateLayersConfig(canonical)) return prev;
      const prevFp = prev.layers ? JSON.stringify(prev.layers) : '';
      if (prevFp === presentationLayersSyncFingerprint) return prev;
      return { ...prev, layers: canonical };
    });
  }, [
    isPrimaryPresentationSlideActive,
    presentationDraftDiagram,
    presentationLayersSyncFingerprint,
    activePresentationSlideId,
  ]);

  React.useEffect(() => {
    if (!presentationStorageHydrated || !activeTabId) return;
    if (!presentationMasterDiagram) return;
    const masterBase = presentationMasterDiagram;
    setPresentationDecks((prev) => {
      let changed = false;
      const next = prev.map((d) => {
        if (d.presentationDeltaMode !== 'chain') return d;
        changed = true;
        return migratePresentationDeckToMaster(d, masterBase);
      });
      return changed ? next : prev;
    });
  }, [presentationStorageHydrated, activeTabId, presentationMasterDiagram]);

  /**
   * IndexedDB restores decks/slide selection, but not presentation master/draft. On hard refresh the active-tab
   * effect can also clear state before per-tab storage hydrates. Rebuild master + draft from the tab diagram
   * and the active slide’s delta once storage is ready (same as choosing a slide in the panel).
   */
  React.useEffect(() => {
    if (!presentationStorageHydrated || !activeTabId) return;
    if (!activePresentationDeckId || !activePresentationSlideId) return;

    const deck = presentationDecks.find((d) => d.id === activePresentationDeckId);
    const slide = deck?.slides.find((s) => s.id === activePresentationSlideId);
    if (!deck || !slide) return;

    const key = `${activeTabId}:${activePresentationDeckId}:${activePresentationSlideId}`;
    const masterMissing = !presentationMasterDiagramRef.current;
    const slideContextChanged = presentationSlideCanvasKeyRef.current !== key;
    if (!masterMissing && !slideContextChanged) return;

    presentationSlideCanvasKeyRef.current = key;

    const tabSnapshot = safeClone(tabDiagramDataRef.current);
    if (masterMissing) {
      setPresentationMasterDiagram(tabSnapshot);
    }

    if (deck.slides[0]?.id === activePresentationSlideId) {
      setPresentationDraftDiagram(null);
      return;
    }

    const masterRaw = masterMissing ? tabSnapshot : (presentationMasterDiagramRef.current ?? tabSnapshot);
    const mode = getPresentationDeltaMode(deck);
    const slideIdx = deck.slides.findIndex((s) => s.id === activePresentationSlideId);
    const nextDraft =
      mode === 'master' || slideIdx <= 0
        ? applyDiagramDelta(masterRaw, slide.diagramDelta)
        : applyDiagramDelta(
            cumulativeDiagramThroughSlideIndex(masterRaw, deck.slides, slideIdx - 1),
            slide.diagramDelta,
          );
    try {
      const baseForFp =
        mode === 'master' || slideIdx <= 0
          ? masterRaw
          : cumulativeDiagramThroughSlideIndex(masterRaw, deck.slides, slideIdx - 1);
      const fpCore = JSON.stringify(
        computeDiagramDelta(
          diagramForPresentationThumbnailFingerprint(baseForFp),
          diagramForPresentationThumbnailFingerprint(nextDraft),
        ),
      );
      presentationThumbDeltaFingerprintBySlideRef.current[`${activePresentationDeckId}:${activePresentationSlideId}`] =
        withPresentationThumbnailThemeFingerprintTag(fpCore, resolvedTheme);
      presentationThumbFingerprintSlideKeyRef.current =
        `${activePresentationDeckId}:${activePresentationSlideId}|thumb:${resolvedTheme}`;
    } catch {
      // ignore
    }
    setPresentationDraftDiagram(nextDraft);
  }, [
    presentationStorageHydrated,
    activeTabId,
    activePresentationDeckId,
    activePresentationSlideId,
    presentationDecks,
    resolvedTheme,
  ]);

  const selectedItem = activeTab?.selectedItem || null;
  const selectedItemIds = activeTab?.selectedItemIds || new Set();
  const selectedItemIdsRef = React.useRef(selectedItemIds);
  selectedItemIdsRef.current = selectedItemIds;
  const isConnectMode = activeTab?.isConnectMode || false;
  const jsonPanelOpen = activeTab?.jsonPanelOpen || false;
  const sanitizeCanvasTransform = React.useCallback((transform?: { x: number; y: number; k: number } | null) => {
    const safeX = typeof transform?.x === 'number' && Number.isFinite(transform.x) ? transform.x : 0;
    const safeY = typeof transform?.y === 'number' && Number.isFinite(transform.y) ? transform.y : 0;
    const safeKRaw = typeof transform?.k === 'number' && Number.isFinite(transform.k) ? transform.k : 1;
    const safeK = Math.max(0.1, Math.min(2.5, safeKRaw));
    return { x: safeX, y: safeY, k: safeK };
  }, []);

  const canvasTransform = sanitizeCanvasTransform(activeTab?.canvasTransform);
  React.useEffect(() => {
    canvasTransformRef.current = canvasTransform;
  }, [canvasTransform]);
  const activePresentationSlides = activePresentationDeck?.slides ?? [];
  const activePresentationSlideDiagrams = React.useMemo(() => {
    const masterFull = presentationMasterDiagram ?? tabDiagramData;
    const mode = activePresentationDeck ? getPresentationDeltaMode(activePresentationDeck) : 'master';
    return resolvePresentationSlideDiagrams(masterFull, activePresentationSlides, mode);
  }, [
    activePresentationSlides,
    presentationMasterDiagram,
    tabDiagramData,
    activePresentationDeck?.presentationDeltaMode,
    activePresentationDeck?.id,
  ]);

  /** Union-fit for thumbnails: active slide uses live draft so bounds match the canvas while editing. */
  const activePresentationSlideDiagramsForThumbnailCapture = React.useMemo(() => {
    const masterFull = presentationMasterDiagram ?? tabDiagramData;
    const mode = activePresentationDeck ? getPresentationDeltaMode(activePresentationDeck) : 'master';
    const baseResolved = resolvePresentationSlideDiagrams(masterFull, activePresentationSlides, mode);
    return activePresentationSlides.map((slide, slideIndex) => {
      if (
        activePresentationSlideId &&
        slide.id === activePresentationSlideId &&
        presentationDraftDiagram
      ) {
        return projectVisibleDiagram(presentationDraftDiagram);
      }
      return baseResolved[slideIndex];
    });
  }, [
    activePresentationSlides,
    presentationMasterDiagram,
    tabDiagramData,
    activePresentationSlideId,
    presentationDraftDiagram,
    activePresentationDeck?.presentationDeltaMode,
    activePresentationDeck?.id,
  ]);

  /** One diagram: current slide only — fit/zoom for PNG strip uses this slide's bounds, not a deck-wide union. */
  const presentationThumbnailFitUnionDiagrams = React.useMemo(() => {
    if (!activePresentationSlideId || activePresentationSlides.length === 0) {
      return [projectVisibleDiagram(presentationDraftDiagram ?? tabDiagramData)];
    }
    const idx = activePresentationSlides.findIndex((s) => s.id === activePresentationSlideId);
    if (idx < 0) {
      return [projectVisibleDiagram(presentationDraftDiagram ?? tabDiagramData)];
    }
    const d = activePresentationSlideDiagramsForThumbnailCapture[idx];
    return [projectVisibleDiagram(d ?? presentationDraftDiagram ?? tabDiagramData)];
  }, [
    activePresentationSlideId,
    activePresentationSlides,
    activePresentationSlideDiagramsForThumbnailCapture,
    presentationDraftDiagram,
    tabDiagramData,
  ]);

  /** Deck + slide ids only (stable while editing deltas) — used to re-run placeholder thumbnail backfill after file load. */
  const presentationDeckIdentityKey = React.useMemo(
    () =>
      presentationDecks
        .map((d) => `${d.id}:${d.slides.map((s) => s.id).join(',')}`)
        .join('||'),
    [presentationDecks],
  );

  React.useEffect(() => {
    if (!isPrimaryPresentationSlideActive) return;
    if (!activePresentationDeckId || activePresentationSlides.length === 0) {
      presentationPrevBaseJsonRef.current = JSON.stringify(
        diagramForPresentationThumbnailFingerprint(tabDiagramData),
      );
      return;
    }
    const nextJson = JSON.stringify(
      diagramForPresentationThumbnailFingerprint(tabDiagramData),
    );
    const prevJson = presentationPrevBaseJsonRef.current;
    if (prevJson !== null && prevJson !== nextJson) {
      try {
        const oldMaster = JSON.parse(prevJson) as DiagramData;
        const newMaster = diagramForPresentationThumbnailFingerprint(tabDiagramData);
        setPresentationDecks((prev) =>
          prev.map((deck) => {
            if (deck.id !== activePresentationDeckId) return deck;
            const mode = getPresentationDeltaMode(deck);
            return {
              ...deck,
              slides: rebasePresentationSlidesOnMasterEdit(oldMaster, newMaster, deck.slides, mode),
              updatedAt: Date.now(),
            };
          }),
        );
      } catch {
        /* ignore */
      }
    }
    presentationPrevBaseJsonRef.current = nextJson;
  }, [
    tabDiagramData,
    isPrimaryPresentationSlideActive,
    activePresentationDeckId,
    activePresentationSlides.length,
  ]);

  React.useEffect(() => {
    if (!isPrimaryPresentationSlideActive) return;
    let serialized: string;
    try {
      serialized = JSON.stringify(tabDiagramData);
    } catch {
      return;
    }
    const syncKey = `${activeTabId ?? ''}:${serialized}`;
    if (presentationMasterFromTabSyncKeyRef.current === syncKey) return;
    presentationMasterFromTabSyncKeyRef.current = syncKey;
    setPresentationMasterDiagram(safeClone(tabDiagramData));
  }, [isPrimaryPresentationSlideActive, activeTabId, tabDiagramData]);

  React.useEffect(() => {
    if (!isLoaded || !presentationStorageHydrated || !activeTabId) return;
    if (presentationDecks.length > 0 && activePresentationDeckId) return;
    const now = Date.now();
    const id = `deck-tab-${activeTabId}`;
    const primary = createPresentationPrimarySlide(id, { createdAt: now });
    const deck: PresentationDeck = {
      id,
      name: '',
      slides: [primary],
      presentationDeltaMode: 'master',
      createdAt: now,
      updatedAt: now,
    };
    setPresentationDecks([deck]);
    setActivePresentationDeckId(id);
    setActivePresentationSlideId(primary.id);
    setPresentationDraftDiagram(null);
  }, [isLoaded, presentationStorageHydrated, activeTabId, presentationDecks.length, activePresentationDeckId]);

  /** After load, coerce legacy null active slide to primary. */
  React.useEffect(() => {
    if (!activePresentationDeckId) return;
    const deck = presentationDecks.find((d) => d.id === activePresentationDeckId);
    const pid = deck?.slides[0]?.id;
    if (!pid || activePresentationSlideId !== null) return;
    setActivePresentationSlideId(pid);
  }, [activePresentationDeckId, presentationDecks, activePresentationSlideId]);

  const presentationPlayerSlides = React.useMemo(() => activePresentationSlides, [activePresentationSlides]);
  const presentationPlayerSlideDiagrams = React.useMemo(() => {
    const masterFull = presentationMasterDiagram ?? tabDiagramData;
    const mode = activePresentationDeck ? getPresentationDeltaMode(activePresentationDeck) : 'master';
    return resolvePresentationSlideDiagrams(masterFull, activePresentationSlides, mode);
  }, [
    activePresentationSlides,
    presentationMasterDiagram,
    tabDiagramData,
    activePresentationDeck?.presentationDeltaMode,
    activePresentationDeck?.id,
  ]);

  // Refresh key to force canvas re-render
  const [canvasRefreshKey, setCanvasRefreshKey] = React.useState(0);

  /** Line shape: vertex handle click (no drag) — Delete removes this point instead of the whole node */
  const [connectorLineFocusedVertex, setConnectorLineFocusedVertex] = React.useState<{
    nodeId: string;
    vertexIndex: number;
  } | null>(null);

  /** Ordered unique timeline card keys (`nodeId\u001fentryId`) — last is primary for panels / context. */
  const [timelineEntrySelectionKeys, setTimelineEntrySelectionKeys] = React.useState<string[]>([]);

  const timelineEntrySelection = React.useMemo(
    () => new Set(timelineEntrySelectionKeys),
    [timelineEntrySelectionKeys],
  );

  const timelineActiveEntryId = React.useMemo(() => {
    if (timelineEntrySelectionKeys.length === 0) return null;
    const last = timelineEntrySelectionKeys[timelineEntrySelectionKeys.length - 1];
    const p = last ? parseTimelineEntryKey(last) : null;
    return p?.entryId ?? null;
  }, [timelineEntrySelectionKeys]);

  const handleTimelineEntrySelect = React.useCallback(
    (nodeId: string, entryId: string | null, additive?: boolean) => {
      if (entryId === null) {
        setTimelineEntrySelectionKeys((prev) => prev.filter((k) => parseTimelineEntryKey(k)?.nodeId !== nodeId));
        return;
      }
      const key = makeTimelineEntryKey(nodeId, entryId);
      setTimelineEntrySelectionKeys((prev) => {
        if (additive) {
          const has = prev.includes(key);
          if (has) return prev.filter((x) => x !== key);
          return [...prev, key];
        }
        return [key];
      });
    },
    [],
  );

  const handleTimelineCardRemoved = React.useCallback((nodeId: string, removedEntryId: string) => {
    setTimelineEntrySelectionKeys((prev) =>
      prev.filter((k) => {
        const p = parseTimelineEntryKey(k);
        return !(p?.nodeId === nodeId && p?.entryId === removedEntryId);
      }),
    );
  }, []);

  /** Selected card sub-element (node id + element id) for per-region styling. */
  const [cardElementSelection, setCardElementSelection] = React.useState<{
    nodeId: string;
    elementId: string;
  } | null>(null);

  const handleCardElementSelect = React.useCallback((nodeId: string, elementId: string | null) => {
    if (elementId === null) {
      setCardElementSelection((prev) => (prev?.nodeId === nodeId ? null : prev));
      return;
    }
    setCardElementSelection({ nodeId, elementId });
  }, []);

  React.useEffect(() => {
    if (!selectedItem || selectedItem.itemType === "edge") {
      setCardElementSelection(null);
      return;
    }
    setCardElementSelection((prev) => (prev?.nodeId === selectedItem.id ? prev : null));
  }, [selectedItem?.id, selectedItem?.itemType]);

  React.useEffect(() => {
    setTimelineEntrySelectionKeys((prev) => {
      const next = prev.filter((k) => {
        const p = parseTimelineEntryKey(k);
        return p && selectedItemIds.has(p.nodeId);
      });
      return next.length === prev.length && next.every((k, i) => k === prev[i]) ? prev : next;
    });
  }, [selectedItemIds]);

  React.useEffect(() => {
    setConnectorLineFocusedVertex(null);
    setTimelineEntrySelectionKeys([]);
  }, [activeTabId]);

  // Sub-diagram navigation stack: empty = root; non-empty = viewing sub-diagram
  const [activeDiagramStack, setActiveDiagramStack] = React.useState<BreadcrumbSegment[]>([]);
  
  const refreshCanvas = React.useCallback(() => {
    setCanvasRefreshKey(prev => prev + 1);
  }, []);



  // Helper functions to update active tab
  const setDiagramData = React.useCallback((updater: DiagramData | ((prev: DiagramData) => DiagramData)) => {
    if (!activeTabId) return;
    const newData = typeof updater === 'function' ? updater(diagramDataRef.current) : updater;
    const connections = newData.connections || [];
    const needsIds = connections.some((c: DiagramConnectionData) => !(c as DiagramConnectionData).id);
    const ensuredConnections = needsIds ? ensureConnectionIds(connections) : connections;
    const nextData = { ...newData, connections: ensuredConnections };
    diagramDataRef.current = nextData;

    if (
      activePresentationPrimarySlideId &&
      activePresentationSlideId &&
      activePresentationSlideId !== activePresentationPrimarySlideId
    ) {
      setPresentationDraftDiagram(nextData);
      updateActiveTab({ hasUnsavedPresentations: true });
      return;
    }

    updateActiveTab({ diagramData: nextData });
  }, [
    activeTabId,
    activePresentationSlideId,
    activePresentationPrimarySlideId,
    updateActiveTab,
  ]);

  // Current diagram (root or sub) and its setter - traverses full stack for nested sub-diagrams
  const currentDiagramData = React.useMemo(() => {
    return getDiagramAtStack(diagramData, activeDiagramStack);
  }, [diagramData, activeDiagramStack]);

  const setCurrentDiagramData = React.useCallback((updater: DiagramData | ((prev: DiagramData) => DiagramData)) => {
    if (activeDiagramStack.length === 0) {
      setDiagramData(updater);
      return;
    }
    setDiagramData((prev) => {
      const current = getDiagramAtStack(prev, activeDiagramStack);
      const next = typeof updater === 'function' ? updater(current) : updater;
      return updateDiagramAtStack(prev, activeDiagramStack, () => next);
    });
  }, [activeDiagramStack, setDiagramData]);

  const setSelectedItem = React.useCallback((updater: SelectedItem | null | ((prev: SelectedItem | null) => SelectedItem | null)) => {
    if (!activeTabId) return;
    const newItem = typeof updater === 'function' ? updater(selectedItem) : updater;
    updateActiveTab({ selectedItem: newItem });
  }, [activeTabId, selectedItem, updateActiveTab]);

  const historyPresentation = React.useMemo(
    () =>
      presentationDecks.length > 0
        ? {
            decks: presentationDecks,
            activeDeckId: activePresentationDeckId,
            activeSlideId: activePresentationSlideId,
            draftDiagram: presentationDraftDiagram,
          }
        : null,
    [
      presentationDecks,
      activePresentationDeckId,
      activePresentationSlideId,
      presentationDraftDiagram,
    ],
  );

  const applyEditorHistorySnapshot = React.useCallback(
    (snapshot: ParsedEditorHistorySnapshot) => {
      recordDiagramReplace(snapshot.diagram);

      const presentation = snapshot.presentation;
      if (presentation && snapshot.hasPresentation) {
        const restoredDecksRaw = safeClone(presentation.decks);
        const liveDecks = presentationDecksRef.current;
        const structureUnchanged = presentationDecksStructurallyEqual(
          restoredDecksRaw,
          liveDecks,
        );
        // Keep live strip PNGs: history commits strip images to avoid thumb-churn undo steps.
        const decks = structureUnchanged
          ? liveDecks
          : mergePresentationDeckThumbnails(restoredDecksRaw, liveDecks);
        const activeDeckId = presentation.activeDeckId;
        const activeSlideId = presentation.activeSlideId;
        const draftDiagram = presentation.draftDiagram
          ? safeClone(presentation.draftDiagram)
          : null;

        const deck = decks.find((d) => d.id === activeDeckId) ?? decks[0];
        const primaryId = deck?.slides[0]?.id ?? null;
        const onPrimary = !activeSlideId || activeSlideId === primaryId;
        const nextDraft = onPrimary ? null : (draftDiagram ?? safeClone(snapshot.diagram));

        if (activeTabId) {
          const prev = presentationStateByTabRef.current[activeTabId];
          presentationStateByTabRef.current[activeTabId] = {
            decks,
            activeDeckId,
            activeSlideId,
            selectedSlideIds: [],
            masterDiagram: prev?.masterDiagram ?? presentationMasterDiagram,
            draftDiagram: nextDraft,
          };
          presentationSlideCanvasKeyRef.current = `${activeTabId}:${activeDeckId}:${activeSlideId}`;
        }
        // Prevent master-rebase effect from treating undo diagram restore as an edit.
        presentationPrevBaseJsonRef.current = JSON.stringify(
          diagramForPresentationThumbnailFingerprint(snapshot.diagram),
        );

        const connections = snapshot.diagram.connections || [];
        const needsIds = connections.some((c) => !(c as DiagramConnectionData).id);
        const restoredDiagram = {
          ...snapshot.diagram,
          connections: needsIds ? ensureConnectionIds(connections) : connections,
        };

        flushSync(() => {
          if (!structureUnchanged) {
            setPresentationDecks(decks);
          }
          setActivePresentationDeckId(activeDeckId);
          setActivePresentationSlideId(activeSlideId);
          setSelectedPresentationSlideIds(new Set());
          setPresentationDraftDiagram(nextDraft);
          if (onPrimary) {
            updateActiveTab({
              diagramData: restoredDiagram,
              hasUnsavedPresentations: true,
            });
          } else {
            updateActiveTab({ hasUnsavedPresentations: true });
          }
        });
        return;
      }

      // Legacy diagram-only entries: restore canvas, leave presentation decks alone.
      const connections = snapshot.diagram.connections || [];
      const needsIds = connections.some((c) => !(c as DiagramConnectionData).id);
      updateActiveTab({
        diagramData: {
          ...snapshot.diagram,
          connections: needsIds ? ensureConnectionIds(connections) : connections,
        },
      });
    },
    [activeTabId, presentationMasterDiagram, updateActiveTab],
  );

  const editorUndoChronologyRef = React.useRef<Array<'structural' | 'diagram'>>([]);
  const editorRedoChronologyRef = React.useRef<Array<'structural' | 'diagram'>>([]);

  const onDiagramHistoryEntryCommitted = React.useCallback(() => {
    editorUndoChronologyRef.current.push('diagram');
    editorRedoChronologyRef.current = [];
  }, []);

  const { history, historyIndex, undo: undoDiagramHistory, redo: redoDiagramHistory, updateHistory, flushHistory, suppressHistoryPushes, jumpToHistoryIndex: jumpToDiagramHistoryIndex } = useDiagramEditorHistory({
    activeTabId,
    activeTab,
    diagramData,
    presentation: historyPresentation,
    presentationReady: presentationStorageHydrated,
    isDragging: isDragging || chartValueDragActive,
    getHistoryRef,
    setHistoryRef,
    updateActiveTab,
    setSelectedItem,
    onApplyHistorySnapshot: applyEditorHistorySnapshot,
    onHistoryEntryCommitted: onDiagramHistoryEntryCommitted,
  });

  /** Dedicated stack for structural slide ops — full decks + tab diagram, not mixed canvas history. */
  const presentationStructuralUndoStackRef = React.useRef<PresentationRestorePoint[]>([]);
  const presentationStructuralRedoStackRef = React.useRef<PresentationRestorePoint[]>([]);
  /** True after first hover-reorder in a strip drag — undo pushed once, not every hover. */
  const presentationReorderGestureUndoPushedRef = React.useRef(false);
  /** Live slide order during strip DnD (avoids stale state without flushSync). */
  const presentationReorderLiveSlidesRef = React.useRef<Slide[] | null>(null);
  /** Slide list at drag begin — used to resolve absolutes on commit. */
  const presentationReorderPreSlidesRef = React.useRef<Slide[] | null>(null);
  /** Primary slot id captured at drag begin (kept stable across mid-drag permutes). */
  const presentationReorderPrimarySlotIdRef = React.useRef<string | null>(null);
  const [presentationStructuralUndoDepth, setPresentationStructuralUndoDepth] = React.useState(0);
  const [presentationStructuralRedoDepth, setPresentationStructuralRedoDepth] = React.useState(0);

  const captureCurrentPresentationRestorePoint = React.useCallback((): PresentationRestorePoint => {
    return capturePresentationRestorePoint({
      decks: presentationDecks,
      activeDeckId: activePresentationDeckId,
      activeSlideId: activePresentationSlideId,
      selectedSlideIds: selectedPresentationSlideIds,
      draftDiagram: presentationDraftDiagram,
      masterDiagram: presentationMasterDiagram,
      tabDiagramData,
    });
  }, [
    presentationDecks,
    activePresentationDeckId,
    activePresentationSlideId,
    selectedPresentationSlideIds,
    presentationDraftDiagram,
    presentationMasterDiagram,
    tabDiagramData,
  ]);

  const pushPresentationStructuralUndo = React.useCallback(() => {
    presentationStructuralUndoStackRef.current.push(captureCurrentPresentationRestorePoint());
    if (presentationStructuralUndoStackRef.current.length > 20) {
      presentationStructuralUndoStackRef.current.shift();
    }
    presentationStructuralRedoStackRef.current = [];
    editorUndoChronologyRef.current.push('structural');
    editorRedoChronologyRef.current = [];
    // Deck updates would otherwise debounce-push canvas history for the same op.
    suppressHistoryPushes(1500);
    setPresentationStructuralUndoDepth(presentationStructuralUndoStackRef.current.length);
    setPresentationStructuralRedoDepth(0);
  }, [captureCurrentPresentationRestorePoint, suppressHistoryPushes]);

  const applyPresentationRestorePoint = React.useCallback(
    (point: PresentationRestorePoint) => {
      const decks = safeClone(point.decks);
      const draft = point.draftDiagram ? safeClone(point.draftDiagram) : null;
      const master = point.masterDiagram ? safeClone(point.masterDiagram) : null;
      const tabDiagram = safeClone(point.tabDiagramData);
      const connections = tabDiagram.connections || [];
      const needsIds = connections.some((c) => !(c as DiagramConnectionData).id);
      const restoredTab = {
        ...tabDiagram,
        connections: needsIds ? ensureConnectionIds(connections) : connections,
      };

      if (activeTabId) {
        presentationStateByTabRef.current[activeTabId] = {
          decks,
          activeDeckId: point.activeDeckId,
          activeSlideId: point.activeSlideId,
          selectedSlideIds: point.selectedSlideIds,
          masterDiagram: master,
          draftDiagram: draft,
        };
        presentationSlideCanvasKeyRef.current = `${activeTabId}:${point.activeDeckId}:${point.activeSlideId}`;
      }
      presentationPrevBaseJsonRef.current = JSON.stringify(
        diagramForPresentationThumbnailFingerprint(restoredTab),
      );
      presentationMasterFromTabSyncKeyRef.current = null;

      flushSync(() => {
        setPresentationDecks(decks);
        setActivePresentationDeckId(point.activeDeckId);
        setActivePresentationSlideId(point.activeSlideId);
        setSelectedPresentationSlideIds(new Set(point.selectedSlideIds));
        setPresentationDraftDiagram(draft);
        setPresentationMasterDiagram(master);
        updateActiveTab({
          diagramData: restoredTab,
          hasUnsavedPresentations: true,
        });
        setSelectedItem(null);
      });
      // Keep canvas history tip aligned without inventing a new undo step.
      suppressHistoryPushes(1500);
    },
    [activeTabId, updateActiveTab, setSelectedItem, suppressHistoryPushes],
  );

  const undo = React.useCallback(() => {
    const chronology = editorUndoChronologyRef.current;
    while (chronology.length > 0) {
      const kind = chronology.pop()!;
      if (kind === 'structural') {
        const stack = presentationStructuralUndoStackRef.current;
        if (stack.length === 0) continue;
        const current = captureCurrentPresentationRestorePoint();
        const point = stack.pop()!;
        presentationStructuralRedoStackRef.current.push(current);
        editorRedoChronologyRef.current.push('structural');
        setPresentationStructuralUndoDepth(stack.length);
        setPresentationStructuralRedoDepth(presentationStructuralRedoStackRef.current.length);
        applyPresentationRestorePoint(point);
        return;
      }
      if (undoDiagramHistory()) {
        editorRedoChronologyRef.current.push('diagram');
        return;
      }
    }

    // Fallback when chronology is empty/out of sync (e.g. older sessions).
    const stack = presentationStructuralUndoStackRef.current;
    if (stack.length > 0) {
      const current = captureCurrentPresentationRestorePoint();
      const point = stack.pop()!;
      presentationStructuralRedoStackRef.current.push(current);
      editorRedoChronologyRef.current.push('structural');
      setPresentationStructuralUndoDepth(stack.length);
      setPresentationStructuralRedoDepth(presentationStructuralRedoStackRef.current.length);
      applyPresentationRestorePoint(point);
      return;
    }
    if (undoDiagramHistory()) {
      editorRedoChronologyRef.current.push('diagram');
    }
  }, [captureCurrentPresentationRestorePoint, applyPresentationRestorePoint, undoDiagramHistory]);

  const redo = React.useCallback(() => {
    const chronology = editorRedoChronologyRef.current;
    while (chronology.length > 0) {
      const kind = chronology.pop()!;
      if (kind === 'structural') {
        const stack = presentationStructuralRedoStackRef.current;
        if (stack.length === 0) continue;
        const current = captureCurrentPresentationRestorePoint();
        const point = stack.pop()!;
        presentationStructuralUndoStackRef.current.push(current);
        editorUndoChronologyRef.current.push('structural');
        setPresentationStructuralUndoDepth(presentationStructuralUndoStackRef.current.length);
        setPresentationStructuralRedoDepth(stack.length);
        applyPresentationRestorePoint(point);
        return;
      }
      if (redoDiagramHistory()) {
        editorUndoChronologyRef.current.push('diagram');
        return;
      }
    }

    const stack = presentationStructuralRedoStackRef.current;
    if (stack.length > 0) {
      const current = captureCurrentPresentationRestorePoint();
      const point = stack.pop()!;
      presentationStructuralUndoStackRef.current.push(current);
      editorUndoChronologyRef.current.push('structural');
      setPresentationStructuralUndoDepth(presentationStructuralUndoStackRef.current.length);
      setPresentationStructuralRedoDepth(stack.length);
      applyPresentationRestorePoint(point);
      return;
    }
    if (redoDiagramHistory()) {
      editorUndoChronologyRef.current.push('diagram');
    }
  }, [captureCurrentPresentationRestorePoint, applyPresentationRestorePoint, redoDiagramHistory]);

  const canUndo = presentationStructuralUndoDepth > 0 || historyIndex > 0;
  const canRedo =
    presentationStructuralRedoDepth > 0 || historyIndex < history.length - 1;

  const jumpToHistoryIndex = React.useCallback(
    (index: number) => {
      presentationStructuralUndoStackRef.current = [];
      presentationStructuralRedoStackRef.current = [];
      editorUndoChronologyRef.current = [];
      editorRedoChronologyRef.current = [];
      setPresentationStructuralUndoDepth(0);
      setPresentationStructuralRedoDepth(0);
      jumpToDiagramHistoryIndex(index);
    },
    [jumpToDiagramHistoryIndex],
  );

  // Structural slide undo is per-tab session; clear when switching tabs.
  React.useEffect(() => {
    presentationStructuralUndoStackRef.current = [];
    presentationStructuralRedoStackRef.current = [];
    editorUndoChronologyRef.current = [];
    editorRedoChronologyRef.current = [];
    setPresentationStructuralUndoDepth(0);
    setPresentationStructuralRedoDepth(0);
  }, [activeTabId]);

  const selectedItemForSyncRef = React.useRef(selectedItem);
  selectedItemForSyncRef.current = selectedItem;
  const setSelectedItemForSyncRef = React.useRef(setSelectedItem);
  setSelectedItemForSyncRef.current = setSelectedItem;

  /**
   * Keep selectedItem geometry in sync with the diagram after drag/resize (diagram updates first).
   * Otherwise toolbar handlers that spread `selectedItem` (e.g. visual styling) can re-apply stale x/y.
   *
   * Depends only on `currentDiagramData`: do not list `selectedItem` or `setSelectedItem` (the latter
   * changes identity when selection changes and would retrigger this effect → max update depth).
   */
  React.useEffect(() => {
    const selectedItem = selectedItemForSyncRef.current;
    const setSelectedItem = setSelectedItemForSyncRef.current;
    if (!selectedItem || selectedItem.itemType === 'edge') return;
    const id = selectedItem.id;

    const lineEndpointsMatch = (a: DiagramNodeData, b: DiagramNodeData) =>
      JSON.stringify((a as any).startPos) === JSON.stringify((b as any).startPos) &&
      JSON.stringify((a as any).endPos) === JSON.stringify((b as any).endPos);

    const rot = (o: unknown) => (typeof o === 'number' && Number.isFinite(o) ? o : 0);

    if (selectedItem.itemType === 'node') {
      const node = currentDiagramData.nodes.find((n) => n.id === id);
      if (node) {
        setSelectedItem((prev) => {
          if (!prev || prev.id !== id || prev.itemType !== 'node') return prev;
          const s = prev as DiagramNodeData & { itemType: 'node' };
          if (
            node.x === s.x &&
            node.y === s.y &&
            node.width === s.width &&
            node.height === s.height &&
            rot((node as any).rotation) === rot((s as any).rotation) &&
            lineEndpointsMatch(node, s)
          ) {
            return prev;
          }
          return { ...node, itemType: 'node' as const };
        });
        return;
      }
      const zone = currentDiagramData.zones?.find((z) => z.id === id);
      if (zone) {
        setSelectedItem((prev) => {
          if (!prev || prev.id !== id || prev.itemType !== 'node') return prev;
          const s = prev as DiagramZoneData & { itemType: 'node' };
          if (
            zone.x === s.x &&
            zone.y === s.y &&
            zone.width === s.width &&
            zone.height === s.height &&
            rot((zone as any).rotation) === rot((s as any).rotation)
          ) {
            return prev;
          }
          return { ...zone, itemType: 'node' as const } as SelectedItem;
        });
      }
      return;
    }
  }, [currentDiagramData]);

  /** One LayersConfig per diagram file; keep tab, master, and slide draft in sync during presentation. */
  const applyDiagramLayersGloballyCb = React.useCallback((newLayersConfig: LayersConfig) => {
    updateActiveTab({
      diagramData: {
        ...tabDiagramDataRef.current,
        layers: newLayersConfig,
      },
    });
    setPresentationMasterDiagram((m) => {
      const base = (m ?? tabDiagramDataRef.current) as DiagramData;
      return { ...base, layers: newLayersConfig };
    });
    setPresentationDraftDiagram((d) => (d ? { ...d, layers: newLayersConfig } : d));
  }, [updateActiveTab]);

  // Initialize layers system (uses current diagram - root or sub)
  const layers = useLayers({
    diagramData: currentDiagramData,
    setDiagramData: setCurrentDiagramData,
    layerSourceKey: activeTabId,
    applyLayersGlobally: activeDiagramStack.length === 0 ? applyDiagramLayersGloballyCb : undefined,
    toast,
  });

  // Layer show/hide animations (Options menu toggle, default enabled)
  const layerAnimation = useLayerAnimation(
    layerAnimationsEnabled,
    layers.filteredDiagramData ?? currentDiagramData,
    layers.layersConfig,
  );

  React.useEffect(() => {
    layerAnimation.updateSnapshot(currentDiagramData);
  }, [currentDiagramData, layerAnimation.updateSnapshot]);

  const handleToggleLayerVisibility = React.useCallback(
    (layerId: string) => {
      if (!layerAnimation.onLayerVisibilityWillChange(layerId)) return;
      layers.toggleLayerVisibilityById(layerId);
    },
    [layerAnimation.onLayerVisibilityWillChange, layers.toggleLayerVisibilityById],
  );

  const displayDiagramData = layerAnimation.animatingDiagramData ?? layers.filteredDiagramData ?? currentDiagramData;

  const diagramDataForExportLayersRef = React.useRef<DiagramData>(currentDiagramData);
  diagramDataForExportLayersRef.current = layers.filteredDiagramData ?? currentDiagramData;

  const { handleExportPng, handleExportPngSelection, handleExportGif, handleExport } = createDiagramExportHandlers({
    editorRef,
    toast: toast as DiagramEditorToastFn,
    setExportDialogOpen,
    setExportDialogFormat,
    activeTab,
    activeDiagramStack,
    activePresentationDeckId,
    presentationDecks,
    presentationPersistSuppressedForExportRef,
    activePresentationSlideId,
    setActivePresentationSlideId,
    presentationDraftDiagram,
    setPresentationDraftDiagram,
    tabDiagramData,
    presentationMasterDiagram,
    diagramDataForExportLayersRef,
  });

  usePresentationTabSwitchSync({
    activeTabId,
    presentationStateByTabRef,
    presentationPrevBaseJsonRef,
    presentationMasterFromTabSyncKeyRef,
    lastRestoredStackRef,
    setPresentationDecks,
    setActivePresentationDeckId,
    setActivePresentationSlideId,
    setSelectedPresentationSlideIds,
    setPresentationMasterDiagram,
    setPresentationDraftDiagram,
    setActiveDiagramStack,
  });

  React.useEffect(() => {
    if (!activeTabId) return;
    presentationStateByTabRef.current[activeTabId] = {
      decks: presentationDecks,
      activeDeckId: activePresentationDeckId,
      activeSlideId: activePresentationSlideId,
      selectedSlideIds: Array.from(selectedPresentationSlideIds),
      masterDiagram: presentationMasterDiagram,
      draftDiagram: presentationDraftDiagram,
    };
  }, [
    activeTabId,
    presentationDecks,
    activePresentationDeckId,
    activePresentationSlideId,
    selectedPresentationSlideIds,
    presentationMasterDiagram,
    presentationDraftDiagram,
  ]);

  // Persist presentations for all tabs whenever per-tab state changes (debounced 600 ms).
  // Keep this effect after ref sync so writes always include latest tab state.
  React.useEffect(() => {
    if (!isLoaded || !presentationStorageHydrated || !activeTabId) return;
    if (presentationPersistTimeoutRef.current) {
      clearTimeout(presentationPersistTimeoutRef.current);
    }

    presentationPersistTimeoutRef.current = setTimeout(() => {
      presentationPersistTimeoutRef.current = null;
      const liveTabIds = new Set(tabs.map((tab) => tab.id));
      const snapshot: Record<string, { decks: PresentationDeck[]; activeDeckId: string | null; activeSlideId?: string | null }> = {};
      for (const [tabId, state] of Object.entries(presentationStateByTabRef.current)) {
        if (liveTabIds.has(tabId) && state.decks.length > 0) {
          snapshot[tabId] = {
            decks: state.decks,
            activeDeckId: state.activeDeckId,
            activeSlideId: state.activeSlideId ?? undefined,
          };
        }
      }
      savePresentationsByTab(snapshot).catch(() => { /* silent */ });
    }, 600);

    return () => {
      if (presentationPersistTimeoutRef.current) {
        clearTimeout(presentationPersistTimeoutRef.current);
        presentationPersistTimeoutRef.current = null;
      }
    };
  }, [
    activeTabId,
    isLoaded,
    presentationStorageHydrated,
    presentationDecks,
    activePresentationDeckId,
    activePresentationSlideId,
    selectedPresentationSlideIds,
    presentationMasterDiagram,
    presentationDraftDiagram,
    tabs,
  ]);

  // When animation toggle-on-click mode is on: show animations only for selected node's chain. Nothing selected = no animations.
  const effectiveAnimationFilterIds = React.useMemo(() => {
    if (!animationToggleOnClickEnabled || !animationConnectionsEnabled) return undefined;
    const displayData = layers.filteredDiagramData ?? diagramData;
    const connections = displayData?.connections ?? [];
    if (selectedItem?.itemType === 'node' && selectedItem?.id && connections.length > 0) {
      return getDownstreamAnimationChainNodes(selectedItem.id, connections);
    }
    return new Set<string>(); // Empty set = no animations when nothing selected
  }, [animationToggleOnClickEnabled, animationConnectionsEnabled, selectedItem, layers.filteredDiagramData, diagramData]);

  const setSelectedItemIds = React.useCallback((updater: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    if (!activeTabId) return;
    const newIds = typeof updater === 'function' ? updater(selectedItemIds) : updater;
    updateActiveTab({ selectedItemIds: newIds });
    
    // Update active layer based on selection
    layers.updateActiveLayerFromSelection(newIds);
  }, [activeTabId, selectedItemIds, updateActiveTab, layers]);

  const setIsConnectMode = React.useCallback((mode: boolean) => {
    if (!activeTabId) return;
    updateActiveTab({ isConnectMode: mode });
  }, [activeTabId, updateActiveTab]);

  const setJsonPanelOpen = React.useCallback((open: boolean) => {
    if (!activeTabId) return;
    updateActiveTab({ jsonPanelOpen: open });
    if (isClient) {
      localStorage.setItem('dw:jsonEditor:open', String(open));
    }
  }, [activeTabId, updateActiveTab, isClient]);

  const viewStatePersistRef = useRef<{ x: number; y: number; k: number } | null>(null);
  const viewStatePersistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const VIEW_STATE_DEBOUNCE_MS = 400;

  const setCanvasTransform = React.useCallback((transform: { x: number; y: number; k: number }) => {
    if (!activeTabId) return;
    const sanitized = sanitizeCanvasTransform(transform);
    updateActiveTab({ canvasTransform: sanitized });

    if (
      typeof document !== "undefined" &&
      document.body.dataset.dwRecording === "active" &&
      document.body.dataset.dwPlayback !== "active"
    ) {
      emitDwCanvasTransform(sanitized);
    }

    if (isPrimaryPresentationSlideActive) {
      viewStatePersistRef.current = sanitized;
      if (viewStatePersistTimeoutRef.current) clearTimeout(viewStatePersistTimeoutRef.current);
      viewStatePersistTimeoutRef.current = setTimeout(() => {
        viewStatePersistTimeoutRef.current = null;
        const toPersist = viewStatePersistRef.current;
        if (!toPersist) return;
        const vs = sanitizeViewState(toPersist);
        if (!vs) return;
        setDiagramData((prev) => {
          const current = getDiagramAtStack(prev, activeDiagramStack);
          return updateDiagramAtStack(prev, activeDiagramStack, () => ({
            ...current,
            viewState: vs,
          }));
        });
      }, VIEW_STATE_DEBOUNCE_MS);
    }
  }, [
    activeTabId,
    updateActiveTab,
    sanitizeCanvasTransform,
    isPrimaryPresentationSlideActive,
    activeDiagramStack,
    setDiagramData,
  ]);

  React.useEffect(() => {
    const onReplayCanvasTransform = (e: Event) => {
      if (document.body.dataset.dwPlayback !== "active") return;
      const detail = (e as CustomEvent<InteractionRecordingCanvasTransform>).detail;
      if (!detail || typeof detail.k !== "number") return;
      const sanitized = sanitizeCanvasTransform(detail);
      flushSync(() => {
        setCanvasTransform(sanitized);
      });
    };
    document.addEventListener(DW_REPLAY_CANVAS_TRANSFORM, onReplayCanvasTransform as EventListener);
    return () =>
      document.removeEventListener(DW_REPLAY_CANVAS_TRANSFORM, onReplayCanvasTransform as EventListener);
  }, [setCanvasTransform, sanitizeCanvasTransform]);

  usePresentationSlideViewportSync({
    activeTabId,
    activePresentationDeckId,
    activePresentationSlideId,
    presentationDecks,
    presentationMasterDiagram,
    tabDiagramData,
    prevPresentationSlideIdForViewportRef,
    canvasTransformRef,
    setPresentationDecks,
    setCanvasTransform,
    sanitizeCanvasTransform,
  });

  React.useEffect(() => {
    return () => {
      if (viewStatePersistTimeoutRef.current) {
        clearTimeout(viewStatePersistTimeoutRef.current);
        viewStatePersistTimeoutRef.current = null;
      }
    };
  }, []);

  useDiagramEditorClientBootstrap({
    setIsClient,
    setJsonPanelWidth,
    setIconBackgroundEnabled,
    setDefaultTextLabelsEnabled,
  });

  // Handle body scroll lock when mobile sidebar is open
  React.useEffect(() => {
    if (isMobile) {
      if (sidebarOpen) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
      
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [sidebarOpen, isMobile]);

  const handleItemSelect = React.useCallback((item: SelectedItem | null, shiftKey = false) => {
    setConnectorLineFocusedVertex(null);

    if (!item || item.itemType === "edge") {
      setTimelineEntrySelectionKeys([]);
    } else if (item.itemType === "node" && !isTimelineNodeType(item.type)) {
      setTimelineEntrySelectionKeys([]);
    }

    if (isConnectMode && !item) {
      setIsConnectMode(false);
    }

    if (!item && animationToggleOnClickEnabled) {
      setAnimationDisabledSources(new Set());
    }

    const diagramForSelectionKind = currentDiagramData;

    if (shiftKey && item) {
      const itemKind = item.itemType === "edge" ? "edge" : "object";
      const mergedForAnchor = new Set(selectedItemIds);
      if (selectedItem?.id) {
        mergedForAnchor.add(selectedItem.id);
      }
      const anchorOrdered = Array.from(mergedForAnchor);
      if (anchorOrdered.length > 0) {
        const anchorKind = getSelectionIdKind(anchorOrdered[0], diagramForSelectionKind);
        if (anchorKind !== "unknown" && anchorKind !== itemKind) {
          return;
        }
      }

      setSelectedItemIds((prev) => {
        const newSet = new Set(prev);

        // Preserve the currently selected item when entering additive selection
        // from flows where selectedItemIds may not yet include selectedItem.
        if (selectedItem?.id) {
          newSet.add(selectedItem.id);
        }

        if (newSet.has(item.id)) {
          newSet.delete(item.id);
        } else {
          newSet.add(item.id);
        }
        return newSet;
      });
      setSelectedItem(item);
    } else {
      // Plain click on an item already in a multi-selection: primary only, keep the set.
      let preserveMulti = false;
      if (item && !shiftKey && selectedItemIds.size > 1) {
        if (item.itemType === "edge") {
          const conns = (displayDiagramData.connections ?? []) as DiagramConnectionData[];
          for (let i = 0; i < conns.length; i++) {
            if (!connectionSelectionIdMatches(item.id, conns[i], i, conns)) continue;
            preserveMulti = selectionSetContainsConnection(selectedItemIds, conns[i], i, conns);
            break;
          }
        } else if (selectedItemIds.has(item.id)) {
          preserveMulti = true;
        }
      }

      if (preserveMulti) {
        setSelectedItem(item);
      } else {
        setSelectedItem(item);

        if (item) {
          setSelectedItemIds(new Set([item.id]));
        } else {
          setSelectedItemIds(new Set());
        }
      }
    }
  }, [
    currentDiagramData,
    displayDiagramData,
    isConnectMode,
    animationToggleOnClickEnabled,
    selectedItem,
    selectedItemIds,
    setIsConnectMode,
    setAnimationDisabledSources,
    setSelectedItem,
    setSelectedItemIds,
  ]);

  const handleConnectorLineVertexFocus = React.useCallback(
    (nodeId: string, vertexIndex: number) => {
      const node = currentDiagramData.nodes.find((n) => n.id === nodeId);
      if (!node || !isConnectorLikeSpineNodeType(node.type) || node.locked) return;
      setTimelineEntrySelectionKeys([]);
      setSelectedItem({ ...node, itemType: 'node' });
      setSelectedItemIds(new Set([nodeId]));
      setConnectorLineFocusedVertex({ nodeId, vertexIndex });
    },
    [currentDiagramData, setSelectedItem, setSelectedItemIds, setConnectorLineFocusedVertex],
  );

  const handleBatchSelect = React.useCallback((itemIds: string[]) => {
    setConnectorLineFocusedVertex(null);
    setTimelineEntrySelectionKeys([]);
    if (itemIds.length === 0) {
      setSelectedItem(null);
      setSelectedItemIds(new Set());
      if (animationToggleOnClickEnabled) setAnimationDisabledSources(new Set());
      return;
    }

    // Same graph the canvas / marquee use (current sub-diagram + visible layers + animation snapshot)
    const dataForHits = displayDiagramData;

    const items: SelectedItem[] = [];
    const resolvedIds: string[] = [];

    for (const id of itemIds) {
      const node = dataForHits.nodes.find((n) => n.id === id);
      if (node) {
        if (node.locked) continue;
        resolvedIds.push(node.id);
        items.push({ ...node, itemType: "node" as const });
        continue;
      }

      const zone = dataForHits.zones?.find((z) => z.id === id);
      if (zone) {
        resolvedIds.push(zone.id);
        items.push({ ...(zone as any), itemType: "node" as const, id: zone.id } as SelectedItem);
        continue;
      }

      const idxBySynthetic = (dataForHits.connections ?? []).findIndex(
        (conn, idx) =>
          (conn as DiagramConnectionData).id === id || `${conn.from}-${conn.to}-${idx}` === id
      );
      let connection =
        idxBySynthetic >= 0 ? dataForHits.connections![idxBySynthetic] : undefined;
      if (!connection) {
        const legacy = (dataForHits.connections ?? []).filter((conn) => `${conn.from}-${conn.to}` === id);
        connection = legacy.length === 1 ? legacy[0] : undefined;
      }
      if (connection) {
        const cIdx = (dataForHits.connections ?? []).indexOf(connection);
        const connId =
          (connection as DiagramConnectionData).id ??
          `${connection.from}-${connection.to}-${Math.max(0, cIdx)}`;
        resolvedIds.push(connId);
        items.push({ ...connection, itemType: "edge" as const, id: connId });
      }
    }

    if (items.length > 0) {
      setSelectedItem(items[0]);
      setSelectedItemIds(new Set(resolvedIds));
    }
  }, [setSelectedItem, setSelectedItemIds, animationToggleOnClickEnabled, setAnimationDisabledSources, displayDiagramData, setConnectorLineFocusedVertex]);

  const handleItemUpdate = React.useCallback((updatedItem: SelectedItem) => {
    if (updatedItem.itemType === 'edge') return;

    const existingNode = currentDiagramData.nodes.find((n) => n.id === updatedItem.id);
    if (existingNode) {
      const { patch, removeKeys } = extractDiagramItemPatch(
        updatedItem as unknown as Record<string, unknown>,
      );
      if (Object.keys(patch).length > 0 || removeKeys.length > 0) {
        recordDiagramChange({ op: "update-node", nodeId: updatedItem.id, patch, removeKeys });
      }
    } else {
      const existingZone = (currentDiagramData.zones ?? []).find((z) => z.id === updatedItem.id);
      if (existingZone) {
        const { patch, removeKeys } = extractDiagramItemPatch(
        updatedItem as unknown as Record<string, unknown>,
      );
        if (Object.keys(patch).length > 0 || removeKeys.length > 0) {
          recordDiagramChange({ op: "update-zone", zoneId: updatedItem.id, patch, removeKeys });
        }
      }
    }

    setCurrentDiagramData(prevData => {
            // Find the existing node to preserve its properties
            const existingNode = prevData.nodes.find(n => n.id === updatedItem.id);

            if (existingNode) {
              const mergedNode = { ...existingNode } as DiagramNodeData;
              Object.keys(updatedItem).forEach(key => {
                  if (key !== 'itemType' && key !== 'id') {
                      if (DIAGRAM_GEOMETRY_KEYS_FROM_SELECTED_MERGE.has(key)) return;
                      const value = (updatedItem as any)[key];
                      if (value === null) {
                          delete (mergedNode as any)[key];
                      } else if (value !== undefined) {
                          (mergedNode as any)[key] = value;
                      }
                  }
              });
              let nodes = prevData.nodes.map(n => n.id === updatedItem.id ? mergedNode : n);
              if (isMindmapNodeType(mergedNode.type) && mergedNode.mindmapFillMode === 'theme-hues') {
                nodes = applyMindmapHueAnchorsAfterVisualChanges(
                  prevData.nodes,
                  nodes,
                  new Set([updatedItem.id]),
                );
              }
              return {
                  ...prevData,
                  nodes,
              };
            }

            const zones = prevData.zones || [];
            const zi = zones.findIndex(z => z.id === updatedItem.id);
            if (zi >= 0) {
              const existingZone = zones[zi];
              const mergedZone = { ...existingZone } as DiagramZoneData;
              Object.keys(updatedItem).forEach(key => {
                if (key !== 'itemType' && key !== 'id') {
                  if (DIAGRAM_GEOMETRY_KEYS_FROM_SELECTED_MERGE.has(key)) return;
                  const value = (updatedItem as any)[key];
                  if (value === null) {
                    delete (mergedZone as any)[key];
                  } else if (value !== undefined) {
                    (mergedZone as any)[key] = value;
                  }
                }
              });
              const nextZones = [...zones];
              nextZones[zi] = mergedZone;
              return { ...prevData, zones: nextZones };
            }

            return prevData;
    });

    // Also update the selected item state if it's the one being edited
    if (selectedItem?.id === updatedItem.id) {
        setSelectedItem(updatedItem);
    }
  }, [selectedItem, setCurrentDiagramData, setSelectedItem, currentDiagramData]);

  const diagramReplayApplyRef = useRef<(detail: DwDiagramChangeDetail) => void>(() => {});
  diagramReplayApplyRef.current = (detail) => {
    setCurrentDiagramData((prev) => applyDiagramChange(detail, prev));
  };
  useInteractionRecordingDiagramReplay({
    applyChange: (detail) => diagramReplayApplyRef.current(detail),
  });

  const handleDiagramDataUpdate = React.useCallback(
    (nextDiagram: DiagramData) => {
      recordDiagramReplace(nextDiagram);
      setDiagramData(nextDiagram);
    },
    [setDiagramData],
  );

  /** Apply tag, description (`info`), and/or plain toolbar **label** to every selected node and zone (multi-select). */
  const handleBulkMetadataUpdate = React.useCallback(
    (patch: { tag?: string; info?: string; label?: string }) => {
      if (selectedItemIds.size < 2) return;
      const hasTag = 'tag' in patch;
      const hasInfo = 'info' in patch;
      const hasLabel = 'label' in patch;
      if (!hasTag && !hasInfo && !hasLabel) return;

      setCurrentDiagramData((prevData) => {
        const nextData = {
          ...prevData,
          nodes: prevData.nodes.map((n) => {
            if (!selectedItemIds.has(n.id)) return n;
            let next = n;
            if (hasTag) next = { ...next, tag: patch.tag };
            if (hasInfo) next = { ...next, info: patch.info };
            if (hasLabel) {
              const isPlainTextNode =
                n.type === 'generic.text.textbox' || n.type === 'generic.text.text';
              next = {
                ...next,
                label: patch.label,
                ...(isPlainTextNode ? { richLabel: undefined } : {}),
              };
            }
            return next;
          }),
          zones: (prevData.zones || []).map((z) => {
            if (!selectedItemIds.has(z.id)) return z;
            let next = z;
            if (hasTag) next = { ...next, tag: patch.tag };
            if (hasInfo) next = { ...next, info: patch.info };
            if (hasLabel) next = { ...next, label: patch.label };
            return next;
          }),
        };
        recordDiagramReplace(nextData);
        return nextData;
      });

      if (
        selectedItem?.itemType === 'node' &&
        selectedItemIds.has(selectedItem.id)
      ) {
        let nextSel = selectedItem as SelectedItem;
        if (hasTag) nextSel = { ...nextSel, tag: patch.tag } as SelectedItem;
        if (hasInfo) nextSel = { ...nextSel, info: patch.info } as SelectedItem;
        if (hasLabel) {
          const t = (nextSel as { type?: string }).type;
          const isPlainTextNode =
            t === 'generic.text.textbox' || t === 'generic.text.text';
          nextSel = {
            ...nextSel,
            label: patch.label,
            ...(isPlainTextNode ? { richLabel: undefined } : {}),
          } as SelectedItem;
        }
        setSelectedItem(nextSel);
      }
    },
    [selectedItem, selectedItemIds, setCurrentDiagramData, setSelectedItem],
  );

  const handleLabelUpdate = React.useCallback((nodeId: string, newLabel: string, richLabel?: import("@/lib/types").RichTextRun[]) => {
    React.startTransition(() => {
      const propagateToSelection =
        selectedItemIds.size > 1 && selectedItemIds.has(nodeId);
      const targetIds: Set<string> = propagateToSelection
        ? new Set(
            [...selectedItemIds].filter((id) =>
              currentDiagramData.nodes.some((n) => n.id === id),
            ),
          )
        : new Set([nodeId]);

      setCurrentDiagramData(prevData => ({
        ...prevData,
        nodes: prevData.nodes.map((n) =>
          targetIds.has(n.id)
            ? { ...n, label: newLabel, richLabel: richLabel ?? undefined }
            : n,
        ),
      }));

      for (const id of targetIds) {
        const patch: Record<string, unknown> = { label: newLabel };
        if (richLabel !== undefined) patch.richLabel = richLabel;
        recordDiagramChange({ op: "update-node", nodeId: id, patch });
      }

      if (
        selectedItem?.itemType === 'node' &&
        selectedItemIds.has(selectedItem.id) &&
        (selectedItem.id === nodeId || propagateToSelection)
      ) {
        if (richLabel !== undefined) {
          setSelectedItem({ ...selectedItem, label: newLabel, richLabel });
        } else if (propagateToSelection) {
          setSelectedItem({ ...selectedItem, label: newLabel, richLabel: undefined });
        } else {
          setSelectedItem({ ...selectedItem, label: newLabel });
        }
      }
    });
  }, [selectedItem, selectedItemIds, currentDiagramData.nodes, setCurrentDiagramData, setSelectedItem]);

  const handleTagUpdate = React.useCallback((nodeId: string, newTag: string) => {
    const propagateToSelection =
      selectedItemIds.size > 1 && selectedItemIds.has(nodeId);
    const targetIds: Set<string> = propagateToSelection
      ? new Set([...selectedItemIds])
      : new Set([nodeId]);

    setCurrentDiagramData((prevData) => {
      const nextData = {
        ...prevData,
        nodes: prevData.nodes.map((n) =>
          targetIds.has(n.id) ? { ...n, tag: newTag } : n,
        ),
        zones: (prevData.zones || []).map((z) =>
          targetIds.has(z.id) ? { ...z, tag: newTag } : z,
        ),
      };
      for (const id of targetIds) {
        if (prevData.nodes.some((n) => n.id === id)) {
          recordDiagramChange({ op: "update-node", nodeId: id, patch: { tag: newTag } });
        } else if ((prevData.zones ?? []).some((z) => z.id === id)) {
          recordDiagramChange({ op: "update-zone", zoneId: id, patch: { tag: newTag } });
        }
      }
      return nextData;
    });

    if (
      selectedItem?.itemType === 'node' &&
      selectedItemIds.has(selectedItem.id) &&
      (selectedItem.id === nodeId || propagateToSelection)
    ) {
      setSelectedItem({ ...selectedItem, tag: newTag });
    }
  }, [selectedItem, selectedItemIds, setCurrentDiagramData, setSelectedItem]);

  const handleResourceSelect = (resource: { name: string; file?: string; type?: string; hasWhiteVariant?: boolean; format?: string; iconType?: string; iconName?: string; emoji?: string; imageUrl?: string; imageOptions?: import('@/lib/types').CustomImageOptions }, provider: string, category: string) => {
    // Track the currently selected resource from the sidebar for copy/paste
    setSelectedResource({ resource, provider, category });
    console.log('Resource selected:', { resource, provider, category });
  };

  const handleResourceActivate = (
    resource: { name: string; file?: string; type?: string; hasWhiteVariant?: boolean; format?: string; iconType?: string; iconName?: string; emoji?: string; imageUrl?: string; imageOptions?: import('@/lib/types').CustomImageOptions },
    provider: string,
    category: string,
    fullItem?: { type: string; label: string; provider: string; category: string; iconType?: string; iconName?: string; emoji?: string; imageUrl?: string; imageOptions?: import('@/lib/types').CustomImageOptions }
  ) => {
    const item = fullItem ?? createPaletteItem(resource as PaletteResource, provider, category);
    setSelectedResource({ resource, provider, category });
    setPaletteClipboardItem(item);
    if (editorRef.current) {
      editorRef.current.pastePaletteItem(item);
    }
  };

  const handleResourceActivateAtPosition = (
    resource: { name: string; file?: string; type?: string; hasWhiteVariant?: boolean; format?: string; iconType?: string; iconName?: string; emoji?: string; imageUrl?: string; imageOptions?: import('@/lib/types').CustomImageOptions },
    provider: string,
    category: string,
    position: { x: number; y: number },
    fullItem?: object
  ) => {
    const item = (fullItem as { type: string; label: string; provider: string; category: string }) ?? createPaletteItem(resource as PaletteResource, provider, category);
    setSelectedResource({ resource, provider, category });
    setPaletteClipboardItem(item);
    emitDwResourceActivate({
      item,
      provider,
      category,
      diagramX: position.x,
      diagramY: position.y,
      resourceLabel: resource.name,
    });
    if (editorRef.current) {
      editorRef.current.pastePaletteItem(item, position);
    }
  };

  const persistUserDefinedObjectsLibrary = React.useCallback(
    (next: Record<string, UserDefinedObject>) => {
      setUserDefinedObjectsLibrary(next);
      saveUserDefinedObjectsLibrary(next);
    },
    [],
  );

  const absorbDiagramUserDefinedObjects = React.useCallback(
    (data: DiagramData, options?: { notify?: boolean; notifyEachCreated?: boolean }) => {
      if (Object.keys(collectUserDefinedObjectsFromDiagramTree(data)).length === 0) return;

      let added: UserDefinedObject[] = [];
      setUserDefinedObjectsLibrary((prev) => {
        added = findNewUserDefinedObjectsForLibrary(prev, data);
        const merged = mergeDiagramObjectsIntoLibrary(prev, data);
        if (options?.notifyEachCreated) {
          saveUserDefinedObjectsLibraryImmediate(merged);
        } else {
          saveUserDefinedObjectsLibrary(merged);
        }
        return merged;
      });

      if (options?.notifyEachCreated) {
        for (const obj of added) {
          toast({
            title: 'User-defined object created',
            description: `User Defined Object ${obj.name} created`,
          });
        }
      } else if (options?.notify && added.length > 0) {
        const names = added.map((o) => o.name).join(', ');
        toast({
          title: 'User-defined objects imported',
          description:
            added.length === 1
              ? `"${names}" added to your library.`
              : `${added.length} objects added to your library: ${names}`,
        });
      }
    },
    [toast],
  );

  const tabsUserDefinedHydratedRef = React.useRef(false);
  React.useEffect(() => {
    if (!isLoaded || tabsUserDefinedHydratedRef.current) return;
    tabsUserDefinedHydratedRef.current = true;
    for (const tabSummary of tabs) {
      const tab = getTab(tabSummary.id);
      if (tab?.diagramData) {
        absorbDiagramUserDefinedObjects(tab.diagramData);
      }
    }
  }, [isLoaded, tabs, getTab, absorbDiagramUserDefinedObjects]);

  React.useEffect(() => {
    absorbDiagramUserDefinedObjects(tabDiagramData);
  }, [activeTabId, tabDiagramData.userDefinedObjects, absorbDiagramUserDefinedObjects]);

  const canCreateUserDefinedObject = React.useMemo(
    () => resolveGroupForUserDefinedCreation(selectedItemIds, currentDiagramData) !== null,
    [selectedItemIds, currentDiagramData],
  );

  const handleCreateUserDefinedObjectClick = React.useCallback(() => {
    const group = resolveGroupForUserDefinedCreation(selectedItemIds, currentDiagramData);
    if (!group) {
      toast({
        variant: 'destructive',
        title: 'Cannot create object',
        description: 'Select items that belong to a group (at least 2 members).',
      });
      return;
    }
    setCreateUserDefinedObjectDialogOpen(true);
  }, [selectedItemIds, currentDiagramData, toast]);

  const handleConfirmCreateUserDefinedObject = React.useCallback(
    (name: string) => {
      const group = resolveGroupForUserDefinedCreation(selectedItemIds, currentDiagramData);
      if (!group) return;
      try {
        const created = createUserDefinedObjectFromGroup(name, group, currentDiagramData);
        persistUserDefinedObjectsLibrary({
          ...userDefinedObjectsLibrary,
          [created.id]: created,
        });
        setCurrentDiagramData((prev) =>
          attachUserDefinedObjectToDiagram(prev, created, group.memberIds),
        );
        toast({
          title: 'Object created',
          description: `"${created.name}" is available in the resource sidebar.`,
        });
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Create failed',
          description: error instanceof Error ? error.message : 'Could not create object.',
        });
      }
    },
    [selectedItemIds, currentDiagramData, userDefinedObjectsLibrary, persistUserDefinedObjectsLibrary, setCurrentDiagramData, toast],
  );

  const handleRenameUserDefinedObject = React.useCallback(
    (id: string, name: string) => {
      const existing = userDefinedObjectsLibrary[id];
      if (!existing) return;
      persistUserDefinedObjectsLibrary({
        ...userDefinedObjectsLibrary,
        [id]: { ...existing, name, updatedAt: Date.now() },
      });
    },
    [userDefinedObjectsLibrary, persistUserDefinedObjectsLibrary],
  );

  const handleDeleteUserDefinedObject = React.useCallback(
    (id: string) => {
      setUserDefinedObjectsLibrary((prev) => {
        const next = { ...prev };
        delete next[id];
        saveUserDefinedObjectsLibrary(next);
        return next;
      });
      for (const tabSummary of tabs) {
        const tab = getTab(tabSummary.id);
        if (!tab) continue;
        const patched = removeUserDefinedObjectFromDiagram(tab.diagramData, id);
        if (patched !== tab.diagramData) {
          updateTab(tab.id, { diagramData: patched });
        }
      }
      toast({ title: 'Object removed', description: 'Removed from your library and resource list.' });
    },
    [tabs, getTab, updateTab, toast],
  );

  const handleEditUserDefinedObject = React.useCallback(
    (object: UserDefinedObject) => {
      if (!activeTabId) return;
      setManageUserDefinedObjectsDialogOpen(false);
      createTab({
        name: `Edit: ${object.name}`,
        diagramData: buildEditDiagramFromUserDefinedObject(object),
        userDefinedObjectEdit: { objectId: object.id, returnTabId: activeTabId },
      });
    },
    [activeTabId, createTab],
  );

  const handleSaveUserDefinedObjectEdit = React.useCallback(async () => {
    const editMeta = activeTab?.userDefinedObjectEdit;
    if (!editMeta || !activeTabId) return;
    const existing = userDefinedObjectsLibrary[editMeta.objectId];
    if (!existing) {
      toast({
        variant: 'destructive',
        title: 'Save failed',
        description: 'Original object no longer exists in the library.',
      });
      return;
    }
    const editDiagram = activeTab?.diagramData ?? tabDiagramData;
    const updated = updateUserDefinedObjectFromEditDiagram(existing, editDiagram);
    setUserDefinedObjectsLibrary((prev) => {
      const next = { ...prev, [updated.id]: updated };
      saveUserDefinedObjectsLibrary(next);
      return next;
    });
    for (const tabSummary of tabs) {
      const tab = getTab(tabSummary.id);
      if (!tab) continue;
      const patched = propagateUserDefinedObjectToDiagram(tab.diagramData, updated);
      if (patched !== tab.diagramData) {
        updateTab(tab.id, { diagramData: patched });
      }
    }
    toast({ title: 'Object saved', description: `"${updated.name}" has been updated.` });
    switchTab(editMeta.returnTabId);
    await closeTab(activeTabId, true);
  }, [
    activeTab,
    activeTabId,
    tabDiagramData,
    userDefinedObjectsLibrary,
    tabs,
    getTab,
    updateTab,
    toast,
    switchTab,
    closeTab,
  ]);

  const handleUserDefinedObjectActivate = React.useCallback(
    (object: UserDefinedObject) => {
      const item = getUserDefinedObjectDragItem(object);
      if (editorRef.current) {
        editorRef.current.pastePaletteItem(item);
      }
    },
    [],
  );

  const handleGroupItems = React.useCallback(() => {
    if (selectedItemIds.size < 2) {
      toast({
        variant: 'destructive',
        title: 'Cannot Group',
        description: 'Select at least 2 items to create a group.'
      });
      return;
    }

    try {
      const updatedData = createGroup(Array.from(selectedItemIds), currentDiagramData);
      setCurrentDiagramData(updatedData);
      toast({
        title: 'Items Grouped',
        description: `Created group with ${selectedItemIds.size} items.`
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Group Failed',
        description: error instanceof Error ? error.message : 'Failed to create group.'
      });
    }
  }, [selectedItemIds, currentDiagramData, setCurrentDiagramData, toast]);

  const handleUngroupItems = React.useCallback(() => {
    if (!selectedItem) return;

    const group = getItemGroup(selectedItem.id, currentDiagramData);
    if (!group) {
      toast({
        variant: 'destructive',
        title: 'Not Grouped',
        description: 'Selected item is not in a group.'
      });
      return;
    }

    try {
      const updatedData = ungroup(group.id, currentDiagramData);
      setCurrentDiagramData(updatedData);
      toast({
        title: 'Items Ungrouped',
        description: 'Group has been dissolved.'
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Ungroup Failed',
        description: error instanceof Error ? error.message : 'Failed to ungroup items.'
      });
    }
  }, [selectedItem, currentDiagramData, setCurrentDiagramData, toast]);

  const handleRemoveFromGroup = React.useCallback(() => {
    if (selectedItemIds.size === 0) return;

    try {
      const updatedData = removeFromGroup(Array.from(selectedItemIds), currentDiagramData);
      setCurrentDiagramData(updatedData);
      toast({
        title: 'Removed from Group',
        description: `${selectedItemIds.size} item(s) removed from group.`
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Remove Failed',
        description: error instanceof Error ? error.message : 'Failed to remove from group.'
      });
    }
  }, [selectedItemIds, currentDiagramData, setCurrentDiagramData, toast]);

  const handleAddToGroup = React.useCallback((groupId: string) => {
    if (selectedItemIds.size === 0) return;

    try {
      const updatedData = addToGroup(Array.from(selectedItemIds), groupId, currentDiagramData);
      setCurrentDiagramData(updatedData);
      toast({
        title: 'Added to Group',
        description: `${selectedItemIds.size} item(s) added to group.`
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Add to Group Failed',
        description: error instanceof Error ? error.message : 'Failed to add to group.'
      });
    }
  }, [selectedItemIds, currentDiagramData, setCurrentDiagramData, toast]);

  const generateSubDiagramId = React.useCallback(() => {
    const { subDiagramKeys } = collectAllIdsInDiagram(diagramData);
    let i = 1;
    while (subDiagramKeys.has(`sub-${i}`)) i++;
    return `sub-${i}`;
  }, [diagramData]);

  const handleSubDiagramDoubleClick = React.useCallback((node: DiagramNodeData) => {
    if (!node.subDiagramId) return;
    const subId = node.subDiagramId;
    setDiagramData((prev) => {
      const current = getDiagramAtStack(prev, activeDiagramStack);
      if (current.subDiagrams?.[subId]) return prev;
      // Sub not at current level: use blank or migrate from root (legacy storage)
      const atRoot = prev.subDiagrams?.[subId];
      const content = atRoot ?? { nodes: [], connections: [] };
      if (atRoot && activeDiagramStack.length > 0) {
        const { [subId]: _, ...restRoot } = prev.subDiagrams || {};
        const withoutAtRoot = { ...prev, subDiagrams: Object.keys(restRoot).length ? restRoot : undefined };
        return addSubDiagramAtStack(withoutAtRoot, activeDiagramStack, subId, content);
      }
      return addSubDiagramAtStack(prev, activeDiagramStack, subId, content);
    });
    setActiveDiagramStack((s) => [...s, { diagramId: subId, fromNodeId: node.id, fromNodeLabel: node.label || 'Sub-diagram' }]);
    setSelectedItem(null);
  }, [activeDiagramStack, setDiagramData]);

  const handleBreadcrumbNavigate = React.useCallback((index: number) => {
    setActiveDiagramStack((s) => s.slice(0, index));
    setSelectedItem(null);
  }, []);

  const handleBreadcrumbSegmentRename = React.useCallback(
    (segmentIndex: number, newLabel: string) => {
      if (segmentIndex < 1) return;
      const seg = activeDiagramStack[segmentIndex - 1];
      if (!seg?.fromNodeId) return;
      const parentStack = activeDiagramStack.slice(0, segmentIndex - 1);
      setDiagramData((prev) =>
        updateDiagramAtStack(prev, parentStack, (current) => ({
          ...current,
          nodes: current.nodes.map((n) =>
            n.id === seg.fromNodeId ? { ...n, label: newLabel } : n
          ),
        }))
      );
      setActiveDiagramStack((s) =>
        s.map((x, i) =>
          i === segmentIndex - 1 ? { ...x, fromNodeLabel: newLabel } : x
        )
      );
    },
    [activeDiagramStack, setDiagramData]
  );

  const handleCreateSubDiagram = React.useCallback((nodeId: string) => {
    const subId = generateSubDiagramId();
    const node = currentDiagramData.nodes.find((n) => n.id === nodeId);
    setDiagramData((prev) => {
      const withNode = updateDiagramAtStack(prev, activeDiagramStack, (current) => ({
        ...current,
        nodes: current.nodes.map((n) => (n.id === nodeId ? { ...n, subDiagramId: subId } : n)),
      }));
      return addSubDiagramAtStack(withNode, activeDiagramStack, subId, { nodes: [], connections: [] });
    });
    setActiveDiagramStack((s) => [...s, { diagramId: subId, fromNodeId: nodeId, fromNodeLabel: node?.label || 'Sub-diagram' }]);
    setSelectedItem(null);
  }, [generateSubDiagramId, currentDiagramData, activeDiagramStack, setDiagramData]);

  /** Restore viewState when navigating to a diagram; use fitToView if no saved state */
  React.useEffect(() => {
    if (!isPrimaryPresentationSlideActive) return;
    const stackKey = JSON.stringify(activeDiagramStack);
    if (lastRestoredStackRef.current === stackKey) return;
    lastRestoredStackRef.current = stackKey;

    const targetDiagram = getDiagramAtStack(diagramData, activeDiagramStack);
    const vs = sanitizeViewState(targetDiagram?.viewState);
    if (vs) {
      setCanvasTransform(vs);
    } else {
      const t = setTimeout(() => editorRef.current?.fitToView(), 100);
      return () => clearTimeout(t);
    }
  }, [activeDiagramStack, diagramData, isPrimaryPresentationSlideActive, setCanvasTransform]);

  /** True when node has subDiagramId and the sub exists (at current level or root for legacy) */
  const getHasLinkedSubDiagram = React.useCallback((node: DiagramNodeData) => {
    if (!node.subDiagramId) return false;
    const subId = node.subDiagramId;
    if (currentDiagramData.subDiagrams?.[subId]) return true;
    if (activeDiagramStack.length > 0 && diagramData.subDiagrams?.[subId]) return true;
    return false;
  }, [currentDiagramData, activeDiagramStack, diagramData]);

  const handleRemoveSubDiagramLink = React.useCallback((nodeId: string) => {
    const node = currentDiagramData.nodes.find((n) => n.id === nodeId);
    const subId = node?.subDiagramId;
    if (!subId) return;
    setDiagramData((prev) => {
      const withoutLink = updateDiagramAtStack(prev, activeDiagramStack, (current) => ({
        ...current,
        nodes: current.nodes.map((n) => (n.id === nodeId ? { ...n, subDiagramId: undefined } : n)),
      }));
      return removeSubDiagramAtStack(withoutLink, activeDiagramStack, subId);
    });
    if (activeDiagramStack.some((s) => s.diagramId === subId)) {
      setActiveDiagramStack((s) => s.filter((seg) => seg.diagramId !== subId));
    }
    setSelectedItem(null);
  }, [currentDiagramData, activeDiagramStack, setDiagramData]);

  const handleConnect = (targetItem: DiagramNodeData) => {
    const pendingIdsRaw = (window as unknown as { pendingConnectionSourceIds?: string[] }).pendingConnectionSourceIds;
    const pendingSingle = (window as unknown as { pendingConnectionSourceId?: string }).pendingConnectionSourceId;
    let sourceIds: string[] = Array.isArray(pendingIdsRaw) && pendingIdsRaw.length > 0
      ? pendingIdsRaw
      : pendingSingle
        ? [pendingSingle]
        : selectedItem?.itemType === 'node'
          ? [selectedItem.id]
          : [];

    const seen = new Set<string>();
    sourceIds = sourceIds.filter((id) => {
      if (!id || id === targetItem.id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    sourceIds = sourceIds.filter((id) => {
      const srcNode = currentDiagramData.nodes.find((n) => n.id === id);
      return !(srcNode && isTimelineNodeType(srcNode.type));
    });

    if (!isConnectMode || sourceIds.length === 0) {
      clearPendingConnectionWindowState();
      setIsConnectMode(false);
      return;
    }

    if (isConnectorLikeSpineNodeType(targetItem.type)) {
      return;
    }

    const connectionOptions = (window as unknown as { pendingConnectionOptions?: { style?: string; curvature?: number } }).pendingConnectionOptions || {};

    clearPendingConnectionWindowState();

    const connStyle: DiagramConnectionData['style'] =
      connectionOptions.style === 'orthogonal' ? 'orthogonal' : 'bezier';
    const connCurvature = connStyle === 'bezier' ? (connectionOptions.curvature ?? 0.5) : undefined;

    const newConnections: DiagramConnectionData[] = sourceIds.map((fromId) => ({
      id: generateConnectionId(),
      from: fromId,
      to: targetItem.id,
      style: connStyle,
      curvature: connCurvature,
      animation: toConnectionAnimationPatch(DEFAULT_CONNECTION_ANIMATION),
    }));

    setCurrentDiagramData((prevData) => ({
      ...prevData,
      connections: [...prevData.connections, ...newConnections],
    }));

    recordDiagramChange({ op: "add-connections", connections: newConnections });

    setIsConnectMode(false);
    setSelectedItem(null); // Deselect after connecting
  };

  const startConnecting = (connectionOptions?: { style?: 'pathways' | 'bezier', curvature?: number; sourceItemId?: string }) => {
    let sourceIds: string[];
    if (connectionOptions?.sourceItemId) {
      sourceIds = [connectionOptions.sourceItemId];
    } else {
      sourceIds = collectConnectSourceIdsFromDiagram(selectedItemIds, currentDiagramData);
      if (sourceIds.length === 0 && selectedItem?.itemType === 'node') {
        sourceIds = [selectedItem.id];
      }
    }

    sourceIds = sourceIds.filter((id) => {
      const n = currentDiagramData.nodes.find((nn) => nn.id === id);
      return !(n && isTimelineNodeType(n.type));
    });

    if (sourceIds.length === 0) return;

    setIsConnectMode(true);
    (window as unknown as { pendingConnectionSourceIds: string[] }).pendingConnectionSourceIds = sourceIds;
    (window as unknown as { pendingConnectionOptions?: unknown }).pendingConnectionOptions = connectionOptions;
  }

  const tryDeleteConnectorLineVertexBeforeNodeDelete = React.useCallback(
    (nodeId: string): boolean => {
      const f = connectorLineFocusedVertex;
      if (!f || f.nodeId !== nodeId) return false;
      const node = currentDiagramData.nodes.find((n) => n.id === nodeId);
      if (!node || !isConnectorLikeSpineNodeType(node.type)) return false;
      const wasClosed = isConnectorLineGeometryClosed(node);
      const nextGeom = removeConnectorLineVertexAtIndex(node, f.vertexIndex);
      if (!nextGeom) return false;
      const isNowClosed = isConnectorLineGeometryClosed(nextGeom);
      let synced = nextGeom;
      if (isNowClosed) {
        synced = syncClosedConnectorLineBorderWidth(synced);
        if (!wasClosed && isNowClosed) {
          synced = syncClosedConnectorVisualBorderFromLineStyling(synced);
        }
      }
      setCurrentDiagramData((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) => (n.id === synced.id ? synced : n)),
      }));
      setConnectorLineFocusedVertex(null);
      setSelectedItem({ ...synced, itemType: 'node' });
      return true;
    },
    [
      connectorLineFocusedVertex,
      currentDiagramData,
      setCurrentDiagramData,
      setSelectedItem,
    ],
  );

  const handleItemDelete = React.useCallback(
    (itemToDelete: SelectedItem) => {
      if (
        itemToDelete.itemType === 'node' &&
        currentDiagramData.nodes.find((n) => n.id === itemToDelete.id)?.locked
      ) {
        return;
      }

      if (
        itemToDelete.itemType === 'node' &&
        isConnectorLikeSpineNodeType(itemToDelete.type) &&
        tryDeleteConnectorLineVertexBeforeNodeDelete(itemToDelete.id)
      ) {
        return;
      }

      const deleteIds =
        itemToDelete.itemType === 'edge'
          ? [
              itemToDelete.id ||
                `${(itemToDelete as { from: string; to: string }).from}-${(itemToDelete as { from: string; to: string }).to}`,
            ]
          : [itemToDelete.id];

      const nextDiagram = deleteDiagramItemsByIds(currentDiagramData, deleteIds);
      if (!nextDiagram) return;

      recordDiagramChange({ op: "delete-items", ids: deleteIds });
      setCurrentDiagramData(nextDiagram);
      setSelectedItem(null);
      setSelectedItemIds(new Set());
    },
    [
      currentDiagramData,
      setCurrentDiagramData,
      setSelectedItem,
      setSelectedItemIds,
      tryDeleteConnectorLineVertexBeforeNodeDelete,
    ],
  );

  const disconnectSelected = () => {
    if (!selectedItem || selectedItem.itemType !== 'node') return;
    const id = selectedItem.id;
    recordDiagramChange({ op: "disconnect-node", nodeId: id });
    setDiagramData(prevData => ({
      ...prevData,
      connections: prevData.connections.filter((e: any) => e.from !== id && e.to !== id),
    }));
    toast({ title: 'Disconnected', description: 'All connections to/from this item have been removed.' });
  };

  const persistPresentationSlideFromDiagram = React.useCallback((nextDiagram: DiagramData) => {
    if (!activePresentationDeckId || !activePresentationSlideId) return;
    if (
      activePresentationPrimarySlideId &&
      activePresentationSlideId === activePresentationPrimarySlideId
    ) {
      return;
    }

    const masterRaw = presentationMasterDiagram ?? tabDiagramData;
    const nextRaw = nextDiagram;

    setPresentationDecks((prev) => prev.map((deck) => {
      if (deck.id !== activePresentationDeckId) return deck;
      const slideIdx = deck.slides.findIndex((s) => s.id === activePresentationSlideId);
      const mode = getPresentationDeltaMode(deck);
      let nextDelta: DiagramDelta;
      if (mode === 'master' || slideIdx <= 0) {
        nextDelta = computeDiagramDelta(masterRaw, nextRaw);
      } else {
        const prevBase = cumulativeDiagramThroughSlideIndex(masterRaw, deck.slides, slideIdx - 1);
        nextDelta = computeDiagramDelta(prevBase, nextRaw);
      }
      return {
        ...deck,
        slides: deck.slides.map((slide) => (
          slide.id === activePresentationSlideId
            ? { ...slide, diagramDelta: nextDelta }
            : slide
        )),
        updatedAt: Date.now(),
      };
    }));
  }, [
    activePresentationDeckId,
    activePresentationSlideId,
    presentationMasterDiagram,
    tabDiagramData,
    activePresentationPrimarySlideId,
  ]);

  React.useEffect(() => {
    if (presentationPersistSuppressedForExportRef.current) return;
    if (!activePresentationDeckId || !activePresentationSlideId) return;
    if (
      activePresentationPrimarySlideId &&
      activePresentationSlideId === activePresentationPrimarySlideId
    ) {
      return;
    }
    if (!presentationDraftDiagram) return;
    persistPresentationSlideFromDiagram(presentationDraftDiagram);
  }, [
    activePresentationDeckId,
    activePresentationSlideId,
    activePresentationPrimarySlideId,
    presentationDraftDiagram,
    persistPresentationSlideFromDiagram,
  ]);

  const { captureOutgoingSlideThumbnailIfNeeded } = usePresentationThumbnails({
    editorRef,
    presentationDecksRef,
    presentationDraftDiagramRef,
    presentationMasterDiagramRef,
    tabDiagramDataRef,
    presentationThumbDeltaFingerprintBySlideRef,
    presentationThumbFingerprintSlideKeyRef,
    presentationDraftDiagram,
    presentationMasterDiagram,
    tabDiagramData,
    activePresentationDeckId,
    activePresentationSlideId,
    activeTabId,
    presentationThumbnailFitUnionDiagrams,
    presentationDeckIdentityKey,
    setPresentationDecks,
    setActivePresentationDeckId,
    setActivePresentationSlideId,
    setPresentationDraftDiagram,
    canvasGeometryInteractionActive,
    presentationThumbnailInteractionRef,
    presentationThumbnailUpdatesEnabled,
    onPresentationThumbnailGeneratingChange: setPresentationThumbnailGenerating,
  });

  const activeStripSlideIndex =
    activePresentationDeck && activePresentationSlideId
      ? activePresentationSlides.findIndex((s) => s.id === activePresentationSlideId)
      : -1;
  const hasLaterSlides =
    activeStripSlideIndex >= 0 && activeStripSlideIndex < activePresentationSlides.length - 1;

  const handlePropagateAddToLaterSlides = React.useCallback(() => {
    if (!activePresentationDeckId || !selectedItem || !hasLaterSlides) return;
    const draftSource = presentationDraftDiagram ?? tabDiagramData;
    const presentationBase = presentationMasterDiagram ?? tabDiagramData;
    let itemToAdd: DiagramNodeData | DiagramConnectionData | null = null;
    if (selectedItem.itemType === 'node') {
      const node = draftSource.nodes.find((n) => n.id === selectedItem.id);
      if (node) itemToAdd = { ...node };
    } else if (selectedItem.itemType === 'edge') {
      const connId = (selectedItem as { id?: string }).id;
      const conn = (draftSource.connections || []).find(
        (c) => (connId && (c as DiagramConnectionData).id === connId) || (c.from === selectedItem.from && c.to === selectedItem.to)
      );
      if (conn) itemToAdd = { ...conn };
    }
    if (!itemToAdd) return;

    setPresentationDecks((prev) =>
      prev.map((deck) => {
        if (deck.id !== activePresentationDeckId) return deck;
        const currentIdx = activePresentationSlideId
          ? deck.slides.findIndex((s) => s.id === activePresentationSlideId)
          : -1;
        if (activePresentationSlideId && currentIdx < 0) return deck;
        const mode = getPresentationDeltaMode(deck);
        if (mode === 'master') {
          const nextSlides = deck.slides.map((slide, idx) => {
            if (idx <= currentIdx) return slide;
            const slideDiagram = applyDiagramDelta(presentationBase, slide.diagramDelta);
            let nextDiagram: DiagramData;
            if (itemToAdd && 'from' in itemToAdd && 'to' in itemToAdd) {
              const conn = itemToAdd as DiagramConnectionData;
              const existing = (slideDiagram.connections || []).some(
                (c) =>
                  (conn.id && (c as DiagramConnectionData).id === conn.id) ||
                  (c.from === conn.from && c.to === conn.to),
              );
              if (existing) return slide;
              nextDiagram = {
                ...slideDiagram,
                connections: [...(slideDiagram.connections || []), ensureConnectionIds([conn])[0]],
              };
            } else if (itemToAdd && 'type' in itemToAdd) {
              const node = itemToAdd as DiagramNodeData;
              if (slideDiagram.nodes.some((n) => n.id === node.id)) return slide;
              nextDiagram = {
                ...slideDiagram,
                nodes: [...slideDiagram.nodes, node],
              };
            } else {
              return slide;
            }
            const nextDelta = computeDiagramDelta(presentationBase, nextDiagram);
            return { ...slide, diagramDelta: nextDelta };
          });
          return { ...deck, slides: nextSlides, updatedAt: Date.now() };
        }

        const absolutes = [...resolvePresentationSlideDiagrams(presentationBase, deck.slides, 'chain')];
        for (let idx = currentIdx + 1; idx < deck.slides.length; idx += 1) {
          let slideDiagram = absolutes[idx];
          let nextDiagram: DiagramData;
          if (itemToAdd && 'from' in itemToAdd && 'to' in itemToAdd) {
            const conn = itemToAdd as DiagramConnectionData;
            const existing = (slideDiagram.connections || []).some(
              (c) =>
                (conn.id && (c as DiagramConnectionData).id === conn.id) ||
                (c.from === conn.from && c.to === conn.to),
            );
            if (existing) continue;
            nextDiagram = {
              ...slideDiagram,
              connections: [...(slideDiagram.connections || []), ensureConnectionIds([conn])[0]],
            };
          } else if (itemToAdd && 'type' in itemToAdd) {
            const node = itemToAdd as DiagramNodeData;
            if (slideDiagram.nodes.some((n) => n.id === node.id)) continue;
            nextDiagram = {
              ...slideDiagram,
              nodes: [...slideDiagram.nodes, node],
            };
          } else {
            continue;
          }
          absolutes[idx] = nextDiagram;
        }
        const rechained = rechainSlideDeltasFromAbsoluteDiagrams(presentationBase, deck.slides, absolutes);
        return { ...deck, slides: rechained, updatedAt: Date.now() };
      }),
    );
    toast({ title: 'Added to later slides', description: `Item added to ${activePresentationSlides.length - 1 - activeStripSlideIndex} slide(s).` });
  }, [
    activePresentationDeckId,
    activePresentationSlideId,
    selectedItem,
    hasLaterSlides,
    presentationDraftDiagram,
    presentationMasterDiagram,
    tabDiagramData,
    activePresentationSlides.length,
    activeStripSlideIndex,
  ]);

  const handlePropagateDeleteToLaterSlides = React.useCallback(() => {
    if (!activePresentationDeckId || !selectedItem || !hasLaterSlides) return;
    const presentationBase = presentationMasterDiagram ?? tabDiagramData;
    const nodeIdToRemove = selectedItem.itemType === 'node' ? selectedItem.id : null;
    const connectionToRemove =
      selectedItem.itemType === 'edge' ? { from: selectedItem.from, to: selectedItem.to, id: (selectedItem as { id?: string }).id } : null;

    setPresentationDecks((prev) =>
      prev.map((deck) => {
        if (deck.id !== activePresentationDeckId) return deck;
        const currentIdx = activePresentationSlideId
          ? deck.slides.findIndex((s) => s.id === activePresentationSlideId)
          : -1;
        if (activePresentationSlideId && currentIdx < 0) return deck;
        const mode = getPresentationDeltaMode(deck);
        if (mode === 'master') {
          const nextSlides = deck.slides.map((slide, idx) => {
            if (idx <= currentIdx) return slide;
            const slideDiagram = applyDiagramDelta(presentationBase, slide.diagramDelta);
            let nextDiagram: DiagramData;
            if (nodeIdToRemove) {
              nextDiagram = {
                ...slideDiagram,
                nodes: slideDiagram.nodes.filter((n) => n.id !== nodeIdToRemove),
                connections: (slideDiagram.connections || []).filter(
                  (c) => c.from !== nodeIdToRemove && c.to !== nodeIdToRemove,
                ),
              };
            } else if (connectionToRemove) {
              nextDiagram = {
                ...slideDiagram,
                connections: (slideDiagram.connections || []).filter((c) => {
                  if (connectionToRemove.id && (c as DiagramConnectionData).id) {
                    return (c as DiagramConnectionData).id !== connectionToRemove.id;
                  }
                  return !(c.from === connectionToRemove.from && c.to === connectionToRemove.to);
                }),
              };
            } else {
              return slide;
            }
            const nextDelta = computeDiagramDelta(presentationBase, nextDiagram);
            return { ...slide, diagramDelta: nextDelta };
          });
          return { ...deck, slides: nextSlides, updatedAt: Date.now() };
        }

        const absolutes = [...resolvePresentationSlideDiagrams(presentationBase, deck.slides, 'chain')];
        for (let idx = currentIdx + 1; idx < deck.slides.length; idx += 1) {
          let slideDiagram = absolutes[idx];
          let nextDiagram: DiagramData;
          if (nodeIdToRemove) {
            nextDiagram = {
              ...slideDiagram,
              nodes: slideDiagram.nodes.filter((n) => n.id !== nodeIdToRemove),
              connections: (slideDiagram.connections || []).filter(
                (c) => c.from !== nodeIdToRemove && c.to !== nodeIdToRemove,
              ),
            };
          } else if (connectionToRemove) {
            nextDiagram = {
              ...slideDiagram,
              connections: (slideDiagram.connections || []).filter((c) => {
                if (connectionToRemove.id && (c as DiagramConnectionData).id) {
                  return (c as DiagramConnectionData).id !== connectionToRemove.id;
                }
                return !(c.from === connectionToRemove.from && c.to === connectionToRemove.to);
              }),
            };
          } else {
            continue;
          }
          absolutes[idx] = nextDiagram;
        }
        const rechained = rechainSlideDeltasFromAbsoluteDiagrams(presentationBase, deck.slides, absolutes);
        return { ...deck, slides: rechained, updatedAt: Date.now() };
      })
    );
    toast({ title: 'Removed from later slides', description: `Item removed from ${activePresentationSlides.length - 1 - activeStripSlideIndex} slide(s).` });
  }, [
    activePresentationDeckId,
    activePresentationSlideId,
    selectedItem,
    hasLaterSlides,
    presentationMasterDiagram,
    tabDiagramData,
    activePresentationSlides.length,
    activeStripSlideIndex,
  ]);

  const disconnectConnection = React.useCallback((from: string, to: string, connectionId?: string) => {
    const nextDiagram: DiagramData = {
      ...diagramData,
      connections: diagramData.connections.filter((e: DiagramConnectionData) => {
        if (connectionId && (e as DiagramConnectionData).id) return (e as DiagramConnectionData).id !== connectionId;
        return !(e.from === from && e.to === to);
      }),
    };

    setDiagramData(nextDiagram);

    if (selectedItem && selectedItem.itemType === 'edge') {
      const match = (selectedItem.from === from && selectedItem.to === to) &&
        (!connectionId || (selectedItem as { id?: string }).id === connectionId);
      if (match) setSelectedItem(null);
    }
    toast({ title: 'Connection Disconnected', description: 'Connection has been removed.' });
  }, [diagramData, selectedItem, setDiagramData, setSelectedItem]);

  const handleTabRename = React.useCallback(
    (tabId: string, name: string) => {
      const trimmed = name.trim();
      const tab = getTab(tabId);
      if (!tab) return;
      const next = trimmed || tab.name;
      if (next === tab.name) return;
      updateTab(tabId, { name: next });
    },
    [getTab, updateTab],
  );

  const handleSave = createDiagramSaveHandler({
    activeTabId,
    activeTab,
    getTab,
    updateTab,
    markTabAsSaved,
    toast: toast as DiagramEditorToastFn,
    presentationMasterDiagram,
    presentationDecks,
    activePresentationDeckId,
  });

  const handleLoadClick = () => {
    fileInputRef.current?.click();
  };

  const handleMermaidImportClick = () => {
    mermaidInputRef.current?.click();
  };

  const handleMermaidFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') return;
        const diagramType = detectMermaidDiagramType(text);
        if (diagramType === 'sequenceDiagram') {
          const parsed = parseMermaidSequenceDiagram(text);
          if (parsed.participants.length === 0 && parsed.messages.length === 0) {
            throw new Error('No valid sequence diagram content found. Expected: sequenceDiagram followed by participant and message definitions.');
          }
          if (parsed.errors.length > 0) {
            const errMsg = parsed.errors.join('; ');
            console.error('[Mermaid Import] Sequence diagram parse issues:', { errors: parsed.errors });
            throw new Error(`Sequence diagram parse issues: ${errMsg}`);
          }
          const completeData = sequenceDiagramToDiagramData(parsed);
          completeData.connections = ensureConnectionIds(completeData.connections || []);
          setDiagramData({ nodes: [], connections: [], groupings: [] });
          setTimeout(() => {
            setDiagramData(completeData);
            setSelectedItem(null);
            toast({ title: 'Mermaid Imported', description: 'Your sequence diagram has been successfully imported.' });
            setTimeout(() => editorRef.current?.fitToView(), 100);
          }, 0);
          return;
        }
        if (diagramType === 'classDiagram') {
          const parsed = parseMermaidClassDiagram(text);
          if (parsed.classes.length === 0 && parsed.edges.length === 0) {
            throw new Error('No valid class diagram content found. Expected: classDiagram followed by class and inheritance definitions.');
          }
          if (parsed.errors.length > 0) {
            const errMsg = parsed.errors.join('; ');
            console.error('[Mermaid Import] Class diagram parse issues:', { errors: parsed.errors });
            throw new Error(`Class diagram parse issues: ${errMsg}`);
          }
          let completeData = classDiagramToDiagramData(parsed);
          completeData.connections = ensureConnectionIds(completeData.connections || []);
          setDiagramData({ nodes: [], connections: [], groupings: [] });
          setTimeout(() => {
            setDiagramData(completeData);
            setSelectedItem(null);
            toast({ title: 'Mermaid Imported', description: 'Your class diagram has been successfully imported.' });
            setTimeout(() => editorRef.current?.fitToView(), 100);
          }, 0);
          return;
        }
        const parsed = parseMermaidFlowchart(text);
        if (parsed.nodes.length === 0 && parsed.edges.length === 0) {
          throw new Error('No valid flowchart content found. Expected: flowchart TD or flowchart LR followed by node and edge definitions.');
        }
        if (parsed.errors.length > 0) {
          const errMsg = parsed.errors.join('; ');
          console.error('[Mermaid Import] Parse issues:', { errors: parsed.errors, nodes: parsed.nodes.length, edges: parsed.edges.length });
          throw new Error(`Mermaid parse issues: ${errMsg}`);
        }
        let completeData = await mermaidToDiagramData(parsed);
        setDiagramData({ nodes: [], connections: [], groupings: [] });
        setTimeout(() => {
          setDiagramData(completeData);
          setSelectedItem(null);
          toast({ title: 'Mermaid Imported', description: 'Your diagram has been successfully imported.' });
          setTimeout(() => editorRef.current?.fitToView(), 100);
        }, 0);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'An unknown error occurred';
        const stack = error instanceof Error ? error.stack : undefined;
        console.error('[Mermaid Import] Error:', { message, stack, file: file?.name });
        toast({ variant: 'destructive', title: 'Error Importing Mermaid', description: message });
      }
    };
    reader.readAsText(file);
    if (event.target) event.target.value = '';
  };

  const parseUnknownJsonToDiagramData = React.useCallback(
    (json: unknown) => parseDiagramJson(json),
    []
  );

  const extractPresentationsFromDiagramJson = React.useCallback((json: unknown): {
    decks: PresentationDeck[];
    activeDeckId: string | null;
  } => {
    const base = parseDiagramJsonSync(json);
    const extracted = extractEmbeddedPresentations(json, base);
    return collapsePresentationDecksToOne(extracted.decks, extracted.activeDeckId);
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const text = e.target?.result;
          if (typeof text !== 'string') return;
          const ext = file.name.toLowerCase().slice(-5);
          const diagramType = detectMermaidDiagramType(text);
          const isMermaid = /\.(mmd|mermaid)$/.test(file.name.toLowerCase())
            || diagramType !== null;
          let completeData: DiagramData;
          let loadedPresentations: { decks: PresentationDeck[]; activeDeckId: string | null } = {
            decks: [],
            activeDeckId: null,
          };

          if (isMermaid && diagramType === 'sequenceDiagram') {
            const parsed = parseMermaidSequenceDiagram(text);
            if (parsed.participants.length === 0 && parsed.messages.length === 0) {
              throw new Error('No valid sequence diagram content found.');
            }
            if (parsed.errors.length > 0) {
              throw new Error(`Sequence diagram parse issues: ${parsed.errors.join('; ')}`);
            }
            completeData = sequenceDiagramToDiagramData(parsed);
          } else if (isMermaid && diagramType === 'classDiagram') {
            const parsed = parseMermaidClassDiagram(text);
            if (parsed.classes.length === 0 && parsed.edges.length === 0) {
              throw new Error('No valid class diagram content found. Expected: classDiagram followed by class and inheritance definitions.');
            }
            if (parsed.errors.length > 0) {
              const errMsg = parsed.errors.join('; ');
              console.error('[Mermaid Load] Class diagram parse issues:', { errors: parsed.errors });
              throw new Error(`Class diagram parse issues: ${errMsg}`);
            }
            completeData = classDiagramToDiagramData(parsed);
          } else if (isMermaid) {
            const parsed = parseMermaidFlowchart(text);
            if (parsed.nodes.length === 0 && parsed.edges.length === 0) {
              throw new Error('No valid flowchart content found. Expected: flowchart TD or flowchart LR followed by node and edge definitions.');
            }
            if (parsed.errors.length > 0) {
              const errMsg = parsed.errors.join('; ');
              console.error('[Mermaid Load] Parse issues:', { errors: parsed.errors, nodes: parsed.nodes.length, edges: parsed.edges.length });
              throw new Error(`Mermaid parse issues: ${errMsg}`);
            }
            let mermaidData = await mermaidToDiagramData(parsed);
            completeData = mermaidData;
          } else {
            const jsonData = parseImportJsonText(text);
            completeData = await parseUnknownJsonToDiagramData(jsonData);
            loadedPresentations = extractPresentationsFromDiagramJson(jsonData);
          }
          completeData.connections = ensureConnectionIds(completeData.connections || []);

          setDiagramData({ nodes: [], connections: [], groupings: [] });
          absorbDiagramUserDefinedObjects(completeData, { notifyEachCreated: true });
          setTimeout(() => {
            setDiagramData(completeData);
            setSelectedItem(null);
            setPresentationDecks(loadedPresentations.decks);
            setActivePresentationDeckId(loadedPresentations.activeDeckId);
            const loadDeck =
              loadedPresentations.decks.find((d) => d.id === loadedPresentations.activeDeckId) ??
              loadedPresentations.decks[0];
            setActivePresentationSlideId(loadDeck?.slides[0]?.id ?? null);
            setSelectedPresentationSlideIds(new Set());
            setPresentationMasterDiagram(safeClone(completeData));
            updateActiveTab({ name: getFilenameStem(file.name), hasUnsavedPresentations: false });
            toast({ title: 'Diagram Loaded', description: 'Your diagram has been successfully loaded.' });
            setTimeout(() => editorRef.current?.fitToView(), 100);
          }, 0);
        } catch (error) {
          const message = error instanceof Error ? error.message : "An unknown error occurred";
          const stack = error instanceof Error ? error.stack : undefined;
          console.error('[Diagram Load] Error:', { message, stack, file: file?.name });
          toast({
            variant: 'destructive',
            title: 'Error Loading Diagram',
            description: `Could not load or parse the file. ${message}`,
          });
        }
      };
      reader.readAsText(file);
    }
    if (event.target) event.target.value = '';
  };

  const handleImportIntoSubDiagramClick = React.useCallback(() => {
    subDiagramImportInputRef.current?.click();
  }, []);

  const handleSubDiagramFileChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || activeDiagramStack.length === 0) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') return;
        const diagramType = detectMermaidDiagramType(text);
        const isMermaid = /\.(mmd|mermaid)$/.test(file.name.toLowerCase()) || diagramType !== null;
        let completeData: DiagramData;

        if (isMermaid && diagramType === 'sequenceDiagram') {
          const parsed = parseMermaidSequenceDiagram(text);
          if (parsed.participants.length === 0 && parsed.messages.length === 0) {
            throw new Error('No valid sequence diagram content found.');
          }
          completeData = sequenceDiagramToDiagramData(parsed);
        } else if (isMermaid && diagramType === 'classDiagram') {
          const parsed = parseMermaidClassDiagram(text);
          if (parsed.classes.length === 0 && parsed.edges.length === 0) {
            throw new Error('No valid class diagram content found.');
          }
          completeData = classDiagramToDiagramData(parsed);
        } else if (isMermaid) {
          const parsed = parseMermaidFlowchart(text);
          if (parsed.nodes.length === 0 && parsed.edges.length === 0) {
            throw new Error('No valid flowchart content found.');
          }
          completeData = await mermaidToDiagramData(parsed);
        } else {
          const jsonData = parseImportJsonText(text);
          completeData = await parseUnknownJsonToDiagramData(jsonData);
        }
        completeData.connections = ensureConnectionIds(completeData.connections || []);
        const existingIds = collectAllIdsInDiagram(diagramData);
        const sanitized = sanitizeImportedDiagram(completeData, existingIds);
        absorbDiagramUserDefinedObjects(sanitized, { notify: true });
        setCurrentDiagramData(sanitized);
        setSelectedItem(null);
        toast({ title: 'Sub-diagram imported', description: 'The diagram has been imported into this sub-diagram.' });
        setTimeout(() => editorRef.current?.fitToView(), 100);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'An unknown error occurred';
        toast({
          variant: 'destructive',
          title: 'Error importing diagram',
          description: `Could not load or parse the file. ${message}`,
        });
      }
    };
    reader.readAsText(file);
    if (event.target) event.target.value = '';
  }, [activeDiagramStack.length, diagramData, parseUnknownJsonToDiagramData, absorbDiagramUserDefinedObjects, setCurrentDiagramData, toast]);

  const hasConnectionAnimationSettings = React.useCallback((connection: DiagramConnectionData) => {
    const animation = connection.animation;
    if (!animation) return false;
    return (
      animation.enabled === true ||
      animation.color !== undefined ||
      animation.shape !== undefined ||
      animation.speed !== undefined ||
      animation.size !== undefined ||
      animation.autoCount !== undefined ||
      animation.shapeCount !== undefined ||
      animation.spacing !== undefined
    );
  }, []);

  const applyConnectionUpdates = React.useCallback((
    from: string,
    to: string,
    updates: {
      text?: string;
      color?: string;
      textPosition?: number;
      lineWidth?: number;
      lineWidthLock?: boolean;
      lineWidthEnd?: number;
      colorLock?: boolean;
      colorEnd?: string;
      shadow?: boolean;
      style?: 'bezier' | 'orthogonal';
      smoothCorners?: boolean;
      curvature?: number;
      fromPreferredExit?: 'top' | 'bottom' | 'left' | 'right' | 'center';
      fromArrow?: boolean;
      toPreferredEntry?: 'top' | 'bottom' | 'left' | 'right' | 'center';
      toArrow?: boolean;
      arrow?: boolean;
      centerEdgeAnchors?: boolean;
      edgeAttachmentConstraint?: DiagramConnectionData['edgeAttachmentConstraint'];
      waypoints?: Array<{ x: number; y: number; id?: string }>;
      orthogonalTrunkOffsetX?: number;
      orthogonalTrunkOffsetY?: number;
      orthogonalCustomRoute?: boolean;
      metaData?: Record<string, string>;
      animation?: DiagramConnectionData['animation'];
    },
    connectionId?: string,
    applyToConnectionIds?: string[]
  ) => {
    const multiById =
      applyToConnectionIds && applyToConnectionIds.length > 0 ? new Set(applyToConnectionIds) : null;

    recordDiagramChange({
      op: "update-connection",
      connectionId,
      from,
      to,
      patch: updates as Record<string, unknown>,
      applyToConnectionIds,
    });

    setCurrentDiagramData((prevData) => ({
      ...prevData,
      connections: (prevData.connections ?? []).map((conn, idx) => {
        const stableId = stableDiagramConnectionId(conn as DiagramConnectionData, idx);
        const match = multiById
          ? multiById.has(stableId)
          : connectionId
            ? (conn as DiagramConnectionData).id === connectionId
            : (conn.from === from && conn.to === to);
        if (!match) return conn;
        const merged = { ...conn, ...updates } as DiagramConnectionData;
        if (updates.lineWidthLock === true) {
          delete merged.lineWidthEnd;
          delete merged.lineWidthLock;
        }
        if (updates.colorLock === true) {
          delete merged.colorEnd;
          delete merged.colorLock;
        }
        if (updates.smoothCorners === false) {
          delete merged.smoothCorners;
        }
        if (updates.centerEdgeAnchors === false) {
          delete merged.centerEdgeAnchors;
        }
        if (
          'edgeAttachmentConstraint' in updates &&
          (updates.edgeAttachmentConstraint === undefined || updates.edgeAttachmentConstraint === 'auto')
        ) {
          delete merged.edgeAttachmentConstraint;
        }
        if ('fromPreferredExit' in updates && updates.fromPreferredExit === undefined) {
          delete merged.fromPreferredExit;
        }
        if ('toPreferredEntry' in updates && updates.toPreferredEntry === undefined) {
          delete merged.toPreferredEntry;
        }
        if ('fromEdgePosition' in updates && updates.fromEdgePosition === undefined) {
          delete merged.fromEdgePosition;
        }
        if ('toEdgePosition' in updates && updates.toEdgePosition === undefined) {
          delete merged.toEdgePosition;
        }
        if ('orthogonalTrunkOffsetX' in updates && updates.orthogonalTrunkOffsetX === undefined) {
          delete merged.orthogonalTrunkOffsetX;
        }
        if ('orthogonalTrunkOffsetY' in updates && updates.orthogonalTrunkOffsetY === undefined) {
          delete merged.orthogonalTrunkOffsetY;
        }
        if ('orthogonalCustomRoute' in updates && updates.orthogonalCustomRoute !== true) {
          delete merged.orthogonalCustomRoute;
        }
        if ('waypoints' in updates && updates.waypoints === undefined) {
          delete merged.waypoints;
        }
        return merged;
      }),
    }));
    if (selectedItem && selectedItem.itemType === 'edge') {
      const sid = (selectedItem as { id?: string }).id;
      const match = multiById
        ? !!(sid && multiById.has(sid))
        : connectionId
          ? sid === connectionId
          : (selectedItem.from === from && selectedItem.to === to);
      if (match) {
        const next = { ...selectedItem, ...updates } as DiagramConnectionData & { itemType: 'edge'; id: string };
        if (updates.lineWidthLock === true) {
          delete (next as DiagramConnectionData).lineWidthEnd;
          delete (next as DiagramConnectionData).lineWidthLock;
        }
        if (updates.colorLock === true) {
          delete (next as DiagramConnectionData).colorEnd;
          delete (next as DiagramConnectionData).colorLock;
        }
        if ('fromPreferredExit' in updates && updates.fromPreferredExit === undefined) {
          delete (next as DiagramConnectionData).fromPreferredExit;
        }
        if ('toPreferredEntry' in updates && updates.toPreferredEntry === undefined) {
          delete (next as DiagramConnectionData).toPreferredEntry;
        }
        if ('fromEdgePosition' in updates && updates.fromEdgePosition === undefined) {
          delete (next as DiagramConnectionData).fromEdgePosition;
        }
        if ('toEdgePosition' in updates && updates.toEdgePosition === undefined) {
          delete (next as DiagramConnectionData).toEdgePosition;
        }
        if ('orthogonalTrunkOffsetX' in updates && updates.orthogonalTrunkOffsetX === undefined) {
          delete (next as DiagramConnectionData).orthogonalTrunkOffsetX;
        }
        if ('orthogonalTrunkOffsetY' in updates && updates.orthogonalTrunkOffsetY === undefined) {
          delete (next as DiagramConnectionData).orthogonalTrunkOffsetY;
        }
        setSelectedItem(next as SelectedItem);
      }
    }
  }, [selectedItem, setCurrentDiagramData, setSelectedItem]);

  const applyAnimationToCurrentAndSelected = React.useCallback((
    from: string,
    to: string,
    updates: {
      text?: string;
      color?: string;
      textPosition?: number;
      lineWidth?: number;
      shadow?: boolean;
      style?: 'bezier' | 'orthogonal';
      smoothCorners?: boolean;
      curvature?: number;
      fromPreferredExit?: 'top' | 'bottom' | 'left' | 'right' | 'center';
      fromArrow?: boolean;
      toPreferredEntry?: 'top' | 'bottom' | 'left' | 'right' | 'center';
      toArrow?: boolean;
      arrow?: boolean;
      waypoints?: Array<{ x: number; y: number; id?: string }>;
      metaData?: Record<string, string>;
      animation?: DiagramConnectionData['animation'];
    },
    selectedConnectionIds: string[],
    currentConnectionId?: string
  ) => {
    setCurrentDiagramData((prevData) => ({
      ...prevData,
      connections: (prevData.connections ?? []).map((conn, idx) => {
        const stable = stableDiagramConnectionId(conn as DiagramConnectionData, idx);
        const connId = (conn as DiagramConnectionData).id;
        const isCurrent = currentConnectionId
          ? connId === currentConnectionId || stable === currentConnectionId
          : conn.from === from && conn.to === to;
        if (isCurrent) return { ...conn, ...updates };
        const peerMatch =
          selectedConnectionIds.includes(stable) ||
          (!!connId && selectedConnectionIds.includes(connId));
        if (peerMatch && updates.animation) {
          return { ...conn, animation: updates.animation };
        }
        return conn;
      }),
    }));

    if (selectedItem && selectedItem.itemType === 'edge') {
      const match = currentConnectionId ? (selectedItem as { id?: string }).id === currentConnectionId : (selectedItem.from === from && selectedItem.to === to);
      if (match) setSelectedItem({ ...selectedItem, ...updates });
    }
  }, [selectedItem, setCurrentDiagramData, setSelectedItem]);

  const resetPendingAnimationDialogs = React.useCallback(() => {
    setAnimationSelectionDialogOpen(false);
    setAnimationOverwriteDialogOpen(false);
    setAnimationDisableConfirmDialogOpen(false);
    setPendingAnimationUpdate(null);
  }, []);

  const handleConnectionUpdate = React.useCallback((from: string, to: string, updates: { text?: string; color?: string; textPosition?: number; lineWidth?: number; lineWidthLock?: boolean; lineWidthEnd?: number; colorLock?: boolean; colorEnd?: string; shadow?: boolean; style?: 'bezier' | 'orthogonal'; smoothCorners?: boolean; curvature?: number; fromPreferredExit?: 'top' | 'bottom' | 'left' | 'right' | 'center'; fromArrow?: boolean; toPreferredEntry?: 'top' | 'bottom' | 'left' | 'right' | 'center'; toArrow?: boolean; arrow?: boolean; centerEdgeAnchors?: boolean; edgeAttachmentConstraint?: DiagramConnectionData['edgeAttachmentConstraint']; waypoints?: Array<{ x: number; y: number; id?: string }>; orthogonalTrunkOffsetX?: number; orthogonalTrunkOffsetY?: number; orthogonalCustomRoute?: boolean; metaData?: Record<string, string>; animation?: DiagramConnectionData['animation'] }, connectionId?: string) => {
    const effectiveConnId = connectionId ?? (selectedItem?.itemType === 'edge' ? (selectedItem as { id?: string }).id : undefined);
    const connections = currentDiagramData.connections ?? [];
    const resolvedEdgeIds = connectionIdsFromSelectionSet(selectedItemIds, connections as DiagramConnectionData[]);

    let currentIdx = -1;
    for (let i = 0; i < connections.length; i++) {
      const conn = connections[i] as DiagramConnectionData;
      if (effectiveConnId) {
        if (conn.id === effectiveConnId || stableDiagramConnectionId(conn, i) === effectiveConnId) {
          currentIdx = i;
          break;
        }
      } else if (conn.from === from && conn.to === to) {
        currentIdx = i;
        break;
      }
    }
    const currentConn = currentIdx >= 0 ? (connections[currentIdx] as DiagramConnectionData) : undefined;
    const currentStableKey =
      currentIdx >= 0 && currentConn !== undefined ? stableDiagramConnectionId(currentConn, currentIdx) : effectiveConnId;

    const isEnablingAnimation = updates.animation?.enabled === true && currentConn?.animation?.enabled !== true;
    const isDisablingAnimation = updates.animation?.enabled === false && currentConn?.animation?.enabled === true;
    const selectedConnectionIds = resolvedEdgeIds.filter((id) => id !== currentStableKey);

    const updatesTouchWaypoints = Object.prototype.hasOwnProperty.call(updates, 'waypoints');
    const fanOutMultiEdges = resolvedEdgeIds.length > 1 && !updatesTouchWaypoints;
    const applyIds = fanOutMultiEdges ? resolvedEdgeIds : undefined;

    if (isEnablingAnimation || isDisablingAnimation) {
      if (selectedConnectionIds.length > 0) {
        setPendingAnimationUpdate({
          from,
          to,
          connectionId: effectiveConnId,
          mode: isDisablingAnimation ? 'disable' : 'enable',
          updates,
          selectedConnectionIds,
          applyAllConnectionIds: resolvedEdgeIds.length > 1 ? resolvedEdgeIds : undefined,
        });
        setAnimationSelectionDialogOpen(true);
        return;
      }
    }

    if (updates.animation && selectedConnectionIds.length > 0 && !fanOutMultiEdges) {
      applyAnimationToCurrentAndSelected(from, to, updates, selectedConnectionIds, effectiveConnId);
      return;
    }

    applyConnectionUpdates(from, to, updates, effectiveConnId, applyIds && applyIds.length > 0 ? applyIds : undefined);
  }, [selectedItem, selectedItemIds, currentDiagramData.connections, setPendingAnimationUpdate, setAnimationSelectionDialogOpen, applyAnimationToCurrentAndSelected, applyConnectionUpdates]);

  const handleAnimationApplyCurrentOnly = React.useCallback(() => {
    if (!pendingAnimationUpdate) return;
    applyConnectionUpdates(
      pendingAnimationUpdate.from,
      pendingAnimationUpdate.to,
      pendingAnimationUpdate.updates,
      pendingAnimationUpdate.connectionId
    );
    resetPendingAnimationDialogs();
    setAnimationCurrentOnlyDialogOpen(true);
  }, [pendingAnimationUpdate, applyConnectionUpdates, resetPendingAnimationDialogs]);

  const handleAnimationApplySelectedConfirm = React.useCallback(() => {
    if (!pendingAnimationUpdate) return;
    setAnimationSelectionDialogOpen(false);

    if (pendingAnimationUpdate.mode === 'disable') {
      setAnimationDisableConfirmDialogOpen(true);
      return;
    }

    const connections = currentDiagramData.connections ?? [];
    const hasOtherExistingAnimation = connections.some((conn, idx) => {
      const stable = stableDiagramConnectionId(conn as DiagramConnectionData, idx);
      const idMatches = pendingAnimationUpdate.selectedConnectionIds.some(
        (pid) => pid === stable || (!!(conn as DiagramConnectionData).id && pid === (conn as DiagramConnectionData).id)
      );
      if (!idMatches) return false;
      return hasConnectionAnimationSettings(conn);
    });

    if (hasOtherExistingAnimation) {
      setAnimationOverwriteDialogOpen(true);
      return;
    }

    if (pendingAnimationUpdate.applyAllConnectionIds && pendingAnimationUpdate.applyAllConnectionIds.length > 0) {
      applyConnectionUpdates(
        pendingAnimationUpdate.from,
        pendingAnimationUpdate.to,
        pendingAnimationUpdate.updates,
        pendingAnimationUpdate.connectionId,
        pendingAnimationUpdate.applyAllConnectionIds
      );
    } else {
      applyAnimationToCurrentAndSelected(
        pendingAnimationUpdate.from,
        pendingAnimationUpdate.to,
        pendingAnimationUpdate.updates,
        pendingAnimationUpdate.selectedConnectionIds,
        pendingAnimationUpdate.connectionId
      );
    }
    resetPendingAnimationDialogs();
  }, [pendingAnimationUpdate, currentDiagramData.connections, hasConnectionAnimationSettings, applyAnimationToCurrentAndSelected, applyConnectionUpdates, resetPendingAnimationDialogs]);

  const handleAnimationDisableConfirm = React.useCallback(() => {
    if (!pendingAnimationUpdate) return;
    if (pendingAnimationUpdate.applyAllConnectionIds && pendingAnimationUpdate.applyAllConnectionIds.length > 0) {
      applyConnectionUpdates(
        pendingAnimationUpdate.from,
        pendingAnimationUpdate.to,
        pendingAnimationUpdate.updates,
        pendingAnimationUpdate.connectionId,
        pendingAnimationUpdate.applyAllConnectionIds
      );
    } else {
      applyAnimationToCurrentAndSelected(
        pendingAnimationUpdate.from,
        pendingAnimationUpdate.to,
        pendingAnimationUpdate.updates,
        pendingAnimationUpdate.selectedConnectionIds,
        pendingAnimationUpdate.connectionId
      );
    }
    resetPendingAnimationDialogs();
  }, [pendingAnimationUpdate, applyAnimationToCurrentAndSelected, applyConnectionUpdates, resetPendingAnimationDialogs]);

  const handleAnimationOverwriteConfirm = React.useCallback(() => {
    if (!pendingAnimationUpdate) return;
    if (pendingAnimationUpdate.applyAllConnectionIds && pendingAnimationUpdate.applyAllConnectionIds.length > 0) {
      applyConnectionUpdates(
        pendingAnimationUpdate.from,
        pendingAnimationUpdate.to,
        pendingAnimationUpdate.updates,
        pendingAnimationUpdate.connectionId,
        pendingAnimationUpdate.applyAllConnectionIds
      );
    } else {
      applyAnimationToCurrentAndSelected(
        pendingAnimationUpdate.from,
        pendingAnimationUpdate.to,
        pendingAnimationUpdate.updates,
        pendingAnimationUpdate.selectedConnectionIds,
        pendingAnimationUpdate.connectionId
      );
    }
    resetPendingAnimationDialogs();
  }, [pendingAnimationUpdate, applyAnimationToCurrentAndSelected, applyConnectionUpdates, resetPendingAnimationDialogs]);

  const handleConnectionWaypointMove = (from: string, to: string, index: number, newPos: { x: number; y: number }, connectionId?: string) => {
    setDiagramData(prevData => {
      let nextWaypoints: Array<{ x: number; y: number; id?: string }> | undefined;
      const connections = prevData.connections.map((conn, idx) => {
        const match = connectionId ? (conn as DiagramConnectionData).id === connectionId : (conn.from === from && conn.to === to);
        if (!match || !conn.waypoints) return conn;
        const updated = [...conn.waypoints];
        if (index >= 0 && index < updated.length) {
          updated[index] = { ...updated[index], x: newPos.x, y: newPos.y };
        }
        nextWaypoints = updated;
        return { ...conn, waypoints: updated };
      });
      if (nextWaypoints) {
        recordDiagramChange({
          op: "update-connection",
          connectionId,
          from,
          to,
          patch: { waypoints: nextWaypoints },
        });
      }
      return { ...prevData, connections };
    });
  };

  const handleConnectionWaypointAdd = (from: string, to: string, connectionId?: string) => {
    const connections = currentDiagramData.connections ?? [];
    const conn = connections.find((c) =>
      connectionId ? (c as DiagramConnectionData).id === connectionId : (c.from === from && c.to === to)
    );
    if (!conn) return;
    const existing = conn.waypoints ?? [];
    const fromNode = currentDiagramData.nodes.find((n) => n.id === from) || currentDiagramData.zones?.find((z) => z.id === from);
    const toNode = currentDiagramData.nodes.find((n) => n.id === to) || currentDiagramData.zones?.find((z) => z.id === to);
    let midX: number;
    let midY: number;
    if (existing.length > 0) {
      const last = existing[existing.length - 1];
      const tx = ((toNode as any)?.x ?? 100) + (((toNode as any)?.width ?? 80) / 2);
      const ty = ((toNode as any)?.y ?? 80) + (((toNode as any)?.height ?? 80) / 2);
      midX = (last.x + tx) / 2;
      midY = (last.y + ty) / 2;
    } else if (fromNode && toNode) {
      const fx = ((fromNode as any).x ?? 0) + (((fromNode as any).width ?? 80) / 2);
      const fy = ((fromNode as any).y ?? 0) + (((fromNode as any).height ?? 80) / 2);
      const tx = ((toNode as any).x ?? 100) + (((toNode as any).width ?? 80) / 2);
      const ty = ((toNode as any).y ?? 80) + (((toNode as any).height ?? 80) / 2);
      midX = (fx + tx) / 2;
      midY = (fy + ty) / 2;
    } else {
      midX = 200;
      midY = 150;
    }
    const newWaypoint = { x: snapToGrid(midX), y: snapToGrid(midY), id: `wp-${Date.now()}` };
    const connId = connectionId ?? (conn as DiagramConnectionData).id;
    handleConnectionUpdate(from, to, { waypoints: [...existing, newWaypoint] }, connId);
  };

  const handleConnectionInsertNode = React.useCallback((
    _conn: DiagramConnectionData,
    connectionIndex: number,
    diagramPoint: { x: number; y: number },
  ) => {
    if (isReadOnly) return;
    const snapshotConns = currentDiagramData.connections ?? [];
    if (connectionIndex < 0 || connectionIndex >= snapshotConns.length) return;
    const target = snapshotConns[connectionIndex] as DiagramConnectionData;
    if (!target || target.from === target.to) return;

    const insertOutcome: { node: DiagramNodeData | null; newIdForLayer: string } = { node: null, newIdForLayer: '' };
    setCurrentDiagramData((prev) => {
      const conns = prev.connections ?? [];
      if (connectionIndex >= conns.length) return prev;
      const row = conns[connectionIndex] as DiagramConnectionData;
      if (!row || row.from !== target.from || row.to !== target.to) return prev;
      const {
        from: _from,
        to: _to,
        id: _id,
        waypoints: _wp,
        orthogonalTrunkOffsetX: _ox,
        orthogonalTrunkOffsetY: _oy,
        connectionIndex: _ci,
        totalConnections: _tc,
        toConnectionIndex: _tci,
        toTotalConnections: _ttc,
        ...restRest
      } = row;
      const restStyle = restRest as Omit<
        DiagramConnectionData,
        | 'from'
        | 'to'
        | 'id'
        | 'waypoints'
        | 'orthogonalTrunkOffsetX'
        | 'orthogonalTrunkOffsetY'
        | 'connectionIndex'
        | 'totalConnections'
        | 'toConnectionIndex'
        | 'toTotalConnections'
      >;
      const w = snapDimensionToGrid(80);
      const h = snapDimensionToGrid(50);
      const nx = snapToGrid(diagramPoint.x - w / 2);
      const ny = snapToGrid(diagramPoint.y - h / 2);
      const newNodeId = generateSequentialId('generic.object.rectangle', prev);
      insertOutcome.newIdForLayer = newNodeId;
      const builtInThemes = DEFAULT_THEMES.filter((t) => t.isBuiltIn);
      const randomTheme = builtInThemes[Math.floor(Math.random() * builtInThemes.length)];
      const newNode: DiagramNodeData = {
        id: newNodeId,
        type: 'generic.object.rectangle',
        label: '',
        x: nx,
        y: ny,
        width: w,
        height: h,
        sizeMode: 'custom',
        textJustify: 'center',
        ...(randomTheme?.properties ?? {}),
      };
      insertOutcome.node = newNode;
      const endArrow = row.toArrow === true || row.arrow === true;
      const leg1: DiagramConnectionData = {
        ...restStyle,
        id: generateConnectionId(),
        from: row.from,
        to: newNodeId,
        fromArrow: row.fromArrow,
        toArrow: false,
        arrow: undefined,
        text: row.text,
        textPosition: row.textPosition,
      };
      const leg2: DiagramConnectionData = {
        ...restStyle,
        id: generateConnectionId(),
        from: newNodeId,
        to: row.to,
        fromArrow: false,
        toArrow: endArrow,
        arrow: undefined,
      };
      const newConnections = [...conns.slice(0, connectionIndex), leg1, leg2, ...conns.slice(connectionIndex + 1)];
      return {
        ...prev,
        nodes: [...(prev.nodes ?? []), newNode],
        connections: newConnections,
      };
    });
    if (insertOutcome.node && insertOutcome.newIdForLayer) {
      const created = insertOutcome.node;
      requestAnimationFrame(() => {
        layers.assignItemsToLayer([insertOutcome.newIdForLayer], layers.getItemLayerById(target.from));
      });
      setSelectedItem({ ...created, itemType: 'node' } as SelectedItem);
      setSelectedItemIds(new Set([created.id]));
    }
  }, [
    isReadOnly,
    currentDiagramData.connections,
    setCurrentDiagramData,
    layers,
    setSelectedItem,
    setSelectedItemIds,
  ]);

  const handleConnectionWaypointRemove = (from: string, to: string, index: number, connectionId?: string) => {
    const connections = currentDiagramData.connections ?? [];
    const conn = connections.find((c) =>
      connectionId ? (c as DiagramConnectionData).id === connectionId : (c.from === from && c.to === to)
    );
    if (!conn?.waypoints) return;
    const updated = conn.waypoints.filter((_, i) => i !== index);
    const connId = connectionId ?? (conn as DiagramConnectionData).id;
    handleConnectionUpdate(from, to, { waypoints: updated.length ? updated : undefined }, connId);
  };

  const handleConnectionAnimationBulkApply = (
    sourceId: string,
    direction: 'outbound' | 'inbound',
    animation: DiagramConnectionData['animation']
  ) => {
    const animationPatch = toConnectionAnimationPatch(animation);
    setCurrentDiagramData((prevData) => ({
      ...prevData,
      connections: (prevData.connections ?? []).map((conn) => {
        const shouldApply = direction === 'outbound' ? conn.from === sourceId : conn.to === sourceId;
        if (!shouldApply) return conn;
        return {
          ...conn,
          animation: animationPatch,
        };
      }),
    }));
  };

  const handleConnectionContextMenu = useCallback(
    (e: React.MouseEvent, connection: DiagramConnectionData) => {
      pauseConnectionAnimationsForOverlayUi();
      setConnectionContextModal({ visible: true, x: e.clientX, y: e.clientY, connection });
    },
    [pauseConnectionAnimationsForOverlayUi],
  );

  const handleNew = () => {
    createTab();
  };

  const handleLoadExample = React.useCallback(async (exampleId: string) => {
    try {
      const isMermaid = exampleId === 'simple' || exampleId === 'complex' || exampleId === 'class-diagram' || exampleId === 'sequence-diagram';
      const res = await fetch(`/examples/${exampleId}.${isMermaid ? 'mmd' : 'json'}`);
      if (!res.ok) {
        throw new Error(`Failed to load example: ${res.statusText}`);
      }
      const text = await res.text();
      let diagram: DiagramData;

      if (isMermaid) {
        const diagramType = detectMermaidDiagramType(text);
        let mermaidData: DiagramData;
        if (diagramType === 'sequenceDiagram') {
          const parsed = parseMermaidSequenceDiagram(text);
          if (parsed.participants.length === 0 && parsed.messages.length === 0) {
            throw new Error('No valid sequence diagram content in Mermaid example.');
          }
          mermaidData = sequenceDiagramToDiagramData(parsed);
        } else if (diagramType === 'classDiagram') {
          const parsed = parseMermaidClassDiagram(text);
          if (parsed.classes.length === 0 && parsed.edges.length === 0) {
            throw new Error('No valid class diagram content in Mermaid example.');
          }
          mermaidData = classDiagramToDiagramData(parsed);
        } else {
          const parsed = parseMermaidFlowchart(text);
          if (parsed.nodes.length === 0 && parsed.edges.length === 0) {
            throw new Error('No valid flowchart content in Mermaid example.');
          }
          mermaidData = await mermaidToDiagramData(parsed);
        }
        diagram = mermaidData;
      } else {
        const json = parseImportJsonText(text);
        diagram = await parseUnknownJsonToDiagramData(json);
      }

      const exampleName = exampleId === 'example1' ? 'Example 1' : exampleId === 'example2' ? 'Example 2'
        : exampleId === 'simple' ? 'Mermaid Simple' : exampleId === 'complex' ? 'Mermaid Complex'
        : exampleId === 'class-diagram' ? 'Mermaid Class Diagram'
        : exampleId === 'sequence-diagram' ? 'Mermaid Sequence Diagram' : `Example: ${exampleId}`;
      absorbDiagramUserDefinedObjects(diagram, { notify: true });
      createTab({ name: exampleName, diagramData: diagram });

      toast({ title: 'Example Loaded', description: `${exampleName} has been loaded in a new tab.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "An unknown error occurred";
      toast({ variant: 'destructive', title: 'Error Loading Example', description: `Could not load example. ${message}` });
    }
  }, [parseUnknownJsonToDiagramData, createTab, absorbDiagramUserDefinedObjects, toast]);

  const activeTabIdRef = React.useRef(activeTabId);
  activeTabIdRef.current = activeTabId;

  const tabsRef = React.useRef(tabs);
  tabsRef.current = tabs;

  const handleLoadTutorialExample = React.useCallback(
    async (exampleId: string) => {
      if (!isLoaded) {
        await new Promise((r) => window.setTimeout(r, 450));
      }
      ensureTutorialTab();

      try {
        const res = await fetch(`/examples/tutorial/${exampleId}.json`);
        if (!res.ok) {
          throw new Error(`Failed to load tutorial example: ${res.statusText}`);
        }
        const text = await res.text();
        const json = parseImportJsonText(text);
        const diagram = await parseUnknownJsonToDiagramData(json);
        absorbDiagramUserDefinedObjects(diagram, { notify: true });
        const serialized = JSON.stringify(diagram);
        const tabId = tabsRef.current.find(
          (t) => t.isTutorialTab === true || t.name === TUTORIAL_TAB_NAME
        )?.id;
        if (!tabId) return;

        updateTab(tabId, {
          diagramData: diagram,
          name: TUTORIAL_TAB_NAME,
          selectedItem: null,
          selectedItemIds: new Set(),
          history: [serialized],
          historyIndex: 0,
          isConnectMode: false,
        });
        setHistoryRef(tabId, { history: [serialized], index: 0 });
        switchTab(tabId);
        window.setTimeout(() => editorRef.current?.fitToView(), 150);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        toast({ variant: 'destructive', title: 'Tutorial example failed', description: message });
      }
    },
    [isLoaded, parseUnknownJsonToDiagramData, absorbDiagramUserDefinedObjects, setHistoryRef, updateTab, toast, ensureTutorialTab, switchTab]
  );

  /** Mutate the dedicated tutorial tab's diagram (not necessarily the active tab). */
  const updateTutorialDiagramData = React.useCallback(
    (updater: (prev: DiagramData) => DiagramData) => {
      const tabId = tabsRef.current.find(
        (t) => t.isTutorialTab === true || t.name === TUTORIAL_TAB_NAME
      )?.id;
      if (!tabId) return;
      const tab = getTab(tabId);
      if (!tab) return;
      const newData = updater(tab.diagramData);
      const connections = newData.connections || [];
      const needsIds = connections.some((c: DiagramConnectionData) => !(c as DiagramConnectionData).id);
      const ensuredConnections = needsIds ? ensureConnectionIds(connections) : connections;
      const nextData = { ...newData, connections: ensuredConnections };
      updateTab(tabId, { diagramData: nextData });
    },
    [getTab, updateTab],
  );

  const handleTutorialFinish = React.useCallback(() => {
    const list = tabsRef.current;
    const tutorialId = list.find((t) => t.isTutorialTab === true || t.name === TUTORIAL_TAB_NAME)?.id;
    if (!tutorialId) return;
    if (list.filter((t) => !t.isTutorialTab).length === 0) {
      flushSync(() => {
        createTab({ name: 'Diagram 1', silent: true });
      });
    }
    void closeTab(tutorialId, true);
  }, [createTab, closeTab]);

  const handleCanvasClipboardChange = React.useCallback((hasClipboard: boolean) => {
    setCanPaste(hasClipboard);
    if (hasClipboard) {
      setPaletteClipboardItem(null);
    }
  }, []);

  const handleMenuCopy = React.useCallback(() => {
    // Canvas selection always wins. A leftover sidebar `selectedResource` used to
    // copy a palette item instead of the highlighted objects (and then paste that).
    if (selectedItemIdsRef.current.size > 0) {
      setPaletteClipboardItem(null);
      editorRef.current?.copy();
      return;
    }
    if (selectedResource) {
      const item = createPaletteItem(selectedResource.resource, selectedResource.provider, selectedResource.category);
      setPaletteClipboardItem(item);
      return;
    }
    editorRef.current?.copy();
  }, [selectedResource, setPaletteClipboardItem, editorRef]);

  const handleMenuPaste = React.useCallback(() => {
    if (paletteClipboardItem && editorRef.current) {
      editorRef.current.pastePaletteItem(paletteClipboardItem);
      return;
    }
    editorRef.current?.paste();
  }, [paletteClipboardItem, editorRef]);

  const handleSelectAll = React.useCallback(() => {
    const allIds = new Set<string>();

    diagramData.nodes.forEach((node) => {
      if (!node.locked) allIds.add(node.id);
    });
    diagramData.connections.forEach(connection => {
      allIds.add((connection as DiagramConnectionData).id ?? `${connection.from}-${connection.to}`);
    });

    setSelectedItemIds(allIds);

    if (allIds.size > 0) {
      const firstId = Array.from(allIds)[0];
      const nodeItem = diagramData.nodes.find(node => node.id === firstId);
      if (nodeItem) {
        setSelectedItem({ ...nodeItem, itemType: 'node' });
        return;
      }
      const connection = diagramData.connections.find(conn =>
        (conn as DiagramConnectionData).id === firstId || `${conn.from}-${conn.to}` === firstId
      );
      if (connection) {
        const connId = (connection as DiagramConnectionData).id ?? firstId;
        setSelectedItem({ ...connection, itemType: 'edge' as const, id: connId });
      }
    } else {
      setSelectedItem(null);
    }
  }, [diagramData, setSelectedItemIds, setSelectedItem]);

  const handleTabClose = async (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;

    if (tab.isTutorialTab === true || tab.name === TUTORIAL_TAB_NAME) {
      await closeTab(tabId, true);
      return;
    }

    // Check for unsaved changes
    const currentDataHash = JSON.stringify(activeTab?.diagramData);
    const hasUnsavedChanges = tab.isModified;

    if (hasUnsavedChanges) {
      setPendingCloseTabId(tabId);
      setCloseTabDialogOpen(true);
    } else {
      await closeTab(tabId, true);
    }
  };

  const handleCloseTabConfirm = async () => {
    if (pendingCloseTabId) {
      await closeTab(pendingCloseTabId, true);
      setPendingCloseTabId(null);
    }
    setCloseTabDialogOpen(false);
  };

  const handleCloseTabSave = async () => {
    if (!pendingCloseTabId) return;
    const saved = await handleSave(pendingCloseTabId);
    if (saved) {
      await closeTab(pendingCloseTabId, true);
      setPendingCloseTabId(null);
      setCloseTabDialogOpen(false);
    }
  };

  const handleJsonValidChange = (newDiagramData: DiagramData) => {
    absorbDiagramUserDefinedObjects(newDiagramData, { notify: true });
    recordDiagramReplace(newDiagramData);
    setDiagramData(newDiagramData);
  };

  const handleThemeApplyToSelected = (theme: DiagramTheme, menuOptions?: ThemeMenuApplyOptions) => {
    const multiHue = menuOptions?.multiSelectHueByLayout === true;
    const chartStepDeg =
      menuOptions?.multiSelectHueStepDegrees ?? readThemeMenuHueStepDegFromStorage();
    if (!selectedItemIds || selectedItemIds.size === 0) {
      // Apply to single selected item
      if (selectedItem) {
        const updatedItem = themeManager.applyThemeToItem(selectedItem, theme, {
          chartSeriesHueStepDegrees: chartStepDeg,
          stepHueWithinCard: multiHue,
        });
        handleItemUpdate(updatedItem as any);
      }
    } else {
      // Apply to multiple selected items - use current diagram (root or sub) for sub-diagram support
      setCurrentDiagramData((prevData) => {
        const orderMap =
          multiHue && selectedItemIds.size > 1
            ? orderSelectedIdsForThemeHue(selectedItemIds, prevData.nodes, prevData.connections ?? [])
            : null;

        const hueShiftForId = (id: string): number => {
          if (!orderMap) return 0;
          const idx = orderMap.get(id) ?? 0;
          return idx * chartStepDeg;
        };

        const updatedNodes = prevData.nodes.map((node) => {
          if (selectedItemIds.has(node.id)) {
            const hueShift = hueShiftForId(node.id);
            return themeManager.applyThemeToItem(node, theme, {
              hueShiftDegrees: hueShift,
              chartSeriesHueStepDegrees: chartStepDeg,
              stepHueWithinCard: multiHue,
            }) as DiagramNodeData;
          }
          return node;
        });
        const updatedConnections = (prevData.connections ?? []).map((connection) => {
          const connId = (connection as DiagramConnectionData).id ?? `${connection.from}-${connection.to}`;
          if (selectedItemIds.has(connId)) {
            const hueShift = hueShiftForId(connId);
            return themeManager.applyThemeToItem(connection, theme, {
              hueShiftDegrees: hueShift,
              chartSeriesHueStepDegrees: chartStepDeg,
              stepHueWithinCard: multiHue,
            }) as DiagramConnectionData;
          }
          return connection;
        });
        const nextNodes = applyMindmapHueAnchorsAfterVisualChanges(
          prevData.nodes,
          updatedNodes,
          selectedItemIds,
        );
        const nextData = { ...prevData, nodes: nextNodes, connections: updatedConnections };
        recordDiagramReplace(nextData);
        return nextData;
      });
      const count = selectedItemIds.size;
      toast({
        title: 'Theme Applied',
        description: `Applied "${theme.name}" theme to ${count} item${count > 1 ? 's' : ''}.`,
      });
    }
  };

  const handleMoveToBack = React.useCallback(() => {
    if (!selectedItem || selectedItem.itemType === 'edge') return;
    const updatedData = moveItemToBack(currentDiagramData, selectedItem.id, selectedItem.itemType);
    setCurrentDiagramData(updatedData);
  }, [selectedItem, currentDiagramData, setCurrentDiagramData]);

  const handleMoveToFront = React.useCallback(() => {
    if (!selectedItem || selectedItem.itemType === 'edge') return;
    const updatedData = moveItemToFront(currentDiagramData, selectedItem.id, selectedItem.itemType);
    setCurrentDiagramData(updatedData);
  }, [selectedItem, currentDiagramData, setCurrentDiagramData]);

  const handleMoveOneBack = React.useCallback(() => {
    if (!selectedItem || selectedItem.itemType === 'edge') return;
    const updatedData = moveItemOneBack(currentDiagramData, selectedItem.id, selectedItem.itemType);
    setCurrentDiagramData(updatedData);
  }, [selectedItem, currentDiagramData, setCurrentDiagramData]);

  const handleMoveOneForward = React.useCallback(() => {
    if (!selectedItem || selectedItem.itemType === 'edge') return;
    const updatedData = moveItemOneForward(currentDiagramData, selectedItem.id, selectedItem.itemType);
    setCurrentDiagramData(updatedData);
  }, [selectedItem, currentDiagramData, setCurrentDiagramData]);

  const handleAlignObjects = (alignment: 'top' | 'center' | 'bottom' | 'v-middle' | 'left' | 'h-center' | 'right' | 'distribute-v' | 'distribute-h') => {
    if (!selectedItem || selectedItemIds.size < 2) return;

    // Get the reference item (first selected item) and store it permanently
    // Use current diagram (root or sub) for sub-diagram support
    const firstSelectedId = Array.from(selectedItemIds)[0];
    const referenceNode = currentDiagramData.nodes.find(n => n.id === firstSelectedId);
    if (!referenceNode) return;
    
    const referenceItem = { ...referenceNode, itemType: 'node' } as SelectedItem;
    
    // Helper function to get object dimensions
    const getObjectDimensions = (item: SelectedItem): { width: number; height: number } => {
      if (item.itemType === 'node') {
        const node = item as any;

        if (isConnectorLikeSpineNodeType(node.type)) {
          return measureNodeDims({
            ...node,
            x: node.x ?? 0,
            y: node.y ?? 0,
          } as PositionedNode);
        }

        // Check if it's a shape node
        const isShapeNode = node.type === 'generic.object.square' ||
                           node.type === 'generic.object.circle' ||
                           node.type === 'generic.object.point' ||
                           node.type === 'generic.object.rectangle' ||
                           node.type === 'generic.object.uml-class' ||
                           node.type === 'generic.object.rounded-rectangle' ||
                           node.type === 'generic.object.progress-bar' ||
                           node.type === 'generic.object.timeline-bar' ||
                           node.type === 'generic.object.segmented-rectangle' ||
                           node.type === 'generic.object.text-box-heading' ||
                           node.type === 'generic.object.triangle' ||
                           node.type === 'generic.object.star' ||
                           node.type === 'generic.object.cloud';
        
        // Check if it's a textbox or plain text node (same custom sizing behavior)
        const isTextboxNode = node.type === 'generic.text.textbox';
        const isPlainTextNode = node.type === 'generic.text.text';
        
        // Use custom dimensions if sizeMode is 'custom' and dimensions are provided
        if ((isTextboxNode || isPlainTextNode || isShapeNode) && node.sizeMode === 'custom' && node.width && node.height) {
          return { width: node.width, height: node.height };
        }
        
        // Shapes always use their custom width/height if set
        if (isShapeNode && node.width && node.height) {
          return { width: node.width, height: node.height };
        }
        
        // Default dimensions based on node type
        if (node.type === 'generic.object.text-box-heading' || node.type?.endsWith('.text-box-heading')) {
          return { width: 180, height: 90 };
        }
        if (node.type?.startsWith('generic.text')) {
          if (node.type === 'generic.text.textbox' || node.type === 'generic.text.text') {
            return { width: 120, height: 60 };
          }
          return { width: 100, height: 40 };
        }
        
        // Default for icon nodes
        return { width: 80, height: 50 };
      }
      return { width: 80, height: 50 };
    };

    // Calculate reference position based on alignment
    const refDims = getObjectDimensions(referenceItem);
    const refX = (referenceItem as any).x || 0;
    const refY = (referenceItem as any).y || 0;
    let referenceX: number;
    let referenceY: number;

    // Handle vertical alignment
    switch (alignment) {
      case 'top':
        referenceY = refY;
        break;
      case 'v-middle':
        referenceY = refY + (refDims.height / 2);
        break;
      case 'bottom':
        referenceY = refY + refDims.height;
        break;
      default:
        // For horizontal alignment, use center Y as default
        referenceY = refY + (refDims.height / 2);
        break;
    }

    // Handle horizontal alignment
    switch (alignment) {
      case 'left':
        referenceX = refX;
        break;
      case 'h-center':
        referenceX = refX + (refDims.width / 2);
        break;
      case 'right':
        referenceX = refX + refDims.width;
        break;
      default:
        // For vertical alignment, use center X as default
        referenceX = refX + (refDims.width / 2);
        break;
    }

    // Handle distribute operations (icon-aware: catalog tiles use tile edges vs label-wide box)
    if (alignment === 'distribute-v' || alignment === 'distribute-h') {
      const newPositions =
        computeDistributeAlongAxisPositions(
          currentDiagramData.nodes,
          selectedItemIds,
          alignment === 'distribute-v' ? 'vertical' : 'horizontal',
        ) ?? [];

      if (newPositions.length < 3) return;

      // Apply the new positions (use current diagram for sub-diagram support)
      setCurrentDiagramData(prevData => {
        const newNodes = [...prevData.nodes];
        newPositions.forEach(pos => {
          const nodeIndex = newNodes.findIndex(n => n.id === pos.id);
          if (nodeIndex !== -1) {
            const prev = newNodes[nodeIndex];
            const nextX = pos.x !== undefined ? pos.x : prev.x ?? 0;
            const nextY = pos.y !== undefined ? pos.y : prev.y ?? 0;
            newNodes[nodeIndex] = positionNodeWithSpineTranslate(prev, nextX, nextY);
          }
        });
        return { ...prevData, nodes: newNodes };
      });

      const updatedSelectedItems: SelectedItem[] = [];
      selectedItemIds.forEach(id => {
        const updatedNode = currentDiagramData.nodes.find(n => n.id === id);
        if (updatedNode) {
          updatedSelectedItems.push({ ...updatedNode, itemType: 'node' } as SelectedItem);
        }
      });

      // Update the primary selected item if it was distributed
      if (selectedItem && selectedItem.id !== firstSelectedId) {
        const updatedPrimary = updatedSelectedItems.find(item => item.id === selectedItem.id);
        if (updatedPrimary) {
          setSelectedItem(updatedPrimary);
        }
      }

      return;
    }

    // Align all selected items (use current diagram for sub-diagram support)
    setCurrentDiagramData(prevData => {
      const newNodes = [...prevData.nodes];

      selectedItemIds.forEach(id => {
        if (id === firstSelectedId) return;

        const nodeIndex = newNodes.findIndex(n => n.id === id);
        if (nodeIndex !== -1) {
          const node = newNodes[nodeIndex];
          const nodeDims = getObjectDimensions({ ...node, itemType: 'node' } as SelectedItem);
          let newX = node.x;
          let newY = node.y;
          
          switch (alignment) {
            case 'top':
              newY = referenceY;
              break;
            case 'v-middle':
              newY = referenceY - (nodeDims.height / 2);
              break;
            case 'bottom':
              newY = referenceY - nodeDims.height;
              break;
          }
          
          switch (alignment) {
            case 'left':
              newX = referenceX;
              break;
            case 'h-center':
              newX = referenceX - (nodeDims.width / 2);
              break;
            case 'right':
              newX = referenceX - nodeDims.width;
              break;
            case 'center':
              newX = referenceX - (nodeDims.width / 2);
              break;
          }
          
          const fx = newX ?? node.x ?? 0;
          const fy = newY ?? node.y ?? 0;
          newNodes[nodeIndex] = positionNodeWithSpineTranslate(node, fx, fy);
        }
      });

      return { ...prevData, nodes: newNodes };
    });

    const updatedSelectedItems: SelectedItem[] = [];
    selectedItemIds.forEach(id => {
      const updatedNode = currentDiagramData.nodes.find(n => n.id === id);
      if (updatedNode) {
        updatedSelectedItems.push({ ...updatedNode, itemType: 'node' } as SelectedItem);
      }
    });

    // Update the primary selected item if it was aligned
    if (selectedItem && selectedItem.id !== referenceItem.id) {
      const updatedPrimary = updatedSelectedItems.find(item => item.id === selectedItem.id);
      if (updatedPrimary) {
        setSelectedItem(updatedPrimary);
      }
    }
  };

  const handleUniformSpacingAlign = useCallback(() => {
    if (isReadOnly || selectedItemIds.size < 3) return;

    const items = Array.from(selectedItemIds)
      .map((id) => {
        const node = currentDiagramData.nodes.find((n) => n.id === id);
        if (!node) return null;
        return nodeToSpacingAlignItem(node);
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    if (items.length < 3) return;

    const result = computeUniformSpacingPositions(items);
    if (!result || !result.changed) return;

    setCurrentDiagramData((prevData) => {
      const newNodes = [...prevData.nodes];
      result.positions.forEach((pos, id) => {
        if (id === result.anchorId) return;
        const nodeIndex = newNodes.findIndex((n) => n.id === id);
        if (nodeIndex === -1) return;
        const prev = newNodes[nodeIndex];
        newNodes[nodeIndex] = positionNodeWithSpineTranslate(prev, pos.x, pos.y);
      });
      return { ...prevData, nodes: newNodes };
    });

    if (
      selectedItem?.itemType === 'node' &&
      selectedItemIds.has(selectedItem.id) &&
      selectedItem.id !== result.anchorId
    ) {
      const updatedNode = currentDiagramData.nodes.find((n) => n.id === selectedItem.id);
      const pos = result.positions.get(selectedItem.id);
      if (updatedNode && pos) {
        setSelectedItem({ ...updatedNode, x: pos.x, y: pos.y, itemType: 'node' } as SelectedItem);
      }
    }

    toast({
      title: 'Spacing aligned',
      description: `Even ${result.axis === 'horizontal' ? 'horizontal' : 'vertical'} spacing applied.`,
    });
  }, [
    isReadOnly,
    selectedItemIds,
    currentDiagramData.nodes,
    setCurrentDiagramData,
    selectedItem,
    setSelectedItem,
    toast,
  ]);

  /**
   * Linear steps (menu): **Horizontal step** sorts **leftmost** first (**`x`** then **`y`**), steps **y** only (matches
   * horizontal curve’s **y** bulge axis; negative **step** → **up**). **Vertical step** sorts **topmost** first (**`y`**
   * then **`x`**), steps **x** only (matches vertical curve’s **x** bulge axis; negative **step** → **right**).
   * **vertical-curve** keeps **selection order**; **horizontal-curve** sorts **left→right**
   * (**`x`** then **`y`**) so **leftmost** is first and **rightmost** is last.
   * **Curved** variants: **vertical-curve** — first item fixed; last item’s **x** matches first (same column), **y**
   * unchanged; middle **y** interpolates first→last, **x** uses `x0 + bulge·4·t·(1−t)`. **horizontal-curve** — **x**
   * unchanged per item; last **y** matches first; middle **y** = chord plus bulge. **Bulge** from **Step amount**:
   * **`max(GRID, |steps|·GRID)`**. ≥3 canvas items. Negative **step** flips bulge side.
   */
  const handleLayoutGridStep = (
    direction:
      | 'horizontal-left'
      | 'vertical-down'
      | 'horizontal-curve'
      | 'vertical-curve',
    stepAmount: number,
  ) => {
    if (isReadOnly) return;
    const raw = Math.trunc(Number(stepAmount));
    const steps =
      !Number.isFinite(raw) || raw === 0
        ? 1
        : Math.max(-99, Math.min(99, raw));
    const zones = currentDiagramData.zones || [];
    const canvasTargets: string[] = [];
    for (const id of selectedItemIds) {
      if (
        currentDiagramData.nodes.some((n) => n.id === id) ||
        zones.some((z) => z.id === id)
      ) {
        canvasTargets.push(id);
      }
    }

    const getSnappedPos = (
      data: DiagramData,
      id: string,
    ): { x: number; y: number } => {
      const node = data.nodes.find((nn) => nn.id === id);
      if (node) {
        return { x: snapToGrid(node.x || 0), y: snapToGrid(node.y || 0) };
      }
      const z = (data.zones || []).find((zz) => zz.id === id);
      return { x: snapToGrid(z?.x || 0), y: snapToGrid(z?.y || 0) };
    };

    if (direction === 'horizontal-curve' || direction === 'vertical-curve') {
      if (canvasTargets.length < 3) return;
      let orderedTargets = [...canvasTargets];
      if (direction === 'horizontal-curve') {
        orderedTargets.sort((a, b) => {
          const pa = getSnappedPos(currentDiagramData, a);
          const pb = getSnappedPos(currentDiagramData, b);
          if (pa.x !== pb.x) return pa.x - pb.x;
          return pa.y - pb.y;
        });
      }
      const n = orderedTargets.length;
      const indexById = new Map(orderedTargets.map((id, i) => [id, i]));
      const targetSet = new Set(orderedTargets);
      const curveW = (t: number) => 4 * t * (1 - t);

      const hasMovableMiddle = orderedTargets.slice(1, -1).some((id) => {
        const node = currentDiagramData.nodes.find((x) => x.id === id);
        if (node) return !node.locked;
        return zones.some((z) => z.id === id);
      });
      if (!hasMovableMiddle) return;

      setCurrentDiagramData((prev) => {
        const zlist = prev.zones || [];
        const p0 = getSnappedPos(prev, orderedTargets[0]);
        const p1 = getSnappedPos(prev, orderedTargets[n - 1]);
        const spanY = p1.y - p0.y;
        const bulgeMag = snapToGrid(
          Math.max(GRID_STEP, Math.abs(steps) * GRID_STEP),
        );
        const bulge = bulgeMag * (Math.sign(steps) || 1);

        const applyCurveNode = (node: (typeof prev.nodes)[0], idx: number) => {
          if (idx === 0) return node;
          if (idx === n - 1) {
            if (node.locked) return node;
            if (direction === 'vertical-curve') {
              return positionNodeWithSpineTranslate(node, p0.x, p1.y);
            }
            return positionNodeWithSpineTranslate(node, snapToGrid(node.x || 0), p0.y);
          }
          if (node.locked) return node;
          const t = idx / (n - 1);
          const w = curveW(t);
          if (direction === 'vertical-curve') {
            const yLine = p0.y + spanY * t;
            return positionNodeWithSpineTranslate(
              node,
              snapToGrid(p0.x + bulge * w),
              snapToGrid(yLine),
            );
          }
          const xKeep = snapToGrid(node.x || 0);
          const yLine = p0.y + spanY * t + bulge * w;
          return positionNodeWithSpineTranslate(node, xKeep, snapToGrid(yLine));
        };

        const applyCurveZone = (z: (typeof zlist)[0], idx: number) => {
          if (idx === 0) return z;
          if (idx === n - 1) {
            if (direction === 'vertical-curve') {
              return { ...z, x: p0.x, y: p1.y };
            }
            return {
              ...z,
              x: snapToGrid(z.x || 0),
              y: p0.y,
            };
          }
          const t = idx / (n - 1);
          const w = curveW(t);
          if (direction === 'vertical-curve') {
            const yLine = p0.y + spanY * t;
            return {
              ...z,
              x: snapToGrid(p0.x + bulge * w),
              y: snapToGrid(yLine),
            };
          }
          const xKeep = snapToGrid(z.x || 0);
          const yLine = p0.y + spanY * t + bulge * w;
          return {
            ...z,
            x: xKeep,
            y: snapToGrid(yLine),
          };
        };

        const newNodes = prev.nodes.map((node) => {
          if (!targetSet.has(node.id)) return node;
          const idx = indexById.get(node.id)!;
          return applyCurveNode(node, idx);
        });
        const newZones = zlist.map((z) => {
          if (!targetSet.has(z.id)) return z;
          const idx = indexById.get(z.id)!;
          return applyCurveZone(z, idx);
        });
        return { ...prev, nodes: newNodes, zones: newZones };
      });

      if (
        selectedItem &&
        selectedItem.itemType !== 'edge' &&
        orderedTargets.includes(selectedItem.id)
      ) {
        const idx = indexById.get(selectedItem.id)!;
        const primaryNode = currentDiagramData.nodes.find(
          (nn) => nn.id === selectedItem.id,
        );
        const primaryIsZone = zones.some((z) => z.id === selectedItem.id);
        if (primaryNode?.locked && idx !== 0) return;
        if (!primaryNode && !primaryIsZone) return;
        const p0c = getSnappedPos(currentDiagramData, orderedTargets[0]);
        const p1c = getSnappedPos(
          currentDiagramData,
          orderedTargets[n - 1],
        );
        const sY = p1c.y - p0c.y;
        const bulgeMagC = snapToGrid(
          Math.max(GRID_STEP, Math.abs(steps) * GRID_STEP),
        );
        const bulgeC = bulgeMagC * (Math.sign(steps) || 1);
        if (idx === 0) return;
        if (idx === n - 1) {
          if (primaryNode?.locked) return;
          if (direction === 'vertical-curve') {
            setSelectedItem({
              ...selectedItem,
              x: p0c.x,
              y: p1c.y,
            } as SelectedItem);
          } else {
            setSelectedItem({
              ...selectedItem,
              x: snapToGrid(selectedItem.x || 0),
              y: p0c.y,
            } as SelectedItem);
          }
          return;
        }
        const t = idx / (n - 1);
        const w = curveW(t);
        if (direction === 'vertical-curve') {
          setSelectedItem({
            ...selectedItem,
            x: snapToGrid(p0c.x + bulgeC * w),
            y: snapToGrid(p0c.y + sY * t),
          } as SelectedItem);
        } else {
          setSelectedItem({
            ...selectedItem,
            x: snapToGrid(selectedItem.x || 0),
            y: snapToGrid(p0c.y + sY * t + bulgeC * w),
          } as SelectedItem);
        }
      }
      return;
    }

    if (canvasTargets.length < 2) return;

    const layoutPosForStepSort = (id: string) => {
      const node = currentDiagramData.nodes.find((nn) => nn.id === id);
      if (node) {
        return { x: snapToGrid(node.x || 0), y: snapToGrid(node.y || 0) };
      }
      const z = zones.find((zz) => zz.id === id);
      return { x: snapToGrid(z?.x || 0), y: snapToGrid(z?.y || 0) };
    };

    const orderedTargets = [...canvasTargets];
    if (direction === 'horizontal-left') {
      orderedTargets.sort((a, b) => {
        const pa = layoutPosForStepSort(a);
        const pb = layoutPosForStepSort(b);
        if (pa.x !== pb.x) return pa.x - pb.x;
        return pa.y - pb.y;
      });
    } else if (direction === 'vertical-down') {
      orderedTargets.sort((a, b) => {
        const pa = layoutPosForStepSort(a);
        const pb = layoutPosForStepSort(b);
        if (pa.y !== pb.y) return pa.y - pb.y;
        return pa.x - pb.x;
      });
    }

    const anchorId = orderedTargets[0];
    const anchorNodePre = currentDiagramData.nodes.find((n) => n.id === anchorId);
    const anchorZonePre = anchorNodePre ? null : zones.find((z) => z.id === anchorId);
    const ax = snapToGrid(anchorNodePre?.x ?? anchorZonePre?.x ?? 0);
    const ay = snapToGrid(anchorNodePre?.y ?? anchorZonePre?.y ?? 0);

    const indexById = new Map(orderedTargets.map((id, i) => [id, i]));
    const targetSet = new Set(orderedTargets);

    const hasMovableStep =
      orderedTargets.slice(1).some((id) => {
        const n = currentDiagramData.nodes.find((x) => x.id === id);
        if (n) return !n.locked;
        return zones.some((z) => z.id === id);
      });
    if (!hasMovableStep) return;

    setCurrentDiagramData((prev) => {
      const zlist = prev.zones || [];
      const newNodes = prev.nodes.map((n) => {
        if (!targetSet.has(n.id)) return n;
        const idx = indexById.get(n.id)!;
        if (idx === 0) return n;
        if (n.locked) return n;
        if (direction === 'vertical-down') {
          return positionNodeWithSpineTranslate(
            n,
            snapToGrid(ax - idx * steps * GRID_STEP),
            snapToGrid(n.y || 0),
          );
        }
        return positionNodeWithSpineTranslate(
          n,
          snapToGrid(n.x || 0),
          snapToGrid(ay + idx * steps * GRID_STEP),
        );
      });
      const newZones = zlist.map((z) => {
        if (!targetSet.has(z.id)) return z;
        const idx = indexById.get(z.id)!;
        if (idx === 0) return z;
        if (direction === 'vertical-down') {
          return {
            ...z,
            x: snapToGrid(ax - idx * steps * GRID_STEP),
            y: snapToGrid(z.y || 0),
          };
        }
        return {
          ...z,
          x: snapToGrid(z.x || 0),
          y: snapToGrid(ay + idx * steps * GRID_STEP),
        };
      });
      return { ...prev, nodes: newNodes, zones: newZones };
    });

    if (selectedItem && selectedItem.itemType !== 'edge' && indexById.has(selectedItem.id)) {
      const idx = indexById.get(selectedItem.id)!;
      if (idx === 0) return;
      const primaryNode = currentDiagramData.nodes.find((n) => n.id === selectedItem.id);
      const primaryIsZone = zones.some((z) => z.id === selectedItem.id);
      if (primaryNode?.locked) return;
      if (!primaryNode && !primaryIsZone) return;
      if (direction === 'vertical-down') {
        setSelectedItem({
          ...selectedItem,
          x: snapToGrid(ax - idx * steps * GRID_STEP),
          y: snapToGrid(selectedItem.y || 0),
        } as SelectedItem);
      } else {
        setSelectedItem({
          ...selectedItem,
          x: snapToGrid(selectedItem.x || 0),
          y: snapToGrid(ay + idx * steps * GRID_STEP),
        } as SelectedItem);
      }
    }
  };

  const handleAutoLayout = () => {
    try {
      const newData = performAutoLayout(currentDiagramData);
      setCurrentDiagramData(newData);
      toast({ 
        title: 'Auto Layout Applied', 
        description: 'Diagram has been automatically arranged.' 
      });
    } catch (error) {
      console.error('Auto layout failed:', error);
      toast({ 
        variant: 'destructive', 
        title: 'Auto Layout Failed', 
        description: 'Could not apply auto layout.' 
      });
    }
  };

  const handleToggleSimulationMode = React.useCallback(() => {
    const next = !simulationModeEnabled;
    setSimulationModeEnabled(next);
    toast({
      title: next ? 'Simulation Mode Enabled' : 'Simulation Mode Disabled',
      description: next ? 'Use this mode to simulate diagram interactions.' : undefined,
    });
  }, [simulationModeEnabled, toast]);

  const handleSelectPresentationBaseSlide = React.useCallback(async () => {
    const pid = activePresentationDeck?.slides[0]?.id;
    if (!pid || activePresentationSlideId === pid) return;
    await captureOutgoingSlideThumbnailIfNeeded();
    setActivePresentationSlideId(pid);
    setPresentationDraftDiagram(null);
    setSelectedPresentationSlideIds(new Set());
  }, [
    activePresentationDeck,
    activePresentationSlideId,
    captureOutgoingSlideThumbnailIfNeeded,
  ]);

  const runPresentationFitToView = React.useCallback(async (): Promise<{
    autoZoomLevel: number;
    viewportTransform: { x: number; y: number; k: number } | null;
  } | null> => {
    if (activePresentationSlideDiagrams.length > 0) {
      const diagrams = activePresentationSlideDiagrams.map((d) => pruneConnectionsToVisibleNodes(d));
      const host = editorRef.current?.getCanvasHostViewportForFit?.();
      const vw =
        host && host.width > 0
          ? host.width
          : typeof window !== 'undefined'
            ? window.innerWidth
            : 1280;
      const vh =
        host && host.height > 0
          ? host.height
          : typeof window !== 'undefined'
            ? window.innerHeight
            : 720;
      const t = computeUnionFitTransformForDiagrams(diagrams, vw, vh);
      if (t && Number.isFinite(t.k) && t.k > 0) {
        return {
          autoZoomLevel: Number(t.k.toFixed(4)),
          viewportTransform: t,
        };
      }
      toast({
        variant: 'destructive',
        title: 'Fit to View Failed',
        description: 'Could not compute bounds from all slides.',
      });
      return null;
    }

    if (!editorRef.current?.fitToView) {
      toast({
        variant: 'destructive',
        title: 'Fit to View Failed',
        description: 'Canvas fit API is unavailable.',
      });
      return null;
    }

    editorRef.current.fitToView();
    await new Promise((resolve) => window.setTimeout(resolve, 140));
    const zoom = canvasTransformRef.current.k;
    if (!Number.isFinite(zoom) || zoom <= 0) {
      toast({
        variant: 'destructive',
        title: 'Fit to View Failed',
        description: 'Could not read zoom after fitting the canvas.',
      });
      return null;
    }

    return {
      autoZoomLevel: Number(zoom.toFixed(4)),
      viewportTransform: null,
    };
  }, [activePresentationSlideDiagrams, toast]);

  /** One “Fit to View” for the deck: union camera across slides (when multi-slide) + persist zoom on every slide. Top bar routes here when a presentation deck is active. */
  const handlePresentationFitToView = React.useCallback(async () => {
    if (!activePresentationDeckId) return;
    const result = await runPresentationFitToView();
    if (result === null) return;
    const { autoZoomLevel, viewportTransform } = result;

    if (viewportTransform) {
      const s = sanitizeCanvasTransform(viewportTransform);
      setCanvasTransform(s);
      canvasTransformRef.current = s;
    }

    if (!activePresentationDeck || activePresentationDeck.slides.length === 0) {
      return;
    }

    setPresentationDecks((prev) => prev.map((deck) => {
      if (deck.id !== activePresentationDeckId) return deck;
      return {
        ...deck,
        slides: deck.slides.map((slide) => ({
          ...slide,
          autoZoomLevel,
          viewPanX: undefined,
          viewPanY: undefined,
        })),
        updatedAt: Date.now(),
      };
    }));
  }, [
    activePresentationDeckId,
    activePresentationDeck,
    runPresentationFitToView,
    sanitizeCanvasTransform,
    setCanvasTransform,
  ]);

  const resolvePresentationZoomLevel = React.useCallback((overrideZoomLevel?: number): number | null => {
    const candidate = overrideZoomLevel ?? canvasTransformRef.current.k;
    if (!Number.isFinite(candidate) || candidate <= 0) {
      toast({ variant: 'destructive', title: 'Invalid Zoom', description: 'Could not read a valid zoom level from the canvas.' });
      return null;
    }
    return Number(Math.min(2.5, Math.max(0.1, candidate)).toFixed(4));
  }, [toast]);

  const applyZoomToCanvas = React.useCallback((zoomLevel: number) => {
    const current = canvasTransformRef.current;
    const next = { ...current, k: zoomLevel };
    setCanvasTransform(next);
    canvasTransformRef.current = next;
  }, [setCanvasTransform]);

  const handleApplyPresentationZoomToCurrent = React.useCallback((overrideZoomLevel?: number) => {
    if (!activePresentationDeckId) return;
    const zoomLevel = resolvePresentationZoomLevel(overrideZoomLevel);
    if (zoomLevel === null) return;

    if (isPrimaryPresentationSlideActive) {
      applyZoomToCanvas(zoomLevel);
      const c = canvasTransformRef.current;
      const vs = sanitizeViewState(c);
      if (vs) {
        setDiagramData((prev) => {
          const current = getDiagramAtStack(prev, activeDiagramStack);
          return updateDiagramAtStack(prev, activeDiagramStack, () => ({
            ...current,
            viewState: vs,
          }));
        });
      }
      toast({ title: 'Zoom Applied', description: `Diagram zoom set to ${(zoomLevel * 100).toFixed(1)}%.` });
      return;
    }

    setPresentationDecks((prev) => prev.map((deck) => {
      if (deck.id !== activePresentationDeckId) return deck;
      return {
        ...deck,
        slides: deck.slides.map((slide) => (
          slide.id === activePresentationSlideId
            ? {
                ...slide,
                autoZoomLevel: zoomLevel,
                viewPanX: canvasTransformRef.current.x,
                viewPanY: canvasTransformRef.current.y,
              }
            : slide
        )),
        updatedAt: Date.now(),
      };
    }));

    applyZoomToCanvas(zoomLevel);
    toast({ title: 'Zoom Applied', description: `Active snapshot zoom set to ${(zoomLevel * 100).toFixed(1)}%.` });
  }, [
    activePresentationDeckId,
    activePresentationSlideId,
    isPrimaryPresentationSlideActive,
    resolvePresentationZoomLevel,
    applyZoomToCanvas,
    toast,
    activeDiagramStack,
    setDiagramData,
  ]);

  const handleApplyPresentationZoomToAll = React.useCallback((overrideZoomLevel?: number) => {
    if (!activePresentationDeckId || !activePresentationDeck || activePresentationDeck.slides.length === 0) return;
    const zoomLevel = resolvePresentationZoomLevel(overrideZoomLevel);
    if (zoomLevel === null) return;

    setPresentationDecks((prev) => prev.map((deck) => {
      if (deck.id !== activePresentationDeckId) return deck;
      return {
        ...deck,
        slides: deck.slides.map((slide) => ({
          ...slide,
          autoZoomLevel: zoomLevel,
          viewPanX: undefined,
          viewPanY: undefined,
        })),
        updatedAt: Date.now(),
      };
    }));

    applyZoomToCanvas(zoomLevel);
    toast({ title: 'Zoom Applied', description: `All ${activePresentationDeck.slides.length} snapshots set to ${(zoomLevel * 100).toFixed(1)}%.` });
  }, [
    activePresentationDeckId,
    activePresentationDeck,
    resolvePresentationZoomLevel,
    applyZoomToCanvas,
    toast,
  ]);

  const capturePresentationSlidePayload = React.useCallback(async (autoZoomLevel?: number) => {
    if (!editorRef.current?.captureSnapshotPng) {
      throw new Error('Canvas snapshot API is unavailable.');
    }

    const thumbBg = presentationThumbnailCaptureBackground(resolvedTheme);
    const snapshotImage = await editorRef.current.captureSnapshotPng(
      buildPresentationThumbnailCaptureOptions(thumbBg, [
        projectVisibleDiagram(presentationDraftDiagram ?? (layers.filteredDiagramData ?? diagramData)),
      ]),
    );

    const topologyCurrent = presentationDraftDiagram ?? diagramData;
    const topologyMaster = presentationMasterDiagram ?? tabDiagramData;
    const deck = presentationDecks.find((d) => d.id === activePresentationDeckId);

    let diagramDelta: DiagramDelta;
    try {
      if (!deck || getPresentationDeltaMode(deck) === 'master') {
        diagramDelta = computeDiagramDelta(topologyMaster, topologyCurrent);
        applyDiagramDelta(topologyMaster, diagramDelta);
      } else {
        let refIdx = activePresentationSlideId
          ? deck.slides.findIndex((s) => s.id === activePresentationSlideId)
          : -1;
        if (refIdx < 0) refIdx = deck.slides.length > 0 ? deck.slides.length - 1 : -1;
        const prevBase =
          refIdx < 0
            ? topologyMaster
            : cumulativeDiagramThroughSlideIndex(topologyMaster, deck.slides, refIdx, {
                activeSlideId: activePresentationSlideId,
                draftDiagram: presentationDraftDiagram ?? undefined,
              });
        diagramDelta = computeDiagramDelta(prevBase, topologyCurrent);
        applyDiagramDelta(prevBase, diagramDelta);
      }
    } catch {
      diagramDelta = {
        version: '1.0',
        compressed: true,
        operations: [{ op: 'replace' as const, path: '', value: safeClone(topologyCurrent) }],
      };
    }

    // Chain mode: duplicating while the canvas matches cumulative state yields an empty delta ("no change").
    // Multiple consecutive identity deltas collapse so later slides mirror earlier ones; edits then appear on every sibling.
    // A root replace freezes this slide's topology so duplicates stay independent snapshots.
    if (
      deck &&
      getPresentationDeltaMode(deck) === 'chain' &&
      diagramDelta.operations.length === 0
    ) {
      diagramDelta = {
        version: '1.0',
        compressed: true,
        operations: [{ op: 'replace' as const, path: '', value: safeClone(topologyCurrent) }],
      };
    }

    return {
      snapshotImage,
      diagramDelta,
      animationState: {
        enabled: animationConnectionsEnabled,
        filterSourceIds: effectiveAnimationFilterIds ? Array.from(effectiveAnimationFilterIds) : undefined,
        disabledSourceIds: animationDisabledSources.size > 0 ? Array.from(animationDisabledSources) : undefined,
      },
      autoZoomLevel: autoZoomLevel ?? canvasTransformRef.current.k,
      viewPanX: canvasTransformRef.current.x,
      viewPanY: canvasTransformRef.current.y,
      visibleLayerIds: listVisibleLayerIds(diagramData),
    };
  }, [
    layers.filteredDiagramData,
    presentationDraftDiagram,
    diagramData,
    presentationMasterDiagram,
    tabDiagramData,
    presentationDecks,
    activePresentationDeckId,
    activePresentationSlideId,
    animationConnectionsEnabled,
    effectiveAnimationFilterIds,
    animationDisabledSources,
    resolvedTheme,
  ]);

  const handleAddPresentationSnapshot = React.useCallback(async () => {
    if (!activePresentationDeckId) return;

    try {
      const payload = await capturePresentationSlidePayload();

      const slideId = `slide-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const slideCreatedAt = Date.now();

      await captureOutgoingSlideThumbnailIfNeeded();

      pushPresentationStructuralUndo();
      flushSync(() => {
        setPresentationDecks((prev) =>
          prev.map((deck) => {
            if (deck.id !== activePresentationDeckId) return deck;
            const currentIdx = activePresentationSlideId
              ? deck.slides.findIndex((s) => s.id === activePresentationSlideId)
              : -1;
            const insertAt = currentIdx >= 0 ? currentIdx + 1 : deck.slides.length;
            const slide: Slide = {
              id: slideId,
              ...payload,
              title: `Slide ${deck.slides.length + 1}`,
              createdAt: slideCreatedAt,
            };
            const slides = [...deck.slides.slice(0, insertAt), slide, ...deck.slides.slice(insertAt)];
            return {
              ...deck,
              slides,
              presentationDeltaMode: deck.presentationDeltaMode ?? 'master',
              updatedAt: Date.now(),
            };
          }),
        );
        setActivePresentationSlideId(slideId);
        setSelectedPresentationSlideIds(new Set());
      });
      toast({ title: 'Snapshot Added', description: 'Captured after the current slide; later slides shifted.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not capture snapshot';
      const lower = message.toLowerCase();
      const isChunkLoadError =
        lower.includes('failed to load chunk') ||
        lower.includes('chunkloaderror') ||
        (lower.includes('/_next/static/chunks/') && lower.includes('module'));

      if (isChunkLoadError) {
        toast({
          variant: 'destructive',
          title: 'Snapshot Failed',
          description: 'App updated in background. Reloading to sync assets...',
        });
        setTimeout(() => window.location.reload(), 150);
        return;
      }
      toast({ variant: 'destructive', title: 'Snapshot Failed', description: message });
    }
  }, [
    activePresentationDeckId,
    activePresentationSlideId,
    captureOutgoingSlideThumbnailIfNeeded,
    capturePresentationSlidePayload,
    pushPresentationStructuralUndo,
    toast,
  ]);

  const handleAddBlankPresentationSlide = React.useCallback(async () => {
    if (!activePresentationDeckId) return;

    try {
      await captureOutgoingSlideThumbnailIfNeeded();

      const masterRaw = presentationMasterDiagram ?? tabDiagramData;
      const blankDiagram = blankSlideVisibleFromMaster(masterRaw);
      const deck = presentationDecks.find((d) => d.id === activePresentationDeckId);

      let diagramDelta: DiagramDelta;
      try {
        if (!deck || getPresentationDeltaMode(deck) === 'master') {
          diagramDelta = computeDiagramDelta(masterRaw, blankDiagram);
          applyDiagramDelta(masterRaw, diagramDelta);
        } else {
          let refIdx = activePresentationSlideId
            ? deck.slides.findIndex((s) => s.id === activePresentationSlideId)
            : -1;
          if (refIdx < 0) refIdx = deck.slides.length > 0 ? deck.slides.length - 1 : -1;
          const prevBase =
            refIdx < 0
              ? masterRaw
              : cumulativeDiagramThroughSlideIndex(masterRaw, deck.slides, refIdx, {
                  activeSlideId: activePresentationSlideId,
                  draftDiagram: presentationDraftDiagram ?? undefined,
                });
          diagramDelta = computeDiagramDelta(prevBase, blankDiagram);
          applyDiagramDelta(prevBase, diagramDelta);
        }
      } catch {
        diagramDelta = {
          version: '1.0',
          compressed: true,
          operations: [{ op: 'replace' as const, path: '', value: safeClone(blankDiagram) }],
        };
      }

      const slideId = `slide-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const slideCreatedAt = Date.now();

      pushPresentationStructuralUndo();
      flushSync(() => {
        setPresentationDecks((prev) =>
          prev.map((deck) => {
            if (deck.id !== activePresentationDeckId) return deck;
            const currentIdx = activePresentationSlideId
              ? deck.slides.findIndex((s) => s.id === activePresentationSlideId)
              : -1;
            const insertAt = currentIdx >= 0 ? currentIdx + 1 : deck.slides.length;
            const slide: Slide = {
              id: slideId,
              diagramDelta,
              animationState: {
                enabled: animationConnectionsEnabled,
                filterSourceIds: effectiveAnimationFilterIds ? Array.from(effectiveAnimationFilterIds) : undefined,
                disabledSourceIds: animationDisabledSources.size > 0 ? Array.from(animationDisabledSources) : undefined,
              },
              autoZoomLevel: canvasTransformRef.current.k,
              viewPanX: canvasTransformRef.current.x,
              viewPanY: canvasTransformRef.current.y,
              visibleLayerIds: listVisibleLayerIds(diagramData),
              title: `Slide ${deck.slides.length + 1}`,
              createdAt: slideCreatedAt,
            };
            const slides = [...deck.slides.slice(0, insertAt), slide, ...deck.slides.slice(insertAt)];
            return {
              ...deck,
              slides,
              presentationDeltaMode: deck.presentationDeltaMode ?? 'master',
              updatedAt: Date.now(),
            };
          }),
        );
        setActivePresentationSlideId(slideId);
        setSelectedPresentationSlideIds(new Set());
      });
      toast({ title: 'Blank slide added', description: 'Inserted after the current slide.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not add blank slide';
      toast({ variant: 'destructive', title: 'Could not add blank slide', description: message });
    }
  }, [
    activePresentationDeckId,
    activePresentationSlideId,
    animationConnectionsEnabled,
    captureOutgoingSlideThumbnailIfNeeded,
    effectiveAnimationFilterIds,
    animationDisabledSources,
    presentationMasterDiagram,
    tabDiagramData,
    diagramData,
    presentationDecks,
    presentationDraftDiagram,
    pushPresentationStructuralUndo,
    toast,
  ]);

  const handleCopyPresentationSlide = React.useCallback(async () => {
    if (isReadOnly || !activePresentationDeckId) return;
    const deck = presentationDecks.find((d) => d.id === activePresentationDeckId);
    if (!deck || deck.slides.length === 0) {
      toast({ variant: 'destructive', title: 'Copy slide failed', description: 'No slide to copy.' });
      return;
    }
    const master = presentationMasterDiagram ?? tabDiagramData;
    const slideId = activePresentationSlideId ?? deck.slides[0].id;
    const slide = deck.slides.find((s) => s.id === slideId) ?? deck.slides[0];
    const absolute = resolveActiveSlideAbsoluteDiagram({
      deck,
      master,
      tabDiagramData,
      activeSlideId: slideId,
      draftDiagram: presentationDraftDiagram,
    });
    const payload = createPresentationSlideClipboardPayload({
      diagram: absolute,
      slide: {
        title: slide.title,
        description: slide.description,
        animationState: slide.animationState,
        autoZoomLevel: slide.autoZoomLevel ?? canvasTransformRef.current.k,
        viewPanX: slide.viewPanX ?? canvasTransformRef.current.x,
        viewPanY: slide.viewPanY ?? canvasTransformRef.current.y,
        visibleLayerIds: slide.visibleLayerIds,
        snapshotImage: slide.snapshotImage,
      },
    });
    await writePresentationSlideClipboard(payload);
    toast({
      title: 'Slide copied',
      description: 'Paste it into another diagram from Edit → Paste Slide.',
    });
  }, [
    isReadOnly,
    activePresentationDeckId,
    activePresentationSlideId,
    presentationDecks,
    presentationMasterDiagram,
    presentationDraftDiagram,
    tabDiagramData,
    toast,
  ]);

  const handlePastePresentationSlide = React.useCallback(async () => {
    if (isReadOnly || !activePresentationDeckId) return;
    const payload = await readPresentationSlideClipboard();
    if (!payload) {
      toast({
        variant: 'destructive',
        title: 'Nothing to paste',
        description: 'Copy a slide first (Edit → Copy Slide).',
      });
      return;
    }
    const deck = presentationDecks.find((d) => d.id === activePresentationDeckId);
    if (!deck) {
      toast({
        variant: 'destructive',
        title: 'Paste slide failed',
        description: 'No presentation on this diagram yet.',
      });
      return;
    }

    try {
      await captureOutgoingSlideThumbnailIfNeeded();
      const master = presentationMasterDiagram ?? tabDiagramData;
      const result = insertAbsoluteSlideIntoDeck({
        deck,
        master,
        absoluteDiagram: payload.diagram,
        meta: payload.slide,
        afterSlideId: activePresentationSlideId,
      });
      pushPresentationStructuralUndo();
      flushSync(() => {
        setPresentationDecks((prev) =>
          prev.map((d) => (d.id === result.deck.id ? result.deck : d)),
        );
        setActivePresentationSlideId(result.newSlideId);
        setSelectedPresentationSlideIds(new Set());
        setPresentationDraftDiagram(safeClone(payload.diagram));
        updateActiveTab({ hasUnsavedPresentations: true });
      });
      toast({ title: 'Slide pasted', description: 'Inserted after the current slide.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not paste slide';
      toast({ variant: 'destructive', title: 'Paste slide failed', description: message });
    }
  }, [
    isReadOnly,
    activePresentationDeckId,
    activePresentationSlideId,
    presentationDecks,
    presentationMasterDiagram,
    tabDiagramData,
    captureOutgoingSlideThumbnailIfNeeded,
    pushPresentationStructuralUndo,
    updateActiveTab,
    toast,
  ]);

  const handleRenamePresentationSlide = React.useCallback(
    (slideId: string, title: string) => {
      if (!activePresentationDeckId) return;
      const nextTitle = title.trim();
      const deck = presentationDecks.find((d) => d.id === activePresentationDeckId);
      const target = deck?.slides.find((s) => s.id === slideId);
      if (!target) return;
      if ((target.title ?? '').trim() === nextTitle) return;

      pushPresentationStructuralUndo();
      setPresentationDecks((prev) =>
        prev.map((d) => {
          if (d.id !== activePresentationDeckId) return d;
          return {
            ...d,
            slides: d.slides.map((slide) =>
              slide.id !== slideId
                ? slide
                : {
                    ...slide,
                    title: nextTitle || undefined,
                  },
            ),
            updatedAt: Date.now(),
          };
        }),
      );
      updateActiveTab({ hasUnsavedPresentations: true });
    },
    [
      activePresentationDeckId,
      presentationDecks,
      pushPresentationStructuralUndo,
      updateActiveTab,
    ],
  );

  const handleDeletePresentationSlide = React.useCallback((slideId: string) => {
    if (!activePresentationDeckId || !activePresentationDeck) return;
    if (activePresentationDeck.slides[0]?.id === slideId) {
      toast({
        variant: 'destructive',
        title: 'Cannot delete',
        description: 'The first slide is the main diagram and cannot be removed.',
      });
      return;
    }
    const targetSlide = activePresentationDeck.slides.find((slide) => slide.id === slideId);
    if (!targetSlide) return;

    const confirmed = window.confirm(`Delete slide "${targetSlide.title || 'Untitled'}"?`);
    if (!confirmed) return;

    // Full presentation restore point (decks + primary tab diagram) for Undo.
    pushPresentationStructuralUndo();

    const masterRaw = presentationMasterDiagram ?? tabDiagramData;
    const mode = getPresentationDeltaMode(activePresentationDeck);
    let nextSlidesFiltered = activePresentationDeck.slides.filter((slide) => slide.id !== slideId);
    if (mode === 'chain') {
      const resolved = resolvePresentationSlideDiagrams(masterRaw, activePresentationDeck.slides, 'chain');
      const indices = activePresentationDeck.slides
        .map((_, i) => i)
        .filter((i) => activePresentationDeck.slides[i].id !== slideId);
      nextSlidesFiltered = rechainSlideDeltasFromAbsoluteDiagrams(
        masterRaw,
        indices.map((i) => activePresentationDeck.slides[i]),
        indices.map((i) => resolved[i]),
      );
    }

    const nextActiveSlideId =
      activePresentationSlideId === slideId
        ? (nextSlidesFiltered[0]?.id ?? null)
        : (activePresentationSlideId ?? nextSlidesFiltered[0]?.id ?? null);

    let nextDraft: DiagramData | null = presentationDraftDiagram;
    if (nextActiveSlideId) {
      const nextSlide = nextSlidesFiltered.find((slide) => slide.id === nextActiveSlideId);
      if (nextSlide) {
        if (nextSlidesFiltered[0]?.id === nextSlide.id) {
          nextDraft = null;
        } else if (mode === 'master') {
          nextDraft = applyDiagramDelta(masterRaw, nextSlide.diagramDelta);
        } else {
          const idx = nextSlidesFiltered.findIndex((s) => s.id === nextSlide.id);
          const diagrams = resolvePresentationSlideDiagrams(masterRaw, nextSlidesFiltered, 'chain');
          nextDraft = diagrams[idx] ?? applyDiagramDelta(masterRaw, nextSlide.diagramDelta);
        }
      }
    } else {
      nextDraft = null;
    }

    const afterDecks = presentationDecks.map((deck) => {
      if (deck.id !== activePresentationDeckId) return deck;
      return {
        ...deck,
        slides: nextSlidesFiltered,
        updatedAt: Date.now(),
      };
    });

    flushSync(() => {
      setPresentationDecks(afterDecks);
      setActivePresentationSlideId(nextActiveSlideId);
      setSelectedPresentationSlideIds(new Set());
      setPresentationDraftDiagram(nextDraft);
      updateActiveTab({ hasUnsavedPresentations: true });
    });

    if (activeTabId) {
      presentationStateByTabRef.current[activeTabId] = {
        decks: afterDecks,
        activeDeckId: activePresentationDeckId,
        activeSlideId: nextActiveSlideId,
        selectedSlideIds: [],
        masterDiagram: presentationMasterDiagram,
        draftDiagram: nextDraft,
      };
    }

    toast({ title: 'Slide deleted', description: 'The slide has been removed from this presentation.' });
  }, [
    activePresentationDeckId,
    activePresentationDeck,
    activePresentationSlideId,
    activeTabId,
    presentationDecks,
    presentationMasterDiagram,
    presentationDraftDiagram,
    tabDiagramData,
    pushPresentationStructuralUndo,
    updateActiveTab,
    toast,
  ]);

  const commitPresentationSlideOrder = React.useCallback(
    (orderedSlides: Slide[], primarySlotId: string) => {
      if (!activePresentationDeckId || orderedSlides.length === 0) return;

      const deck = presentationDecks.find((d) => d.id === activePresentationDeckId);
      if (!deck) return;

      const pid = primarySlotId;
      const masterFull = presentationMasterDiagram ?? tabDiagramData;
      const mode = getPresentationDeltaMode(deck);
      const preSlides = presentationReorderPreSlidesRef.current ?? orderedSlides;

      const preAbsolutes = resolvePresentationSlideDiagrams(masterFull, preSlides, mode);
      const absById = new Map(
        preSlides.map((slide, i) => [slide.id, preAbsolutes[i]] as const),
      );
      const nextAbs = orderedSlides.map((slide, i) => {
        const found = absById.get(slide.id);
        if (found) return found;
        // Fallback: same index from pre-resolve (should not happen for permute-only).
        return preAbsolutes[Math.min(i, preAbsolutes.length - 1)] ?? masterFull;
      });

      const shouldReplaceTabDiagram = orderedSlides[0]?.id !== pid;

      const emptyDelta: DiagramDelta = {
        version: '1.0',
        operations: [],
        compressed: true,
      };

      let withPrimary = orderedSlides.map((row, i) =>
        i === 0
          ? {
              ...row,
              id: pid,
              diagramDelta: emptyDelta,
            }
          : row,
      );
      const dupAt = withPrimary.findIndex((s, i) => i > 0 && s.id === pid);
      if (dupAt >= 0) {
        const newId = `slide-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        withPrimary = withPrimary.map((row, i) =>
          i === dupAt ? { ...row, id: newId } : row,
        );
      }

      const baseDiagramClone = safeClone(nextAbs[0]);
      let finalSlides: Slide[];

      if (shouldReplaceTabDiagram) {
        if (mode === 'master') {
          finalSlides = withPrimary.map((slide, i) =>
            i === 0
              ? slide
              : {
                  ...slide,
                  diagramDelta: computeDiagramDelta(
                    baseDiagramClone,
                    nextAbs[i],
                  ),
                },
          );
        } else {
          finalSlides = rechainSlideDeltasFromAbsoluteDiagrams(
            baseDiagramClone,
            withPrimary,
            nextAbs,
          );
        }
      } else if (mode === 'master') {
        finalSlides = orderedSlides;
      } else {
        finalSlides = rechainSlideDeltasFromAbsoluteDiagrams(
          masterFull,
          withPrimary,
          nextAbs,
        );
      }

      if (shouldReplaceTabDiagram) {
        updateActiveTab({ diagramData: baseDiagramClone });
        setPresentationMasterDiagram(safeClone(baseDiagramClone));
        presentationMasterFromTabSyncKeyRef.current = null;
        setActivePresentationSlideId(pid);
        setPresentationDraftDiagram(null);
      }
      setPresentationDecks((prev) =>
        prev.map((d) =>
          d.id !== activePresentationDeckId
            ? d
            : {
                ...d,
                slides: finalSlides,
                updatedAt: Date.now(),
              },
        ),
      );
    },
    [
      activePresentationDeckId,
      presentationDecks,
      presentationMasterDiagram,
      tabDiagramData,
      updateActiveTab,
      presentationMasterFromTabSyncKeyRef,
      setPresentationMasterDiagram,
      setActivePresentationSlideId,
      setPresentationDraftDiagram,
      setPresentationDecks,
    ],
  );

  const handlePresentationReorderDragBegin = React.useCallback(() => {
    presentationReorderGestureUndoPushedRef.current = false;
    const deck = presentationDecks.find((d) => d.id === activePresentationDeckId);
    const slides = deck ? [...deck.slides] : null;
    presentationReorderLiveSlidesRef.current = slides;
    presentationReorderPreSlidesRef.current = slides ? [...slides] : null;
    presentationReorderPrimarySlotIdRef.current = deck?.slides[0]?.id ?? null;
  }, [activePresentationDeckId, presentationDecks]);

  const handlePresentationReorderDragEnd = React.useCallback(() => {
    const live = presentationReorderLiveSlidesRef.current;
    const pid = presentationReorderPrimarySlotIdRef.current;
    const dirty = presentationReorderGestureUndoPushedRef.current;
    presentationReorderLiveSlidesRef.current = null;
    presentationReorderPrimarySlotIdRef.current = null;
    presentationReorderGestureUndoPushedRef.current = false;
    if (dirty && live && pid) {
      commitPresentationSlideOrder(live, pid);
    }
    presentationReorderPreSlidesRef.current = null;
  }, [commitPresentationSlideOrder]);

  const handleMovePresentationSlide = React.useCallback(
    (fromIndex: number, toIndex: number) => {
      if (!activePresentationDeckId || fromIndex === toIndex) return;

      let live = presentationReorderLiveSlidesRef.current;
      if (!live) {
        const deck = presentationDecks.find((d) => d.id === activePresentationDeckId);
        if (!deck || deck.slides.length === 0) return;
        live = [...deck.slides];
        presentationReorderLiveSlidesRef.current = live;
        presentationReorderPreSlidesRef.current = [...deck.slides];
        presentationReorderPrimarySlotIdRef.current = deck.slides[0]?.id ?? null;
      }

      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= live.length ||
        toIndex >= live.length
      ) {
        return;
      }

      // Push undo once per drag gesture — not every hover — and avoid flushSync so
      // react-dnd targets are not remounted mid-hover (Expected to find a valid target).
      if (!presentationReorderGestureUndoPushedRef.current) {
        pushPresentationStructuralUndo();
        presentationReorderGestureUndoPushedRef.current = true;
      }

      const nextSlides = [...live];
      const [movedSlide] = nextSlides.splice(fromIndex, 1);
      nextSlides.splice(toIndex, 0, movedSlide);
      presentationReorderLiveSlidesRef.current = nextSlides;

      // Mid-drag: permute only (stable ids). Primary remapping / tab sync on drag end.
      setPresentationDecks((prev) =>
        prev.map((d) =>
          d.id !== activePresentationDeckId
            ? d
            : {
                ...d,
                slides: nextSlides,
                updatedAt: Date.now(),
              },
        ),
      );
    },
    [
      activePresentationDeckId,
      presentationDecks,
      setPresentationDecks,
      pushPresentationStructuralUndo,
    ],
  );

  const handleSelectPresentationSlide = React.useCallback(async (slideId: string) => {
    if (slideId === activePresentationSlideId) return;
    await captureOutgoingSlideThumbnailIfNeeded();
    setActivePresentationSlideId(slideId);
    setSelectedPresentationSlideIds(new Set());
    const deck = presentationDecks.find((d) => d.id === activePresentationDeckId);
    const slide = deck?.slides.find((s) => s.id === slideId);
    if (slide && deck) {
      if (deck.slides[0]?.id === slide.id) {
        setPresentationDraftDiagram(null);
      } else {
        const masterFull = presentationMasterDiagram ?? tabDiagramData;
        const mode = getPresentationDeltaMode(deck);
        if (mode === 'master') {
          setPresentationDraftDiagram(applyDiagramDelta(masterFull, slide.diagramDelta));
        } else {
          const idx = deck.slides.findIndex((s) => s.id === slide.id);
          const diagrams = resolvePresentationSlideDiagrams(masterFull, deck.slides, 'chain');
          setPresentationDraftDiagram(diagrams[idx] ?? applyDiagramDelta(masterFull, slide.diagramDelta));
        }
      }
    }
  }, [
    activePresentationSlideId,
    activePresentationDeckId,
    captureOutgoingSlideThumbnailIfNeeded,
    presentationDecks,
    presentationMasterDiagram,
    tabDiagramData,
  ]);

  const handleTogglePresentationSlideSelection = React.useCallback((slideId: string, checked: boolean) => {
    setSelectedPresentationSlideIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(slideId);
      else next.delete(slideId);
      return next;
    });
  }, []);

  const handlePreviousPresentationSlide = React.useCallback(async () => {
    if (activePresentationSlides.length === 0) return;
    const currentIndex = activePresentationSlides.findIndex((slide) => slide.id === activePresentationSlideId);
    if (currentIndex <= 0) {
      await handleSelectPresentationSlide(
        activePresentationSlides[activePresentationSlides.length - 1].id,
      );
      return;
    }
    await handleSelectPresentationSlide(activePresentationSlides[currentIndex - 1].id);
  }, [activePresentationSlides, activePresentationSlideId, handleSelectPresentationSlide]);

  const handleNextPresentationSlide = React.useCallback(async () => {
    if (activePresentationSlides.length === 0) return;
    const currentIndex = activePresentationSlides.findIndex((slide) => slide.id === activePresentationSlideId);
    if (currentIndex < 0 || currentIndex >= activePresentationSlides.length - 1) {
      await handleSelectPresentationSlide(activePresentationSlides[0].id);
      return;
    }
    await handleSelectPresentationSlide(activePresentationSlides[currentIndex + 1].id);
  }, [activePresentationSlides, activePresentationSlideId, handleSelectPresentationSlide]);

  const handleEnterPresentationPlayMode = React.useCallback(() => {
    if (presentationPlayerSlides.length === 0) return;
    let idx = 0;
    if (activePresentationSlideId) {
      const found = presentationPlayerSlides.findIndex((s) => s.id === activePresentationSlideId);
      if (found >= 0) idx = found;
    }
    setPresentationPlayerIndex(idx);
    setPresentationPlayerSessionKey((k) => k + 1);
    setPresentationPlayerOpen(true);
  }, [presentationPlayerSlides, activePresentationSlideId]);

  const toggleJsonPanel = () => {
    const newState = !jsonPanelOpen;
    setJsonPanelOpen(newState);
    if (isClient) {
      localStorage.setItem('dw:jsonEditor:open', String(newState));
    }
  };

  useDiagramEditorKeyboard({
    jsonPanelOpen,
    historyIndex,
    history,
    selectedItem,
    selectedItemIds,
    diagramData,
    setDiagramData,
    setSelectedItem,
    setSelectedItemIds,
    animationConnectionsEnabled,
    setAnimationConnectionsUserEnabled,
    animationToggleOnClickEnabled,
    setAnimationToggleOnClickEnabled,
    isReadOnly,
    handleMenuCopy,
    handleMenuPaste,
    presentationPlayerOpen,
    handleEnterPresentationPlayMode,
    simulationModeEnabled,
    handleToggleSimulationMode,
    toggleJsonPanel,
    handleNew,
    handleLoadClick,
    handleSave,
    undo,
    redo,
    handleSelectAll,
    editorRef,
    handleGroupItems,
    handleUngroupItems,
    handleAutoLayout,
  });

  useDiagramEditorOptionPersistence({
    isClient,
    jsonPanelWidth,
    iconBackgroundEnabled,
    defaultTextLabelsEnabled,
    alignmentGuidesEnabled,
    dotGridEnabled,
    rulerGuidesEnabled,
    connectionsBehindNodesEnabled,
    animationConnectionsUserEnabled,
    animationToggleOnClickEnabled,
    simplifyFillsDuringCanvasDragEnabled,
    suppressShadowsOnAllObjectsDuringCanvasDragEnabled,
    presentationThumbnailUpdatesEnabled,
    leftSidebarMode,
    setRightPanelCollapsed,
    setLeftSidebarMode,
    setPropertiesPanelVisible,
    setMetadataPopupsEnabled,
    setAlignmentGuidesEnabled,
    setDotGridEnabled,
    setRulerGuidesEnabled,
    setConnectionsBehindNodesEnabled,
    setAnimationConnectionsUserEnabled,
    setAnimationToggleOnClickEnabled,
    setSimplifyFillsDuringCanvasDragEnabled,
    setSuppressShadowsOnAllObjectsDuringCanvasDragEnabled,
    setPresentationThumbnailUpdatesEnabled,
  });

  // Reset click-to-toggle disabled sources when it's enabled
  React.useEffect(() => {
    if (animationToggleOnClickEnabled) {
      setAnimationDisabledSources(new Set());
    }
  }, [animationToggleOnClickEnabled]);

  // Disable click-to-toggle when master animation toggle is off
  React.useEffect(() => {
    if (!animationConnectionsEnabled && animationToggleOnClickEnabled) {
      setAnimationToggleOnClickEnabled(false);
    }
  }, [animationConnectionsEnabled, animationToggleOnClickEnabled]);

  // Reset disabled animation sources when master animation toggle is re-enabled (only after client init)
  React.useEffect(() => {
    if (!isClient) return;
    if (animationConnectionsEnabled) {
      setAnimationDisabledSources(new Set());
    }
  }, [animationConnectionsEnabled, isClient]);

  // Persist properties panel collapse state
  React.useEffect(() => {
    if (isClient) {
      localStorage.setItem('dw:propertiesPanel:collapsed', String(rightPanelCollapsed));
    }
  }, [rightPanelCollapsed, isClient]);

  // Persist properties panel visibility
  React.useEffect(() => {
    if (isClient) {
      localStorage.setItem('dw:propertiesPanel:visible', String(propertiesPanelVisible));
    }
  }, [propertiesPanelVisible, isClient]);

  // Persist metadata popups enabled
  React.useEffect(() => {
    if (isClient) {
      localStorage.setItem('dw:metadataPopups:enabled', String(metadataPopupsEnabled));
    }
  }, [metadataPopupsEnabled, isClient]);

  const togglePropertiesPanel = React.useCallback(() => {
    setPropertiesPanelVisible(prev => !prev);
  }, []);

  const toggleMetadataPopups = React.useCallback(() => {
    setMetadataPopupsEnabled(prev => !prev);
  }, []);

  const handleLeftSidebarModeChange = React.useCallback((mode: LeftSidebarMode) => {
    setLeftSidebarMode(mode);
    if (mode === "enabled") {
      setLeftPanelCollapsed(false);
    }
  }, []);

  const canPasteFromMenu = paletteClipboardItem != null || canPaste;
  const canCopyPresentationSlide = Boolean(activePresentationDeckId && !isReadOnly);

  return (
    <TooltipProvider>
    <TutorialProvider
      onTutorialSessionStart={ensureTutorialTab}
      onTutorialFinish={handleTutorialFinish}
      onLoadTutorialExample={handleLoadTutorialExample}
    >
      <DiagramEditorInner
        canPasteFromMenu={canPasteFromMenu}
        isMobile={isMobile}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        leftPanelCollapsed={leftPanelCollapsed}
        setLeftPanelCollapsed={setLeftPanelCollapsed}
        leftSidebarMode={leftSidebarMode}
        onLeftSidebarModeChange={handleLeftSidebarModeChange}
        rightPanelCollapsed={rightPanelCollapsed}
        setRightPanelCollapsed={setRightPanelCollapsed}
        propertiesPanelVisible={propertiesPanelVisible}
        onTogglePropertiesPanel={togglePropertiesPanel}
        metadataPopupsEnabled={metadataPopupsEnabled}
        onToggleMetadataPopups={toggleMetadataPopups}
        selectedItem={selectedItem}
        selectedItemIds={selectedItemIds}
        handleItemUpdate={handleItemUpdate}
        handleBulkMetadataUpdate={handleBulkMetadataUpdate}
        startConnecting={startConnecting}
        handleItemDelete={handleItemDelete}
        connectorLineFocusedVertex={connectorLineFocusedVertex}
        handleConnectorLineVertexFocus={handleConnectorLineVertexFocus}
        tryDeleteConnectorLineVertexBeforeNodeDelete={tryDeleteConnectorLineVertexBeforeNodeDelete}
        timelineEntrySelection={timelineEntrySelection}
        timelineActiveEntryId={timelineActiveEntryId}
        onTimelineEntrySelect={handleTimelineEntrySelect}
        onTimelineCardRemoved={handleTimelineCardRemoved}
        cardElementSelection={cardElementSelection}
        onCardElementSelect={handleCardElementSelect}
        handleResourceSelect={handleResourceSelect}
        handleResourceActivate={handleResourceActivate}
        handleResourceActivateAtPosition={handleResourceActivateAtPosition}
        toggleJsonPanel={toggleJsonPanel}
        jsonPanelOpen={jsonPanelOpen}
        jsonPanelWidth={jsonPanelWidth}
        setJsonPanelWidth={setJsonPanelWidth}
        editorRef={editorRef}
        handleConnectionUpdate={handleConnectionUpdate}
        disconnectConnection={disconnectConnection}
        handleConnectionWaypointAdd={handleConnectionWaypointAdd}
        handleConnectionInsertNode={handleConnectionInsertNode}
        handleConnectionWaypointRemove={handleConnectionWaypointRemove}
        handleConnectionWaypointMove={handleConnectionWaypointMove}
        handleConnectionContextMenu={handleConnectionContextMenu}
        connectionContextModal={connectionContextModal}
        setConnectionContextModal={setConnectionContextModal}
        umlClassEditorModal={umlClassEditorModal}
        setUmlClassEditorModal={setUmlClassEditorModal}
        chartDataEditorModal={chartDataEditorModal}
        setChartDataEditorModal={setChartDataEditorModal}
        timelineBarEditorModal={timelineBarEditorModal}
        setTimelineBarEditorModal={setTimelineBarEditorModal}
        pyramidEditorModal={pyramidEditorModal}
        setPyramidEditorModal={setPyramidEditorModal}
        setDiagramData={setDiagramData}
        onDiagramDataUpdate={handleDiagramDataUpdate}
        updateTutorialDiagramData={updateTutorialDiagramData}
        layers={layers}
        layerAnimationsEnabled={layerAnimationsEnabled}
        setLayerAnimationsEnabled={setLayerAnimationsEnabled}
        layerAnimation={layerAnimation}
        displayDiagramData={displayDiagramData}
        handleToggleLayerVisibility={handleToggleLayerVisibility}
        canvasTransform={canvasTransform}
        setCanvasTransform={setCanvasTransform}
        handleNew={handleNew}
        handleLoadClick={handleLoadClick}
        handleMermaidImportClick={handleMermaidImportClick}
        handleMermaidFileChange={handleMermaidFileChange}
        mermaidInputRef={mermaidInputRef}
        handleSave={handleSave}
        handleLoadExample={handleLoadExample}
        createTab={createTab}
        handleExportSvg={handleExportPng}
        handleExportPngSelection={handleExportPngSelection}
        handleExportGif={handleExportGif}
        handleMenuCopy={handleMenuCopy}
        handleMenuPaste={handleMenuPaste}
        canPaste={canPaste}
        undo={undo}
        redo={redo}
        historyIndex={historyIndex}
        history={history}
        jumpToHistoryIndex={jumpToHistoryIndex}
        canUndo={canUndo}
        canRedo={canRedo}
        handleSelectAll={handleSelectAll}
        hoverEnabled={hoverEnabled}
        setHoverEnabled={setHoverEnabled}
        iconBackgroundEnabled={iconBackgroundEnabled}
        setIconBackgroundEnabled={setIconBackgroundEnabled}
        defaultTextLabelsEnabled={defaultTextLabelsEnabled}
        setDefaultTextLabelsEnabled={setDefaultTextLabelsEnabled}
        alignmentGuidesEnabled={alignmentGuidesEnabled}
        setAlignmentGuidesEnabled={setAlignmentGuidesEnabled}
        dotGridEnabled={dotGridEnabled}
        setDotGridEnabled={setDotGridEnabled}
        rulerGuidesEnabled={rulerGuidesEnabled}
        setRulerGuidesEnabled={setRulerGuidesEnabled}
        simplifyFillsDuringCanvasDragEnabled={simplifyFillsDuringCanvasDragEnabled}
        setSimplifyFillsDuringCanvasDragEnabled={setSimplifyFillsDuringCanvasDragEnabled}
        suppressShadowsOnAllObjectsDuringCanvasDragEnabled={
          suppressShadowsOnAllObjectsDuringCanvasDragEnabled
        }
        setSuppressShadowsOnAllObjectsDuringCanvasDragEnabled={
          setSuppressShadowsOnAllObjectsDuringCanvasDragEnabled
        }
        presentationThumbnailUpdatesEnabled={presentationThumbnailUpdatesEnabled}
        setPresentationThumbnailUpdatesEnabled={setPresentationThumbnailUpdatesEnabled}
        presentationThumbnailGenerating={presentationThumbnailGenerating}
        connectionsBehindNodesEnabled={connectionsBehindNodesEnabled}
        setConnectionsBehindNodesEnabled={setConnectionsBehindNodesEnabled}
        animationConnectionsEnabled={animationConnectionsEnabled}
        animationConnectionsUserEnabled={animationConnectionsUserEnabled}
        animationConnectionsIdlePaused={animationConnectionsIdlePaused}
        animationConnectionsMenuPaused={animationConnectionsMenuPaused}
        setAnimationConnectionsMenuPaused={setAnimationConnectionsMenuPaused}
        pauseConnectionAnimationsForOverlayUi={pauseConnectionAnimationsForOverlayUi}
        setAnimationConnectionsEnabled={setAnimationConnectionsUserEnabled}
        animationToggleOnClickEnabled={animationToggleOnClickEnabled}
        setAnimationToggleOnClickEnabled={setAnimationToggleOnClickEnabled}
        effectiveAnimationFilterIds={effectiveAnimationFilterIds}
        animationDisabledSources={animationDisabledSources}
        setAnimationDisabledSources={setAnimationDisabledSources}
        isReadOnly={isReadOnly}
        setIsReadOnly={setIsReadOnly}
        handleAlignObjects={handleAlignObjects}
        handleUniformSpacingAlign={handleUniformSpacingAlign}
        handleLayoutGridStep={handleLayoutGridStep}
        handleAutoLayout={handleAutoLayout}
        handleThemeApplyToSelected={handleThemeApplyToSelected}
        triggerTextStylingPanel={triggerTextStylingPanel}
        setTriggerTextStylingPanel={setTriggerTextStylingPanel}
        triggerVisualStylingPanel={triggerVisualStylingPanel}
        setTriggerVisualStylingPanel={setTriggerVisualStylingPanel}
        triggerLineStylingPanel={triggerLineStylingPanel}
        setTriggerLineStylingPanel={setTriggerLineStylingPanel}
        triggerConnectionSettingsPanel={triggerConnectionSettingsPanel}
        setTriggerConnectionSettingsPanel={setTriggerConnectionSettingsPanel}
        setScratchPadOpen={setScratchPadOpen}
        scratchPadOpen={scratchPadOpen}
        rulesEditorOpen={rulesEditorOpen}
        setRulesEditorOpen={setRulesEditorOpen}
        rules={rules}
        setRules={setRules}
        presentationDecks={presentationDecks}
        activePresentationDeckId={activePresentationDeckId}
        activePresentationSlideId={activePresentationSlideId}
        activePresentationSlides={activePresentationSlides}
        activePresentationSlideDiagrams={activePresentationSlideDiagrams}
        handleSelectPresentationBaseSlide={handleSelectPresentationBaseSlide}
        handlePresentationFitToView={handlePresentationFitToView}
        handleApplyPresentationZoomToCurrent={handleApplyPresentationZoomToCurrent}
        handleApplyPresentationZoomToAll={handleApplyPresentationZoomToAll}
        handleAddPresentationSnapshot={handleAddPresentationSnapshot}
        handleAddBlankPresentationSlide={handleAddBlankPresentationSlide}
        handleCopyPresentationSlide={handleCopyPresentationSlide}
        handlePastePresentationSlide={handlePastePresentationSlide}
        canCopyPresentationSlide={canCopyPresentationSlide}
        canPastePresentationSlide={canPastePresentationSlide}
        handleDeletePresentationSlide={handleDeletePresentationSlide}
        handleRenamePresentationSlide={handleRenamePresentationSlide}
        presentationHasLaterSlides={hasLaterSlides}
        handlePropagateAddToLaterSlides={handlePropagateAddToLaterSlides}
        handlePropagateDeleteToLaterSlides={handlePropagateDeleteToLaterSlides}
        simulationModeEnabled={simulationModeEnabled}
        handleToggleSimulationMode={handleToggleSimulationMode}
        handleMovePresentationSlide={handleMovePresentationSlide}
        handlePresentationReorderDragBegin={handlePresentationReorderDragBegin}
        handlePresentationReorderDragEnd={handlePresentationReorderDragEnd}
        handleSelectPresentationSlide={handleSelectPresentationSlide}
        handleTogglePresentationSlideSelection={handleTogglePresentationSlideSelection}
        handlePreviousPresentationSlide={handlePreviousPresentationSlide}
        handleNextPresentationSlide={handleNextPresentationSlide}
        handleEnterPresentationPlayMode={handleEnterPresentationPlayMode}
        presentationPlayerSlides={presentationPlayerSlides}
        presentationPlayerSlideDiagrams={presentationPlayerSlideDiagrams}
        presentationPlayerOpen={presentationPlayerOpen}
        setPresentationPlayerOpen={setPresentationPlayerOpen}
        presentationPlayerSessionKey={presentationPlayerSessionKey}
        presentationPlayerIndex={presentationPlayerIndex}
        setPresentationPlayerIndex={setPresentationPlayerIndex}
        tabs={tabs}
        activeTabId={activeTabId}
        isLoaded={isLoaded}
        switchTab={switchTab}
        handleTabClose={handleTabClose}
        onTabRename={handleTabRename}
        reorderTabs={reorderTabs}
        fileInputRef={fileInputRef}
        handleFileChange={handleFileChange}
        diagramData={diagramData}
        handleJsonValidChange={handleJsonValidChange}
        exportDialogOpen={exportDialogOpen}
        exportDialogFormat={exportDialogFormat}
        setExportDialogOpen={setExportDialogOpen}
        handleExport={handleExport}
        refreshCanvas={refreshCanvas}
        updateHistory={updateHistory}
        closeTabDialogOpen={closeTabDialogOpen}
        setCloseTabDialogOpen={setCloseTabDialogOpen}
        pendingCloseTabId={pendingCloseTabId}
        setPendingCloseTabId={setPendingCloseTabId}
        handleCloseTabConfirm={handleCloseTabConfirm}
        handleCloseTabSave={handleCloseTabSave}
        animationSelectionDialogOpen={animationSelectionDialogOpen}
        setAnimationSelectionDialogOpen={setAnimationSelectionDialogOpen}
        animationOverwriteDialogOpen={animationOverwriteDialogOpen}
        setAnimationOverwriteDialogOpen={setAnimationOverwriteDialogOpen}
        animationDisableConfirmDialogOpen={animationDisableConfirmDialogOpen}
        setAnimationDisableConfirmDialogOpen={setAnimationDisableConfirmDialogOpen}
        animationCurrentOnlyDialogOpen={animationCurrentOnlyDialogOpen}
        setAnimationCurrentOnlyDialogOpen={setAnimationCurrentOnlyDialogOpen}
        handleAnimationApplyCurrentOnly={handleAnimationApplyCurrentOnly}
        handleAnimationApplySelectedConfirm={handleAnimationApplySelectedConfirm}
        handleAnimationDisableConfirm={handleAnimationDisableConfirm}
        handleAnimationOverwriteConfirm={handleAnimationOverwriteConfirm}
        handleItemSelect={handleItemSelect}
        handleBatchSelect={handleBatchSelect}
        setSelectedItemIds={setSelectedItemIds}
        setSelectedItem={setSelectedItem}
        isConnectMode={isConnectMode}
        handleConnect={handleConnect}
        setIsConnectMode={setIsConnectMode}
        disconnectSelected={disconnectSelected}
        handleLabelUpdate={handleLabelUpdate}
        handleTagUpdate={handleTagUpdate}
        setIsDragging={handleCanvasDraggingChange}
        setChartValueDragActive={handleChartValueDragSessionChange}
        setCanvasGeometrySessionActive={handleCanvasGeometrySessionChange}
        setCanPaste={handleCanvasClipboardChange}
        setMousePosition={setMousePositionForIdle}
        handleGroupItems={handleGroupItems}
        handleUngroupItems={handleUngroupItems}
        handleRemoveFromGroup={handleRemoveFromGroup}
        handleAddToGroup={handleAddToGroup}
        handleMoveToBack={handleMoveToBack}
        handleMoveToFront={handleMoveToFront}
        handleMoveOneBack={handleMoveOneBack}
        handleMoveOneForward={handleMoveOneForward}
        canvasRefreshKey={canvasRefreshKey}
        activeTab={activeTab}
        toast={toast}
        activeDiagramStack={activeDiagramStack}
        handleBreadcrumbNavigate={handleBreadcrumbNavigate}
        handleBreadcrumbSegmentRename={handleBreadcrumbSegmentRename}
        handleSubDiagramDoubleClick={handleSubDiagramDoubleClick}
        getHasLinkedSubDiagram={getHasLinkedSubDiagram}
        handleCreateSubDiagram={handleCreateSubDiagram}
        handleRemoveSubDiagramLink={handleRemoveSubDiagramLink}
        setCurrentDiagramData={setCurrentDiagramData}
        currentDiagramData={currentDiagramData}
        onImportIntoSubDiagram={activeDiagramStack.length > 0 ? handleImportIntoSubDiagramClick : undefined}
        onSubDiagramFileChange={handleSubDiagramFileChange}
        subDiagramImportInputRef={subDiagramImportInputRef}
        userDefinedObjectsLibrary={userDefinedObjectsLibrary}
        onUserDefinedObjectActivate={handleUserDefinedObjectActivate}
        canCreateUserDefinedObject={canCreateUserDefinedObject}
        onCreateUserDefinedObjectClick={handleCreateUserDefinedObjectClick}
        onManageUserDefinedObjectsClick={() => setManageUserDefinedObjectsDialogOpen(true)}
        onSaveUserDefinedObjectEdit={handleSaveUserDefinedObjectEdit}
        createUserDefinedObjectDialogOpen={createUserDefinedObjectDialogOpen}
        setCreateUserDefinedObjectDialogOpen={setCreateUserDefinedObjectDialogOpen}
        onConfirmCreateUserDefinedObject={handleConfirmCreateUserDefinedObject}
        manageUserDefinedObjectsDialogOpen={manageUserDefinedObjectsDialogOpen}
        setManageUserDefinedObjectsDialogOpen={setManageUserDefinedObjectsDialogOpen}
        onRenameUserDefinedObject={handleRenameUserDefinedObject}
        onDeleteUserDefinedObject={handleDeleteUserDefinedObject}
        onEditUserDefinedObject={handleEditUserDefinedObject}
      />
      <TutorialOverlay />
    </TutorialProvider>
    </TooltipProvider>
  );
}
