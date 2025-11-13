"use client";

import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Copy, Trash2, Link, Link2Off, Move3D, Type, Palette, Network, Maximize2, ChevronRight } from 'lucide-react';


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
  connections?: Array<{from: string; to: string; id?: string}>;
  itemType?: 'node' | 'group';
  onToggleFreeflow?: () => void;
  isFreeflow?: boolean;
  onTextStyling?: () => void;
  onVisualStyling?: () => void;
  onToggleSizeMode?: () => void;
  isSizeModeAuto?: boolean;
  supportsSizeMode?: boolean;
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
  connections = [],
  itemType = 'node',
  onToggleFreeflow,
  isFreeflow = false,
  onTextStyling,
  onVisualStyling,
  onToggleSizeMode,
  isSizeModeAuto = true,
  supportsSizeMode = false
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showConnectionsSubmenu, setShowConnectionsSubmenu] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
        setShowConnectionsSubmenu(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        setShowConnectionsSubmenu(false);
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

  if (!visible) {
    setShowConnectionsSubmenu(false);
    return null;
  }

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

      {supportsSizeMode && onToggleSizeMode && (
        <button
          className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
          onClick={() => {
            onToggleSizeMode();
            onClose();
          }}
        >
          <Maximize2 className="w-4 h-4" />
          Size: {isSizeModeAuto ? 'Auto' : 'Free'}
        </button>
      )}
      
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

      {(itemType === 'node' || itemType === 'group') && (
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

          {onShowConnections && connections.length > 0 && (
            <div className="relative">
              <button
                className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2 justify-between"
                onClick={() => setShowConnectionsSubmenu(!showConnectionsSubmenu)}
                onMouseEnter={() => setShowConnectionsSubmenu(true)}
              >
                <div className="flex items-center gap-2">
                  <Network className="w-4 h-4" />
                  Connections ({connections.length})
                </div>
                <ChevronRight className="w-4 h-4" />
              </button>
              
              {showConnectionsSubmenu && (
                <div
                  className={cn(
                    "absolute left-full top-0 ml-1 bg-popover border border-border rounded-md shadow-lg py-1 z-50 min-w-[200px] max-h-64 overflow-y-auto",
                    "animate-in fade-in-0 zoom-in-95"
                  )}
                  onMouseLeave={() => setShowConnectionsSubmenu(false)}
                >
                  {connections.map((connection, index) => (
                    <div
                      key={index}
                      className="px-3 py-2 text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer"
                      onClick={() => {
                        onShowConnections();
                        onClose();
                        setShowConnectionsSubmenu(false);
                      }}
                    >
                      <div>From: {connection.from}</div>
                      <div>To: {connection.to}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
    </div>
  );
}