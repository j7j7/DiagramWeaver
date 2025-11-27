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
} from '@/components/ui/menubar';
import { Plus, Upload, Download, ImageDown, Undo, Redo, Copy, Clipboard, Code, Maximize2, Move, Eye, EyeOff, Palette, CheckSquare, Layers } from 'lucide-react';
import { ContextToolbar } from './context-toolbar';
import { ThemeEditor } from './theme-editor';
import { ThemeMenuSelector } from './theme-menu-selector';
import type { SelectedItem } from '../diagram-editor';
import type { DiagramData } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { DiagramTheme } from '@/lib/theme-types';

interface TopMenuBarProps {
  onNew: () => void;
  onLoad: () => void;
  onSave: () => void;
  onNewTab?: () => void;
  onExportSvg?: () => void;
  onExportPng?: () => void;
  onToggleJsonPanel?: () => void;
  jsonPanelOpen?: boolean;
  onToggleLayersPanel?: () => void;
  layersPanelOpen?: boolean;
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
  onConnect?: (connectionOptions?: { style?: 'bezier', curvature?: number }) => void;
  onDisconnect?: () => void;
  onDelete?: () => void;
  onConnectionUpdate?: (from: string, to: string, updates: { arrow?: boolean; text?: string; textPosition?: number; color?: string; [key: string]: any }) => void;
  onConnectionDisconnect?: (from: string, to: string) => void;
  diagramData?: DiagramData;
  onDiagramDataUpdate?: (newDiagramData: DiagramData) => void;
  mousePosition?: { x: number; y: number } | null;
  hoverEnabled?: boolean;
  onToggleHover?: () => void;
  selectionAnimationEnabled?: boolean;
  onToggleSelectionAnimation?: () => void;
  onAlignObjects?: (alignment: 'top' | 'center' | 'bottom' | 'v-middle' | 'left' | 'h-center' | 'right' | 'distribute-v' | 'distribute-h') => void;
  onThemeApplyToSelected?: (theme: DiagramTheme) => void;
  triggerTextStylingPanel?: boolean;
  triggerVisualStylingPanel?: boolean;
  triggerConnectionSettingsPanel?: boolean;
  onConnectionSettingsPanelOpenChange?: (open: boolean) => void;
  onCloseConnectionSettingsPanel?: () => void;
  onTextStylingPanelOpenChange?: (open: boolean) => void;
  onVisualStylingPanelOpenChange?: (open: boolean) => void;
  onResetConnectionSettingsTrigger?: () => void;
}

export function TopMenuBar({
  onNew,
  onLoad,
  onSave,
  onNewTab,
  onExportSvg,
  onExportPng,
  onToggleJsonPanel,
  jsonPanelOpen,
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
  diagramData,
  onDiagramDataUpdate,
  mousePosition,
  hoverEnabled,
  onToggleHover,
  selectionAnimationEnabled,
  onToggleSelectionAnimation,
  onAlignObjects,
  onThemeApplyToSelected,
  triggerTextStylingPanel = false,
  triggerVisualStylingPanel = false,
  triggerConnectionSettingsPanel = false,
onToggleLayersPanel,
  layersPanelOpen,
  onConnectionSettingsPanelOpenChange,
  onCloseConnectionSettingsPanel,
  onTextStylingPanelOpenChange,
  onVisualStylingPanelOpenChange,
  onResetConnectionSettingsTrigger,
}: TopMenuBarProps) {
  console.log('TopMenuBar props:', { selectionAnimationEnabled, onToggleSelectionAnimation });
  const [themeEditorOpen, setThemeEditorOpen] = React.useState(false);
  const [textStylingPanelOpen, setTextStylingPanelOpen] = React.useState(false);
  const [visualStylingPanelOpen, setVisualStylingPanelOpen] = React.useState(false);
  const [connectionSettingsPanelOpen, setConnectionSettingsPanelOpen] = React.useState(false);

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

  // Close connection settings panel when clicking away (deselecting)
  React.useEffect(() => {
    if (!selectedItem) {
      setConnectionSettingsPanelOpen(false);
      onConnectionSettingsPanelOpenChange?.(false);
    }
  }, [selectedItem, onConnectionSettingsPanelOpenChange]);


  return (
    <div className="flex items-center border-b bg-card min-h-[2.5rem] overflow-x-auto">
      <Menubar className="rounded-none border-0 border-b-0 border-l-0 border-r-0 border-t-0 h-auto shrink-0">
        <MenubarMenu>
          <MenubarTrigger>File</MenubarTrigger>
          <MenubarContent>
            <MenubarItem onClick={onNew}>
              <Plus className="mr-2 h-4 w-4" />
              New
              <MenubarShortcut>Ctrl+N</MenubarShortcut>
            </MenubarItem>
            <MenubarItem onClick={onLoad}>
              <Upload className="mr-2 h-4 w-4" />
              Load
              <MenubarShortcut>Ctrl+O</MenubarShortcut>
            </MenubarItem>
            <MenubarItem onClick={onSave}>
              <Download className="mr-2 h-4 w-4" />
              Save
              <MenubarShortcut>Ctrl+S</MenubarShortcut>
            </MenubarItem>
            {onNewTab && (
              <>
                <MenubarSeparator />
                <MenubarItem onClick={onNewTab}>
                  <Plus className="mr-2 h-4 w-4" />
                  + Tab
                </MenubarItem>
              </>
            )}
            {(onExportSvg || onExportPng) && (
              <>
                <MenubarSeparator />
                {onExportSvg && (
                  <MenubarItem onClick={onExportSvg}>
                    <ImageDown className="mr-2 h-4 w-4" />
                    Export SVG
                  </MenubarItem>
                )}
                {onExportPng && (
                  <MenubarItem onClick={onExportPng}>
                    <ImageDown className="mr-2 h-4 w-4" />
                    Export PNG
                  </MenubarItem>
                )}
              </>
            )}
            {onToggleJsonPanel && (
              <>
                <MenubarSeparator />
                <MenubarItem onClick={onToggleJsonPanel}>
                  <Code className="mr-2 h-4 w-4" />
                  {jsonPanelOpen ? 'Hide JSON' : 'Show JSON'}
                </MenubarItem>
              </>
            )}
          </MenubarContent>
        </MenubarMenu>
        <MenubarMenu>
          <MenubarTrigger>Edit</MenubarTrigger>
          <MenubarContent>
            {onCopy && (
              <MenubarItem onClick={onCopy}>
                <Copy className="mr-2 h-4 w-4" />
                Copy
                <MenubarShortcut>Ctrl+C</MenubarShortcut>
              </MenubarItem>
            )}
            {onPaste && (
              <MenubarItem onClick={onPaste} disabled={!canPaste}>
                <Clipboard className="mr-2 h-4 w-4" />
                Paste
                <MenubarShortcut>Ctrl+V</MenubarShortcut>
              </MenubarItem>
            )}
            {onSelectAll && (
              <>
                <MenubarSeparator />
                <MenubarItem onClick={onSelectAll}>
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
              <MenubarItem onClick={onUndo} disabled={!canUndo}>
                <Undo className="mr-2 h-4 w-4" />
                Undo
                <MenubarShortcut>Ctrl+Z</MenubarShortcut>
              </MenubarItem>
            )}
            {onRedo && (
              <MenubarItem onClick={onRedo} disabled={!canRedo}>
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
            {onToggleLayersPanel && (
              <>
                {(onUndo || onRedo || onFitToView) && <MenubarSeparator />}
                <MenubarItem onClick={onToggleLayersPanel}>
                  <Layers className="mr-2 h-4 w-4" />
                  {layersPanelOpen ? 'Hide Layers' : 'Show Layers'}
                </MenubarItem>
              </>
            )}
            {onToggleHover !== undefined && (
              <>
                {(onUndo || onRedo || onFitToView || onToggleLayersPanel) && <MenubarSeparator />}
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
            {onToggleSelectionAnimation !== undefined && (
              <>
                {(onUndo || onRedo || onFitToView || onToggleHover) && <MenubarSeparator />}
                <MenubarItem onClick={onToggleSelectionAnimation}>
                  {selectionAnimationEnabled ? (
                    <>
                      <Move className="mr-2 h-4 w-4" />
                      Disable Selection Animation
                    </>
                  ) : (
                    <>
                      <Move className="mr-2 h-4 w-4" />
                      Enable Selection Animation
                    </>
                  )}
                </MenubarItem>
              </>
            )}
            {onTransformChange && (
              <>
                {(onUndo || onRedo || onFitToView) && <MenubarSeparator />}
                <Popover>
                  <PopoverTrigger asChild>
                    <MenubarItem onSelect={(e) => e.preventDefault()}>
                      <Move className="mr-2 h-4 w-4" />
                      Canvas Transform
                    </MenubarItem>
                  </PopoverTrigger>
                  <PopoverContent className="w-64" align="start">
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="transform-x">X Position</Label>
                        <Input
                          id="transform-x"
                          type="number"
                          value={transform?.x || 0}
                          onChange={(e) => onTransformChange({ 
                            x: parseFloat(e.target.value) || 0,
                            y: transform?.y || 0,
                            k: transform?.k || 1
                          })}
                          className="w-full"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="transform-y">Y Position</Label>
                        <Input
                          id="transform-y"
                          type="number"
                          value={transform?.y || 0}
                          onChange={(e) => onTransformChange({ 
                            x: transform?.x || 0,
                            y: parseFloat(e.target.value) || 0,
                            k: transform?.k || 1
                          })}
                          className="w-full"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="transform-zoom">Zoom Level</Label>
                        <Input
                          id="transform-zoom"
                          type="number"
                          step="0.1"
                          min="0.1"
                          max="2.5"
                          value={transform?.k || 1}
                          onChange={(e) => onTransformChange({ 
                            x: transform?.x || 0,
                            y: transform?.y || 0,
                            k: parseFloat(e.target.value) || 1
                          })}
                          className="w-full"
                        />
                      </div>
                      
                      <div className="pt-2">
                        <Button 
                          variant="outline" 
                          onClick={() => onTransformChange({ x: 0, y: 0, k: 1 })}
                          className="w-full"
                        >
                          Reset Transform
                        </Button>
                      </div>
                      
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p><strong>X:</strong> Horizontal pan position</p>
                        <p><strong>Y:</strong> Vertical pan position</p>
                        <p><strong>Zoom:</strong> Scale factor (1.0 = 100%)</p>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </>
            )}
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
      
      {/* Theme Selector in Main Toolbar */}
      <ThemeMenuSelector 
        onThemeSelect={onThemeApplyToSelected}
        onOpenEditor={() => setThemeEditorOpen(true)}
      />
      
      {selectedItem && ((selectedItem.itemType !== 'edge' && onItemUpdate && onConnect && onDisconnect && onDelete) || (selectedItem.itemType === 'edge' && onConnectionUpdate && onDelete)) && (
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
            diagramData={diagramData}
            onDiagramDataUpdate={onDiagramDataUpdate}
            onAlignObjects={onAlignObjects}
            onThemeApplyToSelected={onThemeApplyToSelected}
            textStylingPanelOpen={textStylingPanelOpen}
            visualStylingPanelOpen={visualStylingPanelOpen}
            connectionSettingsPanelOpen={connectionSettingsPanelOpen}
            onTextStylingPanelOpenChange={setTextStylingPanelOpen}
            onVisualStylingPanelOpenChange={setVisualStylingPanelOpen}
            onConnectionSettingsPanelOpenChange={setConnectionSettingsPanelOpen}
          />
        </>
      )}
      {(selectedItem || selectedItemIds.size > 0) && (
        <div className="text-xs text-muted-foreground px-2">
          {selectedItemIds.size > 1 
            ? `${selectedItemIds.size} items selected`
            : selectedItem?.itemType === 'edge' 
              ? `Selected: Connection ${selectedItem.from} → ${selectedItem.to}`
              : `Selected: ${selectedItem?.label || selectedItem?.id || 'Item'}`
          }
        </div>
      )}
      {mousePosition && (
        <div className="text-xs text-muted-foreground px-2 border-l border-border">
          Position: X: {mousePosition.x}, Y: {mousePosition.y}
        </div>
      )}
      {transform && (
        <div className="text-xs text-muted-foreground px-2 border-l border-border">
          Zoom: {(transform.k * 100).toFixed(0)}%
        </div>
      )}
      <div className="ml-auto px-4">
        <h1 className="text-2xl font-headline font-bold text-primary">Diagram Weaver</h1>
      </div>
      
      {/* Theme Editor Dialog */}
      <ThemeEditor 
        open={themeEditorOpen}
        onOpenChange={setThemeEditorOpen}
        onThemeSelect={onThemeApplyToSelected}
      />
    </div>
  );
}

