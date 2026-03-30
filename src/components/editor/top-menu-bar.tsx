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
import { Plus, Upload, Download, ImageDown, Undo, Redo, Copy, Clipboard, Code, Maximize2, Move, Eye, EyeOff, Palette, CheckSquare, Layers, Lock, Unlock, Info, ExternalLink, PanelRight, ListChecks, Network, Sun, Moon, Sparkles, Keyboard, BookOpen, Type } from 'lucide-react';
import { ContextToolbar } from './context-toolbar';
import { ThemeEditor } from './theme-editor';
import { RulesEditor } from './rules-editor';
import { ThemeMenuSelector } from './theme-menu-selector';
import { AboutDialog } from './about-dialog';
import { KeyboardShortcutsDialog } from './keyboard-shortcuts-dialog';
import { ViewerUrlDialog } from './viewer-url-dialog';
import { useTheme } from '@/components/theme-provider';
import type { SelectedItem } from '../diagram-editor';
import type { DiagramData } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { DiagramTheme } from '@/lib/theme-types';

const truncateName = (s: string, max = 20) => (s.length > max ? `${s.slice(0, max - 3)}...` : s);

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
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onSelectAll?: () => void;
  transform?: { x: number; y: number; k: number };
  onTransformChange?: (transform: { x: number; y: number; k: number }) => void;
  selectedItem?: SelectedItem | null;
  selectedItemIds?: Set<string>;
  onItemUpdate?: (updatedItem: SelectedItem) => void;
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
  mousePosition?: { x: number; y: number } | null;
  hoverEnabled?: boolean;
  onToggleHover?: () => void;
  iconBackgroundEnabled?: boolean;
  onToggleIconBackground?: () => void;
  alignmentGuidesEnabled?: boolean;
  onToggleAlignmentGuides?: () => void;
  connectionsBehindNodesEnabled?: boolean;
  onToggleConnectionsBehindNodes?: () => void;
  animationConnectionsEnabled?: boolean;
  onToggleAnimationConnections?: () => void;
  animationToggleOnClickEnabled?: boolean;
  onToggleAnimationToggleOnClick?: () => void;
  /** When true, new palette drops get resource name (label) + info; text/textbox unchanged. */
  defaultTextLabelsEnabled?: boolean;
  onToggleDefaultTextLabels?: () => void;
  onAlignObjects?: (alignment: 'top' | 'center' | 'bottom' | 'v-middle' | 'left' | 'h-center' | 'right' | 'distribute-v' | 'distribute-h') => void;
  onThemeApplyToSelected?: (theme: DiagramTheme) => void;
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
  onToggleScratchPad?: () => void;
  scratchPadOpen?: boolean;
  onToggleRulesEditor?: () => void;
  onRulesEditorOpenChange?: (open: boolean) => void;
  rulesEditorOpen?: boolean;
  rules?: import('@/lib/rules-types').DiagramRule[];
  onRulesChange?: (rules: import('@/lib/rules-types').DiagramRule[]) => void;
  presentationModeEnabled?: boolean;
  onTogglePresentationMode?: () => void;
  presentationHasLaterSlides?: boolean;
  onPropagateAddToLaterSlides?: () => void;
  onPropagateDeleteToLaterSlides?: () => void;
  isReadOnly?: boolean;
  onToggleReadOnly?: () => void;
  onStartTutorial?: () => void;
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
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onSelectAll,
  transform,
  onTransformChange,
  selectedItem,
  selectedItemIds = new Set(),
  onItemUpdate,
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
  mousePosition,
  hoverEnabled,
  onToggleHover,
  iconBackgroundEnabled,
  onToggleIconBackground,
  alignmentGuidesEnabled,
  onToggleAlignmentGuides,
  connectionsBehindNodesEnabled,
  onToggleConnectionsBehindNodes,
  animationConnectionsEnabled,
  onToggleAnimationConnections,
  animationToggleOnClickEnabled,
  onToggleAnimationToggleOnClick,
  defaultTextLabelsEnabled = true,
  onToggleDefaultTextLabels,
  onAlignObjects,
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
  onToggleScratchPad,
  scratchPadOpen,
  onToggleRulesEditor,
  onRulesEditorOpenChange,
  rulesEditorOpen,
  rules = [],
  onRulesChange,
  presentationModeEnabled = false,
  onTogglePresentationMode,
  presentationHasLaterSlides = false,
  onPropagateAddToLaterSlides,
  onPropagateDeleteToLaterSlides,
  isReadOnly = false,
  onToggleReadOnly,
  onStartTutorial,
}: TopMenuBarProps) {
  
  const [themeEditorOpen, setThemeEditorOpen] = React.useState(false);
  const [aboutOpen, setAboutOpen] = React.useState(false);
  const [keyboardShortcutsOpen, setKeyboardShortcutsOpen] = React.useState(false);
  const [viewerUrlDialogOpen, setViewerUrlDialogOpen] = React.useState(false);
  const [textStylingPanelOpen, setTextStylingPanelOpen] = React.useState(false);
  const [visualStylingPanelOpen, setVisualStylingPanelOpen] = React.useState(false);
  const [lineStylingPanelOpen, setLineStylingPanelOpen] = React.useState(false);
  const [connectionSettingsPanelOpen, setConnectionSettingsPanelOpen] = React.useState(false);

  const hasOptionsPanelMenuItems =
    Boolean(onTogglePropertiesPanel) ||
    Boolean(onToggleLayersPanel) ||
    Boolean(onToggleScratchPad) ||
    Boolean(onToggleRulesEditor) ||
    Boolean(onTogglePresentationMode);

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
          <MenubarTrigger data-tutorial-id="file-menu">File</MenubarTrigger>
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
          <MenubarTrigger data-tutorial-id="edit-menu">Edit</MenubarTrigger>
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
            {onFitToView && (
              <>
                {(onUndo || onRedo) && <MenubarSeparator />}
                <MenubarItem onClick={onFitToView}>
                  <Maximize2 className="mr-2 h-4 w-4" />
                  Fit to View
                </MenubarItem>
              </>
            )}
            {onToggleReadOnly !== undefined && (
              <>
                {(onUndo || onRedo || onFitToView) && <MenubarSeparator />}
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
          </MenubarContent>
        </MenubarMenu>
        <MenubarMenu>
          <MenubarTrigger data-tutorial-id="options-menu">Options</MenubarTrigger>
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
            {onToggleRulesEditor && (
              <>
                {(onToggleJsonPanel || onTogglePropertiesPanel || onToggleLayersPanel || onToggleScratchPad) && <MenubarSeparator />}
                <MenubarItem onClick={() => onToggleRulesEditor?.()}>
                  <ListChecks className="mr-2 h-4 w-4" />
                  Rules
                </MenubarItem>
              </>
            )}
            {onTogglePresentationMode && (
              <>
                {(onToggleJsonPanel || onTogglePropertiesPanel || onToggleLayersPanel || onToggleScratchPad || onToggleRulesEditor) && <MenubarSeparator />}
                <MenubarItem onClick={onTogglePresentationMode}>
                  <Layers className="mr-2 h-4 w-4" />
                  {presentationModeEnabled ? 'Exit Presentation Mode' : 'Enter Presentation Mode'}
                  <MenubarShortcut>{presentationModeEnabled ? 'Alt+P' : 'Ctrl+Alt+P'}</MenubarShortcut>
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
            {onToggleDefaultTextLabels !== undefined && (
              <>
                {(onToggleMetadataPopups ||
                  onToggleLayerAnimations !== undefined ||
                  onToggleHover !== undefined ||
                  onToggleAlignmentGuides !== undefined ||
                  onToggleJsonPanel ||
                  hasOptionsPanelMenuItems) && <MenubarSeparator />}
                <MenubarItem onClick={onToggleDefaultTextLabels}>
                  <Type className="mr-2 h-4 w-4" />
                  {defaultTextLabelsEnabled ? 'Disable Default Text Labels' : 'Enable Default Text Labels'}
                </MenubarItem>
              </>
            )}
            {onToggleIconBackground !== undefined && (
              <>
                {(onToggleMetadataPopups ||
                  onToggleLayerAnimations !== undefined ||
                  onToggleHover !== undefined ||
                  onToggleAlignmentGuides !== undefined ||
                  onToggleDefaultTextLabels !== undefined ||
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
                  onToggleDefaultTextLabels !== undefined ||
                  onToggleIconBackground !== undefined ||
                  onToggleConnectionsBehindNodes !== undefined ||
                  onToggleJsonPanel ||
                  hasOptionsPanelMenuItems) && <MenubarSeparator />}
                <MenubarItem onClick={onToggleAnimationConnections}>
                  {animationConnectionsEnabled ? (
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
          <MenubarTrigger>Layout</MenubarTrigger>
          <MenubarContent>
            {onAutoLayout && (
              <MenubarItem onClick={onAutoLayout}>
                <CheckSquare className="mr-2 h-4 w-4" />
                Auto Layout
                <MenubarShortcut>Ctrl+Shift+L</MenubarShortcut>
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
      
      {selectedItem && !isReadOnly && ((selectedItem.itemType !== 'edge' && onItemUpdate && onConnect && onDisconnect && onDelete) || (selectedItem.itemType === 'edge' && onConnectionUpdate && onDelete)) && (
        <>
          <div className="h-6 w-px bg-border mx-2" />
          <ContextToolbar
            selectedItem={selectedItem}
            selectedItemIds={selectedItemIds}
            onItemUpdate={onItemUpdate}
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
            onVisualStylingPanelOpenChange={setVisualStylingPanelOpen}
            onLineStylingPanelOpenChange={setLineStylingPanelOpen}
            onConnectionSettingsPanelOpenChange={setConnectionSettingsPanelOpen}
            isReadOnly={isReadOnly}
            presentationModeEnabled={presentationModeEnabled}
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
      {transform && typeof transform.k === 'number' && Number.isFinite(transform.k) && (
        <div className="text-xs text-muted-foreground px-2 border-l border-border">
          Zoom: {(transform.k * 100).toFixed(1)}% (k: {transform.k.toFixed(3)})
        </div>
      )}
      {mousePosition && (
        <div className="text-xs text-muted-foreground px-2 border-l border-border">
          Cursor: X: {mousePosition.x.toFixed(0)}, Y: {mousePosition.y.toFixed(0)}
        </div>
      )}

      <Menubar className="ml-auto shrink-0 rounded-none border-0 border-b-0 border-l-0 border-r-0 border-t-0 h-auto">
        <MenubarMenu>
          <MenubarTrigger data-tutorial-id="help-menu">Help</MenubarTrigger>
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
            <MenubarItem onClick={() => setAboutOpen(true)}>
              <Info className="mr-2 h-4 w-4" />
              About
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>

      
      {/* Theme Editor Dialog */}
      <ThemeEditor 
        open={themeEditorOpen}
        onOpenChange={setThemeEditorOpen}
        onThemeSelect={onThemeApplyToSelected}
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

