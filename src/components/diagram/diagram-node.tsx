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

const NODE_WIDTH = 80;
const BASE_NODE_HEIGHT = 80;
const TEXT_NODE_HEIGHT = 40; // Height for text-only nodes
const EXTRA_LINE_HEIGHT = 20; // Additional height per extra line of text

interface DiagramNodeProps {
  node: DiagramNodeData & { x: number; y: number };
  isSelected?: boolean;
  isTargetable?: boolean;
  isHighlighted?: boolean;
  onClick?: (e: React.MouseEvent, node: DiagramNodeData) => void;
  onContextMenu?: (e: React.MouseEvent, node: DiagramNodeData) => void;
  onLabelUpdate?: (nodeId: string, newLabel: string) => void;
  onResize?: (nodeId: string, newWidth: number, newHeight: number) => void;
}

export function DiagramNode({ node, isSelected, isTargetable, isHighlighted, onClick, onContextMenu, onLabelUpdate, onResize }: DiagramNodeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [editText, setEditText] = useState(node.label || '');
  
  // Resize state
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<'right' | 'bottom' | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const resizeStartPos = useRef<{ x: number; y: number; startWidth: number; startHeight: number } | null>(null);

  const handleLabelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingLabel(true);
    setEditText(node.label || '');
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
      const lines = Math.max(3, Math.ceil(label.length / maxCharsPerLine)); // Minimum 3 lines
      return 120 + ((lines - 3) * EXTRA_LINE_HEIGHT); // Start with 120px height
    } else if (nodeType === 'generic.text.labelbox') {
      const maxCharsPerLine = 25; // Characters fit in labelbox
      const lines = Math.max(2, Math.ceil(label.length / maxCharsPerLine)); // Minimum 2 lines
      return 100 + ((lines - 2) * EXTRA_LINE_HEIGHT); // Start with 100px height
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
  
  const isTextNode = node.type === 'generic.text.text';
  const isLabelNode = node.type === 'generic.text.label';
  const isTextboxNode = node.type === 'generic.text.textbox';
  const isLabelboxNode = node.type === 'generic.text.labelbox';
  const isShapeNode = node.type === 'generic.text.square' || node.type === 'generic.text.circle' || node.type === 'generic.text.rectangle' || node.type === 'generic.text.triangle';
  const isRotatableNode = isTextNode || isLabelNode || isShapeNode;
  const nodeHeight = calculateNodeHeight(node.label || '', node.type, node.sizeMode, node.height);
  const rotation = (node as any).rotation || 0;
  
  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.CANVAS_NODE,
    item: { id: node.id, x: node.x, y: node.y, type: ItemTypes.CANVAS_NODE, label: node.label || '' },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }), [node.id, node.x, node.y]);

  const [isTouchDragging, setIsTouchDragging] = useState(false);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  
  // Resize handlers
  const handleResizeStart = (e: React.MouseEvent, handle: 'right' | 'bottom') => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsResizing(true);
    setResizeHandle(handle);
    resizeStartPos.current = {
      x: e.clientX,
      y: e.clientY,
      startWidth: node.width || (isTextboxNode ? 200 : isLabelboxNode ? 160 : 80),
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
    const minWidth = isTextboxNode ? 200 : isLabelboxNode ? 160 : 80;
    const minHeight = isTextboxNode ? 120 : isLabelboxNode ? 100 : 40;
    
    switch (resizeHandle) {
      case 'right':
        newWidth = Math.max(minWidth, resizeStartPos.current.startWidth + deltaX);
        break;
      case 'bottom':
        newHeight = Math.max(minHeight, resizeStartPos.current.startHeight + deltaY);
        break;
    }
    
    // Snap to grid
    newWidth = Math.round(newWidth / 20) * 20;
    newHeight = Math.round(newHeight / 20) * 20;
    
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
        "absolute group transition-transform duration-200 ease-in-out hover:scale-105",
        (isSelected || isHighlighted) && "ring-2 ring-accent ring-offset-2 rounded-lg drop-shadow-md",
        (isDragging || isTouchDragging) && "opacity-50 cursor-grabbing",
        isTargetable && "cursor-crosshair opacity-70 hover:opacity-100"
        )}
      style={{
        left: node.x,
        top: node.y,
        width: isRotatableNode || isTextboxNode || isLabelboxNode ? 
          (node.sizeMode === 'custom' && node.width ? node.width : 'auto') : NODE_WIDTH,
        minWidth: isTextboxNode ? (node.sizeMode === 'custom' && node.width ? node.width : 200) : 
                  isLabelboxNode ? (node.sizeMode === 'custom' && node.width ? node.width : 160) : 
                  isRotatableNode ? 80 : NODE_WIDTH,
        maxWidth: isTextboxNode ? (node.sizeMode === 'custom' && node.width ? node.width : 400) : 
                  isLabelboxNode ? (node.sizeMode === 'custom' && node.width ? node.width : 300) : 
                  isRotatableNode ? 200 : NODE_WIDTH,
        height: isRotatableNode || isTextboxNode || isLabelboxNode ? nodeHeight : 'auto',
        touchAction: 'none',
        transform: isRotatableNode && rotation !== 0 ? `rotate(${rotation}deg)` : undefined,
        transformOrigin: 'center'
      }}
      onMouseEnter={() => { if (!isDragging) { setIsOpen(true); setIsHovered(true); } }}
      onMouseLeave={() => { setIsOpen(false); setIsHovered(false); }}
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
              <div className="flex items-center justify-center h-full w-full px-2">
                {isEditingLabel ? (
                  <input
                    type="text"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onBlur={handleLabelSubmit}
                    onKeyDown={(e) => handleLabelKeyDown(e, false)}
                    className="text-sm font-medium text-center bg-transparent border border-primary rounded px-1 py-0.5 w-full outline-none"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <p 
                    className="text-sm font-medium text-center text-foreground break-words leading-tight cursor-text hover:bg-background/50 rounded px-1 py-0.5 -mx-1 -my-0.5"
                    onClick={handleLabelClick}
                  >
                    {node.label || 'Untitled'}
                  </p>
                )}
              </div>
            ) : node.type === 'generic.text.label' ? (
              // Label node - show text with curved rectangle background
              <div 
                className={cn(
                  "flex items-center justify-center h-full w-full px-3 py-2 rounded-lg border-2 transition-colors",
                  isSelected ? "border-primary" : "group-hover:border-accent",
                  isTargetable && "border-dashed border-primary"
                )}
                style={{
                  backgroundColor: (node as any).backgroundColor || '#f3f4f6',
                  borderColor: (node as any).borderColor || '#d1d5db',
                  color: (node as any).textColor || '#374151'
                }}
              >
                {isEditingLabel ? (
                  <input
                    type="text"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onBlur={handleLabelSubmit}
                    onKeyDown={(e) => handleLabelKeyDown(e, false)}
                    className="text-sm font-medium text-center bg-transparent border border-primary rounded px-1 py-0.5 w-full outline-none"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <p 
                    className="text-sm font-medium text-center break-words leading-tight cursor-text hover:bg-background/50 rounded px-1 py-0.5 -mx-1 -my-0.5"
                    onClick={handleLabelClick}
                  >
                    {node.label || 'Label'}
                  </p>
                )}
              </div>
            ) : node.type === 'generic.text.textbox' ? (
              // Textbox node - larger multi-line text box
              <div 
                className={cn(
                  "flex items-center justify-center h-full w-full p-4 rounded-lg border-2 transition-colors",
                  isSelected ? "border-primary" : "group-hover:border-accent",
                  isTargetable && "border-dashed border-primary"
                )}
                style={{
                  backgroundColor: (node as any).backgroundColor || '#ffffff',
                  borderColor: (node as any).borderColor || '#d1d5db',
                  color: (node as any).textColor || '#374151',
                  minHeight: '120px'
                }}
              >
                {isEditingLabel ? (
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onBlur={handleLabelSubmit}
                    onKeyDown={(e) => handleLabelKeyDown(e, true)}
                    className="text-sm font-medium bg-transparent border border-primary rounded px-2 py-2 w-full h-full outline-none resize-none"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                    rows={4}
                  />
                ) : (
                  <p 
                    className="text-sm font-medium text-left break-words leading-normal cursor-text hover:bg-background/50 rounded px-2 py-2 -mx-2 -my-2 whitespace-pre-wrap"
                    onClick={handleLabelClick}
                  >
                    {node.label || 'Enter text...'}
                  </p>
                )}
              </div>
            ) : node.type === 'generic.text.labelbox' ? (
              // Labelbox node - larger multi-line label box with different styling
              <div 
                className={cn(
                  "flex items-center justify-center h-full w-full p-3 rounded-lg border-2 transition-colors",
                  isSelected ? "border-primary" : "group-hover:border-accent",
                  isTargetable && "border-dashed border-primary"
                )}
                style={{
                  backgroundColor: (node as any).backgroundColor || '#f0f9ff',
                  borderColor: (node as any).borderColor || '#0ea5e9',
                  color: (node as any).textColor || '#0c4a6e',
                  minHeight: '100px'
                }}
              >
                {isEditingLabel ? (
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onBlur={handleLabelSubmit}
                    onKeyDown={(e) => handleLabelKeyDown(e, true)}
                    className="text-sm font-medium bg-transparent border border-primary rounded px-2 py-2 w-full h-full outline-none resize-none"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                    rows={3}
                  />
                ) : (
                  <p 
                    className="text-sm font-medium text-center break-words leading-normal cursor-text hover:bg-background/50 rounded px-2 py-2 -mx-2 -my-2 whitespace-pre-wrap"
                    onClick={handleLabelClick}
                  >
                    {node.label || 'Enter label...'}
                  </p>
                )}
              </div>
            ) : isShapeNode ? (
              // Shape node - render pure shape with text in different positions
              <div className="flex flex-col items-center justify-center h-full w-full relative">
                <div className="flex items-center justify-center">
                  {node.type === 'generic.text.square' && (
                    <div 
                      className="w-12 h-12 bg-foreground relative"
                      style={{ backgroundColor: (node as any).backgroundColor || '#6b7280' }}
                    >
                      {/* Text inside square */}
                      {(node as any).textPosition === 'center' && node.label && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          {isEditingLabel ? (
                            <input
                              type="text"
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              onBlur={handleLabelSubmit}
                              onKeyDown={(e) => handleLabelKeyDown(e, false)}
                              className="text-xs font-medium text-center bg-transparent border border-white rounded px-1 py-0.5 w-16 outline-none"
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <p 
                              className="text-xs font-medium text-center text-white break-words leading-tight px-1 cursor-text"
                              onClick={handleLabelClick}
                            >
                              {node.label}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {node.type === 'generic.text.circle' && (
                    <div 
                      className="w-12 h-12 rounded-full bg-foreground relative"
                      style={{ backgroundColor: (node as any).backgroundColor || '#6b7280' }}
                    >
                      {/* Text inside circle */}
                      {(node as any).textPosition === 'center' && node.label && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          {isEditingLabel ? (
                            <input
                              type="text"
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              onBlur={handleLabelSubmit}
                              onKeyDown={(e) => handleLabelKeyDown(e, false)}
                              className="text-xs font-medium text-center bg-transparent border border-white rounded px-1 py-0.5 w-16 outline-none"
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <p 
                              className="text-xs font-medium text-center text-white break-words leading-tight px-1 cursor-text"
                              onClick={handleLabelClick}
                            >
                              {node.label}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {node.type === 'generic.text.rectangle' && (
                    <div 
                      className="w-16 h-10 bg-foreground relative"
                      style={{ backgroundColor: (node as any).backgroundColor || '#6b7280' }}
                    >
                      {/* Text inside rectangle */}
                      {(node as any).textPosition === 'center' && node.label && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          {isEditingLabel ? (
                  <input
                    type="text"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onBlur={handleLabelSubmit}
                    onKeyDown={(e) => handleLabelKeyDown(e, false)}
                    className="text-sm font-medium text-center bg-transparent border border-primary rounded px-1 py-0.5 w-full outline-none"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                          ) : (
                            <p 
                              className="text-xs font-medium text-center text-white break-words leading-tight px-1 cursor-text"
                              onClick={handleLabelClick}
                            >
                              {node.label}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {node.type === 'generic.text.triangle' && (
                    <div className="relative w-12 h-12">
                      {/* Triangle using CSS clip-path */}
                      <div 
                        className="w-full h-full"
                        style={{
                          backgroundColor: (node as any).backgroundColor || '#6b7280',
                          clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)'
                        }}
                      />
                      {/* Text inside triangle - positioned in center */}
                      {(node as any).textPosition === 'center' && node.label && (
                        <div className="absolute inset-0 flex items-center justify-center pt-2">
                          {isEditingLabel ? (
                            <input
                              type="text"
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              onBlur={handleLabelSubmit}
                              onKeyDown={(e) => handleLabelKeyDown(e, false)}
                              className="text-xs font-medium text-center bg-transparent border border-white rounded px-1 py-0.5 w-16 outline-none"
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <p 
                              className="text-xs font-medium text-center text-white break-words leading-tight px-1 cursor-text"
                              onClick={handleLabelClick}
                            >
                              {node.label}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Text over shape */}
                {(node as any).textPosition === 'above' && node.label && (
                  <div className="absolute -top-6 left-1/2 transform -translate-x-1/2">
                    {isEditingLabel ? (
                      <input
                        type="text"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onBlur={handleLabelSubmit}
                        onKeyDown={(e) => handleLabelKeyDown(e, false)}
                        className="text-sm font-medium text-center bg-background border border-primary rounded px-2 py-1 w-24 outline-none"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <p 
                        className="text-sm font-medium text-center text-foreground break-words leading-tight px-2 bg-background/90 rounded cursor-text hover:bg-background/95"
                        onClick={handleLabelClick}
                      >
                        {node.label}
                      </p>
                    )}
                  </div>
                )}
                
                {/* Text under shape */}
                {((node as any).textPosition === 'under' || !(node as any).textPosition) && node.label && (
                  isEditingLabel ? (
                    <input
                      type="text"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onBlur={handleLabelSubmit}
                      onKeyDown={(e) => handleLabelKeyDown(e, false)}
                      className="text-sm font-medium text-center bg-transparent border border-primary rounded px-2 py-1 w-24 outline-none mt-1"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <p 
                      className="text-sm font-medium text-center text-foreground break-words leading-tight px-2 mt-1 cursor-text hover:bg-background/50 rounded -mx-2 -my-1"
                      onClick={handleLabelClick}
                    >
                      {node.label}
                    </p>
                  )
                )}
              </div>
            ) : (
              <>
                <div className={cn(
                    "flex items-center justify-center w-20 h-20 rounded-lg bg-card shadow-md border transition-colors flex-shrink-0",
                    isSelected ? "border-primary" : "group-hover:border-accent",
                    isTargetable && "border-dashed border-primary"
                    )}>
                    <ResourceIcon type={node.type} width="70" height="70" className="w-[70px] h-[70px]" />
                </div>
                {isEditingLabel ? (
                  <input
                    type="text"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onBlur={handleLabelSubmit}
                    onKeyDown={(e) => handleLabelKeyDown(e, false)}
                    className="mt-1 text-xs font-medium text-center bg-transparent border border-primary rounded px-1 py-0.5 w-full outline-none"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <p 
                    className="mt-1 text-xs font-medium text-center text-foreground w-full px-1 break-words leading-tight cursor-text hover:bg-background/50 rounded -mx-1 -my-0.5"
                    onClick={handleLabelClick}
                  >
                    {node.label || 'Untitled'}
                  </p>
                )}
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
              <h4 className="font-semibold font-headline text-primary">{node.label || 'Untitled'}</h4>
              {node.info && <p className="text-sm">{node.info}</p>}
            </div>
          </PopoverContent>
        )}
      </Popover>
      
      {/* Resize handles - only show for textbox/labelbox in custom mode */}
      {(isHovered || isResizing || isSelected) && 
       (isTextboxNode || isLabelboxNode) && 
       node.sizeMode === 'custom' && (
        <>
          {/* Right handle */}
          <div
            className="absolute top-0 right-0 w-2 h-full cursor-ew-resize hover:bg-primary/20 transition-colors"
            style={{ marginRight: '-4px' }}
            onMouseDown={(e) => handleResizeStart(e, 'right')}
          />
          {/* Bottom handle */}
          <div
            className="absolute bottom-0 left-0 w-full h-2 cursor-ns-resize hover:bg-primary/20 transition-colors"
            style={{ marginBottom: '-4px' }}
            onMouseDown={(e) => handleResizeStart(e, 'bottom')}
          />
        </>
      )}
    </div>
  );
}
