"use client";
import React, { useRef, useCallback } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Panel, Group as PanelGroup } from 'react-resizable-panels';
import { ComponentSidebar } from './editor/component-sidebar';
import { EditorCanvas, type EditorCanvasHandle } from './editor/editor-canvas';
import { JsonEditorPanel } from './editor/json-editor-panel';
import dynamic from 'next/dynamic';

const TopMenuBar = dynamic(() => import('./editor/top-menu-bar').then(mod => ({ default: mod.TopMenuBar })), {
  ssr: false,
  loading: () => <div className="flex items-center border-b bg-card min-h-[2.5rem] overflow-x-auto">
    <div className="flex h-10 items-center space-x-1 rounded-md border bg-background p-1">
      <div className="flex cursor-default select-none items-center rounded-sm px-3 py-1.5 text-sm font-medium">Loading...</div>
    </div>
  </div>
});
import { TabBar } from './editor/tab-bar';
import { ExportDialog } from './editor/export-dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { DiagramData, DiagramNodeData, DiagramConnectionData } from '@/lib/types';
import { generateSequentialId } from '@/lib/id-generator';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { useDiagramTabs } from '@/hooks/use-diagram-tabs';
import { useLayers } from '@/hooks/use-layers';
import { flattenDiagramOnImport, type RawDiagramData } from '@/lib/flatten-on-import';
import { DiagramDataSchema } from '@/lib/schemas';
import { themeManager } from '@/lib/theme-manager';
import { DiagramTheme } from '@/lib/theme-types';
import { LayersPanel } from './editor/layers-panel';
const ScratchPad = dynamic(() => import('./editor/scratch-pad').then(mod => ({ default: mod.ScratchPad })), {
  ssr: false,
});
import { TutorialProvider, useTutorial } from './tutorial/tutorial-provider';
import { TutorialOverlay } from './tutorial/tutorial-overlay';
import { 
  createGroup, 
  addToGroup,
  removeFromGroup, 
  ungroup, 
  getItemGroup,
  getGroupMembers,
  handleItemDeletion as cleanupGroupsAfterDeletion
} from '@/lib/grouping-utils';
import { 
  moveItemToBack,
  moveItemToFront,
  moveItemOneBack,
  moveItemOneForward,
  getItemPosition,
  getItemCount
} from '@/lib/rendering-order-utils';
import { performAutoLayout } from '@/lib/auto-layout';

export type SelectedItem = (
  | (DiagramNodeData & {
      itemType: 'node',
      id: string,
      // Zone styling properties for nodes
      borderColor?: string,
      textColor?: string,
      backgroundColor?: string,
      borderStyle?: 'solid' | 'dotted' | 'gradient' | 'none',
      borderColors?: string[],
      backgroundStyle?: 'solid' | 'gradient' | 'none',
      backgroundColors?: string[],
      gradientAngle?: number,
      shadow?: boolean,
      rotation?: number,
      textPosition?: 'above' | 'center' | 'under',
      textJustify?: 'left' | 'center' | 'right' | 'full',
      textVerticalPosition?: 'top' | 'middle' | 'bottom',
      fontFamily?: string,
      fontSize?: number,
      fontWeight?: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900',
      fontStyle?: 'normal' | 'italic' | 'oblique',
      textDecoration?: 'none' | 'underline' | 'overline' | 'line-through',
      textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize',
      letterSpacing?: number,
      lineHeight?: number,
      textOpacity?: number,
      borderWidth?: number,
      objectStyle?: string,
      width?: number,
      height?: number,
      sizeMode?: 'auto' | 'custom',
      minWidth?: number,
      minHeight?: number,
      orientation?: 'horizontal' | 'vertical' | 'square',
      maxItemsPerRow?: number,
      lineColor?: string,
      parentId?: string,
      tag?: string,
      tagPosition?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
    })
  | (DiagramConnectionData & { 
      itemType: 'edge', 
      id: string,
      // Additional edge properties
      freeflow?: boolean,
      edgePosition?: number
    })
);

interface PaletteResource {
  name: string;
  file?: string; // Optional for icon resources (symbols/emojis)
  type?: string;
  hasWhiteVariant?: boolean;
  format?: string;
  iconType?: string;
  iconName?: string;
  emoji?: string;
}

interface PaletteSelection {
  resource: PaletteResource;
  provider: string;
  category: string;
}

function createPaletteItem(
  resource: PaletteResource | { name: string; iconType?: string; iconName?: string; emoji?: string },
  provider: string,
  category: string
) {
  const r = resource as { name: string; iconType?: string; iconName?: string; emoji?: string; file?: string };
  if (r.iconType === 'lucide' && r.iconName) {
    const slug = r.iconName.toLowerCase().replace(/\s+/g, '-');
    return { type: `generic.icon.${slug}`, label: r.name, provider: 'generic', category: 'icon', iconType: 'lucide', iconName: r.iconName };
  }
  if (r.iconType === 'emoji' && r.emoji) {
    const slug = r.name.replace(/\s+/g, '-').toLowerCase();
    return { type: `generic.emoji.${slug}`, label: r.name, provider: 'generic', category: 'emoji', iconType: 'emoji', emoji: r.emoji };
  }
  const derivedSlug = (resource as PaletteResource).name.replace(/\s+/g, '-').toLowerCase();
  return {
    type: `${provider}.${category}.${derivedSlug}`,
    label: (resource as PaletteResource).name,
    provider,
    category,
    file: (resource as PaletteResource).file,
  };
}

export default function DiagramEditor() {
  const [isClient, setIsClient] = React.useState<boolean>(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const editorRef = React.useRef<EditorCanvasHandle>(null);
  const [exportDialogOpen, setExportDialogOpen] = React.useState(false);
  const [closeTabDialogOpen, setCloseTabDialogOpen] = React.useState(false);
  const [pendingCloseTabId, setPendingCloseTabId] = React.useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = React.useState<boolean>(false);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = React.useState<boolean>(false);
  // Initialize scratchpad visibility from localStorage
  const [scratchPadOpen, setScratchPadOpen] = React.useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const savedVisibility = localStorage.getItem('dw:scratchpad:visible');
      if (savedVisibility) {
        try {
          return JSON.parse(savedVisibility);
        } catch (e) {
          console.error('Failed to load scratchpad visibility', e);
        }
      }
    }
    return false;
  });

  // Save scratchpad visibility to localStorage when it changes
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('dw:scratchpad:visible', JSON.stringify(scratchPadOpen));
    }
  }, [scratchPadOpen]);
  const [jsonPanelWidth, setJsonPanelWidth] = React.useState<number>(420);
  const [isDragging, setIsDragging] = React.useState<boolean>(false);
  const [canPaste, setCanPaste] = React.useState<boolean>(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [mousePosition, setMousePosition] = React.useState<{ x: number; y: number } | null>(null);
  const [hoverEnabled, setHoverEnabled] = React.useState<boolean>(false);
  const [selectionAnimationEnabled, setSelectionAnimationEnabled] = React.useState<boolean>(false);
  const [iconBackgroundEnabled, setIconBackgroundEnabled] = React.useState<boolean>(true);
  const [alignmentGuidesEnabled, setAlignmentGuidesEnabled] = React.useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dw:alignmentGuides:enabled');
      return saved !== 'false'; // Default to enabled
    }
    return true;
  });
  const [isReadOnly, setIsReadOnly] = React.useState<boolean>(false);
  const [triggerTextStylingPanel, setTriggerTextStylingPanel] = React.useState<boolean>(false);
  const [triggerVisualStylingPanel, setTriggerVisualStylingPanel] = React.useState<boolean>(false);
  const [triggerLineStylingPanel, setTriggerLineStylingPanel] = React.useState<boolean>(false);
  const [triggerConnectionSettingsPanel, setTriggerConnectionSettingsPanel] = React.useState<boolean>(false);
  const [lastRightClickItemId, setLastRightClickItemId] = React.useState<string | null>(null);
  const [selectedResource, setSelectedResource] = React.useState<PaletteSelection | null>(null);
  const [paletteClipboardItem, setPaletteClipboardItem] = React.useState<any | null>(null);
  // Reset trigger states after they've been used
  React.useEffect(() => {
    if (triggerTextStylingPanel) {
      const timer = setTimeout(() => setTriggerTextStylingPanel(false), 100);
      return () => clearTimeout(timer);
    }
  }, [triggerTextStylingPanel]);

  React.useEffect(() => {
    if (triggerVisualStylingPanel) {
      const timer = setTimeout(() => setTriggerVisualStylingPanel(false), 100);
      return () => clearTimeout(timer);
    }
  }, [triggerVisualStylingPanel]);

  React.useEffect(() => {
    if (triggerLineStylingPanel) {
      const timer = setTimeout(() => setTriggerLineStylingPanel(false), 100);
      return () => clearTimeout(timer);
    }
  }, [triggerLineStylingPanel]);

  React.useEffect(() => {
    if (triggerConnectionSettingsPanel) {
      const timer = setTimeout(() => setTriggerConnectionSettingsPanel(false), 100);
      return () => clearTimeout(timer);
    }
  }, [triggerConnectionSettingsPanel]);

  // Tab management
  const {
    tabs,
    activeTabId,
    activeTab,
    createTab,
    switchTab,
    closeTab,
    updateActiveTab,
    markTabAsSaved,
    getHistoryRef,
    setHistoryRef,
  } = useDiagramTabs({
    isClient,
    onToast: toast,
  });

  // Sync active tab state to local state for component use
  const diagramData = activeTab?.diagramData || { nodes: [], connections: [], groupings: [] };
  const history = activeTab?.history || [JSON.stringify({ nodes: [], connections: [], groupings: [] })];
  const historyIndex = activeTab?.historyIndex || 0;
  const historyRef = React.useRef(getHistoryRef(activeTabId || '') || { history: [], index: 0 });
  const selectedItem = activeTab?.selectedItem || null;
  const selectedItemIds = activeTab?.selectedItemIds || new Set();
  const isConnectMode = activeTab?.isConnectMode || false;
  const jsonPanelOpen = activeTab?.jsonPanelOpen || false;
  const canvasTransform = activeTab?.canvasTransform || { x: 0, y: 0, k: 1 };
  
  // Refresh key to force canvas re-render
  const [canvasRefreshKey, setCanvasRefreshKey] = React.useState(0);
  
  const refreshCanvas = React.useCallback(() => {
    setCanvasRefreshKey(prev => prev + 1);
  }, []);



  // Helper functions to update active tab
  const setDiagramData = React.useCallback((updater: DiagramData | ((prev: DiagramData) => DiagramData)) => {
    if (!activeTabId) return;
    const newData = typeof updater === 'function' ? updater(diagramData) : updater;
    updateActiveTab({ diagramData: newData });
  }, [activeTabId, diagramData, updateActiveTab]);

  const setSelectedItem = React.useCallback((updater: SelectedItem | null | ((prev: SelectedItem | null) => SelectedItem | null)) => {
    if (!activeTabId) return;
    const newItem = typeof updater === 'function' ? updater(selectedItem) : updater;
    updateActiveTab({ selectedItem: newItem });
  }, [activeTabId, selectedItem, updateActiveTab]);

  // Initialize layers system
  const layers = useLayers({
    diagramData,
    setDiagramData,
    toast
  });

  const setSelectedItemIds = React.useCallback((updater: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    if (!activeTabId) return;
    const newIds = typeof updater === 'function' ? updater(selectedItemIds) : updater;
    updateActiveTab({ selectedItemIds: newIds });
    
    // Update active layer based on selection
    layers.updateActiveLayerFromSelection(newIds);
  }, [activeTabId, selectedItemIds, updateActiveTab, layers]);

  const setIsConnectMode = React.useCallback((mode: boolean) => {
    if (!activeTabId) return;
    updateActiveTab({ isConnectMode: mode });
  }, [activeTabId, updateActiveTab]);

  const setJsonPanelOpen = React.useCallback((open: boolean) => {
    if (!activeTabId) return;
    updateActiveTab({ jsonPanelOpen: open });
    if (isClient) {
      localStorage.setItem('dw:jsonEditor:open', String(open));
    }
  }, [activeTabId, updateActiveTab, isClient]);

  const setCanvasTransform = React.useCallback((transform: { x: number; y: number; k: number }) => {
    if (!activeTabId) return;
    updateActiveTab({ canvasTransform: transform });
  }, [activeTabId, updateActiveTab]);

  const setHistory = React.useCallback((newHistory: string[]) => {
    if (!activeTabId) return;
    updateActiveTab({ history: newHistory });
    setHistoryRef(activeTabId, { history: newHistory, index: historyIndex });
  }, [activeTabId, historyIndex, updateActiveTab, setHistoryRef]);

  const setHistoryIndex = React.useCallback((index: number) => {
    if (!activeTabId) return;
    updateActiveTab({ historyIndex: index });
    const currentHistory = historyRef.current.history;
    setHistoryRef(activeTabId, { history: currentHistory, index });
  }, [activeTabId, updateActiveTab, setHistoryRef]);

  // Update historyRef when active tab changes
  React.useEffect(() => {
    if (activeTabId && activeTab) {
      historyRef.current = getHistoryRef(activeTabId) || { history: activeTab.history, index: activeTab.historyIndex };
    }
  }, [activeTabId, activeTab, getHistoryRef]);

  // Debounced history update to prevent excessive processing during rapid changes
  const historyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const updateHistory = useCallback(() => {
    if (!activeTabId || !activeTab) return;
    
    // Skip history updates during dragging
    if (isDragging) {
      return;
    }
    
    const jsonString = JSON.stringify(diagramData);
    
    // Skip if this is same as last history entry (but not on initial load)
    if (historyRef.current.history.length > 1 && historyRef.current.history[historyRef.current.index] === jsonString) {
      return;
    }
    
    // Update history using ref for immediate access
    const currentHistory = historyRef.current.history.slice(0, historyRef.current.index + 1);
    currentHistory.push(jsonString);
    
    // Keep only last 20 states
    if (currentHistory.length > 20) {
      currentHistory.shift();
    }
    
    const newIndex = currentHistory.length - 1;
    
    // Update ref
    historyRef.current = { history: currentHistory, index: newIndex };
    
    // Update tab state
    updateActiveTab({ history: currentHistory, historyIndex: newIndex });
    setHistoryRef(activeTabId, historyRef.current);
  }, [diagramData, isDragging, activeTabId, activeTab, updateActiveTab, setHistoryRef]);

  // Watch diagramData changes and update history with debouncing
  React.useEffect(() => {
    // Clear existing timeout
    if (historyTimeoutRef.current) {
      clearTimeout(historyTimeoutRef.current);
    }
    
    // Skip history updates during dragging to prevent performance issues
    if (isDragging) {
      return;
    }
    
    // Debounce history updates to 300ms
    historyTimeoutRef.current = setTimeout(() => {
      updateHistory();
    }, 300);
    
    // Cleanup timeout on unmount
    return () => {
      if (historyTimeoutRef.current) {
        clearTimeout(historyTimeoutRef.current);
      }
    };
  }, [diagramData, updateHistory, isDragging]);

  const undo = React.useCallback(() => {
    if (!activeTabId) return;
    const { history: currentHistory, index: currentIndex } = historyRef.current;
    
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      historyRef.current.index = newIndex;
      setHistoryIndex(newIndex);
      const newDiagramData = JSON.parse(currentHistory[newIndex]);
      setDiagramData(newDiagramData);
      setSelectedItem(null);
      setHistoryRef(activeTabId, historyRef.current);
    }
  }, [activeTabId, setHistoryIndex, setDiagramData, setSelectedItem, setHistoryRef]);

  const redo = React.useCallback(() => {
    if (!activeTabId) return;
    const { history: currentHistory, index: currentIndex } = historyRef.current;
    
    if (currentIndex < currentHistory.length - 1) {
      const newIndex = currentIndex + 1;
      historyRef.current.index = newIndex;
      setHistoryIndex(newIndex);
      const newDiagramData = JSON.parse(currentHistory[newIndex]);
      setDiagramData(newDiagramData);
      setSelectedItem(null);
      setHistoryRef(activeTabId, historyRef.current);
    }
  }, [activeTabId, setHistoryIndex, setDiagramData, setSelectedItem, setHistoryRef]);

  // Initialize client-side state after hydration
  React.useEffect(() => {
    setIsClient(true);
    const savedWidth = localStorage.getItem('dw:jsonEditor:width');
    if (savedWidth !== null) {
      setJsonPanelWidth(parseInt(savedWidth, 10));
    }
    // Load icon background preference
    const savedIconBackground = localStorage.getItem('dw:iconBackground:enabled');
    if (savedIconBackground !== null) {
      setIconBackgroundEnabled(savedIconBackground === 'true');
    }
  }, []);

  // Handle body scroll lock when mobile sidebar is open
  React.useEffect(() => {
    if (isMobile) {
      if (sidebarOpen) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
      
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [sidebarOpen, isMobile]);

  const handleItemSelect = (item: SelectedItem | null, shiftKey = false) => {
    if (isConnectMode && !item) {
      setIsConnectMode(false);
    }
    
    if (shiftKey && item) {
      setSelectedItemIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(item.id)) {
          newSet.delete(item.id);
        } else {
          newSet.add(item.id);
        }
        return newSet;
      });
      setSelectedItem(item);
    } else {
      setSelectedItem(item);
      
      if (item) {
        // If clicking on an item that's already in a multi-select, preserve the selection
        // This allows dragging multi-selected items without clearing the selection
        setSelectedItemIds(prev => {
          if (prev.size > 1 && prev.has(item.id)) {
            // Preserve multi-select if clicking on an already-selected item
            return prev;
          } else {
            // Otherwise, select only the clicked item
            return new Set([item.id]);
          }
        });
      } else {
        setSelectedItemIds(new Set());
      }
    }
  };

  const handleBatchSelect = (itemIds: string[]) => {
    if (itemIds.length === 0) {
      setSelectedItem(null);
      setSelectedItemIds(new Set());
      return;
    }
    
    // Find all items (nodes only - zones removed)
    const items: SelectedItem[] = [];
    itemIds.forEach(id => {
      const node = diagramData.nodes.find(n => n.id === id);
      if (node) {
        items.push({ ...node, itemType: 'node' as const });
      }
    });
    
    if (items.length > 0) {
      // Set first item as primary, all items as selected
      setSelectedItem(items[0]);
      setSelectedItemIds(new Set(itemIds));
    }
  };
  
  const handleItemUpdate = (updatedItem: SelectedItem) => {
    if (updatedItem.itemType === 'edge') return;
    setDiagramData(prevData => {
            // Find the existing node to preserve its properties
            const existingNode = prevData.nodes.find(n => n.id === updatedItem.id);
            
            if (!existingNode) {
                // Node doesn't exist, this shouldn't happen but handle gracefully
                return prevData;
            }
            
            // Create merged node, ensuring we preserve all existing properties
            // Only update properties that are explicitly provided in updatedItem
            const mergedNode = { ...existingNode } as DiagramNodeData;
            
            // Only copy properties that exist in updatedItem and are not undefined
            Object.keys(updatedItem).forEach(key => {
                if (key !== 'itemType' && key !== 'id') {
                    const value = (updatedItem as any)[key];
                    if (value !== undefined) {
                        (mergedNode as any)[key] = value;
                    }
                }
            });
            
            return {
                ...prevData,
                nodes: prevData.nodes.map(n => n.id === updatedItem.id ? mergedNode : n)
            };
    });

    // Also update the selected item state if it's the one being edited
    if (selectedItem?.id === updatedItem.id) {
        setSelectedItem(updatedItem);
    }
  }

  const handleLabelUpdate = (nodeId: string, newLabel: string, richLabel?: import("@/lib/types").RichTextRun[]) => {
    React.startTransition(() => {
      setDiagramData(prevData => ({
        ...prevData,
        nodes: prevData.nodes.map(n =>
          n.id === nodeId
            ? { ...n, label: newLabel, richLabel: richLabel ?? undefined }
            : n
        ),
      }));

      // Also update the selected item if it's the one being edited
      if (selectedItem?.id === nodeId && selectedItem.itemType === 'node') {
        setSelectedItem({ ...selectedItem, label: newLabel });
      }
    });
  }

  const handleTagUpdate = (nodeId: string, newTag: string) => {
    setDiagramData(prevData => ({
      ...prevData,
      nodes: prevData.nodes.map(n => n.id === nodeId ? { ...n, tag: newTag } : n)
    }));

    // Also update the selected item if it's the one being edited
    if (selectedItem?.id === nodeId && selectedItem.itemType === 'node') {
      setSelectedItem({ ...selectedItem, tag: newTag });
    }
  }

  const handleResourceSelect = (resource: { name: string; file: string; type?: string; hasWhiteVariant?: boolean; format?: string }, provider: string, category: string) => {
    // Track the currently selected resource from the sidebar for copy/paste
    setSelectedResource({ resource, provider, category });
    console.log('Resource selected:', { resource, provider, category });
  };

  const handleResourceActivate = (
    resource: { name: string; file?: string; type?: string; hasWhiteVariant?: boolean; format?: string; iconType?: string; iconName?: string; emoji?: string },
    provider: string,
    category: string,
    fullItem?: { type: string; label: string; provider: string; category: string; iconType?: string; iconName?: string; emoji?: string }
  ) => {
    const item = fullItem ?? createPaletteItem(resource as PaletteResource, provider, category);
    setSelectedResource({ resource, provider, category });
    setPaletteClipboardItem(item);
    if (editorRef.current) {
      editorRef.current.pastePaletteItem(item);
    }
  };

  const handleResourceActivateAtPosition = (
    resource: { name: string; file?: string; type?: string; hasWhiteVariant?: boolean; format?: string; iconType?: string; iconName?: string; emoji?: string },
    provider: string,
    category: string,
    position: { x: number; y: number },
    fullItem?: object
  ) => {
    const item = (fullItem as { type: string; label: string; provider: string; category: string }) ?? createPaletteItem(resource as PaletteResource, provider, category);
    setSelectedResource({ resource, provider, category });
    setPaletteClipboardItem(item);
    if (editorRef.current) {
      editorRef.current.pastePaletteItem(item, position);
    }
  };

  const handleItemDelete = (itemToDelete: SelectedItem) => {
    setDiagramData(prevData => {
      let newNodes = prevData.nodes;
      let newConnections = prevData.connections;

      if (itemToDelete.itemType === 'node') {
        newNodes = prevData.nodes.filter(n => n.id !== itemToDelete.id);
        newConnections = prevData.connections.filter((e: { from: string; to: string }) => e.from !== itemToDelete.id && e.to !== itemToDelete.id);
      } else if (itemToDelete.itemType === 'edge') {
        newConnections = prevData.connections.filter((e: { from: string; to: string }) => 
          !(e.from === itemToDelete.from && e.to === itemToDelete.to)
        );
      }

      const updatedData = { ...prevData, nodes: newNodes, connections: newConnections };
      return cleanupGroupsAfterDeletion([itemToDelete.id], updatedData);
    });
    setSelectedItem(null);
  };

  const handleGroupItems = () => {
    if (selectedItemIds.size < 2) {
      toast({ 
        variant: 'destructive', 
        title: 'Cannot Group', 
        description: 'Select at least 2 items to create a group.' 
      });
      return;
    }

    try {
      const updatedData = createGroup(Array.from(selectedItemIds), diagramData);
      setDiagramData(updatedData);
      toast({ 
        title: 'Items Grouped', 
        description: `Created group with ${selectedItemIds.size} items.` 
      });
    } catch (error) {
      toast({ 
        variant: 'destructive', 
        title: 'Group Failed', 
        description: error instanceof Error ? error.message : 'Failed to create group.' 
      });
    }
  };

  const handleUngroupItems = () => {
    if (!selectedItem) return;

    const group = getItemGroup(selectedItem.id, diagramData);
    if (!group) {
      toast({ 
        variant: 'destructive', 
        title: 'Not Grouped', 
        description: 'Selected item is not in a group.' 
      });
      return;
    }

    try {
      const updatedData = ungroup(group.id, diagramData);
      setDiagramData(updatedData);
      toast({ 
        title: 'Items Ungrouped', 
        description: 'Group has been dissolved.' 
      });
    } catch (error) {
      toast({ 
        variant: 'destructive', 
        title: 'Ungroup Failed', 
        description: error instanceof Error ? error.message : 'Failed to ungroup items.' 
      });
    }
  };

  const handleRemoveFromGroup = () => {
    if (selectedItemIds.size === 0) return;

    try {
      const updatedData = removeFromGroup(Array.from(selectedItemIds), diagramData);
      setDiagramData(updatedData);
      toast({ 
        title: 'Removed from Group', 
        description: `${selectedItemIds.size} item(s) removed from group.` 
      });
    } catch (error) {
      toast({ 
        variant: 'destructive', 
        title: 'Remove Failed', 
        description: error instanceof Error ? error.message : 'Failed to remove from group.' 
      });
    }
  };

  const handleAddToGroup = (groupId: string) => {
    if (selectedItemIds.size === 0) return;

    try {
      const updatedData = addToGroup(Array.from(selectedItemIds), groupId, diagramData);
      setDiagramData(updatedData);
      toast({ 
        title: 'Added to Group', 
        description: `${selectedItemIds.size} item(s) added to group.` 
      });
    } catch (error) {
      toast({ 
        variant: 'destructive', 
        title: 'Add to Group Failed', 
        description: error instanceof Error ? error.message : 'Failed to add to group.' 
      });
    }
  };

  const handleConnect = (targetItem: DiagramNodeData) => {
    if (!isConnectMode || !selectedItem || selectedItem.itemType !== 'node' || selectedItem.id === targetItem.id) {
      setIsConnectMode(false);
      return;
    }

    // Get connection options from window storage or use defaults
    const connectionOptions = (window as any).pendingConnectionOptions || {};
    
    const newConnection: DiagramConnectionData = { 
      from: selectedItem.id, 
      to: targetItem.id,
      style: connectionOptions.style || 'bezier',
      curvature: connectionOptions.style === 'bezier' ? (connectionOptions.curvature || 0.5) : undefined
    };
    
    // Clear stored connection options
    delete (window as any).pendingConnectionOptions;
    
    // Avoid creating duplicate connections
    const connectionExists = diagramData.connections.some(
      (edge: any) => (edge.from === newConnection.from && edge.to === newConnection.to)
    );

    if (!connectionExists) {
      setDiagramData(prevData => ({
        ...prevData,
        connections: [...prevData.connections, newConnection]
      }));
    }
    
    setIsConnectMode(false);
    setSelectedItem(null); // Deselect after connecting
  };

  const startConnecting = (connectionOptions?: { style?: 'pathways' | 'bezier', curvature?: number }) => {
    if (selectedItem && selectedItem.itemType === 'node') {
      setIsConnectMode(true);
      // Store connection options for use when connection is created
      (window as any).pendingConnectionOptions = connectionOptions;
    }
  }

  const disconnectSelected = () => {
    if (!selectedItem || selectedItem.itemType !== 'node') return;
    const id = selectedItem.id;
    setDiagramData(prevData => ({
      ...prevData,
      connections: prevData.connections.filter((e: any) => e.from !== id && e.to !== id),
    }));
    toast({ title: 'Disconnected', description: 'All connections to/from this item have been removed.' });
  };

  const disconnectConnection = (from: string, to: string) => {
    setDiagramData(prevData => ({
      ...prevData,
      connections: prevData.connections.filter((e: any) => !(e.from === from && e.to === to)),
    }));
    // If this connection was selected, deselect it
    if (selectedItem && selectedItem.itemType === 'edge' && selectedItem.from === from && selectedItem.to === to) {
      setSelectedItem(null);
    }
    toast({ title: 'Connection Disconnected', description: 'Connection has been removed.' });
  };
  
  const handleSave = async () => {
    if (!activeTabId || !activeTab) return;
    const jsonString = JSON.stringify(diagramData, null, 2);

    // Try to use the File System Access API if available (Chromium browsers)
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: `${activeTab.name.replace(/\s+/g, '-').toLowerCase()}.json`,
          types: [{
            description: 'JSON Files',
            accept: { 'application/json': ['.json'] }
          }]
        });
        const writable = await handle.createWritable();
        await writable.write(jsonString);
        await writable.close();
        markTabAsSaved();
        toast({ title: 'Diagram Saved', description: 'Your diagram has been saved successfully.' });
        return;
      } catch (error: any) {
        // User cancelled or API failed, fall back to download
        if (error.name !== 'AbortError') {
          console.log('File System Access API failed, falling back to download:', error);
        }
      }
    }

    // Fallback: automatic download
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeTab.name.replace(/\s+/g, '-').toLowerCase()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    markTabAsSaved();
    toast({ title: 'Diagram Saved', description: 'Your diagram has been downloaded.' });
  };

  const handleLoadClick = () => {
    fileInputRef.current?.click();
  };

  const parseUnknownJsonToDiagramData = React.useCallback((json: unknown): DiagramData => {
    const flattened = flattenDiagramOnImport((json || {}) as RawDiagramData);
    const result = DiagramDataSchema.safeParse(flattened);
    if (!result.success) {
      throw new Error(`Invalid diagram format: ${result.error.message}`);
    }
    return {
      nodes: result.data.nodes || [],
      connections: result.data.connections || [],
      groupings: result.data.groupings,
      layers: result.data.layers,
    };
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result;
          if (typeof text === 'string') {
            const jsonData = JSON.parse(text);
            const completeData = parseUnknownJsonToDiagramData(jsonData);
            setDiagramData({ nodes: [], connections: [], groupings: [] });
            setTimeout(() => {
              setDiagramData(completeData);
              setSelectedItem(null);
              toast({ title: 'Diagram Loaded', description: 'Your diagram has been successfully loaded.' });
              
              // Fit diagram to view after loading
              setTimeout(() => {
                editorRef.current?.fitToView();
              }, 100);
            }, 0);
          }
        } catch (error) {
          // Load error handled below via toast
          const message = error instanceof Error ? error.message : "An unknown error occurred";
          toast({
              variant: 'destructive',
              title: 'Error Loading Diagram',
              description: `Could not load or parse the file. ${message}`,
          });
        }
      };
      reader.readAsText(file);
    }
    // Reset file input to allow loading the same file again
    if(event.target) {
        event.target.value = '';
    }
  };

  const handleConnectionUpdate = (from: string, to: string, updates: { text?: string; color?: string; textPosition?: number; lineWidth?: number; shadow?: boolean; style?: 'bezier'; curvature?: number; fromPreferredExit?: 'top' | 'bottom' | 'left' | 'right' | 'center'; fromArrow?: boolean; toPreferredEntry?: 'top' | 'bottom' | 'left' | 'right' | 'center'; toArrow?: boolean; arrow?: boolean }) => {
    setDiagramData(prevData => ({
      ...prevData,
      connections: prevData.connections.map(conn => 
        (conn.from === from && conn.to === to) 
          ? { ...conn, ...updates }
          : conn
      )
    }));
    // Update selected item if it's the same connection
    if (selectedItem && selectedItem.itemType === 'edge' && selectedItem.from === from && selectedItem.to === to) {
      setSelectedItem({ ...selectedItem, ...updates });
    }
  };

  const handleNew = () => {
    createTab();
  };

  const handleLoadExample = React.useCallback(async (exampleId: string) => {
    try {
      const res = await fetch(`/examples/${exampleId}.json`);
      if (!res.ok) {
        throw new Error(`Failed to load example: ${res.statusText}`);
      }
      const json = await res.json();
      const diagram = parseUnknownJsonToDiagramData(json);
      
      // Create a new tab with the example data
      const exampleName = exampleId === 'example1' ? 'Example 1' : exampleId === 'example2' ? 'Example 2' : `Example: ${exampleId}`;
      createTab({ name: exampleName, diagramData: diagram });
      
      toast({ 
        title: 'Example Loaded', 
        description: `${exampleName} has been loaded in a new tab.` 
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "An unknown error occurred";
      toast({
        variant: 'destructive',
        title: 'Error Loading Example',
        description: `Could not load example. ${message}`,
      });
    }
  }, [parseUnknownJsonToDiagramData, createTab, toast]);

  const handleMenuCopy = () => {
    if (selectedResource) {
      const item = createPaletteItem(selectedResource.resource, selectedResource.provider, selectedResource.category);
      setPaletteClipboardItem(item);
    } else {
      editorRef.current?.copy();
    }
  };

  const handleMenuPaste = () => {
    if (paletteClipboardItem && editorRef.current) {
      editorRef.current.pastePaletteItem(paletteClipboardItem);
    } else {
      editorRef.current?.paste();
    }
  };

  const handleSelectAll = () => {
    const allIds = new Set<string>();
    
    diagramData.nodes.forEach(node => allIds.add(node.id));
    diagramData.connections.forEach(connection => {
      allIds.add(`${connection.from}-${connection.to}`);
    });
    
    setSelectedItemIds(allIds);
    
    if (allIds.size > 0) {
      const firstId = Array.from(allIds)[0];
      const nodeItem = diagramData.nodes.find(node => node.id === firstId);
      if (nodeItem) {
        setSelectedItem({ ...nodeItem, itemType: 'node' });
        return;
      }
      const connection = diagramData.connections.find(conn => `${conn.from}-${conn.to}` === firstId);
      if (connection) {
        setSelectedItem({ ...connection, itemType: 'edge', id: firstId });
      }
    } else {
      setSelectedItem(null);
    }
  };

  const handleExportSvg = async () => {
    setExportDialogOpen(true);
  };

  const handleExport = async (options: { backgroundColor: 'transparent' | 'white'; quality?: 'low' | 'medium' | 'high' }) => {
    // Close dialog and export current viewport
    setExportDialogOpen(false);
    if (editorRef.current) {
      await editorRef.current.exportPng({ 
        backgroundColor: options.backgroundColor,
        quality: options.quality || 'medium'
      });
    }
  };

  const handleTabClose = async (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;

    // Check for unsaved changes
    const currentDataHash = JSON.stringify(activeTab?.diagramData);
    const hasUnsavedChanges = tab.isModified;

    if (hasUnsavedChanges) {
      setPendingCloseTabId(tabId);
      setCloseTabDialogOpen(true);
    } else {
      await closeTab(tabId, true);
    }
  };

  const handleCloseTabConfirm = async () => {
    if (pendingCloseTabId) {
      await closeTab(pendingCloseTabId, true);
      setPendingCloseTabId(null);
    }
    setCloseTabDialogOpen(false);
  };

  const handleJsonValidChange = (newDiagramData: DiagramData) => {
    setDiagramData(newDiagramData);
  };

  const handleThemeApplyToSelected = (theme: DiagramTheme) => {
    if (!selectedItemIds || selectedItemIds.size === 0) {
      // Apply to single selected item
      if (selectedItem) {
        const updatedItem = themeManager.applyThemeToItem(selectedItem, theme);
        handleItemUpdate(updatedItem as any);
      }
    } else {
      // Apply to multiple selected items
      const updatedDiagramData = { ...diagramData };
      
      // Update nodes
      updatedDiagramData.nodes = updatedDiagramData.nodes.map(node => {
        if (selectedItemIds.has(node.id)) {
          return themeManager.applyThemeToItem(node, theme) as DiagramNodeData;
        }
        return node;
      });
      
      // Update connections
      updatedDiagramData.connections = updatedDiagramData.connections.map(connection => {
        const connectionId = `${connection.from}-${connection.to}`;
        if (selectedItemIds.has(connectionId)) {
          return themeManager.applyThemeToItem(connection, theme) as DiagramConnectionData;
        }
        return connection;
      });
      
      setDiagramData(updatedDiagramData);
      
      const count = selectedItemIds.size;
      toast({ 
        title: 'Theme Applied', 
        description: `Applied "${theme.name}" theme to ${count} item${count > 1 ? 's' : ''}.` 
      });
    }
  };

  const handleMoveToBack = () => {
    if (!selectedItem || selectedItem.itemType === 'edge') return;
    const updatedData = moveItemToBack(diagramData, selectedItem.id, selectedItem.itemType);
    setDiagramData(updatedData);
  };

  const handleMoveToFront = () => {
    if (!selectedItem || selectedItem.itemType === 'edge') return;
    const updatedData = moveItemToFront(diagramData, selectedItem.id, selectedItem.itemType);
    setDiagramData(updatedData);
  };

  const handleMoveOneBack = () => {
    if (!selectedItem || selectedItem.itemType === 'edge') return;
    const updatedData = moveItemOneBack(diagramData, selectedItem.id, selectedItem.itemType);
    setDiagramData(updatedData);
  };

  const handleMoveOneForward = () => {
    if (!selectedItem || selectedItem.itemType === 'edge') return;
    const updatedData = moveItemOneForward(diagramData, selectedItem.id, selectedItem.itemType);
    setDiagramData(updatedData);
  };

  const handleAlignObjects = (alignment: 'top' | 'center' | 'bottom' | 'v-middle' | 'left' | 'h-center' | 'right' | 'distribute-v' | 'distribute-h') => {
    if (!selectedItem || selectedItemIds.size < 2) return;

    // Get the reference item (first selected item) and store it permanently
    // We need to find the actual first selected item from the diagram data
    const firstSelectedId = Array.from(selectedItemIds)[0];
    const referenceNode = diagramData.nodes.find(n => n.id === firstSelectedId);
    if (!referenceNode) return;
    
    const referenceItem = { ...referenceNode, itemType: 'node' } as SelectedItem;
    
    // Helper function to get object dimensions
    const getObjectDimensions = (item: SelectedItem): { width: number; height: number } => {
      if (item.itemType === 'node') {
        const node = item as any;
        
        // Check if it's a shape node
        const isShapeNode = node.type === 'generic.object.square' ||
                           node.type === 'generic.object.circle' ||
                           node.type === 'generic.object.point' ||
                           node.type === 'generic.object.rectangle' ||
                           node.type === 'generic.object.rounded-rectangle' ||
                           node.type === 'generic.object.triangle' ||
                           node.type === 'generic.object.star' ||
                           node.type === 'generic.object.cloud';
        
        // Check if it's a textbox node
        const isTextboxNode = node.type === 'generic.text.textbox';
        
        // Use custom dimensions if sizeMode is 'custom' and dimensions are provided
        if ((isTextboxNode || isShapeNode) && node.sizeMode === 'custom' && node.width && node.height) {
          return { width: node.width, height: node.height };
        }
        
        // Shapes always use their custom width/height if set
        if (isShapeNode && node.width && node.height) {
          return { width: node.width, height: node.height };
        }
        
        // Default dimensions based on node type
        if (node.type?.startsWith('generic.text')) {
          if (node.type === 'generic.text.textbox') {
            return { width: 120, height: 60 };
          }
          return { width: 100, height: 40 };
        }
        
        // Default for icon nodes
        return { width: 80, height: 50 };
      }
      return { width: 80, height: 50 };
    };

    // Calculate reference position based on alignment
    const refDims = getObjectDimensions(referenceItem);
    const refX = (referenceItem as any).x || 0;
    const refY = (referenceItem as any).y || 0;
    let referenceX: number;
    let referenceY: number;

    // Handle vertical alignment
    switch (alignment) {
      case 'top':
        referenceY = refY;
        break;
      case 'v-middle':
        referenceY = refY + (refDims.height / 2);
        break;
      case 'bottom':
        referenceY = refY + refDims.height;
        break;
      default:
        // For horizontal alignment, use center Y as default
        referenceY = refY + (refDims.height / 2);
        break;
    }

    // Handle horizontal alignment
    switch (alignment) {
      case 'left':
        referenceX = refX;
        break;
      case 'h-center':
        referenceX = refX + (refDims.width / 2);
        break;
      case 'right':
        referenceX = refX + refDims.width;
        break;
      default:
        // For vertical alignment, use center X as default
        referenceX = refX + (refDims.width / 2);
        break;
    }

    // Handle distribute operations
    if (alignment === 'distribute-v' || alignment === 'distribute-h') {
      // Get all selected items with their positions and dimensions
      const selectedItems: Array<{id: string, x: number, y: number, width: number, height: number, itemType: 'node', index: number}> = [];
      
      selectedItemIds.forEach(id => {
        const node = diagramData.nodes.find(n => n.id === id);
        if (node) {
          const dims = getObjectDimensions({ ...node, itemType: 'node' } as SelectedItem);
          selectedItems.push({
            id,
            x: node.x || 0,
            y: node.y || 0,
            width: dims.width,
            height: dims.height,
            itemType: 'node',
            index: diagramData.nodes.findIndex(n => n.id === id)
          });
        }
      });

      if (selectedItems.length < 3) return; // Need at least 3 items to distribute

      // Sort items by position
      if (alignment === 'distribute-v') {
        selectedItems.sort((a, b) => a.y - b.y);
      } else {
        selectedItems.sort((a, b) => a.x - b.x);
      }

      // Calculate distribution
      const firstItem = selectedItems[0];
      const lastItem = selectedItems[selectedItems.length - 1];
      
      let newPositions: Array<{id: string, x?: number, y?: number}> = [];

      if (alignment === 'distribute-v') {
        // Vertical distribution
        const totalHeight = lastItem.y + lastItem.height - firstItem.y;
        const totalItemHeight = selectedItems.reduce((sum, item) => sum + item.height, 0);
        const totalSpacing = totalHeight - totalItemHeight;
        const spacing = totalSpacing / (selectedItems.length - 1);
        
        let currentY = firstItem.y;
        selectedItems.forEach(item => {
          newPositions.push({ id: item.id, y: currentY });
          currentY += item.height + spacing;
        });
      } else {
        // Horizontal distribution
        const totalWidth = lastItem.x + lastItem.width - firstItem.x;
        const totalItemWidth = selectedItems.reduce((sum, item) => sum + item.width, 0);
        const totalSpacing = totalWidth - totalItemWidth;
        const spacing = totalSpacing / (selectedItems.length - 1);
        
        let currentX = firstItem.x;
        selectedItems.forEach(item => {
          newPositions.push({ id: item.id, x: currentX });
          currentX += item.width + spacing;
        });
      }

      // Apply the new positions
      setDiagramData(prevData => {
        const newNodes = [...prevData.nodes];
        newPositions.forEach(pos => {
          const nodeIndex = newNodes.findIndex(n => n.id === pos.id);
          if (nodeIndex !== -1) {
            newNodes[nodeIndex] = { ...newNodes[nodeIndex], ...pos };
          }
        });
        return { ...prevData, nodes: newNodes };
      });

      const updatedSelectedItems: SelectedItem[] = [];
      selectedItemIds.forEach(id => {
        const updatedNode = diagramData.nodes.find(n => n.id === id);
        if (updatedNode) {
          updatedSelectedItems.push({ ...updatedNode, itemType: 'node' } as SelectedItem);
        }
      });

      // Update the primary selected item if it was distributed
      if (selectedItem && selectedItem.id !== firstSelectedId) {
        const updatedPrimary = updatedSelectedItems.find(item => item.id === selectedItem.id);
        if (updatedPrimary) {
          setSelectedItem(updatedPrimary);
        }
      }

      return;
    }

    // Align all selected items
    setDiagramData(prevData => {
      const newNodes = [...prevData.nodes];

      selectedItemIds.forEach(id => {
        if (id === firstSelectedId) return;

        const nodeIndex = newNodes.findIndex(n => n.id === id);
        if (nodeIndex !== -1) {
          const node = newNodes[nodeIndex];
          const nodeDims = getObjectDimensions({ ...node, itemType: 'node' } as SelectedItem);
          let newX = node.x;
          let newY = node.y;
          
          switch (alignment) {
            case 'top':
              newY = referenceY;
              break;
            case 'v-middle':
              newY = referenceY - (nodeDims.height / 2);
              break;
            case 'bottom':
              newY = referenceY - nodeDims.height;
              break;
          }
          
          switch (alignment) {
            case 'left':
              newX = referenceX;
              break;
            case 'h-center':
              newX = referenceX - (nodeDims.width / 2);
              break;
            case 'right':
              newX = referenceX - nodeDims.width;
              break;
            case 'center':
              newX = referenceX - (nodeDims.width / 2);
              break;
          }
          
          newNodes[nodeIndex] = { ...node, x: newX, y: newY };
        }
      });

      return { ...prevData, nodes: newNodes };
    });

    const updatedSelectedItems: SelectedItem[] = [];
    selectedItemIds.forEach(id => {
      const updatedNode = diagramData.nodes.find(n => n.id === id);
      if (updatedNode) {
        updatedSelectedItems.push({ ...updatedNode, itemType: 'node' } as SelectedItem);
      }
    });

    // Update the primary selected item if it was aligned
    if (selectedItem && selectedItem.id !== referenceItem.id) {
      const updatedPrimary = updatedSelectedItems.find(item => item.id === selectedItem.id);
      if (updatedPrimary) {
        setSelectedItem(updatedPrimary);
      }
    }
  };

  const handleAutoLayout = () => {
    try {
      const newData = performAutoLayout(diagramData);
      setDiagramData(newData);
      toast({ 
        title: 'Auto Layout Applied', 
        description: 'Diagram has been automatically arranged.' 
      });
    } catch (error) {
      console.error('Auto layout failed:', error);
      toast({ 
        variant: 'destructive', 
        title: 'Auto Layout Failed', 
        description: 'Could not apply auto layout.' 
      });
    }
  };

  const toggleJsonPanel = () => {
    const newState = !jsonPanelOpen;
    setJsonPanelOpen(newState);
    if (isClient) {
      localStorage.setItem('dw:jsonEditor:open', String(newState));
    }
  };

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.userAgent.toUpperCase().includes('MAC');
      
      // Don't trigger shortcuts when typing in input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      // Ctrl+Shift+J (or Cmd+Shift+J on Mac) - Toggle JSON Panel
      if ((isMac ? e.metaKey : e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        toggleJsonPanel();
      }
      
      // Ctrl+N (or Cmd+N on Mac) - New
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 'n' && !e.shiftKey) {
        e.preventDefault();
        handleNew();
      }
      
      // Ctrl+O (or Cmd+O on Mac) - Load
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 'o' && !e.shiftKey) {
        e.preventDefault();
        handleLoadClick();
      }
      
      // Ctrl+S (or Cmd+S on Mac) - Save
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 's' && !e.shiftKey) {
        e.preventDefault();
        handleSave();
      }
      
      // Ctrl+Z (or Cmd+Z on Mac) - Undo
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      
      // Ctrl+Shift+Z (or Cmd+Shift+Z on Mac) - Redo
      if ((isMac ? e.metaKey : e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        redo();
      }
      
      // Ctrl+Y (or Cmd+Y on Mac) - Redo (alternative)
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
      
      // Ctrl+A (or Cmd+A on Mac) - Select All
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 'a' && !e.shiftKey) {
        e.preventDefault();
        handleSelectAll();
      }
      
      // Escape key - Clear multi-selection
      if (e.key === 'Escape' && selectedItemIds.size > 1) {
        e.preventDefault();
        setSelectedItemIds(new Set());
        return;
      }
      
      // Ctrl+G (or Cmd+G on Mac) - Group selected items
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 'g' && !e.shiftKey) {
        e.preventDefault();
        handleGroupItems();
        return;
      }
      
      // Ctrl+Shift+G (or Cmd+Shift+G on Mac) - Ungroup selected items
      if ((isMac ? e.metaKey : e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        handleUngroupItems();
        return;
      }
      
      // Ctrl+Shift+L (or Cmd+Shift+L on Mac) - Auto Layout
      if ((isMac ? e.metaKey : e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        handleAutoLayout();
        return;
      }
      
      // Arrow keys - Move selected items by 10px grid
      if ((e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') && selectedItem && selectedItem.itemType !== 'edge') {
        e.preventDefault();
        
        const gridSize = 10; // Use 10px for arrow key movement
        let deltaX = 0;
        let deltaY = 0;
        
        switch (e.key) {
          case 'ArrowUp':
            deltaY -= gridSize;
            break;
          case 'ArrowDown':
            deltaY += gridSize;
            break;
          case 'ArrowLeft':
            deltaX -= gridSize;
            break;
          case 'ArrowRight':
            deltaX += gridSize;
            break;
        }
        
        // Determine which items to move (multi-selection or single selection)
        const itemIdsToMove = selectedItemIds.size > 0 ? Array.from(selectedItemIds) : [selectedItem.id];
        
        // Filter out locked nodes
        const unlockedItemIds = itemIdsToMove.filter(id => {
          const node = diagramData.nodes.find(n => n.id === id);
          return !node || !node.locked;
        });
        
        // If all items are locked, don't move anything
        if (unlockedItemIds.length === 0) {
          return;
        }
        
        setDiagramData(prevData => {
          const newNodes = [...prevData.nodes];
          unlockedItemIds.forEach(id => {
            const nodeIndex = newNodes.findIndex(n => n.id === id);
            if (nodeIndex !== -1) {
              const node = newNodes[nodeIndex];
              newNodes[nodeIndex] = { 
                ...node, 
                x: Math.round(((node.x || 0) + deltaX) / gridSize) * gridSize,
                y: Math.round(((node.y || 0) + deltaY) / gridSize) * gridSize
              };
            }
          });
          return { ...prevData, nodes: newNodes };
        });
        
        const updatedSelectedItems: SelectedItem[] = [];
        unlockedItemIds.forEach(id => {
          const updatedNode = diagramData.nodes.find(n => n.id === id);
          if (updatedNode) {
            updatedSelectedItems.push({ 
              ...updatedNode, 
              itemType: 'node',
              x: Math.round(((updatedNode.x || 0) + deltaX) / gridSize) * gridSize,
              y: Math.round(((updatedNode.y || 0) + deltaY) / gridSize) * gridSize
            } as SelectedItem);
          }
        });
        
        // Update the primary selected item
        const updatedPrimary = updatedSelectedItems.find(item => item.id === selectedItem.id);
        if (updatedPrimary) {
          setSelectedItem(updatedPrimary);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [jsonPanelOpen, historyIndex, history, selectedItem, selectedItemIds, diagramData, setDiagramData, setSelectedItem]);

  // Persist panel width
  React.useEffect(() => {
    if (isClient) {
      localStorage.setItem('dw:jsonEditor:width', String(jsonPanelWidth));
    }
  }, [jsonPanelWidth, isClient]);

  // Persist icon background preference
  React.useEffect(() => {
    if (isClient) {
      localStorage.setItem('dw:iconBackground:enabled', String(iconBackgroundEnabled));
    }
  }, [iconBackgroundEnabled, isClient]);

  // Persist alignment guides preference
  React.useEffect(() => {
    if (isClient) {
      localStorage.setItem('dw:alignmentGuides:enabled', String(alignmentGuidesEnabled));
    }
  }, [alignmentGuidesEnabled, isClient]);

  const canPasteFromMenu = paletteClipboardItem != null || canPaste;

  // Tutorial integration
  const handleStartTutorial = React.useCallback(() => {
    // This will be called from TopMenuBar, but we need to access the tutorial context
    // So we'll pass it through a ref or use a different approach
  }, []);

  return (
    <TutorialProvider>
      <DiagramEditorInner
        canPasteFromMenu={canPasteFromMenu}
        isMobile={isMobile}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        leftPanelCollapsed={leftPanelCollapsed}
        setLeftPanelCollapsed={setLeftPanelCollapsed}
        selectedItem={selectedItem}
        selectedItemIds={selectedItemIds}
        handleItemUpdate={handleItemUpdate}
        startConnecting={startConnecting}
        handleItemDelete={handleItemDelete}
        handleResourceSelect={handleResourceSelect}
        handleResourceActivate={handleResourceActivate}
        handleResourceActivateAtPosition={handleResourceActivateAtPosition}
        toggleJsonPanel={toggleJsonPanel}
        jsonPanelOpen={jsonPanelOpen}
        editorRef={editorRef}
        handleConnectionUpdate={handleConnectionUpdate}
        disconnectConnection={disconnectConnection}
        setDiagramData={setDiagramData}
        layers={layers}
        canvasTransform={canvasTransform}
        setCanvasTransform={setCanvasTransform}
        handleNew={handleNew}
        handleLoadClick={handleLoadClick}
        handleSave={handleSave}
        handleLoadExample={handleLoadExample}
        createTab={createTab}
        handleExportSvg={handleExportSvg}
        handleMenuCopy={handleMenuCopy}
        handleMenuPaste={handleMenuPaste}
        canPaste={canPaste}
        undo={undo}
        redo={redo}
        historyIndex={historyIndex}
        history={history}
        handleSelectAll={handleSelectAll}
        mousePosition={mousePosition}
        hoverEnabled={hoverEnabled}
        setHoverEnabled={setHoverEnabled}
        selectionAnimationEnabled={selectionAnimationEnabled}
        setSelectionAnimationEnabled={setSelectionAnimationEnabled}
        iconBackgroundEnabled={iconBackgroundEnabled}
        setIconBackgroundEnabled={setIconBackgroundEnabled}
        alignmentGuidesEnabled={alignmentGuidesEnabled}
        setAlignmentGuidesEnabled={setAlignmentGuidesEnabled}
        isReadOnly={isReadOnly}
        setIsReadOnly={setIsReadOnly}
        handleAlignObjects={handleAlignObjects}
        handleAutoLayout={handleAutoLayout}
        handleThemeApplyToSelected={handleThemeApplyToSelected}
        triggerTextStylingPanel={triggerTextStylingPanel}
        setTriggerTextStylingPanel={setTriggerTextStylingPanel}
        triggerVisualStylingPanel={triggerVisualStylingPanel}
        setTriggerVisualStylingPanel={setTriggerVisualStylingPanel}
        triggerLineStylingPanel={triggerLineStylingPanel}
        setTriggerLineStylingPanel={setTriggerLineStylingPanel}
        triggerConnectionSettingsPanel={triggerConnectionSettingsPanel}
        setTriggerConnectionSettingsPanel={setTriggerConnectionSettingsPanel}
        setScratchPadOpen={setScratchPadOpen}
        scratchPadOpen={scratchPadOpen}
        tabs={tabs}
        activeTabId={activeTabId}
        switchTab={switchTab}
        handleTabClose={handleTabClose}
        fileInputRef={fileInputRef}
        handleFileChange={handleFileChange}
        diagramData={diagramData}
        handleJsonValidChange={handleJsonValidChange}
        exportDialogOpen={exportDialogOpen}
        setExportDialogOpen={setExportDialogOpen}
        handleExport={handleExport}
        refreshCanvas={refreshCanvas}
        updateHistory={updateHistory}
        closeTabDialogOpen={closeTabDialogOpen}
        setCloseTabDialogOpen={setCloseTabDialogOpen}
        pendingCloseTabId={pendingCloseTabId}
        setPendingCloseTabId={setPendingCloseTabId}
        handleCloseTabConfirm={handleCloseTabConfirm}
        handleItemSelect={handleItemSelect}
        handleBatchSelect={handleBatchSelect}
        setSelectedItemIds={setSelectedItemIds}
        setSelectedItem={setSelectedItem}
        isConnectMode={isConnectMode}
        handleConnect={handleConnect}
        setIsConnectMode={setIsConnectMode}
        disconnectSelected={disconnectSelected}
        handleLabelUpdate={handleLabelUpdate}
        handleTagUpdate={handleTagUpdate}
        setIsDragging={setIsDragging}
        setCanPaste={setCanPaste}
        setMousePosition={setMousePosition}
        handleGroupItems={handleGroupItems}
        handleUngroupItems={handleUngroupItems}
        handleRemoveFromGroup={handleRemoveFromGroup}
        handleAddToGroup={handleAddToGroup}
        handleMoveToBack={handleMoveToBack}
        handleMoveToFront={handleMoveToFront}
        handleMoveOneBack={handleMoveOneBack}
        handleMoveOneForward={handleMoveOneForward}
        canvasRefreshKey={canvasRefreshKey}
        activeTab={activeTab}
        toast={toast}
      />
      <TutorialOverlay />
    </TutorialProvider>
  );
}

function DiagramEditorInner({
  canPasteFromMenu,
  isMobile,
  sidebarOpen,
  setSidebarOpen,
  leftPanelCollapsed,
  setLeftPanelCollapsed,
  selectedItem,
  selectedItemIds,
  handleItemUpdate,
  startConnecting,
  handleItemDelete,
  handleResourceSelect,
  handleResourceActivate,
  handleResourceActivateAtPosition,
  toggleJsonPanel,
  jsonPanelOpen,
  editorRef,
  handleConnectionUpdate,
  disconnectConnection,
  setDiagramData,
  layers,
  canvasTransform,
  setCanvasTransform,
  handleNew,
  handleLoadClick,
  handleSave,
  handleLoadExample,
  createTab,
  handleExportSvg,
  handleMenuCopy,
  handleMenuPaste,
  canPaste,
  undo,
  redo,
  historyIndex,
  history,
  handleSelectAll,
  mousePosition,
  hoverEnabled,
  setHoverEnabled,
  selectionAnimationEnabled,
  setSelectionAnimationEnabled,
  iconBackgroundEnabled,
  setIconBackgroundEnabled,
  alignmentGuidesEnabled,
  setAlignmentGuidesEnabled,
  isReadOnly,
  setIsReadOnly,
  handleAlignObjects,
  handleAutoLayout,
  handleThemeApplyToSelected,
  triggerTextStylingPanel,
  setTriggerTextStylingPanel,
  triggerVisualStylingPanel,
  setTriggerVisualStylingPanel,
  triggerLineStylingPanel,
  setTriggerLineStylingPanel,
  triggerConnectionSettingsPanel,
  setTriggerConnectionSettingsPanel,
  setScratchPadOpen,
  scratchPadOpen,
  tabs,
  activeTabId,
  switchTab,
  handleTabClose,
  fileInputRef,
  handleFileChange,
  jsonPanelOpen: jsonPanelOpenInner,
  diagramData,
  handleJsonValidChange,
  toggleJsonPanel: toggleJsonPanelInner,
  exportDialogOpen,
  setExportDialogOpen,
  handleExport,
  refreshCanvas,
  updateHistory,
  closeTabDialogOpen,
  setCloseTabDialogOpen,
  pendingCloseTabId,
  setPendingCloseTabId,
  handleCloseTabConfirm,
  handleItemSelect,
  handleBatchSelect,
  setSelectedItemIds,
  setSelectedItem,
  isConnectMode,
  handleConnect,
  setIsConnectMode,
  disconnectSelected,
  handleLabelUpdate,
  handleTagUpdate,
  setIsDragging,
  setCanPaste,
  setMousePosition,
  handleGroupItems,
  handleUngroupItems,
  handleRemoveFromGroup,
  handleAddToGroup,
  handleMoveToBack,
  handleMoveToFront,
  handleMoveOneBack,
  handleMoveOneForward,
  canvasRefreshKey,
  activeTab,
  toast,
}: any) {
  const { start } = useTutorial();
  
  const handleStartTutorial = React.useCallback(() => {
    start([
      {
        id: 'step-1',
        title: 'Welcome to DiagramWeaver',
        body: 'Click the File menu to open it. If you don’t want to, press Next and the tutorial will do it for you.',
        target: 'file-menu',
        requiresTargetClick: true,
        autoActionsOnNext: [{ type: 'click', target: 'file-menu' }],
      },
      {
        id: 'step-2',
        title: 'Edit menu',
        body: 'The Edit menu has actions like copy/paste and undo/redo. Click it, or press Next to open it automatically.',
        target: 'edit-menu',
        requiresTargetClick: true,
        autoActionsOnNext: [{ type: 'click', target: 'edit-menu' }],
      },
      {
        id: 'step-3',
        title: 'Tutorial complete',
        body: 'You’re all set. You can run this tutorial again any time from File → Start Tutorial.',
        target: 'canvas',
        mode: 'message',
        requiresTargetClick: false,
      },
    ]);
  }, [start]);

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex h-screen w-screen bg-background text-foreground font-body relative overflow-hidden">
        {/* Mobile sidebar overlay */}
        {isMobile && sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        
        {/* Sidebar - fixed on mobile, normal on desktop */}
        <div className={`${isMobile ? 'fixed left-0 top-0 h-full z-50 transform transition-transform duration-300 ease-in-out' : ''} ${isMobile && !sidebarOpen ? '-translate-x-full' : ''} ${isMobile ? (leftPanelCollapsed ? 'w-12' : 'w-80') : ''}`}>
 <ComponentSidebar
    selectedItem={selectedItem}
    selectedItemIds={selectedItemIds}
    onItemUpdate={handleItemUpdate}
    onConnect={startConnecting}
    onDisconnect={disconnectSelected}
    onItemDelete={handleItemDelete}
    diagramData={diagramData}
    onResourceSelect={handleResourceSelect}
    onResourceActivate={handleResourceActivate}
    onToggleJsonPanel={toggleJsonPanel}
    jsonPanelOpen={jsonPanelOpen}
    onFitToView={() => editorRef.current?.fitToView()}
    onConnectionUpdate={handleConnectionUpdate}
    onConnectionDisconnect={disconnectConnection}
    onCloseSidebar={() => setSidebarOpen(false)}
    isMobile={isMobile}
    transform={canvasTransform}
    onTransformChange={setCanvasTransform}
    collapsed={leftPanelCollapsed}
    onToggleCollapse={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
  />
        </div>
        
        {/* Mobile menu toggle button */}
        {isMobile && (
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="fixed left-4 top-4 z-30 p-3 bg-card border border-border rounded-md shadow-lg touch-target"
            style={{ touchAction: 'manipulation' }}
            aria-label="Toggle sidebar"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
        )}
        
        <main className={`flex-1 flex flex-col ${isMobile ? 'w-full' : ''} ${isMobile && sidebarOpen ? 'pointer-events-none' : ''} ${jsonPanelOpen ? 'min-w-0' : ''}`}>
            <header className="flex flex-col border-b bg-card">
                <TopMenuBar
                    onNew={handleNew}
                    onLoad={handleLoadClick}
                    onSave={handleSave}
                    onLoadExample={handleLoadExample}
                    onNewTab={createTab}
                    onExportSvg={handleExportSvg}
                    onToggleJsonPanel={toggleJsonPanel}
                    jsonPanelOpen={jsonPanelOpen}
                    onToggleLayersPanel={layers.toggleLayersPanel}
                    layersPanelOpen={layers.layersPanelOpen}
                    onFitToView={() => editorRef.current?.fitToView()}
                    onCopy={handleMenuCopy}
                    onPaste={handleMenuPaste}
                    canPaste={canPasteFromMenu}
                    onUndo={undo}
                    onRedo={redo}
                    canUndo={historyIndex > 0}
                    canRedo={historyIndex < history.length - 1}
                    onSelectAll={handleSelectAll}
                    transform={canvasTransform}
                    onTransformChange={setCanvasTransform}
                    selectedItem={selectedItem}
                    selectedItemIds={selectedItemIds}
                    onItemUpdate={handleItemUpdate}
                    onConnect={startConnecting}
                    onDisconnect={disconnectSelected}
                    onDelete={() => {
                      if (selectedItem) {
                        handleItemDelete(selectedItem);
                      }
                    }}
                    onConnectionUpdate={handleConnectionUpdate}
                    onConnectionDisconnect={disconnectConnection}
                    diagramData={activeTab?.diagramData}
                    onDiagramDataUpdate={setDiagramData}
                    mousePosition={mousePosition}
                    hoverEnabled={hoverEnabled}
                    onToggleHover={() => setHoverEnabled(!hoverEnabled)}
                    selectionAnimationEnabled={selectionAnimationEnabled}
                    onToggleSelectionAnimation={() => setSelectionAnimationEnabled(!selectionAnimationEnabled)}
                    iconBackgroundEnabled={iconBackgroundEnabled}
                    onToggleIconBackground={() => setIconBackgroundEnabled(!iconBackgroundEnabled)}
                    alignmentGuidesEnabled={alignmentGuidesEnabled}
                    onToggleAlignmentGuides={() => setAlignmentGuidesEnabled(!alignmentGuidesEnabled)}
                    isReadOnly={isReadOnly}
                    onToggleReadOnly={() => setIsReadOnly(!isReadOnly)}
                    onAlignObjects={handleAlignObjects}
                    onAutoLayout={handleAutoLayout}
                    onThemeApplyToSelected={handleThemeApplyToSelected}
                    triggerTextStylingPanel={triggerTextStylingPanel}
                    triggerVisualStylingPanel={triggerVisualStylingPanel}
                    triggerLineStylingPanel={triggerLineStylingPanel}
                    triggerConnectionSettingsPanel={triggerConnectionSettingsPanel}
                    onCloseConnectionSettingsPanel={() => {
                      // This will be passed down to close the connection settings panel
                      // We need to emit an event or call a callback to top-menu-bar
                    }}
                    onToggleScratchPad={() => setScratchPadOpen(!scratchPadOpen)}
                    scratchPadOpen={scratchPadOpen}
                    onStartTutorial={handleStartTutorial}
                />
                {activeTabId && (
                  <TabBar
                    tabs={tabs}
                    activeTabId={activeTabId}
                    onTabSelect={switchTab}
                    onTabClose={handleTabClose}
                  />
                )}
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="application/json"
                    style={{ display: 'none' }}
                />
            </header>
            <div className="flex-1 flex flex-col">
                <div className={`flex flex-1 ${jsonPanelOpen ? 'overflow-x-auto' : ''}`}>
                  <div className={`flex-1 h-full min-w-0 ${jsonPanelOpen ? 'mr-2' : ''}`}>
                <EditorCanvas 
                    key={canvasRefreshKey}
                    ref={editorRef}
                    diagramData={layers.filteredDiagramData} 
                    setDiagramData={setDiagramData}
                    onItemSelect={handleItemSelect}
                    onBatchSelect={handleBatchSelect}
                    setSelectedItemIds={setSelectedItemIds}
                    setSelectedItem={setSelectedItem as any}
                    selectedItemId={selectedItem?.id}
                    selectedItemIds={selectedItemIds}
                    isConnectMode={isConnectMode}
                    onNodeClickInConnectMode={handleConnect}
                    onConnect={startConnecting}
                    onDisconnect={() => {
                             // Remove all connections from selected item
                             if (selectedItem) {
                                 setDiagramData((prevData: DiagramData) => ({
                                     ...prevData,
                                     connections: prevData.connections?.filter((e: any) => e.from !== selectedItem.id && e.to !== selectedItem.id) || []
                                 }));
                                 toast({
                                     title: "Connections Disconnected",
                                     description: "All connections from the selected item have been removed.",
                                 });
                             }
                        }}
                    onConnectionDelete={disconnectConnection}
                    externalTransform={canvasTransform}
                     onTransformChange={setCanvasTransform}
                     onLabelUpdate={handleLabelUpdate}
                     onTagUpdate={handleTagUpdate}
                     onDraggingChange={setIsDragging}
                    onClipboardChange={setCanPaste}
                    onMousePositionChange={setMousePosition}
                    onExportComplete={() => setExportDialogOpen(false)}
                    hoverEnabled={hoverEnabled}
                    selectionAnimationEnabled={selectionAnimationEnabled}
                    iconBackgroundEnabled={iconBackgroundEnabled}
                    onSelectAll={handleSelectAll}
                    onTriggerTextStylingPanel={() => setTriggerTextStylingPanel(true)}
                    onTriggerVisualStylingPanel={() => setTriggerVisualStylingPanel(true)}
                    onTriggerLineStylingPanel={() => setTriggerLineStylingPanel(true)}
                    onTriggerConnectionSettingsPanel={() => setTriggerConnectionSettingsPanel(true)}
                    onResetConnectionSettingsTrigger={() => setTriggerConnectionSettingsPanel(false)}
                    layers={{
                      getAllLayers: layers.getAllLayers,
                      getItemLayerById: layers.getItemLayerById,
                      assignItemsToLayer: layers.assignItemsToLayer
                    }}
                    onGroupItems={handleGroupItems}
                    onUngroupItems={handleUngroupItems}
                    onRemoveFromGroup={handleRemoveFromGroup}
                    onAddToGroupItems={handleAddToGroup}
                    onMoveToBack={handleMoveToBack}
                    onMoveToFront={handleMoveToFront}
                    onMoveOneBack={handleMoveOneBack}
                    onMoveOneForward={handleMoveOneForward}
                    isReadOnly={isReadOnly}
                    alignmentGuidesEnabled={alignmentGuidesEnabled}
                    onResourceActivateAtPosition={handleResourceActivateAtPosition}
                    />
                  </div>
                  
                  {/* Layers Panel */}
                  {layers.layersPanelOpen && (
                    <div className="absolute top-4 right-4 z-50">
                      <LayersPanel
                        layers={layers.getAllLayers()}
                        activeLayerId={layers.layersConfig.activeLayerId}
                        selectedItemsLayerIds={selectedItemIds.size > 0 ? 
                          Array.from(selectedItemIds).map(id => layers.getItemLayerById(id)) : []
                        }
                        onAddLayer={layers.addNewLayer}
                        onRemoveLayer={layers.removeLayerById}
                        onRenameLayer={layers.renameLayerById}
                        onToggleVisibility={layers.toggleLayerVisibilityById}
                        onSetActiveLayer={layers.setActiveLayerById}
                        onReorderLayers={layers.reorderLayers}
                        onAssignSelectedItemsToLayer={selectedItemIds.size > 0 ? (layerId: string) => layers.assignItemsToLayer(Array.from(selectedItemIds), layerId) : undefined}
                        onClose={layers.toggleLayersPanel}
                        getLayerItemCount={(layerId: string) => {
                          const items = layers.getLayerItems(layerId);
                          return (items.nodes?.length || 0);
                        }}
                      />
                    </div>
                  )}
                  
                  {jsonPanelOpen && (
                    <div className="flex-shrink-0">
                      <JsonEditorPanel
                        value={diagramData}
                        onValidJsonChange={handleJsonValidChange}
                        isOpen={jsonPanelOpen}
                        onToggleOpen={toggleJsonPanel}
                        widthPx={400}
                        isReadOnly={isReadOnly}
                      />
                    </div>
                  )}
                </div>
            </div>
        </main>
        <ExportDialog
          open={exportDialogOpen}
          onOpenChange={setExportDialogOpen}
          onExport={handleExport}
        />
        <ScratchPad 
          isOpen={scratchPadOpen} 
          onClose={() => setScratchPadOpen(false)} 
          diagramData={diagramData}
          setDiagramData={setDiagramData}
          onCanvasRefresh={refreshCanvas}
          onHistoryUpdate={updateHistory}
        />
        <AlertDialog open={closeTabDialogOpen} onOpenChange={setCloseTabDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
              <AlertDialogDescription>
                This tab has unsaved changes. Are you sure you want to close it? Your changes will be lost.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                setPendingCloseTabId(null);
                setCloseTabDialogOpen(false);
              }}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleCloseTabConfirm}>Close Tab</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DndProvider>
  );
}
