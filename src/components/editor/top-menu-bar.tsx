"use client";
import React from 'react';
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
  MenubarSub,
  MenubarSubTrigger,
  MenubarSubContent,
} from '@/components/ui/menubar';
import { Plus, Upload, Download, ImageDown, Undo, Redo, History, Copy, Clipboard, ClipboardPaste, CopyPlus, Code, Maximize2, Minimize2, Move, Eye, EyeOff, Palette, CheckSquare, Layers, Lock, Unlock, Info, ExternalLink, PanelRight, PanelLeft, ListChecks, ListOrdered, Network, Sun, Moon, Sparkles, Keyboard, BookOpen, Type, Activity, ArrowDown, Check, ChevronLeft, ChevronRight, FilePlus, Play, PaintBucket, Wrench, MonitorDown, Grid3x3, Shapes, List, Save, Ruler, Images } from 'lucide-react';
import { ContextToolbar } from './context-toolbar';
import { ThemeEditor } from './theme-editor';
import { RulesEditor } from './rules-editor';
import { ThemeMenuSelector } from './theme-menu-selector';
import { AboutDialog } from './about-dialog';
import { CanvasBackgroundDialog } from './canvas-background-dialog';
import { KeyboardShortcutsDialog } from './keyboard-shortcuts-dialog';
import { HistoryBrowserDialog } from './history-browser-dialog';
import { PwaInstallDialog } from './pwa-install-dialog';
import { usePwaInstall } from '@/hooks/use-pwa-install';
import { IconMaintenanceDialog } from './icon-maintenance-dialog';
import { ICON_MAINTENANCE_MENU_ENABLED } from '@/lib/maintenance-config';
import { ViewerUrlDialog } from './viewer-url-dialog';
import { InteractionRecorderHelpMenuItem } from './interaction-recorder-menu-item';
import { useTheme } from '@/components/theme-provider';
import type { SelectedItem } from './diagram-editor-types';
import type { DiagramData, PresentationDeck } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { DiagramTheme, ThemeMenuApplyOptions } from '@/lib/theme-types';
import { cn } from '@/lib/utils';
import type { ViewportCullDebugStats } from '@/lib/viewport-culling';
import type { LeftSidebarMode } from '@/lib/left-sidebar-mode';
import { ViewportCullDebugBadge } from './viewport-cull-debug-badge';
import { PresentationThumbnailGeneratingIndicator } from './presentation-thumbnail-generating-indicator';

const truncateName = (s: string, max = 20) => (s.length > max ? `${s.slice(0, max - 3)}...` : s);

const LAYOUT_GRID_STEP_STORAGE_KEY = 'dw:layout-grid-step-amount';

/** Upward bump (horizontal layout curve: bulge in +y). */
function LayoutHorizontalCurveIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M4 16 Q12 6 20 16" />
    </svg>
  );
}

/** Bump facing left (vertical layout curve: bulge in −x). */
function LayoutVerticalCurveIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M16 4 Q6 12 16 20" />
    </svg>
  );
}

/** Staircase along **y** (Layout: Horizontal step). */
function LayoutHorizontalStepIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 5v9M8 11l4 4 4-4" />
    </svg>
  );
}

/** Staircase along **x** (Layout: Vertical step). */
function LayoutVerticalStepIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M5 12h8M13 8l4 4-4 4" />
    </svg>
  );
}

function normalizeLayoutGridStepString(raw: string): string {
  const n = parseInt(raw.trim(), 10);
  if (!Number.isFinite(n) || n === 0) return '1';
  const clamped = Math.max(-99, Math.min(99, n));
  return String(clamped);
}

/** Top-level menubar labels only — pauses connection animations on open (see diagram-editor). */
function MainMenubarTrigger({
  onPauseConnectionAnimations,
  ...props
}: React.ComponentProps<typeof MenubarTrigger> & {
  onPauseConnectionAnimations?: () => void;
}) {
  return (
    <MenubarTrigger
      {...props}
      onPointerDown={(e) => {
        props.onPointerDown?.(e);
        onPauseConnectionAnimations?.();
      }}
      onKeyDown={(e) => {
        props.onKeyDown?.(e);
        if (e.defaultPrevented) return;
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
          onPauseConnectionAnimations?.();
        }
      }}
    />
  );
}

function ViewThemeSubmenu() {
  const { theme, setTheme } = useTheme();
  return (
    <>
      <MenubarItem onClick={() => setTheme("light")}>
        <Sun className="mr-2 h-4 w-4" />
        Light
        {theme === "light" && <span className="ml-auto">✓</span>}
      </MenubarItem>
      <MenubarItem onClick={() => setTheme("dark")}>
        <Moon className="mr-2 h-4 w-4" />
        Dark
        {theme === "dark" && <span className="ml-auto">✓</span>}
      </MenubarItem>
      <MenubarItem onClick={() => setTheme("system")}>
        <span className="mr-2 h-4 w-4 inline-flex items-center justify-center text-xs">◐</span>
        System
        {theme === "system" && <span className="ml-auto">✓</span>}
      </MenubarItem>
    </>
  );
}

interface TopMenuBarProps {
  onNew: () => void;
  onLoad: () => void;
  onSave: () => void;
  onLoadExample?: (exampleId: string) => void;
  onImportMermaid?: () => void;
  onImportIntoSubDiagram?: () => void;
  onNewTab?: () => void;
  onExportSvg?: () => void;
  onExportPng?: () => void;
  onExportPngSelection?: () => void;
  onExportGif?: () => void;
  onToggleJsonPanel?: () => void;
  jsonPanelOpen?: boolean;
  onTogglePropertiesPanel?: () => void;
  propertiesPanelVisible?: boolean;
  onToggleMetadataPopups?: () => void;
  metadataPopupsEnabled?: boolean;
  onToggleLayersPanel?: () => void;
  layersPanelOpen?: boolean;
  layerAnimationsEnabled?: boolean;
  onToggleLayerAnimations?: () => void;
  onFitToView?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  canPaste?: boolean;
  onCopySlide?: () => void;
  onPasteSlide?: () => void;
  canCopySlide?: boolean;
  canPasteSlide?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  /** Canvas undo stack snapshots (JSON strings). */
  history?: string[];
  historyIndex?: number;
  onJumpToHistoryIndex?: (index: number) => void;
  onSelectAll?: () => void;
  selectedItem?: SelectedItem | null;
  selectedItemIds?: Set<string>;
  /** Selected card sub-element for per-region styling in the visual panel */
  cardElementSelection?: { nodeId: string; elementId: string } | null;
  onCardElementSelect?: (nodeId: string, elementId: string | null) => void;
  onItemUpdate?: (updatedItem: SelectedItem) => void;
  /** Multi-select: apply tag / description (`info`) / plain label to all selected nodes and zones. */
  onBulkMetadataUpdate?: (patch: { tag?: string; info?: string; label?: string }) => void;
  onConnect?: (connectionOptions?: { style?: 'bezier', curvature?: number; sourceItemId?: string }) => void;
  onDisconnect?: () => void;
  onDelete?: () => void;
  onConnectionUpdate?: (from: string, to: string, updates: { arrow?: boolean; text?: string; textPosition?: number; color?: string; [key: string]: any }, connectionId?: string) => void;
  onConnectionDisconnect?: (from: string, to: string) => void;
  onConnectionWaypointAdd?: (from: string, to: string) => void;
  onConnectionWaypointRemove?: (from: string, to: string, index: number) => void;
  diagramData?: DiagramData;
  onDiagramDataUpdate?: (newDiagramData: DiagramData) => void;
  /** Current diagram (root or sub) - use for operations that affect the current view */
  currentDiagramData?: DiagramData;
  /** Updates current diagram - use for sub-diagram safe updates */
  onCurrentDiagramDataUpdate?: (updater: DiagramData | ((prev: DiagramData) => DiagramData)) => void;
  hoverEnabled?: boolean;
  onToggleHover?: () => void;
  iconBackgroundEnabled?: boolean;
  onToggleIconBackground?: () => void;
  alignmentGuidesEnabled?: boolean;
  onToggleAlignmentGuides?: () => void;
  dotGridEnabled?: boolean;
  onToggleDotGrid?: () => void;
  rulerGuidesEnabled?: boolean;
  onToggleRulerGuides?: () => void;
  simplifyFillsDuringCanvasDragEnabled?: boolean;
  onToggleSimplifyFillsDuringCanvasDrag?: () => void;
  suppressShadowsOnAllObjectsDuringCanvasDragEnabled?: boolean;
  onToggleSuppressShadowsOnAllObjectsDuringCanvasDrag?: () => void;
  presentationThumbnailUpdatesEnabled?: boolean;
  onTogglePresentationThumbnailUpdates?: () => void;
  presentationThumbnailGenerating?: boolean;
  connectionsBehindNodesEnabled?: boolean;
  onToggleConnectionsBehindNodes?: () => void;
  animationConnectionsEnabled?: boolean;
  /** User preference (Options menu labels); when omitted, falls back to `animationConnectionsEnabled`. */
  animationConnectionsUserEnabled?: boolean;
  /** True when animations were auto-paused after canvas idle (effective off while preference may stay on). */
  animationConnectionsIdlePaused?: boolean;
  /** True when animations paused because a menubar menu or canvas context UI was opened (cleared on canvas activity). */
  animationConnectionsMenuPaused?: boolean;
  /** Called when any top-level menubar dropdown opens; pauses connection animations like idle pause. */
  onConnectionAnimationPauseFromMenu?: () => void;
  onToggleAnimationConnections?: () => void;
  animationToggleOnClickEnabled?: boolean;
  onToggleAnimationToggleOnClick?: () => void;
  /** When true, new palette drops get resource name (label) + info; text/textbox unchanged. */
  defaultTextLabelsEnabled?: boolean;
  onToggleDefaultTextLabels?: () => void;
  onAlignObjects?: (alignment: 'top' | 'center' | 'bottom' | 'v-middle' | 'left' | 'h-center' | 'right' | 'distribute-v' | 'distribute-h') => void;
  /** Multi-select: linear or curved grid step; see `handleLayoutGridStep` (`horizontal-left` = step **y**; `vertical-down` = step **x**). */
  onLayoutGridStep?: (
    direction:
      | 'horizontal-left'
      | 'vertical-down'
      | 'horizontal-curve'
      | 'vertical-curve',
    gridStepCount: number,
  ) => void;
  onThemeApplyToSelected?: (theme: DiagramTheme, options?: ThemeMenuApplyOptions) => void;
  triggerTextStylingPanel?: boolean;
  triggerVisualStylingPanel?: boolean;
  triggerLineStylingPanel?: boolean;
  triggerConnectionSettingsPanel?: boolean;
  onConnectionSettingsPanelOpenChange?: (open: boolean) => void;
  onCloseConnectionSettingsPanel?: () => void;
  onTextStylingPanelOpenChange?: (open: boolean) => void;
  onVisualStylingPanelOpenChange?: (open: boolean) => void;
  onLineStylingPanelOpenChange?: (open: boolean) => void;
  onResetConnectionSettingsTrigger?: () => void;
  onAutoLayout?: () => void;
  /** Stacking (z) order list — same as Layout → Stacking order list */
  onOpenZOrderList?: () => void;
  onToggleScratchPad?: () => void;
  scratchPadOpen?: boolean;
  leftSidebarMode?: LeftSidebarMode;
  onLeftSidebarModeChange?: (mode: LeftSidebarMode) => void;
  onToggleRulesEditor?: () => void;
  onRulesEditorOpenChange?: (open: boolean) => void;
  rulesEditorOpen?: boolean;
  rules?: import('@/lib/rules-types').DiagramRule[];
  onRulesChange?: (rules: import('@/lib/rules-types').DiagramRule[]) => void;
  simulationModeEnabled?: boolean;
  onToggleSimulationMode?: () => void;
  presentationHasLaterSlides?: boolean;
  onPropagateAddToLaterSlides?: () => void;
  onPropagateDeleteToLaterSlides?: () => void;
  isReadOnly?: boolean;
  onToggleReadOnly?: () => void;
  onStartTutorial?: () => void;
  /** When set, slide deck actions render in this bar (left of connection animation toggle) while the canvas has no selection. */
  presentationToolbar?: {
    decks: PresentationDeck[];
    activeDeckId: string | null;
    activeSlideId: string | null;
    snapshotsCollapsed: boolean;
    onToggleSnapshotsCollapsed: () => void;
    onApplyZoomToCurrent: () => void;
    onApplyZoomToAll: () => void;
    onAddSnapshot: () => void;
    onAddBlankSlide: () => void;
    onPreviousSlide: () => void;
    onNextSlide: () => void;
    onEnterPlayMode: () => void;
  };
  /** Live canvas vs rendered counts (viewport culling debug). */
  viewportCullStats?: ViewportCullDebugStats | null;
  onCreateUserDefinedObject?: () => void;
  canCreateUserDefinedObject?: boolean;
  onManageUserDefinedObjects?: () => void;
  onSaveUserDefinedObjectEdit?: () => void;
  isUserDefinedObjectEditTab?: boolean;
}

export function TopMenuBar({
  onNew,
  onLoad,
  onSave,
  onLoadExample,
  onImportMermaid,
  onImportIntoSubDiagram,
  onNewTab,
  onExportSvg,
  onExportPng,
  onExportPngSelection,
  onExportGif,
  onToggleJsonPanel,
  jsonPanelOpen,
  onTogglePropertiesPanel,
  propertiesPanelVisible,
  onToggleMetadataPopups,
  metadataPopupsEnabled = true,
  onFitToView,
  onCopy,
  onPaste,
  canPaste,
  onCopySlide,
  onPasteSlide,
  canCopySlide = false,
  canPasteSlide = false,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  history = [],
  historyIndex = 0,
  onJumpToHistoryIndex,
  onSelectAll,
  selectedItem,
  selectedItemIds = new Set(),
  cardElementSelection = null,
  onCardElementSelect,
  onItemUpdate,
  onBulkMetadataUpdate,
  onConnect,
  onDisconnect,
  onDelete,
  onConnectionUpdate,
  onConnectionDisconnect,
  onConnectionWaypointAdd,
  onConnectionWaypointRemove,
  diagramData,
  onDiagramDataUpdate,
  currentDiagramData,
  onCurrentDiagramDataUpdate,
  hoverEnabled,
  onToggleHover,
  iconBackgroundEnabled,
  onToggleIconBackground,
  alignmentGuidesEnabled,
  onToggleAlignmentGuides,
  dotGridEnabled = true,
  onToggleDotGrid,
  rulerGuidesEnabled = true,
  onToggleRulerGuides,
  simplifyFillsDuringCanvasDragEnabled = true,
  onToggleSimplifyFillsDuringCanvasDrag,
  suppressShadowsOnAllObjectsDuringCanvasDragEnabled = true,
  onToggleSuppressShadowsOnAllObjectsDuringCanvasDrag,
  presentationThumbnailUpdatesEnabled = true,
  onTogglePresentationThumbnailUpdates,
  presentationThumbnailGenerating = false,
  connectionsBehindNodesEnabled,
  onToggleConnectionsBehindNodes,
  animationConnectionsEnabled,
  animationConnectionsUserEnabled,
  animationConnectionsIdlePaused,
  animationConnectionsMenuPaused,
  onConnectionAnimationPauseFromMenu,
  onToggleAnimationConnections,
  animationToggleOnClickEnabled,
  onToggleAnimationToggleOnClick,
  defaultTextLabelsEnabled = true,
  onToggleDefaultTextLabels,
  onAlignObjects,
  onLayoutGridStep,
  onThemeApplyToSelected,
  triggerTextStylingPanel = false,
  triggerVisualStylingPanel = false,
  triggerLineStylingPanel = false,
  triggerConnectionSettingsPanel = false,
  onToggleLayersPanel,
  layersPanelOpen,
  layerAnimationsEnabled = true,
  onToggleLayerAnimations,
  onConnectionSettingsPanelOpenChange,
  onCloseConnectionSettingsPanel,
  onTextStylingPanelOpenChange,
  onVisualStylingPanelOpenChange,
  onLineStylingPanelOpenChange,
  onResetConnectionSettingsTrigger,
  onAutoLayout,
  onOpenZOrderList,
  onToggleScratchPad,
  scratchPadOpen,
  leftSidebarMode = "enabled",
  onLeftSidebarModeChange,
  onToggleRulesEditor,
  onRulesEditorOpenChange,
  rulesEditorOpen,
  rules = [],
  onRulesChange,
  simulationModeEnabled = false,
  onToggleSimulationMode,
  presentationHasLaterSlides = false,
  onPropagateAddToLaterSlides,
  onPropagateDeleteToLaterSlides,
  isReadOnly = false,
  onToggleReadOnly,
  onStartTutorial,
  presentationToolbar,
  viewportCullStats,
  onCreateUserDefinedObject,
  canCreateUserDefinedObject = false,
  onManageUserDefinedObjects,
  onSaveUserDefinedObjectEdit,
  isUserDefinedObjectEditTab = false,
}: TopMenuBarProps) {
  const animMenuPreferenceOn = animationConnectionsUserEnabled ?? animationConnectionsEnabled;

  const [layoutGridStepInput, setLayoutGridStepInput] = React.useState('1');
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(LAYOUT_GRID_STEP_STORAGE_KEY);
      if (raw != null && raw.trim() !== '') {
        setLayoutGridStepInput(normalizeLayoutGridStepString(raw));
      }
    } catch {
      /* ignore */
    }
  }, []);

  const commitLayoutGridStepInput = React.useCallback((next: string) => {
    const normalized = normalizeLayoutGridStepString(next);
    setLayoutGridStepInput(normalized);
    try {
      localStorage.setItem(LAYOUT_GRID_STEP_STORAGE_KEY, normalized);
    } catch {
      /* ignore */
    }
  }, []);

  const parsedLayoutGridStep = React.useMemo(
    () => parseInt(normalizeLayoutGridStepString(layoutGridStepInput), 10),
    [layoutGridStepInput],
  );

  const layoutStaircaseCanvasCount = React.useMemo(() => {
    if (!currentDiagramData) return 0;
    const zones = currentDiagramData.zones || [];
    let c = 0;
    for (const id of selectedItemIds) {
      if (
        currentDiagramData.nodes.some((n) => n.id === id) ||
        zones.some((z) => z.id === id)
      ) {
        c++;
      }
    }
    return c;
  }, [currentDiagramData, selectedItemIds]);

  const [themeEditorOpen, setThemeEditorOpen] = React.useState(false);
  const [historyBrowserOpen, setHistoryBrowserOpen] = React.useState(false);
  const [canvasBackgroundDialogOpen, setCanvasBackgroundDialogOpen] = React.useState(false);
  const [aboutOpen, setAboutOpen] = React.useState(false);
  const [keyboardShortcutsOpen, setKeyboardShortcutsOpen] = React.useState(false);
  const [iconMaintenanceOpen, setIconMaintenanceOpen] = React.useState(false);
  const [pwaInstallOpen, setPwaInstallOpen] = React.useState(false);
  const [viewerUrlDialogOpen, setViewerUrlDialogOpen] = React.useState(false);
  const pwaInstall = usePwaInstall();
  const [textStylingPanelOpen, setTextStylingPanelOpen] = React.useState(false);
  const [visualStylingPanelOpen, setVisualStylingPanelOpen] = React.useState(false);

  const handleVisualStylingPanelOpenChange = React.useCallback(
    (open: boolean) => {
      setVisualStylingPanelOpen(open);
      onVisualStylingPanelOpenChange?.(open);
    },
    [onVisualStylingPanelOpenChange],
  );
  const [lineStylingPanelOpen, setLineStylingPanelOpen] = React.useState(false);
  const [connectionSettingsPanelOpen, setConnectionSettingsPanelOpen] = React.useState(false);

  const hasCanvasSelection = Boolean(selectedItem) || selectedItemIds.size > 0;
  const showPresentationToolbar = Boolean(presentationToolbar) && !hasCanvasSelection;

  const presentationActiveDeck =
    presentationToolbar && presentationToolbar.activeDeckId
      ? presentationToolbar.decks.find((d) => d.id === presentationToolbar.activeDeckId) ?? null
      : null;
  const presentationStripTotal = presentationActiveDeck?.slides.length ?? 0;
  const presentationActiveStripIndex =
    presentationActiveDeck && presentationToolbar?.activeSlideId
      ? presentationActiveDeck.slides.findIndex((s) => s.id === presentationToolbar.activeSlideId)
      : -1;
  const presentationSlideReadoutIndex =
    presentationActiveStripIndex >= 0
      ? presentationActiveStripIndex + 1
      : presentationStripTotal > 0
        ? 1
        : 0;
  const presentationCanStepSlides = presentationStripTotal > 1;

  const hasOptionsPanelMenuItems =
    Boolean(onTogglePropertiesPanel) ||
    Boolean(onToggleLayersPanel) ||
    Boolean(onToggleScratchPad) ||
    Boolean(onToggleRulesEditor) ||
    Boolean(onToggleSimulationMode);

  // Function to close connection settings panel
  const handleCloseConnectionSettingsPanel = () => {
    setConnectionSettingsPanelOpen(false);
    onConnectionSettingsPanelOpenChange?.(false);
  };

  // Handle trigger for connection settings panel
  React.useEffect(() => {
    if (triggerConnectionSettingsPanel) {
      setConnectionSettingsPanelOpen(true);
      onConnectionSettingsPanelOpenChange?.(true);
      // Reset the trigger after handling
      onResetConnectionSettingsTrigger?.();
    }
  }, [triggerConnectionSettingsPanel, onConnectionSettingsPanelOpenChange, onResetConnectionSettingsTrigger]);

  // Handle trigger for text styling panel
  React.useEffect(() => {
    if (triggerTextStylingPanel) {
      setTextStylingPanelOpen(true);
      onTextStylingPanelOpenChange?.(true);
    }
  }, [triggerTextStylingPanel, onTextStylingPanelOpenChange]);

  // Handle trigger for visual styling panel
  React.useEffect(() => {
    if (triggerVisualStylingPanel) {
      setVisualStylingPanelOpen(true);
      onVisualStylingPanelOpenChange?.(true);
    }
  }, [triggerVisualStylingPanel, onVisualStylingPanelOpenChange]);

  // Handle trigger for line styling panel
  React.useEffect(() => {
    if (triggerLineStylingPanel) {
      setLineStylingPanelOpen(true);
      onLineStylingPanelOpenChange?.(true);
    }
  }, [triggerLineStylingPanel, onLineStylingPanelOpenChange]);

  // Close connection settings panel when clicking away (deselecting)
  React.useEffect(() => {
    if (!selectedItem) {
      setConnectionSettingsPanelOpen(false);
      onConnectionSettingsPanelOpenChange?.(false);
    }
  }, [selectedItem, onConnectionSettingsPanelOpenChange]);


  return (
    <div className="flex w-full min-w-0 items-center border-b bg-card min-h-[2.5rem] overflow-x-auto">
      <Menubar className="rounded-none border-0 border-b-0 border-l-0 border-r-0 border-t-0 h-auto shrink-0" data-tutorial-id="main-menubar">
        <MenubarMenu>
          <MainMenubarTrigger data-tutorial-id="file-menu" onPauseConnectionAnimations={onConnectionAnimationPauseFromMenu}>
            File
          </MainMenubarTrigger>
          <MenubarContent>
            <MenubarItem onClick={onNew}>
              <Plus className="mr-2 h-4 w-4" />
              New
              <MenubarShortcut>Ctrl+N</MenubarShortcut>
            </MenubarItem>
            <MenubarItem onClick={onLoad} data-tutorial-id="load-menu">
              <Upload className="mr-2 h-4 w-4" />
              Load
              <MenubarShortcut>Ctrl+O</MenubarShortcut>
            </MenubarItem>
            {onImportMermaid && (
              <MenubarItem onClick={onImportMermaid}>
                <Upload className="mr-2 h-4 w-4" />
                Import Mermaid
              </MenubarItem>
            )}
            {onImportIntoSubDiagram && (
              <MenubarItem onClick={onImportIntoSubDiagram}>
                <Upload className="mr-2 h-4 w-4" />
                Import into sub-diagram
              </MenubarItem>
            )}
            <MenubarItem onClick={onSave}>
              <Download className="mr-2 h-4 w-4" />
              Save
              <MenubarShortcut>Ctrl+S</MenubarShortcut>
            </MenubarItem>
            {onLoadExample && (
              <>
                <MenubarSeparator />
                <MenubarSub>
                  <MenubarSubTrigger>Examples</MenubarSubTrigger>
                  <MenubarSubContent>
                    <MenubarItem onClick={() => onLoadExample('example1')}>
                      Example 1
                    </MenubarItem>
                    <MenubarItem onClick={() => onLoadExample('example2')}>
                      Example 2
                    </MenubarItem>
                    <MenubarItem onClick={() => onLoadExample('simple')}>
                      Mermaid Simple
                    </MenubarItem>
                    <MenubarItem onClick={() => onLoadExample('class-diagram')}>
                      Mermaid Class Diagram
                    </MenubarItem>
                    <MenubarItem onClick={() => onLoadExample('sequence-diagram')}>
                      Mermaid Sequence Diagram
                    </MenubarItem>
                    <MenubarItem onClick={() => onLoadExample('complex')}>
                      Mermaid Complex
                    </MenubarItem>
                  </MenubarSubContent>
                </MenubarSub>
              </>
            )}
            {onNewTab && (
              <>
                <MenubarSeparator />
                <MenubarItem onClick={onNewTab}>
                  <Plus className="mr-2 h-4 w-4" />
                  + Tab
                </MenubarItem>
              </>
            )}
            {(onExportSvg || onExportPng || onExportGif) && (
              <>
                <MenubarSeparator />
                {onExportSvg && (
                  <MenubarItem onClick={onExportSvg}>
                    <ImageDown className="mr-2 h-4 w-4" />
                    Export PNG
                  </MenubarItem>
                )}
                {onExportPng && (
                  <MenubarItem onClick={onExportPng}>
                    <ImageDown className="mr-2 h-4 w-4" />
                    Export PNG
                  </MenubarItem>
                )}
                {onExportPngSelection && selectedItemIds.size > 0 && (
                  <MenubarItem onClick={onExportPngSelection}>
                    <ImageDown className="mr-2 h-4 w-4" />
                    Export Selected as PNG
                  </MenubarItem>
                )}
                {onExportGif && (
                  <MenubarItem onClick={onExportGif}>
                    <ImageDown className="mr-2 h-4 w-4" />
                    Export GIF
                  </MenubarItem>
                )}
              </>
            )}
            {diagramData && (
              <>
                <MenubarSeparator />
                <MenubarItem onClick={() => setViewerUrlDialogOpen(true)}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Copy Viewer URL
                </MenubarItem>
              </>
            )}
          </MenubarContent>
        </MenubarMenu>
        <MenubarMenu>
          <MainMenubarTrigger data-tutorial-id="edit-menu" onPauseConnectionAnimations={onConnectionAnimationPauseFromMenu}>
            Edit
          </MainMenubarTrigger>
          <MenubarContent>
            {onCopy && (
              <MenubarItem onClick={onCopy} disabled={isReadOnly}>
                <Copy className="mr-2 h-4 w-4" />
                Copy
                <MenubarShortcut>Ctrl+C</MenubarShortcut>
              </MenubarItem>
            )}
            {onPaste && (
              <MenubarItem onClick={onPaste} disabled={!canPaste || isReadOnly}>
                <Clipboard className="mr-2 h-4 w-4" />
                Paste
                <MenubarShortcut>Ctrl+V</MenubarShortcut>
              </MenubarItem>
            )}
            {(onCopySlide || onPasteSlide) && (onCopy || onPaste) && <MenubarSeparator />}
            {onCopySlide && (
              <MenubarItem onClick={onCopySlide} disabled={isReadOnly || !canCopySlide}>
                <CopyPlus className="mr-2 h-4 w-4" />
                Copy Slide
              </MenubarItem>
            )}
            {onPasteSlide && (
              <MenubarItem onClick={onPasteSlide} disabled={isReadOnly || !canPasteSlide}>
                <ClipboardPaste className="mr-2 h-4 w-4" />
                Paste Slide
              </MenubarItem>
            )}
            {onSelectAll && (
              <>
                <MenubarSeparator />
                <MenubarItem onClick={onSelectAll} disabled={isReadOnly}>
                  <CheckSquare className="mr-2 h-4 w-4" />
                  Select All
                  <MenubarShortcut>Ctrl+A</MenubarShortcut>
                </MenubarItem>
              </>
            )}
            {(onCopy || onPaste || onSelectAll) && (onUndo || onRedo) && (
              <MenubarSeparator />
            )}
            {onUndo && (
              <MenubarItem onClick={onUndo} disabled={!canUndo || isReadOnly}>
                <Undo className="mr-2 h-4 w-4" />
                Undo
                <MenubarShortcut>Ctrl+Z</MenubarShortcut>
              </MenubarItem>
            )}
            {onRedo && (
              <MenubarItem onClick={onRedo} disabled={!canRedo || isReadOnly}>
                <Redo className="mr-2 h-4 w-4" />
                Redo
                <MenubarShortcut>Ctrl+Shift+Z</MenubarShortcut>
              </MenubarItem>
            )}
            {onJumpToHistoryIndex && (
              <MenubarItem
                onClick={() => setHistoryBrowserOpen(true)}
                disabled={isReadOnly || history.length === 0}
              >
                <History className="mr-2 h-4 w-4" />
                Show History…
              </MenubarItem>
            )}
            {onFitToView && (
              <>
                {(onUndo || onRedo || onJumpToHistoryIndex) && <MenubarSeparator />}
                <MenubarItem onClick={onFitToView}>
                  <Maximize2 className="mr-2 h-4 w-4" />
                  Fit to View
                </MenubarItem>
              </>
            )}
            {onCurrentDiagramDataUpdate && (
              <>
                {(onCopy || onPaste || onSelectAll || onUndo || onRedo || onFitToView) && <MenubarSeparator />}
                <MenubarItem
                  onClick={() => setCanvasBackgroundDialogOpen(true)}
                  disabled={isReadOnly}
                  data-tutorial-id="canvas-background-menu"
                >
                  <PaintBucket className="mr-2 h-4 w-4" />
                  Canvas background…
                </MenubarItem>
              </>
            )}
            {onToggleReadOnly !== undefined && (
              <>
                {(onUndo || onRedo || onFitToView || onCurrentDiagramDataUpdate) && <MenubarSeparator />}
                <MenubarItem onClick={onToggleReadOnly}>
                  {isReadOnly ? (
                    <>
                      <Unlock className="mr-2 h-4 w-4" />
                      Disable Read-Only Mode
                    </>
                  ) : (
                    <>
                      <Lock className="mr-2 h-4 w-4" />
                      Enable Read-Only Mode
                    </>
                  )}
                </MenubarItem>
              </>
            )}
            {isUserDefinedObjectEditTab && onSaveUserDefinedObjectEdit && (
              <>
                <MenubarSeparator />
                <MenubarItem onClick={onSaveUserDefinedObjectEdit} disabled={isReadOnly}>
                  <Save className="mr-2 h-4 w-4" />
                  Save user-defined object
                </MenubarItem>
              </>
            )}
            {!isUserDefinedObjectEditTab && (onCreateUserDefinedObject || onManageUserDefinedObjects) && (
              <>
                <MenubarSeparator />
                {onCreateUserDefinedObject && (
                  <MenubarItem
                    onClick={onCreateUserDefinedObject}
                    disabled={isReadOnly || !canCreateUserDefinedObject}
                  >
                    <Shapes className="mr-2 h-4 w-4" />
                    Create user-defined object…
                  </MenubarItem>
                )}
                {onManageUserDefinedObjects && (
                  <MenubarItem onClick={onManageUserDefinedObjects}>
                    <List className="mr-2 h-4 w-4" />
                    Manage user-defined objects…
                  </MenubarItem>
                )}
              </>
            )}
          </MenubarContent>
        </MenubarMenu>
        <MenubarMenu>
          <MainMenubarTrigger data-tutorial-id="options-menu" onPauseConnectionAnimations={onConnectionAnimationPauseFromMenu}>
            Options
          </MainMenubarTrigger>
          <MenubarContent>
            {onToggleJsonPanel && (
              <MenubarItem onClick={onToggleJsonPanel} data-tutorial-id="toggle-json-menu">
                <Code className="mr-2 h-4 w-4" />
                {jsonPanelOpen ? 'Hide JSON' : 'Show JSON'}
              </MenubarItem>
            )}
            {onTogglePropertiesPanel && (
              <>
                {onToggleJsonPanel && <MenubarSeparator />}
                <MenubarItem onClick={onTogglePropertiesPanel}>
                  <PanelRight className="mr-2 h-4 w-4" />
                  {propertiesPanelVisible ? 'Hide Properties' : 'Show Properties'}
                </MenubarItem>
              </>
            )}
            {onToggleLayersPanel && (
              <>
                {(onToggleJsonPanel || onTogglePropertiesPanel) && <MenubarSeparator />}
                <MenubarItem onClick={onToggleLayersPanel}>
                  <Layers className="mr-2 h-4 w-4" />
                  {layersPanelOpen ? 'Hide Layers' : 'Show Layers'}
                </MenubarItem>
              </>
            )}
            {onToggleScratchPad && (
              <>
                {(onToggleJsonPanel || onTogglePropertiesPanel || onToggleLayersPanel) && <MenubarSeparator />}
                <MenubarItem onClick={onToggleScratchPad}>
                  <Clipboard className="mr-2 h-4 w-4" />
                  {scratchPadOpen ? 'Hide Scratch Pad' : 'Show Scratch Pad'}
                </MenubarItem>
              </>
            )}
            {onLeftSidebarModeChange && (
              <>
                {(onToggleJsonPanel || onTogglePropertiesPanel || onToggleLayersPanel || onToggleScratchPad) && (
                  <MenubarSeparator />
                )}
                <MenubarSub>
                  <MenubarSubTrigger>
                    <PanelLeft className="mr-2 h-4 w-4" />
                    Component Sidebar
                  </MenubarSubTrigger>
                  <MenubarSubContent>
                    <MenubarItem onClick={() => onLeftSidebarModeChange("disabled")}>
                      Disabled
                      {leftSidebarMode === "disabled" && <span className="ml-auto">✓</span>}
                    </MenubarItem>
                    <MenubarItem onClick={() => onLeftSidebarModeChange("enabled")}>
                      Enabled
                      {leftSidebarMode === "enabled" && <span className="ml-auto">✓</span>}
                    </MenubarItem>
                    <MenubarItem onClick={() => onLeftSidebarModeChange("auto")}>
                      Auto
                      {leftSidebarMode === "auto" && <span className="ml-auto">✓</span>}
                    </MenubarItem>
                  </MenubarSubContent>
                </MenubarSub>
              </>
            )}
            {onToggleRulesEditor && (
              <>
                {(onToggleJsonPanel || onTogglePropertiesPanel || onToggleLayersPanel || onToggleScratchPad || onLeftSidebarModeChange) && <MenubarSeparator />}
                <MenubarItem onClick={() => onToggleRulesEditor?.()}>
                  <ListChecks className="mr-2 h-4 w-4" />
                  Rules
                </MenubarItem>
              </>
            )}
            {onToggleSimulationMode && (
              <>
                {(onToggleJsonPanel || onTogglePropertiesPanel || onToggleLayersPanel || onToggleScratchPad || onToggleRulesEditor) && <MenubarSeparator />}
                <MenubarItem onClick={onToggleSimulationMode}>
                  <Activity className="mr-2 h-4 w-4" />
                  {simulationModeEnabled ? 'Exit Simulation Mode' : 'Enter Simulation Mode'}
                  <MenubarShortcut>{simulationModeEnabled ? 'Alt+S' : 'Ctrl+Alt+S'}</MenubarShortcut>
                </MenubarItem>
              </>
            )}
            {onToggleMetadataPopups && (
              <>
                {(onToggleJsonPanel || hasOptionsPanelMenuItems) && <MenubarSeparator />}
                <MenubarItem onClick={onToggleMetadataPopups}>
                  <Info className="mr-2 h-4 w-4" />
                  {metadataPopupsEnabled ? 'Disable Properties' : 'Enable Properties'}
                </MenubarItem>
              </>
            )}
            {onToggleLayerAnimations !== undefined && (
              <>
                {(onToggleMetadataPopups || onToggleJsonPanel || hasOptionsPanelMenuItems) && <MenubarSeparator />}
                <MenubarItem onClick={onToggleLayerAnimations}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  {layerAnimationsEnabled ? 'Disable Layer Animations' : 'Enable Layer Animations'}
                </MenubarItem>
              </>
            )}
            {onToggleHover !== undefined && (
              <>
                {(onToggleMetadataPopups || onToggleLayerAnimations !== undefined || onToggleJsonPanel || hasOptionsPanelMenuItems) && <MenubarSeparator />}
                <MenubarItem onClick={onToggleHover}>
                  {hoverEnabled ? (
                    <>
                      <Eye className="mr-2 h-4 w-4" />
                      Hide Hover Text
                    </>
                  ) : (
                    <>
                      <EyeOff className="mr-2 h-4 w-4" />
                      Show Hover Text
                    </>
                  )}
                </MenubarItem>
              </>
            )}
            {onToggleAlignmentGuides !== undefined && (
              <>
                {(onToggleMetadataPopups || onToggleLayerAnimations !== undefined || onToggleHover !== undefined || onToggleJsonPanel || hasOptionsPanelMenuItems) && (
                  <MenubarSeparator />
                )}
                <MenubarItem onClick={onToggleAlignmentGuides}>
                  {alignmentGuidesEnabled ? (
                    <>
                      <Move className="mr-2 h-4 w-4" />
                      Hide Alignment Guides
                    </>
                  ) : (
                    <>
                      <Move className="mr-2 h-4 w-4" />
                      Show Alignment Guides
                    </>
                  )}
                </MenubarItem>
              </>
            )}
            {onToggleDotGrid !== undefined && (
              <>
                {(onToggleMetadataPopups ||
                  onToggleLayerAnimations !== undefined ||
                  onToggleHover !== undefined ||
                  onToggleAlignmentGuides !== undefined ||
                  onToggleJsonPanel ||
                  hasOptionsPanelMenuItems) && <MenubarSeparator />}
                <MenubarItem onClick={onToggleDotGrid}>
                  <Grid3x3 className="mr-2 h-4 w-4" />
                  {dotGridEnabled ? 'Hide Dot Grid' : 'Show Dot Grid'}
                </MenubarItem>
              </>
            )}
            {onToggleRulerGuides !== undefined && (
              <>
                {(onToggleMetadataPopups ||
                  onToggleLayerAnimations !== undefined ||
                  onToggleHover !== undefined ||
                  onToggleAlignmentGuides !== undefined ||
                  onToggleDotGrid !== undefined ||
                  onToggleJsonPanel ||
                  hasOptionsPanelMenuItems) && <MenubarSeparator />}
                <MenubarItem onClick={onToggleRulerGuides}>
                  <Ruler className="mr-2 h-4 w-4" />
                  {rulerGuidesEnabled ? 'Hide Guide Lines' : 'Show Guide Lines'}
                </MenubarItem>
              </>
            )}
            {onToggleDefaultTextLabels !== undefined && (
              <>
                {(onToggleMetadataPopups ||
                  onToggleLayerAnimations !== undefined ||
                  onToggleHover !== undefined ||
                  onToggleAlignmentGuides !== undefined ||
                  onToggleDotGrid !== undefined ||
                  onToggleJsonPanel ||
                  hasOptionsPanelMenuItems) && <MenubarSeparator />}
                <MenubarItem onClick={onToggleDefaultTextLabels}>
                  <Type className="mr-2 h-4 w-4" />
                  {defaultTextLabelsEnabled ? 'Disable Default Text Labels' : 'Enable Default Text Labels'}
                </MenubarItem>
              </>
            )}
            {onToggleSimplifyFillsDuringCanvasDrag !== undefined && (
              <>
                {(onToggleMetadataPopups ||
                  onToggleLayerAnimations !== undefined ||
                  onToggleHover !== undefined ||
                  onToggleAlignmentGuides !== undefined ||
                  onToggleDotGrid !== undefined ||
                  onToggleDefaultTextLabels !== undefined ||
                  onToggleJsonPanel ||
                  hasOptionsPanelMenuItems) && <MenubarSeparator />}
                <MenubarItem onClick={onToggleSimplifyFillsDuringCanvasDrag}>
                  <PaintBucket className="mr-2 h-4 w-4" />
                  {simplifyFillsDuringCanvasDragEnabled
                    ? "Disable Simplified Fills While Dragging"
                    : "Enable Simplified Fills While Dragging"}
                </MenubarItem>
              </>
            )}
            {onToggleSuppressShadowsOnAllObjectsDuringCanvasDrag !== undefined && (
              <>
                {(onToggleMetadataPopups ||
                  onToggleLayerAnimations !== undefined ||
                  onToggleHover !== undefined ||
                  onToggleAlignmentGuides !== undefined ||
                  onToggleDotGrid !== undefined ||
                  onToggleDefaultTextLabels !== undefined ||
                  onToggleSimplifyFillsDuringCanvasDrag !== undefined ||
                  onToggleJsonPanel ||
                  hasOptionsPanelMenuItems) && <MenubarSeparator />}
                <MenubarItem onClick={onToggleSuppressShadowsOnAllObjectsDuringCanvasDrag}>
                  <Sun className="mr-2 h-4 w-4" />
                  {suppressShadowsOnAllObjectsDuringCanvasDragEnabled
                    ? "Keep Shadows on Other Objects While Dragging"
                    : "Disable Shadows on All Objects While Dragging"}
                </MenubarItem>
              </>
            )}
            {onTogglePresentationThumbnailUpdates !== undefined && (
              <>
                {(onToggleMetadataPopups ||
                  onToggleLayerAnimations !== undefined ||
                  onToggleHover !== undefined ||
                  onToggleAlignmentGuides !== undefined ||
                  onToggleDotGrid !== undefined ||
                  onToggleDefaultTextLabels !== undefined ||
                  onToggleSimplifyFillsDuringCanvasDrag !== undefined ||
                  onToggleSuppressShadowsOnAllObjectsDuringCanvasDrag !== undefined ||
                  onToggleJsonPanel ||
                  hasOptionsPanelMenuItems) && <MenubarSeparator />}
                <MenubarItem onClick={onTogglePresentationThumbnailUpdates}>
                  <Images className="mr-2 h-4 w-4" />
                  {presentationThumbnailUpdatesEnabled
                    ? "Disable Presentation Thumbnail Updates"
                    : "Enable Presentation Thumbnail Updates"}
                </MenubarItem>
              </>
            )}
            {onToggleIconBackground !== undefined && (
              <>
                {(onToggleMetadataPopups ||
                  onToggleLayerAnimations !== undefined ||
                  onToggleHover !== undefined ||
                  onToggleAlignmentGuides !== undefined ||
                  onToggleDotGrid !== undefined ||
                  onToggleDefaultTextLabels !== undefined ||
                  onToggleSimplifyFillsDuringCanvasDrag !== undefined ||
                  onToggleSuppressShadowsOnAllObjectsDuringCanvasDrag !== undefined ||
                  onTogglePresentationThumbnailUpdates !== undefined ||
                  onToggleJsonPanel ||
                  hasOptionsPanelMenuItems) && <MenubarSeparator />}
                <MenubarItem onClick={onToggleIconBackground}>
                  {iconBackgroundEnabled ? (
                    <>
                      <Move className="mr-2 h-4 w-4" />
                      Disable Icon Background
                    </>
                  ) : (
                    <>
                      <Move className="mr-2 h-4 w-4" />
                      Enable Icon Background
                    </>
                  )}
                </MenubarItem>
              </>
            )}
            {onToggleConnectionsBehindNodes !== undefined && (
              <>
                {(onToggleMetadataPopups ||
                  onToggleLayerAnimations !== undefined ||
                  onToggleHover !== undefined ||
                  onToggleAlignmentGuides !== undefined ||
                  onToggleDotGrid !== undefined ||
                  onToggleDefaultTextLabels !== undefined ||
                  onToggleIconBackground !== undefined ||
                  onToggleJsonPanel ||
                  hasOptionsPanelMenuItems) && <MenubarSeparator />}
                <MenubarItem onClick={onToggleConnectionsBehindNodes}>
                  {connectionsBehindNodesEnabled ? (
                    <>
                      <Network className="mr-2 h-4 w-4" />
                      Lines Behind Nodes
                    </>
                  ) : (
                    <>
                      <Network className="mr-2 h-4 w-4" />
                      Order-Aware Connection Lines
                    </>
                  )}
                </MenubarItem>
              </>
            )}
            {onToggleAnimationConnections !== undefined && (
              <>
                {(onToggleMetadataPopups ||
                  onToggleLayerAnimations !== undefined ||
                  onToggleHover !== undefined ||
                  onToggleAlignmentGuides !== undefined ||
                  onToggleDotGrid !== undefined ||
                  onToggleDefaultTextLabels !== undefined ||
                  onToggleIconBackground !== undefined ||
                  onToggleConnectionsBehindNodes !== undefined ||
                  onToggleJsonPanel ||
                  hasOptionsPanelMenuItems) && <MenubarSeparator />}
                <MenubarItem onClick={onToggleAnimationConnections}>
                  {animMenuPreferenceOn ? (
                    <>
                      <Network className="mr-2 h-4 w-4" />
                      Disable Animation Connections
                      <MenubarShortcut>Ctrl+Alt+A</MenubarShortcut>
                    </>
                  ) : (
                    <>
                      <Network className="mr-2 h-4 w-4" />
                      Enable Animation Connections
                      <MenubarShortcut>Ctrl+Alt+A</MenubarShortcut>
                    </>
                  )}
                </MenubarItem>
              </>
            )}
            {onToggleAnimationToggleOnClick !== undefined && (
              <>
                {(onToggleMetadataPopups ||
                  onToggleLayerAnimations !== undefined ||
                  onToggleHover !== undefined ||
                  onToggleAlignmentGuides !== undefined ||
                  onToggleDotGrid !== undefined ||
                  onToggleDefaultTextLabels !== undefined ||
                  onToggleIconBackground !== undefined ||
                  onToggleConnectionsBehindNodes !== undefined ||
                  onToggleAnimationConnections !== undefined ||
                  onToggleJsonPanel ||
                  hasOptionsPanelMenuItems) && <MenubarSeparator />}
                <MenubarItem onClick={onToggleAnimationToggleOnClick} disabled={!animationConnectionsEnabled}>
                  {animationToggleOnClickEnabled ? (
                    <>
                      <Network className="mr-2 h-4 w-4" />
                      Disable Click to Toggle Animations
                      <MenubarShortcut>Ctrl+Alt+C</MenubarShortcut>
                    </>
                  ) : (
                    <>
                      <Network className="mr-2 h-4 w-4" />
                      Enable Click to Toggle Animations
                      <MenubarShortcut>Ctrl+Alt+C</MenubarShortcut>
                    </>
                  )}
                </MenubarItem>
              </>
            )}
            <>
              {(onToggleJsonPanel ||
                hasOptionsPanelMenuItems ||
                onToggleMetadataPopups ||
                onToggleLayerAnimations !== undefined ||
                onToggleHover !== undefined ||
                onToggleAlignmentGuides !== undefined ||
                onToggleDotGrid !== undefined ||
                onToggleDefaultTextLabels !== undefined ||
                onToggleIconBackground !== undefined ||
                onToggleConnectionsBehindNodes !== undefined ||
                onToggleAnimationConnections !== undefined ||
                onToggleAnimationToggleOnClick !== undefined) && <MenubarSeparator />}
              <MenubarSub>
                <MenubarSubTrigger data-tutorial-id="view-menu">View</MenubarSubTrigger>
                <MenubarSubContent>
                  <ViewThemeSubmenu />
                </MenubarSubContent>
              </MenubarSub>
            </>
          </MenubarContent>
        </MenubarMenu>
        <MenubarMenu>
          <MainMenubarTrigger onPauseConnectionAnimations={onConnectionAnimationPauseFromMenu}>
            Layout
          </MainMenubarTrigger>
          <MenubarContent>
            {onAutoLayout && (
              <MenubarItem onClick={onAutoLayout}>
                <CheckSquare className="mr-2 h-4 w-4" />
                Auto Layout
                <MenubarShortcut>Ctrl+Shift+L</MenubarShortcut>
              </MenubarItem>
            )}
            {onOpenZOrderList && (
              <MenubarItem
                onClick={() => {
                  onOpenZOrderList();
                  onConnectionAnimationPauseFromMenu?.();
                }}
                disabled={isReadOnly}
              >
                <ListOrdered className="mr-2 h-4 w-4" />
                Stacking order list
              </MenubarItem>
            )}
            {onAlignObjects && (
              <>
                <MenubarSeparator />
                <MenubarItem onClick={() => onAlignObjects('left')}>
                  Align Left
                </MenubarItem>
                <MenubarItem onClick={() => onAlignObjects('h-center')}>
                  Align Center (H)
                </MenubarItem>
                <MenubarItem onClick={() => onAlignObjects('right')}>
                  Align Right
                </MenubarItem>
                <MenubarSeparator />
                <MenubarItem onClick={() => onAlignObjects('top')}>
                  Align Top
                </MenubarItem>
                <MenubarItem onClick={() => onAlignObjects('v-middle')}>
                  Align Middle (V)
                </MenubarItem>
                <MenubarItem onClick={() => onAlignObjects('bottom')}>
                  Align Bottom
                </MenubarItem>
                <MenubarSeparator />
                <MenubarItem onClick={() => onAlignObjects('distribute-h')}>
                  Distribute Horizontally
                </MenubarItem>
                <MenubarItem onClick={() => onAlignObjects('distribute-v')}>
                  Distribute Vertically
                </MenubarItem>
                {onLayoutGridStep && (
                  <>
                    <MenubarSeparator />
                    <div
                      className="flex items-center gap-2 px-2 py-1.5 text-sm"
                      onPointerDown={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <label htmlFor="layout-grid-step-amount" className="text-muted-foreground shrink-0">
                        Step amount:
                      </label>
                      <Input
                        id="layout-grid-step-amount"
                        type="number"
                        min={-99}
                        max={99}
                        step={1}
                        className="h-8 w-16 px-2"
                        value={layoutGridStepInput}
                        onChange={(e) => setLayoutGridStepInput(e.target.value)}
                        onBlur={() => commitLayoutGridStepInput(layoutGridStepInput)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <MenubarItem
                      onClick={() =>
                        onLayoutGridStep('horizontal-left', parsedLayoutGridStep)
                      }
                      disabled={isReadOnly || layoutStaircaseCanvasCount < 2}
                    >
                      <LayoutHorizontalStepIcon className="mr-2 h-4 w-4 shrink-0" />
                      Horizontal step
                    </MenubarItem>
                    <MenubarItem
                      onClick={() =>
                        onLayoutGridStep('vertical-down', parsedLayoutGridStep)
                      }
                      disabled={isReadOnly || layoutStaircaseCanvasCount < 2}
                    >
                      <LayoutVerticalStepIcon className="mr-2 h-4 w-4 shrink-0" />
                      Vertical step
                    </MenubarItem>
                    <MenubarItem
                      onClick={() =>
                        onLayoutGridStep('horizontal-curve', parsedLayoutGridStep)
                      }
                      disabled={isReadOnly || layoutStaircaseCanvasCount < 3}
                    >
                      <LayoutHorizontalCurveIcon className="mr-2 h-4 w-4 shrink-0" />
                      Horizontal curve
                    </MenubarItem>
                    <MenubarItem
                      onClick={() =>
                        onLayoutGridStep('vertical-curve', parsedLayoutGridStep)
                      }
                      disabled={isReadOnly || layoutStaircaseCanvasCount < 3}
                    >
                      <LayoutVerticalCurveIcon className="mr-2 h-4 w-4 shrink-0" />
                      Vertical curve
                    </MenubarItem>
                  </>
                )}
              </>
            )}
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
      
      {/* Theme Selector in Main Toolbar */}
      <ThemeMenuSelector 
        onThemeSelect={onThemeApplyToSelected}
        onOpenEditor={() => setThemeEditorOpen(true)}
        isReadOnly={isReadOnly}
      />
      
      {/* Fit to View Button */}
      {onFitToView && (
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 px-2"
          onClick={onFitToView}
          title="Fit to View"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      )}
      {onOpenZOrderList && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={() => {
            onOpenZOrderList();
            onConnectionAnimationPauseFromMenu?.();
          }}
          title="Stacking order (front to back)"
          disabled={isReadOnly}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
      )}
      {showPresentationToolbar && presentationToolbar && (
        <>
          <div className="mx-1 h-6 w-px shrink-0 bg-border" aria-hidden />
          <div className="flex min-w-0 shrink-0 items-center gap-0.5">
            <span className="hidden shrink-0 px-1 text-[11px] text-muted-foreground sm:inline">Slides</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 px-0"
                  onClick={presentationToolbar.onAddSnapshot}
                  disabled={isReadOnly || !presentationActiveDeck}
                  aria-label="Duplicate slide"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Duplicate Slide</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 px-0"
                  onClick={presentationToolbar.onAddBlankSlide}
                  disabled={isReadOnly || !presentationActiveDeck}
                  aria-label="Add blank slide after current"
                >
                  <FilePlus className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Add blank slide after current</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 px-0"
                  onClick={() => presentationToolbar.onApplyZoomToCurrent()}
                  disabled={isReadOnly || !presentationActiveDeck}
                  aria-label="Apply zoom to current slide"
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Apply zoom to current slide</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 px-0"
                  onClick={() => presentationToolbar.onApplyZoomToAll()}
                  disabled={
                    isReadOnly || !presentationActiveDeck || presentationActiveDeck.slides.length === 0
                  }
                  aria-label="Apply zoom to all snapshots"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Apply zoom to all snapshots</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 px-0"
                  onClick={presentationToolbar.onPreviousSlide}
                  disabled={isReadOnly || !presentationActiveDeck || !presentationCanStepSlides}
                  aria-label="Previous slide"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Previous slide</TooltipContent>
            </Tooltip>
            <span
              className="min-w-[2.75rem] shrink-0 text-center tabular-nums text-[11px] text-muted-foreground"
              aria-live="polite"
              aria-label={
                presentationActiveDeck
                  ? `Slide ${presentationSlideReadoutIndex} of ${presentationStripTotal}`
                  : 'No deck'
              }
            >
              {presentationActiveDeck ? `${presentationSlideReadoutIndex} / ${presentationStripTotal}` : '—'}
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 px-0"
                  onClick={presentationToolbar.onNextSlide}
                  disabled={isReadOnly || !presentationActiveDeck || !presentationCanStepSlides}
                  aria-label="Next slide"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Next slide</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="default"
                  className="h-8 w-8 px-0"
                  onClick={presentationToolbar.onEnterPlayMode}
                  disabled={isReadOnly || !presentationActiveDeck}
                  aria-label="Enter play mode"
                >
                  <Play className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Enter play mode</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 px-0"
                  onClick={presentationToolbar.onToggleSnapshotsCollapsed}
                  aria-label={
                    presentationToolbar.snapshotsCollapsed
                      ? 'Show snapshot previews'
                      : 'Hide snapshot previews'
                  }
                >
                  {presentationToolbar.snapshotsCollapsed ? (
                    <Maximize2 className="h-3.5 w-3.5" />
                  ) : (
                    <Minimize2 className="h-3.5 w-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {presentationToolbar.snapshotsCollapsed ? 'Show snapshot previews' : 'Hide snapshot previews'}
              </TooltipContent>
            </Tooltip>
          </div>
        </>
      )}
      {onToggleAnimationConnections && (
        <Button
          variant="ghost"
          size="sm"
          className={cn('h-8 px-2', !(animationConnectionsEnabled ?? true) && 'opacity-50')}
          onClick={onToggleAnimationConnections}
          title={
            animationConnectionsMenuPaused && (animationConnectionsUserEnabled ?? true)
              ? 'Animations paused (menu or context); move on the canvas to resume'
              : animationConnectionsIdlePaused && (animationConnectionsUserEnabled ?? animationConnectionsEnabled ?? true)
                ? 'Animations paused (idle); move on the canvas to resume'
                : (animationConnectionsEnabled ?? true)
                  ? 'Disable connection line animations (Ctrl+Alt+A)'
                  : 'Enable connection line animations (Ctrl+Alt+A)'
          }
          aria-label={
            animationConnectionsMenuPaused && (animationConnectionsUserEnabled ?? true)
              ? 'Animations paused until you move on the canvas'
              : animationConnectionsIdlePaused && (animationConnectionsUserEnabled ?? animationConnectionsEnabled ?? true)
                ? 'Animations paused until you move on the canvas'
                : (animationConnectionsEnabled ?? true)
                  ? 'Disable connection line animations'
                  : 'Enable connection line animations'
          }
          aria-pressed={(animationConnectionsEnabled ?? true) ? 'true' : 'false'}
        >
          <Activity className="h-4 w-4" />
        </Button>
      )}
      
      {selectedItem && !isReadOnly && ((selectedItem.itemType !== 'edge' && onItemUpdate && onConnect && onDisconnect && onDelete) || (selectedItem.itemType === 'edge' && onConnectionUpdate && onDelete)) && (
        <>
          <div className="h-6 w-px bg-border mx-2" />
          <ContextToolbar
            selectedItem={selectedItem}
            selectedItemIds={selectedItemIds}
            cardElementSelection={cardElementSelection}
            onCardElementSelect={onCardElementSelect}
            onItemUpdate={onItemUpdate}
            onBulkMetadataUpdate={onBulkMetadataUpdate}
            onConnect={onConnect}
            onDisconnect={onDisconnect}
            onDelete={onDelete}
            onConnectionUpdate={onConnectionUpdate}
            onConnectionDisconnect={onConnectionDisconnect}
            onConnectionWaypointAdd={onConnectionWaypointAdd}
            onConnectionWaypointRemove={onConnectionWaypointRemove}
            diagramData={diagramData}
            onDiagramDataUpdate={onDiagramDataUpdate}
            currentDiagramData={currentDiagramData}
            onCurrentDiagramDataUpdate={onCurrentDiagramDataUpdate}
            onAlignObjects={onAlignObjects}
            onThemeApplyToSelected={onThemeApplyToSelected}
            textStylingPanelOpen={textStylingPanelOpen}
            visualStylingPanelOpen={visualStylingPanelOpen}
            lineStylingPanelOpen={lineStylingPanelOpen}
            connectionSettingsPanelOpen={connectionSettingsPanelOpen}
            onTextStylingPanelOpenChange={setTextStylingPanelOpen}
            onVisualStylingPanelOpenChange={handleVisualStylingPanelOpenChange}
            onLineStylingPanelOpenChange={setLineStylingPanelOpen}
            onConnectionSettingsPanelOpenChange={setConnectionSettingsPanelOpen}
            isReadOnly={isReadOnly}
            presentationHasLaterSlides={presentationHasLaterSlides}
            onPropagateAddToLaterSlides={onPropagateAddToLaterSlides}
            onPropagateDeleteToLaterSlides={onPropagateDeleteToLaterSlides}
          />
        </>
      )}
      {(selectedItem || selectedItemIds.size > 0) && (
        <div className="text-xs text-muted-foreground px-2">
          {selectedItemIds.size > 1 
            ? `${selectedItemIds.size} items selected`
            : selectedItem?.itemType === 'edge' 
              ? `Selected: Connection ${truncateName(`${selectedItem.from} → ${selectedItem.to}`)}`
              : `Selected: ${truncateName(selectedItem?.label || selectedItem?.id || 'Item')}`
          }
        </div>
      )}

      <ViewportCullDebugBadge stats={viewportCullStats} className="mx-1" />
      <PresentationThumbnailGeneratingIndicator
        active={presentationThumbnailGenerating}
        className="mx-1"
      />

      <Menubar className="ml-auto shrink-0 rounded-none border-0 border-b-0 border-l-0 border-r-0 border-t-0 h-auto">
        <MenubarMenu>
          <MainMenubarTrigger data-tutorial-id="help-menu" onPauseConnectionAnimations={onConnectionAnimationPauseFromMenu}>
            Help
          </MainMenubarTrigger>
          <MenubarContent>
            <MenubarItem onClick={() => setKeyboardShortcutsOpen(true)}>
              <Keyboard className="mr-2 h-4 w-4" />
              Keyboard shortcuts
            </MenubarItem>
            {onStartTutorial && (
              <MenubarItem onClick={onStartTutorial}>
                <BookOpen className="mr-2 h-4 w-4" />
                Interactive tutorial
              </MenubarItem>
            )}
            <InteractionRecorderHelpMenuItem />
            {ICON_MAINTENANCE_MENU_ENABLED && (
              <MenubarItem onClick={() => setIconMaintenanceOpen(true)}>
                <Wrench className="mr-2 h-4 w-4" />
                Icon maintenance…
              </MenubarItem>
            )}
            {pwaInstall.showInstallMenuItem && (
              <MenubarItem
                onClick={async () => {
                  if (pwaInstall.canNativeInstall) {
                    const outcome = await pwaInstall.promptInstall();
                    if (outcome === 'unavailable') setPwaInstallOpen(true);
                  } else {
                    setPwaInstallOpen(true);
                  }
                }}
              >
                <MonitorDown className="mr-2 h-4 w-4" />
                Install app…
              </MenubarItem>
            )}
            <MenubarItem onClick={() => setAboutOpen(true)}>
              <Info className="mr-2 h-4 w-4" />
              About
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>

      
      {/* Theme Editor Dialog */}
      {onJumpToHistoryIndex && (
        <HistoryBrowserDialog
          open={historyBrowserOpen}
          onOpenChange={setHistoryBrowserOpen}
          history={history}
          historyIndex={historyIndex}
          onJumpToIndex={onJumpToHistoryIndex}
          isReadOnly={isReadOnly}
        />
      )}
      <CanvasBackgroundDialog
        open={canvasBackgroundDialogOpen}
        onOpenChange={setCanvasBackgroundDialogOpen}
        savedColor={currentDiagramData?.canvasBackgroundColor}
        isReadOnly={isReadOnly}
        onSave={(color) => {
          onCurrentDiagramDataUpdate?.((prev) => {
            const next = { ...prev };
            if (color === undefined || !String(color).trim()) {
              delete next.canvasBackgroundColor;
            } else {
              next.canvasBackgroundColor = String(color).trim();
            }
            return next;
          });
        }}
      />
      <ThemeEditor
        open={themeEditorOpen}
        onOpenChange={setThemeEditorOpen}
        onThemeSelect={onThemeApplyToSelected}
        selectedItem={selectedItem}
        isReadOnly={isReadOnly}
      />
      
      {/* About Dialog */}
      <AboutDialog
        open={aboutOpen}
        onOpenChange={setAboutOpen}
      />

      <KeyboardShortcutsDialog
        open={keyboardShortcutsOpen}
        onOpenChange={setKeyboardShortcutsOpen}
      />

      <PwaInstallDialog
        open={pwaInstallOpen}
        onOpenChange={setPwaInstallOpen}
        canNativeInstall={pwaInstall.canNativeInstall}
      />

      {ICON_MAINTENANCE_MENU_ENABLED && (
        <IconMaintenanceDialog
          open={iconMaintenanceOpen}
          onOpenChange={setIconMaintenanceOpen}
        />
      )}
      
      {/* Viewer URL Dialog */}
      {diagramData && (
        <ViewerUrlDialog
          open={viewerUrlDialogOpen}
          onOpenChange={setViewerUrlDialogOpen}
          diagramData={diagramData}
        />
      )}
      {/* Rules Editor */}
      {onToggleRulesEditor && (
        <RulesEditor
          open={rulesEditorOpen ?? false}
          onOpenChange={(open) => onRulesEditorOpenChange?.(open)}
          rules={rules ?? []}
          onRulesChange={onRulesChange ?? (() => {})}
          diagramData={diagramData ?? undefined}
        />
      )}
    </div>
  );
}

