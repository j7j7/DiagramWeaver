"use client";
import React from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { ComponentSidebar } from './editor/component-sidebar';
import { EditorCanvas } from './editor/editor-canvas';
import type { DiagramData, DiagramNodeData, DiagramGroupData, DiagramEdgeData } from '@/lib/types';
import sampleDiagram from '@/lib/sample-diagram.json';
import { useToast } from '@/hooks/use-toast';

export type SelectedItem = (DiagramNodeData | DiagramGroupData) & { type: 'node' | 'group', subType?: 'zone' | 'group' };

export default function DiagramEditor() {
  const [diagramData, setDiagramData] = React.useState<DiagramData>(sampleDiagram);
  const [selectedItem, setSelectedItem] = React.useState<SelectedItem | null>(null);
  const [isConnectMode, setIsConnectMode] = React.useState<boolean>(false);
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
    if (updatedItem.type === 'group') {
        setDiagramData(prevData => ({
            ...prevData,
            groups: (prevData.groups || []).map(g => g.id === updatedItem.id ? (updatedItem as DiagramGroupData) : g)
        }));
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

      if (itemToDelete.type === 'node') {
        newNodes = prevData.nodes.filter(n => n.id !== itemToDelete.id);
        newEdges = prevData.edges.filter(e => e.from !== itemToDelete.id && e.to !== itemToDelete.id);
      } else if (itemToDelete.type === 'group') {
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

  const handleConnect = (targetNode: DiagramNodeData) => {
    if (!isConnectMode || !selectedItem || selectedItem.type !== 'node' || selectedItem.id === targetNode.id) {
      setIsConnectMode(false);
      return;
    }

    const newEdge: DiagramEdgeData = { from: selectedItem.id, to: targetNode.id };
    
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
    if (selectedItem && selectedItem.type === 'node') {
      setIsConnectMode(true);
    }
  }

  const disconnectSelected = () => {
    if (!selectedItem || selectedItem.type !== 'node') return;
    const id = selectedItem.id;
    setDiagramData(prevData => ({
      ...prevData,
      edges: prevData.edges.filter(e => e.from !== id && e.to !== id),
    }));
    toast({ title: 'Disconnected', description: 'All connections to/from this node have been removed.' });
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
        />
        <main className="flex-1 flex flex-col">
            <header className="flex items-center justify-between p-4 border-b">
                <h1 className="text-2xl font-headline font-bold">Diagram Weaver</h1>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="application/json"
                    style={{ display: 'none' }}
                />
            </header>
            <div className="flex-1 relative">
                <EditorCanvas 
                    diagramData={diagramData} 
                    setDiagramData={setDiagramData}
                    onItemSelect={handleItemSelect}
                    selectedItemId={selectedItem?.id}
                    isConnectMode={isConnectMode}
                    onNodeClickInConnectMode={handleConnect}
                />
            </div>
        </main>
      </div>
    </DndProvider>
  );
}
