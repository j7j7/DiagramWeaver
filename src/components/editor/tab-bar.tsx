"use client";
import React, { useState, useCallback, useLayoutEffect, useRef } from 'react';
import { X, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TUTORIAL_TAB_NAME } from '@/hooks/use-diagram-tabs';

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
  /** Double-click tab label to rename; saved diagram uses this tab name as the suggested filename stem. */
  onTabRename?: (tabId: string, name: string) => void;
}

export function TabBar({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onTabReorder,
  onTabRename,
}: TabBarProps) {
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const skipRenameBlurCommitRef = useRef(false);
  /** Enter commits then blurs — ignore the duplicate blur commit. */
  const ignoreNextRenameBlurRef = useRef(false);

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
  const commitRename = useCallback(
    (tabId: string, originalName: string, draft: string) => {
      if (!onTabRename) return;
      const trimmed = draft.trim();
      const next = trimmed || originalName;
      if (next !== originalName) onTabRename(tabId, next);
      setEditingTabId(null);
      setEditDraft('');
    },
    [onTabRename],
  );

  const cancelRename = useCallback(() => {
    setEditingTabId(null);
    setEditDraft('');
  }, []);

  useLayoutEffect(() => {
    if (!editingTabId) return;
    const el = renameInputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [editingTabId]);

  return (
    <div className="flex items-center gap-1 border-b bg-card px-2 overflow-x-auto">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          draggable={canReorder && editingTabId === null}
          onDragStart={(e) => canReorder && editingTabId === null && handleDragStart(e, tab.id)}
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
          {editingTabId === tab.id && onTabRename ? (
            <input
              ref={renameInputRef}
              type="text"
              spellCheck
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              className={cn(
                'text-sm min-w-[6rem] max-w-[14rem] rounded border border-primary bg-background px-1 py-0',
                tab.isModified && 'font-semibold',
              )}
              aria-label={`Rename ${tab.name}`}
              onClick={(e) => e.stopPropagation()}
              onBlur={() => {
                if (skipRenameBlurCommitRef.current) {
                  skipRenameBlurCommitRef.current = false;
                  return;
                }
                if (ignoreNextRenameBlurRef.current) {
                  ignoreNextRenameBlurRef.current = false;
                  return;
                }
                commitRename(tab.id, tab.name, renameInputRef.current?.value ?? editDraft);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  ignoreNextRenameBlurRef.current = true;
                  commitRename(tab.id, tab.name, renameInputRef.current?.value ?? editDraft);
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  skipRenameBlurCommitRef.current = true;
                  cancelRename();
                }
              }}
            />
          ) : (
            <span
              className={cn(
                'text-sm whitespace-nowrap',
                tab.isModified && 'font-semibold',
                onTabRename && !tab.isTutorialTab && tab.name !== TUTORIAL_TAB_NAME && 'cursor-text',
              )}
              onDoubleClick={(e) => {
                if (!onTabRename || tab.isTutorialTab || tab.name === TUTORIAL_TAB_NAME) return;
                e.preventDefault();
                e.stopPropagation();
                setEditingTabId(tab.id);
                setEditDraft(tab.name);
              }}
            >
              {tab.isModified && <span className="mr-1 text-xs">●</span>}
              {tab.name}
            </span>
          )}
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

