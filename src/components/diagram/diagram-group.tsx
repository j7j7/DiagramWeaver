"use client";

import React, { useState, useRef } from 'react';
import { useDrag } from 'react-dnd';
import type { DiagramGroupData } from '@/lib/types';
import { ItemTypes } from '../editor/draggable-item';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';

const GRID_SNAP = 20;

interface DiagramGroupProps {
  group: DiagramGroupData & { x: number; y: number; width: number; height: number };
  isSelected?: boolean;
  isDropTarget?: boolean;
  isTargetable?: boolean;
  isMultiSelected?: boolean;
  onClick?: (e: React.MouseEvent, group: DiagramGroupData) => void;
  onContextMenu?: (e: React.MouseEvent, group: DiagramGroupData) => void;
  onResize?: (groupId: string, newWidth: number, newHeight: number) => void;
  onLabelChange?: (groupId: string, newLabel: string) => void;
}




export function DiagramGroup({ group, isSelected, isDropTarget, isTargetable, isMultiSelected, onClick, onContextMenu, onResize, onLabelChange }: DiagramGroupProps) {
const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.GROUP,
    item: { ...group, type: ItemTypes.GROUP },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }), [group]);

  const [isTouchDragging, setIsTouchDragging] = useState(false);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  
  // Resize state
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<'right' | 'bottom' | 'bottom-right' | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [editValue, setEditValue] = useState('');
  const resizeStartPos = useRef<{ x: number; y: number; startWidth: number; startHeight: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Resize handlers
  const handleResizeStart = (e: React.MouseEvent, handle: 'right' | 'bottom' | 'bottom-right') => {
    e.stopPropagation();
    e.preventDefault();
    
    setIsResizing(true);
    setResizeHandle(handle);
    resizeStartPos.current = {
      x: e.clientX,
      y: e.clientY,
      startWidth: group.width,
      startHeight: group.height
    };
  };

  const handleResizeMove = (e: React.MouseEvent) => {
    if (!isResizing || !resizeStartPos.current || !resizeHandle || !onResize) return;
    
    const deltaX = e.clientX - resizeStartPos.current.x;
    const deltaY = e.clientY - resizeStartPos.current.y;
    
    let newWidth = resizeStartPos.current.startWidth;
    let newHeight = resizeStartPos.current.startHeight;
    
    // Calculate minimum size based on content
    const minWidth = group.minWidth || 200;
    const minHeight = group.minHeight || 150;
    
    switch (resizeHandle) {
      case 'right':
        // Dragging right edge - increase width with positive deltaX
        newWidth = Math.max(minWidth, resizeStartPos.current.startWidth + deltaX);
        break;
      case 'bottom':
        // Dragging bottom edge - increase height with positive deltaY
        newHeight = Math.max(minHeight, resizeStartPos.current.startHeight + deltaY);
        break;
      case 'bottom-right':
        // Dragging bottom-right corner - increase both width and height
        newWidth = Math.max(minWidth, resizeStartPos.current.startWidth + deltaX);
        newHeight = Math.max(minHeight, resizeStartPos.current.startHeight + deltaY);
        break;
    }
    
    // Snap to grid
    newWidth = Math.round(newWidth / GRID_SNAP) * GRID_SNAP;
    newHeight = Math.round(newHeight / GRID_SNAP) * GRID_SNAP;
    
    onResize(group.id, newWidth, newHeight);
  };

  const handleResizeEnd = () => {
    setIsResizing(false);
    setResizeHandle(null);
    resizeStartPos.current = null;
  };

  // Global mouse events for resize
  React.useEffect(() => {
    if (isResizing) {
      const handleMouseMove = (e: MouseEvent) => {
        handleResizeMove(e as any);
      };
      const handleMouseUp = () => {
        handleResizeEnd();
      };
      
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, resizeHandle, group.id, onResize]);
  
  const handleGroupMouseEnter = () => setIsHovered(true);
  const handleGroupMouseLeave = () => {
    if (!isResizing) {
      setIsHovered(false);
    }
  };

  // Label editing handlers
  const handleLabelStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingLabel(true);
    setEditValue(group.label || '');
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  };

  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditValue(e.target.value);
  };

  const handleLabelSubmit = () => {
    if (onLabelChange) {
      onLabelChange(group.id, editValue.trim());
    }
    setIsEditingLabel(false);
    setEditValue('');
  };

  const handleLabelKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleLabelSubmit();
    } else if (e.key === 'Escape') {
      setIsEditingLabel(false);
      setEditValue('');
    }
  };

  const handleLabelBlur = () => {
    handleLabelSubmit();
  };

  const isZone = group.subType === 'zone';
  const hasLabel = !!group.label && group.label.trim() !== '';
  
  // Get text position with defaults
  const getTextPosition = () => {
    if (group.textPosition) return group.textPosition;
    return isZone ? 'top-left' : 'bottom-right';
  };
  
  const textPosition = getTextPosition();
  
  // Calculate text positioning classes and styles
  const getTextPositioning = () => {
    switch (textPosition) {
      case 'top-left':
        return {
          className: "absolute px-2 text-sm font-semibold hover:text-primary cursor-pointer",
          style: {
            ...(isZone ? { top: '-12px', left: '4px' } : { top: '8px', left: '8px' }),
            backgroundColor: isZone ? 'hsl(var(--background))' : 'transparent',
            color: textColor,
          }
        };
      case 'top-center':
        return {
          className: "absolute px-2 text-sm font-semibold hover:text-primary cursor-pointer",
          style: {
            ...(isZone ? { top: '-12px', left: '50%', transform: 'translateX(-50%)' } : { top: '8px', left: '50%', transform: 'translateX(-50%)' }),
            backgroundColor: isZone ? 'hsl(var(--background))' : 'transparent',
            color: textColor,
          }
        };
      case 'top-right':
        return {
          className: "absolute px-2 text-sm font-semibold hover:text-primary cursor-pointer",
          style: {
            ...(isZone ? { top: '-12px', right: '4px' } : { top: '8px', right: '8px' }),
            backgroundColor: isZone ? 'hsl(var(--background))' : 'transparent',
            color: textColor,
          }
        };
      case 'bottom-left':
        return {
          className: "absolute px-2 text-sm font-semibold hover:text-primary cursor-pointer",
          style: {
            ...(isZone ? { bottom: '-12px', left: '4px' } : { bottom: '8px', left: '8px' }),
            backgroundColor: isZone ? 'hsl(var(--background))' : 'transparent',
            color: textColor,
          }
        };
      case 'bottom-center':
        return {
          className: "absolute px-2 text-sm font-semibold hover:text-primary cursor-pointer",
          style: {
            ...(isZone ? { bottom: '-12px', left: '50%', transform: 'translateX(-50%)' } : { bottom: '8px', left: '50%', transform: 'translateX(-50%)' }),
            backgroundColor: isZone ? 'hsl(var(--background))' : 'transparent',
            color: textColor,
          }
        };
      case 'bottom-right':
        return {
          className: "absolute px-2 text-sm font-semibold hover:text-primary cursor-pointer",
          style: {
            ...(isZone ? { bottom: '-12px', right: '4px' } : { bottom: '8px', right: '8px' }),
            backgroundColor: isZone ? 'hsl(var(--background))' : 'transparent',
            color: textColor,
          }
        };
      case 'inside':
        return {
          className: "absolute px-2 text-sm font-semibold hover:text-primary cursor-pointer",
          style: {
            bottom: '8px',
            right: '8px',
            backgroundColor: 'transparent',
            color: textColor,
          }
        };
      default:
        return {
          className: "absolute px-2 text-sm font-semibold hover:text-primary cursor-pointer",
          style: {
            ...(isZone ? { top: '-12px', left: '4px' } : { bottom: '8px', right: '8px' }),
            backgroundColor: isZone ? 'hsl(var(--background))' : 'transparent',
            color: textColor,
          }
        };
    }
  };
  
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
  const rotation = group.rotation || 0;

  return (
    <div
      ref={(node) => {
        if (node) {
          drag(node);
        }
      }}
      className={cn(
        "absolute rounded-lg cursor-move",
        borderStyle !== 'none' && (isZone ? "border-2 border-dashed" : "border-2"),
        borderStyle === 'none' && (isSelected 
          ? "border border-dashed border-primary opacity-100" 
          : "border border-dashed border-gray-400 opacity-0 hover:opacity-100 hover:border-primary hover:bg-primary/5"),
        (isDragging || isTouchDragging || isResizing) && "opacity-50",
        (isSelected || isDropTarget || isMultiSelected) && "ring-2 ring-primary ring-offset-2",
        isTargetable && "ring-2 ring-green-500 ring-offset-2 animate-pulse",
        group.shadow && "shadow-[0_10px_15px_-3px_rgba(239,68,68,0.3),0_4px_6px_-2px_rgba(239,68,68,0.2)]",
        "group" // Add group class for CSS selectors
      )}
      style={{
        left: group.x,
        top: group.y,
        width: group.width,
        height: group.height,
        background: backgroundStyle === 'none' 
          ? 'transparent'
          : backgroundStyle === 'gradient' 
            ? `linear-gradient(135deg, ${backgroundColors[0]}, ${backgroundColors[1]})`
            : backgroundColor,
        // Handle border styling
        ...(borderStyle === 'none' ? {
          // Border handled by CSS class for visibility
        } : borderStyle === 'gradient' ? {
          border: isZone ? '2px dashed' : '2px solid',
          borderImage: `linear-gradient(135deg, ${borderColors[0]}, ${borderColors[1]}) 1`,
          borderColor: 'transparent'
        } : {
          borderWidth: (group as any).borderWidth || 2,
          borderStyle: isZone ? 'dashed' : 'solid',
          borderColor: borderColor
        }),
        color: textColor,
        margin: group.shadow ? 4 : 0, // Add margin when shadow is enabled to prevent clipping
        touchAction: 'none',
        transform: rotation !== 0 
          ? `rotate(${rotation}deg)${group.shadow ? ' translateZ(0)' : ''}`
          : (group.shadow ? 'translateZ(0)' : undefined),
        transformOrigin: 'center',
        ...(group.shadow && { 
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' // More prominent shadow
        })
      }}
      onClick={(e) => onClick && onClick(e, group)}
      onContextMenu={(e) => onContextMenu && onContextMenu(e, group)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseEnter={handleGroupMouseEnter}
      onMouseLeave={handleGroupMouseLeave}
    >
      {/* Resize handles - only show when hovered or resizing */}
      {(isHovered || isResizing || isSelected) && group.sizeMode !== 'auto' && (
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
          {/* Bottom-right corner handle */}
          <div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize hover:bg-primary/30 transition-colors"
            style={{ marginBottom: '-4px', marginRight: '-4px' }}
            onMouseDown={(e) => handleResizeStart(e, 'bottom-right')}
          />
        </>
      )}
      {/* Label display/edit */}
      {isEditingLabel ? (
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={handleLabelChange}
          onKeyDown={handleLabelKeyDown}
          onBlur={handleLabelBlur}
          className={cn(
            "absolute px-2 text-sm font-semibold bg-background border border-primary rounded outline-none",
            "focus:ring-2 focus:ring-primary focus:ring-offset-1"
          )}
          style={getTextPositioning().style}
        />
      ) : (
        <Popover>
          <PopoverTrigger asChild>
            <div 
              className={cn(
                "absolute px-2 text-sm font-semibold hover:text-primary cursor-pointer"
              )}
              style={getTextPositioning().style}
              onDoubleClick={handleLabelStartEdit}
            >
               {group.label}
            </div>
          </PopoverTrigger>
          {group.info && (
            <PopoverContent
              side="top"
              align="start"
              className="w-80 bg-popover text-popover-foreground shadow-xl border-accent"
            >
              <div className="space-y-2">
                {group.label && <h4 className="font-semibold font-headline text-primary">{group.label}</h4>}
                <p className="text-sm">{group.info}</p>
              </div>
            </PopoverContent>
          )}
        </Popover>
      )}
    </div>
  );
}
