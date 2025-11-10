"use client";
import React, { useState, useMemo } from 'react';
import { 
  Type, 
  Info, 
  Trash2, 
  Link, 
  Unlink, 
  Layout, 
  AlignLeft, 
  AlignCenter,
  AlignRight,
  AlignJustify,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  Move3D, 
  Image as ImageIcon,
  RotateCw,
  GripVertical,
  Layers,
  Square,
  Grid3x3,
  Maximize2,
  ArrowRight,
  ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Slider } from '@/components/ui/slider';
import type { SelectedItem } from '../diagram-editor';
import type { DiagramData } from '@/lib/types';

interface ContextToolbarProps {
  selectedItem: SelectedItem | null;
  selectedItemIds?: Set<string>;
  onItemUpdate?: (updatedItem: SelectedItem) => void;
  onConnect?: (connectionOptions?: { style?: 'bezier', curvature?: number }) => void;
  onDisconnect?: () => void;
  onDelete?: () => void;
  onConnectionUpdate?: (from: string, to: string, updates: { arrow?: boolean; text?: string; textPosition?: number; color?: string; lineWidth?: number; shadow?: boolean; [key: string]: any }) => void;
  onConnectionDisconnect?: (from: string, to: string) => void;
  diagramData?: DiagramData;
  onAlignObjects?: (alignment: 'top' | 'center' | 'bottom' | 'v-middle' | 'left' | 'h-center' | 'right' | 'distribute-v' | 'distribute-h') => void;
}

export function ContextToolbar({
  selectedItem,
  selectedItemIds,
  onItemUpdate,
  onConnect,
  onDisconnect,
  onDelete,
  onConnectionUpdate,
  onConnectionDisconnect,
  diagramData,
  onAlignObjects,
}: ContextToolbarProps) {
  const [labelOpen, setLabelOpen] = useState(false);
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const [connectionsOpen, setConnectionsOpen] = useState(false);

  if (!selectedItem) {
    return null;
  }

  // Handle edge/connection selection
  if (selectedItem.itemType === 'edge') {
    const isEdge = selectedItem.itemType === 'edge';
    const hasArrow = selectedItem.arrow === true || selectedItem.toArrow === true;

    const handleArrowToggle = () => {
      if (onConnectionUpdate && isEdge) {
        // Toggle arrow - if arrow is true, set to false, otherwise set to true
        onConnectionUpdate(selectedItem.from, selectedItem.to, {
          arrow: !hasArrow,
          toArrow: !hasArrow
        });
      }
    };

    return (
      <div className="flex items-center gap-1 px-2 border-l border-border min-h-[2.5rem] shrink-0">
        {/* Arrow Toggle Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant={hasArrow ? "default" : "ghost"} 
              size="sm" 
              className="h-8 px-2"
              onClick={handleArrowToggle}
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{hasArrow ? 'Hide Arrow' : 'Show Arrow'}</TooltipContent>
        </Tooltip>

      </div>
    );
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
      (updatedItem as any).width = isGroup ? 300 : 40;
      (updatedItem as any).height = isGroup ? 220 : 40;
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

  const handleBorderStyleChange = (value: 'solid' | 'dotted' | 'gradient' | 'none') => {
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

  const handleGradientAngleChange = (value: number) => {
    onItemUpdate({ ...selectedItem, gradientAngle: value } as SelectedItem);
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
  const isLabelNode = isNode && selectedItem.type === 'generic.text.label';
  const isLabelboxNode = isNode && selectedItem.type === 'generic.text.labelbox';
  const isTextboxNode = isNode && selectedItem.type === 'generic.text.textbox';
  const isPlainTextNode = isNode && selectedItem.type === 'generic.text.text';
  const isShapeNode = isNode && (selectedItem.type === 'generic.text.square' || 
                                 selectedItem.type === 'generic.text.circle' || 
                                 selectedItem.type === 'generic.text.rectangle' || 
                                 selectedItem.type === 'generic.text.triangle' ||
                                 selectedItem.type === 'generic.text.star' ||
                                 selectedItem.type === 'generic.text.cloud' ||
                                 // Also check for alternative type format
                                 selectedItem.type?.endsWith('.square') ||
                                 selectedItem.type?.endsWith('.circle') ||
                                 selectedItem.type?.endsWith('.rectangle') ||
                                 selectedItem.type?.endsWith('.triangle') ||
                                 selectedItem.type?.endsWith('.star') ||
                                 selectedItem.type?.endsWith('.cloud'));
  

  const isLabelOrLabelbox = isLabelNode || isLabelboxNode;
  // Text type nodes that should hide certain controls
  const isTextTypeNode = isTextNode; // includes all generic.text.* nodes

  // Get all connections for the selected node/group
  const getAllConnections = useMemo(() => {
    if (!selectedItem || !diagramData || selectedItem.itemType === 'edge') {
      return [];
    }

    const itemId = selectedItem.id;
    const nodesById = new Map(diagramData.nodes.map(n => [n.id, n]));
    const groupsById = new Map((diagramData.groups || []).map(g => [g.id, g]));

    const allConnections = (diagramData.connections || []).filter((edge: any) => 
      edge.from === itemId || edge.to === itemId
    ).map((edge: any) => {
      const isOutgoing = edge.from === itemId;
      const targetId = isOutgoing ? edge.to : edge.from;
      const targetItem = nodesById.get(targetId) || groupsById.get(targetId);
      const targetLabel = targetItem?.label || targetId;
      
      return {
        connection: edge,
        targetId,
        targetLabel,
        isOutgoing,
        direction: isOutgoing ? '→' : '←'
      };
    });

    return allConnections;
  }, [selectedItem, diagramData]);

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


        {/* Connections Arrow Toggle - Show if there are multiple connections */}
        {(isNode || isGroup) && getAllConnections.length > 0 && (
          <Popover open={connectionsOpen} onOpenChange={setConnectionsOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    <ArrowRight className="h-4 w-4" />
                    {getAllConnections.length > 1 && (
                      <span className="ml-1 text-xs">({getAllConnections.length})</span>
                    )}
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Connection Settings</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-96">
              <div className="space-y-2">
                <label className="text-sm font-medium">Connections</label>
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {getAllConnections.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-2">No connections</div>
                  ) : (
                    getAllConnections.map((connInfo, index) => {
                      const hasArrow = connInfo.connection.arrow === true || connInfo.connection.toArrow === true;
                      const connectionColor = connInfo.connection.color || '#6b7280';
                      const textPosition = connInfo.connection.textPosition ?? 50; // Default to 50%
                      const connectionText = connInfo.connection.text || '';
                      
                      const handleConnectionArrowToggle = () => {
                        if (onConnectionUpdate) {
                          onConnectionUpdate(
                            connInfo.connection.from,
                            connInfo.connection.to,
                            {
                              arrow: !hasArrow,
                              toArrow: !hasArrow
                            }
                          );
                        }
                      };

                      const handleColorChange = (color: string) => {
                        if (onConnectionUpdate) {
                          onConnectionUpdate(
                            connInfo.connection.from,
                            connInfo.connection.to,
                            {
                              color: color
                            }
                          );
                        }
                      };

                      const handleTextPositionChange = (value: number) => {
                        if (onConnectionUpdate) {
                          onConnectionUpdate(
                            connInfo.connection.from,
                            connInfo.connection.to,
                            {
                              textPosition: value
                            }
                          );
                        }
                      };

                      const handleTextChange = (text: string) => {
                        if (onConnectionUpdate) {
                          onConnectionUpdate(
                            connInfo.connection.from,
                            connInfo.connection.to,
                            {
                              text: text
                            }
                          );
                        }
                      };

                      return (
                        <div 
                          key={`${connInfo.connection.from}-${connInfo.connection.to}-${index}`}
                          className="flex flex-col gap-2 p-2 rounded-md border border-border hover:bg-accent/20"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="text-xs font-mono text-muted-foreground">
                                {connInfo.isOutgoing ? '→' : '←'}
                              </span>
                              <span className="text-sm truncate" title={connInfo.targetLabel}>
                                {connInfo.targetLabel || connInfo.targetId}
                              </span>
                            </div>
                            <Button
                              variant={hasArrow ? "default" : "outline"}
                              size="sm"
                              className="h-7 px-2 shrink-0"
                              onClick={handleConnectionArrowToggle}
                            >
                              <ArrowRight className={`h-3 w-3 ${hasArrow ? '' : 'opacity-50'}`} />
                            </Button>
                          </div>
                          <div className="flex flex-col gap-1 pt-1 border-t border-border/50">
                            <label className="text-xs text-muted-foreground whitespace-nowrap shrink-0">Text:</label>
                            <Input
                              type="text"
                              value={connectionText}
                              onChange={(e) => handleTextChange(e.target.value)}
                              placeholder="Enter connection text..."
                              className="h-7 text-sm"
                              title="Text displayed on connection line"
                            />
                          </div>
                          <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                            <label className="text-xs text-muted-foreground whitespace-nowrap shrink-0">Color:</label>
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                              <Input
                                type="color"
                                value={connectionColor}
                                onChange={(e) => handleColorChange(e.target.value)}
                                className="h-7 w-12 p-1 cursor-pointer shrink-0"
                                title="Pick color"
                              />
                              <Input
                                type="text"
                                value={connectionColor}
                                onChange={(e) => handleColorChange(e.target.value)}
                                className="h-7 flex-1 min-w-0 text-xs font-mono"
                                placeholder="#6b7280"
                                title="Hex color code"
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                            <label className="text-xs text-muted-foreground whitespace-nowrap shrink-0">Text Position:</label>
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Slider
                                value={[textPosition]}
                                onValueChange={(values) => handleTextPositionChange(values[0])}
                                min={0}
                                max={100}
                                step={1}
                                className="flex-1"
                              />
                              <Input
                                type="number"
                                value={textPosition}
                                onChange={(e) => handleTextPositionChange(Math.max(0, Math.min(100, parseInt(e.target.value) || 50)))}
                                className="h-7 w-16 text-xs text-center shrink-0"
                                min={0}
                                max={100}
                                title="Text position percentage (0-100)"
                              />
                              <span className="text-xs text-muted-foreground shrink-0">%</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                            <label className="text-xs text-muted-foreground whitespace-nowrap shrink-0">Line Thickness:</label>
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Input
                                type="number"
                                min="1"
                                max="10"
                                value={(connInfo.connection.lineWidth || 2.5).toString()}
                                onChange={(e) => {
                                  const width = Math.max(1, Math.min(10, parseFloat(e.target.value) || 2.5));
                                  if (onConnectionUpdate) {
                                    onConnectionUpdate(
                                      connInfo.connection.from,
                                      connInfo.connection.to,
                                      { lineWidth: width }
                                    );
                                  }
                                }}
                                className="h-7 w-20 text-xs text-center shrink-0"
                                title="Line thickness (1-10 pixels)"
                              />
                              <span className="text-xs text-muted-foreground shrink-0">px</span>
                            </div>
                            <label className="text-xs text-muted-foreground whitespace-nowrap shrink-0 ml-2">Shadow:</label>
                            <Button
                              variant={(connInfo.connection.shadow || false) ? "default" : "outline"}
                              size="sm"
                              className="h-7 px-2 shrink-0"
                              onClick={() => {
                                if (onConnectionUpdate) {
                                  onConnectionUpdate(
                                    connInfo.connection.from,
                                    connInfo.connection.to,
                                    { shadow: !(connInfo.connection.shadow || false) }
                                  );
                                }
                              }}
                            >
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 12 12"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <rect
                                  x="2"
                                  y="2"
                                  width="6"
                                  height="6"
                                  rx="0.5"
                                  fill="rgba(0, 0, 0, 0.15)"
                                />
                                <rect
                                  x="0.5"
                                  y="0.5"
                                  width="6"
                                  height="6"
                                  rx="0.5"
                                  fill={(connInfo.connection.shadow || false) ? "#22c55e" : "#9ca3af"}
                                  stroke={(connInfo.connection.shadow || false) ? "#22c55e" : "#9ca3af"}
                                  strokeWidth="0.3"
                                />
                              </svg>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-destructive hover:text-destructive shrink-0"
                              onClick={() => {
                                if (onConnectionDisconnect) {
                                  onConnectionDisconnect(
                                    connInfo.connection.from,
                                    connInfo.connection.to
                                  );
                                }
                              }}
                            >
                              <Unlink className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>
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
            <PopoverContent className="w-64">
              <div className="space-y-2">
                <label className="text-sm font-medium">Border Style</label>
                <Select 
                  value={(selectedItem as any).backgroundStyle || 'solid'} 
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
                <div className="pt-2 border-t border-border">
                  <label className="text-sm font-medium">Border Thickness</label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={((selectedItem as any).borderWidth || 2).toString()}
                    onChange={(e) => {
                      const width = Math.max(1, Math.min(10, parseInt(e.target.value) || 2));
                      onItemUpdate({ ...selectedItem, borderWidth: width } as SelectedItem);
                    }}
                    className="h-10"
                  />
                  <span className="text-xs text-muted-foreground">1-10 pixels</span>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Border Color */}
        {isGroup && ((selectedItem as any).backgroundStyle === 'solid' || (selectedItem as any).backgroundStyle === 'gradient' || !(selectedItem as any).backgroundStyle) && (
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    <div 
                      className="w-4 h-4 rounded border-2 border-border"
                        style={{ 
                          backgroundColor: (selectedItem as any).backgroundStyle === 'gradient' 
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
                {(selectedItem as any).backgroundStyle === 'gradient' ? (
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
                    <div className="pt-2 border-t border-border">
                      <label className="text-sm font-medium">Gradient Angle</label>
                      <Select 
                        value={String((selectedItem as any).gradientAngle || 135)} 
                        onValueChange={(value) => handleGradientAngleChange(parseInt(value))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="-45">Alt Diagonal ↗</SelectItem>
                          <SelectItem value="90">Down</SelectItem>
                          <SelectItem value="135">Diagonal ↘</SelectItem>
                          <SelectItem value="180">Side</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
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
        {(isGroup || isShapeNode) && (
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
        {(isGroup || isShapeNode) && selectedItem.backgroundStyle && selectedItem.backgroundStyle !== 'none' && (
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
                    <div className="pt-2 border-t border-border">
                      <label className="text-sm font-medium">Gradient Angle</label>
                      <Select 
                        value={String((selectedItem as any).gradientAngle || 135)} 
                        onValueChange={(value) => handleGradientAngleChange(parseInt(value))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="-45">Alt Diagonal ↗</SelectItem>
                          <SelectItem value="90">Down</SelectItem>
                          <SelectItem value="135">Diagonal ↘</SelectItem>
                          <SelectItem value="180">Side</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
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
        {(isGroup || isLabelOrLabelbox) && (
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

        {/* Text Justification for Text Resources */}
        {(isTextNode || isLabelNode || isTextboxNode || isLabelboxNode) && (
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    <AlignLeft className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Text Justification</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-48">
              <div className="space-y-2">
                <label className="text-sm font-medium">Text Justification</label>
                <Select
                  value={(selectedItem.itemType === 'node' ? (selectedItem as any).textJustify : undefined) || 'center'}
                  onValueChange={(value) => {
                    if (onItemUpdate && selectedItem.itemType === 'node') {
                      onItemUpdate({ ...selectedItem, textJustify: value as 'left' | 'center' | 'right' | 'full' });
                    }
                  }}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">
                      <div className="flex items-center gap-2">
                        <AlignLeft className="h-4 w-4" />
                        <span>Left</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="center">
                      <div className="flex items-center gap-2">
                        <AlignCenter className="h-4 w-4" />
                        <span>Center</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="right">
                      <div className="flex items-center gap-2">
                        <AlignRight className="h-4 w-4" />
                        <span>Right</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="full">
                      <div className="flex items-center gap-2">
                        <AlignJustify className="h-4 w-4" />
                        <span>Full</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Border Style for Label/Labelbox */}
        {isLabelOrLabelbox && (
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
                  value={(selectedItem as any).borderStyle || 'solid'} 
                  onValueChange={handleBorderStyleChange}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="solid">Solid</SelectItem>
                    <SelectItem value="dotted">Dotted</SelectItem>
                    <SelectItem value="gradient">Gradient</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Border Color for Label/Labelbox */}
        {isLabelOrLabelbox && ((selectedItem as any).borderStyle === 'solid' || (selectedItem as any).borderStyle === 'gradient' || !(selectedItem as any).borderStyle) && (
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    <div 
                      className="w-4 h-4 rounded border-2 border-border"
                      style={{ 
                        backgroundColor: (selectedItem as any).borderStyle === 'gradient' 
                          ? ((selectedItem as any).borderColors?.[0] || '#6b7280')
                          : (selectedItem.borderColor || '#d1d5db')
                      }}
                    />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Border Color</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-64">
              <div className="space-y-2">
                {(selectedItem as any).borderStyle === 'gradient' ? (
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
                      value={selectedItem.borderColor || '#d1d5db'}
                      onChange={(e) => handleBorderColorChange(e.target.value)}
                      className="h-10"
                    />
                  </>
                )}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Background Style for Label/Labelbox */}
        {isLabelOrLabelbox && (
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
                  value={(selectedItem as any).backgroundStyle || 'solid'} 
                  onValueChange={handleBackgroundStyleChange}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="solid">Solid</SelectItem>
                    <SelectItem value="dotted">Dotted</SelectItem>
                    <SelectItem value="gradient">Gradient</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Background Color for Label/Labelbox */}
        {isLabelOrLabelbox && (selectedItem as any).backgroundStyle && (selectedItem as any).backgroundStyle !== 'none' && (
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    <div 
                      className="w-4 h-4 rounded"
                      style={{ 
                        backgroundColor: (selectedItem as any).backgroundStyle === 'gradient' 
                          ? ((selectedItem as any).backgroundColors?.[0] || '#f3f4f6')
                          : (selectedItem.backgroundColor || (isLabelNode ? '#f3f4f6' : '#f0f9ff'))
                      }}
                    />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Background Color</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-64">
              <div className="space-y-2">
                {(selectedItem as any).backgroundStyle === 'gradient' ? (
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
                    <div className="pt-2 border-t border-border">
                      <label className="text-sm font-medium">Gradient Angle</label>
                      <Select 
                        value={String((selectedItem as any).gradientAngle || 135)} 
                        onValueChange={(value) => handleGradientAngleChange(parseInt(value))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="-45">Alt Diagonal ↗</SelectItem>
                          <SelectItem value="90">Down</SelectItem>
                          <SelectItem value="135">Diagonal ↘</SelectItem>
                          <SelectItem value="180">Side</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                ) : (
                  <>
                    <label className="text-sm font-medium">Background Color</label>
                    <Input
                      type="color"
                      value={selectedItem.backgroundColor || (isLabelNode ? '#f3f4f6' : '#f0f9ff')}
                      onChange={(e) => handleBackgroundColorChange(e.target.value)}
                      className="h-10"
                    />
                  </>
                )}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Border Style for Shapes */}
        {isShapeNode && (
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
                  value={(selectedItem as any).borderStyle || 'solid'} 
                  onValueChange={handleBorderStyleChange}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="solid">Solid</SelectItem>
                    <SelectItem value="dotted">Dotted</SelectItem>
                    <SelectItem value="gradient">Gradient</SelectItem>
                  </SelectContent>
                </Select>
                <div className="pt-2 border-t border-border">
                  <label className="text-sm font-medium">Border Thickness</label>
                  <Input
                    type="number"
                    min="0"
                    max="20"
                    value={(selectedItem as any).borderWidth || 2}
                    onChange={(e) => {
                      const width = Math.max(0, Math.min(20, parseInt(e.target.value) || 2));
                      onItemUpdate({ ...selectedItem, borderWidth: width } as SelectedItem);
                    }}
                    className="h-10"
                  />
                  <span className="text-xs text-muted-foreground">0-20 pixels</span>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Border Color for Shapes */}
        {isShapeNode && ((selectedItem as any).borderStyle === 'solid' || (selectedItem as any).borderStyle === 'gradient' || !(selectedItem as any).borderStyle) && (
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    <div 
                      className="w-4 h-4 rounded border-2 border-border"
                      style={{ 
                        backgroundColor: (selectedItem as any).borderStyle === 'gradient' 
                          ? ((selectedItem as any).borderColors?.[0] || '#6b7280')
                          : (selectedItem.borderColor || '#6b7280')
                      }}
                    />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Border Color</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-64">
              <div className="space-y-2">
                {(selectedItem as any).borderStyle === 'gradient' ? (
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
                    <div className="pt-2 border-t border-border">
                      <label className="text-sm font-medium">Gradient Angle</label>
                      <Select 
                        value={String((selectedItem as any).gradientAngle || 135)} 
                        onValueChange={(value) => handleGradientAngleChange(parseInt(value))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="-45">Alt Diagonal ↗</SelectItem>
                          <SelectItem value="90">Down</SelectItem>
                          <SelectItem value="135">Diagonal ↘</SelectItem>
                          <SelectItem value="180">Side</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                ) : (
                  <>
                    <label className="text-sm font-medium">Border Color</label>
                    <Input
                      type="color"
                      value={selectedItem.borderColor || '#6b7280'}
                      onChange={(e) => handleColorChange('borderColor', e.target.value)}
                      className="h-10"
                    />
                    <Input
                      type="text"
                      value={selectedItem.borderColor || '#6b7280'}
                      onChange={(e) => handleColorChange('borderColor', e.target.value)}
                      className="h-8 text-xs font-mono"
                      placeholder="#6b7280"
                    />
                  </>
                )}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Background Style for Shapes */}
        {isShapeNode && (
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
                  value={(selectedItem as any).backgroundStyle || 'solid'} 
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

        {/* Fill/Background Color for Shapes */}
        {isShapeNode && ((selectedItem as any).backgroundStyle !== 'none') && (
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 px-2"
                  >
                    <div 
                      className="w-4 h-4 rounded"
                      style={{ 
                        backgroundColor: (selectedItem as any).backgroundStyle === 'gradient' 
                          ? ((selectedItem as any).backgroundColors?.[0] || '#6b7280')
                          : (selectedItem.backgroundColor || '#6b7280')
                      }}
                    />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Fill Color</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-64">
              <div className="space-y-2">
                {(selectedItem as any).backgroundStyle === 'gradient' ? (
                  <>
                    <label className="text-sm font-medium">Background Start Color</label>
                    <Input
                      type="color"
                      value={((selectedItem as any).backgroundColors?.[0] || '#6b7280')}
                      onChange={(e) => handleBackgroundColorChange(e.target.value, 0)}
                      className="h-10"
                    />
                    <label className="text-sm font-medium">Background End Color</label>
                    <Input
                      type="color"
                      value={((selectedItem as any).backgroundColors?.[1] || '#3b82f6')}
                      onChange={(e) => handleBackgroundColorChange(e.target.value, 1)}
                      className="h-10"
                    />
                    <div className="pt-2 border-t border-border">
                      <label className="text-sm font-medium">Gradient Angle</label>
                      <Select 
                        value={String((selectedItem as any).gradientAngle || 135)} 
                        onValueChange={(value) => handleGradientAngleChange(parseInt(value))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="-45">Alt Diagonal ↗</SelectItem>
                          <SelectItem value="90">Down</SelectItem>
                          <SelectItem value="135">Diagonal ↘</SelectItem>
                          <SelectItem value="180">Side</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                ) : (
                  <>
                    <label className="text-sm font-medium">Fill Color</label>
                    <Input
                      type="color"
                      value={selectedItem.backgroundColor || '#6b7280'}
                      onChange={(e) => handleBackgroundColorChange(e.target.value)}
                      className="h-10"
                    />
                    <Input
                      type="text"
                      value={selectedItem.backgroundColor || '#6b7280'}
                      onChange={(e) => handleBackgroundColorChange(e.target.value)}
                      className="h-8 text-xs font-mono"
                      placeholder="#6b7280"
                    />
                  </>
                )}
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
        {isNode && !isTextTypeNode && (
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

        {/* Size Mode (Groups and Text Resources) */}
        {(isGroup || isTextNode || isLabelNode || isTextboxNode || isLabelboxNode) && (
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
                        min="40"
                        step="20"
                        value={(selectedItem as any).width || 40}
                        onChange={(e) => handleWidthChange(parseInt(e.target.value) || 40)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Height (px)</label>
                      <Input
                        type="number"
                        min="40"
                        step="20"
                        value={(selectedItem as any).height || 40}
                        onChange={(e) => handleHeightChange(parseInt(e.target.value) || 40)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
        )}



        {/* Rotation (All Nodes and Groups) */}
        {(isNode || isGroup) && (
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


        {/* Shadow Toggle (Groups, Label/Labelbox, and Shapes) */}
        {(isGroup || isLabelOrLabelbox || isShapeNode) && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 px-2"
                onClick={toggleShadow}
              >
                {/* Custom shadow icon - square with shadow */}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                >
                  {/* Shadow */}
                  <rect
                    x="3"
                    y="3"
                    width="10"
                    height="10"
                    rx="1"
                    fill="rgba(0, 0, 0, 0.15)"
                  />
                  {/* Square - green when enabled, grey when disabled */}
                  <rect
                    x="1"
                    y="1"
                    width="10"
                    height="10"
                    rx="1"
                    fill={(selectedItem as any).shadow ? "#22c55e" : "#9ca3af"}
                    stroke={(selectedItem as any).shadow ? "#22c55e" : "#9ca3af"}
                    strokeWidth="0.5"
                  />
                </svg>
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

        {/* Align Objects Button - Show when multiple items are selected */}
        {selectedItemIds && selectedItemIds.size > 1 && (
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    <AlignCenter className="h-4 w-4" />
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Align Objects</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-48">
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Vertical Alignment</label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start h-8 px-2"
                    onClick={() => onAlignObjects?.('top')}
                  >
                    <AlignVerticalJustifyStart className="h-4 w-4 mr-2" />
                    Align Top
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start h-8 px-2"
                    onClick={() => onAlignObjects?.('v-middle')}
                  >
                    <AlignVerticalJustifyCenter className="h-4 w-4 mr-2" />
                    Align Middle
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start h-8 px-2"
                    onClick={() => onAlignObjects?.('bottom')}
                  >
                    <AlignVerticalJustifyEnd className="h-4 w-4 mr-2" />
                    Align Bottom
                  </Button>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Horizontal Alignment</label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start h-8 px-2"
                    onClick={() => onAlignObjects?.('left')}
                  >
                    <AlignLeft className="h-4 w-4 mr-2" />
                    Align Left
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start h-8 px-2"
                    onClick={() => onAlignObjects?.('h-center')}
                  >
                    <AlignCenter className="h-4 w-4 mr-2" />
                    Align Center
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start h-8 px-2"
                    onClick={() => onAlignObjects?.('right')}
                  >
                    <AlignRight className="h-4 w-4 mr-2" />
                    Align Right
                  </Button>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Distribute</label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start h-8 px-2"
                    onClick={() => onAlignObjects?.('distribute-v')}
                  >
                    <AlignVerticalJustifyCenter className="h-4 w-4 mr-2" />
                    Distribute Vertically
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start h-8 px-2"
                    onClick={() => onAlignObjects?.('distribute-h')}
                  >
                    <AlignCenter className="h-4 w-4 mr-2" />
                    Distribute Horizontally
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
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

