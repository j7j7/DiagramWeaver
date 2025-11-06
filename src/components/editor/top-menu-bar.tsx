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
import { Plus, Upload, Download, ImageDown, Undo, Redo, Copy, Clipboard, Code, Maximize2, Move } from 'lucide-react';
import { ContextToolbar } from './context-toolbar';
import type { SelectedItem } from '../diagram-editor';
import type { DiagramData } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

interface TopMenuBarProps {
  onNew: () => void;
  onLoad: () => void;
  onSave: () => void;
  onExportPng?: () => void;
  onToggleJsonPanel?: () => void;
  jsonPanelOpen?: boolean;
  onFitToView?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  canPaste?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  transform?: { x: number; y: number; k: number };
  onTransformChange?: (transform: { x: number; y: number; k: number }) => void;
  selectedItem?: SelectedItem | null;
  onItemUpdate?: (updatedItem: SelectedItem) => void;
  onConnect?: (connectionOptions?: { style?: 'bezier', curvature?: number }) => void;
  onDisconnect?: () => void;
  onDelete?: () => void;
  onConnectionUpdate?: (from: string, to: string, updates: { arrow?: boolean; text?: string; textPosition?: number; color?: string; [key: string]: any }) => void;
  diagramData?: DiagramData;
}

export function TopMenuBar({
  onNew,
  onLoad,
  onSave,
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
  transform,
  onTransformChange,
  selectedItem,
  onItemUpdate,
  onConnect,
  onDisconnect,
  onDelete,
  onConnectionUpdate,
  diagramData,
}: TopMenuBarProps) {
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
            {onExportPng && (
              <>
                <MenubarSeparator />
                <MenubarItem onClick={onExportPng}>
                  <ImageDown className="mr-2 h-4 w-4" />
                  Export PNG
                </MenubarItem>
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
            {(onCopy || onPaste) && (onUndo || onRedo) && (
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
                          max="4"
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
      {selectedItem && ((selectedItem.itemType !== 'edge' && onItemUpdate && onConnect && onDisconnect && onDelete) || (selectedItem.itemType === 'edge' && onConnectionUpdate && onDelete)) && (
        <>
          <div className="h-6 w-px bg-border mx-2" />
          <ContextToolbar
            selectedItem={selectedItem}
            onItemUpdate={onItemUpdate}
            onConnect={onConnect}
            onDisconnect={onDisconnect}
            onDelete={onDelete}
            onConnectionUpdate={onConnectionUpdate}
            diagramData={diagramData}
          />
        </>
      )}
      {/* Debug: Remove this after testing */}
      {process.env.NODE_ENV === 'development' && (
        <div className="text-xs text-muted-foreground px-2">
          {selectedItem ? `Selected: ${selectedItem.itemType}` : 'No selection'}
        </div>
      )}
      <div className="ml-auto px-4">
        <h1 className="text-2xl font-headline font-bold text-primary">Diagram Weaver</h1>
      </div>
    </div>
  );
}

