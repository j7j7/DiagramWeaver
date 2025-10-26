"use client";

import React from 'react';
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
}

function hexToRgba(hex: string, alpha: number) {
    let c: any;
    if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
        c = hex.substring(1).split('');
        if (c.length === 3) {
            c = [c[0], c[0], c[1], c[1], c[2], c[2]];
        }
        c = '0x' + c.join('');
        return `rgba(${[(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',')},${alpha})`;
    }
    return hex;
}


export function DiagramGroup({ group, isSelected, isDropTarget, isTargetable }: DiagramGroupProps) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.GROUP,
    item: { ...group, type: ItemTypes.GROUP },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [group]);

  const isZone = group.subType === 'zone';
  
  // Use new color properties with fallbacks
  const borderColor = group.borderColor || (isZone ? '#6b7280' : '#3b82f6');
  const textColor = group.textColor || '#374151';
  const backgroundColor = group.backgroundColor || (isZone ? 'transparent' : '#f3f4f6');

  return (
    <div
      ref={drag as any}
      className={cn(
        "absolute rounded-lg cursor-move",
        isZone ? "border-2 border-dashed" : "border-2",
        isDragging && "opacity-50",
        (isSelected || isDropTarget) && "ring-2 ring-primary ring-offset-2",
        isTargetable && "ring-2 ring-green-500 ring-offset-2 animate-pulse",
        group.shadow && "shadow-lg"
        )}
      style={{
        left: group.x,
        top: group.y,
        width: group.width,
        height: group.height,
        backgroundColor: backgroundColor,
        borderColor: borderColor,
        color: textColor,
      }}
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
              <h4 className="font-semibold font-headline text-primary">{group.label}</h4>
              <p className="text-sm">{group.info}</p>
            </div>
          </PopoverContent>
        )}
      </Popover>
    </div>
  );
}
