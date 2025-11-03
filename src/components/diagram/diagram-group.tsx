"use client";

import React, { useState, useRef } from 'react';
import { useDrag } from 'react-dnd';
import type { DiagramGroupData } from '@/lib/types';
import { ItemTypes } from '../editor/draggable-item';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';

interface DiagramGroupProps {
  group: DiagramGroupData & { x: number; y: number; width: number; height: number };
  isSelected?: boolean;
  isDropTarget?: boolean;
  isTargetable?: boolean;
  onClick?: (e: React.MouseEvent, group: DiagramGroupData) => void;
  onContextMenu?: (e: React.MouseEvent, group: DiagramGroupData) => void;
}




export function DiagramGroup({ group, isSelected, isDropTarget, isTargetable, onClick, onContextMenu }: DiagramGroupProps) {
const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.GROUP,
    item: { ...group, type: ItemTypes.GROUP },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }), [group]);

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
        
        // Dispatch a custom event to the canvas for moving the group
        const moveEvent = new CustomEvent('mobileMove', {
          detail: { 
            id: group.id, 
            type: ItemTypes.GROUP, 
            x, 
            y,
            originalX: group.x,
            originalY: group.y
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
        onClick(syntheticEvent as any, group);
      }
    }
    
    // Reset styles
    (e.currentTarget as HTMLElement).style.opacity = '1';
    setIsTouchDragging(false);
    touchStartPos.current = null;
    e.stopPropagation();
    e.preventDefault(); // Prevent any default touch behavior
  };

  const isZone = group.subType === 'zone';
  const hasLabel = !!group.label && group.label.trim() !== '';
  
  // If no label, make group invisible (just a container)
  if (!hasLabel) {
    return (
      <div
        ref={(node) => {
          if (node) {
            drag(node);
          }
        }}
        className="absolute"
        style={{
          left: group.x,
          top: group.y,
          width: group.width,
          height: group.height,
          pointerEvents: 'none' // Let clicks pass through to children
        }}
      />
    );
  }
  
  // Use new color properties with fallbacks
  const textColor = group.textColor || '#374151';
  
  // Handle border color (solid or gradient)
  const borderStyle = group.borderStyle || 'solid';
  const borderColors = group.borderColors || [group.borderColor || (isZone ? '#6b7280' : '#3b82f6'), group.borderColor || (isZone ? '#6b7280' : '#3b82f6')];
  const borderColor = group.borderColor || (isZone ? '#6b7280' : '#3b82f6');
  
  // Handle background color (solid or gradient)
  const backgroundStyle = group.backgroundStyle || 'solid';
  const backgroundColors = group.backgroundColors || [group.backgroundColor || (isZone ? '#f3f4f6' : '#f3f4f6'), group.backgroundColor || (isZone ? '#e5e7eb' : '#e5e7eb')];
  const backgroundColor = group.backgroundColor || (isZone ? 'transparent' : '#f3f4f6');

  return (
    <div
      ref={(node) => {
        if (node) {
          drag(node);
        }
      }}
className={cn(
        "absolute rounded-lg cursor-move",
        isZone ? "border-2 border-dashed" : "border-2",
        (isDragging || isTouchDragging) && "opacity-50",
        (isSelected || isDropTarget) && "ring-2 ring-primary ring-offset-2",
        isTargetable && "ring-2 ring-green-500 ring-offset-2 animate-pulse",
        group.shadow && "shadow-[0_10px_15px_-3px_rgba(239,68,68,0.3),0_4px_6px_-2px_rgba(239,68,68,0.2)]"
        )}
      style={{
        left: group.x,
        top: group.y,
        width: group.width,
        height: group.height,
        background: backgroundStyle === 'gradient' 
          ? `linear-gradient(135deg, ${backgroundColors[0]}, ${backgroundColors[1]})`
          : backgroundColor,
        // Handle border styling
        ...(borderStyle === 'gradient' ? {
          border: isZone ? '2px dashed' : '2px solid',
          borderImage: `linear-gradient(135deg, ${borderColors[0]}, ${borderColors[1]}) 1`,
          borderColor: 'transparent'
        } : {
          borderWidth: 2,
          borderStyle: isZone ? 'dashed' : 'solid',
          borderColor: borderColor
        }),
        color: textColor,
        margin: group.shadow ? 4 : 0, // Add margin when shadow is enabled to prevent clipping
        touchAction: 'none',
        ...(group.shadow && { 
          transform: 'translateZ(0)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' // More prominent shadow
        })
      }}
      onClick={(e) => onClick && onClick(e, group)}
      onContextMenu={(e) => onContextMenu && onContextMenu(e, group)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <Popover>
        <PopoverTrigger asChild>
          <div className={cn(
            "absolute px-2 text-sm font-semibold hover:text-primary cursor-pointer",
            isZone ? "-top-3 left-4" : "bottom-1 right-2"
          )}
          style={{
            backgroundColor: isZone ? 'hsl(var(--background))' : 'transparent',
            color: textColor,
          }}>
            {group.label || 'Untitled Group'}
          </div>
        </PopoverTrigger>
        {group.info && (
          <PopoverContent
            side="top"
            align="start"
            className="w-80 bg-popover text-popover-foreground shadow-xl border-accent"
          >
            <div className="space-y-2">
              <h4 className="font-semibold font-headline text-primary">{group.label || 'Untitled Group'}</h4>
              <p className="text-sm">{group.info}</p>
            </div>
          </PopoverContent>
        )}
      </Popover>
    </div>
  );
}
