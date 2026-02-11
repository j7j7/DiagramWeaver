"use client";

import React, { useEffect, useRef, useState } from 'react';
import { cn, isShapeNodeType } from '@/lib/utils';
import { Copy, Trash2, Link, Link2Off, Move3D, Type, Palette, Network, Grid3X3, AlignLeft, AlignCenter, Layers, ChevronRight, Group, Ungroup, Plus, ArrowUp, ArrowDown, ChevronUp, ChevronDown, Circle, RotateCw, ArrowDownAZ, ArrowUpAZ, Minus, Lock, Unlock } from 'lucide-react';


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
  itemId?: string;
  nodeType?: string;
  onTextStyling?: () => void;
  onVisualStyling?: () => void;
  onLineStyling?: () => void;
  onOrientationChange?: (orientation: 'auto' | 'grid' | 'horizontal' | 'vertical') => void;
  onLayoutChange?: (layout: 'grid' | 'circular') => void;
  onCycleItems?: () => void;
  onSortItems?: (order: 'alpha-asc' | 'alpha-desc') => void;
  currentOrientation?: 'auto' | 'grid' | 'horizontal' | 'vertical';
  currentLayer?: string;
  availableLayers?: Array<{id: string; name: string}>;
  onChangeLayer?: (layerId: string) => void;
  onGroup?: () => void;
  onUngroup?: () => void;
  onRemoveFromGroup?: (itemId: string) => void;
  onAddToGroup?: () => void;
  isGrouped?: boolean;
  canGroup?: boolean;
  canAddToGroup?: boolean;
  onMoveToBack?: () => void;
  onMoveToFront?: () => void;
  onMoveOneBack?: () => void;
  onMoveOneForward?: () => void;
  canMoveToBack?: boolean;
  canMoveToFront?: boolean;
  canMoveOneBack?: boolean;
  canMoveOneForward?: boolean;
  onToggleLock?: () => void;
  isLocked?: boolean;
}

// Helper function to check if a node type is a line
const isLineNodeType = (nodeType?: string): boolean => {
  return nodeType === 'generic.object.line' || (nodeType?.endsWith('.line') ?? false);
};


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
  nodeType,
  onTextStyling,
  onVisualStyling,
  onLineStyling,
  onOrientationChange,
  currentOrientation = 'auto',
  currentLayer,
  availableLayers = [],
  onChangeLayer,
  onGroup,
  onUngroup,
  onRemoveFromGroup,
  onAddToGroup,
  isGrouped = false,
  canGroup = false,
  canAddToGroup = false,
  itemId,
  onMoveToBack,
  onMoveToFront,
  onMoveOneBack,
  onMoveOneForward,
  canMoveToBack = false,
  canMoveToFront = false,
  canMoveOneBack = false,
  canMoveOneForward = false,
  onLayoutChange,
  onCycleItems,
  onSortItems,
  onToggleLock,
  isLocked = false
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [layerSubmenuOpen, setLayerSubmenuOpen] = useState(false);
  const [renderOrderSubmenuOpen, setRenderOrderSubmenuOpen] = useState(false);
  const [layoutOrderSubmenuOpen, setLayoutOrderSubmenuOpen] = useState(false);

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

    const handleCanvasClick = (event: MouseEvent) => {
      // Close context menu on any canvas click when menu is visible
      if (visible && menuRef.current && !menuRef.current.contains(event.target as Node)) {
        const target = event.target as HTMLElement;
        // Check if click is on canvas area (not on other UI elements)
        if (target.closest('#canvas-container') || target.closest('[data-canvas]')) {
          onClose();
        }
      }
    };

    if (visible) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
      document.addEventListener('click', handleCanvasClick, true); // Use capture to ensure it fires
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('click', handleCanvasClick, true);
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

      {onTextStyling && !isLineNodeType(nodeType) && (
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

      {onVisualStyling && (() => {
        const t = nodeType || '';
        const isEmoji = t.startsWith('generic.emoji.');
        const isShape = isShapeNodeType(t);
        const isText = t.startsWith('generic.text.');
        const isLucide = t.startsWith('generic.icon.');
        const isResourceItem = !isShape && !isText && !isLineNodeType(t);
        return !isEmoji && (isShape || isText || isLucide || isResourceItem);
      })() && (
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

      {onLineStyling && (
        <button
          className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
          onClick={() => {
            onLineStyling();
            onClose();
          }}
        >
          <Minus className="w-4 h-4" />
          Line Styling
        </button>
      )}

      {/* Render Order Submenu */}
      {(canMoveToBack || canMoveToFront || canMoveOneBack || canMoveOneForward) && (
        <div className="relative">
          <button
            className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
            onMouseEnter={() => setRenderOrderSubmenuOpen(true)}
            onMouseLeave={() => setRenderOrderSubmenuOpen(false)}
          >
            <ArrowUp className="w-4 h-4" />
            Render Order
            <ChevronRight className="w-4 h-4 ml-auto" />
          </button>
          
          {renderOrderSubmenuOpen && (
            <div
              className={cn(
                "absolute left-full top-0 bg-popover border border-border rounded-md shadow-lg py-1 z-50 min-w-[150px]",
                "animate-in fade-in-0 zoom-in-95"
              )}
              style={{ marginLeft: '0px' }}
              onMouseEnter={() => setRenderOrderSubmenuOpen(true)}
              onMouseLeave={() => setRenderOrderSubmenuOpen(false)}
            >
              {onMoveToFront && (
                <button
                  className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
                  onClick={() => {
                    onMoveToFront();
                    onClose();
                    setRenderOrderSubmenuOpen(false);
                  }}
                  disabled={!canMoveToFront}
                >
                  <ChevronUp className="w-4 h-4" />
                  Move to Front
                </button>
              )}

              {onMoveOneForward && (
                <button
                  className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
                  onClick={() => {
                    onMoveOneForward();
                    onClose();
                    setRenderOrderSubmenuOpen(false);
                  }}
                  disabled={!canMoveOneForward}
                >
                  <ArrowUp className="w-4 h-4" />
                  Move One Forward
                </button>
              )}

              {onMoveOneBack && (
                <button
                  className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
                  onClick={() => {
                    onMoveOneBack();
                    onClose();
                    setRenderOrderSubmenuOpen(false);
                  }}
                  disabled={!canMoveOneBack}
                >
                  <ArrowDown className="w-4 h-4" />
                  Move One Back
                </button>
              )}

              {onMoveToBack && (
                <button
                  className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
                  onClick={() => {
                    onMoveToBack();
                    onClose();
                    setRenderOrderSubmenuOpen(false);
                  }}
                  disabled={!canMoveToBack}
                >
                  <ChevronDown className="w-4 h-4" />
                  Move to Back
                </button>
              )}
            </div>
          )}
        </div>
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

      {/* Layout & Order Submenu */}
      {itemType === 'zone' && (onLayoutChange || onCycleItems || onSortItems) && (
        <div className="relative">
          <button
            className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
            onMouseEnter={() => setLayoutOrderSubmenuOpen(true)}
            onMouseLeave={() => setLayoutOrderSubmenuOpen(false)}
          >
            <Grid3X3 className="w-4 h-4" />
            Layout & Order
            <ChevronRight className="w-4 h-4 ml-auto" />
          </button>

          {layoutOrderSubmenuOpen && (
            <div
              className={cn(
                "absolute left-full top-0 bg-popover border border-border rounded-md shadow-lg py-1 z-50 min-w-[150px]",
                "animate-in fade-in-0 zoom-in-95"
              )}
              style={{ marginLeft: '4px' }}
              onMouseEnter={() => setLayoutOrderSubmenuOpen(true)}
              onMouseLeave={() => setLayoutOrderSubmenuOpen(false)}
            >
              {onLayoutChange && (
                <>
                  <button
                    className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
                    onClick={() => {
                      onLayoutChange('grid');
                      onClose();
                      setLayoutOrderSubmenuOpen(false);
                    }}
                  >
                    <Grid3X3 className="w-4 h-4" />
                    Grid Layout
                  </button>
                  <button
                    className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
                    onClick={() => {
                      onLayoutChange('circular');
                      onClose();
                      setLayoutOrderSubmenuOpen(false);
                    }}
                  >
                    <Circle className="w-4 h-4" />
                    Circular Layout
                  </button>
                  {(onCycleItems || onSortItems) && <div className="border-t border-border my-1" />}
                </>
              )}

              {onCycleItems && (
                <button
                  className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
                  onClick={() => {
                    onCycleItems();
                    onClose();
                    setLayoutOrderSubmenuOpen(false);
                  }}
                >
                  <RotateCw className="w-4 h-4" />
                  Cycle Items
                </button>
              )}

              {onSortItems && (
                <>
                  <button
                    className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
                    onClick={() => {
                      onSortItems('alpha-asc');
                      onClose();
                      setLayoutOrderSubmenuOpen(false);
                    }}
                  >
                    <ArrowDownAZ className="w-4 h-4" />
                    Sort A-Z
                  </button>
                  <button
                    className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
                    onClick={() => {
                      onSortItems('alpha-desc');
                      onClose();
                      setLayoutOrderSubmenuOpen(false);
                    }}
                  >
                    <ArrowUpAZ className="w-4 h-4" />
                    Sort Z-A
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {(itemType === 'node' || itemType === 'zone') && !isLineNodeType(nodeType) && (
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

      {/* Layer Submenu */}
      {availableLayers.length > 0 && (
        <>
          <div className="border-t border-border my-1" />
          <div className="relative">
            <button
              className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
              onMouseEnter={() => setLayerSubmenuOpen(true)}
              onMouseLeave={() => setLayerSubmenuOpen(false)}
            >
              <Layers className="w-4 h-4" />
              Layer: {currentLayer}
              <ChevronRight className="w-4 h-4 ml-auto" />
            </button>
            
            {/* Layer Submenu */}
            {layerSubmenuOpen && (
              <div
                className={cn(
                  "absolute left-full top-0 bg-popover border border-border rounded-md shadow-lg py-1 z-50 min-w-[150px]",
                  "animate-in fade-in-0 zoom-in-95"
                )}
                style={{ marginLeft: '0px' }}
                onMouseEnter={() => setLayerSubmenuOpen(true)}
                onMouseLeave={() => setLayerSubmenuOpen(false)}
              >
                {availableLayers.map((layer) => (
                  <button
                    key={layer.id}
                    className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
                    onClick={() => {
                      onChangeLayer?.(layer.id);
                      onClose();
                      setLayerSubmenuOpen(false);
                    }}
                  >
                    <Layers className="w-4 h-4" />
                    {layer.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <div className="border-t border-border my-1" />
      
      {canGroup && onGroup && (
        <button
          className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
          onClick={() => {
            onGroup();
            onClose();
          }}
        >
          <Group className="w-4 h-4" />
          Group Items
        </button>
      )}

      {canAddToGroup && onAddToGroup && (
        <button
          className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
          onClick={() => {
            onAddToGroup();
            onClose();
          }}
        >
          <Plus className="w-4 h-4" />
          Add to Group
        </button>
      )}

      {isGrouped && onUngroup && (
        <button
          className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
          onClick={() => {
            onUngroup();
            onClose();
          }}
        >
          <Ungroup className="w-4 h-4" />
          Ungroup
        </button>
      )}

      {isGrouped && onRemoveFromGroup && (
        <button
          className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
          onClick={() => {
            if (itemId && onRemoveFromGroup) {
              onRemoveFromGroup(itemId);
            }
            onClose();
          }}
        >
          <Link2Off className="w-4 h-4" />
          Remove from Group
        </button>
      )}



      {(canGroup || isGrouped) && <div className="border-t border-border my-1" />}
      
      {onToggleLock && (
        <button
          className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
          onClick={() => {
            onToggleLock();
            onClose();
          }}
        >
          {isLocked ? (
            <>
              <Unlock className="w-4 h-4" />
              Unlock
            </>
          ) : (
            <>
              <Lock className="w-4 h-4" />
              Lock
            </>
          )}
        </button>
      )}

      {onToggleLock && <div className="border-t border-border my-1" />}
      
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