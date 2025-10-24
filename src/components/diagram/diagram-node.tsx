"use client";

import React, { useState } from "react";
import { useDrag } from 'react-dnd';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { AwsIcon } from "./aws-icon";
import type { DiagramNodeData } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ItemTypes } from "../editor/draggable-item";

const NODE_WIDTH = 104;
const NODE_HEIGHT = 100;

interface DiagramNodeProps {
  node: DiagramNodeData & { x: number; y: number };
  isSelected?: boolean;
  isTargetable?: boolean;
}

export function DiagramNode({ node, isSelected, isTargetable }: DiagramNodeProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.CANVAS_NODE,
    item: { id: node.id, x: node.x, y: node.y, type: ItemTypes.CANVAS_NODE, label: node.label },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }), [node.id, node.x, node.y]);


  return (
    <div
      ref={drag}
      className={cn(
        "absolute group transition-transform duration-200 ease-in-out hover:scale-105",
        isSelected && "ring-2 ring-primary ring-offset-2 rounded-lg",
        isDragging && "opacity-50 cursor-grabbing",
        isTargetable && "cursor-crosshair opacity-70 hover:opacity-100"
        )}
      style={{
        left: node.x,
        top: node.y,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
      }}
      onMouseEnter={() => !isDragging && setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <Popover open={isOpen && !isDragging} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <div className="flex flex-col items-center justify-center h-full w-full cursor-pointer">
            <div className={cn(
                "flex items-center justify-center w-20 h-20 rounded-lg bg-card shadow-md border transition-colors",
                isSelected ? "border-primary" : "group-hover:border-accent",
                isTargetable && "border-dashed border-primary"
                )}>
                <AwsIcon type={node.type} className="w-10 h-10" />
            </div>
            <p className="mt-2 text-sm font-medium text-center text-foreground truncate w-full px-1">
              {node.label}
            </p>
          </div>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="center"
          className="w-64 bg-popover text-popover-foreground shadow-xl border-accent"
        >
          <div className="space-y-2">
            <h4 className="font-semibold font-headline text-primary">{node.label}</h4>
            <p className="text-sm">{node.info}</p>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
