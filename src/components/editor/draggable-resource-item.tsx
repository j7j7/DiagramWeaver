"use client";
import React, { useMemo, useState, useRef } from 'react';
import { useDrag } from 'react-dnd';
import { Card, CardContent } from '../ui/card';
import { ItemTypes, emitMobilePaletteDropIfOverCanvas } from './draggable-item';
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

function DraggableResourceItemInner({ resource, provider, category, icon, onClick, onDoubleClick, isSelected, viewMode = 'normal', invertInDarkMode = false }: DraggableResourceItemProps) {
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
    const isPieChartPalette = provider === 'generic' && category === 'object' && derivedSlug === 'pie-chart';
    const isBarChartPalette = provider === 'generic' && category === 'object' && derivedSlug === 'bar-chart';
    const isLineChartPalette = provider === 'generic' && category === 'object' && derivedSlug === 'line-chart';
    const isRingChartPalette = provider === 'generic' && category === 'object' && derivedSlug === 'ring-chart';
    const isGridChartPalette = provider === 'generic' && category === 'object' && derivedSlug === 'grid-chart';
    const isCardPalette = provider === 'generic' && category === 'cards';
    const isBorderPalette = provider === 'generic' && category === 'borders';
    return {
      type: isTextPaletteTextBoxHeading
        ? 'generic.object.text-box-heading'
        : isPieChartPalette
          ? 'generic.chart.pie'
          : isBarChartPalette
            ? 'generic.chart.bar'
            : isLineChartPalette
              ? 'generic.chart.line'
              : isRingChartPalette
                ? 'generic.chart.ring'
                : isGridChartPalette
                  ? 'generic.chart.grid'
                  : isBorderPalette
                  ? `generic.border.${derivedSlug}`
                : isCardPalette
                  ? `generic.card.${derivedSlug}`
                  : `${provider}.${category}.${derivedSlug}`,
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
    
    if (deltaX > 10 || deltaY > 10) {
      emitMobilePaletteDropIfOverCanvas({
        touchClientX: touch.clientX,
        touchClientY: touch.clientY,
        item,
      });
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
  const derivedPaletteSlug = resource.name.replace(/\s+/g, '-').toLowerCase();
  const isTextBoxHeadingResource = derivedPaletteSlug === 'text-box-heading';
  const isPieChartPalette = provider === 'generic' && category === 'object' && derivedPaletteSlug === 'pie-chart';
  const isBarChartPalette = provider === 'generic' && category === 'object' && derivedPaletteSlug === 'bar-chart';
  const isLineChartPalette = provider === 'generic' && category === 'object' && derivedPaletteSlug === 'line-chart';
  const isRingChartPalette = provider === 'generic' && category === 'object' && derivedPaletteSlug === 'ring-chart';
  const isGridChartPalette = provider === 'generic' && category === 'object' && derivedPaletteSlug === 'grid-chart';
  const isCloudPalette = provider === 'generic' && category === 'object' && derivedPaletteSlug === 'cloud';
  const isProgressBarPalette = provider === 'generic' && category === 'object' && derivedPaletteSlug === 'progress-bar';
  const isTimelineBarPalette = provider === 'generic' && category === 'object' && derivedPaletteSlug === 'timeline-bar';
  const isSegmentedRectanglePalette =
    provider === 'generic' && category === 'object' && derivedPaletteSlug === 'segmented-rectangle';
  const isPyramidPalette = provider === 'generic' && category === 'object' && derivedPaletteSlug === 'pyramid';
  const isTimelinePalette = provider === 'generic' && category === 'object' && derivedPaletteSlug === 'timeline';
  const isMindmapPalette =
    provider === 'generic' && category === 'object' && derivedPaletteSlug === 'mind-map-node';

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
                  ) : isPieChartPalette ? (
                    <ResourceIcon type="generic.chart.pie" width={48} height={48} className="max-h-[90%] max-w-[90%] shrink-0 object-contain" />
                  ) : isBarChartPalette ? (
                    <ResourceIcon type="generic.chart.bar" width={48} height={48} className="max-h-[90%] max-w-[90%] shrink-0 object-contain" />
                  ) : isLineChartPalette ? (
                    <ResourceIcon type="generic.chart.line" width={48} height={48} className="max-h-[90%] max-w-[90%] shrink-0 object-contain" />
                  ) : isRingChartPalette ? (
                    <ResourceIcon type="generic.chart.ring" width={48} height={48} className="max-h-[90%] max-w-[90%] shrink-0 object-contain" />
                  ) : isGridChartPalette ? (
                    <ResourceIcon type="generic.chart.grid" width={48} height={48} className="max-h-[90%] max-w-[90%] shrink-0 object-contain" />
                  ) : isCloudPalette ? (
                    <ResourceIcon type="generic.object.cloud" width={48} height={48} className="max-h-[90%] max-w-[90%] shrink-0 object-contain" />
                  ) : isProgressBarPalette ? (
                    <ResourceIcon type="generic.object.progress-bar" width={48} height={48} className="max-h-[90%] max-w-[90%] shrink-0 object-contain" />
                  ) : isTimelineBarPalette ? (
                    <ResourceIcon type="generic.object.timeline-bar" width={48} height={48} className="max-h-[90%] max-w-[90%] shrink-0 object-contain" />
                  ) : isSegmentedRectanglePalette ? (
                    <ResourceIcon type="generic.object.segmented-rectangle" width={48} height={48} className="max-h-[90%] max-w-[90%] shrink-0 object-contain" />
                  ) : isPyramidPalette ? (
                    <ResourceIcon type="generic.object.pyramid" width={48} height={48} className="max-h-[90%] max-w-[90%] shrink-0 object-contain" />
                  ) : isTimelinePalette ? (
                    <ResourceIcon type="generic.object.timeline" width={48} height={48} className="max-h-[90%] max-w-[90%] shrink-0 object-contain" />
                  ) : isMindmapPalette ? (
                    <ResourceIcon type="generic.object.mind-map-node" width={48} height={48} className="max-h-[90%] max-w-[90%] shrink-0 object-contain" />
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
                  ) : isPieChartPalette ? (
                    <ResourceIcon type="generic.chart.pie" width={24} height={24} className="shrink-0" />
                  ) : isBarChartPalette ? (
                    <ResourceIcon type="generic.chart.bar" width={24} height={24} className="shrink-0" />
                  ) : isLineChartPalette ? (
                    <ResourceIcon type="generic.chart.line" width={24} height={24} className="shrink-0" />
                  ) : isRingChartPalette ? (
                    <ResourceIcon type="generic.chart.ring" width={24} height={24} className="shrink-0" />
                  ) : isGridChartPalette ? (
                    <ResourceIcon type="generic.chart.grid" width={24} height={24} className="shrink-0" />
                  ) : isCloudPalette ? (
                    <ResourceIcon type="generic.object.cloud" width={24} height={24} className="shrink-0" />
                  ) : isProgressBarPalette ? (
                    <ResourceIcon type="generic.object.progress-bar" width={24} height={24} className="shrink-0" />
                  ) : isTimelineBarPalette ? (
                    <ResourceIcon type="generic.object.timeline-bar" width={24} height={24} className="shrink-0" />
                  ) : isSegmentedRectanglePalette ? (
                    <ResourceIcon type="generic.object.segmented-rectangle" width={24} height={24} className="shrink-0" />
                  ) : isPyramidPalette ? (
                    <ResourceIcon type="generic.object.pyramid" width={24} height={24} className="shrink-0" />
                  ) : isTimelinePalette ? (
                    <ResourceIcon type="generic.object.timeline" width={24} height={24} className="shrink-0" />
                  ) : isMindmapPalette ? (
                    <ResourceIcon type="generic.object.mind-map-node" width={24} height={24} className="shrink-0" />
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

function areDraggableResourceItemPropsEqual(prev: DraggableResourceItemProps, next: DraggableResourceItemProps): boolean {
  return (
    prev.resource === next.resource &&
    prev.provider === next.provider &&
    prev.category === next.category &&
    prev.isSelected === next.isSelected &&
    prev.viewMode === next.viewMode &&
    prev.invertInDarkMode === next.invertInDarkMode &&
    prev.onClick === next.onClick &&
    prev.onDoubleClick === next.onDoubleClick
  );
}

export const DraggableResourceItem = React.memo(DraggableResourceItemInner, areDraggableResourceItemPropsEqual);