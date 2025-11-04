"use client";
import React from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Panel, PanelGroup } from 'react-resizable-panels';
import { ComponentSidebar } from './editor/component-sidebar';
import { EditorCanvas, type EditorCanvasHandle } from './editor/editor-canvas';
import { JsonEditorPanel } from './editor/json-editor-panel';
import type { DiagramData, DiagramNodeData, DiagramGroupData, DiagramConnectionData } from '@/lib/types';
import { generateSequentialId } from '@/lib/id-generator';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { convertFromNestedHierarchy, convertToNestedHierarchy } from '@/lib/nested-hierarchy';

export type SelectedItem = ((DiagramNodeData | DiagramGroupData) & { 
  itemType: 'node' | 'group', 
  subType?: 'zone' | 'group',
  borderColor?: string,
  textColor?: string,
  backgroundColor?: string,
  borderStyle?: 'solid' | 'gradient';
  borderColors?: string[];
  backgroundStyle?: 'solid' | 'gradient';
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
  const [diagramData, setDiagramData] = React.useState<DiagramData>({ nodes: [], connections: [], groups: [] });
  const [history, setHistory] = React.useState<DiagramData[]>([{ nodes: [], connections: [], groups: [] }]);
  const [historyIndex, setHistoryIndex] = React.useState<number>(0);
  const editorRef = React.useRef<EditorCanvasHandle>(null);
  const [selectedItem, setSelectedItem] = React.useState<SelectedItem | null>(null);
  const [selectedItemIds, setSelectedItemIds] = React.useState<Set<string>>(new Set());
  const [isConnectMode, setIsConnectMode] = React.useState<boolean>(false);
  const [jsonPanelOpen, setJsonPanelOpen] = React.useState<boolean>(false);
  const [jsonPanelWidth, setJsonPanelWidth] = React.useState<number>(420);
  const [isClient, setIsClient] = React.useState<boolean>(false);
  const [sidebarOpen, setSidebarOpen] = React.useState<boolean>(false);
  const [canvasTransform, setCanvasTransform] = React.useState<{ x: number; y: number; k: number }>({ x: 0, y: 0, k: 1 });
  const isMobile = useIsMobile();

  // History management functions
  const addToHistory = (newData: DiagramData) => {
    setHistory(prevHistory => {
      const newHistory = prevHistory.slice(0, historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(newData)));
      // Keep only last 10 states
      if (newHistory.length > 10) {
        newHistory.shift();
        return newHistory;
      }
      return newHistory;
    });
    setHistoryIndex(prev => Math.min(prev + 1, 9));
  };

  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setDiagramData(JSON.parse(JSON.stringify(history[newIndex])));
      setSelectedItem(null);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setDiagramData(JSON.parse(JSON.stringify(history[newIndex])));
      setSelectedItem(null);
    }
  };

  // Wrapper function for setDiagramData that also manages history
  const updateDiagramData = (newData: DiagramData | ((prev: DiagramData) => DiagramData)) => {
    setDiagramData(prevData => {
      const updatedData = typeof newData === 'function' ? newData(prevData) : newData;
      addToHistory(updatedData);
      return updatedData;
    });
  };

  // Initialize client-side state after hydration
  React.useEffect(() => {
    setIsClient(true);
    const savedOpen = localStorage.getItem('dw:jsonEditor:open');
    const savedWidth = localStorage.getItem('dw:jsonEditor:width');
    
    if (savedOpen !== null) {
      setJsonPanelOpen(savedOpen === 'true');
    }
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
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();


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
        updateDiagramData(prevData => {
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
        updateDiagramData(prevData => ({
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
    updateDiagramData(prevData => ({
      ...prevData,
      nodes: prevData.nodes.map(n => n.id === nodeId ? { ...n, label: newLabel } : n)
    }));

    // Also update the selected item if it's the one being edited
    if (selectedItem?.id === nodeId && selectedItem.itemType === 'node') {
      setSelectedItem({ ...selectedItem, label: newLabel });
    }
  }

  const handleItemDelete = (itemToDelete: SelectedItem) => {
    updateDiagramData(prevData => {
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
      updateDiagramData(prevData => ({
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
    updateDiagramData(prevData => ({
      ...prevData,
      connections: prevData.connections.filter((e: any) => e.from !== id && e.to !== id),
    }));
    toast({ title: 'Disconnected', description: 'All connections to/from this item have been removed.' });
  };
  
  const handleSave = async () => {
    const nestedData = convertToNestedHierarchy(diagramData);
    const jsonString = JSON.stringify(nestedData, null, 2);

    // Try to use the File System Access API if available (Chromium browsers)
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: 'diagram.json',
          types: [{
            description: 'JSON Files',
            accept: { 'application/json': ['.json'] }
          }]
        });
        const writable = await handle.createWritable();
        await writable.write(jsonString);
        await writable.close();
        toast({ title: 'Diagram Saved', description: 'Your diagram has been saved successfully.' });
        return;
      } catch (error) {
        // User cancelled or API failed, fall back to download
        console.log('File System Access API failed, falling back to download:', error);
      }
    }

    // Fallback: automatic download
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'diagram.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: 'Diagram Saved', description: 'Your diagram has been downloaded as diagram.json.' });
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
                 updateDiagramData(completeData);
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

  const handleConnectionUpdate = (from: string, to: string, updates: { text?: string; color?: string; style?: 'pathways' | 'bezier'; curvature?: number; fromPreferredExit?: 'top' | 'bottom' | 'left' | 'right' | 'center'; fromArrow?: boolean; toPreferredEntry?: 'top' | 'bottom' | 'left' | 'right' | 'center'; toArrow?: boolean }) => {
    updateDiagramData(prevData => ({
      ...prevData,
      connections: prevData.connections.map(conn => 
        (conn.from === from && conn.to === to) 
          ? { ...conn, ...updates }
          : conn
      )
    }));
  };

  const handleNew = () => {
    updateDiagramData({ nodes: [], connections: [], groups: [] });
    setSelectedItem(null);
    toast({ title: 'New Diagram', description: 'Diagram has been cleared.' });
  };

  const handleJsonValidChange = (newDiagramData: DiagramData) => {
    updateDiagramData(newDiagramData);
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
      
      // Ctrl+Shift+J (or Cmd+Shift+J on Mac) - Toggle JSON Panel
      if ((isMac ? e.metaKey : e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        toggleJsonPanel();
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
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [jsonPanelOpen, historyIndex, history]);

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
           onSave={handleSave}
           onLoad={handleLoadClick}
           onNew={handleNew}
           onFitToView={() => editorRef.current?.fitToView()}
           onExportPng={() => editorRef.current?.exportPng()}
           onToggleJsonPanel={toggleJsonPanel}
           jsonPanelOpen={jsonPanelOpen}
           onConnectionUpdate={handleConnectionUpdate}
           onCloseSidebar={() => setSidebarOpen(false)}
           isMobile={isMobile}
           transform={canvasTransform}
           onTransformChange={setCanvasTransform}
           onUndo={undo}
           onRedo={redo}
           canUndo={historyIndex > 0}
           canRedo={historyIndex < history.length - 1}
          onResourceSelect={(resource, provider, category) => {
            // NEVER add file or imagePath to node data
            // ResourceIcon will derive path from type and resource catalog
            const nodeType = `${provider}.${category}.${resource.name.replace(/\s+/g, '-').toLowerCase()}`;
             updateDiagramData(prevData => {
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
            <header className="flex items-center justify-center p-4 border-b bg-card">
                <h1 className="text-2xl font-headline font-bold text-primary">Diagram Weaver</h1>
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
                                 updateDiagramData(prevData => ({
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
      </div>
    </DndProvider>
  );
}
