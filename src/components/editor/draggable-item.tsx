"use client";
import React, { useMemo, useRef, useState } from 'react';
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
  const [{ isDragging }, drag, dragPreview] = useDrag(() => ({
    type: ItemTypes.DIAGRAM_NODE,
    item: item,
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }));

  const [isTouchDragging, setIsTouchDragging] = useState(false);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);

  // Touch event handlers for mobile drag and drop
  const handleTouchStart = (e: React.TouchEvent) => {
    try {
      if (!e.touches || e.touches.length === 0) return;
      const touch = e.touches[0];
      touchStartPos.current = { x: touch.clientX, y: touch.clientY };
      setIsTouchDragging(true);
      (e.currentTarget as HTMLElement).style.opacity = '0.5';
    } catch (error) {
      console.error('Touch start error:', error);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    try {
      if (!touchStartPos.current || !e.touches || e.touches.length === 0) return;
      
      const touch = e.touches[0];
      const deltaX = Math.abs(touch.clientX - touchStartPos.current.x);
      const deltaY = Math.abs(touch.clientY - touchStartPos.current.y);
      
      // Only start dragging if moved enough to prevent accidental drags
      if (deltaX > 10 || deltaY > 10) {
        e.preventDefault(); // Prevent scrolling when dragging
      }
    } catch (error) {
      console.error('Touch move error:', error);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    try {
      if (!touchStartPos.current || !e.changedTouches || e.changedTouches.length === 0) return;
      
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
    } catch (error) {
      console.error('Touch end error:', error);
      // Reset state on error
      setIsTouchDragging(false);
      touchStartPos.current = null;
    }
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
        <CardContent className="p-3 flex flex-col items-center justify-center gap-2 text-center h-24">
          <div className="w-8 h-8 flex items-center justify-center">{icon}</div>
          <span className="font-medium text-xs">{label}</span>
        </CardContent>
      </Card>
    </div>
  );
}
