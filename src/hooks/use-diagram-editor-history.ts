"use client";

import { useCallback, useEffect, useRef } from "react";
import type { DiagramData } from "@/lib/types";
import type { TabState } from "@/hooks/use-diagram-tabs";
import type { SelectedItem } from "@/components/editor/diagram-editor-types";

export interface UseDiagramEditorHistoryParams {
  activeTabId: string | null;
  activeTab: TabState | undefined | null;
  diagramData: DiagramData;
  isDragging: boolean;
  getHistoryRef: (tabId: string) => { history: string[]; index: number } | undefined;
  setHistoryRef: (tabId: string, ref: { history: string[]; index: number }) => void;
  updateActiveTab: (updates: Partial<TabState>) => void;
  setDiagramData: (updater: DiagramData | ((prev: DiagramData) => DiagramData)) => void;
  setSelectedItem: (
    updater: SelectedItem | null | ((prev: SelectedItem | null) => SelectedItem | null),
  ) => void;
  /** Fired before undo/redo applies a history snapshot (e.g. interaction recorder). */
  onHistoryNavigate?: (diagram: DiagramData) => void;
}

/**
 * Undo/redo stack for the active tab: debounced snapshots on diagram edits, ref sync with `useDiagramTabs` history refs.
 */
export function useDiagramEditorHistory({
  activeTabId,
  activeTab,
  diagramData,
  isDragging,
  getHistoryRef,
  setHistoryRef,
  updateActiveTab,
  setDiagramData,
  setSelectedItem,
  onHistoryNavigate,
}: UseDiagramEditorHistoryParams) {
  const history =
    activeTab?.history || [JSON.stringify({ nodes: [], connections: [], groupings: [] })];
  const historyIndex = activeTab?.historyIndex || 0;

  const historyRef = useRef(getHistoryRef(activeTabId || "") || { history: [] as string[], index: 0 });

  const setHistoryIndex = useCallback(
    (index: number) => {
      if (!activeTabId) return;
      updateActiveTab({ historyIndex: index });
      const currentHistory = historyRef.current.history;
      setHistoryRef(activeTabId, { history: currentHistory, index });
    },
    [activeTabId, updateActiveTab, setHistoryRef],
  );

  useEffect(() => {
    if (activeTabId && activeTab) {
      historyRef.current = getHistoryRef(activeTabId) || { history: activeTab.history, index: activeTab.historyIndex };
    }
  }, [activeTabId, activeTab, getHistoryRef]);

  const historyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateHistory = useCallback(() => {
    if (!activeTabId || !activeTab) return;

    if (isDragging) {
      return;
    }

    const jsonString = JSON.stringify(diagramData);

    if (historyRef.current.history.length > 1 && historyRef.current.history[historyRef.current.index] === jsonString) {
      return;
    }

    const currentHistory = historyRef.current.history.slice(0, historyRef.current.index + 1);
    currentHistory.push(jsonString);

    if (currentHistory.length > 20) {
      currentHistory.shift();
    }

    const newIndex = currentHistory.length - 1;

    historyRef.current = { history: currentHistory, index: newIndex };

    updateActiveTab({ history: currentHistory, historyIndex: newIndex });
    setHistoryRef(activeTabId, historyRef.current);
  }, [diagramData, isDragging, activeTabId, activeTab, updateActiveTab, setHistoryRef]);

  useEffect(() => {
    if (historyTimeoutRef.current) {
      clearTimeout(historyTimeoutRef.current);
    }

    if (isDragging) {
      return;
    }

    historyTimeoutRef.current = setTimeout(() => {
      updateHistory();
    }, 300);

    return () => {
      if (historyTimeoutRef.current) {
        clearTimeout(historyTimeoutRef.current);
      }
    };
  }, [diagramData, updateHistory, isDragging]);

  const undo = useCallback(() => {
    if (!activeTabId) return;
    const { history: currentHistory, index: currentIndex } = historyRef.current;

    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      historyRef.current.index = newIndex;
      setHistoryIndex(newIndex);
      const newDiagramData = JSON.parse(currentHistory[newIndex]) as DiagramData;
      onHistoryNavigate?.(newDiagramData);
      setDiagramData(newDiagramData);
      setSelectedItem(null);
      setHistoryRef(activeTabId, historyRef.current);
    }
  }, [activeTabId, setHistoryIndex, setDiagramData, setSelectedItem, setHistoryRef, onHistoryNavigate]);

  const redo = useCallback(() => {
    if (!activeTabId) return;
    const { history: currentHistory, index: currentIndex } = historyRef.current;

    if (currentIndex < currentHistory.length - 1) {
      const newIndex = currentIndex + 1;
      historyRef.current.index = newIndex;
      setHistoryIndex(newIndex);
      const newDiagramData = JSON.parse(currentHistory[newIndex]) as DiagramData;
      onHistoryNavigate?.(newDiagramData);
      setDiagramData(newDiagramData);
      setSelectedItem(null);
      setHistoryRef(activeTabId, historyRef.current);
    }
  }, [activeTabId, setHistoryIndex, setDiagramData, setSelectedItem, setHistoryRef, onHistoryNavigate]);

  return {
    history,
    historyIndex,
    updateHistory,
    undo,
    redo,
  };
}
