"use client";

import { useCallback, useEffect, useRef } from "react";
import type { DiagramData } from "@/lib/types";
import type { TabState } from "@/hooks/use-diagram-tabs";
import type { SelectedItem } from "@/components/editor/diagram-editor-types";
import {
  parseEditorHistorySnapshot,
  serializeEditorHistorySnapshot,
  shouldUpgradeLegacyHistoryEntry,
  type EditorHistoryPresentationSlice,
  type ParsedEditorHistorySnapshot,
} from "@/lib/editor-history-snapshot";

export interface EditorHistoryCommitInput {
  diagram: DiagramData;
  presentation?: EditorHistoryPresentationSlice | null;
}

export interface UseDiagramEditorHistoryParams {
  activeTabId: string | null;
  activeTab: TabState | undefined | null;
  diagramData: DiagramData;
  /** Active-tab presentation slice; omit/empty until hydrated so load does not invent undo steps. */
  presentation: EditorHistoryPresentationSlice | null;
  /** When false, only keep the current history slot warm — do not push presentation-driven entries. */
  presentationReady: boolean;
  isDragging: boolean;
  getHistoryRef: (tabId: string) => { history: string[]; index: number } | undefined;
  setHistoryRef: (tabId: string, ref: { history: string[]; index: number }) => void;
  updateActiveTab: (updates: Partial<TabState>) => void;
  setSelectedItem: (
    updater: SelectedItem | null | ((prev: SelectedItem | null) => SelectedItem | null),
  ) => void;
  /** Apply a full undo/redo snapshot (diagram + optional presentation). */
  onApplyHistorySnapshot: (snapshot: ParsedEditorHistorySnapshot) => void;
  /** Fired when a new history entry is pushed (not tip-sync / legacy upgrade). */
  onHistoryEntryCommitted?: () => void;
}

/**
 * Undo/redo stack for the active tab: debounced snapshots on diagram + presentation edits,
 * ref sync with `useDiagramTabs` history refs.
 */
export function useDiagramEditorHistory({
  activeTabId,
  activeTab,
  diagramData,
  presentation,
  presentationReady,
  isDragging,
  getHistoryRef,
  setHistoryRef,
  updateActiveTab,
  setSelectedItem,
  onApplyHistorySnapshot,
  onHistoryEntryCommitted,
}: UseDiagramEditorHistoryParams) {
  const history =
    activeTab?.history || [JSON.stringify({ nodes: [], connections: [], groupings: [] })];
  const historyIndex = activeTab?.historyIndex || 0;

  const historyRef = useRef(getHistoryRef(activeTabId || "") || { history: [] as string[], index: 0 });
  const presentationRef = useRef(presentation);
  presentationRef.current = presentation;
  const presentationReadyRef = useRef(presentationReady);
  presentationReadyRef.current = presentationReady;
  const diagramDataRef = useRef(diagramData);
  diagramDataRef.current = diagramData;
  const isDraggingRef = useRef(isDragging);
  isDraggingRef.current = isDragging;
  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const onHistoryEntryCommittedRef = useRef(onHistoryEntryCommitted);
  onHistoryEntryCommittedRef.current = onHistoryEntryCommitted;
  /** Skip debounced capture while undo/redo is applying a snapshot. */
  const applyingHistoryRef = useRef(false);
  const applyingHistoryClearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** After undo/redo, only sync the tip in place (preserve redo) until this timestamp. */
  const suppressHistoryPushUntilRef = useRef(0);
  const historyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const syncCurrentHistorySlot = useCallback(() => {
    const tabId = activeTabIdRef.current;
    if (!tabId || !activeTabRef.current) return;
    const jsonString = serializeEditorHistorySnapshot({
      diagram: diagramDataRef.current,
      presentation: presentationReadyRef.current ? presentationRef.current : null,
    });
    const { history: stack, index } = historyRef.current;
    if (!stack.length || stack[index] === jsonString) return;
    const next = stack.slice();
    next[index] = jsonString;
    // Replace tip only — do not truncate redo entries after undo.
    historyRef.current = { history: next, index };
    setHistoryRef(tabId, historyRef.current);
    updateActiveTab({ history: next, historyIndex: index });
  }, [setHistoryRef, updateActiveTab]);

  const beginApplyingHistory = useCallback(() => {
    applyingHistoryRef.current = true;
    suppressHistoryPushUntilRef.current = Date.now() + 2000;
    if (historyTimeoutRef.current) {
      clearTimeout(historyTimeoutRef.current);
      historyTimeoutRef.current = null;
    }
    if (applyingHistoryClearTimeoutRef.current) {
      clearTimeout(applyingHistoryClearTimeoutRef.current);
    }
    applyingHistoryClearTimeoutRef.current = setTimeout(() => {
      applyingHistoryClearTimeoutRef.current = null;
      syncCurrentHistorySlot();
      applyingHistoryRef.current = false;
    }, 500);
  }, [syncCurrentHistorySlot]);

  const persistHistoryState = useCallback(
    (next: { history: string[]; index: number }) => {
      const tabId = activeTabIdRef.current;
      if (!tabId) return;
      historyRef.current = next;
      setHistoryRef(tabId, next);
      updateActiveTab({ history: next.history, historyIndex: next.index });
    },
    [setHistoryRef, updateActiveTab],
  );

  // Only resync the mutable history ref when the active tab changes — never on every
  // activeTab field update (that raced with flush/undo and could restore a stale stack).
  useEffect(() => {
    if (!activeTabId) return;
    historyRef.current = getHistoryRef(activeTabId) || {
      history: activeTab?.history ?? [JSON.stringify({ nodes: [], connections: [], groupings: [] })],
      index: activeTab?.historyIndex ?? 0,
    };
  }, [activeTabId, getHistoryRef]); // eslint-disable-line react-hooks/exhaustive-deps -- intentional: tab switch only

  const buildSnapshotString = useCallback((override?: EditorHistoryCommitInput) => {
    const diagram = override?.diagram ?? diagramDataRef.current;
    const hasExplicitPresentation =
      !!override && Object.prototype.hasOwnProperty.call(override, "presentation");
    const presentationSlice = hasExplicitPresentation
      ? (override.presentation ?? null)
      : presentationReadyRef.current
        ? presentationRef.current
        : null;
    return serializeEditorHistorySnapshot({
      diagram,
      presentation: presentationSlice,
    });
  }, []);

  const commitSnapshotString = useCallback(
    (jsonString: string) => {
      const tabId = activeTabIdRef.current;
      if (!tabId || !activeTabRef.current) return false;

      const { history: stack, index } = historyRef.current;

      if (stack.length > 0 && stack[index] === jsonString) {
        return false;
      }

      if (
        stack.length > 0 &&
        shouldUpgradeLegacyHistoryEntry(stack[index] ?? "", jsonString)
      ) {
        const upgraded = stack.slice();
        upgraded[index] = jsonString;
        persistHistoryState({ history: upgraded, index });
        return false;
      }

      const currentHistory = stack.slice(0, index + 1);
      currentHistory.push(jsonString);

      if (currentHistory.length > 20) {
        currentHistory.shift();
      }

      persistHistoryState({
        history: currentHistory,
        index: currentHistory.length - 1,
      });
      onHistoryEntryCommittedRef.current?.();
      return true;
    },
    [persistHistoryState],
  );

  const updateHistory = useCallback(() => {
    if (applyingHistoryRef.current) return;
    if (isDraggingRef.current) return;
    if (Date.now() < suppressHistoryPushUntilRef.current) {
      syncCurrentHistorySlot();
      return;
    }
    commitSnapshotString(buildSnapshotString());
  }, [buildSnapshotString, commitSnapshotString, syncCurrentHistorySlot]);

  const presentationHistoryKey = presentationReady
    ? serializeEditorHistorySnapshot({
        diagram: { nodes: [], connections: [], groupings: [] },
        presentation,
      })
    : "";

  useEffect(() => {
    if (historyTimeoutRef.current) {
      clearTimeout(historyTimeoutRef.current);
    }

    if (isDragging || applyingHistoryRef.current) {
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
  }, [diagramData, presentationHistoryKey, updateHistory, isDragging]);

  const undo = useCallback((): boolean => {
    if (!activeTabId) return false;
    const { history: currentHistory, index: currentIndex } = historyRef.current;

    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      beginApplyingHistory();
      persistHistoryState({ history: currentHistory, index: newIndex });
      const snapshot = parseEditorHistorySnapshot(currentHistory[newIndex]);
      onApplyHistorySnapshot(snapshot);
      setSelectedItem(null);
      return true;
    }
    return false;
  }, [activeTabId, beginApplyingHistory, persistHistoryState, setSelectedItem, onApplyHistorySnapshot]);

  const redo = useCallback((): boolean => {
    if (!activeTabId) return false;
    const { history: currentHistory, index: currentIndex } = historyRef.current;

    if (currentIndex < currentHistory.length - 1) {
      const newIndex = currentIndex + 1;
      beginApplyingHistory();
      persistHistoryState({ history: currentHistory, index: newIndex });
      const snapshot = parseEditorHistorySnapshot(currentHistory[newIndex]);
      onApplyHistorySnapshot(snapshot);
      setSelectedItem(null);
      return true;
    }
    return false;
  }, [activeTabId, beginApplyingHistory, persistHistoryState, setSelectedItem, onApplyHistorySnapshot]);

  /** Jump to a specific history slot (keeps newer entries for redo). */
  const jumpToHistoryIndex = useCallback(
    (targetIndex: number): boolean => {
      if (!activeTabId) return false;
      const { history: currentHistory, index: currentIndex } = historyRef.current;
      if (targetIndex < 0 || targetIndex >= currentHistory.length) return false;
      if (targetIndex === currentIndex) return true;
      beginApplyingHistory();
      persistHistoryState({ history: currentHistory, index: targetIndex });
      const snapshot = parseEditorHistorySnapshot(currentHistory[targetIndex]);
      onApplyHistorySnapshot(snapshot);
      setSelectedItem(null);
      return true;
    },
    [activeTabId, beginApplyingHistory, persistHistoryState, setSelectedItem, onApplyHistorySnapshot],
  );

  /** Tip-sync only for a while (e.g. after structural slide ops that have their own undo stack). */
  const suppressHistoryPushes = useCallback((durationMs = 1000) => {
    suppressHistoryPushUntilRef.current = Date.now() + durationMs;
    if (historyTimeoutRef.current) {
      clearTimeout(historyTimeoutRef.current);
      historyTimeoutRef.current = null;
    }
  }, []);

  /** Commit the current (or explicit) diagram/presentation into history immediately. */
  const flushHistory = useCallback(
    (override?: EditorHistoryCommitInput) => {
      if (historyTimeoutRef.current) {
        clearTimeout(historyTimeoutRef.current);
        historyTimeoutRef.current = null;
      }
      if (isDraggingRef.current && !override) return;
      // Structural slide ops pass an explicit override and must always push.
      if (override) {
        suppressHistoryPushUntilRef.current = 0;
        commitSnapshotString(buildSnapshotString(override));
        return;
      }
      if (Date.now() < suppressHistoryPushUntilRef.current) {
        syncCurrentHistorySlot();
        return;
      }
      commitSnapshotString(buildSnapshotString());
    },
    [buildSnapshotString, commitSnapshotString, syncCurrentHistorySlot],
  );

  return {
    history,
    historyIndex,
    updateHistory,
    flushHistory,
    suppressHistoryPushes,
    jumpToHistoryIndex,
    undo,
    redo,
  };
}
