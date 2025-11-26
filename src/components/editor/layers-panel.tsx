"use client";

import React, { useState, useRef, useCallback } from 'react';
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
  selectedItemsLayerIds?: string[];
  onAddLayer: (name: string) => void;
  onRemoveLayer: (layerId: string) => void;
  onRenameLayer: (layerId: string, newName: string) => void;
  onToggleVisibility: (layerId: string) => void;
  onSetActiveLayer: (layerId: string) => void;
  onReorderLayers: (fromIndex: number, toIndex: number) => void;
  onAssignSelectedItemsToLayer?: (layerId: string) => void;
  className?: string;
}

export function LayersPanel({
  layers,
  activeLayerId,
  selectedItemsLayerIds = [],
  onAddLayer,
  onRemoveLayer,
  onRenameLayer,
  onToggleVisibility,
  onSetActiveLayer,
  onReorderLayers,
  onAssignSelectedItemsToLayer,
  className
}: LayersPanelProps) {
  const [newLayerName, setNewLayerName] = useState('');
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [editingLayerName, setEditingLayerName] = useState('');
  const [deleteLayerId, setDeleteLayerId] = useState<string | null>(null);
  const [draggedLayerIndex, setDraggedLayerIndex] = useState<number | null>(null);
  const [showAddLayerForm, setShowAddLayerForm] = useState(false);
  
  const dragStartIndex = useRef<number | null>(null);

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

  return (
    <div className={cn("bg-white border rounded-lg shadow-lg w-80", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5" />
          <h3 className="font-semibold">Layers</h3>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowAddLayerForm(!showAddLayerForm)}
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Add Layer Form */}
      {showAddLayerForm && (
        <div className="p-4 border-b bg-gray-50">
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
            <Button size="sm" onClick={handleAddLayer}>
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
      <div className="max-h-96 overflow-y-auto">
        {layers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Layers className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No layers yet</p>
            <p className="text-xs mt-1">Click + to add your first layer</p>
          </div>
        ) : (
          <div className="p-2">
            {layers.map((layer, index) => (
              <div
                key={layer.id}
                draggable={layer.id !== 'background'}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                className={cn(
                  "group flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors",
                  "hover:bg-gray-100",
                  activeLayerId === layer.id && "bg-blue-50 border border-blue-200",
                  draggedLayerIndex === index && "opacity-50"
                )}
                onClick={() => onSetActiveLayer(layer.id)}
              >
                {/* Drag Handle */}
                {layer.id !== 'background' && (
                  <div className="cursor-move opacity-50 hover:opacity-100">
                    <GripVertical className="w-4 h-4" />
                  </div>
                )}

                {/* Layer Color Indicator */}
                <div
                  className="w-3 h-3 rounded-full border border-gray-300"
                  style={{ backgroundColor: layer.color || '#f3f4f6' }}
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
                      <span className="text-sm font-medium truncate">
                        {layer.name}
                      </span>
                      {hasSelectedItems(layer.id) && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                          {selectedItemsLayerIds.filter(id => id === layer.id).length}
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
            ))}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t bg-gray-50 text-xs text-gray-600">
        <div className="flex justify-between">
          <span>{layers.length} layer(s)</span>
          <span>Active: {layers.find(l => l.id === activeLayerId)?.name || 'None'}</span>
        </div>
        {selectedItemsLayerIds.length > 0 && (
          <div className="mt-1 text-blue-600">
            {selectedItemsLayerIds.length} item(s) selected
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
  );
}