"use client";

import React, { useState, useRef, useEffect } from "react";
import { useDrag } from 'react-dnd';
import { getEmptyImage } from 'react-dnd-html5-backend';
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
  isGroupMember?: boolean;
  onClick?: (e: React.MouseEvent, node: DiagramNodeData) => void;
  onContextMenu?: (e: React.MouseEvent, node: DiagramNodeData) => void;
  onLabelUpdate?: (nodeId: string, newLabel: string) => void;
  onResize?: (nodeId: string, newWidth: number, newHeight: number) => void;
  onPositionUpdate?: (nodeId: string, x: number, y: number) => void;
  onDraggingChange?: (isDragging: boolean) => void;
  hoverEnabled?: boolean;
  selectionAnimationEnabled?: boolean;
  animationOffset?: { x: number; y: number };
  isReadOnly?: boolean;
}

export function DiagramNode({ node, isSelected, isTargetable, isHighlighted, isMultiSelected, isGroupMember, onClick, onContextMenu, onLabelUpdate, onResize, onPositionUpdate, onDraggingChange, hoverEnabled = true, selectionAnimationEnabled = false, animationOffset = { x: 0, y: 0 }, isReadOnly = false }: DiagramNodeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [editText, setEditText] = useState(node.label || '');
  
  // Resize state
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<'right' | 'bottom' | 'bottom-right' | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const resizeStartPos = useRef<{ x: number; y: number; startWidth: number; startHeight: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleLabelDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingLabel(true);
    setIsOpen(false); // Close popup when editing starts
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
      // Also clear resize state when Escape is pressed
      if (isResizing) {
        handleResizeEnd();
      }
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
      const lines = Math.max(1, Math.ceil(label.length / maxCharsPerLine));
      return TEXT_NODE_HEIGHT + ((lines - 1) * EXTRA_LINE_HEIGHT);
    } else {
      const maxCharsPerLine = 12; // Approximate characters that fit in node width
      const lines = Math.max(1, Math.ceil(label.length / maxCharsPerLine));
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
   
   // Helper function to get vertical positioning class (for flex containers with flex-col)
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
   
   // Helper function to get vertical justification class (for flex containers with flex-col to position content)
   const getVerticalJustifyClass = (position?: string) => {
     switch (position) {
       case 'top':
         return 'justify-start';
       case 'middle':
         return 'justify-center';
       case 'bottom':
         return 'justify-end';
       default:
         return 'justify-center';
     }
    };

    // Helper function to get tag positioning classes
    const getTagPositionClasses = (position?: string) => {
      switch (position) {
        case 'top-left':
          return '-top-6 -left-2';
        case 'top-center':
          return '-top-6 left-1/2 transform -translate-x-1/2';
        case 'top-right':
          return '-top-6 -right-2';
        case 'bottom-left':
          return '-bottom-6 -left-2';
        case 'bottom-center':
          return '-bottom-6 left-1/2 transform -translate-x-1/2';
        case 'bottom-right':
          return '-bottom-6 -right-2';
        default:
          return '-top-6 left-1/2 transform -translate-x-1/2'; // Default to top-center
      }
    };

   const isTextNode = node.type === 'generic.text.text';
  const isTextboxNode = node.type === 'generic.text.textbox';
   const isShapeNode = node.type === 'generic.object.square' || node.type === 'generic.object.circle' || node.type === 'generic.object.point' || node.type === 'generic.object.rectangle' || node.type === 'generic.object.rounded-rectangle' || node.type === 'generic.object.triangle' || node.type === 'generic.object.star' || node.type === 'generic.object.cloud' || node.type === 'generic.object.parallelogram' || node.type === 'generic.object.trapezoid' || node.type === 'generic.object.kite' || node.type === 'generic.object.hexagon' || node.type === 'generic.object.pentagon' || node.type === 'generic.object.octagon' || node.type === 'generic.object.jigsaw' || node.type === 'generic.object.arrowhead' || node.type === 'generic.object.chevron' ||
                       node.type?.endsWith('.square') || node.type?.endsWith('.circle') || node.type?.endsWith('.point') || node.type?.endsWith('.rectangle') || node.type?.endsWith('.rounded-rectangle') || node.type?.endsWith('.triangle') || node.type?.endsWith('.star') || node.type?.endsWith('.cloud') || node.type?.endsWith('.parallelogram') || node.type?.endsWith('.trapezoid') || node.type?.endsWith('.kite') || node.type?.endsWith('.hexagon') || node.type?.endsWith('.pentagon') || node.type?.endsWith('.octagon') || node.type?.endsWith('.jigsaw') || node.type?.endsWith('.arrowhead') || node.type?.endsWith('.chevron');
  const isPointNode = node.type === 'generic.object.point' || node.type?.endsWith('.point');
  const isRotatableNode = isTextNode  || isTextboxNode || isShapeNode;
  const nodeHeight = calculateNodeHeight(node.label || '', node.type, node.sizeMode, node.height);
  const rotation = (node as any).rotation || 0;
  
  const [{ isDragging }, drag, preview] = useDrag(() => ({
    type: ItemTypes.CANVAS_NODE,
    item: { 
      ...node, // Include ALL node properties
      x: node.x, 
      y: node.y, 
      type: ItemTypes.CANVAS_NODE, 
      // CRITICAL: Preserve original shape type for scratchpad
      originalType: node.type,
      label: node.label || '' 
    },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
    onDragStart: () => {
      onDraggingChange?.(true);
    },
    onDragEnd: () => {
      onDraggingChange?.(false);
    },
  }), [node, node.id, node.x, node.y, onDraggingChange]);

  useEffect(() => {
    preview(getEmptyImage(), { captureDraggingState: true });
  }, [preview]);

  const [isTouchDragging, setIsTouchDragging] = useState(false);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  
  // Temporary position for dragging (doesn't update actual data until drop)
  const [tempPosition] = useState<{ x: number; y: number } | null>(null);
  
  // Resize handlers
  const handleResizeStart = (e: React.MouseEvent, handle: 'right' | 'bottom' | 'bottom-right') => {
    if (isReadOnly) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }
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
      case 'bottom-right':
        // Dragging bottom-right corner - increase both width and height
        newWidth = resizeStartPos.current.startWidth + deltaX;
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

  // Global click handler to clear resize state when clicking outside
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Check if click is outside this node
      if (!target.closest(`[data-node-id="${node.id}"]`)) {
        // Clear both resize state and hover state
        handleResizeEnd();
        setIsHovered(false);
      }
    };
    
    document.addEventListener('click', handleGlobalClick);
    
    return () => {
      document.removeEventListener('click', handleGlobalClick);
    };
  }, [isResizing, node.id, handleResizeEnd, setIsHovered]);

  // Global keyboard handler for Escape key
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isResizing) {
        handleResizeEnd();
        setIsHovered(false);
      }
    };
    
    document.addEventListener('keydown', handleGlobalKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [isResizing, handleResizeEnd, setIsHovered]);

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
      data-node-id={node.id}
      ref={(node) => {
        if (node) {
          drag(node);
        }
      }}
      className={cn(
        "absolute group transition-transform duration-200 ease-in-out rounded-lg",
        !(isDragging || isTouchDragging) && "hover:scale-105",
        (isSelected || isHighlighted || isMultiSelected) && `${selectionAnimationEnabled ? "node-glow-pulse" : "node-glow-static"} drop-shadow-md`,
        isGroupMember && !isSelected && !isHighlighted && !isMultiSelected && `${selectionAnimationEnabled ? "node-glow-green-pulse" : "node-glow-green-static"} drop-shadow-md`,
        (isDragging || isTouchDragging) && "cursor-grabbing",
        isTargetable && "cursor-crosshair opacity-70 hover:opacity-100"
        )}
      style={{
        left: node.x + animationOffset.x,
        top: node.y + animationOffset.y,
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
      onMouseEnter={() => { if (!isDragging && !isEditingLabel) { setIsOpen(hoverEnabled); setIsHovered(true); } }}
      onMouseLeave={() => { if (!isEditingLabel) { setIsOpen(false); setIsHovered(false); } } }
      onClick={(e) => onClick && onClick(e, node)}
      onContextMenu={(e) => onContextMenu && onContextMenu(e, node)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <Popover open={isOpen && !isDragging && !isEditingLabel} onOpenChange={setIsOpen}>
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
                    "flex flex-col h-full w-full rounded-lg transition-colors",
                    getVerticalPositionClass((node as any).textVerticalPosition),
                    node.sizeMode === 'custom' ? "p-1" : "p-4",
                   borderStyle !== 'none' && "border-2",
                   borderStyle === 'none' && (isSelected 
                      ? "border border-dashed border-primary opacity-100" 
                      : "opacity-100 hover:border hover:border-dashed hover:border-primary hover:bg-primary/5"),
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
                    <div 
                      className={`w-full flex-1 flex flex-col ${getVerticalJustifyClass((node as any).textVerticalPosition)} ${node.sizeMode === 'custom' ? 'px-1 py-0.5' : 'px-2 py-2'}`}
                    >
                      <p 
                        className={`${getTextJustifyClass((node as any).textJustify)} break-words leading-normal cursor-text hover:bg-background/50 rounded whitespace-pre-wrap w-full`}
                        style={{ ...getTextStylingForNode(node), display: 'block' }}
                        onDoubleClick={handleLabelDoubleClick}
                      >
                        {node.label || 'Enter text...'}
                       </p>
                         </div>
                     )}
               </div>
               );
                })()
             ) : isShapeNode ? (
              // Shape node - render pure shape with text in different positions (resizable)
               (() => {
                 return (
                   <div className="flex flex-col items-center justify-center h-full w-full relative">
                     <div className="flex items-center justify-center" style={{ width: '100%', height: '100%' }}>
                        {(node.type === 'generic.object.square' || node.type?.endsWith('.square')) && (
                          <div
                            key={`gradient-${(node as any).gradientAngle || 135}`}
                            className="relative"
                            style={{
                              background: ((node as any).backgroundStyle === 'gradient') ?
                                getGradientWithAngle((node as any).backgroundColors || [(node as any).backgroundColor || '#6b7280'], (node as any).gradientAngle || 135) :
                                (node as any).backgroundColor || '#6b7280',
                              borderWidth: ((node as any).borderStyle === 'none') ? '0' : `${(node as any).borderWidth || 2}px`,
                              borderStyle: (node as any).borderStyle === 'gradient' ? 'solid' : ((node as any).borderStyle || 'solid'),
                              borderColor: (node as any).borderColor || '#6b7280',
                              width: node.width || 60,
                              height: node.height || 60,
                              minWidth: node.width || 60,
                              minHeight: node.height || 60,
                              margin: ((node as any).shadow) ? 4 : 0,
                              ...(node as any).shadow && {
                                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
                              }
                            }}
                          >
                            {/* Text inside square */}
                            {(((node as any).textVerticalPosition === 'middle' || !(node as any).textVerticalPosition) && ((node as any).textPosition === 'center' || !(node as any).textPosition)) && node.label && (
                              <div className={`absolute inset-0 flex flex-col ${getVerticalPositionClass((node as any).textVerticalPosition)}`}>
                                {isEditingLabel ? (
                                  <div className={`w-full h-full flex flex-col ${getVerticalJustifyClass((node as any).textVerticalPosition)} px-1`}>
                                    <input
                                      ref={inputRef}
                                      id={`node-input-${node.id}`}
                                      type="text"
                                      value={editText}
                                      onChange={(e) => setEditText(e.target.value)}
                                      onBlur={handleLabelSubmit}
                                      onKeyDown={(e) => handleLabelKeyDown(e, false)}
                                      className={`text-xs ${getTextJustifyClass((node as any).textJustify)} bg-transparent border border-white rounded px-1 py-0.5 w-full outline-none`}
                                      style={{ ...getTextStylingForNode(node), color: getTextColorForBackground(((node as any).backgroundStyle === 'gradient') ? ((node as any).backgroundColors || [(node as any).backgroundColor || '#6b7280'])[0] : ((node as any).backgroundColor || '#6b7280'), (node as any).textColor) }}
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  </div>
                                ) : (
                                  <div className={`w-full h-full flex flex-col ${getVerticalJustifyClass((node as any).textVerticalPosition)} px-1`}>
                                    <p
                                      className={`text-xs ${getTextJustifyClass((node as any).textJustify)} break-words leading-tight cursor-text w-full`}
                                      style={{ ...getTextStylingForNode(node), color: getTextColorForBackground(((node as any).backgroundStyle === 'gradient') ? ((node as any).backgroundColors || [(node as any).backgroundColor || '#6b7280'])[0] : ((node as any).backgroundColor || '#6b7280'), (node as any).textColor), display: 'block' }}
                                      onDoubleClick={handleLabelDoubleClick}
                                    >
                                      {node.label}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        {(node.type === 'generic.object.rounded-rectangle' || node.type?.endsWith('.rounded-rectangle')) && (
                          <div className="relative">
                            {/* Tag box positioned based on tagPosition */}
                            {(node as any).tag && (node as any).tag.trim() && (
                              <div
                                className={`absolute px-2 py-1 rounded-full text-xs font-medium border bg-slate-100 border-slate-300 z-10 ${getTagPositionClasses((node as any).tagPosition)}`}
                                style={{
                                  color: '#374151',
                                  whiteSpace: 'nowrap',
                                  minWidth: 'fit-content',
                                  boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.06)'
                                }}
                              >
                                {(node as any).tag}
                              </div>
                            )}

                            {/* Main rounded rectangle */}
                            <div
                              key={`gradient-${(node as any).gradientAngle || 135}`}
                              className="relative"
                              style={{
                                background: ((node as any).backgroundStyle === 'gradient') ?
                                  getGradientWithAngle((node as any).backgroundColors || [(node as any).backgroundColor || '#6b7280'], (node as any).gradientAngle || 135) :
                                  (node as any).backgroundColor || '#6b7280',
                                border: ((node as any).borderStyle === 'none') ? 'none' : `${(node as any).borderWidth || 2}px ${(node as any).borderStyle || 'solid'} ${(node as any).borderColor || '#6b7280'}`,
                                borderRadius: '12px',
                                width: node.width || 80,
                                height: node.height || 50,
                                minWidth: node.width || 80,
                                minHeight: node.height || 50,
                                margin: ((node as any).shadow) ? 4 : 0,
                                ...(((node as any).shadow) && {
                                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
                                })
                              }}
                            >
                              {/* Text inside rounded rectangle */}
                              {(((node as any).textVerticalPosition === 'middle' || !(node as any).textVerticalPosition) && ((node as any).textPosition === 'center' || !(node as any).textPosition)) && node.label && (
                                <div className={`absolute inset-0 flex flex-col ${getVerticalPositionClass((node as any).textVerticalPosition)}`}>
                                  {isEditingLabel ? (
                                    <input
                                      ref={inputRef}
                                      id={`node-input-${node.id}`}
                                      type="text"
                                      value={editText}
                                      onChange={(e) => setEditText(e.target.value)}
                                      onBlur={handleLabelSubmit}
                                      onKeyDown={(e) => handleLabelKeyDown(e, false)}
                                      className={`text-xs ${getTextJustifyClass((node as any).textJustify)} bg-transparent border border-white rounded px-1 py-0.5 w-full outline-none`}
                                      style={{ ...getTextStylingForNode(node), color: getTextColorForBackground(((node as any).backgroundStyle === 'gradient') ? ((node as any).backgroundColors || [(node as any).backgroundColor || '#6b7280'])[0] : ((node as any).backgroundColor || '#6b7280'), (node as any).textColor) }}
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  ) : (
                                    <div className={`w-full h-full flex flex-col ${getVerticalJustifyClass((node as any).textVerticalPosition)} px-1`}>
                                      <p
                                        className={`text-xs ${getTextJustifyClass((node as any).textJustify)} break-words leading-tight cursor-text w-full`}
                                        style={{ ...getTextStylingForNode(node), color: getTextColorForBackground(((node as any).backgroundStyle === 'gradient') ? ((node as any).backgroundColors || [(node as any).backgroundColor || '#6b7280'])[0] : ((node as any).backgroundColor || '#6b7280'), (node as any).textColor), display: 'block' }}
                                        onDoubleClick={handleLabelDoubleClick}
                                      >
                                        {node.label}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                     </div>
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
                    <ResourceIcon 
                      type={node.type} 
                      provider={node.provider}
                      category={node.category}
                      file={node.file}
                      width="70" 
                      height="70" 
                      className="w-[70px] h-[70px]" 
                    />
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
        {!isReadOnly && (isHovered || isResizing || isSelected) &&
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
           {/* Bottom-right corner handle */}
           <div
             className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize hover:bg-primary/30 transition-colors z-50"
             style={{ marginBottom: '-4px', marginRight: '-4px' }}
             onMouseDown={(e) => {
               e.stopPropagation();
               e.preventDefault();
               handleResizeStart(e, 'bottom-right');
             }}
           />
         </>
       )}
    </div>
  );
}
