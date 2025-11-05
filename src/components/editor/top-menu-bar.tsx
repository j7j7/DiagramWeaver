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
import { Plus, Upload, Download, ImageDown, Undo, Redo, Copy, Clipboard } from 'lucide-react';

interface TopMenuBarProps {
  onNew: () => void;
  onLoad: () => void;
  onSave: () => void;
  onExportPng?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  canPaste?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

export function TopMenuBar({
  onNew,
  onLoad,
  onSave,
  onExportPng,
  onCopy,
  onPaste,
  canPaste,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: TopMenuBarProps) {
  return (
    <Menubar className="rounded-none border-b border-l-0 border-r-0 border-t-0">
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
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
}

