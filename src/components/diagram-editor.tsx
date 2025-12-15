"use client";
import React, { useRef, useCallback } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Panel, PanelGroup } from 'react-resizable-panels';
import { ComponentSidebar } from './editor/component-sidebar';
import { EditorCanvas, type EditorCanvasHandle } from './editor/editor-canvas';
import { JsonEditorPanel } from './editor/json-editor-panel';
import { TopMenuBar } from './editor/top-menu-bar';
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
import type { DiagramData, DiagramNodeData, DiagramZoneData, DiagramConnectionData } from '@/lib/types';
import { generateSequentialId } from '@/lib/id-generator';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { useDiagramTabs } from '@/hooks/use-diagram-tabs';
import { useLayers } from '@/hooks/use-layers';
import { convertFromNestedHierarchy, convertToNestedHierarchy } from '@/lib/nested-hierarchy';
import { themeManager } from '@/lib/theme-manager';
import { DiagramTheme } from '@/lib/theme-types';
import { LayersPanel } from './editor/layers-panel';
import { ScratchPad } from './editor/scratch-pad';
import { 
  createGroup, 
  addToGroup,
  removeFromGroup, 
  ungroup, 
  getItemGroup,
  getGroupMembers,
  handleItemDeletion as cleanupGroupsAfterDeletion,
  cleanupEmptyZones
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
      parentId?: string
    })
  | (DiagramZoneData & { 
      itemType: 'zone', 
      id: string,
      subType?: 'zone' | 'group'
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
  file: string;
  type?: string;
  hasWhiteVariant?: boolean;
  format?: string;
}

interface PaletteSelection {
  resource: PaletteResource;
  provider: string;
  category: string;
}

function createPaletteItem(resource: PaletteResource, provider: string, category: string) {
  const derivedSlug = resource.name.replace(/\s+/g, '-').toLowerCase();
  const isZoneResource = (provider === 'generic' && category === 'grouping') || resource.type === 'zone';

  if (isZoneResource) {
    const subType = resource.name.toLowerCase();
    return {
      type: 'zone',
      subType,
      label: resource.name,
      provider,
      category,
      file: resource.file,
    };
  }

  return {
    type: `${provider}.${category}.${derivedSlug}`,
    label: resource.name,
    provider,
    category,
    file: resource.file,
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
  const [scratchPadOpen, setScratchPadOpen] = React.useState<boolean>(false);

  // Load scratchpad visibility from localStorage after mount
  React.useEffect(() => {
    const savedVisibility = localStorage.getItem('dw:scratchpad:visible');
    if (savedVisibility) {
      try {
        setScratchPadOpen(JSON.parse(savedVisibility));
      } catch (e) {
        console.error('Failed to load scratchpad visibility', e);
      }
    }
  }, []);

  // Save scratchpad visibility to localStorage when it changes
  React.useEffect(() => {
    localStorage.setItem('dw:scratchpad:visible', JSON.stringify(scratchPadOpen));
  }, [scratchPadOpen]);
  const [jsonPanelWidth, setJsonPanelWidth] = React.useState<number>(420);
  const [isDragging, setIsDragging] = React.useState<boolean>(false);
  const [canPaste, setCanPaste] = React.useState<boolean>(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [mousePosition, setMousePosition] = React.useState<{ x: number; y: number } | null>(null);
  const [selectionCoordinates, setSelectionCoordinates] = React.useState<{ start: { x: number; y: number } | null; end: { x: number; y: number } | null } | undefined>(undefined);
  const [hoverEnabled, setHoverEnabled] = React.useState<boolean>(false);
  const [selectionAnimationEnabled, setSelectionAnimationEnabled] = React.useState<boolean>(false);
  const [iconBackgroundEnabled, setIconBackgroundEnabled] = React.useState<boolean>(true);
  const [triggerTextStylingPanel, setTriggerTextStylingPanel] = React.useState<boolean>(false);
  const [triggerVisualStylingPanel, setTriggerVisualStylingPanel] = React.useState<boolean>(false);
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
  const diagramData = activeTab?.diagramData || { nodes: [], connections: [], zones: [], groupings: [] };
  const history = activeTab?.history || [JSON.stringify({ nodes: [], connections: [], zones: [], groupings: [] })];
  const historyIndex = activeTab?.historyIndex || 0;
  const historyRef = React.useRef(getHistoryRef(activeTabId || '') || { history: [], index: 0 });
  const selectedItem = activeTab?.selectedItem || null;
  const selectedItemIds = activeTab?.selectedItemIds || new Set();
  const isConnectMode = activeTab?.isConnectMode || false;
  const jsonPanelOpen = activeTab?.jsonPanelOpen || false;
  const canvasTransform = activeTab?.canvasTransform || { x: 0, y: 0, k: 1 };



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
        // Always select only the clicked item, not the entire group
        setSelectedItemIds(new Set([item.id]));
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
    
    // Find all items
    const items: SelectedItem[] = [];
    itemIds.forEach(id => {
      const node = diagramData.nodes.find(n => n.id === id);
      const zone = diagramData.zones?.find(g => g.id === id);
      
      if (node) {
        items.push({ ...node, itemType: 'node' as const });
      } else if (zone) {
        items.push({ ...zone, itemType: 'zone' as const });
      }
    });
    
    if (items.length > 0) {
      // Set first item as primary, all items as selected
      setSelectedItem(items[0]);
      setSelectedItemIds(new Set(itemIds));
    }
  };
  
  const handleItemUpdate = (updatedItem: SelectedItem) => {
    if (updatedItem.itemType === 'zone') {
        setDiagramData(prevData => {
            const currentZone = (prevData.zones || []).find(g => g.id === updatedItem.id);
            const orientationChanged = currentZone && currentZone.orientation !== updatedItem.orientation;
            
            // Preserve existing zone properties and merge with updates
            const mergedZone = { ...currentZone, ...updatedItem } as DiagramZoneData;
            
            let newZones = (prevData.zones || []).map(g => g.id === updatedItem.id ? mergedZone : g);
            let newNodes = prevData.nodes;
            
            // If orientation changed, reset positions of child items to trigger re-layout
            if (orientationChanged) {
                const zoneData = mergedZone as DiagramZoneData;
                
                // Reset positions of child nodes
                newNodes = prevData.nodes.map(node => {
                    if ((zoneData.children || []).includes(node.id)) {
                        return { ...node, x: undefined, y: undefined };
                    }
                    return node;
                });
                
                // Reset positions of child zones recursively
                const resetChildZonePositions = (zoneId: string, visited: Set<string> = new Set()) => {
                    if (visited.has(zoneId)) {
                        return; // Prevent infinite recursion
                    }
                    visited.add(zoneId);
                    
                    newZones = newZones.map(g => {
                        if (g.id === zoneId) {
                            return { ...g, x: undefined, y: undefined };
                        }
                        return g;
                    });
                    
                    // Recursively reset children of this zone
                    const zone = newZones.find(g => g.id === zoneId);
                    if (zone && zone.children) {
                        zone.children.forEach((childId: string) => {
                            const childZone = newZones.find(g => g.id === childId);
                            if (childZone) {
                                resetChildZonePositions(childId, visited);
                            }
                        });
                    }
                };
                
                (zoneData.children || []).forEach((nodeId: string) => {
                    const childZone = newZones.find(g => g.id === nodeId);
                    if (childZone) {
                        resetChildZonePositions(nodeId);
                    }
                });
            }
            
            return {
                ...prevData,
                zones: newZones,
                nodes: newNodes
            };
        });
    } else {
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
    }

    // Also update the selected item state if it's the one being edited
    if (selectedItem?.id === updatedItem.id) {
        setSelectedItem(updatedItem);
    }
  }

  const handleLabelUpdate = (nodeId: string, newLabel: string) => {
    setDiagramData(prevData => ({
      ...prevData,
      nodes: prevData.nodes.map(n => n.id === nodeId ? { ...n, label: newLabel } : n)
    }));

    // Also update the selected item if it's the one being edited
    if (selectedItem?.id === nodeId && selectedItem.itemType === 'node') {
      setSelectedItem({ ...selectedItem, label: newLabel });
    }
  }

  const handleResourceSelect = (resource: { name: string; file: string; type?: string; hasWhiteVariant?: boolean; format?: string }, provider: string, category: string) => {
    // Track the currently selected resource from the sidebar for copy/paste
    setSelectedResource({ resource, provider, category });
    console.log('Resource selected:', { resource, provider, category });
  };

  const handleResourceActivate = (resource: { name: string; file: string; type?: string; hasWhiteVariant?: boolean; format?: string }, provider: string, category: string) => {
    const item = createPaletteItem(resource, provider, category);
    setSelectedResource({ resource, provider, category });
    setPaletteClipboardItem(item);
    if (editorRef.current) {
      editorRef.current.pastePaletteItem(item);
    }
  };

  const handleItemDelete = (itemToDelete: SelectedItem) => {
    setDiagramData(prevData => {
      let newNodes = prevData.nodes;
      let newZones = prevData.zones || [];
      let newConnections = prevData.connections;

      if (itemToDelete.itemType === 'node') {
        newNodes = prevData.nodes.filter(n => n.id !== itemToDelete.id);
        newConnections = prevData.connections.filter((e: any) => e.from !== itemToDelete.id && e.to !== itemToDelete.id);
      } else if (itemToDelete.itemType === 'zone') {
        newZones = newZones.filter(g => g.id !== itemToDelete.id);
      } else if (itemToDelete.itemType === 'edge') {
        newConnections = prevData.connections.filter((e: any) => 
          !(e.from === itemToDelete.from && e.to === itemToDelete.to)
        );
      }

      newZones = newZones.map(g => ({
        ...g,
        children: (g.children || []).filter((nodeId: string) => nodeId !== itemToDelete.id)
      }));

      const updatedData = { ...prevData, nodes: newNodes, zones: newZones, connections: newConnections };
      
      // Clean up groupings (old system) and empty zones (new system)
      const withGroupingsCleaned = cleanupGroupsAfterDeletion([itemToDelete.id], updatedData);
      return cleanupEmptyZones(withGroupingsCleaned);
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

  const handleConnect = (targetItem: DiagramNodeData | DiagramZoneData) => {
    if (!isConnectMode || !selectedItem || (selectedItem.itemType !== 'node' && selectedItem.itemType !== 'zone') || selectedItem.id === targetItem.id) {
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
    if (selectedItem && (selectedItem.itemType === 'node' || selectedItem.itemType === 'zone')) {
      setIsConnectMode(true);
      // Store connection options for use when connection is created
      (window as any).pendingConnectionOptions = connectionOptions;
    }
  }

  const disconnectSelected = () => {
    if (!selectedItem || (selectedItem.itemType !== 'node' && selectedItem.itemType !== 'zone')) return;
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
    const nestedData = convertToNestedHierarchy(diagramData);
    const jsonString = JSON.stringify(nestedData, null, 2);

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

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result;
          if (typeof text === 'string') {
            let jsonData = JSON.parse(text);

            // Check if this is hierarchical format (has groups with nested children)
            const isHierarchical = jsonData.zones && Array.isArray(jsonData.zones) &&
              jsonData.zones.some((zone: any) => zone.children && Array.isArray(zone.children) &&
                zone.children.some((child: any) => child && typeof child === 'object'));

            if (isHierarchical) {
              // Convert hierarchical to flat format
              jsonData = convertFromNestedHierarchy(jsonData as any);
            }

              // Add basic validation for the loaded data
             if (jsonData.nodes && jsonData.connections) {
               // Ensure all required arrays are present
               const completeData: DiagramData = {
                 nodes: jsonData.nodes || [],
                 connections: jsonData.connections || [],
                 zones: jsonData.zones || [],
                 groupings: jsonData.groupings || [], // Preserve groupings
                 rootZoneId: jsonData.rootZoneId,
                 layers: jsonData.layers // Preserve layers
               };
               // Clear existing data first to ensure clean load
                setDiagramData({ nodes: [], connections: [], zones: [], groupings: [] });
               // Then set the loaded data
               setTimeout(() => {
                 setDiagramData(completeData);
                 setSelectedItem(null);
                 toast({ title: 'Diagram Loaded', description: 'Your diagram has been successfully loaded. If the JSON editor doesn\'t update, try toggling it off and on.' });
               }, 0);
            } else {
              throw new Error('Invalid diagram file format.');
            }
          }
        } catch (error) {
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
    
    // Add all node IDs
    diagramData.nodes.forEach(node => allIds.add(node.id));
    
    // Add all group IDs
    diagramData.zones.forEach(zone => allIds.add(zone.id));
    
    // Add all connection IDs
    diagramData.connections.forEach(connection => {
      const connectionId = `${connection.from}-${connection.to}`;
      allIds.add(connectionId);
    });
    
    setSelectedItemIds(allIds);
    
    // Set the first item as the primary selected item if there are any items
    if (allIds.size > 0) {
      const firstId = Array.from(allIds)[0];
      
      // Try to find the item in nodes first
      const nodeItem = diagramData.nodes.find(node => node.id === firstId);
      if (nodeItem) {
        setSelectedItem({ ...nodeItem, itemType: 'node' });
        return;
      }
      
      // Then try groups
      const groupItem = diagramData.zones.find(zone => zone.id === firstId);
      if (groupItem) {
        setSelectedItem({ ...groupItem, itemType: 'zone' });
        return;
      }
      
      // Finally try connections
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

  const handleExport = async (options: { backgroundColor: 'transparent' | 'white'; useSelection: boolean }) => {
    if (options.useSelection) {
      // Keep dialog open during selection mode
      if (editorRef.current) {
        await editorRef.current.startSelectionMode(options);
      }
    } else {
      // Close dialog and export immediately for full diagram
      setExportDialogOpen(false);
      if (editorRef.current) {
        await editorRef.current.exportPng({ backgroundColor: options.backgroundColor });
      }
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
      
      // Update groups
      updatedDiagramData.zones = updatedDiagramData.zones.map(zone => {
        if (selectedItemIds.has(zone.id)) {
          return themeManager.applyThemeToItem(zone, theme) as DiagramZoneData;
        }
        return zone;
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
    const referenceGroup = diagramData.zones?.find(g => g.id === firstSelectedId);
    
    if (!referenceNode && !referenceGroup) return;
    
    const referenceItem = referenceNode 
      ? { ...referenceNode, itemType: 'node' } as SelectedItem
      : { ...referenceGroup!, itemType: 'zone' } as SelectedItem;
    
    // Helper function to get object dimensions
    const getObjectDimensions = (item: SelectedItem): { width: number; height: number } => {
      if (item.itemType === 'node') {
        const node = item as any;
        
        // Check if it's a shape node
        const isShapeNode = node.type === 'generic.object.square' || 
                           node.type === 'generic.object.circle' || 
                           node.type === 'generic.object.point' || 
                           node.type === 'generic.object.rectangle' || 
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
      } else if (item.itemType === 'zone') {
        return { 
          width: (item as any).width || 300, 
          height: (item as any).height || 220 
        };
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
      const selectedItems: Array<{id: string, x: number, y: number, width: number, height: number, itemType: 'node' | 'zone', index: number}> = [];
      
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
        
        const zone = diagramData.zones?.find(g => g.id === id);
        if (zone) {
          const dims = getObjectDimensions({ ...zone, itemType: 'zone' } as SelectedItem);
          selectedItems.push({
            id,
            x: zone.x || 0,
            y: zone.y || 0,
            width: dims.width,
            height: dims.height,
            itemType: 'zone',
            index: (diagramData.zones || []).findIndex(g => g.id === id)
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
        const newZones = [...(prevData.zones || [])];

        newPositions.forEach(pos => {
          // Update nodes
          const nodeIndex = newNodes.findIndex(n => n.id === pos.id);
          if (nodeIndex !== -1) {
            newNodes[nodeIndex] = { ...newNodes[nodeIndex], ...pos };
          }

          // Update groups
          const groupIndex = newZones.findIndex(g => g.id === pos.id);
          if (groupIndex !== -1) {
            newZones[groupIndex] = { ...newZones[groupIndex], ...pos };
          }
        });

        return {
          ...prevData,
          nodes: newNodes,
          zones: newZones
        };
      });

      // Update selected item states
      const updatedSelectedItems: SelectedItem[] = [];
      selectedItemIds.forEach(id => {
        const updatedNode = diagramData.nodes.find(n => n.id === id);
        const updatedGroup = diagramData.zones?.find(g => g.id === id);
        
        if (updatedNode) {
          updatedSelectedItems.push({ ...updatedNode, itemType: 'node' } as SelectedItem);
        } else if (updatedGroup) {
          updatedSelectedItems.push({ ...updatedGroup, itemType: 'zone' } as SelectedItem);
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
      const newZones = [...(prevData.zones || [])];

      selectedItemIds.forEach(id => {
        if (id === firstSelectedId) return; // Skip reference item

        // Find and update node
        const nodeIndex = newNodes.findIndex(n => n.id === id);
        if (nodeIndex !== -1) {
          const node = newNodes[nodeIndex];
          const nodeDims = getObjectDimensions({ ...node, itemType: 'node' } as SelectedItem);
          
          let newX = node.x;
          let newY = node.y;
          
          // Handle vertical alignment
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
          
          // Handle horizontal alignment
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
              // For vertical center alignment, align X to center
              newX = referenceX - (nodeDims.width / 2);
              break;
          }
          
          newNodes[nodeIndex] = { ...node, x: newX, y: newY };
          return;
        }

        // Find and update group
        const groupIndex = newZones.findIndex(g => g.id === id);
        if (groupIndex !== -1) {
          const zone = newZones[groupIndex];
          const groupDims = getObjectDimensions({ ...zone, itemType: 'zone' } as SelectedItem);
          
          let newX = zone.x;
          let newY = zone.y;
          
          // Handle vertical alignment
          switch (alignment) {
            case 'top':
              newY = referenceY;
              break;
            case 'v-middle':
              newY = referenceY - (groupDims.height / 2);
              break;
            case 'bottom':
              newY = referenceY - groupDims.height;
              break;
          }
          
          // Handle horizontal alignment
          switch (alignment) {
            case 'left':
              newX = referenceX;
              break;
            case 'h-center':
              newX = referenceX - (groupDims.width / 2);
              break;
            case 'right':
              newX = referenceX - groupDims.width;
              break;
            case 'center':
              // For vertical center alignment, align X to center
              newX = referenceX - (groupDims.width / 2);
              break;
          }
          
          newZones[groupIndex] = { ...zone, x: newX, y: newY };
        }
      });

      return {
        ...prevData,
        nodes: newNodes,
        zones: newZones
      };
    });

    // Update selected item states to reflect new positions
    const updatedSelectedItems: SelectedItem[] = [];
    selectedItemIds.forEach(id => {
      const updatedNode = diagramData.nodes.find(n => n.id === id);
      const updatedGroup = diagramData.zones?.find(g => g.id === id);
      
      if (updatedNode) {
        updatedSelectedItems.push({ ...updatedNode, itemType: 'node' } as SelectedItem);
      } else if (updatedGroup) {
        updatedSelectedItems.push({ ...updatedGroup, itemType: 'zone' } as SelectedItem);
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
      
      // 'c' key - Start connecting if item is selected, cancel if in connect mode
      if (e.key.toLowerCase() === 'c' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        if (isConnectMode) {
          // Cancel connect mode
          setIsConnectMode(false);
        } else if (selectedItem && (selectedItem.itemType === 'node' || selectedItem.itemType === 'zone')) {
          // Start connect mode
          startConnecting();
        }
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
        
        setDiagramData(prevData => {
          const newNodes = [...prevData.nodes];
          const newZones = [...(prevData.zones || [])];
          
          itemIdsToMove.forEach(id => {
            // Update nodes
            const nodeIndex = newNodes.findIndex(n => n.id === id);
            if (nodeIndex !== -1) {
              const node = newNodes[nodeIndex];
              newNodes[nodeIndex] = { 
                ...node, 
                x: Math.round(((node.x || 0) + deltaX) / gridSize) * gridSize,
                y: Math.round(((node.y || 0) + deltaY) / gridSize) * gridSize
              };
            }
            
            // Update zones
            const zoneIndex = newZones.findIndex(g => g.id === id);
            if (zoneIndex !== -1) {
              const zone = newZones[zoneIndex];
              newZones[zoneIndex] = { 
                ...zone, 
                x: Math.round(((zone.x || 0) + deltaX) / gridSize) * gridSize,
                y: Math.round(((zone.y || 0) + deltaY) / gridSize) * gridSize
              };
            }
          });
          
          return {
            ...prevData,
            nodes: newNodes,
            zones: newZones
          };
        });
        
        // Update selected item states to reflect new positions
        const updatedSelectedItems: SelectedItem[] = [];
        itemIdsToMove.forEach(id => {
          const updatedNode = diagramData.nodes.find(n => n.id === id);
          const updatedZone = diagramData.zones?.find(g => g.id === id);
          
          if (updatedNode) {
            updatedSelectedItems.push({ 
              ...updatedNode, 
              itemType: 'node',
              x: Math.round(((updatedNode.x || 0) + deltaX) / gridSize) * gridSize,
              y: Math.round(((updatedNode.y || 0) + deltaY) / gridSize) * gridSize
            } as SelectedItem);
          } else if (updatedZone) {
            updatedSelectedItems.push({ 
              ...updatedZone, 
              itemType: 'zone',
              x: Math.round(((updatedZone.x || 0) + deltaX) / gridSize) * gridSize,
              y: Math.round(((updatedZone.y || 0) + deltaY) / gridSize) * gridSize
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

  const canPasteFromMenu = paletteClipboardItem != null || canPaste;

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
        <div className={`${isMobile ? 'fixed left-0 top-0 h-full z-50 transform transition-transform duration-300 ease-in-out' : ''} ${isMobile && !sidebarOpen ? '-translate-x-full' : ''} ${isMobile ? 'w-80' : ''}`}>
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
    onDiagramGenerated={setDiagramData}
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
                    onAlignObjects={handleAlignObjects}
                    onAutoLayout={handleAutoLayout}
                    onThemeApplyToSelected={handleThemeApplyToSelected}
                    triggerTextStylingPanel={triggerTextStylingPanel}
                    triggerVisualStylingPanel={triggerVisualStylingPanel}
                    triggerConnectionSettingsPanel={triggerConnectionSettingsPanel}
                    onCloseConnectionSettingsPanel={() => {
                      // This will be passed down to close the connection settings panel
                      // We need to emit an event or call a callback to top-menu-bar
                    }}
                    onToggleScratchPad={() => setScratchPadOpen(!scratchPadOpen)}
                    scratchPadOpen={scratchPadOpen}
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
                    ref={editorRef}
                    diagramData={layers.getFilteredDiagramData()} 
                    setDiagramData={setDiagramData}
                    onItemSelect={handleItemSelect}
                    onBatchSelect={handleBatchSelect}
                    setSelectedItemIds={setSelectedItemIds}
                    setSelectedItem={setSelectedItem as any}
                    selectedItemId={selectedItem?.id}
                    selectedItemIds={selectedItemIds}
                    isConnectMode={isConnectMode}
                    onNodeClickInConnectMode={handleConnect}
                    onConnect={() => setIsConnectMode(true)}
                    onDisconnect={() => {
                             // Remove all connections from selected item
                             if (selectedItem) {
                                 setDiagramData(prevData => ({
                                     ...prevData,
                                     connections: prevData.connections?.filter((e: any) => e.from !== selectedItem.id && e.to !== selectedItem.id) || []
                                 }));
                                 toast({
                                     title: "Connections Disconnected",
                                     description: "All connections from the selected item have been removed.",
                                 });
                             }
                        }}
                    externalTransform={canvasTransform}
                    onTransformChange={setCanvasTransform}
                    onLabelUpdate={handleLabelUpdate}
                    onDraggingChange={setIsDragging}
                    onClipboardChange={setCanPaste}
                    onMousePositionChange={setMousePosition}
                    onSelectionChange={setSelectionCoordinates}
                    onExportComplete={() => setExportDialogOpen(false)}
                    hoverEnabled={hoverEnabled}
                    selectionAnimationEnabled={selectionAnimationEnabled}
                    iconBackgroundEnabled={iconBackgroundEnabled}
                    onSelectAll={handleSelectAll}
                    onTriggerTextStylingPanel={() => setTriggerTextStylingPanel(true)}
                    onTriggerVisualStylingPanel={() => setTriggerVisualStylingPanel(true)}
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
          selectionCoordinates={selectionCoordinates}
        />
        <ScratchPad 
          isOpen={scratchPadOpen} 
          onClose={() => setScratchPadOpen(false)} 
          diagramData={diagramData}
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
