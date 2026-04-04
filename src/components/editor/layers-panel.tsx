"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import Draggable from 'react-draggable';
import { 
  Layers, 
  Plus, 
  Trash2, 
  Eye, 
  EyeOff, 
  Edit2, 
  Check, 
  X, 
  GripVertical,
  Palette
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from '@/components/ui/alert-dialog';
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { LayerInfo } from '@/lib/types';

interface LayersPanelProps {
  layers: LayerInfo[];
  activeLayerId: string;
  disabledLayerIds?: string[];
  selectedItemsLayerIds?: string[];
  onAddLayer: (name: string) => void;
  onRemoveLayer: (layerId: string) => void;
  onRenameLayer: (layerId: string, newName: string) => void;
  onToggleVisibility: (layerId: string) => void;
  onSetActiveLayer: (layerId: string) => void;
  onReorderLayers: (fromIndex: number, toIndex: number) => void;
  onAssignSelectedItemsToLayer?: (layerId: string) => void;
  onClose?: () => void;
  className?: string;
  getLayerItemCount?: (layerId: string) => number;
}

export function LayersPanel({
  layers,
  activeLayerId,
  disabledLayerIds = [],
  selectedItemsLayerIds = [],
  onAddLayer,
  onRemoveLayer,
  onRenameLayer,
  onToggleVisibility,
  onSetActiveLayer,
  onReorderLayers,
  onAssignSelectedItemsToLayer,
  onClose,
  className,
  getLayerItemCount
}: LayersPanelProps) {
  const [newLayerName, setNewLayerName] = useState('');
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [editingLayerName, setEditingLayerName] = useState('');
  const [deleteLayerId, setDeleteLayerId] = useState<string | null>(null);
  const [draggedLayerIndex, setDraggedLayerIndex] = useState<number | null>(null);
  const [showAddLayerForm, setShowAddLayerForm] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isMounted, setIsMounted] = useState(false);
  
  const dragStartIndex = useRef<number | null>(null);
  const nodeRef = useRef(null);

  // Handle adding a new layer
  const handleAddLayer = useCallback(() => {
    if (newLayerName.trim()) {
      onAddLayer(newLayerName.trim());
      setNewLayerName('');
      setShowAddLayerForm(false);
    }
  }, [newLayerName, onAddLayer]);

  // Handle starting to edit a layer name
  const handleStartEditLayer = useCallback((layer: LayerInfo) => {
    setEditingLayerId(layer.id);
    setEditingLayerName(layer.name);
  }, []);

  // Handle saving edited layer name
  const handleSaveEditLayer = useCallback(() => {
    if (editingLayerId && editingLayerName.trim()) {
      onRenameLayer(editingLayerId, editingLayerName.trim());
      setEditingLayerId(null);
      setEditingLayerName('');
    }
  }, [editingLayerId, editingLayerName, onRenameLayer]);

  // Handle canceling edit
  const handleCancelEdit = useCallback(() => {
    setEditingLayerId(null);
    setEditingLayerName('');
  }, []);

  // Handle delete layer
  const handleDeleteLayer = useCallback(() => {
    if (deleteLayerId) {
      onRemoveLayer(deleteLayerId);
      setDeleteLayerId(null);
    }
  }, [deleteLayerId, onRemoveLayer]);

  // Handle drag start
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    dragStartIndex.current = index;
    setDraggedLayerIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  }, []);

  // Handle drag over
  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    if (draggedLayerIndex !== null && draggedLayerIndex !== index) {
      // Visual feedback could be added here
    }
  }, [draggedLayerIndex]);

  // Handle drop
  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (dragStartIndex.current !== null && dragStartIndex.current !== dropIndex) {
      onReorderLayers(dragStartIndex.current, dropIndex);
    }
    
    setDraggedLayerIndex(null);
    dragStartIndex.current = null;
  }, [onReorderLayers]);

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    setDraggedLayerIndex(null);
    dragStartIndex.current = null;
  }, []);

  // Check if layer contains selected items
  const hasSelectedItems = useCallback((layerId: string) => {
    return selectedItemsLayerIds.includes(layerId);
  }, [selectedItemsLayerIds]);

  useEffect(() => {
    setIsMounted(true);
    
    // Load position from localStorage
    if (typeof window !== 'undefined') {
      const savedPosition = localStorage.getItem('dw:layers:position');
      if (savedPosition) {
        try {
          const parsed = JSON.parse(savedPosition);
          setPosition(parsed);
        } catch (e) {
          console.error('Failed to load layers position', e);
        }
      }
    }
  }, []);

  // Save position to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && isMounted) {
      try {
        localStorage.setItem('dw:layers:position', JSON.stringify(position));
      } catch (e) {
        console.error('Failed to save layers position', e);
      }
    }
  }, [position, isMounted]);

  return (
    <Draggable 
      handle=".layers-handle" 
      nodeRef={nodeRef}
      position={position}
      onStop={(e, data) => {
        setPosition({ x: data.x, y: data.y });
      }}
    >
      <div ref={nodeRef} className={cn("fixed top-20 left-20 z-50 bg-popover border border-border rounded-lg shadow-lg w-80", className)}>
        {/* Header */}
        <div className="layers-handle flex items-center justify-between p-4 border-b cursor-move">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5" />
            <h3 className="font-semibold">Layers</h3>
          </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowAddLayerForm(!showAddLayerForm)}
          >
            <Plus className="w-4 h-4" />
          </Button>
          {onClose && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Add Layer Form */}
      {showAddLayerForm && (
        <div className="p-4 border-b border-border bg-muted/50">
          <div className="flex gap-2">
            <Input
              placeholder="Layer name..."
              value={newLayerName}
              onChange={(e) => setNewLayerName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAddLayer();
                } else if (e.key === 'Escape') {
                  setShowAddLayerForm(false);
                  setNewLayerName('');
                }
              }}
              className="flex-1"
              autoFocus
            />
            <Button variant="default" size="sm" onClick={handleAddLayer} aria-label="Add layer">
              <Check className="w-4 h-4" />
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => {
                setShowAddLayerForm(false);
                setNewLayerName('');
              }}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Layers List */}
      <div className="h-64 overflow-y-auto">
        {layers.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Layers className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No layers yet</p>
            <p className="text-xs mt-1">Click + to add your first layer</p>
          </div>
        ) : (
          <div className="p-2">
            {layers.map((layer, index) => (
              (() => {
                const isLayerDisabled = disabledLayerIds.includes(layer.id);
                return (
              <div
                key={layer.id}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                className={cn(
                  "group flex items-center gap-2 p-2 rounded-md transition-colors",
                  "hover:bg-accent",
                  activeLayerId === layer.id && "bg-accent border border-border",
                  isLayerDisabled && "ring-1 ring-amber-500/50 bg-amber-500/5",
                  draggedLayerIndex === index && "opacity-50"
                )}
                onClick={() => onSetActiveLayer(layer.id)}
              >
                {/* Drag Handle */}
                {layer.id !== 'background' && (
                  <div 
                    className="cursor-move opacity-50 hover:opacity-100"
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                  >
                    <GripVertical className="w-4 h-4" />
                  </div>
                )}

                {/* Layer Color Indicator */}
                <div
                  className="w-3 h-3 rounded-full border border-gray-300"
                  style={{ backgroundColor: layer.color || 'hsl(var(--muted))' }}
                />

                {/* Layer Name */}
                <div className={editingLayerId === layer.id ? "flex-1 min-w-0" : "flex-1 min-w-0"}>
                  {editingLayerId === layer.id ? (
                    <Input
                      value={editingLayerName}
                      onChange={(e) => setEditingLayerName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSaveEditLayer();
                        } else if (e.key === 'Escape') {
                          handleCancelEdit();
                        }
                      }}
                      className="h-6 text-sm w-full"
                      autoFocus
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-sm font-medium truncate",
                        !layer.visible && "text-muted-foreground"
                      )}>
                        {layer.name}
                      </span>
                      {getLayerItemCount && (
                        <span className={cn(
                          "text-xs px-1.5 py-0.5 rounded",
                          layer.visible 
? "bg-accent text-foreground"
                            : "bg-muted/50 text-muted-foreground"
                        )}>
                          {getLayerItemCount(layer.id)}
                        </span>
                      )}
                      {hasSelectedItems(layer.id) && (
                        <span className={cn(
                          "text-xs px-1.5 py-0.5 rounded",
                          layer.visible 
? "bg-primary/20 text-primary"
                            : "bg-accent text-muted-foreground"
                        )}>
                          {selectedItemsLayerIds.filter(id => id === layer.id).length}
                        </span>
                      )}
                      {isLayerDisabled && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 whitespace-nowrap">
                          Disabled in presentation
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Layer Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {editingLayerId === layer.id ? (
                    <>
                      <Button size="sm" variant="ghost" onClick={handleSaveEditLayer}>
                        <Check className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                        <X className="w-3 h-3" />
                      </Button>
                    </>
                  ) : (
                    <>
                      {/* Only show these icons when no items are selected */}
                      {selectedItemsLayerIds.length === 0 && (
                        <>
                          {/* Visibility Toggle */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleVisibility(layer.id);
                            }}
                            disabled={layer.id === 'background'}
                          >
                            {layer.visible ? (
                              <Eye className="w-3 h-3" />
                            ) : (
                              <EyeOff className="w-3 h-3" />
                            )}
                          </Button>

                          {/* Edit Name */}
                          {layer.id !== 'background' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartEditLayer(layer);
                              }}
                            >
                              <Edit2 className="w-3 h-3" />
                            </Button>
                          )}

                          {/* Delete Layer */}
                          {layer.id !== 'background' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteLayerId(layer.id);
                              }}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </>
                      )}

                      {/* Assign Selected Items - always show when items are selected */}
                      {onAssignSelectedItemsToLayer && selectedItemsLayerIds.length > 0 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAssignSelectedItemsToLayer(layer.id);
                          }}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
              );
              })()
            ))}
          </div>
        )}
      </div>



      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteLayerId} onOpenChange={() => setDeleteLayerId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Layer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this layer? All items in this layer will be moved to the background layer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteLayer}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </Draggable>
  );
}