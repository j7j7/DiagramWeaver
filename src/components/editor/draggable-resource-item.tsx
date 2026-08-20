"use client";
import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '../ui/card';
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip';
import { buildResourceIconPath } from '@/lib/resource-mapping';
import { ResourceIcon } from '@/components/diagram/resource-icon';
import { usePalettePointerDrag } from '@/hooks/use-palette-pointer-drag';

interface DraggableResourceItemProps {
  resource: {
    name: string;
    file?: string;
    type?: string;
    hasWhiteVariant?: boolean;
    format?: string;
  };
  provider: string;
  category: string;
  icon: React.ReactNode;
  invertInDarkMode?: boolean;
  onClick?: (args: { resource: DraggableResourceItemProps['resource']; provider: string; category: string }) => void;
  onDoubleClick?: (args: { resource: DraggableResourceItemProps['resource']; provider: string; category: string }) => void;
  isSelected?: boolean;
  viewMode?: 'normal' | 'compact';
}

function DraggableResourceItemInner({ resource, provider, category, icon, onClick, onDoubleClick, isSelected, viewMode = 'normal', invertInDarkMode = false }: DraggableResourceItemProps) {
  const [imageError, setImageError] = useState(false);

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
    const isZoneResource = (provider === 'generic' && category === 'grouping') || resource.type === 'zone';
    
    if (isZoneResource) {
      return {
        type: 'zone',
        subType: resource.name.toLowerCase(),
        label: resource.name,
        provider,
        category,
        file: resource.file,
      };
    }
    
    const isTextPaletteTextBoxHeading =
      provider === 'generic' && category === 'text' && derivedSlug === 'text-box-heading';
    const isPieChartPalette = provider === 'generic' && category === 'object' && derivedSlug === 'pie-chart';
    const isBarChartPalette = provider === 'generic' && category === 'object' && derivedSlug === 'bar-chart';
    const isLineChartPalette = provider === 'generic' && category === 'object' && derivedSlug === 'line-chart';
    const isRingChartPalette = provider === 'generic' && category === 'object' && derivedSlug === 'ring-chart';
    const isGridChartPalette = provider === 'generic' && category === 'object' && derivedSlug === 'grid-chart';
    const isGanttChartPalette = provider === 'generic' && category === 'object' && derivedSlug === 'gantt-chart';
    const isLoopChartPalette = provider === 'generic' && category === 'object' && derivedSlug === 'loop-chart';
    const isArrowChartPalette = provider === 'generic' && category === 'object' && derivedSlug === 'arrow-chart';
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
                  : isGanttChartPalette
                    ? 'generic.chart.gantt'
                    : isLoopChartPalette
                      ? 'generic.chart.loop'
                      : isArrowChartPalette
                        ? 'generic.chart.arrow'
                  : isBorderPalette
                  ? `generic.border.${derivedSlug}`
                : isCardPalette
                  ? `generic.card.${derivedSlug}`
                  : `${provider}.${category}.${derivedSlug}`,
      label: resource.name,
      provider,
      category: isTextPaletteTextBoxHeading ? 'object' : category,
      file: resource.file,
    };
  }, [resource.name, provider, category, resource.file, resource.type]);

  const { isDragging, pointerHandlers } = usePalettePointerDrag(item, {
    onTap: () => onClick?.({ resource, provider, category }),
  });

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
  const isGanttChartPalette = provider === 'generic' && category === 'object' && derivedPaletteSlug === 'gantt-chart';
  const isLoopChartPalette = provider === 'generic' && category === 'object' && derivedPaletteSlug === 'loop-chart';
  const isArrowChartPalette = provider === 'generic' && category === 'object' && derivedPaletteSlug === 'arrow-chart';
  const isCloudPalette = provider === 'generic' && category === 'object' && derivedPaletteSlug === 'cloud';
  const isProgressBarPalette = provider === 'generic' && category === 'object' && derivedPaletteSlug === 'progress-bar';
  const isTimelineBarPalette = provider === 'generic' && category === 'object' && derivedPaletteSlug === 'timeline-bar';
  const isSegmentedRectanglePalette =
    provider === 'generic' && category === 'object' && derivedPaletteSlug === 'segmented-rectangle';
  const isPyramidPalette = provider === 'generic' && category === 'object' && derivedPaletteSlug === 'pyramid';
  const isTimelinePalette = provider === 'generic' && category === 'object' && derivedPaletteSlug === 'timeline';
  const isMindmapPalette =
    provider === 'generic' && category === 'object' && derivedPaletteSlug === 'mind-map-node';

  const innerIconClass = `pointer-events-none select-none flex items-center justify-center text-muted-foreground ${invertInDarkMode && !isTextBoxHeadingResource ? 'dark:[&_img]:invert' : ''}`;
  const paletteImgProps = {
    draggable: false as const,
    onDragStart: (e: React.DragEvent) => {
      e.preventDefault();
    },
  };

  const renderIconContent = (size: 'compact' | 'normal') => {
    const dim = size === 'compact' ? 48 : 24;
    const imgClass =
      size === 'compact'
        ? 'max-h-[92%] max-w-[92%] h-auto w-auto object-contain'
        : 'w-6 h-6 object-contain';

    if (isTextBoxHeadingResource) {
      return <ResourceIcon type="generic.object.text-box-heading" width={dim} height={dim} className={size === 'compact' ? 'max-h-[90%] max-w-[90%] shrink-0 object-contain' : 'shrink-0'} />;
    }
    if (isPieChartPalette) {
      return <ResourceIcon type="generic.chart.pie" width={dim} height={dim} className={size === 'compact' ? 'max-h-[90%] max-w-[90%] shrink-0 object-contain' : 'shrink-0'} />;
    }
    if (isBarChartPalette) {
      return <ResourceIcon type="generic.chart.bar" width={dim} height={dim} className={size === 'compact' ? 'max-h-[90%] max-w-[90%] shrink-0 object-contain' : 'shrink-0'} />;
    }
    if (isLineChartPalette) {
      return <ResourceIcon type="generic.chart.line" width={dim} height={dim} className={size === 'compact' ? 'max-h-[90%] max-w-[90%] shrink-0 object-contain' : 'shrink-0'} />;
    }
    if (isRingChartPalette) {
      return <ResourceIcon type="generic.chart.ring" width={dim} height={dim} className={size === 'compact' ? 'max-h-[90%] max-w-[90%] shrink-0 object-contain' : 'shrink-0'} />;
    }
    if (isGridChartPalette) {
      return <ResourceIcon type="generic.chart.grid" width={dim} height={dim} className={size === 'compact' ? 'max-h-[90%] max-w-[90%] shrink-0 object-contain' : 'shrink-0'} />;
    }
    if (isGanttChartPalette) {
      return <ResourceIcon type="generic.chart.gantt" width={dim} height={dim} className={size === 'compact' ? 'max-h-[90%] max-w-[90%] shrink-0 object-contain' : 'shrink-0'} />;
    }
    if (isLoopChartPalette) {
      return <ResourceIcon type="generic.chart.loop" width={dim} height={dim} className={size === 'compact' ? 'max-h-[90%] max-w-[90%] shrink-0 object-contain' : 'shrink-0'} />;
    }
    if (isArrowChartPalette) {
      return <ResourceIcon type="generic.chart.arrow" width={dim} height={dim} className={size === 'compact' ? 'max-h-[90%] max-w-[90%] shrink-0 object-contain' : 'shrink-0'} />;
    }
    if (isCloudPalette) {
      return <ResourceIcon type="generic.object.cloud" width={dim} height={dim} className={size === 'compact' ? 'max-h-[90%] max-w-[90%] shrink-0 object-contain' : 'shrink-0'} />;
    }
    if (isProgressBarPalette) {
      return <ResourceIcon type="generic.object.progress-bar" width={dim} height={dim} className={size === 'compact' ? 'max-h-[90%] max-w-[90%] shrink-0 object-contain' : 'shrink-0'} />;
    }
    if (isTimelineBarPalette) {
      return <ResourceIcon type="generic.object.timeline-bar" width={dim} height={dim} className={size === 'compact' ? 'max-h-[90%] max-w-[90%] shrink-0 object-contain' : 'shrink-0'} />;
    }
    if (isSegmentedRectanglePalette) {
      return <ResourceIcon type="generic.object.segmented-rectangle" width={dim} height={dim} className={size === 'compact' ? 'max-h-[90%] max-w-[90%] shrink-0 object-contain' : 'shrink-0'} />;
    }
    if (isPyramidPalette) {
      return <ResourceIcon type="generic.object.pyramid" width={dim} height={dim} className={size === 'compact' ? 'max-h-[90%] max-w-[90%] shrink-0 object-contain' : 'shrink-0'} />;
    }
    if (isTimelinePalette) {
      return <ResourceIcon type="generic.object.timeline" width={dim} height={dim} className={size === 'compact' ? 'max-h-[90%] max-w-[90%] shrink-0 object-contain' : 'shrink-0'} />;
    }
    if (isMindmapPalette) {
      return <ResourceIcon type="generic.object.mind-map-node" width={dim} height={dim} className={size === 'compact' ? 'max-h-[90%] max-w-[90%] shrink-0 object-contain' : 'shrink-0'} />;
    }
    if (!imageError && iconPath) {
      return (
        <img
          src={iconPath}
          alt={resource.name}
          className={imgClass}
          onError={handleImageError}
          {...paletteImgProps}
        />
      );
    }
    return icon;
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          {...pointerHandlers}
          style={{ opacity: isDragging ? 0.5 : 1, ...pointerHandlers.style }}
          className={`cursor-move min-w-0 ${isSelected ? 'ring-2 ring-primary ring-offset-2' : ''}`}
          data-dw-recording-action={derivedPaletteSlug}
          onDoubleClick={() => onDoubleClick?.({ resource, provider, category })}
        >
          {isCompact ? (
            <Card className="hover:bg-accent hover:text-accent-foreground transition-colors w-full min-w-0 aspect-square pointer-events-none select-none">
              <CardContent className="p-1 flex h-full min-h-0 w-full flex-col items-center justify-center gap-0.5 text-center min-w-0">
                <div className={`${innerIconClass} h-full w-full min-h-0 flex-1`}>
                  {renderIconContent('compact')}
                </div>
                {resource.hasWhiteVariant && (
                  <div className="text-[10px] text-muted-foreground leading-none">W</div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="hover:bg-accent hover:text-accent-foreground transition-colors min-w-0 pointer-events-none select-none">
              <CardContent className="p-2 flex flex-col items-center justify-center gap-1 text-center h-16 min-w-0 w-full">
                <div className={`${innerIconClass} w-6 h-6 flex-shrink-0`}>
                  {renderIconContent('normal')}
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
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>{resource.name}</p>
      </TooltipContent>
    </Tooltip>
  );
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
