"use client";
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import Draggable from 'react-draggable';
import { createPortal } from 'react-dom';
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
  ChevronUp,
  Tag,
  Minus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Slider } from '@/components/ui/slider';

import { TextStylingPanel } from './text-styling-panel';
import { VisualStylingPanel } from './visual-styling-panel';
import { LineStylingPanel } from './line-styling-panel';
import type { SelectedItem } from '../diagram-editor';
import type { DiagramData, DiagramNodeData, DiagramZoneData } from '@/lib/types';
import { DiagramTheme } from '@/lib/theme-types';
import { themeManager } from '@/lib/theme-manager';
import { extractTextStylingFromNode, extractTextStylingFromGroup, applyTextStylingToZone, applyTextStylingToNode } from '@/lib/text-styling';
import { isShapeNodeType } from '@/lib/utils';
import { extractVisualStylingFromNode, extractVisualStylingFromGroup } from '@/lib/visual-styling';
import { extractLineStylingFromNode, applyLineStylingToNode } from '@/lib/line-styling';

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
  lineStylingPanelOpen?: boolean;
  connectionSettingsPanelOpen?: boolean;
  onTextStylingPanelOpenChange?: (open: boolean) => void;
  onVisualStylingPanelOpenChange?: (open: boolean) => void;
  onLineStylingPanelOpenChange?: (open: boolean) => void;
  onConnectionSettingsPanelOpenChange?: (open: boolean) => void;
  isReadOnly?: boolean;
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
  lineStylingPanelOpen = false,
  connectionSettingsPanelOpen = false,
  onTextStylingPanelOpenChange,
  onVisualStylingPanelOpenChange,
  onLineStylingPanelOpenChange,
  onConnectionSettingsPanelOpenChange,
  isReadOnly = false,
}: ContextToolbarProps) {
  const [labelOpen, setLabelOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const [textStylingOpen, setTextStylingOpen] = useState(false);
  const [visualStylingOpen, setVisualStylingOpen] = useState(false);
  const [lineStylingOpen, setLineStylingOpen] = useState(false);
  const [draggedConnectionIndex, setDraggedConnectionIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [connectionsPosition, setConnectionsPosition] = useState({ x: 0, y: 0 });
  const [isConnectionsMounted, setIsConnectionsMounted] = useState(false);
  const textStylingPanelRef = useRef<HTMLDivElement>(null);
  const connectionsPanelRef = useRef(null);
  const visualStylingPanelRef = useRef<HTMLDivElement>(null);
  const lineStylingPanelRef = useRef<HTMLDivElement>(null);
  const textStylingButtonRef = useRef<HTMLButtonElement>(null);
  const visualStylingButtonRef = useRef<HTMLButtonElement>(null);
  const lineStylingButtonRef = useRef<HTMLButtonElement>(null);

  const handleTextStylingOpenChange = useCallback((open: boolean) => {
    setTextStylingOpen(open);
    onTextStylingPanelOpenChange?.(open);
  }, [onTextStylingPanelOpenChange]);

  const handleVisualStylingOpenChange = useCallback((open: boolean) => {
    setVisualStylingOpen(open);
    onVisualStylingPanelOpenChange?.(open);
  }, [onVisualStylingPanelOpenChange]);

  const handleLineStylingOpenChange = useCallback((open: boolean) => {
    setLineStylingOpen(open);
    onLineStylingPanelOpenChange?.(open);
  }, [onLineStylingPanelOpenChange]);

  // Sync external panel state with internal state - but only when explicitly triggered
  // Don't auto-open when external state changes - only sync when opening, not when closing
  useEffect(() => {
    if (textStylingPanelOpen && !textStylingOpen) {
      setTextStylingOpen(true);
    }
  }, [textStylingPanelOpen, textStylingOpen]);

  useEffect(() => {
    if (visualStylingPanelOpen && !visualStylingOpen) {
      setVisualStylingOpen(true);
    }
  }, [visualStylingPanelOpen, visualStylingOpen]);

  useEffect(() => {
    if (lineStylingPanelOpen && !lineStylingOpen) {
      setLineStylingOpen(true);
    }
  }, [lineStylingPanelOpen, lineStylingOpen]);

  // Close panels when selectedItem becomes null (deselecting)
  useEffect(() => {
    if (!selectedItem) {
      if (textStylingOpen) {
        handleTextStylingOpenChange(false);
      }
      if (visualStylingOpen) {
        handleVisualStylingOpenChange(false);
      }
      if (lineStylingOpen) {
        handleLineStylingOpenChange(false);
      }
    }
  }, [selectedItem, textStylingOpen, visualStylingOpen, lineStylingOpen, handleTextStylingOpenChange, handleVisualStylingOpenChange, handleLineStylingOpenChange]);

  // Click outside detection for text styling panel
  useEffect(() => {
    if (!textStylingOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Check if click is on the panel or button
      if (
        textStylingPanelRef.current?.contains(target) ||
        textStylingButtonRef.current?.contains(target)
      ) {
        return;
      }
      
      // Check if click is on a Radix Select dropdown (portaled to body)
      // Radix Select content has data-radix-select-content attribute
      if (target.closest('[data-radix-select-content]')) {
        return;
      }
      
      // Check if click is on a Radix Select viewport (the scrollable area)
      if (target.closest('[data-radix-select-viewport]')) {
        return;
      }
      
      // Check if click is on a Radix Select item
      if (target.closest('[data-radix-select-item]')) {
        return;
      }
      
      // If none of the above, close the panel
      handleTextStylingOpenChange(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [textStylingOpen, handleTextStylingOpenChange]);

  // Click outside detection for visual styling panel
  useEffect(() => {
    if (!visualStylingOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Check if click is on the panel or button
      if (
        visualStylingPanelRef.current?.contains(target) ||
        visualStylingButtonRef.current?.contains(target)
      ) {
        return;
      }
      
      // Check if click is on a Radix Select dropdown (portaled to body)
      // Radix Select content has data-radix-select-content attribute
      if (target.closest('[data-radix-select-content]')) {
        return;
      }
      
      // Check if click is on a Radix Select viewport (the scrollable area)
      if (target.closest('[data-radix-select-viewport]')) {
        return;
      }
      
      // Check if click is on a Radix Select item
      if (target.closest('[data-radix-select-item]')) {
        return;
      }
      
      // If none of the above, close the panel
      handleVisualStylingOpenChange(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [visualStylingOpen, handleVisualStylingOpenChange]);

  // Click outside detection for line styling panel
  useEffect(() => {
    if (!lineStylingOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Check if click is on the panel or button
      if (
        lineStylingPanelRef.current?.contains(target) ||
        lineStylingButtonRef.current?.contains(target)
      ) {
        return;
      }
      
      // Check if click is on a Radix Select dropdown (portaled to body)
      if (target.closest('[data-radix-select-content]')) {
        return;
      }
      
      // Check if click is on a Radix Select viewport (the scrollable area)
      if (target.closest('[data-radix-select-viewport]')) {
        return;
      }
      
      // Check if click is on a Radix Select item
      if (target.closest('[data-radix-select-item]')) {
        return;
      }
      
      // If none of the above, close the panel
      handleLineStylingOpenChange(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [lineStylingOpen, handleLineStylingOpenChange]);

  useEffect(() => {
    setConnectionsOpen(connectionSettingsPanelOpen);
  }, [connectionSettingsPanelOpen]);

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

  const handleTagChange = (value: string) => {
    onItemUpdate?.({ ...selectedItem, tag: value } as SelectedItem);
  };

  const handleInfoChange = (value: string) => {
    onItemUpdate?.({ ...selectedItem, info: value } as SelectedItem);
  };

  // Debounced color change to prevent excessive updates during dragging
  const colorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Connection color timeout ref
  const connectionColorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
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
    // Check if multiple items are selected
    if (selectedItemIds && selectedItemIds.size > 1 && diagramData && onDiagramDataUpdate) {
      // Apply maxItemsPerRow change to all selected items
      const updatedDiagramData = { ...diagramData };
      
      // Update zones (only zones have maxItemsPerRow)
      if (updatedDiagramData.zones) {
        updatedDiagramData.zones = updatedDiagramData.zones.map(zone => {
          if (selectedItemIds.has(zone.id)) {
            return { ...zone, maxItemsPerRow: value };
          }
          return zone;
        });
      }
      
      onDiagramDataUpdate(updatedDiagramData);
    } else {
      // Single item selection - existing logic
      onItemUpdate?.({ ...selectedItem, maxItemsPerRow: value } as SelectedItem);
    }
  };

  const handleSizeModeChange = (value: 'auto' | 'custom') => {
    // Check if multiple items are selected
    if (selectedItemIds && selectedItemIds.size > 1 && diagramData && onDiagramDataUpdate) {
      // Apply sizeMode change to all selected items
      const updatedDiagramData = { ...diagramData };
      
      // Update zones (only zones have sizeMode)
      if (updatedDiagramData.zones) {
        updatedDiagramData.zones = updatedDiagramData.zones.map(zone => {
          if (selectedItemIds.has(zone.id)) {
            const updatedZone = { ...zone, sizeMode: value };
            // Set default dimensions if switching to custom without existing dimensions
            if (value === 'custom' && !zone.width && !zone.height) {
              (updatedZone as any).width = 300;
              (updatedZone as any).height = 220;
            }
            return updatedZone;
          }
          return zone;
        });
      }
      
      onDiagramDataUpdate(updatedDiagramData);
    } else {
      // Single item selection - existing logic
      const updatedItem = { ...selectedItem, sizeMode: value } as SelectedItem;
      if (value === 'custom' && !(selectedItem as any).width && !(selectedItem as any).height) {
        (updatedItem as any).width = 40;
        (updatedItem as any).height = 40;
      }
      onItemUpdate?.(updatedItem);
    }
  };

  const handleWidthChange = (value: number) => {
    // Check if multiple items are selected
    if (selectedItemIds && selectedItemIds.size > 1 && diagramData && onDiagramDataUpdate) {
      // Apply width change to all selected items
      const updatedDiagramData = { ...diagramData };
      
      // Update nodes
      updatedDiagramData.nodes = updatedDiagramData.nodes.map(node => {
        if (selectedItemIds.has(node.id)) {
          return { ...node, width: value };
        }
        return node;
      });
      
      // Update zones
      if (updatedDiagramData.zones) {
        updatedDiagramData.zones = updatedDiagramData.zones.map(zone => {
          if (selectedItemIds.has(zone.id)) {
            return { ...zone, width: value };
          }
          return zone;
        });
      }
      
      onDiagramDataUpdate(updatedDiagramData);
    } else {
      // Single item selection - existing logic
      onItemUpdate?.({ ...selectedItem, width: value } as SelectedItem);
    }
  };

  const handleHeightChange = (value: number) => {
    // Check if multiple items are selected
    if (selectedItemIds && selectedItemIds.size > 1 && diagramData && onDiagramDataUpdate) {
      // Apply height change to all selected items
      const updatedDiagramData = { ...diagramData };
      
      // Update nodes
      updatedDiagramData.nodes = updatedDiagramData.nodes.map(node => {
        if (selectedItemIds.has(node.id)) {
          return { ...node, height: value };
        }
        return node;
      });
      
      // Update zones
      if (updatedDiagramData.zones) {
        updatedDiagramData.zones = updatedDiagramData.zones.map(zone => {
          if (selectedItemIds.has(zone.id)) {
            return { ...zone, height: value };
          }
          return zone;
        });
      }
      
      onDiagramDataUpdate(updatedDiagramData);
    } else {
      // Single item selection - existing logic
      onItemUpdate?.({ ...selectedItem, height: value } as SelectedItem);
    }
  };

  const handleRotationChange = (value: string) => {
    const rotationValue = parseInt(value);
    
    // Check if multiple items are selected
    if (selectedItemIds && selectedItemIds.size > 1 && diagramData && onDiagramDataUpdate) {
      // Apply rotation change to all selected items
      const updatedDiagramData = { ...diagramData };
      
      // Update nodes
      updatedDiagramData.nodes = updatedDiagramData.nodes.map(node => {
        if (selectedItemIds.has(node.id)) {
          return { ...node, rotation: rotationValue };
        }
        return node;
      });
      
      // Update zones
      if (updatedDiagramData.zones) {
        updatedDiagramData.zones = updatedDiagramData.zones.map(zone => {
          if (selectedItemIds.has(zone.id)) {
            return { ...zone, rotation: rotationValue };
          }
          return zone;
        });
      }
      
      onDiagramDataUpdate(updatedDiagramData);
    } else {
      // Single item selection - existing logic
      onItemUpdate?.({ ...selectedItem, rotation: rotationValue } as SelectedItem);
    }
  };



  const handleOrientationChange = (value: 'square' | 'horizontal' | 'vertical') => {
    onItemUpdate?.({ ...selectedItem, orientation: value } as SelectedItem);
  };

  const handleTextPositionChange = (value: string) => {
    onItemUpdate?.({ ...selectedItem, textPosition: value as any } as SelectedItem);
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
      if (isNode) {
        // Use applyTextStylingToNode to properly merge styling for nodes
        const updatedNode = applyTextStylingToNode(selectedItem as any, styling);
        onItemUpdate?.({ ...updatedNode, itemType: 'node' } as SelectedItem);
      } else {
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

  const handleLineStylingChange = (styling: any) => {
    // Check if multiple items are selected
    if (selectedItemIds && selectedItemIds.size > 1 && diagramData && onDiagramDataUpdate) {
      // Apply styling change to all selected items
      const updatedDiagramData = { ...diagramData };
      
      // Update nodes (only line nodes)
      updatedDiagramData.nodes = updatedDiagramData.nodes.map(node => {
        if (selectedItemIds.has(node.id) && (node.type === 'generic.object.line' || node.type?.endsWith('.line'))) {
          return applyLineStylingToNode(node, styling);
        }
        return node;
      });
      
      onDiagramDataUpdate(updatedDiagramData);
    } else {
      // Single item selection - get fresh node data from diagramData to preserve startPos/endPos
      if (isNode && isLineNode && diagramData) {
        // Get the latest node data from diagramData to ensure we have current startPos/endPos
        const freshNode = diagramData.nodes.find(n => n.id === selectedItem.id);
        const nodeToUpdate = freshNode || selectedItem;
        const updatedNode = applyLineStylingToNode(nodeToUpdate as any, styling);
        onItemUpdate?.({ ...updatedNode, itemType: 'node' } as SelectedItem);
      }
    }
  };

  const handleLineStylingReset = () => {
    // Reset to default line styling
    const defaultStyling = {
      lineThickness: undefined,
      startCap: undefined,
      endCap: undefined,
      lineColor: undefined,
      lineTextVerticalPosition: undefined,
      fontFamily: undefined,
      fontSize: undefined,
      fontWeight: undefined,
      fontStyle: undefined,
      textDecoration: undefined,
      textTransform: undefined,
      letterSpacing: undefined,
      lineHeight: undefined,
      textOpacity: undefined,
      textColor: undefined,
      textJustify: undefined,
      textVerticalPosition: undefined
    };
    
    // Check if multiple items are selected
    if (selectedItemIds && selectedItemIds.size > 1 && diagramData && onDiagramDataUpdate) {
      // Apply reset to all selected items
      const updatedDiagramData = { ...diagramData };
      
      // Update nodes (only line nodes)
      updatedDiagramData.nodes = updatedDiagramData.nodes.map(node => {
        if (selectedItemIds.has(node.id) && (node.type === 'generic.object.line' || node.type?.endsWith('.line'))) {
          return applyLineStylingToNode(node, defaultStyling);
        }
        return node;
      });
      
      onDiagramDataUpdate(updatedDiagramData);
    } else {
      // Single item selection
      if (isNode && isLineNode) {
        const updatedNode = applyLineStylingToNode(selectedItem as any, defaultStyling);
        onItemUpdate?.({ ...updatedNode, itemType: 'node' } as SelectedItem);
      }
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
      }
    }
    
    if (isNode) {
      return extractTextStylingFromNode(currentItem as any);
    }
    return {};
  }, [selectedItem, isNode, selectedItemIds, diagramData]);

  const getCurrentVisualStyling = useMemo(() => {
    if (!selectedItem || !diagramData) return {};
    
    // In multi-select scenarios, get fresh data from diagramData to avoid stale references
    let currentItem = selectedItem;
    if (selectedItemIds && selectedItemIds.size > 1) {
      // Find the current version of the selected item in diagramData
      if (isNode) {
        const foundNode = diagramData.nodes.find(n => n.id === selectedItem.id);
        currentItem = foundNode ? { ...foundNode, itemType: 'node' as const } : selectedItem;
      }
    }
    
    if (isNode) {
      return extractVisualStylingFromNode(currentItem as any);
    }
    return {};
  }, [selectedItem, isNode, selectedItemIds, diagramData]);
  const isTextNode = isNode && selectedItem.type?.startsWith('generic.text');
  const isTextboxNode = isNode && selectedItem.type === 'generic.text.textbox';
  const isPlainTextNode = isNode && selectedItem.type === 'generic.text.text';
    const isShapeNode = isNode && (selectedItem.type === 'generic.object.square' ||
                                   selectedItem.type === 'generic.object.circle' ||
                                   selectedItem.type === 'generic.object.point' ||
                                   selectedItem.type === 'generic.object.rectangle' ||
                                   selectedItem.type === 'generic.object.rounded-rectangle' ||
                                   selectedItem.type === 'generic.object.triangle' ||
                                   selectedItem.type === 'generic.object.star' ||
                                   selectedItem.type === 'generic.object.cloud' ||
                                   selectedItem.type === 'generic.object.parallelogram' ||
                                   selectedItem.type === 'generic.object.trapezoid' ||
                                   selectedItem.type === 'generic.object.kite' ||
                                   selectedItem.type === 'generic.object.hexagon' ||
                                   selectedItem.type === 'generic.object.pentagon' ||
                                   selectedItem.type === 'generic.object.octagon' ||
                                   selectedItem.type === 'generic.object.jigsaw' ||
                                   selectedItem.type === 'generic.object.arrowhead' ||
                                   selectedItem.type === 'generic.object.chevron' ||
                                   selectedItem.type === 'generic.object.line' ||
                                   selectedItem.type?.endsWith('.square') ||
                                   selectedItem.type?.endsWith('.circle') ||
                                   selectedItem.type?.endsWith('.point') ||
                                   selectedItem.type?.endsWith('.rectangle') ||
                                   selectedItem.type?.endsWith('.rounded-rectangle') ||
                                   selectedItem.type?.endsWith('.triangle') ||
                                   selectedItem.type?.endsWith('.star') ||
                                   selectedItem.type?.endsWith('.cloud') ||
                                   selectedItem.type?.endsWith('.parallelogram') ||
                                   selectedItem.type?.endsWith('.trapezoid') ||
                                   selectedItem.type?.endsWith('.kite') ||
                                   selectedItem.type?.endsWith('.hexagon') ||
                                   selectedItem.type?.endsWith('.pentagon') ||
                                   selectedItem.type?.endsWith('.octagon') ||
                                   selectedItem.type?.endsWith('.jigsaw') ||
                                   selectedItem.type?.endsWith('.arrowhead') ||
                                   selectedItem.type?.endsWith('.chevron') ||
                                   selectedItem.type?.endsWith('.line'));
    const isLineNode = isNode && (selectedItem.type === 'generic.object.line' || selectedItem.type?.endsWith('.line'));

  const getCurrentLineStyling = useMemo(() => {
    if (!selectedItem || !diagramData) return {};
    
    // Only for line nodes
    if (!isNode || !isLineNode) return {};
    
    // In multi-select scenarios, get fresh data from diagramData to avoid stale references
    let currentItem = selectedItem;
    if (selectedItemIds && selectedItemIds.size > 1) {
      const foundNode = diagramData.nodes.find(n => n.id === selectedItem.id);
      currentItem = foundNode ? { ...foundNode, itemType: 'node' as const } : selectedItem;
    }
    
    return extractLineStylingFromNode(currentItem as any);
  }, [selectedItem, isNode, isLineNode, selectedItemIds, diagramData]);
  

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
      {isReadOnly && selectedItem ? (
        <div className="flex items-center gap-2 px-3 border-l border-border min-h-[2.5rem] shrink-0 bg-muted/30">
          <div className="flex flex-col">
            <span className="text-sm font-medium">{selectedItem.label || 'Unnamed Item'}</span>
            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
              {selectedItem.info || 'No description'}
            </span>
          </div>
          <span className="text-xs text-muted-foreground px-2 border-l border-border">
            {selectedItem.itemType === 'node' ? 'Node' : 'Connection'}
          </span>
        </div>
      ) : (
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

        {/* Tag Editor - Show for all shapes except lines */}
        {isShapeNode && !isLineNode && (
          <Popover open={tagOpen} onOpenChange={setTagOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    <Tag className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Tag</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-64">
              <div className="space-y-2">
                <label className="text-sm font-medium">Tag</label>
                <Input
                  value={(selectedItem as any).tag || ''}
                  onChange={(e) => handleTagChange(e.target.value)}
                  placeholder="Enter tag"
                  onBlur={() => setTagOpen(false)}
                />
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Description Editor - Hide for lines */}
        {!isLineNode && (
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
        )}

        {/* Connect Button - Hide for lines */}
        {isNode && !isLineNode && (
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
        {isNode && getAllConnections.length > 0 && (
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
              <Draggable 
                handle=".connections-handle" 
                nodeRef={connectionsPanelRef}
                defaultPosition={connectionsPosition}
                onStop={(e, data) => {
                  setConnectionsPosition({ x: data.x, y: data.y });
                }}
              >
                <div ref={connectionsPanelRef} className="fixed top-20 right-20 z-50 w-80 bg-white border rounded-lg shadow-lg">
                <div className="connections-handle flex items-center justify-between p-4 border-b cursor-move">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">Connections</h3>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setConnectionsOpen(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div className="max-h-96 overflow-y-auto space-y-2 p-4">
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
              style={{ pointerEvents: 'auto' }}
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
              </Draggable>
            )}
          </>
        )}



        {/* Text Styling Button */}
        {selectedItem && isNode && !isLineNode && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  ref={textStylingButtonRef}
                  variant="ghost" 
                  size="sm" 
                  className="h-8 px-2"
                  onClick={() => handleTextStylingOpenChange(!textStylingOpen)}
                >
                  <Type className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Text Styling</TooltipContent>
            </Tooltip>
            {textStylingOpen && typeof window !== 'undefined' && createPortal(
              <div 
                ref={textStylingPanelRef}
                className="fixed top-0 left-0 h-screen z-[60]"
                style={{ pointerEvents: 'auto' }}
              >
                <TextStylingPanel
                  styling={getCurrentTextStyling}
                  onStylingChange={handleTextStylingChange}
                  onReset={handleTextStylingReset}
                  selectedItem={selectedItem}
                  selectedItemIds={selectedItemIds}
                  textPosition={selectedItem?.textPosition}
                  onTextPositionChange={handleTextPositionChange}
                />
              </div>,
              document.body
            )}
          </>
        )}

        {/* Visual Styling Button */}
        {selectedItem && isNode && !isLineNode && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  ref={visualStylingButtonRef}
                  variant="ghost" 
                  size="sm" 
                  className="h-8 px-2"
                  onClick={() => handleVisualStylingOpenChange(!visualStylingOpen)}
                >
                  <Palette className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Visual Styling</TooltipContent>
            </Tooltip>
            {visualStylingOpen && typeof window !== 'undefined' && createPortal(
              <div 
                ref={visualStylingPanelRef}
                className="fixed top-0 left-0 h-screen z-[60]"
                style={{ pointerEvents: 'auto' }}
              >
                <VisualStylingPanel
                  styling={getCurrentVisualStyling}
                  onStylingChange={handleVisualStylingChange}
                  onReset={handleVisualStylingReset}
                  selectedItemIds={selectedItemIds}
                  tag={(selectedItem as any)?.tag}
                  tagPosition={(selectedItem as any)?.tagPosition}
                  onTagChange={(tag) => onItemUpdate?.({ ...selectedItem, tag } as SelectedItem)}
                  onTagPositionChange={(tagPosition) => onItemUpdate?.({ ...selectedItem, tagPosition } as SelectedItem)}
                />
              </div>,
              document.body
            )}
          </>
        )}

        {/* Line Styling Button - Only for line nodes */}
        {selectedItem && isLineNode && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  ref={lineStylingButtonRef}
                  variant="ghost" 
                  size="sm" 
                  className="h-8 px-2"
                  onClick={() => handleLineStylingOpenChange(!lineStylingOpen)}
                >
                  <Minus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Line Styling</TooltipContent>
            </Tooltip>
            {lineStylingOpen && typeof window !== 'undefined' && createPortal(
              <div 
                ref={lineStylingPanelRef}
                className="fixed top-0 left-0 h-screen z-[60]"
                style={{ pointerEvents: 'auto' }}
              >
                <LineStylingPanel
                  styling={getCurrentLineStyling}
                  onStylingChange={handleLineStylingChange}
                  onReset={handleLineStylingReset}
                  selectedItem={selectedItem}
                  selectedItemIds={selectedItemIds}
                  onClose={() => handleLineStylingOpenChange(false)}
                />
              </div>,
              document.body
            )}
          </>
        )}



        {/* Text Placement for Shapes */}
        {isShapeNode && !isLineNode && (
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

        {/* Line Endpoint Controls */}
        {/* Line Endpoints - Hide for lines (endpoints are controlled via handles on canvas) */}
        {false && isLineNode && (
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="4" y1="12" x2="20" y2="12" />
                      <polygon points="20,12 16,10 16,14" fill="currentColor" />
                    </svg>
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Line Endpoints</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-56">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Start Cap</label>
                  <Select
                    value={(selectedItem as any).startCap || 'none'}
                    onValueChange={(value) => {
                      onItemUpdate?.({ 
                        ...selectedItem, 
                        startCap: value as 'none' | 'arrow' | 'dot' | 'square'
                      } as SelectedItem);
                    }}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="arrow">Arrow</SelectItem>
                      <SelectItem value="dot">Dot</SelectItem>
                      <SelectItem value="square">Square</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">End Cap</label>
                  <Select
                    value={(selectedItem as any).endCap || 'arrow'}
                    onValueChange={(value) => {
                      onItemUpdate?.({ 
                        ...selectedItem, 
                        endCap: value as 'none' | 'arrow' | 'dot' | 'square'
                      } as SelectedItem);
                    }}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="arrow">Arrow</SelectItem>
                      <SelectItem value="dot">Dot</SelectItem>
                      <SelectItem value="square">Square</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Line Thickness</label>
                  <input
                    type="number"
                    className="w-full h-8 px-2 rounded border"
                    value={(selectedItem as any).lineThickness || 2.5}
                    min={0.5}
                    max={10}
                    step={0.5}
                    onChange={(e) => {
                      const thickness = parseFloat(e.target.value);
                      if (!isNaN(thickness)) {
                        onItemUpdate?.({ 
                          ...selectedItem, 
                          lineThickness: thickness
                        } as SelectedItem);
                      }
                    }}
                  />
                </div>
                
                {/* Text Position Controls */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Text Position</label>
                  <Select
                    value={(selectedItem as any).lineTextVerticalPosition || 'middle'}
                    onValueChange={(value: 'above' | 'below' | 'middle') => {
                      onItemUpdate?.({
                        ...selectedItem,
                        lineTextVerticalPosition: value
                      } as SelectedItem);
                    }}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="above">Above Line</SelectItem>
                      <SelectItem value="middle">On Line</SelectItem>
                      <SelectItem value="below">Below Line</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Text Position Along Line (%)</label>
                  <input
                    type="number"
                    className="w-full h-8 px-2 rounded border"
                    value={(selectedItem as any).lineTextPosition || 50}
                    min={0}
                    max={100}
                    step={5}
                    onChange={(e) => {
                      const value = Math.max(0, Math.min(100, parseInt(e.target.value) || 50));
                      onItemUpdate?.({
                        ...selectedItem,
                        lineTextPosition: value
                      } as SelectedItem);
                    }}
                  />
                  <p className="text-xs text-muted-foreground">0% = start, 50% = middle, 100% = end</p>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}









        {/* Orientation (Groups only) - zones removed */}
        {false && selectedItem && (
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
                  value={((selectedItem as any).orientation as string) || 'square'} 
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
        {false && (
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
                  value={String((selectedItem as any)?.textPosition ?? '')} 
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

        {/* Edge Position (Nodes in groups) - Hide for lines */}
        {selectedItem && isNode && !isTextTypeNode && !isLineNode && (
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
                  value={(selectedItem as DiagramNodeData).edgePosition || 'none'} 
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

        {/* Max Items Per Row (Groups) - zones removed */}
        {false && (
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
        {(isTextNode || isTextboxNode) && (
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



        {/* Rotation (All Nodes and Groups, except lines) */}
        {isNode && !isLineNode && (
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




        {/* Remove Icon Background (Non-text, non-shape nodes) */}
        {isNode && !isTextNode && !isShapeNode && (
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
        {isNode && (
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
      )}
    </TooltipProvider>
  );
}

