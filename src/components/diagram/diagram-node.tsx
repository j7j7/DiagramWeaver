"use client";

import React, { useState, useRef, useEffect } from "react";
import { useDrag } from 'react-dnd';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ResourceIcon } from "./resource-icon";
import type { DiagramNodeData } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ItemTypes } from "../editor/draggable-item";
import { getTextStylingCSS, extractTextStylingFromNode } from "@/lib/text-styling";

const NODE_WIDTH = 80;
const BASE_NODE_HEIGHT = 80;
const TEXT_NODE_HEIGHT = 40; // Height for text-only nodes
const EXTRA_LINE_HEIGHT = 20; // Additional height per extra line of text

// Helper function to get gradient CSS with angle
const getGradientWithAngle = (colors: string[], angle: number = 135) => {
  // Convert angle to CSS gradient direction
  let gradientDirection = '';
  switch (angle) {
    case 0:
      gradientDirection = 'to right';
      break;
    case 45:
      gradientDirection = 'to bottom right';
      break;
    case -45:
      gradientDirection = 'to top right';
      break;
    case 90:
      gradientDirection = 'to bottom';
      break;
    case 180:
      gradientDirection = 'to left';
      break;
    default:
      gradientDirection = `${angle}deg`;
  }
  // Ensure unique string by including angle in all cases
  const gradient = `linear-gradient(${gradientDirection}, ${colors[0]}, ${colors[1]})`;
  return gradient;
};

// Helper function to convert gradient angle to SVG coordinates
const getGradientCoordinates = (angle: number = 135) => {
  // CSS gradient angles: 0° = to right, 90° = to bottom, -45° = to top right
  // Convert CSS angle to SVG coordinates (where 0° points right)
  const radians = (angle * Math.PI) / 180;
  
  // Calculate end point coordinates
  const x2 = 50 + 50 * Math.cos(radians);
  const y2 = 50 + 50 * Math.sin(radians);
  
  // Calculate start point (opposite direction)
  const x1 = 50 - 50 * Math.cos(radians);
  const y1 = 50 - 50 * Math.sin(radians);
  
  return {
    x1: `${x1}%`,
    y1: `${y1}%`,
    x2: `${x2}%`,
    y2: `${y2}%`
  };
};

// Helper function to determine if a color is dark or light
const isColorDark = (color: string): boolean => {
  // Convert hex to RGB
  let r = 0, g = 0, b = 0;
  
  if (color.startsWith('#')) {
    const hex = color.replace('#', '');
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    }
  } else if (color.startsWith('rgb')) {
    const matches = color.match(/\d+/g);
    if (matches) {
      r = parseInt(matches[0]);
      g = parseInt(matches[1]);
      b = parseInt(matches[2]);
    }
  }
  
  // Calculate relative luminance (perceived brightness)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return true if dark (luminance < 0.5)
  return luminance < 0.5;
};

// Helper function to get text color based on background
const getTextColorForBackground = (backgroundColor: string, customTextColor?: string): string => {
  if (customTextColor) return customTextColor;
  return isColorDark(backgroundColor) ? '#ffffff' : '#000000';
};

// Helper function to get text styling CSS for a node
const getTextStylingForNode = (node: DiagramNodeData) => {
  const textStyling = extractTextStylingFromNode(node);
  return getTextStylingCSS(textStyling);
};

interface DiagramNodeProps {
  node: DiagramNodeData & { x: number; y: number };
  isSelected?: boolean;
  isTargetable?: boolean;
  isHighlighted?: boolean;
  isMultiSelected?: boolean;
  onClick?: (e: React.MouseEvent, node: DiagramNodeData) => void;
  onContextMenu?: (e: React.MouseEvent, node: DiagramNodeData) => void;
  onLabelUpdate?: (nodeId: string, newLabel: string) => void;
  onResize?: (nodeId: string, newWidth: number, newHeight: number) => void;
  onPositionUpdate?: (nodeId: string, x: number, y: number) => void;
  onDraggingChange?: (isDragging: boolean) => void;
  hoverEnabled?: boolean;
}

export function DiagramNode({ node, isSelected, isTargetable, isHighlighted, isMultiSelected, onClick, onContextMenu, onLabelUpdate, onResize, onPositionUpdate, onDraggingChange, hoverEnabled = true }: DiagramNodeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [editText, setEditText] = useState(node.label || '');
  
  // Resize state
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<'right' | 'bottom' | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const resizeStartPos = useRef<{ x: number; y: number; startWidth: number; startHeight: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleLabelDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingLabel(true);
    setEditText(node.label || '');
    setTimeout(() => {
      const ref = isTextboxNode ? textareaRef.current : inputRef.current;
      if (ref) {
        ref.focus();
        ref.select();
      }
    }, 0);
  };

  const handleLabelSubmit = () => {
    if (onLabelUpdate && editText.trim() !== node.label) {
      onLabelUpdate(node.id, editText.trim());
    }
    setIsEditingLabel(false);
  };

  const handleLabelKeyDown = (e: React.KeyboardEvent, isMultiline: boolean = false) => {
    if (e.key === 'Enter') {
      if (isMultiline) {
        // For multiline inputs, only submit on Ctrl+Enter or Cmd+Enter
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          handleLabelSubmit();
        }
        // Otherwise, allow Enter to create a new line (default textarea behavior)
      } else {
        // For single-line inputs, Enter submits
        handleLabelSubmit();
      }
    } else if (e.key === 'Escape') {
      setIsEditingLabel(false);
      setEditText(node.label || '');
    } else if (!isEditingLabel && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      // Handle keyboard navigation for selected nodes
      e.preventDefault();
      const gridSize = 20;
      let newX = node.x || 0;
      let newY = node.y || 0;
      
      switch (e.key) {
        case 'ArrowUp':
          newY -= gridSize;
          break;
        case 'ArrowDown':
          newY += gridSize;
          break;
        case 'ArrowLeft':
          newX -= gridSize;
          break;
        case 'ArrowRight':
          newX += gridSize;
          break;
      }
      
      // Update node position through parent
      if (onPositionUpdate) {
        onPositionUpdate(node.id, newX, newY);
      }
    }
  };
  
  // Calculate dynamic height based on label length and node type
  const calculateNodeHeight = (label: string = '', nodeType: string, sizeMode?: string, customHeight?: number) => {
    // Use custom height if sizeMode is 'custom' and customHeight is provided
    if (sizeMode === 'custom' && customHeight) {
      return customHeight;
    }
    
    // Handle larger multi-line text boxes
    if (nodeType === 'generic.text.textbox') {
      const maxCharsPerLine = 30; // More characters fit in wider textbox
      const lines = Math.max(1, Math.ceil(label.length / maxCharsPerLine)); // Minimum 1 line
      return 40 + ((lines - 1) * EXTRA_LINE_HEIGHT); // Start with 40px height
    } else if (nodeType === 'generic.text.textbox') {
      const maxCharsPerLine = 25; // Characters fit in textbox
      const lines = Math.max(1, Math.ceil(label.length / maxCharsPerLine)); // Minimum 1 line for custom sizing
      return 100 + ((lines - 1) * EXTRA_LINE_HEIGHT); // Start with 100px height
    } else if (nodeType === 'generic.text.text') {
      const maxCharsPerLine = 20; // More characters fit in text-only nodes
      const lines = Math.ceil(label.length / maxCharsPerLine);
      return TEXT_NODE_HEIGHT + ((lines - 1) * EXTRA_LINE_HEIGHT);
    } else {
      const maxCharsPerLine = 12; // Approximate characters that fit in node width
      const lines = Math.ceil(label.length / maxCharsPerLine);
      return BASE_NODE_HEIGHT + ((lines - 1) * EXTRA_LINE_HEIGHT);
    }
  };
  
   // Helper function to get text justification class
   const getTextJustifyClass = (justify?: string) => {
     switch (justify) {
       case 'left':
         return 'text-left';
       case 'center':
         return 'text-center';
       case 'right':
         return 'text-right';
       case 'full':
         return 'text-justify';
       default:
         return 'text-center';
     }
   };
   
   // Helper function to get vertical positioning class
   const getVerticalPositionClass = (position?: string) => {
     switch (position) {
       case 'top':
         return 'items-start';
       case 'middle':
         return 'items-center';
       case 'bottom':
         return 'items-end';
       default:
         return 'items-center';
     }
   };
  
  const isTextNode = node.type === 'generic.text.text';
  const isTextboxNode = node.type === 'generic.text.textbox';
  const isShapeNode = node.type === 'generic.object.square' || node.type === 'generic.object.circle' || node.type === 'generic.object.point' || node.type === 'generic.object.rectangle' || node.type === 'generic.object.triangle' || node.type === 'generic.object.star' || node.type === 'generic.object.cloud' ||
                      node.type?.endsWith('.square') || node.type?.endsWith('.circle') || node.type?.endsWith('.point') || node.type?.endsWith('.rectangle') || node.type?.endsWith('.triangle') || node.type?.endsWith('.star') || node.type?.endsWith('.cloud');
  const isPointNode = node.type === 'generic.object.point' || node.type?.endsWith('.point');
  const isRotatableNode = isTextNode  || isTextboxNode || isShapeNode;
  const nodeHeight = calculateNodeHeight(node.label || '', node.type, node.sizeMode, node.height);
  const rotation = (node as any).rotation || 0;
  
  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.CANVAS_NODE,
    item: { id: node.id, x: node.x, y: node.y, type: ItemTypes.CANVAS_NODE, label: node.label || '' },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
    onDragStart: () => {
      onDraggingChange?.(true);
    },
    onDragEnd: () => {
      onDraggingChange?.(false);
    },
  }), [node.id, node.x, node.y, onDraggingChange]);

  const [isTouchDragging, setIsTouchDragging] = useState(false);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  
  // Temporary position for dragging (doesn't update actual data until drop)
  const [tempPosition] = useState<{ x: number; y: number } | null>(null);
  
  // Resize handlers
  const handleResizeStart = (e: React.MouseEvent, handle: 'right' | 'bottom') => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsResizing(true);
    setResizeHandle(handle);
    resizeStartPos.current = {
      x: e.clientX,
      y: e.clientY,
      startWidth: node.width || (isTextboxNode ? 40 : 80),
      startHeight: node.height || nodeHeight
    };
  };

  const handleResizeMove = (e: React.MouseEvent) => {
    if (!isResizing || !resizeStartPos.current || !resizeHandle || !onResize) return;
    
    const deltaX = e.clientX - resizeStartPos.current.x;
    const deltaY = e.clientY - resizeStartPos.current.y;
    
    let newWidth = resizeStartPos.current.startWidth;
    let newHeight = resizeStartPos.current.startHeight;
    
    // Calculate minimum size based on node type
    const minWidth = isTextboxNode ? 40 : isShapeNode ? 20 : 80;
    const minHeight = isTextboxNode ? 40 : isShapeNode ? 20 : 40;
    
    switch (resizeHandle) {
      case 'right':
        newWidth = resizeStartPos.current.startWidth + deltaX;
        break;
      case 'bottom':
        newHeight = resizeStartPos.current.startHeight + deltaY;
        break;
    }
    
    // Snap to grid first
    newWidth = Math.round(newWidth / 20) * 20;
    newHeight = Math.round(newHeight / 20) * 20;
    
    // Then apply minimum constraints (after grid snapping)
    newWidth = Math.max(minWidth, newWidth);
    newHeight = Math.max(minHeight, newHeight);
    
    onResize(node.id, newWidth, newHeight);
  };

  const handleResizeEnd = () => {
    setIsResizing(false);
    setResizeHandle(null);
    resizeStartPos.current = null;
  };

  // Global mouse events for resize
  useEffect(() => {
    if (isResizing) {
      const handleGlobalMouseMove = (e: MouseEvent) => {
        handleResizeMove(e as any);
      };
      
      const handleGlobalMouseUp = () => {
        handleResizeEnd();
      };
      
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isResizing, resizeHandle, node.id, onResize]);

  // Touch event handlers for mobile drag and drop
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    setIsTouchDragging(true);
    onDraggingChange?.(true);
    (e.currentTarget as HTMLElement).style.opacity = '0.5';
    e.stopPropagation(); // Prevent canvas from handling this touch
    e.preventDefault(); // Prevent any default touch behavior
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPos.current) return;
    
    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartPos.current.x);
    const deltaY = Math.abs(touch.clientY - touchStartPos.current.y);
    
    // Only start dragging if moved enough to prevent accidental drags
    if (deltaX > 10 || deltaY > 10) {
      e.preventDefault(); // Prevent scrolling when dragging
      e.stopPropagation(); // Prevent canvas from handling this touch
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartPos.current) return;
    
    const touch = e.changedTouches[0];
    const deltaX = Math.abs(touch.clientX - touchStartPos.current.x);
    const deltaY = Math.abs(touch.clientY - touchStartPos.current.y);
    
    // Check if it was a significant drag (not just a tap)
    if (deltaX > 10 || deltaY > 10) {
      // Find the canvas element
      const canvas = document.querySelector('[data-testid="editor-canvas"]') as HTMLElement;
      if (canvas) {
        const canvasRect = canvas.getBoundingClientRect();
        
        // Calculate position relative to canvas
        const x = touch.clientX - canvasRect.left;
        const y = touch.clientY - canvasRect.top;
        
        // Dispatch a custom event to the canvas for moving the node
        const moveEvent = new CustomEvent('mobileMove', {
          detail: { 
            id: node.id, 
            type: ItemTypes.CANVAS_NODE, 
            x, 
            y,
            originalX: node.x,
            originalY: node.y
          }
        });
        canvas.dispatchEvent(moveEvent);
      }
    } else {
      // This was a tap, not a drag - trigger click
      if (onClick) {
        const syntheticEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window
        });
        onClick(syntheticEvent as any, node);
      }
    }
    
    // Reset styles
    (e.currentTarget as HTMLElement).style.opacity = '1';
    setIsTouchDragging(false);
    onDraggingChange?.(false);
    touchStartPos.current = null;
    e.stopPropagation();
    e.preventDefault(); // Prevent any default touch behavior
  };



return (
    <div
      ref={(node) => {
        if (node) {
          drag(node);
        }
      }}
      className={cn(
        "absolute group transition-transform duration-200 ease-in-out",
        !(isDragging || isTouchDragging) && "hover:scale-105",
        (isSelected || isHighlighted || isMultiSelected) && "ring-2 ring-accent ring-offset-2 rounded-lg drop-shadow-md",
        (isDragging || isTouchDragging) && "opacity-50 cursor-grabbing",
        isTargetable && "cursor-crosshair opacity-70 hover:opacity-100"
        )}
      style={{
        left: isDragging ? (tempPosition?.x || node.x) : node.x,
        top: isDragging ? (tempPosition?.y || node.y) : node.y,
         width: isShapeNode ? (node.width || 60) :
                (isRotatableNode || isTextboxNode ? 
                 (node.sizeMode === 'custom' && node.width ? node.width : 'auto') : NODE_WIDTH),
         minWidth: isShapeNode ? (node.width || 60) :
                    isTextboxNode ? 40 :
                   isRotatableNode ? 80 : NODE_WIDTH,
         maxWidth: isShapeNode ? (node.width || 60) :
                    isTextboxNode ? (node.sizeMode === 'custom' ? 'none' : 400) :
                   isRotatableNode ? 200 : NODE_WIDTH,
         height: isShapeNode ? (node.height || 60) :
                 isTextboxNode && node.sizeMode === 'custom' ? (node.height || 40) :
                 (isRotatableNode || isTextboxNode) ? nodeHeight : 'auto',
        touchAction: 'none',
        transform: rotation !== 0 ? `rotate(${rotation}deg)` : undefined,
        transformOrigin: 'center'
      }}
      onMouseEnter={() => { if (!isDragging) { setIsOpen(hoverEnabled); setIsHovered(true); } }}
      onMouseLeave={() => { setIsOpen(false); setIsHovered(false); } }
      onClick={(e) => onClick && onClick(e, node)}
      onContextMenu={(e) => onContextMenu && onContextMenu(e, node)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <Popover open={isOpen && !isDragging} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <div className="flex flex-col items-center justify-center h-full w-full cursor-pointer">
            {node.type === 'generic.text.text' ? (
              // Text-only node - just show text without icon container
              (() => {
                // For text nodes, use transparent background
                const effectiveBgColor = 'transparent';
                
                return (
                  <div className="flex items-center justify-center h-full w-full px-2">
                {isEditingLabel ? (
                  <input
                    ref={inputRef}
                    id={`node-input-${node.id}`}
                    type="text"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onBlur={handleLabelSubmit}
                    onKeyDown={(e) => handleLabelKeyDown(e, false)}
                    className="text-sm font-medium text-center bg-transparent border border-primary rounded px-1 py-0.5 w-full outline-none"
                    onClick={(e) => e.stopPropagation()}
                  />
                 ) : node.label ? (
                             <p 
                               className="text-center break-words leading-tight px-1 cursor-text"
                               style={{ 
                                 color: getTextColorForBackground(effectiveBgColor, (node as any).textColor),
                                 ...getTextStylingForNode(node) 
                               }}
                               onDoubleClick={handleLabelDoubleClick}
                             >
                               {node.label}
                              </p>
                  ) : null}
                  </div>
                );
              })()
            ) : node.type === 'generic.text.textbox' ? (
              // Textbox node - larger multi-line text box
              (() => {
                const borderStyle = (node as any).borderStyle || 'solid';
                const borderColors = (node as any).borderColors || [(node as any).borderColor || '#d1d5db', (node as any).borderColor || '#d1d5db'];
                const borderColor = (node as any).borderColor || '#d1d5db';
                const backgroundStyle = (node as any).backgroundStyle || 'solid';
                const backgroundColors = (node as any).backgroundColors || [(node as any).backgroundColor || '#ffffff', (node as any).backgroundColor || '#ffffff'];
                const backgroundColor = (node as any).backgroundColor || '#ffffff';
                const gradientAngle = (node as any).gradientAngle || 135;
                const hasShadow = (node as any).shadow || false;
                
                return (
              <div 
                  className={cn(
                    "flex h-full w-full rounded-lg transition-colors",
                    getVerticalPositionClass((node as any).textVerticalPosition),
                    "justify-center",
                    node.sizeMode === 'custom' ? "p-1" : "p-4",
                   borderStyle !== 'none' && "border-2",
                   borderStyle === 'none' && (isSelected 
                     ? "border border-dashed border-primary opacity-100" 
                     : "border border-dashed border-gray-400 opacity-0 hover:opacity-100 hover:border-primary hover:bg-primary/5"),
                   isSelected && borderStyle !== 'none' ? "border-primary" : !(isDragging || isTouchDragging) && borderStyle !== 'none' && "group-hover:border-accent",
                   isTargetable && "border-dashed border-primary",
                   hasShadow && "shadow-[0_10px_15px_-3px_rgba(239,68,68,0.3),0_4px_6px_-2px_rgba(239,68,68,0.2)]"
                 )}
                 style={{
                   background: backgroundStyle === 'none' 
                     ? 'transparent'
                     : backgroundStyle === 'gradient' 
                       ? `linear-gradient(${gradientAngle}deg, ${backgroundColors[0]}, ${backgroundColors[1]})`
                       : backgroundColor,
                   ...(borderStyle === 'none' ? {} : borderStyle === 'gradient' ? {
                     borderImage: `${getGradientWithAngle(borderColors, gradientAngle)} 1`,
                     borderColor: 'transparent'
                   } : borderStyle === 'dotted' ? {
                     borderColor: borderColor,
                     borderStyle: 'dotted'
                   } : {
                     borderColor: borderColor
                   }),
                    color: (node as any).textColor || '#374151',
                    ...(node.sizeMode === 'custom' ? {} : { minHeight: '120px' }),
                    margin: hasShadow ? 4 : 0,
                   ...(hasShadow && { 
                     boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
                   })
                 }}
              >
                {isEditingLabel ? (
                  <textarea
                    ref={textareaRef}
                    id={`node-input-${node.id}`}
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onBlur={handleLabelSubmit}
                    onKeyDown={(e) => handleLabelKeyDown(e, true)}
                    className="text-sm font-medium bg-transparent border border-primary rounded px-2 py-2 w-full h-full outline-none resize-none"
                    onClick={(e) => e.stopPropagation()}
                    rows={4}
                  />
                ) : (
                    <p 
                      className={`${getTextJustifyClass((node as any).textJustify)} break-words leading-normal cursor-text hover:bg-background/50 rounded whitespace-pre-wrap ${node.sizeMode === 'custom' ? 'w-full px-1 py-0.5' : 'px-2 py-2 -mx-2 -my-2'}`}
                      style={getTextStylingForNode(node)}
                     onDoubleClick={handleLabelDoubleClick}
                   >
                     {node.label || 'Enter text...'}
                   </p>
                 )}
               </div>
               );
                })()
             ) : isShapeNode ? (
              // Shape node - render pure shape with text in different positions (resizable)
              (() => {
                const borderWidth = (node as any).borderWidth || 2;
                const hasShadow = (node as any).shadow || false;
                const borderStyle = (node as any).borderStyle || 'solid';
                const borderColors = (node as any).borderColors || [(node as any).borderColor || '#6b7280', (node as any).borderColor || '#6b7280'];
                const borderColor = (node as any).borderColor || '#6b7280';
                const backgroundStyle = (node as any).backgroundStyle || 'solid';
                const backgroundColors = (node as any).backgroundColors || [(node as any).backgroundColor || '#6b7280', (node as any).backgroundColor || '#6b7280'];
                const backgroundColor = (node as any).backgroundColor || '#6b7280';
                const gradientAngle = (node as any).gradientAngle || 135;
                
                // Generate background style
                const getBackgroundStyle = () => {
                  if (backgroundStyle === 'none') return 'transparent';
                  if (backgroundStyle === 'gradient') return getGradientWithAngle(backgroundColors, gradientAngle);
                  return backgroundColor;
                };
                
                 // Get the effective background color for text color calculation
                 const effectiveBgColor = backgroundStyle === 'gradient' ? backgroundColors[0] : backgroundColor;
                 
                 // Helper function to get text color for shapes
                 const getShapeTextColor = () => getTextColorForBackground(effectiveBgColor, (node as any).textColor);
                 
                 // Generate border style
                const getBorderStyle = () => {
                  if (borderStyle === 'none') return 'none';
                  if (borderStyle === 'dotted') return 'dotted';
                  if (borderStyle === 'gradient') {
                    return {
                      borderImage: `linear-gradient(${gradientAngle}deg, ${borderColors[0]}, ${borderColors[1]}) 1`,
                      borderColor: 'transparent'
                    };
                  }
                  return borderColor;
                };
                
                return (
              <div className="flex flex-col items-center justify-center h-full w-full relative">
                <div className="flex items-center justify-center" style={{ width: '100%', height: '100%' }}>
                  {(node.type === 'generic.object.square' || node.type?.endsWith('.square')) && (
                    <div 
                      key={`gradient-${gradientAngle}`}
                      className="relative"
                      style={{ 
                        background: getBackgroundStyle(),
                        borderWidth: borderStyle === 'none' ? '0' : `${borderWidth}px`,
                        borderStyle: borderStyle === 'gradient' ? 'solid' : borderStyle,
                        width: node.width || 60,
                        height: node.height || 60,
                        minWidth: node.width || 60,
                        minHeight: node.height || 60,
                        margin: hasShadow ? 4 : 0,
                        ...(borderStyle === 'gradient' ? getBorderStyle() : { borderColor: getBorderStyle() }),
                        ...(hasShadow && { 
                          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
                        })
                      }}
                    >
                      {/* Text inside square */}
                      {(node as any).textPosition === 'center' && node.label && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          {isEditingLabel ? (
                            <input
                              ref={inputRef}
                              id={`node-input-${node.id}`}
                              type="text"
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              onBlur={handleLabelSubmit}
                              onKeyDown={(e) => handleLabelKeyDown(e, false)}
                              className="text-xs font-medium text-center bg-transparent border border-white rounded px-1 py-0.5 w-16 outline-none"
                               style={{ color: getShapeTextColor() }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <p 
                              className="text-xs font-medium text-center break-words leading-tight px-1 cursor-text"
                               style={{ color: getShapeTextColor() }}
                              onDoubleClick={handleLabelDoubleClick}
                            >
                              {node.label}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {(node.type === 'generic.object.circle' || node.type?.endsWith('.circle')) && (
                    <div 
                      key={`gradient-${gradientAngle}`}
                      className="rounded-full relative"
                      style={{ 
                        background: getBackgroundStyle(),
                        borderWidth: borderStyle === 'none' ? '0' : `${borderWidth}px`,
                        borderStyle: borderStyle === 'gradient' ? 'solid' : borderStyle,
                        width: node.width || 60,
                        height: node.height || 60,
                        minWidth: node.width || 60,
                        minHeight: node.height || 60,
                        margin: hasShadow ? 4 : 0,
                        ...(borderStyle === 'gradient' ? getBorderStyle() : { borderColor: getBorderStyle() }),
                        ...(hasShadow && { 
                          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
                        })
                      }}
                    >
                      {/* Text inside circle */}
                      {(node as any).textPosition === 'center' && node.label && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          {isEditingLabel ? (
                            <input
                              ref={inputRef}
                              id={`node-input-${node.id}`}
                              type="text"
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              onBlur={handleLabelSubmit}
                              onKeyDown={(e) => handleLabelKeyDown(e, false)}
                              className="text-xs font-medium text-center bg-transparent border border-white rounded px-1 py-0.5 w-16 outline-none"
                               style={{ color: getShapeTextColor() }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <p 
                              className="text-xs font-medium text-center break-words leading-tight px-1 cursor-text"
                               style={{ color: getShapeTextColor() }}
                              onDoubleClick={handleLabelDoubleClick}
                            >
                              {node.label}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {(node.type === 'generic.object.point' || node.type?.endsWith('.point')) && (
                    <div 
                      key={`gradient-${gradientAngle}`}
                      className="rounded-full relative"
                      style={{ 
                        background: getBackgroundStyle(),
                        borderWidth: borderStyle === 'none' ? '0' : `${borderWidth}px`,
                        borderStyle: borderStyle === 'gradient' ? 'solid' : borderStyle,
                        width: node.width || 20,
                        height: node.height || 20,
                        minWidth: node.width || 20,
                        minHeight: node.height || 20,
                        margin: hasShadow ? 4 : 0,
                        ...(borderStyle === 'gradient' ? getBorderStyle() : { borderColor: getBorderStyle() }),
                        ...(hasShadow && { 
                          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
                        })
                      }}
                    >
                      {/* Text inside point - typically empty */}
                      {(node as any).textPosition === 'center' && node.label && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          {isEditingLabel ? (
                             <input
                               ref={inputRef}
                               id={`node-input-${node.id}`}
                               type="text"
                               value={editText}
                               onChange={(e) => setEditText(e.target.value)}
                               onBlur={handleLabelSubmit}
                               onKeyDown={(e) => handleLabelKeyDown(e, false)}
                               className="text-xs text-center bg-transparent border border-white rounded px-1 py-0.5 w-16 outline-none"
                                style={getTextStylingForNode(node)}
                               onClick={(e) => e.stopPropagation()}
                             />
                           ) : (
                             <p 
                               className="text-xs text-center break-words leading-tight px-1 cursor-text"
                                style={getTextStylingForNode(node)}
                               onDoubleClick={handleLabelDoubleClick}
                             >
                              {node.label}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {(node.type === 'generic.object.rectangle' || node.type?.endsWith('.rectangle')) && (
                    <div 
                      key={`gradient-${gradientAngle}`}
                      className="relative"
                      style={{ 
                        background: getBackgroundStyle(),
                        borderWidth: borderStyle === 'none' ? '0' : `${borderWidth}px`,
                        borderStyle: borderStyle === 'gradient' ? 'solid' : borderStyle,
                        width: node.width || 80,
                        height: node.height || 50,
                        minWidth: node.width || 80,
                        minHeight: node.height || 50,
                        margin: hasShadow ? 4 : 0,
                        ...(borderStyle === 'gradient' ? getBorderStyle() : { borderColor: getBorderStyle() }),
                        ...(hasShadow && { 
                          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
                        })
                      }}
                    >
                      {/* Text inside rectangle */}
                      {(node as any).textPosition === 'center' && node.label && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          {isEditingLabel ? (
                             <input
                               ref={inputRef}
                               id={`node-input-${node.id}`}
                               type="text"
                               value={editText}
                               onChange={(e) => setEditText(e.target.value)}
                               onBlur={handleLabelSubmit}
                               onKeyDown={(e) => handleLabelKeyDown(e, false)}
                               className="text-xs text-center bg-transparent border border-white rounded px-1 py-0.5 w-16 outline-none"
                                style={getTextStylingForNode(node)}
                               onClick={(e) => e.stopPropagation()}
                             />
                           ) : (
                             <p 
                               className="text-xs text-center break-words leading-tight px-1 cursor-text"
                                style={getTextStylingForNode(node)}
                               onDoubleClick={handleLabelDoubleClick}
                             >
                              {node.label}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {(node.type === 'generic.object.triangle' || node.type?.endsWith('.triangle')) && (
                    <div 
                      key={`gradient-${gradientAngle}`}
                      className="relative" 
                      style={{ 
                        width: node.width || 60, 
                        height: node.height || 60, 
                        minWidth: node.width || 60, 
                        minHeight: node.height || 60,
                        margin: hasShadow ? 4 : 0,
                        ...(hasShadow && { 
                          filter: 'drop-shadow(0 20px 25px rgba(0, 0, 0, 0.2)) drop-shadow(0 10px 10px rgba(0, 0, 0, 0.04))'
                        })
                      }}>
                      {/* Triangle using SVG for proper border and shadow support */}
                      <svg 
                        width={node.width || 60} 
                        height={node.height || 60}
                        style={{ display: 'block' }}
                      >
                        <defs>
                          {backgroundStyle === 'gradient' && (() => {
                            const coords = getGradientCoordinates(gradientAngle);
                            return (
                              <linearGradient id={`triangle-bg-${node.id}`} x1={coords.x1} y1={coords.y1} x2={coords.x2} y2={coords.y2}>
                                <stop offset="0%" stopColor={backgroundColors[0]} />
                                <stop offset="100%" stopColor={backgroundColors[1]} />
                              </linearGradient>
                            );
                          })()}
                          {borderStyle === 'gradient' && (() => {
                            const coords = getGradientCoordinates(gradientAngle);
                            return (
                              <linearGradient id={`triangle-border-${node.id}`} x1={coords.x1} y1={coords.y1} x2={coords.x2} y2={coords.y2}>
                                <stop offset="0%" stopColor={borderColors[0]} />
                                <stop offset="100%" stopColor={borderColors[1]} />
                              </linearGradient>
                            );
                          })()}
                        </defs>
                        <polygon
                          points={`${(node.width || 60) / 2},${borderWidth / 2} ${borderWidth / 2},${(node.height || 60) - borderWidth / 2} ${(node.width || 60) - borderWidth / 2},${(node.height || 60) - borderWidth / 2}`}
                          fill={backgroundStyle === 'gradient' ? `url(#triangle-bg-${node.id})` : backgroundStyle === 'none' ? 'transparent' : backgroundColor}
                          stroke={borderStyle === 'gradient' ? `url(#triangle-border-${node.id})` : borderStyle === 'none' ? 'transparent' : borderColor}
                          strokeWidth={borderStyle === 'none' ? 0 : borderWidth}
                          strokeDasharray={borderStyle === 'dotted' ? '3,3' : undefined}
                        />
                      </svg>
                      {/* Text inside triangle - positioned in center */}
                      {(node as any).textPosition === 'center' && node.label && (
                        <div className="absolute inset-0 flex items-center justify-center pt-2">
                          {isEditingLabel ? (
                            <input
                              ref={inputRef}
                              id={`node-input-${node.id}`}
                              type="text"
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              onBlur={handleLabelSubmit}
                              onKeyDown={(e) => handleLabelKeyDown(e, false)}
                              className="text-xs font-medium text-center bg-transparent border border-white rounded px-1 py-0.5 w-16 outline-none"
                               style={{ color: getShapeTextColor() }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <p 
                              className="text-xs font-medium text-center break-words leading-tight px-1 cursor-text"
                               style={{ color: getShapeTextColor() }}
                              onDoubleClick={handleLabelDoubleClick}
                            >
                              {node.label}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {(node.type === 'generic.object.star' || node.type?.endsWith('.star')) && (
                    <div 
                      key={`gradient-${gradientAngle}`}
                      className="relative" 
                      style={{ 
                        width: node.width || 60, 
                        height: node.height || 60, 
                        minWidth: node.width || 60, 
                        minHeight: node.height || 60,
                        margin: hasShadow ? 4 : 0,
                        ...(hasShadow && { 
                          filter: 'drop-shadow(0 20px 25px rgba(0, 0, 0, 0.2)) drop-shadow(0 10px 10px rgba(0, 0, 0, 0.04))'
                        })
                      }}>
                      {/* Star using SVG */}
                      <svg 
                        width={node.width || 60} 
                        height={node.height || 60}
                        style={{ display: 'block' }}
                      >
                        <defs>
                            {backgroundStyle === 'gradient' && (() => {
                              const coords = getGradientCoordinates(gradientAngle);
                              return (
                                <linearGradient id={`star-bg-${node.id}`} x1={coords.x1} y1={coords.y1} x2={coords.x2} y2={coords.y2}>
                                  <stop offset="0%" stopColor={backgroundColors[0]} />
                                  <stop offset="100%" stopColor={backgroundColors[1]} />
                                </linearGradient>
                              );
                            })()}
                            {borderStyle === 'gradient' && (() => {
                              const coords = getGradientCoordinates(gradientAngle);
                              return (
                                <linearGradient id={`star-border-${node.id}`} x1={coords.x1} y1={coords.y1} x2={coords.x2} y2={coords.y2}>
                                  <stop offset="0%" stopColor={borderColors[0]} />
                                  <stop offset="100%" stopColor={borderColors[1]} />
                                </linearGradient>
                              );
                            })()}
                        </defs>
                        {/* 5-pointed star path */}
                        <path
                          d={`M ${(node.width || 60) / 2},${borderWidth / 2} 
                              L ${(node.width || 60) * 0.61},${(node.height || 60) * 0.38} 
                              L ${(node.width || 60) - borderWidth / 2},${(node.height || 60) * 0.38} 
                              L ${(node.width || 60) * 0.68},${(node.height || 60) * 0.62} 
                              L ${(node.width || 60) * 0.82},${(node.height || 60) - borderWidth / 2} 
                              L ${(node.width || 60) / 2},${(node.height || 60) * 0.75} 
                              L ${(node.width || 60) * 0.18},${(node.height || 60) - borderWidth / 2} 
                              L ${(node.width || 60) * 0.32},${(node.height || 60) * 0.62} 
                              L ${borderWidth / 2},${(node.height || 60) * 0.38} 
                              L ${(node.width || 60) * 0.39},${(node.height || 60) * 0.38} Z`}
                          fill={backgroundStyle === 'gradient' ? `url(#star-bg-${node.id})` : backgroundStyle === 'none' ? 'transparent' : backgroundColor}
                          stroke={borderStyle === 'gradient' ? `url(#star-border-${node.id})` : borderStyle === 'none' ? 'transparent' : borderColor}
                          strokeWidth={borderStyle === 'none' ? 0 : borderWidth}
                          strokeDasharray={borderStyle === 'dotted' ? '3,3' : undefined}
                        />
                      </svg>
                      {/* Text inside star - positioned in center */}
                      {(node as any).textPosition === 'center' && node.label && (
                        <div className="absolute inset-0 flex items-center justify-center pt-2">
                          {isEditingLabel ? (
                            <input
                              ref={inputRef}
                              id={`node-input-${node.id}`}
                              type="text"
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              onBlur={handleLabelSubmit}
                              onKeyDown={(e) => handleLabelKeyDown(e, false)}
                              className="text-xs font-medium text-center bg-transparent border border-white rounded px-1 py-0.5 w-16 outline-none"
                               style={{ color: getShapeTextColor() }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <p 
                              className="text-xs font-medium text-center break-words leading-tight px-1 cursor-text"
                               style={{ color: getShapeTextColor() }}
                              onDoubleClick={handleLabelDoubleClick}
                            >
                              {node.label}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {(node.type === 'generic.object.cloud' || node.type?.endsWith('.cloud')) && (
                    <div 
                      key={`gradient-${gradientAngle}`}
                      className="relative" 
                      style={{ 
                        width: node.width || 80, 
                        height: node.height || 50, 
                        minWidth: node.width || 80, 
                        minHeight: node.height || 50,
                        margin: hasShadow ? 4 : 0,
                        ...(hasShadow && { 
                          filter: 'drop-shadow(0 20px 25px rgba(0, 0, 0, 0.2)) drop-shadow(0 10px 10px rgba(0, 0, 0, 0.04))'
                        })
                      }}>
                      {/* Cloud using SVG */}
                      <svg 
                        width={node.width || 80} 
                        height={node.height || 50}
                        style={{ display: 'block' }}
                      >
                        <defs>
                            {backgroundStyle === 'gradient' && (() => {
                              const coords = getGradientCoordinates(gradientAngle);
                              return (
                                <linearGradient id={`cloud-bg-${node.id}`} x1={coords.x1} y1={coords.y1} x2={coords.x2} y2={coords.y2}>
                                  <stop offset="0%" stopColor={backgroundColors[0]} />
                                  <stop offset="100%" stopColor={backgroundColors[1]} />
                                </linearGradient>
                              );
                            })()}
                            {borderStyle === 'gradient' && (() => {
                              const coords = getGradientCoordinates(gradientAngle);
                              return (
                                <linearGradient id={`cloud-border-${node.id}`} x1={coords.x1} y1={coords.y1} x2={coords.x2} y2={coords.y2}>
                                  <stop offset="0%" stopColor={borderColors[0]} />
                                  <stop offset="100%" stopColor={borderColors[1]} />
                                </linearGradient>
                              );
                            })()}
                        </defs>
                        {/* Cloud shape made of multiple circles */}
                        <path
                          d={`M ${(node.width || 80) * 0.2},${(node.height || 50) / 2} 
                              Q ${borderWidth / 2},${(node.height || 50) * 0.3} ${(node.width || 80) * 0.15},${(node.height || 50) * 0.15} 
                              Q ${(node.width || 80) * 0.1},${borderWidth / 2} ${(node.width || 80) * 0.25},${borderWidth / 2} 
                              Q ${(node.width || 80) * 0.35},${borderWidth / 2} ${(node.width || 80) * 0.4},${(node.height || 50) * 0.2} 
                              Q ${(node.width || 80) * 0.5},${borderWidth / 2} ${(node.width || 80) * 0.6},${(node.height || 50) * 0.15} 
                              Q ${(node.width || 80) * 0.7},${borderWidth / 2} ${(node.width || 80) * 0.75},${(node.height || 50) * 0.25} 
                              Q ${(node.width || 80) - borderWidth / 2},${(node.height || 50) * 0.25} ${(node.width || 80) * 0.85},${(node.height || 50) * 0.35} 
                              Q ${(node.width || 80) - borderWidth / 2},${(node.height || 50) * 0.5} ${(node.width || 80) * 0.8},${(node.height || 50) * 0.65} 
                              Q ${(node.width || 80) * 0.7},${(node.height || 50) - borderWidth / 2} ${(node.width || 80) * 0.55},${(node.height || 50) * 0.7} 
                              Q ${(node.width || 80) * 0.45},${(node.height || 50) - borderWidth / 2} ${(node.width || 80) * 0.35},${(node.height || 50) * 0.65} 
                              Q ${(node.width || 80) * 0.25},${(node.height || 50) - borderWidth / 2} ${(node.width || 80) * 0.15},${(node.height || 50) * 0.55} 
                              Q ${borderWidth / 2},${(node.height || 50) * 0.55} ${(node.width || 80) * 0.18},${(node.height || 50) / 2} Z`}
                          fill={backgroundStyle === 'gradient' ? `url(#cloud-bg-${node.id})` : backgroundStyle === 'none' ? 'transparent' : backgroundColor}
                          stroke={borderStyle === 'gradient' ? `url(#cloud-border-${node.id})` : borderStyle === 'none' ? 'transparent' : borderColor}
                          strokeWidth={borderStyle === 'none' ? 0 : borderWidth}
                          strokeDasharray={borderStyle === 'dotted' ? '3,3' : undefined}
                        />
                      </svg>
                      {/* Text inside cloud - positioned in center */}
                      {(node as any).textPosition === 'center' && node.label && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          {isEditingLabel ? (
                             <input
                               ref={inputRef}
                               id={`node-input-${node.id}`}
                               type="text"
                               value={editText}
                               onChange={(e) => setEditText(e.target.value)}
                               onBlur={handleLabelSubmit}
                               onKeyDown={(e) => handleLabelKeyDown(e, false)}
                               className="text-xs text-center bg-transparent border border-white rounded px-1 py-0.5 w-20 outline-none"
                                style={getTextStylingForNode(node)}
                               onClick={(e) => e.stopPropagation()}
                             />
                           ) : (
                             <p 
                               className="text-xs text-center break-words leading-tight px-1 cursor-text"
                                style={getTextStylingForNode(node)}
                               onDoubleClick={handleLabelDoubleClick}
                             >
                              {node.label}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Text above shape */}
                {(node as any).textPosition === 'above' && node.label && (() => {
                  const shapeWidth = node.width || 60;
                  const charsPerLine = Math.floor(shapeWidth / 7);
                  const estimatedLines = Math.ceil((node.label?.length || 0) / charsPerLine);
                  const lineHeight = 1.25;
                  const textHeight = estimatedLines * lineHeight;
                  const topOffset = -(textHeight + 0.5);
                  
                  return (
                    <div 
                      className="absolute left-0 flex items-center justify-center"
                      style={{ 
                        top: `${topOffset}rem`,
                        width: shapeWidth,
                        minWidth: shapeWidth
                      }}
                    >
                      {isEditingLabel ? (
                        <input
                          ref={inputRef}
                          id={`node-input-${node.id}`}
                          type="text"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          onBlur={handleLabelSubmit}
                          onKeyDown={(e) => handleLabelKeyDown(e, false)}
                          className="text-sm text-center bg-background border border-primary rounded px-2 py-1 w-full outline-none"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                         <p 
                           className="text-center break-words leading-tight px-2 py-1 bg-background/90 rounded cursor-text hover:bg-background/95 w-full"
                           style={getTextStylingForNode(node)}
                           onDoubleClick={handleLabelDoubleClick}
                         >
                           {node.label}
                         </p>
                      )}
                    </div>
                  );
                })()}
                
                {/* Text under shape */}
                {((node as any).textPosition === 'under' || !(node as any).textPosition) && node.label && (
                  <div 
                    className="flex items-center justify-center"
                    style={{ 
                      width: node.width || 60,
                      minWidth: node.width || 60
                    }}
                  >
                    {isEditingLabel ? (
                      <input
                        ref={inputRef}
                        id={`node-input-${node.id}`}
                        type="text"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onBlur={handleLabelSubmit}
                        onKeyDown={(e) => handleLabelKeyDown(e, false)}
                        className="text-sm text-center bg-transparent border border-primary rounded px-2 py-1 w-full outline-none mt-1"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                        <p 
                          className="text-center break-words leading-tight px-2 mt-1 cursor-text hover:bg-background/50 rounded w-full"
                          style={getTextStylingForNode(node)}
                          onDoubleClick={handleLabelDoubleClick}
                        >
                         {node.label}
                       </p>
                    )}
                  </div>
                )}
              </div>
              );
              })()
            ) : (
              <>
                <div className={cn(
                    "flex items-center justify-center w-20 h-20 transition-colors flex-shrink-0",
                    (node as any).noIconBackground ? "" : "rounded-lg shadow-md border bg-card",
                    isSelected ? "border-primary" : (node as any).noIconBackground || (isDragging || isTouchDragging) ? "" : "group-hover:border-accent",
                    isTargetable && "border-dashed border-primary"
                    )}>
                    <ResourceIcon type={node.type} width="70" height="70" className="w-[70px] h-[70px]" />
                </div>
                {isEditingLabel ? (
                  <input
                    ref={inputRef}
                    id={`node-input-${node.id}`}
                    type="text"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onBlur={handleLabelSubmit}
                     onKeyDown={(e) => handleLabelKeyDown(e, false)}
                     className={`text-sm text-center bg-transparent border border-primary rounded w-full outline-none ${node.sizeMode === 'custom' ? 'px-1 py-0.5' : 'px-1 py-0.5'}`}
                     onClick={(e) => e.stopPropagation()}
                   />
                   ) : node.label ? (
                    <p 
                      className="text-center break-words leading-tight cursor-text hover:bg-background/50 rounded px-1 py-0.5 -mx-1 -my-0.5"
                      style={getTextStylingForNode(node)}
                      onDoubleClick={handleLabelDoubleClick}
                    >
                      {node.label}
                    </p>
                ) : null}
              </>
            )}
          </div>
        </PopoverTrigger>
        {(node.info || node.label) && (
          <PopoverContent
            side="top"
            align="center"
            className="w-64 bg-popover text-popover-foreground shadow-xl border-accent"
          >
            <div className="space-y-2">
               {node.label && <h4 className="font-semibold font-headline text-primary">{node.label}</h4>}
              {node.info && <p className="text-sm">{node.info}</p>}
            </div>
          </PopoverContent>
        )}
      </Popover>
      
      {/* Resize handles - show for text resources (textbox always, others only in custom mode), or for shapes (except points) */}
       {(isHovered || isResizing || isSelected) && 
        (isTextboxNode || ((isTextNode ) && node.sizeMode === 'custom') || (isShapeNode && !isPointNode)) && (
        <>
          {/* Right handle */}
          <div
            className="absolute top-0 right-0 w-2 h-full cursor-ew-resize hover:bg-primary/20 transition-colors z-50"
            style={{ marginRight: '-4px' }}
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              handleResizeStart(e, 'right');
            }}
          />
          {/* Bottom handle */}
          <div
            className="absolute bottom-0 left-0 w-full h-2 cursor-ns-resize hover:bg-primary/20 transition-colors z-50"
            style={{ marginBottom: '-4px' }}
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              handleResizeStart(e, 'bottom');
            }}
          />
        </>
      )}
    </div>
  );
}
