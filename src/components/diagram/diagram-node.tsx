"use client";

import React, { useState, useRef } from "react";
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

const NODE_WIDTH = 104;
const BASE_NODE_HEIGHT = 100;
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
}

export function DiagramNode({ node, isSelected, isTargetable, isHighlighted, onClick, onContextMenu, onLabelUpdate }: DiagramNodeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [editText, setEditText] = useState(node.label || '');

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

  const handleLabelKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLabelSubmit();
    } else if (e.key === 'Escape') {
      setIsEditingLabel(false);
      setEditText(node.label || '');
    }
  };
  
  // Calculate dynamic height based on label length and node type
  const calculateNodeHeight = (label: string = '', isTextNode: boolean) => {
    if (isTextNode) {
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
  const isShapeNode = node.type === 'generic.text.square' || node.type === 'generic.text.circle' || node.type === 'generic.text.rectangle' || node.type === 'generic.text.triangle';
  const isRotatableNode = isTextNode || isLabelNode || isShapeNode;
  const nodeHeight = calculateNodeHeight(node.label || '', isRotatableNode);
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
        width: isRotatableNode ? 'auto' : NODE_WIDTH,
        minWidth: isRotatableNode ? 80 : NODE_WIDTH,
        maxWidth: isRotatableNode ? 200 : NODE_WIDTH,
        height: nodeHeight,
        touchAction: 'none',
        transform: isRotatableNode && rotation !== 0 ? `rotate(${rotation}deg)` : undefined,
        transformOrigin: 'center'
      }}
      onMouseEnter={() => !isDragging && setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
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
                    onKeyDown={handleLabelKeyDown}
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
                    onKeyDown={handleLabelKeyDown}
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
                              onKeyDown={handleLabelKeyDown}
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
                              onKeyDown={handleLabelKeyDown}
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
                              onKeyDown={handleLabelKeyDown}
                              className="text-xs font-medium text-center bg-transparent border border-white rounded px-1 py-0.5 w-20 outline-none"
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
                              onKeyDown={handleLabelKeyDown}
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
                        onKeyDown={handleLabelKeyDown}
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
                      onKeyDown={handleLabelKeyDown}
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
                    "flex items-center justify-center w-20 h-20 rounded-lg bg-card shadow-md border transition-colors",
                    isSelected ? "border-primary" : "group-hover:border-accent",
                    isTargetable && "border-dashed border-primary"
                    )}>
                    <ResourceIcon type={node.type} className="w-10 h-10" />
                </div>
                {isEditingLabel ? (
                  <input
                    type="text"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onBlur={handleLabelSubmit}
                    onKeyDown={handleLabelKeyDown}
                    className="mt-1 text-sm font-medium text-center bg-transparent border border-primary rounded px-1 py-0.5 w-full outline-none"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <p 
                    className="mt-1 text-sm font-medium text-center text-foreground w-full px-1 break-words leading-tight cursor-text hover:bg-background/50 rounded -mx-1 -my-0.5"
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
    </div>
  );
}
