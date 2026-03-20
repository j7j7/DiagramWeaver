"use client";
import { useState, useCallback, useEffect, useRef } from 'react';
import type { DiagramData } from '@/lib/types';
import type { SelectedItem } from '@/components/diagram-editor';
import { ensureConnectionIds } from '@/lib/connection-order-utils';
import {
  loadTabsFromIndexedDB,
  saveTabsToIndexedDB,
  saveTabsToLocalStorage,
  loadTabsFromLocalStorage,
  clearTabsFromLocalStorage,
} from '@/lib/tab-storage';

export interface TabState {
  id: string;
  name: string;
  diagramData: DiagramData;
  history: string[];
  historyIndex: number;
  selectedItem: SelectedItem | null;
  selectedItemIds: Set<string>;
  isConnectMode: boolean;
  jsonPanelOpen: boolean;
  canvasTransform: { x: number; y: number; k: number };
  savedDataHash?: string; // Track if tab has unsaved changes
  /** Embedded presentation slides/decks differ from last file save (e.g. edits in presentation mode). */
  hasUnsavedPresentations?: boolean;
}

interface UseDiagramTabsOptions {
  isClient: boolean;
  onToast: (message: { title: string; description: string }) => void;
}

function parseStoredTabs(
  parsedTabs: (TabState & { historyRef?: { history: string[]; index: number } })[],
  historyRefs: React.MutableRefObject<Record<string, { history: string[]; index: number }>>
): TabState[] {
  parsedTabs.forEach((tab) => {
    if (tab.historyRef?.history?.length) {
      historyRefs.current[tab.id] = tab.historyRef;
    } else if (tab.diagramData) {
      historyRefs.current[tab.id] = {
        history: [JSON.stringify(tab.diagramData)],
        index: 0,
      };
    }
  });
  return parsedTabs.map((tab: TabState & { historyRef?: unknown }) => {
    const { historyRef: _, ...rest } = tab;
    const diagramData = rest.diagramData
      ? { ...rest.diagramData, connections: ensureConnectionIds(rest.diagramData.connections || []) }
      : rest.diagramData;
    return {
      ...rest,
      diagramData,
      selectedItemIds: new Set(rest.selectedItemIds || []),
      savedDataHash: JSON.stringify(rest.diagramData),
      hasUnsavedPresentations: rest.hasUnsavedPresentations === true,
    };
  });
}

export function useDiagramTabs({ isClient, onToast }: UseDiagramTabsOptions) {
  const [tabs, setTabs] = useState<TabState[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const historyRefs = useRef<Record<string, { history: string[]; index: number }>>({});
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize tabs from IndexedDB (with localStorage migration)
  useEffect(() => {
    if (!isClient) return;

    // No IndexedDB (e.g. old browser, worker): use localStorage fallback
    if (typeof indexedDB === 'undefined') {
      try {
        const lsPayload = loadTabsFromLocalStorage();
        if (lsPayload && lsPayload.tabs.length > 0) {
          const cleanedTabs = parseStoredTabs(
            lsPayload.tabs as (TabState & { historyRef?: { history: string[]; index: number } })[],
            historyRefs
          );
          setTabs(cleanedTabs);
          const active =
            lsPayload.activeTabId && cleanedTabs.some((t) => t.id === lsPayload.activeTabId)
              ? lsPayload.activeTabId
              : cleanedTabs[0].id;
          setActiveTabId(active);
        } else {
          const defaultTab = createNewTab('Diagram 1');
          setTabs([defaultTab]);
          setActiveTabId(defaultTab.id);
        }
      } catch {
        const defaultTab = createNewTab('Diagram 1');
        setTabs([defaultTab]);
        setActiveTabId(defaultTab.id);
      }
      setIsLoaded(true);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        // 1. Try IndexedDB first
        const idbPayload = await loadTabsFromIndexedDB();
        if (cancelled) return;

        if (idbPayload && idbPayload.tabs.length > 0) {
          const cleanedTabs = parseStoredTabs(
            idbPayload.tabs as (TabState & { historyRef?: { history: string[]; index: number } })[],
            historyRefs
          );
          setTabs(cleanedTabs);
          const active =
            idbPayload.activeTabId && cleanedTabs.some((t) => t.id === idbPayload.activeTabId)
              ? idbPayload.activeTabId
              : cleanedTabs[0].id;
          setActiveTabId(active);
          setIsLoaded(true);
          return;
        }

        // 2. Migrate from localStorage if IndexedDB empty
        const lsPayload = loadTabsFromLocalStorage();
        if (cancelled) return;

        if (lsPayload && lsPayload.tabs.length > 0) {
          const cleanedTabs = parseStoredTabs(
            lsPayload.tabs as (TabState & { historyRef?: { history: string[]; index: number } })[],
            historyRefs
          );
          setTabs(cleanedTabs);
          const active =
            lsPayload.activeTabId && cleanedTabs.some((t) => t.id === lsPayload.activeTabId)
              ? lsPayload.activeTabId
              : cleanedTabs[0].id;
          setActiveTabId(active);
          clearTabsFromLocalStorage();
          // Persist to IndexedDB on next effect
          setIsLoaded(true);
          return;
        }

        // 3. Default tab
        const defaultTab = createNewTab('Diagram 1');
        setTabs([defaultTab]);
        setActiveTabId(defaultTab.id);
      } catch (error) {
        console.warn('Failed to load tabs:', error);
        const defaultTab = createNewTab('Diagram 1');
        setTabs([defaultTab]);
        setActiveTabId(defaultTab.id);
      } finally {
        if (!cancelled) setIsLoaded(true);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [isClient]);

  // Persist tabs (IndexedDB when available, else localStorage)
  useEffect(() => {
    if (!isClient || !isLoaded || tabs.length === 0) return;

    const buildPayload = (includeHistory: boolean) => {
      const tabsToStore = tabs.map((tab) => {
        const base = {
          ...tab,
          selectedItemIds: Array.from(tab.selectedItemIds),
        };
        return includeHistory
          ? { ...base, historyRef: historyRefs.current[tab.id] }
          : base;
      });
      return { tabs: tabsToStore, activeTabId };
    };

    const PERSIST_DEBOUNCE_MS = 400;

    if (persistTimeoutRef.current) {
      clearTimeout(persistTimeoutRef.current);
    }

    persistTimeoutRef.current = setTimeout(async () => {
      persistTimeoutRef.current = null;

      if (typeof indexedDB === 'undefined') {
        try {
          saveTabsToLocalStorage(buildPayload(true));
        } catch (error) {
          const isQuotaExceeded =
            error instanceof DOMException && error.name === 'QuotaExceededError';
          if (isQuotaExceeded) {
            try {
              saveTabsToLocalStorage(buildPayload(false));
            } catch {
              onToast({
                title: 'Storage full',
                description:
                  'Could not save tabs. Try closing some tabs, exporting diagrams, or clearing site data.',
              });
            }
          }
        }
        return;
      }

      try {
        await saveTabsToIndexedDB(buildPayload(true));
      } catch (error) {
        const isQuotaExceeded =
          error instanceof DOMException && error.name === 'QuotaExceededError';
        if (isQuotaExceeded) {
          try {
            await saveTabsToIndexedDB(buildPayload(false));
          } catch {
            onToast({
              title: 'Storage full',
              description:
                'Could not save tabs. Try closing some tabs, exporting diagrams, or clearing site data.',
            });
          }
        } else {
          console.warn('Failed to save tabs to IndexedDB:', error);
        }
      }
    }, PERSIST_DEBOUNCE_MS);

    return () => {
      if (persistTimeoutRef.current) {
        clearTimeout(persistTimeoutRef.current);
        persistTimeoutRef.current = null;
      }
    };
  }, [tabs, activeTabId, isClient, isLoaded, onToast]);

  function createNewTab(name: string, diagramData?: DiagramData): TabState {
    const rawDiagram = diagramData || { nodes: [], connections: [], groupings: [] };
    const initialDiagram = { ...rawDiagram, connections: ensureConnectionIds(rawDiagram.connections || []) };
    const initialHistory = [JSON.stringify(initialDiagram)];
    const tabId = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    historyRefs.current[tabId] = { history: initialHistory, index: 0 };

    return {
      id: tabId,
      name,
      diagramData: initialDiagram,
      history: initialHistory,
      historyIndex: 0,
      selectedItem: null,
      selectedItemIds: new Set(),
      isConnectMode: false,
      jsonPanelOpen: false,
      canvasTransform: { x: 0, y: 0, k: 1 },
      savedDataHash: JSON.stringify(initialDiagram),
      hasUnsavedPresentations: false,
    };
  }

  const createTab = useCallback((options?: { name?: string; diagramData?: DiagramData }) => {
    const tabNumber = tabs.length + 1;
    const tabName = options?.name || `Diagram ${tabNumber}`;
    const newTab = createNewTab(tabName, options?.diagramData);
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
    onToast({ title: 'New Tab', description: `${newTab.name} created.` });
  }, [tabs.length, onToast]);

  const switchTab = useCallback((tabId: string) => {
    if (tabs.some(t => t.id === tabId)) {
      setActiveTabId(tabId);
    }
  }, [tabs]);

  const closeTab = useCallback(async (tabId: string, force: boolean = false): Promise<void> => {
    delete historyRefs.current[tabId];
    
    setTabs(prev => {
      const remainingTabs = prev.filter(t => t.id !== tabId);
      
      // If closing the last tab, prevent closing (keep at least one tab)
      if (remainingTabs.length === 0) {
        return prev;
      }
      
      // Switch to another tab if this was active
      if (activeTabId === tabId && remainingTabs.length > 0) {
        setActiveTabId(remainingTabs[remainingTabs.length - 1].id);
      }
      
      return remainingTabs;
    });
  }, [activeTabId]);

  const updateActiveTab = useCallback((updates: Partial<TabState>) => {
    if (!activeTabId) return;
    
    setTabs(prev => prev.map(tab => {
      if (tab.id === activeTabId) {
        const updated = { ...tab, ...updates };
        return updated;
      }
      return tab;
    }));

    // Update history ref if needed
    if (updates.history || updates.historyIndex !== undefined) {
      const tab = tabs.find(t => t.id === activeTabId);
      if (tab) {
        historyRefs.current[activeTabId] = {
          history: updates.history || tab.history,
          index: updates.historyIndex !== undefined ? updates.historyIndex : tab.historyIndex,
        };
      }
    }
  }, [activeTabId, tabs]);

  const getActiveTab = useCallback((): TabState | null => {
    return tabs.find(t => t.id === activeTabId) || null;
  }, [tabs, activeTabId]);

  const getTab = useCallback((tabId: string): TabState | null => {
    return tabs.find(t => t.id === tabId) || null;
  }, [tabs]);

  const updateTab = useCallback((tabId: string, updates: Partial<TabState>) => {
    setTabs(prev => prev.map(tab => {
      if (tab.id === tabId) {
        const updated = { ...tab, ...updates };
        return updated;
      }
      return tab;
    }));
  }, []);

  const reorderTabs = useCallback((orderedTabIds: string[]) => {
    setTabs(prev => {
      const byId = new Map(prev.map(t => [t.id, t]));
      const reordered: TabState[] = [];
      for (const id of orderedTabIds) {
        const tab = byId.get(id);
        if (tab) reordered.push(tab);
      }
      const idsInOrder = new Set(orderedTabIds);
      const appended = prev.filter(t => !idsInOrder.has(t.id));
      return reordered.length > 0 ? [...reordered, ...appended] : prev;
    });
  }, []);

  const markTabAsSaved = useCallback((tabId?: string) => {
    const targetId = tabId ?? activeTabId;
    if (!targetId) return;
    
    setTabs(prev => prev.map(tab => {
      if (tab.id === targetId) {
        return {
          ...tab,
          savedDataHash: JSON.stringify(tab.diagramData),
          hasUnsavedPresentations: false,
        };
      }
      return tab;
    }));
  }, [activeTabId]);

  return {
    tabs: tabs.map((t) => ({
      id: t.id,
      name: t.name,
      isModified:
        t.savedDataHash !== JSON.stringify(t.diagramData) || t.hasUnsavedPresentations === true,
    })),
    activeTabId,
    isLoaded,
    activeTab: getActiveTab(),
    createTab,
    switchTab,
    closeTab,
    updateActiveTab,
    updateTab,
    getTab,
    reorderTabs,
    markTabAsSaved,
    getHistoryRef: (tabId: string) => historyRefs.current[tabId],
    setHistoryRef: (tabId: string, ref: { history: string[]; index: number }) => {
      historyRefs.current[tabId] = ref;
    },
  };
}

