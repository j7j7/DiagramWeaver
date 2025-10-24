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


export function DiagramGroup({ group, isSelected, isDropTarget }: DiagramGroupProps) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.GROUP,
    item: { ...group, type: ItemTypes.GROUP },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [group]);

  const isZone = group.subType === 'zone';
  const backgroundColor = group.color ? hexToRgba(group.color, 0.1) : 'transparent';

  return (
    <div
      ref={drag}
      className={cn(
        "absolute rounded-lg cursor-move",
        isZone ? "border-2 border-dashed border-muted-foreground" : `border-2 border-transparent`,
        isDragging && "opacity-50",
        (isSelected || isDropTarget) && "ring-2 ring-primary ring-offset-2"
        )}
      style={{
        left: group.x,
        top: group.y,
        width: group.width,
        height: group.height,
        backgroundColor: !isZone ? backgroundColor : 'transparent',
        borderColor: !isZone && group.color ? group.color : undefined,
      }}
    >
      <Popover>
        <PopoverTrigger asChild>
          <div className={cn(
            "absolute px-2 bg-background text-sm font-semibold hover:text-primary cursor-pointer",
            isZone ? "-top-3 left-4 text-muted-foreground" : "bottom-1 right-2 text-foreground"
          )}>
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
