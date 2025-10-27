"use client";
import React from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { ComponentSidebar } from './editor/component-sidebar';
import { EditorCanvas } from './editor/editor-canvas';
import { JsonEditorPanel } from './editor/json-editor-panel';
import type { DiagramData, DiagramNodeData, DiagramGroupData, DiagramEdgeData } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

export type SelectedItem = (DiagramNodeData | DiagramGroupData) & { 
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
  shadow?: boolean
};

export default function DiagramEditor() {
  const [diagramData, setDiagramData] = React.useState<DiagramData>({ nodes: [], edges: [], groups: [] });
  const [selectedItem, setSelectedItem] = React.useState<SelectedItem | null>(null);
  const [isConnectMode, setIsConnectMode] = React.useState<boolean>(false);
  const [jsonPanelOpen, setJsonPanelOpen] = React.useState<boolean>(false);
  const [jsonPanelWidth, setJsonPanelWidth] = React.useState<number>(420);
  const [isClient, setIsClient] = React.useState<boolean>(false);

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
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();


  const handleItemSelect = (item: SelectedItem | null) => {
    // If we click away while in connect mode, cancel it.
    if (isConnectMode && !item) {
      setIsConnectMode(false);
    }
    setSelectedItem(item);
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
                    if (groupData.nodes.includes(node.id)) {
                        return { ...node, x: undefined, y: undefined };
                    }
                    return node;
                });
                
                // Reset positions of child groups recursively
                const resetChildGroupPositions = (groupId: string) => {
                    newGroups = newGroups.map(g => {
                        if (g.id === groupId) {
                            return { ...g, x: undefined, y: undefined };
                        }
                        return g;
                    });
                    
                    // Recursively reset children of this group
                    const group = newGroups.find(g => g.id === groupId);
                    if (group) {
                        group.nodes.forEach(childId => {
                            const childGroup = newGroups.find(g => g.id === childId);
                            if (childGroup) {
                                resetChildGroupPositions(childId);
                            }
                        });
                    }
                };
                
                groupData.nodes.forEach(nodeId => {
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

  const handleItemDelete = (itemToDelete: SelectedItem) => {
    setDiagramData(prevData => {
      let newNodes = prevData.nodes;
      let newGroups = prevData.groups || [];
      let newEdges = prevData.edges;

      if (itemToDelete.itemType === 'node') {
        newNodes = prevData.nodes.filter(n => n.id !== itemToDelete.id);
        newEdges = prevData.edges.filter(e => e.from !== itemToDelete.id && e.to !== itemToDelete.id);
      } else if (itemToDelete.itemType === 'group') {
        newGroups = newGroups.filter(g => g.id !== itemToDelete.id);
        // Also remove nodes that were inside the group if desired, or re-parent them.
        // For simplicity, we'll just remove the group for now. Any nodes inside become "homeless".
      }

      // Also remove the deleted item from any group's node list
      newGroups = newGroups.map(g => ({
        ...g,
        nodes: g.nodes.filter(nodeId => nodeId !== itemToDelete.id)
      }));

      return { ...prevData, nodes: newNodes, groups: newGroups, edges: newEdges };
    });
    setSelectedItem(null); // Deselect after deleting
  };

  const handleConnect = (targetItem: DiagramNodeData | DiagramGroupData) => {
    if (!isConnectMode || !selectedItem || (selectedItem.itemType !== 'node' && selectedItem.itemType !== 'group') || selectedItem.id === targetItem.id) {
      setIsConnectMode(false);
      return;
    }

    const newEdge: DiagramEdgeData = { from: selectedItem.id, to: targetItem.id };
    
    // Avoid creating duplicate edges
    const edgeExists = diagramData.edges.some(
      edge => (edge.from === newEdge.from && edge.to === newEdge.to)
    );

    if (!edgeExists) {
      setDiagramData(prevData => ({
        ...prevData,
        edges: [...prevData.edges, newEdge]
      }));
    }
    
    setIsConnectMode(false);
    setSelectedItem(null); // Deselect after connecting
  };

  const startConnecting = () => {
    if (selectedItem && (selectedItem.itemType === 'node' || selectedItem.itemType === 'group')) {
      setIsConnectMode(true);
    }
  }

  const disconnectSelected = () => {
    if (!selectedItem || (selectedItem.itemType !== 'node' && selectedItem.itemType !== 'group')) return;
    const id = selectedItem.id;
    setDiagramData(prevData => ({
      ...prevData,
      edges: prevData.edges.filter(e => e.from !== id && e.to !== id),
    }));
    toast({ title: 'Disconnected', description: 'All connections to/from this item have been removed.' });
  };
  
  const handleSave = () => {
    const jsonString = JSON.stringify(diagramData, null, 2);
    
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'diagram.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: 'Diagram Saved', description: 'Your diagram has been saved as diagram.json.' });
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
            const jsonData = JSON.parse(text);
            // Add basic validation for the loaded data
            if (jsonData.nodes && jsonData.edges) {
              setDiagramData(jsonData);
              setSelectedItem(null);
              toast({ title: 'Diagram Loaded', description: 'Your diagram has been successfully loaded.' });
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

  const handleNew = () => {
    setDiagramData({ nodes: [], edges: [], groups: [] });
    setSelectedItem(null);
    toast({ title: 'New Diagram', description: 'Diagram has been cleared.' });
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

  // Keyboard shortcut: Ctrl+Shift+J (or Cmd+Shift+J on Mac)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      if ((isMac ? e.metaKey : e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        toggleJsonPanel();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [jsonPanelOpen]);

  // Persist panel width
  React.useEffect(() => {
    if (isClient) {
      localStorage.setItem('dw:jsonEditor:width', String(jsonPanelWidth));
    }
  }, [jsonPanelWidth, isClient]);


  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex h-screen w-screen bg-background text-foreground font-body">
        <ComponentSidebar
          selectedItem={selectedItem}
          onItemUpdate={handleItemUpdate}
          onConnect={startConnecting}
          onDisconnect={disconnectSelected}
          onItemDelete={handleItemDelete}
          diagramData={diagramData}
          onSave={handleSave}
          onLoad={handleLoadClick}
          onNew={handleNew}
          onResourceSelect={(resource, provider, category) => {
            // Add the resource to the diagram at a default position
            const nodeType = `${provider}.${category}.${resource.name.replace(/\s+/g, '-').toLowerCase()}`;
            const newNode = {
              id: `${nodeType.replace(/[^a-zA-Z0-9-]/g, '-')}-${Date.now()}`,
              type: nodeType,
              label: resource.name,
              info: `${resource.name} from ${provider}`,
              x: 100 + Math.random() * 200, // Random position to avoid overlap
              y: 100 + Math.random() * 200,
            };
            setDiagramData(prevData => ({
              ...prevData,
              nodes: [...prevData.nodes, newNode]
            }));
            toast({ title: 'Resource Added', description: `${resource.name} has been added to the diagram.` });
          }}
        />
        <main className="flex-1 flex flex-col">
            <header className="flex items-center justify-between p-4 border-b">
                <h1 className="text-2xl font-headline font-bold">Diagram Weaver</h1>
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleJsonPanel}
                    className="text-sm px-3 py-1.5 rounded border hover:bg-accent transition-colors"
                    title="Toggle JSON Editor (Ctrl+Shift+J)"
                  >
                    {jsonPanelOpen ? 'Hide JSON' : 'Show JSON'}
                  </button>
                </div>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="application/json"
                    style={{ display: 'none' }}
                />
            </header>
            <div className="flex-1">
                <PanelGroup direction="horizontal" className="h-full">
                  <Panel defaultSize={jsonPanelOpen ? 75 : 100} minSize={30}>
                    <EditorCanvas 
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
                                    edges: prevData.edges?.filter(e => e.from !== selectedItem.id && e.to !== selectedItem.id) || []
                                }));
                                toast({
                                    title: "Connections Disconnected",
                                    description: "All connections from the selected item have been removed.",
                                });
                            }
                        }}
                    />
                  </Panel>
                  
                  {jsonPanelOpen && (
                    <>
                      <PanelResizeHandle className="w-1 bg-border hover:bg-accent cursor-col-resize transition-colors" />
                      <Panel 
                        defaultSize={25} 
                        minSize={15} 
                        maxSize={50}
                        onResize={(size) => {
                          // Convert panel percentage to pixels (approximate)
                          const panelWidth = Math.round((size / 100) * window.innerWidth);
                          setJsonPanelWidth(panelWidth);
                        }}
                      >
                        <JsonEditorPanel
                          value={diagramData}
                          onValidJsonChange={handleJsonValidChange}
                          isOpen={jsonPanelOpen}
                          onToggleOpen={toggleJsonPanel}
                          widthPx={jsonPanelWidth}
                        />
                      </Panel>
                    </>
                  )}
                  
                  {!jsonPanelOpen && (
                    <JsonEditorPanel
                      value={diagramData}
                      onValidJsonChange={handleJsonValidChange}
                      isOpen={jsonPanelOpen}
                      onToggleOpen={toggleJsonPanel}
                      widthPx={0}
                    />
                  )}
                </PanelGroup>
            </div>
        </main>
      </div>
    </DndProvider>
  );
}
