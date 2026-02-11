"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
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
import { snapToGrid, snapDimensionToGrid } from "@/components/editor/canvas-constants";
import { getTextStylingCSS, extractTextStylingFromNode } from "@/lib/text-styling";
import {
  SquareShape,
  RectangleShape,
  RoundedRectangleShape,
  CircleShape,
  PointShape,
  KiteShape,
  TriangleShape,
  StarShape,
  HexagonShape,
  PentagonShape,
  OctagonShape,
  CloudShape,
  ParallelogramShape,
  TrapezoidShape,
  JigsawShape,
  ArrowheadShape,
  ChevronShape,
  LineShape,
} from "./shapes";
import { ResizeHandles } from "./resize-handles";
import { LineEndpointHandles } from "./line-endpoint-handles";
import { ConnectHandle } from "./connect-handle";

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
  onTagUpdate?: (nodeId: string, newTag: string) => void;
  onResize?: (nodeId: string, newWidth: number, newHeight: number) => void;
  onResizeStart?: (nodeId: string, width: number, height: number) => void;
  onResizeEnd?: () => void;
  onPositionUpdate?: (nodeId: string, x: number, y: number) => void;
  onDraggingChange?: (isDragging: boolean) => void;
  onUpdate?: (node: DiagramNodeData) => void;
  hoverEnabled?: boolean;
  selectionAnimationEnabled?: boolean;
  animationOffset?: { x: number; y: number };
  isReadOnly?: boolean;
  onHoverChange?: (id: string, itemType: 'node' | 'zone', isHovered: boolean) => void;
  onConnect?: (connectionOptions?: { style?: 'pathways' | 'bezier', curvature?: number }) => void;
  isConnectMode?: boolean;
  transform?: { x: number; y: number; k: number }; // Canvas transform for coordinate conversion
  canvasRef?: React.RefObject<HTMLDivElement | null>; // Canvas ref for coordinate conversion
}

export function DiagramNode({ node, isSelected, isTargetable, isHighlighted, isMultiSelected, isGroupMember, onClick, onContextMenu, onLabelUpdate, onTagUpdate, onResize, onResizeStart, onResizeEnd, onPositionUpdate, onDraggingChange, onUpdate, hoverEnabled = true, selectionAnimationEnabled = false, animationOffset = { x: 0, y: 0 }, isReadOnly = false, onHoverChange, onConnect, isConnectMode, transform, canvasRef }: DiagramNodeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [isEditingTag, setIsEditingTag] = useState(false);
  const [editText, setEditText] = useState(node.label || '');
  const [editTagText, setEditTagText] = useState(node.tag || '');
  
  // Resize state
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<'right' | 'bottom' | 'bottom-right' | null>(null);
  const [hoveredHandle, setHoveredHandle] = useState<'right' | 'bottom' | 'bottom-right' | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const resizeStartPos = useRef<{ x: number; y: number; startWidth: number; startHeight: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);
  
  // Line endpoint dragging state
  const [isDraggingLineEndpoint, setIsDraggingLineEndpoint] = useState(false);
  const [lineEndpointHandle, setLineEndpointHandle] = useState<'start' | 'end' | null>(null);
  const lineEndpointStartPos = useRef<{ x: number; y: number; startPoint: { x: number; y: number }; endPoint: { x: number; y: number } } | null>(null);

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

  const handleTagDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingTag(true);
    setIsOpen(false); // Close popup when editing starts
    setEditTagText(node.tag || '');
    setTimeout(() => {
      if (tagInputRef.current) {
        tagInputRef.current.focus();
        tagInputRef.current.select();
      }
    }, 0);
  };

  const handleTagSubmit = () => {
    if (onTagUpdate && editTagText.trim() !== node.tag) {
      onTagUpdate(node.id, editTagText.trim());
    }
    setIsEditingTag(false);
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
      // Handle keyboard navigation for selected nodes (skip if locked)
      if (node.locked) {
        return; // Don't move locked nodes
      }
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

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTagSubmit();
    } else if (e.key === 'Escape') {
      setIsEditingTag(false);
      setEditTagText(node.tag || '');
    }
  };

  // Helper function to render shape based on node type
  const renderShape = () => {
    const nodeAny = node as any;
    const shapeProps = {
      node,
      tag: nodeAny.tag,
      tagPosition: nodeAny.tagPosition,
      isEditingTag,
      editTagText,
      onTagTextChange: setEditTagText,
      onTagSubmit: handleTagSubmit,
      onTagKeyDown: handleTagKeyDown,
      onTagDoubleClick: handleTagDoubleClick,
      label: node.label || '',
      isEditingLabel,
      editText,
      onLabelTextChange: setEditText,
      onLabelSubmit: handleLabelSubmit,
      onLabelKeyDown: (e: React.KeyboardEvent) => handleLabelKeyDown(e, true),
      onLabelDoubleClick: handleLabelDoubleClick,
    };

    const nodeType = node.type;
    if (nodeType === 'generic.object.square' || nodeType?.endsWith('.square')) {
      return <SquareShape {...shapeProps} />;
    } else if (nodeType === 'generic.object.rectangle' || nodeType?.endsWith('.rectangle')) {
      return <RectangleShape {...shapeProps} />;
    } else if (nodeType === 'generic.object.rounded-rectangle' || nodeType?.endsWith('.rounded-rectangle')) {
      return <RoundedRectangleShape {...shapeProps} />;
    } else if (nodeType === 'generic.object.circle' || nodeType?.endsWith('.circle')) {
      return <CircleShape {...shapeProps} />;
    } else if (nodeType === 'generic.object.point' || nodeType?.endsWith('.point')) {
      return <PointShape {...shapeProps} />;
    } else if (nodeType === 'generic.object.kite' || nodeType?.endsWith('.kite')) {
      return <KiteShape {...shapeProps} />;
    } else if (nodeType === 'generic.object.triangle' || nodeType?.endsWith('.triangle')) {
      return <TriangleShape {...shapeProps} />;
    } else if (nodeType === 'generic.object.star' || nodeType?.endsWith('.star')) {
      return <StarShape {...shapeProps} />;
    } else if (nodeType === 'generic.object.hexagon' || nodeType?.endsWith('.hexagon')) {
      return <HexagonShape {...shapeProps} />;
    } else if (nodeType === 'generic.object.pentagon' || nodeType?.endsWith('.pentagon')) {
      return <PentagonShape {...shapeProps} />;
    } else if (nodeType === 'generic.object.octagon' || nodeType?.endsWith('.octagon')) {
      return <OctagonShape {...shapeProps} />;
    } else if (nodeType === 'generic.object.cloud' || nodeType?.endsWith('.cloud')) {
      return <CloudShape {...shapeProps} />;
    } else if (nodeType === 'generic.object.parallelogram' || nodeType?.endsWith('.parallelogram')) {
      return <ParallelogramShape {...shapeProps} />;
    } else if (nodeType === 'generic.object.trapezoid' || nodeType?.endsWith('.trapezoid')) {
      return <TrapezoidShape {...shapeProps} />;
    } else if (nodeType === 'generic.object.jigsaw' || nodeType?.endsWith('.jigsaw')) {
      return <JigsawShape {...shapeProps} />;
    } else if (nodeType === 'generic.object.arrowhead' || nodeType?.endsWith('.arrowhead')) {
      return <ArrowheadShape {...shapeProps} />;
    } else if (nodeType === 'generic.object.chevron' || nodeType?.endsWith('.chevron')) {
      return <ChevronShape {...shapeProps} />;
    } else       if (nodeType === 'generic.object.line' || nodeType?.endsWith('.line')) {
        // Pass local positions for smooth dragging (if available)
        const lineNodeWithLocalPos = {
          ...node,
          ...(localStartPos && { __localStartPos: localStartPos }),
          ...(localEndPos && { __localEndPos: localEndPos })
        };
        return <LineShape {...shapeProps} node={lineNodeWithLocalPos} onClick={onClick} onContextMenu={onContextMenu} />;
      }
    return null;
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
          return '-top-[30px] left-0';
        case 'top-center':
          return '-top-[30px] left-1/2 transform -translate-x-1/2';
        case 'top-right':
          return '-top-[30px] right-0';
        case 'bottom-left':
          return '-bottom-[30px] left-0';
        case 'bottom-center':
          return '-bottom-[30px] left-1/2 transform -translate-x-1/2';
        case 'bottom-right':
          return '-bottom-[30px] right-0';
        default:
          return '-top-[30px] left-1/2 transform -translate-x-1/2'; // Default to top-center
      }
    };

   const isTextNode = node.type === 'generic.text.text';
  const isTextboxNode = node.type === 'generic.text.textbox';
   const isShapeNode = node.type === 'generic.object.square' || node.type === 'generic.object.circle' || node.type === 'generic.object.point' || node.type === 'generic.object.rectangle' || node.type === 'generic.object.rounded-rectangle' || node.type === 'generic.object.triangle' || node.type === 'generic.object.star' || node.type === 'generic.object.cloud' || node.type === 'generic.object.parallelogram' || node.type === 'generic.object.trapezoid' || node.type === 'generic.object.kite' || node.type === 'generic.object.hexagon' || node.type === 'generic.object.pentagon' || node.type === 'generic.object.octagon' || node.type === 'generic.object.jigsaw' || node.type === 'generic.object.arrowhead' || node.type === 'generic.object.chevron' ||
                       node.type?.endsWith('.square') || node.type?.endsWith('.circle') || node.type?.endsWith('.point') || node.type?.endsWith('.rectangle') || node.type?.endsWith('.rounded-rectangle') || node.type?.endsWith('.triangle') || node.type?.endsWith('.star') || node.type?.endsWith('.cloud') || node.type?.endsWith('.parallelogram') || node.type?.endsWith('.trapezoid') || node.type?.endsWith('.kite') || node.type?.endsWith('.hexagon') || node.type?.endsWith('.pentagon') || node.type?.endsWith('.octagon') || node.type?.endsWith('.jigsaw') || node.type?.endsWith('.arrowhead') || node.type?.endsWith('.chevron') || node.type === 'generic.object.line' || node.type?.endsWith('.line');
  const isPointNode = node.type === 'generic.object.point' || node.type?.endsWith('.point');
  const isLineNode = node.type === 'generic.object.line' || node.type?.endsWith('.line');
  const isRotatableNode = (isTextNode || isTextboxNode || isShapeNode) && !isLineNode;
  const nodeHeight = calculateNodeHeight(node.label || '', node.type, node.sizeMode, node.height);
  const rotation = (node as any).rotation || 0;
  const isLocked = node.locked || false;
  
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
    canDrag: () => !isLocked && !isReadOnly,
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
    onDragStart: () => {
      onDraggingChange?.(true);
    },
    onDragEnd: () => {
      onDraggingChange?.(false);
    },
  }), [node, node.id, node.x, node.y, onDraggingChange, isLocked, isReadOnly]);

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
    const startWidth = node.width || (isTextboxNode ? 40 : 80);
    const startHeight = node.height || nodeHeight;
    
    // Store original dimensions for multi-resize
    (node as any).originalWidth = startWidth;
    (node as any).originalHeight = startHeight;
    
    // Notify parent to store original dimensions for all selected items
    if (onResizeStart) {
      onResizeStart(node.id, startWidth, startHeight);
    }
    
    resizeStartPos.current = {
      x: e.clientX,
      y: e.clientY,
      startWidth,
      startHeight
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
    
    // Snap dimensions to grid so right/bottom edges tessellate correctly
    newWidth = snapDimensionToGrid(newWidth, minWidth);
    newHeight = snapDimensionToGrid(newHeight, minHeight);
    
    onResize(node.id, newWidth, newHeight);
  };

  const handleResizeEnd = () => {
    setIsResizing(false);
    setResizeHandle(null);
    resizeStartPos.current = null;
    // Clear original dimensions used for multi-resize
    delete (node as any).originalWidth;
    delete (node as any).originalHeight;
    // Notify parent to clear original dimensions
    if (onResizeEnd) {
      onResizeEnd();
    }
  };
  
  // Store initial container position when drag starts (keeps container stable during drag)
  const initialContainerPosRef = useRef<{ x: number; y: number } | null>(null);
  
  // Line endpoint drag handlers
  const handleLineEndpointDragStart = (e: React.MouseEvent, handle: 'start' | 'end') => {
    if (isReadOnly) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    
    setIsDraggingLineEndpoint(true);
    setLineEndpointHandle(handle);
    
    // Notify parent that dragging has started (prevents history updates during drag)
    onDraggingChange?.(true);
    
    // Store absolute canvas positions (use local state if available, otherwise node state)
    const currentStartPos = localStartPos || (node as any).startPos || { x: node.x || 0, y: node.y || 0 };
    const currentEndPos = localEndPos || (node as any).endPos || { x: (node.x || 0) + 150, y: node.y || 0 };
    
    // Store initial container position (keep it stable during drag)
    const initialMinX = Math.min(currentStartPos.x, currentEndPos.x);
    const initialMinY = Math.min(currentStartPos.y, currentEndPos.y);
    initialContainerPosRef.current = { x: initialMinX, y: initialMinY };
    
    lineEndpointStartPos.current = {
      x: e.clientX,
      y: e.clientY,
      startPoint: currentStartPos,
      endPoint: currentEndPos
    };
    
    // Initialize ref with current positions
    latestPositionsRef.current = { startPos: currentStartPos, endPos: currentEndPos };
  };
  
  // Use local state for immediate visual updates, only sync to data on drag end
  const [localStartPos, setLocalStartPos] = useState<{ x: number; y: number } | null>(null);
  const [localEndPos, setLocalEndPos] = useState<{ x: number; y: number } | null>(null);
  // Ref to track latest positions during drag (for reliable access on drag end)
  const latestPositionsRef = useRef<{ startPos: { x: number; y: number } | null, endPos: { x: number; y: number } | null }>({ startPos: null, endPos: null });
  
  // Initialize and sync local state with node positions (but not during drag)
  useEffect(() => {
    if (!isDraggingLineEndpoint && isLineNode) {
      const startPos = (node as any).startPos || { x: node.x || 0, y: node.y || 0 };
      const endPos = (node as any).endPos || { x: (node.x || 0) + 150, y: node.y || 0 };
      
      // Only update if positions actually changed to avoid unnecessary state updates
      setLocalStartPos(prev => {
        if (!prev || prev.x !== startPos.x || prev.y !== startPos.y) {
          return startPos;
        }
        return prev;
      });
      setLocalEndPos(prev => {
        if (!prev || prev.x !== endPos.x || prev.y !== endPos.y) {
          return endPos;
        }
        return prev;
      });
    }
  }, [node.id, (node as any).startPos?.x, (node as any).startPos?.y, (node as any).endPos?.x, (node as any).endPos?.y, isDraggingLineEndpoint, isLineNode]);

  const handleLineEndpointDragMove = useCallback((e: MouseEvent | React.MouseEvent) => {
    if (!isDraggingLineEndpoint || !lineEndpointStartPos.current || !lineEndpointHandle) return;
    
    // Convert screen coordinates to canvas coordinates
    let deltaX = e.clientX - lineEndpointStartPos.current.x;
    let deltaY = e.clientY - lineEndpointStartPos.current.y;
    
    // Apply transform if available (convert screen delta to canvas delta)
    if (transform) {
      deltaX = deltaX / transform.k;
      deltaY = deltaY / transform.k;
    }
    
    let newStartPos = lineEndpointStartPos.current.startPoint;
    let newEndPos = lineEndpointStartPos.current.endPoint;
    
    if (lineEndpointHandle === 'start') {
      newStartPos = {
        x: snapToGrid(lineEndpointStartPos.current.startPoint.x + deltaX),
        y: snapToGrid(lineEndpointStartPos.current.startPoint.y + deltaY)
      };
      setLocalStartPos(newStartPos);
      latestPositionsRef.current.startPos = newStartPos;
    } else {
      newEndPos = {
        x: snapToGrid(lineEndpointStartPos.current.endPoint.x + deltaX),
        y: snapToGrid(lineEndpointStartPos.current.endPoint.y + deltaY)
      };
      setLocalEndPos(newEndPos);
      latestPositionsRef.current.endPos = newEndPos;
    }
    
    // Update local state immediately for visual feedback (no data update yet)
    // This provides instant visual feedback without triggering expensive re-renders
  }, [isDraggingLineEndpoint, lineEndpointHandle, transform]);
  
  const handleLineEndpointDragEnd = useCallback(() => {
    // Only update data on drag end (not during drag) for better performance
    if (onUpdate && lineEndpointStartPos.current) {
      // Get the current positions from ref (most reliable) or fall back to local state or original
      const currentStartPos = latestPositionsRef.current.startPos || localStartPos || lineEndpointStartPos.current.startPoint;
      const currentEndPos = latestPositionsRef.current.endPos || localEndPos || lineEndpointStartPos.current.endPoint;
      
      const minX = Math.min(currentStartPos.x, currentEndPos.x);
      const minY = Math.min(currentStartPos.y, currentEndPos.y);
      
      // Update the node with final positions
      onUpdate({
        ...node,
        x: minX,
        y: minY,
        startPos: currentStartPos,
        endPos: currentEndPos
      });
      
      // Reset refs after update
      latestPositionsRef.current = { startPos: null, endPos: null };
      initialContainerPosRef.current = null;
    }
    
    // Notify parent that dragging has ended (allows history updates again)
    onDraggingChange?.(false);
    
    setIsDraggingLineEndpoint(false);
    setLineEndpointHandle(null);
    lineEndpointStartPos.current = null;
  }, [onUpdate, node, localStartPos, localEndPos, onDraggingChange]);

  // Global mouse events for resize
  useEffect(() => {
    if (isResizing) {
      const handleGlobalMouseMove = (e: MouseEvent) => {
        if (!isResizing || !resizeStartPos.current || !resizeHandle || !onResize) return;
        handleResizeMove(e as any);
      };
      
      const handleGlobalMouseUp = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        handleResizeEnd();
      };
      
      document.addEventListener('mousemove', handleGlobalMouseMove, true);
      document.addEventListener('mouseup', handleGlobalMouseUp, true);
      
      return () => {
        document.removeEventListener('mousemove', handleGlobalMouseMove, true);
        document.removeEventListener('mouseup', handleGlobalMouseUp, true);
      };
    }
  }, [isResizing, resizeHandle, node.id, onResize]);
  
  // Global mouse events for line endpoint dragging
  useEffect(() => {
    if (isDraggingLineEndpoint) {
      const handleGlobalMouseMove = (e: MouseEvent) => {
        handleLineEndpointDragMove(e);
      };
      
      const handleGlobalMouseUp = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        handleLineEndpointDragEnd();
      };
      
      document.addEventListener('mousemove', handleGlobalMouseMove, true);
      document.addEventListener('mouseup', handleGlobalMouseUp, true);
      
      return () => {
        document.removeEventListener('mousemove', handleGlobalMouseMove, true);
        document.removeEventListener('mouseup', handleGlobalMouseUp, true);
      };
    }
  }, [isDraggingLineEndpoint, lineEndpointHandle, handleLineEndpointDragMove, handleLineEndpointDragEnd, localStartPos, localEndPos, onUpdate, node]);

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
    if (isLocked || isReadOnly) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }
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
        // Hover and selection effects - not for lines, and not when locked
        !isLineNode && !(isDragging || isTouchDragging) && !(isSelected || isHighlighted || isMultiSelected) && !isLocked && "hover:scale-105",
        !isLineNode && (isSelected || isHighlighted || isMultiSelected) && `${selectionAnimationEnabled ? "node-glow-pulse" : "node-glow-static"} drop-shadow-md`,
        !isLineNode && isGroupMember && !isSelected && !isHighlighted && !isMultiSelected && `${selectionAnimationEnabled ? "node-glow-green-pulse" : "node-glow-green-static"} drop-shadow-md`,
        (isDragging || isTouchDragging) && "cursor-grabbing",
        isTargetable && "cursor-crosshair opacity-70 hover:opacity-100"
        )}
      onClick={isLineNode ? undefined : (e) => onClick && onClick(e, node)} // Lines handle clicks in their SVG (not on container)
      onContextMenu={isLineNode ? undefined : (e) => onContextMenu && onContextMenu(e, node)} // Lines handle context menu in their SVG (not on container)
      style={{
        // For lines during drag, keep container position stable (use initial position)
        // This prevents handles from drifting - they're positioned relative to stable container
        left: isLineNode && isDraggingLineEndpoint && initialContainerPosRef.current
          ? initialContainerPosRef.current.x + animationOffset.x
          : node.x + animationOffset.x,
        top: isLineNode && isDraggingLineEndpoint && initialContainerPosRef.current
          ? initialContainerPosRef.current.y + animationOffset.y
          : node.y + animationOffset.y,
         width: isLineNode ? 'auto' : // Lines don't need a fixed width container
                (isShapeNode ? (node.width || 60) :
                (isRotatableNode || isTextboxNode ? 
                 (node.sizeMode === 'custom' && node.width ? node.width : 'auto') : NODE_WIDTH)),
         minWidth: isLineNode ? 0 : // Lines don't need min width
                   (isShapeNode ? (node.width || 60) :
                    isTextboxNode ? 40 :
                   isRotatableNode ? 80 : NODE_WIDTH),
         maxWidth: isLineNode ? 'none' : // Lines don't need max width
                   (isShapeNode ? (node.width || 60) :
                    isTextboxNode ? (node.sizeMode === 'custom' ? 'none' : 400) :
                   isRotatableNode ? 200 : NODE_WIDTH),
         height: isLineNode ? 'auto' : // Lines don't need a fixed height container
                 (isShapeNode ? (node.height || 60) :
                 isTextboxNode && node.sizeMode === 'custom' ? (node.height || 40) :
                 (isRotatableNode || isTextboxNode) ? nodeHeight : 'auto'),
        touchAction: 'none',
        transform: rotation !== 0 ? `rotate(${rotation}deg)` : undefined,
        transformOrigin: 'center',
        // For lines: container doesn't intercept clicks, but children (endpoint handles) can still receive events
        ...(isLineNode && { pointerEvents: 'none' }), 
      }}
      onMouseEnter={() => { 
        if (!isDragging && !isEditingLabel && !isEditingTag) { 
          setIsOpen(hoverEnabled); 
          setIsHovered(true);
          onHoverChange?.(node.id, 'node', true);
        } 
      }}
      onMouseLeave={() => { 
        if (!isEditingLabel && !isEditingTag) { 
          setIsOpen(false); 
          setIsHovered(false);
          onHoverChange?.(node.id, 'node', false);
        } 
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <Popover open={isOpen && !isDragging && !isEditingLabel && !isEditingTag} onOpenChange={setIsOpen}>
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
                <div className="flex flex-col items-center justify-center h-full w-full relative">
                  <div className="flex items-center justify-center" style={{ width: '100%', height: '100%' }}>
                    {renderShape()}
                  </div>
                </div>
             ) : (
              // Regular icon node - support vertical text positioning
              (() => {
                const nodeAny = node as any;
                const textVerticalPosition = nodeAny.textVerticalPosition || 'bottom'; // Default to bottom for backward compatibility
                const isMiddle = textVerticalPosition === 'middle';
                const isTop = textVerticalPosition === 'top';
                const isBottom = textVerticalPosition === 'bottom';
                
                // For middle position, use relative container with absolute positioning
                // For top/bottom, use flex-col with order
                return (
                  <div className={cn(
                    "flex flex-col items-center justify-center",
                    isMiddle && "relative"
                  )}>
                    {/* Icon container */}
                    <div className={cn(
                      "flex items-center justify-center w-20 h-20 transition-colors flex-shrink-0",
                      (node as any).noIconBackground ? "" : "rounded-lg shadow-md border bg-card",
                      isSelected ? "border-primary" : (node as any).noIconBackground || (isDragging || isTouchDragging) ? "" : "group-hover:border-accent",
                      isTargetable && "border-dashed border-primary",
                      isTop && "order-2", // Icon comes after text when text is on top
                      isBottom && "order-1" // Icon comes before text when text is on bottom (default)
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
                    
                    {/* Text - positioned based on textVerticalPosition */}
                    {isEditingLabel ? (
                      <input
                        ref={inputRef}
                        id={`node-input-${node.id}`}
                        type="text"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onBlur={handleLabelSubmit}
                        onKeyDown={(e) => handleLabelKeyDown(e, false)}
                        className={cn(
                          "text-sm text-center bg-transparent border border-primary rounded outline-none",
                          node.sizeMode === 'custom' ? 'px-1 py-0.5' : 'px-1 py-0.5',
                          isMiddle ? "absolute w-20 h-20 flex items-center justify-center pointer-events-auto left-0 top-0" : "w-full",
                          isTop && "order-1", // Text comes before icon when on top
                          isBottom && "order-2" // Text comes after icon when on bottom (default)
                        )}
                        style={isMiddle ? {
                          ...getTextStylingForNode(node),
                          backgroundColor: 'transparent',
                          zIndex: 10
                        } : getTextStylingForNode(node)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : node.label ? (
                      <p 
                        className={cn(
                          "text-center break-words leading-tight cursor-text hover:bg-background/50 rounded px-1 py-0.5",
                          isMiddle ? "absolute w-20 h-20 flex items-center justify-center pointer-events-auto left-0 top-0 -mx-0 -my-0" : "-mx-1 -my-0.5 w-full",
                          isTop && "order-1", // Text comes before icon when on top
                          isBottom && "order-2" // Text comes after icon when on bottom (default)
                        )}
                        style={isMiddle ? {
                          ...getTextStylingForNode(node),
                          backgroundColor: 'transparent',
                          zIndex: 10,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        } : {
                          ...getTextStylingForNode(node),
                          display: 'block'
                        }}
                        onDoubleClick={handleLabelDoubleClick}
                      >
                        {node.label}
                      </p>
                    ) : null}
                  </div>
                );
              })()
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

       {/* Resize handles - show for text resources (textbox always, others only in custom mode), or for shapes (except points and lines) */}
        {!isReadOnly && (isResizing || isSelected || isMultiSelected) &&
         (isTextboxNode || ((isTextNode ) && node.sizeMode === 'custom') || (isShapeNode && !isPointNode && !isLineNode)) && (
          <ResizeHandles
            visible={true}
            activeHandle={resizeHandle}
            hoveredHandle={hoveredHandle}
            onStart={handleResizeStart}
            disabled={false}
            zIndexClass="z-50"
          />
       )}
       
       {/* Line endpoint handles for line shapes - only show when THIS line is selected (not in multi-select with other items) */}
       {!isReadOnly && isLineNode && isSelected && !isMultiSelected && (() => {
         // Get base positions - use same logic as drag start handler for consistency
         // This ensures handles are positioned correctly even on first drag
        const baseStartPos = localStartPos || (node as any).startPos || { x: node.x || 0, y: node.y || 0 };
        const baseEndPos = localEndPos || (node as any).endPos || { x: (node.x || 0) + 150, y: node.y || 0 };
         
         // During drag, only update the handle being dragged, keep the other stable
         const currentStartPos = isDraggingLineEndpoint && lineEndpointHandle === 'start' && localStartPos
           ? localStartPos
           : baseStartPos;
         const currentEndPos = isDraggingLineEndpoint && lineEndpointHandle === 'end' && localEndPos
           ? localEndPos
           : baseEndPos;
         
         // Use node.x/y if available (matches LineShape calculation), otherwise use min of positions
         // This ensures handles align exactly with the line endpoints
         const nodeX = node.x ?? Math.min(currentStartPos.x, currentEndPos.x);
         const nodeY = node.y ?? Math.min(currentStartPos.y, currentEndPos.y);
         
         // During drag, use stable container position to prevent handles from drifting
         const handleNodeX = isDraggingLineEndpoint && initialContainerPosRef.current
           ? initialContainerPosRef.current.x
           : nodeX;
         const handleNodeY = isDraggingLineEndpoint && initialContainerPosRef.current
           ? initialContainerPosRef.current.y
           : nodeY;
         
         return (
           <LineEndpointHandles
             visible={true}
             activeHandle={lineEndpointHandle}
             startPoint={currentStartPos}
             endPoint={currentEndPos}
             nodeX={handleNodeX}
             nodeY={handleNodeY}
             onStartDrag={handleLineEndpointDragStart}
             disabled={false}
             zIndexClass="z-50"
           />
         );
       })()}

       {/* Connect handle - show when selected (not for lines) */}
       {!isReadOnly && (isSelected || isMultiSelected) && onConnect && !isLineNode && (
         <ConnectHandle
           visible={true}
           onConnect={() => onConnect({ style: 'bezier', curvature: 0.6 })}
           isConnectMode={isConnectMode}
           disabled={false}
           zIndexClass="z-50"
         />
       )}
    </div>
  );
}
