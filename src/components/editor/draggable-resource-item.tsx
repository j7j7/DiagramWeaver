"use client";
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useDrag } from 'react-dnd';
import { Card, CardContent } from '../ui/card';
import { DraggableItem, ItemTypes } from './draggable-item';

interface DraggableResourceItemProps {
  resource: {
    name: string;
    file: string;
    type?: string;
    hasWhiteVariant?: boolean;
    format?: string;
  };
  provider: string;
  category: string;
  icon: React.ReactNode;
}

export function DraggableResourceItem({ resource, provider, category, icon }: DraggableResourceItemProps) {
  const [imageError, setImageError] = useState(false);

  // Icon path for display in sidebar - NEVER passed to node
  const iconPath = useMemo(() => {
    return `/resources/${provider}/${category}/${resource.file}`;
  }, [provider, category, resource.file]);
  
  const item = useMemo(() => {
    const derivedSlug = resource.name.replace(/\s+/g, '-').toLowerCase();

    // Pass file for initial rendering only (NOT stored in node)
    // Check if this is a zone resource (either by type field or by category)
    const isZoneResource = (provider === 'generic' && category === 'grouping') || resource.type === 'zone';
    
    if (isZoneResource) {
      // Zone should create zone type with subType
      const subType = resource.name.toLowerCase(); // 'zone'
      
      const dragItem = {
        type: 'zone', // Always create zone type
        subType, // Preserve subType
        label: resource.name,
        provider,
        category,
        file: resource.file, // For ResourceIcon lookup during drag
      };
      

      return dragItem;
    }
    
    return {
      type: `${provider}.${category}.${derivedSlug}`,
      label: resource.name,
      provider,
      category,
      file: resource.file, // For ResourceIcon lookup during drag
    };
  }, [resource.name, provider, category, resource.file]);

  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.DIAGRAM_NODE,
    item: item,
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }), [item]);

  const [isTouchDragging, setIsTouchDragging] = useState(false);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);

  // Touch event handlers for mobile drag and drop
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    setIsTouchDragging(true);
    (e.currentTarget as HTMLElement).style.opacity = '0.5';
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPos.current) return;
    
    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartPos.current.x);
    const deltaY = Math.abs(touch.clientY - touchStartPos.current.y);
    
    // Only start dragging if moved enough to prevent accidental drags
    if (deltaX > 10 || deltaY > 10) {
      e.preventDefault(); // Prevent scrolling when dragging
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
        
        // Check if touch ended over canvas
        if (touch.clientX >= canvasRect.left && touch.clientX <= canvasRect.right &&
            touch.clientY >= canvasRect.top && touch.clientY <= canvasRect.bottom) {
          
          // Calculate position relative to canvas
          const x = touch.clientX - canvasRect.left;
          const y = touch.clientY - canvasRect.top;
          
          // Dispatch a custom event to the canvas
          const dropEvent = new CustomEvent('mobileDrop', {
            detail: { item, x, y, itemType: ItemTypes.DIAGRAM_NODE }
          });
          canvas.dispatchEvent(dropEvent);
        }
      }
    }
    
    // Reset styles
    (e.currentTarget as HTMLElement).style.opacity = '1';
    setIsTouchDragging(false);
    touchStartPos.current = null;
  };

  // Handle image loading errors - show fallback icon
  const handleImageError = () => {
    setImageError(true);
  };

  return (
    <div
      ref={(node) => {
        if (node) {
          drag(node);
        }
      }}
      style={{ opacity: (isDragging || isTouchDragging) ? 0.5 : 1 }}
      className="cursor-move"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <Card className="hover:bg-accent hover:text-accent-foreground transition-colors">
        <CardContent className="p-2 flex flex-col items-center justify-center gap-1 text-center h-16">
          <div className="w-6 h-6 flex items-center justify-center">
            {!imageError ? (
              <img
                src={iconPath}
                alt={resource.name}
                className="w-6 h-6 object-contain"
                onError={handleImageError}
              />
            ) : (
              icon
            )}
          </div>
          <span className="font-medium text-xs leading-tight">
            {resource.name}
          </span>
          {resource.hasWhiteVariant && (
            <div className="text-xs text-muted-foreground">White</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}