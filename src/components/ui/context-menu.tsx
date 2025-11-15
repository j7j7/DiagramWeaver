"use client";

import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Copy, Trash2, Link, Link2Off, Move3D, Type, Palette, Network, Grid3X3, AlignLeft, AlignCenter } from 'lucide-react';


interface ContextMenuProps {
  x: number;
  y: number;
  visible: boolean;
  onClose: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onShowConnections?: () => void;
  triggerConnectionSettings?: () => void;
  connections?: Array<{from: string; to: string; id?: string}>;
  itemType?: 'node' | 'zone';
  onToggleFreeflow?: () => void;
  isFreeflow?: boolean;
  onTextStyling?: () => void;
  onVisualStyling?: () => void;
  onOrientationChange?: (orientation: 'auto' | 'grid' | 'horizontal' | 'vertical') => void;
  currentOrientation?: 'auto' | 'grid' | 'horizontal' | 'vertical';
}

export function ContextMenu({ 
  x, 
  y, 
  visible, 
  onClose, 
  onCopy, 
  onDelete, 
  onConnect, 
  onDisconnect,
  onShowConnections,
  triggerConnectionSettings,
  connections = [],
  itemType = 'node',
  onToggleFreeflow,
  isFreeflow = false,
  onTextStyling,
  onVisualStyling,
  onToggleSizeMode,
  isSizeModeAuto = true,
  supportsSizeMode = false,
  onOrientationChange,
  currentOrientation = 'auto'
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (visible) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div
      ref={menuRef}
      className={cn(
        "fixed bg-popover border border-border rounded-md shadow-lg py-1 z-50 min-w-[150px]",
        "animate-in fade-in-0 zoom-in-95"
      )}
      style={{
        left: `${x}px`,
        top: `${y}px`,
      }}
    >
      <button
        className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
        onClick={() => {
          onCopy();
          onClose();
        }}
      >
        <Copy className="w-4 h-4" />
        Copy
      </button>

      {onTextStyling && (
        <button
          className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
          onClick={() => {
            onTextStyling();
            onClose();
          }}
        >
          <Type className="w-4 h-4" />
          Text Styling
        </button>
      )}

      {onVisualStyling && (
        <button
          className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
          onClick={() => {
            onVisualStyling();
            onClose();
          }}
        >
          <Palette className="w-4 h-4" />
          Visual Styling
        </button>
      )}

      {itemType === 'zone' && onOrientationChange && (
        <>
          <div className="border-t border-border my-1" />
          <div className="px-3 py-1 text-xs font-medium text-muted-foreground">Orientation</div>
          <button
            className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
            onClick={() => {
              onOrientationChange('auto');
              onClose();
            }}
          >
            <AlignCenter className="w-4 h-4" />
            Auto
          </button>
          <button
            className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
            onClick={() => {
              onOrientationChange('grid');
              onClose();
            }}
          >
            <Grid3X3 className="w-4 h-4" />
            Grid
          </button>
          <button
            className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
            onClick={() => {
              onOrientationChange('horizontal');
              onClose();
            }}
          >
            <AlignLeft className="w-4 h-4" />
            Horizontal
          </button>
          <button
            className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
            onClick={() => {
              onOrientationChange('vertical');
              onClose();
            }}
          >
            <Move3D className="w-4 h-4" />
            Vertical
          </button>
        </>
      )}

      {itemType === 'node' && (
        <>
          <div className="border-t border-border my-1" />
          
          <button
            className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
            onClick={() => {
              onToggleFreeflow?.();
              onClose();
            }}
          >
            <Move3D className="w-4 h-4" />
            {isFreeflow ? 'Disable Freeflow' : 'Enable Freeflow'}
          </button>
        </>
      )}

      {(itemType === 'node' || itemType === 'zone') && (
        <>
          <div className="border-t border-border my-1" />
          
          <button
            className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
            onClick={() => {
              onConnect();
              onClose();
            }}
          >
            <Link className="w-4 h-4" />
            Connect
          </button>

          {triggerConnectionSettings && connections.length > 0 && (
            <button
              className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
              onClick={() => {
                triggerConnectionSettings();
                onClose();
              }}
            >
              <Network className="w-4 h-4" />
              Connections ({connections.length})
            </button>
          )}
          
          <button
            className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
            onClick={() => {
              onDisconnect();
              onClose();
            }}
          >
            <Link2Off className="w-4 h-4" />
            Disconnect
          </button>
        </>
      )}

      <div className="border-t border-border my-1" />
      
      <button
        className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
        onClick={() => {
          onDelete();
          onClose();
        }}
      >
        <Trash2 className="w-4 h-4 text-destructive" />
        Delete
      </button>
    </div>
  );
}