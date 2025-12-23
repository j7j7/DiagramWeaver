"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useDrag } from 'react-dnd';
import { getEmptyImage } from 'react-dnd-html5-backend';
import type { DiagramZoneData } from '@/lib/types';
import { ItemTypes } from '../editor/draggable-item';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { extractTextStylingFromZone } from '@/lib/text-styling';

const GRID_SNAP = 20;



interface DiagramZoneProps {
  zone: DiagramZoneData & { x: number; y: number; width: number; height: number };
  isSelected?: boolean;
  isDropTarget?: boolean;
  isTargetable?: boolean;
  isMultiSelected?: boolean;
  isGroupMember?: boolean;
  onClick?: (e: React.MouseEvent, zone: DiagramZoneData) => void;
  onContextMenu?: (e: React.MouseEvent, zone: DiagramZoneData) => void;
  onResize?: (zoneId: string, newWidth: number, newHeight: number) => void;
  onLabelChange?: (zoneId: string, newLabel: string) => void;
}




export function DiagramZone({ zone, isSelected, isDropTarget, isTargetable, isMultiSelected, isGroupMember, onClick, onContextMenu, onResize, onLabelChange }: DiagramZoneProps) {
const [{ isDragging }, drag, preview] = useDrag(() => ({
    type: ItemTypes.ZONE,
    item: { ...zone, type: ItemTypes.ZONE },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }), [zone]);

  useEffect(() => {
    preview(getEmptyImage(), { captureDraggingState: true });
  }, [preview]);

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
        
        // Dispatch a custom event to the canvas for moving the zone
        const moveEvent = new CustomEvent('mobileMove', {
          detail: { 
            id: zone.id, 
            type: ItemTypes.ZONE, 
            x, 
            y,
            originalX: zone.x,
            originalY: zone.y
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
        onClick(syntheticEvent as any, zone);
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
      startWidth: zone.width,
      startHeight: zone.height
    };
  };

  const handleResizeMove = (e: React.MouseEvent) => {
    if (!isResizing || !resizeStartPos.current || !resizeHandle || !onResize) return;
    
    const deltaX = e.clientX - resizeStartPos.current.x;
    const deltaY = e.clientY - resizeStartPos.current.y;
    
    let newWidth = resizeStartPos.current.startWidth;
    let newHeight = resizeStartPos.current.startHeight;
    
    // Calculate minimum size based on content
    const minWidth = zone.minWidth || 200;
    const minHeight = zone.minHeight || 150;
    
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
    
    onResize(zone.id, newWidth, newHeight);
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
  }, [isResizing, resizeHandle, zone.id, onResize]);

  // Global click handler to clear resize state when clicking outside
  React.useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Check if click is outside this zone
      if (!target.closest(`[data-zone-id="${zone.id}"]`)) {
        // Clear both resize state and hover state
        handleResizeEnd();
        setIsHovered(false);
      }
    };
    
    document.addEventListener('click', handleGlobalClick);
    
    return () => {
      document.removeEventListener('click', handleGlobalClick);
    };
  }, [isResizing, zone.id, handleResizeEnd, setIsHovered]);

  // Global keyboard handler for Escape key
  React.useEffect(() => {
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
    setEditValue(zone.label || '');
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
      onLabelChange(zone.id, editValue.trim());
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

  const isZone = true; // Always true now that we only have zones
  const hasLabel = !!zone.label && zone.label.trim() !== '';
  
  // Get text position with defaults
  const getTextPosition = () => {
    if (zone.textPosition) return zone.textPosition;
    return 'top-left'; // Default for zones
  };
  
  const textPosition = getTextPosition();
  const isInlinePosition = textPosition.startsWith('inline-');
  
  // Helper function to get text justification class (like textbox)
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

  // Helper function to get vertical justification class (like textbox)
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

  // Calculate text positioning classes and styles
  const getTextPositioning = () => {
    // Extract text styling to get justification and vertical positioning
    const textStyling = extractTextStylingFromZone(zone);
    const verticalPos = textStyling.textVerticalPosition || 'middle';
    
    // Determine positioning type
    const isInlinePosition = textPosition.startsWith('inline-');
    const isOutsidePosition = textPosition.startsWith('outside-');
    const isInsidePosition = textPosition === 'inside';
    
    // Base positioning styles for zones - simplified for top/bottom only
    const getBasePosition = () => {
      const position = textPosition as any;
      
      // Calculate vertical offset based on vertical position for inline/outside
      // For inline-top: adjust where along the top border the text appears
      // For inline-bottom: adjust where along the bottom border the text appears
      // Border is typically 2px thick, so we adjust within that range
      const getVerticalOffsetForTop = (baseOffset: number) => {
        // baseOffset is negative (e.g., -12 for inline-top)
        // For top border: 'top' = furthest from zone, 'bottom' = closest to zone
        if (verticalPos === 'top') {
          return baseOffset - 4; // At the top edge of the border line (furthest from zone) - slightly higher
        } else if (verticalPos === 'bottom') {
          return baseOffset + 8; // At the bottom edge of the border line (closest to zone)
        } else {
          return baseOffset + 2; // Middle of the border line
        }
      };
      
      const getVerticalOffsetForBottom = (baseOffset: number, isOutside: boolean = false) => {
        // baseOffset is negative (e.g., -12 for inline-bottom, -30 for outside-bottom)
        // For bottom border: 'top' = closest to zone, 'bottom' = furthest from zone (more outside)
        if (verticalPos === 'top') {
          // At the top edge of the border (closest to zone) - smaller bottom offset
          return baseOffset + 8;
        } else if (verticalPos === 'bottom') {
          // At the bottom edge of the border (furthest from zone)
          if (isOutside) {
            // For outside: should be much further outside the box - make it significantly more negative
            // This ensures text is clearly outside the zone border
            return baseOffset - 30;
          } else {
            // For inline: should be at bottom edge of border line - much lower position (inside zone)
            return baseOffset - 18;
          }
        } else {
          // Middle of the border line
          return baseOffset + 4;
        }
      };
      
      // Get horizontal positioning based on text justification
      const getHorizontalPosition = () => {
        const justify = textStyling.textJustify || 'left';
        if (justify === 'center') {
          return { left: '50%', right: 'auto', transform: 'translateX(-50%)' };
        } else if (justify === 'right') {
          return { left: 'auto', right: '0', transform: 'none' };
        } else {
          return { left: '0', right: 'auto', transform: 'none' };
        }
      };
      
      const horizontalPos = getHorizontalPosition();
      
      switch (position) {
        // Inline positions (text aligned with border) - top/bottom only
        case 'inline-top':
          // Position at top border, adjust based on vertical alignment
          const inlineTopOffset = getVerticalOffsetForTop(-12);
          return { 
            top: `${inlineTopOffset}px`, 
            ...horizontalPos,
            bottom: 'auto', 
            position: 'absolute' as const 
          };
        case 'inline-bottom':
          // Position at bottom border, adjust based on vertical alignment
          const inlineBottomOffset = getVerticalOffsetForBottom(-12, false);
          return { 
            bottom: `${-inlineBottomOffset}px`, 
            ...horizontalPos,
            top: 'auto', 
            position: 'absolute' as const 
          };
          
        // Outside positions (text outside but not inline) - determined by vertical position
        case 'outside-top':
          // Position outside top - add 2px more distance
          const outsideTopOffset = getVerticalOffsetForTop(-32);
          return { 
            top: `${outsideTopOffset}px`, 
            ...horizontalPos,
            bottom: 'auto', 
            position: 'absolute' as const 
          };
        case 'outside-bottom':
          // Position outside bottom - when vertical position is 'bottom'
          // For outside, we need negative bottom value (e.g., -30px) to position outside the zone
          // The more negative, the further outside
          // Adjust distance based on border width - thicker borders need more space
          const borderWidth = (zone as any).borderWidth || 2;
          const baseDistance = verticalPos === 'bottom' ? 40 : (verticalPos === 'top' ? 20 : 30);
          // Add extra distance for thicker borders (borderWidth - 2, since default is 2)
          const borderAdjustment = borderWidth > 2 ? (borderWidth - 2) : 0;
          const outsideBottomDistance = baseDistance + borderAdjustment;
          return { 
            bottom: `-${outsideBottomDistance}px`, 
            ...horizontalPos,
            top: 'auto', 
            position: 'absolute' as const 
          };
          
        // Traditional positions
        case 'top-left':
          return { top: '-12px', left: '4px', right: 'auto', bottom: 'auto', transform: 'none', position: 'absolute' as const };
        case 'top-center':
          return { top: '-12px', left: '50%', right: 'auto', bottom: 'auto', transform: 'translateX(-50%)', position: 'absolute' as const };
        case 'top-right':
          return { top: '-12px', right: '4px', left: 'auto', bottom: 'auto', transform: 'none', position: 'absolute' as const };
        case 'bottom-left':
          return { bottom: '-12px', left: '4px', right: 'auto', top: 'auto', transform: 'none', position: 'absolute' as const };
        case 'bottom-center':
          return { bottom: '-12px', left: '50%', right: 'auto', top: 'auto', transform: 'translateX(-50%)', position: 'absolute' as const };
        case 'bottom-right':
          return { bottom: '-12px', right: '4px', left: 'auto', top: 'auto', transform: 'none', position: 'absolute' as const };
          
        // Inside position - use full container with flexbox for vertical alignment
        case 'inside':
          return { top: '0', left: '0', right: '0', bottom: '0', transform: 'none', position: 'absolute' as const };
          
        default:
          return { top: '-12px', left: '4px', right: 'auto', bottom: 'auto', transform: 'none', position: 'absolute' as const };
      }
    };

    const basePosition = getBasePosition();
    
    // Common text styling properties - never include background for zones
    const getTextStyles = (): React.CSSProperties => ({
      fontFamily: textStyling.fontFamily,
      fontSize: textStyling.fontSize ? `${textStyling.fontSize}px` : undefined,
      fontWeight: textStyling.fontWeight,
      fontStyle: textStyling.fontStyle,
      textDecoration: textStyling.textDecoration,
      textTransform: textStyling.textTransform,
      letterSpacing: textStyling.letterSpacing ? `${textStyling.letterSpacing}px` : undefined,
      lineHeight: textStyling.lineHeight,
      opacity: textStyling.textOpacity,
      color: textStyling.textColor || textColor,
      backgroundColor: 'transparent', // Never show background for zone labels
      minWidth: 'max-content'
    });
    
    // For inline positions - simple positioning, no background
    if (isInlinePosition) {
      const combinedStyles: React.CSSProperties = {
        ...basePosition,
        ...getTextStyles(), // No background
        display: 'inline-block',
        padding: '2px 12px',
        backgroundColor: 'transparent', // Explicitly no background
        pointerEvents: 'auto',
        whiteSpace: 'nowrap',
        zIndex: 10
      };
      
      return {
        className: `hover:text-primary cursor-pointer ${getTextJustifyClass(textStyling.textJustify)}`,
        style: combinedStyles
      };
    }
    
    // For outside positions, use flexbox like textbox for proper vertical alignment, no background
    if (isOutsidePosition) {
      const combinedStyles: React.CSSProperties = {
        ...basePosition,
        ...getTextStyles(), // No background
        // Use flexbox for proper vertical alignment (like TextBox)
        display: 'flex',
        flexDirection: 'column',
        justifyContent: verticalPos === 'top' ? 'flex-start' : verticalPos === 'bottom' ? 'flex-end' : 'center',
        alignItems: 'stretch', // Full width for text alignment
        padding: '2px 8px',
        backgroundColor: 'transparent', // Explicitly no background
        pointerEvents: 'auto',
        whiteSpace: 'nowrap'
      };
      
      return {
        className: `hover:text-primary cursor-pointer ${getTextJustifyClass(textStyling.textJustify)}`,
        style: combinedStyles
      };
    }
    
    // For inside position, use absolute positioning with transparent background (like TextBox)
    if (isInsidePosition) {
      const insideStyles: React.CSSProperties = {
        ...basePosition,
        ...getTextStyles(), // No background
        // Use flexbox for proper text alignment (like TextBox)
        display: 'flex',
        flexDirection: 'column',
        justifyContent: verticalPos === 'top' ? 'flex-start' : verticalPos === 'bottom' ? 'flex-end' : 'center',
        alignItems: 'stretch', // Full width for text alignment
        padding: '8px',
        backgroundColor: 'transparent', // Explicitly no background
        pointerEvents: 'auto' // Allow interaction
      };
      
      return {
        className: `hover:text-primary cursor-pointer ${getTextJustifyClass(textStyling.textJustify)}`,
        style: insideStyles
      };
    }
    
    // For traditional positions, use flexbox layout, no background
    const combinedStyles: React.CSSProperties = {
      ...basePosition,
      ...getTextStyles(), // No background
      // Use flexbox for proper text alignment
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      justifyContent: verticalPos === 'top' ? 'flex-start' : verticalPos === 'bottom' ? 'flex-end' : 'center',
      backgroundColor: 'transparent', // Explicitly no background
      minHeight: '1.5em',
      height: 'auto'
    };
    
    return {
      className: `px-2 hover:text-primary cursor-pointer ${getTextJustifyClass(textStyling.textJustify)}`,
      style: combinedStyles
    };
  };
  
  // If no label, make zone invisible (just a container)
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
          left: zone.x,
          top: zone.y,
          width: zone.width,
          height: zone.height,
          pointerEvents: 'none' // Let clicks pass through to children
        }}
      />
    );
  }
  
  // Use new color properties with fallbacks
  const textColor = zone.textColor || '#374151';
  
  // Handle border color (solid or gradient)
  const borderStyle = zone.borderStyle || 'solid';
  const borderColors = zone.borderColors || [zone.borderColor || (isZone ? '#6b7280' : '#3b82f6'), zone.borderColor || (isZone ? '#6b7280' : '#3b82f6')];
  const borderColor = zone.borderColor || (isZone ? '#6b7280' : '#3b82f6');
  
  // Handle background color (solid or gradient)
  const backgroundStyle = zone.backgroundStyle || 'solid';
  const backgroundColors = zone.backgroundColors || [zone.backgroundColor || (isZone ? '#f3f4f6' : '#f3f4f6'), zone.backgroundColor || (isZone ? '#e5e7eb' : '#e5e7eb')];
  const backgroundColor = zone.backgroundColor || (isZone ? 'transparent' : '#f3f4f6');
  const rotation = zone.rotation || 0;

  return (
    <div
      data-zone-id={zone.id}
      ref={(node) => {
        if (node) {
          drag(node);
        }
      }}
      className={cn(
        "absolute cursor-move",
        zone.layoutType === 'circular' ? "rounded-full" : "rounded-lg",
        borderStyle !== 'none' && "border-2",
        borderStyle === 'none' && (isSelected 
          ? "border border-dashed border-primary opacity-100" 
          : "opacity-100 hover:border hover:border-dashed hover:border-primary hover:bg-primary/5"),
        (isDragging || isTouchDragging) && "cursor-grabbing",
        isResizing && "opacity-50",
        (isSelected || isDropTarget || isMultiSelected) && "ring-2 ring-primary ring-offset-2",
        isGroupMember && !isSelected && !isDropTarget && !isMultiSelected && "ring-2 ring-green-500 ring-offset-2",
        isTargetable && "ring-2 ring-green-500 ring-offset-2 animate-pulse",
        zone.shadow && "shadow-[0_10px_15px_-3px_rgba(239,68,68,0.3),0_4px_6px_-2px_rgba(239,68,68,0.2)]",
        "zone" // Add zone class for CSS selectors
      )}
      style={{
        left: zone.x,
        top: zone.y,
        width: zone.width,
        height: zone.height,
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
          borderWidth: (zone as any).borderWidth || 2,
          borderStyle: borderStyle,
          borderColor: borderColor
        }),
        color: textColor,
        margin: zone.shadow ? 4 : 0, // Add margin when shadow is enabled to prevent clipping
        touchAction: 'none',
        transform: rotation !== 0 
          ? `rotate(${rotation}deg)${zone.shadow ? ' translateZ(0)' : ''}`
          : (zone.shadow ? 'translateZ(0)' : undefined),
        transformOrigin: 'center',
        ...(zone.shadow && { 
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' // More prominent shadow
        })
      }}
      onClick={(e) => onClick && onClick(e, zone)}
      onContextMenu={(e) => onContextMenu && onContextMenu(e, zone)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseEnter={handleGroupMouseEnter}
      onMouseLeave={handleGroupMouseLeave}
    >
      {/* Resize handles - only show when hovered or resizing */}
      {(isHovered || isResizing || isSelected) && zone.sizeMode !== 'auto' && (
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
        <div
          className={cn(
            "px-2 text-sm font-semibold bg-background border border-primary rounded outline-none",
            "focus:ring-2 focus:ring-primary focus:ring-offset-1",
            getTextPositioning().className
          )}
          style={getTextPositioning().style}
        >
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={handleLabelChange}
            onKeyDown={handleLabelKeyDown}
            onBlur={handleLabelBlur}
            className="w-full bg-transparent outline-none border-none p-0"
            style={{ display: 'block' }}
          />
        </div>
      ) : (
        <Popover>
          <PopoverTrigger asChild>
            <div 
              className={cn(
                "text-sm font-semibold hover:text-primary cursor-pointer",
                getTextPositioning().className
              )}
              style={getTextPositioning().style}
              onDoubleClick={handleLabelStartEdit}
            >
               <span 
                 className="break-words leading-normal whitespace-pre-wrap w-full"
                 style={{ display: 'block' }}
               >
                 {zone.label}
               </span>
            </div>
          </PopoverTrigger>
          {zone.info && (
            <PopoverContent
              side="top"
              align="start"
              className="w-80 bg-popover text-popover-foreground shadow-xl border-accent"
            >
              <div className="space-y-2">
                {zone.label && <h4 className="font-semibold font-headline text-primary">{zone.label}</h4>}
                <p className="text-sm">{zone.info}</p>
              </div>
            </PopoverContent>
          )}
        </Popover>
      )}
    </div>
  );
}
