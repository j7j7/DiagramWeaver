"use client";
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
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
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  Move3D, 
  Image as ImageIcon,
  RotateCw,
  GripVertical,
  Square,
  Grid3x3,
  Maximize2,
  ArrowRight,
  ChevronDown,
  Palette,
  GripHorizontal,
  X,
  ArrowUp,
  ArrowDown,
  ChevronUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Slider } from '@/components/ui/slider';

import { TextStylingPanel } from './text-styling-panel';
import { VisualStylingPanel } from './visual-styling-panel';
import type { SelectedItem } from '../diagram-editor';
import type { DiagramData, DiagramZoneData } from '@/lib/types';
import { DiagramTheme } from '@/lib/theme-types';
import { themeManager } from '@/lib/theme-manager';
import { extractTextStylingFromNode, extractTextStylingFromGroup, applyTextStylingToZone, applyTextStylingToNode } from '@/lib/text-styling';
import { extractVisualStylingFromNode, extractVisualStylingFromGroup } from '@/lib/visual-styling';

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
  onDiagramDataUpdate?: (newDiagramData: DiagramData) => void;
  onAlignObjects?: (alignment: 'top' | 'center' | 'bottom' | 'v-middle' | 'left' | 'h-center' | 'right' | 'distribute-v' | 'distribute-h') => void;
  onThemeApplyToSelected?: (theme: DiagramTheme) => void;
  textStylingPanelOpen?: boolean;
  visualStylingPanelOpen?: boolean;
  connectionSettingsPanelOpen?: boolean;
  onTextStylingPanelOpenChange?: (open: boolean) => void;
  onVisualStylingPanelOpenChange?: (open: boolean) => void;
  onConnectionSettingsPanelOpenChange?: (open: boolean) => void;
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
  onDiagramDataUpdate,
  onAlignObjects,
  onThemeApplyToSelected,
  textStylingPanelOpen = false,
  visualStylingPanelOpen = false,
  connectionSettingsPanelOpen = false,
  onTextStylingPanelOpenChange,
  onVisualStylingPanelOpenChange,
  onConnectionSettingsPanelOpenChange,
}: ContextToolbarProps) {
  const [labelOpen, setLabelOpen] = useState(false);
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const [textStylingOpen, setTextStylingOpen] = useState(textStylingPanelOpen);
  const [visualStylingOpen, setVisualStylingOpen] = useState(visualStylingPanelOpen);
  const [draggedConnectionIndex, setDraggedConnectionIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Sync external panel state with internal state
  useEffect(() => {
    setTextStylingOpen(textStylingPanelOpen);
  }, [textStylingPanelOpen]);

  useEffect(() => {
    setVisualStylingOpen(visualStylingPanelOpen);
  }, [visualStylingPanelOpen]);

  useEffect(() => {
    setConnectionsOpen(connectionSettingsPanelOpen);
  }, [connectionSettingsPanelOpen]);

  const handleTextStylingOpenChange = (open: boolean) => {
    setTextStylingOpen(open);
    onTextStylingPanelOpenChange?.(open);
  };

  const handleVisualStylingOpenChange = (open: boolean) => {
    setVisualStylingOpen(open);
    onVisualStylingPanelOpenChange?.(open);
  };

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
    onItemUpdate?.({ ...selectedItem, label: value } as SelectedItem);
  };

  const handleInfoChange = (value: string) => {
    onItemUpdate?.({ ...selectedItem, info: value } as SelectedItem);
  };

  // Debounced color change to prevent excessive updates during dragging
  const colorTimeoutRef = useRef<NodeJS.Timeout>();
  // Connection color timeout ref
  const connectionColorTimeoutRef = useRef<NodeJS.Timeout>();
  
  const handleColorChange = useCallback((property: 'borderColor' | 'backgroundColor' | 'textColor' | 'lineColor', value: string) => {
    // Clear existing timeout
    if (colorTimeoutRef.current) {
      clearTimeout(colorTimeoutRef.current);
    }
    
    // Set new timeout to update after 150ms of no changes
    colorTimeoutRef.current = setTimeout(() => {
      onItemUpdate?.({ ...selectedItem, [property]: value } as SelectedItem);
    }, 150);
  }, [selectedItem, onItemUpdate]);

  // Immediate color change for final value (when input is released)
  const handleColorChangeImmediate = useCallback((property: 'borderColor' | 'backgroundColor' | 'textColor' | 'lineColor', value: string) => {
    if (colorTimeoutRef.current) {
      clearTimeout(colorTimeoutRef.current);
    }
    onItemUpdate?.({ ...selectedItem, [property]: value } as SelectedItem);
  }, [selectedItem, onItemUpdate]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (colorTimeoutRef.current) {
        clearTimeout(colorTimeoutRef.current);
      }
      if (connectionColorTimeoutRef.current) {
        clearTimeout(connectionColorTimeoutRef.current);
      }
    };
  }, []);

  const handleMaxItemsPerRowChange = (value: number) => {
    onItemUpdate?.({ ...selectedItem, maxItemsPerRow: value } as SelectedItem);
  };

  const handleSizeModeChange = (value: 'auto' | 'custom') => {
    const isZone = selectedItem.itemType === 'zone';
    const updatedItem = { ...selectedItem, sizeMode: value } as SelectedItem;
    if (value === 'custom' && !(selectedItem as any).width && !(selectedItem as any).height) {
      (updatedItem as any).width = isZone ? 300 : 40;
      (updatedItem as any).height = isZone ? 220 : 40;
    }
    onItemUpdate?.(updatedItem);
  };

  const handleWidthChange = (value: number) => {
    onItemUpdate?.({ ...selectedItem, width: value } as SelectedItem);
  };

  const handleHeightChange = (value: number) => {
    onItemUpdate?.({ ...selectedItem, height: value } as SelectedItem);
  };

  const handleRotationChange = (value: string) => {
    onItemUpdate?.({ ...selectedItem, rotation: parseInt(value) } as SelectedItem);
  };



  const handleOrientationChange = (value: 'square' | 'horizontal' | 'vertical') => {
    onItemUpdate?.({ ...selectedItem, orientation: value } as SelectedItem);
  };

  const handleTextPositionChange = (value: string) => {
    // When textPosition changes for zones, also update textVerticalPosition if needed
    if (selectedItem && selectedItem.itemType === 'zone') {
      const updatedItem: any = { ...selectedItem, textPosition: value as any };
      
      // Derive textVerticalPosition from textPosition for outside/inline positions
      if (value === 'outside-bottom' || value === 'inline-bottom') {
        updatedItem.textVerticalPosition = 'bottom';
      } else if (value === 'outside-top' || value === 'inline-top') {
        updatedItem.textVerticalPosition = 'top';
      }
      
      onItemUpdate?.(updatedItem as SelectedItem);
    } else {
      onItemUpdate?.({ ...selectedItem, textPosition: value as any } as SelectedItem);
    }
  };

  const handleShapeTextPlacementChange = (value: 'above' | 'center' | 'under') => {
    onItemUpdate?.({ ...selectedItem, textPosition: value } as SelectedItem);
  };

  const handleEdgePositionChange = (value: string) => {
    onItemUpdate?.({ 
      ...selectedItem, 
      edgePosition: value === 'none' ? undefined : value as 'top' | 'bottom' | 'left' | 'right'
    } as SelectedItem);
  };



  const toggleFreeflow = () => {
    if (selectedItem.itemType === 'node') {
      onItemUpdate?.({ ...selectedItem, freeflow: !selectedItem.freeflow } as SelectedItem);
    }
  };

  const toggleNoIconBackground = () => {
    if (!selectedItem) return;
    
    if (selectedItemIds && selectedItemIds.size > 1) {
      // Apply to multiple selected items
      const newNoIconBackgroundValue = !(selectedItem as any).noIconBackground;
      
      // Update all selected items in the diagram data
      if (diagramData && onDiagramDataUpdate) {
        const updatedDiagramData = {
          ...diagramData,
          nodes: diagramData.nodes.map((node: any) => {
            if (selectedItemIds.has(node.id)) {
              return { ...node, noIconBackground: newNoIconBackgroundValue };
            }
            return node;
          }),
          zones: diagramData.zones?.map((zone: any) => {
            if (selectedItemIds.has(zone.id)) {
              return { ...zone, noIconBackground: newNoIconBackgroundValue };
            }
            return zone;
          })
        };
        onDiagramDataUpdate(updatedDiagramData);
      }
    } else {
      // Apply to single selected item
      onItemUpdate?.({ ...selectedItem, noIconBackground: !(selectedItem as any).noIconBackground } as any);
    }
  };

  const handleTextStylingChange = (styling: any) => {
    // Check if multiple items are selected
    if (selectedItemIds && selectedItemIds.size > 1 && diagramData && onDiagramDataUpdate) {
      // Apply styling change to all selected items
      const updatedDiagramData = { ...diagramData };
      
      // Update nodes
      updatedDiagramData.nodes = updatedDiagramData.nodes.map(node => {
        if (selectedItemIds.has(node.id)) {
          return applyTextStylingToNode(node, styling);
        }
        return node;
      });
      
      // Update zones
      if (updatedDiagramData.zones) {
        updatedDiagramData.zones = updatedDiagramData.zones.map(zone => {
          if (selectedItemIds.has(zone.id)) {
            return applyTextStylingToZone(zone, styling) as DiagramZoneData;
          }
          return zone;
        });
      }
      
      onDiagramDataUpdate(updatedDiagramData);
    } else {
      // Single item selection - existing logic
      if (isZone) {
        // Use applyTextStylingToZone to properly merge styling for zones
        const updatedZone = applyTextStylingToZone(selectedItem as any, styling);
        onItemUpdate?.({ ...updatedZone, itemType: 'zone' } as SelectedItem);
      } else if (isNode) {
        // Use applyTextStylingToNode to properly merge styling for nodes
        const updatedNode = applyTextStylingToNode(selectedItem as any, styling);
        onItemUpdate?.({ ...updatedNode, itemType: 'node' } as SelectedItem);
      } else {
        // Fallback to direct spread
        onItemUpdate?.({ ...selectedItem as SelectedItem, ...styling } as SelectedItem);
      }
    }
  };

  const handleTextStylingReset = () => {
    // Reset to default text styling
    const defaultStyling = {
      fontFamily: undefined,
      fontSize: undefined,
      fontWeight: undefined,
      fontStyle: undefined,
      textDecoration: undefined,
      textTransform: undefined,
      letterSpacing: undefined,
      lineHeight: undefined,
      textOpacity: undefined,
      textColor: undefined
    };
    
    // Check if multiple items are selected
    if (selectedItemIds && selectedItemIds.size > 1 && diagramData && onDiagramDataUpdate) {
      // Apply reset to all selected items
      const updatedDiagramData = { ...diagramData };
      
      // Update nodes
      updatedDiagramData.nodes = updatedDiagramData.nodes.map(node => {
        if (selectedItemIds.has(node.id)) {
          return applyTextStylingToNode(node, defaultStyling);
        }
        return node;
      });
      
      // Update zones
      if (updatedDiagramData.zones) {
        updatedDiagramData.zones = updatedDiagramData.zones.map(zone => {
          if (selectedItemIds.has(zone.id)) {
            return applyTextStylingToZone(zone, defaultStyling) as DiagramZoneData;
          }
          return zone;
        });
      }
      
      onDiagramDataUpdate(updatedDiagramData);
    } else {
      // Single item selection - existing logic
      onItemUpdate?.({ ...selectedItem as SelectedItem, ...defaultStyling } as SelectedItem);
    }
  };

  const handleVisualStylingChange = (styling: any) => {
    // Check if multiple items are selected
    if (selectedItemIds && selectedItemIds.size > 1 && diagramData && onDiagramDataUpdate) {
      // Apply styling change to all selected items
      const updatedDiagramData = { ...diagramData };
      
      // Update nodes
      updatedDiagramData.nodes = updatedDiagramData.nodes.map(node => {
        if (selectedItemIds.has(node.id)) {
          return { ...node, ...styling };
        }
        return node;
      });
      
      // Update zones
      if (updatedDiagramData.zones) {
        updatedDiagramData.zones = updatedDiagramData.zones.map(zone => {
          if (selectedItemIds.has(zone.id)) {
            return { ...zone, ...styling };
          }
          return zone;
        });
      }
      
      onDiagramDataUpdate(updatedDiagramData);
    } else {
      // Single item selection - existing logic
      onItemUpdate?.({ ...selectedItem as SelectedItem, ...styling } as SelectedItem);
    }
  };

  const handleVisualStylingReset = () => {
    // Reset to default visual styling
    const defaultStyling = {
      borderStyle: undefined,
      borderColor: undefined,
      borderColors: undefined,
      backgroundStyle: undefined,
      backgroundColor: undefined,
      backgroundColors: undefined,
      gradientAngle: undefined,
      shadow: undefined,
      borderWidth: undefined
    };
    
    // Check if multiple items are selected
    if (selectedItemIds && selectedItemIds.size > 1 && diagramData && onDiagramDataUpdate) {
      // Apply reset to all selected items
      const updatedDiagramData = { ...diagramData };
      
      // Update nodes
      updatedDiagramData.nodes = updatedDiagramData.nodes.map(node => {
        if (selectedItemIds.has(node.id)) {
          return { ...node, ...defaultStyling };
        }
        return node;
      });
      
      // Update zones
      if (updatedDiagramData.zones) {
        updatedDiagramData.zones = updatedDiagramData.zones.map(zone => {
          if (selectedItemIds.has(zone.id)) {
            return { ...zone, ...defaultStyling };
          }
          return zone;
        });
      }
      
      onDiagramDataUpdate(updatedDiagramData);
    } else {
      // Single item selection - existing logic
      onItemUpdate?.({ ...selectedItem as SelectedItem, ...defaultStyling } as SelectedItem);
    }
  };

  // Drag and drop handlers for connection reordering
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedConnectionIndex(index);
    // Set drag data to identify the connection
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragEnter = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear drag over if we're actually leaving the element
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragOverIndex(null);
    }
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverIndex(null);
    
    const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'));
    
    if (isNaN(draggedIndex) || draggedIndex === dropIndex) {
      setDraggedConnectionIndex(null);
      return;
    }



    // Get the actual connection objects from the filtered getAllConnections
    const allConnections = getAllConnections;
    if (draggedIndex >= allConnections.length || dropIndex >= allConnections.length) {
      setDraggedConnectionIndex(null);
      return;
    }

    const draggedConnInfo = allConnections[draggedIndex];
    const dropConnInfo = allConnections[dropIndex];
    


    // Reorder connections in the diagram data
    if (diagramData && onDiagramDataUpdate) {
      const newConnections = [...(diagramData.connections || [])];
      

      
      // Find the actual indices in the full connections array
      const draggedActualIndex = newConnections.findIndex(
        c => (c.from === draggedConnInfo.connection.from && c.to === draggedConnInfo.connection.to) ||
             (c.from === draggedConnInfo.connection.to && c.to === draggedConnInfo.connection.from)
      );
      
      const dropActualIndex = newConnections.findIndex(
        c => (c.from === dropConnInfo.connection.from && c.to === dropConnInfo.connection.to) ||
             (c.from === dropConnInfo.connection.to && c.to === dropConnInfo.connection.from)
      );
      

      
      if (draggedActualIndex !== -1 && dropActualIndex !== -1) {
        const draggedConnection = newConnections[draggedActualIndex];
        
        // Remove the dragged connection and insert at new position
        newConnections.splice(draggedActualIndex, 1);
        newConnections.splice(dropActualIndex, 0, draggedConnection);
        

        
        // Update the diagram data with reordered connections
        onDiagramDataUpdate({
          ...diagramData,
          connections: newConnections
        });
        
      }
    }
    
    setDraggedConnectionIndex(null);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedConnectionIndex(null);
    setDragOverIndex(null);
  };

  const isZone = selectedItem.itemType === 'zone';
  const isNode = selectedItem.itemType === 'node';

  const getCurrentTextStyling = useMemo(() => {
    if (!selectedItem || !diagramData) return {};
    
    // In multi-select scenarios, get fresh data from diagramData to avoid stale references
    let currentItem = selectedItem;
    if (selectedItemIds && selectedItemIds.size > 1) {
      // Find the current version of the selected item in diagramData
      if (isNode) {
        const foundNode = diagramData.nodes.find(n => n.id === selectedItem.id);
        currentItem = foundNode ? { ...foundNode, itemType: 'node' as const } : selectedItem;
      } else if (isZone) {
        const foundZone = diagramData.zones?.find(z => z.id === selectedItem.id);
        currentItem = foundZone ? { ...foundZone, itemType: 'zone' as const } : selectedItem;
      }
    }
    
    if (isNode) {
      return extractTextStylingFromNode(currentItem as any);
    } else if (isZone) {
      return extractTextStylingFromGroup(currentItem as any);
    }
    return {};
  }, [selectedItem, isNode, isZone, selectedItemIds, diagramData]);

  const getCurrentVisualStyling = useMemo(() => {
    if (!selectedItem || !diagramData) return {};
    
    // In multi-select scenarios, get fresh data from diagramData to avoid stale references
    let currentItem = selectedItem;
    if (selectedItemIds && selectedItemIds.size > 1) {
      // Find the current version of the selected item in diagramData
      if (isNode) {
        const foundNode = diagramData.nodes.find(n => n.id === selectedItem.id);
        currentItem = foundNode ? { ...foundNode, itemType: 'node' as const } : selectedItem;
      } else if (isZone) {
        const foundZone = diagramData.zones?.find(z => z.id === selectedItem.id);
        currentItem = foundZone ? { ...foundZone, itemType: 'zone' as const } : selectedItem;
      }
    }
    
    if (isNode) {
      return extractVisualStylingFromNode(currentItem as any);
    } else if (isZone) {
      return extractVisualStylingFromGroup(currentItem as any);
    }
    return {};
  }, [selectedItem, isNode, isZone, selectedItemIds, diagramData]);
  const isTextNode = isNode && selectedItem.type?.startsWith('generic.text');
  const isTextboxNode = isNode && selectedItem.type === 'generic.text.textbox';
  const isPlainTextNode = isNode && selectedItem.type === 'generic.text.text';
  const isShapeNode = isNode && (selectedItem.type === 'generic.object.square' || 
                                 selectedItem.type === 'generic.object.circle' || 
                                 selectedItem.type === 'generic.object.point' || 
                                 selectedItem.type === 'generic.object.rectangle' || 
                                 selectedItem.type === 'generic.object.triangle' ||
                                 selectedItem.type === 'generic.object.star' ||
                                 selectedItem.type === 'generic.object.cloud' ||
                                 selectedItem.type?.endsWith('.square') ||
                                 selectedItem.type?.endsWith('.circle') ||
                                 selectedItem.type?.endsWith('.point') ||
                                 selectedItem.type?.endsWith('.rectangle') ||
                                 selectedItem.type?.endsWith('.triangle') ||
                                 selectedItem.type?.endsWith('.star') ||
                                 selectedItem.type?.endsWith('.cloud'));
  

  const isLabelOrTextbox = isTextboxNode;
  // Text type nodes that should hide certain controls
  const isTextTypeNode = isTextNode; // includes all generic.text nodes

  // Get all connections for the selected node/zone
  const getAllConnections = useMemo(() => {
    if (!selectedItem || !diagramData) {
      return [];
    }

    const itemId = selectedItem.id;
    const nodesById = new Map(diagramData.nodes.map(n => [n.id, n]));
    const zonesById = new Map((diagramData.zones || []).map(zone => [zone.id, zone]));

    const allConnections = (diagramData.connections || []).filter((edge: any) => 
      edge.from === itemId || edge.to === itemId
    ).map((edge: any) => {
      const isOutgoing = edge.from === itemId;
      const targetId = isOutgoing ? edge.to : edge.from;
      const targetItem = nodesById.get(targetId) || zonesById.get(targetId);
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
        {(isNode || isZone) && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 px-2" 
                onClick={() => onConnect?.({ style: 'bezier', curvature: 0.6 })}
              >
                <Link className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Connect</TooltipContent>
          </Tooltip>
        )}


        {/* Connections Arrow Toggle - Show if there are multiple connections */}
        {(isNode || isZone) && getAllConnections.length > 0 && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 px-2"
                  onClick={() => setConnectionsOpen(!connectionsOpen)}
                >
                  <ArrowRight className="h-4 w-4" />
                  {getAllConnections.length > 1 && (
                    <span className="ml-1 text-xs">({getAllConnections.length})</span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Connection Settings</TooltipContent>
            </Tooltip>
            {connectionsOpen && (
              <div className="fixed top-4 right-4 z-[60] bg-white border rounded-lg shadow-lg w-96">
                <div className="space-y-2 p-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Connections</label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => setConnectionsOpen(false)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {getAllConnections.length === 0 ? (
                      <div className="text-sm text-muted-foreground py-2">No connections</div>
                    ) : (
                      getAllConnections.map((connInfo, index) => {
                        const hasArrow = connInfo.connection.arrow === true || connInfo.connection.toArrow === true;
                        
                        // Get the actual connection color using the same inheritance logic as the rendered connection
                        const fromNode = diagramData?.nodes.find(n => n.id === connInfo.connection.from) || 
                                        diagramData?.zones?.find(z => z.id === connInfo.connection.from);
                        const toNode = diagramData?.nodes.find(n => n.id === connInfo.connection.to) || 
                                      diagramData?.zones?.find(z => z.id === connInfo.connection.to);
                        
                        const connectionColor = connInfo.connection.color || 
                                              toNode?.lineColor || 
                                              fromNode?.lineColor || 
                                              '#6b7280';
                        
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

                        // Debounced connection color change
                        const handleConnectionColorChange = (color: string, immediate = false) => {
                          if (connectionColorTimeoutRef.current) {
                            clearTimeout(connectionColorTimeoutRef.current);
                          }
                          
                          const updateColor = () => {
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
                          
                          if (immediate) {
                            updateColor();
                          } else {
                            connectionColorTimeoutRef.current = setTimeout(updateColor, 150);
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
                            className={`flex flex-col gap-2 p-2 rounded-md border transition-all ${
                              dragOverIndex === index 
                                ? 'border-primary bg-primary/10 scale-105' 
                                : 'border-border hover:bg-accent/20'
                            } ${draggedConnectionIndex === index ? 'opacity-50' : ''}`}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDragEnter={(e) => handleDragEnter(e, index)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, index)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <div 
                                  className="cursor-grab active:cursor-grabbing p-1 hover:bg-accent/50 rounded"
                                  draggable
                                  onDragStart={(e) => {
                                    e.stopPropagation();
                                    handleDragStart(e, index);
                                  }}
                                  onDragEnd={(e) => {
                                    e.stopPropagation();
                                    handleDragEnd(e);
                                  }}
                                >
                                  <GripHorizontal className="h-3 w-3 text-muted-foreground" />
                                </div>
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
                                  onChange={(e) => handleConnectionColorChange((e.target as HTMLInputElement).value)}
                                  onMouseUp={(e) => handleConnectionColorChange((e.target as HTMLInputElement).value, true)}
                                  onBlur={(e) => handleConnectionColorChange((e.target as HTMLInputElement).value, true)}
                                  className="h-7 w-12 p-1 cursor-pointer shrink-0"
                                  title="Pick color"
                                  style={{ 
                                    backgroundColor: connectionColor,
                                    borderColor: connectionColor === '#6b7280' ? '#d1d5db' : connectionColor
                                  }}
                                />
                                <Input
                                  type="text"
                                  value={connectionColor}
                                  onChange={(e) => handleConnectionColorChange((e.target as HTMLInputElement).value)}
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
              </div>
            )}
          </>
        )}



        {/* Text Styling Button */}
        {selectedItem && (isNode || isZone) && (
          <Popover open={textStylingOpen} onOpenChange={handleTextStylingOpenChange}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    <Type className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Text Styling</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-80 p-0" align="start">
              <TextStylingPanel
                styling={getCurrentTextStyling}
                onStylingChange={handleTextStylingChange}
                onReset={handleTextStylingReset}
                selectedItem={selectedItem}
                selectedItemIds={selectedItemIds}
                textPosition={selectedItem?.textPosition}
                onTextPositionChange={handleTextPositionChange}
              />
            </PopoverContent>
          </Popover>
        )}

        {/* Visual Styling Button */}
        {selectedItem && (isNode || isZone) && (
          <Popover open={visualStylingOpen} onOpenChange={handleVisualStylingOpenChange}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    <Palette className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Visual Styling</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-80 p-0" align="start">
              <VisualStylingPanel
                styling={getCurrentVisualStyling}
                onStylingChange={handleVisualStylingChange}
                onReset={handleVisualStylingReset}
                selectedItemIds={selectedItemIds}
              />
            </PopoverContent>
          </Popover>
        )}



        {/* Text Placement for Shapes */}
        {isShapeNode && (
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    <AlignVerticalJustifyCenter className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Text Placement</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-48">
              <div className="space-y-2">
                <label className="text-sm font-medium">Text Placement</label>
                <Select
                  value={(selectedItem as any).textPosition || 'under'}
                  onValueChange={handleShapeTextPlacementChange}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="above">
                      <div className="flex items-center gap-2">
                        <AlignVerticalJustifyStart className="h-4 w-4" />
                        <span>Above</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="center">
                      <div className="flex items-center gap-2">
                        <AlignVerticalJustifyCenter className="h-4 w-4" />
                        <span>Middle</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="under">
                      <div className="flex items-center gap-2">
                        <AlignVerticalJustifyEnd className="h-4 w-4" />
                        <span>Below</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </PopoverContent>
          </Popover>
        )}









        {/* Orientation (Groups only) */}
        {isZone && (
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
        {isZone && (
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
            <PopoverContent className="w-56">
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
                    <div className="max-h-60 overflow-y-auto">
                      {/* Inline Positions */}
                      <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Inline (Border)</div>
                      <SelectItem value="inline-top">Inline Top</SelectItem>
                      <SelectItem value="inline-bottom">Inline Bottom</SelectItem>
                      <SelectItem value="inline-left">Inline Left</SelectItem>
                      <SelectItem value="inline-right">Inline Right</SelectItem>
                      
                      {/* Outside Positions */}
                      <div className="px-2 py-1 text-xs font-semibold text-muted-foreground mt-2">Outside</div>
                      <SelectItem value="outside-top">Outside Top</SelectItem>
                      <SelectItem value="outside-bottom">Outside Bottom</SelectItem>
                      <SelectItem value="outside-left">Outside Left</SelectItem>
                      <SelectItem value="outside-right">Outside Right</SelectItem>
                      
                      {/* Traditional Positions */}
                      <div className="px-2 py-1 text-xs font-semibold text-muted-foreground mt-2">Traditional</div>
                      <SelectItem value="top-left">Top Left</SelectItem>
                      <SelectItem value="top-center">Top Center</SelectItem>
                      <SelectItem value="top-right">Top Right</SelectItem>
                      <SelectItem value="bottom-left">Bottom Left</SelectItem>
                      <SelectItem value="bottom-center">Bottom Center</SelectItem>
                      <SelectItem value="bottom-right">Bottom Right</SelectItem>
                      
                      {/* Inside Position */}
                      <div className="px-2 py-1 text-xs font-semibold text-muted-foreground mt-2">Inside</div>
                      <SelectItem value="inside">Inside Zone</SelectItem>
                    </div>
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
        {isZone && (selectedItem.orientation === 'horizontal' || selectedItem.orientation === 'square') && (
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
        {(isZone || isTextNode  || isTextboxNode) && (
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
        {(isNode || isZone) && (
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
                    Vertically
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start h-8 px-2"
                    onClick={() => onAlignObjects?.('distribute-h')}
                  >
                    <AlignCenter className="h-4 w-4 mr-2" />
                    Horizontally
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Rendering Order Controls */}
        {(isNode || isZone) && (
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    <ArrowUp className="h-4 w-4" />
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Rendering Order</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-48">
              <div className="space-y-2">
                <label className="text-sm font-medium">Rendering Order</label>
                <div className="space-y-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start h-8 px-2"
                    onClick={() => {
                      if (onDiagramDataUpdate && diagramData) {
                        const { moveItemToFront } = require('@/lib/rendering-order-utils');
                        const updatedData = moveItemToFront(diagramData, selectedItem.id, selectedItem.itemType);
                        onDiagramDataUpdate(updatedData);
                      }
                    }}
                  >
                    <ChevronUp className="h-4 w-4 mr-2" />
                    Move to Front
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start h-8 px-2"
                    onClick={() => {
                      if (onDiagramDataUpdate && diagramData) {
                        const { moveItemOneForward } = require('@/lib/rendering-order-utils');
                        const updatedData = moveItemOneForward(diagramData, selectedItem.id, selectedItem.itemType);
                        onDiagramDataUpdate(updatedData);
                      }
                    }}
                  >
                    <ArrowUp className="h-4 w-4 mr-2" />
                    Move One Forward
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start h-8 px-2"
                    onClick={() => {
                      if (onDiagramDataUpdate && diagramData) {
                        const { moveItemOneBack } = require('@/lib/rendering-order-utils');
                        const updatedData = moveItemOneBack(diagramData, selectedItem.id, selectedItem.itemType);
                        onDiagramDataUpdate(updatedData);
                      }
                    }}
                  >
                    <ArrowDown className="h-4 w-4 mr-2" />
                    Move One Back
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start h-8 px-2"
                    onClick={() => {
                      if (onDiagramDataUpdate && diagramData) {
                        const { moveItemToBack } = require('@/lib/rendering-order-utils');
                        const updatedData = moveItemToBack(diagramData, selectedItem.id, selectedItem.itemType);
                        onDiagramDataUpdate(updatedData);
                      }
                    }}
                  >
                    <ChevronDown className="h-4 w-4 mr-2" />
                    Move to Back
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

