"use client";

import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Copy, Trash2, Link, Link2Off, Move3D } from 'lucide-react';

interface ContextMenuProps {
  x: number;
  y: number;
  visible: boolean;
  onClose: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  itemType?: 'node' | 'group';
  onToggleFreeflow?: () => void;
  isFreeflow?: boolean;
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
  itemType = 'node',
  onToggleFreeflow,
  isFreeflow = false
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
      
      <button
        className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
        onClick={() => {
          onDelete();
          onClose();
        }}
      >
        <Trash2 className="w-4 h-4" />
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