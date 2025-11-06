"use client";
import React from 'react';
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
import type { DiagramData, DiagramNodeData, DiagramGroupData, DiagramConnectionData } from '@/lib/types';
import { generateSequentialId } from '@/lib/id-generator';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { useDiagramTabs } from '@/hooks/use-diagram-tabs';
import { convertFromNestedHierarchy, convertToNestedHierarchy } from '@/lib/nested-hierarchy';

export type SelectedItem = ((DiagramNodeData | DiagramGroupData) & { 
  itemType: 'node' | 'group', 
  subType?: 'zone' | 'group',
  borderColor?: string,
  textColor?: string,
  backgroundColor?: string,
  borderStyle?: 'solid' | 'gradient' | 'none';
  borderColors?: string[];
  backgroundStyle?: 'solid' | 'gradient' | 'none';
  backgroundColors?: string[];
  orientation?: 'horizontal' | 'vertical' | 'square',
  lineColor?: string,
  maxItemsPerRow?: number,
  shadow?: boolean,
  edgePosition?: 'top' | 'bottom' | 'left' | 'right',
  sizeMode?: 'auto' | 'custom',
  width?: number,
  height?: number,
  minWidth?: number,
  minHeight?: number,
  freeflow?: boolean,
  textPosition?: 'above' | 'center' | 'under' | 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right' | 'inside'
}) | (DiagramConnectionData & { 
  itemType: 'edge',
  id: string // Add the missing id property for edges
});

export default function DiagramEditor() {
  const [isClient, setIsClient] = React.useState<boolean>(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const editorRef = React.useRef<EditorCanvasHandle>(null);
  const [exportDialogOpen, setExportDialogOpen] = React.useState(false);
  const [closeTabDialogOpen, setCloseTabDialogOpen] = React.useState(false);
  const [pendingCloseTabId, setPendingCloseTabId] = React.useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = React.useState<boolean>(false);
  const [jsonPanelWidth, setJsonPanelWidth] = React.useState<number>(420);
  const [isDragging, setIsDragging] = React.useState<boolean>(false);
  const [canPaste, setCanPaste] = React.useState<boolean>(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [mousePosition, setMousePosition] = React.useState<{ x: number; y: number } | null>(null);
  const [selectionCoordinates, setSelectionCoordinates] = React.useState<{ start: { x: number; y: number } | null; end: { x: number; y: number } | null } | undefined>(undefined);

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
  const diagramData = activeTab?.diagramData || { nodes: [], connections: [], groups: [] };
  const history = activeTab?.history || [JSON.stringify({ nodes: [], connections: [], groups: [] })];
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

  const setSelectedItem = React.useCallback((item: SelectedItem | null) => {
    if (!activeTabId) return;
    updateActiveTab({ selectedItem: item });
  }, [activeTabId, updateActiveTab]);

  const setSelectedItemIds = React.useCallback((updater: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    if (!activeTabId) return;
    const newIds = typeof updater === 'function' ? updater(selectedItemIds) : updater;
    updateActiveTab({ selectedItemIds: newIds });
  }, [activeTabId, selectedItemIds, updateActiveTab]);

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

  // Watch diagramData changes and update history automatically
  React.useEffect(() => {
    if (!activeTabId || !activeTab) return;
    
    // Skip history updates during dragging
    if (isDragging) {
      return;
    }
    
    const jsonString = JSON.stringify(diagramData);
    
    // Skip if this is the same as last history entry (but not on initial load)
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
    // If we click away while in connect mode, cancel it.
    if (isConnectMode && !item) {
      setIsConnectMode(false);
    }
    
    if (shiftKey && item) {
      // Multi-select with shift key
      setSelectedItemIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(item.id)) {
          newSet.delete(item.id);
        } else {
          newSet.add(item.id);
        }
        return newSet;
      });
      // Set the primary selected item to the most recently selected
      setSelectedItem(item);
    } else {
      // Normal selection
      setSelectedItem(item);
      setSelectedItemIds(item ? new Set([item.id]) : new Set());
    }
  };
  
  const handleItemUpdate = (updatedItem: SelectedItem) => {
    if (updatedItem.itemType === 'group') {
        setDiagramData(prevData => {
            const currentGroup = (prevData.groups || []).find(g => g.id === updatedItem.id);
            const orientationChanged = currentGroup && currentGroup.orientation !== updatedItem.orientation;
            
            let newGroups = (prevData.groups || []).map(g => g.id === updatedItem.id ? (updatedItem as DiagramGroupData) : g);
            let newNodes = prevData.nodes;
            
            // If orientation changed, reset positions of child items to trigger re-layout
            if (orientationChanged) {
                const groupData = updatedItem as DiagramGroupData;
                
                // Reset positions of child nodes
                newNodes = prevData.nodes.map(node => {
                    if ((groupData.children || []).includes(node.id)) {
                        return { ...node, x: undefined, y: undefined };
                    }
                    return node;
                });
                
                // Reset positions of child groups recursively
                const resetChildGroupPositions = (groupId: string, visited: Set<string> = new Set()) => {
                    if (visited.has(groupId)) {
                        return; // Prevent infinite recursion
                    }
                    visited.add(groupId);
                    
                    newGroups = newGroups.map(g => {
                        if (g.id === groupId) {
                            return { ...g, x: undefined, y: undefined };
                        }
                        return g;
                    });
                    
                    // Recursively reset children of this group
                    const group = newGroups.find(g => g.id === groupId);
                    if (group && group.children) {
                        group.children.forEach((childId: string) => {
                            const childGroup = newGroups.find(g => g.id === childId);
                            if (childGroup) {
                                resetChildGroupPositions(childId, visited);
                            }
                        });
                    }
                };
                
                (groupData.children || []).forEach((nodeId: string) => {
                    const childGroup = newGroups.find(g => g.id === nodeId);
                    if (childGroup) {
                        resetChildGroupPositions(nodeId);
                    }
                });
            }
            
            return {
                ...prevData,
                groups: newGroups,
                nodes: newNodes
            };
        });
    } else {
        setDiagramData(prevData => ({
            ...prevData,
            nodes: prevData.nodes.map(n => n.id === updatedItem.id ? (updatedItem as DiagramNodeData) : n)
        }));
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

  const handleItemDelete = (itemToDelete: SelectedItem) => {
    setDiagramData(prevData => {
      let newNodes = prevData.nodes;
      let newGroups = prevData.groups || [];
      let newConnections = prevData.connections;

      if (itemToDelete.itemType === 'node') {
        newNodes = prevData.nodes.filter(n => n.id !== itemToDelete.id);
        newConnections = prevData.connections.filter((e: any) => e.from !== itemToDelete.id && e.to !== itemToDelete.id);
      } else if (itemToDelete.itemType === 'group') {
        newGroups = newGroups.filter(g => g.id !== itemToDelete.id);
        // Also remove nodes that were inside the group if desired, or re-parent them.
        // For simplicity, we'll just remove the group for now. Any nodes inside become "homeless".
      } else if (itemToDelete.itemType === 'edge') {
        // Delete the connection/edge
        newConnections = prevData.connections.filter((e: any) => 
          !(e.from === itemToDelete.from && e.to === itemToDelete.to)
        );
      }

      // Also remove the deleted item from any group's node list
      newGroups = newGroups.map(g => ({
        ...g,
        children: (g.children || []).filter((nodeId: string) => nodeId !== itemToDelete.id)
      }));

      return { ...prevData, nodes: newNodes, groups: newGroups, connections: newConnections };
    });
    setSelectedItem(null); // Deselect after deleting
  };

  const handleConnect = (targetItem: DiagramNodeData | DiagramGroupData) => {
    if (!isConnectMode || !selectedItem || (selectedItem.itemType !== 'node' && selectedItem.itemType !== 'group') || selectedItem.id === targetItem.id) {
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
    if (selectedItem && (selectedItem.itemType === 'node' || selectedItem.itemType === 'group')) {
      setIsConnectMode(true);
      // Store connection options for use when connection is created
      (window as any).pendingConnectionOptions = connectionOptions;
    }
  }

  const disconnectSelected = () => {
    if (!selectedItem || (selectedItem.itemType !== 'node' && selectedItem.itemType !== 'group')) return;
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
            const isHierarchical = jsonData.groups && Array.isArray(jsonData.groups) &&
              jsonData.groups.some((group: any) => group.children && Array.isArray(group.children) &&
                group.children.some((child: any) => child && typeof child === 'object'));

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
                groups: jsonData.groups || [],
                rootGroupId: jsonData.rootGroupId
              };
               // Clear existing data first to ensure clean load
               setDiagramData({ nodes: [], connections: [], groups: [] });
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
    setSelectedItem(null); // Deselect to avoid stale references
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
      
      // Arrow keys - Move selected node by 10px grid (up to 150), then 30px increments
      if ((e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') && selectedItem && selectedItem.itemType !== 'edge') {
        e.preventDefault();
        // Custom snap function: snaps to 10px increments up to 150, then 30px increments (150, 180, 210, etc.)
        const snapToGrid = (v: number): number => {
          if (v <= 150) {
            return Math.round(v / 10) * 10;
          } else {
            return Math.round((v - 150) / 30) * 30 + 150;
          }
        };
        
        const gridSize = 10; // Use 10px for arrow key movement
        let newX = (selectedItem as any).x || 0;
        let newY = (selectedItem as any).y || 0;
        
        switch (e.key) {
          case 'ArrowUp':
            newY -= gridSize;
            break;
          case 'ArrowDown':
            newY += gridSize;
            break;
          case 'ArrowLeft':
            newX -= gridSize;
            break;
          case 'ArrowRight':
            newX += gridSize;
            break;
        }
        
        // Snap to grid after movement
        newX = snapToGrid(newX);
        newY = snapToGrid(newY);
        
        // Update node position through proper callback
        if (selectedItem.itemType === 'node') {
          setDiagramData(prevData => ({
            ...prevData,
            nodes: prevData.nodes.map(n => 
              n.id === selectedItem.id ? { ...n, x: newX, y: newY } : n
            )
          }));
        } else if (selectedItem.itemType === 'group') {
          setDiagramData(prevData => ({
            ...prevData,
            groups: (prevData.groups || []).map(g => 
              g.id === selectedItem.id ? { ...g, x: newX, y: newY } : g
            )
          }));
        }
        
        // Update selected item state
        setSelectedItem({ ...selectedItem, x: newX, y: newY } as any);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [jsonPanelOpen, historyIndex, history, selectedItem]);

  // Persist panel width
  React.useEffect(() => {
    if (isClient) {
      localStorage.setItem('dw:jsonEditor:width', String(jsonPanelWidth));
    }
  }, [jsonPanelWidth, isClient]);


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
           onFitToView={() => editorRef.current?.fitToView()}
           onToggleJsonPanel={toggleJsonPanel}
           jsonPanelOpen={jsonPanelOpen}
           onConnectionUpdate={handleConnectionUpdate}
           onConnectionDisconnect={disconnectConnection}
           onCloseSidebar={() => setSidebarOpen(false)}
           isMobile={isMobile}
           transform={canvasTransform}
           onTransformChange={setCanvasTransform}
          onResourceSelect={(resource, provider, category) => {
            // NEVER add file or imagePath to node data
            // ResourceIcon will derive path from type and resource catalog
            const nodeType = `${provider}.${category}.${resource.name.replace(/\s+/g, '-').toLowerCase()}`;
             setDiagramData(prevData => {
               const newNode = {
                 id: generateSequentialId(nodeType, prevData),
                 type: nodeType,
                 label: resource.name,
                 info: `${resource.name} from ${provider}`,
                 x: 100 + Math.random() * 200,
                 y: 100 + Math.random() * 200,
               };
               return {
                 ...prevData,
                 nodes: [...prevData.nodes, newNode]
               };
             });
            toast({ title: 'Resource Added', description: `${resource.name} has been added to the diagram.` });
          }}
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
        
        <main className={`flex-1 flex flex-col ${isMobile ? 'w-full' : ''} ${isMobile && sidebarOpen ? 'pointer-events-none' : ''}`}>
            <header className="flex flex-col border-b bg-card">
                <TopMenuBar
                    onNew={handleNew}
                    onLoad={handleLoadClick}
                    onSave={handleSave}
                    onNewTab={createTab}
                    onExportSvg={handleExportSvg}
                    onToggleJsonPanel={toggleJsonPanel}
                    jsonPanelOpen={jsonPanelOpen}
                    onFitToView={() => editorRef.current?.fitToView()}
                    onCopy={() => editorRef.current?.copy()}
                    onPaste={() => editorRef.current?.paste()}
                    canPaste={canPaste}
                    onUndo={undo}
                    onRedo={redo}
                    canUndo={historyIndex > 0}
                    canRedo={historyIndex < history.length - 1}
                    transform={canvasTransform}
                    onTransformChange={setCanvasTransform}
                    selectedItem={selectedItem}
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
                    diagramData={diagramData}
                    mousePosition={mousePosition}
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
                <div className="flex flex-1">
                  <div className={`flex-1 h-full ${jsonPanelOpen ? 'mr-2' : ''}`}>
                <EditorCanvas 
                    ref={editorRef}
                    diagramData={diagramData} 
                    setDiagramData={setDiagramData}
                    onItemSelect={handleItemSelect}
                    selectedItemId={selectedItem?.id}
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
                    onClipboardChange={setCanPaste}
                    onMousePositionChange={setMousePosition}
                    onSelectionChange={setSelectionCoordinates}
                    onExportComplete={() => setExportDialogOpen(false)}
                    />
                  </div>
                  
                  <JsonEditorPanel
                    value={diagramData}
                    onValidJsonChange={handleJsonValidChange}
                    isOpen={jsonPanelOpen}
                    onToggleOpen={toggleJsonPanel}
                    widthPx={400}
                  />
                </div>
            </div>
        </main>
        <ExportDialog
          open={exportDialogOpen}
          onOpenChange={setExportDialogOpen}
          onExport={handleExport}
          selectionCoordinates={selectionCoordinates}
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
