"use client";
import { useState, useCallback, useEffect, useRef } from 'react';
import type { DiagramData } from '@/lib/types';
import type { SelectedItem } from '@/components/diagram-editor';

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
}

interface UseDiagramTabsOptions {
  isClient: boolean;
  onToast: (message: { title: string; description: string }) => void;
}

export function useDiagramTabs({ isClient, onToast }: UseDiagramTabsOptions) {
  const [tabs, setTabs] = useState<TabState[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const historyRefs = useRef<Record<string, { history: string[]; index: number }>>({});

  // Initialize tabs from localStorage
  useEffect(() => {
    if (!isClient) return;

    try {
      const savedTabs = localStorage.getItem('dw:tabs');
      const savedActiveTabId = localStorage.getItem('dw:activeTabId');

      if (savedTabs) {
        const parsedTabs = JSON.parse(savedTabs);
        // Restore history refs
        parsedTabs.forEach((tab: TabState & { historyRef?: { history: string[]; index: number } }) => {
          if (tab.historyRef) {
            historyRefs.current[tab.id] = tab.historyRef;
          }
        });
        // Remove historyRef from tabs (we store it separately)
        const cleanedTabs = parsedTabs.map((tab: TabState & { historyRef?: any }) => {
          const { historyRef, ...rest } = tab;
          // Convert selectedItemIds back to Set
          return {
            ...rest,
            selectedItemIds: new Set(rest.selectedItemIds || []),
            savedDataHash: JSON.stringify(rest.diagramData),
          };
        });
        setTabs(cleanedTabs);
        if (savedActiveTabId && cleanedTabs.some((t: TabState) => t.id === savedActiveTabId)) {
          setActiveTabId(savedActiveTabId);
        } else if (cleanedTabs.length > 0) {
          setActiveTabId(cleanedTabs[0].id);
        }
      } else {
        // Create default tab
        const defaultTab = createNewTab('Diagram 1');
        setTabs([defaultTab]);
        setActiveTabId(defaultTab.id);
      }
    } catch (error) {
      console.warn('Failed to load tabs from localStorage:', error);
      // Create default tab on error
      const defaultTab = createNewTab('Diagram 1');
      setTabs([defaultTab]);
      setActiveTabId(defaultTab.id);
    }
  }, [isClient]);

  // Persist tabs to localStorage
  useEffect(() => {
    if (!isClient || tabs.length === 0) return;

    try {
      // Store tabs with historyRefs
      const tabsToStore = tabs.map(tab => ({
        ...tab,
        selectedItemIds: Array.from(tab.selectedItemIds),
        historyRef: historyRefs.current[tab.id],
      }));
      localStorage.setItem('dw:tabs', JSON.stringify(tabsToStore));
      if (activeTabId) {
        localStorage.setItem('dw:activeTabId', activeTabId);
      }
    } catch (error) {
      console.warn('Failed to save tabs to localStorage:', error);
    }
  }, [tabs, activeTabId, isClient]);

  function createNewTab(name: string): TabState {
    const emptyDiagram = { nodes: [], connections: [], zones: [] };
    const emptyHistory = [JSON.stringify(emptyDiagram)];
    const tabId = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    historyRefs.current[tabId] = { history: emptyHistory, index: 0 };

    return {
      id: tabId,
      name,
      diagramData: emptyDiagram,
      history: emptyHistory,
      historyIndex: 0,
      selectedItem: null,
      selectedItemIds: new Set(),
      isConnectMode: false,
      jsonPanelOpen: false,
      canvasTransform: { x: 0, y: 0, k: 1 },
      savedDataHash: JSON.stringify(emptyDiagram),
    };
  }

  const createTab = useCallback(() => {
    const tabNumber = tabs.length + 1;
    const newTab = createNewTab(`Diagram ${tabNumber}`);
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
        // Update savedDataHash if diagramData changed
        if (updates.diagramData) {
          updated.savedDataHash = JSON.stringify(updates.diagramData);
        }
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

  const markTabAsSaved = useCallback(() => {
    if (!activeTabId) return;
    
    setTabs(prev => prev.map(tab => {
      if (tab.id === activeTabId) {
        return {
          ...tab,
          savedDataHash: JSON.stringify(tab.diagramData),
        };
      }
      return tab;
    }));
  }, [activeTabId]);

  return {
    tabs: tabs.map(t => ({ id: t.id, name: t.name, isModified: t.savedDataHash !== JSON.stringify(t.diagramData) })),
    activeTabId,
    activeTab: getActiveTab(),
    createTab,
    switchTab,
    closeTab,
    updateActiveTab,
    markTabAsSaved,
    getHistoryRef: (tabId: string) => historyRefs.current[tabId],
    setHistoryRef: (tabId: string, ref: { history: string[]; index: number }) => {
      historyRefs.current[tabId] = ref;
    },
  };
}

