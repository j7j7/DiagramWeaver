"use client";
import React, { useState, useCallback } from 'react';
import { X, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TabData {
  id: string;
  name: string;
  isModified: boolean;
  /** Reserved tab for the interactive tutorial (`name` is `tutorial`). */
  isTutorialTab?: boolean;
}

interface TabBarProps {
  tabs: TabData[];
  activeTabId: string;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onTabReorder?: (orderedTabIds: string[]) => void;
}

export function TabBar({ tabs, activeTabId, onTabSelect, onTabClose, onTabReorder }: TabBarProps) {
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const handleClose = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    onTabClose(tabId);
  };

  const handleDragStart = useCallback(
    (e: React.DragEvent, tabId: string) => {
      setDraggedTabId(tabId);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', tabId);
      e.dataTransfer.setData('application/x-diagramweaver-tab', tabId);
    },
    []
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, tabId: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (draggedTabId && draggedTabId !== tabId) {
        setDropTargetId(tabId);
      }
    },
    [draggedTabId]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, targetTabId: string) => {
      e.preventDefault();
      setDraggedTabId(null);
      setDropTargetId(null);
      if (!onTabReorder || !draggedTabId || draggedTabId === targetTabId) return;

      const ids = tabs.map((t) => t.id);
      const fromIdx = ids.indexOf(draggedTabId);
      const toIdx = ids.indexOf(targetTabId);
      if (fromIdx === -1 || toIdx === -1) return;

      const reordered = [...ids];
      reordered.splice(fromIdx, 1);
      reordered.splice(toIdx, 0, draggedTabId);
      onTabReorder(reordered);
    },
    [draggedTabId, onTabReorder, tabs]
  );

  const handleDragEnd = useCallback(() => {
    setDraggedTabId(null);
    setDropTargetId(null);
  }, []);

  const canReorder = Boolean(onTabReorder && tabs.length > 1);

  return (
    <div className="flex items-center gap-1 border-b bg-card px-2 overflow-x-auto">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          draggable={canReorder}
          onDragStart={(e) => canReorder && handleDragStart(e, tab.id)}
          onDragOver={(e) => canReorder && handleDragOver(e, tab.id)}
          onDrop={(e) => canReorder && handleDrop(e, tab.id)}
          onDragEnd={handleDragEnd}
          onClick={() => onTabSelect(tab.id)}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-t-md cursor-pointer transition-colors relative group",
            "border border-b-0 border-t-0 border-l-0 border-r",
            activeTabId === tab.id
              ? "bg-background text-foreground border-border"
              : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted",
            draggedTabId === tab.id && "opacity-50",
            dropTargetId === tab.id && "ring-1 ring-primary/50"
          )}
        >
          {canReorder && (
            <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60 cursor-grab active:cursor-grabbing" />
          )}
          <span className={cn("text-sm whitespace-nowrap", tab.isModified && "font-semibold")}>
            {tab.isModified && <span className="mr-1 text-xs">●</span>}
            {tab.name}
          </span>
          <button
            onClick={(e) => handleClose(e, tab.id)}
            className={cn(
              "opacity-0 group-hover:opacity-100 transition-opacity rounded p-0.5 hover:bg-muted",
              "flex items-center justify-center"
            )}
            aria-label={`Close ${tab.name}`}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

