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
      ref={drag as any}
className={cn(
        "absolute rounded-lg cursor-move",
        isZone ? "border-2 border-dashed" : "border-2",
        isDragging && "opacity-50",
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
        // Avoid mixing shorthand border with border-image to prevent React warnings
        borderWidth: 2,
        borderStyle: borderStyle === 'gradient' ? 'solid' : (isZone ? 'dashed' : 'solid'),
        borderColor: borderStyle === 'gradient' ? 'transparent' : borderColor,
        borderImageSource: borderStyle === 'gradient'
          ? `linear-gradient(135deg, ${borderColors[0]}, ${borderColors[1]})`
          : undefined,
        borderImageSlice: borderStyle === 'gradient' ? 1 : undefined,
        color: textColor,
        margin: group.shadow ? 4 : 0, // Add margin when shadow is enabled to prevent clipping
        ...(group.shadow && { 
          transform: 'translateZ(0)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' // More prominent shadow
        })
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
