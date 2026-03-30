"use client";
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useDrag } from 'react-dnd';
import { Card, CardContent } from '../ui/card';
import { DraggableItem, ItemTypes } from './draggable-item';
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip';
import { buildResourceIconPath } from '@/lib/resource-mapping';
import { ResourceIcon } from '@/components/diagram/resource-icon';

interface DraggableResourceItemProps {
  resource: {
    name: string;
    file?: string; // Optional for icon resources (icons use DraggableIconItem)
    type?: string;
    hasWhiteVariant?: boolean;
    format?: string;
  };
  provider: string;
  category: string;
  icon: React.ReactNode;
  /** When true, invert image in dark mode (for black shape icons) */
  invertInDarkMode?: boolean;
  onClick?: (args: { resource: DraggableResourceItemProps['resource']; provider: string; category: string }) => void;
  onDoubleClick?: (args: { resource: DraggableResourceItemProps['resource']; provider: string; category: string }) => void;
  isSelected?: boolean;
  viewMode?: 'normal' | 'compact';
}

export function DraggableResourceItem({ resource, provider, category, icon, onClick, onDoubleClick, isSelected, viewMode = 'normal', invertInDarkMode = false }: DraggableResourceItemProps) {
  const [imageError, setImageError] = useState(false);

  // Icon path for display in sidebar - NEVER passed to node
  const iconPath = useMemo(() => {
    if (!resource.file) return '';
    const derivedSlug = resource.name.replace(/\s+/g, '-').toLowerCase();
    const pathCategory =
      provider === 'generic' && category === 'text' && derivedSlug === 'text-box-heading'
        ? 'object'
        : category;
    return buildResourceIconPath(provider, pathCategory, resource.file);
  }, [provider, category, resource.file, resource.name]);
  
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
    
    const isTextPaletteTextBoxHeading =
      provider === 'generic' && category === 'text' && derivedSlug === 'text-box-heading';
    return {
      type: isTextPaletteTextBoxHeading ? 'generic.object.text-box-heading' : `${provider}.${category}.${derivedSlug}`,
      label: resource.name,
      provider,
      category: isTextPaletteTextBoxHeading ? 'object' : category,
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

  const isCompact = viewMode === 'compact';
  const isTextBoxHeadingResource =
    resource.name.replace(/\s+/g, '-').toLowerCase() === 'text-box-heading';

  const dragWrapper = (
    <div
      ref={(node) => {
        if (node) {
          drag(node);
        }
      }}
      style={{ opacity: (isDragging || isTouchDragging) ? 0.5 : 1 }}
      className={`cursor-move min-w-0 ${isSelected ? 'ring-2 ring-primary ring-offset-2' : ''}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={() => onClick?.({ resource, provider, category })}
      onDoubleClick={() => onDoubleClick?.({ resource, provider, category })}
    >
      {isCompact ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Card className="hover:bg-accent hover:text-accent-foreground transition-colors w-full min-w-0 aspect-square">
              <CardContent className="p-1 flex h-full min-h-0 w-full flex-col items-center justify-center gap-0.5 text-center min-w-0">
                <div className={`flex h-full w-full min-h-0 flex-1 items-center justify-center text-muted-foreground ${invertInDarkMode && !isTextBoxHeadingResource ? 'dark:[&_img]:invert' : ''}`}>
                  {isTextBoxHeadingResource ? (
                    <ResourceIcon type="generic.object.text-box-heading" width={48} height={48} className="max-h-[90%] max-w-[90%] shrink-0 object-contain" />
                  ) : !imageError && iconPath ? (
                    <img
                      src={iconPath}
                      alt={resource.name}
                      className="max-h-[92%] max-w-[92%] h-auto w-auto object-contain"
                      onError={handleImageError}
                    />
                  ) : (
                    icon
                  )}
                </div>
                {resource.hasWhiteVariant && (
                  <div className="text-[10px] text-muted-foreground leading-none">W</div>
                )}
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent>
            <p>{resource.name}</p>
          </TooltipContent>
        </Tooltip>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <Card className="hover:bg-accent hover:text-accent-foreground transition-colors min-w-0">
              <CardContent className="p-2 flex flex-col items-center justify-center gap-1 text-center h-16 min-w-0 w-full">
                <div className={`w-6 h-6 flex items-center justify-center flex-shrink-0 text-muted-foreground ${invertInDarkMode && !isTextBoxHeadingResource ? 'dark:[&_img]:invert' : ''}`}>
                  {isTextBoxHeadingResource ? (
                    <ResourceIcon type="generic.object.text-box-heading" width={24} height={24} className="shrink-0" />
                  ) : !imageError && iconPath ? (
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
                <div className="w-full min-w-0 overflow-hidden">
                  <span className="font-medium text-xs leading-tight truncate block">
                    {resource.name}
                  </span>
                </div>
                {resource.hasWhiteVariant && (
                  <div className="text-xs text-muted-foreground">White</div>
                )}
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent>
            <p>{resource.name}</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );

  return dragWrapper;
}