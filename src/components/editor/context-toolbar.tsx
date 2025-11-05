"use client";
import React, { useState } from 'react';
import { 
  Type, 
  Info, 
  Trash2, 
  Link, 
  Unlink, 
  Layout, 
  AlignLeft, 
  Move3D, 
  Image as ImageIcon,
  RotateCw,
  GripVertical,
  Layers,
  Square,
  Grid3x3,
  Maximize2,
  Minus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { SelectedItem } from '../diagram-editor';

interface ContextToolbarProps {
  selectedItem: SelectedItem | null;
  onItemUpdate: (updatedItem: SelectedItem) => void;
  onConnect: (connectionOptions?: { style?: 'bezier', curvature?: number }) => void;
  onDisconnect: () => void;
  onDelete: () => void;
}

export function ContextToolbar({
  selectedItem,
  onItemUpdate,
  onConnect,
  onDisconnect,
  onDelete,
}: ContextToolbarProps) {
  const [labelOpen, setLabelOpen] = useState(false);
  const [descriptionOpen, setDescriptionOpen] = useState(false);

  if (!selectedItem || selectedItem.itemType === 'edge') {
    return null;
  }

  const handleLabelChange = (value: string) => {
    onItemUpdate({ ...selectedItem, label: value } as SelectedItem);
  };

  const handleInfoChange = (value: string) => {
    onItemUpdate({ ...selectedItem, info: value } as SelectedItem);
  };

  const handleColorChange = (property: 'borderColor' | 'backgroundColor' | 'textColor' | 'lineColor', value: string) => {
    onItemUpdate({ ...selectedItem, [property]: value } as SelectedItem);
  };

  const handleBorderColorChange = (value: string, index?: number) => {
    if (selectedItem.borderStyle === 'gradient' && index !== undefined) {
      const currentColors = (selectedItem as any).borderColors || ['#6b7280', '#3b82f6'];
      const newColors = [...currentColors];
      newColors[index] = value;
      onItemUpdate({ ...selectedItem, borderColors: newColors } as SelectedItem);
    } else {
      onItemUpdate({ ...selectedItem, borderColor: value } as SelectedItem);
    }
  };

  const handleBackgroundColorChange = (value: string, index?: number) => {
    if (selectedItem.backgroundStyle === 'gradient' && index !== undefined) {
      const currentColors = (selectedItem as any).backgroundColors || ['#f3f4f6', '#e5e7eb'];
      const newColors = [...currentColors];
      newColors[index] = value;
      onItemUpdate({ ...selectedItem, backgroundColors: newColors } as SelectedItem);
    } else {
      onItemUpdate({ ...selectedItem, backgroundColor: value } as SelectedItem);
    }
  };

  const handleMaxItemsPerRowChange = (value: number) => {
    onItemUpdate({ ...selectedItem, maxItemsPerRow: value } as SelectedItem);
  };

  const handleSizeModeChange = (value: 'auto' | 'custom') => {
    const isGroup = selectedItem.itemType === 'group';
    const updatedItem = { ...selectedItem, sizeMode: value } as SelectedItem;
    if (value === 'custom' && !(selectedItem as any).width && !(selectedItem as any).height) {
      (updatedItem as any).width = isGroup ? 300 : 200;
      (updatedItem as any).height = isGroup ? 220 : 120;
    }
    onItemUpdate(updatedItem);
  };

  const handleWidthChange = (value: number) => {
    onItemUpdate({ ...selectedItem, width: value } as SelectedItem);
  };

  const handleHeightChange = (value: number) => {
    onItemUpdate({ ...selectedItem, height: value } as SelectedItem);
  };

  const handleRotationChange = (value: string) => {
    onItemUpdate({ ...selectedItem, rotation: parseInt(value) } as SelectedItem);
  };

  const handleBorderStyleChange = (value: 'solid' | 'gradient' | 'none') => {
    if (value === 'none') {
      onItemUpdate({ ...selectedItem, borderStyle: 'none' } as SelectedItem);
    } else {
      onItemUpdate({ ...selectedItem, borderStyle: value } as SelectedItem);
    }
  };

  const handleBackgroundStyleChange = (value: 'solid' | 'gradient' | 'none') => {
    if (value === 'none') {
      onItemUpdate({ ...selectedItem, backgroundStyle: 'none' } as SelectedItem);
    } else {
      onItemUpdate({ ...selectedItem, backgroundStyle: value } as SelectedItem);
    }
  };

  const handleOrientationChange = (value: 'square' | 'horizontal' | 'vertical') => {
    onItemUpdate({ ...selectedItem, orientation: value } as SelectedItem);
  };

  const handleTextPositionChange = (value: string) => {
    onItemUpdate({ ...selectedItem, textPosition: value as any } as SelectedItem);
  };

  const handleEdgePositionChange = (value: string) => {
    onItemUpdate({ 
      ...selectedItem, 
      edgePosition: value === 'none' ? undefined : value as 'top' | 'bottom' | 'left' | 'right'
    } as SelectedItem);
  };

  const toggleShadow = () => {
    onItemUpdate({ ...selectedItem, shadow: !selectedItem.shadow } as SelectedItem);
  };

  const toggleFreeflow = () => {
    onItemUpdate({ ...selectedItem, freeflow: !selectedItem.freeflow } as SelectedItem);
  };

  const toggleNoIconBackground = () => {
    onItemUpdate({ ...selectedItem, noIconBackground: !(selectedItem as any).noIconBackground } as any);
  };

  const isGroup = selectedItem.itemType === 'group';
  const isNode = selectedItem.itemType === 'node';
  const isTextNode = isNode && selectedItem.type?.startsWith('generic.text');

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1 px-2 border-l border-border min-h-[2.5rem] shrink-0">
        {/* Label Editor */}
        <Popover open={labelOpen} onOpenChange={setLabelOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 px-2">
                  <Type className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent>Label</TooltipContent>
          </Tooltip>
          <PopoverContent className="w-64">
            <div className="space-y-2">
              <label className="text-sm font-medium">Label</label>
              <Input
                value={selectedItem.label || ''}
                onChange={(e) => handleLabelChange(e.target.value)}
                placeholder="Enter label"
                onBlur={() => setLabelOpen(false)}
              />
            </div>
          </PopoverContent>
        </Popover>

        {/* Description Editor */}
        <Popover open={descriptionOpen} onOpenChange={setDescriptionOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 px-2">
                  <Info className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent>Description</TooltipContent>
          </Tooltip>
          <PopoverContent className="w-64">
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={selectedItem.info || ''}
                onChange={(e) => handleInfoChange(e.target.value)}
                placeholder="Enter description"
                rows={3}
                onBlur={() => setDescriptionOpen(false)}
              />
            </div>
          </PopoverContent>
        </Popover>

        {/* Connect Button */}
        {(isNode || isGroup) && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 px-2" 
                onClick={() => onConnect({ style: 'bezier', curvature: 0.6 })}
              >
                <Link className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Connect</TooltipContent>
          </Tooltip>
        )}

        {/* Disconnect Button */}
        {(isNode || isGroup) && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-2" onClick={onDisconnect}>
                <Unlink className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Disconnect</TooltipContent>
          </Tooltip>
        )}

        {/* Border Style */}
        {isGroup && (
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    <Square className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Border Style</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-48">
              <div className="space-y-2">
                <label className="text-sm font-medium">Border Style</label>
                <Select 
                  value={selectedItem.borderStyle || 'solid'} 
                  onValueChange={handleBorderStyleChange}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="solid">Solid</SelectItem>
                    <SelectItem value="gradient">Gradient</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Border Color */}
        {isGroup && selectedItem.borderStyle && selectedItem.borderStyle !== 'none' && (
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    <div 
                      className="w-4 h-4 rounded border-2 border-border"
                      style={{ 
                        backgroundColor: selectedItem.borderStyle === 'gradient' 
                          ? ((selectedItem as any).borderColors?.[0] || '#6b7280')
                          : (selectedItem.borderColor || '#3b82f6')
                      }}
                    />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Border Color</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-64">
              <div className="space-y-2">
                {selectedItem.borderStyle === 'gradient' ? (
                  <>
                    <label className="text-sm font-medium">Border Start Color</label>
                    <Input
                      type="color"
                      value={((selectedItem as any).borderColors?.[0] || '#6b7280')}
                      onChange={(e) => handleBorderColorChange(e.target.value, 0)}
                      className="h-10"
                    />
                    <label className="text-sm font-medium">Border End Color</label>
                    <Input
                      type="color"
                      value={((selectedItem as any).borderColors?.[1] || '#3b82f6')}
                      onChange={(e) => handleBorderColorChange(e.target.value, 1)}
                      className="h-10"
                    />
                  </>
                ) : (
                  <>
                    <label className="text-sm font-medium">Border Color</label>
                    <Input
                      type="color"
                      value={selectedItem.borderColor || '#3b82f6'}
                      onChange={(e) => handleBorderColorChange(e.target.value)}
                      className="h-10"
                    />
                  </>
                )}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Background Style */}
        {isGroup && (
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    <Layers className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Background Style</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-48">
              <div className="space-y-2">
                <label className="text-sm font-medium">Background Style</label>
                <Select 
                  value={selectedItem.backgroundStyle || 'solid'} 
                  onValueChange={handleBackgroundStyleChange}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="solid">Solid</SelectItem>
                    <SelectItem value="gradient">Gradient</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Background Color */}
        {isGroup && selectedItem.backgroundStyle && selectedItem.backgroundStyle !== 'none' && (
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    <div 
                      className="w-4 h-4 rounded"
                      style={{ 
                        backgroundColor: selectedItem.backgroundStyle === 'gradient' 
                          ? ((selectedItem as any).backgroundColors?.[0] || '#f3f4f6')
                          : (selectedItem.backgroundColor || '#f3f4f6')
                      }}
                    />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Background Color</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-64">
              <div className="space-y-2">
                {selectedItem.backgroundStyle === 'gradient' ? (
                  <>
                    <label className="text-sm font-medium">Background Start Color</label>
                    <Input
                      type="color"
                      value={((selectedItem as any).backgroundColors?.[0] || '#f3f4f6')}
                      onChange={(e) => handleBackgroundColorChange(e.target.value, 0)}
                      className="h-10"
                    />
                    <label className="text-sm font-medium">Background End Color</label>
                    <Input
                      type="color"
                      value={((selectedItem as any).backgroundColors?.[1] || '#e5e7eb')}
                      onChange={(e) => handleBackgroundColorChange(e.target.value, 1)}
                      className="h-10"
                    />
                  </>
                ) : (
                  <>
                    <label className="text-sm font-medium">Background Color</label>
                    <Input
                      type="color"
                      value={selectedItem.backgroundColor || '#f3f4f6'}
                      onChange={(e) => handleBackgroundColorChange(e.target.value)}
                      className="h-10"
                    />
                  </>
                )}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Text Color */}
        {isGroup && (
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    <Type className="h-4 w-4" style={{ color: selectedItem.textColor || '#374151' }} />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Text Color</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-64">
              <div className="space-y-2">
                <label className="text-sm font-medium">Text Color</label>
                <Input
                  type="color"
                  value={selectedItem.textColor || '#374151'}
                  onChange={(e) => handleColorChange('textColor', e.target.value)}
                  className="h-10"
                />
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Orientation (Groups only) */}
        {isGroup && (
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    <Layout className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Orientation</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-48">
              <div className="space-y-2">
                <label className="text-sm font-medium">Orientation</label>
                <Select 
                  value={selectedItem.orientation || 'square'} 
                  onValueChange={handleOrientationChange}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="square">Square</SelectItem>
                    <SelectItem value="horizontal">Horizontal</SelectItem>
                    <SelectItem value="vertical">Vertical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Text Position (Groups) */}
        {isGroup && (
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    <AlignLeft className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Text Position</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-48">
              <div className="space-y-2">
                <label className="text-sm font-medium">Text Position</label>
                <Select 
                  value={selectedItem.textPosition || ''} 
                  onValueChange={handleTextPositionChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select position" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="top-left">Top Left</SelectItem>
                    <SelectItem value="top-center">Top Center</SelectItem>
                    <SelectItem value="top-right">Top Right</SelectItem>
                    <SelectItem value="bottom-left">Bottom Left</SelectItem>
                    <SelectItem value="bottom-center">Bottom Center</SelectItem>
                    <SelectItem value="bottom-right">Bottom Right</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Edge Position (Nodes in groups) */}
        {isNode && (
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    <GripVertical className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Edge Position</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-48">
              <div className="space-y-2">
                <label className="text-sm font-medium">Edge Position</label>
                <Select 
                  value={selectedItem.edgePosition || 'none'} 
                  onValueChange={handleEdgePositionChange}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Normal (Inside)</SelectItem>
                    <SelectItem value="top">Top Edge</SelectItem>
                    <SelectItem value="bottom">Bottom Edge</SelectItem>
                    <SelectItem value="left">Left Edge</SelectItem>
                    <SelectItem value="right">Right Edge</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Max Items Per Row (Groups) */}
        {isGroup && (selectedItem.orientation === 'horizontal' || selectedItem.orientation === 'square') && (
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    <Grid3x3 className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Max Items Per Row</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-48">
              <div className="space-y-2">
                <label className="text-sm font-medium">Max Items Per Row</label>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={(selectedItem as any).maxItemsPerRow || 3}
                  onChange={(e) => handleMaxItemsPerRowChange(parseInt(e.target.value) || 3)}
                  className="h-10"
                />
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Size Mode (Groups) */}
        {isGroup && (
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Size Mode</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-48">
              <div className="space-y-2">
                <label className="text-sm font-medium">Sizing Mode</label>
                <Select 
                  value={(selectedItem as any).sizeMode || 'auto'} 
                  onValueChange={handleSizeModeChange}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto (Fit Content)</SelectItem>
                    <SelectItem value="custom">Custom (Manual Resize)</SelectItem>
                  </SelectContent>
                </Select>
                {(selectedItem as any).sizeMode === 'custom' && (
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <div>
                      <label className="text-xs text-muted-foreground">Width (px)</label>
                      <Input
                        type="number"
                        min="100"
                        step="20"
                        value={(selectedItem as any).width || 300}
                        onChange={(e) => handleWidthChange(parseInt(e.target.value) || 300)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Height (px)</label>
                      <Input
                        type="number"
                        min="100"
                        step="20"
                        value={(selectedItem as any).height || 220}
                        onChange={(e) => handleHeightChange(parseInt(e.target.value) || 220)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Line Color (Nodes) */}
        {isNode && (
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    <Minus className="h-4 w-4" style={{ color: (selectedItem as any).lineColor || '#6b7280' }} />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Line Color</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-64">
              <div className="space-y-2">
                <label className="text-sm font-medium">Line Color</label>
                <Input
                  type="color"
                  value={(selectedItem as any).lineColor || '#6b7280'}
                  onChange={(e) => handleColorChange('lineColor', e.target.value)}
                  className="h-10"
                />
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Text Position for Text Nodes */}
        {isTextNode && (
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    <AlignLeft className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Text Position</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-48">
              <div className="space-y-2">
                <label className="text-sm font-medium">Text Position</label>
                <Select 
                  value={(selectedItem as any).textPosition || 'under'} 
                  onValueChange={handleTextPositionChange}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="above">Above</SelectItem>
                    <SelectItem value="center">Center</SelectItem>
                    <SelectItem value="under">Under (Default)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Rotation (Text Nodes) */}
        {isTextNode && (
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    <RotateCw className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Rotation</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-48">
              <div className="space-y-2">
                <label className="text-sm font-medium">Rotation</label>
                <Select 
                  value={String((selectedItem as any).rotation || 0)} 
                  onValueChange={handleRotationChange}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0° (Default)</SelectItem>
                    <SelectItem value="45">45°</SelectItem>
                    <SelectItem value="-45">-45°</SelectItem>
                    <SelectItem value="90">90°</SelectItem>
                    <SelectItem value="-90">-90°</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Size Mode for Text Nodes */}
        {isTextNode && (
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Size Mode</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-48">
              <div className="space-y-2">
                <label className="text-sm font-medium">Sizing Mode</label>
                <Select 
                  value={(selectedItem as any).sizeMode || 'auto'} 
                  onValueChange={handleSizeModeChange}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto (Fit Content)</SelectItem>
                    <SelectItem value="custom">Custom (Manual Resize)</SelectItem>
                  </SelectContent>
                </Select>
                {(selectedItem as any).sizeMode === 'custom' && (
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <div>
                      <label className="text-xs text-muted-foreground">Width (px)</label>
                      <Input
                        type="number"
                        min={selectedItem.type === 'generic.text.textbox' ? 200 : 160}
                        step="10"
                        value={(selectedItem as any).width || (selectedItem.type === 'generic.text.textbox' ? 200 : 160)}
                        onChange={(e) => handleWidthChange(parseInt(e.target.value) || (selectedItem.type === 'generic.text.textbox' ? 200 : 160))}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Height (px)</label>
                      <Input
                        type="number"
                        min={selectedItem.type === 'generic.text.textbox' ? 120 : 100}
                        step="10"
                        value={(selectedItem as any).height || (selectedItem.type === 'generic.text.textbox' ? 120 : 100)}
                        onChange={(e) => handleHeightChange(parseInt(e.target.value) || (selectedItem.type === 'generic.text.textbox' ? 120 : 100))}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Shadow Toggle (Groups) */}
        {isGroup && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant={(selectedItem as any).shadow ? "default" : "ghost"} 
                size="sm" 
                className="h-8 px-2"
                onClick={toggleShadow}
              >
                <Layers className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle Shadow</TooltipContent>
          </Tooltip>
        )}

        {/* Freeflow Toggle (Nodes) */}
        {isNode && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant={(selectedItem as any).freeflow ? "default" : "ghost"} 
                size="sm" 
                className="h-8 px-2"
                onClick={toggleFreeflow}
              >
                <Move3D className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Freeflow Mode</TooltipContent>
          </Tooltip>
        )}

        {/* Remove Icon Background (Non-text nodes) */}
        {isNode && !isTextNode && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant={(selectedItem as any).noIconBackground ? "default" : "ghost"} 
                size="sm" 
                className="h-8 px-2"
                onClick={toggleNoIconBackground}
              >
                <ImageIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Remove Icon Background</TooltipContent>
          </Tooltip>
        )}

        {/* Delete Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 px-2 text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Delete</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

