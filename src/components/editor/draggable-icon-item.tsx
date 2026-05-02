"use client";

import React, { useRef, useState } from "react";
import { useDrag } from "react-dnd";
import { Card, CardContent } from "../ui/card";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { ItemTypes, emitMobilePaletteDropIfOverCanvas } from "./draggable-item";
import type { IconResourceItem } from "@/lib/icon-resources";

export interface IconDragItem {
  type: string;
  label: string;
  provider: string;
  category: string;
  iconType?: "lucide" | "emoji";
  iconName?: string;
  emoji?: string;
}

interface DraggableIconItemProps {
  iconItem: IconResourceItem;
  onClick?: (dragItem: IconDragItem) => void;
  onDoubleClick?: (dragItem: IconDragItem) => void;
  viewMode?: "normal" | "compact";
}

function slugify(name: string): string {
  return name.replace(/\s+/g, "-").toLowerCase();
}

export function DraggableIconItemInner({
  iconItem,
  onClick,
  onDoubleClick,
  viewMode = "normal",
}: DraggableIconItemProps) {
  const dragItem = React.useMemo(() => {
    if (iconItem.iconType === "lucide") {
      const slug = slugify(iconItem.iconName);
      return {
        type: `generic.icon.${slug}`,
        label: iconItem.name,
        provider: "generic",
        category: "icon",
        iconType: "lucide" as const,
        iconName: iconItem.iconName,
      };
    }
    const slug = slugify(iconItem.name);
    return {
      type: `generic.emoji.${slug}`,
      label: iconItem.name,
      provider: "generic",
      category: "emoji",
      iconType: "emoji" as const,
      emoji: iconItem.emoji,
    };
  }, [iconItem]);

  const [{ isDragging }, drag] = useDrag(
    () => ({
      type: ItemTypes.DIAGRAM_NODE,
      item: dragItem,
      collect: (monitor) => ({
        isDragging: !!monitor.isDragging(),
      }),
    }),
    [dragItem]
  );

  const [isTouchDragging, setIsTouchDragging] = useState(false);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!e.touches?.[0]) return;
    const t = e.touches[0];
    touchStartPos.current = { x: t.clientX, y: t.clientY };
    setIsTouchDragging(true);
    (e.currentTarget as HTMLElement).style.opacity = "0.5";
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPos.current || !e.touches?.[0]) return;
    const t = e.touches[0];
    if (Math.abs(t.clientX - touchStartPos.current.x) > 10 || Math.abs(t.clientY - touchStartPos.current.y) > 10) {
      e.preventDefault();
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartPos.current || !e.changedTouches?.[0]) {
      setIsTouchDragging(false);
      touchStartPos.current = null;
      (e.currentTarget as HTMLElement).style.opacity = "1";
      return;
    }
    const t = e.changedTouches[0];
    const dx = Math.abs(t.clientX - touchStartPos.current.x);
    const dy = Math.abs(t.clientY - touchStartPos.current.y);
    if (dx > 10 || dy > 10) {
      emitMobilePaletteDropIfOverCanvas({
        touchClientX: t.clientX,
        touchClientY: t.clientY,
        item: dragItem,
      });
    }
    (e.currentTarget as HTMLElement).style.opacity = "1";
    setIsTouchDragging(false);
    touchStartPos.current = null;
  };

  const content =
    iconItem.iconType === "lucide" ? (
      <iconItem.IconComponent className="w-6 h-6" />
    ) : (
      <span className="text-2xl leading-none">{iconItem.emoji}</span>
    );

  const isCompact = viewMode === "compact";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          ref={(node) => { if (node) drag(node); }}
          style={{ opacity: isDragging || isTouchDragging ? 0.5 : 1 }}
          className="cursor-move min-w-0"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={() => onClick?.(dragItem)}
          onDoubleClick={() => onDoubleClick?.(dragItem)}
        >
          {isCompact ? (
            <Card className="hover:bg-accent hover:text-accent-foreground transition-colors w-full aspect-square">
              <CardContent className="flex h-full min-h-0 w-full flex-col items-center justify-center p-1 text-center">
                <div className="flex h-full w-full min-h-0 flex-1 items-center justify-center">
                  {iconItem.iconType === "lucide" ? (
                    <iconItem.IconComponent className="h-12 w-12 max-h-[90%] max-w-[90%] shrink-0" />
                  ) : (
                    <span className="text-4xl leading-none">{iconItem.emoji}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="hover:bg-accent hover:text-accent-foreground transition-colors min-w-0">
              <CardContent className="p-2 flex flex-col items-center justify-center gap-1 text-center h-16 min-w-0 w-full">
                <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                  {content}
                </div>
                <div className="w-full min-w-0 overflow-hidden">
                  <span className="font-medium text-xs leading-tight truncate block">
                    {iconItem.name}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>{iconItem.name}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function areDraggableIconItemPropsEqual(prev: DraggableIconItemProps, next: DraggableIconItemProps): boolean {
  return (
    prev.iconItem === next.iconItem &&
    prev.viewMode === next.viewMode &&
    prev.onClick === next.onClick &&
    prev.onDoubleClick === next.onDoubleClick
  );
}

export const DraggableIconItem = React.memo(DraggableIconItemInner, areDraggableIconItemPropsEqual);
