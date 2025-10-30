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
}

export function DiagramNode({ node, isSelected, isTargetable, isHighlighted, onClick, onContextMenu }: DiagramNodeProps) {
  const [isOpen, setIsOpen] = useState(false);
  
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
  const nodeHeight = calculateNodeHeight(node.label || '', isTextNode);
  
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
        width: isTextNode ? 'auto' : NODE_WIDTH,
        minWidth: isTextNode ? 80 : NODE_WIDTH,
        maxWidth: isTextNode ? 200 : NODE_WIDTH,
        height: nodeHeight,
        touchAction: 'none'
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
              // Text-only node - just show the text without icon container
              <div className="flex items-center justify-center h-full w-full px-2">
                <p className="text-sm font-medium text-center text-foreground break-words leading-tight">
                  {node.label || 'Untitled'}
                </p>
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
                <p className="mt-2 text-sm font-medium text-center text-foreground w-full px-1 break-words leading-tight">
                  {node.label || 'Untitled'}
                </p>
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
