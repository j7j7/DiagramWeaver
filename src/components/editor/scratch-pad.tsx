"use client";
import React, { useState, useEffect, useMemo } from 'react';
import Draggable from 'react-draggable';
import { useDrop, useDrag } from 'react-dnd';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Check, Edit2, Trash2 } from 'lucide-react';
import { DraggableItem, ItemTypes } from './draggable-item';
import type { DiagramData, ScratchPadItem } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TextStylingPanel } from './text-styling-panel';
import { VisualStylingPanel } from './visual-styling-panel';
import { processImportedItems, getResourcePath } from '@/lib/resource-mapping';
import { ResourceIcon } from '@/components/diagram/resource-icon';
import { ShapePreview } from './shape-preview';
import { Card, CardContent } from '@/components/ui/card';

interface ScratchPadProps {
  isOpen: boolean;
  onClose: () => void;
  diagramData: DiagramData;
}

export function ScratchPad({ isOpen, onClose, diagramData }: ScratchPadProps) {

// Load favorites from localStorage (client-side only) - use initializer
  const [favorites, setFavorites] = useState<ScratchPadItem[]>(() => {
    if (typeof window !== 'undefined') {
      const savedFavorites = localStorage.getItem('dw:scratchpad:favorites');
      if (savedFavorites) {
        try {
          const parsed = JSON.parse(savedFavorites);
          console.log('[ScratchPad] Loaded favorites from localStorage on mount:', parsed);
          return parsed;
        } catch (e) {
          console.error('Failed to load favorites', e);
        }
      }
    }
    return [];
  });

  // Load imports from localStorage (client-side only) - use initializer
  const [imports, setImports] = useState<ScratchPadItem[]>(() => {
    if (typeof window !== 'undefined') {
      const savedImports = localStorage.getItem('dw:scratchpad:imports');
      if (savedImports) {
        try {
          const parsed = JSON.parse(savedImports);
          console.log('[ScratchPad] Loaded imports from localStorage on mount:', parsed);
          return parsed;
        } catch (e) {
          console.error('Failed to load imports', e);
        }
      }
    }
    return [];
  });
  
  const [activeTab, setActiveTab] = useState('favorites');
  const [editingItem, setEditingItem] = useState<ScratchPadItem | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Save favorites to localStorage (client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        console.log('[ScratchPad] Saving favorites to localStorage:', favorites);
        localStorage.setItem('dw:scratchpad:favorites', JSON.stringify(favorites));
      } catch (e) {
        console.error('Failed to save favorites to localStorage', e);
      }
    }
  }, [favorites]);

  // Save imports to localStorage (client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('dw:scratchpad:imports', JSON.stringify(imports));
      } catch (e) {
        console.error('Failed to save imports to localStorage', e);
      }
    }
  }, [imports]);

  const [{ isOver }, drop] = useDrop(() => ({
    accept: [ItemTypes.DIAGRAM_NODE, ItemTypes.CANVAS_NODE],
    drop: (item: any) => {
      // Check if this is a canvas item (has id and position properties)
      const isCanvasItem = item.id && (item.x !== undefined || item.y !== undefined);
      
      // Handle zones with children or nodes - create favorites for each child node
      const zoneChildren = item.children || item.nodes;
      if (isCanvasItem && item.type === 'zone' && zoneChildren && Array.isArray(zoneChildren)) {
        // Create favorites for each child node in the zone
        const newFavorites = zoneChildren.map((child: any, index: number) => {
          // Use originalType if available (for canvas items in zones), otherwise use type
          const childType = child.originalType || child.type || 'generic.object.square';
          return {
            id: `scratchpad-${Date.now()}-${index}`,
            label: child.label || 'New Item',
            type: childType,
            // Preserve ALL visual properties from child node
            data: {
              borderColor: child.borderColor,
              backgroundColor: child.backgroundColor,
              textColor: child.textColor,
              borderStyle: child.borderStyle,
              borderColors: child.borderColors,
              backgroundStyle: child.backgroundStyle,
              backgroundColors: child.backgroundColors,
              gradientAngle: child.gradientAngle,
              shadow: child.shadow,
              rotation: child.rotation,
              textPosition: child.textPosition,
              freeflow: child.freeflow,
              borderWidth: child.borderWidth,
              objectStyle: child.objectStyle,
              width: child.width,
              height: child.height,
              sizeMode: child.sizeMode,
              noIconBackground: child.noIconBackground,
              textJustify: child.textJustify,
              textVerticalPosition: child.textVerticalPosition,
              fontFamily: child.fontFamily,
              fontSize: child.fontSize,
              fontWeight: child.fontWeight,
              fontStyle: child.fontStyle,
              textDecoration: child.textDecoration,
              textTransform: child.textTransform,
              letterSpacing: child.letterSpacing,
              lineHeight: child.lineHeight,
              textOpacity: child.textOpacity,
              // Resource info for icon rendering
              ...(child.provider && { provider: child.provider }),
              ...(child.category && { category: child.category }),
              ...(child.file && { file: child.file }),
              ...(child.info && { info: child.info }),
              ...(child.importId && { importId: child.importId }),
            },
            isFavorite: true,
            // Store important properties at item level for access
            ...(child.objectType && { objectType: child.objectType }),
            ...(child.importId && { importId: child.importId }),
            ...(child.provider && { provider: child.provider }),
            ...(child.category && { category: child.category }),
            ...(child.file && { file: child.file }),
          };
        });
        setFavorites(prev => [...prev, ...newFavorites]);
        return;
      }
      
      // For individual canvas items, use the original node type, not the ItemTypes constant
      // Use originalType if available (for canvas items), otherwise use type
      const itemType = isCanvasItem ? (item.originalType || item.type) : item.type;
      
      const newItem: ScratchPadItem = {
        id: `scratchpad-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        label: item.label || 'New Item',
        type: itemType,
        // For canvas items, preserve ALL visual properties in data
        data: isCanvasItem ? { 
          // Include ALL visual properties from canvas item
          borderColor: item.borderColor,
          backgroundColor: item.backgroundColor,
          textColor: item.textColor,
          borderStyle: item.borderStyle,
          borderColors: item.borderColors,
          backgroundStyle: item.backgroundStyle,
          backgroundColors: item.backgroundColors,
          gradientAngle: item.gradientAngle,
          shadow: item.shadow,
          rotation: item.rotation,
          textPosition: item.textPosition,
          freeflow: item.freeflow,
          borderWidth: item.borderWidth,
          objectStyle: item.objectStyle,
          width: item.width,
          height: item.height,
          sizeMode: item.sizeMode,
          noIconBackground: item.noIconBackground,
          textJustify: item.textJustify,
          textVerticalPosition: item.textVerticalPosition,
          fontFamily: item.fontFamily,
          fontSize: item.fontSize,
          fontWeight: item.fontWeight,
          fontStyle: item.fontStyle,
          textDecoration: item.textDecoration,
          textTransform: item.textTransform,
          letterSpacing: item.letterSpacing,
          lineHeight: item.lineHeight,
          textOpacity: item.textOpacity,
          // Resource info for icon rendering
          ...(item.provider && { provider: item.provider }),
          ...(item.category && { category: item.category }),
          ...(item.file && { file: item.file }),
          ...(item.info && { info: item.info }),
          ...(item.importId && { importId: item.importId }),
        } : { ...item }, // For non-canvas items, keep original structure
        isFavorite: true,
        // Store important properties at item level for access
        ...(item.objectType && { objectType: item.objectType }),
        ...(item.importId && { importId: item.importId }),
        ...(item.provider && { provider: item.provider }),
        ...(item.category && { category: item.category }),
        ...(item.file && { file: item.file }),
      };
      console.log('[ScratchPad] Adding new item to favorites:', newItem);
      setFavorites(prev => [...prev, newItem]);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }));

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (Array.isArray(json)) {
          const newImports = await processImportedItems(json);
          
          // Filter out items that already exist (by name and type combination)
          setImports(prev => {
            const existingKeys = prev.map(item => `${item.label}-${item.type}`);
            const filteredNewImports = newImports.filter(newItem => 
              !existingKeys.includes(`${newItem.label}-${newItem.type}`)
            );
            return [...prev, ...filteredNewImports];
          });
        }
      } catch (err) {
        console.error('Failed to parse import', err);
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  const updateFavorite = (id: string, updates: Partial<ScratchPadItem>) => {
    setFavorites(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const deleteFavorite = (id: string) => {
    setFavorites(prev => prev.filter(item => item.id !== id));
  };
  
  const deleteImport = (id: string) => {
      setImports(prev => prev.filter(item => item.id !== id));
  }

  const clearFavorites = () => {
    setFavorites([]);
  }

  const clearImports = () => {
    setImports([]);
  }

  const handleEditClick = (item: ScratchPadItem) => {
    setEditingItem(item);
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (editingItem) {
        updateFavorite(editingItem.id, { 
            label: editingItem.label,
            data: editingItem.data
        });
        setIsEditDialogOpen(false);
        setEditingItem(null);
    }
  };

// Component for rendering draggable shape items directly (not wrapped in DraggableItem)
const DraggableShape = ({ item, data }: { item: ScratchPadItem; data: any }) => {
  const itemData = item.data || {};
  // Get original canvas dimensions
  const originalWidth = itemData.width || 60;
  const originalHeight = itemData.height || 60;
  
  // Display at 50% size on scratchpad to match other items
  const displayWidth = originalWidth * 0.5;
  const displayHeight = originalHeight * 0.5;
  
  // Create drag item with ALL properties preserved
  const dragItem = useMemo(() => ({
    type: item.type, // Use the actual shape type, not ItemTypes.DIAGRAM_NODE
    label: item.label,
    ...data, // This includes all visual properties
    fromScratchPad: true,
  }), [item.type, item.label, data]);
  
  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.DIAGRAM_NODE,
    item: dragItem,
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }), [dragItem]);
  
  console.log('[ScratchPad] Draggable shape item:', dragItem);
  
  return (
    <div
      ref={(node) => {
        if (node) drag(node);
      }}
      style={{ opacity: isDragging ? 0.5 : 1 }}
      className="cursor-move"
    >
      <Card className="hover:bg-accent hover:text-accent-foreground transition-colors">
        <CardContent className="p-3 flex flex-col items-center justify-center gap-2 text-center min-h-24">
          <ShapePreview
            type={item.type}
            width={displayWidth}
            height={displayHeight}
            backgroundColor={itemData.backgroundColor}
            borderColor={itemData.borderColor}
            strokeWidth={(itemData.borderWidth || 2) * 0.5}
            borderStyle={itemData.borderStyle}
            backgroundStyle={itemData.backgroundStyle}
            backgroundColors={itemData.backgroundColors}
            borderColors={itemData.borderColors}
            gradientAngle={itemData.gradientAngle}
            label={item.label}
            textColor={itemData.textColor}
            fontFamily={itemData.fontFamily}
            fontSize={8}
            fontWeight={itemData.fontWeight}
            fontStyle={itemData.fontStyle}
            textDecoration={itemData.textDecoration}
            shadow={itemData.shadow}
          />
        </CardContent>
      </Card>
    </div>
  );
};

const renderIcon = (item: ScratchPadItem) => {
    // For items with resource mapping (cloud resources), use image path
    const resourcePath = getResourcePath(item as any);
    if (resourcePath) {
        return <img src={resourcePath} className="w-6 h-6 object-contain" alt={item.label} />;
    }
    
    // For other items, use ResourceIcon component
    return (
        <ResourceIcon 
            type={item.type} 
            width={24} 
            height={24}
            provider={item.data?.provider}
            category={item.data?.category}
            file={item.data?.file}
            // Pass visual properties for shape rendering
            fill={item.data?.backgroundColor}
            stroke={item.data?.borderColor}
            strokeWidth={item.data?.borderWidth}
            style={{
                transform: item.data?.rotation ? `rotate(${item.data.rotation}deg)` : undefined,
                opacity: item.data?.textOpacity
            }}
        />
    );
}

  const nodeRef = React.useRef(null);

  if (!isOpen || !isMounted) return null;

  return (
    <Draggable handle=".scratchpad-handle" nodeRef={nodeRef}>
      <div ref={nodeRef} className="fixed top-20 right-20 z-50 w-80 bg-background border rounded-lg shadow-xl flex flex-col max-h-[600px]">
        <div className="scratchpad-handle p-3 border-b bg-muted/50 rounded-t-lg cursor-move flex justify-between items-center">
          <h3 className="font-semibold text-sm">Scratch Pad</h3>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="w-full justify-between rounded-none border-b px-2 h-10 bg-transparent">
            <div className="flex gap-2">
              <TabsTrigger value="favorites" className="data-[state=active]:bg-background">Favorites</TabsTrigger>
              <TabsTrigger value="imports" className="data-[state=active]:bg-background">Imports</TabsTrigger>
            </div>
            <div className="flex gap-1">
              {activeTab === 'favorites' && favorites.length > 0 && (
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={clearFavorites} title="Clear Favorites">
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
              {activeTab === 'imports' && imports.length > 0 && (
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={clearImports} title="Clear Imports">
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          </TabsList>
          
          <TabsContent value="favorites" className="flex-1 flex flex-col min-h-0 p-0 m-0">
            <div 
              ref={(node) => { if (node) drop(node); }}
              className={`flex-1 p-4 overflow-y-auto min-h-[200px] ${isOver ? 'bg-accent/20' : ''}`}
            >
              {favorites.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-8">
                  Drag items here from the sidebar to save them as favorites.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {favorites.map(item => {
                    const isOnCanvas = diagramData.nodes.some(n => 
                      (n.importId && item.data?.importId && n.importId === item.data.importId) ||
                      (n.label === item.label && n.type === item.type)
                    );
                    
                    const itemData = {
                      // For canvas items, properties are already flat in item.data
                      // For imported items, properties are in item.data
                      ...item.data, 
                      // Include item-level properties for canvas operations
                      ...(item.objectType && { objectType: item.objectType }),
                      ...(item.importId && { importId: item.importId }),
                      ...(item.provider && { provider: item.provider }),
                      ...(item.category && { category: item.category }),
                      ...(item.file && { file: item.file }),
                      // CRITICAL: Ensure the original type is preserved for shapes
                      type: item.type,
                      label: item.label, 
                      fromScratchPad: true 
                    };
                    
                    // Check if this is a shape item
                    const isShape = item.type.startsWith('generic.object.') || 
                      item.type?.endsWith('.square') || item.type?.endsWith('.circle') || 
                      item.type?.endsWith('.point') || item.type?.endsWith('.rectangle') || 
                      item.type?.endsWith('.triangle') || item.type?.endsWith('.star') || 
                      item.type?.endsWith('.cloud') || item.type?.endsWith('.parallelogram') ||
                      item.type?.endsWith('.trapezoid') || item.type?.endsWith('.kite') || 
                      item.type?.endsWith('.hexagon') || item.type?.endsWith('.pentagon') || 
                      item.type?.endsWith('.octagon') || item.type?.endsWith('.jigsaw') ||
                      item.type?.endsWith('.arrowhead') || item.type?.endsWith('.chevron');
                    
                    return (
                    <div key={item.id} className="relative group">
                      {isShape ? (
                        <DraggableShape item={item} data={itemData} />
                      ) : (
                        <DraggableItem 
                          type={ItemTypes.DIAGRAM_NODE} 
                          label={item.label} 
                          icon={renderIcon(item)}
                          data={itemData}
                        />
                      )}
                      {isOnCanvas && (
                        <div className="absolute top-1 left-1 bg-green-500 text-white rounded-full p-0.5 z-10">
                          <Check className="h-3 w-3" />
                        </div>
                      )}
                      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-background/80 rounded z-10">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEditClick(item)}>
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteFavorite(item.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="imports" className="flex-1 flex flex-col min-h-0 p-0 m-0">
            <div className="p-2 border-b">
              <div className="flex items-center gap-2">
                <Input type="file" accept=".json" onChange={handleImport} className="h-8 text-xs" />
              </div>
            </div>
            <ScrollArea className="flex-1 p-2 h-[300px]">
               <div className="grid grid-cols-2 gap-2">
                  {imports.map(item => {
                    const isOnCanvas = diagramData.nodes.some(n => n.importId === item.importId);
                    
                    const itemData = { 
                      ...item.data, 
                      // Also include item-level properties that might not be in data
                      ...(item.objectType && { objectType: item.objectType }),
                      ...(item.importId && { importId: item.importId }),
                      // CRITICAL: Ensure the original type is preserved for shapes
                      type: item.type,
                      label: item.label,
                      fromScratchPad: true 
                    };
                    
                    // Check if this is a shape item
                    const isShape = item.type.startsWith('generic.object.') || 
                      item.type?.endsWith('.square') || item.type?.endsWith('.circle') || 
                      item.type?.endsWith('.point') || item.type?.endsWith('.rectangle') || 
                      item.type?.endsWith('.triangle') || item.type?.endsWith('.star') || 
                      item.type?.endsWith('.cloud') || item.type?.endsWith('.parallelogram') ||
                      item.type?.endsWith('.trapezoid') || item.type?.endsWith('.kite') || 
                      item.type?.endsWith('.hexagon') || item.type?.endsWith('.pentagon') || 
                      item.type?.endsWith('.octagon') || item.type?.endsWith('.jigsaw') ||
                      item.type?.endsWith('.arrowhead') || item.type?.endsWith('.chevron');
                    
                    return (
                        <div key={item.id} className="relative group">
                            {isShape ? (
                              <DraggableShape item={item} data={itemData} />
                            ) : (
                              <DraggableItem 
                                  type={ItemTypes.DIAGRAM_NODE} 
                                  label={item.label} 
                                  icon={renderIcon(item)}
                                  data={itemData} 
                              />
                            )}
                            {isOnCanvas && (
                                <div className="absolute top-1 left-1 bg-green-500 text-white rounded-full p-0.5 z-10">
                                    <Check className="h-3 w-3" />
                                </div>
                            )}
                             <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-background/80 rounded z-10">
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteImport(item.id)}>
                                <Trash2 className="h-3 w-3" />
                                </Button>
                            </div>
                        </div>
                    );
                  })}
               </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit Favorite</DialogTitle>
                </DialogHeader>
                {editingItem && (
                    <Tabs defaultValue="general" className="w-full">
                        <TabsList className="w-full grid grid-cols-3">
                            <TabsTrigger value="general">General</TabsTrigger>
                            <TabsTrigger value="text">Text</TabsTrigger>
                            <TabsTrigger value="visual">Visual</TabsTrigger>
                        </TabsList>
                        <TabsContent value="general" className="py-4 space-y-4">
                            <div className="grid gap-4">
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="name" className="text-right">Label</Label>
                                    <Input 
                                        id="name" 
                                        value={editingItem.label} 
                                        onChange={(e) => setEditingItem({...editingItem, label: e.target.value})} 
                                        className="col-span-3" 
                                    />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="info" className="text-right">Description</Label>
                                    <Textarea 
                                        id="info" 
                                        value={editingItem.data.info || ''} 
                                        onChange={(e) => setEditingItem({
                                            ...editingItem, 
                                            data: { ...editingItem.data, info: e.target.value }
                                        })} 
                                        className="col-span-3" 
                                    />
                                </div>
                            </div>
                        </TabsContent>
                        <TabsContent value="text" className="py-4 flex justify-center">
                            <TextStylingPanel 
                                styling={editingItem.data} 
                                onStylingChange={(changes) => setEditingItem({
                                    ...editingItem,
                                    data: { ...editingItem.data, ...changes }
                                })}
                                selectedItem={{
                                    ...editingItem.data,
                                    id: editingItem.id,
                                    type: editingItem.type,
                                    itemType: editingItem.type === 'zone' ? 'zone' : 'node'
                                }}
                            />
                        </TabsContent>
                        <TabsContent value="visual" className="py-4 flex justify-center">
                            <VisualStylingPanel 
                                styling={editingItem.data} 
                                onStylingChange={(changes) => setEditingItem({
                                    ...editingItem,
                                    data: { ...editingItem.data, ...changes }
                                })}
                            />
                        </TabsContent>
                    </Tabs>
                )}
                <DialogFooter>
                    <Button onClick={handleSaveEdit}>Save</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      </div>
    </Draggable>
  );
}
