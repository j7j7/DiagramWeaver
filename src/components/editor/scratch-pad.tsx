"use client";
import React, { useState, useEffect, useMemo } from 'react';
import Draggable from 'react-draggable';
import { useDrop, useDrag } from 'react-dnd';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Check, Edit2, Trash2, Download, Upload } from 'lucide-react';
import { DraggableItem, ItemTypes } from './draggable-item';
import type { DiagramData, ScratchPadItem } from '@/lib/types';
import { Dialog, DialogPortal, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TextStylingPanel } from './text-styling-panel';
import { VisualStylingPanel } from './visual-styling-panel';
import { processImportedItems, getResourcePath } from '@/lib/resource-mapping';
import { isIconOrEmojiType } from '@/lib/utils';
import { ResourceIcon } from '@/components/diagram/resource-icon';
import { ShapePreview } from './shape-preview';
import { Card, CardContent } from '@/components/ui/card';

interface ScratchPadProps {
  isOpen: boolean;
  onClose: () => void;
  diagramData: DiagramData;
  setDiagramData: React.Dispatch<React.SetStateAction<DiagramData>>;
  onCanvasRefresh: () => void;
  onHistoryUpdate?: () => void;
}

export function ScratchPad({ isOpen, onClose, diagramData, setDiagramData, onCanvasRefresh, onHistoryUpdate }: ScratchPadProps) {

// Load favorites from localStorage (client-side only) - use initializer
  const [favorites, setFavorites] = useState<ScratchPadItem[]>(() => {
    if (typeof window !== 'undefined') {
      const savedFavorites = localStorage.getItem('dw:scratchpad:favorites');
      if (savedFavorites) {
        try {
          const parsed = JSON.parse(savedFavorites);
        
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
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setIsMounted(true);
    
    // Load position from localStorage
    if (typeof window !== 'undefined') {
      const savedPosition = localStorage.getItem('dw:scratchpad:position');
      if (savedPosition) {
        try {
          const parsed = JSON.parse(savedPosition);
          setPosition(parsed);
        } catch (e) {
          console.error('Failed to load scratchpad position', e);
        }
      }
    }
  }, []);

  // Save favorites to localStorage (client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('dw:scratchpad:favorites', JSON.stringify(favorites));
        // Trigger history update when favorites change
        onHistoryUpdate?.();
      } catch (e) {
        console.error('Failed to save favorites to localStorage', e);
      }
    }
  }, [favorites, onHistoryUpdate]);

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

  // Save position to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && isMounted) {
      try {
        localStorage.setItem('dw:scratchpad:position', JSON.stringify(position));
      } catch (e) {
        console.error('Failed to save scratchpad position', e);
      }
    }
  }, [position, isMounted]);

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
              borderGradientAngle: child.borderGradientAngle,
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
          borderGradientAngle: item.borderGradientAngle,
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
      setFavorites(prev => [...prev, newItem]);
      
      // Refresh canvas after adding canvas item to scratchpad
      if (isCanvasItem) {
        setTimeout(() => {
          onCanvasRefresh();
        }, 100);
      }
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

  const saveFavorites = async () => {
    if (favorites.length === 0) {
      return;
    }
    
    try {
      const jsonString = JSON.stringify(favorites, null, 2);

      // Try to use File System Access API if available (same as main save)
      if ('showSaveFilePicker' in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: `diagramweaver-favorites-${new Date().toISOString().split('T')[0]}.json`,
            types: [{
              description: 'JSON Files',
              accept: { 'application/json': ['.json'] }
            }]
          });
          const writable = await handle.createWritable();
          await writable.write(jsonString);
          await writable.close();
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
      a.download = `diagramweaver-favorites-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to save favorites', e);
    }
  };

  const loadFavorites = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (Array.isArray(json)) {
          // Validate that the loaded items have the required structure
          const validFavorites = json.filter(item => 
            item && 
            typeof item === 'object' && 
            item.id && 
            item.label && 
            item.type
          );
          
          if (validFavorites.length > 0) {
            setFavorites(prev => [...prev, ...validFavorites]);
          } else {
            console.error('No valid favorites found in file');
          }
        } else {
          console.error('Invalid file format: expected array');
        }
      } catch (err) {
        console.error('Failed to parse favorites file', err);
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

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
  
  // Display at 25% size on scratchpad (50% smaller than current 50%)
  const displayWidth = originalWidth * 0.25;
  const displayHeight = originalHeight * 0.25;
  
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
  

  
  return (
    <div
      ref={(node) => {
        if (node) drag(node);
      }}
      style={{ opacity: isDragging ? 0.5 : 1 }}
      className="cursor-move"
    >
      <Card className="hover:bg-accent hover:text-accent-foreground transition-colors">
        <CardContent className="p-1.5 flex flex-col items-center justify-center gap-1 text-center min-h-12">
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
            borderGradientAngle={itemData.borderGradientAngle}
            label={item.label}
            textColor={itemData.textColor}
            fontFamily={itemData.fontFamily}
            fontSize={8}
            fontWeight={itemData.fontWeight}
            fontStyle={itemData.fontStyle}
            textDecoration={itemData.textDecoration}
            shadow={itemData.shadow}
            roundedEdges={(itemData as { roundedEdges?: boolean }).roundedEdges}
            cornerRadius={(itemData as { cornerRadius?: number }).cornerRadius}
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
            width={17} 
            height={17}
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
    <Draggable 
      handle=".scratchpad-handle" 
      nodeRef={nodeRef}
      defaultPosition={position}
      onStop={(e, data) => {
        setPosition({ x: data.x, y: data.y });
      }}
    >
      <div ref={nodeRef} data-testid="scratchpad" className="fixed top-20 right-20 z-50 w-80 bg-white border rounded-lg shadow-lg flex flex-col max-h-[600px]">
        <div className="scratchpad-handle flex items-center justify-between p-4 border-b cursor-move">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">Scratch Pad</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="w-full justify-between rounded-none border-b px-2 h-10 bg-transparent">
            <div className="flex gap-2">
              <TabsTrigger value="favorites" className="data-[state=active]:bg-background">Favorites</TabsTrigger>
              <TabsTrigger value="imports" className="data-[state=active]:bg-background">Imports</TabsTrigger>
            </div>
            <div className="flex gap-1">
              {activeTab === 'favorites' && (
                <>
                  {favorites.length > 0 && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={saveFavorites} title="Save Favorites">
                      <Download className="h-3 w-3" />
                    </Button>
                  )}
                  <div className="relative">
                    <Input 
                      type="file" 
                      accept=".json" 
                      onChange={loadFavorites} 
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                      title="Load Favorites"
                    />
                    <Button variant="ghost" size="icon" className="h-6 w-6" title="Load Favorites">
                      <Upload className="h-3 w-3" />
                    </Button>
                  </div>
                  {favorites.length > 0 && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={clearFavorites} title="Clear Favorites">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </>
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
                <div className="grid grid-cols-4 gap-1">
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
                    
                    // Check if this is a shape item (exclude icon/emoji - generic.icon.star is Lucide icon)
                    const isShape = !isIconOrEmojiType(item.type) && (item.type.startsWith('generic.object.') || 
                      item.type?.endsWith('.square') || item.type?.endsWith('.circle') || 
                      item.type?.endsWith('.point') || item.type?.endsWith('.rectangle') || 
                      item.type?.endsWith('.triangle') || item.type?.endsWith('.star') || 
                      item.type?.endsWith('.cloud') || item.type?.endsWith('.parallelogram') ||
                      item.type?.endsWith('.trapezoid') || item.type?.endsWith('.kite') || 
                      item.type?.endsWith('.hexagon') || item.type?.endsWith('.pentagon') || 
                      item.type?.endsWith('.octagon') || item.type?.endsWith('.jigsaw') ||
                      item.type?.endsWith('.arrowhead') || item.type?.endsWith('.chevron'));
                    
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
               <div className="grid grid-cols-4 gap-1">
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
                    
                    // Check if this is a shape item (exclude icon/emoji)
                    const isShape = !isIconOrEmojiType(item.type) && (item.type.startsWith('generic.object.') || 
                      item.type?.endsWith('.square') || item.type?.endsWith('.circle') || 
                      item.type?.endsWith('.point') || item.type?.endsWith('.rectangle') || 
                      item.type?.endsWith('.triangle') || item.type?.endsWith('.star') || 
                      item.type?.endsWith('.cloud') || item.type?.endsWith('.parallelogram') ||
                      item.type?.endsWith('.trapezoid') || item.type?.endsWith('.kite') || 
                      item.type?.endsWith('.hexagon') || item.type?.endsWith('.pentagon') || 
                      item.type?.endsWith('.octagon') || item.type?.endsWith('.jigsaw') ||
                      item.type?.endsWith('.arrowhead') || item.type?.endsWith('.chevron'));
                    
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
            <DialogPortal>
                <DialogPrimitive.Content
                    className="fixed left-0 top-[50%] z-50 max-w-2xl max-h-[90vh] w-[45vw] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg overflow-y-auto"
                >
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
                                        value={editingItem.data?.info ?? ''} 
                                        onChange={(e) => setEditingItem({
                                            ...editingItem, 
                                            data: { ...(editingItem.data || {}), info: e.target.value }
                                        })} 
                                        className="col-span-3" 
                                    />
                                </div>
                            </div>
                        </TabsContent>
                        <TabsContent value="text" className="py-4">
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
                        <TabsContent value="visual" className="py-4">
                            <VisualStylingPanel
                                styling={editingItem.data}
                                onStylingChange={(changes) => setEditingItem({
                                    ...editingItem,
                                    data: { ...editingItem.data, ...changes }
                                })}
                                isShape={(() => {
                                    const t = editingItem.type || '';
                                    return !isIconOrEmojiType(t) && (t.startsWith('generic.object.') ||
                                      t?.endsWith('.square') || t?.endsWith('.circle') ||
                                      t?.endsWith('.point') || t?.endsWith('.rectangle') ||
                                      t?.endsWith('.triangle') || t?.endsWith('.star') ||
                                      t?.endsWith('.cloud') || t?.endsWith('.parallelogram') ||
                                      t?.endsWith('.trapezoid') || t?.endsWith('.kite') ||
                                      t?.endsWith('.hexagon') || t?.endsWith('.pentagon') ||
                                      t?.endsWith('.octagon') || t?.endsWith('.jigsaw') ||
                                      t?.endsWith('.arrowhead') || t?.endsWith('.chevron'));
                                })()}
                            />
                        </TabsContent>
                    </Tabs>
                )}
                <DialogFooter>
                    <Button onClick={handleSaveEdit}>Save</Button>
                </DialogFooter>
                </DialogPrimitive.Content>
            </DialogPortal>
        </Dialog>
      </div>
    </Draggable>
  );
}
