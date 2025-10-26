"use client";
import React, { useMemo } from 'react';
import { useDrag } from 'react-dnd';
import { Card, CardContent } from '../ui/card';

interface DraggableItemProps {
    type: string;
    label: string;
    icon: React.ReactNode;
}

export const ItemTypes = {
  DIAGRAM_NODE: 'diagram_node',
  CANVAS_NODE: 'canvas_node',
  GROUP: 'group',
};

export function DraggableItem({ type, label, icon }: DraggableItemProps) {
  const item = useMemo(() => ({ type, label }), [type, label]);
  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.DIAGRAM_NODE,
    item: item,
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }));

  return (
    <div
      ref={drag as any}
      style={{ opacity: isDragging ? 0.5 : 1 }}
      className="cursor-move"
    >
      <Card className="hover:bg-accent hover:text-accent-foreground transition-colors">
        <CardContent className="p-3 flex flex-col items-center justify-center gap-2 text-center h-24">
          <div className="w-8 h-8 flex items-center justify-center">{icon}</div>
          <span className="font-medium text-xs">{label}</span>
        </CardContent>
      </Card>
    </div>
  );
}
