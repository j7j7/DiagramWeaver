"use client";

import React, { useMemo } from 'react';
import { Card, CardContent } from '../ui/card';
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip';
import { usePalettePointerDrag } from '@/hooks/use-palette-pointer-drag';
import type { UserDefinedObject } from '@/lib/types';
import { getUserDefinedObjectDragItem } from '@/lib/user-defined-objects';

interface DraggableUserDefinedItemProps {
  object: UserDefinedObject;
  onClick?: () => void;
  onDoubleClick?: () => void;
  viewMode?: 'normal' | 'compact';
}

export function DraggableUserDefinedItem({
  object,
  onClick,
  onDoubleClick,
  viewMode = 'normal',
}: DraggableUserDefinedItemProps) {
  const item = useMemo(() => getUserDefinedObjectDragItem(object), [object]);
  const { isDragging, pointerHandlers } = usePalettePointerDrag(item, {
    onTap: () => onClick?.(),
  });

  const isCompact = viewMode === 'compact';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Card
          className={`cursor-grab active:cursor-grabbing transition-opacity touch-target ${
            isDragging ? 'opacity-40' : 'opacity-100'
          } ${isCompact ? 'h-10' : ''}`}
          {...pointerHandlers}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onDoubleClick?.();
          }}
        >
          <CardContent
            className={`flex flex-col items-center justify-center gap-1 p-2 pointer-events-none select-none ${
              isCompact ? 'flex-row gap-2 py-1 px-2' : ''
            }`}
          >
            <span
              className="inline-flex items-center justify-center text-muted-foreground [&_svg]:w-6 [&_svg]:h-6"
              dangerouslySetInnerHTML={{ __html: object.iconSvg }}
            />
            {!isCompact && (
              <span className="text-[10px] leading-tight text-center text-muted-foreground line-clamp-2 w-full">
                {object.name}
              </span>
            )}
          </CardContent>
        </Card>
      </TooltipTrigger>
      <TooltipContent side="right">
        <p>{object.name}</p>
        <p className="text-xs text-muted-foreground">generic.user-defined</p>
      </TooltipContent>
    </Tooltip>
  );
}
